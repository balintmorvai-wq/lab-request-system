from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import jwt
import datetime
from functools import wraps
import json
import os
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image  # v7.0.31: Image QR kódhoz
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import qrcode  # v7.0.31: QR kód generálás

# v8.0: Notification Service
from notification_service import NotificationService


app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')

# v6.6 Production: PostgreSQL support
DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///lab_requests.db')
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Database engine options - különböző SQLite és PostgreSQL esetén
if DATABASE_URL.startswith('sqlite'):
    # SQLite - nincs connect_timeout
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_pre_ping': True,
    }
else:
    # PostgreSQL
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
        'connect_args': {'connect_timeout': 10}
    }

app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['LOGO_FOLDER'] = 'uploads/logos'
app.config['ATTACHMENT_FOLDER'] = 'uploads/attachments'
app.config['RESULT_ATTACHMENT_FOLDER'] = 'uploads/results'  # v7.0: Vizsgálati eredmény fájlok
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # v7.0: 50MB max (vizsgálati eredmények miatt)

# Create upload folders
os.makedirs(app.config['LOGO_FOLDER'], exist_ok=True)
os.makedirs(app.config['ATTACHMENT_FOLDER'], exist_ok=True)
os.makedirs(app.config['RESULT_ATTACHMENT_FOLDER'], exist_ok=True)  # v7.0

# v6.6 Production: CORS with frontend domain
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
# v7.0.18: CORS fix - supports_credentials és resources
CORS(app, 
     resources={r"/api/*": {"origins": [FRONTEND_URL, 'http://localhost:3000', 'https://labsquare.netlify.app']}},
     supports_credentials=True,
     allow_headers=['Content-Type', 'Authorization'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
)

# Lazy database initialization
db = SQLAlchemy()
db.init_app(app)

ALLOWED_LOGO_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
ALLOWED_ATTACHMENT_EXTENSIONS = {'pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png'}

def allowed_file(filename, allowed_extensions):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

# --- Models ---
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(50), nullable=False)
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=True)
    department_id = db.Column(db.Integer, db.ForeignKey('department.id'), nullable=True)  # v7.0: Szervezeti egység (labor staff-nál kötelező)
    phone = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    
    # Kapcsolatok
    department = db.relationship('Department', backref='users')  # v7.0

class Company(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    address = db.Column(db.String(300))
    contact_person = db.Column(db.String(100))
    contact_email = db.Column(db.String(120))
    contact_phone = db.Column(db.String(20))
    logo_filename = db.Column(db.String(200))
    users = db.relationship('User', backref='company', lazy=True)
    # LabRequest kapcsolat a LabRequest oldalon definiálva (backref='lab_requests')

class Department(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False, unique=True)
    description = db.Column(db.Text)
    contact_person = db.Column(db.String(100))
    contact_email = db.Column(db.String(120))
    sample_pickup_address = db.Column(db.String(500))  # ÚJ: Mintaátvétel pontos címe
    sample_pickup_contact = db.Column(db.String(200))  # ÚJ: Mintaátvétel kontakt személy
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class TestType(db.Model):
    """
    Vizsgálattípus model - v6.7 kibővített mezők
    """
    id = db.Column(db.Integer, primary_key=True)
    # Alapadatok
    name = db.Column(db.String(200), nullable=False, unique=True)  # Rövid név
    description = db.Column(db.Text)  # Mérési szolgáltatás, leírás
    standard = db.Column(db.Text)  # Szabvány (lehet hosszú szöveg is)
    
    # Kategória és részleg
    category_id = db.Column(db.Integer, db.ForeignKey('request_category.id'), nullable=True)
    department_id = db.Column(db.Integer, db.ForeignKey('department.id'), nullable=True)
    device = db.Column(db.String(200))  # Készülék
    
    # Árak
    cost_price = db.Column(db.Float, default=0)  # Önköltség (Ft/minta)
    price = db.Column(db.Float, nullable=False)  # Kiajánlási ár (Ft/minta)
    
    # Időadatok (órában)
    measurement_time = db.Column(db.Float, default=0)  # Mérési idő (óra)
    sample_prep_time = db.Column(db.Float, default=0)  # Mintaelőkészítési idő (óra) - csak ha sample_prep_required=True
    evaluation_time = db.Column(db.Float, default=0)  # Kiértékelés (óra)
    turnaround_time = db.Column(db.Float, default=0)  # Átfutási idő (óra)
    turnaround_days = db.Column(db.Integer, nullable=True)  # Átfutási idő napokban (admin tölti ki)
    
    # Minta adatok
    sample_quantity = db.Column(db.String(100))  # Minta mennyiség (szabad szöveg, pl. "50-100 mg")
    sample_prep_required = db.Column(db.Boolean, default=False)  # Mintaelőkészítés szükséges (igen/nem)
    sample_prep_description = db.Column(db.String(200))  # Mintaelőkészítés típusa (pl. "Szárítás, mosás")
    hazard_level = db.Column(db.String(200))  # Veszélyesség (szabad szöveg)
    
    # Státusz
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Kapcsolatok
    department = db.relationship('Department', backref='test_types')
    category = db.relationship('RequestCategory', backref='test_types')

class RequestCategory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    description = db.Column(db.Text)
    color = db.Column(db.String(7), default='#6B7280')  # Hex color
    icon = db.Column(db.String(50), default='Beaker')  # Lucide icon name
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class LabRequest(db.Model):
    """
    Laborkérés model - v6.7 kibővített mezők
    """
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('request_category.id'), nullable=True)
    
    # v6.7: Azonosítók
    request_number = db.Column(db.String(50), unique=True)  # Generált egyedi azonosító (pl. MOL-20241124-001)
    internal_id = db.Column(db.String(100))  # Céges belső azonosító (szabadon szerkeszthető)
    
    # Minta adatok
    sample_id = db.Column(db.String(100), nullable=False)  # Minta azonosító (legacy, most = internal_id)
    sample_description = db.Column(db.Text)  # Minta leírása
    
    # v6.7: Mintavétel idő és hely - egy blokkban
    sampling_datetime = db.Column(db.DateTime)  # Mintavétel időpontja (dátum + óra:perc)
    sampling_location = db.Column(db.String(200))  # Mintavétel helye
    sampling_date = db.Column(db.DateTime)  # Legacy (backward compat)
    
    # v6.7: Minta feladás részletei
    logistics_type = db.Column(db.String(50), default='sender')  # 'sender' = feladó, 'provider' = szolgáltató
    shipping_address = db.Column(db.String(500))  # Pontos cím (ha szolgáltató szállít)
    contact_person = db.Column(db.String(200))  # Kontakt személy
    contact_phone = db.Column(db.String(50))  # Telefon
    sampling_address = db.Column(db.String(500))  # Legacy alias
    
    # Vizsgálatok
    test_types = db.Column(db.Text, nullable=False)  # JSON lista
    total_price = db.Column(db.Float, default=0)
    
    # Prioritás és határidő
    urgency = db.Column(db.String(50))  # 'normal', 'urgent', 'critical'
    deadline = db.Column(db.DateTime, nullable=True)  # Határidő (opcionális)
    
    # Egyéb
    special_instructions = db.Column(db.Text)
    attachment_filename = db.Column(db.String(200))
    
    # Státusz és workflow
    # v7.0.27: Logisztikai modul - új státuszok
    # Workflow: draft → pending_approval → awaiting_shipment → in_transit → arrived_at_provider → in_progress → validation_pending → completed
    status = db.Column(db.String(50), default='draft')
    approved_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    approved_at = db.Column(db.DateTime)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Kapcsolatok - egyedi backref nevek!
    user = db.relationship('User', foreign_keys=[user_id], backref='lab_requests')
    approver = db.relationship('User', foreign_keys=[approved_by])
    category = db.relationship('RequestCategory', backref='lab_requests')
    company = db.relationship('Company', backref='lab_requests')

# v7.0: Vizsgálati eredmények tábla
class TestResult(db.Model):
    """
    Vizsgálati eredmények tárolása
    Minden LabRequest + TestType párhoz tartozik egy eredmény rekord
    """
    id = db.Column(db.Integer, primary_key=True)
    lab_request_id = db.Column(db.Integer, db.ForeignKey('lab_request.id'), nullable=False)
    test_type_id = db.Column(db.Integer, db.ForeignKey('test_type.id'), nullable=False)
    
    # Eredmény adatok
    result_text = db.Column(db.Text)  # Szöveges eredmény
    attachment_filename = db.Column(db.String(200))  # Csatolt fájl neve
    
    # Státusz és követés
    # v7.0.25: Egyszerűsített státuszok
    status = db.Column(db.String(50), default='pending')  # 'pending', 'in_progress', 'completed', 'validation_pending'
    completed_by_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)  # Ki töltötte ki
    completed_at = db.Column(db.DateTime)  # Mikor töltötte ki
    
    # v7.0.3: Admin validation
    validated_by_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)  # Admin aki validálta
    validated_at = db.Column(db.DateTime, nullable=True)  # Mikor validálta
    rejection_reason = db.Column(db.Text, nullable=True)  # Elutasítás indoka
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Kapcsolatok
    lab_request = db.relationship('LabRequest', backref='test_results')
    test_type = db.relationship('TestType', backref='test_results')
    completed_by = db.relationship('User', foreign_keys=[completed_by_user_id], backref='completed_test_results')
    validated_by = db.relationship('User', foreign_keys=[validated_by_user_id], backref='validated_test_results')  # v7.0.3

# ============================================
# v8.0: ABSTRACT NOTIFICATION SYSTEM MODELS
# ============================================

class NotificationEventType(db.Model):
    """
    Értesítési eseménytípusok (pl. status_change, new_request)
    """
    __tablename__ = 'notification_event_types'
    
    id = db.Column(db.Integer, primary_key=True)
    event_key = db.Column(db.String(50), unique=True, nullable=False)
    event_name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    available_variables = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class NotificationTemplate(db.Model):
    """
    Email sablonok értesítésekhez
    """
    __tablename__ = 'notification_templates'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    event_type_id = db.Column(db.Integer, db.ForeignKey('notification_event_types.id'), nullable=False)
    subject = db.Column(db.String(200), nullable=False)
    body_html = db.Column(db.Text, nullable=False)
    variables_used = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    
    event_type = db.relationship('NotificationEventType', backref='templates')

class NotificationRule(db.Model):
    """
    Értesítési szabályok - ki, mikor, hogyan kapjon értesítést
    """
    __tablename__ = 'notification_rules'
    
    id = db.Column(db.Integer, primary_key=True)
    event_type_id = db.Column(db.Integer, db.ForeignKey('notification_event_types.id'), nullable=False)
    role = db.Column(db.String(50), nullable=False)
    event_filter = db.Column(db.Text)
    in_app_enabled = db.Column(db.Integer, default=1)
    email_enabled = db.Column(db.Integer, default=0)
    email_template_id = db.Column(db.Integer, db.ForeignKey('notification_templates.id'), nullable=True)
    priority = db.Column(db.Integer, default=5)
    is_active = db.Column(db.Integer, default=1)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    
    event_type = db.relationship('NotificationEventType', backref='rules')
    email_template = db.relationship('NotificationTemplate', foreign_keys=[email_template_id])

class Notification(db.Model):
    """
    Tényleges értesítések (új event-alapú struktúra)
    """
    __tablename__ = 'notifications'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    event_type_id = db.Column(db.Integer, db.ForeignKey('notification_event_types.id'), nullable=False)
    event_data = db.Column(db.Text)
    message = db.Column(db.Text, nullable=False)
    link_url = db.Column(db.String(200))
    request_id = db.Column(db.Integer, db.ForeignKey('lab_request.id'), nullable=True)
    is_read = db.Column(db.Integer, default=0)
    read_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    
    user = db.relationship('User', backref='notifications')
    event_type = db.relationship('NotificationEventType', backref='notifications')
    request = db.relationship('LabRequest', backref='notifications')

class SMTPSettings(db.Model):
    """
    SMTP beállítások email küldéshez
    """
    __tablename__ = 'smtp_settings'
    
    id = db.Column(db.Integer, primary_key=True)
    smtp_host = db.Column(db.String(100))
    smtp_port = db.Column(db.Integer, default=587)
    smtp_username = db.Column(db.String(100))
    smtp_password = db.Column(db.String(200))
    from_email = db.Column(db.String(100))
    from_name = db.Column(db.String(100))
    use_tls = db.Column(db.Integer, default=1)
    is_active = db.Column(db.Integer, default=0)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

# ============================================
# END OF v8.0 NOTIFICATION MODELS
# ============================================

# --- Request Number Generator ---
def generate_request_number(company_short_name):
    """
    Generál egyedi kérés azonosítót
    Formátum: {CÉG_RÖVID}-{YYYYMMDD}-{SORSZÁM}
    Példa: MOL-20241124-001
    """
    today = datetime.datetime.now()
    date_str = today.strftime('%Y%m%d')
    
    # Cég rövid név normalizálása (max 5 karakter, uppercase, ékezet nélkül)
    import unicodedata
    short = unicodedata.normalize('NFKD', company_short_name or 'LAB')
    short = short.encode('ASCII', 'ignore').decode('ASCII')
    short = ''.join(c for c in short if c.isalnum())[:5].upper() or 'LAB'
    
    # Mai napon belüli sorszám keresése
    prefix = f"{short}-{date_str}-"
    
    # Utolsó mai kérés keresése ezzel a prefix-szel
    last_request = LabRequest.query.filter(
        LabRequest.request_number.like(f"{prefix}%")
    ).order_by(LabRequest.request_number.desc()).first()
    
    if last_request and last_request.request_number:
        try:
            last_num = int(last_request.request_number.split('-')[-1])
            next_num = last_num + 1
        except (ValueError, IndexError):
            next_num = 1
    else:
        next_num = 1
    
    return f"{prefix}{next_num:03d}"

# --- Notification Helper ---
# v8.0: create_notification ELTÁVOLÍTVA - NotificationService használata
# --- Auth Decorators ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # v7.0.10: Token header-ből VAGY query parameter-ből
        token = request.headers.get('Authorization')
        
        # Ha nincs header-ben, próbáljuk query param-ból
        if not token:
            token = request.args.get('token')
        
        if not token:
            return jsonify({'message': 'Token hiányzik!'}), 401
        
        try:
            # Bearer prefix eltávolítása ha van
            if token.startswith('Bearer '):
                token = token[7:]
            
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.get(data['user_id'])
            
            if not current_user:
                return jsonify({'message': 'User nem található!'}), 401
                
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token lejárt!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token érvénytelen!'}), 401
        except Exception as e:
            return jsonify({'message': f'Token hiba: {str(e)}'}), 401
            
        return f(current_user, *args, **kwargs)
    return decorated

def role_required(*roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(current_user, *args, **kwargs):
            if current_user.role not in roles:
                return jsonify({'message': 'Nincs jogosultságod ehhez a művelethez!'}), 403
            return f(current_user, *args, **kwargs)
        return decorated_function
    return decorator

# --- Auth Routes ---
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data.get('email')).first()
    if not user or not check_password_hash(user.password, data.get('password')):
        return jsonify({'message': 'Hibás email vagy jelszó!'}), 401
    token = jwt.encode({
        'user_id': user.id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }, app.config['SECRET_KEY'], algorithm="HS256")
    return jsonify({
        'token': token,
        'user': {
            'id': user.id,
            'email': user.email,
            'name': user.name,
            'role': user.role,
            'company_id': user.company_id,
            'company_name': user.company.name if user.company else None,  # v7.0.17
            'company_logo': user.company.logo_filename if user.company else None,  # v7.0.17
            'department_id': user.department_id,  # v7.0.1: Add department_id
            'department_name': user.department.name if user.department else None  # v7.0.1: Add department_name
        }
    })

@app.route('/api/auth/me', methods=['GET'])
@token_required
def get_current_user(current_user):
    return jsonify({
        'id': current_user.id,
        'email': current_user.email,
        'name': current_user.name,
        'role': current_user.role,
        'company_id': current_user.company_id,
        'company_name': current_user.company.name if current_user.company else None,  # v7.0.17
        'company_logo': current_user.company.logo_filename if current_user.company else None,  # v7.0.17
        'department_id': current_user.department_id,  # v7.0.1: Add department_id
        'department_name': current_user.department.name if current_user.department else None,  # v7.0.1: Add department_name
        'phone': current_user.phone
    })

# --- Request Categories Routes (NEW) ---
@app.route('/api/categories', methods=['GET'])
@token_required
def get_categories(current_user):
    if current_user.role == 'super_admin':
        categories = RequestCategory.query.all()
    else:
        categories = RequestCategory.query.filter_by(is_active=True).all()
    
    return jsonify([{
        'id': cat.id,
        'name': cat.name,
        'description': cat.description,
        'color': cat.color,
        'icon': cat.icon,
        'is_active': cat.is_active
    } for cat in categories])

@app.route('/api/categories', methods=['POST'])
@token_required
@role_required('super_admin')
def create_category(current_user):
    data = request.get_json()
    
    if RequestCategory.query.filter_by(name=data.get('name')).first():
        return jsonify({'message': 'Ez a kategória már létezik!'}), 400
    
    new_category = RequestCategory(
        name=data.get('name'),
        description=data.get('description'),
        color=data.get('color', '#6B7280'),
        icon=data.get('icon', 'Beaker')
    )
    db.session.add(new_category)
    db.session.commit()
    return jsonify({'message': 'Kategória létrehozva!', 'id': new_category.id}), 201

@app.route('/api/categories/<int:category_id>', methods=['PUT'])
@token_required
@role_required('super_admin')
def update_category(current_user, category_id):
    category = RequestCategory.query.get_or_404(category_id)
    data = request.get_json()
    
    if 'name' in data:
        category.name = data['name']
    if 'description' in data:
        category.description = data['description']
    if 'color' in data:
        category.color = data['color']
    if 'icon' in data:
        category.icon = data['icon']
    if 'is_active' in data:
        category.is_active = data['is_active']
    
    category.updated_at = datetime.datetime.utcnow()
    db.session.commit()
    return jsonify({'message': 'Kategória frissítve!'})

@app.route('/api/categories/<int:category_id>', methods=['DELETE'])
@token_required
@role_required('super_admin')
def delete_category(current_user, category_id):
    category = RequestCategory.query.get_or_404(category_id)
    db.session.delete(category)
    db.session.commit()
    return jsonify({'message': 'Kategória törölve!'})

# --- OLD Notifications Routes REMOVED (v8.0) ---
# Replaced with new NotificationService API at line 2670+

@app.route('/api/admin/reseed', methods=['POST'])
@token_required
@role_required('super_admin')
def admin_reseed(current_user):
    """Admin endpoint to update seed data (categories, test types)"""
    try:
        update_seed_data()
        return jsonify({'message': 'Seed adatok sikeresen frissítve!', 'success': True})
    except Exception as e:
        return jsonify({'message': f'Hiba: {str(e)}', 'success': False}), 500
    
    return jsonify({'message': 'Összes értesítés megjelölve'})

@app.route('/api/notifications/unread-count', methods=['GET'])
@token_required
def get_unread_count(current_user):
    count = Notification.query.filter_by(user_id=current_user.id, is_read=False).count()
    return jsonify({'count': count})

# --- Companies Routes ---
@app.route('/api/companies', methods=['GET'])
@token_required
def get_companies(current_user):
    companies = Company.query.all()
    return jsonify([{
        'id': company.id,
        'name': company.name,
        'address': company.address,
        'contact_person': company.contact_person,
        'contact_email': company.contact_email,
        'contact_phone': company.contact_phone,
        'logo_filename': company.logo_filename
    } for company in companies])

@app.route('/api/companies/<int:company_id>', methods=['PUT'])
@token_required
@role_required('super_admin')
def update_company(current_user, company_id):
    company = Company.query.get_or_404(company_id)
    data = request.get_json()
    
    if 'name' in data:
        company.name = data['name']
    if 'address' in data:
        company.address = data['address']
    if 'contact_person' in data:
        company.contact_person = data['contact_person']
    if 'contact_email' in data:
        company.contact_email = data['contact_email']
    if 'contact_phone' in data:
        company.contact_phone = data['contact_phone']
    
    db.session.commit()
    return jsonify({'message': 'Cég frissítve!'})

@app.route('/api/companies/<int:company_id>/logo', methods=['POST'])
@token_required
@role_required('super_admin')
def upload_company_logo(current_user, company_id):
    company = Company.query.get_or_404(company_id)
    
    if 'logo' not in request.files:
        return jsonify({'message': 'Nincs fájl!'}), 400
    
    file = request.files['logo']
    
    if file.filename == '':
        return jsonify({'message': 'Nincs kiválasztva fájl!'}), 400
    
    if file and allowed_file(file.filename, ALLOWED_LOGO_EXTENSIONS):
        filename = secure_filename(f"company_{company_id}_{datetime.datetime.now().timestamp()}.{file.filename.rsplit('.', 1)[1].lower()}")
        filepath = os.path.join(app.config['LOGO_FOLDER'], filename)
        file.save(filepath)
        
        if company.logo_filename:
            old_path = os.path.join(app.config['LOGO_FOLDER'], company.logo_filename)
            if os.path.exists(old_path):
                os.remove(old_path)
        
        company.logo_filename = filename
        db.session.commit()
        
        return jsonify({'message': 'Logó feltöltve!', 'filename': filename})
    
    return jsonify({'message': 'Nem engedélyezett fájltípus!'}), 400

