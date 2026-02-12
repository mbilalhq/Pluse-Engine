import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import {
  MessageSquare, Users, Target, Ticket, TrendingUp, TrendingDown,
  Bot, Clock, Smile, ArrowUpRight, Zap, Activity, BarChart3
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="dashboard-loading">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const stats = overview ? [
    { label: 'Active Conversations', value: overview.open_conversations, icon: MessageSquare, change: '+12%', up: true, color: 'violet' },
    { label: 'Total Leads', value: overview.total_leads, icon: Target, change: '+8%', up: true, color: 'cyan' },
    { label: 'Open Tickets', value: overview.open_tickets, icon: Ticket, change: '-5%', up: false, color: 'amber' },
    { label: 'AI Resolution', value: `${overview.ai_resolution_rate}%`, icon: Bot, change: '+3%', up: true, color: 'emerald' },
    { label: 'Avg Response', value: overview.avg_response_time, icon: Clock, change: '-15%', up: false, color: 'fuchsia' },
    { label: 'CSAT Score', value: overview.csat_score, icon: Smile, change: '+0.2', up: true, color: 'violet' },
  ] : [];

  const channelData = overview ? Object.entries(overview.channel_distribution).map(([name, value]) => ({ name, value })).filter(d => d.value > 0) : [];
  const sentimentData = overview ? [
    { name: 'Positive', value: overview.sentiment_distribution.positive },
    { name: 'Neutral', value: overview.sentiment_distribution.neutral },
    { name: 'Negative', value: overview.sentiment_distribution.negative },
  ].filter(d => d.value > 0) : [];

  const colorMap = { violet: 'from-violet-500/20 to-violet-500/5 border-violet-500/30 text-violet-400', cyan: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/30 text-cyan-400', amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-400', emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400', fuchsia: 'from-fuchsia-500/20 to-fuchsia-500/5 border-fuchsia-500/30 text-fuchsia-400' };

  return (
    <div className="p-6 lg:p-8 space-y-8" data-testid="dashboard-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Welcome back, {user?.name?.split(' ')[0]}</h1>
        <p className="text-gray-500 mt-1">Here's what's happening across your channels today.</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4" data-testid="kpi-grid">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`bg-gradient-to-b ${colorMap[stat.color]} border rounded-xl p-5 hover:scale-[1.02] transition-transform duration-200`}
            data-testid={`kpi-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <div className="flex items-center justify-between mb-3">
              <stat.icon size={20} className="opacity-70" />
              <span className={`text-xs font-medium flex items-center gap-0.5 ${stat.up ? 'text-emerald-400' : 'text-red-400'}`}>
                {stat.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {stat.change}
              </span>
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Conversation Trend - Large */}
        <div className="lg:col-span-8 bg-[#111827] border border-gray-800/60 rounded-xl p-6" data-testid="conversation-trend-chart">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">Conversation Volume</h3>
              <p className="text-sm text-gray-500">AI vs Human handled conversations</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-violet-500"></span> AI Handled</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span> Human</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={convoData}>
              <defs>
                <linearGradient id="aiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="humanGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" stroke="#4b5563" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis stroke="#4b5563" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }} />
              <Area type="monotone" dataKey="ai_handled" stroke="#8b5cf6" fill="url(#aiGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="human_handled" stroke="#06b6d4" fill="url(#humanGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-4 space-y-6">
          {/* Channel Distribution */}
          <div className="bg-[#111827] border border-gray-800/60 rounded-xl p-6" data-testid="channel-distribution">
            <h3 className="text-sm font-semibold text-white mb-4">Channel Distribution</h3>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={channelData.length ? channelData : [{name:'No Data', value:1}]} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={4} dataKey="value">
                  {(channelData.length ? channelData : [{name:'No Data'}]).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {channelData.map((d, i) => (
                <span key={d.name} className="text-xs text-gray-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                  {d.name.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>

          {/* Sentiment */}
          <div className="bg-[#111827] border border-gray-800/60 rounded-xl p-6" data-testid="sentiment-overview">
            <h3 className="text-sm font-semibold text-white mb-4">Sentiment Overview</h3>
            <div className="space-y-3">
              {sentimentData.map((d, i) => {
                const total = sentimentData.reduce((a, b) => a + b.value, 0) || 1;
                const pct = Math.round((d.value / total) * 100);
                const colors = ['bg-emerald-500', 'bg-gray-500', 'bg-red-500'];
                return (
                  <div key={d.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">{d.name}</span>
                      <span className="text-gray-300 font-medium">{pct}%</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full ${colors[i]} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Conversations */}
        <div className="bg-[#111827] border border-gray-800/60 rounded-xl p-6" data-testid="recent-conversations">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Recent Conversations</h3>
            <Activity size={16} className="text-gray-500" />
          </div>
          <div className="space-y-3">
            {(feed?.recent_conversations || []).map((convo) => (
              <div key={convo.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-800/30 transition-colors cursor-pointer">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${convo.channel === 'whatsapp' ? 'bg-emerald-500/20 text-emerald-400' : convo.channel === 'instagram' ? 'bg-pink-500/20 text-pink-400' : convo.channel === 'facebook' ? 'bg-blue-500/20 text-blue-400' : 'bg-violet-500/20 text-violet-400'}`}>
                  {convo.customer_name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{convo.customer_name}</p>
                  <p className="text-xs text-gray-500 truncate">{convo.last_message}</p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${convo.status === 'open' ? 'bg-emerald-500/10 text-emerald-400' : convo.status === 'escalated' ? 'bg-red-500/10 text-red-400' : 'bg-gray-700 text-gray-400'}`}>
                  {convo.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Leads */}
        <div className="bg-[#111827] border border-gray-800/60 rounded-xl p-6" data-testid="recent-leads">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Recent Leads</h3>
            <Target size={16} className="text-gray-500" />
          </div>
          <div className="space-y-3">
            {(feed?.recent_leads || []).map((lead) => (
              <div key={lead.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800/30 transition-colors cursor-pointer">
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs font-bold text-cyan-400">
                  {lead.name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200">{lead.name}</p>
                  <p className="text-xs text-gray-500">{lead.company}</p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${lead.grade === 'hot' ? 'bg-red-500/10 text-red-400' : lead.grade === 'warm' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'}`}>
                  {lead.grade}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Tickets */}
        <div className="bg-[#111827] border border-gray-800/60 rounded-xl p-6" data-testid="recent-tickets">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Recent Tickets</h3>
            <Ticket size={16} className="text-gray-500" />
          </div>
          <div className="space-y-3">
            {(feed?.recent_tickets || []).map((ticket) => (
              <div key={ticket.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-800/30 transition-colors cursor-pointer">
                <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${ticket.priority === 'critical' ? 'bg-red-500' : ticket.priority === 'high' ? 'bg-amber-500' : 'bg-gray-500'}`}></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{ticket.subject}</p>
                  <p className="text-xs text-gray-500">{ticket.ticket_number} · {ticket.category}</p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ticket.status === 'open' ? 'bg-emerald-500/10 text-emerald-400' : ticket.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-700 text-gray-400'}`}>
                  {ticket.status?.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
