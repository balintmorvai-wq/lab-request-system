import React, { useState, useEffect } from 'react';
import { Bell, Settings, CheckCircle, XCircle, Mail, Edit2, Plus, Trash2, Save } from 'lucide-react';

function NotificationManagement() {
  const [activeTab, setActiveTab] = useState('rules'); // 'rules' | 'templates' | 'smtp'
  const [statuses, setStatuses] = useState([]);
  const [roles, setRoles] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [rules, setRules] = useState([]);
  const [smtpSettings, setSmtpSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  // Template editor state
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    event_key: '',
    subject: '',
    body: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const [statusesRes, rolesRes, templatesRes, rulesRes, smtpRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_API_URL}/admin/notification-statuses`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${process.env.REACT_APP_API_URL}/admin/notification-roles`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${process.env.REACT_APP_API_URL}/admin/notification-templates`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${process.env.REACT_APP_API_URL}/admin/notification-rules`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${process.env.REACT_APP_API_URL}/admin/smtp-settings`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const statusData = await statusesRes.json();
      const rolesData = await rolesRes.json();
      const tempsData = await templatesRes.json();
      const rulesData = await rulesRes.json();
      const smtpData = await smtpRes.json();

      setStatuses(statusData.statuses || []);
      setRoles(rolesData.roles || []);
      setTemplates(tempsData.templates || []);
      setRules(rulesData.rules || []);
      setSmtpSettings(smtpData.settings || {
        smtp_host: 'smtp.gmail.com',
        smtp_port: 587,
        smtp_username: '',
        smtp_password: '',
        from_email: 'noreply@example.com',
        from_name: 'Lab Request System',
        use_tls: 1,
        is_active: 0
      });
    } catch (error) {
      console.error('Load error:', error);
      showMessage('Hiba az adatok betöltésekor!', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Get rule for status + role
  const getRule = (statusKey, roleKey) => {
    // Keresünk event_key-vel ami "status_to_X" formátumú
    const eventKey = `status_to_${statusKey}`;
    return rules.find(r => r.event_key === eventKey && r.role === roleKey);
  };

  // Get event_type_id for status
  const getEventTypeIdForStatus = (statusKey) => {
    const eventKey = `status_to_${statusKey}`;
    // Keresünk egy rule-t ami ezt használja és lekérjük az event_type_id-t
    const rule = rules.find(r => r.event_key === eventKey);
    return rule?.event_type_id || null;
  };

  // Toggle in-app notification
  const toggleInApp = async (statusKey, roleKey) => {
    const rule = getRule(statusKey, roleKey);
    const eventKey = `status_to_${statusKey}`;
    
    if (rule) {
      // Update existing rule
      await updateRule(rule.id, {
        event_type_id: rule.event_type_id,
        role: roleKey,
        event_filter: rule.event_filter,
        in_app_enabled: !rule.in_app_enabled,
        email_enabled: rule.email_enabled,
        email_template_id: rule.email_template_id,
        priority: rule.priority || 5,
        is_active: true
      });
    } else {
      // Create new rule - need event_type_id
      const eventTypeId = getEventTypeIdForStatus(statusKey);
      if (!eventTypeId) {
        showMessage('Event type nem található!', 'error');
        return;
      }
      
      await createRule({
        event_type_id: eventTypeId,
        role: roleKey,
        in_app_enabled: true,
        email_enabled: false,
        email_template_id: null,
        priority: 5,
        is_active: true
      });
    }
  };

  // Toggle email notification
  const toggleEmail = async (statusKey, roleKey) => {
    const rule = getRule(statusKey, roleKey);
    const eventKey = `status_to_${statusKey}`;
    
    if (rule) {
      await updateRule(rule.id, {
        event_type_id: rule.event_type_id,
        role: roleKey,
        event_filter: rule.event_filter,
        in_app_enabled: rule.in_app_enabled,
        email_enabled: !rule.email_enabled,
        email_template_id: rule.email_template_id,
        priority: rule.priority || 5,
        is_active: true
      });
    } else {
      // Create new rule with email enabled
      const eventTypeId = getEventTypeIdForStatus(statusKey);
      if (!eventTypeId) {
        showMessage('Event type nem található!', 'error');
        return;
      }
      
      const defaultTemplate = templates.find(t => t.event_key === eventKey);
      
      await createRule({
        event_type_id: eventTypeId,
        role: roleKey,
        in_app_enabled: false,
        email_enabled: true,
        email_template_id: defaultTemplate?.id || null,
        priority: 5,
        is_active: true
      });
    }
  };

  // Change email template
  const changeTemplate = async (statusKey, roleKey, templateId) => {
    const rule = getRule(statusKey, roleKey);
    
    if (rule) {
      await updateRule(rule.id, {
        event_type_id: rule.event_type_id,
        role: roleKey,
        event_filter: rule.event_filter,
        in_app_enabled: rule.in_app_enabled,
        email_enabled: rule.email_enabled,
        email_template_id: templateId ? parseInt(templateId) : null,
        priority: rule.priority || 5,
        is_active: true
      });
    }
  };

  const createRule = async (ruleData) => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/admin/notification-rules`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ruleData)
      });

      if (response.ok) {
        await loadData();
        showMessage('Szabály létrehozva!', 'success');
      } else {
        showMessage('Hiba a szabály létrehozásakor!', 'error');
      }
    } catch (error) {
      console.error('Create error:', error);
      showMessage('Hiba a szabály létrehozásakor!', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateRule = async (ruleId, ruleData) => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/admin/notification-rules/${ruleId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ruleData)
      });

      if (response.ok) {
        await loadData();
        showMessage('Szabály frissítve!', 'success');
      } else {
        showMessage('Hiba a frissítéskor!', 'error');
      }
    } catch (error) {
      console.error('Update error:', error);
      showMessage('Hiba a frissítéskor!', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Template CRUD
  const openTemplateEditor = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateForm({
        name: template.name,
        event_key: template.event_key || '',
        subject: template.subject,
        body: template.body
      });
    } else {
      setEditingTemplate({});
      setTemplateForm({
        name: '',
        event_key: '',
        subject: '',
        body: ''
      });
    }
  };

  const saveTemplate = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      // Find event_type_id for the selected status
      const status = statuses.find(s => templateForm.event_key === `status_to_${s.key}`);
      if (!status && !editingTemplate.id) {
        showMessage('Válassz státuszt!', 'error');
        return;
      }
      
      const eventTypeId = editingTemplate.id ? editingTemplate.event_type_id : getEventTypeIdForStatus(status?.key);
      
      const templateData = {
        name: templateForm.name,
        event_type_id: eventTypeId,
        subject: templateForm.subject,
        body: templateForm.body,
        variables_used: [] // Auto-detect later
      };
      
      const url = editingTemplate.id 
        ? `${process.env.REACT_APP_API_URL}/admin/notification-templates/${editingTemplate.id}`
        : `${process.env.REACT_APP_API_URL}/admin/notification-templates`;
      
      const method = editingTemplate.id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateData)
      });

      if (response.ok) {
        await loadData();
        setEditingTemplate(null);
        showMessage(editingTemplate.id ? 'Sablon frissítve!' : 'Sablon létrehozva!', 'success');
      } else {
        showMessage('Hiba a sablon mentésekor!', 'error');
      }
    } catch (error) {
      console.error('Template save error:', error);
      showMessage('Hiba a sablon mentésekor!', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (templateId) => {
    if (!window.confirm('Biztosan törölni szeretnéd ezt a sablont?')) return;
    
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/admin/notification-templates/${templateId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        await loadData();
        showMessage('Sablon törölve!', 'success');
      } else {
        const data = await response.json();
        showMessage(data.message || 'Hiba a törléskor!', 'error');
      }
    } catch (error) {
      console.error('Delete error:', error);
      showMessage('Hiba a törléskor!', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveSMTPSettings = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/admin/smtp-settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(smtpSettings)
      });

      if (response.ok) {
        showMessage('SMTP beállítások mentve!', 'success');
      }
    } catch (error) {
      console.error('SMTP save error:', error);
      showMessage('Hiba az SMTP beállítások mentésekor!', 'error');
    } finally {
      setSaving(false);
    }
  };

  const testEmail = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/admin/smtp-test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ to_email: smtpSettings.smtp_username })
      });

      const data = await response.json();
      if (response.ok) {
        showMessage('Teszt email elküldve! Ellenőrizd a postafiókot.', 'success');
      } else {
        showMessage(`Email hiba: ${data.error}`, 'error');
      }
    } catch (error) {
      console.error('Test email error:', error);
      showMessage('Hiba a teszt email küldésekor!', 'error');
    } finally {
      setSaving(false);
    }
  };

  const showMessage = (msg, type = 'success') => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(''), 3000);
  };

  const insertVariable = (varName) => {
    setTemplateForm({
      ...templateForm,
      body: templateForm.body + `{{${varName}}}`
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Betöltés...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Bell className="w-8 h-8 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Értesítési Rendszer</h1>
            <p className="text-sm text-gray-500">Státusz-alapú értesítések kezelése</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'rules'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Szabályok
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
              activeTab === 'templates'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Edit2 className="w-4 h-4" />
            <span>Sablonok</span>
          </button>
          <button
            onClick={() => setActiveTab('smtp')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
              activeTab === 'smtp'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>SMTP</span>
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center space-x-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              {/* Header */}
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: '200px'}}>
                    Státusz
                  </th>
                  {roles.map(role => (
                    <th key={role.key} className="px-4 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: '140px'}}>
                      {role.name}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Body */}
              <tbody className="bg-white divide-y divide-gray-200">
                {statuses.map(status => {
                  const eventKey = `status_to_${status.key}`;
                  const statusTemplates = templates.filter(t => t.event_key === eventKey);

                  return (
                    <tr key={status.key} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{status.name}</div>
                        <div className="text-xs text-gray-500">{status.description}</div>
                      </td>

                      {roles.map(role => {
                        const rule = getRule(status.key, role.key);

                        return (
                          <td key={role.key} className="px-4 py-4 text-center" style={{height: '100px'}}>
                            <div className="flex flex-col items-center justify-start space-y-2">
                              {/* In-App Checkbox */}
                              <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={rule?.in_app_enabled || false}
                                  onChange={() => toggleInApp(status.key, role.key)}
                                  disabled={saving}
                                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <span className="text-xs text-gray-700">App</span>
                              </label>

                              {/* Email Checkbox */}
                              {statusTemplates.length > 0 && (
                                <label className="flex items-center space-x-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={rule?.email_enabled || false}
                                    onChange={() => toggleEmail(status.key, role.key)}
                                    disabled={saving}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                  />
                                  <Mail className="w-4 h-4 text-gray-500" />
                                </label>
                              )}

                              {/* Email Template Selector - ALWAYS VISIBLE BUT DISABLED */}
                              <div style={{height: '32px', width: '100%'}}>
                                {statusTemplates.length > 0 && (
                                  <select
                                    value={rule?.email_template_id || ''}
                                    onChange={(e) => changeTemplate(status.key, role.key, e.target.value)}
                                    disabled={saving || !rule?.email_enabled}
                                    className="text-xs border-gray-300 rounded px-2 py-1 w-full disabled:opacity-50"
                                    style={{fontSize: '11px'}}
                                  >
                                    <option value="">Sablon...</option>
                                    {statusTemplates.map(t => (
                                      <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex items-center space-x-6 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-indigo-600 rounded flex items-center justify-center">
                  <div className="w-2 h-2 bg-indigo-600 rounded-sm"></div>
                </div>
                <span>In-app értesítés</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-indigo-600" />
                <span>Email értesítés</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Email Sablonok</h2>
            <button
              onClick={() => openTemplateEditor()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Új Sablon</span>
            </button>
          </div>

          {editingTemplate ? (
            // Template Editor
            <div className="space-y-4 border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-md font-medium text-gray-900">
                  {editingTemplate.id ? 'Sablon Szerkesztése' : 'Új Sablon'}
                </h3>
                <button
                  onClick={() => setEditingTemplate(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sablon Neve</label>
                  <input
                    type="text"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({...templateForm, name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="pl. Státusz változás értesítés"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Státusz</label>
                  <select
                    value={templateForm.event_key}
                    onChange={(e) => setTemplateForm({...templateForm, event_key: e.target.value})}
                    disabled={editingTemplate.id}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">Válassz státuszt...</option>
                    {statuses.map(s => (
                      <option key={s.key} value={`status_to_${s.key}`}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Tárgy</label>
                <input
                  type="text"
                  value={templateForm.subject}
                  onChange={(e) => setTemplateForm({...templateForm, subject: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Kérés státusza: {{request_number}}"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Törzs (HTML)</label>
                <textarea
                  value={templateForm.body}
                  onChange={(e) => setTemplateForm({...templateForm, body: e.target.value})}
                  rows={10}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
                  placeholder="<p>Kedves {{requester_name}}!</p>"
                />
              </div>

              {/* Variable Inserter */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm font-medium text-gray-700 mb-2">Változók beszúrása:</div>
                <div className="flex flex-wrap gap-2">
                  {['request_number', 'company_name', 'requester_name', 'old_status', 'new_status', 'request_url'].map(v => (
                    <button
                      key={v}
                      onClick={() => insertVariable(v)}
                      className="px-3 py-1 bg-white border border-gray-300 rounded text-xs hover:bg-gray-50"
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={saveTemplate}
                  disabled={saving}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Mentés...' : 'Sablon Mentése'}</span>
                </button>
                <button
                  onClick={() => setEditingTemplate(null)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Mégse
                </button>
              </div>
            </div>
          ) : (
            // Template List
            <div className="space-y-3">
              {templates.map(template => (
                <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{template.name}</h4>
                      <p className="text-sm text-gray-500 mt-1">Esemény: {template.event_name}</p>
                      <p className="text-xs text-gray-400 mt-1">Tárgy: {template.subject}</p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openTemplateEditor(template)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteTemplate(template.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
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
      )}

      {/* SMTP Tab */}
      {activeTab === 'smtp' && smtpSettings && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">SMTP Email Beállítások</h2>
          
          <div className="space-y-4 max-w-2xl">
            {/* Active Toggle */}
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={smtpSettings.is_active === 1}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, is_active: e.target.checked ? 1 : 0 })}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label className="text-sm font-medium text-gray-700">Email értesítések aktívak</label>
            </div>

            {/* SMTP Host */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Szerver</label>
              <input
                type="text"
                value={smtpSettings.smtp_host || ''}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_host: e.target.value })}
                placeholder="smtp.gmail.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Port */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
              <input
                type="number"
                value={smtpSettings.smtp_port || 587}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_port: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Felhasználónév (Email cím)</label>
              <input
                type="email"
                value={smtpSettings.smtp_username || ''}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_username: e.target.value })}
                placeholder="noreply@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jelszó (App Password)</label>
              <input
                type="password"
                value={smtpSettings.smtp_password || ''}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_password: e.target.value })}
                placeholder="••••••••••••••••"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">Gmail esetén App Password szükséges (2FA engedélyezve)</p>
            </div>

            {/* From Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Feladó Email</label>
              <input
                type="email"
                value={smtpSettings.from_email || ''}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, from_email: e.target.value })}
                placeholder="noreply@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* From Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Feladó Név</label>
              <input
                type="text"
                value={smtpSettings.from_name || ''}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, from_name: e.target.value })}
                placeholder="Lab Request System"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* TLS */}
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={smtpSettings.use_tls === 1}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, use_tls: e.target.checked ? 1 : 0 })}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label className="text-sm font-medium text-gray-700">TLS használata (ajánlott)</label>
            </div>

            {/* Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                onClick={saveSMTPSettings}
                disabled={saving}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Mentés...' : 'Beállítások Mentése'}
              </button>
              
              <button
                onClick={testEmail}
                disabled={saving || !smtpSettings.smtp_username}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                <Mail className="w-4 h-4" />
                <span>{saving ? 'Küldés...' : 'Teszt Email'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationManagement;