@app.route('/api/companies/<int:company_id>/logo', methods=['GET'])
def get_company_logo(company_id):
    company = Company.query.get_or_404(company_id)
    
    if not company.logo_filename:
        return jsonify({'message': 'Nincs logó!'}), 404
    
    filepath = os.path.join(app.config['LOGO_FOLDER'], company.logo_filename)
    
    if not os.path.exists(filepath):
        return jsonify({'message': 'Fájl nem található!'}), 404
    
    return send_file(filepath)

# --- Departments Routes ---
@app.route('/api/departments', methods=['GET'])
@token_required
def get_departments(current_user):
    if current_user.role == 'super_admin':
        departments = Department.query.all()
    else:
        departments = Department.query.filter_by(is_active=True).all()
    
    return jsonify([{
        'id': dept.id,
        'name': dept.name,
        'description': dept.description,
        'contact_person': dept.contact_person,
        'contact_email': dept.contact_email,
        'is_active': dept.is_active
    } for dept in departments])

@app.route('/api/departments', methods=['POST'])
@token_required
@role_required('super_admin')
def create_department(current_user):
    data = request.get_json()
    
    if Department.query.filter_by(name=data.get('name')).first():
        return jsonify({'message': 'Ez a szervezeti egység már létezik!'}), 400
    
    new_dept = Department(
        name=data.get('name'),
        description=data.get('description'),
        contact_person=data.get('contact_person'),
        contact_email=data.get('contact_email')
    )
    db.session.add(new_dept)
    db.session.commit()
    return jsonify({'message': 'Szervezeti egység létrehozva!', 'id': new_dept.id}), 201

@app.route('/api/departments/<int:dept_id>', methods=['PUT'])
@token_required
@role_required('super_admin')
def update_department(current_user, dept_id):
    dept = Department.query.get_or_404(dept_id)
    data = request.get_json()
    
    if 'name' in data:
        dept.name = data['name']
    if 'description' in data:
        dept.description = data['description']
    if 'contact_person' in data:
        dept.contact_person = data['contact_person']
    if 'contact_email' in data:
        dept.contact_email = data['contact_email']
    if 'is_active' in data:
        dept.is_active = data['is_active']
    
    dept.updated_at = datetime.datetime.utcnow()
    db.session.commit()
    return jsonify({'message': 'Szervezeti egység frissítve!'})

@app.route('/api/departments/<int:dept_id>', methods=['DELETE'])
@token_required
@role_required('super_admin')
def delete_department(current_user, dept_id):
    dept = Department.query.get_or_404(dept_id)
    db.session.delete(dept)
    db.session.commit()
    return jsonify({'message': 'Szervezeti egység törölve!'})

# --- Test Types Routes ---
@app.route('/api/test-types', methods=['GET'])
@token_required
def get_test_types(current_user):
    if current_user.role == 'super_admin':
        test_types = TestType.query.all()
    else:
        test_types = TestType.query.filter_by(is_active=True).all()
    
    return jsonify([{
        'id': tt.id,
        'name': tt.name,
        'description': tt.description,
        'standard': tt.standard,
        'price': tt.price,
        'cost_price': tt.cost_price,
        'department_id': tt.department_id,
        'department_name': tt.department.name if tt.department else None,
        'category_id': tt.category_id,
        'category_name': tt.category.name if tt.category else None,
        'category_color': tt.category.color if tt.category else None,
        'device': tt.device,
        'turnaround_days': tt.turnaround_days,
        'turnaround_time': tt.turnaround_time,
        'measurement_time': tt.measurement_time,
        'sample_prep_time': tt.sample_prep_time,
        'sample_prep_required': tt.sample_prep_required,
        'sample_prep_description': tt.sample_prep_description,
        'evaluation_time': tt.evaluation_time,
        'sample_quantity': tt.sample_quantity,
        'hazard_level': tt.hazard_level,
        'is_active': tt.is_active
    } for tt in test_types])

@app.route('/api/test-types', methods=['POST'])
@token_required
@role_required('super_admin')
def create_test_type(current_user):
    data = request.get_json()
    
    if TestType.query.filter_by(name=data.get('name')).first():
        return jsonify({'message': 'Ez a vizsgálattípus már létezik!'}), 400
    
    # Üres string-eket None-ra konvertálás
    department_id = data.get('department_id')
    if department_id == '':
        department_id = None
    
    category_id = data.get('category_id')
    if category_id == '':
        category_id = None
    
    new_test_type = TestType(
        name=data.get('name'),
        description=data.get('description'),
        standard=data.get('standard'),
        price=float(data.get('price', 0)),
        cost_price=float(data.get('cost_price', 0)) if data.get('cost_price') else 0,
        department_id=department_id,
        category_id=category_id,
        device=data.get('device'),
        turnaround_days=int(data.get('turnaround_days')) if data.get('turnaround_days') else None,
        turnaround_time=float(data.get('turnaround_time', 0)) if data.get('turnaround_time') else 0,
        measurement_time=float(data.get('measurement_time', 0)) if data.get('measurement_time') else 0,
        sample_prep_time=float(data.get('sample_prep_time', 0)) if data.get('sample_prep_time') else 0,
        sample_prep_required=data.get('sample_prep_required', False),
        sample_prep_description=data.get('sample_prep_description'),
        evaluation_time=float(data.get('evaluation_time', 0)) if data.get('evaluation_time') else 0,
        sample_quantity=data.get('sample_quantity'),
        hazard_level=data.get('hazard_level'),
        is_active=data.get('is_active', True)
    )
    db.session.add(new_test_type)
    db.session.commit()
    return jsonify({'message': 'Vizsgálattípus létrehozva!', 'id': new_test_type.id}), 201

@app.route('/api/test-types/<int:test_type_id>', methods=['PUT'])
@token_required
@role_required('super_admin')
def update_test_type(current_user, test_type_id):
    test_type = TestType.query.get_or_404(test_type_id)
    data = request.get_json()
    
    if 'name' in data:
        test_type.name = data['name']
    if 'description' in data:
        test_type.description = data['description']
    if 'standard' in data:
        test_type.standard = data['standard']
    if 'price' in data:
        test_type.price = float(data['price'])
    if 'cost_price' in data:
        test_type.cost_price = float(data['cost_price']) if data['cost_price'] else 0
    if 'department_id' in data:
        test_type.department_id = data['department_id'] if data['department_id'] != '' else None
    if 'category_id' in data:
        test_type.category_id = data['category_id'] if data['category_id'] != '' else None
    if 'device' in data:
        test_type.device = data['device']
    if 'turnaround_days' in data:
        test_type.turnaround_days = int(data['turnaround_days']) if data['turnaround_days'] else None
    if 'turnaround_time' in data:
        test_type.turnaround_time = float(data['turnaround_time']) if data['turnaround_time'] else 0
    if 'measurement_time' in data:
        test_type.measurement_time = float(data['measurement_time']) if data['measurement_time'] else 0
    if 'sample_prep_time' in data:
        test_type.sample_prep_time = float(data['sample_prep_time']) if data['sample_prep_time'] else 0
    if 'sample_prep_required' in data:
        test_type.sample_prep_required = data['sample_prep_required']
    if 'sample_prep_description' in data:
        test_type.sample_prep_description = data['sample_prep_description']
    if 'evaluation_time' in data:
        test_type.evaluation_time = float(data['evaluation_time']) if data['evaluation_time'] else 0
    if 'sample_quantity' in data:
        test_type.sample_quantity = data['sample_quantity']
    if 'hazard_level' in data:
        test_type.hazard_level = data['hazard_level']
    if 'is_active' in data:
        test_type.is_active = data['is_active']
    
    test_type.updated_at = datetime.datetime.utcnow()
    db.session.commit()
    return jsonify({'message': 'Vizsgálattípus frissítve!'})

@app.route('/api/test-types/<int:test_type_id>', methods=['DELETE'])
@token_required
@role_required('super_admin')
def delete_test_type(current_user, test_type_id):
    test_type = TestType.query.get_or_404(test_type_id)
    db.session.delete(test_type)
    db.session.commit()
    return jsonify({'message': 'Vizsgálattípus törölve!'})

