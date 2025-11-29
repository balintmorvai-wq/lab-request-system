import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Truck, CheckCircle, AlertCircle, Loader } from 'lucide-react';

function QRScanner() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { getAuthHeaders, API_URL } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  const request_number = searchParams.get('request');
  
  const handleScan = async () => {
    if (!request_number) {
      setResult({ success: false, message: 'Hiányzó kérésszám!' });
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/logistics/scan`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ request_number })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setResult({ success: true, ...data });
        // Automatikus átirányítás 3 másodperc után
        setTimeout(() => navigate('/logistics'), 3000);
      } else {
        setResult({ success: false, message: data.message });
      }
    } catch (error) {
      setResult({ success: false, message: 'Hálózati hiba történt!' });
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (request_number) {
      handleScan();
    }
  }, [request_number]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Kártya */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center">
            {/* Icon */}
            <div className="mb-6">
              <Truck className="w-20 h-20 mx-auto text-indigo-600" />
            </div>
            
            {/* Cím */}
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              QR Kód Beolvasás
            </h1>
            <p className="text-gray-600 mb-6">
              Szállítás indítása
            </p>
            
            {/* Loading */}
            {loading && (
              <div className="py-8">
                <Loader className="w-16 h-16 mx-auto text-indigo-600 animate-spin" />
                <p className="mt-4 text-gray-600">Feldolgozás...</p>
              </div>
            )}
            
            {/* Eredmény */}
            {result && (
              <div className={`mt-6 p-6 rounded-xl border-2 ${
                result.success 
                  ? 'bg-green-50 border-green-300' 
                  : 'bg-red-50 border-red-300'
              }`}>
                {result.success ? (
                  <>
                    {/* Sikeres */}
                    <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-green-900 mb-3">
                      Sikeres!
                    </h2>
                    <p className="text-lg text-green-800 mb-2">
                      {result.message}
                    </p>
                    <p className="text-sm text-green-700 font-medium mb-4">
                      Kérés: <span className="font-bold">{result.request_number}</span>
                    </p>
                    <p className="text-sm text-green-600">
                      Átirányítás a logisztikai modulhoz...
                    </p>
                  </>
                ) : (
                  <>
                    {/* Hiba */}
                    <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-red-900 mb-3">
                      Hiba történt!
                    </h2>
                    <p className="text-lg text-red-800 mb-6">
                      {result.message}
                    </p>
                    <button
                      onClick={() => navigate('/logistics')}
                      className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors active:scale-95"
                    >
                      Vissza a logisztikához
                    </button>
                  </>
                )}
              </div>
            )}
            
            {/* Nincs request_number */}
            {!request_number && !loading && !result && (
              <div className="mt-6 p-6 bg-gray-50 rounded-xl border-2 border-gray-300">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">
                  Érvénytelen QR kód
                </p>
                <button
                  onClick={() => navigate('/logistics')}
                  className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700 transition-colors"
                >
                  Vissza
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Info kártya */}
        <div className="mt-4 text-center text-sm text-gray-600">
          <p>Csak "szállításra vár" státuszú kérések indíthatók</p>
        </div>
      </div>
    </div>
  );
}

export default QRScanner;
