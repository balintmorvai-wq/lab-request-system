# GYORS PUSH ÚTMUTATÓ - v8.0 🚀

**5 parancs = teljes projekt push-olva!**

---

## 📦 **1. ZIP KIBONTÁS**

```
Windows Explorer:
- Jobb klikk: lab-request-system-v8.0.zip
- "Extract All..."
- Cél: C:\Projects\lab-request-system-v8.0
```

**VAGY PowerShell:**
```powershell
Expand-Archive -Path lab-request-system-v8.0.zip -DestinationPath C:\Projects\
```

---

## 🔧 **2. BACKEND GYORS SETUP**

```powershell
cd C:\Projects\lab-request-system-v8.0\backend

# Modulok (helyi teszt):
python -m pip install qrcode pillow

# Adatbázis + Migration:
New-Item -ItemType Directory -Path instance -Force
python -c "from app import app, db; app.app_context().push(); db.create_all(); print('OK')"
python migrate_v8_0.py
# → y (enter)
```

**VÁRJ:** `✅ v8.0 Migration sikeresen lefutott!`

---

## 📤 **3. GIT PUSH**

### **Ha ÚJ projekt (nincs még git repo):**

```powershell
# Projekt gyökér:
cd C:\Projects\lab-request-system-v8.0

git init
git branch -M main
git add .
git commit -m "v8.0: Complete Lab Request System"

# Backend → Railway:
git remote add railway YOUR_RAILWAY_GIT_URL
git push railway main

# Frontend → GitHub (majd Netlify):
git remote add origin YOUR_GITHUB_REPO_URL
git push origin main
```

---

### **Ha LÉTEZŐ projekt (van git repo, csak update-eled):**

```powershell
# 1. BACKUP (biztonsági mentés):
cd C:\lab-request-system-v6.6
Copy-Item -Recurse . C:\backup-v6.6

# 2. REPLACE (fájlok cseréje):
# Törölj MINDENT kivéve .git mappát:
Get-ChildItem -Exclude .git | Remove-Item -Recurse -Force

# Másold be az új fájlokat:
Copy-Item C:\Projects\lab-request-system-v8.0\* -Destination . -Recurse -Force

# 3. COMMIT + PUSH:
git add .
git commit -m "v8.0: Complete rewrite with Abstract Notification System"
git push railway main  # Backend
git push origin main   # Frontend
```

---

## 🚂 **4. RAILWAY MIGRATION**

```powershell
# Railway production migration:
railway run python migrate_v8_0.py
# → y (enter)

# VAGY Railway shell:
railway shell
python migrate_v8_0.py
exit
```

---

## ✅ **5. ELLENŐRZÉS**

**Backend (Railway):**
```
1. Railway dashboard → Logs
2. Keresd: "✅ v8.0 Migration sikeresen lefutott!"
```

**Frontend (Netlify/Vercel):**
```
1. Login: super_admin
2. Menü → "Értesítések" ✅
3. Harang ikon ✅
```

---

## ⚡ **ÖSSZEFOGLALÓ**

```
TELJES WORKFLOW:

1. Kibontás             (30 mp)
2. Backend setup        (2 perc)
3. Git push             (2 perc)
4. Railway migration    (1 perc)
5. Ellenőrzés           (1 perc)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL:                  ~6 perc

✅ Teljes projekt push-olva
✅ v8.0 migration lefutott
✅ Production ready
```

---

## 🐛 **GYORS HIBAELHÁRÍTÁS**

**"Module not found":**
```powershell
python -m pip install qrcode pillow
```

**Migration hiba:**
```powershell
# Töröld és kezdd újra:
Remove-Item backend\instance\lab_requests.db
cd backend
python -c "from app import app, db; app.app_context().push(); db.create_all()"
python migrate_v8_0.py
```

**Git conflict:**
```powershell
# Hard reset (FIGYELEM - elvesznek a helyi változtatások):
git reset --hard HEAD
git pull railway main
```

---

**Részletes útmutató:** `README_v8.0.md`

**Jó push-olást! 🎉**
