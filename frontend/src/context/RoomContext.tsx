import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ChatMessage, Room, SessionInfo } from '../types/room';

interface RoomContextValue {
  room: Room | null;
  session: SessionInfo | null;
  setRoom: (room: Room | null) => void;
  setSession: (session: SessionInfo | null) => void;
  chatMessages: ChatMessage[];
  addChatMessage: (msg: ChatMessage) => void;
  wsConnected: boolean;
  setWsConnected: (connected: boolean) => void;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({ children }: { children: ReactNode }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [wsConnected, setWsConnected] = useState(false);

  const addChatMessage = useCallback((msg: ChatMessage) => {
    setChatMessages((prev) => [...prev, msg]);
  }, []);

  const value = useMemo(
    () => ({
      room,
      session,
      setRoom,
      setSession,
      chatMessages,
      addChatMessage,
      wsConnected,
      setWsConnected,
    }),
    [room, session, chatMessages, addChatMessage, wsConnected],
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoomContext() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoomContext must be used within RoomProvider');
  return ctx;
}
