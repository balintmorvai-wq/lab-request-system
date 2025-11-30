"""
Migration v8.1: Státusz-alapú értesítési események

Hozzáadja a státusz-specifikus event type-okat:
- status_to_draft
- status_to_pending_approval
- status_to_awaiting_shipment
- status_to_in_transit
- status_to_arrived_at_provider
- status_to_in_progress
- status_to_validation_pending
- status_to_completed

Használat:
    python migrate_v8_1.py
"""

import os
import sys
import sqlite3

def run_migration():
    """Státusz-alapú event type-ok hozzáadása"""
    
    # Database path
    db_path = 'instance/lab_requests.db'
    
    if not os.path.exists(db_path):
        print(f"❌ Database nem található: {db_path}")
        return False
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("🚀 v8.1 Migration - Státusz-alapú Események")
    print("=" * 60)
    
    # Státusz-alapú event type-ok
    status_events = [
        ('status_to_draft', 'Vázlat státusz', 
         'Kérés vázlat állapotba került', 
         '["request_number", "company_name", "requester_name", "new_status"]'),
        
        ('status_to_pending_approval', 'Jóváhagyásra vár', 
         'Kérés jóváhagyásra vár', 
         '["request_number", "company_name", "requester_name", "new_status"]'),
        
        ('status_to_awaiting_shipment', 'Szállításra vár', 
         'Kérés jóváhagyva, mintaszállításra vár', 
         '["request_number", "company_name", "requester_name", "new_status", "approved_by"]'),
        
        ('status_to_in_transit', 'Szállítás alatt', 
         'Minta szállítás megkezdődött', 
         '["request_number", "company_name", "requester_name", "new_status", "logistics_staff"]'),
        
        ('status_to_arrived_at_provider', 'Minta laborban', 
         'Minta megérkezett a laborba', 
         '["request_number", "company_name", "requester_name", "new_status", "received_by"]'),
        
        ('status_to_in_progress', 'Vizsgálat folyamatban', 
         'Laboratóriumi vizsgálatok megkezdődtek', 
         '["request_number", "company_name", "requester_name", "new_status", "lab_staff"]'),
        
        ('status_to_validation_pending', 'Validálásra vár', 
         'Eredmények validálásra várnak', 
         '["request_number", "company_name", "requester_name", "new_status", "lab_staff"]'),
        
        ('status_to_completed', 'Befejezett', 
         'Kérés befejezve, eredmények validálva', 
         '["request_number", "company_name", "requester_name", "new_status", "validated_by"]')
    ]
    
    print(f"\\n📝 {len(status_events)} státusz esemény hozzáadása...")
    
    added_count = 0
    existing_count = 0
    
    for event in status_events:
        event_key, event_name, description, variables = event
        
        # Ellenőrzés: létezik-e már
        cursor.execute("""
            SELECT COUNT(*) FROM notification_event_types 
            WHERE event_key = ?
        """, (event_key,))
        
        exists = cursor.fetchone()[0] > 0
        
        if exists:
            existing_count += 1
            print(f"  ⏭️  {event_name} - már létezik")
        else:
            cursor.execute("""
                INSERT INTO notification_event_types 
                (event_key, event_name, description, available_variables)
                VALUES (?, ?, ?, ?)
            """, event)
            added_count += 1
            print(f"  ✅ {event_name} - hozzáadva")
    
    conn.commit()
    conn.close()
    
    print(f"\\n✅ Migration befejezve!")
    print(f"   - Hozzáadva: {added_count} esemény")
    print(f"   - Már létezett: {existing_count} esemény")
    print("=" * 60)
    
    return True

if __name__ == '__main__':
    success = run_migration()
    sys.exit(0 if success else 1)
