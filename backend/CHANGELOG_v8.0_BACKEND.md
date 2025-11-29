# v8.0 Backend - Abstract Notification System

## 🔧 Változások

### **Új fájlok:**
1. `migrate_v8_0.py` - Migration script
2. `notification_service.py` - Központi notification service

### **Módosított fájlok:**
1. `app.py`:
   - Notification model ELTÁVOLÍTVA
   - create_notification() függvény ELTÁVOLÍTVA
   - NotificationService import HOZZÁADVA
   - Összes notification hívás lecserélve NotificationService.notify()-ra
   - 10+ új API endpoint (user + admin)

---

## 🗄️ Adatbázis

### **Új táblák:**
1. `notification_event_types` - Eseménytípusok (7 db default)
2. `notification_templates` - Email sablonok (5 db default)
3. `notification_rules` - Értesítési szabályok (role-alapú)
4. `notifications` - ÚJ struktúra (user notifikációk)
5. `smtp_settings` - SMTP konfig (később)

### **Törölt táblák:**
- `notifications` (régi struktúra)

---

## 🚀 Migration Futtatás

```bash
cd backend
python migrate_v8_0.py
```

**Kimenet:**
```
🚀 v8.0 Migration - Abstract Notification System
============================================================

📦 1/6: Régi notifications tábla eldobása...
✅ Régi notifications tábla törölve

📦 2/6: notification_event_types tábla létrehozása...
✅ 7 eseménytípus létrehozva

📦 3/6: notification_templates tábla létrehozása...
✅ 5 email sablon létrehozva

📦 4/6: notification_rules tábla létrehozása...
✅ XX alapértelmezett szabály létrehozva

📦 5/6: Új notifications tábla létrehozása...
✅ Új notifications tábla létrehozva indexekkel

📦 6/6: smtp_settings tábla létrehozása...
✅ smtp_settings tábla létrehozva

============================================================
✅ v8.0 Migration sikeresen lefutott!
```

---

## 🔔 NotificationService API

### **Használat:**

```python
from notification_service import NotificationService

# Státuszváltozás értesítés
NotificationService.notify(
    event_key='status_change',
    request_id=123,
    event_data={
        'request_number': 'LAB-2024-001',
        'old_status': 'draft',
        'new_status': 'pending_approval',
        'company_name': 'MOL Nyrt.',
        'requester_name': 'Kiss János'
    }
)

# Új kérés értesítés
NotificationService.notify(
    event_key='new_request',
    request_id=456,
    event_data={
        'request_number': 'LAB-2024-002',
        'company_name': 'Pannon Egyetem',
        'requester_name': 'Nagy Anna',
        'category': 'Olaj analízis'
    }
)

# Jóváhagyás értesítés
NotificationService.notify(
    event_key='request_approved',
    request_id=789,
    event_data={
        'request_number': 'LAB-2024-003',
        'approver_name': 'Kovács Péter',
        'company_name': 'MOL Nyrt.'
    }
)
```

### **Események:**
- `status_change` - Státuszváltozás
- `new_request` - Új kérés
- `request_approved` - Jóváhagyás
- `request_rejected` - Elutasítás
- `results_uploaded` - Eredmények feltöltve
- `deadline_approaching` - Határidő közeledik (később)
- `comment_added` - Megjegyzés (később)

---

## 📡 API Endpoints

### **User Endpoints:**
```
GET    /api/notifications              - Notifikációk listája
       ?unread_only=true               - Csak olvasatlanok
       ?limit=50                        - Max. darabszám

PUT    /api/notifications/:id/read     - Olvasottnak jelölés
PUT    /api/notifications/read-all     - Összes olvasottnak
DELETE /api/notifications/:id          - Törlés
```

### **Admin Endpoints (super_admin):**
```
# Event Types
GET    /api/admin/notification-event-types

# Rules
GET    /api/admin/notification-rules
POST   /api/admin/notification-rules
PUT    /api/admin/notification-rules/:id
DELETE /api/admin/notification-rules/:id

# Templates
GET    /api/admin/notification-templates
POST   /api/admin/notification-templates
PUT    /api/admin/notification-templates/:id
DELETE /api/admin/notification-templates/:id
```

---

## 📋 Default Notification Rules

**Státuszváltozás** - Minden szerepkör:
- ✅ In-app enabled
- ❌ Email disabled (később)

**Új kérés** - super_admin, labor_staff:
- ✅ In-app enabled
- ❌ Email disabled

**Jóváhagyás** - company_admin, company_user:
- ✅ In-app enabled
- ❌ Email disabled

**Elutasítás** - company_admin, company_user:
- ✅ In-app enabled
- ❌ Email disabled

**Eredmények feltöltve** - company_admin, company_user:
- ✅ In-app enabled
- ❌ Email disabled

---

## 🎯 Következő Lépések

1. ✅ Backend migration és service
2. ⏳ Frontend NotificationBell újraírás
3. ⏳ Frontend Admin konfigurátor UI
4. ⏳ SMTP beállítások UI
5. ⏳ Email küldés implementáció (Flask-Mail)

---

**v8.0 Backend KÉSZ!** 🎉
