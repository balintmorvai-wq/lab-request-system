# 🧪 v7.0 VÁLTOZÁSOK - Kiértékelő modul

## 🎯 Fő fejlesztés: Labor munkatársak kiértékelő modulja

A v7.0 egy komplex kiértékelő rendszert vezet be, amely lehetővé teszi a labor munkatársak számára, hogy vizsgálati eredményeket rögzítsenek, fájlokat csatolj anakok, és validálásra küldjék a kész eredményeket az adminoknak.

---

## 📊 Adatmodell változások

### 1. Új tábla: `TestResult`
```sql
CREATE TABLE test_result (
    id INTEGER PRIMARY KEY,
    lab_request_id INTEGER NOT NULL,
    test_type_id INTEGER NOT NULL,
    result_text TEXT,
    attachment_filename VARCHAR(200),
    status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'completed'
    completed_by_user_id INTEGER,
    completed_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
```

**Cél:** Minden egyes vizsgálathoz külön eredmény rekord, amely tartalmazza:
- Szöveges eredményt
- Csatolt fájlt (max 50MB)
- Státuszt (pending/completed)
- Ki és mikor töltötte ki

---

### 2. `User` tábla bővítése
**Új oszlop:**
- `department_id` (INTEGER, NULLABLE) - Szervezeti egység hozzárendelése
- **Kötelező** labor_staff szerepkörnél

**Kapcsolat:**
```python
department = db.relationship('Department', backref='users')
```

---

### 3. `TestType` tábla módosítás
**Kötelező mező:**
- `department_id` - Minden vizsgálattípushoz kötelező megadni a végrehajtó szervezeti egységet

---

### 4. Új `Department` default érték
**Automatikus migráció:**
- Létrejön egy "Általános labor" szervezeti egység (ID: 1)
- Minden meglévő labor_staff felhasználó automatikusan hozzárendelődik ehhez

---

### 5. Új státusz: `validation_pending`
**Teljes státusz flow:**
```
draft 
  → pending_approval (cég jóváhagyás)
  → submitted (beküldve)
  → in_progress (labor megkezdi)
  → validation_pending (labor befejezte, admin ellenőrzi) ← ÚJ!
  → completed (admin jóváhagyta)
```

**Láthatóság:**
- `validation_pending` csak super_admin és labor_staff látja
- Céges felhasználók NEM látják ezt a státuszt

---

## 🔧 Backend API változások

### Új API végpontok

#### 1. `GET /api/my-worklist`
**Jogosultság:** labor_staff  
**Funkció:** Labor munkatárs saját munkalistája  
**Szűrés:**
- Csak `in_progress`, `validation_pending`, `completed` státuszok
- Csak olyan kérések, ahol van saját department-hez tartozó vizsgálat

**Visszatér:**
```json
[
  {
    "id": 123,
    "request_number": "MOL-20241126-001",
    "my_test_count": 3,
    "my_completed_count": 1,
    "progress": 33,
    "urgency": "urgent",
    "deadline": "2024-12-01T00:00:00"
  }
]
```

---

#### 2. `GET /api/requests/<id>/test-results`
**Jogosultság:** super_admin, labor_staff (saját dept), company_admin, company_user (ha saját kérés)  
**Funkció:** Egy kérés összes vizsgálati eredménye  

**Visszatér:**
```json
[
  {
    "test_type_id": 5,
    "test_type_name": "Viszkozitás mérés",
    "department_id": 3,
    "department_name": "Kémiai Labor",
    "result_id": 42,
    "result_text": "40 cSt @ 40°C",
    "attachment_filename": "grafikon.pdf",
    "status": "completed",
    "completed_by": "Dr. Kovács István",
    "completed_at": "2024-11-26T14:30:00",
    "can_edit": true
  }
]
```

---

#### 3. `POST /api/test-results`
**Jogosultság:** labor_staff (saját dept), super_admin  
**Funkció:** Vizsgálati eredmény mentése/frissítése  

**Request body:**
```json
{
  "lab_request_id": 123,
  "test_type_id": 5,
  "result_text": "40 cSt @ 40°C",
  "status": "completed"
}
```

---

#### 4. `POST /api/test-results/<id>/attachment`
**Jogosultság:** labor_staff (saját dept), super_admin  
**Funkció:** Fájl feltöltés eredményhez  
**Limit:** 50MB  
**Content-Type:** multipart/form-data  

---

