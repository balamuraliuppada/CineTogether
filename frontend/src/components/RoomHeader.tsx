import { Check, Copy, Film, Users, Wifi, WifiOff } from 'lucide-react';
import { useState } from 'react';
import type { Participant } from '../types/room';

interface RoomHeaderProps {
  roomCode: string;
  participantCount: number;
  maxCapacity: number;
  connected: boolean;
  isHost?: boolean;
  localParticipantId?: string;
  participants?: Participant[];
  onTransferHost?: (participantId: string) => void;
}

export default function RoomHeader({
  roomCode,
  participantCount,
  maxCapacity,
  connected,
  isHost = false,
  localParticipantId,
  participants = [],
  onTransferHost,
}: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');

  const copyLink = async () => {
    const url = `${window.location.origin}/room/${roomCode}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-navy-900 border-b border-navy-700 shrink-0">
      <div className="flex items-center gap-3">
        <Film className="w-6 h-6 text-accent-violet" />
        <span className="text-lg font-semibold bg-gradient-to-r from-accent-blue to-accent-violet bg-clip-text text-transparent">
          CineTogether
        </span>
      </div>

      <div className="flex items-center gap-4 text-sm text-slate-400">
        <span className="hidden sm:inline font-mono tracking-widest text-slate-300">
          {roomCode}
        </span>

        <div className="flex items-center gap-1.5">
          <Users className="w-4 h-4" />
          <span>
            {participantCount}/{maxCapacity}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {connected ? (
            <Wifi className="w-4 h-4 text-emerald-400" />
          ) : (
            <WifiOff className="w-4 h-4 text-amber-400" />
          )}
          <span className={connected ? 'text-emerald-400' : 'text-amber-400'}>
            {connected ? 'Connected' : 'Connecting…'}
          </span>
        </div>

        {isHost && participants.length > 1 && (
          <select
            value={transferTarget}
            onChange={(event) => {
              const target = event.target.value;
              setTransferTarget('');
              if (target) onTransferHost?.(target);
            }}
            className="max-w-36 rounded-lg border border-navy-700 bg-navy-800 px-2 py-1.5 text-xs text-slate-300"
            aria-label="Transfer host"
          >
            <option value="">Transfer host</option>
            {participants
              .filter((participant) => participant.id !== localParticipantId)
              .map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.display_name}
                </option>
              ))}
          </select>
        )}

        <button
          onClick={copyLink}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-700 hover:bg-navy-800 border border-navy-700 transition-colors text-slate-300"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy Link'}</span>
        </button>
      </div>
    </header>
  );
}
