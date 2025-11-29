import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Bell, Plus, Edit2, Trash2, Save, X, AlertCircle,
  Mail, Smartphone, Check, Eye, Code
} from 'lucide-react';

function NotificationManagement() {
  const { getAuthHeaders, API_URL } = useAuth();
  const [eventTypes, setEventTypes] = useState([]);
  const [rules, setRules] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('rules'); // rules | templates
  
  // Edit states
  const [editingRule, setEditingRule] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [isCreatingRule, setIsCreatingRule] = useState(false);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);

  const roles = [
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'company_admin', label: 'Céges Admin' },
    { value: 'company_user', label: 'Céges Felhasználó' },
    { value: 'labor_staff', label: 'Labor Munkatárs' },
    { value: 'university_logistics', label: 'Egyetemi Logisztika' },
    { value: 'company_logistics', label: 'Céges Logisztika' }
  ];

  // Data fetch
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [eventsRes, rulesRes, templatesRes] = await Promise.all([
        fetch(`${API_URL}/admin/notification-event-types`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/admin/notification-rules`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/admin/notification-templates`, { headers: getAuthHeaders() })
      ]);

      const eventsData = await eventsRes.json();
      const rulesData = await rulesRes.json();
      const templatesData = await templatesRes.json();

      setEventTypes(eventsData.event_types || []);
      setRules(rulesData.rules || []);
      setTemplates(templatesData.templates || []);
    } catch (error) {
      console.error('Fetch error:', error);
      alert('Hiba történt az adatok betöltése során!');
    } finally {
      setLoading(false);
    }
  };

  // Rule CRUD
  const saveRule = async (rule) => {
    try {
      const url = rule.id 
        ? `${API_URL}/admin/notification-rules/${rule.id}`
        : `${API_URL}/admin/notification-rules`;
      
      const method = rule.id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(rule)
      });

      if (response.ok) {
        alert(rule.id ? 'Szabály frissítve!' : 'Szabály létrehozva!');
        fetchData();
        setEditingRule(null);
        setIsCreatingRule(false);
      } else {
        const data = await response.json();
        alert(`Hiba: ${data.message}`);
      }
    } catch (error) {
      console.error('Save rule error:', error);
      alert('Hiba történt a mentés során!');
    }
  };

  const deleteRule = async (ruleId) => {
    if (!window.confirm('Biztosan törlöd ezt a szabályt?')) return;

    try {
      const response = await fetch(`${API_URL}/admin/notification-rules/${ruleId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        alert('Szabály törölve!');
        fetchData();
      } else {
        alert('Hiba történt a törlés során!');
      }
    } catch (error) {
      console.error('Delete rule error:', error);
      alert('Hiba történt a törlés során!');
    }
  };

  // Template CRUD
  const saveTemplate = async (template) => {
    try {
      const url = template.id 
        ? `${API_URL}/admin/notification-templates/${template.id}`
        : `${API_URL}/admin/notification-templates`;
      
      const method = template.id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(template)
      });

      if (response.ok) {
        alert(template.id ? 'Sablon frissítve!' : 'Sablon létrehozva!');
        fetchData();
        setEditingTemplate(null);
        setIsCreatingTemplate(false);
      } else {
        const data = await response.json();
        alert(`Hiba: ${data.message}`);
      }
    } catch (error) {
      console.error('Save template error:', error);
      alert('Hiba történt a mentés során!');
    }
  };

  const deleteTemplate = async (templateId) => {
    if (!window.confirm('Biztosan törlöd ezt a sablont?')) return;

    try {
      const response = await fetch(`${API_URL}/admin/notification-templates/${templateId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        alert('Sablon törölve!');
        fetchData();
      } else {
        const data = await response.json();
        alert(`Hiba: ${data.message}`);
      }
    } catch (error) {
      console.error('Delete template error:', error);
      alert('Hiba történt a törlés során!');
    }
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Bell className="w-8 h-8 text-indigo-600" />
            Értesítések Kezelése
          </h1>
          <p className="text-gray-600 mt-1">
            Értesítési szabályok és email sablonok konfigurálása
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('rules')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'rules'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Értesítési Szabályok ({rules.length})
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'templates'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Email Sablonok ({templates.length})
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'rules' ? (
        <RulesTab
          rules={rules}
          eventTypes={eventTypes}
          templates={templates}
          roles={roles}
          editingRule={editingRule}
          setEditingRule={setEditingRule}
          isCreatingRule={isCreatingRule}
          setIsCreatingRule={setIsCreatingRule}
          saveRule={saveRule}
          deleteRule={deleteRule}
        />
      ) : (
        <TemplatesTab
          templates={templates}
          eventTypes={eventTypes}
          editingTemplate={editingTemplate}
          setEditingTemplate={setEditingTemplate}
          isCreatingTemplate={isCreatingTemplate}
          setIsCreatingTemplate={setIsCreatingTemplate}
          saveTemplate={saveTemplate}
          deleteTemplate={deleteTemplate}
        />
      )}
    </div>
  );
}