#### 5. `GET /api/test-results/<id>/attachment`
**Jogosultság:** Mindenki, aki láthatja a kérést  
**Funkció:** Eredmény fájl letöltése  

---

#### 6. `POST /api/requests/<id>/submit-validation`
**Jogosultság:** labor_staff  
**Funkció:** Kérés validálásra küldése  

**Validáció:**
- Minden saját dept vizsgálatnak `completed` státuszúnak kell lennie
- Kérés státusza `in_progress` → `validation_pending`
- Értesítés küldése minden super_admin-nak

---

### Módosított API végpontok

#### `GET /api/requests`
**Labor staff szűrés (v7.0):**
```python
if current_user.role == 'labor_staff':
    requests = LabRequest.query.filter(
        LabRequest.status.in_(['in_progress', 'validation_pending', 'completed'])
    ).all()
```

Labor staff **NEM** látja:
- `draft` - piszkozat
- `pending_approval` - cég jóváhagyásra vár
- `submitted` - beküldött (még nem kezdték el)

---

#### `POST /api/requests` (create_request)
**Automatikus TestResult létrehozás:**
```python
# Minden vizsgálathoz automatikusan létrejön egy TestResult rekord
for tt_id in test_type_ids:
    result = TestResult(
        lab_request_id=new_request.id,
        test_type_id=tt_id,
        status='pending'
    )
    db.session.add(result)
```

---

## 🎨 Frontend változások

### Új komponensek

#### 1. `WorkList.js` - Munkalista
**Helye:** `/worklist`  
**Jogosultság:** labor_staff  

**Funkciók:**
- Statisztikai összefoglaló (összes, folyamatban, validálásra vár, elkészült)
- Szűrés státusz szerint
- Kérések listája progress bar-ral
- "Végrehajtás" gomb → navigál `/test-results/:id`

**Megjelenítés:**
```
┌─────────────────────────────────────────┐
│ MUNKALISTÁM                             │
│ Kémiai Labor - Folyamatban lévő kérések│
└─────────────────────────────────────────┘

[Összes: 12] [Folyamatban: 8] [Validálás: 3] [Elkészült: 1]

[Összes] [Folyamatban] [Validálásra vár] [Elkészült]

┌─────────────────────────────────────────┐
│ MOL-20241126-001    [Folyamatban]      │
│ Mintaleírás                             │
│ 2024-11-26 | MOL Nyrt.                  │
│                                         │
│ 2/3 vizsgálat  ████████░░ 67%          │
│                          [Végrehajtás]  │
└─────────────────────────────────────────┘
```

---

#### 2. `TestResultsPanel.js` - Eredmény kitöltő
**Helye:** `/test-results/:id`  
**Jogosultság:** labor_staff, super_admin  

**Split-screen layout:**

```
┌──────────────────────┬──────────────────────┐
│ BAL OLDAL (readonly) │ JOBB OLDAL (editable)│
│                      │                      │
│ Laborkérés adatok:   │ Saját vizsgálatok:   │
│ - Azonosító          │                      │
│ - Minta leírás       │ ┌──────────────────┐ │
│ - Cég                │ │ Viszkozitás      │ │
│ - Kontakt            │ │ Eredmény:        │ │
│ - Határidő           │ │ [Textarea]       │ │
│ - Összes vizsgálat   │ │ Fájl: [Browse]   │ │
│   (lista)            │ │ [Elkészült]      │ │
│                      │ └──────────────────┘ │
│                      │                      │
│ [Bezárás]            │ [Validálásra küldés] │
└──────────────────────┴──────────────────────┘
```

**Funkciók:**
- Bal oldal: Teljes kérés adatok (readonly)
- Jobb oldal: Csak saját dept vizsgálatok
- Eredmény textarea (kötelező)
- Fájl feltöltés (opcionális, max 50MB)
- "Mentés és Elkészültnek jelölés" gomb
- "Validálásra küldés" gomb (csak ha minden saját vizsgálat elkészült)

---

### Módosított komponensek

#### `Layout.js` - Navigáció
**Labor staff menü (v7.0):**
```
Dashboard
Munkalistám  ← ÚJ!
Minden kérés
```

**Egyéb szerepkörök:**
```
Dashboard
Laborkérések
[Felhasználók] (ha company_admin)
```

---

#### `App.js` - Új routok
```jsx
// v7.0: Labor munkatárs munkalista
<Route path="worklist" element={
  <PrivateRoute allowedRoles={['labor_staff']}>
    <WorkList />
  </PrivateRoute>
} />

// v7.0: Vizsgálati eredmények kitöltése
<Route path="test-results/:id" element={
  <PrivateRoute allowedRoles={['labor_staff', 'super_admin']}>
    <TestResultsPanel />
  </PrivateRoute>
} />
```

