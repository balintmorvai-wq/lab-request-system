#!/usr/bin/env python3
"""
Diagnostic script to check database state
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, db, RequestCategory, TestType, Department, User, Company

def diagnose():
    with app.app_context():
        print("🔍 DATABASE DIAGNOSTIC")
        print("=" * 60)
        
        # Check tables exist
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        
        print(f"\n📊 Tables found: {len(tables)}")
        for table in tables:
            print(f"   - {table}")
        
        # Check data counts
        print(f"\n📈 Data counts:")
        print(f"   Categories: {RequestCategory.query.count()}")
        print(f"   Test Types: {TestType.query.count()}")
        print(f"   Departments: {Department.query.count()}")
        print(f"   Users: {User.query.count()}")
        print(f"   Companies: {Company.query.count()}")
        
        # Check columns
        print(f"\n🔧 LabRequest columns:")
        lab_request_cols = [col['name'] for col in inspector.get_columns('lab_request')]
        for col in sorted(lab_request_cols):
            print(f"   - {col}")
        
        # Check if new columns exist
        print(f"\n✅ New v2 columns:")
        print(f"   sampling_address: {'✅' if 'sampling_address' in lab_request_cols else '❌'}")
        print(f"   contact_person: {'✅' if 'contact_person' in lab_request_cols else '❌'}")
        print(f"   contact_phone: {'✅' if 'contact_phone' in lab_request_cols else '❌'}")
        
        # Check categories with icons
        print(f"\n📁 Categories:")
        categories = RequestCategory.query.all()
        for cat in categories:
            print(f"   - {cat.name} (icon: {cat.icon if hasattr(cat, 'icon') else 'N/A'})")
        
        # Check if init_db was called
        print(f"\n🎯 Database initialization status:")
        if RequestCategory.query.count() == 0:
            print("   ❌ NO DATA! init_db() may not have run!")
            print("   💡 Solution: Call /api/init or run init_db()")
        else:
            print(f"   ✅ Data exists ({RequestCategory.query.count()} categories)")

if __name__ == '__main__':
    diagnose()
