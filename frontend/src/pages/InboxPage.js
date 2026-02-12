import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import {
  Send, Bot, Search, Sparkles, Phone, Mail, Tag,
  MessageSquare, Smile, Frown, Meh, UserCircle, X
} from 'lucide-react';

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
  escalated: 'bg-orange-50 text-orange-600 border-orange-200',
};

function getTagColor(tag) {
  return TAG_COLORS[tag] || 'bg-slate-50 text-slate-500 border-slate-200';
}

export default function InboxPage() {
  const [conversations, setConversations] = useState([]);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [customerInfo, setCustomerInfo] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => { loadConversations(); }, []);

  useEffect(() => {
    if (selectedConvo) {
      loadMessages(selectedConvo.id);
      if (selectedConvo.customer_id) {
        api.get(`/customers/${selectedConvo.customer_id}`).then(r => setCustomerInfo(r.data)).catch(() => {});
      }
    }
  }, [selectedConvo?.id]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadConversations = async () => {
    try {
      const res = await api.get('/conversations');
      setConversations(res.data);
    } catch (err) { console.error(err); }
  };

  const loadMessages = async (convoId) => {
    try {
      const res = await api.get(`/conversations/${convoId}/messages`);
      setMessages(res.data);
    } catch (err) { console.error(err); }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConvo || sending) return;
    setSending(true);
    try {
      const res = await api.post(`/conversations/${selectedConvo.id}/messages`, { content: newMessage, sender_type: 'agent' });
      setMessages(prev => [...prev, res.data.message]);
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

  // Group conversations by channel
  const grouped = {};
  CHANNELS.forEach(ch => { grouped[ch.key] = []; });
  conversations.forEach(c => {
    if (grouped[c.channel]) grouped[c.channel].push(c);
    else if (grouped.web_chat) grouped.web_chat.push(c);
  });

  return (
    <div className="flex h-[calc(100vh-3.5rem)]" data-testid="inbox-page">
      {/* Left: 4-Column Channel View */}
      <div className={`${selectedConvo ? 'w-[55%]' : 'flex-1'} flex-shrink-0 overflow-x-auto border-r border-slate-100 bg-slate-50`}>
        <div className="flex h-full min-w-[800px]" data-testid="channel-columns">
          {CHANNELS.map((ch) => {
            const items = grouped[ch.key] || [];
            return (
              <div key={ch.key} className="flex-1 flex flex-col border-r border-slate-100 last:border-r-0 min-w-[200px]" data-testid={`channel-col-${ch.key}`}>
                {/* Column Header */}
                <div className={`px-4 py-3 border-b border-slate-100 bg-white flex items-center gap-2`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${ch.color}`}></div>
                  <span className="text-[13px] font-semibold text-slate-800">{ch.label}</span>
                  <span className="ml-auto text-[11px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{items.length}</span>
                </div>
                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {items.map(convo => {
                    const isActive = selectedConvo?.id === convo.id;
                    return (
                      <div
                        key={convo.id}
                        onClick={() => setSelectedConvo(convo)}
                        className={`bg-white rounded-xl p-3.5 border cursor-pointer transition-all duration-150 hover:shadow-md ${isActive ? `${ch.border} shadow-md ring-1 ring-blue-100` : 'border-slate-100 hover:border-slate-200'}`}
                        data-testid={`convo-card-${convo.id}`}
                      >
                        <div className="flex items-start gap-2.5 mb-2">
                          <div className={`w-8 h-8 rounded-full ${ch.lightBg} flex items-center justify-center text-xs font-bold ${ch.text} flex-shrink-0`}>
                            {convo.customer_name?.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-[13px] font-semibold text-slate-800 truncate">{convo.customer_name}</span>
                              {convo.unread_count > 0 && (
                                <span className="w-4.5 h-4.5 min-w-[18px] rounded-full bg-blue-500 text-[9px] font-bold text-white flex items-center justify-center">{convo.unread_count}</span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {new Date(convo.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
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
                    );
                  })}
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

      {/* Right: Message Thread + Customer */}
      {selectedConvo && (
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          {/* Thread Header */}
          <div className="h-14 px-5 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full ${CHANNELS.find(c => c.key === selectedConvo.channel)?.lightBg || 'bg-slate-100'} flex items-center justify-center text-sm font-bold ${CHANNELS.find(c => c.key === selectedConvo.channel)?.text || 'text-slate-600'}`}>
                {selectedConvo.customer_name?.charAt(0)}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{selectedConvo.customer_name}</h3>
                <p className="text-[11px] text-slate-400">{selectedConvo.subject}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium border ${selectedConvo.sentiment_score > 0.3 ? 'bg-green-50 text-green-600 border-green-200' : selectedConvo.sentiment_score < -0.3 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                {selectedConvo.sentiment_label}
              </span>
              <button onClick={() => setSelectedConvo(null)} className="p-1 rounded hover:bg-slate-100 text-slate-400">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-slate-50/50" data-testid="message-thread">
            {messages.map((msg) => {
              const isCustomer = msg.sender_type === 'customer';
              const isAI = msg.sender_type === 'ai';
              return (
                <div key={msg.id} className={`flex ${isCustomer ? 'justify-start' : 'justify-end'}`} data-testid={`msg-${msg.id}`}>
                  <div className={`max-w-[75%]`}>
                    <div className={`flex items-center gap-1.5 mb-1 ${isCustomer ? '' : 'justify-end'}`}>
                      <span className="text-[10px] text-slate-400 font-medium">{msg.sender_name}</span>
                      <span className="text-[10px] text-slate-300">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {isAI && <span className="text-[10px] px-1 py-0.5 rounded bg-purple-50 text-purple-500 font-medium">AI</span>}
                    </div>
                    <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isCustomer ? 'bg-white border border-slate-200 text-slate-700 rounded-bl-md' :
                      isAI ? 'bg-purple-50 text-slate-700 border border-purple-100 rounded-br-md' :
                      'bg-blue-600 text-white rounded-br-md'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Compose */}
          <div className="px-5 py-3 border-t border-slate-100 bg-white">
            <div className="flex items-center gap-2">
              <button onClick={triggerAI} disabled={aiLoading} className="p-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-500 hover:bg-purple-100 transition-colors disabled:opacity-50" title="AI Response" data-testid="ai-respond-btn">
                {aiLoading ? <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div> : <Sparkles size={16} />}
              </button>
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                data-testid="message-input"
              />
              <button onClick={sendMessage} disabled={!newMessage.trim() || sending} className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm" data-testid="send-message-btn">
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
