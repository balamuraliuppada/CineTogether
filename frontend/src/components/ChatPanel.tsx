import { MessageSquare, Send, Users } from 'lucide-react';
import { useState } from 'react';
import type { ChatMessage, Participant } from '../types/room';

interface ChatPanelProps {
  messages: ChatMessage[];
  participants: Participant[];
  onSendMessage: (content: string) => void;
  disabled?: boolean;
  isHost?: boolean;
  localParticipantId?: string;
  onTransferHost?: (participantId: string) => void;
}

type Tab = 'chat' | 'people';

export default function ChatPanel({
  messages,
  participants,
  onSendMessage,
  disabled = false,
  isHost = false,
  localParticipantId,
  onTransferHost,
}: ChatPanelProps) {
  const [tab, setTab] = useState<Tab>('chat');
  const [input, setInput] = useState('');

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSendMessage(trimmed);
    setInput('');
  };

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-navy-900 rounded-xl border border-navy-700 overflow-hidden">
      <div className="flex border-b border-navy-700">
        <button
          onClick={() => setTab('chat')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
            tab === 'chat'
              ? 'text-accent-violet border-b-2 border-accent-violet'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Chat
        </button>
        <button
          onClick={() => setTab('people')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
            tab === 'people'
              ? 'text-accent-violet border-b-2 border-accent-violet'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          People
        </button>
      </div>

      {tab === 'chat' ? (
        <>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm gap-2 py-8">
                <MessageSquare className="w-8 h-8 text-navy-700" />
                <p>No messages yet</p>
                <p className="text-xs text-slate-600">
                  Messages are shared with everyone in this room
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={msg.type === 'system' ? 'text-center' : ''}>
                {msg.type === 'system' ? (
                  <span className="text-xs text-slate-500 italic">{msg.content}</span>
                ) : (
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-medium text-accent-violet">
                        {msg.sender_name}
                      </span>
                      <span className="text-[10px] text-slate-600">{formatTime(msg.timestamp)}</span>
                    </div>
                    <p className="text-sm text-slate-300 mt-0.5 break-words">{msg.content}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-navy-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={disabled ? 'Connecting…' : 'Type a message…'}
                maxLength={500}
                disabled={disabled}
                className="flex-1 px-3 py-2 rounded-lg bg-navy-800 border border-navy-700 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent-violet disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={disabled || !input.trim()}
                className="p-2 rounded-lg bg-accent-violet hover:bg-accent-violet/80 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Send message"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {participants.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-navy-800 border border-navy-700"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-navy-600 flex items-center justify-center text-xs font-medium text-slate-300">
                  {p.display_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="text-sm text-slate-200">{p.display_name}</span>
                  {p.is_host && (
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                      Host
                    </span>
                  )}
                </div>
              </div>
              <span
                className={`text-[10px] ${
                  p.connection_status === 'connected' ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {p.connection_status}
              </span>
              {isHost && p.id !== localParticipantId && (
                <button
                  onClick={() => onTransferHost?.(p.id)}
                  className="ml-2 text-[10px] text-accent-blue hover:text-slate-200"
                >
                  Make host
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
