# 🚀 Lab Request System v7.0.1 - DEPLOYMENT

**Production-ready csomag Railway-hez**

---

## ✅ Mi van ebben a csomagban?

### Backend
- ✅ Flask API (Python 3.9+)
- ✅ PostgreSQL support
- ✅ Automatikus migráció (v7.0.1 fix)
- ✅ JWT autentikáció
- ✅ File upload (max 50MB)
- ✅ PDF generálás

### Frontend
- ✅ React 18
- ✅ Tailwind CSS
- ✅ Axios HTTP client
- ✅ JWT token kezelés
- ✅ Modern UI

### v7.0 Új funkciók
- ✅ Kiértékelő modul (labor staff)
- ✅ Munkalista
- ✅ Split-screen eredmény kitöltő
- ✅ Fájl feltöltés eredményekhez
- ✅ Validálási workflow

---

## 🚂 Railway Deployment (AJÁNLOTT)

### 1. Projekt létrehozása Railway-en

```bash
# Railway CLI telepítése (ha még nincs)
# macOS/Linux:
curl -fsSL https://railway.app/install.sh | sh

# Windows:
# Töltsd le: https://github.com/railwayapp/cli/releases

# Login
railway login

# Új projekt
railway init

# Link GitHub repo (ha van)
railway link
```

### 2. Database hozzáadása

```bash
# PostgreSQL hozzáadása
railway add --database postgres
```

### 3. Környezeti változók beállítása

Railway Dashboard → Variables:

```
DATABASE_URL = [automatikusan generált]
SECRET_KEY = [generálj egy random stringet: openssl rand -hex 32]
FLASK_ENV = production
```

### 4. Deploy

```bash
# Git push
git add .
git commit -m "Initial deployment v7.0.1"
git push origin main

# Vagy Railway CLI:
railway up
```

### 5. **KRITIKUS: Database migráció futtatása**

#### Opció A: Railway Web Console (EGYSZERŰ)
```
Railway Dashboard
→ Postgres service
→ Query tab
→ Másold be:

ALTER TABLE "user" ADD COLUMN department_id INTEGER REFERENCES department(id);

CREATE TABLE test_result (
    id SERIAL PRIMARY KEY,
    lab_request_id INTEGER NOT NULL REFERENCES lab_request(id) ON DELETE CASCADE,
    test_type_id INTEGER NOT NULL REFERENCES test_type(id),
    result_text TEXT,
    attachment_filename VARCHAR(200),
    status VARCHAR(50) DEFAULT 'pending',
    completed_by_user_id INTEGER REFERENCES "user"(id),
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

→ Execute
```

#### Opció B: Railway CLI
```bash
railway connect

# PostgreSQL shell-ben:
ALTER TABLE "user" ADD COLUMN department_id INTEGER REFERENCES department(id);
CREATE TABLE test_result (...);  # lásd fent

\q
```

#### Opció C: Migration script (ha van psycopg2)
```bash
railway run python backend/migrate_v7_0_1.py
```

---

## 📋 Ellenőrzés

### 1. Backend működik?
```bash
curl https://your-app.up.railway.app/api/stats
```

### 2. Login működik?
```bash
curl -X POST https://your-app.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pannon.hu","password":"admin123"}'
```

**Sikeres válasz:**
```json
{
  "token": "eyJ...",
  "user": {
    "email": "admin@pannon.hu",
    "role": "super_admin"
  }
}
```

### 3. Database séma helyes?
```bash
railway connect
\d user           # department_id van?
\dt               # test_result létezik?
\q
```

---

## 🔐 Bejelentkezési adatok

| Email | Jelszó | Szerepkör |
|-------|--------|-----------|
| admin@pannon.hu | admin123 | Super Admin |
| labor@pannon.hu | labor123 | Labor Staff |
| admin@mol.hu | mol123 | Company Admin |
| user@mol.hu | mol123 | Company User |

**⚠️ FONTOS:** Változtasd meg ezeket production-ben!

---

## 📁 Fájl struktúra

```
lab-request-system-v7.0.1/
├── backend/
│   ├── app.py                    # Flask backend
│   ├── migrations.py             # Migráció definíciók
│   ├── migrate_v7_0_1.py         # Migration script (opcionális)
│   ├── requirements.txt          # Python dependencies
│   └── uploads/                  # File uploads (gitignore)
├── frontend/
│   ├── src/
│   │   ├── components/           # React komponensek
│   │   ├── context/              # Auth context
│   │   └── App.js
│   ├── package.json
│   └── public/
├── DEPLOYMENT_README.md          # Ez a fájl
├── CHANGELOG_v7.0.md             # Változások
└── railway.json                  # Railway config
```

---

## 🐛 Hibakeresés

### "column user.department_id does not exist"
→ Lásd 5. lépés: Database migráció futtatása

### "relation test_result does not exist"
→ Lásd 5. lépés: Database migráció futtatása

### "500 Internal Server Error" login-nál
→ Nézd a Railway Logs-ot: Deployments → View Logs

### "CORS error"
→ Ellenőrizd `backend/app.py`:
```python
CORS(app, origins=['https://your-frontend-url.app'])
```

---

## 🔄 Frissítés korábbi verzióról

### v6.8 → v7.0.1

**1. Backup (KÖTELEZŐ!)**
```bash
railway connect
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

**2. Kód frissítése**
```bash
# Töröld a régi fájlokat
rm -rf backend/* frontend/*

# Másold be az új fájlokat
cp -r lab-request-system-v7.0.1/* ./

# Git commit
git add .
git commit -m "Upgrade to v7.0.1"
git push origin main
```

**3. Migráció futtatása**
Lásd "5. Database migráció futtatása" fent.

---

## 🎯 Post-deployment checklist

- [ ] Database migráció lefutott
- [ ] Login működik (admin@pannon.hu)
- [ ] Dashboard betölt
- [ ] Laborkérés létrehozható
- [ ] Labor staff látja a "Munkalistám" menüpontot
- [ ] Fájl feltöltés működik
- [ ] PDF generálás működik
- [ ] Email értesítések működnek (ha konfigurált)

---

## 📞 Támogatás

Ha probléma van:

1. **Nézd a Railway Logs-ot:**
   - Deployments → Latest → View Logs

2. **Ellenőrizd a Database-t:**
   ```bash
   railway connect
   \dt  # Táblák listája
   \d user  # User tábla struktúra
   ```

3. **Migration script futtatása:**
   ```bash
   railway run python backend/migrate_v7_0_1.py
   ```

---

## 🚀 Production best practices

### Security
- [ ] SECRET_KEY cseréje
- [ ] Admin jelszavak cseréje
- [ ] HTTPS használata (Railway automatikus)
- [ ] CORS beállítása

### Performance
- [ ] Database connection pooling
- [ ] File upload limit ellenőrzése
- [ ] Memory limit beállítása

### Monitoring
- [ ] Railway Metrics figyelése
- [ ] Error logging beállítása
- [ ] Backup stratégia

---

**Verzió:** v7.0.1  
**Dátum:** 2024-11-26  
**Státusz:** ✅ Production-ready  
**Tesztelve:** Railway + PostgreSQL + Gunicorn
