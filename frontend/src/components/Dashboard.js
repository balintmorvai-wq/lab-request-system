import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  PlusCircle,
  TrendingUp,
  DollarSign,
  Edit,
  XCircle,
  Eye,
  Download,
  Trash2,
  Clipboard  // v7.0.4 FINAL: Munkalista ikon
} from 'lucide-react';

function Dashboard() {
  const { user, getAuthHeaders, API_URL } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, requestsRes] = await Promise.all([
        axios.get(`${API_URL}/stats`, { headers: getAuthHeaders() }),
        axios.get(`${API_URL}/requests`, { headers: getAuthHeaders() })
      ]);
      
      setStats(statsRes.data);
      
      // v6.8 - Időrend szerint rendezés (legújabb elöl)
      const sortedRequests = requestsRes.data.sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
      });
      setRecentRequests(sortedRequests.slice(0, 5));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // v6.8 - PDF letöltés funkció
  const downloadPDF = async (requestId, sampleId) => {
    try {
      const response = await axios.get(`${API_URL}/requests/${requestId}/pdf`, {
        headers: getAuthHeaders(),
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `laborkeres_${sampleId || requestId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('PDF letöltési hiba:', error);
      alert('Hiba történt a PDF letöltése során');
    }
  };

  // v6.8 - Törlés funkció
  const deleteRequest = async (requestId) => {
    const request = recentRequests.find(r => r.id === requestId);
    if (!window.confirm(`Biztosan törölni szeretnéd ezt a laborkérést?\n\nAzonosító: ${request?.request_number || request?.sample_id}\n\nEz a művelet nem vonható vissza!`)) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/requests/${requestId}`, {
        headers: getAuthHeaders()
      });
      
      // Lista frissítése
      fetchData();
      alert('Laborkérés sikeresen törölve!');
    } catch (error) {
      console.error('Törlési hiba:', error);
      alert(error.response?.data?.message || 'Hiba történt a törlés során');
    }
  };

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    pending_approval: 'bg-orange-100 text-orange-800',
    submitted: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    validation_pending: 'bg-purple-100 text-purple-800',
    completed: 'bg-green-100 text-green-800'
  };

  // v7.0.22: MASTER státusz definíciók
  const statusLabels = {
    draft: 'Piszkozat (szerkeszthető)',
    pending_approval: 'Céges jóváhagyásra vár',
    submitted: 'Szolgáltatóhoz beküldve',
    in_progress: 'Folyamatban',
    validation_pending: 'Validálásra vár',
    completed: 'Elkészült'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Betöltés...</div>
      </div>
    );
  }

  const showCosts = user?.role === 'company_admin' || user?.role === 'super_admin' || user?.role === 'lab_staff';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Üdvözlünk, {user?.name}!
        </h1>
        {/* v7.0.13: Áttekintés szöveg csak company_user-nak (nem admin-oknak) */}
        {user?.role === 'company_user' && (
          <p className="text-gray-600 mt-1">
            Itt az áttekintés a laborkéréseidről
          </p>
        )}
      </div>

      {(user?.role === 'company_user' || user?.role === 'company_admin') && (
        <Link
          to="/requests/new"
          className="inline-flex items-center px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <PlusCircle className="w-5 h-5 mr-2" />
          Új laborkérés létrehozása
        </Link>
      )}

      {/* Status Cards - v6.1 Order: draft, pending, rejected, submitted, in_progress, completed */}
      {/* v7.0.13: Laborkérések követése - kompakt dark design */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header - Sötétebb mint munkalista (slate-700 vs indigo-600) */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Laborkérések követése
          </h2>
          <p className="text-sm text-slate-200 mt-0.5">Összes kérés állapot szerint</p>
        </div>
        
        {/* v7.0.16: Cards Grid - Vizuálisan elválasztva: Cég vs Szolgáltató */}
        <div className="p-6 bg-slate-50 space-y-6">
          {/* ELSŐ SOR: CÉG STÁTUSZOK (draft, pending_approval) */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1 w-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded"></div>
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">📝 Cég oldal (Feladó)</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Draft */}
              <button
                onClick={() => navigate('/requests?status=draft')}
                className="bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition-all text-left w-full border-2 border-gray-200 hover:border-gray-400 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Piszkozat</p>
                    <p className="text-3xl font-bold text-gray-700 group-hover:text-gray-900">{stats?.by_status?.draft || 0}</p>
                  </div>
                  <div className="bg-gray-100 rounded-full p-3 border-2 border-gray-200 group-hover:bg-gray-200 transition-colors">
                    <Edit className="w-6 h-6 text-gray-600" />
                  </div>
                </div>
              </button>

              {/* Pending Approval */}
              <button
                onClick={() => navigate('/requests?status=pending_approval')}
                className="bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition-all text-left w-full border-2 border-gray-200 hover:border-orange-400 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Jóváhagyásra vár</p>
                    <p className="text-3xl font-bold text-orange-600 group-hover:text-orange-700">{stats?.by_status?.pending_approval || 0}</p>
                  </div>
                  <div className="bg-orange-100 rounded-full p-3 border-2 border-orange-200 group-hover:bg-orange-200 transition-colors">
                    <AlertCircle className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* MÁSODIK SOR: SZOLGÁLTATÓ STÁTUSZOK (submitted, in_progress, validation_pending, completed) */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1 w-8 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded"></div>
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">🔬 Szolgáltató oldal (Labor)</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Submitted */}
              <button
                onClick={() => navigate('/requests?status=submitted')}
                className="bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition-all text-left w-full border-2 border-gray-200 hover:border-blue-400 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Szolgáltatóhoz beküldve</p>
                    <p className="text-3xl font-bold text-blue-600 group-hover:text-blue-700">{stats?.by_status?.submitted || 0}</p>
                  </div>
                  <div className="bg-blue-100 rounded-full p-3 border-2 border-blue-200 group-hover:bg-blue-200 transition-colors">
                    <Clock className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </button>

              {/* In Progress */}
              <button
                onClick={() => navigate('/requests?status=in_progress')}
                className="bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition-all text-left w-full border-2 border-gray-200 hover:border-yellow-400 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Végrehajtás alatt</p>
                    <p className="text-3xl font-bold text-yellow-600 group-hover:text-yellow-700">{stats?.by_status?.in_progress || 0}</p>
                  </div>
                  <div className="bg-yellow-100 rounded-full p-3 border-2 border-yellow-200 group-hover:bg-yellow-200 transition-colors">
                    <TrendingUp className="w-6 h-6 text-yellow-600" />
                  </div>
                </div>
              </button>

              {/* v7.0.22: Validation Pending */}
              <button
                onClick={() => navigate('/requests?status=validation_pending')}
                className="bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition-all text-left w-full border-2 border-gray-200 hover:border-purple-400 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Validálásra vár</p>
                    <p className="text-3xl font-bold text-purple-600 group-hover:text-purple-700">{stats?.by_status?.validation_pending || 0}</p>
                  </div>
                  <div className="bg-purple-100 rounded-full p-3 border-2 border-purple-200 group-hover:bg-purple-200 transition-colors">
                    <AlertCircle className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </button>

              {/* Completed */}
              <button
                onClick={() => navigate('/requests?status=completed')}
                className="bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition-all text-left w-full border-2 border-gray-200 hover:border-green-400 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Elkészült</p>
                    <p className="text-3xl font-bold text-green-600 group-hover:text-green-700">{stats?.by_status?.completed || 0}</p>
                  </div>
                  <div className="bg-green-100 rounded-full p-3 border-2 border-green-200 group-hover:bg-green-200 transition-colors">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
