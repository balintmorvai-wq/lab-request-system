import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  UserPlus, 
  Search, 
  Trash2,
  Edit2,
  X,
  AlertCircle,
  Users as UsersIcon
} from 'lucide-react';

function UserManagement() {
  const { user, getAuthHeaders, API_URL } = useAuth();
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'company_user',
    company_id: '',
    phone: ''
  });

  const fetchData = useCallback(async () => {
    try {
      const [usersRes, companiesRes] = await Promise.all([
        axios.get(`${API_URL}/users`, { headers: getAuthHeaders() }),
        axios.get(`${API_URL}/companies`, { headers: getAuthHeaders() })
      ]);
      
      setUsers(usersRes.data);
      setCompanies(companiesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [API_URL, getAuthHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (editingId) {
        // Update existing user
        await axios.put(
          `${API_URL}/users/${editingId}`,
          formData,
          { headers: getAuthHeaders() }
        );
      } else {
        // Create new user
        await axios.post(
          `${API_URL}/users`,
          formData,
          { headers: getAuthHeaders() }
        );
      }
      
      setShowModal(false);
      setEditingId(null);
      setFormData({
        email: '',
        password: '',
        name: '',
        role: 'company_user',
        company_id: '',
        phone: ''
      });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Hiba történt a művelet során');
    }
  };

  const handleEdit = (user) => {
    setEditingId(user.id);
    setFormData({
      email: user.email,
      password: '', // Don't populate password for security
      name: user.name,
      role: user.role,
      company_id: user.company_id || '',
      phone: user.phone || ''
    });
    setShowModal(true);
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Biztosan törölni szeretnéd ezt a felhasználót?')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/users/${userId}`, {
        headers: getAuthHeaders()
      });
      fetchData();
    } catch (error) {
      alert(error.response?.data?.message || 'Hiba történt a törlés során');
    }
  };

  const roleLabels = {
    super_admin: 'Super Admin',
    lab_staff: 'Labor munkatárs',
    company_admin: 'Cég Admin',
    company_user: 'Cég dolgozó'
  };

  const roleColors = {
    super_admin: 'bg-purple-100 text-purple-800',
    lab_staff: 'bg-blue-100 text-blue-800',
    company_admin: 'bg-green-100 text-green-800',
    company_user: 'bg-gray-100 text-gray-800'
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.company_name && u.company_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Betöltés...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Felhasználók</h1>
          <p className="text-gray-600 mt-1">
            Összesen {filteredUsers.length} felhasználó
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          Új felhasználó
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Keresés név, email vagy cég szerint..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Felhasználó
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Szerepkör
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cég
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Telefon
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Műveletek
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                  <UsersIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>Nincs megjeleníthető felhasználó</p>
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{u.name}</div>
                    <div className="text-sm text-gray-500">{u.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${roleColors[u.role]}`}>
                      {roleLabels[u.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {u.company_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {u.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                    {u.id !== user?.id && (
                      <>
                        <button
                          onClick={() => handleEdit(u)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <Edit2 className="w-5 h-5 inline" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-5 h-5 inline" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingId ? 'Felhasználó szerkesztése' : 'Új felhasználó létrehozása'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingId(null);
                  setError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Név *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jelszó {editingId ? '(hagyd üresen, ha nem akarod módosítani)' : '*'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required={!editingId}
                  minLength="6"
                  placeholder={editingId ? 'Hagyd üresen a megtartásához' : ''}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Szerepkör *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                >
                  {user?.role === 'super_admin' && (
                    <>
                      <option value="super_admin">Super Admin</option>
                      <option value="lab_staff">Labor munkatárs</option>
                    </>
                  )}
                  <option value="company_admin">Cég Admin</option>
                  <option value="company_user">Cég dolgozó</option>
                </select>
              </div>

              {(formData.role === 'company_admin' || formData.role === 'company_user') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cég *
                  </label>
                  <select
                    value={formData.company_id}
                    onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                    disabled={user?.role === 'company_admin'}
                  >
                    <option value="">Válassz...</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefon
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {editingId ? 'Mentés' : 'Létrehozás'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingId(null);
                    setError('');
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Mégse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
