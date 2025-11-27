import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X,
  AlertCircle,
  TestTube,
  Clock,
  Beaker,
  FileText,
  Eye,
  EyeOff,
  Download,     // v7.0.15: Export
  Upload,       // v7.0.15: Import
  Database      // v7.0.15: Full DB export
} from 'lucide-react';

function TestTypeManagement() {
  const { getAuthHeaders, API_URL } = useAuth();
  const [testTypes, setTestTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  
  // v7.0.15: Export/Import state
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef(null);
  
  // v6.8 - Kibővített formData az összes mezővel
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    standard: '',
    price: '',
    cost_price: '',
    department_id: '',
    category_id: '',
    device: '',
    turnaround_days: '',
    turnaround_time: '',
    measurement_time: '',
    sample_prep_time: '',
    sample_prep_required: false,
    sample_prep_description: '',
    evaluation_time: '',
    sample_quantity: '',
    hazard_level: '',
    is_active: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [testTypesRes, departmentsRes, categoriesRes] = await Promise.all([
        axios.get(`${API_URL}/test-types`, { headers: getAuthHeaders() }),
        axios.get(`${API_URL}/departments`, { headers: getAuthHeaders() }),
        axios.get(`${API_URL}/categories`, { headers: getAuthHeaders() })
      ]);
      setTestTypes(testTypesRes.data);
      setDepartments(departmentsRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetFormData = () => ({
    name: '',
    description: '',
    standard: '',
    price: '',
    cost_price: '',
    department_id: '',
    category_id: '',
    device: '',
    turnaround_days: '',
    turnaround_time: '',
    measurement_time: '',
    sample_prep_time: '',
    sample_prep_required: false,
    sample_prep_description: '',
    evaluation_time: '',
    sample_quantity: '',
    hazard_level: '',
    is_active: true
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // v6.8 - Biztosítjuk, hogy minden mező el legyen küldve
    const dataToSend = {
      ...formData,
      // Biztosítjuk, hogy numerikus mezők számként kerüljenek elküldésre
      price: formData.price ? parseFloat(formData.price) : null,
      cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
      turnaround_days: formData.turnaround_days ? parseInt(formData.turnaround_days) : null,
      turnaround_time: formData.turnaround_time ? parseFloat(formData.turnaround_time) : null,
      measurement_time: formData.measurement_time ? parseFloat(formData.measurement_time) : null,
      sample_prep_time: formData.sample_prep_time ? parseFloat(formData.sample_prep_time) : null,
      evaluation_time: formData.evaluation_time ? parseFloat(formData.evaluation_time) : null,
      sample_quantity: formData.sample_quantity ? parseFloat(formData.sample_quantity) : null,
      department_id: formData.department_id || null,
      category_id: formData.category_id || null
    };

    try {
      if (editingId) {
        await axios.put(
          `${API_URL}/test-types/${editingId}`,
          dataToSend,
          { headers: getAuthHeaders() }
        );
      } else {
        await axios.post(
          `${API_URL}/test-types`,
          dataToSend,
          { headers: getAuthHeaders() }
        );
      }
      
      setShowModal(false);
      setEditingId(null);
      setFormData(resetFormData());
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Hiba történt a művelet során');
    }
  };

  const handleEdit = (testType) => {
    setEditingId(testType.id);
    setFormData({
      name: testType.name || '',
      description: testType.description || '',
      standard: testType.standard || '',
      price: testType.price || '',
      cost_price: testType.cost_price || '',
      department_id: testType.department_id || '',
      category_id: testType.category_id || '',
      device: testType.device || '',
      turnaround_days: testType.turnaround_days || '',
      turnaround_time: testType.turnaround_time || '',
      measurement_time: testType.measurement_time || '',
      sample_prep_time: testType.sample_prep_time || '',
      sample_prep_required: testType.sample_prep_required || false,
      sample_prep_description: testType.sample_prep_description || '',
      evaluation_time: testType.evaluation_time || '',
      sample_quantity: testType.sample_quantity || '',
      hazard_level: testType.hazard_level || '',
      is_active: testType.is_active !== undefined ? testType.is_active : true
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Biztosan törölni szeretnéd ezt a vizsgálattípust?')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/test-types/${id}`, {
        headers: getAuthHeaders()
      });
      fetchData();
    } catch (error) {
      alert(error.response?.data?.message || 'Hiba történt a törlés során');
    }
  };

  const toggleActive = async (testType) => {
    try {
      await axios.put(
        `${API_URL}/test-types/${testType.id}`,
        { ...testType, is_active: !testType.is_active },
        { headers: getAuthHeaders() }
      );
      fetchData();
    } catch (error) {
      alert('Hiba történt a státusz váltás során');
    }
  };

  // v7.0.15: Export/Import függvények
  const handleExport = async (format, fullDatabase = false) => {
    try {
      const endpoint = fullDatabase ? '/export/full-database' : '/export/test-types';
      const response = await axios.get(`${API_URL}${endpoint}?format=${format}`, {
        headers: getAuthHeaders(),
        responseType: format === 'json' ? 'json' : 'blob'
      });

      if (format === 'json') {
        // JSON letöltés
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fullDatabase ? 'full_database' : 'test_types'}_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        // CSV vagy Excel letöltés
        const url = URL.createObjectURL(response.data);
        const link = document.createElement('a');
        link.href = url;
        const ext = format === 'csv' ? 'csv' : 'xlsx';
        link.download = `${fullDatabase ? 'full_database' : 'test_types'}_${new Date().toISOString().split('T')[0]}.${ext}`;
        link.click();
        URL.revokeObjectURL(url);
      }

      setShowExportMenu(false);
      alert('Export sikeres!');
    } catch (error) {
      console.error('Export hiba:', error);
      alert('Hiba történt az export során');
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!window.confirm(`Biztosan importálod a(z) ${file.name} fájlt? Ez módosíthatja a meglévő adatokat!`)) {
      event.target.value = '';
      return;
    }

    setImportLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/import/test-types`, formData, {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'multipart/form-data'
        }
      });

      alert(`Import sikeres!\n- Létrehozva: ${response.data.created}\n- Frissítve: ${response.data.updated}\n${response.data.errors.length > 0 ? '- Hibák: ' + response.data.errors.join(', ') : ''}`);
      fetchData();
    } catch (error) {
      console.error('Import hiba:', error);
      alert('Hiba történt az import során: ' + (error.response?.data?.error || error.message));
    } finally {
      setImportLoading(false);
      event.target.value = '';
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vizsgálattípusok kezelése</h1>
          <p className="text-sm text-gray-600 mt-1">Vizsgálatok, árak és paraméterek karbantartása</p>
        </div>
        
        {/* v7.0.15: Action gombok (Export, Import, Új) */}
        <div className="flex gap-2">
          {/* Export dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-5 h-5" />
              Export
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-10">
                <div className="p-2">
                  <p className="text-xs font-semibold text-gray-600 uppercase px-2 py-1">Vizsgálattípusok</p>
                  <button
                    onClick={() => handleExport('json', false)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm"
                  >
                    📄 JSON formátum
                  </button>
                  <button
                    onClick={() => handleExport('csv', false)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm"
                  >
                    📊 CSV formátum
                  </button>
                  <button
                    onClick={() => handleExport('excel', false)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm"
                  >
                    📗 Excel formátum
                  </button>
                  
                  <div className="border-t border-gray-200 my-2"></div>
                  
                  <p className="text-xs font-semibold text-gray-600 uppercase px-2 py-1">Teljes adatbázis</p>
                  <button
                    onClick={() => handleExport('json', true)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm flex items-center gap-2"
                  >
                    <Database className="w-4 h-4" />
                    JSON (teljes)
                  </button>
                  <button
                    onClick={() => handleExport('excel', true)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm flex items-center gap-2"
                  >
                    <Database className="w-4 h-4" />
                    Excel (teljes)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Import gomb */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importLoading}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Upload className="w-5 h-5" />
            {importLoading ? 'Import...' : 'Import'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv,.xlsx,.xls"
            onChange={handleImport}
            className="hidden"
          />

          {/* Új vizsgálat gomb */}
          <button
            onClick={() => {
              setEditingId(null);
              setFormData(resetFormData());
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Új vizsgálat
          </button>
        </div>
      </div>

      {/* v6.8 - Teljes táblázat oszlopokkal */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Név</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Leírás</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Szervezeti egység</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategória</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ár (Ft)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Átfutási idő (nap)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aktív</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Műveletek</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {testTypes.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                    <TestTube className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>Még nincsenek vizsgálattípusok</p>
                  </td>
                </tr>
              ) : (
                testTypes.map((testType) => (
                  <tr key={testType.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{testType.name}</div>
                      {testType.standard && (
                        <div className="text-xs text-blue-600">{testType.standard}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-600 max-w-xs truncate">
                        {testType.description || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">
                        {testType.department_name || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {testType.category_name ? (
                        <span 
                          className="px-2 py-1 text-xs font-medium rounded-full"
                          style={{ 
                            backgroundColor: `${testType.category_color}20`, 
                            color: testType.category_color 
                          }}
                        >
                          {testType.category_name}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-gray-900">
                        {testType.price ? `${testType.price.toLocaleString('hu-HU')}` : '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        {testType.turnaround_days || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(testType)}
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          testType.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {testType.is_active ? 'Aktív' : 'Inaktív'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(testType)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Szerkesztés"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(testType.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Törlés"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal - v6.8 javított űrlap */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {editingId ? 'Vizsgálat szerkesztése' : 'Új vizsgálat hozzáadása'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingId(null);
                  setFormData(resetFormData());
                  setError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {error && (
              <div className="mx-6 mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* v6.8 - Alap információk - LÁTHATÓ A LABORKÉRŐ LAPON */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-900">Megjelenik a laborkérő lapon</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vizsgálat neve *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ár (Ft) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Leírás
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Kategória *
                    </label>
                    <select
                      required
                      value={formData.category_id}
                      onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Válassz kategóriát</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Átfutási idő (nap)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.turnaround_days}
                      onChange={(e) => setFormData({...formData, turnaround_days: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="pl. 3"
                    />
                  </div>
                </div>
              </div>

              {/* v6.8 - Belső információk - NEM LÁTHATÓ A LABORKÉRŐ LAPON */}
              <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <EyeOff className="w-5 h-5 text-gray-600" />
                  <h3 className="font-semibold text-gray-900">Belső adatok (nem látható a laborkérő lapon)</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Szabvány
                    </label>
                    <input
                      type="text"
                      value={formData.standard}
                      onChange={(e) => setFormData({...formData, standard: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="pl. MSZ EN ISO 3104"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Szervezeti egység
                    </label>
                    <select
                      value={formData.department_id}
                      onChange={(e) => setFormData({...formData, department_id: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Válassz egységet</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Önköltség (Ft)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.cost_price}
                      onChange={(e) => setFormData({...formData, cost_price: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Minta mennyiség (ml)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={formData.sample_quantity}
                      onChange={(e) => setFormData({...formData, sample_quantity: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Veszélyesség
                    </label>
                    <select
                      value={formData.hazard_level}
                      onChange={(e) => setFormData({...formData, hazard_level: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Nincs</option>
                      <option value="low">Alacsony</option>
                      <option value="medium">Közepes</option>
                      <option value="high">Magas</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Készülék
                    </label>
                    <input
                      type="text"
                      value={formData.device}
                      onChange={(e) => setFormData({...formData, device: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Átfutási idő (óra)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.turnaround_time}
                      onChange={(e) => setFormData({...formData, turnaround_time: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mérési idő (óra)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.measurement_time}
                      onChange={(e) => setFormData({...formData, measurement_time: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mintaelőkészítés (óra)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.sample_prep_time}
                      onChange={(e) => setFormData({...formData, sample_prep_time: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Kiértékelés (óra)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.evaluation_time}
                      onChange={(e) => setFormData({...formData, evaluation_time: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="sample_prep_required"
                    checked={formData.sample_prep_required}
                    onChange={(e) => setFormData({...formData, sample_prep_required: e.target.checked})}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="sample_prep_required" className="text-sm text-gray-700">
                    Mintaelőkészítés szükséges
                  </label>
                </div>

                {formData.sample_prep_required && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mintaelőkészítés leírása
                    </label>
                    <textarea
                      value={formData.sample_prep_description}
                      onChange={(e) => setFormData({...formData, sample_prep_description: e.target.value})}
                      rows="2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="is_active" className="text-sm text-gray-700">
                    Aktív vizsgálat (elérhető kérésekhez)
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingId(null);
                    setFormData(resetFormData());
                    setError('');
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Mégse
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {editingId ? 'Mentés' : 'Létrehozás'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TestTypeManagement;
