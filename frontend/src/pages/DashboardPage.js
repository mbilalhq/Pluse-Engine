import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import {
  MessageSquare, Users, Target, Ticket, TrendingUp, TrendingDown,
  Bot, Clock, Smile, Activity
} from 'lucide-react';
import { AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const COLORS = ['#2563eb', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

export default function DashboardPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [convoData, setConvoData] = useState([]);
  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/overview'),
      api.get('/analytics/conversations'),
      api.get('/dashboard/feed'),
    ]).then(([ov, cd, fd]) => {
      setOverview(ov.data);
      setConvoData(cd.data);
      setFeed(fd.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full" data-testid="dashboard-loading"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  const stats = overview ? [
    { label: 'Active Conversations', value: overview.open_conversations, icon: MessageSquare, change: '+12%', up: true, color: 'blue' },
    { label: 'Total Leads', value: overview.total_leads, icon: Target, change: '+8%', up: true, color: 'cyan' },
    { label: 'Open Tickets', value: overview.open_tickets, icon: Ticket, change: '-5%', up: false, color: 'amber' },
    { label: 'AI Resolution', value: `${overview.ai_resolution_rate}%`, icon: Bot, change: '+3%', up: true, color: 'emerald' },
    { label: 'Avg Response', value: overview.avg_response_time, icon: Clock, change: '-15%', up: false, color: 'purple' },
    { label: 'CSAT Score', value: overview.csat_score, icon: Smile, change: '+0.2', up: true, color: 'blue' },
  ] : [];

  const channelData = overview ? Object.entries(overview.channel_distribution).map(([name, value]) => ({ name: name.replace('_', ' '), value })).filter(d => d.value > 0) : [];
  const sentimentData = overview ? [
    { name: 'Positive', value: overview.sentiment_distribution.positive, color: '#10b981' },
    { name: 'Neutral', value: overview.sentiment_distribution.neutral, color: '#94a3b8' },
    { name: 'Negative', value: overview.sentiment_distribution.negative, color: '#ef4444' },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="p-6 lg:p-8 space-y-6" data-testid="dashboard-page">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome back, {user?.name?.split(' ')[0]}</h1>
        <p className="text-slate-500 text-sm mt-0.5">Here's what's happening across your channels today.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4" data-testid="kpi-grid">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white border border-slate-100 rounded-xl p-4 hover:shadow-md transition-shadow" data-testid={`kpi-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>
            <div className="flex items-center justify-between mb-2">
              <stat.icon size={18} className="text-slate-400" />
              <span className={`text-[11px] font-medium flex items-center gap-0.5 ${stat.up ? 'text-emerald-500' : 'text-red-500'}`}>
                {stat.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {stat.change}
              </span>
            </div>
            <p className="text-xl font-bold text-slate-900">{stat.value}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-slate-100 rounded-xl p-5" data-testid="conversation-trend-chart">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Conversation Volume</h3>
              <p className="text-[11px] text-slate-400">AI vs Human handled</p>
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> AI</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500"></span> Human</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={convoData}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/></linearGradient>
                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#06b6d4" stopOpacity={0.15}/><stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" stroke="#cbd5e1" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => v.slice(5)} />
              <YAxis stroke="#cbd5e1" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }} />
              <Area type="monotone" dataKey="ai_handled" stroke="#2563eb" fill="url(#g1)" strokeWidth={2} />
              <Area type="monotone" dataKey="human_handled" stroke="#06b6d4" fill="url(#g2)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-slate-100 rounded-xl p-5" data-testid="channel-distribution">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Channels</h3>
            <ResponsiveContainer width="100%" height={120}>
              <PieChart><Pie data={channelData.length ? channelData : [{name:'None', value:1}]} cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={3} dataKey="value">{(channelData.length ? channelData : [{name:'None'}]).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px' }} /></PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 mt-2 justify-center">{channelData.map((d, i) => <span key={d.name} className="text-[10px] text-slate-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>{d.name}</span>)}</div>
          </div>
          <div className="bg-white border border-slate-100 rounded-xl p-5" data-testid="sentiment-overview">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Sentiment</h3>
            <div className="space-y-2.5">{sentimentData.map(d => { const total = sentimentData.reduce((a, b) => a + b.value, 0) || 1; const pct = Math.round((d.value / total) * 100); return (<div key={d.name}><div className="flex justify-between text-[11px] mb-1"><span className="text-slate-500">{d.name}</span><span className="text-slate-700 font-medium">{pct}%</span></div><div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: d.color }}></div></div></div>); })}</div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-100 rounded-xl p-5" data-testid="recent-conversations">
          <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-slate-900">Recent Conversations</h3><Activity size={14} className="text-slate-400" /></div>
          <div className="space-y-2">{(feed?.recent_conversations || []).map(c => (<div key={c.id} className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"><div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-[10px] font-bold text-blue-600">{c.customer_name?.charAt(0)}</div><div className="flex-1 min-w-0"><p className="text-[12px] font-medium text-slate-800 truncate">{c.customer_name}</p><p className="text-[11px] text-slate-400 truncate">{c.last_message}</p></div><span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${c.status === 'open' ? 'bg-green-50 text-green-600' : c.status === 'escalated' ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-500'}`}>{c.status}</span></div>))}</div>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-5" data-testid="recent-leads">
          <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-slate-900">Recent Leads</h3><Target size={14} className="text-slate-400" /></div>
          <div className="space-y-2">{(feed?.recent_leads || []).map(l => (<div key={l.id} className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"><div className="w-7 h-7 rounded-full bg-cyan-50 flex items-center justify-center text-[10px] font-bold text-cyan-600">{l.name?.charAt(0)}</div><div className="flex-1 min-w-0"><p className="text-[12px] font-medium text-slate-800">{l.name}</p><p className="text-[11px] text-slate-400">{l.company}</p></div><span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${l.grade === 'hot' ? 'bg-red-50 text-red-500' : l.grade === 'warm' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-500'}`}>{l.grade}</span></div>))}</div>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-5" data-testid="recent-tickets">
          <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-slate-900">Recent Tickets</h3><Ticket size={14} className="text-slate-400" /></div>
          <div className="space-y-2">{(feed?.recent_tickets || []).map(t => (<div key={t.id} className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"><div className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${t.priority === 'critical' ? 'bg-red-500' : t.priority === 'high' ? 'bg-amber-500' : 'bg-slate-400'}`}></div><div className="flex-1 min-w-0"><p className="text-[12px] font-medium text-slate-800 truncate">{t.subject}</p><p className="text-[11px] text-slate-400">{t.ticket_number}</p></div><span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${t.status === 'open' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-500'}`}>{t.status?.replace('_', ' ')}</span></div>))}</div>
        </div>
      </div>
    </div>
  );
}
