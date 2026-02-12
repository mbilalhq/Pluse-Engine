import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import {
  Settings, Shield, Users, Bell, Palette, Key, Globe, Bot,
  Save, Plus, X, Trash2, Eye, EyeOff, Check, AlertCircle,
  MessageSquare, Package, HelpCircle, Database
} from 'lucide-react';

const CHANNEL_CONFIG = {
  whatsapp: { label: 'WhatsApp Business', color: 'emerald', fields: ['phone_number_id', 'access_token'] },
  instagram: { label: 'Instagram', color: 'pink', fields: ['page_id', 'access_token'] },
  facebook: { label: 'Facebook Messenger', color: 'blue', fields: ['page_id', 'access_token'] },
  twitter: { label: 'Twitter / X', color: 'sky', fields: ['api_key', 'api_secret', 'access_token'] },
  web_chat: { label: 'Web Chat Widget', color: 'violet', fields: [] },
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('channels');
  const [channels, setChannels] = useState([]);
  const [company, setCompany] = useState(null);
  const [users, setUsers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [showKeyMap, setShowKeyMap] = useState({});
  const [saving, setSaving] = useState('');
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: '', content: '', category: 'general', channel: 'all' });
  const [products, setProducts] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showFaqForm, setShowFaqForm] = useState(false);
  const [productForm, setProductForm] = useState({ name: '', description: '', price: '', category: 'general' });
  const [faqForm, setFaqForm] = useState({ question: '', answer: '', category: 'general' });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [ch, co, us, tm, pr, fq] = await Promise.all([
        api.get('/settings/channels'),
        api.get('/settings/company'),
        api.get('/users'),
        api.get('/settings/templates'),
        api.get('/company-data/products').catch(() => ({ data: [] })),
        api.get('/company-data/faqs').catch(() => ({ data: [] })),
      ]);
      setChannels(ch.data);
      setCompany(co.data);
      setUsers(us.data);
      setTemplates(tm.data);
      setProducts(pr.data);
      setFaqs(fq.data);
    } catch (err) { console.error(err); }
  };

  const saveChannel = async (channel) => {
    setSaving(channel.channel);
    try {
      await api.put(`/settings/channels/${channel.channel}`, channel);
      setSaving('');
    } catch (err) { console.error(err); setSaving(''); }
  };

  const updateChannelField = (channelName, field, value) => {
    setChannels(prev => prev.map(ch =>
      ch.channel === channelName ? { ...ch, [field]: value } : ch
    ));
  };

  const saveCompany = async () => {
    setSaving('company');
    try {
      await api.put('/settings/company', company);
      setSaving('');
    } catch (err) { console.error(err); setSaving(''); }
  };

  const createTemplate = async () => {
    try {
      await api.post('/settings/templates', templateForm);
      setShowTemplateForm(false);
      setTemplateForm({ name: '', content: '', category: 'general', channel: 'all' });
      const res = await api.get('/settings/templates');
      setTemplates(res.data);
    } catch (err) { console.error(err); }
  };

  const deleteTemplate = async (id) => {
    try {
      await api.delete(`/settings/templates/${id}`);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err) { console.error(err); }
  };

  const tabs = [
    { id: 'channels', label: 'Channels', icon: MessageSquare },
    { id: 'company-data', label: 'Company Data', icon: Database },
    { id: 'company', label: 'Company', icon: Globe },
    { id: 'ai', label: 'AI Config', icon: Bot },
    { id: 'templates', label: 'Templates', icon: MessageSquare },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  const createProduct = async () => {
    try { await api.post('/company-data/products', productForm); setShowProductForm(false); setProductForm({ name: '', description: '', price: '', category: 'general' }); const r = await api.get('/company-data/products'); setProducts(r.data); } catch (err) { console.error(err); }
  };
  const deleteProduct = async (id) => { try { await api.delete(`/company-data/products/${id}`); setProducts(prev => prev.filter(p => p.id !== id)); } catch (err) { console.error(err); } };
  const createFaq = async () => {
    try { await api.post('/company-data/faqs', faqForm); setShowFaqForm(false); setFaqForm({ question: '', answer: '', category: 'general' }); const r = await api.get('/company-data/faqs'); setFaqs(r.data); } catch (err) { console.error(err); }
  };
  const deleteFaq = async (id) => { try { await api.delete(`/company-data/faqs/${id}`); setFaqs(prev => prev.filter(f => f.id !== id)); } catch (err) { console.error(err); } };

  return (
    <div className="p-6 lg:p-8" data-testid="settings-page">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Settings</h1>

      <div className="flex gap-8">
        {/* Tab Nav */}
        <div className="w-48 flex-shrink-0 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
              data-testid={`settings-tab-${tab.id}`}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Channels Tab */}
          {activeTab === 'channels' && (
            <div className="space-y-6" data-testid="channels-settings">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-1">Social Media Channels</h2>
                <p className="text-sm text-slate-400">Configure your social media integrations and API keys</p>
              </div>
              {channels.map((channel) => {
                const config = CHANNEL_CONFIG[channel.channel] || { label: channel.channel, color: 'gray', fields: [] };
                const showKeys = showKeyMap[channel.channel] || false;
                return (
                  <div key={channel.channel} className="bg-white border border-slate-100 rounded-xl p-6" data-testid={`channel-config-${channel.channel}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg bg-${config.color}-500/20 flex items-center justify-center`}>
                          <MessageSquare size={18} className={`text-${config.color}-400`} />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">{config.label}</h3>
                          <p className="text-xs text-slate-400">{channel.enabled ? 'Active' : 'Inactive'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => updateChannelField(channel.channel, 'enabled', !channel.enabled)}
                          className={`relative w-11 h-6 rounded-full transition-colors ${channel.enabled ? 'bg-blue-600' : 'bg-gray-700'}`}
                          data-testid={`toggle-${channel.channel}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${channel.enabled ? 'translate-x-5' : ''}`}></span>
                        </button>
                      </div>
                    </div>

                    {channel.channel !== 'web_chat' && (
                      <div className="space-y-3">
                        {channel.channel === 'whatsapp' && (
                          <>
                            <div>
                              <label className="text-xs text-slate-400 mb-1 block">Phone Number ID</label>
                              <input
                                value={channel.phone_number_id || ''}
                                onChange={(e) => updateChannelField(channel.channel, 'phone_number_id', e.target.value)}
                                placeholder="Enter WhatsApp Phone Number ID"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                                data-testid={`${channel.channel}-phone-id`}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-400 mb-1 block">Access Token</label>
                              <div className="relative">
                                <input
                                  type={showKeys ? 'text' : 'password'}
                                  value={channel.access_token || ''}
                                  onChange={(e) => updateChannelField(channel.channel, 'access_token', e.target.value)}
                                  placeholder="Enter Access Token"
                                  className="w-full px-3 py-2 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/20 font-mono"
                                  data-testid={`${channel.channel}-access-token`}
                                />
                                <button onClick={() => setShowKeyMap({...showKeyMap, [channel.channel]: !showKeys})} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                  {showKeys ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                              </div>
                            </div>
                          </>
                        )}

                        {(channel.channel === 'instagram' || channel.channel === 'facebook') && (
                          <>
                            <div>
                              <label className="text-xs text-slate-400 mb-1 block">Page ID</label>
                              <input
                                value={channel.page_id || ''}
                                onChange={(e) => updateChannelField(channel.channel, 'page_id', e.target.value)}
                                placeholder={`Enter ${config.label} Page ID`}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                                data-testid={`${channel.channel}-page-id`}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-400 mb-1 block">Access Token</label>
                              <div className="relative">
                                <input
                                  type={showKeys ? 'text' : 'password'}
                                  value={channel.access_token || ''}
                                  onChange={(e) => updateChannelField(channel.channel, 'access_token', e.target.value)}
                                  placeholder="Enter Access Token"
                                  className="w-full px-3 py-2 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/20 font-mono"
                                  data-testid={`${channel.channel}-access-token`}
                                />
                                <button onClick={() => setShowKeyMap({...showKeyMap, [channel.channel]: !showKeys})} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                  {showKeys ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                              </div>
                            </div>
                          </>
                        )}

                        {channel.channel === 'twitter' && (
                          <>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-slate-400 mb-1 block">API Key</label>
                                <input
                                  value={channel.api_key || ''}
                                  onChange={(e) => updateChannelField(channel.channel, 'api_key', e.target.value)}
                                  placeholder="API Key"
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/20 font-mono"
                                  data-testid={`${channel.channel}-api-key`}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-400 mb-1 block">API Secret</label>
                                <input
                                  type={showKeys ? 'text' : 'password'}
                                  value={channel.api_secret || ''}
                                  onChange={(e) => updateChannelField(channel.channel, 'api_secret', e.target.value)}
                                  placeholder="API Secret"
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/20 font-mono"
                                  data-testid={`${channel.channel}-api-secret`}
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs text-slate-400 mb-1 block">Access Token</label>
                              <input
                                type={showKeys ? 'text' : 'password'}
                                value={channel.access_token || ''}
                                onChange={(e) => updateChannelField(channel.channel, 'access_token', e.target.value)}
                                placeholder="Access Token"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/20 font-mono"
                                data-testid={`${channel.channel}-access-token`}
                              />
                            </div>
                          </>
                        )}

                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">Webhook URL</label>
                          <input
                            value={channel.webhook_url || ''}
                            onChange={(e) => updateChannelField(channel.channel, 'webhook_url', e.target.value)}
                            placeholder="https://your-domain.com/api/webhooks/..."
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/20 font-mono"
                            data-testid={`${channel.channel}-webhook-url`}
                          />
                        </div>

                        <button
                          onClick={() => saveChannel(channel)}
                          disabled={saving === channel.channel}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-slate-900 rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-50"
                          data-testid={`save-${channel.channel}-btn`}
                        >
                          {saving === channel.channel ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Save size={14} />}
                          Save
                        </button>
                      </div>
                    )}

                    {channel.channel === 'web_chat' && (
                      <div className="bg-slate-50 rounded-lg p-4">
                        <p className="text-xs text-slate-500 mb-2">Web Chat is enabled by default. Customize appearance in the widget settings.</p>
                        <div className="flex items-center gap-2">
                          <Check size={14} className="text-emerald-600" />
                          <span className="text-xs text-emerald-600">Ready to use</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Company Tab */}
          {activeTab === 'company' && company && (
            <div className="space-y-6" data-testid="company-settings">
              <h2 className="text-lg font-semibold text-slate-900">Company Settings</h2>
              <div className="bg-white border border-slate-100 rounded-xl p-6 space-y-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Company Name</label>
                  <input value={company.company_name || ''} onChange={(e) => setCompany({...company, company_name: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/20" data-testid="company-name-input" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Timezone</label>
                    <select value={company.timezone || 'UTC'} onChange={(e) => setCompany({...company, timezone: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/20" data-testid="timezone-select">
                      {['UTC', 'US/Eastern', 'US/Pacific', 'Europe/London', 'Asia/Tokyo', 'Asia/Kolkata'].map(tz => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Language</label>
                    <select value={company.language || 'en'} onChange={(e) => setCompany({...company, language: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/20" data-testid="language-select">
                      {['en', 'es', 'fr', 'de', 'pt', 'ja', 'ko', 'zh'].map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={saveCompany} disabled={saving === 'company'} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-slate-900 rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-50" data-testid="save-company-btn">
                  <Save size={14} /> Save
                </button>
              </div>
            </div>
          )}

          {/* AI Config Tab */}
          {activeTab === 'ai' && company && (
            <div className="space-y-6" data-testid="ai-settings">
              <h2 className="text-lg font-semibold text-slate-900">AI Configuration</h2>
              <div className="bg-white border border-slate-100 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-slate-900">Enable AI Responses</h3>
                    <p className="text-xs text-slate-400">Allow AI to automatically respond to customer messages</p>
                  </div>
                  <button
                    onClick={() => setCompany({...company, ai_enabled: !company.ai_enabled})}
                    className={`relative w-11 h-6 rounded-full transition-colors ${company.ai_enabled ? 'bg-blue-600' : 'bg-gray-700'}`}
                    data-testid="toggle-ai"
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${company.ai_enabled ? 'translate-x-5' : ''}`}></span>
                  </button>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-2 block">AI Confidence Threshold: {(company.ai_confidence_threshold * 100).toFixed(0)}%</label>
                  <input
                    type="range"
                    min="0.1" max="1" step="0.05"
                    value={company.ai_confidence_threshold || 0.7}
                    onChange={(e) => setCompany({...company, ai_confidence_threshold: parseFloat(e.target.value)})}
                    className="w-full accent-violet-600"
                    data-testid="ai-confidence-slider"
                  />
                  <div className="flex justify-between text-[10px] text-slate-300">
                    <span>More AI responses</span>
                    <span>More human handoff</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-slate-900">Auto-assign Conversations</h3>
                    <p className="text-xs text-slate-400">Automatically assign escalated conversations to available agents</p>
                  </div>
                  <button
                    onClick={() => setCompany({...company, auto_assign: !company.auto_assign})}
                    className={`relative w-11 h-6 rounded-full transition-colors ${company.auto_assign ? 'bg-blue-600' : 'bg-gray-700'}`}
                    data-testid="toggle-auto-assign"
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${company.auto_assign ? 'translate-x-5' : ''}`}></span>
                  </button>
                </div>
                <button onClick={saveCompany} disabled={saving === 'company'} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-slate-900 rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-50" data-testid="save-ai-config-btn">
                  <Save size={14} /> Save
                </button>
              </div>
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div className="space-y-6" data-testid="templates-settings">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Response Templates</h2>
                <button onClick={() => setShowTemplateForm(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-slate-900 rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors" data-testid="add-template-btn">
                  <Plus size={14} /> New Template
                </button>
              </div>
              <div className="space-y-3">
                {templates.map(tmpl => (
                  <div key={tmpl.id} className="bg-white border border-slate-100 rounded-xl p-4 flex items-start justify-between" data-testid={`template-${tmpl.id}`}>
                    <div>
                      <h4 className="text-sm font-medium text-slate-700">{tmpl.name}</h4>
                      <p className="text-xs text-slate-400 mt-1">{tmpl.content}</p>
                      <div className="flex gap-2 mt-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">{tmpl.category}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">{tmpl.channel}</span>
                      </div>
                    </div>
                    <button onClick={() => deleteTemplate(tmpl.id)} className="text-slate-400 hover:text-red-500 p-1" data-testid={`delete-template-${tmpl.id}`}><Trash2 size={14} /></button>
                  </div>
                ))}
                {templates.length === 0 && <p className="text-center text-slate-400 text-sm py-8">No templates yet</p>}
              </div>
              {showTemplateForm && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-bold text-slate-900">New Template</h3>
                      <button onClick={() => setShowTemplateForm(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                    </div>
                    <div className="space-y-4">
                      <input value={templateForm.name} onChange={(e) => setTemplateForm({...templateForm, name: e.target.value})} placeholder="Template Name" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/20" data-testid="template-name-input" />
                      <textarea value={templateForm.content} onChange={(e) => setTemplateForm({...templateForm, content: e.target.value})} placeholder="Template content..." rows={4} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/20 resize-none" data-testid="template-content-input" />
                      <button onClick={createTemplate} className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-slate-900 rounded-xl text-sm font-medium" data-testid="save-template-btn">Create Template</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-6" data-testid="users-settings">
              <h2 className="text-lg font-semibold text-slate-900">Team Members</h2>
              <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left text-xs text-slate-400 font-medium px-6 py-3">User</th>
                      <th className="text-left text-xs text-slate-400 font-medium px-4 py-3">Role</th>
                      <th className="text-left text-xs text-slate-400 font-medium px-4 py-3">Status</th>
                      <th className="text-left text-xs text-slate-400 font-medium px-4 py-3">Last Login</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-xs font-bold text-blue-600">{u.name?.charAt(0)}</div>
                            <div>
                              <p className="text-sm text-slate-700">{u.name}</p>
                              <p className="text-xs text-slate-400">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500 capitalize">{u.role}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded ${u.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-700 text-slate-400'}`}>{u.status}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6" data-testid="security-settings">
              <h2 className="text-lg font-semibold text-slate-900">Security</h2>
              <div className="bg-white border border-slate-100 rounded-xl p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-slate-900">Two-Factor Authentication</h3>
                    <p className="text-xs text-slate-400">Add an extra layer of security</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-600">Coming Soon</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-slate-900">Session Management</h3>
                    <p className="text-xs text-slate-400">Manage active sessions and devices</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-600">Coming Soon</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-slate-900">API Keys</h3>
                    <p className="text-xs text-slate-400">Manage API access keys for integrations</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-600">Coming Soon</span>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Shield size={16} className="text-emerald-600 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-emerald-600">Security Status: Good</h4>
                      <p className="text-xs text-slate-400 mt-1">All communications are encrypted with TLS 1.3. JWT tokens expire after 8 hours.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Company Data Tab */}
          {activeTab === 'company-data' && (
            <div className="space-y-6" data-testid="company-data-settings">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-1">Company Products & FAQs</h2>
                <p className="text-sm text-slate-400">This data feeds into the AI to provide accurate, personalized responses to your customers.</p>
              </div>

              {/* Products Section */}
              <div className="bg-white border border-slate-100 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Package size={16} className="text-blue-600" />
                    <h3 className="text-sm font-semibold text-slate-900">Products & Services ({products.length})</h3>
                  </div>
                  <button onClick={() => setShowProductForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors" data-testid="add-product-btn">
                    <Plus size={12} /> Add Product
                  </button>
                </div>
                <div className="space-y-2">
                  {products.map(p => (
                    <div key={p.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg border border-slate-100" data-testid={`product-${p.id}`}>
                      <div>
                        <h4 className="text-sm font-medium text-slate-800">{p.name}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{p.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {p.price && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 border border-green-200 font-medium">{p.price}</span>}
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{p.category}</span>
                        </div>
                      </div>
                      <button onClick={() => deleteProduct(p.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {products.length === 0 && <p className="text-center text-slate-400 text-sm py-4">No products added yet. Add products so AI can answer customer queries accurately.</p>}
                </div>
              </div>

              {/* FAQs Section */}
              <div className="bg-white border border-slate-100 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <HelpCircle size={16} className="text-blue-600" />
                    <h3 className="text-sm font-semibold text-slate-900">FAQs ({faqs.length})</h3>
                  </div>
                  <button onClick={() => setShowFaqForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors" data-testid="add-faq-btn">
                    <Plus size={12} /> Add FAQ
                  </button>
                </div>
                <div className="space-y-2">
                  {faqs.map(f => (
                    <div key={f.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg border border-slate-100" data-testid={`faq-${f.id}`}>
                      <div>
                        <h4 className="text-sm font-medium text-slate-800">Q: {f.question}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">A: {f.answer}</p>
                      </div>
                      <button onClick={() => deleteFaq(f.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {faqs.length === 0 && <p className="text-center text-slate-400 text-sm py-4">No FAQs added yet. Add FAQs so AI can instantly answer common questions.</p>}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Bot size={16} className="text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-800">How this works</h4>
                    <p className="text-xs text-blue-600 mt-1 leading-relaxed">Products and FAQs you add here are automatically used by the AI when responding to customer messages. The AI references this data to provide accurate, brand-consistent answers about your products, pricing, features, and policies.</p>
                  </div>
                </div>
              </div>

              {/* Product Form Modal */}
              {showProductForm && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6">
                    <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-slate-900">Add Product</h3><button onClick={() => setShowProductForm(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button></div>
                    <div className="space-y-3">
                      <input value={productForm.name} onChange={(e) => setProductForm({...productForm, name: e.target.value})} placeholder="Product Name *" className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" data-testid="product-name-input" required />
                      <textarea value={productForm.description} onChange={(e) => setProductForm({...productForm, description: e.target.value})} placeholder="Description - what does this product do?" rows={3} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none" data-testid="product-desc-input" />
                      <div className="grid grid-cols-2 gap-3">
                        <input value={productForm.price} onChange={(e) => setProductForm({...productForm, price: e.target.value})} placeholder="Price (e.g. $99/mo)" className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" data-testid="product-price-input" />
                        <select value={productForm.category} onChange={(e) => setProductForm({...productForm, category: e.target.value})} className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                          <option value="general">General</option><option value="software">Software</option><option value="service">Service</option><option value="subscription">Subscription</option><option value="hardware">Hardware</option>
                        </select>
                      </div>
                      <button onClick={createProduct} className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700" data-testid="save-product-btn">Add Product</button>
                    </div>
                  </div>
                </div>
              )}

              {/* FAQ Form Modal */}
              {showFaqForm && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6">
                    <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-slate-900">Add FAQ</h3><button onClick={() => setShowFaqForm(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button></div>
                    <div className="space-y-3">
                      <input value={faqForm.question} onChange={(e) => setFaqForm({...faqForm, question: e.target.value})} placeholder="Question *" className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" data-testid="faq-question-input" required />
                      <textarea value={faqForm.answer} onChange={(e) => setFaqForm({...faqForm, answer: e.target.value})} placeholder="Answer *" rows={3} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none" data-testid="faq-answer-input" required />
                      <button onClick={createFaq} className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700" data-testid="save-faq-btn">Add FAQ</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
