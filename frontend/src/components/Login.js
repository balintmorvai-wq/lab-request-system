import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Lock } from 'lucide-react';

function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (!email || !password) {
      setError('Kérlek töltsd ki az összes mezőt');
      return;
    }

    if (!email.includes('@')) {
      setError('Érvénytelen email formátum');
      return;
    }

    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      // Enhanced error messages
      if (err.response?.status === 401) {
        setError('Az email cím vagy jelszó helytelen');
      } else if (err.response?.status === 404) {
        setError('Nincs regisztrált felhasználó ezzel az email címmel');
      } else if (err.code === 'ERR_NETWORK') {
        setError('Kapcsolódási hiba. Kérlek ellenőrizd az internetkapcsolatot');
      } else {
        setError(err.response?.data?.message || 'Sikertelen bejelentkezés');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: 'url(/background.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div 
          className="absolute inset-0 bg-slate-900 backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)' }}
        />
      </div>

      {/* Login Card */}
      <div className="relative z-10 max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          
          {/* Logo Section */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-8 text-center border-b border-gray-100">
            <img 
              src="/pannon-logo.png" 
              alt="Pannon Egyetem" 
              className="w-32 h-auto mx-auto mb-3"
            />
            <h1 className="text-xl font-semibold text-gray-800">
              Laborkérés Kezelő Rendszer
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Pannon Egyetem
            </p>
          </div>

          {/* Login Form */}
          <div className="p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Bejelentkezés</h2>
              <p className="text-gray-600 text-sm mt-1">Lépj be a fiókodba</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 flex items-start gap-3 text-red-700 bg-red-50 border border-red-200 p-4 rounded-lg">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Sikertelen bejelentkezés</p>
                  <p className="text-sm mt-0.5">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Email Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email cím
                </label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="pelda@email.hu"
                  disabled={loading}
                />
              </div>

              {/* Password Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jelszó
                </label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  disabled={loading}
                />
              </div>

              {/* Submit Button */}
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-200 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Bejelentkezés...' : 'Bejelentkezés'}
              </button>
            </form>
          </div>

          {/* Footer with MOL Partner */}
          <div className="bg-gray-50 px-8 py-4 border-t border-gray-100">
            <div className="flex items-center justify-center gap-3">
              <p className="text-xs text-gray-500">Együttműködő partner:</p>
              <img 
                src="/mol-logo.png" 
                alt="MOL Group" 
                className="h-6 w-auto opacity-80"
              />
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <p className="text-center text-white text-xs mt-6 opacity-75 flex items-center justify-center gap-1">
          <Lock className="w-4 h-4" />
          Biztonságos kapcsolat SSL titkosítással
        </p>
      </div>
    </div>
  );
}

export default Login;