// Rules Tab Component
function RulesTab({ rules, eventTypes, templates, roles, editingRule, setEditingRule, isCreatingRule, setIsCreatingRule, saveRule, deleteRule }) {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (editingRule) {
      setFormData(editingRule);
    } else if (isCreatingRule) {
      setFormData({
        event_type_id: eventTypes[0]?.id || 1,
        role: 'company_admin',
        in_app_enabled: true,
        email_enabled: false,
        email_template_id: null,
        priority: 0,
        is_active: true
      });
    }
  }, [editingRule, isCreatingRule]);

  const handleSave = () => {
    saveRule(formData);
  };

  const handleCancel = () => {
    setEditingRule(null);
    setIsCreatingRule(false);
    setFormData({});
  };

  // Group rules by event type
  const rulesByEvent = rules.reduce((acc, rule) => {
    if (!acc[rule.event_type_id]) {
      acc[rule.event_type_id] = [];
    }
    acc[rule.event_type_id].push(rule);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Create Button */}
      <button
        onClick={() => setIsCreatingRule(true)}
        className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2"
      >
        <Plus className="w-5 h-5" />
        Új Szabály
      </button>

      {/* Edit/Create Form */}
      {(editingRule || isCreatingRule) && (
        <div className="bg-white border-2 border-indigo-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            {editingRule ? 'Szabály Szerkesztése' : 'Új Szabály Létrehozása'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Event Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Esemény Típus
              </label>
              <select
                value={formData.event_type_id || ''}
                onChange={(e) => setFormData({ ...formData, event_type_id: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {eventTypes.map(et => (
                  <option key={et.id} value={et.id}>{et.event_name}</option>
                ))}
              </select>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Szerepkör
              </label>
              <select
                value={formData.role || ''}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {roles.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* In-App Enabled */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.in_app_enabled || false}
                onChange={(e) => setFormData({ ...formData, in_app_enabled: e.target.checked })}
                className="w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
              />
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                In-App Értesítés
              </label>
            </div>

            {/* Email Enabled */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.email_enabled || false}
                onChange={(e) => setFormData({ ...formData, email_enabled: e.target.checked })}
                className="w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
              />
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Értesítés
              </label>
            </div>

            {/* Email Template */}
            {formData.email_enabled && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Sablon
                </label>
                <select
                  value={formData.email_template_id || ''}
                  onChange={(e) => setFormData({ ...formData, email_template_id: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Válassz sablont...</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prioritás
              </label>
              <input
                type="number"
                value={formData.priority || 0}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Active */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.is_active !== false}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
              />
              <label className="text-sm font-medium text-gray-700">
                Aktív
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Mentés
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Mégse
            </button>
          </div>
        </div>
      )}

      {/* Rules List */}
      <div className="space-y-6">
        {eventTypes.map(eventType => {
          const eventRules = rulesByEvent[eventType.id] || [];
          
          return (
            <div key={eventType.id} className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
                <h3 className="text-lg font-bold">{eventType.event_name}</h3>
                <p className="text-sm text-indigo-100">{eventType.description}</p>
              </div>

              {eventRules.length === 0 ? (
                <div className="px-6 py-4 text-center text-gray-500">
                  Nincs szabály ehhez az eseménytípushoz
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {eventRules.map(rule => (
                    <div key={rule.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-sm font-semibold rounded">
                              {roles.find(r => r.value === rule.role)?.label}
                            </span>
                            {rule.in_app_enabled && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded flex items-center gap-1">
                                <Smartphone className="w-3 h-3" />
                                In-App
                              </span>
                            )}
                            {rule.email_enabled && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                Email
                              </span>
                            )}
                            {!rule.is_active && (
                              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                                Inaktív
                              </span>
                            )}
                          </div>
                          {rule.email_template_name && (
                            <p className="text-sm text-gray-600">
                              Email sablon: <span className="font-medium">{rule.email_template_name}</span>
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingRule(rule)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                            title="Szerkesztés"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteRule(rule.id)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded transition-colors"
                            title="Törlés"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Templates Tab Component (simplified - full implementation would be similar to RulesTab)
function TemplatesTab({ templates, eventTypes, editingTemplate, setEditingTemplate, isCreatingTemplate, setIsCreatingTemplate, saveTemplate, deleteTemplate }) {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-blue-800">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm font-medium">
            Email sablonok létrehozása és szerkesztése hamarosan elérhető lesz. Jelenleg az alapértelmezett sablonok használhatók.
          </p>
        </div>
      </div>

      {/* Templates List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map(template => (
          <div key={template.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-lg font-bold text-gray-900">{template.name}</h3>
              <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded">
                {eventTypes.find(et => et.id === template.event_type_id)?.event_name}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              <strong>Tárgy:</strong> {template.subject}
            </p>
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => alert('Előnézet hamarosan!')}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors flex items-center gap-1"
              >
                <Eye className="w-3 h-3" />
                Előnézet
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default NotificationManagement;
