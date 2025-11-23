from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
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
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')

# v6.6 Production: PostgreSQL support
DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///lab_requests.db')
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_recycle': 300,
    'connect_args': {'connect_timeout': 10}
}
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['LOGO_FOLDER'] = 'uploads/logos'
app.config['ATTACHMENT_FOLDER'] = 'uploads/attachments'
app.config['MAX_CONTENT_LENGTH'] = 20 * 1024 * 1024  # 20MB max

# Create upload folders
os.makedirs(app.config['LOGO_FOLDER'], exist_ok=True)
os.makedirs(app.config['ATTACHMENT_FOLDER'], exist_ok=True)

# v6.6 Production: CORS with frontend domain
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
CORS(app, origins=[FRONTEND_URL, 'http://localhost:3000'])

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
    phone = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class Company(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    address = db.Column(db.String(300))
    contact_person = db.Column(db.String(100))
    contact_email = db.Column(db.String(120))
    contact_phone = db.Column(db.String(20))
    logo_filename = db.Column(db.String(200))
    users = db.relationship('User', backref='company', lazy=True)
    requests = db.relationship('LabRequest', backref='company', lazy=True)

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
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False, unique=True)
    description = db.Column(db.Text)
    price = db.Column(db.Float, nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey('department.id'), nullable=True)
    category_id = db.Column(db.Integer, db.ForeignKey('request_category.id'), nullable=True)  # v6.6 VISSZA
    turnaround_days = db.Column(db.Integer, default=7)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    department = db.relationship('Department', backref='test_types')
    category = db.relationship('RequestCategory', backref='test_types')  # v6.6 VISSZA

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
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('request_category.id'), nullable=True)
    sample_id = db.Column(db.String(100), nullable=False)
    sample_description = db.Column(db.Text)
    test_types = db.Column(db.Text, nullable=False)
    total_price = db.Column(db.Float, default=0)
    urgency = db.Column(db.String(50))
    status = db.Column(db.String(50), default='draft')
    sampling_location = db.Column(db.String(200))
    sampling_address = db.Column(db.String(500))      # ÚJ: Pontos cím
    contact_person = db.Column(db.String(200))        # ÚJ: Kontakt személy
    contact_phone = db.Column(db.String(50))          # ÚJ: Telefon
    sampling_date = db.Column(db.DateTime)
    deadline = db.Column(db.DateTime, nullable=True)  # NULLABLE!
    special_instructions = db.Column(db.Text)
    attachment_filename = db.Column(db.String(200))
    approved_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    approved_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    user = db.relationship('User', foreign_keys=[user_id], backref='requests')
    approver = db.relationship('User', foreign_keys=[approved_by])
    category = db.relationship('RequestCategory', backref='requests')

class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    request_id = db.Column(db.Integer, db.ForeignKey('lab_request.id'), nullable=False)
    type = db.Column(db.String(50), nullable=False)
    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    user = db.relationship('User', backref='notifications')
    lab_request = db.relationship('LabRequest', backref='notifications')

# --- Notification Helper ---
def create_notification(user_id, request_id, notif_type, message):
    """Create a new notification - add to session but don't commit"""
    notification = Notification(
        user_id=user_id,
        request_id=request_id,
        type=notif_type,
        message=message
    )
    db.session.add(notification)
    # Note: No commit here - will be committed with the main transaction

# --- Auth Decorators ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token hiányzik!'}), 401
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.get(data['user_id'])
        except:
            return jsonify({'message': 'Token érvénytelen!'}), 401
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
            'company_id': user.company_id
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

# --- Notifications Routes ---
@app.route('/api/notifications', methods=['GET'])
@token_required
def get_notifications(current_user):
    notifications = Notification.query.filter_by(user_id=current_user.id).order_by(Notification.created_at.desc()).limit(50).all()
    
    return jsonify([{
        'id': n.id,
        'request_id': n.request_id,
        'sample_id': n.lab_request.sample_id,
        'type': n.type,
        'message': n.message,
        'is_read': n.is_read,
        'created_at': n.created_at.isoformat()
    } for n in notifications])

