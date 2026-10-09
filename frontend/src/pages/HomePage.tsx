import { Film, Loader2, Users, Video, MessageSquare, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createRoom, joinRoom } from '../services/api';
import { saveSession } from '../services/session';

export default function HomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [displayName, setDisplayName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const joinCode = searchParams.get('join');
    if (joinCode) {
      setRoomCode(joinCode.toUpperCase().slice(0, 6));
    }
  }, [searchParams]);

  const handleCreate = async () => {
    const name = displayName.trim();
    if (!name) {
      setError('Please enter a display name');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await createRoom(name);
      saveSession({
        participantId: res.participant_id,
        displayName: name,
        isHost: true,
        roomCode: res.room.code,
      });
      navigate(`/room/${res.room.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    const name = displayName.trim();
    const code = roomCode.trim().toUpperCase();
    if (!name) {
      setError('Please enter a display name');
      return;
    }
    if (!code || code.length !== 6) {
      setError('Please enter a valid 6-character room code');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await joinRoom(code, name);
      saveSession({
        participantId: res.participant_id,
        displayName: res.room.participants.find((p) => p.id === res.participant_id)?.display_name ?? name,
        isHost: false,
        roomCode: res.room.code,
      });
      navigate(`/room/${res.room.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-navy-950">
      <div className="max-w-6xl mx-auto px-4 py-12 lg:py-20">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Film className="w-10 h-10 text-accent-violet" />
            <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-accent-blue to-accent-violet bg-clip-text text-transparent">
              CineTogether
            </h1>
          </div>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Watch movies together in perfect sync. See your friends, talk in real time, and share the experience — no account required.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Create / Join */}
          <div className="bg-navy-900 rounded-2xl border border-navy-700 p-6 lg:p-8 space-y-6">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-slate-300 mb-2">
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                maxLength={32}
                className="w-full px-4 py-3 rounded-lg bg-navy-800 border border-navy-700 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent-violet transition-colors"
              />
            </div>

            {error && (
              <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-accent-blue to-accent-violet text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Video className="w-5 h-5" />}
              Create Room
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-navy-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-navy-900 text-slate-500">or join existing</span>
              </div>
            </div>

            <div>
              <label htmlFor="roomCode" className="block text-sm font-medium text-slate-300 mb-2">
                Room Code
              </label>
              <input
                id="roomCode"
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="ABC123"
                maxLength={6}
                className="w-full px-4 py-3 rounded-lg bg-navy-800 border border-navy-700 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent-violet transition-colors font-mono tracking-widest uppercase"
              />
            </div>

            <button
              onClick={handleJoin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-navy-700 hover:bg-navy-600 border border-navy-600 text-slate-200 font-medium transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Users className="w-5 h-5" />}
              Join Room
            </button>
          </div>

          {/* Preview */}
          <div className="space-y-6">
            <div className="bg-navy-900 rounded-2xl border border-navy-700 p-6 lg:p-8">
              <h2 className="text-lg font-semibold text-slate-200 mb-4">How it works</h2>
              <div className="space-y-4">
                {[
                  { icon: Video, title: 'Create a room', desc: 'Pick a movie from your computer and invite friends with a link.' },
                  { icon: Users, title: 'Watch together', desc: 'Everyone sees the same movie, synced in real time.' },
                  { icon: MessageSquare, title: 'Chat & react', desc: 'Talk over video while you watch and share reactions in chat.' },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex gap-4">
                    <div className="w-10 h-10 rounded-lg bg-navy-800 border border-navy-700 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-accent-violet" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-slate-200">{title}</h3>
                      <p className="text-sm text-slate-500 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview mockup */}
            <div className="bg-navy-900 rounded-2xl border border-navy-700 p-4 aspect-video relative overflow-hidden">
              <div className="absolute inset-0 grid grid-cols-3 gap-1 p-2 opacity-60">
                <div className="col-span-2 bg-navy-800 rounded-lg flex items-center justify-center">
                  <Film className="w-8 h-8 text-navy-600" />
                </div>
                <div className="space-y-1">
                  <div className="h-1/2 bg-navy-800 rounded-lg" />
                  <div className="h-1/2 bg-navy-800 rounded-lg" />
                </div>
              </div>
              <div className="absolute bottom-3 left-3 right-3 text-center">
                <span className="text-xs text-slate-500">Watch room preview</span>
              </div>
            </div>

            <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-navy-900/50 border border-navy-700">
              <Shield className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-500 leading-relaxed">
                Your movie stays on your device — it is streamed directly to participants, never uploaded to cloud storage.
                Camera and microphone access is requested only inside the watch room.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
