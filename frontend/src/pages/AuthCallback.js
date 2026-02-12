import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Zap } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuthFromGoogle } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      api.post('/auth/session', { session_id: sessionId })
        .then(res => {
          setAuthFromGoogle(res.data.user, res.data.token);
          navigate('/dashboard', { replace: true });
        })
        .catch(err => {
          setError('Google authentication failed. Please try again.');
          setTimeout(() => navigate('/signin'), 2000);
        });
    } else {
      navigate('/signin', { replace: true });
    }
  }, [searchParams, navigate, setAuthFromGoogle]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
          <Zap size={24} className="text-white" />
        </div>
        {error ? (
          <p className="text-red-500 text-sm">{error}</p>
        ) : (
          <>
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm text-slate-500">Completing sign in...</p>
          </>
        )}
      </div>
    </div>
  );
}
