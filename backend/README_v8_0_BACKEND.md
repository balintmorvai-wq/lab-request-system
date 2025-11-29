# v8.0 Backend Csomag - Gyors Telepítés 🚀

**Tartalom:**
- ✅ migrate_v8_0.py - Migration script
- ✅ notification_service.py - Központi service (JAVÍTOTT import)
- ✅ app.py - Backend API (v8.0 endpoint-okkal)
- ✅ setup_v8_0.ps1 - Automatikus telepítő script
- ✅ CHANGELOG_v8.0_BACKEND.md - Dokumentáció

---

## 📦 **TELEPÍTÉS (2 LEHETŐSÉG)**

### **OPCIÓ 1: Automatikus (AJÁNLOTT)**

```powershell
# 1. Csomagold ki a zip-et a backend mappába:
#    C:\lab-request-system-v6.6\backend\

# 2. PowerShell-ben lépj be:
cd C:\lab-request-system-v6.6\backend

# 3. Futtasd a setup scriptet:
.\setup_v8_0.ps1

# 4. Várj ~1-2 percet
# ✅ Kész!
```

**A script automatikusan:**
- ✅ Ellenőrzi a Python-t
- ✅ Telepíti a hiányzó modulokat (qrcode, pillow)
- ✅ Létrehozza az instance mappát
- ✅ Inicializálja az adatbázist
- ✅ Lefuttatja a v8.0 migration-t

---

### **OPCIÓ 2: Manuális**

```powershell
# 1. Backend mappa:
cd C:\lab-request-system-v6.6\backend

# 2. Függőségek:
python -m pip install qrcode pillow

# 3. Instance mappa:
New-Item -ItemType Directory -Path instance -Force

# 4. Adatbázis:
python -c "from app import app, db; app.app_context().push(); db.create_all(); print('OK')"

# 5. Migration:
python migrate_v8_0.py
```

---

## ✅ **ELLENŐRZÉS**

Migration sikeres, ha látod:

```
✅ v8.0 Migration sikeresen lefutott!

📊 Létrehozott táblák:
  • notification_event_types (7 eseménytípus)
  • notification_templates (5 email sablon)
  • notification_rules (14 alapértelmezett szabály)
  • notifications (új struktúra)
  • smtp_settings (később konfigurálható)
```

---

## 🚂 **KÖVETKEZŐ LÉPÉSEK**

### **1. Git Commit & Push:**

```powershell
git add migrate_v8_0.py notification_service.py app.py CHANGELOG_v8_0_BACKEND.md
git commit -m "v8.0: Abstract Notification System - Backend"
git push railway main
```

### **2. Railway Production Migration:**

```powershell
railway run python migrate_v8_0.py
```

### **3. Frontend Deploy:**

```powershell
cd ..\frontend
git add src/components/NotificationBell.js src/components/NotificationManagement.js src/App.js src/components/Layout.js
git commit -m "v8.0: Notification UI"
git push origin main
```

---

## 🐛 **HIBAELHÁRÍTÁS**

### **"setup_v8_0.ps1 cannot be loaded"**

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\setup_v8_0.ps1
```

### **"No module named 'qrcode'"**

```powershell
python -m pip install qrcode pillow
```

### **"Table already exists"**

```powershell
# Töröld az adatbázist és kezdd újra:
Remove-Item instance\lab_requests.db
python -c "from app import app, db; app.app_context().push(); db.create_all()"
python migrate_v8_0.py
```

---

## 📋 **FÁJLOK LEÍRÁSA**

**migrate_v8_0.py** (~580 sor)
- Törli a régi notifications táblát
- Létrehoz 5 új táblát
- Beszúr 7 eseménytípust
- Beszúr 5 email sablont
- Beszúr 14 alapértelmezett szabályt

**notification_service.py** (~250 sor)
- NotificationService osztály
- notify() - központi API
- Template renderelés
- User notification CRUD

**app.py** (módosítva)
- Régi Notification model TÖRÖLVE
- create_notification() TÖRÖLVE
- NotificationService import HOZZÁADVA
- 10+ új API endpoint
- ~19 notification hívás lecserélve

**setup_v8_0.ps1** (~150 sor)
- Automatikus telepítő PowerShell script
- Ellenőrzi a környezetet
- Telepíti a függőségeket
- Inicializálja az adatbázist
- Futtatja a migration-t

---

## 🎯 **TÁMOGATÁS**

**Ha elakadsz:**
1. Futtasd újra: `.\setup_v8_0.ps1`
2. Ellenőrizd a hibaüzeneteket
3. Küldd el a teljes kimenetet Claude-nak

**Dokumentáció:**
- CHANGELOG_v8.0_BACKEND.md - Teljes változásnapló
- CHANGELOG_v8.0_COMPLETE.md - Átfogó dokumentáció (frontend is)

---

**Sikeres telepítést! 🚀**
