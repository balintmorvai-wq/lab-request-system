"""
CLEANUP SCRIPT v8.2.5 - Régi notification rule-ok törlése

Töröl minden rule-t ami NINCS státusz-alapú event type-hoz rendelve.
Megtartja: status_to_draft, status_to_pending_approval, stb.
Törli: request_created, request_updated, stb. (régi event type-ok)
"""

import sqlite3
import sys

def cleanup_old_rules():
    """Régi notification rule-ok törlése"""
    
    # Csatlakozás adatbázishoz
    db_path = input("Adatbázis path (Enter = instance/lab_requests.db): ").strip()
    if not db_path:
        db_path = 'instance/lab_requests.db'
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("\n" + "="*60)
        print("🔍 JELENLEGI ÁLLAPOT ELLENŐRZÉSE")
        print("="*60)
        
        # Összes rule száma
        cursor.execute("SELECT COUNT(*) FROM notification_rules")
        total_rules = cursor.fetchone()[0]
        print(f"\n📊 Összes rule: {total_rules} db")
        
        # Státusz-alapú rule-ok száma
        cursor.execute("""
            SELECT COUNT(*) 
            FROM notification_rules nr
            JOIN notification_event_types net ON nr.event_type_id = net.id
            WHERE net.event_key LIKE 'status_to_%'
        """)
        status_rules = cursor.fetchone()[0]
        print(f"✅ Státusz-alapú rule-ok: {status_rules} db (MEGMARAD)")
        
        # Régi rule-ok száma
        old_rules = total_rules - status_rules
        print(f"❌ Régi rule-ok: {old_rules} db (TÖRLŐDIK)")
        
        if old_rules == 0:
            print("\n✅ Nincs mit törölni! Minden rule státusz-alapú!")
            conn.close()
            return
        
        # Listázzuk a régi event type-okat
        print("\n📋 Régi event type-ok (törlődnek):")
        cursor.execute("""
            SELECT DISTINCT net.event_key, net.event_name, COUNT(nr.id) as rule_count
            FROM notification_event_types net
            LEFT JOIN notification_rules nr ON net.id = nr.event_type_id
            WHERE net.event_key NOT LIKE 'status_to_%'
            GROUP BY net.id, net.event_key, net.event_name
            HAVING rule_count > 0
            ORDER BY rule_count DESC
        """)
        
        old_event_types = cursor.fetchall()
        for event_key, event_name, count in old_event_types:
            print(f"  • {event_name} ({event_key}): {count} rule")
        
        # Megerősítés
        print("\n" + "="*60)
        print("⚠️  FIGYELEM!")
        print("="*60)
        print(f"\nEz a művelet TÖRÖLNI FOG {old_rules} régi notification rule-t!")
        print(f"MEGMARAD {status_rules} státusz-alapú rule!")
        print("\nEz a művelet NEM VISSZAVONHATÓ!")
        
        confirm = input("\nBiztosan folytatod? (írj be: TOROL): ").strip()
        
        if confirm != "TOROL":
            print("\n❌ Művelet megszakítva!")
            conn.close()
            return
        
        # TÖRLÉS
        print("\n" + "="*60)
        print("🗑️  RÉGI RULE-OK TÖRLÉSE")
        print("="*60)
        
        cursor.execute("""
            DELETE FROM notification_rules
            WHERE event_type_id IN (
                SELECT id 
                FROM notification_event_types 
                WHERE event_key NOT LIKE 'status_to_%'
            )
        """)
        
        deleted_count = cursor.rowcount
        conn.commit()
        
        print(f"\n✅ Törölve: {deleted_count} régi rule!")
        
        # Végső állapot
        cursor.execute("SELECT COUNT(*) FROM notification_rules")
        final_rules = cursor.fetchone()[0]
        
        print("\n" + "="*60)
        print("📊 VÉGSŐ ÁLLAPOT")
        print("="*60)
        print(f"\nÖsszes rule: {final_rules} db (csak státusz-alapúak)")
        
        # Státuszok szerinti bontás
        print("\n📋 Rule-ok státuszonként:")
        cursor.execute("""
            SELECT net.event_name, COUNT(nr.id) as rule_count
            FROM notification_event_types net
            LEFT JOIN notification_rules nr ON net.id = nr.event_type_id
            WHERE net.event_key LIKE 'status_to_%'
            GROUP BY net.id, net.event_name
            ORDER BY net.event_name
        """)
        
        for event_name, count in cursor.fetchall():
            print(f"  • {event_name}: {count} rule")
        
        print("\n✅ CLEANUP SIKERES! 🎉")
        print("\nMost frissítsd az Értesítések oldalt, és csak a státusz-alapú rule-okat fogod látni!")
        
        conn.close()
        
    except sqlite3.Error as e:
        print(f"\n❌ Adatbázis hiba: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Hiba: {e}")
        sys.exit(1)

if __name__ == '__main__':
    print("="*60)
    print("🧹 NOTIFICATION RULES CLEANUP v8.2.5")
    print("="*60)
    print("\nEz a script törli a régi notification rule-okat,")
    print("és csak a státusz-alapú (status_to_*) rule-okat hagyja meg.\n")
    
    cleanup_old_rules()
