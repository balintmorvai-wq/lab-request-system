# Frontend Production Setup

## 1. Environment variables

Hozz létre: `frontend/.env.production`

```env
REACT_APP_API_URL=https://your-backend.railway.app/api
```

**FONTOS:** Ez később frissül a Railway backend URL-re!

---

## 2. AuthContext.js módosítás

### Fájl: `frontend/src/context/AuthContext.js`

**Keresés:**
```javascript
const API_URL = 'http://localhost:5000/api';
```

**Csere:**
```javascript
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
```

Ez lehetővé teszi, hogy production-ben más URL-t használjon!

---

## 3. package.json scripts

`frontend/package.json` - ellenőrizd, hogy van-e:

```json
{
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  }
}
```

✅ A `build` parancs szükséges!

---

## 4. .env.example létrehozása

`frontend/.env.example`:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

---

## 5. .gitignore ellenőrzés

`frontend/.gitignore`:

```
# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# production
/build

# misc
.DS_Store
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

npm-debug.log*
yarn-debug.log*
yarn-error.log*
```

---

## ÖSSZEFOGLALÁS:

✅ .env.production - API URL config
✅ AuthContext.js - env var használat
✅ package.json - build script
✅ .env.example - template
✅ .gitignore - build folder excluded
