import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Zap, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function SignInPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid credentials');
    } finally { setLoading(false); }
  };

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const handleGoogleAuth = () => {
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const fillDemo = (role) => {
    const map = {
      admin: { email: 'admin@pulseengine.com', password: 'admin123' },
      manager: { email: 'manager@pulseengine.com', password: 'manager123' },
      agent: { email: 'agent1@pulseengine.com', password: 'agent123' },
    };
    setEmail(map[role].email);
    setPassword(map[role].password);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" data-testid="signin-page">
      {/* Top bar */}
      <div className="h-16 flex items-center px-6 bg-white border-b border-slate-100">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center"><Zap size={14} className="text-white" /></div>
          <span className="text-base font-bold text-slate-900">Pulse Engine</span>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Sign in to your account</h1>
          <p className="text-sm text-slate-500 mb-8">
            Don't have an account? <Link to="/signup" className="text-blue-600 hover:text-blue-700 font-medium">Create one</Link>
          </p>

          {/* Google Auth */}
          <button
            onClick={handleGoogleAuth}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm mb-6"
            data-testid="google-signin-btn"
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-slate-200"></div>
            <span className="text-xs text-slate-400">or</span>
            <div className="flex-1 h-px bg-slate-200"></div>
          </div>

          {error && <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm" data-testid="auth-error">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" data-testid="signin-email" required />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" data-testid="signin-password" required />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{showPw ? <EyeOff size={15}/> : <Eye size={15}/>}</button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2" data-testid="signin-submit-btn">
              {loading ? 'Signing in...' : 'Sign In'} {!loading && <ArrowRight size={15} />}
            </button>
          </form>

          {/* Demo */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-[11px] text-slate-400 mb-2 text-center">Quick demo access</p>
            <div className="flex gap-2">
              {['admin', 'manager', 'agent'].map(r => (
                <button key={r} onClick={() => fillDemo(r)} className="flex-1 py-2 text-xs font-medium capitalize bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all" data-testid={`demo-${r}-btn`}>{r}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
