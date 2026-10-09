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
import { clearSession, loadSession } from '../services/session';
import type { RoomEvent } from '../types/room';

export default function WatchRoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { room, session, setRoom, setSession, chatMessages, addChatMessage, setWsConnected } =
    useRoomContext();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const {
    localParticipant,
    remoteParticipants,
    status: liveKitStatus,
    error: liveKitError,
    micEnabled,
    cameraEnabled,
    toggleMicrophone,
    toggleCamera,
    publishMovie,
    movieVideoTrack,
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
        for (const message of event.payload.messages) {
          if (typeof message !== 'object' || message === null) continue;
          const savedMessage = message as Record<string, unknown>;
          addChatMessage({
            id: (savedMessage.id as string) ?? crypto.randomUUID(),
            sender_id: (savedMessage.sender_id as string) ?? '',
            sender_name: (savedMessage.sender_name as string) ?? 'Unknown',
            content: (savedMessage.content as string) ?? '',
            timestamp: (savedMessage.timestamp as string) ?? new Date().toISOString(),
            type: 'message',
          });
        }
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
      if (event.type === 'movie_selected' || event.type.startsWith('playback_')) {
        if (roomCode) {
          getRoom(roomCode)
            .then(setRoom)
            .catch(() => {});
        }
      }
    },
    [addChatMessage, roomCode, setRoom],
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
      />

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 p-2 lg:p-3 gap-2 lg:gap-3">
        {/* Movie Player — largest section */}
        <div className="flex-[2] min-h-[200px] lg:min-h-0">
          <MoviePlayer
            isHost={session.isHost}
            movieTitle={room.playback.movie_title}
            onMovieSelect={session.isHost ? handleMovieSelect : undefined}
            onMovieStreamReady={session.isHost ? publishMovie : undefined}
            onPlaybackEvent={session.isHost ? send : undefined}
            remoteMovieVideoTrack={session.isHost ? undefined : movieVideoTrack}
            remoteMovieAudioTrack={session.isHost ? undefined : movieAudioTrack}
          />
        </div>

        {/* Video Grid — center on desktop */}
        <div className="lg:w-56 xl:w-64 shrink-0 min-h-[120px] lg:min-h-0">
          <VideoGrid
            participants={room.participants}
            localParticipantId={session.participantId}
            liveKitLocalParticipant={localParticipant}
            liveKitRemoteParticipants={remoteParticipants}
          />
        </div>

        {/* Chat Sidebar */}
        <div className="lg:w-72 xl:w-80 shrink-0 min-h-[200px] lg:min-h-0">
          <ChatPanel
            messages={chatMessages}
            participants={room.participants}
            onSendMessage={handleSendMessage}
            disabled={!connected}
          />
        </div>
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
