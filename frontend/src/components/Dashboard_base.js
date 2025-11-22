import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  PlusCircle,
  TrendingUp,
  DollarSign
} from 'lucide-react';

function Dashboard() {
  const { user, getAuthHeaders, API_URL } = useAuth();
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
    submitted: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800'
  };

  const statusLabels = {
    submitted: 'Beküldve',
    in_progress: 'Feldolgozás alatt',
    completed: 'Elkészült',
    closed: 'Lezárva'
  };

  const urgencyColors = {
    normal: 'text-gray-600',
    urgent: 'text-orange-600',
    critical: 'text-red-600'
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
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Üdvözlünk, {user?.name}!
        </h1>
        <p className="text-gray-600 mt-1">
          Itt az áttekintés a laborkéréseidről
        </p>
      </div>

      {/* Quick action */}
      {(user?.role === 'company_user' || user?.role === 'company_admin') && (
        <Link
          to="/requests/new"
          className="inline-flex items-center px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <PlusCircle className="w-5 h-5 mr-2" />
          Új laborkérés létrehozása
        </Link>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Összes kérés</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats?.total_requests || 0}
              </p>
            </div>
            <div className="bg-indigo-100 rounded-full p-3">
              <FileText className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Beküldött</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">
                {stats?.by_status?.submitted || 0}
              </p>
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Folyamatban</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">
                {stats?.by_status?.in_progress || 0}
              </p>
            </div>
            <div className="bg-yellow-100 rounded-full p-3">
              <TrendingUp className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Elkészült</p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {stats?.by_status?.completed || 0}
              </p>
            </div>
            <div className="bg-green-100 rounded-full p-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Cost Summary - Only for admins */}
      {showCosts && (
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-8 h-8" />
              <h2 className="text-2xl font-bold">Költség áttekintés</h2>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-90">Összes költség</p>
              <p className="text-3xl font-bold">
                {(stats?.total_revenue || 0).toLocaleString('hu-HU')} Ft
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <p className="text-sm opacity-90 mb-1">Beküldött</p>
              <p className="text-xl font-bold">
                {(stats?.revenue_by_status?.submitted || 0).toLocaleString('hu-HU')} Ft
              </p>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <p className="text-sm opacity-90 mb-1">Folyamatban</p>
              <p className="text-xl font-bold">
                {(stats?.revenue_by_status?.in_progress || 0).toLocaleString('hu-HU')} Ft
              </p>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <p className="text-sm opacity-90 mb-1">Elkészült</p>
              <p className="text-xl font-bold">
                {(stats?.revenue_by_status?.completed || 0).toLocaleString('hu-HU')} Ft
              </p>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <p className="text-sm opacity-90 mb-1">Lezárva</p>
              <p className="text-xl font-bold">
                {(stats?.revenue_by_status?.closed || 0).toLocaleString('hu-HU')} Ft
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Requests */}
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
                      {request.urgency !== 'normal' && (
                        <AlertCircle className={`w-4 h-4 ${urgencyColors[request.urgency]}`} />
                      )}
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
                      <span>{request.company_name}</span>
                      {user?.role === 'company_admin' && (
                        <>
                          <span>•</span>
                          <span>Feladó: {request.user_name}</span>
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
