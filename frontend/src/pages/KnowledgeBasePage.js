import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { BookOpen, Search, Plus, X, Eye, Edit3, Trash2, Tag, User, Calendar } from 'lucide-react';

export default function KnowledgeBasePage() {
  const [docs, setDocs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [form, setForm] = useState({ title: '', content: '', category: 'general', tags: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadDocs(); }, [search, filterCategory]);

  const loadDocs = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (filterCategory) params.category = filterCategory;
      const res = await api.get('/knowledge-base', { params });
      setDocs(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const createDoc = async () => {
    try {
      const payload = { ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) };
      if (editMode && selected) {
        await api.put(`/knowledge-base/${selected.id}`, payload);
      } else {
        await api.post('/knowledge-base', payload);
      }
      setShowForm(false);
      setEditMode(false);
      setForm({ title: '', content: '', category: 'general', tags: '' });
      loadDocs();
    } catch (err) { console.error(err); }
  };

  const deleteDoc = async (docId) => {
    try {
      await api.delete(`/knowledge-base/${docId}`);
      if (selected?.id === docId) setSelected(null);
      loadDocs();
    } catch (err) { console.error(err); }
  };

  const startEdit = (doc) => {
    setForm({ title: doc.title, content: doc.content, category: doc.category, tags: (doc.tags || []).join(', ') });
    setSelected(doc);
    setEditMode(true);
    setShowForm(true);
  };

  const categories = ['getting_started', 'integration', 'ai', 'sales', 'general', 'troubleshooting'];

  return (
    <div className="p-6 lg:p-8 space-y-6" data-testid="knowledge-base-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Knowledge Base</h1>
          <p className="text-gray-500 text-sm mt-1">{docs.length} articles</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditMode(false); setForm({ title: '', content: '', category: 'general', tags: '' }); }} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl text-sm font-medium hover:from-violet-500 hover:to-fuchsia-500 transition-all shadow-lg shadow-violet-500/20" data-testid="add-kb-doc-btn">
          <Plus size={16} /> New Article
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search articles..." className="w-full pl-9 pr-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50" data-testid="kb-search" />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          <button onClick={() => setFilterCategory('')} className={`px-3 py-1.5 text-xs rounded-lg font-medium capitalize transition-colors whitespace-nowrap ${!filterCategory ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'text-gray-500 hover:text-gray-300 border border-gray-700/50'}`}>All</button>
          {categories.map(c => (
            <button key={c} onClick={() => setFilterCategory(c)} className={`px-3 py-1.5 text-xs rounded-lg font-medium capitalize transition-colors whitespace-nowrap ${filterCategory === c ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'text-gray-500 hover:text-gray-300 border border-gray-700/50'}`}>{c.replace('_', ' ')}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="kb-articles-grid">
        {docs.map((doc) => (
          <div key={doc.id} className="bg-[#111827] border border-gray-800/60 rounded-xl p-5 hover:border-violet-500/30 transition-all group" data-testid={`kb-doc-${doc.id}`}>
            <div className="flex items-start justify-between mb-3">
              <span className="text-[10px] px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 capitalize">{doc.category?.replace('_', ' ')}</span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => startEdit(doc)} className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-gray-300" data-testid={`edit-kb-${doc.id}`}><Edit3 size={14} /></button>
                <button onClick={() => deleteDoc(doc.id)} className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-red-400" data-testid={`delete-kb-${doc.id}`}><Trash2 size={14} /></button>
              </div>
            </div>
            <h4 className="text-sm font-semibold text-gray-200 mb-2 cursor-pointer hover:text-violet-400" onClick={() => setSelected(doc)}>{doc.title}</h4>
            <p className="text-xs text-gray-500 line-clamp-3 mb-3">{doc.content}</p>
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1">
                {(doc.tags || []).slice(0, 3).map(tag => (
                  <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">{tag}</span>
                ))}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-gray-600">
                <Eye size={10} /> {doc.views || 0}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Document Viewer */}
      {selected && !showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="kb-viewer-modal">
          <div className="bg-[#111827] border border-gray-700/60 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 capitalize">{selected.category?.replace('_', ' ')}</span>
                  <h3 className="text-xl font-bold text-white mt-2">{selected.title}</h3>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><User size={12} /> {selected.author_name}</span>
                    <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(selected.created_at).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1"><Eye size={12} /> {selected.views} views</span>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-300"><X size={20} /></button>
              </div>
              <div className="prose prose-invert max-w-none">
                <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{selected.content}</div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-6">
                {(selected.tags || []).map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700"><Tag size={10} className="inline mr-1" />{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="kb-form-modal">
          <div className="bg-[#111827] border border-gray-700/60 rounded-2xl w-full max-w-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">{editMode ? 'Edit Article' : 'New Article'}</h3>
                <button onClick={() => { setShowForm(false); setEditMode(false); }} className="text-gray-500 hover:text-gray-300"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <input value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} placeholder="Article Title *" className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50" data-testid="kb-form-title" required />
                <select value={form.category} onChange={(e) => setForm({...form, category: e.target.value})} className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-violet-500/50" data-testid="kb-form-category">
                  {categories.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                </select>
                <textarea value={form.content} onChange={(e) => setForm({...form, content: e.target.value})} placeholder="Article content..." rows={10} className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none" data-testid="kb-form-content" />
                <input value={form.tags} onChange={(e) => setForm({...form, tags: e.target.value})} placeholder="Tags (comma separated)" className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50" data-testid="kb-form-tags" />
                <button onClick={createDoc} className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl text-sm font-medium hover:from-violet-500 hover:to-fuchsia-500 transition-all shadow-lg shadow-violet-500/20" data-testid="kb-form-submit">{editMode ? 'Update Article' : 'Create Article'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
