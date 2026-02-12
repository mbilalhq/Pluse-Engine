import { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Users, Search, Plus, X, Mail, Phone, Building2, Tag,
  MessageSquare, TrendingUp, AlertTriangle, Shield, ChevronRight
} from 'lucide-react';

const SEGMENT_COLORS = { vip: 'bg-amber-500/10 text-amber-400 border-amber-500/30', enterprise: 'bg-violet-500/10 text-violet-400 border-violet-500/30', growth: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30', general: 'bg-gray-700/50 text-gray-400 border-gray-600/30' };

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [filterSeg, setFilterSeg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', segment: 'general', tags: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCustomers(); }, [search, filterSeg]);

  const loadCustomers = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (filterSeg) params.segment = filterSeg;
      const res = await api.get('/customers', { params });
      setCustomers(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const selectCustomer = async (cust) => {
    try {
      const res = await api.get(`/customers/${cust.id}`);
      setSelected(res.data);
    } catch (err) { setSelected(cust); }
  };

  const createCustomer = async () => {
    try {
      await api.post('/customers', { ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean), channels: [] });
      setShowForm(false);
      setForm({ name: '', email: '', phone: '', company: '', segment: 'general', tags: '' });
      loadCustomers();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6" data-testid="customers-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Customers</h1>
          <p className="text-gray-500 text-sm mt-1">{customers.length} total customers</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl text-sm font-medium hover:from-violet-500 hover:to-fuchsia-500 transition-all shadow-lg shadow-violet-500/20" data-testid="add-customer-btn">
          <Plus size={16} /> Add Customer
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers..." className="w-full pl-9 pr-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50" data-testid="customer-search" />
        </div>
        {['', 'vip', 'enterprise', 'growth', 'general'].map(s => (
          <button key={s} onClick={() => setFilterSeg(s)} className={`px-3 py-1.5 text-xs rounded-lg font-medium capitalize transition-colors ${filterSeg === s ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'text-gray-500 hover:text-gray-300 border border-gray-700/50'}`} data-testid={`filter-segment-${s || 'all'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Customer Table */}
      <div className="bg-[#111827] border border-gray-800/60 rounded-xl overflow-hidden" data-testid="customer-table">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800/60">
              <th className="text-left text-xs text-gray-500 font-medium px-6 py-3">Customer</th>
              <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Company</th>
              <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Segment</th>
              <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">LTV</th>
              <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Sentiment</th>
              <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Conversations</th>
              <th className="text-right text-xs text-gray-500 font-medium px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((cust) => (
              <tr key={cust.id} className="border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors cursor-pointer" onClick={() => selectCustomer(cust)} data-testid={`customer-row-${cust.id}`}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 flex items-center justify-center text-sm font-bold text-violet-300">{cust.name?.charAt(0)}</div>
                    <div>
                      <p className="text-sm font-medium text-gray-200">{cust.name}</p>
                      <p className="text-xs text-gray-500">{cust.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-gray-400">{cust.company}</td>
                <td className="px-4 py-4">
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium border capitalize ${SEGMENT_COLORS[cust.segment] || SEGMENT_COLORS.general}`}>{cust.segment}</span>
                </td>
                <td className="px-4 py-4 text-sm text-gray-300 font-medium">${(cust.lifetime_value || 0).toLocaleString()}</td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${cust.avg_sentiment > 0.3 ? 'bg-emerald-500' : cust.avg_sentiment < -0.3 ? 'bg-red-500' : 'bg-gray-500'}`}></div>
                    <span className="text-xs text-gray-400">{cust.avg_sentiment?.toFixed(1)}</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-gray-400">{cust.total_conversations}</td>
                <td className="px-6 py-4 text-right">
                  <ChevronRight size={16} className="text-gray-600 inline" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Customer Detail */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="customer-detail-modal">
          <div className="bg-[#111827] border border-gray-700/60 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-xl font-bold text-white">{selected.name?.charAt(0)}</div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{selected.name}</h3>
                    <p className="text-sm text-gray-500">{selected.company}</p>
                    <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-md border font-medium capitalize ${SEGMENT_COLORS[selected.segment] || SEGMENT_COLORS.general}`}>{selected.segment}</span>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-300"><X size={20} /></button>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-gray-800/30 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-white">${((selected.lifetime_value || 0) / 1000).toFixed(0)}k</p>
                  <p className="text-[10px] text-gray-500">LTV</p>
                </div>
                <div className="bg-gray-800/30 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-white">{selected.total_conversations}</p>
                  <p className="text-[10px] text-gray-500">Conversations</p>
                </div>
                <div className="bg-gray-800/30 rounded-lg p-3 text-center">
                  <p className={`text-lg font-bold ${selected.avg_sentiment > 0.3 ? 'text-emerald-400' : selected.avg_sentiment < -0.3 ? 'text-red-400' : 'text-gray-300'}`}>{selected.avg_sentiment?.toFixed(1)}</p>
                  <p className="text-[10px] text-gray-500">Sentiment</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {selected.email && <p className="text-sm text-gray-300 flex items-center gap-2"><Mail size={14} className="text-gray-500" /> {selected.email}</p>}
                {selected.phone && <p className="text-sm text-gray-300 flex items-center gap-2"><Phone size={14} className="text-gray-500" /> {selected.phone}</p>}
              </div>

              {selected.churn_risk && (
                <div className={`p-4 rounded-xl border mb-6 ${selected.churn_risk.risk_level === 'critical' || selected.churn_risk.risk_level === 'high' ? 'bg-red-500/10 border-red-500/20' : 'bg-gray-800/30 border-gray-700/50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={14} className={selected.churn_risk.risk_level === 'low' ? 'text-emerald-400' : 'text-amber-400'} />
                    <span className="text-xs font-medium text-gray-300 capitalize">Churn Risk: {selected.churn_risk.risk_level}</span>
                    <span className="text-xs font-bold text-gray-200 ml-auto">{Math.round(selected.churn_risk.risk_score * 100)}%</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${selected.churn_risk.risk_score > 0.7 ? 'bg-red-500' : selected.churn_risk.risk_score > 0.3 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${selected.churn_risk.risk_score * 100}%` }}></div>
                  </div>
                  {selected.churn_risk.factors?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {selected.churn_risk.factors.map((f, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 bg-gray-800/50 rounded text-gray-400">{f}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {(selected.tags || []).map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700"><Tag size={10} className="inline mr-1" />{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Customer Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="new-customer-modal">
          <div className="bg-[#111827] border border-gray-700/60 rounded-2xl w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Add Customer</h3>
                <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-300"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="Name *" className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50" data-testid="new-cust-name" required />
                <input value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} placeholder="Email" className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50" data-testid="new-cust-email" />
                <input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} placeholder="Phone" className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50" data-testid="new-cust-phone" />
                <input value={form.company} onChange={(e) => setForm({...form, company: e.target.value})} placeholder="Company" className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50" data-testid="new-cust-company" />
                <select value={form.segment} onChange={(e) => setForm({...form, segment: e.target.value})} className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-violet-500/50" data-testid="new-cust-segment">
                  <option value="general">General</option>
                  <option value="growth">Growth</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="vip">VIP</option>
                </select>
                <input value={form.tags} onChange={(e) => setForm({...form, tags: e.target.value})} placeholder="Tags (comma separated)" className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50" data-testid="new-cust-tags" />
                <button onClick={createCustomer} className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl text-sm font-medium hover:from-violet-500 hover:to-fuchsia-500 transition-all shadow-lg shadow-violet-500/20" data-testid="create-customer-submit">Add Customer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
