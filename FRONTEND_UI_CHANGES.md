# v5.0 Frontend UI Változások

## RequestForm.js - Hozzáadandó mezők

### 1. Kategória mező (Minta leírás UTÁN)

```javascript
{/* Kategória SELECT - INSERT AFTER sample_description */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Kategória *
  </label>
  <div className="relative">
    <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
    <select
      value={selectedCategory}
      onChange={(e) => setSelectedCategory(e.target.value)}
      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
```

### 2. Prioritás/Sürgősség BLOKK (KÜLÖN CARD - urgency utántól kivenni)

```javascript
{/* Priority Block - SEPARATE CARD after Basic Information */}
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
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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

### 3. Fájl melléklet (KÜLÖN CARD a form végén, gombok előtt)

```javascript
{/* File Attachment - BEFORE BUTTONS */}
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
          onChange={(e) => setAttachmentFile(e.target.files[0])}
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

## Struktúra összefoglalva:

```
FORM:
  1. Minta információk CARD
     - Minta azonosító
     - Minta leírása
     - Kategória ← ÚJ!
  
  2. Prioritás és határidők CARD ← ÚJ BLOKK!
     - Sürgősség
     - Mintavétel dátuma
     - Határidő
     - Figyelmeztetés
  
  3. Mintavétel részletei CARD
     - Mintavétel helye
  
  4. Vizsgálatok CARD
     - Checkbox list
  
  5. Speciális utasítások CARD
  
  6. Melléklet CARD ← ÚJ!
     - Fájl feltöltés
  
  7. GOMBOK
     - Mentés piszkozat
     - Beküldés
     - Mégse
```

## Módosítandó sorok:

1. Import: +Tag, +Paperclip, +X, +AlertTriangle
2. State: +categories, +selectedCategory, +attachmentFile, +existingAttachment
3. useEffect: +fetchCategories()
4. loadRequest: +category, +attachment betöltés
5. handleSubmit: +category validáció, +attachment append
6. Form HTML: Átrendezés + új mezők

## Teljes fájl méret: ~550 sor (volt ~467)
