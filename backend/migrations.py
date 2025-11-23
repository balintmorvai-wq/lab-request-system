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
    # FUTURE MIGRATIONS - Add below this line
    # ============================================================================
    
    # Example future migration (commented out):
    # {
    #     'table': 'lab_request',
    #     'column': 'estimated_completion',
    #     'definition': 'TIMESTAMP',
    #     'description': 'Estimated completion date'
    # },
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
