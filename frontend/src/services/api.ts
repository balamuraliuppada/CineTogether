import type {
  CreateRoomResponse,
  JoinRoomResponse,
  MediaTokenResponse,
  Room,
} from '../types/room';

const API_URL = import.meta.env.VITE_API_URL || '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(body.detail || `Request failed: ${response.status}`);
  }

  return response.json();
}

export async function createRoom(displayName: string): Promise<CreateRoomResponse> {
  return request('/api/v1/rooms', {
    method: 'POST',
    body: JSON.stringify({ display_name: displayName }),
  });
}

export async function getRoom(roomCode: string): Promise<Room> {
  return request(`/api/v1/rooms/${roomCode}`);
}

export async function joinRoom(roomCode: string, displayName: string): Promise<JoinRoomResponse> {
  return request(`/api/v1/rooms/${roomCode}/join`, {
    method: 'POST',
    body: JSON.stringify({ display_name: displayName }),
  });
}

export async function leaveRoom(roomCode: string, participantId: string): Promise<void> {
  await request(`/api/v1/rooms/${roomCode}/leave`, {
    method: 'POST',
    body: JSON.stringify({ participant_id: participantId }),
  });
}

export async function getMediaToken(
  roomCode: string,
  participantId: string,
): Promise<MediaTokenResponse> {
  return request(`/api/v1/rooms/${roomCode}/media-token`, {
    method: 'POST',
    body: JSON.stringify({ participant_id: participantId }),
  });
}