@app.route('/api/notifications/<int:notif_id>/read', methods=['PUT'])
@token_required
def mark_notification_read(current_user, notif_id):
    notification = Notification.query.get_or_404(notif_id)
    
    if notification.user_id != current_user.id:
        return jsonify({'message': 'Nincs jogosultságod!'}), 403
    
    notification.is_read = True
    db.session.commit()
    
    return jsonify({'message': 'Értesítés megjelölve olvasottként'})

@app.route('/api/notifications/read-all', methods=['PUT'])
@token_required
def mark_all_notifications_read(current_user):
    Notification.query.filter_by(user_id=current_user.id, is_read=False).update({'is_read': True})
    db.session.commit()
    
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
        'price': tt.price,
        'department_id': tt.department_id,
        'department_name': tt.department.name if tt.department else None,
        'category_id': tt.category_id,  # v6.6
        'category_name': tt.category.name if tt.category else None,  # v6.6
        'category_color': tt.category.color if tt.category else None,  # v6.6
        'turnaround_days': tt.turnaround_days,
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
        price=float(data.get('price')),
        department_id=department_id,
        category_id=category_id,
        turnaround_days=int(data.get('turnaround_days', 7)),
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
    if 'price' in data:
        test_type.price = float(data['price'])
    if 'department_id' in data:
        # Üres string esetén None
        test_type.department_id = data['department_id'] if data['department_id'] != '' else None
    if 'category_id' in data:
        # Üres string esetén None
        test_type.category_id = data['category_id'] if data['category_id'] != '' else None
    if 'turnaround_days' in data:
        test_type.turnaround_days = int(data['turnaround_days'])
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

# --- Lab Requests Routes ---
def get_test_type_details(test_type_ids):
    try:
        ids = json.loads(test_type_ids)
        test_types = TestType.query.filter(TestType.id.in_(ids)).all()
        return [{
            'id': tt.id,
            'name': tt.name,
            'price': tt.price,
            'turnaround_days': tt.turnaround_days,
            'department_name': tt.department.name if tt.department else None
        } for tt in test_types]
    except:
        return []

