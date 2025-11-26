import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  ArrowLeft,
  Save,
  Send,
  FileText,
  Upload,
  Check,
  Clock,
  AlertCircle,
  Download,
  X
} from 'lucide-react';

function TestResultsPanel() {
  const { user, getAuthHeaders, API_URL } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [request, setRequest] = useState(null);
  const [testResults, setTestResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState({});

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [reqRes, resultsRes] = await Promise.all([
        axios.get(`${API_URL}/requests/${id}`, { headers: getAuthHeaders() }),
        axios.get(`${API_URL}/requests/${id}/test-results`, { headers: getAuthHeaders() })
      ]);
      
      setRequest(reqRes.data);
      setTestResults(resultsRes.data);
    } catch (error) {
      console.error('Adatlekérési hiba:', error);
      alert('Hiba történt az adatok betöltése során');
    } finally {
      setLoading(false);
    }
  };

  const handleResultChange = (testTypeId, value) => {
    setTestResults(prev => prev.map(tr =>
      tr.test_type_id === testTypeId
        ? { ...tr, result_text: value }
        : tr
    ));
  };

  const saveResult = async (testResult) => {
    if (!testResult.can_edit) {
      alert('Nincs jogosultságod szerkeszteni ezt a vizsgálatot!');
      return;
    }

    setSaving(true);
    try {
      await axios.post(`${API_URL}/test-results`, {
        lab_request_id: parseInt(id),
        test_type_id: testResult.test_type_id,
        result_text: testResult.result_text,
        status: 'completed'
      }, {
        headers: getAuthHeaders()
      });
      
      // Frissítjük a lokális státuszt
      setTestResults(prev => prev.map(tr =>
        tr.test_type_id === testResult.test_type_id
          ? { ...tr, status: 'completed', completed_by: user.name, completed_at: new Date().toISOString() }
          : tr
      ));
      
      alert('Eredmény mentve!');
    } catch (error) {
      console.error('Mentési hiba:', error);
      alert(error.response?.data?.message || 'Hiba történt a mentés során');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (testResult, event) => {
    if (!testResult.can_edit) {
      alert('Nincs jogosultságod fájlt feltölteni!');
      return;
    }

    const file = event.target.files[0];
    if (!file) return;

    // 50MB limit ellenőrzése
    if (file.size > 50 * 1024 * 1024) {
      alert('A fájl mérete maximum 50MB lehet!');
      return;
    }

    if (!testResult.result_id) {
      alert('Először mentsd el az eredményt!');
      return;
    }

    setUploadingFiles(prev => ({ ...prev, [testResult.test_type_id]: true }));
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post(
        `${API_URL}/test-results/${testResult.result_id}/attachment`,
        formData,
        {
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      // Frissítjük a lokális állapotot
      setTestResults(prev => prev.map(tr =>
        tr.test_type_id === testResult.test_type_id
          ? { ...tr, attachment_filename: file.name }
          : tr
      ));
      
      alert('Fájl feltöltve!');
    } catch (error) {
      console.error('Feltöltési hiba:', error);
      alert(error.response?.data?.message || 'Hiba történt a feltöltés során');
    } finally {
      setUploadingFiles(prev => ({ ...prev, [testResult.test_type_id]: false }));
    }
  };

  const downloadAttachment = async (resultId, filename) => {
    try {
      const response = await axios.get(
        `${API_URL}/test-results/${resultId}/attachment`,
        {
          headers: getAuthHeaders(),
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Letöltési hiba:', error);
      alert('Hiba történt a fájl letöltése során');
    }
  };

  const submitForValidation = async () => {
    // Ellenőrizzük, hogy minden saját vizsgálat ki van-e töltve
    const myIncompleteTests = testResults.filter(
      tr => tr.can_edit && tr.status !== 'completed'
    );

    if (myIncompleteTests.length > 0) {
      alert(`Még ${myIncompleteTests.length} vizsgálat nincs kitöltve!`);
      return;
    }

    if (!window.confirm('Biztosan validálásra küldöd? Ezután már nem szerkesztheted!')) {
      return;
    }

    setSaving(true);
    try {
      await axios.post(
        `${API_URL}/requests/${id}/submit-validation`,
        {},
        { headers: getAuthHeaders() }
      );
      
      alert('Kérés validálásra küldve!');
      navigate('/worklist');
    } catch (error) {
      console.error('Küldési hiba:', error);
      alert(error.response?.data?.message || 'Hiba történt a küldés során');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Betöltés...</div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-red-600">Laborkérés nem található</div>
      </div>
    );
  }

  const myTests = testResults.filter(tr => tr.can_edit);
  const completedCount = myTests.filter(tr => tr.status === 'completed').length;
  const progress = myTests.length > 0 ? Math.round((completedCount / myTests.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/worklist')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {request.request_number}
                </h1>
                <p className="text-sm text-gray-600">
                  {completedCount} / {myTests.length} vizsgálat elkészült ({progress}%)
                </p>
              </div>
            </div>

            <button
              onClick={submitForValidation}
              disabled={saving || completedCount < myTests.length}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                completedCount < myTests.length
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              <Send className="w-4 h-4" />
              Validálásra küldés
            </button>
          </div>
        </div>
      </div>

      {/* Split Screen Layout */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* BAL OLDAL - Kérés adatok (readonly) */}
          <div className="bg-white rounded-lg shadow p-6 h-fit sticky top-24">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Laborkérés adatok</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Azonosító</label>
                <p className="text-gray-900">{request.request_number}</p>
              </div>

              {request.internal_id && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Céges azonosító</label>
                  <p className="text-gray-900">{request.internal_id}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-600">Minta leírása</label>
                <p className="text-gray-900">{request.sample_description}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Cég</label>
                <p className="text-gray-900">{request.company_name}</p>
              </div>

              {request.sampling_location && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Mintavétel helye</label>
                  <p className="text-gray-900">{request.sampling_location}</p>
                </div>
              )}

              {request.contact_person && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Kontakt</label>
                  <p className="text-gray-900">
                    {request.contact_person}
                    {request.contact_phone && ` (${request.contact_phone})`}
                  </p>
                </div>
              )}

              {request.deadline && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Határidő</label>
                  <p className="text-orange-600 font-medium">
                    {new Date(request.deadline).toLocaleDateString('hu-HU')}
                  </p>
                </div>
              )}

              {request.special_instructions && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Különleges utasítások</label>
                  <p className="text-gray-900 text-sm">{request.special_instructions}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-600 mb-2 block">
                  Összes kért vizsgálat
                </label>
                <div className="space-y-1">
                  {request.test_types?.map((tt, idx) => (
                    <div key={idx} className="text-sm text-gray-700 flex items-center gap-2">
                      <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                      {tt.name}
                      {tt.department_name && (
                        <span className="text-xs text-gray-500">({tt.department_name})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* JOBB OLDAL - Saját vizsgálatok kitöltése */}
          <div className="space-y-4">
            <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-indigo-900 mb-2">
                Saját vizsgálatok ({user.department?.name || 'Szervezeti egység'})
              </h2>
              <p className="text-sm text-indigo-700">
                Csak az alábbi vizsgálatokat töltheted ki, amelyek a te szervezeti egységedhez tartoznak.
              </p>
            </div>

            {myTests.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>Nincs olyan vizsgálat, ami a te szervezeti egységedhez tartozik.</p>
              </div>
            ) : (
              myTests.map((testResult) => (
                <div key={testResult.test_type_id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {testResult.test_type_name}
                      </h3>
                      {testResult.test_type_description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {testResult.test_type_description}
                        </p>
                      )}
                    </div>
                    {testResult.status === 'completed' && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                        <Check className="w-3 h-3" />
                        Elkészült
                      </span>
                    )}
                  </div>

                  {/* Eredmény textarea */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Eredmény *
                    </label>
                    <textarea
                      value={testResult.result_text || ''}
                      onChange={(e) => handleResultChange(testResult.test_type_id, e.target.value)}
                      rows="4"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Írd be a vizsgálat eredményét..."
                      disabled={!testResult.can_edit}
                    />
                  </div>

                  {/* Fájl feltöltés */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Melléklet (max 50MB)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        id={`file-${testResult.test_type_id}`}
                        onChange={(e) => handleFileUpload(testResult, e)}
                        className="hidden"
                        disabled={!testResult.can_edit || !testResult.result_id}
                      />
                      <label
                        htmlFor={`file-${testResult.test_type_id}`}
                        className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition-colors ${
                          !testResult.can_edit || !testResult.result_id
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <Upload className="w-4 h-4" />
                        {uploadingFiles[testResult.test_type_id] ? 'Feltöltés...' : 'Fájl kiválasztása'}
                      </label>
                      {testResult.attachment_filename && (
                        <button
                          onClick={() => downloadAttachment(testResult.result_id, testResult.attachment_filename)}
                          className="flex items-center gap-2 px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          {testResult.attachment_filename}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mentés gomb */}
                  <button
                    onClick={() => saveResult(testResult)}
                    disabled={saving || !testResult.result_text?.trim() || !testResult.can_edit}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      !testResult.result_text?.trim() || !testResult.can_edit
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    <Save className="w-4 h-4" />
                    {testResult.status === 'completed' ? 'Frissítés' : 'Mentés és Elkészültnek jelölés'}
                  </button>

                  {testResult.completed_by && (
                    <div className="mt-3 text-xs text-gray-500">
                      Kitöltötte: {testResult.completed_by} • {new Date(testResult.completed_at).toLocaleString('hu-HU')}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TestResultsPanel;
