import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertCircle } from 'lucide-react';

function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err.response?.data?.message || 'Hibás email vagy jelszó');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-cyan-50 to-teal-100 flex items-center justify-center p-4">
      <div className="max-w-5xl w-full grid md:grid-cols-2 gap-8">
        {/* Logo Section - v6.3 */}
        <div className="bg-white rounded-lg shadow-2xl p-8 flex flex-col items-center justify-center space-y-8">
          {/* Pannon Egyetem Logo */}
          <div className="text-center">
            <img 
              src="/pannon-logo.png" 
              alt="Pannon Egyetem" 
              className="w-64 h-auto mx-auto mb-4"
            />
            <p className="text-xl text-gray-700 font-medium">
              Laborkérés Kezelő Rendszer
            </p>
            <p className="text-sm text-indigo-600 font-semibold mt-2">
              v6.3
            </p>
          </div>

          <div className="border-t border-gray-200 w-full pt-6">
            <p className="text-center text-sm text-gray-600 mb-4">
              Együttműködő partner:
            </p>
            {/* MOL Group Logo */}
            <div className="flex items-center justify-center">
              <img 
                src="/mol-logo.png" 
                alt="MOL Group" 
                className="h-12 w-auto"
              />
            </div>
          </div>

          <div className="text-center text-xs text-gray-500 space-y-1">
            <p>🧪 Vizsgálattípus kezelés</p>
            <p>📁 Kategória rendszer</p>
            <p>📎 Fájl mellékletek</p>
            <p>⏱️ Átfutási idő tracking</p>
            <p>✅ Jóváhagyási workflow</p>
            <p>🔔 Értesítések</p>
          </div>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-lg shadow-2xl p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Bejelentkezés</h1>
            <p className="text-gray-600 mt-2">Lépj be a fiókodba a folytatáshoz</p>
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-lg">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email cím
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="email@pelda.hu"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Jelszó
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Bejelentkezés...' : 'Bejelentkezés'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="text-xs text-gray-500 space-y-2">
              <p className="font-semibold text-gray-700">Teszt fiókok:</p>
              <div className="bg-gray-50 p-3 rounded space-y-1">
                <p><strong>Super Admin:</strong> admin@pannon.hu / password</p>
                <p><strong>Céges Admin:</strong> admin@mol.hu / password</p>
                <p><strong>Dolgozó:</strong> user@mol.hu / password</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
