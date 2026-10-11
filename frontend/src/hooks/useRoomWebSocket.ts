import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomEvent } from '../types/room';

function resolveWebSocketUrl(): string {
  const configuredUrl = import.meta.env.VITE_WS_URL?.trim() || import.meta.env.VITE_API_URL?.trim();
  if (configuredUrl) {
    const normalizedUrl = configuredUrl.replace(/\/+$/, '');
    if (normalizedUrl.startsWith('https://')) return normalizedUrl.replace(/^https:/, 'wss:');
    if (normalizedUrl.startsWith('http://')) return normalizedUrl.replace(/^http:/, 'ws:');
    if (normalizedUrl.startsWith('wss://') || normalizedUrl.startsWith('ws://')) return normalizedUrl;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}

const WS_URL = resolveWebSocketUrl();

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

    let disposed = false;
    let reconnectTimer: number | undefined;
    let attempt = 0;
    const connect = () => {
      if (disposed) return;
      const ws = new WebSocket(
        `${WS_URL}/ws/rooms/${roomCode}?participant_id=${participantId}`,
      );
      wsRef.current = ws;
      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
      };
      ws.onclose = () => {
        setConnected(false);
        if (!disposed) {
          reconnectTimer = window.setTimeout(connect, Math.min(1000 * 2 ** attempt++, 10000));
        }
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (msg) => {
        try {
          const event: RoomEvent = JSON.parse(msg.data);
          onEventRef.current(event);
        } catch {
          /* ignore malformed messages */
        }
      };
    };
    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [roomCode, participantId]);

  return { connected, send };
}
