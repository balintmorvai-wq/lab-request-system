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

# LATE IMPORT - db, User, LabRequest csak függvényeken belül!
# Ezzel elkerüljük a circular import-ot

class NotificationService:
    """Központi értesítési szolgáltatás"""
    
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
            "SELECT id, event_name FROM notification_event_types WHERE event_key = ?",
            (event_key,)
        )
        event_type = cursor.fetchone()
        
        if not event_type:
            current_app.logger.warning(f"Unknown event type: {event_key}")
            return {'in_app_count': 0, 'email_count': 0}
        
        event_type_id, event_name = event_type
        
        # Request link generálása
        frontend_url = current_app.config.get('FRONTEND_URL', 'https://lab-request-frontend.netlify.app')
        request_link = f"{frontend_url}/requests" if request_id is None else f"{frontend_url}/requests?id={request_id}"
        event_data['request_link'] = request_link
        
        # Érintett userek meghatározása
        if specific_users:
            # Konkrét userek megadva
            target_users = User.query.filter(User.id.in_(specific_users)).all()
            rules = NotificationService._get_rules_for_event(event_type_id)
        else:
            # Szabályok alapján
            target_users, rules = NotificationService._determine_target_users(
                event_type_id, event_data, request_id
            )
        
        if not target_users:
            return {'in_app_count': 0, 'email_count': 0}
        
        in_app_count = 0
        email_count = 0
        
        # Értesítések küldése minden user-nek
        for user in target_users:
            # User szerepkörhöz tartozó szabály keresése
            user_rule = next((r for r in rules if r['role'] == user.role), None)
            
            if not user_rule:
                continue
            
            # In-app notification
            if user_rule['in_app_enabled']:
                message = NotificationService._generate_in_app_message(
                    event_key, event_data
                )
                NotificationService._create_in_app_notification(
                    user.id, event_type_id, message, request_link, 
                    request_id, event_data
                )
                in_app_count += 1
            
            # Email notification
            if user_rule['email_enabled'] and user_rule['email_template_id']:
                NotificationService._send_email_notification(
                    user, event_data, user_rule['email_template_id']
                )
                email_count += 1
        
        db.session.commit()
        
        return {
            'in_app_count': in_app_count,
            'email_count': email_count
        }
    
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
        
        cursor = db.session.execute("""
            SELECT role, event_filter, in_app_enabled, email_enabled, 
                   email_template_id, priority
            FROM notification_rules
            WHERE event_type_id = ? AND is_active = 1
            ORDER BY priority DESC
        """, (event_type_id,))
        
        rules = []
        for row in cursor:
            rules.append({
                'role': row[0],
                'event_filter': json.loads(row[1]) if row[1] else None,
                'in_app_enabled': bool(row[2]),
                'email_enabled': bool(row[3]),
                'email_template_id': row[4],
                'priority': row[5]
            })
        
        return rules
    
    @staticmethod
    def _generate_in_app_message(event_key, event_data):
        """In-app notification szöveg generálása"""
        messages = {
            'status_change': f"Státuszváltozás: {event_data.get('request_number', '')} → {event_data.get('new_status', '')}",
            'new_request': f"Új kérés: {event_data.get('request_number', '')} ({event_data.get('company_name', '')})",
            'request_approved': f"Jóváhagyva: {event_data.get('request_number', '')}",
            'request_rejected': f"Elutasítva: {event_data.get('request_number', '')}",
            'results_uploaded': f"Eredmények feltöltve: {event_data.get('request_number', '')}",
            'deadline_approaching': f"Határidő közeledik: {event_data.get('request_number', '')} ({event_data.get('days_remaining', '')} nap)",
            'comment_added': f"Új megjegyzés: {event_data.get('request_number', '')}"
        }
        
        return messages.get(event_key, f"Új értesítés: {event_data.get('request_number', '')}")
    
    @staticmethod
    def _create_in_app_notification(user_id, event_type_id, message, link_url, request_id, event_data):
        """In-app notification létrehozása"""
        # Late import - circular import elkerülése
        from app import db
        
