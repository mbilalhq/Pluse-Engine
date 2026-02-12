import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, MessageSquare, Users, Target, BarChart3,
  Ticket, BookOpen, Settings, LogOut, Menu, X, Bell, Search,
  ChevronDown, Zap, UserCircle
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/inbox', label: 'Inbox', icon: MessageSquare },
  { path: '/leads', label: 'Leads', icon: Target },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/tickets', label: 'Tickets', icon: Ticket },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  // Close profile dropdown on click outside
  useEffect(() => {
    function handleClick(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setProfileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-[#030712] text-gray-100 overflow-hidden" data-testid="app-layout">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-20'} flex-shrink-0 bg-[#0a0f1a] border-r border-gray-800/60 flex flex-col transition-all duration-300 ease-in-out`}
        data-testid="sidebar"
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-gray-800/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Zap size={18} className="text-white" />
            </div>
            {sidebarOpen && (
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                NexusEngage
              </span>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                data-testid={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${active
                    ? 'bg-violet-500/15 text-violet-400 border border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.1)]'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                  }`}
              >
                <Icon size={20} className={active ? 'text-violet-400' : ''} />
                {sidebarOpen && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-gray-800/60">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-xs font-bold text-white">
              {user?.name?.charAt(0) || 'U'}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role || 'agent'}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-gray-800/60 bg-[#030712]/80 backdrop-blur-xl z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-800/50 text-gray-400 transition-colors"
              data-testid="toggle-sidebar-btn"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search conversations, leads, customers..."
                className="w-80 pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                data-testid="global-search-input"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-lg hover:bg-gray-800/50 text-gray-400 transition-colors" data-testid="notifications-btn">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-violet-500 rounded-full"></span>
            </button>
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-800/50 transition-colors"
                data-testid="profile-menu-btn"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-xs font-bold text-white">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <ChevronDown size={14} className="text-gray-400" />
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-12 w-52 bg-[#111827] border border-gray-700/60 rounded-xl shadow-xl py-2 z-50" data-testid="profile-dropdown">
                  <div className="px-4 py-2 border-b border-gray-700/60">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                  </div>
                  <Link to="/settings" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800/50">
                    <UserCircle size={16} /> Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-gray-800/50"
                    data-testid="logout-btn"
                  >
                    <LogOut size={16} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto" data-testid="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
