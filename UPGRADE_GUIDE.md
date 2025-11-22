# 🚀 v3.1 → v4.0 TELJES FRISSÍTÉSI ÚTMUTATÓ

## 📋 v4.0 ÚJDONSÁGOK:

### 1. 📁 **Request Categories (Laborkérés Kategóriák)**
- University Admin létrehozhat/szerkeszthet kategóriákat
- Színkódolt megjelenítés
- Kategória szerinti szűrés
- Dashboard statisztika kategóriánként

### 2. 📎 **File Attachments (Fájl Mellékletek)**
- 1 fájl / laborkérés
- Max 20 MB
- Formátumok: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG
- Letöltés megtekintésnél

### 3. 🏢 **Company Logo Login Oldalon**
- MOL logó alapértelmezetten
- Dinamikus betöltés
- Professzionális megjelenés

### 4. 🎨 **Kategória szerinti Design**
- Színes badge-ek
- Vizuális megkülönböztetés
- Kategória szűrő

---

## 🔧 BACKEND - KÉSZ ✅

**Fájl:** `lab-request-system-v4.0/backend/app.py`

**Új modellek:**
```python
class RequestCategory(db.Model):
    id, name, description, color, is_active, created_at, updated_at

# LabRequest model kiegészítve:
    category_id
    attachment_filename
```

**Új API végpontok:**
```
GET  /api/categories                      # Lista
POST /api/categories                      # Létrehozás (super_admin)
PUT  /api/categories/<id>                 # Szerkesztés (super_admin)
DELETE /api/categories/<id>               # Törlés (super_admin)

GET  /api/requests/<id>/attachment        # Melléklet letöltés
```

**Módosított végpontok:**
```
POST /api/requests                        # + category_id, + file upload
PUT  /api/requests/<id>                   # + category_id, + file upload
GET  /api/requests                        # + category info
GET  /api/stats                           # + by_category
```

---

## 🎨 FRONTEND MÓDOSÍTÁSOK

### 1. CategoryManagement komponens (ÚJ)

**Fájl:** `frontend/src/components/CategoryManagement.js`

