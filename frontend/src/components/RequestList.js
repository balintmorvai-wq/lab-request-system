import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
  Edit,
  Edit2,
  Send,
  XCircle,
  Trash2
} from 'lucide-react';

function RequestList() {
  const { user, getAuthHeaders, API_URL } = useAuth();
  const [searchParams] = useSearchParams();
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
  }, [requests, searchTerm, statusFilter]);

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
      const response = await axios.get(
        `${API_URL}/requests/${requestId}/pdf`,
        {
          headers: getAuthHeaders(),
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `laborkeres_${sampleId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF letöltési hiba:', error);
      alert('Hiba történt a PDF letöltése során');
    }
  };

  const filterRequests = () => {
    let filtered = requests;

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
    await updateStatus(requestId, 'submitted');
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
    rejected: {
      label: 'Cég által elutasítva',
      color: 'bg-red-100 text-red-800',
      icon: XCircle
    },
    submitted: { 
      label: 'Beküldve', 
      color: 'bg-blue-100 text-blue-800',
      icon: FileText 
    },
    in_progress: { 
      label: 'Folyamatban', 
      color: 'bg-yellow-100 text-yellow-800',
      icon: Clock 
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

  const canEditStatus = user?.role === 'super_admin' || user?.role === 'lab_staff';
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
              <option value="rejected">Cég által elutasítva</option>
              <option value="submitted">Beküldve</option>
              <option value="in_progress">Folyamatban</option>
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
              const StatusIcon = statusConfig[request.status].icon;
              const isPendingApproval = request.status === 'pending_approval';
              
              return (
                <div 
                  key={request.id} 
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-bold text-gray-900">
                          {request.request_number || request.sample_id}
                        </h3>
                        {request.internal_id && (
                          <span className="text-sm text-gray-500">
                            ({request.internal_id})
                          </span>
                        )}
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${statusConfig[request.status].color} flex items-center gap-1`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig[request.status].label}
                        </span>
                        <span className={`text-sm ${urgencyColors[request.urgency]}`}>
                          {urgencyLabels[request.urgency]}
                        </span>
                      </div>

                      <p className="text-gray-700 mb-2">{request.sample_description}</p>
                      
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Vizsgálatok:</span>
                          <span className="ml-2 font-medium">{request.test_types?.length || 0} db</span>
                        </div>
                        {showCosts && (
                          <div>
                            <span className="text-gray-600">Költség:</span>
                            <span className="ml-2 font-semibold text-indigo-600">
                              {(request.total_price || 0).toLocaleString('hu-HU')} Ft
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-600">Hely:</span>
                          <span className="ml-2 font-medium">{request.sampling_location}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Cég:</span>
                          <span className="ml-2 font-medium">{request.company_name}</span>
                        </div>
                        {(user?.role === 'company_admin' || user?.role === 'super_admin' || user?.role === 'lab_staff') && (
                          <div>
                            <span className="text-gray-600">Feladó:</span>
                            <span className="ml-2 font-medium">{request.user_name}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-600">Létrehozva:</span>
                          <span className="ml-2 font-medium">
                            {new Date(request.created_at).toLocaleDateString('hu-HU')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="ml-4 flex gap-2">
                      {/* Info Button */}
                      {/* Edit Button for DRAFT and REJECTED - v6.5 */}
                      {(request.status === 'draft' || request.status === 'rejected') && user?.role === 'company_user' && (
                        <Link
                          to={`/requests/edit/${request.id}`}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Szerkesztés"
                        >
                          <Edit2 className="w-5 h-5" />
                        </Link>
                      )}
                      <button
                        onClick={() => fetchRequestDetails(request.id)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Részletek"
                      >
                        <Info className="w-5 h-5" />
                      </button>

                      {/* PDF Button */}
                      <button
                        onClick={() => downloadPDF(request.id, request.sample_id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="PDF letöltés"
                      >
                        <Download className="w-5 h-5" />
                      </button>

                      {/* Approval Buttons (Company Admin only) */}
                      {canApprove && isPendingApproval && (
                        <>
                          <button
                            onClick={() => approveRequest(request.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Jóváhagyás"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => rejectRequest(request.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Elutasítás"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </>
                      )}

                      {/* v6.8 - Törlés gomb (saját piszkozat vagy super admin) */}
                      {((request.status === 'draft' && request.user_id === user.id) || user.role === 'super_admin') && (
                        <button
                          onClick={() => deleteRequest(request.id)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          title="Törlés"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}

                      {/* Status Update (Lab/Super Admin) */}
                      {canEditStatus && (
                        <div className="relative">
                          <button
                            onClick={() => setSelectedRequestId(request.id === selectedRequestId ? null : request.id)}
                            className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            Státusz váltás
                          </button>
                          
                          {selectedRequestId === request.id && (
                            <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
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