# v7.0.15: Export/Import endpoints (karbantartókhoz)
@app.route('/api/export/test-types', methods=['GET'])
@token_required
@role_required('super_admin')
def export_test_types(current_user):
    """Export test types in multiple formats: JSON, CSV, Excel"""
    try:
        format_type = request.args.get('format', 'json')  # json, csv, excel
        
        test_types = TestType.query.all()
        
        data = []
        for tt in test_types:
            data.append({
                'id': tt.id,
                'name': tt.name,
                'description': tt.description,
                'standard': tt.standard,
                'price': float(tt.price) if tt.price else None,
                'cost_price': float(tt.cost_price) if tt.cost_price else None,
                'turnaround_days': tt.turnaround_days,
                'turnaround_time': tt.turnaround_time,
                'measurement_time': tt.measurement_time,
                'sample_prep_time': tt.sample_prep_time,
                'sample_prep_required': tt.sample_prep_required,
                'sample_prep_description': tt.sample_prep_description,
                'evaluation_time': tt.evaluation_time,
                'sample_quantity': tt.sample_quantity,
                'hazard_level': tt.hazard_level,
                'device': tt.device,
                'department_id': tt.department_id,
                'department_name': tt.department.name if tt.department else None,
                'category_id': tt.category_id,
                'category_name': tt.category.name if tt.category else None
            })
        
        if format_type == 'json':
            return jsonify({
                'test_types': data,
                'exported_at': datetime.datetime.utcnow().isoformat(),
                'total_count': len(data)
            })
        
        elif format_type == 'csv':
            import csv
            from io import StringIO
            
            output = StringIO()
            if len(data) > 0:
                writer = csv.DictWriter(output, fieldnames=data[0].keys())
                writer.writeheader()
                writer.writerows(data)
            
            response = Response(output.getvalue(), mimetype='text/csv')
            response.headers['Content-Disposition'] = f'attachment; filename=test_types_{datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.csv'
            return response
        
        elif format_type == 'excel':
            try:
                import pandas as pd
                from io import BytesIO
                
                df = pd.DataFrame(data)
                output = BytesIO()
                
                with pd.ExcelWriter(output, engine='openpyxl') as writer:
                    df.to_excel(writer, sheet_name='Test Types', index=False)
                
                output.seek(0)
                response = Response(output.getvalue(), mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                response.headers['Content-Disposition'] = f'attachment; filename=test_types_{datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.xlsx'
                return response
            except ImportError as e:
                return jsonify({'error': f'pandas vagy openpyxl nincs telepítve: {str(e)}'}), 500
        
        else:
            return jsonify({'error': 'Érvénytelen formátum. Használj: json, csv, excel'}), 400
    
    except Exception as e:
        print(f"Export hiba: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Export hiba: {str(e)}'}), 500

@app.route('/api/import/test-types', methods=['POST'])
@token_required
@role_required('super_admin')
def import_test_types(current_user):
    """Import test types from JSON or CSV"""
    if 'file' not in request.files:
        return jsonify({'error': 'Nincs fájl feltöltve'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'Üres fájlnév'}), 400
    
    try:
        # Determine file type
        if file.filename.endswith('.json'):
            data = json.load(file)
            if 'test_types' in data:
                test_types_data = data['test_types']
            else:
                test_types_data = data
        
        elif file.filename.endswith('.csv'):
            import pandas as pd
            df = pd.read_csv(file)
            test_types_data = df.to_dict('records')
        
        elif file.filename.endswith('.xlsx') or file.filename.endswith('.xls'):
            import pandas as pd
            df = pd.read_excel(file, sheet_name='Test Types')
            test_types_data = df.to_dict('records')
        
        else:
            return jsonify({'error': 'Nem támogatott fájl formátum. Használj JSON, CSV vagy Excel fájlt.'}), 400
        
        # Import/update test types
        created = 0
        updated = 0
        errors = []
        
        for item in test_types_data:
            try:
                # Check if exists (by id or name)
                existing = None
                if 'id' in item and item['id']:
                    existing = TestType.query.get(item['id'])
                
                if not existing and 'name' in item:
                    existing = TestType.query.filter_by(name=item['name']).first()
                
                if existing:
                    # Update
                    for key, value in item.items():
                        if key not in ['id', 'department_name', 'category_name'] and hasattr(existing, key):
                            # Handle NaN/None values
                            if pd.isna(value) if 'pandas' in str(type(value)) else value is None:
                                value = None
                            setattr(existing, key, value)
                    updated += 1
                else:
                    # Create new
                    new_test_type = TestType(
                        name=item.get('name'),
                        description=item.get('description'),
                        standard=item.get('standard'),
                        price=item.get('price'),
                        cost_price=item.get('cost_price'),
                        turnaround_days=item.get('turnaround_days'),
                        turnaround_time=item.get('turnaround_time'),
                        measurement_time=item.get('measurement_time'),
                        sample_prep_time=item.get('sample_prep_time'),
                        sample_prep_required=item.get('sample_prep_required', False),
                        sample_prep_description=item.get('sample_prep_description'),
                        evaluation_time=item.get('evaluation_time'),
                        sample_quantity=item.get('sample_quantity'),
                        hazard_level=item.get('hazard_level'),
                        device=item.get('device'),
                        department_id=item.get('department_id'),
                        category_id=item.get('category_id')
                    )
                    db.session.add(new_test_type)
                    created += 1
            
            except Exception as e:
                errors.append(f"Hiba ({item.get('name', 'unknown')}): {str(e)}")
        
        db.session.commit()
        
        return jsonify({
            'message': 'Import sikeres!',
            'created': created,
            'updated': updated,
            'errors': errors
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Import hiba: {str(e)}'}), 500

# --- Lab Requests Routes ---
def get_test_type_details(test_type_ids):
    """Return detailed test type info for a request"""
    try:
        ids = json.loads(test_type_ids)
        test_types = TestType.query.filter(TestType.id.in_(ids)).all()
        return [{
            'id': tt.id,
            'name': tt.name,
            'description': tt.description,
            'standard': tt.standard,
            'price': tt.price,
            'cost_price': tt.cost_price,
            'turnaround_days': tt.turnaround_days,
            'turnaround_time': tt.turnaround_time,
            'measurement_time': tt.measurement_time,
            'sample_prep_time': tt.sample_prep_time,
            'sample_prep_required': tt.sample_prep_required,
            'sample_prep_description': tt.sample_prep_description,
            'evaluation_time': tt.evaluation_time,
            'sample_quantity': tt.sample_quantity,
            'hazard_level': tt.hazard_level,
            'device': tt.device,
            'department_name': tt.department.name if tt.department else None,
            'category_name': tt.category.name if tt.category else None
        } for tt in test_types]
    except:
        return []

@app.route('/api/requests', methods=['GET'])
@token_required
def get_requests(current_user):
    if current_user.role == 'super_admin':
        requests = LabRequest.query.all()
    elif current_user.role == 'labor_staff':
        # v7.0.27: Labor staff in_progress, validation_pending, completed ÉS arrived_at_provider (logisztikai)
        requests = LabRequest.query.filter(
            LabRequest.status.in_(['arrived_at_provider', 'in_progress', 'validation_pending', 'completed'])
        ).all()
    elif current_user.role == 'company_admin':
        requests = LabRequest.query.filter_by(company_id=current_user.company_id).all()
    else:
        requests = LabRequest.query.filter_by(user_id=current_user.id).all()
    
    return jsonify([{
        'id': req.id,
        # v6.7 azonosítók
        'request_number': req.request_number,
        'internal_id': req.internal_id,
        'sample_id': req.sample_id,  # Legacy
        # Minta
        'sample_description': req.sample_description,
        'sampling_datetime': req.sampling_datetime.isoformat() if req.sampling_datetime else None,
        'sampling_location': req.sampling_location,
        'sampling_date': req.sampling_date.isoformat() if req.sampling_date else None,
        # Feladás
        'logistics_type': req.logistics_type,
        'shipping_address': req.shipping_address,
        'contact_person': req.contact_person,
        'contact_phone': req.contact_phone,
        # Vizsgálatok
        'test_types': get_test_type_details(req.test_types),
        'total_price': req.total_price,
        # Prioritás
        'urgency': req.urgency,
        'deadline': req.deadline.isoformat() if req.deadline else None,
        # Egyéb
        'special_instructions': req.special_instructions,
        'attachment_filename': req.attachment_filename,
        'status': req.status,
        'category': {
            'id': req.category.id,
            'name': req.category.name,
            'color': req.category.color
        } if req.category else None,
        'created_at': req.created_at.isoformat(),
        'user_name': req.user.name,
        'company_name': req.company.name if req.company else None,
        'approved_by': req.approver.name if req.approver else None,
        'approved_at': req.approved_at.isoformat() if req.approved_at else None
    } for req in requests])

@app.route('/api/requests/<int:request_id>', methods=['GET'])
@token_required
def get_request_detail(current_user, request_id):
    req = LabRequest.query.get_or_404(request_id)
    
    if current_user.role == 'company_user' and req.user_id != current_user.id:
        return jsonify({'message': 'Nincs jogosultságod!'}), 403
    
    if current_user.role == 'company_admin' and req.company_id != current_user.company_id:
        return jsonify({'message': 'Nincs jogosultságod!'}), 403
    
    return jsonify({
        'id': req.id,
        # v6.7 azonosítók
        'request_number': req.request_number,
        'internal_id': req.internal_id,
        'sample_id': req.sample_id,  # Legacy
        # Minta adatok
        'sample_description': req.sample_description,
        'sampling_datetime': req.sampling_datetime.isoformat() if req.sampling_datetime else None,
        'sampling_location': req.sampling_location,
        'sampling_date': req.sampling_date.isoformat() if req.sampling_date else None,  # Legacy
        # v6.7 feladás
        'logistics_type': req.logistics_type or 'sender',
        'shipping_address': req.shipping_address,
        'contact_person': req.contact_person,
        'contact_phone': req.contact_phone,
        'sampling_address': req.sampling_address,  # Legacy
        # Vizsgálatok
        'test_types': get_test_type_details(req.test_types),
        'total_price': req.total_price,
        # Prioritás
        'urgency': req.urgency,
        'deadline': req.deadline.isoformat() if req.deadline else None,
        # Egyéb
        'special_instructions': req.special_instructions,
        'attachment_filename': req.attachment_filename,
        # Státusz
        'status': req.status,
        'category_id': req.category_id,
        'category': {
            'id': req.category.id,
            'name': req.category.name,
            'color': req.category.color
        } if req.category else None,
        # Meta
        'created_at': req.created_at.isoformat(),
        'user_name': req.user.name,
        'user_email': req.user.email,
        'user_phone': req.user.phone,
        'company_name': req.company.name if req.company else None,
        'approved_by': req.approver.name if req.approver else None,
        'approved_at': req.approved_at.isoformat() if req.approved_at else None
    })

@app.route('/api/requests', methods=['POST'])
@token_required
def create_request(current_user):
    data = request.form.to_dict()
    
    test_type_ids = json.loads(data.get('test_types', '[]'))
    total_price = 0
    if test_type_ids:
        test_types = TestType.query.filter(TestType.id.in_(test_type_ids)).all()
        total_price = sum(tt.price for tt in test_types)
    
    # v6.7: Parse datetime with time
    sampling_datetime = None
    if data.get('sampling_datetime'):
        try:
            sampling_datetime = datetime.datetime.fromisoformat(data.get('sampling_datetime'))
        except:
            pass
    
    # Legacy sampling_date support (v7.0.25: fix empty string crash)
    sampling_date = None
    if data.get('sampling_date') and data.get('sampling_date').strip():
        try:
            sampling_date = datetime.datetime.fromisoformat(data.get('sampling_date'))
        except:
            pass
    
    # Deadline parsing (v7.0.25: fix empty string crash)
    deadline = None
    if data.get('deadline') and data.get('deadline').strip():
        try:
            deadline = datetime.datetime.fromisoformat(data.get('deadline'))
        except:
            pass
    
    # v6.7: Generate request number
    company = Company.query.get(current_user.company_id)
    company_short = company.name[:5] if company else 'LAB'
    request_number = generate_request_number(company_short)
    
    new_request = LabRequest(
        user_id=current_user.id,
        company_id=current_user.company_id,
        # v6.7 azonosítók
        request_number=request_number,
        internal_id=data.get('internal_id', ''),
        # Minta adatok
        sample_id=data.get('sample_id') or data.get('internal_id', ''),
        sample_description=data.get('sample_description'),
        # v6.7 mintavétel
        sampling_datetime=sampling_datetime,
        sampling_location=data.get('sampling_location'),
        sampling_date=sampling_date,  # Legacy
        # v6.7 feladás
        logistics_type=data.get('logistics_type', 'sender'),
        shipping_address=data.get('shipping_address'),
        contact_person=data.get('contact_person'),
        contact_phone=data.get('contact_phone'),
        sampling_address=data.get('shipping_address'),  # Legacy alias
        # Vizsgálatok
        test_types=json.dumps(test_type_ids),
        total_price=total_price,
        # Prioritás
        urgency=data.get('urgency', 'normal'),
        deadline=deadline,
        # Státusz
        # v7.0.29: Company admin jóváhagyásra küldésnél automatikusan awaiting_shipment (átugrik jóváhagyás)
        status='awaiting_shipment' if (current_user.role == 'company_admin' and data.get('status') == 'pending_approval') else data.get('status', 'draft'),
        special_instructions=data.get('special_instructions')
    )
    
    # Handle file attachment
    if 'attachment' in request.files:
        file = request.files['attachment']
        if file and file.filename and allowed_file(file.filename, ALLOWED_ATTACHMENT_EXTENSIONS):
            filename = secure_filename(f"req_{datetime.datetime.now().timestamp()}_{file.filename}")
            filepath = os.path.join(app.config['ATTACHMENT_FOLDER'], filename)
            file.save(filepath)
            new_request.attachment_filename = filename
    
    db.session.add(new_request)
    
    # Single commit for request
    db.session.commit()
    
    # v8.0: Notification Service - új kérés létrehozva
    event_data = {
        'request_number': new_request.request_number,
        'company_name': new_request.company.name if new_request.company else '',
        'requester_name': current_user.name,
        'category': new_request.category.name if new_request.category else ''
    }
    NotificationService.notify('new_request', request_id=new_request.id, event_data=event_data)
    
    # v7.0: Automatikus TestResult rekordok létrehozása minden vizsgálathoz
    # v7.0.1: Fix - use test_type_ids already parsed above (line 911)
    for tt_id in test_type_ids:
        result = TestResult(
            lab_request_id=new_request.id,
            test_type_id=tt_id,
            status='pending'
        )
        db.session.add(result)
    db.session.commit()
    
    return jsonify({
        'message': 'Laborkérés sikeresen létrehozva!', 
        'id': new_request.id,
        'request_number': new_request.request_number
    }), 201

@app.route('/api/requests/<int:request_id>', methods=['PUT'])
@token_required
def update_request(current_user, request_id):
    req = LabRequest.query.get_or_404(request_id)
    data = request.form.to_dict()
    
    if current_user.role == 'company_user' and req.user_id != current_user.id:
        return jsonify({'message': 'Nincs jogosultságod!'}), 403
    
    old_status = req.status
    
    # Update fields
    if 'status' in data:
        old_status_value = old_status
        new_status_value = data['status']
        req.status = new_status_value
        
        # Legacy support: submitted → arrived_at_provider
        if new_status_value == 'submitted':
            new_status_value = 'arrived_at_provider'
            req.status = new_status_value
        
        # v8.0: Státuszváltozás notification
        if new_status_value != old_status_value:
            event_data = {
                'request_number': req.request_number,
                'old_status': old_status_value,
                'new_status': new_status_value,
                'company_name': req.company.name if req.company else '',
                'requester_name': req.user.name
            }
            NotificationService.notify('status_change', request_id=req.id, event_data=event_data)
        
        # v8.0: Jóváhagyás (pending_approval → awaiting_shipment)
        if new_status_value == 'awaiting_shipment' and current_user.role == 'company_admin' and old_status_value == 'pending_approval':
            req.approved_by = current_user.id
            req.approved_at = datetime.datetime.utcnow()
            
            approval_data = {
                'request_number': req.request_number,
                'approver_name': current_user.name,
                'company_name': req.company.name if req.company else ''
            }
            NotificationService.notify('request_approved', request_id=req.id, event_data=approval_data)
    
    if 'sample_id' in data:
        req.sample_id = data['sample_id']
    if 'sample_description' in data:
        req.sample_description = data['sample_description']
    if 'urgency' in data:
        req.urgency = data['urgency']
    if 'sampling_location' in data:
        req.sampling_location = data['sampling_location']
    if 'sampling_address' in data:
        req.sampling_address = data['sampling_address']      # ÚJ
    if 'contact_person' in data:
        req.contact_person = data['contact_person']          # ÚJ
    if 'contact_phone' in data:
        req.contact_phone = data['contact_phone']            # ÚJ
    if 'sampling_date' in data:
        if data['sampling_date'] and data['sampling_date'].strip():
            try:
                req.sampling_date = datetime.datetime.fromisoformat(data['sampling_date'])
            except:
                req.sampling_date = None
        else:
            req.sampling_date = None
    if 'deadline' in data:
        if data['deadline'] and data['deadline'].strip():
            try:
                req.deadline = datetime.datetime.fromisoformat(data['deadline'])
            except:
                req.deadline = None
        else:
            req.deadline = None
    if 'special_instructions' in data:
        req.special_instructions = data['special_instructions']
    if 'test_types' in data:
        test_type_ids = json.loads(data['test_types'])
        req.test_types = json.dumps(test_type_ids)
        test_types = TestType.query.filter(TestType.id.in_(test_type_ids)).all()
        req.total_price = sum(tt.price for tt in test_types)
    
    # Handle new attachment
    if 'attachment' in request.files:
        file = request.files['attachment']
        if file and file.filename and allowed_file(file.filename, ALLOWED_ATTACHMENT_EXTENSIONS):
            # Delete old attachment
            if req.attachment_filename:
                old_path = os.path.join(app.config['ATTACHMENT_FOLDER'], req.attachment_filename)
                if os.path.exists(old_path):
                    os.remove(old_path)
            
            filename = secure_filename(f"req_{datetime.datetime.now().timestamp()}_{file.filename}")
            filepath = os.path.join(app.config['ATTACHMENT_FOLDER'], filename)
            file.save(filepath)
            req.attachment_filename = filename
    
    req.updated_at = datetime.datetime.utcnow()
    db.session.commit()
    
    return jsonify({'message': 'Laborkérés sikeresen frissítve!'})

# v6.8 - DELETE endpoint laborkérésekhez
@app.route('/api/requests/<int:request_id>', methods=['DELETE'])
@token_required
def delete_request(current_user, request_id):
    req = LabRequest.query.get_or_404(request_id)
    
    # Jogosultság ellenőrzése
    # Super admin mindent törölhet
    # Company admin és company user csak saját draft státuszú kéréseket törölhetnek
    if current_user.role == 'super_admin':
        # Admin mindent törölhet
        pass
    elif current_user.role in ['company_admin', 'company_user']:
        # Csak saját piszkozatot törölhet
        if req.user_id != current_user.id:
            return jsonify({'message': 'Nincs jogosultságod ehhez a művelethez!'}), 403
        if req.status != 'draft':
            return jsonify({'message': 'Csak piszkozat státuszú kérést törölhetsz!'}), 403
    else:
        return jsonify({'message': 'Nincs jogosultságod kérések törléséhez!'}), 403
    
    # Melléklet törlése, ha van
    if req.attachment_filename:
        filepath = os.path.join(app.config['ATTACHMENT_FOLDER'], req.attachment_filename)
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except Exception as e:
                print(f"Melléklet törlési hiba: {e}")
    
    # v7.0.13: Kapcsolódó adatok törlése (foreign key constraints)
    # v7.0.15: FIX - lab_request_id a helyes mező név!
    # TestResult-ok törlése (mellékletekkel együtt)
    test_results = TestResult.query.filter_by(lab_request_id=request_id).all()
    for result in test_results:
        if result.attachment_filename:
            result_filepath = os.path.join(app.config['RESULT_ATTACHMENT_FOLDER'], result.attachment_filename)
            if os.path.exists(result_filepath):
                try:
                    os.remove(result_filepath)
                except Exception as e:
                    print(f"TestResult melléklet törlési hiba: {e}")
    TestResult.query.filter_by(lab_request_id=request_id).delete()
    
    # v7.0.16: LabRequestTestType törölve - ez a tábla már nem létezik
    # A vizsgálat típusok JSON-ban vannak tárolva (test_types mező)
    
    # Notification-ok törlése
    Notification.query.filter_by(request_id=request_id).delete()
    
    # Kérés törlése
    db.session.delete(req)
    db.session.commit()
    
    return jsonify({'message': 'Laborkérés sikeresen törölve!'})

# ========================================
# v7.0: TEST RESULTS & WORKLIST API
# ========================================

@app.route('/api/my-worklist', methods=['GET'])
@token_required
def get_my_worklist(current_user):
    """
    Labor munkatárs saját munkalistája (+ super_admin minden vizsgálat)
    Labor munkatárs: Csak azokat a kéréseket látja, amelyekben van olyan vizsgálat, 
                     ami az ő szervezeti egységéhez tartozik
    Super admin: Minden in_progress/validation_pending/completed kérést lát
    """
    # v7.0.1: Super admin is allowed (sees everything)
    if current_user.role not in ['labor_staff', 'super_admin']:
        return jsonify({'message': 'Csak labor munkatársak és adminok számára elérhető!'}), 403
    
    # v7.0.1: Labor staff needs department
    if current_user.role == 'labor_staff' and not current_user.department_id:
        return jsonify({'message': 'Nincs szervezeti egység hozzárendelve!'}), 400
    
    # Lekérjük az in_progress, validation_pending és completed kéréseket
    requests = LabRequest.query.filter(
        LabRequest.status.in_(['in_progress', 'validation_pending', 'completed'])
    ).all()
    
    # Szűrjük azokra, amelyekben van saját dept vizsgálat (vagy super_admin esetén mindent)
    worklist = []
    for req in requests:
        test_type_ids = json.loads(req.test_types)
        test_types = TestType.query.filter(TestType.id.in_(test_type_ids)).all()
        
        # v7.0.1: Super admin sees all tests
        if current_user.role == 'super_admin':
            my_tests = test_types  # All tests
        else:
            # Van-e saját szervezeti egységhez tartozó vizsgálat?
            my_tests = [tt for tt in test_types if tt.department_id == current_user.department_id]
        
        if my_tests:
            # Lekérjük az eredményeket is
            results = TestResult.query.filter_by(lab_request_id=req.id).all()
            results_dict = {r.test_type_id: r for r in results}
            
            # Számoljuk, hány saját vizsgálat van és hány elkészült
            my_test_count = len(my_tests)
            # v7.0.25: Egyszerűsített - csak completed és validation_pending
            my_completed_count = sum(1 for tt in my_tests if results_dict.get(tt.id) and results_dict[tt.id].status in ['completed', 'validation_pending'])
            
            # v7.0.1: Test list for display
            test_list = [
                {
                    'id': tt.id,
                    'name': tt.name,
                    'department_name': tt.department.name if tt.department else None,
                    'status': results_dict[tt.id].status if tt.id in results_dict else 'pending'
                }
                for tt in my_tests
            ]
            
            worklist.append({
                'id': req.id,
                'request_number': req.request_number,
                'internal_id': req.internal_id,
                'sample_description': req.sample_description,
                'status': req.status,
                'urgency': req.urgency,
                'deadline': req.deadline.isoformat() if req.deadline else None,
                'created_at': req.created_at.isoformat(),
                'company_name': req.company.name if req.company else None,
                'my_test_count': my_test_count,
                'my_completed_count': my_completed_count,
                'progress': round((my_completed_count / my_test_count * 100) if my_test_count > 0 else 0),
                'test_list': test_list  # v7.0.1: Add test list
            })
    
    # Rendezés: sürgős elöl, határidő szerint
    worklist.sort(key=lambda x: (
        0 if x['urgency'] == 'critical' else 1 if x['urgency'] == 'urgent' else 2,
        x['deadline'] if x['deadline'] else '9999-12-31'
    ))
    
    return jsonify(worklist)

@app.route('/api/requests/<int:request_id>/test-results', methods=['GET'])
@token_required
def get_test_results(current_user, request_id):
    """
    Egy laborkérés összes vizsgálati eredménye
    """
    req = LabRequest.query.get_or_404(request_id)
    
    # Jogosultság ellenőrzése
    if current_user.role == 'company_user' and req.user_id != current_user.id:
        return jsonify({'message': 'Nincs jogosultságod!'}), 403
    
    # Lekérjük a vizsgálatokat
    test_type_ids = json.loads(req.test_types)
    test_types = TestType.query.filter(TestType.id.in_(test_type_ids)).all()
    
    # Lekérjük az eredményeket
    results = TestResult.query.filter_by(lab_request_id=request_id).all()
    results_dict = {r.test_type_id: r for r in results}
    
    # Labor staff csak saját dept vizsgálatait látja
    if current_user.role == 'labor_staff':
        test_types = [tt for tt in test_types if tt.department_id == current_user.department_id]
    
    response_data = []
    for tt in test_types:
        result = results_dict.get(tt.id)
        
        response_data.append({
            'test_type_id': tt.id,
            'test_type_name': tt.name,
            'test_type_description': tt.description,
            'test_type_department': tt.department.name if tt.department else None,  # v7.0.4: Add department name
            'department_id': tt.department_id,
            'department_name': tt.department.name if tt.department else None,
            'result_id': result.id if result else None,
            'result_text': result.result_text if result else None,
            'attachment_filename': result.attachment_filename if result else None,
            'status': result.status if result else 'pending',
            'completed_by': result.completed_by.name if result and result.completed_by else None,
            'completed_at': result.completed_at.isoformat() if result and result.completed_at else None,
            # v7.0.4: Admin validation fields
            'validated_by': result.validated_by.name if result and result.validated_by else None,
            'validated_at': result.validated_at.isoformat() if result and result.validated_at else None,
            'rejection_reason': result.rejection_reason if result else None,
            'can_edit': current_user.role == 'super_admin' or (
                current_user.role == 'labor_staff' and tt.department_id == current_user.department_id
            )
        })
    
    return jsonify(response_data)

@app.route('/api/test-results', methods=['POST'])
@token_required
def create_or_update_test_result(current_user):
    """
    Vizsgálati eredmény mentése vagy frissítése
    v7.0.26: Tiltás ha dept lezárva
    """
    data = request.get_json()
    
    lab_request_id = data.get('lab_request_id')
    test_type_id = data.get('test_type_id')
    result_text = data.get('result_text', '')
    
    if not lab_request_id or not test_type_id:
        return jsonify({'message': 'Hiányzó adatok!'}), 400
    
    # Ellenőrizzük a jogosultságot
    test_type = TestType.query.get_or_404(test_type_id)
    
    if current_user.role == 'labor_staff':
        if test_type.department_id != current_user.department_id:
            return jsonify({'message': 'Nincs jogosultságod ehhez a vizsgálathoz!'}), 403
    elif current_user.role not in ['super_admin']:
        return jsonify({'message': 'Nincs jogosultságod!'}), 403
    
    # Keressük meg vagy hozzuk létre az eredményt
    result = TestResult.query.filter_by(
        lab_request_id=lab_request_id,
        test_type_id=test_type_id
    ).first()
    
    if result:
        # Frissítés
        result.result_text = result_text
        result.status = data.get('status', 'completed')
        result.completed_by_user_id = current_user.id
        result.completed_at = datetime.datetime.utcnow()
    else:
        # Létrehozás
        result = TestResult(
            lab_request_id=lab_request_id,
            test_type_id=test_type_id,
            result_text=result_text,
            status=data.get('status', 'completed'),
            completed_by_user_id=current_user.id,
            completed_at=datetime.datetime.utcnow()
        )
        db.session.add(result)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Eredmény mentve!',
        'result_id': result.id
    })

@app.route('/api/test-results/<int:result_id>/attachment', methods=['POST'])
@token_required
def upload_result_attachment(current_user, result_id):
    """
    Fájl feltöltés vizsgálati eredményhez
    Max 50MB
    """
    result = TestResult.query.get_or_404(result_id)
    
    # Jogosultság ellenőrzése
    test_type = result.test_type
    if current_user.role == 'labor_staff':
        if test_type.department_id != current_user.department_id:
            return jsonify({'message': 'Nincs jogosultságod!'}), 403
    elif current_user.role not in ['super_admin']:
        return jsonify({'message': 'Nincs jogosultságod!'}), 403
    
    if 'file' not in request.files:
        return jsonify({'message': 'Nincs fájl!'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'message': 'Üres fájlnév!'}), 400
    
    # Fájl mentése
    filename = secure_filename(file.filename)
    timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    unique_filename = f"result_{result.id}_{timestamp}_{filename}"
    filepath = os.path.join(app.config['RESULT_ATTACHMENT_FOLDER'], unique_filename)
    
    # Töröljük a régi fájlt, ha volt
    if result.attachment_filename:
        old_filepath = os.path.join(app.config['RESULT_ATTACHMENT_FOLDER'], result.attachment_filename)
        if os.path.exists(old_filepath):
            try:
                os.remove(old_filepath)
            except Exception as e:
                print(f"Régi fájl törlési hiba: {e}")
    
    file.save(filepath)
    result.attachment_filename = unique_filename
    db.session.commit()
    
    return jsonify({
        'message': 'Fájl feltöltve!',
        'filename': unique_filename
    })

@app.route('/api/test-results/<int:result_id>/attachment', methods=['GET'])
@token_required
def download_result_attachment(current_user, result_id):
    """
    Vizsgálati eredmény fájl letöltése
    v7.0.10: Debug logging hozzáadva
    """
    print(f"[ATTACHMENT DOWNLOAD] Kezdés - result_id={result_id}, user_id={current_user.id}")
    
    result = TestResult.query.get_or_404(result_id)
    print(f"[ATTACHMENT DOWNLOAD] TestResult megtalálva - attachment_filename={result.attachment_filename}")
    
    if not result.attachment_filename:
        print(f"[ATTACHMENT DOWNLOAD] ERROR: Nincs attachment_filename!")
        return jsonify({'message': 'Nincs melléklet!'}), 404
    
    filepath = os.path.join(app.config['RESULT_ATTACHMENT_FOLDER'], result.attachment_filename)
    print(f"[ATTACHMENT DOWNLOAD] File path: {filepath}")
    print(f"[ATTACHMENT DOWNLOAD] RESULT_ATTACHMENT_FOLDER: {app.config['RESULT_ATTACHMENT_FOLDER']}")
    print(f"[ATTACHMENT DOWNLOAD] File exists: {os.path.exists(filepath)}")
    
    # v7.0.10: Mappa tartalom listázása debug-hoz
    if os.path.exists(app.config['RESULT_ATTACHMENT_FOLDER']):
        files_in_folder = os.listdir(app.config['RESULT_ATTACHMENT_FOLDER'])
        print(f"[ATTACHMENT DOWNLOAD] Files in result folder: {files_in_folder}")
    else:
        print(f"[ATTACHMENT DOWNLOAD] ERROR: Result attachment folder NOT EXISTS!")
    
    if not os.path.exists(filepath):
        print(f"[ATTACHMENT DOWNLOAD] ERROR: File not found at {filepath}")
        return jsonify({
            'message': 'Fájl nem található!',
            'debug_info': {
                'filename': result.attachment_filename,
                'expected_path': filepath,
                'folder_exists': os.path.exists(app.config['RESULT_ATTACHMENT_FOLDER'])
            }
        }), 404
    
    print(f"[ATTACHMENT DOWNLOAD] Sikeres letöltés: {result.attachment_filename}")
    return send_file(filepath, as_attachment=True, download_name=result.attachment_filename)

@app.route('/api/requests/<int:request_id>/submit-validation', methods=['POST'])
@token_required
def submit_for_validation(current_user, request_id):
    """
    v7.0.25: Egyszerűsített validation workflow
    
    Flow:
    1. Labor staff check: saját dept minden vizsgálat kész?
    2. GLOBÁLIS check: MINDEN vizsgálat kész?
       - IGEN → status = 'validation_pending', results → 'validation_pending'
       - NEM  → error (nem lehet validálásra küldeni)
    """
    req = LabRequest.query.get_or_404(request_id)
    
    if current_user.role not in ['labor_staff', 'super_admin']:
        return jsonify({'message': 'Nincs jogosultságod!'}), 403
    
    # Dept check szükséges labor staff-nál
    if current_user.role == 'labor_staff' and not current_user.department_id:
        return jsonify({'message': 'Nincs szervezeti egység hozzárendelve!'}), 400
    
    test_type_ids = json.loads(req.test_types)
    test_types = TestType.query.filter(TestType.id.in_(test_type_ids)).all()
    all_results = TestResult.query.filter_by(lab_request_id=request_id).all()
    results_dict = {r.test_type_id: r for r in all_results}
    
    # STEP 1: Labor staff esetén ellenőrizzük, hogy saját dept minden vizsgálat kész-e
    if current_user.role == 'labor_staff':
        my_tests = [tt for tt in test_types if tt.department_id == current_user.department_id]
        
        incomplete_my_tests = [
            tt for tt in my_tests 
            if not results_dict.get(tt.id) or results_dict[tt.id].status != 'completed'
        ]
        
        if incomplete_my_tests:
            return jsonify({
                'message': 'Nem minden vizsgálat van kitöltve!',
                'incomplete_tests': [tt.name for tt in incomplete_my_tests]
            }), 400
    
    # STEP 2: GLOBÁLIS check - MINDEN vizsgálat kész?
    all_completed = all(
        results_dict.get(tt.id) and 
        results_dict[tt.id].status in ['completed', 'validation_pending']
        for tt in test_types
    )
    
    if not all_completed:
        # Még nem minden vizsgálat kész
        incomplete_tests = [
            tt.name for tt in test_types 
            if not results_dict.get(tt.id) or results_dict[tt.id].status not in ['completed', 'validation_pending']
        ]
        return jsonify({
            'message': 'Még nem minden vizsgálat készült el!',
            'incomplete_tests': incomplete_tests
        }), 400
    
    # MINDEN vizsgálat kész → validation_pending
    req.status = 'validation_pending'
    
    # Összes completed result → validation_pending
    for result in all_results:
        if result.status == 'completed':
            result.status = 'validation_pending'
    
    db.session.commit()
    
    # v8.0: Státuszváltozás notification
    event_data = {
        'request_number': req.request_number,
        'old_status': old_status,
        'new_status': 'validation_pending',
        'company_name': req.company.name if req.company else '',
        'requester_name': req.user.name
    }
    NotificationService.notify('status_change', request_id=req.id, event_data=event_data)
    
    return jsonify({
        'message': 'Kérés validálásra küldve!',
        'status': 'validation_pending'
    })


@app.route('/api/test-results/<int:result_id>/validate', methods=['PUT'])
@token_required
def validate_test_result(current_user, result_id):
    """
    v7.0.3: Admin validálja az egyes vizsgálati eredményeket
    """
    if current_user.role != 'super_admin':
        return jsonify({'message': 'Csak adminok validálhatnak!'}), 403
    
    result = TestResult.query.get_or_404(result_id)
    data = request.get_json()
    action = data.get('action')  # 'approve' vagy 'reject'
    
    if action == 'approve':
        result.status = 'completed'
        result.validated_by_user_id = current_user.id
        result.validated_at = datetime.datetime.utcnow()
        result.rejection_reason = None
        message = 'Eredmény elfogadva!'
    elif action == 'reject':
        result.status = 'in_progress'  # Vissza labor staff-hez
        result.validated_by_user_id = None
        result.validated_at = None
        result.rejection_reason = data.get('rejection_reason', 'Nincs megadva ok')
        message = 'Eredmény visszaküldve javításra!'
    else:
        return jsonify({'message': 'Érvénytelen művelet!'}), 400
    
    db.session.commit()
    
    return jsonify({
        'message': message,
        'result': {
            'id': result.id,
            'status': result.status,
            'validated_at': result.validated_at.isoformat() if result.validated_at else None,
            'rejection_reason': result.rejection_reason
        }
    })

@app.route('/api/requests/<int:request_id>/complete-validation', methods=['POST'])
@token_required
def complete_request_validation(current_user, request_id):
    """
    v7.0.3: Admin lezárja a kérést - minden vizsgálat validált
    """
    if current_user.role != 'super_admin':
        return jsonify({'message': 'Csak adminok zárhatnak le kérést!'}), 403
    
    req = LabRequest.query.get_or_404(request_id)
    
    if req.status != 'validation_pending':
        return jsonify({'message': 'A kérés nincs validálásra váró státuszban!'}), 400
    
    # Ellenőrizzük, hogy minden vizsgálat completed-e
    results = TestResult.query.filter_by(lab_request_id=request_id).all()
    incomplete_results = [r for r in results if r.status != 'completed']
    
    if incomplete_results:
        test_names = []
        for r in incomplete_results:
            tt = TestType.query.get(r.test_type_id)
            test_names.append(tt.name if tt else f'ID: {r.test_type_id}')
        
        return jsonify({
            'message': 'Nem minden vizsgálat van validálva!',
            'incomplete_tests': test_names
        }), 400
    
    # Összes vizsgálat validált → Kérés lezárása
    old_status = req.status
    req.status = 'completed'
    db.session.commit()
    
    # v8.0: Státuszváltozás notification
    event_data = {
        'request_number': req.request_number,
        'old_status': old_status,
        'new_status': 'completed',
        'company_name': req.company.name if req.company else '',
        'requester_name': req.user.name
    }
    NotificationService.notify('status_change', request_id=req.id, event_data=event_data)
    
    return jsonify({
        'message': 'Kérés sikeresen lezárva!',
        'request': {
            'id': req.id,
            'status': req.status,
            'request_number': req.request_number
        }
    })

@app.route('/api/requests/<int:request_id>/attachment', methods=['GET'])
@token_required
def download_attachment(current_user, request_id):
    req = LabRequest.query.get_or_404(request_id)
    
    if not req.attachment_filename:
        return jsonify({'message': 'Nincs melléklet!'}), 404
    
    filepath = os.path.join(app.config['ATTACHMENT_FOLDER'], req.attachment_filename)
    
    if not os.path.exists(filepath):
        return jsonify({'message': 'Fájl nem található!'}), 404
    
    return send_file(filepath, as_attachment=True, download_name=req.attachment_filename)

# --- PDF Export ---
@app.route('/api/requests/<int:request_id>/pdf', methods=['GET'])
@token_required
def export_request_pdf(current_user, request_id):
    req = LabRequest.query.get_or_404(request_id)
    
    # v7.0.8: Jogosultság ellenőrzés céges userekre
    if current_user.role == 'company_user' and req.user_id != current_user.id:
        return jsonify({'message': 'Nincs jogosultságod!'}), 403
    
    # v7.0.8: Company admin csak saját cégének kéréseit láthatja
    if current_user.role == 'company_admin' and req.company_id != current_user.company_id:
        return jsonify({'message': 'Nincs jogosultságod!'}), 403
    
    # v6.7 - Improved UTF-8 font registration for Hungarian characters
    default_font = 'Helvetica'
    bold_font = 'Helvetica-Bold'
    
    font_paths = [
        # Linux paths
        ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'),
        # Ubuntu/Debian alternative
        ('/usr/share/fonts/TTF/DejaVuSans.ttf', '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf'),
        # FreeSans (wide Unicode support)
        ('/usr/share/fonts/truetype/freefont/FreeSans.ttf', '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf'),
        # Liberation Sans
        ('/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'),
    ]
    
    font_registered = False
    for regular_path, bold_path in font_paths:
        try:
            if os.path.exists(regular_path) and os.path.exists(bold_path):
                pdfmetrics.registerFont(TTFont('CustomFont', regular_path))
                pdfmetrics.registerFont(TTFont('CustomFont-Bold', bold_path))
                default_font = 'CustomFont'
                bold_font = 'CustomFont-Bold'
                font_registered = True
                print(f"✅ PDF font registered: {regular_path}")
                break
        except Exception as e:
            print(f"⚠️ Font registration failed for {regular_path}: {e}")
            continue
    
    if not font_registered:
        print("⚠️ Using Helvetica fallback (no UTF-8 support)")
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    elements = []
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#4F46E5'),
        spaceAfter=30,
        alignment=TA_CENTER,
        fontName=bold_font
    )
    elements.append(Paragraph('LABORKÉRÉS', title_style))
    elements.append(Spacer(1, 0.5*cm))
    
    # v6.7: Kérés azonosító
    id_style = ParagraphStyle('IDStyle', parent=styles['Normal'], fontSize=14, spaceAfter=20, fontName=default_font)
    request_number = req.request_number or f"LAB-{req.id}"
    elements.append(Paragraph(f'<b>Kérés azonosító:</b> {request_number}', id_style))
    if req.internal_id:
        elements.append(Paragraph(f'<b>Céges belső azonosító:</b> {req.internal_id}', id_style))
    elements.append(Spacer(1, 0.3*cm))
    
    # v6.7: Mintavétel időpont
    sampling_time = '-'
    if req.sampling_datetime:
        sampling_time = req.sampling_datetime.strftime('%Y-%m-%d %H:%M')
    elif req.sampling_date:
        sampling_time = req.sampling_date.strftime('%Y-%m-%d')
    
    # v6.7: Logisztika info
    logistics_text = 'Feladó gondoskodik' if req.logistics_type == 'sender' else 'Szolgáltató szállít'
    
    data = [
        ['Feladó:', req.user.name],
        ['Cég:', req.company.name if req.company else '-'],
        ['Kategória:', req.category.name if req.category else '-'],
        ['Mintavétel helye:', req.sampling_location or '-'],
        ['Mintavétel időpontja:', sampling_time],
        ['Határidő:', req.deadline.strftime('%Y-%m-%d') if req.deadline else '-'],
        ['Minta leírása:', req.sample_description or '-'],
        ['Logisztika:', logistics_text],
        ['Kontakt:', f"{req.contact_person or '-'} ({req.contact_phone or '-'})"],
    ]
    
    if req.logistics_type == 'provider' and req.shipping_address:
        data.append(['Szállítási cím:', req.shipping_address])
    
    table = Table(data, colWidths=[5*cm, 12*cm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F3F4F6')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), bold_font),
        ('FONTNAME', (1, 0), (1, -1), default_font),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey)
    ]))
    elements.append(table)
    elements.append(Spacer(1, 0.5*cm))
    
    heading_style = ParagraphStyle('Heading', parent=styles['Heading2'], fontName=bold_font)
    elements.append(Paragraph('<b>Kért vizsgálatok:</b>', heading_style))
    elements.append(Spacer(1, 0.2*cm))
    
    test_data = [['Vizsgálat neve', 'Szervezeti egység', 'Átfutás (nap)', 'Ár (Ft)']]
    test_types = get_test_type_details(req.test_types)
    for tt in test_types:
        test_data.append([
            tt['name'],
            tt.get('department_name', '-'),
            str(tt.get('turnaround_days', '-')),
            f"{tt['price']:,.0f}"
        ])
    
    test_table = Table(test_data, colWidths=[7*cm, 4*cm, 3*cm, 3*cm])
    test_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4F46E5')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), bold_font),  # v6.5
        ('FONTNAME', (0, 1), (-1, -1), default_font),  # v6.5
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey)
    ]))
    elements.append(test_table)
    elements.append(Spacer(1, 0.3*cm))
    
    total_style = ParagraphStyle('Total', parent=styles['Normal'], fontSize=14, alignment=TA_LEFT, fontName=bold_font)  # v6.5
    elements.append(Paragraph(f'<b>Összköltség: {req.total_price:,.0f} Ft</b>', total_style))
    
    if req.special_instructions:
        elements.append(Spacer(1, 0.5*cm))
        elements.append(Paragraph('<b>Különleges kezelési utasítások:</b>', heading_style))
        instruction_style = ParagraphStyle('Instruction', parent=styles['Normal'], fontName=default_font)
        elements.append(Paragraph(req.special_instructions, instruction_style))
    
    # v7.0.7: Eredmények szekció - csak completed kéréseknél
    if req.status == 'completed':
        elements.append(PageBreak())  # Új oldal az eredményeknek
        
        # API base URL melléklet linkekhez
        api_base_url = request.host_url.rstrip('/')  # pl. https://your-backend.railway.app
        
        # v7.0.10: JWT token generálás PDF linkekhez
        # FONTOS: current_user token-jét használjuk, hogy a PDF link működjön
        try:
            # Token lekérése header-ből vagy query param-ból
            user_token = request.headers.get('Authorization')
            if user_token and user_token.startswith('Bearer '):
                user_token = user_token[7:]
            elif not user_token:
                user_token = request.args.get('token')
            
            # Ha nincs token, generálunk egy újat (24 órás érvényességgel)
            if not user_token:
                user_token = jwt.encode({
                    'user_id': current_user.id,
                    'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
                }, app.config['SECRET_KEY'], algorithm='HS256')
        except Exception as e:
            # Fallback: Új token generálás
            user_token = jwt.encode({
                'user_id': current_user.id,
                'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
            }, app.config['SECRET_KEY'], algorithm='HS256')
        
        # Eredmények header
        results_title_style = ParagraphStyle(
            'ResultsTitle',
            parent=styles['Heading1'],
            fontSize=20,
            textColor=colors.HexColor('#059669'),  # Zöld
            spaceAfter=20,
            alignment=TA_CENTER,
            fontName=bold_font
        )
        elements.append(Paragraph('VIZSGÁLATI EREDMÉNYEK', results_title_style))
        elements.append(Spacer(1, 0.5*cm))
        
        # Link style mellékletekhez
        link_style = ParagraphStyle(
            'AttachmentLink',
            parent=styles['Normal'],
            fontName=default_font,
            fontSize=10,
            textColor=colors.HexColor('#2563EB'),  # Kék link
            underline=True
        )
        
        # TestResult-ok lekérdezése
        test_results = TestResult.query.filter_by(lab_request_id=request_id).all()
        
        if test_results:
            for idx, result in enumerate(test_results, 1):
                # Vizsgálat neve
                test_name_style = ParagraphStyle(
                    'TestName',
                    parent=styles['Heading2'],
                    fontSize=14,
                    textColor=colors.HexColor('#4F46E5'),
                    spaceAfter=10,
                    fontName=bold_font
                )
                test_type_name = result.test_type.name if result.test_type else f"Vizsgálat #{result.test_type_id}"
                elements.append(Paragraph(f'{idx}. {test_type_name}', test_name_style))
                
                # Eredmény adatok táblázat
                result_data = []
                
                # Eredmény szöveg
                result_text = result.result_text or '-'
                result_data.append(['Eredmény:', result_text])
                
                # Melléklet - v7.0.10: Kattintható link token-nel
                if result.attachment_filename:
                    attachment_url = f"{api_base_url}/api/test-results/{result.id}/attachment?token={user_token}"
                    attachment_link = Paragraph(
                        f'<a href="{attachment_url}" color="blue"><u>{result.attachment_filename}</u></a>',
                        link_style
                    )
                    result_data.append(['Melléklet:', attachment_link])
                
                # Kitöltő adatok
                completed_by_name = result.completed_by.name if result.completed_by else '-'
                completed_at_str = result.completed_at.strftime('%Y-%m-%d %H:%M') if result.completed_at else '-'
                result_data.append(['Kitöltötte:', f"{completed_by_name} • {completed_at_str}"])
                
                # Validáló adatok
                if result.validated_by:
                    validated_by_name = result.validated_by.name if result.validated_by else '-'
                    validated_at_str = result.validated_at.strftime('%Y-%m-%d %H:%M') if result.validated_at else '-'
                    result_data.append(['Validálta:', f"{validated_by_name} • {validated_at_str}"])
                
                result_table = Table(result_data, colWidths=[4*cm, 13*cm])
                result_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F0FDF4')),  # Világos zöld
                    ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),  # v7.0.9: Top align (link miatt)
                    ('FONTNAME', (0, 0), (0, -1), bold_font),
                    ('FONTNAME', (1, 0), (1, -1), default_font),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
                    ('TOPPADDING', (0, 0), (-1, -1), 8),
                    ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#D1FAE5'))  # Zöld border
                ]))
                elements.append(result_table)
                elements.append(Spacer(1, 0.4*cm))
        else:
            # Nincs eredmény
            no_result_style = ParagraphStyle('NoResult', parent=styles['Normal'], fontSize=12, textColor=colors.grey, fontName=default_font)
            elements.append(Paragraph('Nincs rögzített eredmény.', no_result_style))
    
    doc.build(elements)
    buffer.seek(0)
    
    return send_file(
        buffer,
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f'laborkeres_{req.sample_id}.pdf'
    )

