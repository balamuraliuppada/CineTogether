import { PanelRight, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CallControls from '../components/CallControls';
import ChatPanel from '../components/ChatPanel';
import MoviePlayer from '../components/MoviePlayer';
import RoomHeader from '../components/RoomHeader';
import VideoGrid from '../components/VideoGrid';
import { useRoomContext } from '../context/RoomContext';
import { useLiveKitRoom } from '../hooks/useLiveKitRoom';
import { useRoomWebSocket } from '../hooks/useRoomWebSocket';
import { getRoom, leaveRoom } from '../services/api';
import { clearSession, loadSession, saveSession } from '../services/session';
import type { ChatMessage, RoomEvent } from '../types/room';

export default function WatchRoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const {
    room,
    session,
    setRoom,
    setSession,
    chatMessages,
    addChatMessage,
    replaceChatMessages,
    setWsConnected,
  } =
    useRoomContext();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPeople, setShowPeople] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const {
    localParticipant,
    remoteParticipants,
    status: liveKitStatus,
    error: liveKitError,
    micEnabled,
    cameraEnabled,
    mediaRevision,
    toggleMicrophone,
    toggleCamera,
    publishMovie,
    clearPublishedMovie,
    movieVideoTrack,
    remoteMovieVideoTrack,
    movieAudioTrack,
  } = useLiveKitRoom(roomCode ?? null, session?.participantId ?? null);

  const handleWsEvent = useCallback(
    (event: RoomEvent) => {
      if (event.type === 'chat_message' && event.payload) {
        addChatMessage({
          id: (event.payload.id as string) ?? crypto.randomUUID(),
          sender_id: event.sender_id ?? '',
          sender_name: (event.payload.sender_name as string) ?? 'Unknown',
          content: (event.payload.content as string) ?? '',
          timestamp: (event.payload.timestamp as string) ?? new Date().toISOString(),
          type: 'message',
        });
      }
      if (event.type === 'chat_history' && Array.isArray(event.payload?.messages)) {
        const history: ChatMessage[] = [];
        for (const message of event.payload.messages) {
          if (typeof message !== 'object' || message === null) continue;
          const savedMessage = message as Record<string, unknown>;
          history.push({
            id: (savedMessage.id as string) ?? crypto.randomUUID(),
            sender_id: (savedMessage.sender_id as string) ?? '',
            sender_name: (savedMessage.sender_name as string) ?? 'Unknown',
            content: (savedMessage.content as string) ?? '',
            timestamp: (savedMessage.timestamp as string) ?? new Date().toISOString(),
            type: 'message',
          });
        }
        replaceChatMessages(history);
      }
      if (
        event.type === 'participant_joined' ||
        event.type === 'participant_left' ||
        event.type === 'connection_state_changed'
      ) {
        if (roomCode) {
          getRoom(roomCode)
            .then(setRoom)
            .catch(() => {});
        }
      }
      if (event.type === 'participant_left' && event.payload?.display_name) {
        addChatMessage({
          id: crypto.randomUUID(),
          sender_id: 'system',
          sender_name: 'System',
          content: `${String(event.payload.display_name)} left the room.`,
          timestamp: new Date().toISOString(),
          type: 'system',
        });
      }
      if (
        event.type === 'participant_joined' &&
        event.sender_id !== session?.participantId &&
        event.payload?.display_name
      ) {
        addChatMessage({
          id: crypto.randomUUID(),
          sender_id: 'system',
          sender_name: 'System',
          content: `${String(event.payload.display_name)} entered the room.`,
          timestamp: new Date().toISOString(),
          type: 'system',
        });
      }
      if (event.type === 'host_changed' && roomCode && session) {
        const newHostId = String(event.payload?.host_id ?? '');
        if (newHostId !== session.participantId) void clearPublishedMovie();
        const nextSession = { ...session, isHost: newHostId === session.participantId };
        setSession(nextSession);
        saveSession(nextSession);
        getRoom(roomCode).then(setRoom).catch(() => {});
      }
      if (event.type === 'movie_selected' || event.type === 'movie_cleared' || event.type.startsWith('playback_')) {
        if (roomCode) {
          getRoom(roomCode)
            .then(setRoom)
            .catch(() => {});
        }
      }
    },
    [addChatMessage, clearPublishedMovie, replaceChatMessages, roomCode, session, setRoom, setSession],
  );

  const { connected, send } = useRoomWebSocket(
    roomCode ?? null,
    session?.participantId ?? null,
    handleWsEvent,
  );

  useEffect(() => {
    setWsConnected(connected);
  }, [connected, setWsConnected]);

  useEffect(() => {
    if (!roomCode) {
      navigate('/');
      return;
    }

    const init = async () => {
      const saved = loadSession(roomCode);
      if (!saved) {
        navigate(`/?join=${roomCode}`);
        return;
      }

      setSession(saved);

      try {
        const roomData = await getRoom(roomCode);
        setRoom(roomData);
        addChatMessage({
          id: crypto.randomUUID(),
          sender_id: 'system',
          sender_name: 'System',
          content: `Welcome to room ${roomCode}!`,
          timestamp: new Date().toISOString(),
          type: 'system',
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load room');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [roomCode, navigate, setRoom, setSession, addChatMessage]);

  const handleLeave = async () => {
    if (roomCode && session) {
      try {
        await leaveRoom(roomCode, session.participantId);
      } catch {
        /* room may already be closed */
      }
    }
    clearSession();
    navigate('/');
  };

  const handleSendMessage = (content: string) => {
    if (!session) return;

    send('chat_message', {
      content,
    });
  };

  const handleMovieSelect = (file: File) => {
    send('movie_selected', { title: file.name });
  };

  const handleClearMovie = () => {
    void clearPublishedMovie();
    send('movie_cleared');
  };
  const handleTransferHost = (participantId: string) => send('host_transfer', { participant_id: participantId });

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-navy-950">
        <div className="text-slate-400">Loading room…</div>
      </div>
    );
  }

  if (error || !room || !session) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-navy-950 gap-4">
        <p className="text-red-400">{error ?? 'Room not found'}</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded-lg bg-navy-700 text-slate-200 hover:bg-navy-600 transition-colors"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-navy-950">
      <RoomHeader
        roomCode={room.code}
        participantCount={room.participant_count}
        maxCapacity={room.max_capacity}
        connected={connected}
        isHost={session.isHost}
        localParticipantId={session.participantId}
        participants={room.participants}
        onTransferHost={handleTransferHost}
      />

      <div className="flex items-center justify-end gap-2 px-2 lg:px-3 pt-2">
        <button
          onClick={() => setShowPeople((visible) => !visible)}
          className="inline-flex items-center gap-1.5 rounded-md border border-navy-700 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200"
          aria-pressed={showPeople}
        >
          <Users className="w-3.5 h-3.5" /> People
        </button>
        <button
          onClick={() => setShowChat((visible) => !visible)}
          className="inline-flex items-center gap-1.5 rounded-md border border-navy-700 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200"
          aria-pressed={showChat}
        >
          <PanelRight className="w-3.5 h-3.5" /> Chat
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 p-2 lg:p-3 gap-2 lg:gap-3">
        {/* Movie Player — largest section */}
        <div className="flex-[2] min-h-[200px] lg:min-h-0">
          <MoviePlayer
            isHost={session.isHost}
            movieTitle={room.playback.movie_title}
            playbackState={room.playback}
            roomCode={room.code}
            onMovieSelect={session.isHost ? handleMovieSelect : undefined}
            onMovieStreamReady={session.isHost ? publishMovie : undefined}
            onPlaybackEvent={session.isHost ? send : undefined}
            onClearMovie={session.isHost ? handleClearMovie : undefined}
            onMovieDurationReady={session.isHost ? (duration) => send('playback_duration', { duration }) : undefined}
            remoteMovieVideoTrack={session.isHost ? remoteMovieVideoTrack : movieVideoTrack}
            remoteMovieAudioTrack={movieAudioTrack}
          />
        </div>

        {/* Video Grid — center on desktop */}
        {showPeople && <div className="lg:w-56 xl:w-64 shrink-0 min-h-[120px] lg:min-h-0">
          <VideoGrid
            participants={room.participants}
            localParticipantId={session.participantId}
            liveKitLocalParticipant={localParticipant}
            liveKitRemoteParticipants={remoteParticipants}
            mediaRevision={mediaRevision}
          />
        </div>}

        {/* Chat Sidebar */}
        {showChat && <div className="lg:w-72 xl:w-80 shrink-0 min-h-[200px] lg:min-h-0">
          <ChatPanel
            messages={chatMessages}
            participants={room.participants}
            onSendMessage={handleSendMessage}
            disabled={!connected}
            isHost={session.isHost}
            localParticipantId={session.participantId}
            onTransferHost={handleTransferHost}
          />
        </div>}
      </div>

      <CallControls
        micEnabled={micEnabled}
        cameraEnabled={cameraEnabled}
        onToggleMic={toggleMicrophone}
        onToggleCamera={toggleCamera}
        onLeave={handleLeave}
      />
      {liveKitStatus === 'error' && (
        <div className="bg-red-950/80 px-4 py-2 text-center text-xs text-red-200">
          Video calling unavailable: {liveKitError}
        </div>
      )}
    </div>
  );
}
