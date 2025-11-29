#!/usr/bin/env python3
"""
v8.0 Migration Script - Abstract Notification System
PostgreSQL + SQLite kompatibilis verzió

Támogatja:
- PostgreSQL (Railway production - DATABASE_URL)
- SQLite (Local development)
"""

import os
import sys
from datetime import datetime

def migrate():
    # Adatbázis kapcsolat - PostgreSQL vagy SQLite
    database_url = os.environ.get('DATABASE_URL')
    
    if database_url:
        # PostgreSQL (Railway production)
        print(f"🔗 PostgreSQL adatbázis használata (Railway)")
        import psycopg2
        
        # Fix postgres:// -> postgresql://
        if database_url.startswith('postgres://'):
            database_url = database_url.replace('postgres://', 'postgresql://', 1)
        
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        use_postgres = True
        placeholder = '%s'
        autoincrement = 'SERIAL'
        insert_ignore = 'ON CONFLICT (event_key) DO NOTHING'
    else:
        # SQLite (local dev)
        print(f"🔗 SQLite adatbázis használata (local dev)")
        import sqlite3
        db_path = os.path.join(os.path.dirname(__file__), 'instance', 'lab_requests.db')
        
        if not os.path.exists(db_path):
            print(f"❌ Adatbázis nem található: {db_path}")
            sys.exit(1)
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        use_postgres = False
        placeholder = '?'
        autoincrement = 'INTEGER PRIMARY KEY AUTOINCREMENT'
        insert_ignore = 'OR IGNORE'
    
    print("🚀 v8.0 Migration - Abstract Notification System")
    print("=" * 60)
    
    # Confirmation
    print("\n⚠️  FIGYELMEZTETÉS: Ez törli a régi 'notifications' táblát!")
    print("Ez szükséges a v8.0 Abstract Notification System működéséhez.")
    
    confirm = input("\nFolytatod? (y/n): ").strip().lower()
    if confirm != 'y':
        print("❌ Migration megszakítva")
        sys.exit(0)
    
    try:
        # 1. RÉGI NOTIFICATIONS TÁBLA ELDOBÁSA
        print("\n📦 1/6: Régi notifications tábla eldobása...")
        cursor.execute("DROP TABLE IF EXISTS notifications CASCADE" if use_postgres else "DROP TABLE IF EXISTS notifications")
        print("✅ Régi notifications tábla törölve")
        
        # 2. NOTIFICATION_EVENT_TYPES TÁBLA
        print("\n📦 2/6: notification_event_types tábla létrehozása...")
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS notification_event_types (
                id {autoincrement},
                event_key VARCHAR(50) UNIQUE NOT NULL,
                event_name VARCHAR(100) NOT NULL,
                description TEXT,
                available_variables TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                {', PRIMARY KEY (id)' if use_postgres else ''}
            )
        """)
        
        # Alapértelmezett event típusok
        event_types = [
            ('status_change', 'Státuszváltozás', 
             'Kérés státusza megváltozott', 
             '["request_number", "old_status", "new_status", "company_name", "requester_name"]'),
            ('new_request', 'Új kérés létrehozva', 
             'Új laborkérés került a rendszerbe',
             '["request_number", "company_name", "requester_name", "category"]'),
            ('request_approved', 'Kérés jóváhagyva', 
             'Céges admin jóváhagyta a kérést',
             '["request_number", "approver_name", "company_name"]'),
            ('request_rejected', 'Kérés elutasítva', 
             'Céges admin elutasította a kérést',
             '["request_number", "approver_name", "rejection_reason"]'),
            ('results_uploaded', 'Eredmények feltöltve', 
             'Labor feltöltötte a vizsgálati eredményeket',
             '["request_number", "uploader_name"]'),
            ('deadline_approaching', 'Határidő közeledik',
             'Kérés határideje 3 napon belül lejár',
             '["request_number", "deadline", "days_remaining"]'),
            ('comment_added', 'Megjegyzés hozzáadva',
             'Új megjegyzés érkezett a kéréshez',
             '["request_number", "commenter_name", "comment_text"]')
        ]
        
        for event in event_types:
            cursor.execute(f"""
                INSERT INTO notification_event_types 
                (event_key, event_name, description, available_variables)
                VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder})
                {insert_ignore}
            """, event)
        
        print(f"✅ {len(event_types)} eseménytípus létrehozva")
        
        # 3. NOTIFICATION_TEMPLATES TÁBLA
        print("\n📦 3/6: notification_templates tábla létrehozása...")
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS notification_templates (
                id {autoincrement},
                name VARCHAR(100) NOT NULL,
                event_type_id INTEGER NOT NULL,
                subject VARCHAR(200) NOT NULL,
                body_html TEXT NOT NULL,
                variables_used TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                {', PRIMARY KEY (id)' if use_postgres else ''}
            )
        """)
        
        # Email sablonok
        templates = [
            ('Státuszváltozás email', 1, 'Kérés státusza megváltozott: {{request_number}}',
             '<p>Tisztelt {{requester_name}}!</p><p>A kérése ({{request_number}}) státusza megváltozott: <strong>{{old_status}}</strong> → <strong>{{new_status}}</strong></p>',
             '["request_number", "old_status", "new_status", "requester_name"]'),
            ('Új kérés email', 2, 'Új laborkérés: {{request_number}}',
             '<p>Új laborkérés érkezett a {{company_name}} cégtől.</p><p>Kérés száma: {{request_number}}</p><p>Kérelmező: {{requester_name}}</p>',
             '["request_number", "company_name", "requester_name"]'),
            ('Jóváhagyás email', 3, 'Kérés jóváhagyva: {{request_number}}',
             '<p>A kérését ({{request_number}}) jóváhagyta: {{approver_name}}</p>',
             '["request_number", "approver_name"]'),
            ('Elutasítás email', 4, 'Kérés elutasítva: {{request_number}}',
             '<p>A kérését ({{request_number}}) elutasította: {{approver_name}}</p><p>Indok: {{rejection_reason}}</p>',
             '["request_number", "approver_name", "rejection_reason"]'),
            ('Eredmények email', 5, 'Eredmények elérhetők: {{request_number}}',
             '<p>A kéréshez ({{request_number}}) tartozó eredmények elérhetők a rendszerben.</p>',
             '["request_number"]')
        ]
        
        for template in templates:
            cursor.execute(f"""
                INSERT INTO notification_templates 
                (name, event_type_id, subject, body_html, variables_used)
                VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
            """, template)
        
        print(f"✅ {len(templates)} email sablon létrehozva")
        
        # 4. NOTIFICATION_RULES TÁBLA
        print("\n📦 4/6: notification_rules tábla létrehozása...")
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS notification_rules (
                id {autoincrement},
                event_type_id INTEGER NOT NULL,
                role VARCHAR(50) NOT NULL,
                event_filter TEXT,
                in_app_enabled INTEGER DEFAULT 1,
                email_enabled INTEGER DEFAULT 0,
                email_template_id INTEGER,
                priority INTEGER DEFAULT 5,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                {', PRIMARY KEY (id)' if use_postgres else ''}
            )
        """)
        
        # Alapértelmezett szabályok
        rules = [
            # Status change - mindenki kap in-app notification
            (1, 'company_user', None, 1, 0, None, 10, 1),
            (1, 'company_admin', None, 1, 1, 1, 10, 1),
            (1, 'labor_staff', None, 1, 0, None, 5, 1),
            (1, 'super_admin', None, 1, 0, None, 5, 1),
            
            # New request - labor és adminok
            (2, 'company_admin', None, 1, 1, 2, 10, 1),
            (2, 'labor_staff', None, 1, 0, None, 8, 1),
            (2, 'super_admin', None, 1, 0, None, 5, 1),
            
            # Approved - kérelmező kap emailt
            (3, 'company_user', None, 1, 1, 3, 10, 1),
            
            # Rejected - kérelmező kap emailt
            (4, 'company_user', None, 1, 1, 4, 10, 1),
            
            # Results uploaded - mindenki
            (5, 'company_user', None, 1, 1, 5, 10, 1),
            (5, 'company_admin', None, 1, 0, None, 8, 1),
            (5, 'labor_staff', None, 1, 0, None, 5, 1),
            
            # Deadline approaching - labor staff
            (6, 'labor_staff', None, 1, 0, None, 8, 1),
            
            # Comment added
            (7, 'company_user', None, 1, 0, None, 5, 1)
        ]
        
        for rule in rules:
            cursor.execute(f"""
                INSERT INTO notification_rules 
                (event_type_id, role, event_filter, in_app_enabled, email_enabled, 
                 email_template_id, priority, is_active)
                VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, 
                        {placeholder}, {placeholder}, {placeholder})
            """, rule)
        
        print(f"✅ {len(rules)} alapértelmezett szabály létrehozva")
        
        # 5. NOTIFICATIONS TÁBLA (ÚJ STRUKTÚRA)
        print("\n📦 5/6: notifications tábla létrehozása (új struktúra)...")
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS notifications (
                id {autoincrement},
                user_id INTEGER NOT NULL,
                event_type_id INTEGER NOT NULL,
                event_data TEXT,
                message TEXT NOT NULL,
                link_url VARCHAR(200),
                request_id INTEGER,
                is_read INTEGER DEFAULT 0,
                read_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                {', PRIMARY KEY (id)' if use_postgres else ''}
            )
        """)
        
        print("✅ Új notifications tábla létrehozva")
        
        # 6. SMTP_SETTINGS TÁBLA
        print("\n📦 6/6: smtp_settings tábla létrehozása...")
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS smtp_settings (
                id {autoincrement},
                smtp_host VARCHAR(100),
                smtp_port INTEGER DEFAULT 587,
                smtp_username VARCHAR(100),
                smtp_password VARCHAR(200),
                from_email VARCHAR(100),
                from_name VARCHAR(100),
                use_tls INTEGER DEFAULT 1,
                is_active INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                {', PRIMARY KEY (id)' if use_postgres else ''}
            )
        """)
        
        # Placeholder SMTP config
        cursor.execute(f"""
            INSERT INTO smtp_settings 
            (smtp_host, smtp_port, from_email, from_name, is_active)
            VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
        """, ('smtp.gmail.com', 587, 'noreply@example.com', 'Labor Rendszer', 0))
        
        print("✅ smtp_settings tábla létrehozva (placeholder config)")
        
        # COMMIT
        conn.commit()
        
        print("\n" + "=" * 60)
        print("✅ v8.0 Migration sikeresen lefutott!")
        print("\n📊 Létrehozott táblák:")
        print("  • notification_event_types (7 eseménytípus)")
        print("  • notification_templates (5 email sablon)")
        print("  • notification_rules (14 alapértelmezett szabály)")
        print("  • notifications (új struktúra)")
        print("  • smtp_settings (placeholder config)")
        print("=" * 60)
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ HIBA történt a migration során:")
        print(f"   {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    migrate()
