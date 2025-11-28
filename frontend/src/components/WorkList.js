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
  const [departmentFilter, setDepartmentFilter] = useState('all'); // v7.0.14: Department szűrő (super_admin)
  const [departments, setDepartments] = useState([]); // v7.0.14: Department lista

  useEffect(() => {
    fetchWorklist();
    if (user?.role === 'super_admin') {
      fetchDepartments();
    }
  }, [user]);

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

  const fetchDepartments = async () => {
    try {
      const response = await axios.get(`${API_URL}/departments`, {
        headers: getAuthHeaders()
      });
      setDepartments(response.data);
    } catch (error) {
      console.error('Department lekérési hiba:', error);
    }
  };

  // v7.0.26: ÚJ 4 státusz szűrés - department-specific
  const filteredWorklist = worklist.filter(req => {
    // 1. Department szűrés (legfelső szint)
    if (departmentFilter !== 'all') {
      const hasMatchingDept = req.test_list && req.test_list.some(test => 
        test.department_name === departmentFilter
      );
      if (!hasMatchingDept) return false;
    }
    
    // 2. Státusz szűrés (egyszerűsített - kérés státusz alapján)
    if (filter === 'in_progress') {
      return req.status === 'in_progress';
    }
    
    if (filter === 'validation_pending') {
      return req.status === 'validation_pending';
    }
    
    if (filter === 'completed') {
      return req.status === 'completed';
    }
    
    // 3. Keresés (request_number, sample_description, internal_id, company_name)
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

  // v7.0.25: Részletes státusz számolás vizsgálat szinten
  const getDetailedStats = (status) => {
    const myDeptName = user?.department_name;
    let requestCount = 0;
    let completedTests = 0;
    let totalTests = 0;
    
    worklist.forEach(req => {
      if (req.status !== status) return;
      
      const myDeptTests = req.test_list?.filter(t => t.department_name === myDeptName) || [];
      if (myDeptTests.length === 0) return;
      
      requestCount++;
      totalTests += myDeptTests.length;
      
      if (status === 'in_progress') {
        // Végrehajtás alatt: completed státuszú vizsgálatok (végrehajtva)
        completedTests += myDeptTests.filter(t => t.status === 'completed').length;
      } else if (status === 'validation_pending') {
        // Validálás alatt: completed státuszú vizsgálatok (validálva az admin által)
        // totalTests = minden vizsgálat (validation_pending + completed)
        completedTests += myDeptTests.filter(t => t.status === 'completed').length;
      } else if (status === 'completed') {
        // Elkészült: minden vizsgálat completed (final)
        completedTests += myDeptTests.filter(t => t.status === 'completed').length;
      }
    });
    
    return { requestCount, completedTests, totalTests };
  };

  // v7.0.25: Kérés számolás státusz szerint
  const getTestCountByStatus = (status) => {
    if (status === 'all') return worklist.length;
    return worklist.filter(req => req.status === status).length;
  };

  // v7.0.25: Kérés statisztikák számolása department filter alapján
  const getRequestStats = (request) => {
    const filteredTests = getFilteredTests(request);
    const totalCount = filteredTests.length;
    
    let completedCount = 0;
    if (request.status === 'validation_pending' || request.status === 'completed') {
      // Validation_pending vagy completed: completed státuszú vizsgálatok
      completedCount = filteredTests.filter(t => t.status === 'completed').length;
    } else {
      // in_progress: completed státuszú vizsgálatok
      completedCount = filteredTests.filter(t => t.status === 'completed').length;
    }
    
    const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    
    return { totalCount, completedCount, progress };
  };

  // v7.0.15: Kérés vizsgálatok szűrése department szerint (renderhez)
  const getFilteredTests = (request) => {
    if (!request.test_list) return [];
    
    if (departmentFilter === 'all') {
      return request.test_list;
    }
    
    return request.test_list.filter(test => test.department_name === departmentFilter);
  };

  const statusConfig = {
    in_progress: {
      label: 'Végrehajtás alatt',
      color: 'bg-yellow-100 text-yellow-800',
      icon: Clock
    },
    validation_pending: {
      label: 'Validálás alatt',
      color: 'bg-purple-100 text-purple-800',
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

        {/* v7.0.25: Professzionális statisztika kártyák - 3 státusz + részletes progress */}
        <div className="p-6 bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* 1. Végrehajtás alatt */}
            {(() => {
              const stats = getDetailedStats('in_progress');
              const progress = stats.totalTests > 0 ? Math.round((stats.completedTests / stats.totalTests) * 100) : 0;
              
              return (
                <button
                  onClick={() => setFilter('in_progress')}
                  className={`bg-white rounded-xl shadow-lg p-5 border-2 transition-all transform hover:scale-105 ${
                    filter === 'in_progress' 
                      ? 'border-yellow-500 ring-4 ring-yellow-200 shadow-xl' 
                      : 'border-gray-200 hover:border-yellow-400 hover:shadow-2xl'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-5 h-5 text-yellow-600" />
                        <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Végrehajtás alatt</p>
                      </div>
                      <p className="text-3xl font-extrabold text-yellow-600 mb-1">
                        {stats.requestCount}
                      </p>
                      <p className="text-xs text-gray-600 font-medium">
                        {stats.completedTests}/{stats.totalTests} eredmény rögzítve
                      </p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5 font-semibold text-right">{progress}%</p>
                </button>
              );
            })()}

            {/* 2. Validálás alatt */}
            {(() => {
              const stats = getDetailedStats('validation_pending');
              const progress = stats.totalTests > 0 ? Math.round((stats.completedTests / stats.totalTests) * 100) : 0;
              
              return (
                <button
                  onClick={() => setFilter('validation_pending')}
                  className={`bg-white rounded-xl shadow-lg p-5 border-2 transition-all transform hover:scale-105 ${
                    filter === 'validation_pending' 
                      ? 'border-purple-500 ring-4 ring-purple-200 shadow-xl' 
                      : 'border-gray-200 hover:border-purple-400 hover:shadow-2xl'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className="w-5 h-5 text-purple-600" />
                        <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Validálás alatt</p>
                      </div>
                      <p className="text-3xl font-extrabold text-purple-600 mb-1">
                        {stats.requestCount}
                      </p>
                      <p className="text-xs text-gray-600 font-medium">
                        {stats.completedTests}/{stats.totalTests} vizsgálat validálva
                      </p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-purple-400 to-purple-600 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5 font-semibold text-right">{progress}%</p>
                </button>
              );
            })()}

            {/* 3. Elkészült */}
            {(() => {
              const stats = getDetailedStats('completed');
              
              return (
                <button
                  onClick={() => setFilter('completed')}
                  className={`bg-white rounded-xl shadow-lg p-5 border-2 transition-all transform hover:scale-105 ${
                    filter === 'completed' 
                      ? 'border-green-500 ring-4 ring-green-200 shadow-xl' 
                      : 'border-gray-200 hover:border-green-400 hover:shadow-2xl'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Elkészült</p>
                      </div>
                      <p className="text-3xl font-extrabold text-green-600 mb-1">
                        {stats.requestCount}
                      </p>
                      <p className="text-xs text-gray-600 font-medium">
                        {stats.totalTests} vizsgálat lezárva
                      </p>
                    </div>
                  </div>
                  {/* Success indicator */}
                  <div className="flex items-center gap-2 bg-green-50 rounded-lg p-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-xs text-green-700 font-semibold">Minden vizsgálat kész</span>
                  </div>
                </button>
              );
            })()}
          </div>

          {/* v7.0.16: Department szűrő KÁRTYÁK UTÁN */}
          {user?.role === 'super_admin' && departments.length > 0 && (
            <div className="mt-4 pt-4 border-t-2 border-indigo-200 bg-gradient-to-b from-indigo-50 to-transparent rounded-lg p-4">
              <p className="text-sm font-bold text-gray-800 mb-3">🔍 Szervezeti egység szűrés:</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setDepartmentFilter('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    departmentFilter === 'all'
                      ? 'bg-indigo-600 text-white shadow-lg scale-105'
                      : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-indigo-400 hover:shadow-md'
                  }`}
                >
                  ✨ Összes szervezet
                </button>
                {departments.map((dept) => (
                  <button
                    key={dept.id}
                    onClick={() => setDepartmentFilter(dept.name)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      departmentFilter === dept.name
                        ? 'bg-indigo-600 text-white shadow-lg scale-105'
                        : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-indigo-400 hover:shadow-md'
                    }`}
                  >
                    {dept.name}
                  </button>
                ))}
              </div>
            </div>
          )}

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

            {/* v7.0.25: Státusz szűrők - 3 egyszerűsített státusz */}
            <div className="flex gap-2 flex-wrap">
              {(() => {
                const inProgressStats = getDetailedStats('in_progress');
                const validationStats = getDetailedStats('validation_pending');
                const completedStats = getDetailedStats('completed');
                
                return (
                  <>
                    <button
                      onClick={() => setFilter('in_progress')}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                        filter === 'in_progress'
                          ? 'bg-yellow-600 text-white shadow-md'
                          : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-yellow-300'
                      }`}
                    >
                      Végrehajtás alatt ({inProgressStats.requestCount})
                    </button>
                    <button
                      onClick={() => setFilter('validation_pending')}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                        filter === 'validation_pending'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-purple-300'
                      }`}
                    >
                      Validálás alatt ({validationStats.requestCount})
                    </button>
                    <button
                      onClick={() => setFilter('completed')}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                        filter === 'completed'
                          ? 'bg-green-600 text-white shadow-md'
                          : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-green-300'
                      }`}
                    >
                      Elkészült ({completedStats.requestCount})
                    </button>
                    <button
                      onClick={() => setFilter('all')}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                        filter === 'all'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-indigo-300'
                      }`}
                    >
                      Összes ({worklist.length})
                    </button>
                  </>
                );
              })()}
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
                      // v7.0.25: Egyszerűsített státusz (kérés státusz alapján)
                      const displayStatus = request.status;
                      const StatusIcon = statusConfig[displayStatus]?.icon || Clock;
                      
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
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${statusConfig[displayStatus]?.color}`}>
                          {statusConfig[displayStatus]?.label}
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

                      {/* v7.0.25: Vizsgálatok (csak department-matching) */}
                      {(() => {
                        const filteredTests = getFilteredTests(request);
                        return filteredTests.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <div className="flex flex-wrap gap-1.5">
                              {filteredTests.map((test) => {
                                // v7.0.25: Státusz alapú színkód (egyszerűsített)
                                let badgeClass = '';
                                let icon = null;
                                
                                if (request.status === 'validation_pending') {
                                  // Validálás alatt kérés esetén: completed = validált
                                  if (test.status === 'completed') {
                                    badgeClass = 'bg-green-100 text-green-700 border border-green-200';
                                    icon = <CheckCircle className="w-3 h-3" />;
                                  } else {
                                    // validation_pending de még nem validált
                                    badgeClass = 'bg-purple-100 text-purple-700 border border-purple-200';
                                    icon = <AlertCircle className="w-3 h-3" />;
                                  }
                                } else if (request.status === 'completed') {
                                  // Elkészült kérés - minden completed
                                  badgeClass = 'bg-green-100 text-green-700 border border-green-200';
                                  icon = <CheckCircle className="w-3 h-3" />;
                                } else {
                                  // in_progress - completed vagy pending
                                  if (test.status === 'completed') {
                                    badgeClass = 'bg-blue-100 text-blue-700 border border-blue-200';
                                    icon = <CheckCircle className="w-3 h-3" />;
                                  } else {
                                    badgeClass = 'bg-gray-100 text-gray-600 border border-gray-200';
                                    icon = <Clock className="w-3 h-3" />;
                                  }
                                }
                                
                                return (
                                  <div 
                                    key={test.id}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${badgeClass}`}
                                  >
                                    {icon}
                                    <span className="font-semibold">{test.name}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Közép - Progress (v7.0.25: department filter alapján) */}
                    {(() => {
                      const { totalCount, completedCount, progress } = getRequestStats(request);
                      return (
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="text-sm font-bold text-gray-900">
                              {completedCount} / {totalCount}
                            </div>
                            <div className="text-xs text-gray-600">vizsgálat</div>
                          </div>
                          <div className="w-20">
                            <div className="bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  progress === 100 ? 'bg-green-500' : 'bg-indigo-600'
                                }`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <div className="text-xs text-center text-gray-700 font-semibold mt-0.5">
                              {progress}%
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Jobb oldal - Gomb (v7.0.25: egyszerűsített) */}
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
                          Eredmények rögzítése
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
