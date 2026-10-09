import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomEvent } from '../types/room';

const WS_URL = import.meta.env.VITE_API_URL?.replace(/^http/, 'ws') || `ws://${window.location.host}`;

export function useRoomWebSocket(
  roomCode: string | null,
  participantId: string | null,
  onEvent: (event: RoomEvent) => void,
) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const send = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  useEffect(() => {
    if (!roomCode || !participantId) return;

    const ws = new WebSocket(
      `${WS_URL}/ws/rooms/${roomCode}?participant_id=${participantId}`,
    );
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (msg) => {
      try {
        const event: RoomEvent = JSON.parse(msg.data);
        onEventRef.current(event);
      } catch {
        /* ignore malformed messages */
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [roomCode, participantId]);

  return { connected, send };
}
