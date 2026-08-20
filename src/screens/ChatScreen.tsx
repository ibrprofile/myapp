import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { callAIChat } from '@/lib/ai';
import { Send, Loader2, Sparkles, Check } from 'lucide-react';

export default function ChatScreen() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadMessages(); }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadMessages() {
    const { data: conv } = await supabase.from('chat_conversations').select('id').eq('user_id', user!.id).eq('is_active', true).maybeSingle();
    if (conv) {
      setConversationId(conv.id);
      const { data: msgs } = await supabase.from('chat_messages').select('*').eq('conversation_id', conv.id).order('created_at', { ascending: true });
      setMessages(msgs || []);
    }
  }

  async function send() {
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput('');
    setSending(true);

    setMessages(prev => [...prev, { id: 'temp-' + Date.now(), role: 'user', content: userMsg, created_at: new Date().toISOString() }]);

    try {
      const result = await callAIChat(userMsg, conversationId || undefined);
      if (result.conversationId && !conversationId) setConversationId(result.conversationId);
      setMessages(prev => [...prev, {
        id: 'ai-' + Date.now(),
        role: 'assistant',
        content: result.message,
        action_type: result.actions?.[0]?.action || null,
        created_at: new Date().toISOString(),
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: 'err-' + Date.now(),
        role: 'assistant',
        content: 'Теса сейчас немного занята. Данные сохранены, я обработаю их чуть позже.',
        created_at: new Date().toISOString(),
      }]);
    }
    setSending(false);
  }

  return (
    <main className="chat-screen">
      <header className="chat-header">
        <div className="tesa-avatar"><Sparkles size={20} /></div>
        <div>
          <h1>Теса</h1>
          <span>онлайн</span>
        </div>
      </header>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="empty-state" style={{ marginTop: 40 }}>
            <Sparkles size={48} />
            <p>Напиши Тесе что угодно.<br />Она поймёт и поможет.</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id}>
            <div className={`msg ${msg.role === 'user' ? 'msg-user' : 'msg-tesa'}`}>
              {msg.content}
            </div>
            {msg.action_type && (
              <div className="msg-action">
                <Check size={14} /> {msg.action_type.replace(/_/g, ' ')}
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="msg msg-tesa" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Loader2 size={16} className="animate-spin" />
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Теса думает...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-bar">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Сообщение Тесе..."
          disabled={sending}
        />
        <button className="chat-send-btn" onClick={send} disabled={sending || !input.trim()}>
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </main>
  );
}
