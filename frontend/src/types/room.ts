export interface Participant {
  id: string;
  display_name: string;
  is_host: boolean;
  connection_status: string;
  joined_at: string;
}

export interface PlaybackState {
  movie_title: string | null;
  is_playing: boolean;
  position: number;
  last_update: string;
  control_version: number;
}

export interface Room {
  code: string;
  host_id: string;
  state: string;
  participant_count: number;
  max_capacity: number;
  participants: Participant[];
  playback: PlaybackState;
  expires_at: string;
}

export interface CreateRoomResponse {
  room: Room;
  participant_id: string;
  invitation_url: string;
}

export interface JoinRoomResponse {
  room: Room;
  participant_id: string;
}

export interface MediaTokenResponse {
  token: string;
  livekit_url: string;
  room_name: string;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  timestamp: string;
  type: 'message' | 'system' | 'reaction';
}

export interface SessionInfo {
  participantId: string;
  displayName: string;
  isHost: boolean;
  roomCode: string;
}

export interface RoomEvent {
  type: string;
  room_code: string;
  sender_id?: string;
  payload: Record<string, unknown>;
}