# v7.0.31: Minta átadás-átvételi jegyzőkönyv PDF (QR kóddal)
@app.route('/api/requests/<int:request_id>/handover-pdf', methods=['GET'])
@token_required
def export_handover_pdf(current_user, request_id):
    """Minta átadás-átvételi jegyzőkönyv PDF generálás QR kóddal"""
    req = LabRequest.query.get_or_404(request_id)
    
    # Jogosultság: Csak awaiting_shipment vagy későbbi státuszú kéréseknél
    allowed_statuses = ['awaiting_shipment', 'in_transit', 'arrived_at_provider', 'in_progress', 'validation_pending', 'completed']
    if req.status not in allowed_statuses:
        return jsonify({'message': 'Ez a dokumentum csak jóváhagyott kéréseknél elérhető!'}), 403
    
    # Jogosultság ellenőrzés
    if current_user.role == 'company_user' and req.user_id != current_user.id:
        return jsonify({'message': 'Nincs jogosultságod!'}), 403
    if current_user.role == 'company_admin' and req.company_id != current_user.company_id:
        return jsonify({'message': 'Nincs jogosultságod!'}), 403
    
    # Font registration
    default_font = 'Helvetica'
    bold_font = 'Helvetica-Bold'
    
    font_paths = [
        ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'),
        ('/usr/share/fonts/TTF/DejaVuSans.ttf', '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf'),
        ('/usr/share/fonts/truetype/freefont/FreeSans.ttf', '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf'),
        ('/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'),
    ]
    
    font_registered = False
    for regular_path, bold_path in font_paths:
        try:
            if os.path.exists(regular_path) and os.path.exists(bold_path):
                pdfmetrics.registerFont(TTFont('CustomFont', regular_path))
                pdfmetrics.registerFont(TTFont('CustomFont-Bold', bold_path))
                default_font = 'CustomFont'
                bold_font = 'CustomFont-Bold'
                font_registered = True
                break
        except Exception as e:
            continue
    
    # QR kód generálás
    frontend_url = os.environ.get('FRONTEND_URL', 'https://lab-request-frontend.netlify.app')
    qr_data = f"{frontend_url}/logistics/scan?request={req.request_number}"
    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(qr_data)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")
    
    # QR kód BytesIO-ba mentés
    qr_buffer = BytesIO()
    qr_img.save(qr_buffer, format='PNG')
    qr_buffer.seek(0)
    
    # PDF build
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
    elements = []
    styles = getSampleStyleSheet()
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#4F46E5'),
        spaceAfter=15,
        alignment=TA_CENTER,
        fontName=bold_font
    )
    elements.append(Paragraph('MINTA ÁTADÁS-ÁTVÉTELI JEGYZŐKÖNYV', title_style))
    elements.append(Spacer(1, 0.3*cm))
    
    # Header with QR code
    qr_image = Image(qr_buffer, width=3.5*cm, height=3.5*cm)
    id_para = Paragraph(f'<b>Kérés azonosító:</b> {req.request_number}', ParagraphStyle('IDStyle', parent=styles['Normal'], fontSize=13, fontName=default_font))
    header_table = Table([[id_para, qr_image]], colWidths=[13*cm, 4*cm])
    header_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 0.4*cm))
    
    # Internal ID
    if req.internal_id:
        id_style = ParagraphStyle('IDStyle2', parent=styles['Normal'], fontSize=11, spaceAfter=12, fontName=default_font)
        elements.append(Paragraph(f'<b>Céges belső azonosító:</b> {req.internal_id}', id_style))
    
    # Sampling time
    sampling_time = '-'
    if req.sampling_datetime:
        sampling_time = req.sampling_datetime.strftime('%Y-%m-%d %H:%M')
    elif req.sampling_date:
        sampling_time = req.sampling_date.strftime('%Y-%m-%d')
    
    # Logistics info
    logistics_text = 'Feladó gondoskodik' if req.logistics_type == 'sender' else 'Szolgáltató szállít'
    
    # Main info table
    data = [
        ['Feladó:', req.user.name],
        ['Cég:', req.company.name if req.company else '-'],
        ['Kategória:', req.category.name if req.category else '-'],
        ['Mintavétel helye:', req.sampling_location or '-'],
        ['Mintavétel időpontja:', sampling_time],
        ['Határidő:', req.deadline.strftime('%Y-%m-%d') if req.deadline else '-'],
        ['Minta leírása:', req.sample_description or '-'],
        ['Logisztika:', logistics_text],
        ['Kontakt:', f"{req.contact_person or '-'} ({req.contact_phone or '-'})"],
    ]
    
    if req.logistics_type == 'provider' and req.shipping_address:
        data.append(['Szállítási cím:', req.shipping_address])
    
    table = Table(data, colWidths=[5*cm, 11*cm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F3F4F6')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), bold_font),
        ('FONTNAME', (1, 0), (1, -1), default_font),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey)
    ]))
    elements.append(table)
    elements.append(Spacer(1, 0.4*cm))
    
    # Test types
    heading_style = ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=13, fontName=bold_font)
    elements.append(Paragraph('<b>Kért vizsgálatok:</b>', heading_style))
    elements.append(Spacer(1, 0.2*cm))
    
    test_data = [['Vizsgálat neve', 'Szervezeti egység', 'Átfutás (nap)', 'Ár (Ft)']]
    test_types = get_test_type_details(req.test_types)
    for tt in test_types:
        test_data.append([
            tt['name'],
            tt.get('department_name', '-'),
            str(tt.get('turnaround_days', '-')),
            f"{tt['price']:,.0f}"
        ])
    
    test_table = Table(test_data, colWidths=[6*cm, 4*cm, 3*cm, 3*cm])
    test_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4F46E5')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), bold_font),
        ('FONTNAME', (0, 1), (-1, -1), default_font),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey)
    ]))
    elements.append(test_table)
    elements.append(Spacer(1, 0.3*cm))
    
    # Total price
    total_style = ParagraphStyle('Total', parent=styles['Normal'], fontSize=13, alignment=TA_LEFT, fontName=bold_font)
    elements.append(Paragraph(f'<b>Összköltség: {req.total_price:,.0f} Ft</b>', total_style))
    
    # Special instructions
    if req.special_instructions:
        elements.append(Spacer(1, 0.4*cm))
        elements.append(Paragraph('<b>Különleges kezelési utasítások:</b>', heading_style))
        instruction_style = ParagraphStyle('Instruction', parent=styles['Normal'], fontSize=10, fontName=default_font)
        elements.append(Paragraph(req.special_instructions, instruction_style))
    
    # Handover-specific content
    elements.append(Spacer(1, 0.8*cm))
    
    # Order statement
    order_style = ParagraphStyle('Order', parent=styles['Normal'], fontSize=12, alignment=TA_CENTER, fontName=bold_font, spaceAfter=25)
    elements.append(Paragraph('<b>A fentiek szerinti vizsgálatok ezúton megrendelem.</b>', order_style))
    
    # Signature section
    today = datetime.datetime.now().strftime('%Y. %m. %d.')
    signature_data = [
        ['Jóváhagyás dátuma:', today],
        ['', ''],
        ['Cég bélyegzője:', 'Jóváhagyó aláírása:'],
        ['', ''],
        ['', '________________________________'],
    ]
    signature_table = Table(signature_data, colWidths=[8*cm, 8*cm])
    signature_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, 0), bold_font),
        ('FONTNAME', (1, 0), (1, 0), default_font),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 2), 6),
        ('FONTNAME', (0, 2), (-1, 2), bold_font),
    ]))
    elements.append(signature_table)
    
    # Italic instruction
    elements.append(Spacer(1, 0.4*cm))
    italic_style = ParagraphStyle('Italic', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER, fontName=default_font, textColor=colors.grey, leading=12)
    elements.append(Paragraph('<i>Kérem, az eredeti átadás-átvételi jegyzőkönyvet aláírni és a mintához mellékelni szíveskedjen.</i>', italic_style))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    
    return send_file(
        buffer,
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f'atadas_atveteli_{req.request_number}.pdf'
    )

