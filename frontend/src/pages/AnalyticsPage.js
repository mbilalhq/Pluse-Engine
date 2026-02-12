import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { BarChart3, TrendingUp, Bot, Users, Target, MessageSquare } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts';

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function AnalyticsPage() {
  const [overview, setOverview] = useState(null);
  const [convoData, setConvoData] = useState([]);
  const [leadData, setLeadData] = useState(null);
  const [sentimentData, setSentimentData] = useState([]);
  const [agentData, setAgentData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/overview'),
      api.get('/analytics/conversations'),
      api.get('/analytics/leads'),
      api.get('/analytics/sentiment'),
      api.get('/analytics/agents'),
    ]).then(([ov, cd, ld, sd, ad]) => {
      setOverview(ov.data);
      setConvoData(cd.data);
      setLeadData(ld.data);
      setSentimentData(sd.data);
      setAgentData(ad.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div></div>;

  const leadsBySource = leadData ? Object.entries(leadData.by_source).map(([name, value]) => ({ name: name.replace('_', ' '), value })) : [];
  const leadsByGrade = leadData ? Object.entries(leadData.by_grade).map(([name, value]) => ({ name, value })) : [];

  return (
    <div className="p-6 lg:p-8 space-y-8" data-testid="analytics-page">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">Performance insights and business metrics</p>
      </div>

      {/* Top KPIs */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4" data-testid="analytics-kpis">
          {[
            { label: 'Conversations', value: overview.total_conversations, icon: MessageSquare, color: 'violet' },
            { label: 'AI Rate', value: `${overview.ai_resolution_rate}%`, icon: Bot, color: 'purple' },
            { label: 'CSAT', value: overview.csat_score, icon: TrendingUp, color: 'emerald' },
            { label: 'NPS', value: overview.nps_score, icon: BarChart3, color: 'cyan' },
            { label: 'Leads', value: overview.total_leads, icon: Target, color: 'amber' },
            { label: 'Customers', value: overview.total_customers, icon: Users, color: 'fuchsia' },
          ].map(k => (
            <div key={k.label} className="bg-[#111827] border border-gray-800/60 rounded-xl p-4">
              <k.icon size={16} className="text-gray-500 mb-2" />
              <p className="text-2xl font-bold text-white">{k.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversation Volume */}
        <div className="bg-[#111827] border border-gray-800/60 rounded-xl p-6" data-testid="chart-conversation-volume">
          <h3 className="text-sm font-semibold text-white mb-4">Conversation Volume (30d)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={convoData.slice(-15)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" stroke="#4b5563" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis stroke="#4b5563" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }} />
              <Bar dataKey="ai_handled" fill="#8b5cf6" name="AI" radius={[2, 2, 0, 0]} />
              <Bar dataKey="human_handled" fill="#06b6d4" name="Human" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sentiment Trend */}
        <div className="bg-[#111827] border border-gray-800/60 rounded-xl p-6" data-testid="chart-sentiment-trend">
          <h3 className="text-sm font-semibold text-white mb-4">Sentiment Trend (30d)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={sentimentData.slice(-15)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" stroke="#4b5563" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis stroke="#4b5563" tick={{ fontSize: 10 }} domain={[-1, 1]} />
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }} />
              <Line type="monotone" dataKey="avg_sentiment" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Leads by Source */}
        <div className="bg-[#111827] border border-gray-800/60 rounded-xl p-6" data-testid="chart-leads-source">
          <h3 className="text-sm font-semibold text-white mb-4">Leads by Source</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={leadsBySource.length ? leadsBySource : [{name: 'No data', value: 1}]} cx="50%" cy="50%" outerRadius={80} innerRadius={40} dataKey="value" paddingAngle={3}>
                {(leadsBySource.length ? leadsBySource : [{name: 'No data'}]).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Lead Grade Distribution */}
        <div className="bg-[#111827] border border-gray-800/60 rounded-xl p-6" data-testid="chart-leads-grade">
          <h3 className="text-sm font-semibold text-white mb-4">Lead Grade Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={leadsByGrade} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis type="number" stroke="#4b5563" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" stroke="#4b5563" tick={{ fontSize: 11 }} width={60} />
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {leadsByGrade.map((entry, i) => <Cell key={i} fill={entry.name === 'hot' ? '#ef4444' : entry.name === 'warm' ? '#f59e0b' : '#3b82f6'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Agent Performance */}
      <div className="bg-[#111827] border border-gray-800/60 rounded-xl p-6" data-testid="agent-performance">
        <h3 className="text-sm font-semibold text-white mb-4">Agent Performance</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800/60">
              <th className="text-left text-xs text-gray-500 font-medium py-3 px-4">Agent</th>
              <th className="text-left text-xs text-gray-500 font-medium py-3 px-4">Role</th>
              <th className="text-left text-xs text-gray-500 font-medium py-3 px-4">Conversations</th>
              <th className="text-left text-xs text-gray-500 font-medium py-3 px-4">Resolved</th>
              <th className="text-left text-xs text-gray-500 font-medium py-3 px-4">Resolution Rate</th>
              <th className="text-left text-xs text-gray-500 font-medium py-3 px-4">Avg Response</th>
              <th className="text-left text-xs text-gray-500 font-medium py-3 px-4">CSAT</th>
            </tr>
          </thead>
          <tbody>
            {agentData.map((agent) => (
              <tr key={agent.id} className="border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-400">{agent.name?.charAt(0)}</div>
                    <span className="text-sm text-gray-200">{agent.name}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-xs text-gray-400 capitalize">{agent.role}</td>
                <td className="py-3 px-4 text-sm text-gray-300 font-medium">{agent.conversations_handled}</td>
                <td className="py-3 px-4 text-sm text-gray-300">{agent.resolved}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${agent.resolution_rate}%` }}></div>
                    </div>
                    <span className="text-xs text-gray-400">{agent.resolution_rate}%</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-gray-400">{agent.avg_response_time}</td>
                <td className="py-3 px-4 text-sm text-amber-400 font-medium">{agent.csat}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
