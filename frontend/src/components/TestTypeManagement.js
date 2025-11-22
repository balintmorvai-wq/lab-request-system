import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X,
  AlertCircle,
  TestTube
} from 'lucide-react';

function TestTypeManagement() {
  const { getAuthHeaders, API_URL } = useAuth();
  const [testTypes, setTestTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);  // v6.6 VISSZA
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    department_id: '',
    category_id: '',
    
    turnaround_days: '7'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [testTypesRes, departmentsRes, categoriesRes] = await Promise.all([
        axios.get(`${API_URL}/test-types`, { headers: getAuthHeaders() }),
        axios.get(`${API_URL}/departments`, { headers: getAuthHeaders() }),
        axios.get(`${API_URL}/categories`, { headers: getAuthHeaders() })  // v6.6 VISSZA
      ]);
      setTestTypes(testTypesRes.data);
      setDepartments(departmentsRes.data);
      setCategories(categoriesRes.data);  // v6.6 VISSZA
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (editingId) {
        await axios.put(
          `${API_URL}/test-types/${editingId}`,
          formData,
          { headers: getAuthHeaders() }
        );
      } else {
        await axios.post(
          `${API_URL}/test-types`,
          formData,
          { headers: getAuthHeaders() }
        );
      }
      
      setShowModal(false);
      setEditingId(null);
      setFormData({ name: '', description: '', price: '', department_id: '', category_id: '', turnaround_days: '7' });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Hiba történt a művelet során');
    }
  };

  const handleEdit = (testType) => {
    setEditingId(testType.id);
    setFormData({
      name: testType.name,
      description: testType.description,
      price: testType.price,
      department_id: testType.department_id || '',
      
      category_id: testType.category_id || '',
      turnaround_days: testType.turnaround_days || 7
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
        { is_active: !testType.is_active },
        { headers: getAuthHeaders() }
      );
      fetchData();
    } catch (error) {
      alert('Hiba történt a státusz váltás során');
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vizsgálattípusok</h1>
          <p className="text-gray-600 mt-1">
            Összesen {testTypes.length} vizsgálattípus
          </p>
        </div>

        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ name: '', description: '', price: '', department_id: '', category_id: '', turnaround_days: '7' });
            setShowModal(true);
          }}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Új vizsgálattípus
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vizsgálat neve</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Szervezeti egység</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Átfutás (nap)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ár</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Státusz</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Műveletek</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {testTypes.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                  <TestTube className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>Még nincsenek vizsgálattípusok</p>
                </td>
              </tr>
            ) : (
              testTypes.map((testType) => (
                <tr key={testType.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <TestTube className="w-5 h-5 text-gray-400 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{testType.name}</div>
                        {testType.description && (
                          <div className="text-xs text-gray-500">{testType.description}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{testType.department_name || '-'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{testType.turnaround_days} nap</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-gray-900">
                      {testType.price.toLocaleString('hu-HU')} Ft
                    </div>
                  </td>
                  <td className="px-6 py-4">
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
                  <td className="px-6 py-4 text-right space-x-4">
                    <button
                      onClick={() => handleEdit(testType)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      <Edit2 className="w-5 h-5 inline" />
                    </button>
                    <button
                      onClick={() => handleDelete(testType.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-5 h-5 inline" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingId ? 'Vizsgálattípus szerkesztése' : 'Új vizsgálattípus'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
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
                  Vizsgálat neve *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Szakmai leírás
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Pl. ASTM D4294 szabvány szerint..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Szervezeti egység
                </label>
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">-- Nincs megadva --</option>
                  {departments.filter(d => d.is_active).map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              {/* v6.6 - Szakmai kategória dropdown VISSZA */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Szakmai kategória
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">-- Nincs megadva --</option>
                  {categories.filter(c => c.is_active).map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Várható átfutási idő (napokban) *
                </label>
                <input
                  type="number"
                  value={formData.turnaround_days}
                  onChange={(e) => setFormData({ ...formData, turnaround_days: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                  min="1"
                  max="365"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Minta beérkezésétől számított munkanapok száma
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ár (Ft) *
                </label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                  min="0"
                  step="1000"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {editingId ? 'Mentés' : 'Létrehozás'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setError('');
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
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

export default TestTypeManagement;