# --- Users Routes ---
@app.route('/api/users', methods=['GET'])
@token_required
@role_required('super_admin', 'company_admin')
def get_users(current_user):
    if current_user.role == 'super_admin':
        users = User.query.all()
    else:
        users = User.query.filter_by(company_id=current_user.company_id).all()
    
    return jsonify([{
        'id': user.id,
        'email': user.email,
        'name': user.name,
        'role': user.role,
        'phone': user.phone,
        'company_id': user.company_id,
        'company_name': user.company.name if user.company else None,
        'department_id': user.department_id,  # v7.0.1: Add department_id
        'department_name': user.department.name if user.department else None  # v7.0.1: Add department_name
    } for user in users])

@app.route('/api/users', methods=['POST'])
@token_required
@role_required('super_admin', 'company_admin')
def create_user(current_user):
    data = request.get_json()
    
    if User.query.filter_by(email=data.get('email')).first():
        return jsonify({'message': 'Ez az email cím már használatban van!'}), 400
    
    company_id = data.get('company_id')
    if current_user.role == 'company_admin':
        company_id = current_user.company_id
    
    # Handle empty string as None for company_id
    if company_id == '' or company_id == 'null':
        company_id = None
    
    # v7.0.1: Handle department_id
    department_id = data.get('department_id')
    if department_id == '' or department_id == 'null':
        department_id = None
    
    new_user = User(
        email=data.get('email'),
        password=generate_password_hash(data.get('password')),
        name=data.get('name'),
        role=data.get('role'),
        company_id=company_id,
        department_id=department_id,  # v7.0.1: Add department_id
        phone=data.get('phone') if data.get('phone') else None
    )
    
    db.session.add(new_user)
    db.session.commit()
    
    return jsonify({'message': 'Felhasználó sikeresen létrehozva!', 'id': new_user.id}), 201

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@token_required
@role_required('super_admin', 'company_admin')
def delete_user(current_user, user_id):
    user = User.query.get_or_404(user_id)
    
    if current_user.role == 'company_admin' and user.company_id != current_user.company_id:
        return jsonify({'message': 'Nincs jogosultságod!'}), 403
    
    if user.id == current_user.id:
        return jsonify({'message': 'Nem törölheted magadat!'}), 400
    
    db.session.delete(user)
    db.session.commit()
    
    return jsonify({'message': 'Felhasználó sikeresen törölve!'})

@app.route('/api/users/<int:user_id>', methods=['PUT'])
@token_required
@role_required('super_admin', 'company_admin')
def update_user(current_user, user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json()
    
    # Permission check
    if current_user.role == 'company_admin' and user.company_id != current_user.company_id:
        return jsonify({'message': 'Nincs jogosultságod!'}), 403
    
    # Email uniqueness check (if email is being changed)
    if 'email' in data and data['email'] != user.email:
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'message': 'Ez az email cím már használatban van!'}), 400
    
    # Update fields
    if 'name' in data:
        user.name = data['name']
    if 'email' in data:
        user.email = data['email']
    if 'phone' in data:
        user.phone = data['phone']
    if 'password' in data and data['password']:  # Only if password provided
        user.password = generate_password_hash(data['password'])
    if 'role' in data:
        # Company admin cannot change role to super_admin or labor_staff  # v7.0.1: lab_staff → labor_staff
        if current_user.role == 'company_admin':
            if data['role'] in ['super_admin', 'labor_staff']:  # v7.0.1: lab_staff → labor_staff
                return jsonify({'message': 'Nincs jogosultságod ezt a szerepkört beállítani!'}), 403
        user.role = data['role']
    if 'company_id' in data:
        # Company admin cannot change company
        if current_user.role == 'company_admin':
            return jsonify({'message': 'Nincs jogosultságod a céget módosítani!'}), 403
        # Empty string to None
        user.company_id = data['company_id'] if data['company_id'] != '' else None
    
    # v7.0.1: Handle department_id
    if 'department_id' in data:
        # Empty string to None
        user.department_id = data['department_id'] if data['department_id'] != '' else None
    
    db.session.commit()
    
    return jsonify({'message': 'Felhasználó sikeresen frissítve!'})

# v7.0.27: === LOGISTICS MODULE ENDPOINTS ===

@app.route('/api/logistics', methods=['GET'])
@token_required
def get_logistics_requests(current_user):
    """
    Logisztikai modul - szállításra váró, szállítás alatt, szolgáltatóhoz megérkezett kérések
    
    Jogosultságok:
    - super_admin: minden kérés
    - university_logistics: minden kérés
    - company_logistics: csak saját cég kérései
    - company_admin: csak saját cég kérései
    - company_user: csak saját kérései
    """
    logistics_statuses = ['awaiting_shipment', 'in_transit', 'arrived_at_provider']
    
    if current_user.role in ['super_admin', 'university_logistics']:
        # Admin és egyetemi logisztika: minden kérés
        requests = LabRequest.query.filter(
            LabRequest.status.in_(logistics_statuses)
        ).all()
    elif current_user.role in ['company_logistics', 'company_admin']:
        # Céges logisztika és céges admin: csak saját cég
        requests = LabRequest.query.filter(
            LabRequest.company_id == current_user.company_id,
            LabRequest.status.in_(logistics_statuses)
        ).all()
    elif current_user.role == 'company_user':
        # Céges user: csak saját kérései
        requests = LabRequest.query.filter(
            LabRequest.user_id == current_user.id,
            LabRequest.status.in_(logistics_statuses)
        ).all()
    else:
        # Labor staff nincs jogosultsága
        return jsonify({'message': 'Nincs jogosultságod ehhez a modulhoz!'}), 403
    
    return jsonify([{
        'id': req.id,
        # Azonosítók
        'request_number': req.request_number,
        'internal_id': req.internal_id,
        # Minta
        'sample_description': req.sample_description,
        'sampling_datetime': req.sampling_datetime.isoformat() if req.sampling_datetime else None,
        'sampling_location': req.sampling_location,
        # Feladás - LOGISZTIKAI INFO
        'logistics_type': req.logistics_type,  # 'sender' vagy 'laboratory'
        'shipping_address': req.shipping_address,
        'contact_person': req.contact_person,
        'contact_phone': req.contact_phone,
        # Vizsgálatok
        'test_types': get_test_type_details(req.test_types),
        'total_price': req.total_price,
        # Prioritás
        'urgency': req.urgency,
        'deadline': req.deadline.isoformat() if req.deadline else None,
        # Státusz
        'status': req.status,
        # Egyéb
        'special_instructions': req.special_instructions,
        'created_at': req.created_at.isoformat(),
        'user_name': req.user.name,
        'company_name': req.company.name if req.company else None
    } for req in requests])


@app.route('/api/logistics/<int:request_id>/update-status', methods=['PUT'])
@token_required
def update_logistics_status(current_user, request_id):
    """
    Logisztikai státusz frissítése
    
    Engedélyezett átmenetek:
    - awaiting_shipment → in_transit: university_logistics, company_logistics
    - in_transit → arrived_at_provider: company_admin, super_admin
    """
    req = LabRequest.query.get_or_404(request_id)
    data = request.get_json()
    new_status = data.get('status')
    
    # Státusz átmenet ellenőrzés
    valid_transitions = {
        'awaiting_shipment': ['in_transit'],
        'in_transit': ['arrived_at_provider']
    }
    
    if req.status not in valid_transitions:
        return jsonify({'message': f'Ebből a státuszból ({req.status}) nem lehet logisztikai műveletet végezni!'}), 400
    
    if new_status not in valid_transitions[req.status]:
        return jsonify({'message': f'Érvénytelen státusz átmenet: {req.status} → {new_status}'}), 400
    
    # Jogosultság ellenőrzés STÁTUSZ-SPECIFIKUSAN
    # awaiting_shipment → in_transit: logistics munkatársak
    if req.status == 'awaiting_shipment' and new_status == 'in_transit':
        if current_user.role not in ['university_logistics', 'company_logistics']:
            return jsonify({'message': 'Nincs jogosultságod szállítást indítani!'}), 403
        # Céges logistics csak saját céget módosíthat
        if current_user.role == 'company_logistics' and req.company_id != current_user.company_id:
            return jsonify({'message': 'Csak saját céged kéréseit módosíthatod!'}), 403
    
    # in_transit → arrived_at_provider: company_admin vagy super_admin
    elif req.status == 'in_transit' and new_status == 'arrived_at_provider':
        if current_user.role not in ['company_admin', 'super_admin']:
            return jsonify({'message': 'Nincs jogosultságod megérkezést jelezni!'}), 403
        # Company admin csak saját céget módosíthat
        if current_user.role == 'company_admin' and req.company_id != current_user.company_id:
            return jsonify({'message': 'Csak saját céged kéréseit módosíthatod!'}), 403
    else:
        return jsonify({'message': 'Érvénytelen művelet!'}), 403
    
    old_status = req.status
    req.status = new_status
    req.updated_at = datetime.datetime.utcnow()
    db.session.commit()
    
    # v8.0: Státuszváltozás notification
    event_data = {
        'request_number': req.request_number,
        'old_status': old_status,
        'new_status': new_status,
        'company_name': req.company.name if req.company else '',
        'requester_name': req.user.name
    }
    NotificationService.notify('status_change', request_id=req.id, event_data=event_data)
    
    return jsonify({
        'message': 'Státusz sikeresen frissítve!',
        'status': new_status,
        'request_number': req.request_number
    })

# v7.0.31: QR kód beolvasás - szállítás indítása
@app.route('/api/logistics/scan', methods=['POST'])
@token_required
def scan_qr_code(current_user):
    """QR kód beolvasás - kérés in_transit státuszba helyezése"""
    data = request.get_json()
    request_number = data.get('request_number')
    
    if not request_number:
        return jsonify({'message': 'Hiányzó request_number!'}), 400
    
    req = LabRequest.query.filter_by(request_number=request_number).first()
    if not req:
        return jsonify({'message': f'Nem található kérés: {request_number}'}), 404
    
    # Státusz ellenőrzés
    if req.status != 'awaiting_shipment':
        status_hu = {
            'draft': 'piszkozat',
            'pending_approval': 'jóváhagyásra vár',
            'in_transit': 'már szállítás alatt van',
            'arrived_at_provider': 'már megérkezett',
            'in_progress': 'végrehajtás alatt',
            'completed': 'elkészült'
        }
        current_status = status_hu.get(req.status, req.status)
        return jsonify({
            'message': f'Ezt a kérést nem lehet elindítani, mert {current_status}. Csak "szállításra vár" státuszú kéréseket lehet beolvasni!'
        }), 400
    
    # Jogosultság: university_logistics vagy company_logistics
    if current_user.role not in ['university_logistics', 'company_logistics']:
        return jsonify({'message': 'Nincs jogosultságod szállítást indítani!'}), 403
    
    # Company logistics csak saját céget
    if current_user.role == 'company_logistics' and req.company_id != current_user.company_id:
        return jsonify({'message': 'Csak saját céged kéréseit módosíthatod!'}), 403
    
    # Státusz frissítés
    old_status = req.status
    req.status = 'in_transit'
    req.updated_at = datetime.datetime.utcnow()
    db.session.commit()
    
    # v8.0: Státuszváltozás notification
    event_data = {
        'request_number': req.request_number,
        'old_status': old_status,
        'new_status': 'in_transit',
        'company_name': req.company.name if req.company else '',
        'requester_name': req.user.name
    }
    NotificationService.notify('status_change', request_id=req.id, event_data=event_data)
    
    return jsonify({
        'success': True,
        'message': f'Szállítás sikeresen elindítva!',
        'request_number': req.request_number,
        'new_status': req.status,
        'scanned_by': current_user.name
    }), 200

# v7.0.27: === END LOGISTICS MODULE ===

# v8.0: === NOTIFICATION MODULE ===

# User notification endpoints
@app.route('/api/notifications', methods=['GET'])
@token_required
def get_notifications(current_user):
    """User notifications lekérése"""
    unread_only = request.args.get('unread_only', 'false').lower() == 'true'
    limit = int(request.args.get('limit', 50))
    
    notifications = NotificationService.get_user_notifications(
        current_user.id, unread_only=unread_only, limit=limit
    )
    
    return jsonify({
        'notifications': notifications,
        'unread_count': NotificationService.get_unread_count(current_user.id)
    })

@app.route('/api/notifications/<int:notification_id>/read', methods=['PUT'])
@token_required
def mark_notification_read(current_user, notification_id):
    """Notification olvasottnak jelölése"""
    NotificationService.mark_as_read(notification_id, current_user.id)
    return jsonify({'message': 'Értesítés olvasottnak jelölve!'})

@app.route('/api/notifications/read-all', methods=['PUT'])
@token_required
def mark_all_notifications_read(current_user):
    """Összes notification olvasottnak jelölése"""
    NotificationService.mark_all_as_read(current_user.id)
    return jsonify({'message': 'Összes értesítés olvasottnak jelölve!'})

@app.route('/api/notifications/<int:notification_id>', methods=['DELETE'])
@token_required
def delete_notification(current_user, notification_id):
    """Notification törlése"""
    NotificationService.delete_notification(notification_id, current_user.id)
    return jsonify({'message': 'Értesítés törölve!'})

# Admin notification management endpoints
@app.route('/api/admin/notification-event-types', methods=['GET'])
@token_required
@role_required('super_admin')
def get_notification_event_types(current_user):
    """Notification event típusok listája"""
    cursor = db.session.execute(text("""
        SELECT id, event_key, event_name, description, available_variables
        FROM notification_event_types
        ORDER BY id
    """))
    
    events = []
    for row in cursor:
        events.append({
            'id': row[0],
            'event_key': row[1],
            'event_name': row[2],
            'description': row[3],
            'available_variables': json.loads(row[4]) if row[4] else []
        })
    
    return jsonify({'event_types': events})

@app.route('/api/admin/notification-rules', methods=['GET'])
@token_required
@role_required('super_admin')
def get_notification_rules(current_user):
    """Notification rules listája"""
    cursor = db.session.execute(text("""
        SELECT nr.id, nr.event_type_id, net.event_name, net.event_key,
               nr.role, nr.event_filter, nr.in_app_enabled, nr.email_enabled,
               nr.email_template_id, nt.name as template_name,
               nr.priority, nr.is_active
        FROM notification_rules nr
        JOIN notification_event_types net ON nr.event_type_id = net.id
        LEFT JOIN notification_templates nt ON nr.email_template_id = nt.id
        ORDER BY nr.event_type_id, nr.priority DESC, nr.role
    """))
    
    rules = []
    for row in cursor:
        rules.append({
            'id': row[0],
            'event_type_id': row[1],
            'event_name': row[2],
            'event_key': row[3],
            'role': row[4],
            'event_filter': json.loads(row[5]) if row[5] else None,
            'in_app_enabled': bool(row[6]),
            'email_enabled': bool(row[7]),
            'email_template_id': row[8],
            'email_template_name': row[9],
            'priority': row[10],
            'is_active': bool(row[11])
        })
    
    return jsonify({'rules': rules})

@app.route('/api/admin/notification-rules', methods=['POST'])
@token_required
@role_required('super_admin')
def create_notification_rule(current_user):
    """Notification rule létrehozása"""
    data = request.get_json()
    
    rule = NotificationRule(
        event_type_id=data['event_type_id'],
        role=data['role'],
        event_filter=json.dumps(data.get('event_filter')) if data.get('event_filter') else None,
        in_app_enabled=data.get('in_app_enabled', True),
        email_enabled=data.get('email_enabled', False),
        email_template_id=data.get('email_template_id'),
        priority=data.get('priority', 0),
        is_active=data.get('is_active', True)
    )
    
    db.session.add(rule)
    db.session.commit()
    
    return jsonify({
        'message': 'Értesítési szabály létrehozva!',
        'id': rule.id
    }), 201

@app.route('/api/admin/notification-rules/<int:rule_id>', methods=['PUT'])
@token_required
@role_required('super_admin')
def update_notification_rule(current_user, rule_id):
    """Notification rule frissítése"""
    data = request.get_json()
    
    rule = NotificationRule.query.get_or_404(rule_id)
    rule.event_type_id = data['event_type_id']
    rule.role = data['role']
    rule.event_filter = json.dumps(data.get('event_filter')) if data.get('event_filter') else None
    rule.in_app_enabled = data.get('in_app_enabled', True)
    rule.email_enabled = data.get('email_enabled', False)
    rule.email_template_id = data.get('email_template_id')
    rule.priority = data.get('priority', 0)
    rule.is_active = data.get('is_active', True)
    
    db.session.commit()
    
    return jsonify({'message': 'Értesítési szabály frissítve!'})

@app.route('/api/admin/notification-rules/<int:rule_id>', methods=['DELETE'])
@token_required
@role_required('super_admin')
def delete_notification_rule(current_user, rule_id):
    """Notification rule törlése"""
    rule = NotificationRule.query.get_or_404(rule_id)
    db.session.delete(rule)
    db.session.commit()
    
    return jsonify({'message': 'Értesítési szabály törölve!'})

@app.route('/api/admin/notification-templates', methods=['GET'])
@token_required
@role_required('super_admin')
def get_notification_templates(current_user):
    """Email template-ek listája"""
    cursor = db.session.execute(text("""
        SELECT nt.id, nt.name, nt.event_type_id, net.event_name,
               nt.subject, nt.body_html, nt.variables_used,
               nt.created_at
        FROM notification_templates nt
        JOIN notification_event_types net ON nt.event_type_id = net.id
        ORDER BY nt.event_type_id, nt.name
    """))
    
    templates = []
    for row in cursor:
        templates.append({
            'id': row[0],
            'name': row[1],
            'event_type_id': row[2],
            'event_name': row[3],
            'subject': row[4],
            'body': row[5],
            'variables_used': json.loads(row[6]) if row[6] else [],
            'created_at': row[7]
        })
    
    return jsonify({'templates': templates})

@app.route('/api/admin/notification-templates', methods=['POST'])
@token_required
@role_required('super_admin')
def create_notification_template(current_user):
    """Email template létrehozása"""
    data = request.get_json()
    
    template = NotificationTemplate(
        name=data['name'],
        event_type_id=data['event_type_id'],
        subject=data['subject'],
        body_html=data['body'],
        variables_used=json.dumps(data.get('variables_used', []))
    )
    
    db.session.add(template)
    db.session.commit()
    
    return jsonify({
        'message': 'Email sablon létrehozva!',
        'id': template.id
    }), 201

@app.route('/api/admin/notification-templates/<int:template_id>', methods=['PUT'])
@token_required
@role_required('super_admin')
def update_notification_template(current_user, template_id):
    """Email template frissítése"""
    data = request.get_json()
    
    template = NotificationTemplate.query.get_or_404(template_id)
    template.name = data['name']
    template.event_type_id = data['event_type_id']
    template.subject = data['subject']
    template.body_html = data['body']
    template.variables_used = json.dumps(data.get('variables_used', []))
    
    db.session.commit()
    
    return jsonify({'message': 'Email sablon frissítve!'})

@app.route('/api/admin/notification-templates/<int:template_id>', methods=['DELETE'])
@token_required
@role_required('super_admin')
def delete_notification_template(current_user, template_id):
    """Email template törlése"""
    # Ellenőrzés: van-e használatban
    count = NotificationRule.query.filter_by(email_template_id=template_id).count()
    if count > 0:
        return jsonify({'message': f'A sablon {count} szabályban használatban van! Először töröld a szabályokat.'}), 400
    
    template = NotificationTemplate.query.get_or_404(template_id)
    db.session.delete(template)
    db.session.commit()
    
    return jsonify({'message': 'Email sablon törölve!'})

# SMTP Settings endpoints
@app.route('/api/admin/smtp-settings', methods=['GET'])
@token_required
@role_required('super_admin')
def get_smtp_settings(current_user):
    """SMTP beállítások lekérése"""
    settings = SMTPSettings.query.first()
    
    if not settings:
        # Return default settings
        return jsonify({
            'settings': {
                'smtp_host': 'smtp.gmail.com',
                'smtp_port': 587,
                'smtp_username': '',
                'smtp_password': '',
                'from_email': 'noreply@example.com',
                'from_name': 'Lab Request System',
                'use_tls': 1,
                'is_active': 0
            }
        })
    
    return jsonify({
        'settings': {
            'id': settings.id,
            'smtp_host': settings.smtp_host,
            'smtp_port': settings.smtp_port,
            'smtp_username': settings.smtp_username,
            'smtp_password': settings.smtp_password,
            'from_email': settings.from_email,
            'from_name': settings.from_name,
            'use_tls': settings.use_tls,
            'is_active': settings.is_active
        }
    })

