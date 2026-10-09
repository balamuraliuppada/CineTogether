from datetime import datetime
from enum import Enum
from uuid import uuid4

from pydantic import BaseModel, Field


class ConnectionStatus(str, Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    RECONNECTING = "reconnecting"


class RoomState(str, Enum):
    ACTIVE = "active"
    CLOSED = "closed"


class Participant(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    display_name: str
    is_host: bool = False
    connection_status: ConnectionStatus = ConnectionStatus.CONNECTED
    joined_at: datetime = Field(default_factory=datetime.utcnow)


class PlaybackState(BaseModel):
    movie_title: str | None = None
    is_playing: bool = False
    position: float = 0.0
    last_update: datetime = Field(default_factory=datetime.utcnow)
    control_version: int = 0


class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    sender_id: str
    sender_name: str
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class Room(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    code: str
    host_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
    max_capacity: int = 5
    state: RoomState = RoomState.ACTIVE
    participants: dict[str, Participant] = Field(default_factory=dict)
    playback: PlaybackState = Field(default_factory=PlaybackState)
    chat_history: list[ChatMessage] = Field(default_factory=list)

    @property
    def participant_count(self) -> int:
        return len(self.participants)

    def get_host(self) -> Participant | None:
        return self.participants.get(self.host_id)
