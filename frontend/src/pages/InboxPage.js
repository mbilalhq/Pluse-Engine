import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import io from 'socket.io-client';
import {
  Send, Bot, Search, Sparkles, Phone, Mail, Tag,
  MessageSquare, Smile, Frown, Meh, UserCircle, X,
  Maximize2, Minimize2, ArrowLeft
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const CHANNELS = [
  { key: 'whatsapp', label: 'WhatsApp', color: 'bg-emerald-500', lightBg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  { key: 'facebook', label: 'Facebook', color: 'bg-blue-500', lightBg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  { key: 'instagram', label: 'Instagram', color: 'bg-pink-500', lightBg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-200' },
  { key: 'web_chat', label: 'Website', color: 'bg-violet-500', lightBg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200' },
];

const TAG_COLORS = {
  pricing: 'bg-amber-50 text-amber-600 border-amber-200',
  sales: 'bg-green-50 text-green-600 border-green-200',
  vip: 'bg-purple-50 text-purple-600 border-purple-200',
  support: 'bg-blue-50 text-blue-600 border-blue-200',
  billing: 'bg-red-50 text-red-600 border-red-200',
  complaint: 'bg-red-50 text-red-600 border-red-200',
  technical: 'bg-cyan-50 text-cyan-600 border-cyan-200',
  api: 'bg-slate-100 text-slate-600 border-slate-200',
  'feature-request': 'bg-indigo-50 text-indigo-600 border-indigo-200',
};

function getTagColor(tag) { return TAG_COLORS[tag] || 'bg-slate-50 text-slate-500 border-slate-200'; }

export default function InboxPage() {
  const [conversations, setConversations] = useState([]);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [maximized, setMaximized] = useState(false);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  // Socket.io connection
  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'], withCredentials: true });
    socketRef.current = socket;

    socket.on('connect', () => {
      const user = JSON.parse(localStorage.getItem('pe_user') || '{}');
      if (user.id) socket.emit('join', { user_id: user.id });
    });

    socket.on('new_message', (data) => {
      if (data.conversation_id && data.message) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev;
          if (prev.length > 0 && prev[0]?.conversation_id === data.conversation_id) {
            return [...prev, data.message];
          }
          return prev;
        });
      }
    });

    socket.on('conversation_updated', () => { loadConversations(); });

    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => { loadConversations(); }, []);

  useEffect(() => {
    if (selectedConvo) {
      loadMessages(selectedConvo.id);
      if (selectedConvo.customer_id) {
        api.get(`/customers/${selectedConvo.customer_id}`).then(r => setCustomerInfo(r.data)).catch(() => {});
      }
      // Join socket room
      if (socketRef.current) {
        socketRef.current.emit('join_conversation', { conversation_id: selectedConvo.id });
      }
    }
    return () => {
      if (selectedConvo && socketRef.current) {
        socketRef.current.emit('leave_conversation', { conversation_id: selectedConvo.id });
      }
    };
  }, [selectedConvo?.id]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadConversations = async () => {
    try { const res = await api.get('/conversations'); setConversations(res.data); }
    catch (err) { console.error(err); }
  };

  const loadMessages = async (convoId) => {
    try { const res = await api.get(`/conversations/${convoId}/messages`); setMessages(res.data); }
    catch (err) { console.error(err); }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConvo || sending) return;
    setSending(true);
    try {
      const res = await api.post(`/conversations/${selectedConvo.id}/messages`, { content: newMessage, sender_type: 'agent' });
      setMessages(prev => [...prev, res.data.message]);
      if (res.data.ai_response) setMessages(prev => [...prev, res.data.ai_response]);
      setNewMessage('');
      loadConversations();
    } catch (err) { console.error(err); }
    finally { setSending(false); }
  };

  const triggerAI = async () => {
    if (!selectedConvo || aiLoading) return;
    setAiLoading(true);
    try {
      const res = await api.post(`/conversations/${selectedConvo.id}/ai-respond`);
      setMessages(prev => [...prev, res.data]);
      loadConversations();
    } catch (err) { console.error(err); }
    finally { setAiLoading(false); }
  };

  const handleSelectConvo = (convo) => {
    setSelectedConvo(convo);
    setMaximized(true); // Auto-maximize on click
  };

  const handleBack = () => {
    setMaximized(false);
    setSelectedConvo(null);
    setCustomerInfo(null);
  };

  const grouped = {};
  CHANNELS.forEach(ch => { grouped[ch.key] = []; });
  conversations.forEach(c => {
    if (grouped[c.channel]) grouped[c.channel].push(c);
    else if (grouped.web_chat) grouped.web_chat.push(c);
  });

  const chInfo = selectedConvo ? CHANNELS.find(c => c.key === selectedConvo.channel) || CHANNELS[3] : null;

  return (
    <div className="flex h-[calc(100vh-3.5rem)]" data-testid="inbox-page">
      {/* Left: Channel Columns (hidden when maximized) */}
      {!maximized && (
        <div className="flex-1 overflow-x-auto border-r border-slate-100 bg-slate-50">
          <div className="flex h-full min-w-[800px]" data-testid="channel-columns">
            {CHANNELS.map((ch) => {
              const items = grouped[ch.key] || [];
              return (
                <div key={ch.key} className="flex-1 flex flex-col border-r border-slate-100 last:border-r-0 min-w-[200px]" data-testid={`channel-col-${ch.key}`}>
                  <div className="px-4 py-3 border-b border-slate-100 bg-white flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${ch.color}`}></div>
                    <span className="text-[13px] font-semibold text-slate-800">{ch.label}</span>
                    <span className="ml-auto text-[11px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{items.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {items.map(convo => (
                      <div
                        key={convo.id}
                        onClick={() => handleSelectConvo(convo)}
                        className="bg-white rounded-xl p-3.5 border border-slate-100 cursor-pointer transition-all duration-150 hover:shadow-md hover:border-slate-200"
                        data-testid={`convo-card-${convo.id}`}
                      >
                        <div className="flex items-start gap-2.5 mb-2">
                          <div className={`w-8 h-8 rounded-full ${ch.lightBg} flex items-center justify-center text-xs font-bold ${ch.text} flex-shrink-0`}>
                            {convo.customer_name?.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-[13px] font-semibold text-slate-800 truncate">{convo.customer_name}</span>
                              {convo.unread_count > 0 && <span className="min-w-[18px] h-[18px] rounded-full bg-blue-500 text-[9px] font-bold text-white flex items-center justify-center">{convo.unread_count}</span>}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">{new Date(convo.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 mb-2 leading-relaxed">{convo.last_message}</p>
                        <div className="flex flex-wrap gap-1">
                          {(convo.tags || []).slice(0, 3).map(tag => (
                            <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded-md border font-medium ${getTagColor(tag)}`}>{tag}</span>
                          ))}
                          {convo.ai_handled && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-600 border border-purple-200 font-medium">AI</span>}
                        </div>
                      </div>
                    ))}
                    {items.length === 0 && (
                      <div className="text-center py-8 text-slate-300">
                        <MessageSquare size={24} className="mx-auto mb-2 opacity-40" />
                        <p className="text-xs">No conversations</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Maximized Message View */}
      {maximized && selectedConvo && (
        <div className="flex-1 flex min-w-0 bg-white" data-testid="maximized-view">
          {/* Message Thread */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <div className="h-14 px-5 flex items-center justify-between border-b border-slate-100 bg-white">
              <div className="flex items-center gap-3">
                <button onClick={handleBack} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors" data-testid="back-to-inbox-btn">
                  <ArrowLeft size={18} />
                </button>
                <div className={`w-10 h-10 rounded-full ${chInfo?.lightBg || 'bg-slate-100'} flex items-center justify-center text-sm font-bold ${chInfo?.text || 'text-slate-600'}`}>
                  {selectedConvo.customer_name?.charAt(0)}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{selectedConvo.customer_name}</h3>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${chInfo?.lightBg} ${chInfo?.text} font-medium`}>{chInfo?.label}</span>
                    <span className="text-[11px] text-slate-400">{selectedConvo.subject}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium border ${selectedConvo.sentiment_score > 0.3 ? 'bg-green-50 text-green-600 border-green-200' : selectedConvo.sentiment_score < -0.3 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                  {selectedConvo.sentiment_label}
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${selectedConvo.status === 'open' ? 'bg-green-50 text-green-600' : selectedConvo.status === 'escalated' ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-500'}`}>
                  {selectedConvo.status}
                </span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-slate-50/50" data-testid="message-thread">
              {messages.map((msg) => {
                const isCustomer = msg.sender_type === 'customer';
                const isAI = msg.sender_type === 'ai';
                return (
                  <div key={msg.id} className={`flex ${isCustomer ? 'justify-start' : 'justify-end'} animate-fadeIn`} data-testid={`msg-${msg.id}`}>
                    <div className="max-w-[65%]">
                      <div className={`flex items-center gap-1.5 mb-1 ${isCustomer ? '' : 'justify-end'}`}>
                        <span className="text-[10px] text-slate-400 font-medium">{msg.sender_name}</span>
                        <span className="text-[10px] text-slate-300">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {isAI && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-500 font-medium">AI {msg.ai_confidence ? `${Math.round(msg.ai_confidence * 100)}%` : ''}</span>}
                      </div>
                      <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                        isCustomer ? 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm' :
                        isAI ? 'bg-purple-50 text-slate-700 border border-purple-100 rounded-br-sm' :
                        'bg-blue-600 text-white rounded-br-sm shadow-sm'
                      }`}>
                        {isAI && <Sparkles size={12} className="inline-block text-purple-400 mr-1" />}
                        {msg.content}
                      </div>
                      {msg.sentiment && (
                        <div className="mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${msg.sentiment.score > 0.3 ? 'bg-emerald-50 text-emerald-600' : msg.sentiment.score < -0.3 ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-500'}`}>
                            {msg.sentiment.emotion} ({msg.sentiment.score?.toFixed(1)})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Compose */}
            <div className="px-5 py-3 border-t border-slate-100 bg-white">
              <div className="flex items-center gap-2">
                <button onClick={triggerAI} disabled={aiLoading} className="p-2.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-500 hover:bg-purple-100 transition-colors disabled:opacity-50" data-testid="ai-respond-btn">
                  {aiLoading ? <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div> : <Sparkles size={16} />}
                </button>
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  data-testid="message-input"
                />
                <button onClick={sendMessage} disabled={!newMessage.trim() || sending} className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm" data-testid="send-message-btn">
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Customer Sidebar */}
          {customerInfo && (
            <div className="w-72 flex-shrink-0 border-l border-slate-100 bg-white overflow-y-auto" data-testid="customer-sidebar">
              <div className="p-5">
                <div className="text-center mb-5">
                  <div className={`w-14 h-14 rounded-full ${chInfo?.lightBg || 'bg-blue-50'} mx-auto flex items-center justify-center text-lg font-bold ${chInfo?.text || 'text-blue-600'} mb-2`}>
                    {customerInfo.name?.charAt(0)}
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900">{customerInfo.name}</h4>
                  <p className="text-[11px] text-slate-400">{customerInfo.company}</p>
                  <span className={`inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full font-medium border capitalize ${customerInfo.segment === 'vip' ? 'bg-amber-50 text-amber-600 border-amber-200' : customerInfo.segment === 'enterprise' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                    {customerInfo.segment}
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    {customerInfo.email && <p className="text-xs text-slate-600 flex items-center gap-2"><Mail size={12} className="text-slate-400" /> {customerInfo.email}</p>}
                    {customerInfo.phone && <p className="text-xs text-slate-600 flex items-center gap-2"><Phone size={12} className="text-slate-400" /> {customerInfo.phone}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                      <p className="text-base font-bold text-slate-900">{customerInfo.total_conversations}</p>
                      <p className="text-[10px] text-slate-400">Convos</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                      <p className="text-base font-bold text-slate-900">${((customerInfo.lifetime_value || 0) / 1000).toFixed(0)}k</p>
                      <p className="text-[10px] text-slate-400">LTV</p>
                    </div>
                  </div>

                  {customerInfo.churn_risk && (
                    <div className={`p-3 rounded-lg border ${customerInfo.churn_risk.risk_level === 'critical' || customerInfo.churn_risk.risk_level === 'high' ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-medium text-slate-600 capitalize">Churn: {customerInfo.churn_risk.risk_level}</span>
                        <span className="text-[11px] font-bold text-slate-800">{Math.round(customerInfo.churn_risk.risk_score * 100)}%</span>
                      </div>
                      <div className="h-1.5 bg-white rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${customerInfo.churn_risk.risk_score > 0.7 ? 'bg-red-500' : customerInfo.churn_risk.risk_score > 0.3 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${customerInfo.churn_risk.risk_score * 100}%` }}></div>
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {(customerInfo.tags || []).map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200"><Tag size={8} className="inline mr-0.5" />{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
