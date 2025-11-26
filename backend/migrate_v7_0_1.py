#!/usr/bin/env python
"""
Railway Migration Script v7.0.1
================================

Manually run database migrations for v7.0.1

Usage:
    python migrate_v7_0_1.py
"""

import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import inspect

# Flask app setup
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///lab_requests.db')

# Fix postgres:// -> postgresql://
if app.config['SQLALCHEMY_DATABASE_URI'].startswith('postgres://'):
    app.config['SQLALCHEMY_DATABASE_URI'] = app.config['SQLALCHEMY_DATABASE_URI'].replace('postgres://', 'postgresql://', 1)

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_recycle': 300,
}

db = SQLAlchemy(app)

def migrate():
    """Run v7.0.1 migrations"""
    with app.app_context():
        inspector = inspect(db.engine)
        
        # Get existing columns and tables
        try:
            user_columns = [col['name'] for col in inspector.get_columns('user')]
        except Exception as e:
            print(f"❌ Error getting user columns: {e}")
            return False
            
        try:
            existing_tables = inspector.get_table_names()
        except Exception as e:
            print(f"❌ Error getting tables: {e}")
            return False
        
        migrations_applied = []
        
        print("\n🔍 Checking migrations...")
        print(f"📋 User columns: {user_columns}")
        print(f"📋 Existing tables: {existing_tables[:5]}...")  # First 5
        
        # 1. Add user.department_id
        if 'department_id' not in user_columns:
            print("\n🔄 Adding department_id to user table...")
            try:
                db.session.execute(db.text(
                    'ALTER TABLE "user" ADD COLUMN department_id INTEGER REFERENCES department(id)'
                ))
                db.session.commit()
                migrations_applied.append('user.department_id')
                print("✅ Added department_id to user")
            except Exception as e:
                print(f"❌ Failed to add department_id: {e}")
                db.session.rollback()
                return False
        else:
            print("⏭️  Skipped: user.department_id (already exists)")
        
        # 2. Create test_result table
        if 'test_result' not in existing_tables:
            print("\n🔄 Creating test_result table...")
            try:
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
                db.session.commit()
                migrations_applied.append('test_result table')
                print("✅ Created test_result table")
            except Exception as e:
                print(f"❌ Failed to create test_result: {e}")
                db.session.rollback()
                return False
        else:
            print("⏭️  Skipped: test_result table (already exists)")
        
        # 3. Verify migrations
        if migrations_applied:
            print(f"\n✅ Migration complete! Applied {len(migrations_applied)} changes:")
            for m in migrations_applied:
                print(f"   - {m}")
            return True
        else:
            print("\n✅ No migrations needed - database is up to date")
            return True

if __name__ == '__main__':
    print("=" * 60)
    print("Railway Migration Script v7.0.1")
    print("=" * 60)
    
    db_url = os.environ.get('DATABASE_URL', 'Not set')
    if db_url.startswith('postgresql://'):
        # Mask password
        parts = db_url.split('@')
        if len(parts) == 2:
            masked = parts[0].split(':')
            masked[-1] = '****'
            print(f"Database: {':'.join(masked)}@{parts[1]}")
        else:
            print(f"Database: {db_url[:30]}...")
    else:
        print(f"Database: {db_url}")
    
    print("\n🚀 Starting migration...\n")
    
    success = migrate()
    
    if success:
        print("\n" + "=" * 60)
        print("✅ MIGRATION SUCCESSFUL!")
        print("=" * 60)
        print("\nNext steps:")
        print("1. Test login: curl -X POST https://your-app.up.railway.app/api/auth/login \\")
        print('     -H "Content-Type: application/json" \\')
        print('     -d \'{"email":"admin@pannon.hu","password":"admin123"}\'')
        print("\n2. Check database:")
        print("   railway connect")
        print("   \\d user")
        print("   \\dt")
    else:
        print("\n" + "=" * 60)
        print("❌ MIGRATION FAILED")
        print("=" * 60)
        print("\nPlease check the error messages above and try again.")
        print("If the problem persists, run migrations manually:")
        print("  railway connect")
        print('  ALTER TABLE "user" ADD COLUMN department_id INTEGER REFERENCES department(id);')
