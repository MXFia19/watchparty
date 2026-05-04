import { useState, useEffect, useRef } from 'react';
import Avatar from './Avatar';
import type { ChatMessage } from '../hooks/useWatchParty';

interface ChatProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  currentUserId: string;
}

export default function Chat({ messages, onSend, currentUserId }: ChatProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-dark-700 font-semibold text-sm text-gray-300 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Chat
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0 overflow-x-hidden">
        {messages.length === 0 && (
          <p className="text-center text-gray-600 text-sm mt-8">Aucun message pour l'instant…</p>
        )}

        {messages.map((msg, i) => {
          const isSystem = msg.userId === 'system';
          const isMe = msg.userId === currentUserId;

          if (isSystem) {
            return (
              <div key={i} className="text-center text-xs text-gray-600 py-1">
                {msg.message}
              </div>
            );
          }

          return (
            <div key={i} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''} w-full min-w-0`}>
              <Avatar pseudo={msg.pseudo} src={msg.avatar} size={28} className="mt-1 flex-shrink-0" />
              <div className={`flex flex-col min-w-0 flex-1 ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && (
                  <span className="text-xs text-gray-500 mb-0.5 ml-1 truncate">{msg.pseudo}</span>
                )}
                <div className={`px-3 py-2 rounded-2xl text-sm break-all max-w-[85%] ${
                  isMe
                    ? 'bg-brand-500 text-white rounded-tr-sm'
                    : 'bg-dark-700 text-gray-200 rounded-tl-sm'
                }`}>
                  {msg.message}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-dark-700 flex gap-2">
        <input
          className="input flex-1 text-sm py-1.5"
          placeholder="Message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
          maxLength={500}
        />
        <button onClick={handleSend} disabled={!input.trim()} className="btn-primary px-3 py-1.5 text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
