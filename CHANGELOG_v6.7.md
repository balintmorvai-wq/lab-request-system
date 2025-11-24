# 🧪 v6.7 VÁLTOZÁSOK - Összefoglaló

## 📊 VIZSGÁLATTÍPUS (TestType) ÚJ OSZLOPOK

| Oszlop | Típus | Leírás |
|--------|-------|--------|
| `standard` | VARCHAR(100) | Szabvány (pl. MSZ EN ISO 3104) |
| `device` | VARCHAR(200) | Készülék neve |
| `cost_price` | FLOAT | Önköltség (Ft/minta) |
| `measurement_time` | FLOAT | Mérési idő (óra) |
| `sample_prep_time` | FLOAT | Mintaelőkészítési idő (óra) |
| `evaluation_time` | FLOAT | Kiértékelés (óra) |
| `turnaround_time` | FLOAT | Átfutási idő (óra) |
| `sample_quantity` | FLOAT | Minta mennyiség (ml) |
| `sample_prep_required` | BOOLEAN | Mintaelőkészítés szükséges |
| `hazard_level` | VARCHAR(50) | Veszélyesség |

---

## 📋 LABORKÉRÉS (LabRequest) ÚJ OSZLOPOK

| Oszlop | Típus | Leírás |
|--------|-------|--------|
| `request_number` | VARCHAR(50) UNIQUE | Generált azonosító (pl. MOL-20241124-001) |
| `internal_id` | VARCHAR(100) | Céges belső azonosító |
| `sampling_datetime` | TIMESTAMP | Mintavétel időpontja (dátum + óra:perc) |
| `logistics_type` | VARCHAR(50) | 'sender' vagy 'provider' |
| `shipping_address` | VARCHAR(500) | Szállítási cím |

---

## 🎨 FRONTEND VÁLTOZÁSOK

### 1. Minta információk blokk
- Céges belső azonosító mező (opcionális)
- Mintavétel időpontja (datetime-local, "Most" gombbal)
- Mintavétel helye

### 2. Prioritás és határidők blokk
- **Vízszintes prioritás választó** 3 opcióval:
  - ⚪ Normál - Standard átfutás
  - 🟡 Sürgős - Gyorsított feldolgozás
  - 🔴 Kritikus - Azonnali prioritás
- Határidő mező (opcionális)

### 3. Minta feladás részletei blokk (ÚJ!)
- **Markáns logisztika választó:**
  - 🏢 Feladó gondoskodik
  - 🚚 Szolgáltató szállít
- Szállítási cím (csak ha szolgáltató szállít)
- Kontakt személy + telefon

### 4. Vizsgálatok blokk
- Kategória fejlécben **"Összes kijelölése"** gomb
- **Számláló:** kijelölt/összes (pl. 3/8)

---

## 📂 ÚJ SZAKMAI KATEGÓRIÁK

| Kategória | Szín | Ikon |
|-----------|------|------|
| Minta előkészítés | Indigo | Package |
| Anyagvizsgálat | Sky blue | Beaker |
| Kromatográfia | Purple | BarChart3 |
| Fizikai tulajdonság | Amber | Gauge |

---

## 🖨️ PDF JAVÍTÁSOK

- Többféle UTF-8 font támogatás
- Fallback sorrend: DejaVuSans → FreeSans → LiberationSans → Helvetica
- Új mezők megjelenítése a PDF-ben

---

## 🗃️ MIGRÁCIÓK

A `migrations.py` automatikusan hozzáadja az új oszlopokat az első indításkor.

```bash
# Futtatás
cd backend
python app.py
# → "✅ Applied: test_type.standard - Szabvány"
# → "✅ Applied: lab_request.request_number - ..."
```

---

## 🧪 TESZT

```bash
# Backend
cd backend
python app.py

# Frontend (másik terminál)
cd frontend
npm install
npm start
```

**Teszt felhasználók:**
- admin@pannon.hu / admin123
- user@mol.hu / user123
