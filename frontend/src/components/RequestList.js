import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';  // v7.0.6: useNavigate
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import RequestDetailsModal from './RequestDetailsModal';
import { 
  PlusCircle, 
  Search, 
  Filter,
  AlertCircle,
  Clock,
  CheckCircle,
  FileText,
  Info,
  Download,
  FileCheck,  // v7.0.8: Completed kérések PDF ikonja
  Edit,
  Edit2,
  Send,
  XCircle,
  Trash2,
  Eye,  // v7.0.6: Eredmények megtekintése ikon
  Clipboard  // v7.0.31: Átadás-átvételi jegyzőkönyv
} from 'lucide-react';

function RequestList() {
  const { user, getAuthHeaders, API_URL } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();  // v7.0.6: Eredmények megtekintése navigáció
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // v6.0: Check URL params for status filter
  useEffect(() => {
    const statusFromUrl = searchParams.get('status');
    if (statusFromUrl) {
      setStatusFilter(statusFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    filterRequests();
  }, [requests, searchTerm, statusFilter]); // v7.0.13: departmentFilter eltávolítva (csak WorkList-en van)

  const fetchRequests = async () => {
    try {
      const response = await axios.get(`${API_URL}/requests`, {
        headers: getAuthHeaders()
      });
      setRequests(response.data);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequestDetails = async (requestId) => {
    try {
      const response = await axios.get(`${API_URL}/requests/${requestId}`, {
        headers: getAuthHeaders()
      });
      setSelectedRequest(response.data);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Error fetching request details:', error);
      alert('Hiba történt a részletek betöltése során');
    }
  };

  const downloadPDF = async (requestId, sampleId) => {
    try {
      console.log('[PDF Download] Letöltés indul...', { requestId, sampleId, userRole: user?.role });
      const response = await axios.get(
        `${API_URL}/requests/${requestId}/pdf`,
        {
          headers: getAuthHeaders(),
          responseType: 'blob'
        }
      );
      
      console.log('[PDF Download] Válasz érkezett:', response.status, response.headers['content-type']);
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `laborkeres_${sampleId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      console.log('[PDF Download] Letöltés sikeres!');
    } catch (error) {
      console.error('[PDF Download] Hiba:', error);
      console.error('[PDF Download] Response:', error.response?.data);
      console.error('[PDF Download] Status:', error.response?.status);
      alert(`Hiba történt a PDF letöltése során: ${error.response?.status === 403 ? 'Nincs jogosultságod!' : 'Ismeretlen hiba'}`);
    }
  };

  // v7.0.31: Átadás-átvételi jegyzőkönyv PDF letöltés
  const downloadHandoverPDF = async (requestId, requestNumber) => {
    try {
      const response = await axios.get(
        `${API_URL}/requests/${requestId}/handover-pdf`,
        {
          headers: getAuthHeaders(),
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `atadas_atveteli_${requestNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Átadás-átvételi PDF hiba:', error);
      alert(`Hiba: ${error.response?.data?.message || 'PDF generálás sikertelen'}`);
    }
  };

  const filterRequests = () => {
    let filtered = requests;

    // Keresés
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(req =>
        (req.request_number && req.request_number.toLowerCase().includes(term)) ||
        (req.internal_id && req.internal_id.toLowerCase().includes(term)) ||
        (req.sample_id && req.sample_id.toLowerCase().includes(term)) ||
        (req.sample_description && req.sample_description.toLowerCase().includes(term)) ||
        (req.company_name && req.company_name.toLowerCase().includes(term)) ||
        (req.user_name && req.user_name.toLowerCase().includes(term))
      );
    }

    // Státusz szűrés
    if (statusFilter !== 'all') {
      filtered = filtered.filter(req => req.status === statusFilter);
    }

    setFilteredRequests(filtered);
  };

  const updateStatus = async (requestId, newStatus) => {
    try {
      // v4.0 backend expects FormData
      const formData = new FormData();
      formData.append('status', newStatus);
      
      await axios.put(
        `${API_URL}/requests/${requestId}`,
        formData,
        { 
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      fetchRequests();
      setSelectedRequestId(null);
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Hiba a státusz frissítése során');
    }
  };

  const approveRequest = async (requestId) => {
    if (!window.confirm('Biztosan jóváhagyod és beküldöd ezt a laborkérést?')) {
      return;
    }
    // v7.0.27: pending_approval → awaiting_shipment (logisztikai modul)
    await updateStatus(requestId, 'awaiting_shipment');
  };

  const rejectRequest = async (requestId) => {
    if (!window.confirm('Biztosan elutasítod? A kérés visszakerül piszkozat állapotba.')) {
      return;
    }
    await updateStatus(requestId, 'draft');
  };

  // v6.8 - Törlés funkció
  const deleteRequest = async (requestId) => {
    const request = requests.find(r => r.id === requestId);
    if (!window.confirm(`Biztosan törölni szeretnéd ezt a laborkérést?\n\nAzonosító: ${request?.request_number || request?.sample_id}\n\nEz a művelet nem vonható vissza!`)) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/requests/${requestId}`, {
        headers: getAuthHeaders()
      });
      
      // Lista frissítése
      fetchRequests();
      alert('Laborkérés sikeresen törölve!');
    } catch (error) {
      console.error('Törlési hiba:', error);
      alert(error.response?.data?.message || 'Hiba történt a törlés során');
    }
  };

  const statusConfig = {
    draft: { 
      label: 'Piszkozat (szerkeszthető)', 
      color: 'bg-gray-100 text-gray-800',
      icon: Edit 
    },
    pending_approval: { 
      label: 'Céges jóváhagyásra vár', 
      color: 'bg-orange-100 text-orange-800',
      icon: Clock 
    },
    // v7.0.27: Logisztikai státuszok
    awaiting_shipment: {
      label: 'Szállításra vár',
      color: 'bg-orange-100 text-orange-800',
      icon: Clock
    },
    in_transit: {
      label: 'Szállítás alatt',
      color: 'bg-blue-100 text-blue-800',
      icon: Clock
    },
    arrived_at_provider: {  // v7.0.27: submitted átnevezve
      label: 'Szolgáltatóhoz megérkezett',
      color: 'bg-green-100 text-green-800',
      icon: CheckCircle
    },
    in_progress: { 
      label: 'Végrehajtás alatt', 
      color: 'bg-yellow-100 text-yellow-800',
      icon: Clock 
    },
    awaiting_other_departments: {  // v7.0.26: Törölt de legacy support
      label: 'Másik szervezeti egységre vár',
      color: 'bg-orange-100 text-orange-800',
      icon: Clock
    },
    validation_pending: {
      label: 'Validálásra vár',
      color: 'bg-purple-100 text-purple-800',
      icon: AlertCircle
    },
    completed: { 
      label: 'Elkészült', 
      color: 'bg-green-100 text-green-800',
      icon: CheckCircle 
    }
  };

  const urgencyColors = {
    normal: 'text-gray-600',
    urgent: 'text-orange-600 font-semibold',
    critical: 'text-red-600 font-bold'
  };

  const urgencyLabels = {
    normal: 'Normal',
    urgent: 'Sürgős',
    critical: 'Kritikus'
  };

  const canEditStatus = user?.role === 'super_admin';  // v7.0.13: Csak super_admin válthat státuszt
  const canApprove = user?.role === 'company_admin';
  const showCosts = user?.role !== 'company_user';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Betöltés...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Laborkérések</h1>
          <p className="text-gray-600 mt-1">
            Összesen {filteredRequests.length} kérés
          </p>
        </div>

        {(user?.role === 'company_user' || user?.role === 'company_admin') && (
          <Link
            to="/requests/new"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <PlusCircle className="w-5 h-5 mr-2" />
            Új kérés
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Keresés..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">Összes státusz</option>
              <option value="draft">Piszkozat (szerkeszthető)</option>
              <option value="pending_approval">Céges jóváhagyásra vár</option>
              {/* v7.0.29: Logisztikai státuszok */}
              <option value="awaiting_shipment">Szállításra vár</option>
              <option value="in_transit">Szállítás alatt</option>
              <option value="arrived_at_provider">Szolgáltatóhoz megérkezett</option>
              {/* Szolgáltatói státuszok */}
              <option value="in_progress">Végrehajtás alatt</option>
              <option value="validation_pending">Validálásra vár</option>
              <option value="completed">Elkészült</option>
            </select>
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>Nincs megjeleníthető laborkérés</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredRequests.map((request) => {
              // v7.0.26: Fallback ha ismeretlen status
              const statusInfo = statusConfig[request.status] || {
                label: request.status,
                color: 'bg-gray-100 text-gray-800',
                icon: AlertCircle
              };
              const StatusIcon = statusInfo.icon;
              const isPendingApproval = request.status === 'pending_approval';
              
              return (
                <div 
                  key={request.id} 
                  className="px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Header sor */}
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-bold text-gray-900">
                          {request.request_number || request.sample_id}
                        </h3>
                        {request.internal_id && (
                          <span className="text-xs text-gray-500">
                            ({request.internal_id})
                          </span>
                        )}
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${statusInfo.color} flex items-center gap-1`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusInfo.label}
                        </span>
                        <span className={`text-xs font-bold ${urgencyColors[request.urgency]}`}>
                          {urgencyLabels[request.urgency]}
                        </span>
                      </div>

                      {/* Leírás */}
                      <p className="text-sm text-gray-700 mb-1.5 font-medium">{request.sample_description}</p>
                      
                      {/* Adatok kompakt grid */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 mb-2">
                        <span className="flex items-center gap-1">
                          <span className="font-medium">Hely:</span> {request.sampling_location}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="font-medium">Cég:</span> {request.company_name}
                        </span>
                        {(user?.role === 'company_admin' || user?.role === 'super_admin' || user?.role === 'labor_staff') && (
                          <span className="flex items-center gap-1">
                            <span className="font-medium">Feladó:</span> {request.user_name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <span className="font-medium">Létrehozva:</span> {new Date(request.created_at).toLocaleDateString('hu-HU')}
                        </span>
                        {showCosts && (
                          <span className="flex items-center gap-1 font-semibold text-indigo-600">
                            {(request.total_price || 0).toLocaleString('hu-HU')} Ft
                          </span>
                        )}
                      </div>

                      {/* v7.0.13: Vizsgálatok kiírása badge-ekkel */}
                      {request.test_types && request.test_types.length > 0 && (
                        <div className="pt-2 border-t border-gray-100">
                          <div className="flex flex-wrap gap-1.5">
                            {request.test_types.map((test, idx) => (
                              <span 
                                key={idx}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200"
                              >
                                {typeof test === 'string' ? test : test.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Jobb oldal - Gombok */}
                    <div className="flex gap-1.5 items-start">
                      {/* Edit Button for DRAFT only - v7.0.29: company_admin is szerkeszthet */}
                      {request.status === 'draft' && (user?.role === 'company_user' || user?.role === 'company_admin') && (
                        <Link
                          to={`/requests/edit/${request.id}`}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Szerkesztés"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Link>
                      )}
                      
                      {/* Info */}
                      <button
                        onClick={() => fetchRequestDetails(request.id)}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Részletek"
                      >
                        <Info className="w-4 h-4" />
                      </button>

                      {/* PDF */}
                      <button
                        onClick={() => downloadPDF(request.id, request.sample_id)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          request.status === 'completed' 
                            ? 'text-emerald-600 hover:bg-emerald-50'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                        title={request.status === 'completed' ? 'Eredményekkel bővített PDF' : 'PDF letöltés'}
                      >
                        {request.status === 'completed' ? (
                          <FileCheck className="w-4 h-4" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>

                      {/* v7.0.31: Átadás-átvételi jegyzőkönyv PDF */}
                      {['awaiting_shipment', 'in_transit', 'arrived_at_provider'].includes(request.status) && (
                        <button
                          onClick={() => downloadHandoverPDF(request.id, request.request_number)}
                          className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Átadás-átvételi jegyzőkönyv (QR kóddal)"
                        >
                          <Clipboard className="w-4 h-4" />
                        </button>
                      )}

                      {/* Eredmények megtekintése */}
                      {request.status === 'completed' && (user?.role === 'labor_staff' || user?.role === 'super_admin') && (
                        <button
                          onClick={() => navigate(`/test-results/${request.id}`)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Eredmények"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}

                      {/* Approval Buttons */}
                      {canApprove && isPendingApproval && (
                        <>
                          <button
                            onClick={() => approveRequest(request.id)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Jóváhagyás"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => rejectRequest(request.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Elutasítás"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {/* Törlés */}
                      {((request.status === 'draft' && request.user_id === user.id) || user.role === 'super_admin') && (
                        <button
                          onClick={() => deleteRequest(request.id)}
                          className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          title="Törlés"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      {/* v7.0.29: Státusz váltás - Dropdown scroll fix kis táblázatnál */}
                      {canEditStatus && (
                        <div className="relative">
                          <button
                            onClick={() => setSelectedRequestId(request.id === selectedRequestId ? null : request.id)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                          >
                            Státusz
                          </button>
                          
                          {selectedRequestId === request.id && (
                            <>
                              {/* Backdrop - kattintásra bezáródik */}
                              <div 
                                className="fixed inset-0 z-40" 
                                onClick={() => setSelectedRequestId(null)}
                              />
                              {/* Dropdown - max-height + scroll kis táblázatnál */}
                              <div className="absolute right-0 top-full mt-2 w-56 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-xl z-50">
                                {Object.entries(statusConfig).map(([status, config]) => (
                                  <button
                                    key={status}
                                    onClick={() => updateStatus(request.id, status)}
                                    className="w-full text-left px-4 py-2 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors"
                                  >
                                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${config.color}`}>
                                      {config.label}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedRequest && (
        <RequestDetailsModal
          request={selectedRequest}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedRequest(null);
          }}
        />
      )}
    </div>
  );
}

export default RequestList;
