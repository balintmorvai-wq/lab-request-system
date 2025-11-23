#!/usr/bin/env python3
"""
Migration script for v6.6 ENHANCED v2 features
Adds new columns to LabRequest and Department models
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, db

def migrate_v2():
    """Add new columns for v2 features"""
    with app.app_context():
        print("🔄 Starting migration for v6.6 ENHANCED v2...")
        
        try:
            # Check if we're using SQLite or PostgreSQL
            from sqlalchemy import inspect
            inspector = inspect(db.engine)
            
            # Get existing columns
            lab_request_columns = [col['name'] for col in inspector.get_columns('lab_request')]
            department_columns = [col['name'] for col in inspector.get_columns('department')]
            
            # Migrate LabRequest table
            print("\n📋 Migrating LabRequest table...")
            
            if 'sampling_address' not in lab_request_columns:
                print("  ✅ Adding column: sampling_address")
                db.session.execute(db.text("ALTER TABLE lab_request ADD COLUMN sampling_address VARCHAR(500)"))
            else:
                print("  ⏭️  Column already exists: sampling_address")
            
            if 'contact_person' not in lab_request_columns:
                print("  ✅ Adding column: contact_person")
                db.session.execute(db.text("ALTER TABLE lab_request ADD COLUMN contact_person VARCHAR(200)"))
            else:
                print("  ⏭️  Column already exists: contact_person")
            
            if 'contact_phone' not in lab_request_columns:
                print("  ✅ Adding column: contact_phone")
                db.session.execute(db.text("ALTER TABLE lab_request ADD COLUMN contact_phone VARCHAR(50)"))
            else:
                print("  ⏭️  Column already exists: contact_phone")
            
            # Migrate Department table
            print("\n🏢 Migrating Department table...")
            
            if 'sample_pickup_address' not in department_columns:
                print("  ✅ Adding column: sample_pickup_address")
                db.session.execute(db.text("ALTER TABLE department ADD COLUMN sample_pickup_address VARCHAR(500)"))
            else:
                print("  ⏭️  Column already exists: sample_pickup_address")
            
            if 'sample_pickup_contact' not in department_columns:
                print("  ✅ Adding column: sample_pickup_contact")
                db.session.execute(db.text("ALTER TABLE department ADD COLUMN sample_pickup_contact VARCHAR(200)"))
            else:
                print("  ⏭️  Column already exists: sample_pickup_contact")
            
            db.session.commit()
            print("\n✅ Migration completed successfully!")
            print("\n📝 Changes made:")
            print("   - LabRequest: sampling_address, contact_person, contact_phone")
            print("   - Department: sample_pickup_address, sample_pickup_contact")
            
        except Exception as e:
            db.session.rollback()
            print(f"\n❌ Migration failed: {e}")
            return False
        
        return True

if __name__ == '__main__':
    success = migrate_v2()
    sys.exit(0 if success else 1)
