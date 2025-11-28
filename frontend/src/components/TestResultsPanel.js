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
  CheckCircle,  // v7.0.5: Readonly mode header
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

  // v7.0.3: Admin validation functions
  const validateResult = async (resultId, action, rejectionReason = '') => {
    setSaving(true);
    try {
      await axios.put(
        `${API_URL}/test-results/${resultId}/validate`,
        { action, rejection_reason: rejectionReason },
        { headers: getAuthHeaders() }
      );
      
      // Refresh data
      await fetchData();
      
      const message = action === 'approve' ? 'Eredmény elfogadva!' : 'Eredmény visszaküldve javításra!';
      alert(message);
    } catch (error) {
      console.error('Validálási hiba:', error);
      alert(error.response?.data?.message || 'Hiba történt a validálás során');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = (resultId) => {
    if (window.confirm('Biztosan elfogadod ezt az eredményt?')) {
      validateResult(resultId, 'approve');
    }
  };

  const handleReject = (resultId) => {
    const reason = prompt('Add meg az elutasítás okát:');
    if (reason !== null && reason.trim() !== '') {
      validateResult(resultId, 'reject', reason);
    }
  };

  const completeValidation = async () => {
    // Check if all results are validated
    const unvalidatedResults = testResults.filter(tr => tr.status !== 'completed');
    
    if (unvalidatedResults.length > 0) {
      alert(`Még ${unvalidatedResults.length} vizsgálat nincs validálva!`);
      return;
    }

    if (!window.confirm('Minden vizsgálat validálva van. Lezárod a kérést?')) {
      return;
    }

    setSaving(true);
    try {
      await axios.post(
        `${API_URL}/requests/${id}/complete-validation`,
        {},
        { headers: getAuthHeaders() }
      );
      
      alert('Kérés sikeresen lezárva!');
      navigate('/worklist');
    } catch (error) {
      console.error('Lezárási hiba:', error);
      alert(error.response?.data?.message || 'Hiba történt a lezárás során');
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

  const myTests = testResults.filter(tr => tr.can_edit || user?.role === 'super_admin');
  const completedCount = myTests.filter(tr => tr.status === 'completed').length;
  const progress = myTests.length > 0 ? Math.round((completedCount / myTests.length) * 100) : 0;
  
  // v7.0.3: Admin validation mode
  const isAdminValidationMode = user?.role === 'super_admin' && request.status === 'validation_pending';
  
  // v7.0.4 FINAL: Readonly mode if completed
  const isReadOnlyMode = request.status === 'completed';

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
                  {isAdminValidationMode 
                    ? `${completedCount} / {testResults.length} vizsgálat validálva ({progress}%)`
                    : `${completedCount} / ${myTests.length} vizsgálat elkészült ({progress}%)`
                  }
                </p>
              </div>
            </div>

            {/* v7.0.4 FINAL: Header gomb - csak ha nem completed */}
            {request.status !== 'completed' && (
              <>
                {isAdminValidationMode ? (
                  <button
                    onClick={completeValidation}
                    disabled={saving || completedCount < testResults.length}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      completedCount < testResults.length
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    Kérés lezárása
                  </button>
                ) : (
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
                )}
              </>
            )}
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

          {/* JOBB OLDAL - Saját vizsgálatok VAGY Admin validation VAGY Readonly */}
          <div className="space-y-4">
            {isReadOnlyMode ? (
              <>
                {/* v7.0.4 FINAL: Readonly mode - completed kérés */}
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                  <h2 className="text-lg font-semibold text-green-900 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Elkészült vizsgálatok
                  </h2>
                  <p className="text-sm text-green-700">
                    Ez a kérés lezárva. Az eredmények megtekinthetők, de nem szerkeszthetők.
                  </p>
                </div>

                {testResults.length === 0 ? (
                  <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>Nincs vizsgálat ebben a kérésben.</p>
                  </div>
                ) : (
                  testResults.map((testResult) => (
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
                          {testResult.test_type_department && (
                            <p className="text-xs text-gray-500 mt-1">
                              Szervezeti egység: {testResult.test_type_department}
                            </p>
                          )}
                        </div>
                        <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                          <Check className="w-3 h-3" />
                          Elkészült
                        </span>
                      </div>

                      {/* Eredmény (readonly) */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Eredmény
                        </label>
                        <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 min-h-[100px] whitespace-pre-wrap">
                          {testResult.result_text || <span className="text-gray-400">Nincs eredmény</span>}
                        </div>
                      </div>

                      {/* Melléklet */}
                      {testResult.attachment_filename && (
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Melléklet
                          </label>
                          <button
                            onClick={() => downloadAttachment(testResult.result_id, testResult.attachment_filename)}
                            className="flex items-center gap-2 px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            {testResult.attachment_filename}
                          </button>
                        </div>
                      )}

                      {/* Kitöltő és validáló adatai */}
                      {testResult.completed_by && (
                        <div className="text-xs text-gray-500 border-t pt-3 mt-3">
                          <p>Kitöltötte: {testResult.completed_by} • {new Date(testResult.completed_at).toLocaleString('hu-HU')}</p>
                          {testResult.validated_by && testResult.validated_at && (
                            <p className="mt-1">Validálta: {testResult.validated_by} • {new Date(testResult.validated_at).toLocaleString('hu-HU')}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </>
            ) : isAdminValidationMode ? (
              <>
                {/* v7.0.3: Admin validation mode */}
                <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
                  <h2 className="text-lg font-semibold text-purple-900 mb-2">
                    Admin Validáció
                  </h2>
                  <p className="text-sm text-purple-700">
                    Ellenőrizd az eredményeket és validáld vagy küldd vissza javításra.
                  </p>
                </div>

                {testResults.length === 0 ? (
                  <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>Nincs vizsgálat ebben a kérésben.</p>
                  </div>
                ) : (
                  testResults.map((testResult) => (
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
                          {testResult.test_type_department && (
                            <p className="text-xs text-gray-500 mt-1">
                              Szervezeti egység: {testResult.test_type_department}
                            </p>
                          )}
                        </div>
                        <span className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                          testResult.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : testResult.status === 'in_progress'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {testResult.status === 'completed' && <Check className="w-3 h-3" />}
                          {testResult.status === 'completed' ? 'Validálva' : 
                           testResult.status === 'in_progress' ? 'Javításra visszaküldve' : 'Feldolgozásra vár'}
                        </span>
                      </div>

                      {/* Eredmény megjelenítése (readonly) */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Eredmény
                        </label>
                        <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 min-h-[100px] whitespace-pre-wrap">
                          {testResult.result_text || <span className="text-gray-400">Nincs eredmény</span>}
                        </div>
                      </div>

                      {/* Melléklet */}
                      {testResult.attachment_filename && (
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Melléklet
                          </label>
                          <button
                            onClick={() => downloadAttachment(testResult.result_id, testResult.attachment_filename)}
                            className="flex items-center gap-2 px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            {testResult.attachment_filename}
                          </button>
                        </div>
                      )}

                      {/* Visszautasítás indoka (ha van) */}
                      {testResult.rejection_reason && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm font-medium text-red-800 mb-1">Visszaküldés oka:</p>
                          <p className="text-sm text-red-700">{testResult.rejection_reason}</p>
                        </div>
                      )}

                      {/* Kitöltő adatai */}
                      {testResult.completed_by && (
                        <div className="mb-4 text-xs text-gray-500">
                          Kitöltötte: {testResult.completed_by} • {new Date(testResult.completed_at).toLocaleString('hu-HU')}
                        </div>
                      )}

                      {/* Admin validation gombok */}
                      {testResult.status === 'validation_pending' ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(testResult.result_id)}
                            disabled={saving || !testResult.result_text?.trim()}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                              !testResult.result_text?.trim()
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-green-600 text-white hover:bg-green-700'
                            }`}
                          >
                            <Check className="w-4 h-4" />
                            Elfogad
                          </button>
                          <button
                            onClick={() => handleReject(testResult.result_id)}
                            disabled={saving}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                          >
                            <X className="w-4 h-4" />
                            Visszaküld
                          </button>
                        </div>
                      ) : testResult.status === 'completed' ? (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                          <p className="text-sm font-medium text-green-800">✓ Validálva</p>
                          {testResult.validated_by && testResult.validated_at && (
                            <p className="text-xs text-green-700 mt-1">
                              {testResult.validated_by} • {new Date(testResult.validated_at).toLocaleString('hu-HU')}
                            </p>
                          )}
                        </div>
                      ) : testResult.status === 'in_progress' ? (
                        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-center">
                          <p className="text-sm font-medium text-orange-800">🔄 Javításra visszaküldve</p>
                          <p className="text-xs text-orange-700 mt-1">Labor staff javítja</p>
                        </div>
                      ) : (
                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
                          <p className="text-sm text-gray-600">Nincs eredmény</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </>
            ) : (
              <>
                {/* Labor staff mode - original UI */}
                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-4">
                  <h2 className="text-lg font-semibold text-indigo-900 mb-2">
                    Saját vizsgálatok ({user.department_name || 'Szervezeti egység'})
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

                      {/* v7.0.4: Visszaküldés oka (ha van) */}
                      {testResult.rejection_reason && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm font-medium text-red-800 mb-1">⚠️ Admin visszaküldve javításra:</p>
                          <p className="text-sm text-red-700">{testResult.rejection_reason}</p>
                        </div>
                      )}

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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TestResultsPanel;
