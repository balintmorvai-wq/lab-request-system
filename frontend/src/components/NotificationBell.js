import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react';

function NotificationBell() {
  const { getAuthHeaders, API_URL } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Notifikációk lekérése
  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${API_URL}/notifications?limit=20`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (error) {
      console.error('Notification fetch error:', error);
    }
  };

  // Olvasottnak jelölés
  const markAsRead = async (notificationId) => {
    try {
      await fetch(`${API_URL}/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: getAuthHeaders()
      });
      
      // Frissítés
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  };

  // Összes olvasottnak jelölés
  const markAllAsRead = async () => {
    setLoading(true);
    try {
      await fetch(`${API_URL}/notifications/read-all`, {
        method: 'PUT',
        headers: getAuthHeaders()
      });
      
      // Frissítés
      setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Mark all as read error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Törlés
  const deleteNotification = async (notificationId) => {
    try {
      await fetch(`${API_URL}/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      // Eltávolítás a listából
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      // Olvasatlan számláló frissítés
      const deletedNotif = notifications.find(n => n.id === notificationId);
      if (deletedNotif && !deletedNotif.read_at) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Delete notification error:', error);
    }
  };

  // Notification kattintás → olvasottnak + link
  const handleNotificationClick = (notification) => {
    if (!notification.read_at) {
      markAsRead(notification.id);
    }
    
    // ✅ Ha van link, navigálás (React Router SPA navigation)
    if (notification.link_url) {
      setIsOpen(false);  // Dropdown bezárása
      navigate(notification.link_url);
    }
  };

  // Dropdown bezárás kattintásra
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Polling (30 sec)
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Relatív idő formázás
  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'most';
    if (diffMins < 60) return `${diffMins} perce`;
    if (diffHours < 24) return `${diffHours} órája`;
    if (diffDays < 7) return `${diffDays} napja`;
    return date.toLocaleDateString('hu-HU');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-indigo-600 transition-colors rounded-lg hover:bg-gray-100"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-h-[32rem] bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex items-center justify-between">
            <h3 className="text-lg font-bold">Értesítések</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  disabled={loading}
                  className="text-xs px-2 py-1 bg-white bg-opacity-20 hover:bg-opacity-30 rounded transition-colors disabled:opacity-50"
                  title="Összes olvasottnak jelölés"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 p-1 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto max-h-96">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Nincs értesítés</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
                    !notif.read_at ? 'bg-indigo-50' : ''
                  }`}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Event Type Badge */}
                      <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-indigo-100 text-indigo-700 mb-1">
                        {notif.event_name}
                      </span>
                      
                      {/* Message */}
                      <p className={`text-sm ${!notif.read_at ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                        {notif.message}
                      </p>
                      
                      {/* Time */}
                      <p className="text-xs text-gray-500 mt-1">
                        {formatRelativeTime(notif.created_at)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!notif.read_at && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notif.id);
                          }}
                          className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
                          title="Olvasottnak jelölés"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notif.id);
                        }}
                        className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                        title="Törlés"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 text-center border-t border-gray-200">
              <p className="text-xs text-gray-600">
                {unreadCount > 0 ? `${unreadCount} olvasatlan értesítés` : 'Minden értesítés elolvasva'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
