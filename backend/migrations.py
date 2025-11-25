"""
Migration Framework for Lab Request System
==========================================

This module provides a simple, maintainable migration system for database schema changes.

Usage:
------
Add new migrations to the MIGRATIONS list below. Each migration is a dictionary with:
- table: Table name to modify
- column: Column name to add
- definition: SQL column definition (e.g., "VARCHAR(500)", "INTEGER DEFAULT 0")
- description: Human-readable description

The auto_migrate() function will automatically apply all pending migrations.

Example:
--------
MIGRATIONS = [
    {
        'table': 'lab_request',
        'column': 'priority_level',
        'definition': 'INTEGER DEFAULT 0',
        'description': 'Priority level (0-5)'
    },
    {
        'table': 'user',
        'column': 'department_id',
        'definition': 'INTEGER',
        'description': 'User department reference'
    }
]
"""

# ============================================================================
# MIGRATION DEFINITIONS
# ============================================================================
# Add new migrations here - they will be applied automatically!

MIGRATIONS = [
    # v6.6 ENHANCED v2 - Sampling details
    {
        'table': 'lab_request',
        'column': 'sampling_address',
        'definition': 'VARCHAR(500)',
        'description': 'Exact sampling address'
    },
    {
        'table': 'lab_request',
        'column': 'contact_person',
        'definition': 'VARCHAR(200)',
        'description': 'Contact person for sampling'
    },
    {
        'table': 'lab_request',
        'column': 'contact_phone',
        'definition': 'VARCHAR(50)',
        'description': 'Contact phone number'
    },
    {
        'table': 'department',
        'column': 'sample_pickup_address',
        'definition': 'VARCHAR(500)',
        'description': 'Sample pickup address'
    },
    {
        'table': 'department',
        'column': 'sample_pickup_contact',
        'definition': 'VARCHAR(200)',
        'description': 'Sample pickup contact person'
    },
    
    # ============================================================================
    # v6.7 MIGRATIONS - TestType új oszlopok
    # ============================================================================
    {
        'table': 'test_type',
        'column': 'standard',
        'definition': 'VARCHAR(200)',
        'description': 'Szabvány (pl. MSZ EN ISO 3104)'
    },
    {
        'table': 'test_type',
        'column': 'device',
        'definition': 'VARCHAR(200)',
        'description': 'Készülék'
    },
    {
        'table': 'test_type',
        'column': 'cost_price',
        'definition': 'FLOAT DEFAULT 0',
        'description': 'Önköltség (Ft/minta)'
    },
    {
        'table': 'test_type',
        'column': 'measurement_time',
        'definition': 'FLOAT DEFAULT 0',
        'description': 'Mérési idő (óra)'
    },
    {
        'table': 'test_type',
        'column': 'sample_prep_time',
        'definition': 'FLOAT DEFAULT 0',
        'description': 'Mintaelőkészítési idő (óra)'
    },
    {
        'table': 'test_type',
        'column': 'evaluation_time',
        'definition': 'FLOAT DEFAULT 0',
        'description': 'Kiértékelés (óra)'
    },
    {
        'table': 'test_type',
        'column': 'turnaround_time',
        'definition': 'FLOAT DEFAULT 0',
        'description': 'Átfutási idő (óra)'
    },
    {
        'table': 'test_type',
        'column': 'sample_quantity',
        'definition': 'VARCHAR(100)',
        'description': 'Minta mennyiség (szabad szöveg, pl. 50-100 mg)'
    },
    {
        'table': 'test_type',
        'column': 'sample_prep_required',
        'definition': 'BOOLEAN DEFAULT FALSE',
        'description': 'Mintaelőkészítés szükséges (igen/nem)'
    },
    {
        'table': 'test_type',
        'column': 'sample_prep_description',
        'definition': 'VARCHAR(200)',
        'description': 'Mintaelőkészítés típusa (pl. Szárítás, mosás)'
    },
    {
        'table': 'test_type',
        'column': 'hazard_level',
        'definition': 'VARCHAR(200)',
        'description': 'Veszélyesség (szabad szöveg)'
    },
    
    # ============================================================================
    # v6.7 MIGRATIONS - LabRequest új oszlopok
    # ============================================================================
    {
        'table': 'lab_request',
        'column': 'request_number',
        'definition': 'VARCHAR(50)',
        'description': 'Generált egyedi azonosító (pl. MOL-20241124-001)'
    },
    {
        'table': 'lab_request',
        'column': 'internal_id',
        'definition': 'VARCHAR(100)',
        'description': 'Céges belső azonosító'
    },
    {
        'table': 'lab_request',
        'column': 'sampling_datetime',
        'definition': 'TIMESTAMP',
        'description': 'Mintavétel időpontja (dátum + óra:perc)'
    },
    {
        'table': 'lab_request',
        'column': 'logistics_type',
        'definition': "VARCHAR(50) DEFAULT 'sender'",
        'description': 'Logisztika típusa (sender/provider)'
    },
    {
        'table': 'lab_request',
        'column': 'shipping_address',
        'definition': 'VARCHAR(500)',
        'description': 'Szállítási cím (ha szolgáltató szállít)'
    },
    
    # ============================================================================
    # FUTURE MIGRATIONS - Add below this line
    # ============================================================================
]

