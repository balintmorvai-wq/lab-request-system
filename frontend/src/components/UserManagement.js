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
  const [departments, setDepartments] = useState([]);  // v7.0.1: Departments
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
    department_id: '',  // v7.0.1: Department
    phone: ''
  });

  const fetchData = useCallback(async () => {
    try {
      const [usersRes, companiesRes, departmentsRes] = await Promise.all([
        axios.get(`${API_URL}/users`, { headers: getAuthHeaders() }),
        axios.get(`${API_URL}/companies`, { headers: getAuthHeaders() }),
        axios.get(`${API_URL}/departments`, { headers: getAuthHeaders() })  // v7.0.1
      ]);
      
      setUsers(usersRes.data);
      setCompanies(companiesRes.data);
      setDepartments(departmentsRes.data);  // v7.0.1
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

    // v7.0.1: Validation - labor_staff requires department
    if (formData.role === 'labor_staff' && !formData.department_id) {
      setError('Labor munkatársnál kötelező a szervezeti egység megadása!');
      return;
    }

    try {
      const dataToSend = { ...formData };
      
      // Don't send empty password on edit
      if (editingId && !dataToSend.password) {
        delete dataToSend.password;
      }

      // Convert empty strings to null
      if (!dataToSend.company_id) dataToSend.company_id = null;
      if (!dataToSend.department_id) dataToSend.department_id = null;  // v7.0.1

      if (editingId) {
        await axios.put(`${API_URL}/users/${editingId}`, dataToSend, { 
          headers: getAuthHeaders() 
        });
      } else {
        await axios.post(`${API_URL}/users`, dataToSend, { 
          headers: getAuthHeaders() 
        });
      }
      
      setShowModal(false);
      setEditingId(null);
      setFormData({
        email: '',
        password: '',
        name: '',
        role: 'company_user',
        company_id: '',
        department_id: '',  // v7.0.1
        phone: ''
      });
      fetchData();
    } catch (error) {
      setError(error.response?.data?.message || 'Hiba történt a mentés során!');
    }
  };

  const handleEdit = (user) => {
    setEditingId(user.id);
    setFormData({
      email: user.email,
      password: '',
      name: user.name,
      role: user.role,
      company_id: user.company_id || '',
      department_id: user.department_id || '',  // v7.0.1
      phone: user.phone || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Biztosan törölni szeretnéd ezt a felhasználót?')) {
      try {
        await axios.delete(`${API_URL}/users/${id}`, { 
          headers: getAuthHeaders() 
        });
        fetchData();
      } catch (error) {
        alert('Hiba történt a törlés során!');
      }
    }
  };

  const roleLabels = {
    'super_admin': 'Egyetemi adminisztrátor',
    'labor_staff': 'Labor munkatárs',
    'company_admin': 'Cég adminisztrátor',
    'company_user': 'Cég felhasználó'
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    roleLabels[u.role]?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Betöltés...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <UsersIcon className="h-8 w-8 text-indigo-600" />
          <h1 className="text-3xl font-bold text-gray-900">Felhasználók kezelése</h1>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({
              email: '',
              password: '',
              name: '',
              role: 'company_user',
              company_id: '',
              department_id: '',  // v7.0.1
              phone: ''
            });
            setShowModal(true);
          }}
          className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <UserPlus className="h-5 w-5" />
          <span>Új felhasználó</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Keresés név, email vagy szerepkör szerint..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Név
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Szerepkör
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cég / Szervezeti egység
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
            {filteredUsers.map((u) => {
              const company = companies.find(c => c.id === u.company_id);
              const department = departments.find(d => d.id === u.department_id);  // v7.0.1
              
              return (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{u.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">{u.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      u.role === 'super_admin' ? 'bg-purple-100 text-purple-800' :
                      u.role === 'labor_staff' ? 'bg-blue-100 text-blue-800' :
                      u.role === 'company_admin' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {roleLabels[u.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {/* v7.0.1: Show department for labor_staff, company for others */}
                      {u.role === 'labor_staff' ? (
                        department ? (
                          <span className="text-blue-600">🏢 {department.name}</span>
                        ) : (
                          <span className="text-red-600">⚠️ Nincs megadva</span>
                        )
                      ) : (
                        company?.name || '-'
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">{u.phone || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(u)}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      <Edit2 className="h-5 w-5" />
                    </button>
                    {u.id !== user.id && (
                      <button
                        onClick={() => handleDelete(u.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">
                {editingId ? 'Felhasználó szerkesztése' : 'Új felhasználó'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <p className="ml-3 text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Név</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Jelszó {editingId && '(üresen hagyva nem változik)'}
                </label>
                <input
                  type="password"
                  required={!editingId}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Szerepkör</label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="company_user">Cég felhasználó</option>
                  <option value="company_admin">Cég adminisztrátor</option>
                  <option value="labor_staff">Labor munkatárs</option>
                  <option value="super_admin">Egyetemi adminisztrátor</option>
                </select>
              </div>

              {/* v7.0.1: Department select for labor_staff */}
              {formData.role === 'labor_staff' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Szervezeti egység <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.department_id}
                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="">-- Válassz szervezeti egységet --</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Labor munkatársaknál kötelező megadni a szervezeti egységet
                  </p>
                </div>
              )}

              {/* Company select for company roles */}
              {(formData.role === 'company_admin' || formData.role === 'company_user') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Cég</label>
                  <select
                    required
                    value={formData.company_id}
                    onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="">-- Válassz céget --</option>
                    {companies.map(comp => (
                      <option key={comp.id} value={comp.id}>
                        {comp.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">Telefon</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setError('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Mégse
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  {editingId ? 'Mentés' : 'Létrehozás'}
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
