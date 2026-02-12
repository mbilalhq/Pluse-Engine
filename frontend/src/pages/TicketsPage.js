import { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Ticket, Search, Plus, X, Clock, AlertTriangle, CheckCircle2,
  MessageSquare, User, Calendar, Tag, ChevronRight
} from 'lucide-react';

const PRIORITY_COLORS = { critical: 'bg-red-500/10 text-red-400 border-red-500/30', high: 'bg-amber-500/10 text-amber-400 border-amber-500/30', medium: 'bg-blue-500/10 text-blue-400 border-blue-500/30', low: 'bg-gray-700/50 text-gray-400 border-gray-600/30' };
const STATUS_COLORS = { open: 'bg-emerald-500/10 text-emerald-400', in_progress: 'bg-blue-500/10 text-blue-400', escalated: 'bg-red-500/10 text-red-400', resolved: 'bg-gray-700/50 text-gray-400', closed: 'bg-gray-800 text-gray-500' };

export default function TicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [form, setForm] = useState({ subject: '', description: '', priority: 'medium', category: 'general' });
  const [noteContent, setNoteContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTickets(); }, [filterStatus, filterPriority]);

  const loadTickets = async () => {
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterPriority) params.priority = filterPriority;
      const res = await api.get('/tickets', { params });
      setTickets(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const createTicket = async () => {
    try {
      await api.post('/tickets', form);
      setShowForm(false);
      setForm({ subject: '', description: '', priority: 'medium', category: 'general' });
      loadTickets();
    } catch (err) { console.error(err); }
  };

  const updateTicketStatus = async (ticketId, status) => {
    try {
      const res = await api.put(`/tickets/${ticketId}`, { status });
      setSelected(res.data);
      loadTickets();
    } catch (err) { console.error(err); }
  };

  const addNote = async () => {
    if (!noteContent.trim() || !selected) return;
    try {
      await api.post(`/tickets/${selected.id}/notes`, { content: noteContent });
      setNoteContent('');
      const res = await api.get(`/tickets/${selected.id}`);
      setSelected(res.data);
    } catch (err) { console.error(err); }
  };

  const getSLAStatus = (deadline) => {
    if (!deadline) return { text: 'N/A', urgent: false };
    const diff = new Date(deadline) - new Date();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 0) return { text: 'Overdue', urgent: true };
    if (hours < 4) return { text: `${hours}h left`, urgent: true };
    return { text: `${hours}h left`, urgent: false };
  };

  return (
    <div className="p-6 lg:p-8 space-y-6" data-testid="tickets-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Support Tickets</h1>
          <p className="text-gray-500 text-sm mt-1">{tickets.length} tickets</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl text-sm font-medium hover:from-violet-500 hover:to-fuchsia-500 transition-all shadow-lg shadow-violet-500/20" data-testid="create-ticket-btn">
          <Plus size={16} /> New Ticket
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {['', 'open', 'in_progress', 'escalated', 'resolved'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 text-xs rounded-lg font-medium capitalize transition-colors ${filterStatus === s ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'text-gray-500 hover:text-gray-300 border border-gray-700/50'}`} data-testid={`filter-status-${s || 'all'}`}>
              {s ? s.replace('_', ' ') : 'All'}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-gray-700"></div>
        <div className="flex gap-1">
          {['', 'critical', 'high', 'medium', 'low'].map(p => (
            <button key={p} onClick={() => setFilterPriority(p)} className={`px-3 py-1.5 text-xs rounded-lg font-medium capitalize transition-colors ${filterPriority === p ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'text-gray-500 hover:text-gray-300 border border-gray-700/50'}`} data-testid={`filter-priority-${p || 'all'}`}>
              {p || 'All Priority'}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket List */}
      <div className="space-y-3" data-testid="ticket-list">
        {tickets.map((ticket) => {
          const sla = getSLAStatus(ticket.sla_deadline);
          return (
            <div
              key={ticket.id}
              onClick={() => setSelected(ticket)}
              className="bg-[#111827] border border-gray-800/60 rounded-xl p-5 hover:border-violet-500/30 transition-all cursor-pointer"
              data-testid={`ticket-item-${ticket.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs text-gray-500 font-mono">{ticket.ticket_number}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.medium}`}>{ticket.priority}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[ticket.status] || STATUS_COLORS.open}`}>{ticket.status?.replace('_', ' ')}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-gray-200 mb-1">{ticket.subject}</h4>
                  <p className="text-xs text-gray-500 line-clamp-1">{ticket.description}</p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <div className="text-right">
                    <div className={`flex items-center gap-1 text-xs ${sla.urgent ? 'text-red-400' : 'text-gray-500'}`}>
                      <Clock size={12} /> {sla.text}
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1">{ticket.category}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-600" />
                </div>
              </div>
              {ticket.assigned_name && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-800/40">
                  <User size={12} className="text-gray-500" />
                  <span className="text-xs text-gray-500">{ticket.assigned_name}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Ticket Detail */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="ticket-detail-modal">
          <div className="bg-[#111827] border border-gray-700/60 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-500 font-mono">{selected.ticket_number}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${PRIORITY_COLORS[selected.priority]}`}>{selected.priority}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white">{selected.subject}</h3>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-300"><X size={20} /></button>
              </div>

              <div className="bg-gray-800/30 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-300">{selected.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Status</p>
                  <select
                    value={selected.status}
                    onChange={(e) => updateTicketStatus(selected.id, e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                    data-testid="ticket-status-select"
                  >
                    {['open', 'in_progress', 'escalated', 'resolved', 'closed'].map(s => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase mb-1">SLA Deadline</p>
                  <p className={`text-sm font-medium ${getSLAStatus(selected.sla_deadline).urgent ? 'text-red-400' : 'text-gray-300'}`}>
                    {selected.sla_deadline ? new Date(selected.sla_deadline).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Notes */}
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-white mb-3">Internal Notes</h4>
                <div className="space-y-2 mb-3">
                  {(selected.notes || []).map((note) => (
                    <div key={note.id} className="bg-gray-800/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-300">{note.author_name}</span>
                        <span className="text-[10px] text-gray-500">{new Date(note.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-gray-400">{note.content}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addNote()}
                    placeholder="Add a note..."
                    className="flex-1 px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                    data-testid="ticket-note-input"
                  />
                  <button onClick={addNote} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-500 transition-colors" data-testid="add-note-btn">Add</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Ticket Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="new-ticket-modal">
          <div className="bg-[#111827] border border-gray-700/60 rounded-2xl w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Create Ticket</h3>
                <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-300"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <input value={form.subject} onChange={(e) => setForm({...form, subject: e.target.value})} placeholder="Subject *" className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50" data-testid="new-ticket-subject" required />
                <textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} placeholder="Description" rows={4} className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none" data-testid="new-ticket-desc" />
                <div className="grid grid-cols-2 gap-4">
                  <select value={form.priority} onChange={(e) => setForm({...form, priority: e.target.value})} className="px-4 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-violet-500/50" data-testid="new-ticket-priority">
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="critical">Critical</option>
                  </select>
                  <select value={form.category} onChange={(e) => setForm({...form, category: e.target.value})} className="px-4 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-violet-500/50" data-testid="new-ticket-category">
                    <option value="general">General</option>
                    <option value="billing">Billing</option>
                    <option value="technical">Technical</option>
                    <option value="feature_request">Feature Request</option>
                    <option value="complaint">Complaint</option>
                  </select>
                </div>
                <button onClick={createTicket} className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl text-sm font-medium hover:from-violet-500 hover:to-fuchsia-500 transition-all shadow-lg shadow-violet-500/20" data-testid="submit-ticket-btn">Create Ticket</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
