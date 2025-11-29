"""
v7.0.27 Migration: submitted → arrived_at_provider átnevezés

Ez egy OPCIONÁLIS data migration!
Nincs szükség schema változásra, csak a régi submitted státuszú
kéréseket nevezi át arrived_at_provider-re.

Ha nem futtatod:
- Régi submitted kérések továbbra is működnek (legacy support)
- Új kérések automatikusan arrived_at_provider státuszt kapnak

Ha futtatod:
- Minden submitted kérés → arrived_at_provider
- Egységes adatbázis (ajánlott)
"""

import os
import sys

# Railway: Add parent directory to sys.path to import app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app, db, LabRequest

def migrate():
    """Migrate submitted status to arrived_at_provider"""
    
    with app.app_context():
        print("\n" + "="*60)
        print("v7.0.27 Migration: submitted → arrived_at_provider")
        print("="*60 + "\n")
        
        # Count submitted requests
        submitted_count = LabRequest.query.filter_by(status='submitted').count()
        
        if submitted_count == 0:
            print("✅ Nincs submitted státuszú kérés, migration nem szükséges!")
            return
        
        print(f"📊 Talált submitted státuszú kérések: {submitted_count}")
        print("\nA következő kérések kerülnek átnevezésre:")
        
        submitted_requests = LabRequest.query.filter_by(status='submitted').all()
        for req in submitted_requests:
            print(f"  - {req.request_number or req.sample_id} (ID: {req.id})")
        
        # Confirm
        confirm = input(f"\n⚠️  Biztosan átnevezed mind a {submitted_count} kérést? (yes/no): ")
        
        if confirm.lower() != 'yes':
            print("❌ Migration megszakítva!")
            return
        
        # Migrate
        print("\n🔄 Migration futtatása...")
        
        for req in submitted_requests:
            req.status = 'arrived_at_provider'
            print(f"  ✅ {req.request_number or req.sample_id}: submitted → arrived_at_provider")
        
        db.session.commit()
        
        print(f"\n✅ Migration sikeres! {submitted_count} kérés frissítve.")
        print("\n" + "="*60 + "\n")

if __name__ == '__main__':
    migrate()
