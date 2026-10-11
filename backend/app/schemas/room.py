from datetime import datetime

from pydantic import BaseModel, Field


class CreateRoomRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=32)


class JoinRoomRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=32)


class LeaveRoomRequest(BaseModel):
    participant_id: str


class TransferHostRequest(BaseModel):
    participant_id: str


class MediaTokenRequest(BaseModel):
    participant_id: str


class ParticipantResponse(BaseModel):
    id: str
    display_name: str
    is_host: bool
    connection_status: str
    joined_at: datetime


class PlaybackStateResponse(BaseModel):
    movie_title: str | None
    duration: float
    is_playing: bool
    position: float
    last_update: datetime
    control_version: int


class RoomResponse(BaseModel):
    code: str
    host_id: str
    state: str
    participant_count: int
    max_capacity: int
    participants: list[ParticipantResponse]
    playback: PlaybackStateResponse
    expires_at: datetime


class CreateRoomResponse(BaseModel):
    room: RoomResponse
    participant_id: str
    invitation_url: str


class JoinRoomResponse(BaseModel):
    room: RoomResponse
    participant_id: str


class MediaTokenResponse(BaseModel):
    token: str
    livekit_url: str
    room_name: str
