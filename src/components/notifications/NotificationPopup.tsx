import { useEffect, useState, useRef, RefObject } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  created_at: string;
}

interface NotificationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  /*
    The button that opens this popup lives in the header, outside the popup's
    own element, so the dismiss-on-outside-click handler below counted a tap on
    it as "outside" and closed the popup - and then the button's own click
    toggled it straight back open. The popup could only be dismissed by tapping
    somewhere else entirely, which on a phone is the one gesture people do not
    think to try. Passing the trigger in lets the handler leave it alone so the
    button can do its own toggling.
  */
  triggerRef?: RefObject<HTMLElement | null>;
}

export default function NotificationPopup({ isOpen, onClose, triggerRef }: NotificationPopupProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && user) {
      fetchNotifications();
    }
  }, [isOpen, user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // The trigger toggles by itself; closing here too would just undo it.
      if (triggerRef?.current?.contains(target)) return;
      if (popupRef.current && !popupRef.current.contains(target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, triggerRef]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);

      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .in('id', unreadIds);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={18} className="text-blue-400" />;
      case 'warning':
        return <AlertTriangle size={18} className="text-yellow-400" />;
      case 'error':
        return <XCircle size={18} className="text-red-400" />;
      default:
        return <Info size={18} className="text-blue-400" />;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMins = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMs / 3600000);
    const diffInDays = Math.floor(diffInMs / 86400000);

    if (diffInMins < 1) return 'Just now';
    if (diffInMins < 60) return `${diffInMins}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="notifications-panel"
          ref={popupRef}
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          /*
            On a phone this is pinned to the screen, not to the bell.

            right-0 anchors to the trigger's right edge, and the bell sits
            about 58px in from the edge of the screen - so a panel wide
            enough to be useful grew leftward past x=0 and lost its first
            26px. Spanning the viewport with a margin each side is the only
            arrangement that cannot depend on where the trigger happens to
            sit. The header is fixed, so a fixed panel hanging off it
            behaves consistently.
          */
          className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-14 sm:w-96 bg-[#0A0A0A] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
        >
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={18} />
              <h3 className="font-medium">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs bg-blue-400/20 text-blue-400 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-400">
                <div className="text-sm">Loading...</div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Bell size={32} className="mx-auto mb-2 opacity-50" />
                <div className="text-sm">No notifications yet</div>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {notifications.map(notification => (
                  /*
                    The whole row marks itself read. Previously the only way
                    to do it was a 14px check icon held at opacity-0 until
                    hover - invisible until you happened to mouse over it,
                    and unreachable entirely on a touch screen, which has no
                    hover. Keyboard users get the same action via Enter or
                    Space.
                  */
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    role={!notification.read ? 'button' : undefined}
                    tabIndex={!notification.read ? 0 : undefined}
                    aria-label={!notification.read ? `Mark "${notification.title}" as read` : undefined}
                    onClick={() => !notification.read && markAsRead(notification.id)}
                    onKeyDown={(e) => {
                      if (!notification.read && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        markAsRead(notification.id);
                      }
                    }}
                    className={`p-4 hover:bg-white/5 transition-colors group ${
                      !notification.read ? 'bg-white/[0.02] cursor-pointer' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="text-sm font-medium">{notification.title}</h4>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {/*
                              Always visible, and a real tap target rather
                              than a 14px icon revealed on hover. stopPropagation
                              so removing a notification doesn't also trigger
                              the row's mark-as-read underneath it.
                            */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notification.id);
                              }}
                              className="p-1.5 -m-0.5 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors"
                              title="Remove notification"
                              aria-label={`Remove "${notification.title}"`}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-400 mb-1">{notification.message}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            {formatTime(notification.created_at)}
                          </span>
                          {!notification.read && (
                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
