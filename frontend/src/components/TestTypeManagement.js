import React, { useState, useEffect } from 'react';
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
  FileText
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
  
  // v6.7 - Kibővített formData az összes mezővel
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
            setFormData(resetFormData());
            setShowModal(true);
          }}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Új vizsgálattípus
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vizsgálat</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategória</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Átfutás</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ár</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Minta</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Státusz</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Műveletek</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {testTypes.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    <TestTube className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>Még nincsenek vizsgálattípusok</p>
                  </td>
                </tr>
              ) : (
                testTypes.map((testType) => (
                  <tr key={testType.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="flex items-start">
                        <TestTube className="w-5 h-5 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{testType.name}</div>
                          {testType.standard && (
                            <div className="text-xs text-blue-600">{testType.standard}</div>
                          )}
                          {testType.description && (
                            <div className="text-xs text-gray-500 max-w-xs truncate">{testType.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
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
                    <td className="px-4 py-4">
                      <div className="text-sm">
                        {testType.turnaround_time ? (
                          <span className="font-medium">{testType.turnaround_time} óra</span>
                        ) : testType.turnaround_days ? (
                          <span className="font-medium">{testType.turnaround_days} nap</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-semibold text-gray-900">
                        {testType.price ? `${testType.price.toLocaleString('hu-HU')} Ft` : '-'}
                      </div>
                      {testType.cost_price > 0 && (
                        <div className="text-xs text-gray-500">
                          Önkölt: {testType.cost_price.toLocaleString('hu-HU')} Ft
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-600">
                        {testType.sample_quantity || '-'}
                      </div>
                      {testType.sample_prep_required && (
                        <div className="text-xs text-orange-600">Előkész. szüks.</div>
                      )}
                    </td>
                    <td className="px-4 py-4">
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
                    <td className="px-4 py-4 text-right space-x-2">
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
      </div>

      {/* Modal - v6.7 kibővített mezőkkel */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
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

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Alapadatok */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Alapadatok
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
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

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Leírás (mérési szolgáltatás)
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows="2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Szabvány
                    </label>
                    <input
                      type="text"
                      value={formData.standard}
                      onChange={(e) => setFormData({ ...formData, standard: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="pl. ASTM D86, MSZ EN ISO 3104"
                    />
                  </div>

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

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Készülék
                    </label>
                    <input
                      type="text"
                      value={formData.device}
                      onChange={(e) => setFormData({ ...formData, device: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="pl. Anton Paar DMA 4500 M"
                    />
                  </div>
                </div>
              </div>

              {/* Árak */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                  💰 Árak
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Kiajánlási ár (Ft/minta) *
                    </label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Önköltség (Ft/minta)
                    </label>
                    <input
                      type="number"
                      value={formData.cost_price}
                      onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {/* Időadatok */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Időadatok (órában)
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mérési idő
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.measurement_time}
                      onChange={(e) => setFormData({ ...formData, measurement_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Előkészítési idő
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.sample_prep_time}
                      onChange={(e) => setFormData({ ...formData, sample_prep_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Kiértékelés
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.evaluation_time}
                      onChange={(e) => setFormData({ ...formData, evaluation_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Átfutási idő (óra)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.turnaround_time}
                      onChange={(e) => setFormData({ ...formData, turnaround_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Átfutási idő (napokban)
                  </label>
                  <input
                    type="number"
                    value={formData.turnaround_days}
                    onChange={(e) => setFormData({ ...formData, turnaround_days: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    min="1"
                    max="365"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Minta beérkezésétől számított munkanapok száma
                  </p>
                </div>
              </div>

              {/* Minta adatok */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                  <Beaker className="w-4 h-4" />
                  Minta adatok
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Minta mennyiség
                    </label>
                    <input
                      type="text"
                      value={formData.sample_quantity}
                      onChange={(e) => setFormData({ ...formData, sample_quantity: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="pl. 50-100 mg, 1-4 g"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Veszélyesség
                    </label>
                    <input
                      type="text"
                      value={formData.hazard_level}
                      onChange={(e) => setFormData({ ...formData, hazard_level: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="pl. Nem veszélyes, Gyúlékony"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                      <input
                        type="checkbox"
                        id="sample_prep_required"
                        checked={formData.sample_prep_required}
                        onChange={(e) => setFormData({ ...formData, sample_prep_required: e.target.checked })}
                        className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                      />
                      <label htmlFor="sample_prep_required" className="text-sm font-medium text-gray-700">
                        Mintaelőkészítés szükséges
                      </label>
                    </div>
                  </div>

                  {formData.sample_prep_required && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Mintaelőkészítés típusa
                      </label>
                      <input
                        type="text"
                        value={formData.sample_prep_description}
                        onChange={(e) => setFormData({ ...formData, sample_prep_description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="pl. Szárítás, mosás, Savas feltárás"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Státusz */}
              {editingId && (
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                    Aktív státusz (csak aktív vizsgálatok jelennek meg a kérőlapon)
                  </label>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
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