```javascript
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Tag, Edit2, Trash2, PlusCircle, X, AlertCircle } from 'lucide-react';

function CategoryManagement() {
  const { getAuthHeaders, API_URL } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#6B7280'
  });

  const predefinedColors = [
    { name: 'Zöld', value: '#10B981' },
    { name: 'Piros', value: '#EF4444' },
    { name: 'Kék', value: '#3B82F6' },
    { name: 'Lila', value: '#8B5CF6' },
    { name: 'Narancs', value: '#F59E0B' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Türkiz', value: '#14B8A6' },
    { name: 'Szürke', value: '#6B7280' },
  ];

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API_URL}/categories`, {
        headers: getAuthHeaders()
      });
      setCategories(response.data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      color: category.color
    });
    setShowModal(true);
  };

  const handleNew = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      color: '#6B7280'
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (editingCategory) {
        await axios.put(
          `${API_URL}/categories/${editingCategory.id}`,
          formData,
          { headers: getAuthHeaders() }
        );
      } else {
        await axios.post(
          `${API_URL}/categories`,
          formData,
          { headers: getAuthHeaders() }
        );
      }
      
      setShowModal(false);
      fetchCategories();
    } catch (err) {
      setError(err.response?.data?.message || 'Hiba történt');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Biztosan törölni szeretnéd ezt a kategóriát?')) return;

    try {
      await axios.delete(`${API_URL}/categories/${id}`, {
        headers: getAuthHeaders()
      });
      fetchCategories();
    } catch (error) {
      alert('Hiba történt a törlés során');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Betöltés...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Laborkérés Kategóriák</h1>
          <p className="text-gray-600 mt-1">Összesen {categories.length} kategória</p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <PlusCircle className="w-5 h-5" />
          Új kategória
        </button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((category) => (
          <div key={category.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: category.color }}
                >
                  <Tag className="w-6 h-6 text-white" />
                </div>
                
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900">{category.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className="inline-block px-2 py-1 text-xs font-medium text-white rounded"
                      style={{ backgroundColor: category.color }}
                    >
                      {category.color}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(category)}
                  className="text-indigo-600 hover:text-indigo-900"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDelete(category.id)}
                  className="text-red-600 hover:text-red-900"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">
                {editingCategory ? 'Kategória szerkesztése' : 'Új kategória'}
              </h2>
              <button onClick={() => setShowModal(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kategória neve *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Leírás
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows="3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Szín
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {predefinedColors.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`w-full h-10 rounded-lg border-2 ${
                        formData.color === color.value ? 'border-gray-900' : 'border-gray-200'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-12 h-10 border rounded"
                  />
                  <span className="text-sm text-gray-600">{formData.color}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  {editingCategory ? 'Mentés' : 'Létrehozás'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Mégse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CategoryManagement;
```

---

### 2. Login oldal - MOL logó megjelenítése

**Fájl:** `frontend/src/components/Login.js`

**Módosítás a tetején:**

```javascript
import React, { useState, useEffect } from 'react';
// ... existing imports

function Login() {
  const [logoUrl, setLogoUrl] = useState(null);
  
  // ... existing state
  
  useEffect(() => {
    // Load MOL logo (company_id = 1)
    setLogoUrl('http://localhost:5000/api/companies/1/logo');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Logo section */}
        {logoUrl && (
          <div className="mb-6 flex justify-center">
            <img 
              src={logoUrl} 
              alt="Company Logo" 
              className="h-16 object-contain"
              onError={() => setLogoUrl(null)}
            />
          </div>
        )}
        
        <div className="flex justify-center mb-8">
          <Beaker className="w-16 h-16 text-indigo-600" />
        </div>
        
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-2">
          LabRequest v4.0
        </h2>
        
        {/* ... rest of the component */}
```

---

### 3. RequestForm - Kategória + Fájl feltöltés

**Fájl:** `frontend/src/components/RequestForm.js`

**Hozzáadások:**

```javascript
import { Paperclip, X } from 'lucide-react';

function RequestForm() {
  // ... existing state
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [attachmentFile, setAttachmentFile] = useState(null);
  
  useEffect(() => {
    fetchCategories();
    // ... existing useEffect
  }, []);
  
  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API_URL}/categories`, {
        headers: getAuthHeaders()
      });
      setCategories(response.data.filter(c => c.is_active));
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };
  
  // Load request for edit mode
  const loadRequest = async () => {
    try {
      const response = await axios.get(`${API_URL}/requests/${id}`, {
        headers: getAuthHeaders()
      });
      const req = response.data;
      
      // ... existing form data
      setSelectedCategory(req.category_id || '');
      
    } catch (error) {
      console.error('Error loading request:', error);
    }
  };
  
  const handleSubmit = async (e, status = 'pending_approval') => {
    e.preventDefault();
    
    if (selectedTests.length === 0) {
      alert('Válassz ki legalább egy vizsgálattípust!');
      return;
    }
    
    if (!selectedCategory) {
      alert('Válassz kategóriát!');
      return;
    }

    try {
      const formDataObj = new FormData();
      
      // Add all form fields
      formDataObj.append('sample_id', formData.sample_id);
      formDataObj.append('sample_description', formData.sample_description);
      formDataObj.append('urgency', formData.urgency);
      formDataObj.append('sampling_location', formData.sampling_location);
      formDataObj.append('sampling_date', formData.sampling_date);
      formDataObj.append('deadline', formData.deadline);
      formDataObj.append('special_instructions', formData.special_instructions);
      formDataObj.append('test_types', JSON.stringify(selectedTests));
      formDataObj.append('category_id', selectedCategory);
      formDataObj.append('status', status);
      
      // Add attachment if selected
      if (attachmentFile) {
        formDataObj.append('attachment', attachmentFile);
      }

      if (isEditing) {
        await axios.put(`${API_URL}/requests/${id}`, formDataObj, {
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'multipart/form-data'
          }
        });
        alert(status === 'draft' ? 'Piszkozat mentve!' : 'Kérés frissítve!');
      } else {
        await axios.post(`${API_URL}/requests`, formDataObj, {
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'multipart/form-data'
          }
        });
        alert(status === 'draft' ? 'Piszkozat mentve!' : 'Kérés beküldve!');
      }
      
      navigate('/requests');
    } catch (error) {
      console.error('Error:', error);
      alert('Hiba történt');
    }
  };
  
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-gray-900">
        {isEditing ? 'Laborkérés szerkesztése' : 'Új laborkérés'}
      </h1>

      <form onSubmit={(e) => handleSubmit(e, 'pending_approval')} className="bg-white rounded-lg shadow p-6 space-y-4">
        
        {/* Existing fields... */}
        
        {/* CATEGORY SELECT - INSERT AFTER SAMPLE_ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kategória *
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
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
        
        {/* ... other existing fields ... */}
        
        {/* FILE ATTACHMENT - INSERT BEFORE BUTTONS */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Melléklet (max 20 MB)
          </label>
          <div className="mt-1 flex items-center gap-2">
            <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
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
                <span className="text-sm text-indigo-700">{attachmentFile.name}</span>
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
          <p className="text-xs text-gray-500 mt-1">
            Támogatott: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG
          </p>
        </div>
        
        {/* Buttons... */}
      </form>
    </div>
  );
}
```

---

### 4. RequestList - Kategória megjelenítés + szűrés

**Fájl:** `frontend/src/components/RequestList.js`

**Hozzáadások:**

```javascript
function RequestList() {
  // ... existing state
  const [categories, setCategories] = useState([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  
  useEffect(() => {
    fetchCategories();
    // ... existing
  }, []);
  
  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API_URL}/categories`, {
        headers: getAuthHeaders()
      });
      setCategories(response.data);
    } catch (error) {
      console.error('Error:', error);
    }
  };
  
  // Modify filtering
  useEffect(() => {
    let result = requests;
    
    // ... existing filters (status, search)
    
    // Category filter
    if (selectedCategoryFilter !== 'all') {
      result = result.filter(req => 
        req.category && req.category.id === parseInt(selectedCategoryFilter)
      );
    }
    
    setFilteredRequests(result);
  }, [requests, selectedStatusFilter, searchQuery, selectedCategoryFilter]);
  
  return (
    <div className="space-y-4">
      {/* ... existing header ... */}
      
      {/* FILTERS - ADD CATEGORY FILTER */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid md:grid-cols-3 gap-4">
          {/* Existing status filter */}
          
          {/* Existing search */}
          
          {/* NEW: Category filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kategória
            </label>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Összes kategória</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {/* REQUEST CARDS - ADD CATEGORY BADGE */}
      {filteredRequests.map((request) => (
        <div key={request.id} className="bg-white rounded-lg shadow p-4 hover:bg-gray-50">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-bold text-gray-900">
                  {request.sample_id}
                </h3>
                
                {/* STATUS BADGE */}
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(request.status)}`}>
                  {getStatusText(request.status)}
                </span>
                
                {/* CATEGORY BADGE - NEW! */}
                {request.category && (
                  <span
                    className="px-2 py-1 text-xs font-medium text-white rounded-full"
                    style={{ backgroundColor: request.category.color }}
                  >
                    {request.category.name}
                  </span>
                )}
              </div>
              
              {/* ... rest of card ... */}
```

---

### 5. RequestDetailsModal - Melléklet letöltés

**Fájl:** `frontend/src/components/RequestDetailsModal.js`

**Hozzáadás a részletek megjelenítéséhez:**

```javascript
import { Download, Paperclip } from 'lucide-react';

// Inside modal, after special instructions:

{request.category && (
  <div>
    <span className="font-medium text-gray-700">Kategória:</span>
    <span
      className="ml-2 px-2 py-1 text-xs font-medium text-white rounded-full"
      style={{ backgroundColor: request.category.color }}
    >
      {request.category.name}
    </span>
  </div>
)}

{request.attachment_filename && (
  <div>
    <span className="font-medium text-gray-700">Melléklet:</span>
    <button
      onClick={() => {
        window.open(`${API_URL}/requests/${request.id}/attachment`, '_blank');
      }}
      className="ml-2 inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100"
    >
      <Paperclip className="w-4 h-4" />
      <span className="text-sm">{request.attachment_filename}</span>
      <Download className="w-4 h-4" />
    </button>
  </div>
)}
```

---

### 6. Dashboard - Kategória statisztika

**Fájl:** `frontend/src/components/Dashboard.js`

**Hozzáadás:**

```javascript
// In fetchStats:
const response = await axios.get(`${API_URL}/stats`, {...});
setStats(response.data);

// In JSX, add new card:
<div className="bg-white rounded-lg shadow p-6">
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-lg font-semibold text-gray-900">Kategóriák szerint</h3>
    <Tag className="w-8 h-8 text-purple-600" />
  </div>
  
  <div className="space-y-2">
    {Object.entries(stats.by_category || {}).map(([category, count]) => (
      <div key={category} className="flex items-center justify-between">
        <span className="text-sm text-gray-600">{category}</span>
        <span className="font-semibold text-gray-900">{count} db</span>
      </div>
    ))}
  </div>
</div>
```

---

### 7. Layout - Kategóriák menüpont

**Fájl:** `frontend/src/components/Layout.js`

**Szervezeti adatok csoportba:**

```javascript
{
  title: 'Szervezeti adatok',
  items: [
    { name: 'Szervezeti egységek', href: '/departments', icon: Building2 },
    { name: 'Vizsgálattípusok', href: '/test-types', icon: TestTube },
    { name: 'Kategóriák', href: '/categories', icon: Tag },  // ÚJ!
    { name: 'Cégek', href: '/companies', icon: Building },
    { name: 'Felhasználók', href: '/users', icon: Users }
  ]
}
```

---

### 8. App.js - Kategóriák route

**Fájl:** `frontend/src/App.js`

```javascript
import CategoryManagement from './components/CategoryManagement';

// Add route:
<Route 
  path="categories" 
  element={
    <PrivateRoute allowedRoles={['super_admin']}>
      <CategoryManagement />
    </PrivateRoute>
  } 
/>
```

---

## 📦 FÁJLOK ÖSSZEFOGLALÓJA

### Backend (KÉSZ ✅):
```
backend/
├── app.py              ← Categories + Attachments
└── requirements.txt
```

### Frontend (MÓDOSÍTANDÓ):
```
frontend/src/
├── App.js                          ← + categories route
├── components/
│   ├── CategoryManagement.js      ← ÚJ komponens
│   ├── Login.js                    ← + MOL logó
│   ├── Layout.js                   ← + Kategóriák menü
│   ├── RequestForm.js              ← + kategória + fájl
│   ├── RequestList.js              ← + kategória badge + szűrő
│   ├── RequestDetailsModal.js     ← + kategória + melléklet
│   └── Dashboard.js                ← + kategória stats
```

---

## 🚀 TELEPÍTÉS

### 1. Backend:
```powershell
cd lab-request-system-v4.0\backend
python -m pip install -r requirements.txt
python app.py
```

### 2. Frontend:
```powershell
# Másold v3.1-ből:
cp -r lab-request-system-v3.1/frontend/* lab-request-system-v4.0/frontend/

# Alkalmazzd a fenti módosításokat!

cd lab-request-system-v4.0\frontend
npm install
npm start
```

---

## ✅ TESZTELÉS

### 1. Kategóriák:
```
admin@pannon.hu → Kategóriák → Új → Létrehozás
```

### 2. Kategória használata:
```
user@mol.hu → Új kérés → Kategória kiválasztása → Mentés
```

### 3. Fájl melléklet:
```
Új kérés → Fájl kiválasztása → PDF feltöltés → Mentés
Részletek → Melléklet letöltése
```

### 4. MOL logó:
```
Kijelentkezés → Login oldalon látható a MOL logó
```

---

## 🎉 KÉSZ!

**v4.0 = v3.1 + 4 új funkció!**

✅ Request Categories  
✅ File Attachments  
✅ Category-based Design  
✅ Company Logo on Login  

---

**Verzió:** 4.0.0  
**Készítette:** Claude AI  
**Dátum:** 2024-11-21
