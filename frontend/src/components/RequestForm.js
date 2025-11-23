import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  AlertCircle, 
  Calendar, 
  MapPin, 
  FileText,
  Save,
  Send,
  Paperclip,
  X,
  AlertTriangle
} from 'lucide-react';

function RequestForm() {
  const { user, getAuthHeaders, API_URL } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const [testTypes, setTestTypes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedTests, setSelectedTests] = useState([]);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [existingAttachment, setExistingAttachment] = useState('');
  const [loading, setLoading] = useState(true);
  const [deadlineWarning, setDeadlineWarning] = useState('');
  const [originalStatus, setOriginalStatus] = useState('');  // v6.6 track original status
  
  const [formData, setFormData] = useState({
    sample_id: '',
    sample_description: '',
    urgency: 'normal',
    sampling_location: '',
    sampling_date: '',
    deadline: '',
    special_instructions: ''
  });

  useEffect(() => {
    fetchTestTypes();
    fetchCategories();
    if (isEditing) {
      loadRequest();
    }
  }, [id]);

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

  const loadRequest = async () => {
    try {
      const response = await axios.get(`${API_URL}/requests/${id}`, {
        headers: getAuthHeaders()
      });
      const req = response.data;
      
      setFormData({
        sample_id: req.sample_id,
        sample_description: req.sample_description,
        urgency: req.urgency,
        sampling_location: req.sampling_location,
        sampling_date: req.sampling_date?.split('T')[0] || '',
        deadline: req.deadline?.split('T')[0] || '',
        special_instructions: req.special_instructions || ''
      });
      
      setSelectedTests(req.test_types.map(tt => tt.id));
      setExistingAttachment(req.attachment_filename || '');
      setOriginalStatus(req.status);  // v6.6 track if it was rejected
    } catch (error) {
      console.error('Error loading request:', error);
      alert('Hiba történt a kérés betöltése során');
      navigate('/requests');
    }
  };

  // Deadline warning check
  useEffect(() => {
    if (selectedTests.length > 0 && formData.sampling_date && formData.deadline) {
      checkDeadlineWarning();
    } else {
      setDeadlineWarning('');
    }
  }, [selectedTests, formData.sampling_date, formData.deadline]);

  const fetchTestTypes = async () => {
    try {
      const response = await axios.get(`${API_URL}/test-types`, {
        headers: getAuthHeaders()
      });
      setTestTypes(response.data.filter(tt => tt.is_active));
    } catch (error) {
      console.error('Error fetching test types:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkDeadlineWarning = () => {
    const samplingDate = new Date(formData.sampling_date);
    const deadline = new Date(formData.deadline);
    
    // Get max turnaround time from selected tests
    const selectedTestTypes = testTypes.filter(tt => selectedTests.includes(tt.id));
    if (selectedTestTypes.length === 0) {
      setDeadlineWarning('');
      return;
    }
    
    const maxTurnaround = Math.max(...selectedTestTypes.map(tt => tt.turnaround_days || 7));
    const expectedCompletion = new Date(samplingDate);
    expectedCompletion.setDate(expectedCompletion.getDate() + maxTurnaround);
    
    if (expectedCompletion > deadline) {
      const daysDiff = Math.ceil((expectedCompletion - deadline) / (1000 * 60 * 60 * 24));
      setDeadlineWarning(
        `A legkésőbbi vizsgálat átfutási ideje ${maxTurnaround} nap. ` +
        `Várható befejezés: ${expectedCompletion.toLocaleDateString('hu-HU')}. ` +
        `Ez ${daysDiff} nappal később van, mint a megadott határidő!`
      );
    } else {
      setDeadlineWarning('');
    }
  };

  const toggleTestType = (testTypeId) => {
    setSelectedTests(prev => 
      prev.includes(testTypeId)
        ? prev.filter(id => id !== testTypeId)
        : [...prev, testTypeId]
    );
  };

  const calculateTotalPrice = () => {
    return selectedTests.reduce((total, testId) => {
      const testType = testTypes.find(tt => tt.id === testId);
      return total + (testType ? testType.price : 0);
    }, 0);
  };

  const handleSubmit = async (e, status = 'pending_approval') => {
    e.preventDefault();

    // Validations
    if (!formData.sample_id || formData.sample_id.trim() === '') {
      alert('Kérlek add meg a Minta azonosítót!');
      return;
    }

    if (selectedTests.length === 0) {
      alert('Kérlek válassz ki legalább egy vizsgálattípust!');
      return;
    }

    // File size check
    if (attachmentFile && attachmentFile.size > 20 * 1024 * 1024) {
      alert('A fájl mérete nem lehet nagyobb 20 MB-nál!');
      return;
    }

    // v6.0: Company admin skips approval → directly to submitted
    // v6.6: If editing a rejected request, keep it rejected
    let finalStatus = status;
    if (user?.role === 'company_admin' && status === 'pending_approval') {
      finalStatus = 'submitted';
    } else if (isEditing && originalStatus === 'rejected') {
      // v6.6: Rejected requests stay rejected after editing
      finalStatus = 'rejected';
    }

    try {
      // Use FormData for v4.0 backend (file upload support)
      const formDataObj = new FormData();
      formDataObj.append('sample_id', formData.sample_id);
      formDataObj.append('sample_description', formData.sample_description);
      formDataObj.append('urgency', formData.urgency);
      formDataObj.append('sampling_location', formData.sampling_location);
      formDataObj.append('sampling_date', formData.sampling_date);
      formDataObj.append('deadline', formData.deadline);
      formDataObj.append('special_instructions', formData.special_instructions);
      formDataObj.append('test_types', JSON.stringify(selectedTests));
      formDataObj.append('status', finalStatus);

      // Add attachment if selected
      if (attachmentFile) {
        formDataObj.append('attachment', attachmentFile);
      }

      if (isEditing) {
        // Update existing request
        await axios.put(`${API_URL}/requests/${id}`, formDataObj, {
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'multipart/form-data'
          }
        });
        alert(finalStatus === 'draft' ? 'Piszkozat frissítve!' : 'Kérés frissítve!');
      } else {
        // Create new request
        await axios.post(`${API_URL}/requests`, formDataObj, {
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'multipart/form-data'
          }
        });
        
        // v6.0: Different message for admin
        if (finalStatus === 'submitted') {
          alert('Laborkérés sikeresen beküldve az egyetemi adminnak!');
        } else if (finalStatus === 'draft') {
          alert('Piszkozat sikeresen mentve!');
        } else {
          alert('Laborkérés sikeresen beküldve jóváhagyásra!');
        }
      }

      navigate('/requests');
    } catch (error) {
      console.error('Error creating request:', error);
      alert(error.response?.data?.message || 'Hiba történt a mentés során');
    }
  };

  const saveDraft = (e) => {
    handleSubmit(e, 'draft');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Betöltés...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditing ? 'Laborkérés szerkesztése' : 'Új laborkérés'}
        </h1>
        <p className="text-gray-600 mt-1">
          {isEditing ? 'Módosítsd az alábbi mezőket' : 'Töltsd ki az alábbi űrlapot a laborkérés beküldéséhez'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Minta információk
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minta azonosító *
              </label>
              <input
                type="text"
                value={formData.sample_id}
                onChange={(e) => setFormData({ ...formData, sample_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
                placeholder="pl. MOL-2024-003"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minta leírása *
            </label>
            <textarea
              value={formData.sample_description}
              onChange={(e) => setFormData({ ...formData, sample_description: e.target.value })}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
              placeholder="Részletes leírás a mintáról..."
            />
          </div>
        </div>

        {/* Priority and Deadlines */}
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

        {/* Location Details */}
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

        {/* Test Types - v6.6 Kategória szerint csoportosítva (VISSZA) */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Vizsgálatok
          </h2>

          {/* Group by Category - v6.6 */}
          {categories.filter(cat => cat.is_active).map((category) => {
            const categoryTests = testTypes.filter(tt => tt.category_id === category.id && tt.is_active);
            if (categoryTests.length === 0) return null;

            return (
              <div key={category.id} className="border border-gray-200 rounded-lg p-4">
                <h3 
                  className="font-semibold text-gray-900 mb-3 pb-2 border-b"
                  style={{ borderColor: category.color, color: category.color }}
                >
                  {category.name}
                </h3>
                <div className="space-y-2">
                  {categoryTests.map((testType) => (
                    <label
                      key={testType.id}
                      className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTests.includes(testType.id)}
                        onChange={() => toggleTestType(testType.id)}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{testType.name}</span>
                          <span className="text-sm font-semibold text-indigo-600">
                            {testType.price.toLocaleString('hu-HU')} Ft
                          </span>
                        </div>
                        {testType.description && (
                          <p className="text-sm text-gray-500 mt-1">{testType.description}</p>
                        )}
                        {testType.turnaround_days && (
                          <p className="text-xs text-gray-400 mt-1">
                            Átfutási idő: {testType.turnaround_days} nap
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Uncategorized tests */}
          {testTypes.filter(tt => !tt.category_id && tt.is_active).length > 0 && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-600 mb-3 pb-2 border-b border-gray-300">
                Egyéb vizsgálatok
              </h3>
              <div className="space-y-2">
                {testTypes.filter(tt => !tt.category_id && tt.is_active).map((testType) => (
                  <label
                    key={testType.id}
                    className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTests.includes(testType.id)}
                      onChange={() => toggleTestType(testType.id)}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <div className="ml-3 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{testType.name}</span>
                        <span className="text-sm font-semibold text-indigo-600">
                          {testType.price.toLocaleString('hu-HU')} Ft
                        </span>
                      </div>
                      {testType.description && (
                        <p className="text-sm text-gray-500 mt-1">{testType.description}</p>
                      )}
                      {testType.turnaround_days && (
                        <p className="text-xs text-gray-400 mt-1">
                          Átfutási idő: {testType.turnaround_days} nap
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {selectedTests.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
              <span className="text-sm font-medium text-indigo-900">Összesen:</span>
              <span className="text-lg font-bold text-indigo-600">
                {calculateTotalPrice().toLocaleString('hu-HU')} Ft
              </span>
            </div>
          )}
        </div>

        {/* Special Instructions */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Speciális utasítások
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              További megjegyzések (opcionális)
            </label>
            <textarea
              value={formData.special_instructions}
              onChange={(e) => setFormData({ ...formData, special_instructions: e.target.value })}
              rows="4"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Speciális kezelési utasítások, kérések..."
            />
          </div>
        </div>

        {/* File Attachment */}
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

        {/* v6.4 - Sticky Action Bar */}
        <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4 z-10">
          <div className="max-w-7xl mx-auto flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/requests')}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Mégse
            </button>
            
            <button
              type="button"
              onClick={saveDraft}
              className="flex items-center gap-2 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Save className="w-5 h-5" />
              Mentés piszkozatként
            </button>
            
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Send className="w-5 h-5" />
              {originalStatus === 'rejected' 
                ? 'Mentés (Elutasított)' 
                : (user?.role === 'company_admin' ? 'Beküldés' : 'Beküldés jóváhagyásra')
              }
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default RequestForm;