# ============================================================================
# MIGRATION ENGINE
# ============================================================================

def apply_migrations(db, inspector=None):
    """
    Apply all pending migrations from MIGRATIONS list
    
    Args:
        db: SQLAlchemy database instance
        inspector: Optional SQLAlchemy inspector (will create if None)
    
    Returns:
        tuple: (success: bool, applied_migrations: list, errors: list)
    """
    from sqlalchemy import inspect
    
    if inspector is None:
        inspector = inspect(db.engine)
    
    applied = []
    errors = []
    
    # Group migrations by table for efficient checking
    tables_cache = {}
    
    for migration in MIGRATIONS:
        table = migration['table']
        column = migration['column']
        definition = migration['definition']
        description = migration['description']
        
        try:
            # Get table columns (cached)
            if table not in tables_cache:
                try:
                    tables_cache[table] = [col['name'] for col in inspector.get_columns(table)]
                except Exception as e:
                    errors.append(f"❌ Table '{table}' not found: {e}")
                    continue
            
            columns = tables_cache[table]
            
            # Check if migration needed
            if column not in columns:
                # Apply migration
                sql = f"ALTER TABLE {table} ADD COLUMN {column} {definition}"
                db.session.execute(db.text(sql))
                
                applied.append({
                    'table': table,
                    'column': column,
                    'description': description
                })
                
                print(f"  ✅ Applied: {table}.{column} - {description}")
            else:
                print(f"  ⏭️  Skipped: {table}.{column} (already exists)")
                
        except Exception as e:
            error_msg = f"❌ Failed to add {table}.{column}: {str(e)}"
            errors.append(error_msg)
            print(f"  {error_msg}")
    
    # Commit all changes at once
    if applied:
        try:
            db.session.commit()
            print(f"\n✅ Successfully applied {len(applied)} migrations!")
        except Exception as e:
            db.session.rollback()
            errors.append(f"❌ Commit failed: {str(e)}")
            return False, applied, errors
    
    return len(errors) == 0, applied, errors


def get_migration_status(inspector, table_name):
    """
    Get status of all migrations for a specific table
    
    Returns:
        dict: {column_name: {'exists': bool, 'description': str}}
    """
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    
    status = {}
    for migration in MIGRATIONS:
        if migration['table'] == table_name:
            status[migration['column']] = {
                'exists': migration['column'] in columns,
                'description': migration['description']
            }
    
    return status


# ============================================================================
# USAGE EXAMPLES
# ============================================================================

if __name__ == '__main__':
    """
    Example usage and testing
    """
    print("Migration Framework - Example Usage")
    print("=" * 60)
    
    print("\nCurrent migrations defined:")
    for i, mig in enumerate(MIGRATIONS, 1):
        print(f"{i}. {mig['table']}.{mig['column']}")
        print(f"   Type: {mig['definition']}")
        print(f"   Description: {mig['description']}")
    
    print("\n" + "=" * 60)
    print("\nTo apply migrations, call:")
    print("  from migrations import apply_migrations")
    print("  success, applied, errors = apply_migrations(db)")
    print("\nTo add new migration:")
    print("  Add entry to MIGRATIONS list above")
    print("  Push to Railway")
    print("  Done! (auto-applies on startup)")