---

#### `UserManagement.js` (TODO)
**Módosítások:**
- Labor staff létrehozásakor/szerkesztésekor `department_id` **kötelező**
- Dropdown select a szervezeti egységek közül
- Validáció: labor_staff esetén nem lehet menteni department nélkül

---

#### `TestTypeManagement.js` (TODO)
**Módosítások:**
- `department_id` **kötelező** mező
- Dropdown select a szervezeti egységek közül
- Vizualizáció: mely szervezeti egység végzi a vizsgálatot

---

## 🔔 Értesítések

### Új értesítés típusok

#### 1. Labor munkatársnak: Új kérés
**Trigger:** LabRequest státusz változik `submitted` → `in_progress`  
**Címzettek:** Azok a labor_staff felhasználók, akiknek a department_id-ja szerepel a kérés vizsgálatai között  
**Üzenet:** "Új laborkérés: {request_number}"  

---

#### 2. Admin-nak: Validálásra beküldött
**Trigger:** Labor staff meghívja a `/submit-validation` endpoint-ot  
**Címzettek:** Minden super_admin  
**Üzenet:** "Új validálásra váró kérés: {request_number}"  

---

## 📂 Fájlkezelés

### Új mappa: `uploads/results/`
**Cél:** Vizsgálati eredmény fájlok tárolása  

**Fájlnév formátum:**
```
result_{result_id}_{timestamp}_{original_filename}
```

**Példa:**
```
result_42_20241126_143052_grafikon.pdf
```

**Max méret:** 50MB (app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024)

---

## 🔐 Jogosultságok összefoglalás

### Labor staff
**Láthat:**
- `in_progress`, `validation_pending`, `completed` kéréseket
- Minden kérésnél csak saját dept vizsgálatokat

**Műveletek:**
- Eredmény kitöltése (saját dept vizsgálatoknál)
- Fájl feltöltés (max 50MB)
- Validálásra küldés (ha minden saját vizsgálat kész)

**NEM láthat:**
- `draft`, `pending_approval`, `submitted` kéréseket
- Más dept vizsgálatok eredményeit (csak a nevet látja)

---

### Super Admin
**Láthat:**
- MINDEN státuszt (beleértve `validation_pending`-et is)
- MINDEN vizsgálat eredményét (minden dept)

**Műveletek:**
- Eredmények szerkesztése (bármely dept)
- Hiányzó eredmények kitöltése
- Kérés `validation_pending` → `completed` állítása
- Csak akkor, ha MINDEN vizsgálat elkészült

---

### Company Admin & Company User
**NEM látják:**
- `validation_pending` státuszt
- A számukra ez átugrásra kerül: `in_progress` → `completed`

**Látják:**
- Csak saját cég kéréseit
- Vizsgálatok eredményeit (readonly)

---

## 🧪 Tesztelési útmutató

### 1. Backend tesztelés

#### Adatbázis létrehozása
```bash
cd backend
python app.py
# → Automatikus migráció: Általános labor dept létrehozása
# → Meglévő labor staff-ok hozzárendelése
```

#### Teszt felhasználók
```python
# Labor staff teszt user létrehozása
{
  "email": "labor@pannon.hu",
  "password": "labor123",
  "name": "Dr. Kovács István",
  "role": "labor_staff",
  "department_id": 3  # Kémiai Labor
}
```

#### API tesztelés (Postman / curl)
```bash
# 1. Bejelentkezés
POST /api/auth/login
{
  "email": "labor@pannon.hu",
  "password": "labor123"
}
# → token

# 2. Munkalista lekérése
GET /api/my-worklist
Headers: Authorization: Bearer {token}
# → Lista kérésekkel, ahol van saját dept vizsgálat

# 3. Eredmények lekérése
GET /api/requests/123/test-results
Headers: Authorization: Bearer {token}
# → Csak saját dept vizsgálatok

# 4. Eredmény mentése
POST /api/test-results
Headers: Authorization: Bearer {token}
{
  "lab_request_id": 123,
  "test_type_id": 5,
  "result_text": "40 cSt @ 40°C",
  "status": "completed"
}
# → result_id: 42

# 5. Fájl feltöltés
POST /api/test-results/42/attachment
Headers: Authorization: Bearer {token}
Content-Type: multipart/form-data
file: grafikon.pdf (max 50MB)
# → filename

# 6. Validálásra küldés
POST /api/requests/123/submit-validation
Headers: Authorization: Bearer {token}
# → "Kérés validálásra küldve!"
```

