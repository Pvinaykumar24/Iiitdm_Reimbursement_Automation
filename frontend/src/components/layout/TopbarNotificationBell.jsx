import { useEffect, useState, useRef } from 'react';
import { notificationsApi } from '../../api';

export default function TopbarNotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifs = () => {
    notificationsApi.getAll()
      .then(res => {
        setNotifications(Array.isArray(res.data) ? res.data : []);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unread = notifications.filter(n => !n.is_read);

  const handleMarkRead = async (notifId) => {
    try {
      await notificationsApi.markRead(notifId);
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      for (const n of unread) {
        await notificationsApi.markRead(n.id);
      }
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', borderRadius: '50%', color: '#444'
        }}
      >
        <i className="ti ti-bell" style={{ fontSize: 20 }} />
        {unread.length > 0 && (
          <span
            style={{
              position: 'absolute', top: 2, right: 2,
              background: '#A32D2D', color: '#fff', fontSize: 9, fontWeight: 'bold',
              minWidth: 15, height: 15, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 2px'
            }}
          >
            {unread.length}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', right: 0, top: 36, zIndex: 999,
            background: '#fff', border: '1px solid #e5e5e3', borderRadius: 10,
            width: 320, boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            overflow: 'hidden'
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e5e3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Notifications</span>
            {unread.length > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{ background: 'none', border: 'none', color: '#534AB7', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}
              >
                Mark all read
              </button>
            )}
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#888', fontSize: 12 }}>
                No notifications yet.
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => !n.is_read && handleMarkRead(n.id)}
                  style={{
                    padding: '10px 16px', borderBottom: '1px solid #f5f5f4',
                    background: n.is_read ? '#fff' : '#EEEDFE',
                    cursor: n.is_read ? 'default' : 'pointer',
                    fontSize: 12, transition: 'background 0.15s'
                  }}
                >
                  <div style={{ color: '#333', lineHeight: 1.4, fontWeight: n.is_read ? 400 : 500 }}>
                    {n.message}
                  </div>
                  <div style={{ color: '#888', fontSize: 10, marginTop: 4 }}>
                    {new Date(n.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {new Date(n.created_at).toLocaleDateString('en-IN')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
