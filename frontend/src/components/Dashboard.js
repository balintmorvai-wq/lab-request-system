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
  XCircle
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
      setRecentRequests(requestsRes.data.slice(0, 5));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    pending_approval: 'bg-orange-100 text-orange-800',
    submitted: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800'
  };

  const statusLabels = {
    draft: 'Piszkozat (szerkeszthető)',
    pending_approval: 'Céges jóváhagyásra vár',
    rejected: 'Cég által elutasítva',
    submitted: 'Beküldve',
    in_progress: 'Folyamatban',
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
        <p className="text-gray-600 mt-1">
          Itt az áttekintés a laborkéréseidről
        </p>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Draft */}
        <button
          onClick={() => navigate('/requests?status=draft')}
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer text-left w-full"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Piszkozat</p>
              <p className="text-xs text-gray-500">(szerkeszthető)</p>
              <p className="text-3xl font-bold text-gray-600 mt-2">
                {stats?.by_status?.draft || 0}
              </p>
            </div>
            <div className="bg-gray-100 rounded-full p-3">
              <Edit className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </button>

        {/* Pending Approval */}
        <button
          onClick={() => navigate('/requests?status=pending_approval')}
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer text-left w-full"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Céges jóváhagyásra vár</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">
                {stats?.by_status?.pending_approval || 0}
              </p>
            </div>
            <div className="bg-orange-100 rounded-full p-3">
              <AlertCircle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </button>

        {/* Rejected */}
        <button
          onClick={() => navigate('/requests?status=rejected')}
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer text-left w-full"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Cég által elutasítva</p>
              <p className="text-3xl font-bold text-red-600 mt-2">
                {stats?.by_status?.rejected || 0}
              </p>
            </div>
            <div className="bg-red-100 rounded-full p-3">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Submitted */}
        <button
          onClick={() => navigate('/requests?status=submitted')}
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer text-left w-full"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Beküldve</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">
                {stats?.by_status?.submitted || 0}
              </p>
              {showCosts && stats?.revenue_by_status?.submitted && (
                <p className="text-xs text-blue-500 mt-1">
                  {stats.revenue_by_status.submitted.toLocaleString('hu-HU')} Ft
                </p>
              )}
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </button>

        {/* In Progress */}
        <button
          onClick={() => navigate('/requests?status=in_progress')}
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer text-left w-full"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Folyamatban</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">
                {stats?.by_status?.in_progress || 0}
              </p>
              {showCosts && stats?.revenue_by_status?.in_progress && (
                <p className="text-xs text-yellow-500 mt-1">
                  {stats.revenue_by_status.in_progress.toLocaleString('hu-HU')} Ft
                </p>
              )}
            </div>
            <div className="bg-yellow-100 rounded-full p-3">
              <TrendingUp className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </button>

        {/* Completed */}
        <button
          onClick={() => navigate('/requests?status=completed')}
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer text-left w-full"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Elkészült</p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {stats?.by_status?.completed || 0}
              </p>
              {showCosts && stats?.revenue_by_status?.completed && (
                <p className="text-xs text-green-500 mt-1">
                  {stats.revenue_by_status.completed.toLocaleString('hu-HU')} Ft
                </p>
              )}
            </div>
            <div className="bg-green-100 rounded-full p-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Legutóbbi kérések</h2>
        </div>
        
        <div className="divide-y divide-gray-200">
          {recentRequests.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              Még nincsenek laborkérések
            </div>
          ) : (
            recentRequests.map((request) => (
              <div key={request.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-gray-900">
                        {request.sample_id}
                      </h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[request.status]}`}>
                        {statusLabels[request.status]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {request.sample_description}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>Vizsgálatok: {request.test_types?.length || 0} db</span>
                      {showCosts && (
                        <>
                          <span>•</span>
                          <span className="font-semibold text-indigo-600">
                            {(request.total_price || 0).toLocaleString('hu-HU')} Ft
                          </span>
                        </>
                      )}
                      <span>•</span>
                      <span>{new Date(request.created_at).toLocaleDateString('hu-HU')}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {recentRequests.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <Link 
              to="/requests"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Összes kérés megtekintése →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
