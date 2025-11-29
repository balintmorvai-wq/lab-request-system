import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Truck, Package, CheckCircle, Clock, Search, Filter, AlertCircle, MapPin, User, Phone } from 'lucide-react';

function Logistics() {
  const { user } = useContext(AuthContext);
  const [logistics, setLogistics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Szűrők
  const [filter, setFilter] = useState('all');
  const [logisticsFilter, setLogisticsFilter] = useState('all'); // 'all', 'sender', 'laboratory'
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLogistics();
  }, []);

  const fetchLogistics = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/logistics`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Hiba a logisztikai adatok lekérésekor');

      const data = await response.json();
      setLogistics(data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const updateStatus = async (requestId, newStatus) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/logistics/${requestId}/update-status`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: newStatus })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Hiba a státusz frissítésekor');
      }

      // Refresh data
      fetchLogistics();
      alert('Státusz sikeresen frissítve!');
    } catch (err) {
      alert(`Hiba: ${err.message}`);
    }
  };

  // Státusz config
  const statusConfig = {
    awaiting_shipment: {
      label: 'Szállításra vár',
      color: 'bg-orange-100 text-orange-800',
      icon: Package,
      nextStatus: 'in_transit',
      nextLabel: 'Szállítás indítása'
    },
    in_transit: {
      label: 'Szállítás alatt',
      color: 'bg-blue-100 text-blue-800',
      icon: Truck,
      nextStatus: 'arrived_at_provider',
      nextLabel: 'Megérkezett'
    },
    arrived_at_provider: {
      label: 'Szolgáltatóhoz megérkezett',
      color: 'bg-green-100 text-green-800',
      icon: CheckCircle,
      nextStatus: null,
      nextLabel: null
    }
  };

  // Logistics type config
  const logisticsTypeConfig = {
    sender: {
      label: 'Feladó intézi',
      icon: User,
      color: 'bg-purple-100 text-purple-700'
    },
    laboratory: {
      label: 'Labor intézi',
      icon: Truck,
      color: 'bg-indigo-100 text-indigo-700'
    }
  };

  // Stats számítás státuszonként
  const getDetailedStats = (status) => {
    const filtered = logistics.filter(req => {
      if (status !== 'all' && req.status !== status) return false;
      if (logisticsFilter !== 'all' && req.logistics_type !== logisticsFilter) return false;
      return true;
    });

    return {
      requestCount: filtered.length,
      urgentCount: filtered.filter(r => r.urgency === 'urgent' || r.urgency === 'critical').length
    };
  };

  // Szűrt lista
  const filteredLogistics = logistics.filter(req => {
    // Státusz szűrő
    if (filter !== 'all' && req.status !== filter) return false;
    
    // Logisztikai típus szűrő
    if (logisticsFilter !== 'all' && req.logistics_type !== logisticsFilter) return false;
    
    // Keresés
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        req.request_number?.toLowerCase().includes(search) ||
        req.sample_description?.toLowerCase().includes(search) ||
        req.company_name?.toLowerCase().includes(search) ||
        req.shipping_address?.toLowerCase().includes(search)
      );
    }
    
    return true;
  });

  // Jogosultság ellenőrzés státusz változtatáshoz
  const canChangeStatus = user?.role in ['super_admin', 'university_logistics', 'company_logistics'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Betöltés...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Hiba: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Fejléc */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center gap-3">
          <Truck className="w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold">Logisztikai Modul</h1>
            <p className="text-indigo-100 text-sm">Szállítások kezelése és nyomon követése</p>
          </div>
        </div>
      </div>

      {/* Dashboard Kártyák */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Összes */}
          <button
            onClick={() => setFilter('all')}
            className={`bg-white rounded-xl shadow-lg p-5 border-2 transition-all transform hover:scale-105 ${
              filter === 'all' 
                ? 'border-indigo-500 ring-4 ring-indigo-200 shadow-xl' 
                : 'border-gray-200 hover:border-indigo-400 hover:shadow-2xl'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-5 h-5 text-indigo-600" />
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Összes</p>
            </div>
            <p className="text-3xl font-extrabold text-indigo-600">
              {getDetailedStats('all').requestCount}
            </p>
            <p className="text-xs text-gray-600 font-medium mt-1">
              {getDetailedStats('all').urgentCount} sürgős
            </p>
          </button>

          {/* Szállításra vár */}
          {(() => {
            const stats = getDetailedStats('awaiting_shipment');
            return (
              <button
                onClick={() => setFilter('awaiting_shipment')}
                className={`bg-white rounded-xl shadow-lg p-5 border-2 transition-all transform hover:scale-105 ${
                  filter === 'awaiting_shipment' 
                    ? 'border-orange-500 ring-4 ring-orange-200 shadow-xl' 
                    : 'border-gray-200 hover:border-orange-400 hover:shadow-2xl'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-5 h-5 text-orange-600" />
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Szállításra vár</p>
                </div>
                <p className="text-3xl font-extrabold text-orange-600">
                  {stats.requestCount}
                </p>
                <p className="text-xs text-gray-600 font-medium mt-1">
                  {stats.urgentCount} sürgős
                </p>
              </button>
            );
          })()}

          {/* Szállítás alatt */}
          {(() => {
            const stats = getDetailedStats('in_transit');
            return (
              <button
                onClick={() => setFilter('in_transit')}
                className={`bg-white rounded-xl shadow-lg p-5 border-2 transition-all transform hover:scale-105 ${
                  filter === 'in_transit' 
                    ? 'border-blue-500 ring-4 ring-blue-200 shadow-xl' 
                    : 'border-gray-200 hover:border-blue-400 hover:shadow-2xl'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Truck className="w-5 h-5 text-blue-600" />
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Szállítás alatt</p>
                </div>
                <p className="text-3xl font-extrabold text-blue-600">
                  {stats.requestCount}
                </p>
                <p className="text-xs text-gray-600 font-medium mt-1">
                  {stats.urgentCount} sürgős
                </p>
              </button>
            );
          })()}

          {/* Megérkezett */}
          {(() => {
            const stats = getDetailedStats('arrived_at_provider');
            return (
              <button
                onClick={() => setFilter('arrived_at_provider')}
                className={`bg-white rounded-xl shadow-lg p-5 border-2 transition-all transform hover:scale-105 ${
                  filter === 'arrived_at_provider' 
                    ? 'border-green-500 ring-4 ring-green-200 shadow-xl' 
                    : 'border-gray-200 hover:border-green-400 hover:shadow-2xl'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Megérkezett</p>
                </div>
                <p className="text-3xl font-extrabold text-green-600">
                  {stats.requestCount}
                </p>
                <p className="text-xs text-gray-600 font-medium mt-1">
                  {stats.urgentCount} sürgős
                </p>
              </button>
            );
          })()}
        </div>
      </div>

      {/* Keresés és Szűrők */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="space-y-4">
          {/* Kereső */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Keresés kérésszám, leírás, cím, cég alapján..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Logisztikai típus szűrő */}
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">Logisztika:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setLogisticsFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  logisticsFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-indigo-300'
                }`}
              >
                Összes
              </button>
              <button
                onClick={() => setLogisticsFilter('sender')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  logisticsFilter === 'sender'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-purple-300'
                }`}
              >
                Feladó intézi
              </button>
              <button
                onClick={() => setLogisticsFilter('laboratory')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  logisticsFilter === 'laboratory'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-indigo-300'
                }`}
              >
                Labor intézi
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Logisztikai Lista */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {filteredLogistics.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">Nincs megjeleníthető logisztikai kérés</p>
            <p className="text-sm mt-2">Próbáld meg módosítani a szűrőket</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredLogistics.map((req) => {
              const statusInfo = statusConfig[req.status];
              const logisticsInfo = logisticsTypeConfig[req.logistics_type];
              const StatusIcon = statusInfo.icon;
              const LogisticsIcon = logisticsInfo.icon;

              return (
                <div key={req.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Bal - Kérés info */}
                    <div className="flex-1 space-y-3">
                      {/* Fejléc */}
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-gray-900">{req.request_number}</h3>
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${statusInfo.color}`}>
                              <StatusIcon className="w-3.5 h-3.5" />
                              {statusInfo.label}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${logisticsInfo.color}`}>
                              <LogisticsIcon className="w-3.5 h-3.5" />
                              {logisticsInfo.label}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{req.sample_description}</p>
                        </div>
                      </div>

                      {/* Cég és logisztikai adatok */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-gray-700">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{req.company_name}</span>
                        </div>
                        {req.shipping_address && (
                          <div className="flex items-start gap-2 text-gray-700">
                            <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                            <span className="text-xs">{req.shipping_address}</span>
                          </div>
                        )}
                        {req.contact_person && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-xs">{req.contact_person}</span>
                          </div>
                        )}
                        {req.contact_phone && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span className="text-xs">{req.contact_phone}</span>
                          </div>
                        )}
                      </div>

                      {/* Sürgősség */}
                      {req.urgency !== 'normal' && (
                        <div className="flex items-center gap-2">
                          <AlertCircle className={`w-4 h-4 ${
                            req.urgency === 'critical' ? 'text-red-600' : 'text-orange-600'
                          }`} />
                          <span className={`text-xs font-bold ${
                            req.urgency === 'critical' ? 'text-red-600' : 'text-orange-600'
                          }`}>
                            {req.urgency === 'critical' ? 'KRITIKUS' : 'SÜRGŐS'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Jobb - Státusz gomb */}
                    {canChangeStatus && statusInfo.nextStatus && (
                      <div className="lg:w-48">
                        <button
                          onClick={() => updateStatus(req.id, statusInfo.nextStatus)}
                          className="w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg font-semibold hover:from-indigo-700 hover:to-blue-700 transition-all shadow-md hover:shadow-lg transform hover:scale-105"
                        >
                          {statusInfo.nextLabel}
                        </button>
                      </div>
                    )}
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

export default Logistics;