@app.route('/api/admin/smtp-settings', methods=['PUT'])
@token_required
@role_required('super_admin')
def update_smtp_settings(current_user):
    """SMTP beállítások frissítése/létrehozása"""
    data = request.get_json()
    
    settings = SMTPSettings.query.first()
    
    if not settings:
        # Create new settings
        settings = SMTPSettings(
            smtp_host=data.get('smtp_host'),
            smtp_port=data.get('smtp_port', 587),
            smtp_username=data.get('smtp_username'),
            smtp_password=data.get('smtp_password'),
            from_email=data.get('from_email'),
            from_name=data.get('from_name', 'Lab Request System'),
            use_tls=data.get('use_tls', 1),
            is_active=data.get('is_active', 0)
        )
        db.session.add(settings)
    else:
        # Update existing settings
        settings.smtp_host = data.get('smtp_host', settings.smtp_host)
        settings.smtp_port = data.get('smtp_port', settings.smtp_port)
        settings.smtp_username = data.get('smtp_username', settings.smtp_username)
        
        # Only update password if provided (not empty)
        if data.get('smtp_password'):
            settings.smtp_password = data.get('smtp_password')
            
        settings.from_email = data.get('from_email', settings.from_email)
        settings.from_name = data.get('from_name', settings.from_name)
        settings.use_tls = data.get('use_tls', settings.use_tls)
        settings.is_active = data.get('is_active', settings.is_active)
        settings.updated_at = datetime.datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({'message': 'SMTP beállítások mentve!'})

@app.route('/api/admin/smtp-test', methods=['POST'])
@token_required
@role_required('super_admin')
def test_smtp(current_user):
    """SMTP kapcsolat tesztelése teszt email küldéssel"""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    data = request.get_json()
    to_email = data.get('to_email')
    
    if not to_email:
        return jsonify({'error': 'Email cím megadása kötelező!'}), 400
    
    settings = SMTPSettings.query.first()
    if not settings:
        return jsonify({'error': 'SMTP beállítások nincsenek konfigurálva!'}), 400
    
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'SMTP Teszt Email - Lab Request System'
        msg['From'] = f"{settings.from_name} <{settings.from_email}>"
        msg['To'] = to_email
        
        # Email body
        html = f"""
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #4F46E5;">SMTP Teszt Email Sikeres! ✅</h2>
            <p>Ez egy teszt email a Lab Request System értesítési rendszeréből.</p>
            <p><strong>SMTP Szerver:</strong> {settings.smtp_host}:{settings.smtp_port}</p>
            <p><strong>Küldés ideje:</strong> {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            <hr style="border: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="color: #6B7280; font-size: 12px;">
              Ha ezt az emailt megkaptad, az SMTP beállításaid helyesek! 🎉
            </p>
          </body>
        </html>
        """
        
        msg.attach(MIMEText(html, 'html'))
        
        # Send email
        if settings.use_tls:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)
            server.starttls()
        else:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)
        
        server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(msg)
        server.quit()
        
        return jsonify({'message': 'Teszt email sikeresen elküldve!'}), 200
        
    except smtplib.SMTPAuthenticationError:
        return jsonify({'error': 'SMTP authentikációs hiba! Ellenőrizd a felhasználónevet és jelszót.'}), 400
    except smtplib.SMTPException as e:
        return jsonify({'error': f'SMTP hiba: {str(e)}'}), 400
    except Exception as e:
        return jsonify({'error': f'Email küldési hiba: {str(e)}'}), 500

# v8.0: === END NOTIFICATION MODULE ===

# --- Stats Route ---
@app.route('/api/stats', methods=['GET'])
@token_required
def get_stats(current_user):
    if current_user.role == 'super_admin' or current_user.role == 'labor_staff':  # v7.0.1: lab_staff → labor_staff
        total_requests = LabRequest.query.count()
        requests_by_status = db.session.query(
            LabRequest.status, db.func.count(LabRequest.id)
        ).group_by(LabRequest.status).all()
        requests_by_category = db.session.query(
            RequestCategory.name, db.func.count(LabRequest.id)
        ).join(LabRequest.category).group_by(RequestCategory.name).all()
        total_revenue = db.session.query(db.func.sum(LabRequest.total_price)).scalar() or 0
        revenue_by_status = db.session.query(
            LabRequest.status, db.func.sum(LabRequest.total_price)
        ).group_by(LabRequest.status).all()
    elif current_user.role == 'company_admin':
        total_requests = LabRequest.query.filter_by(company_id=current_user.company_id).count()
        requests_by_status = db.session.query(
            LabRequest.status, db.func.count(LabRequest.id)
        ).filter_by(company_id=current_user.company_id).group_by(LabRequest.status).all()
        requests_by_category = db.session.query(
            RequestCategory.name, db.func.count(LabRequest.id)
        ).join(LabRequest.category).filter(LabRequest.company_id == current_user.company_id).group_by(RequestCategory.name).all()
        total_revenue = db.session.query(db.func.sum(LabRequest.total_price)).filter_by(
            company_id=current_user.company_id
        ).scalar() or 0
        revenue_by_status = db.session.query(
            LabRequest.status, db.func.sum(LabRequest.total_price)
        ).filter_by(company_id=current_user.company_id).group_by(LabRequest.status).all()
    else:
        total_requests = LabRequest.query.filter_by(user_id=current_user.id).count()
        requests_by_status = db.session.query(
            LabRequest.status, db.func.count(LabRequest.id)
        ).filter_by(user_id=current_user.id).group_by(LabRequest.status).all()
        requests_by_category = db.session.query(
            RequestCategory.name, db.func.count(LabRequest.id)
        ).join(LabRequest.category).filter(LabRequest.user_id == current_user.id).group_by(RequestCategory.name).all()
        total_revenue = db.session.query(db.func.sum(LabRequest.total_price)).filter_by(
            user_id=current_user.id
        ).scalar() or 0
        revenue_by_status = db.session.query(
            LabRequest.status, db.func.sum(LabRequest.total_price)
        ).filter_by(user_id=current_user.id).group_by(LabRequest.status).all()
    
    # v7.0.29: submitted státusz egyesítése arrived_at_provider-rel (duplikáció fix)
    by_status_dict = {status: count for status, count in requests_by_status}
    if 'submitted' in by_status_dict:
        by_status_dict['arrived_at_provider'] = by_status_dict.get('arrived_at_provider', 0) + by_status_dict['submitted']
        del by_status_dict['submitted']
    
    revenue_by_status_dict = {status: (revenue or 0) for status, revenue in revenue_by_status}
    if 'submitted' in revenue_by_status_dict:
        revenue_by_status_dict['arrived_at_provider'] = revenue_by_status_dict.get('arrived_at_provider', 0) + revenue_by_status_dict['submitted']
        del revenue_by_status_dict['submitted']
    
    return jsonify({
        'total_requests': total_requests,
        'by_status': by_status_dict,
        'by_category': {cat: count for cat, count in requests_by_category},
        'total_revenue': total_revenue,
        'revenue_by_status': revenue_by_status_dict
    })

# --- v6.7 Data Definitions ---
V67_CATEGORIES = [
    {'name': 'Anyagvizsgálat', 'description': 'Anyagösszetétel és tulajdonságok meghatározása', 'color': '#0EA5E9', 'icon': 'Beaker'},
    {'name': 'Kromatográfia', 'description': 'Gáz- és folyadékkromatográfiás vizsgálatok', 'color': '#8B5CF6', 'icon': 'BarChart3'},
    {'name': 'Fizikai tulajdonság', 'description': 'Fizikai jellemzők mérése (viszkozitás, sűrűség, stb.)', 'color': '#F59E0B', 'icon': 'Gauge'},
]

def get_v67_test_types(cat_anyag_id, cat_krom_id, cat_fizikai_id):
    """Return v6.7 test type definitions from Excel spec"""
    return [
        # Anyagvizsgálat
        {'name': 'CHNS', 'description': 'Szén-, hidrogén-, oxigén- és kéntartalom meghatározása', 'category_id': cat_anyag_id, 'price': 23800, 'measurement_time': 1, 'sample_prep_required': True, 'sample_prep_description': 'Szárítás, mosás', 'sample_prep_time': 0.1, 'evaluation_time': 0.1, 'turnaround_time': 1.2, 'sample_quantity': '50-100 mg'},
        {'name': 'IR', 'description': 'Funkciós csoport meghatározás', 'category_id': cat_anyag_id, 'price': 25000, 'measurement_time': 0.7, 'sample_prep_time': 0.3, 'evaluation_time': 0.5, 'turnaround_time': 1.5, 'sample_quantity': '100 mg'},
        {'name': 'XRF', 'description': 'Elemi összetétel meghatározása', 'category_id': cat_anyag_id, 'price': 24400, 'measurement_time': 0.7, 'sample_prep_time': 0.2, 'evaluation_time': 0.3, 'turnaround_time': 1.2, 'sample_quantity': '1-4 g'},
        {'name': 'XRD', 'description': 'Ásványi összetétel minőségi meghatározása', 'category_id': cat_anyag_id, 'price': 25850, 'measurement_time': 1, 'sample_prep_time': 0.5, 'evaluation_time': 0.5, 'turnaround_time': 2, 'sample_quantity': '1-4 g'},
        {'name': 'SEM-EDX', 'description': 'Morfológia, mikorszerkezet tanulmányozása. Elemösszetétel meghatározása', 'category_id': cat_anyag_id, 'price': 39000, 'measurement_time': 2, 'sample_prep_time': 0.5, 'evaluation_time': 0.5, 'turnaround_time': 3, 'sample_quantity': '50-100 mg'},
        {'name': 'NMR folydék', 'description': 'Folyadékminták, oldható minták vizsgálata komplex szerkezeti visgálata', 'category_id': cat_anyag_id, 'price': 100000, 'measurement_time': 1, 'sample_prep_time': 0.2, 'evaluation_time': 0.7, 'turnaround_time': 1.9},
        {'name': 'NMR szilárd', 'description': 'Szilárd minták komplex szerkezeti vizsgálata', 'category_id': cat_anyag_id, 'price': 90000, 'measurement_time': 1, 'sample_prep_time': 0.2, 'evaluation_time': 0.7, 'turnaround_time': 1.9},
        {'name': 'ICP-OES', 'description': 'Elemi összetétel meghatározása feltárással Na-U-ig alacsony koncentrációban pl. ppm', 'category_id': cat_anyag_id, 'price': 13000, 'measurement_time': 1, 'sample_prep_required': True, 'sample_prep_description': 'Savas feltárás', 'sample_prep_time': 3, 'evaluation_time': 0.4, 'turnaround_time': 4.4},
        {'name': 'IR mikroszkóp', 'description': 'Mikro analitika funkciós csoport meghatározása', 'category_id': cat_anyag_id, 'price': 27700, 'measurement_time': 1, 'sample_prep_time': 0.2, 'evaluation_time': 0.5, 'turnaround_time': 1.7},
        {'name': 'Víztartalom KF', 'description': 'Ásványolajtermékek és bioüzemanyagok víztartamának meghatározása Karl-Fischer titrálással ( MKA-610 x MKC-610)', 'standard': 'Víztartalom meghatározása Karl-Fischer titrálással automata berendezés segítségével.', 'category_id': cat_anyag_id, 'price': 10000, 'measurement_time': 0.6, 'sample_prep_time': 0.2, 'evaluation_time': 0.1, 'turnaround_time': 0.9},
        {'name': 'S/N', 'description': 'Folyadékok kén- és nitrogéntartalmának meghatározása (Analytik Jena Multi EA-3100)', 'standard': 'Oxidációs kamrával és UV fluoreszcenciás és kemilumineszcenciás detektorokkal felszerelt készülék foladékmintákhoz.', 'category_id': cat_anyag_id, 'price': 12000, 'measurement_time': 1, 'sample_prep_time': 0.2, 'evaluation_time': 0.2, 'turnaround_time': 1.4},
        
        # Kromatográfia
        {'name': 'GC-MS mérés', 'description': 'GC-MS mérés', 'category_id': cat_krom_id, 'price': 90000, 'measurement_time': 3, 'sample_prep_time': 0.1, 'evaluation_time': 0.8, 'turnaround_time': 3.9},
        {'name': 'HPLC mérés', 'description': 'HPLC mérés', 'category_id': cat_krom_id, 'price': 40000, 'measurement_time': 2, 'sample_prep_time': 0.3, 'evaluation_time': 0.3, 'turnaround_time': 2.6},
        {'name': 'GC-MS módszer fejlesztés', 'description': 'GC-MS módszer fejlesztés (egyedi ár)', 'category_id': cat_krom_id, 'price': 0, 'turnaround_time': 0},
        {'name': 'HPLC módszer fejlesztés', 'description': 'HPLC/UPLC/GPC módszer fejlesztés (egyedi ár)', 'category_id': cat_krom_id, 'price': 0, 'turnaround_time': 0},
        {'name': 'GC összertétel', 'description': 'Ásványolajterrmékek és biomotorhajtóanyagok összetételének meghatározása gázkromatográfiás vizsgálattal (Shimadzu GC2010)', 'standard': 'Szénhidrogén-összetétel meghatározása FID detektorral szerelt gázkromatográfiás készülékkel.', 'category_id': cat_krom_id, 'price': 80000, 'measurement_time': 3, 'sample_prep_time': 0.5, 'evaluation_time': 1, 'turnaround_time': 4.5},
        {'name': 'Aromástartalom HPLC', 'description': 'Gázolajok aromástartalmának meghatározása HPLC-vel (Shimadzu LC20)', 'standard': 'ASTM D6591', 'category_id': cat_krom_id, 'price': 20000, 'measurement_time': 1.2, 'sample_prep_time': 0.2, 'evaluation_time': 0.3, 'turnaround_time': 1.7},
        
        # Fizikai tulajdonság
        {'name': 'Engler desztilláció', 'description': 'Ásványolajtermékek (motorhajtóanyagok) és biomotorhajtóanyagok Engler desztillációja (TANAKA AD6)', 'standard': 'ASTM D86', 'category_id': cat_fizikai_id, 'price': 12000, 'measurement_time': 1, 'sample_prep_time': 0.1, 'evaluation_time': 0.2, 'turnaround_time': 1.3},
        {'name': 'Kinematikai viszkozitás', 'description': 'Ásványolajtermékek és egyéb folyadékok kinematikai viszkozitásának meghatározása (Cannon Mini AV) (40 és 100°C)', 'standard': 'ASTMD445', 'category_id': cat_fizikai_id, 'price': 10000, 'measurement_time': 0.5, 'sample_prep_time': 0.1, 'evaluation_time': 0.1, 'turnaround_time': 0.7},
        {'name': 'Sűrűség és törésmutató', 'description': 'Ásványolajtermékek és egyéb folyadékok sűrűségének és törésmutatójának meghatározása (Anton Paar DMA 4500 M x Abbemat 300)', 'standard': 'Univerzális (12 db ASTM szabványnak - pl. D4052 - megfelelő) automata sűrűségmérő készülék kapcsolt törésmutató mérővel (6 db ASTM szabványnak megfelelő mérés).', 'category_id': cat_fizikai_id, 'price': 10000, 'measurement_time': 0.5, 'sample_prep_time': 0.1, 'evaluation_time': 0.1, 'turnaround_time': 0.7},
        {'name': 'Kokszosodási maradék', 'description': 'Ásványolajtermékek kokszosodási maradékának meghatározása mikro módszerrel (TANAKA ACR-M3)', 'standard': 'ASTM D4530, ISO10370, IP398', 'category_id': cat_fizikai_id, 'price': 12000, 'measurement_time': 0.5, 'sample_prep_time': 0.1, 'evaluation_time': 0.2, 'turnaround_time': 0.8},
        {'name': 'Nemkormozó lángmagasság', 'description': 'Petróleum forráspont-tartományú szénhidrogének (pl. sugárhajtómű üzemanyagok) nemkormozó lángmagasságának meghatározása (DC Scientific SP10)', 'standard': 'ASTM D1322, IP 598, JIS K2537', 'category_id': cat_fizikai_id, 'price': 10000, 'measurement_time': 0.5, 'sample_prep_time': 0.1, 'evaluation_time': 0.1, 'turnaround_time': 0.7},
        {'name': 'Gőznyomás', 'description': 'Motorbenzinek és egyéb szénhidrogének gőznyomásának meghatározása (Eralytics Eravap)', 'standard': 'ASTM D5191', 'category_id': cat_fizikai_id, 'price': 10000, 'measurement_time': 0.6, 'sample_prep_time': 0.1, 'evaluation_time': 0.2, 'turnaround_time': 0.9},
        {'name': 'Lobbanáspont', 'description': 'Ásványolajtermékek nyílttéri- vagy zárttéri lobbanáspontjának meghatározása', 'category_id': cat_fizikai_id, 'price': 10000, 'measurement_time': 0.6, 'sample_prep_time': 0.1, 'evaluation_time': 0.2, 'turnaround_time': 0.9},
        {'name': 'ASTM szín', 'description': 'Ásványolajtermékek ASTM színének meghatározása (SETA Lovibond)', 'standard': 'ASTM szín meghatározása szín-összehasonlítással', 'category_id': cat_fizikai_id, 'price': 6000, 'measurement_time': 0.2, 'sample_prep_time': 0.1, 'evaluation_time': 0.1, 'turnaround_time': 0.4},
        {'name': 'CFPP', 'description': 'Középpárlatok hidegszűrhetőségi határhőmérsékletének meghatározása (TANAKA AFP-102)', 'standard': 'ASTM D 6371', 'category_id': cat_fizikai_id, 'price': 12000, 'measurement_time': 0.6, 'sample_prep_time': 0.2, 'evaluation_time': 0.1, 'turnaround_time': 0.9},
        {'name': 'Zavarosodás, Dermedés, Kristályosodási pont', 'description': 'Ásványolajtermékek zavarosodás- dermedés- és kristályosodáspontjának meghatározása (Phase Series 70X)', 'standard': 'ASTM D5949, D5773, D5972', 'category_id': cat_fizikai_id, 'price': 12000, 'measurement_time': 0.6, 'sample_prep_time': 0.2, 'evaluation_time': 0.1, 'turnaround_time': 0.9},
        {'name': 'Lágyuláspont', 'description': 'Paraffinok lágyuláspontjának meghatározása', 'standard': 'ASTM D3954-15', 'category_id': cat_fizikai_id, 'price': 6000, 'measurement_time': 0.3, 'sample_prep_time': 0.1, 'evaluation_time': 0.1, 'turnaround_time': 0.5},
        {'name': 'CT', 'description': 'Két-, ill. háromdimenziós képalkotású CT vizsgálat', 'category_id': cat_fizikai_id, 'price': 28600, 'measurement_time': 3, 'sample_prep_time': 0.5, 'evaluation_time': 0.6, 'turnaround_time': 4.1},
    ]

# --- Ensure v6.7 Data (runs on every startup) ---
def ensure_v67_data():
    """Ensure v6.7 categories exist and add new test types if needed"""
    print("  🔄 Checking v6.7 data...")
    
    # 1. Ensure v6.7 categories exist
    for cat_data in V67_CATEGORIES:
        existing = RequestCategory.query.filter_by(name=cat_data['name']).first()
        if not existing:
            new_cat = RequestCategory(**cat_data)
            db.session.add(new_cat)
            print(f"    ✅ Kategória létrehozva: {cat_data['name']}")
    db.session.commit()
    
    # 2. Get category IDs
    cat_anyag = RequestCategory.query.filter_by(name='Anyagvizsgálat').first()
    cat_krom = RequestCategory.query.filter_by(name='Kromatográfia').first()
    cat_fizikai = RequestCategory.query.filter_by(name='Fizikai tulajdonság').first()
    
    # 3. Get v6.7 test types
    v67_test_types = get_v67_test_types(
        cat_anyag.id if cat_anyag else None,
        cat_krom.id if cat_krom else None,
        cat_fizikai.id if cat_fizikai else None
    )
    
    # 4. Add new test types if they don't exist
    for tt_data in v67_test_types:
        existing = TestType.query.filter_by(name=tt_data['name']).first()
        if not existing:
            new_tt = TestType(**tt_data)
            db.session.add(new_tt)
            print(f"    ✅ Vizsgálat létrehozva: {tt_data['name']}")
    db.session.commit()
    
    print("  ✅ v6.7 adatok rendben!")

