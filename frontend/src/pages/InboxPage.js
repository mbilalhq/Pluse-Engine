import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import {
  Send, Bot, UserCircle, Search, Filter, Sparkles, Phone, Mail,
  Hash, MessageSquare, ChevronRight, Smile, Frown, Meh,
  MoreVertical, Tag, ArrowRightLeft, Clock
} from 'lucide-react';

const CHANNEL_ICONS = {
  whatsapp: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'WhatsApp' },
  instagram: { bg: 'bg-pink-500/20', text: 'text-pink-400', label: 'Instagram' },
  facebook: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Facebook' },
  web_chat: { bg: 'bg-violet-500/20', text: 'text-violet-400', label: 'Web Chat' },
  twitter: { bg: 'bg-sky-500/20', text: 'text-sky-400', label: 'Twitter/X' },
};

const SENTIMENT_ICONS = { happy: Smile, satisfied: Smile, neutral: Meh, frustrated: Frown, angry: Frown };

export default function InboxPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [sending, setSending] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [customerInfo, setCustomerInfo] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadConversations();
  }, [filterChannel, searchTerm]);

  useEffect(() => {
    if (selectedConvo) {
      loadMessages(selectedConvo.id);
      if (selectedConvo.customer_id) {
        api.get(`/customers/${selectedConvo.customer_id}`).then(r => setCustomerInfo(r.data)).catch(() => {});
      }
    }
  }, [selectedConvo?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const params = {};
      if (filterChannel) params.channel = filterChannel;
      if (searchTerm) params.search = searchTerm;
      const res = await api.get('/conversations', { params });
      setConversations(res.data);
      if (!selectedConvo && res.data.length > 0) setSelectedConvo(res.data[0]);
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
      const res = await api.post(`/conversations/${selectedConvo.id}/messages`, {
        content: newMessage,
        sender_type: 'agent',
      });
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

  const SentimentIcon = selectedConvo ? (SENTIMENT_ICONS[selectedConvo.sentiment_label] || Meh) : Meh;

  return (
    <div className="flex h-[calc(100vh-4rem)]" data-testid="inbox-page">
      {/* Conversation List */}
      <div className="w-80 flex-shrink-0 border-r border-gray-800/60 flex flex-col bg-[#0a0f1a]">
        <div className="p-4 border-b border-gray-800/60 space-y-3">
          <h2 className="text-lg font-semibold text-white">Inbox</h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-9 pr-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-xs text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              data-testid="inbox-search-input"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            <button onClick={() => setFilterChannel('')} className={`px-2.5 py-1 text-[10px] rounded-md font-medium whitespace-nowrap transition-colors ${!filterChannel ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'text-gray-500 hover:text-gray-300 border border-transparent'}`} data-testid="filter-all">All</button>
            {Object.entries(CHANNEL_ICONS).map(([ch, info]) => (
              <button key={ch} onClick={() => setFilterChannel(ch)} className={`px-2.5 py-1 text-[10px] rounded-md font-medium whitespace-nowrap transition-colors ${filterChannel === ch ? `${info.bg} ${info.text} border border-current/30` : 'text-gray-500 hover:text-gray-300 border border-transparent'}`} data-testid={`filter-${ch}`}>
                {info.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto" data-testid="conversation-list">
          {conversations.map((convo) => {
            const ch = CHANNEL_ICONS[convo.channel] || CHANNEL_ICONS.web_chat;
            const active = selectedConvo?.id === convo.id;
            return (
              <button
                key={convo.id}
                onClick={() => setSelectedConvo(convo)}
                className={`w-full text-left p-4 border-b border-gray-800/40 hover:bg-gray-800/30 transition-colors ${active ? 'bg-violet-500/10 border-l-2 border-l-violet-500' : ''}`}
                data-testid={`convo-item-${convo.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-full ${ch.bg} flex items-center justify-center text-xs font-bold ${ch.text} flex-shrink-0`}>
                    {convo.customer_name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-200 truncate">{convo.customer_name}</span>
                      {convo.unread_count > 0 && (
                        <span className="w-5 h-5 rounded-full bg-violet-500 text-[10px] font-bold text-white flex items-center justify-center">{convo.unread_count}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{convo.last_message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${ch.bg} ${ch.text}`}>{ch.label}</span>
                      {convo.ai_handled && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">AI</span>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          {conversations.length === 0 && (
            <div className="p-8 text-center text-gray-500 text-sm">No conversations found</div>
          )}
        </div>
      </div>

      {/* Message Thread */}
      {selectedConvo ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Thread Header */}
          <div className="h-16 px-6 flex items-center justify-between border-b border-gray-800/60 bg-[#030712]/50">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full ${CHANNEL_ICONS[selectedConvo.channel]?.bg} flex items-center justify-center text-sm font-bold ${CHANNEL_ICONS[selectedConvo.channel]?.text}`}>
                {selectedConvo.customer_name?.charAt(0)}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{selectedConvo.customer_name}</h3>
                <p className="text-xs text-gray-500">{selectedConvo.subject} · {CHANNEL_ICONS[selectedConvo.channel]?.label}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-md font-medium flex items-center gap-1 ${selectedConvo.sentiment_score > 0.3 ? 'bg-emerald-500/10 text-emerald-400' : selectedConvo.sentiment_score < -0.3 ? 'bg-red-500/10 text-red-400' : 'bg-gray-700/50 text-gray-400'}`}>
                <SentimentIcon size={12} /> {selectedConvo.sentiment_label}
              </span>
              <span className={`text-xs px-2 py-1 rounded-md font-medium ${selectedConvo.priority === 'critical' ? 'bg-red-500/10 text-red-400' : selectedConvo.priority === 'high' ? 'bg-amber-500/10 text-amber-400' : 'bg-gray-700/50 text-gray-400'}`}>
                {selectedConvo.priority}
              </span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4" data-testid="message-thread">
            {messages.map((msg) => {
              const isAgent = msg.sender_type === 'agent';
              const isAI = msg.sender_type === 'ai';
              const isCustomer = msg.sender_type === 'customer';
              return (
                <div key={msg.id} className={`flex ${isCustomer ? 'justify-start' : 'justify-end'}`} data-testid={`message-${msg.id}`}>
                  <div className={`max-w-[70%] ${isCustomer ? '' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {isCustomer && <UserCircle size={14} className="text-gray-500" />}
                      {isAI && <Bot size={14} className="text-purple-400" />}
                      <span className="text-[10px] text-gray-500">{msg.sender_name}</span>
                      <span className="text-[10px] text-gray-600">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {isAI && msg.ai_confidence && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-purple-500/10 text-purple-400">{Math.round(msg.ai_confidence * 100)}% conf</span>
                      )}
                    </div>
                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      isCustomer ? 'bg-gray-800/60 text-gray-200 rounded-tl-md' :
                      isAI ? 'bg-purple-500/15 text-gray-200 border border-purple-500/20 rounded-tr-md' :
                      'bg-violet-600/20 text-gray-200 border border-violet-500/20 rounded-tr-md'
                    }`}>
                      {isAI && <Sparkles size={12} className="inline-block text-purple-400 mr-1" />}
                      {msg.content}
                    </div>
                    {msg.sentiment && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${msg.sentiment.score > 0.3 ? 'bg-emerald-500/10 text-emerald-400' : msg.sentiment.score < -0.3 ? 'bg-red-500/10 text-red-400' : 'bg-gray-800 text-gray-500'}`}>
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
          <div className="p-4 border-t border-gray-800/60 bg-[#030712]/50">
            <div className="flex items-center gap-3">
              <button
                onClick={triggerAI}
                disabled={aiLoading}
                className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                title="Generate AI Response"
                data-testid="ai-respond-btn"
              >
                {aiLoading ? <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div> : <Sparkles size={18} />}
              </button>
              <div className="flex-1 relative">
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Type a message..."
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 pr-12"
                  data-testid="message-input"
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending}
                className="p-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500 transition-all shadow-lg shadow-violet-500/20 disabled:opacity-50"
                data-testid="send-message-btn"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <MessageSquare size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Select a conversation</p>
            <p className="text-sm">Choose from the list to start messaging</p>
          </div>
        </div>
      )}

      {/* Customer Sidebar */}
      {selectedConvo && customerInfo && (
        <div className="w-72 flex-shrink-0 border-l border-gray-800/60 bg-[#0a0f1a] overflow-y-auto" data-testid="customer-sidebar">
          <div className="p-5">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 mx-auto flex items-center justify-center text-xl font-bold text-white mb-3">
                {customerInfo.name?.charAt(0)}
              </div>
              <h4 className="text-sm font-semibold text-white">{customerInfo.name}</h4>
              <p className="text-xs text-gray-500">{customerInfo.company}</p>
              <span className={`inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full font-medium ${customerInfo.segment === 'vip' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : customerInfo.segment === 'enterprise' ? 'bg-violet-500/10 text-violet-400 border border-violet-500/30' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                {customerInfo.segment}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Contact</p>
                <div className="space-y-2">
                  {customerInfo.email && <p className="text-xs text-gray-300 flex items-center gap-2"><Mail size={12} className="text-gray-500" /> {customerInfo.email}</p>}
                  {customerInfo.phone && <p className="text-xs text-gray-300 flex items-center gap-2"><Phone size={12} className="text-gray-500" /> {customerInfo.phone}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800/30 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-white">{customerInfo.total_conversations}</p>
                  <p className="text-[10px] text-gray-500">Conversations</p>
                </div>
                <div className="bg-gray-800/30 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-white">${(customerInfo.lifetime_value / 1000).toFixed(0)}k</p>
                  <p className="text-[10px] text-gray-500">Lifetime Value</p>
                </div>
              </div>

              {customerInfo.churn_risk && (
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Churn Risk</p>
                  <div className={`p-3 rounded-lg border ${customerInfo.churn_risk.risk_level === 'critical' ? 'bg-red-500/10 border-red-500/30' : customerInfo.churn_risk.risk_level === 'high' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-gray-800/30 border-gray-700/50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium capitalize text-gray-300">{customerInfo.churn_risk.risk_level}</span>
                      <span className="text-xs font-bold text-gray-200">{Math.round(customerInfo.churn_risk.risk_score * 100)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${customerInfo.churn_risk.risk_score > 0.7 ? 'bg-red-500' : customerInfo.churn_risk.risk_score > 0.3 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${customerInfo.churn_risk.risk_score * 100}%` }}></div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Channels</p>
                <div className="flex flex-wrap gap-1.5">
                  {(customerInfo.channels || []).map((ch) => {
                    const info = CHANNEL_ICONS[ch] || CHANNEL_ICONS.web_chat;
                    return (
                      <span key={ch} className={`text-[10px] px-2 py-0.5 rounded ${info.bg} ${info.text}`}>{info.label}</span>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {(customerInfo.tags || []).map((tag) => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
                      <Tag size={8} className="inline mr-1" />{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
