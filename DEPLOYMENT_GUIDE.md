# 🚀 TELJES DEPLOYMENT ÚTMUTATÓ - Railway

## ELŐFELTÉTELEK CHECKLIST:

✅ GitHub fiók (https://github.com)
✅ Git telepítve a gépeden
✅ lab-request-system-v6.6 mappa kicsomagolva
✅ Bankkártya (Railway $5 credit, utána fizetős)

---

# LÉPÉS 1: GIT REPOSITORY LÉTREHOZÁSA

## 1.1 Lokális Git repo

```powershell
# Nyisd meg a PowerShell-t
cd C:\Users\[FELHASZNÁLÓ]\Downloads\lab-request-system-v6.6

# Git init
git init
git add .
git commit -m "v6.6 - Production ready"
```

## 1.2 GitHub repository

1. Menj: https://github.com/new
2. Repository name: `lab-request-system`
3. Private vagy Public (válaszd: **Private**)
4. **NE** jelöld be: "Add a README file"
5. Kattints: **Create repository**

## 1.3 Push GitHub-ra

A GitHub oldalon látod a parancsokat:

```powershell
git remote add origin https://github.com/[USERNAME]/lab-request-system.git
git branch -M main
git push -u origin main
```

✅ Refresh GitHub → Látod a fájlokat!

---

# LÉPÉS 2: RAILWAY REGISZTRÁCIÓ

## 2.1 Railway fiók

1. Menj: https://railway.app
2. Kattints: **Login** → **Login with GitHub**
3. GitHub engedélyezés
4. **Start a New Project** → átugrod

## 2.2 Bankkártya hozzáadás (szükséges)

1. Railway Dashboard → Settings (bal lent)
2. Billing → Add Payment Method
3. Kártya adatok megadása
4. $5 ingyenes credit jóváírva! ✅

---

# LÉPÉS 3: BACKEND DEPLOY (PostgreSQL + Flask)

## 3.1 New Project

1. Railway Dashboard → **New Project**
2. **Deploy from GitHub repo**
3. Válaszd: `lab-request-system` repo
4. **Add variables** → Később!

## 3.2 Backend Service konfigurálás

1. Kattints a service-re (pl. "lab-request-system")
2. Settings tab:
   - **Root Directory:** `backend`
   - **Start Command:** (hagyd üresen, Procfile használja)
3. Variables tab → Add Variable:

```
PORT=5000
SECRET_KEY=your-very-secret-key-change-this-to-random-string
DATABASE_URL=(később töltődik)
FRONTEND_URL=(később töltődik)
DEBUG=False
```

## 3.3 PostgreSQL hozzáadása

1. Ugyanabban a Project-ben → **New** → **Database** → **Add PostgreSQL**
2. Automatikusan létrejön a `DATABASE_URL` változó! ✅
3. Backend Service → Variables → ellenőrizd, hogy van `DATABASE_URL`

## 3.4 Deploy indítás

1. Backend Service → Deployments tab
2. **Deploy** gomb (vagy automatikusan elindul)
3. Várd meg: "Success" ✅ (2-3 perc)

## 3.5 Backend URL másolása

1. Backend Service → Settings → Domains
2. Kattints: **Generate Domain**
3. Kapsz: `your-backend-name.railway.app`
4. **MÁSOLD KI!** → pl. `https://lab-request-backend-production.up.railway.app`

## 3.6 Tesztelés

Böngésző → `https://your-backend.railway.app/api/stats`

**Ha látod:**
```json
{
  "total_requests": 0,
  "pending_requests": 0,
  ...
}
```
✅ **BACKEND MŰKÖDIK!**

---

# LÉPÉS 4: FRONTEND DEPLOY (React on Vercel)

**Miért Vercel?** Ingyenes, gyors, React-re optimalizált!

## 4.1 Vercel regisztráció

1. Menj: https://vercel.com
2. **Sign Up** → **Continue with GitHub**
3. GitHub engedélyezés

## 4.2 Import projekt

1. Vercel Dashboard → **Add New** → **Project**
2. Import Git Repository → Válaszd: `lab-request-system`
3. **Import**

## 4.3 Build beállítások

**Configure Project:**
- **Framework Preset:** Create React App
- **Root Directory:** `frontend` ← **FONTOS!**
- **Build Command:** `npm run build`
- **Output Directory:** `build`

**Environment Variables:**
- Name: `REACT_APP_API_URL`
- Value: `https://your-backend.railway.app/api` ← Illeszd be a Railway backend URL-t!

## 4.4 Deploy

1. Kattints: **Deploy**
2. Várd meg: "Congratulations!" ✅ (2-3 perc)
3. Kapsz egy URL-t: `https://your-app.vercel.app`

## 4.5 CORS javítás (Railway backend)

**Probléma:** Frontend nem tud csatlakozni backend-hez (CORS error)

**Megoldás:**

1. Railway → Backend Service → Variables
2. Add Variable:
   - Name: `FRONTEND_URL`
   - Value: `https://your-app.vercel.app` ← Vercel URL!
3. Redeploy backend: Deployments → ... → Redeploy

---

# LÉPÉS 5: ELSŐ BELÉPÉS ÉS TESZTELÉS

## 5.1 Nyisd meg az alkalmazást

URL: `https://your-app.vercel.app`

## 5.2 Első admin bejelentkezés

**Alapértelmezett admin:**
- Email: `admin@pannon.hu`
- Jelszó: `admin123`

**Ha "Invalid credentials":**
→ Az adatbázis üres! A backend `init_db()` nem futott le.

**Megoldás:**
1. Railway → Backend Service → Deployments
2. View Logs
3. Nézd meg, hogy lefutott-e az `init_db()`
4. Ha nem → Redeploy

## 5.3 Tesztelés checklist

```
✅ Login működik (admin@pannon.hu)
✅ Dashboard látszik
✅ Új felhasználó létrehozása
✅ Új laborkérés létrehozása
✅ Kategóriák kezelése
✅ Vizsgálattípusok kezelése
✅ PDF export
✅ Értesítések
```

---

# LÉPÉS 6: CUSTOM DOMAIN (OPCIONÁLIS)

## 6.1 Domain vásárlás

Példa: **Namecheap.com**
- Domain: `laborkeres.hu` → ~3000 Ft/év

## 6.2 Vercel domain beállítás

1. Vercel Project → Settings → Domains
2. Add Domain: `laborkeres.hu`
3. Kapsz DNS beállításokat:

```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

## 6.3 Namecheap DNS

1. Namecheap → Domain List → Manage
2. Advanced DNS
3. Add Record:
   - A Record: `@` → `76.76.21.21`
   - CNAME: `www` → `cname.vercel-dns.com`
4. Save

**Várakozás:** 10-30 perc DNS propagáció

## 6.4 HTTPS automatikus! ✅

Vercel automatikusan generál SSL tanúsítványt!

---

# LÉPÉS 7: TOVÁBBI KONFIGURÁCIÓK

## 7.1 DejaVu font (PDF ékezetek)

**Railway Backend:**

1. Backend Service → Settings → Add Buildpack
2. Nincs ilyen? → Dockerfile szükséges (advanced)

**Egyszerűbb megoldás:** Ellenőrizd, hogy Railway Ubuntu alapú → DejaVu alapból telepítve!

## 7.2 Környezeti változók összefoglalása

**Railway Backend:**
```
PORT=5000
SECRET_KEY=random-secret-key-here
DATABASE_URL=(auto - PostgreSQL)
FRONTEND_URL=https://your-app.vercel.app
DEBUG=False
```

**Vercel Frontend:**
```
REACT_APP_API_URL=https://your-backend.railway.app/api
```

---

# 📊 KÖLTSÉGEK

## Railway (Backend + Database)

**Starter Plan:** $5/hó
- 500 óra/hó végrehajtási idő
- 512 MB RAM
- PostgreSQL database (1 GB)

**Ha túlléped:** $10/hó (Hobby Plan)

## Vercel (Frontend)

**Hobby Plan:** **INGYENES!** ✅
- Unlimited deployments
- Automatic HTTPS
- Serverless Functions

**Összesen:** ~$5-10/hó

---

# 🔒 BIZTONSÁGI ELLENŐRZŐLISTA

```
✅ SECRET_KEY megváltoztatva (Railway)
✅ CORS FRONTEND_URL beállítva
✅ DEBUG=False production-ben
✅ .env fájlok nem commitolva (.gitignore)
✅ Alapértelmezett admin jelszó megváltoztatva
✅ PostgreSQL SSL connection (Railway auto)
✅ HTTPS mindenhol (Vercel/Railway auto)
```

---

# 🆘 HIBAELHÁRÍTÁS

## "502 Bad Gateway" - Backend

**Ok:** Backend nem indult el
**Megoldás:**
1. Railway → Backend → Logs
2. Nézd meg a hibát
3. Gyakori: `requirements.txt` hiba → ellenőrizd verziók

## "Network Error" - Frontend

**Ok:** CORS vagy rossz API URL
**Megoldás:**
1. Ellenőrizd: `REACT_APP_API_URL` helyes?
2. Ellenőrizd: `FRONTEND_URL` Railway-ben helyes?
3. Redeploy backend

## "Invalid credentials" - Login

**Ok:** Adatbázis üres
**Megoldás:**
1. Railway → Backend → Logs
2. Keresd: "✅ Példa felhasználók létrehozva"
3. Ha nincs → Redeploy

## PDF ékezetek nem jók

**Ok:** DejaVu font hiányzik
**Megoldás:**
1. Railway Logs → Keresd: "DejaVu" error
2. Ha van → Font path frissítés szükséges backend-ben

---

# ✅ SIKERES DEPLOY CHECKLIST

```
✅ GitHub repository létrehozva
✅ Railway backend deployed
✅ PostgreSQL database csatlakoztatva
✅ Vercel frontend deployed
✅ CORS beállítva (FRONTEND_URL)
✅ Environment variables beállítva
✅ Login működik
✅ Új kérés létrehozható
✅ PDF letölthető
✅ (Opcionális) Custom domain beállítva
```

---

# 🎉 KÉSZ VAGY!

**Alkalmazás URL:** `https://your-app.vercel.app`

**Következő lépések:**
1. Változtasd meg az admin jelszót
2. Hozz létre kategóriákat
3. Add hozzá a vizsgálattípusokat
4. Hívd meg a felhasználókat!

---

**Verzió:** v6.6 Production
**Utolsó frissítés:** 2024-11-22
**Nehézség:** ⭐⭐ Közepes
**Idő:** ~30-45 perc
