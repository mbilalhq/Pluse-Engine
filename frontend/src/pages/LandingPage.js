import { Link } from 'react-router-dom';
import { MessageSquare, Bot, BarChart3, Users, Shield, Zap, ArrowRight, Check, Globe } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white" data-testid="landing-page">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900 tracking-tight">Pulse Engine</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Features</a>
            <a href="#channels" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Channels</a>
            <a href="#pricing" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/signin" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-4 py-2" data-testid="header-signin-btn">
              Sign In
            </Link>
            <Link to="/signup" className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-lg transition-colors shadow-sm" data-testid="header-signup-btn">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-medium mb-6">
            <Zap size={12} /> AI-Powered Customer Engagement
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-slate-900 tracking-tight leading-tight mb-6">
            Unify Every Customer<br />
            <span className="text-blue-600">Conversation</span> in One Place
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Connect WhatsApp, Instagram, Facebook & Web Chat. Let AI handle routine inquiries while your team focuses on closing deals and delighting customers.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/signup" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20" data-testid="hero-signup-btn">
              Start Free Trial <ArrowRight size={16} />
            </Link>
            <Link to="/signin" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-lg font-medium text-sm hover:bg-slate-50 transition-colors" data-testid="hero-signin-btn">
              Sign In to Dashboard
            </Link>
          </div>
          <div className="flex items-center justify-center gap-6 mt-8 text-xs text-slate-400">
            <span className="flex items-center gap-1"><Check size={12} className="text-green-500" /> Free 14-day trial</span>
            <span className="flex items-center gap-1"><Check size={12} className="text-green-500" /> No credit card required</span>
            <span className="flex items-center gap-1"><Check size={12} className="text-green-500" /> Cancel anytime</span>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-slate-50 border-y border-slate-100">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: '70%+', label: 'AI Resolution Rate' },
            { value: '<1min', label: 'Avg Response Time' },
            { value: '5+', label: 'Channels Supported' },
            { value: '4.8/5', label: 'Customer Satisfaction' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-bold text-slate-900">{s.value}</p>
              <p className="text-sm text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Everything You Need to Engage</h2>
            <p className="text-slate-500 max-w-xl mx-auto">From AI-powered responses to deep analytics, Pulse Engine covers your entire customer engagement workflow.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Bot, title: 'AI-Powered Responses', desc: 'Gemini AI handles routine queries with sentiment analysis and intent classification. Escalates complex issues to human agents automatically.' },
              { icon: MessageSquare, title: 'Unified Inbox', desc: 'See conversations from WhatsApp, Instagram, Facebook, and Web Chat side by side. Never miss a message.' },
              { icon: BarChart3, title: 'Real-time Analytics', desc: 'Track conversation volume, sentiment trends, agent performance, and lead conversion rates in real-time.' },
              { icon: Users, title: 'Lead Management', desc: 'Capture and score leads from every channel. BANT scoring and AI-powered qualification.' },
              { icon: Shield, title: 'Enterprise Security', desc: 'JWT authentication, role-based access control, encrypted data, and GDPR compliance built-in.' },
              { icon: Globe, title: 'Multi-Channel', desc: 'Connect any social platform. Configure API keys per company. Webhook-ready architecture.' },
            ].map(f => (
              <div key={f.title} className="bg-white border border-slate-100 rounded-xl p-6 hover:shadow-lg hover:shadow-slate-100/50 transition-all duration-300">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
                  <f.icon size={20} className="text-blue-600" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-blue-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Transform Your Customer Engagement?</h2>
          <p className="text-blue-100 mb-8 text-lg">Join thousands of companies using Pulse Engine to deliver exceptional experiences.</p>
          <Link to="/signup" className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-blue-600 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-colors shadow-lg" data-testid="cta-signup-btn">
            Get Started Free <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-slate-900 text-slate-400">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-white">Pulse Engine</span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <span>Privacy</span>
            <span>Terms</span>
          </div>
          <p className="text-xs">&copy; 2026 Pulse Engine. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
