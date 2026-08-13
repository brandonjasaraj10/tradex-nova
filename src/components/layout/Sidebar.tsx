import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import {
  LayoutDashboard,
  BookOpen,
  BarChart2,
  Calendar as CalendarIcon,
  Settings,
  Brain,
  ChevronLeft,
  LogOut,
  CheckSquare,
  X
} from 'lucide-react';
import Logo from '../shared/Logo';

const navigation = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Journal', path: '/journal', icon: BookOpen },
  { name: 'Analytics', path: '/analytics', icon: BarChart2 },
  { name: 'Calendar', path: '/calendar', icon: CalendarIcon },
  { name: 'NOVA AI', path: '/nova', icon: Brain },
  { name: 'Checklists', path: '/checklists', icon: CheckSquare },
  { name: 'Settings', path: '/settings', icon: Settings },
];

interface SidebarProps {
  onCollapseChange?: (collapsed: boolean) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ onCollapseChange, mobileOpen = false, onMobileClose }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { signOut } = useAuth();

  const handleToggle = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    onCollapseChange?.(newState);
  };

  const handleNavClick = () => {
    if (onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside className={`
        bg-[#0A0A0A] border-r border-white/[0.05] h-screen sticky top-0 z-50
        transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-16' : 'w-64'}
        fixed lg:sticky
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className={`p-4 border-b border-white/[0.05] relative ${isCollapsed ? 'flex justify-center' : 'flex items-center justify-between'}`}>
          <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`} data-tour="sidebar-logo">
            <Logo className="h-8 w-8 flex-shrink-0" />
            {!isCollapsed && <span className="font-semibold text-xl">TradeX</span>}
          </div>
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggle}
                className="hidden lg:block p-1 hover:bg-white/5 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 transition-transform" />
              </button>
              <button
                onClick={onMobileClose}
                className="lg:hidden p-1 hover:bg-white/5 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
          {isCollapsed && (
            <button
              onClick={handleToggle}
              className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 p-1.5 bg-[#0A0A0A] border border-white/[0.05] hover:bg-white/5 rounded-lg transition-colors z-10"
            >
              <ChevronLeft className="w-4 h-4 rotate-180" />
            </button>
          )}
        </div>

        <nav className="p-2 space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={handleNavClick}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2 rounded-lg transition-colors
                ${isActive ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}
                ${isCollapsed ? 'justify-center' : ''}
              `}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span>{item.name}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <button
            onClick={() => signOut()}
            className={`
              flex items-center gap-3 w-full px-3 py-2 rounded-lg
              text-gray-400 hover:bg-white/5 hover:text-white transition-colors
              ${isCollapsed ? 'justify-center' : ''}
            `}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}