# --- Update Seed Data (for FORCE_RESEED) ---
def update_seed_data():
    """Update categories and test types - full reseed"""
    with app.app_context():
        print("  🔄 FORCE_RESEED: Kategóriák és vizsgálatok frissítése...")
        
        # Update all categories
        for cat_data in V67_CATEGORIES:
            existing = RequestCategory.query.filter_by(name=cat_data['name']).first()
            if existing:
                existing.description = cat_data['description']
                existing.color = cat_data['color']
                existing.icon = cat_data['icon']
                print(f"    📝 Kategória frissítve: {cat_data['name']}")
            else:
                new_cat = RequestCategory(**cat_data)
                db.session.add(new_cat)
                print(f"    ✅ Kategória létrehozva: {cat_data['name']}")
        db.session.commit()
        
        # Get category IDs
        cat_anyag = RequestCategory.query.filter_by(name='Anyagvizsgálat').first()
        cat_krom = RequestCategory.query.filter_by(name='Kromatográfia').first()
        cat_fizikai = RequestCategory.query.filter_by(name='Fizikai tulajdonság').first()
        
        v67_test_types = get_v67_test_types(
            cat_anyag.id if cat_anyag else None,
            cat_krom.id if cat_krom else None,
            cat_fizikai.id if cat_fizikai else None
        )
        
        # Update or create test types
        for tt_data in v67_test_types:
            existing = TestType.query.filter_by(name=tt_data['name']).first()
            if existing:
                for key, value in tt_data.items():
                    if value is not None:
                        setattr(existing, key, value)
                print(f"    📝 Vizsgálat frissítve: {tt_data['name']}")
            else:
                new_tt = TestType(**tt_data)
                db.session.add(new_tt)
                print(f"    ✅ Vizsgálat létrehozva: {tt_data['name']}")
        
        db.session.commit()
        print("  ✅ FORCE_RESEED kész!")

# --- Initialize Database ---
def init_db():
    with app.app_context():
        db.create_all()
        
        # Create categories - v6.7 új kategóriák
        if RequestCategory.query.count() == 0:
            categories = [
                # MINTA ELŐKÉSZÍTÉS - MINDIG ELSŐ HELYEN!
                RequestCategory(
                    name='Minta előkészítés', 
                    description='Mintavétel, előkészítés, homogenizálás', 
                    color='#6366F1',  # Indigo
                    icon='Package'
                ),
                # v6.7 Új kategóriák
                RequestCategory(
                    name='Anyagvizsgálat', 
                    description='Anyagösszetétel és tulajdonságok meghatározása', 
                    color='#0EA5E9',  # Sky blue
                    icon='Beaker'
                ),
                RequestCategory(
                    name='Kromatográfia', 
                    description='Gáz- és folyadékkromatográfiás vizsgálatok', 
                    color='#8B5CF6',  # Purple
                    icon='BarChart3'
                ),
                RequestCategory(
                    name='Fizikai tulajdonság', 
                    description='Fizikai jellemzők mérése (viszkozitás, sűrűség, stb.)', 
                    color='#F59E0B',  # Amber
                    icon='Gauge'
                ),
            ]
            for cat in categories:
                db.session.add(cat)
            db.session.commit()
            print("✅ Kategóriák létrehozva!")
        
        # Create departments
        if Department.query.count() == 0:
            departments = [
                Department(name='Általános labor', description='Általános laboratóriumi munkák', contact_person='Adminisztrátor', contact_email='admin@pannon.hu'),  # v7.0: Default department
                Department(name='Minta Előkészítő', description='Mintavétel, homogenizálás, előkészítés', contact_person='Szabó Katalin', contact_email='szabo@pannon.hu'),
                Department(name='Kémiai Labor', description='Általános kémiai analitika', contact_person='Dr. Kovács István', contact_email='kovacs@pannon.hu'),
                Department(name='Olajipar Szaklabor', description='Ásványolaj és származékok vizsgálata', contact_person='Dr. Nagy Éva', contact_email='nagy@pannon.hu'),
                Department(name='Környezetvédelmi Labor', description='Környezeti minták elemzése', contact_person='Dr. Tóth Péter', contact_email='toth@pannon.hu'),
            ]
            for dept in departments:
                db.session.add(dept)
            db.session.commit()
            print("✅ Szervezeti egységek létrehozva!")
        
        # v7.0: Meglévő labor staff felhasználók department_id frissítése
        default_dept = Department.query.filter_by(name='Általános labor').first()
        if default_dept:
            labor_staff_without_dept = User.query.filter_by(role='labor_staff', department_id=None).all()
            for user in labor_staff_without_dept:
                user.department_id = default_dept.id
            if labor_staff_without_dept:
                db.session.commit()
                print(f"✅ {len(labor_staff_without_dept)} labor munkatárs hozzárendelve 'Általános labor' egységhez")
        
        # Create test types - v6.7 új kategóriákkal
        if TestType.query.count() == 0:
            # Get category IDs
            cat_minta = RequestCategory.query.filter_by(name='Minta előkészítés').first().id
            cat_anyag = RequestCategory.query.filter_by(name='Anyagvizsgálat').first().id
            cat_krom = RequestCategory.query.filter_by(name='Kromatográfia').first().id
            cat_fizikai = RequestCategory.query.filter_by(name='Fizikai tulajdonság').first().id
            
            test_types = [
                # MINTA ELŐKÉSZÍTÉS - FIX ELSŐ KATEGÓRIA (0 Ft, 0 nap, tény alapon)
                TestType(
                    name='Minta előkészítés', 
                    description='Minta függvényében, tény alapon kerül elszámolásra', 
                    price=0, 
                    cost_price=0,
                    category_id=cat_minta, 
                    department_id=4,  # v7.0: Minta Előkészítő
                    turnaround_days=0,
                    sample_prep_required=False
                ),
                
                # ANYAGVIZSGÁLAT
                TestType(
                    name='Kéntartalom', 
                    description='Összes kéntartalom meghatározás röntgen fluoreszcencia módszerrel', 
                    standard='MSZ EN ISO 20846',
                    price=12000, 
                    cost_price=8000,
                    category_id=cat_anyag, 
                    department_id=4,  # v7.0: Kémiai Labor
                    device='Oxford XRF',
                    turnaround_days=3,
                    measurement_time=1,
                    sample_prep_time=0.5,
                    evaluation_time=0.5,
                    turnaround_time=8,
                    sample_quantity=50,
                    hazard_level='Nem veszélyes'
                ),
                TestType(
                    name='Víztartalom (Karl Fischer)', 
                    description='Pontos vízmeghatározás titrálással', 
                    standard='MSZ EN ISO 12937',
                    price=8000, 
                    cost_price=5000,
                    category_id=cat_anyag, 
                    department_id=4,  # v7.0: Kémiai Labor
                    device='Metrohm KF Titrator',
                    turnaround_days=2,
                    measurement_time=0.5,
                    sample_prep_time=0.25,
                    evaluation_time=0.25,
                    turnaround_time=4,
                    sample_quantity=10,
                    hazard_level='Nem veszélyes'
                ),
                TestType(
                    name='Aszfaltén tartalom', 
                    description='N-heptán oldhatatlan frakció meghatározás', 
                    standard='ASTM D6560',
                    price=15000, 
                    cost_price=10000,
                    category_id=cat_anyag, 
                    department_id=4,  # v7.0: Olajipar Szaklabor
                    turnaround_days=7,
                    measurement_time=4,
                    sample_prep_time=2,
                    evaluation_time=1,
                    turnaround_time=24,
                    sample_quantity=100,
                    hazard_level='Gyúlékony'
                ),
                TestType(
                    name='TBN (Teljes bázikus szám)', 
                    description='Savsemlegesítő képesség', 
                    standard='ASTM D2896',
                    price=13000, 
                    cost_price=8500,
                    category_id=cat_anyag, 
                    department_id=3,  # v7.0: Kémiai Labor
                    turnaround_days=4,
                    measurement_time=1.5,
                    sample_prep_time=0.5,
                    evaluation_time=0.5,
                    turnaround_time=10,
                    sample_quantity=50,
                    hazard_level='Nem veszélyes'
                ),
                TestType(
                    name='TAN (Teljes savas szám)', 
                    description='Oxidáció, szennyeződés mértéke', 
                    standard='ASTM D664',
                    price=11000, 
                    cost_price=7000,
                    category_id=cat_anyag, 
                    department_id=4, 
                    turnaround_days=4,
                    measurement_time=1.5,
                    sample_prep_time=0.5,
                    evaluation_time=0.5,
                    turnaround_time=10,
                    sample_quantity=50,
                    hazard_level='Nem veszélyes'
                ),
                
                # KROMATOGRÁFIA
                TestType(
                    name='FAME tartalom (GC)', 
                    description='Zsírsav-metil-észter koncentráció gázkromatográfiával', 
                    standard='EN 14103',
                    price=14000, 
                    cost_price=9500,
                    category_id=cat_krom, 
                    department_id=4, 
                    device='Agilent 7890 GC-FID',
                    turnaround_days=5,
                    measurement_time=2,
                    sample_prep_time=1,
                    evaluation_time=1,
                    turnaround_time=16,
                    sample_quantity=5,
                    hazard_level='Gyúlékony'
                ),
                TestType(
                    name='Benzol tartalom', 
                    description='Aromás szénhidrogén koncentráció GC-vel', 
                    standard='EN 238',
                    price=14000, 
                    cost_price=9000,
                    category_id=cat_krom, 
                    department_id=4, 
                    device='Agilent 7890 GC-MS',
                    turnaround_days=5,
                    measurement_time=1.5,
                    sample_prep_time=0.5,
                    evaluation_time=1,
                    turnaround_time=12,
                    sample_quantity=5,
                    hazard_level='Mérgező'
                ),
                TestType(
                    name='Gázösszetétel (GC)', 
                    description='PB-gáz, földgáz komponens analízis', 
                    standard='ASTM D1945',
                    price=16000, 
                    cost_price=11000,
                    category_id=cat_krom, 
                    department_id=4, 
                    device='Agilent 7890 GC-TCD',
                    turnaround_days=5,
                    measurement_time=1,
                    sample_prep_time=0.5,
                    evaluation_time=1,
                    turnaround_time=10,
                    sample_quantity=500,  # ml gáz
                    hazard_level='Gyúlékony'
                ),
                TestType(
                    name='PAH vizsgálat (16 EPA)', 
                    description='Poliaromás szénhidrogének GC-MS módszerrel', 
                    standard='EPA 8270D',
                    price=25000, 
                    cost_price=17000,
                    category_id=cat_krom, 
                    department_id=4, 
                    device='Agilent 7890/5977 GC-MS',
                    turnaround_days=10,
                    measurement_time=3,
                    sample_prep_time=4,
                    evaluation_time=2,
                    turnaround_time=40,
                    sample_quantity=100,
                    hazard_level='Mérgező',
                    sample_prep_required=True
                ),
                TestType(
                    name='BTEX vizsgálat', 
                    description='Benzol, Toluol, Etilbenzol, Xilol', 
                    standard='EPA 8260',
                    price=20000, 
                    cost_price=13000,
                    category_id=cat_krom, 
                    department_id=4, 
                    device='Agilent GC-MS Headspace',
                    turnaround_days=7,
                    measurement_time=2,
                    sample_prep_time=1,
                    evaluation_time=1.5,
                    turnaround_time=20,
                    sample_quantity=50,
                    hazard_level='Mérgező'
                ),
                
                # FIZIKAI TULAJDONSÁG
                TestType(
                    name='Viszkozitás (40°C)', 
                    description='Kinematikai viszkozitás 40°C-on', 
                    standard='ASTM D445',
                    price=10000, 
                    cost_price=6000,
                    category_id=cat_fizikai, 
                    department_id=4, 
                    device='Anton Paar SVM 3001',
                    turnaround_days=2,
                    measurement_time=0.5,
                    sample_prep_time=0.25,
                    evaluation_time=0.25,
                    turnaround_time=4,
                    sample_quantity=20,
                    hazard_level='Nem veszélyes'
                ),
                TestType(
                    name='Viszkozitás (100°C)', 
                    description='Kinematikai viszkozitás 100°C-on', 
                    standard='ASTM D445',
                    price=10000, 
                    cost_price=6000,
                    category_id=cat_fizikai, 
                    department_id=4, 
                    device='Anton Paar SVM 3001',
                    turnaround_days=2,
                    measurement_time=0.5,
                    sample_prep_time=0.25,
                    evaluation_time=0.25,
                    turnaround_time=4,
                    sample_quantity=20,
                    hazard_level='Nem veszélyes'
                ),
                TestType(
                    name='Sűrűség (15°C)', 
                    description='Sűrűség meghatározás 15°C-on', 
                    standard='ASTM D4052',
                    price=6000, 
                    cost_price=3500,
                    category_id=cat_fizikai, 
                    department_id=4, 
                    device='Anton Paar DMA 4500',
                    turnaround_days=1,
                    measurement_time=0.25,
                    sample_prep_time=0.1,
                    evaluation_time=0.15,
                    turnaround_time=2,
                    sample_quantity=10,
                    hazard_level='Nem veszélyes'
                ),
                TestType(
                    name='Lobbanáspont', 
                    description='Tűzvédelmi jellemző meghatározás', 
                    standard='ASTM D93',
                    price=7000, 
                    cost_price=4500,
                    category_id=cat_fizikai, 
                    department_id=4, 
                    device='Pensky-Martens készülék',
                    turnaround_days=2,
                    measurement_time=1,
                    sample_prep_time=0.25,
                    evaluation_time=0.25,
                    turnaround_time=6,
                    sample_quantity=75,
                    hazard_level='Gyúlékony'
                ),
                TestType(
                    name='Dermedéspont', 
                    description='Minimális folyási hőmérséklet meghatározás', 
                    standard='ASTM D97',
                    price=9000, 
                    cost_price=6000,
                    category_id=cat_fizikai, 
                    department_id=4, 
                    turnaround_days=3,
                    measurement_time=2,
                    sample_prep_time=0.5,
                    evaluation_time=0.5,
                    turnaround_time=12,
                    sample_quantity=50,
                    hazard_level='Nem veszélyes'
                ),
                TestType(
                    name='CFPP (Hideg szűrhetőség)', 
                    description='Dízel téli használhatósági határ', 
                    standard='EN 116',
                    price=11000, 
                    cost_price=7500,
                    category_id=cat_fizikai, 
                    department_id=4, 
                    device='ISL CFPP készülék',
                    turnaround_days=4,
                    measurement_time=1.5,
                    sample_prep_time=0.5,
                    evaluation_time=0.5,
                    turnaround_time=10,
                    sample_quantity=50,
                    hazard_level='Gyúlékony'
                ),
                TestType(
                    name='Cetánszám', 
                    description='Dízel öngyulladási jellemző', 
                    standard='EN ISO 5165',
                    price=20000, 
                    cost_price=14000,
                    category_id=cat_fizikai, 
                    department_id=4, 
                    device='CFR cetán motor',
                    turnaround_days=5,
                    measurement_time=3,
                    sample_prep_time=1,
                    evaluation_time=1,
                    turnaround_time=20,
                    sample_quantity=500,
                    hazard_level='Gyúlékony'
                ),
                TestType(
                    name='Oktánszám (RON)', 
                    description='Benzin kopogásállóság - Research módszer', 
                    standard='EN ISO 5164',
                    price=18000, 
                    cost_price=12000,
                    category_id=cat_fizikai, 
                    department_id=4, 
                    device='CFR oktán motor',
                    turnaround_days=4,
                    measurement_time=2,
                    sample_prep_time=0.5,
                    evaluation_time=0.5,
                    turnaround_time=16,
                    sample_quantity=500,
                    hazard_level='Gyúlékony'
                ),
            ]
            for tt in test_types:
                db.session.add(tt)
            db.session.commit()
            print("✅ Vizsgálattípusok létrehozva!")
        
        # Create company
        if Company.query.count() == 0:
            company = Company(
                name='MOL Nyrt.',
                address='1117 Budapest, Október huszonharmadika u. 18.',
                contact_person='Nagy Péter',
                contact_email='peter.nagy@mol.hu',
                contact_phone='+36 1 464 0000',
                logo_filename='mol_logo.png'  # Default logo
            )
            db.session.add(company)
            db.session.commit()
            print("✅ Cég létrehozva!")
        
        # Create users
        if User.query.count() == 0:
            users = [
                User(
                    email='admin@pannon.hu',
                    password=generate_password_hash('admin123'),
                    name='Dr. Szabó László',
                    role='super_admin',
                    phone='+36 30 123 4567'
                ),
                User(
                    email='labor@pannon.hu',
                    password=generate_password_hash('labor123'),
                    name='Kiss Éva',
                    role='labor_staff',  # v7.0.1: Renamed lab_staff → labor_staff for consistency
                    phone='+36 30 234 5678'
                ),
                User(
                    email='admin@mol.hu',
                    password=generate_password_hash('mol123'),
                    name='Nagy Péter',
                    role='company_admin',
                    company_id=1,
                    phone='+36 30 345 6789'
                ),
                User(
                    email='user@mol.hu',
                    password=generate_password_hash('mol123'),
                    name='Tóth János',
                    role='company_user',
                    company_id=1,
                    phone='+36 30 456 7890'
                ),
            ]
            for user in users:
                db.session.add(user)
            db.session.commit()
            print("✅ Felhasználók létrehozva!")
        
        # Create sample requests
        if LabRequest.query.count() == 0:
            requests = [
                LabRequest(
                    user_id=4, company_id=1, category_id=1,
                    sample_id='MOL-2024-001',
                    sample_description='Kőolaj minta az algyői mezőről',
                    test_types=json.dumps([1, 2, 3]),
                    total_price=35000,
                    urgency='normal', status='submitted',
                    sampling_location='Algyő, 3. kút',
                    sampling_date=datetime.datetime(2024, 11, 15),
                    deadline=datetime.datetime(2024, 11, 30),
                    special_instructions='40°C-on kell tárolni'
                ),
                LabRequest(
                    user_id=4, company_id=1, category_id=2,
                    sample_id='MOL-2024-002',
                    sample_description='Dízelolaj minta',
                    test_types=json.dumps([4, 5]),
                    total_price=28000,
                    urgency='urgent', status='in_progress',
                    sampling_location='Százhalombatta, finomító',
                    sampling_date=datetime.datetime(2024, 11, 18),
                    deadline=datetime.datetime(2024, 11, 25),
                    special_instructions='Gyúlékony anyag, óvatosan kezelendő'
                ),
            ]
            for req in requests:
                db.session.add(req)
            db.session.commit()
            print("✅ Példa laborkérések létrehozva!")
        
        print("\n🎉 Adatbázis inicializálva!")

def auto_migrate():
    """
    Automatic migration that runs on app startup
    Uses the migration framework from migrations.py
    """
    with app.app_context():
        try:
            from sqlalchemy import inspect
            from migrations import apply_migrations
            
            print("  📋 Running schema migrations...")
            inspector = inspect(db.engine)
            
            # Apply all pending migrations from migrations.py
            success, applied, errors = apply_migrations(db, inspector)
            
            if applied:
                print(f"\n✅ Auto-migration completed! Applied {len(applied)} changes:")
                for mig in applied:
                    print(f"   - {mig['table']}.{mig['column']}: {mig['description']}")
            else:
                print("✅ Database schema is up to date (no migrations needed)")
            
            if errors:
                print(f"\n⚠️  {len(errors)} errors occurred:")
                for error in errors:
                    print(f"   {error}")
            
            # v6.7: Fix sample_quantity column type (FLOAT -> VARCHAR)
            try:
                # Check if sample_quantity is FLOAT type and convert to VARCHAR
                result = db.session.execute(db.text("""
                    SELECT data_type FROM information_schema.columns 
                    WHERE table_name = 'test_type' AND column_name = 'sample_quantity'
                """))
                row = result.fetchone()
                if row and row[0] in ('double precision', 'real', 'numeric', 'float'):
                    print("  🔄 Converting sample_quantity from FLOAT to VARCHAR...")
                    db.session.execute(db.text("ALTER TABLE test_type ALTER COLUMN sample_quantity TYPE VARCHAR(100)"))
                    db.session.commit()
                    print("  ✅ sample_quantity converted to VARCHAR")
            except Exception as e:
                print(f"  ⚠️  sample_quantity type check/conversion skipped: {e}")
                db.session.rollback()
            
            # v6.7: Fix standard column type (VARCHAR -> TEXT)
            try:
                result = db.session.execute(db.text("""
                    SELECT data_type, character_maximum_length FROM information_schema.columns 
                    WHERE table_name = 'test_type' AND column_name = 'standard'
                """))
                row = result.fetchone()
                if row and row[0] == 'character varying' and row[1] and row[1] < 500:
                    print("  🔄 Converting standard from VARCHAR to TEXT...")
                    db.session.execute(db.text("ALTER TABLE test_type ALTER COLUMN standard TYPE TEXT"))
                    db.session.commit()
                    print("  ✅ standard converted to TEXT")
            except Exception as e:
                print(f"  ⚠️  standard type check/conversion skipped: {e}")
                db.session.rollback()
            
            return success
            
        except ImportError:
            # Fallback to inline migrations if migrations.py not found
            print("  ⚠️  migrations.py not found, using inline migrations")
            return auto_migrate_inline()
        except Exception as e:
            db.session.rollback()
            print(f"⚠️  Auto-migration failed: {e}")
            print("   Application will continue, but some features may not work correctly.")
            return False

