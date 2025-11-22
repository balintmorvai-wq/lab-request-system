# Railway Backend Setup

## 1. requirements.txt frissítése

Módosítsd a `backend/requirements.txt` fájlt:

```txt
Flask==2.3.0
Flask-CORS==4.0.0
Flask-SQLAlchemy==3.0.3
PyJWT==2.8.0
Werkzeug==2.3.0
reportlab==4.0.4
psycopg2-binary==2.9.6
gunicorn==21.2.0
```

**Új:** psycopg2-binary (PostgreSQL), gunicorn (production server)

---

## 2. app.py módosítása

### Keresés és csere:

**Régi (sqlite):**
```python
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///laborkeres.db'
```

**Új (PostgreSQL support):**
```python
import os

# v6.6 Production: PostgreSQL support
DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///laborkeres.db')
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
```

### CORS frissítés:

**Régi:**
```python
CORS(app)
```

**Új:**
```python
# v6.6 Production: Allow frontend domain
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
CORS(app, origins=[FRONTEND_URL, 'http://localhost:3000'])
```

### App run módosítás (fájl vége):

**Régi:**
```python
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)
```

**Új:**
```python
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    # v6.6 Production: Use PORT from environment
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
```

---

## 3. Procfile létrehozása

Hozz létre egy új fájlt: `backend/Procfile` (nincs kiterjesztés!)

```
web: gunicorn app:app
```

---

## 4. runtime.txt (opcionális)

Hozz létre: `backend/runtime.txt`

```
python-3.11.0
```

---

## 5. .gitignore frissítés

`backend/.gitignore`:

```
__pycache__/
*.pyc
*.db
venv/
.env
uploads/*
!uploads/.gitkeep
```

Hozz létre: `backend/uploads/.gitkeep` (üres fájl)

---

## ÖSSZEFOGLALÁS:

✅ requirements.txt - PostgreSQL + gunicorn
✅ app.py - DATABASE_URL env var
✅ app.py - CORS frontend URL
✅ app.py - PORT env var
✅ Procfile - gunicorn
✅ .gitignore - uploads
