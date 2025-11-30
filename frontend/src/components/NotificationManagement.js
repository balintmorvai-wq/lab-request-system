import React, { useState, useEffect } from 'react';
import { Bell, Settings, CheckCircle, XCircle, Mail } from 'lucide-react';

function NotificationManagement() {
  const [activeTab, setActiveTab] = useState('rules'); // 'rules' | 'smtp'
  const [eventTypes, setEventTypes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [rules, setRules] = useState([]);
  const [smtpSettings, setSmtpSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const roleNames = {
    company_user: 'Cég dolgozó',
    company_admin: 'Cég Admin',
    labor_staff: 'Labor',
    super_admin: 'Admin'
  };

  const roleOrder = ['company_user', 'company_admin', 'labor_staff', 'super_admin'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const [eventsRes, templatesRes, rulesRes, smtpRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_API_URL}/admin/notification-event-types`, {
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

      const events = await eventsRes.json();
      const temps = await templatesRes.json();
      const rulesData = await rulesRes.json();
      const smtp = await smtpRes.json();

      setEventTypes(events.event_types || []);
      setTemplates(temps.templates || []);
      setRules(rulesData.rules || []);
      setSmtpSettings(smtp.settings || {
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
      setMessage({ text: 'Hiba az adatok betöltésekor!', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Get rule for event + role
  const getRule = (eventId, role) => {
    return rules.find(r => r.event_type_id === eventId && r.role === role);
  };

  // Toggle in-app notification
  const toggleInApp = async (eventId, role) => {
    const rule = getRule(eventId, role);
    
    if (rule) {
      // Update existing rule
      await updateRule(rule.id, {
        ...rule,
        in_app_enabled: !rule.in_app_enabled
      });
    } else {
      // Create new rule
      await createRule({
        event_type_id: eventId,
        role: role,
        in_app_enabled: true,
        email_enabled: false,
        email_template_id: null,
        priority: 5,
        is_active: true
      });
    }
  };

  // Toggle email notification
  const toggleEmail = async (eventId, role) => {
    const rule = getRule(eventId, role);
    
    if (rule) {
      await updateRule(rule.id, {
        ...rule,
        email_enabled: !rule.email_enabled
      });
    } else {
      // Create new rule with email enabled
      const defaultTemplate = templates.find(t => t.event_type_id === eventId);
      
      await createRule({
        event_type_id: eventId,
        role: role,
        in_app_enabled: false,
        email_enabled: true,
        email_template_id: defaultTemplate?.id || null,
        priority: 5,
        is_active: true
      });
    }
  };

  // Change email template
  const changeTemplate = async (eventId, role, templateId) => {
    const rule = getRule(eventId, role);
    
    if (rule) {
      await updateRule(rule.id, {
        ...rule,
        email_template_id: templateId ? parseInt(templateId) : null
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
        await loadData(); // Reload to get updated data
        showMessage('Szabály létrehozva!', 'success');
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
      }
    } catch (error) {
      console.error('Update error:', error);
      showMessage('Hiba a frissítéskor!', 'error');
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
            <p className="text-sm text-gray-500">Értesítések kezelése szerepkörönként</p>
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
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                    Esemény
                  </th>
                  {roleOrder.map(role => (
                    <th key={role} className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {roleNames[role]}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Body */}
              <tbody className="bg-white divide-y divide-gray-200">
                {eventTypes.map(event => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{event.event_name}</div>
                      <div className="text-xs text-gray-500">{event.description}</div>
                    </td>

                    {roleOrder.map(role => {
                      const rule = getRule(event.id, role);
                      const eventTemplates = templates.filter(t => t.event_type_id === event.id);

                      return (
                        <td key={role} className="px-6 py-4 text-center">
                          <div className="space-y-2">
                            {/* In-App Checkbox */}
                            <label className="flex items-center justify-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={rule?.in_app_enabled || false}
                                onChange={() => toggleInApp(event.id, role)}
                                disabled={saving}
                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                              />
                              <span className="text-sm text-gray-700">App</span>
                            </label>

                            {/* Email Checkbox + Template */}
                            {eventTemplates.length > 0 && (
                              <div className="space-y-1">
                                <label className="flex items-center justify-center space-x-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={rule?.email_enabled || false}
                                    onChange={() => toggleEmail(event.id, role)}
                                    disabled={saving}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                  />
                                  <Mail className="w-4 h-4 text-gray-500" />
                                </label>

                                {rule?.email_enabled && (
                                  <select
                                    value={rule.email_template_id || ''}
                                    onChange={(e) => changeTemplate(event.id, role, e.target.value)}
                                    disabled={saving}
                                    className="text-xs border-gray-300 rounded px-2 py-1 w-full"
                                  >
                                    <option value="">Sablon...</option>
                                    {eventTemplates.map(t => (
                                      <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
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
