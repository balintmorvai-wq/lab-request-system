import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Truck, Package, CheckCircle, Clock, Search, Filter, AlertCircle, MapPin, User, Phone } from 'lucide-react';

function Logistics() {
  const { user, getAuthHeaders, API_URL } = useAuth();
  const [logistics, setLogistics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Szűrők
  const [filter, setFilter] = useState('awaiting_shipment'); // v7.0.31: Default "szállításra vár"
  const [logisticsFilter, setLogisticsFilter] = useState('all'); // 'all', 'sender', 'provider'
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLogistics();
  }, []);

  const fetchLogistics = async () => {
    try {
      const response = await fetch(`${API_URL}/logistics`, {
        headers: getAuthHeaders()
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
        `${API_URL}/logistics/${requestId}/update-status`,
        {
          method: 'PUT',
          headers: {
            ...getAuthHeaders(),
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
  // v7.0.30: 'laboratory' → 'provider' (backend kompatibilitás)
  const logisticsTypeConfig = {
    sender: {
      label: 'Feladó intézi',
      icon: User,
      color: 'bg-purple-100 text-purple-700'
    },
    provider: {  // Backend: 'provider' (NEM 'laboratory'!)
      label: 'Szolgáltató intézi',
      icon: Truck,
      color: 'bg-indigo-100 text-indigo-700'
    }
  };

  // v7.0.30: Fallback config undefined státusz/logistics_type esetére
  const fallbackStatusConfig = {
    label: 'Ismeretlen státusz',
    color: 'bg-gray-100 text-gray-800',
    icon: AlertCircle,
    nextStatus: null,
    nextLabel: null
  };

  const fallbackLogisticsConfig = {
    label: 'Nincs megadva',
    icon: Package,
    color: 'bg-gray-100 text-gray-700'
  };

  // Stats számítás státuszonként (simple count only)
  const getStats = (status) => {
    return logistics.filter(req => {
      if (req.status !== status) return false;
      if (logisticsFilter !== 'all' && req.logistics_type !== logisticsFilter) return false;
      return true;
    }).length;
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

  // Jogosultság ellenőrzés státusz változtatáshoz (státusz-specifikus)
  const canChangeStatus = (status) => {
    // awaiting_shipment → in_transit: logistics munkatársak
    if (status === 'awaiting_shipment') {
      return user?.role === 'university_logistics' || user?.role === 'company_logistics';
    }
    // in_transit → arrived_at_provider: company admin vagy super admin
    if (status === 'in_transit') {
      return user?.role === 'company_admin' || user?.role === 'super_admin';
    }
    return false;
  };

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

      {/* Dashboard Kártyák - csak 3 logisztikai státusz */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Szállításra vár */}
          <button
            onClick={() => setFilter('awaiting_shipment')}
            className={`bg-white rounded-xl shadow-lg p-6 border-2 transition-all transform hover:scale-105 ${
              filter === 'awaiting_shipment' 
                ? 'border-orange-500 ring-4 ring-orange-200 shadow-xl' 
                : 'border-gray-200 hover:border-orange-400 hover:shadow-2xl'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-6 h-6 text-orange-600" />
              <p className="text-sm font-bold text-gray-700 uppercase tracking-wide">Szállításra vár</p>
            </div>
            <p className="text-4xl font-extrabold text-orange-600">
              {getStats('awaiting_shipment')}
            </p>
          </button>

          {/* Szállítás alatt */}
          <button
            onClick={() => setFilter('in_transit')}
            className={`bg-white rounded-xl shadow-lg p-6 border-2 transition-all transform hover:scale-105 ${
              filter === 'in_transit' 
                ? 'border-blue-500 ring-4 ring-blue-200 shadow-xl' 
                : 'border-gray-200 hover:border-blue-400 hover:shadow-2xl'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Truck className="w-6 h-6 text-blue-600" />
              <p className="text-sm font-bold text-gray-700 uppercase tracking-wide">Szállítás alatt</p>
            </div>
            <p className="text-4xl font-extrabold text-blue-600">
              {getStats('in_transit')}
            </p>
          </button>

          {/* Megérkezett */}
          <button
            onClick={() => setFilter('arrived_at_provider')}
            className={`bg-white rounded-xl shadow-lg p-6 border-2 transition-all transform hover:scale-105 ${
              filter === 'arrived_at_provider' 
                ? 'border-green-500 ring-4 ring-green-200 shadow-xl' 
                : 'border-gray-200 hover:border-green-400 hover:shadow-2xl'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <p className="text-sm font-bold text-gray-700 uppercase tracking-wide">Megérkezett</p>
            </div>
            <p className="text-4xl font-extrabold text-green-600">
              {getStats('arrived_at_provider')}
            </p>
          </button>
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
                onClick={() => setLogisticsFilter('provider')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  logisticsFilter === 'provider'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-indigo-300'
                }`}
              >
                Szolgáltató intézi
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
              // v7.0.30: Fallback config használata undefined esetén (crash fix)
              const statusInfo = statusConfig[req.status] || fallbackStatusConfig;
              const logisticsInfo = logisticsTypeConfig[req.logistics_type] || fallbackLogisticsConfig;
              const StatusIcon = statusInfo.icon;
              const LogisticsIcon = logisticsInfo.icon;

              return (
                <div key={req.id} className="p-4 sm:p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col gap-4">
                    {/* v7.0.31: Mobile-first fejléc */}
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base sm:text-lg font-bold text-gray-900">{req.request_number}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${statusInfo.color}`}>
                        <StatusIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span className="hidden xs:inline">{statusInfo.label}</span>
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${logisticsInfo.color}`}>
                        <LogisticsIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span className="hidden xs:inline">{logisticsInfo.label}</span>
                      </span>
                    </div>

                    {/* v7.0.31: NAGY, olvasható kontakt info - minta leírás NINCS */}
                    <div className="space-y-3">
                      {/* Szállítási cím - NAGY, hangsúlyos */}
                      {req.shipping_address && (
                        <div className="flex items-start gap-3 bg-indigo-50 p-3 rounded-lg">
                          <MapPin className="w-6 h-6 text-indigo-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-indigo-600 uppercase mb-1">Cím</p>
                            <p className="text-base sm:text-lg font-bold text-gray-900 leading-tight break-words">{req.shipping_address}</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Kontakt személy + telefon - mobile-optimalizált grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Kontakt személy */}
                        {req.contact_person && (
                          <div className="flex items-center gap-3 bg-purple-50 p-3 rounded-lg">
                            <User className="w-6 h-6 text-purple-600 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-purple-600 uppercase">Kontakt</p>
                              <p className="text-base sm:text-lg font-bold text-gray-900 truncate">{req.contact_person}</p>
                            </div>
                          </div>
                        )}
                        
                        {/* Telefonszám - HÍVHATÓ link */}
                        {req.contact_phone && (
                          <div className="flex items-center gap-3 bg-green-50 p-3 rounded-lg">
                            <Phone className="w-6 h-6 text-green-600 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-green-600 uppercase">Telefon</p>
                              <a 
                                href={`tel:${req.contact_phone}`} 
                                className="text-base sm:text-lg font-bold text-green-600 hover:text-green-700 hover:underline block truncate"
                              >
                                {req.contact_phone}
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Cég név - kisebb, szürke */}
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                        <span className="text-sm text-gray-600">{req.company_name}</span>
                      </div>
                    </div>

                    {/* Sürgősség - mobile-optimalizált */}
                    {req.urgency !== 'normal' && (
                      <div className={`flex items-center gap-2 p-2 rounded-lg ${
                        req.urgency === 'critical' ? 'bg-red-100' : 'bg-orange-100'
                      }`}>
                        <AlertCircle className={`w-5 h-5 flex-shrink-0 ${
                          req.urgency === 'critical' ? 'text-red-600' : 'text-orange-600'
                        }`} />
                        <span className={`text-sm font-bold ${
                          req.urgency === 'critical' ? 'text-red-600' : 'text-orange-600'
                        }`}>
                          {req.urgency === 'critical' ? 'KRITIKUS SÜRGŐSSÉG' : 'SÜRGŐS'}
                        </span>
                      </div>
                    )}

                    {/* Státusz gomb - full width mobil-on */}
                    {canChangeStatus(req.status) && statusInfo.nextStatus && (
                      <button
                        onClick={() => updateStatus(req.id, statusInfo.nextStatus)}
                        className="w-full px-4 py-3 sm:py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg text-base sm:text-lg font-bold hover:from-indigo-700 hover:to-blue-700 transition-all shadow-md hover:shadow-lg active:scale-95"
                      >
                        {statusInfo.nextLabel}
                      </button>
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
