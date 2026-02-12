import { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Target, Search, Plus, X, ChevronDown, Star, Phone, Mail,
  Building2, Calendar, User, MoreVertical, TrendingUp, Sparkles
} from 'lucide-react';

const GRADE_COLORS = { hot: 'bg-red-50 text-red-500 border-red-500/30', warm: 'bg-amber-50 text-amber-600 border-amber-500/30', cold: 'bg-blue-50 text-blue-600 border-blue-500/30' };
const STATUS_COLORS = { new: 'bg-blue-50 text-blue-600', contacted: 'bg-cyan-50 text-cyan-600', qualified: 'bg-emerald-50 text-emerald-600', proposal: 'bg-amber-50 text-amber-600', negotiation: 'bg-fuchsia-50 text-fuchsia-600', won: 'bg-green-500/10 text-green-400', lost: 'bg-red-50 text-red-500' };

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', source: 'web_chat', notes: '' });
  const [scoring, setScoring] = useState(false);

  useEffect(() => { loadLeads(); }, [search, filterGrade]);

  const loadLeads = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (filterGrade) params.grade = filterGrade;
      const res = await api.get('/leads', { params });
      setLeads(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const createLead = async () => {
    try {
      await api.post('/leads', form);
      setShowForm(false);
      setForm({ name: '', email: '', phone: '', company: '', source: 'web_chat', notes: '' });
      loadLeads();
    } catch (err) { console.error(err); }
  };

  const scoreLead = async (leadId) => {
    setScoring(true);
    try {
      const res = await api.post(`/leads/${leadId}/score`);
      setSelectedLead(res.data);
      loadLeads();
    } catch (err) { console.error(err); }
    finally { setScoring(false); }
  };

  const updateStatus = async (leadId, status) => {
    try {
      const res = await api.put(`/leads/${leadId}`, { status });
      setSelectedLead(res.data);
      loadLeads();
    } catch (err) { console.error(err); }
  };

  const grouped = { new: [], contacted: [], qualified: [], proposal: [], won: [] };
  leads.forEach(l => { if (grouped[l.status]) grouped[l.status].push(l); else grouped.new.push(l); });

  return (
    <div className="p-6 lg:p-8 space-y-6" data-testid="leads-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lead Pipeline</h1>
          <p className="text-slate-400 text-sm mt-1">{leads.length} leads total</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-slate-900 rounded-xl text-sm font-medium hover:from-blue-500 hover:to-blue-600 transition-all shadow-lg shadow-blue-600/15"
          data-testid="add-lead-btn"
        >
          <Plus size={16} /> Add Lead
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
            data-testid="lead-search-input"
          />
        </div>
        {['', 'hot', 'warm', 'cold'].map((g) => (
          <button
            key={g}
            onClick={() => setFilterGrade(g)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${filterGrade === g ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'text-slate-400 hover:text-slate-600 border border-slate-200'}`}
            data-testid={`filter-grade-${g || 'all'}`}
          >
            {g || 'All'}
          </button>
        ))}
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4" data-testid="lead-pipeline">
        {Object.entries(grouped).map(([status, items]) => (
          <div key={status} className="w-72 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-md font-medium capitalize ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-500'}`}>{status}</span>
                <span className="text-xs text-slate-400">{items.length}</span>
              </div>
            </div>
            <div className="space-y-3">
              {items.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className="bg-white border border-slate-100 rounded-xl p-4 hover:border-blue-200 transition-all cursor-pointer group"
                  data-testid={`lead-card-${lead.id}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-semibold text-slate-700">{lead.name}</h4>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${GRADE_COLORS[lead.grade] || GRADE_COLORS.warm}`}>{lead.grade}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{lead.company}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${lead.score >= 80 ? 'bg-emerald-500' : lead.score >= 50 ? 'bg-amber-500' : 'bg-gray-600'}`} style={{ width: `${lead.score}%` }}></div>
                      </div>
                      <span className="text-[10px] text-slate-400">{lead.score}%</span>
                    </div>
                    <span className="text-[10px] text-slate-300">{lead.source?.replace('_', ' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="lead-detail-modal">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedLead.name}</h3>
                  <p className="text-sm text-slate-400">{selectedLead.company}</p>
                </div>
                <button onClick={() => setSelectedLead(null)} className="text-slate-400 hover:text-slate-600" data-testid="close-lead-detail">
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 mb-1">Score</p>
                  <p className="text-2xl font-bold text-slate-900">{selectedLead.score}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 mb-1">Grade</p>
                  <p className={`text-xl font-bold capitalize ${selectedLead.grade === 'hot' ? 'text-red-500' : selectedLead.grade === 'warm' ? 'text-amber-600' : 'text-blue-600'}`}>{selectedLead.grade}</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {selectedLead.email && <p className="text-sm text-slate-600 flex items-center gap-2"><Mail size={14} className="text-slate-400" /> {selectedLead.email}</p>}
                {selectedLead.phone && <p className="text-sm text-slate-600 flex items-center gap-2"><Phone size={14} className="text-slate-400" /> {selectedLead.phone}</p>}
                <p className="text-sm text-slate-600 flex items-center gap-2"><Building2 size={14} className="text-slate-400" /> {selectedLead.company || 'N/A'}</p>
                <p className="text-sm text-slate-600 flex items-center gap-2"><Target size={14} className="text-slate-400" /> Source: {selectedLead.source?.replace('_', ' ')}</p>
              </div>

              {selectedLead.notes && (
                <div className="bg-slate-50 rounded-lg p-3 mb-6">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-sm text-slate-600">{selectedLead.notes}</p>
                </div>
              )}

              {selectedLead.scoring_reason && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-6">
                  <p className="text-[10px] text-purple-600 uppercase tracking-wider mb-1 flex items-center gap-1"><Sparkles size={10} /> AI Scoring Insight</p>
                  <p className="text-sm text-slate-600">{selectedLead.scoring_reason}</p>
                  {selectedLead.next_action && <p className="text-xs text-purple-600 mt-2">Next: {selectedLead.next_action}</p>}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => scoreLead(selectedLead.id)}
                  disabled={scoring}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-50 border border-purple-200 text-purple-600 rounded-xl text-sm font-medium hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                  data-testid="score-lead-btn"
                >
                  <Sparkles size={14} /> {scoring ? 'Scoring...' : 'AI Score'}
                </button>
                <button
                  onClick={async () => { try { const r = await api.post(`/leads/${selectedLead.id}/nurture`); alert(`Nurture message:\n\n${r.data.message}`); } catch(e) { console.error(e); } }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-100 transition-colors"
                  data-testid="nurture-lead-btn"
                >
                  <Sparkles size={14} /> Nurture
                </button>
              </div>
              <select
                value={selectedLead.status}
                onChange={(e) => updateStatus(selectedLead.id, e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                data-testid="lead-status-select"
              >
                {['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* New Lead Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="new-lead-modal">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900">Add New Lead</h3>
                <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="Full Name *" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/20" data-testid="new-lead-name" required />
                <input value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} placeholder="Email" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/20" data-testid="new-lead-email" />
                <input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} placeholder="Phone" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/20" data-testid="new-lead-phone" />
                <input value={form.company} onChange={(e) => setForm({...form, company: e.target.value})} placeholder="Company" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/20" data-testid="new-lead-company" />
                <select value={form.source} onChange={(e) => setForm({...form, source: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/20" data-testid="new-lead-source">
                  <option value="web_chat">Web Chat</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="referral">Referral</option>
                  <option value="organic">Organic</option>
                </select>
                <textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} placeholder="Notes" rows={3} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/20 resize-none" data-testid="new-lead-notes" />
                <button onClick={createLead} className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-slate-900 rounded-xl text-sm font-medium hover:from-blue-500 hover:to-blue-600 transition-all shadow-lg shadow-blue-600/15" data-testid="create-lead-submit">Create Lead</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
