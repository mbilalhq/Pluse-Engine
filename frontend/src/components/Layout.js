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

  useEffect(() => {
    function handleClick(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => { setProfileOpen(false); }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/signin'); };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden" data-testid="app-layout">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-60' : 'w-[72px]'} flex-shrink-0 bg-white border-r border-slate-100 flex flex-col transition-all duration-200`} data-testid="sidebar">
        <div className="h-14 flex items-center px-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
              <Zap size={16} className="text-white" />
            </div>
            {sidebarOpen && <span className="font-bold text-base text-slate-900 tracking-tight">Pulse Engine</span>}
          </div>
        </div>
        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname.startsWith(path);
            return (
              <Link
                key={path} to={path}
                data-testid={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all
                  ${active ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
              >
                <Icon size={18} />
                {sidebarOpen && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
              {user?.name?.charAt(0) || 'U'}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-slate-900 truncate">{user?.name || 'User'}</p>
                <p className="text-[11px] text-slate-400 capitalize">{user?.role || 'agent'}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 flex items-center justify-between px-5 border-b border-slate-100 bg-white/80 backdrop-blur-xl z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 transition-colors" data-testid="toggle-sidebar-btn">
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="relative hidden md:block">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search..." className="w-72 pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" data-testid="global-search-input" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative p-1.5 rounded-md hover:bg-slate-100 text-slate-400 transition-colors" data-testid="notifications-btn">
              <Bell size={18} />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
            </button>
            <div className="relative" ref={profileRef}>
              <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors" data-testid="profile-menu-btn">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-[11px] font-bold text-blue-600">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <ChevronDown size={12} className="text-slate-400" />
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-10 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50" data-testid="profile-dropdown">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                    <p className="text-[11px] text-slate-400">{user?.email}</p>
                  </div>
                  <Link to="/settings" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><UserCircle size={14} /> Profile</Link>
                  <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50" data-testid="logout-btn"><LogOut size={14} /> Sign Out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto" data-testid="main-content">{children}</main>
      </div>
    </div>
  );
}
