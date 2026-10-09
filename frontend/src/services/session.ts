import type { SessionInfo } from '../types/room';

const SESSION_KEY = 'cinetogether_session';

export function saveSession(session: SessionInfo): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(roomCode: string): SessionInfo | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session: SessionInfo = JSON.parse(raw);
    if (session.roomCode.toUpperCase() === roomCode.toUpperCase()) {
      return session;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
