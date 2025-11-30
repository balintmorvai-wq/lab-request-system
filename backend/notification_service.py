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
        message = NotificationService._generate_in_app_message(event_key, event_data)
        link_url = f"/requests/{request_id}" if request_id else None
        
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
        # Event-specific messages
        templates = {
            'status_change': "Kérés státusza megváltozott: {old_status} → {new_status}",
            'new_request': "Új labor kérés érkezett: {request_number}",
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
        """Email értesítés küldése"""
        # Late import - circular import elkerülése
        from app import db
        
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
        
        # TODO: Email küldés implementálás (v8.1)
        # SMTP beállítások lekérése és Flask-Mail küldés
        current_app.logger.info(f"Email notification queued for {user.email}: {rendered_subject}")
    
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
            SELECT n.id, n.message, n.link_url, n.is_read, n.created_at, 
                   net.event_key, net.event_name, n.event_data
            FROM notifications n
            JOIN notification_event_types net ON n.event_type_id = net.id
            WHERE n.user_id = ?
        """
        
        params = [user_id]
        
        if unread_only:
            query += " AND n.is_read = 0"
        
        query += " ORDER BY n.created_at DESC LIMIT ?"
        params.append(limit)
        
        cursor = db.session.execute(text(query), params)
        
        notifications = []
        for row in cursor:
            notifications.append({
                'id': row[0],
                'message': row[1],
                'link_url': row[2],
                'is_read': bool(row[3]),
                'created_at': row[4],
                'event_key': row[5],
                'event_name': row[6],
                'event_data': json.loads(row[7]) if row[7] else {}
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
