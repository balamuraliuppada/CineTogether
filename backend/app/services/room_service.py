import secrets
import string
from datetime import datetime, timedelta

from app.core.config import settings
from app.models.room import ConnectionStatus, Participant, Room, RoomState
from app.services.storage import room_repository


class RoomNotFoundError(Exception):
    pass


class RoomFullError(Exception):
    pass


class RoomClosedError(Exception):
    pass


class ParticipantNotFoundError(Exception):
    pass


class RoomService:
    """Room management backed by PostgreSQL when DATABASE_URL is configured."""

    CODE_LENGTH = 6
    CODE_ALPHABET = string.ascii_uppercase + string.digits

    def __init__(self) -> None:
        self._rooms: dict[str, Room] = {}

    def _generate_code(self) -> str:
        for _ in range(100):
            code = "".join(secrets.choice(self.CODE_ALPHABET) for _ in range(self.CODE_LENGTH))
            if code not in self._rooms and room_repository.get(code) is None:
                return code
        raise RuntimeError("Unable to generate unique room code")

    def _resolve_display_name(self, room: Room, requested_name: str) -> str:
        existing = {p.display_name.lower() for p in room.participants.values()}
        if requested_name.lower() not in existing:
            return requested_name
        suffix = 2
        while f"{requested_name} ({suffix})".lower() in existing:
            suffix += 1
        return f"{requested_name} ({suffix})"

    def _get_room(self, code: str) -> Room:
        normalized_code = code.upper()
        room = room_repository.get(normalized_code) or self._rooms.get(normalized_code)
        if room is None:
            raise RoomNotFoundError(f"Room '{code}' not found")
        if room.state == RoomState.CLOSED:
            raise RoomClosedError(f"Room '{code}' is closed")
        if datetime.utcnow() > room.expires_at:
            room.state = RoomState.CLOSED
            room_repository.delete(normalized_code)
            self._rooms.pop(normalized_code, None)
            raise RoomClosedError(f"Room '{code}' has expired")
        return room

    def _save_room(self, room: Room) -> None:
        if room_repository.enabled:
            room_repository.save(room)
        else:
            self._rooms[room.code] = room

    def create_room(self, display_name: str) -> tuple[Room, Participant]:
        code = self._generate_code()
        participant = Participant(display_name=display_name.strip(), is_host=True)
        expires_at = datetime.utcnow() + timedelta(minutes=settings.room_expiration_minutes)
        room = Room(
            code=code,
            host_id=participant.id,
            expires_at=expires_at,
            max_capacity=settings.max_participants,
            participants={participant.id: participant},
        )
        self._save_room(room)
        return room, participant

    def join_room(self, code: str, display_name: str) -> tuple[Room, Participant]:
        room = self._get_room(code)
        if room.participant_count >= room.max_capacity:
            raise RoomFullError(f"Room '{code}' is full")
        resolved_name = self._resolve_display_name(room, display_name.strip())
        participant = Participant(display_name=resolved_name, is_host=False)
        room.participants[participant.id] = participant
        self._save_room(room)
        return room, participant

    def leave_room(self, code: str, participant_id: str) -> Room | None:
        room = self._get_room(code)
        if participant_id not in room.participants:
            raise ParticipantNotFoundError(f"Participant '{participant_id}' not in room")
        was_host = participant_id == room.host_id
        del room.participants[participant_id]

        if was_host:
            room.state = RoomState.CLOSED
            room.participants.clear()
            self._save_room(room)
            return None

        if not room.participants:
            room_repository.delete(code.upper())
            self._rooms.pop(code.upper(), None)
            return None

        self._save_room(room)
        return room

    def get_room(self, code: str) -> Room:
        return self._get_room(code)

    def set_participant_status(
        self, code: str, participant_id: str, status: ConnectionStatus
    ) -> None:
        room = self._get_room(code)
        if participant_id not in room.participants:
            raise ParticipantNotFoundError(f"Participant '{participant_id}' not in room")
        room.participants[participant_id].connection_status = status
        self._save_room(room)

    def cleanup_expired(self) -> int:
        now = datetime.utcnow()
        rooms = list(self._rooms.values())
        if room_repository.enabled:
            rooms.extend(room_repository.all())
        expired = [room.code for room in rooms if now > room.expires_at]
        for code in expired:
            room_repository.delete(code)
            self._rooms.pop(code, None)
        if room_repository.enabled:
            # Persistent rooms are removed lazily when accessed; this keeps cleanup safe
            # across database engines without relying on database-specific date syntax.
            return len(expired)
        return len(expired)


room_service = RoomService()