def auto_migrate_inline():
    """
    Inline migration fallback (for backward compatibility)
    Includes v7.0 migrations: user.department_id, test_result table
    """
    try:
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        
        lab_request_columns = [col['name'] for col in inspector.get_columns('lab_request')]
        department_columns = [col['name'] for col in inspector.get_columns('department')]
        user_columns = [col['name'] for col in inspector.get_columns('user')]  # v7.0
        existing_tables = inspector.get_table_names()  # v7.0
        
        migrations_applied = []
        
        # LabRequest migrations
        if 'sampling_address' not in lab_request_columns:
            db.session.execute(db.text("ALTER TABLE lab_request ADD COLUMN sampling_address VARCHAR(500)"))
            migrations_applied.append('lab_request.sampling_address')
            print("  🔄 Added sampling_address to lab_request")
        
        if 'contact_person' not in lab_request_columns:
            db.session.execute(db.text("ALTER TABLE lab_request ADD COLUMN contact_person VARCHAR(200)"))
            migrations_applied.append('lab_request.contact_person')
            print("  🔄 Added contact_person to lab_request")
        
        if 'contact_phone' not in lab_request_columns:
            db.session.execute(db.text("ALTER TABLE lab_request ADD COLUMN contact_phone VARCHAR(50)"))
            migrations_applied.append('lab_request.contact_phone')
            print("  🔄 Added contact_phone to lab_request")
        
        # Department migrations
        if 'sample_pickup_address' not in department_columns:
            db.session.execute(db.text("ALTER TABLE department ADD COLUMN sample_pickup_address VARCHAR(500)"))
            migrations_applied.append('department.sample_pickup_address')
            print("  🔄 Added sample_pickup_address to department")
        
        if 'sample_pickup_contact' not in department_columns:
            db.session.execute(db.text("ALTER TABLE department ADD COLUMN sample_pickup_contact VARCHAR(200)"))
            migrations_applied.append('department.sample_pickup_contact')
            print("  🔄 Added sample_pickup_contact to department")
        
        # v7.0: User.department_id migration
        if 'department_id' not in user_columns:
            db.session.execute(db.text("ALTER TABLE \"user\" ADD COLUMN department_id INTEGER REFERENCES department(id)"))
            migrations_applied.append('user.department_id')
            print("  🔄 Added department_id to user (v7.0)")
        
        # v7.0: test_result table creation
        if 'test_result' not in existing_tables:
            db.session.execute(db.text("""
                CREATE TABLE test_result (
                    id SERIAL PRIMARY KEY,
                    lab_request_id INTEGER NOT NULL REFERENCES lab_request(id) ON DELETE CASCADE,
                    test_type_id INTEGER NOT NULL REFERENCES test_type(id),
                    result_text TEXT,
                    attachment_filename VARCHAR(200),
                    status VARCHAR(50) DEFAULT 'pending',
                    completed_by_user_id INTEGER REFERENCES "user"(id),
                    completed_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            migrations_applied.append('test_result table')
            print("  🔄 Created test_result table (v7.0)")
        
        if migrations_applied:
            db.session.commit()
            print(f"✅ Applied {len(migrations_applied)} migrations")
        
        return True
        
    except Exception as e:
        db.session.rollback()
        print(f"⚠️  Inline migration failed: {e}")
        import traceback
        traceback.print_exc()  # v7.0: Better error debugging
        return False

# Global flag to track initialization
_app_initialized = False

@app.before_request
def ensure_initialized():
    """
    Automatic initialization check on first request
    This ensures data exists even when running with Gunicorn (Railway production)
    """
    global _app_initialized
    
    if _app_initialized:
        return
    
    try:
        # Check if we need to initialize
        with app.app_context():
            # Check if categories exist
            if RequestCategory.query.count() == 0:
                print("\n🔄 Auto-initializing database (first request)...")
                print("   Reason: No categories found in database")
                init_db()
                print("✅ Auto-initialization completed!")
            
        _app_initialized = True
        
    except Exception as e:
        print(f"⚠️  Auto-initialization failed: {e}")
        _app_initialized = True  # Don't try again

@app.route('/api/init', methods=['GET'])
def initialize_database():
    """Database initialization endpoint - csak egyszer kell meghívni!"""
    try:
        init_db()
        return jsonify({"message": "✅ Database initialized successfully!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/reset-data', methods=['POST'])
@token_required
def reset_data_endpoint(current_user):
    """
    Reset and reinitialize all data (categories, test types, departments, etc.)
    Only super_admin can run this
    WARNING: This will DELETE all existing data!
    """
    if current_user.role != 'super_admin':
        return jsonify({'message': '⛔ Nincs jogosultságod! Csak super_admin futtathatja.'}), 403
    
    try:
        print("\n🔄 Resetting database data...")
        
        # Delete all data (except users and companies)
        from sqlalchemy import text
        
        # Delete in correct order (foreign keys)
        print("  🗑️  Deleting lab requests...")
        db.session.execute(text("DELETE FROM lab_request"))
        
        print("  🗑️  Deleting test types...")
        db.session.execute(text("DELETE FROM test_type"))
        
        print("  🗑️  Deleting categories...")
        db.session.execute(text("DELETE FROM request_category"))
        
        print("  🗑️  Deleting departments...")
        db.session.execute(text("DELETE FROM department"))
        
        db.session.commit()
        print("  ✅ Old data deleted")
        
        # Now reinitialize (this will recreate everything)
        print("\n🔄 Reinitializing data...")
        init_db()
        
        # Count results
        categories_count = RequestCategory.query.count()
        test_types_count = TestType.query.count()
        departments_count = Department.query.count()
        
        return jsonify({
            'message': '✅ Data reset completed successfully!',
            'data': {
                'categories': categories_count,
                'test_types': test_types_count,
                'departments': departments_count
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        error_msg = f'❌ Data reset failed: {str(e)}'
        print(error_msg)
        return jsonify({'message': error_msg, 'error': str(e)}), 500

@app.route('/api/migrate-v2', methods=['POST'])
@token_required
def migrate_v2_endpoint(current_user):
    """
    Migration endpoint for v6.6 ENHANCED v2
    Adds new columns: sampling_address, contact_person, contact_phone
    Only super_admin can run this
    """
    if current_user.role != 'super_admin':
        return jsonify({'message': '⛔ Nincs jogosultságod! Csak super_admin futtathatja.'}), 403
    
    try:
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        
        # Get existing columns
        lab_request_columns = [col['name'] for col in inspector.get_columns('lab_request')]
        department_columns = [col['name'] for col in inspector.get_columns('department')]
        
        results = []
        
        print("🔄 Starting migration for v6.6 ENHANCED v2...")
        
        # Migrate LabRequest table
        print("\n📋 Migrating LabRequest table...")
        
        if 'sampling_address' not in lab_request_columns:
            db.session.execute(db.text("ALTER TABLE lab_request ADD COLUMN sampling_address VARCHAR(500)"))
            results.append('✅ Added: lab_request.sampling_address')
            print("  ✅ Adding column: sampling_address")
        else:
            results.append('⏭️  Already exists: lab_request.sampling_address')
            print("  ⏭️  Column already exists: sampling_address")
        
        if 'contact_person' not in lab_request_columns:
            db.session.execute(db.text("ALTER TABLE lab_request ADD COLUMN contact_person VARCHAR(200)"))
            results.append('✅ Added: lab_request.contact_person')
            print("  ✅ Adding column: contact_person")
        else:
            results.append('⏭️  Already exists: lab_request.contact_person')
            print("  ⏭️  Column already exists: contact_person")
        
        if 'contact_phone' not in lab_request_columns:
            db.session.execute(db.text("ALTER TABLE lab_request ADD COLUMN contact_phone VARCHAR(50)"))
            results.append('✅ Added: lab_request.contact_phone')
            print("  ✅ Adding column: contact_phone")
        else:
            results.append('⏭️  Already exists: lab_request.contact_phone')
            print("  ⏭️  Column already exists: contact_phone")
        
        # Migrate Department table
        print("\n🏢 Migrating Department table...")
        
        if 'sample_pickup_address' not in department_columns:
            db.session.execute(db.text("ALTER TABLE department ADD COLUMN sample_pickup_address VARCHAR(500)"))
            results.append('✅ Added: department.sample_pickup_address')
            print("  ✅ Adding column: sample_pickup_address")
        else:
            results.append('⏭️  Already exists: department.sample_pickup_address')
            print("  ⏭️  Column already exists: sample_pickup_address")
        
        if 'sample_pickup_contact' not in department_columns:
            db.session.execute(db.text("ALTER TABLE department ADD COLUMN sample_pickup_contact VARCHAR(200)"))
            results.append('✅ Added: department.sample_pickup_contact')
            print("  ✅ Adding column: sample_pickup_contact")
        else:
            results.append('⏭️  Already exists: department.sample_pickup_contact')
            print("  ⏭️  Column already exists: sample_pickup_contact")
        
        db.session.commit()
        
        print("\n✅ Migration completed successfully!")
        print("\n📝 Changes made:")
        print("   - LabRequest: sampling_address, contact_person, contact_phone")
        print("   - Department: sample_pickup_address, sample_pickup_contact")
        
        return jsonify({
            'message': '✅ Migration v2 completed successfully!',
            'changes': results
        }), 200
        
    except Exception as e:
        db.session.rollback()
        error_msg = f'❌ Migration failed: {str(e)}'
        print(error_msg)
        return jsonify({'message': error_msg, 'error': str(e)}), 500

if __name__ == '__main__':
    # Local development mode - init everything
    init_db()
    
    # Auto-migration: Automatically apply schema changes
    print("\n🔄 Checking for database migrations...")
    auto_migrate()
    
    print("\n🚀 Backend starting...")
    print("📊 API endpoint: /api/stats")
    print("\n🆕 v6.6 features:")
    print("   📁 Categories")
    print("   📎 File attachments (max 20 MB)")
    print("   🏢 Company logo")
    print("   🎨 Color-coded test types")
    print("\n🆕 v6.6 ENHANCED v2:")
    print("   📍 Sampling address & contact details")
    print("   🏢 Department sample pickup info")
    print("   📅 Optional deadline")
    print("   🎯 Auto-scroll to validation errors\n")
    
    # v6.6 Production: Use PORT from environment
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('DEBUG', 'False') == 'True'
    app.run(host='0.0.0.0', port=port, debug=debug)
else:
    # Production mode (Gunicorn) - init on first import
    print("\n🔄 Production mode: Running auto-initialization...")
    with app.app_context():
        # Create tables if they don't exist
        db.create_all()
        
        # Run migrations
        print("🔄 Checking for database migrations...")
        auto_migrate()
        
        # Check for force reseed
        force_reseed = os.environ.get('FORCE_RESEED', 'false').lower() == 'true'
        
        if force_reseed:
            print("⚠️ FORCE_RESEED enabled - updating categories and test types...")
            update_seed_data()
            print("✅ Seed data updated!")
        elif RequestCategory.query.count() == 0:
            print("🔄 No data found, initializing database...")
            init_db()
            print("✅ Database initialized!")
        
        # ALWAYS ensure v6.7 data exists and fields are populated
        ensure_v67_data()
        
    print("✅ Production initialization complete!\n")

# ============================================
# SIMPLE v8.0 MIGRATION - GET ENDPOINT
# ============================================
@app.route('/migrate-v8-run', methods=['GET'])
def migrate_v8_simple():
    """
    Egyszerű migration endpoint - böngészőből hívható
    URL: /migrate-v8-run?secret=LAB2024SECRET
    """
    # Secret check (biztonság)
    secret = request.args.get('secret', '')
    if secret != 'LAB2024SECRET':
        return """
        <html>
        <head><title>Access Denied</title></head>
        <body style="font-family: Arial; text-align: center; padding: 100px;">
            <h1 style="color: #ef4444;">❌ Invalid Secret</h1>
            <p>URL formátum: /migrate-v8-run?secret=LAB2024SECRET</p>
        </body>
        </html>
        """, 403
    
    try:
        results = []
        
        # 1. Drop old table
        db.session.execute(text("DROP TABLE IF EXISTS notifications CASCADE"))
        db.session.commit()
        results.append('✅ Old notifications table dropped')
        
        # 2. Create notification_event_types
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS notification_event_types (
                id SERIAL PRIMARY KEY,
                event_key VARCHAR(50) UNIQUE NOT NULL,
                event_name VARCHAR(100) NOT NULL,
                description TEXT,
                available_variables TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
        events = [
            ('status_change', 'Státuszváltozás', 'Kérés státusza megváltozott', '["request_number"]'),
            ('new_request', 'Új kérés létrehozva', 'Új laborkérés', '["request_number"]'),
            ('request_approved', 'Kérés jóváhagyva', 'Jóváhagyva', '["request_number"]'),
            ('request_rejected', 'Kérés elutasítva', 'Elutasítva', '["request_number"]'),
            ('results_uploaded', 'Eredmények feltöltve', 'Eredmények elérhetők', '["request_number"]'),
            ('deadline_approaching', 'Határidő közeledik', 'Lejárat közel', '["request_number"]'),
            ('comment_added', 'Megjegyzés hozzáadva', 'Új megjegyzés', '["request_number"]')
        ]
        
        for e in events:
            db.session.execute(text("""
                INSERT INTO notification_event_types (event_key, event_name, description, available_variables)
                VALUES (:k, :n, :d, :v) ON CONFLICT (event_key) DO NOTHING
            """), {'k': e[0], 'n': e[1], 'd': e[2], 'v': e[3]})
        
        db.session.commit()
        results.append(f'✅ Event types created ({len(events)} types)')
        
        # 3. Create notification_templates
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS notification_templates (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                event_type_id INTEGER NOT NULL,
                subject VARCHAR(200) NOT NULL,
                body_html TEXT NOT NULL,
                variables_used TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
        templates = [
            ('Státuszváltozás', 1, 'Státusz: {{request_number}}', '<p>Státusz változott</p>', '[]'),
            ('Új kérés', 2, 'Új: {{request_number}}', '<p>Új kérés</p>', '[]'),
            ('Jóváhagyva', 3, 'OK: {{request_number}}', '<p>Jóváhagyva</p>', '[]'),
            ('Elutasítva', 4, 'NO: {{request_number}}', '<p>Elutasítva</p>', '[]'),
            ('Eredmények', 5, 'Kész: {{request_number}}', '<p>Eredmények</p>', '[]')
        ]
        
        for t in templates:
            db.session.execute(text("""
                INSERT INTO notification_templates (name, event_type_id, subject, body_html, variables_used)
                VALUES (:n, :e, :s, :b, :v)
            """), {'n': t[0], 'e': t[1], 's': t[2], 'b': t[3], 'v': t[4]})
        
        db.session.commit()
        results.append(f'✅ Templates created ({len(templates)} templates)')
        
        # 4. Create notification_rules
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS notification_rules (
                id SERIAL PRIMARY KEY,
                event_type_id INTEGER NOT NULL,
                role VARCHAR(50) NOT NULL,
                event_filter TEXT,
                in_app_enabled INTEGER DEFAULT 1,
                email_enabled INTEGER DEFAULT 0,
                email_template_id INTEGER,
                priority INTEGER DEFAULT 5,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
        rules = [
            (1, 'company_user', None, 1, 0, None, 10, 1),
            (1, 'company_admin', None, 1, 1, 1, 10, 1),
            (1, 'labor_staff', None, 1, 0, None, 5, 1),
            (1, 'super_admin', None, 1, 0, None, 5, 1),
            (2, 'company_admin', None, 1, 1, 2, 10, 1),
            (2, 'labor_staff', None, 1, 0, None, 8, 1),
            (2, 'super_admin', None, 1, 0, None, 5, 1),
            (3, 'company_user', None, 1, 1, 3, 10, 1),
            (4, 'company_user', None, 1, 1, 4, 10, 1),
            (5, 'company_user', None, 1, 1, 5, 10, 1),
            (5, 'company_admin', None, 1, 0, None, 8, 1),
            (5, 'labor_staff', None, 1, 0, None, 5, 1),
            (6, 'labor_staff', None, 1, 0, None, 8, 1),
            (7, 'company_user', None, 1, 0, None, 5, 1)
        ]
        
        for r in rules:
            db.session.execute(text("""
                INSERT INTO notification_rules 
                (event_type_id, role, event_filter, in_app_enabled, email_enabled, 
                 email_template_id, priority, is_active)
                VALUES (:e, :r, :f, :a, :m, :t, :p, :s)
            """), {'e': r[0], 'r': r[1], 'f': r[2], 'a': r[3], 'm': r[4], 't': r[5], 'p': r[6], 's': r[7]})
        
        db.session.commit()
        results.append(f'✅ Rules created ({len(rules)} rules)')
        
        # 5. Create notifications table
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                event_type_id INTEGER NOT NULL,
                event_data TEXT,
                message TEXT NOT NULL,
                link_url VARCHAR(200),
                request_id INTEGER,
                is_read INTEGER DEFAULT 0,
                read_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        db.session.commit()
        results.append('✅ Notifications table created')
        
        # 6. Create smtp_settings
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS smtp_settings (
                id SERIAL PRIMARY KEY,
                smtp_host VARCHAR(100),
                smtp_port INTEGER DEFAULT 587,
                smtp_username VARCHAR(100),
                smtp_password VARCHAR(200),
                from_email VARCHAR(100),
                from_name VARCHAR(100),
                use_tls INTEGER DEFAULT 1,
                is_active INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
        db.session.execute(text("""
            INSERT INTO smtp_settings (smtp_host, smtp_port, from_email, from_name, is_active)
            VALUES (:h, :p, :e, :n, :a)
        """), {'h': 'smtp.gmail.com', 'p': 587, 'e': 'noreply@example.com', 'n': 'Labor', 'a': 0})
        
        db.session.commit()
        results.append('✅ SMTP settings created')
        
        # Success HTML
        html = """
        <html>
        <head>
            <title>v8.0 Migration Success</title>
            <style>
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    max-width: 900px; 
                    margin: 50px auto; 
                    padding: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                }
                .container {
                    background: white;
                    border-radius: 16px;
                    padding: 40px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                }
                h1 { 
                    color: #10b981; 
                    font-size: 2.5em;
                    margin-bottom: 10px;
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }
                .subtitle {
                    color: #6b7280;
                    font-size: 1.1em;
                    margin-bottom: 30px;
                }
                .step { 
                    padding: 15px 20px; 
                    margin: 10px 0; 
                    background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
                    border-left: 5px solid #10b981; 
                    border-radius: 8px;
                    font-size: 1.1em;
                    transition: transform 0.2s;
                }
                .step:hover {
                    transform: translateX(5px);
                }
                .footer { 
                    margin-top: 40px; 
                    padding-top: 30px; 
                    border-top: 3px solid #e5e7eb; 
                }
                .next-steps {
                    background: #f9fafb;
                    padding: 20px;
                    border-radius: 12px;
                    margin-top: 20px;
                }
                .next-steps h3 {
                    color: #4f46e5;
                    margin-top: 0;
                }
                .next-steps ol {
                    font-size: 1.1em;
                    line-height: 1.8;
                }
                .next-steps li {
                    margin: 10px 0;
                }
                .badge {
                    display: inline-block;
                    background: #10b981;
                    color: white;
                    padding: 5px 15px;
                    border-radius: 20px;
                    font-size: 0.9em;
                    font-weight: bold;
                    margin-left: 10px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>
                    <span style="font-size: 1.5em;">✅</span>
                    v8.0 Migration Sikeres!
                    <span class="badge">DONE</span>
                </h1>
                <div class="subtitle">PostgreSQL táblák létrehozva és feltöltve</div>
        """
        
        for result in results:
            html += f'<div class="step">{result}</div>'
        
        html += """
                <div class="footer">
                    <div class="next-steps">
                        <h3>🎯 Következő lépések:</h3>
                        <ol>
                            <li><strong>Login as super_admin</strong> → super@admin.com</li>
                            <li><strong>Navigálj:</strong> Menü → "Értesítések"</li>
                            <li><strong>Ellenőrizd:</strong> Rules tab (14 szabály) + Templates tab (5 sablon)</li>
                            <li><strong>Teszt:</strong> NotificationBell harang ikon működik minden user-nél</li>
                            <li><strong>Próba:</strong> Hozz létre egy új kérést → értesítés megjelenik</li>
                        </ol>
                    </div>
                    <p style="text-align: center; color: #6b7280; margin-top: 30px; font-size: 0.95em;">
                        🚀 v8.0 Abstract Notification System aktiválva!<br>
                        <small>Migration completed successfully at """ + str(__import__('datetime').datetime.now()) + """</small>
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return html, 200
        
    except Exception as e:
        import traceback
        error_html = f"""
        <html>
        <head>
            <title>Migration Error</title>
            <style>
                body {{ 
                    font-family: Arial; 
                    max-width: 900px; 
                    margin: 50px auto; 
                    padding: 20px;
                    background: linear-gradient(135deg, #fee 0%, #fcc 100%);
                    min-height: 100vh;
                }}
                .container {{
                    background: white;
                    border-radius: 16px;
                    padding: 40px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                }}
                h1 {{ color: #ef4444; font-size: 2em; }}
                pre {{ 
                    background: #fee; 
                    padding: 20px; 
                    border-radius: 8px; 
                    border-left: 5px solid #ef4444;
                    overflow-x: auto;
                    font-size: 0.9em;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <h1>❌ Migration Hiba!</h1>
                <p><strong>Error:</strong> {str(e)}</p>
                <pre>{traceback.format_exc()}</pre>
                <p style="margin-top: 30px; color: #6b7280;">
                    <strong>Support:</strong> Küldd el ezt a hibaüzenetet debug-olásra!
                </p>
            </div>
        </body>
        </html>
        """
        return error_html, 500

