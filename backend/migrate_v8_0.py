#!/usr/bin/env python3
"""
v8.0 Migration Script - Abstract Notification System
- Régi notifications tábla eldobása
- Új notification_event_types tábla
- Új notification_rules tábla
- Új notification_templates tábla
- Új notifications tábla (új struktúra)
- smtp_settings tábla (később használatos)
"""

import sqlite3
import os
import sys
from datetime import datetime

def migrate():
    # Adatbázis kapcsolat
    db_path = os.path.join(os.path.dirname(__file__), 'instance', 'lab_requests.db')
    
    if not os.path.exists(db_path):
        print(f"❌ Adatbázis nem található: {db_path}")
        sys.exit(1)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("🚀 v8.0 Migration - Abstract Notification System")
    print("=" * 60)
    
    try:
        # 1. RÉGI NOTIFICATIONS TÁBLA ELDOBÁSA
        print("\n📦 1/6: Régi notifications tábla eldobása...")
        cursor.execute("DROP TABLE IF EXISTS notifications")
        print("✅ Régi notifications tábla törölve")
        
        # 2. NOTIFICATION_EVENT_TYPES TÁBLA
        print("\n📦 2/6: notification_event_types tábla létrehozása...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notification_event_types (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_key VARCHAR(50) UNIQUE NOT NULL,
                event_name VARCHAR(100) NOT NULL,
                description TEXT,
                available_variables TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Alapértelmezett event típusok beszúrása
        event_types = [
            ('status_change', 'Státuszváltozás', 
             'Kérés státusza megváltozott', 
             '["request_number", "old_status", "new_status", "company_name", "requester_name", "request_link"]'),
            
            ('new_request', 'Új kérés létrehozva', 
             'Új laborkérés került a rendszerbe',
             '["request_number", "company_name", "requester_name", "category", "request_link"]'),
            
            ('request_approved', 'Kérés jóváhagyva', 
             'Céges admin jóváhagyta a kérést',
             '["request_number", "approver_name", "company_name", "request_link"]'),
            
            ('request_rejected', 'Kérés elutasítva', 
             'Céges admin elutasította a kérést',
             '["request_number", "approver_name", "rejection_reason", "request_link"]'),
            
            ('results_uploaded', 'Eredmények feltöltve', 
             'Labor feltöltötte a vizsgálati eredményeket',
             '["request_number", "uploader_name", "request_link"]'),
            
            ('deadline_approaching', 'Határidő közeledik',
             'Kérés határideje 3 napon belül lejár',
             '["request_number", "deadline", "days_remaining", "request_link"]'),
            
            ('comment_added', 'Megjegyzés hozzáadva',
             'Új megjegyzés érkezett a kéréshez',
             '["request_number", "commenter_name", "comment_text", "request_link"]')
        ]
        
        for event in event_types:
            cursor.execute("""
                INSERT OR IGNORE INTO notification_event_types 
                (event_key, event_name, description, available_variables)
                VALUES (?, ?, ?, ?)
            """, event)
        
        print(f"✅ {len(event_types)} eseménytípus létrehozva")
        
        # 3. NOTIFICATION_TEMPLATES TÁBLA
        print("\n📦 3/6: notification_templates tábla létrehozása...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notification_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) NOT NULL,
                event_type_id INTEGER NOT NULL,
                subject VARCHAR(200) NOT NULL,
                body TEXT NOT NULL,
                variables_used TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (event_type_id) REFERENCES notification_event_types(id)
            )
        """)
        
        # Alapértelmezett template-ek
        templates = [
            # Status change template
            ('Alapértelmezett státuszváltozás', 1,
             'Laborkérés státuszváltozás - {{request_number}}',
             '''<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4F46E5;">Státuszváltozás</h2>
                <p>Tisztelt Felhasználó!</p>
                <p>A <strong>{{request_number}}</strong> számú laborkérés státusza megváltozott:</p>
                <ul>
                    <li><strong>Korábbi státusz:</strong> {{old_status}}</li>
                    <li><strong>Új státusz:</strong> {{new_status}}</li>
                </ul>
                <p><strong>Cég:</strong> {{company_name}}</p>
                <p><strong>Kérelmező:</strong> {{requester_name}}</p>
                <p><a href="{{request_link}}" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Kérés megtekintése</a></p>
                <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;">
                <p style="color: #666; font-size: 12px;">Ez egy automatikus értesítés a Laborkérés rendszerből.</p>
            </div>''',
             '["request_number", "old_status", "new_status", "company_name", "requester_name", "request_link"]'),
            
            # New request template
            ('Új kérés értesítés', 2,
             'Új laborkérés - {{request_number}}',
             '''<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #10B981;">Új laborkérés érkezett</h2>
                <p>Tisztelt Felhasználó!</p>
                <p>Új laborkérés került a rendszerbe:</p>
                <ul>
                    <li><strong>Kérés azonosító:</strong> {{request_number}}</li>
                    <li><strong>Cég:</strong> {{company_name}}</li>
                    <li><strong>Kérelmező:</strong> {{requester_name}}</li>
                    <li><strong>Kategória:</strong> {{category}}</li>
                </ul>
                <p><a href="{{request_link}}" style="background-color: #10B981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Kérés megtekintése</a></p>
                <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;">
                <p style="color: #666; font-size: 12px;">Ez egy automatikus értesítés a Laborkérés rendszerből.</p>
            </div>''',
             '["request_number", "company_name", "requester_name", "category", "request_link"]'),
            
            # Approved template
            ('Jóváhagyás értesítés', 3,
             'Kérés jóváhagyva - {{request_number}}',
             '''<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #10B981;">Kérés jóváhagyva</h2>
                <p>Tisztelt Felhasználó!</p>
                <p>A <strong>{{request_number}}</strong> számú laborkérést jóváhagyta: <strong>{{approver_name}}</strong></p>
                <p><strong>Cég:</strong> {{company_name}}</p>
                <p><a href="{{request_link}}" style="background-color: #10B981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Kérés megtekintése</a></p>
                <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;">
                <p style="color: #666; font-size: 12px;">Ez egy automatikus értesítés a Laborkérés rendszerből.</p>
            </div>''',
             '["request_number", "approver_name", "company_name", "request_link"]'),
            
            # Rejected template
            ('Elutasítás értesítés', 4,
             'Kérés elutasítva - {{request_number}}',
             '''<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #EF4444;">Kérés elutasítva</h2>
                <p>Tisztelt Felhasználó!</p>
                <p>A <strong>{{request_number}}</strong> számú laborkérést elutasította: <strong>{{approver_name}}</strong></p>
                <p><strong>Indoklás:</strong> {{rejection_reason}}</p>
                <p><a href="{{request_link}}" style="background-color: #EF4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Kérés megtekintése</a></p>
                <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;">
                <p style="color: #666; font-size: 12px;">Ez egy automatikus értesítés a Laborkérés rendszerből.</p>
            </div>''',
             '["request_number", "approver_name", "rejection_reason", "request_link"]'),
            
            # Results uploaded template
            ('Eredmények feltöltve értesítés', 5,
             'Vizsgálati eredmények - {{request_number}}',
             '''<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #8B5CF6;">Eredmények feltöltve</h2>
                <p>Tisztelt Felhasználó!</p>
                <p>A <strong>{{request_number}}</strong> számú laborkérés vizsgálati eredményeit feltöltötte: <strong>{{uploader_name}}</strong></p>
                <p><a href="{{request_link}}" style="background-color: #8B5CF6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Eredmények megtekintése</a></p>
                <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;">
                <p style="color: #666; font-size: 12px;">Ez egy automatikus értesítés a Laborkérés rendszerből.</p>
            </div>''',
             '["request_number", "uploader_name", "request_link"]')
        ]
        
        for template in templates:
            cursor.execute("""
                INSERT INTO notification_templates 
                (name, event_type_id, subject, body, variables_used)
                VALUES (?, ?, ?, ?, ?)
            """, template)
        
        print(f"✅ {len(templates)} email sablon létrehozva")
        
        # 4. NOTIFICATION_RULES TÁBLA
        print("\n📦 4/6: notification_rules tábla létrehozása...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notification_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type_id INTEGER NOT NULL,
                role VARCHAR(50) NOT NULL,
                event_filter TEXT,
                in_app_enabled BOOLEAN DEFAULT TRUE,
                email_enabled BOOLEAN DEFAULT FALSE,
                email_template_id INTEGER,
                priority INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (event_type_id) REFERENCES notification_event_types(id),
                FOREIGN KEY (email_template_id) REFERENCES notification_templates(id)
            )
        """)
        
        # Alapértelmezett szabályok (minden szerepkör megkapja az in-app értesítéseket)
        roles = ['super_admin', 'company_admin', 'company_user', 'labor_staff', 
                 'university_logistics', 'company_logistics']
        
        default_rules = []
        
        # Status change - minden szerepkör
        for role in roles:
            default_rules.append((1, role, None, True, False, 1, 10, True))
        
        # New request - super_admin, labor_staff
        for role in ['super_admin', 'labor_staff']:
            default_rules.append((2, role, None, True, False, 2, 20, True))
        
        # Approved - requester, company_admin
        for role in ['company_admin', 'company_user']:
            default_rules.append((3, role, None, True, False, 3, 30, True))
        
        # Rejected - requester, company_admin
        for role in ['company_admin', 'company_user']:
            default_rules.append((4, role, None, True, False, 4, 40, True))
        
        # Results uploaded - company_admin, company_user
        for role in ['company_admin', 'company_user']:
            default_rules.append((5, role, None, True, False, 5, 50, True))
        
        for rule in default_rules:
            cursor.execute("""
                INSERT INTO notification_rules 
                (event_type_id, role, event_filter, in_app_enabled, email_enabled, 
                 email_template_id, priority, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, rule)
        
        print(f"✅ {len(default_rules)} alapértelmezett szabály létrehozva")
        
        # 5. ÚJ NOTIFICATIONS TÁBLA
        print("\n📦 5/6: Új notifications tábla létrehozása...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                event_type_id INTEGER NOT NULL,
                event_data TEXT,
                message TEXT NOT NULL,
                link_url VARCHAR(200),
                read_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                request_id INTEGER,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (event_type_id) REFERENCES notification_event_types(id),
                FOREIGN KEY (request_id) REFERENCES lab_requests(id)
            )
        """)
        
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read_at)")
        
        print("✅ Új notifications tábla létrehozva indexekkel")
        
        # 6. SMTP_SETTINGS TÁBLA (később használatos)
        print("\n📦 6/6: smtp_settings tábla létrehozása...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS smtp_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                smtp_host VARCHAR(100),
                smtp_port INTEGER DEFAULT 587,
                smtp_user VARCHAR(100),
                smtp_password VARCHAR(200),
                use_tls BOOLEAN DEFAULT TRUE,
                from_address VARCHAR(100),
                from_name VARCHAR(100) DEFAULT 'Laborkérés Rendszer',
                is_active BOOLEAN DEFAULT FALSE,
                test_email_sent_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        print("✅ smtp_settings tábla létrehozva")
        
        # Commit
        conn.commit()
        
        print("\n" + "=" * 60)
        print("✅ v8.0 Migration sikeresen lefutott!")
        print("\n📊 Létrehozott táblák:")
        print("  • notification_event_types (7 eseménytípus)")
        print("  • notification_templates (5 email sablon)")
        print(f"  • notification_rules ({len(default_rules)} alapértelmezett szabály)")
        print("  • notifications (új struktúra)")
        print("  • smtp_settings (később konfigurálható)")
        print("\n🗑️  Törölt táblák:")
        print("  • notifications (régi struktúra)")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration hiba: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
