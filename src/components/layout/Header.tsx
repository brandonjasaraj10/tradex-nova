import { Bell, User, Menu } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NotificationPopup from '../notifications/NotificationPopup';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

interface HeaderProps {
  sidebarCollapsed?: boolean;
  sidebarOpen?: boolean;
  onMenuClick?: () => void;
}

export default function Header({ sidebarCollapsed = false, sidebarOpen = false, onMenuClick }: HeaderProps) {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchUnreadCount();

      const channel = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchUnreadCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchUnreadCount = async () => {
    if (!user) return;
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  return (
    <>
      <header className={`h-16 border-b border-white/[0.05] px-4 sm:px-6 flex items-center justify-between fixed top-0 right-0 bg-black z-40 transition-all duration-300 ${
        sidebarCollapsed ? 'left-0 lg:left-16' : 'left-0 lg:left-64'
      }`}>
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-white/5"
          >
            <Menu size={20} />
          </button>
          <h2 className="text-xs sm:text-sm font-medium text-gray-400 truncate">
            {/*
              Time-agnostic. This said "Good morning" around the clock, so it
              greeted people at midnight with the wrong half of the day - and a
              greeting that is visibly wrong reads as the app not knowing
              anything about you.
            */}
            Welcome, {profile?.first_name || user?.email?.split('@')[0] || 'User'}
          </h2>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="relative">
            <button
              className="p-2 rounded-lg hover:bg-white/5 relative"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-blue-400 rounded-full" />
              )}
            </button>
            <NotificationPopup
              isOpen={showNotifications}
              onClose={() => setShowNotifications(false)}
            />
          </div>
          <button
            className="p-2 rounded-lg hover:bg-white/5"
            onClick={() => navigate('/profile')}
          >
            <User size={18} />
          </button>
        </div>
      </header>

    </>
  );
}