db.session.execute("""
            INSERT INTO notifications 
            (user_id, event_type_id, event_data, message, link_url, request_id)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (user_id, event_type_id, json.dumps(event_data), message, link_url, request_id))
    
    @staticmethod
    def _send_email_notification(user, event_data, template_id):
        """Email értesítés küldése"""
        # Late import - circular import elkerülése
        from app import db
        
# Template lekérése
        cursor = db.session.execute("""
            SELECT subject, body FROM notification_templates WHERE id = ?
        """, (template_id,))
        
        template = cursor.fetchone()
        if not template:
            current_app.logger.warning(f"Template not found: {template_id}")
            return
        
        subject_template, body_template = template
        
        # Template feldolgozása (változók behelyettesítése)
        subject = NotificationService._render_template(subject_template, event_data)
        body = NotificationService._render_template(body_template, event_data)
        
        # Email küldés (később implementáljuk az SMTP-t)
        # TODO: Implement actual email sending
        current_app.logger.info(f"Email would be sent to {user.email}: {subject}")
        
        # SMTP implementáció később:
        # from flask_mail import Message
        # msg = Message(subject, recipients=[user.email], html=body)
        # mail.send(msg)
    
    @staticmethod
    def _render_template(template, data):
        """Template renderelés ({{variable}} helyettesítés)"""
        def replace_var(match):
            var_name = match.group(1)
            return str(data.get(var_name, ''))
        
        # {{variable}} pattern helyettesítése
        return re.sub(r'\{\{(\w+)\}\}', replace_var, template)
    
    @staticmethod
    def mark_as_read(notification_id, user_id):
        """Notification olvasottnak jelölése"""
        # Late import - circular import elkerülése
        from app import db
        
db.session.execute("""
            UPDATE notifications 
            SET read_at = ? 
            WHERE id = ? AND user_id = ?
        """, (datetime.utcnow(), notification_id, user_id))
        db.session.commit()
    
    @staticmethod
    def mark_all_as_read(user_id):
        """Összes notification olvasottnak jelölése"""
        # Late import - circular import elkerülése
        from app import db
        
db.session.execute("""
            UPDATE notifications 
            SET read_at = ? 
            WHERE user_id = ? AND read_at IS NULL
        """, (datetime.utcnow(), user_id))
        db.session.commit()
    
    @staticmethod
    def delete_notification(notification_id, user_id):
        """Notification törlése"""
        # Late import - circular import elkerülése
        from app import db
        
db.session.execute("""
            DELETE FROM notifications 
            WHERE id = ? AND user_id = ?
        """, (notification_id, user_id))
        db.session.commit()
    
    @staticmethod
    def get_user_notifications(user_id, unread_only=False, limit=50):
        """User notifikációi"""
        # Late import - circular import elkerülése
        from app import db
        
query = """
            SELECT n.id, n.event_type_id, net.event_name, n.message, 
                   n.link_url, n.read_at, n.created_at, n.request_id
            FROM notifications n
            JOIN notification_event_types net ON n.event_type_id = net.id
            WHERE n.user_id = ?
        """
        
        params = [user_id]
        
        if unread_only:
            query += " AND n.read_at IS NULL"
        
        query += " ORDER BY n.created_at DESC LIMIT ?"
        params.append(limit)
        
        cursor = db.session.execute(query, params)
        
        notifications = []
        for row in cursor:
            notifications.append({
                'id': row[0],
                'event_type_id': row[1],
                'event_name': row[2],
                'message': row[3],
                'link_url': row[4],
                'read_at': row[5],
                'created_at': row[6],
                'request_id': row[7]
            })
        
        return notifications
    
    @staticmethod
    def get_unread_count(user_id):
        """Olvasatlan notifikációk száma"""
        # Late import - circular import elkerülése
        from app import db
        
cursor = db.session.execute("""
            SELECT COUNT(*) FROM notifications 
            WHERE user_id = ? AND read_at IS NULL
        """, (user_id,))
        
        return cursor.fetchone()[0]
