import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  Clipboard,
  Clock,
  AlertCircle,
  CheckCircle,
  Play,
  Calendar,
  TrendingUp
} from 'lucide-react';

function WorkList() {
  const { user, getAuthHeaders, API_URL } = useAuth();
  const navigate = useNavigate();
  const [worklist, setWorklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, in_progress, validation_pending, completed

  useEffect(() => {
    fetchWorklist();
  }, []);

  const fetchWorklist = async () => {
    try {
      const response = await axios.get(`${API_URL}/my-worklist`, {
        headers: getAuthHeaders()
      });
      setWorklist(response.data);
    } catch (error) {
      console.error('Munkalista lekérési hiba:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredWorklist = worklist.filter(req => {
    if (filter === 'all') return true;
    return req.status === filter;
  });

  const statusConfig = {
    in_progress: {
      label: 'Végrehajtás alatt',
      color: 'bg-yellow-100 text-yellow-800',
      icon: Clock
    },
    validation_pending: {
      label: 'Validálásra beküldött',
      color: 'bg-blue-100 text-blue-800',
      icon: AlertCircle
    },
    completed: {
      label: 'Elkészült',
      color: 'bg-green-100 text-green-800',
      icon: CheckCircle
    }
  };

  const urgencyConfig = {
    normal: { label: 'Normál', color: 'text-gray-600' },
    urgent: { label: 'Sürgős', color: 'text-orange-600' },
    critical: { label: 'Kritikus', color: 'text-red-600' }
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
      {/* v7.0.4 FINAL: Sötét header - alfolyamat jelzés */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-lg p-6 shadow-xl">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Clipboard className="w-7 h-7" />
          Munkalistám
        </h1>
        <p className="text-sm text-slate-300 mt-2">
          {user.department_name || 'Szervezeti egység'} - Folyamatban lévő laborkérések nyomon követése
        </p>
      </div>

      {/* Statisztikák - sötét design */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-slate-700 to-slate-800 p-4 rounded-lg shadow-lg border border-slate-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-300">Összes</p>
              <p className="text-2xl font-bold text-white">{worklist.length}</p>
            </div>
            <Clipboard className="w-8 h-8 text-slate-400" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-700 to-slate-800 p-4 rounded-lg shadow-lg border border-slate-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-300">Végrehajtás alatt</p>
              <p className="text-2xl font-bold text-yellow-400">
                {worklist.filter(r => r.status === 'in_progress').length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-700 to-slate-800 p-4 rounded-lg shadow-lg border border-slate-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-300">Validálásra vár</p>
              <p className="text-2xl font-bold text-purple-400">
                {worklist.filter(r => r.status === 'validation_pending').length}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-700 to-slate-800 p-4 rounded-lg shadow-lg border border-slate-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-300">Elkészült</p>
              <p className="text-2xl font-bold text-green-400">
                {worklist.filter(r => r.status === 'completed').length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Szűrők - sötét design */}
      <div className="bg-slate-800 rounded-lg shadow-lg p-4 border border-slate-700">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600'
            }`}
          >
            Összes ({worklist.length})
          </button>
          <button
            onClick={() => setFilter('in_progress')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'in_progress'
                ? 'bg-yellow-600 text-white shadow-lg'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600'
            }`}
          >
            Folyamatban ({worklist.filter(r => r.status === 'in_progress').length})
          </button>
          <button
            onClick={() => setFilter('validation_pending')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'validation_pending'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600'
            }`}
          >
            Validálásra vár ({worklist.filter(r => r.status === 'validation_pending').length})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'completed'
                ? 'bg-green-600 text-white shadow-lg'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600'
            }`}
          >
            Elkészült ({worklist.filter(r => r.status === 'completed').length})
          </button>
        </div>
      </div>

      {/* Munkalista - javított design v7.0.11 */}
      <div className="bg-white rounded-lg shadow-xl overflow-hidden border border-gray-200">
        {filteredWorklist.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            <Clipboard className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>Nincs megjeleníthető kérés</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredWorklist.map((request) => {
              const StatusIcon = statusConfig[request.status]?.icon || Clock;
              
              return (
                <div 
                  key={request.id} 
                  className="p-5 hover:bg-gray-50 transition-colors bg-white border-l-4 border-l-transparent hover:border-l-indigo-500"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Bal oldal - Kérés infó */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {request.request_number}
                        </h3>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${statusConfig[request.status]?.color}`}>
                          {statusConfig[request.status]?.label}
                        </span>
                        {request.urgency !== 'normal' && (
                          <span className={`text-sm font-semibold ${urgencyConfig[request.urgency].color}`}>
                            {urgencyConfig[request.urgency].label}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-700 mb-3 font-medium">
                        {request.sample_description || request.internal_id}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(request.created_at).toLocaleDateString('hu-HU')}
                        </span>
                        {request.deadline && (
                          <span className="flex items-center gap-1 text-orange-600 font-medium">
                            <Clock className="w-4 h-4" />
                            Határidő: {new Date(request.deadline).toLocaleDateString('hu-HU')}
                          </span>
                        )}
                        <span className="font-medium">{request.company_name}</span>
                      </div>

                      {/* v7.0.1: Test list - javított design */}
                      {request.test_list && request.test_list.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="text-xs font-semibold text-gray-700 mb-2">Vizsgálatok:</div>
                          <div className="flex flex-wrap gap-2">
                            {request.test_list.map((test) => (
                              <div 
                                key={test.id}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium ${
                                  test.status === 'completed' 
                                    ? 'bg-green-50 text-green-700 border border-green-200' 
                                    : test.status === 'in_progress'
                                    ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                                    : 'bg-gray-50 text-gray-600 border border-gray-200'
                                }`}
                              >
                                <span className="font-semibold">{test.name}</span>
                                {test.department_name && user?.role === 'super_admin' && (
                                  <span className="text-gray-500">({test.department_name})</span>
                                )}
                                {test.status === 'completed' && <CheckCircle className="w-3.5 h-3.5" />}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Közép - Progress */}
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-bold text-gray-900">
                          {request.my_completed_count} / {request.my_test_count}
                        </div>
                        <div className="text-xs text-gray-600 font-medium">vizsgálat</div>
                      </div>
                      <div className="w-24">
                        <div className="bg-gray-200 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full transition-all ${
                              request.progress === 100 ? 'bg-green-500' : 'bg-indigo-600'
                            }`}
                            style={{ width: `${request.progress}%` }}
                          />
                        </div>
                        <div className="text-xs text-center text-gray-700 font-semibold mt-1">
                          {request.progress}%
                        </div>
                      </div>
                    </div>

                    {/* Jobb oldal - Műveletek */}
                    <button
                      onClick={() => navigate(`/test-results/${request.id}`)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        request.status === 'completed'
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : user?.role === 'super_admin' && request.status === 'validation_pending'
                          ? 'bg-purple-600 text-white hover:bg-purple-700'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {request.status === 'completed' ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Eredmények
                        </>
                      ) : user?.role === 'super_admin' && request.status === 'validation_pending' ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Validálás
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Végrehajtás
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default WorkList;
