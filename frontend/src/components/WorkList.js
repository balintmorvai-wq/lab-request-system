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
  TrendingUp,
  Search  // v7.0.11: Kereső ikon
} from 'lucide-react';

function WorkList() {
  const { user, getAuthHeaders, API_URL } = useAuth();
  const navigate = useNavigate();
  const [worklist, setWorklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, in_progress, validation_pending, completed
  const [searchTerm, setSearchTerm] = useState(''); // v7.0.11: Kereső

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

  // v7.0.11: Kereső + szűrő kombinálva
  const filteredWorklist = worklist.filter(req => {
    // Státusz szűrő
    if (filter !== 'all' && req.status !== filter) return false;
    
    // Keresés (request_number, sample_description, internal_id, company_name)
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        (req.request_number && req.request_number.toLowerCase().includes(search)) ||
        (req.sample_description && req.sample_description.toLowerCase().includes(search)) ||
        (req.internal_id && req.internal_id.toLowerCase().includes(search)) ||
        (req.company_name && req.company_name.toLowerCase().includes(search))
      );
    }
    
    return true;
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
      {/* v7.0.11: Dashboard stílusú kompakt header */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Clipboard className="w-7 h-7" />
            Munkalistám
          </h1>
          <p className="text-sm text-indigo-100 mt-1">
            {user.department_name || 'Szervezeti egység'} - Folyamatban lévő laborkérések nyomon követése
          </p>
        </div>

        {/* Statisztikák Grid + Kereső */}
        <div className="p-6 bg-gray-50">
          {/* Statisztikák */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white rounded-lg shadow-md p-4 border-2 border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Összes</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{worklist.length}</p>
                </div>
                <Clipboard className="w-7 h-7 text-gray-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4 border-2 border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Végrehajtás alatt</p>
                  <p className="text-2xl font-bold text-yellow-600 mt-1">
                    {worklist.filter(r => r.status === 'in_progress').length}
                  </p>
                </div>
                <Clock className="w-7 h-7 text-yellow-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4 border-2 border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Validálásra vár</p>
                  <p className="text-2xl font-bold text-purple-600 mt-1">
                    {worklist.filter(r => r.status === 'validation_pending').length}
                  </p>
                </div>
                <AlertCircle className="w-7 h-7 text-purple-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4 border-2 border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Elkészült</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {worklist.filter(r => r.status === 'completed').length}
                  </p>
                </div>
                <CheckCircle className="w-7 h-7 text-green-600" />
              </div>
            </div>
          </div>

          {/* Kereső + Szűrők */}
          <div className="flex flex-col md:flex-row gap-3">
            {/* Kereső */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Keresés kérésszám, leírás, azonosító, cég alapján..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Státusz szűrők */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-indigo-300'
                }`}
              >
                Összes ({worklist.length})
              </button>
              <button
                onClick={() => setFilter('in_progress')}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'in_progress'
                    ? 'bg-yellow-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-yellow-300'
                }`}
              >
                Végrehajtás ({worklist.filter(r => r.status === 'in_progress').length})
              </button>
              <button
                onClick={() => setFilter('validation_pending')}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'validation_pending'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-purple-300'
                }`}
              >
                Validálás ({worklist.filter(r => r.status === 'validation_pending').length})
              </button>
              <button
                onClick={() => setFilter('completed')}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'completed'
                    ? 'bg-green-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-green-300'
                }`}
              >
                Elkészült ({worklist.filter(r => r.status === 'completed').length})
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* v7.0.11: Kompakt professzionális táblázat */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
        {filteredWorklist.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            <Clipboard className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-sm">
              {searchTerm ? 'Nincs találat a keresésre' : 'Nincs megjeleníthető kérés'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredWorklist.map((request, index) => {
              const StatusIcon = statusConfig[request.status]?.icon || Clock;
              
              return (
                <div 
                  key={request.id} 
                  className="px-4 py-3 hover:bg-indigo-50 transition-colors group"
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Bal oldal - Kérés infó */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900 text-base">
                          {request.request_number}
                        </h3>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${statusConfig[request.status]?.color}`}>
                          {statusConfig[request.status]?.label}
                        </span>
                        {request.urgency !== 'normal' && (
                          <span className={`text-xs font-bold ${urgencyConfig[request.urgency].color}`}>
                            {urgencyConfig[request.urgency].label}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-700 mb-1.5 font-medium">
                        {request.sample_description || request.internal_id}
                      </p>

                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(request.created_at).toLocaleDateString('hu-HU')}
                        </span>
                        {request.deadline && (
                          <span className="flex items-center gap-1 text-orange-600 font-semibold">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(request.deadline).toLocaleDateString('hu-HU')}
                          </span>
                        )}
                        <span className="font-medium">{request.company_name}</span>
                      </div>

                      {/* Vizsgálatok */}
                      {request.test_list && request.test_list.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <div className="flex flex-wrap gap-1.5">
                            {request.test_list.map((test) => (
                              <div 
                                key={test.id}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                                  test.status === 'completed' 
                                    ? 'bg-green-100 text-green-700 border border-green-200' 
                                    : test.status === 'in_progress'
                                    ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                                }`}
                              >
                                <span className="font-semibold">{test.name}</span>
                                {test.status === 'completed' && <CheckCircle className="w-3 h-3" />}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Közép - Progress */}
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-sm font-bold text-gray-900">
                          {request.my_completed_count} / {request.my_test_count}
                        </div>
                        <div className="text-xs text-gray-600">vizsgálat</div>
                      </div>
                      <div className="w-20">
                        <div className="bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              request.progress === 100 ? 'bg-green-500' : 'bg-indigo-600'
                            }`}
                            style={{ width: `${request.progress}%` }}
                          />
                        </div>
                        <div className="text-xs text-center text-gray-700 font-semibold mt-0.5">
                          {request.progress}%
                        </div>
                      </div>
                    </div>

                    {/* Jobb oldal - Gomb */}
                    <button
                      onClick={() => navigate(`/test-results/${request.id}`)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
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
