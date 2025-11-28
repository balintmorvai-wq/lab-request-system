"""
Migration script for v7.0.26
Add departments_closed column to lab_request table
"""

from app import app, db

def migrate():
    with app.app_context():
        print("Starting v7.0.26 migration...")
        
        try:
            # Add departments_closed column
            with db.engine.connect() as conn:
                # Check if column exists
                result = conn.execute(db.text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name='lab_request' AND column_name='departments_closed'
                """))
                
                if result.fetchone() is None:
                    print("Adding departments_closed column...")
                    conn.execute(db.text("""
                        ALTER TABLE lab_request 
                        ADD COLUMN departments_closed TEXT
                    """))
                    conn.commit()
                    print("✅ departments_closed column added successfully")
                else:
                    print("⏭️  departments_closed column already exists, skipping")
            
            print("✅ Migration v7.0.26 completed successfully!")
            
        except Exception as e:
            print(f"❌ Migration failed: {str(e)}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    migrate()
