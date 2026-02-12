import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Zap, Eye, EyeOff, ArrowRight, Mail, Lock, User } from 'lucide-react';

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role) => {
    const creds = {
      admin: { email: 'admin@nexusengage.com', password: 'admin123' },
      manager: { email: 'manager@nexusengage.com', password: 'manager123' },
      agent: { email: 'agent1@nexusengage.com', password: 'agent123' },
    };
    setEmail(creds[role].email);
    setPassword(creds[role].password);
    setIsLogin(true);
  };

  return (
    <div className="min-h-screen bg-[#030712] flex" data-testid="login-page">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/30 via-[#030712] to-fuchsia-900/20"></div>
        <div className="absolute inset-0" style={{backgroundImage: 'radial-gradient(circle at 30% 40%, rgba(139,92,246,0.15) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(217,70,239,0.1) 0%, transparent 50%)'}}></div>
        <div className="relative z-10 flex flex-col justify-center px-16">
          <div className="flex items-center gap-4 mb-12">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-2xl shadow-violet-500/30">
              <Zap size={28} className="text-white" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">NexusEngage</span>
            </h1>
          </div>
          <h2 className="text-3xl font-semibold text-white mb-4 leading-tight">
            AI-Powered Customer<br />Engagement Platform
          </h2>
          <p className="text-gray-400 text-lg max-w-md leading-relaxed">
            Unify conversations across WhatsApp, Instagram, Facebook & Web Chat. Let AI handle the routine while your team focuses on what matters.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-6">
            {[
              { label: 'AI Resolution Rate', value: '70%+' },
              { label: 'Response Time', value: '<1min' },
              { label: 'Channels', value: '5+' },
              { label: 'CSAT Score', value: '4.5/5' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-2xl font-bold text-violet-400">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Zap size={20} className="text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">NexusEngage</span>
          </div>

          <h3 className="text-2xl font-bold text-white mb-2">{isLogin ? 'Welcome back' : 'Create account'}</h3>
          <p className="text-gray-500 mb-8">{isLogin ? 'Sign in to your workspace' : 'Get started with NexusEngage'}</p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm" data-testid="auth-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/50 transition-all"
                  data-testid="register-name-input"
                  required
                />
              </div>
            )}
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/50 transition-all"
                data-testid="email-input"
                required
              />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/50 transition-all"
                data-testid="password-input"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl font-semibold text-sm hover:from-violet-500 hover:to-fuchsia-500 transition-all shadow-lg shadow-violet-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="login-submit-btn"
            >
              {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="text-sm text-gray-500 hover:text-violet-400 transition-colors"
              data-testid="toggle-auth-mode-btn"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>

          {isLogin && (
            <div className="mt-8 pt-6 border-t border-gray-800/60">
              <p className="text-xs text-gray-600 mb-3 text-center">Quick demo access</p>
              <div className="flex gap-2">
                {['admin', 'manager', 'agent'].map((role) => (
                  <button
                    key={role}
                    onClick={() => fillDemo(role)}
                    className="flex-1 py-2 text-xs font-medium capitalize bg-gray-800/50 border border-gray-700/50 rounded-lg text-gray-400 hover:text-violet-400 hover:border-violet-500/30 transition-all"
                    data-testid={`demo-${role}-btn`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
