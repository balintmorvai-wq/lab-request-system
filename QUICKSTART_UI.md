# 🚀 GYORS UI BEÉPÍTÉS - RequestForm.js

## ⚡ 5 PERCES ÚTMUTATÓ

### 1️⃣ MINTA INFORMÁCIÓK BLOKK - Kategória hozzáadása

**BESZÚRÁS HELYE:** A `Minta leírása` textarea UTÁN (kb. 291. sor után)

```jsx
          {/* KATEGÓRIA - ÚJ MEZŐ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kategória *
            </label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              >
                <option value="">Válassz kategóriát</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            {selectedCategory && categories.find(c => c.id === parseInt(selectedCategory)) && (
              <p className="text-xs text-gray-500 mt-1">
                {categories.find(c => c.id === parseInt(selectedCategory)).description}
              </p>
            )}
          </div>
        </div>
        {/* MINTA INFORMÁCIÓK BLOKK VÉGE */}
```

---

### 2️⃣ PRIORITÁS ÉS HATÁRIDŐK - ÚJ KÜLÖN BLOKK

**BESZÚRÁS HELYE:** Minta információk blokk UTÁN, Mintavétel részletei blokk ELŐTT (kb. 293. sor)

**TÖRÖLD KI:** Az urgency (Sürgősség) mezőt az első blokkból (263-276. sor)

```jsx
        {/* PRIORITÁS ÉS HATÁRIDŐK - ÚJ BLOKK */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Prioritás és határidők
          </h2>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sürgősség *
              </label>
              <select
                value={formData.urgency}
                onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="normal">⚪ Normal</option>
                <option value="urgent">🟡 Sürgős</option>
                <option value="critical">🔴 Kritikus</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mintavétel dátuma *
              </label>
              <input
                type="date"
                value={formData.sampling_date}
                onChange={(e) => setFormData({ ...formData, sampling_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Határidő *
              </label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {deadlineWarning && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">{deadlineWarning}</p>
            </div>
          )}
        </div>
```

---

### 3️⃣ MINTAVÉTEL RÉSZLETEI MÓDOSÍTÁS

**TÖRÖLD KI:** A dátum mezőket ebből a blokkból (315-340. sor körül)

**MARADJON:** Csak a "Mintavétel helye" mező

```jsx
        {/* Mintavétel részletei - EGYSZERŰSÍTETT */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-indigo-600" />
            Mintavétel részletei
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mintavétel helye *
            </label>
            <input
              type="text"
              value={formData.sampling_location}
              onChange={(e) => setFormData({ ...formData, sampling_location: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
              placeholder="pl. Százhalombatta, finomító"
            />
          </div>
        </div>
```

---

### 4️⃣ FÁJL MELLÉKLET - ÚJ BLOKK

**BESZÚRÁS HELYE:** Speciális utasítások UTÁN, Gombok ELŐTT (kb. 430. sor előtt)

```jsx
        {/* MELLÉKLET - ÚJ BLOKK */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Paperclip className="w-5 h-5 text-indigo-600" />
            Melléklet
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fájl csatolása (opcionális, max 20 MB)
            </label>
            
            {existingAttachment && !attachmentFile && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                <Paperclip className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-700">Meglévő: {existingAttachment}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Törölni akarod a meglévő mellékletet?')) {
                      setExistingAttachment('');
                    }
                  }}
                  className="ml-auto text-red-600 hover:text-red-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-colors">
                <Paperclip className="w-5 h-5 text-gray-500" />
                <span className="text-sm text-gray-700">Fájl kiválasztása</span>
                <input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file && file.size > 20 * 1024 * 1024) {
                      alert('A fájl mérete nem lehet nagyobb 20 MB-nál!');
                      e.target.value = '';
                      return;
                    }
                    setAttachmentFile(file);
                  }}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                />
              </label>
              
              {attachmentFile && (
                <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-lg">
                  <Paperclip className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm text-indigo-700">{attachmentFile.name}</span>
                  <span className="text-xs text-indigo-500">
                    ({(attachmentFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                  <button
                    type="button"
                    onClick={() => setAttachmentFile(null)}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            
            <p className="text-xs text-gray-500 mt-2">
              Támogatott: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG (max 20 MB)
            </p>
          </div>
        </div>
```

---

## ✅ ÖSSZEGZÉS:

### Változások:
1. ✅ **Minta info:** +Kategória mező
2. ✅ **Prioritás:** Új külön blokk (sürgősség + dátumok)
3. ✅ **Mintavétel:** Egyszerűsítve (csak hely)
4. ✅ **Melléklet:** Új blokk (fájl feltöltés)

### Időbecslés: **10-15 perc**

### Ellenőrzőlista:
- [ ] Import: Tag, Paperclip, X, AlertTriangle hozzáadva
- [ ] State: categories, selectedCategory, attachmentFile, existingAttachment hozzáadva
- [ ] useEffect: fetchCategories() hozzáadva
- [ ] loadRequest: category + attachment betöltés
- [ ] handleSubmit: category validáció + attachment append
- [ ] Form HTML: 4 módosítás (fent)

### Teszt:
```
npm start
→ Új kérés
→ Látszik: Kategória ✅
→ Látszik: Prioritás blokk ✅
→ Látszik: Melléklet ✅
```

**KÉSZ!** 🎉