@app.route('/api/requests', methods=['GET'])
@token_required
def get_requests(current_user):
    if current_user.role == 'super_admin' or current_user.role == 'lab_staff':
        requests = LabRequest.query.all()
    elif current_user.role == 'company_admin':
        requests = LabRequest.query.filter_by(company_id=current_user.company_id).all()
    else:
        requests = LabRequest.query.filter_by(user_id=current_user.id).all()
    
    return jsonify([{
        'id': req.id,
        'sample_id': req.sample_id,
        'sample_description': req.sample_description,
        'test_types': get_test_type_details(req.test_types),
        'total_price': req.total_price,
        'urgency': req.urgency,
        'status': req.status,
        'sampling_location': req.sampling_location,
        'sampling_address': req.sampling_address,             # ÚJ
        'contact_person': req.contact_person,                 # ÚJ
        'contact_phone': req.contact_phone,                   # ÚJ
        'sampling_date': req.sampling_date.isoformat() if req.sampling_date else None,
        'deadline': req.deadline.isoformat() if req.deadline else None,
        'special_instructions': req.special_instructions,
        'attachment_filename': req.attachment_filename,
        'category': {
            'id': req.category.id,
            'name': req.category.name,
            'color': req.category.color
        } if req.category else None,
        'created_at': req.created_at.isoformat(),
        'user_name': req.user.name,
        'company_name': req.company.name,
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
        'sample_id': req.sample_id,
        'sample_description': req.sample_description,
        'test_types': get_test_type_details(req.test_types),
        'total_price': req.total_price,
        'urgency': req.urgency,
        'status': req.status,
        'sampling_location': req.sampling_location,
        'sampling_address': req.sampling_address,             # ÚJ
        'contact_person': req.contact_person,                 # ÚJ
        'contact_phone': req.contact_phone,                   # ÚJ
        'sampling_date': req.sampling_date.isoformat() if req.sampling_date else None,
        'deadline': req.deadline.isoformat() if req.deadline else None,
        'special_instructions': req.special_instructions,
        'attachment_filename': req.attachment_filename,
        'category_id': req.category_id,
        'category': {
            'id': req.category.id,
            'name': req.category.name,
            'color': req.category.color
        } if req.category else None,
        'created_at': req.created_at.isoformat(),
        'user_name': req.user.name,
        'user_email': req.user.email,
        'user_phone': req.user.phone,
        'company_name': req.company.name,
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
    
    sampling_date = datetime.datetime.fromisoformat(data.get('sampling_date')) if data.get('sampling_date') else None
    deadline = datetime.datetime.fromisoformat(data.get('deadline')) if data.get('deadline') and data.get('deadline').strip() else None
    
    new_request = LabRequest(
        user_id=current_user.id,
        company_id=current_user.company_id,
        sample_id=data.get('sample_id'),
        sample_description=data.get('sample_description'),
        test_types=json.dumps(test_type_ids),
        total_price=total_price,
        urgency=data.get('urgency', 'normal'),
        status=data.get('status', 'draft'),
        sampling_location=data.get('sampling_location'),
        sampling_address=data.get('sampling_address'),      # ÚJ
        contact_person=data.get('contact_person'),          # ÚJ
        contact_phone=data.get('contact_phone'),            # ÚJ
        sampling_date=sampling_date,
        deadline=deadline,                                   # NULLABLE
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
    
    # Notifications - add to session before commit
    if new_request.status == 'pending_approval':
        company_admins = User.query.filter_by(company_id=current_user.company_id, role='company_admin').all()
        for admin in company_admins:
            create_notification(
                admin.id,
                new_request.id,
                'pending_approval',
                f'{current_user.name} beküldött egy laborkérést jóváhagyásra: {new_request.sample_id}'
            )
    
    # Single commit for request and notifications
    db.session.commit()
    
    return jsonify({'message': 'Laborkérés sikeresen létrehozva!', 'id': new_request.id}), 201

@app.route('/api/requests/<int:request_id>', methods=['PUT'])
@token_required
def update_request(current_user, request_id):
    req = LabRequest.query.get_or_404(request_id)
    data = request.form.to_dict()
    
    if current_user.role == 'company_user' and req.user_id != current_user.id:
        return jsonify({'message': 'Nincs jogosultságod!'}), 403
    
    old_status = req.status
    
    # v6.6: If status is rejected and user is editing, keep it rejected
    # This prevents rejected requests from going back to pending_approval
    if old_status == 'rejected' and current_user.role == 'company_user':
        # User can edit rejected requests, but status stays rejected
        # Admin can still change status from rejected to other states
        if 'status' not in data or data.get('status') == 'pending_approval':
            data['status'] = 'rejected'  # Force stay in rejected
    
    # Update fields
    if 'status' in data:
        req.status = data['status']
        
        # v6.5: Notify company admin when user submits for approval OR admin approves
        if data['status'] == 'pending_approval' and old_status != 'pending_approval':
            # User submits for company approval
            company_admins = User.query.filter_by(company_id=req.company_id, role='company_admin').all()
            for admin in company_admins:
                if admin.id != current_user.id:  # Don't notify self
                    create_notification(
                        admin.id,
                        req.id,
                        'pending_approval',
                        f'{current_user.name} beküldött egy laborkérést jóváhagyásra: {req.sample_id}'
                    )
        
        if data['status'] == 'submitted' and current_user.role == 'company_admin' and old_status == 'pending_approval':
            req.approved_by = current_user.id
            req.approved_at = datetime.datetime.utcnow()
            
            create_notification(
                req.user_id,
                req.id,
                'approved',
                f'A céges admin jóváhagyta a laborkérésedet: {req.sample_id}'
            )
            
            super_admins = User.query.filter_by(role='super_admin').all()
            for admin in super_admins:
                create_notification(
                    admin.id,
                    req.id,
                    'submitted',
                    f'Új laborkérés érkezett: {req.sample_id} ({req.company.name})'
                )
        
        # v6.1: Notifications for all university admin status changes
        if data['status'] != old_status and current_user.role in ['super_admin', 'lab_staff']:
            # Notify company admins
            company_admins = User.query.filter_by(company_id=req.company_id, role='company_admin').all()
            for admin in company_admins:
                create_notification(
                    admin.id,
                    req.id,
                    'status_change',
                    f'Státuszváltozás: {req.sample_id} → {data["status"]}'
                )
            
            # Notify requester
            create_notification(
                req.user_id,
                req.id,
                'status_change',
                f'Státuszváltozás: {req.sample_id} → {data["status"]}'
            )
        
        # Legacy notification for in_progress (keep for backwards compatibility)
        if data['status'] == 'in_progress' and old_status == 'submitted':
            company_admins = User.query.filter_by(company_id=req.company_id, role='company_admin').all()
            for admin in company_admins:
                create_notification(
                    admin.id,
                    req.id,
                    'accepted',
                    f'Az egyetemi admin befogadta a laborkérést: {req.sample_id}'
                )
            
            create_notification(
                req.user_id,
                req.id,
                'accepted',
                f'Az egyetemi admin befogadta a laborkérésedet: {req.sample_id}'
            )
    
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
        req.sampling_date = datetime.datetime.fromisoformat(data['sampling_date']) if data['sampling_date'] else None
    if 'deadline' in data:
        req.deadline = datetime.datetime.fromisoformat(data['deadline']) if data['deadline'] and data['deadline'].strip() else None
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
    
    if current_user.role == 'company_user' and req.user_id != current_user.id:
        return jsonify({'message': 'Nincs jogosultságod!'}), 403
    
    # v6.5 - Register UTF-8 font for Hungarian characters
    try:
        pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
        pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
        default_font = 'DejaVuSans'
        bold_font = 'DejaVuSans-Bold'
    except:
        # Fallback to Helvetica if DejaVu not available
        default_font = 'Helvetica'
        bold_font = 'Helvetica-Bold'
    
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
        fontName=bold_font  # v6.5
    )
    elements.append(Paragraph('LABORKÉRÉS', title_style))
    elements.append(Spacer(1, 0.5*cm))
    
    id_style = ParagraphStyle('IDStyle', parent=styles['Normal'], fontSize=14, spaceAfter=20, fontName=default_font)  # v6.5
    elements.append(Paragraph(f'<b>Minta azonosító:</b> {req.sample_id}', id_style))
    elements.append(Spacer(1, 0.3*cm))
    
    data = [
        ['Feladó:', req.user.name],
        ['Cég:', req.company.name],
        ['Kategória:', req.category.name if req.category else '-'],
        ['Mintavétel helye:', req.sampling_location],
        ['Mintavétel dátuma:', req.sampling_date.strftime('%Y-%m-%d') if req.sampling_date else '-'],
        ['Határidő:', req.deadline.strftime('%Y-%m-%d') if req.deadline else '-'],
        ['Minta leírása:', req.sample_description],
    ]
    
    table = Table(data, colWidths=[5*cm, 12*cm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F3F4F6')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), bold_font),  # v6.5
        ('FONTNAME', (1, 0), (1, -1), default_font),  # v6.5
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey)
    ]))
    elements.append(table)
    elements.append(Spacer(1, 0.5*cm))
    
    heading_style = ParagraphStyle('Heading', parent=styles['Heading2'], fontName=bold_font)  # v6.5
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
        elements.append(Paragraph('<b>Különleges kezelési utasítások:</b>', styles['Heading2']))
        elements.append(Paragraph(req.special_instructions, styles['Normal']))
    
    doc.build(elements)
    buffer.seek(0)
    
    return send_file(
        buffer,
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f'laborkeres_{req.sample_id}.pdf'
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
        'company_name': user.company.name if user.company else None
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
    
    new_user = User(
        email=data.get('email'),
        password=generate_password_hash(data.get('password')),
        name=data.get('name'),
        role=data.get('role'),
        company_id=company_id,
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
        # Company admin cannot change role to super_admin or lab_staff
        if current_user.role == 'company_admin':
            if data['role'] in ['super_admin', 'lab_staff']:
                return jsonify({'message': 'Nincs jogosultságod ezt a szerepkört beállítani!'}), 403
        user.role = data['role']
    if 'company_id' in data:
        # Company admin cannot change company
        if current_user.role == 'company_admin':
            return jsonify({'message': 'Nincs jogosultságod a céget módosítani!'}), 403
        # Empty string to None
        user.company_id = data['company_id'] if data['company_id'] != '' else None
    
    db.session.commit()
    
    return jsonify({'message': 'Felhasználó sikeresen frissítve!'})

# --- Stats Route ---
@app.route('/api/stats', methods=['GET'])
@token_required
def get_stats(current_user):
    if current_user.role == 'super_admin' or current_user.role == 'lab_staff':
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
    
    return jsonify({
        'total_requests': total_requests,
        'by_status': {status: count for status, count in requests_by_status},
        'by_category': {cat: count for cat, count in requests_by_category},
        'total_revenue': total_revenue,
        'revenue_by_status': {status: (revenue or 0) for status, revenue in revenue_by_status}
    })

# --- Initialize Database ---
def init_db():
    with app.app_context():
        db.create_all()
        
        # Create categories
        if RequestCategory.query.count() == 0:
            categories = [
                # MINTA ELŐKÉSZÍTÉS - MINDIG ELSŐ HELYEN!
                RequestCategory(
                    name='Minta előkészítés', 
                    description='Mintavétel, előkészítés, homogenizálás', 
                    color='#6366F1',  # Indigo
                    icon='Package'
                ),
                # Nyersolaj vizsgálatok
                RequestCategory(
                    name='Nyersolaj vizsgálatok', 
                    description='Kőolaj alapjellemzők meghatározása', 
                    color='#0F172A',  # Dark slate
                    icon='Droplet'
                ),
                # Finomított termékek
                RequestCategory(
                    name='Finomított termékek', 
                    description='Benzin, dízel, fűtőolaj vizsgálatok', 
                    color='#0EA5E9',  # Sky blue
                    icon='Fuel'
                ),
                # Kenőanyagok
                RequestCategory(
                    name='Kenőanyagok', 
                    description='Motor- és ipari kenőolajok', 
                    color='#F59E0B',  # Amber
                    icon='Droplets'
                ),
                # Biodízel és bioüzemanyagok
                RequestCategory(
                    name='Biodízel és bioüzemanyagok', 
                    description='Megújuló üzemanyagok vizsgálata', 
                    color='#10B981',  # Green
                    icon='Leaf'
                ),
                # Additívok és adalékanyagok
                RequestCategory(
                    name='Additívok', 
                    description='Üzemanyag-adalékok, javítók', 
                    color='#8B5CF6',  # Purple
                    icon='Beaker'
                ),
                # Környezetvédelem
                RequestCategory(
                    name='Környezetvédelem', 
                    description='Talaj, víz, levegő szennyezettség', 
                    color='#059669',  # Emerald
                    icon='TreePine'
                ),
                # Gázok vizsgálata
                RequestCategory(
                    name='Gázok', 
                    description='PB-gáz, földgáz, biogáz', 
                    color='#64748B',  # Slate
                    icon='Wind'
                ),
                # Korróziós vizsgálatok
                RequestCategory(
                    name='Korrózió és kompatibilitás', 
                    description='Anyagvizsgálat, kompatibilitás', 
                    color='#DC2626',  # Red
                    icon='AlertTriangle'
                ),
            ]
            for cat in categories:
                db.session.add(cat)
            db.session.commit()
            print("✅ Kategóriák létrehozva!")
        
        # Create departments
        if Department.query.count() == 0:
            departments = [
                Department(name='Minta Előkészítő', description='Mintavétel, homogenizálás, előkészítés', contact_person='Szabó Katalin', contact_email='szabo@pannon.hu'),
                Department(name='Kémiai Labor', description='Általános kémiai analitika', contact_person='Dr. Kovács István', contact_email='kovacs@pannon.hu'),
                Department(name='Olajipar Szaklabor', description='Ásványolaj és származékok vizsgálata', contact_person='Dr. Nagy Éva', contact_email='nagy@pannon.hu'),
                Department(name='Környezetvédelmi Labor', description='Környezeti minták elemzése', contact_person='Dr. Tóth Péter', contact_email='toth@pannon.hu'),
            ]
            for dept in departments:
                db.session.add(dept)
            db.session.commit()
            print("✅ Szervezeti egységek létrehozva!")
        
        # Create test types
        if TestType.query.count() == 0:
            # Get category IDs
            cat_minta = RequestCategory.query.filter_by(name='Minta előkészítés').first().id
            cat_nyersolaj = RequestCategory.query.filter_by(name='Nyersolaj vizsgálatok').first().id
            cat_finomitott = RequestCategory.query.filter_by(name='Finomított termékek').first().id
            cat_kenoanyag = RequestCategory.query.filter_by(name='Kenőanyagok').first().id
            cat_biodiesel = RequestCategory.query.filter_by(name='Biodízel és bioüzemanyagok').first().id
            cat_additivok = RequestCategory.query.filter_by(name='Additívok').first().id
            cat_kornyezet = RequestCategory.query.filter_by(name='Környezetvédelem').first().id
            cat_gazok = RequestCategory.query.filter_by(name='Gázok').first().id
            cat_korrozio = RequestCategory.query.filter_by(name='Korrózió és kompatibilitás').first().id
            
            test_types = [
                # MINTA ELŐKÉSZÍTÉS - FIX ELSŐ KATEGÓRIA (0 Ft, 0 nap, tény alapon)
                TestType(
                    name='Minta előkészítés', 
                    description='Minta függvényében, tény alapon kerül elszámolásra', 
                    price=0, 
                    category_id=cat_minta, 
                    department_id=1,  # Minta Előkészítő (ID=1)
                    turnaround_days=0
                ),
                
                # NYERSOLAJ VIZSGÁLATOK
                TestType(name='API fajsúly', description='Nyersolaj sűrűségének API egységekben', price=8000, category_id=cat_nyersolaj, department_id=3, turnaround_days=2),
                TestType(name='Kéntartalom (nyersolaj)', description='Összes kéntartalom ASTM D4294 szerint', price=12000, category_id=cat_nyersolaj, department_id=2, turnaround_days=5),
                TestType(name='Aszfaltén tartalom', description='N-heptán oldhatatlan frakció', price=15000, category_id=cat_nyersolaj, department_id=3, turnaround_days=7),
                TestType(name='Pour point (ömléspont)', description='Minimális folyási hőmérséklet', price=9000, category_id=cat_nyersolaj, department_id=3, turnaround_days=3),
                TestType(name='Paraffinvax tartalom', description='Szilárd paraffin koncentráció', price=13000, category_id=cat_nyersolaj, department_id=3, turnaround_days=5),
                
                # FINOMÍTOTT TERMÉKEK (Benzin, Dízel, Fűtőolaj)
                TestType(name='Oktánszám (RON/MON)', description='Benzin kopogásállóság vizsgálat', price=18000, category_id=cat_finomitott, department_id=3, turnaround_days=4),
                TestType(name='Cetánszám', description='Dízel öngyulladási jellemző', price=20000, category_id=cat_finomitott, department_id=3, turnaround_days=5),
                TestType(name='Lepárlási görbe', description='ASTM D86 desztilláció', price=16000, category_id=cat_finomitott, department_id=3, turnaround_days=6),
                TestType(name='RVP (Reid-gőznyomás)', description='Benzin illékonyság 37.8°C-on', price=10000, category_id=cat_finomitott, department_id=3, turnaround_days=3),
                TestType(name='Benzol tartalom', description='Aromás szénhidrogén koncentráció', price=14000, category_id=cat_finomitott, department_id=2, turnaround_days=5),
                TestType(name='Oxigéntartalom', description='Oxigén-vegyületek mennyisége', price=12000, category_id=cat_finomitott, department_id=2, turnaround_days=4),
                TestType(name='Dermedéspont', description='ASTM D97 mérés', price=9000, category_id=cat_finomitott, department_id=3, turnaround_days=3),
                TestType(name='Hideg szűrhetőségi határérték (CFPP)', description='Dízel téli használhatóság', price=11000, category_id=cat_finomitott, department_id=3, turnaround_days=4),
                TestType(name='Felhőpont', description='Paraffinok kikristályosodása', price=8500, category_id=cat_finomitott, department_id=3, turnaround_days=3),
                TestType(name='Lobbanáspont', description='Tűzvédelmi jellemző meghatározás', price=7000, category_id=cat_finomitott, department_id=3, turnaround_days=2),
                
                # KENŐANYAGOK
                TestType(name='Viszkozitás (40°C és 100°C)', description='Kinematikai viszkozitás meghatározás', price=15000, category_id=cat_kenoanyag, department_id=3, turnaround_days=3),
                TestType(name='Viszkozitási index (VI)', description='Viszkozitás hőmérsékletfüggése', price=12000, category_id=cat_kenoanyag, department_id=3, turnaround_days=3),
                TestType(name='TBN (Teljes bázikus szám)', description='Savsemlegesítő képesség', price=13000, category_id=cat_kenoanyag, department_id=2, turnaround_days=4),
                TestType(name='TAN (Teljes savas szám)', description='Oxidáció, szennyeződés mértéke', price=11000, category_id=cat_kenoanyag, department_id=2, turnaround_days=4),
                TestType(name='Noack párolgás', description='Kenőolaj párolgási vesztesége 250°C', price=17000, category_id=cat_kenoanyag, department_id=3, turnaround_days=5),
                TestType(name='Oxidációs stabilitás (RPVOT)', description='Forgónyomás oxigén teszt', price=19000, category_id=cat_kenoanyag, department_id=3, turnaround_days=6),
                TestType(name='Kopásvédelem (Four-ball)', description='Négygolyós kopásvizsgálat', price=16000, category_id=cat_kenoanyag, department_id=3, turnaround_days=5),
                
                # BIODÍZEL ÉS BIOÜZEMANYAGOK
                TestType(name='Észtartalom (FAME)', description='Zsírsav-metil-észter koncentráció', price=14000, category_id=cat_biodiesel, department_id=2, turnaround_days=5),
                TestType(name='Glicerin tartalom', description='Szabad és teljes glicerin', price=13000, category_id=cat_biodiesel, department_id=2, turnaround_days=5),
                TestType(name='Metanol tartalom', description='Maradék metanol GC-vel', price=12000, category_id=cat_biodiesel, department_id=2, turnaround_days=4),
                TestType(name='Jódszám', description='Telítetlenség mértéke', price=10000, category_id=cat_biodiesel, department_id=2, turnaround_days=4),
                TestType(name='Oxidációs stabilitás (Rancimat)', description='110°C-on induktív periódus', price=15000, category_id=cat_biodiesel, department_id=3, turnaround_days=6),
                
                # ADDITÍVOK ÉS ADALÉKANYAGOK
                TestType(name='Adalékanyag koncentráció', description='Dózoló adalék pontos mennyisége', price=16000, category_id=cat_additivok, department_id=2, turnaround_days=5),
                TestType(name='Detergens hatóanyag', description='Tisztító adalék aktivitás', price=14000, category_id=cat_additivok, department_id=2, turnaround_days=5),
                TestType(name='Antioxidáns hatóanyag', description='Oxidációgátló koncentráció', price=13000, category_id=cat_additivok, department_id=2, turnaround_days=4),
                
                # KÖRNYEZETVÉDELEM
                TestType(name='TPH (Összes szénhidrogén)', description='Talaj/víz olajszennyezettség', price=18000, category_id=cat_kornyezet, department_id=4, turnaround_days=7),
                TestType(name='PAH (Poliaromás szénhidrogének)', description='EPA 16 PAH komponens', price=25000, category_id=cat_kornyezet, department_id=4, turnaround_days=10),
                TestType(name='BTEX', description='Benzol, Toluol, Etilbenzol, Xilol', price=20000, category_id=cat_kornyezet, department_id=4, turnaround_days=7),
                TestType(name='Nehézfém tartalom', description='ICP-MS módszerrel', price=22000, category_id=cat_kornyezet, department_id=4, turnaround_days=8),
                
                # GÁZOK
                TestType(name='Gázösszetétel (GC)', description='PB-gáz, földgáz komponens analízis', price=16000, category_id=cat_gazok, department_id=2, turnaround_days=5),
                TestType(name='Fűtőérték', description='Égéshő meghatározás bomba kalorimetriával', price=12000, category_id=cat_gazok, department_id=3, turnaround_days=4),
                TestType(name='H₂S tartalom', description='Kénhidrogén koncentráció', price=10000, category_id=cat_gazok, department_id=2, turnaround_days=3),
                
                # KORRÓZIÓ ÉS KOMPATIBILITÁS
                TestType(name='Réz korróziós teszt', description='ASTM D130 rézkorrózió', price=9000, category_id=cat_korrozio, department_id=3, turnaround_days=3),
                TestType(name='Kompatibilitási vizsgálat', description='Üzemanyag keverhetőség teszt', price=15000, category_id=cat_korrozio, department_id=3, turnaround_days=5),
                TestType(name='Víztartalom (Karl Fischer)', description='Pontos vízmeghatározás titrálással', price=8000, category_id=cat_korrozio, department_id=2, turnaround_days=2),
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
                    role='lab_staff',
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
    Checks and adds missing columns without requiring manual intervention
    """
    try:
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        
        # Get existing columns
        lab_request_columns = [col['name'] for col in inspector.get_columns('lab_request')]
        department_columns = [col['name'] for col in inspector.get_columns('department')]
        
        migrations_applied = []
        
        # LabRequest migrations
        if 'sampling_address' not in lab_request_columns:
            db.session.execute(db.text("ALTER TABLE lab_request ADD COLUMN sampling_address VARCHAR(500)"))
            migrations_applied.append('lab_request.sampling_address')
            print("  🔄 Auto-migration: Added sampling_address to lab_request")
        
        if 'contact_person' not in lab_request_columns:
            db.session.execute(db.text("ALTER TABLE lab_request ADD COLUMN contact_person VARCHAR(200)"))
            migrations_applied.append('lab_request.contact_person')
            print("  🔄 Auto-migration: Added contact_person to lab_request")
        
        if 'contact_phone' not in lab_request_columns:
            db.session.execute(db.text("ALTER TABLE lab_request ADD COLUMN contact_phone VARCHAR(50)"))
            migrations_applied.append('lab_request.contact_phone')
            print("  🔄 Auto-migration: Added contact_phone to lab_request")
        
        # Department migrations
        if 'sample_pickup_address' not in department_columns:
            db.session.execute(db.text("ALTER TABLE department ADD COLUMN sample_pickup_address VARCHAR(500)"))
            migrations_applied.append('department.sample_pickup_address')
            print("  🔄 Auto-migration: Added sample_pickup_address to department")
        
        if 'sample_pickup_contact' not in department_columns:
            db.session.execute(db.text("ALTER TABLE department ADD COLUMN sample_pickup_contact VARCHAR(200)"))
            migrations_applied.append('department.sample_pickup_contact')
            print("  🔄 Auto-migration: Added sample_pickup_contact to department")
        
        if migrations_applied:
            db.session.commit()
            print(f"✅ Auto-migration completed! Applied {len(migrations_applied)} changes:")
            for migration in migrations_applied:
                print(f"   - {migration}")
        else:
            print("✅ Database schema is up to date (no migrations needed)")
        
        return True
        
    except Exception as e:
        db.session.rollback()
        print(f"⚠️  Auto-migration failed: {e}")
        print("   Application will continue, but some features may not work correctly.")
        return False

@app.route('/api/init', methods=['GET'])
def initialize_database():
    """Database initialization endpoint - csak egyszer kell meghívni!"""
    try:
        init_db()
        return jsonify({"message": "✅ Database initialized successfully!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
