#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v7.0.4 Database Migration: Admin Validation Fields
Automatikusan lefut az app.py indításakor
"""

import os
import sys
from sqlalchemy import text, inspect

def run_migration_v7_0_4(db):
    """
    v7.0.4 migráció: TestResult validation mezők hozzáadása
    """
    print("\n" + "="*60)
    print("v7.0.4 Migration: Admin Validation Fields")
    print("="*60)
    
    try:
        # Ellenőrizzük, hogy már léteznek-e a mezők
        inspector = inspect(db.engine)
        columns = [col['name'] for col in inspector.get_columns('test_result')]
        
        needs_migration = False
        missing_columns = []
        
        if 'validated_by_user_id' not in columns:
            needs_migration = True
            missing_columns.append('validated_by_user_id')
        
        if 'validated_at' not in columns:
            needs_migration = True
            missing_columns.append('validated_at')
        
        if 'rejection_reason' not in columns:
            needs_migration = True
            missing_columns.append('rejection_reason')
        
        if not needs_migration:
            print("✓ Migration already completed - all columns exist")
            print("  - validated_by_user_id: EXISTS")
            print("  - validated_at: EXISTS")
            print("  - rejection_reason: EXISTS")
            print("="*60 + "\n")
            return True
        
        print(f"⚠ Migration needed - missing columns: {', '.join(missing_columns)}")
        print("\nExecuting migration...")
        
        # PostgreSQL vagy SQLite?
        is_postgres = 'postgresql' in str(db.engine.url).lower()
        
        # Oszlopok hozzáadása
        with db.engine.connect() as conn:
            trans = conn.begin()
            
            try:
                if 'validated_by_user_id' not in columns:
                    print("  Adding column: validated_by_user_id...")
                    if is_postgres:
                        conn.execute(text(
                            'ALTER TABLE test_result ADD COLUMN IF NOT EXISTS validated_by_user_id INTEGER'
                        ))
                        conn.execute(text(
                            'ALTER TABLE test_result ADD CONSTRAINT fk_test_result_validated_by '
                            'FOREIGN KEY (validated_by_user_id) REFERENCES "user"(id) ON DELETE SET NULL'
                        ))
                    else:
                        # SQLite nem támogatja az ADD CONSTRAINT-et ALTER TABLE-ben
                        conn.execute(text(
                            'ALTER TABLE test_result ADD COLUMN validated_by_user_id INTEGER'
                        ))
                    print("    ✓ validated_by_user_id added")
                
                if 'validated_at' not in columns:
                    print("  Adding column: validated_at...")
                    conn.execute(text(
                        'ALTER TABLE test_result ADD COLUMN validated_at TIMESTAMP'
                    ))
                    print("    ✓ validated_at added")
                
                if 'rejection_reason' not in columns:
                    print("  Adding column: rejection_reason...")
                    conn.execute(text(
                        'ALTER TABLE test_result ADD COLUMN rejection_reason TEXT'
                    ))
                    print("    ✓ rejection_reason added")
                
                # Index létrehozása (csak PostgreSQL-nél)
                if is_postgres and 'validated_by_user_id' in missing_columns:
                    print("  Creating index: idx_test_result_validated_by...")
                    conn.execute(text(
                        'CREATE INDEX IF NOT EXISTS idx_test_result_validated_by '
                        'ON test_result(validated_by_user_id)'
                    ))
                    print("    ✓ Index created")
                
                trans.commit()
                print("\n✓ Migration completed successfully!")
                print("="*60 + "\n")
                return True
                
            except Exception as e:
                trans.rollback()
                print(f"\n✗ Migration failed: {str(e)}")
                print("="*60 + "\n")
                raise
    
    except Exception as e:
        print(f"\n✗ Migration error: {str(e)}")
        print("="*60 + "\n")
        # Neállítsuk le az app-ot migráció hiba miatt
        # csak logoljuk
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    """
    Standalone futtatás Railway CLI-vel:
    railway run python backend/migrate_v7_0_4.py
    """
    print("Standalone migration mode")
    print("This script should be imported and called from app.py")
    print("\nTo run standalone with Railway CLI:")
    print("  railway run python backend/migrate_v7_0_4.py")
    sys.exit(1)
