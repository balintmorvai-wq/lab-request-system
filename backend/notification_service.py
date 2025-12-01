"""
NotificationService - Központi értesítési szolgáltatás
v8.0 - Abstract, konfigurálható notification rendszer

Használat:
    from notification_service import NotificationService
    
    # Státuszváltozás értesítés
    NotificationService.notify(
        event_key='status_change',
        request_id=123,
        event_data={
            'old_status': 'draft',
            'new_status': 'pending_approval',
            'request_number': 'LAB-2024-001',
            'company_name': 'MOL Nyrt.',
            'requester_name': 'Kiss János'
        }
    )
"""

import json
import re
from datetime import datetime
from flask import current_app
from sqlalchemy import text

# LATE IMPORT - db, User, LabRequest csak függvényeken belül!
# Ezzel elkerüljük a circular import-ot (app.py imports notification_service)

class NotificationService:
    """Központi értesítési szolgáltatás"""
    
    @staticmethod
    def notify_status_change(request, old_status, new_status):
        """
        Státuszváltozás értesítés - új status_to_* rendszerrel
        
        Args:
            request: LabRequest object
            old_status (str): Régi státusz
            new_status (str): Új státusz
        """
        import os
        
        # Új státusz-alapú event key
        event_key = f"status_to_{new_status}"
        
        # Frontend URL environment variable-ból
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
        
        # Event data összeállítása
        event_data = {
            'request_id': request.id,
            'request_number': request.request_number,
            'old_status': old_status,
            'new_status': new_status,
            'company_name': request.company.name if request.company else '',
            'requester_name': request.user.name if request.user else '',
            # ✅ request_url dinamikus frontend URL-lel
            'request_url': f"{frontend_url}/requests?search={request.request_number}"
        }
        
        # Értesítés küldése
        return NotificationService.notify(
            event_key=event_key,
            request_id=request.id,
            event_data=event_data
        )
    
    @staticmethod
    def notify(event_key, request_id=None, event_data=None, specific_users=None):
        """
        Értesítés küldése esemény alapján
        
        Args:
            event_key (str): Esemény kulcs (pl. 'status_change', 'new_request')
            request_id (int): Kapcsolódó kérés ID (opcionális)
            event_data (dict): Esemény specifikus adatok
            specific_users (list): Konkrét user ID-k listája (felülírja a szabályokat)
        
        Returns:
            dict: Statisztika (in_app_count, email_count)
        """
        # Late import - circular import elkerülése
        from app import db, User, LabRequest
        
        if event_data is None:
            event_data = {}
        
        # Event type lekérése
        cursor = db.session.execute(
            text("SELECT id, event_name FROM notification_event_types WHERE event_key = :key"),
            {"key": event_key}
        )
        event_type = cursor.fetchone()
        
        if not event_type:
            current_app.logger.warning(f"Unknown event type: {event_key}")
            return {'in_app_count': 0, 'email_count': 0}
        
        event_type_id, event_name = event_type
        
        # Specifikus userek vagy szabály alapján
        if specific_users:
            target_users = User.query.filter(User.id.in_(specific_users)).all()
            rules = NotificationService._get_rules_for_event(event_type_id)
        else:
            target_users, rules = NotificationService._determine_target_users(
                event_type_id, event_data, request_id
            )
        
        if not target_users:
            return {'in_app_count': 0, 'email_count': 0}
        
        # Generate message
        # Ha van request_id és ez státusz-alapú event, akkor lekérjük a request adatait
        if request_id and event_key.startswith('status_to_'):
            import os
            request = LabRequest.query.get(request_id)
            if request:
                # Frontend URL environment variable-ból
                frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
                
                # Felülírjuk az event_data-t a request aktuális adataival
                event_data = {
                    **event_data,  # Meglévő adatok megtartása
                    'request_id': request.id,
                    'request_number': request.request_number,
                    'company_name': request.company.name if request.company else '',
                    'requester_name': request.user.name if request.user else '',
                    'new_status': request.status,
                    # ✅ request_url dinamikus frontend URL-lel
                    'request_url': f"{frontend_url}/requests?search={request.request_number}"
                }
        
        message = NotificationService._generate_in_app_message(event_key, event_data)
        # ✅ Link URL szűrővel - navigál a kérések listára request_number szűrővel
        link_url = f"/requests?search={event_data.get('request_number', '')}" if request_id and event_data.get('request_number') else None
        
        # Create notifications
        stats = {'in_app_count': 0, 'email_count': 0}
        
        for user in target_users:
            # Find user's applicable rule
            user_rule = next((r for r in rules if r['role'] == user.role), None)
            
            if not user_rule:
                continue
            
            # In-app notification
            if user_rule.get('in_app_enabled'):
                NotificationService._create_in_app_notification(
                    user.id, event_type_id, message, link_url, request_id, event_data
                )
                stats['in_app_count'] += 1
            
            # Email notification
            if user_rule.get('email_enabled') and user_rule.get('email_template_id'):
                NotificationService._send_email_notification(
                    user, event_data, user_rule['email_template_id']
                )
                stats['email_count'] += 1
        
        db.session.commit()
        
        return stats
    
    @staticmethod
    def _determine_target_users(event_type_id, event_data, request_id):
        """Érintett userek meghatározása szabályok alapján"""
        # Late import - circular import elkerülése
        from app import db, User, LabRequest
        
        # Aktív szabályok lekérése
        rules = NotificationService._get_rules_for_event(event_type_id)
        
        if not rules:
            return [], []
        
        # Szerepkörök gyűjtése
        target_roles = [r['role'] for r in rules]
        
        # Request specifikus szűrés
        query = User.query.filter(User.role.in_(target_roles))
        
        if request_id:
            request = LabRequest.query.get(request_id)
            if request:
                # Company-specifikus userek szűrése
                if request.company_id:
                    company_roles = ['company_admin', 'company_user', 'company_logistics']
                    query = query.filter(
                        db.or_(
                            User.role.notin_(company_roles),
                            db.and_(
                                User.role.in_(company_roles),
                                User.company_id == request.company_id
                            )
                        )
                    )
        
        target_users = query.all()
        
        return target_users, rules
    
    @staticmethod
    def _get_rules_for_event(event_type_id):
        """Aktív szabályok lekérése eseményhez"""
        # Late import - circular import elkerülése
        from app import db
        
        cursor = db.session.execute(text("""
            SELECT role, event_filter, in_app_enabled, email_enabled, 
                   email_template_id, priority
            FROM notification_rules
            WHERE event_type_id = :event_id AND is_active = 1
            ORDER BY priority DESC
        """), {"event_id": event_type_id})
        
        rules = []
        for row in cursor:
            rules.append({
                'role': row[0],
                'event_filter': row[1],
                'in_app_enabled': bool(row[2]),
                'email_enabled': bool(row[3]),
                'email_template_id': row[4],
                'priority': row[5]
            })
        
        return rules
    
    @staticmethod
    def _generate_in_app_message(event_key, event_data):
        """In-app notification message generálása"""
        # Státusz-alapú események (status_to_*)
        if event_key.startswith('status_to_'):
            status_name_map = {
                'status_to_draft': 'Vázlat',
                'status_to_pending_approval': 'Jóváhagyásra vár',
                'status_to_awaiting_shipment': 'Szállításra vár',
                'status_to_in_transit': 'Szállítás alatt',
                'status_to_arrived_at_provider': 'Laborban',
                'status_to_in_progress': 'Folyamatban',
                'status_to_validation_pending': 'Validálásra vár',
                'status_to_completed': 'Befejezett'
            }
            
            status_hu = status_name_map.get(event_key, event_key.replace('status_to_', '').replace('_', ' ').title())
            request_number = event_data.get('request_number', 'N/A')
            company_name = event_data.get('company_name', '')
            
            if company_name:
                return f"{company_name} - {request_number}: {status_hu}"
            else:
                return f"{request_number}: {status_hu}"
        
        # Régi event-specific messages (visszafelé kompatibilitás)
        templates = {
            'status_change': "Kérés státusza: {old_status} → {new_status} ({request_number})",
            'new_request': "Új labor kérés: {request_number} - {company_name}",
            'request_approved': "Kérés jóváhagyva: {request_number}",
            'request_rejected': "Kérés elutasítva: {request_number}",
            'results_uploaded': "Eredmények feltöltve: {request_number}",
            'sample_received': "Minta átvéve: {request_number}",
            'comment_added': "Új megjegyzés: {request_number}"
        }
        
        template = templates.get(event_key, "Esemény: {event_key}")
        
        try:
            return template.format(**event_data, event_key=event_key)
        except KeyError:
            # Ha hiányoznak adatok, próbáljuk meg ami van
            available_data = {k: v for k, v in event_data.items()}
            available_data['event_key'] = event_key
            try:
                return template.format(**available_data)
            except:
                return f"Esemény: {event_key}"
    
    @staticmethod
    def _create_in_app_notification(user_id, event_type_id, message, link_url, request_id, event_data):
        """In-app notification létrehozása"""
        # Late import - circular import elkerülése
        from app import db
        
        db.session.execute(text("""
            INSERT INTO notifications 
            (user_id, event_type_id, event_data, message, link_url, request_id)
            VALUES (:p0, :p1, :p2, :p3, :p4, :p5)
        """), {"p0": user_id, "p1": event_type_id, "p2": json.dumps(event_data), "p3": message, "p4": link_url, "p5": request_id})
    
    @staticmethod
    def _send_email_notification(user, event_data, template_id):
        """Email értesítés küldése (SMTP vagy API)"""
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        import requests
        
        # Late import - circular import elkerülése
        from app import db
        
        # SMTP beállítások lekérése (most már smtp_api_key-vel!)
        cursor = db.session.execute(text("""
            SELECT smtp_host, smtp_port, smtp_username, smtp_password,
                   from_email, from_name, use_tls, is_active, smtp_api_key
            FROM smtp_settings
            LIMIT 1
        """))
        smtp_settings = cursor.fetchone()
        
        if not smtp_settings or smtp_settings[7] != 1:  # is_active check
            current_app.logger.warning("SMTP not configured or inactive - email not sent")
            return
        
        smtp_host, smtp_port, smtp_username, smtp_password, from_email, from_name, use_tls, is_active, smtp_api_key = smtp_settings
        
        # Template lekérése
        cursor = db.session.execute(text("""
            SELECT subject, body_html FROM notification_templates WHERE id = :p0
        """), {"p0": template_id})
        template = cursor.fetchone()
        
        if not template:
            return
        
        subject, body_html = template
        
        # Template renderelés
        rendered_subject = NotificationService._render_template(subject, event_data)
        rendered_body = NotificationService._render_template(body_html, event_data)
        
        # Email címzett ellenőrzés
        if not user.email:
            current_app.logger.warning(f"User {user.id} has no email address")
            return
        
        # ✅ MailerSend API használata ha van API key
        if smtp_api_key:
            try:
                # MailerSend API endpoint
                url = "https://api.mailersend.com/v1/email"
                
                headers = {
                    "Authorization": f"Bearer {smtp_api_key}",
                    "Content-Type": "application/json"
                }
                
                payload = {
                    "from": {
                        "email": from_email,
                        "name": from_name
                    },
                    "to": [
                        {
                            "email": user.email,
                            "name": user.name
                        }
                    ],
                    "subject": rendered_subject,
                    "html": rendered_body
                }
                
                response = requests.post(url, json=payload, headers=headers)
                
                if response.status_code == 202:
                    current_app.logger.info(f"Email sent via MailerSend API to {user.email}: {rendered_subject}")
                else:
                    current_app.logger.error(f"MailerSend API error: {response.status_code} - {response.text}")
                    
            except requests.exceptions.RequestException as e:
                current_app.logger.error(f"MailerSend API request error: {str(e)}")
            except Exception as e:
                current_app.logger.error(f"Error sending email via MailerSend: {str(e)}")
        
        # ✅ Hagyományos SMTP használata ha nincs API key
        else:
            try:
                # Email összeállítás
                msg = MIMEMultipart('alternative')
                msg['Subject'] = rendered_subject
                msg['From'] = f"{from_name} <{from_email}>"
                msg['To'] = user.email
                
                # ✅ UTF-8 charset for Hungarian characters
                msg.attach(MIMEText(rendered_body, 'html', 'utf-8'))
                
                # SMTP kapcsolat és küldés
                if use_tls:
                    server = smtplib.SMTP(smtp_host, smtp_port)
                    server.starttls()
                else:
                    server = smtplib.SMTP(smtp_host, smtp_port)
                
                server.login(smtp_username, smtp_password)
                server.send_message(msg)
                server.quit()
                
                current_app.logger.info(f"Email sent via SMTP to {user.email}: {rendered_subject}")
                
            except smtplib.SMTPException as e:
                current_app.logger.error(f"SMTP error sending email to {user.email}: {str(e)}")
            except Exception as e:
                current_app.logger.error(f"Error sending email via SMTP to {user.email}: {str(e)}")
    
    @staticmethod
    def _render_template(template, data):
        """Template renderelés ({{variable}} -> érték)"""
        def replace_var(match):
            var_name = match.group(1)
            return str(data.get(var_name, f"{{{{{var_name}}}}}"))
        
        return re.sub(r'\{\{(\w+)\}\}', replace_var, template)
    
    # ============================================
    # USER-FACING API METHODS
    # ============================================
    
    @staticmethod
    def mark_as_read(notification_id, user_id):
        """Notification olvasottnak jelölése"""
        # Late import - circular import elkerülése
        from app import db
        
        db.session.execute(text("""
            UPDATE notifications 
            SET is_read = 1, read_at = CURRENT_TIMESTAMP
            WHERE id = :p0 AND user_id = :p1
        """), {"p0": notification_id, "p1": user_id})
        db.session.commit()
    
    @staticmethod
    def mark_all_as_read(user_id):
        """Összes notification olvasottnak jelölése"""
        # Late import - circular import elkerülése
        from app import db
        
        db.session.execute(text("""
            UPDATE notifications 
            SET is_read = 1, read_at = CURRENT_TIMESTAMP
            WHERE user_id = :p0 AND is_read = 0
        """), {"p0": user_id})
        db.session.commit()
    
    @staticmethod
    def delete_notification(notification_id, user_id):
        """Notification törlése"""
        # Late import - circular import elkerülése
        from app import db
        
        db.session.execute(text("""
            DELETE FROM notifications 
            WHERE id = :p0 AND user_id = :p1
        """), {"p0": notification_id, "p1": user_id})
        db.session.commit()
    
    @staticmethod
    def get_user_notifications(user_id, unread_only=False, limit=50):
        """User notificationjei lekérése"""
        # Late import - circular import elkerülése
        from app import db
        
        query = """
            SELECT n.id, n.message, n.link_url, n.is_read, n.read_at, n.created_at, 
                   net.event_key, net.event_name, n.event_data
            FROM notifications n
            JOIN notification_event_types net ON n.event_type_id = net.id
            WHERE n.user_id = :user_id
        """
        
        params = {"user_id": user_id}
        
        if unread_only:
            query += " AND n.is_read = 0"
        
        query += " ORDER BY n.created_at DESC LIMIT :limit"
        params["limit"] = limit
        
        cursor = db.session.execute(text(query), params)
        
        notifications = []
        for row in cursor:
            notifications.append({
                'id': row[0],
                'message': row[1],
                'link_url': row[2],
                'is_read': bool(row[3]),
                'read_at': row[4],  # ✅ read_at mező hozzáadva!
                'created_at': row[5],
                'event_key': row[6],
                'event_name': row[7],
                'event_data': json.loads(row[8]) if row[8] else {}
            })
        
        return notifications
    
    @staticmethod
    def get_unread_count(user_id):
        """Olvasatlan notificationök száma"""
        # Late import - circular import elkerülése
        from app import db
        
        cursor = db.session.execute(text("""
            SELECT COUNT(*) FROM notifications 
            WHERE user_id = :p0 AND is_read = 0
        """), {"p0": user_id})
        return cursor.fetchone()[0]