---

### 2. Frontend tesztelés

#### Labor staff flow
```
1. Bejelentkezés: labor@pannon.hu / labor123
2. Navigálás: Munkalistám menüpont
3. Ellenőrzés: 
   ✓ Statisztikák láthatók
   ✓ Kérések listája progress bar-ral
   ✓ Csak in_progress, validation_pending, completed kérések

4. "Végrehajtás" gomb kattintás
5. TestResultsPanel megnyílik:
   ✓ Bal oldal: Kérés adatok (readonly)
   ✓ Jobb oldal: Saját vizsgálatok (editable)

6. Eredmény kitöltése:
   - Textarea: "40 cSt @ 40°C"
   - "Mentés és Elkészültnek jelölés"
   ✓ Sikeres mentés üzenet
   ✓ Státusz: Elkészült

7. Fájl feltöltés:
   - Fájl kiválasztása: grafikon.pdf
   ✓ "Fájl feltöltve!" üzenet
   ✓ Fájl név megjelenik

8. Következő vizsgálat kitöltése...

9. Minden saját vizsgálat elkészült után:
   - "Validálásra küldés" gomb aktív lesz
   - Kattintás → Megerősítés
   ✓ "Kérés validálásra küldve!"
   ✓ Navigáció vissza a munkalistához
```

---

#### Admin validálás flow
```
1. Bejelentkezés: admin@pannon.hu / admin123
2. Dashboard → Értesítés: "Új validálásra váró kérés"
3. Kérés megnyitása
4. Ellenőrzés:
   ✓ validation_pending státusz látható
   ✓ Minden vizsgálat eredménye látható
   ✓ Fájlok letölthetők

5. Ha minden rendben:
   - Státusz váltás: completed
   ✓ Kérés elkészült

6. Ha hiányzik valami:
   - Eredmények szerkesztése
   - Hiányzó eredmények kitöltése
   - Státusz váltás: completed
```

---

## 📊 Statisztikák

### Backend változások
- **Új API végpontok:** 6
- **Módosított API végpontok:** 2
- **Új modellek:** 1 (TestResult)
- **Módosított modellek:** 2 (User, TestType)
- **Új státuszok:** 1 (validation_pending)
- **Új szerepkör funkciók:** 1 (labor_staff worklist)

### Frontend változások
- **Új komponensek:** 2 (WorkList, TestResultsPanel)
- **Módosított komponensek:** 2 (Layout, App)
- **Új routok:** 2 (/worklist, /test-results/:id)
- **Új menüpontok:** 1 (Munkalistám)

### Adatbázis
- **Új táblák:** 1 (test_result)
- **Új oszlopok:** 2 (User.department_id, TestType.department_id kötelező)
- **Új default rekordok:** 1 (Általános labor dept)

---

## 🚀 Telepítés

### Backend migráció
```bash
cd backend

# 1. Adatbázis backup (opcionális, de ajánlott)
cp lab_requests.db lab_requests_backup_v6.8.1.db

# 2. Frissítés
pip install -r requirements.txt

# 3. Indítás (automatikus migráció)
python app.py
# → Új táblák és oszlopok létrejönnek
# → Általános labor dept létrejön
# → Meglévő labor staff-ok hozzárendelése
```

### Frontend frissítés
```bash
cd frontend

# Új komponensek másolása
# WorkList.js, TestResultsPanel.js

# App.js és Layout.js frissítése

# Indítás
npm start
```

---

## 🎯 Következő lépések (v7.1 tervek)

- [ ] UserManagement: department_id kötelező labor staff-nál
- [ ] TestTypeManagement: department_id kötelező mezőként
- [ ] Email értesítések konfigurálása
- [ ] Bulk eredmény import (CSV)
- [ ] Vizsgálati eredmények export (Excel)
- [ ] Eredmény sablonok (gyakori vizsgálatokhoz)
- [ ] Vizsgálati eredmény history (verziókezelés)
- [ ] Labor munkatárs dashboard (statisztikák, teljesítmény)

---

**Verzió:** v7.0  
**Dátum:** 2024-11-26  
**Készítette:** Bálint + Claude  
**Státusz:** 🚧 Fejlesztés alatt - Backend kész, Frontend komponensek 70% kész  
**Build típus:** Major Feature Release
