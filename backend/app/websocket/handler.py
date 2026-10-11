import json
import html
import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.models.room import ChatMessage
from app.models.room import ConnectionStatus
from app.services.room_service import HostTransferError, ParticipantNotFoundError, RoomNotFoundError, room_service
from app.websocket.manager import ws_manager

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_CHAT_LENGTH = 500
MAX_CHAT_HISTORY = 100


def _sanitize_chat_content(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    normalized = " ".join(value.split())
    return html.escape(normalized, quote=False)


async def _send_error(room_code: str, participant_id: str, message: str) -> None:
    await ws_manager.send(
        room_code,
        participant_id,
        {"type": "error", "room_code": room_code, "payload": {"message": message}},
    )


@router.websocket("/ws/rooms/{room_code}")
async def room_websocket(websocket: WebSocket, room_code: str) -> None:
    """Handle room chat and host-authorized playback events."""
    participant_id = websocket.query_params.get("participant_id")
    if not participant_id:
        await websocket.close(code=4001, reason="participant_id required")
        return

    try:
        room = room_service.get_room(room_code)
    except RoomNotFoundError:
        await websocket.close(code=4004, reason="Room not found")
        return

    if participant_id not in room.participants:
        await websocket.close(code=4003, reason="Not a room participant")
        return

    await ws_manager.connect(room_code.upper(), participant_id, websocket)
    room_service.set_participant_status(room_code, participant_id, ConnectionStatus.CONNECTED)

    try:
        await ws_manager.send(
            room_code.upper(),
            participant_id,
            {
                "type": "playback_state",
                "room_code": room_code.upper(),
                "payload": room.playback.model_dump(mode="json"),
            },
        )
        await ws_manager.send(
            room_code.upper(),
            participant_id,
            {
                "type": "chat_history",
                "room_code": room_code.upper(),
                "payload": {
                    "messages": [message.model_dump(mode="json") for message in room.chat_history],
                },
            },
        )
        await ws_manager.broadcast(
            room_code.upper(),
            {
                "type": "participant_joined",
                "room_code": room_code.upper(),
                "sender_id": participant_id,
                "payload": {
                    "participant_id": participant_id,
                    "display_name": room.participants[participant_id].display_name,
                    "status": "connected",
                },
            },
        )
        while True:
            data = await websocket.receive_text()
            try:
                event = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"type": "error", "payload": {"message": "Invalid JSON"}}))
                continue

            event_type = event.get("type", "")
            payload = event.get("payload", {})
            if not isinstance(event_type, str) or not isinstance(payload, dict):
                await _send_error(room_code.upper(), participant_id, "Invalid event format")
                continue

            # The websocket may stay open while other participants join. Reload the
            # persisted room before mutating playback so those newer participants
            # cannot be overwritten by this connection's old snapshot.
            if event_type.startswith("playback_") or event_type in {"movie_selected", "movie_cleared"}:
                try:
                    room = room_service.get_room(room_code)
                except RoomNotFoundError:
                    await _send_error(room_code.upper(), participant_id, "Room no longer exists")
                    continue

            if (
                event_type.startswith("playback_")
                or event_type in {"movie_selected", "movie_cleared", "host_transfer"}
            ) and participant_id != room.host_id:
                await websocket.send_text(
                    json.dumps({"type": "error", "payload": {"message": "Only the host can control playback"}})
                )
                continue

            if event_type == "chat_message":
                raw_content = payload.get("content")
                content = _sanitize_chat_content(raw_content)
                if not content:
                    await _send_error(room_code.upper(), participant_id, "Message cannot be empty")
                    continue
                if not isinstance(raw_content, str) or len(raw_content) > MAX_CHAT_LENGTH:
                    await _send_error(
                        room_code.upper(), participant_id, f"Message must be {MAX_CHAT_LENGTH} characters or fewer"
                    )
                    continue

                message = ChatMessage(
                    sender_id=participant_id,
                    sender_name=room.participants[participant_id].display_name,
                    content=content,
                )
                room.chat_history.append(message)
                del room.chat_history[:-MAX_CHAT_HISTORY]
                await ws_manager.broadcast(
                    room_code.upper(),
                    {
                        "type": "chat_message",
                        "room_code": room_code.upper(),
                        "sender_id": participant_id,
                        "payload": message.model_dump(mode="json"),
                    },
                )
                continue

            if event_type == "host_transfer":
                target_id = str(payload.get("participant_id", ""))
                try:
                    room = room_service.transfer_host(room_code, participant_id, target_id)
                except (HostTransferError, ParticipantNotFoundError) as transfer_error:
                    await _send_error(room_code.upper(), participant_id, str(transfer_error))
                    continue
                await ws_manager.broadcast(
                    room_code.upper(),
                    {
                        "type": "host_changed",
                        "room_code": room_code.upper(),
                        "sender_id": participant_id,
                        "payload": {"host_id": room.host_id},
                    },
                )
                continue

            if event_type not in {"movie_selected", "movie_cleared", "playback_duration", "playback_play", "playback_pause", "playback_seek"}:
                await _send_error(room_code.upper(), participant_id, "Unsupported event type")
                continue

            if event_type == "movie_selected":
                room.playback.movie_title = str(payload.get("title", "")) or None
                room.playback.duration = 0.0
                room.playback.is_playing = False
                room.playback.position = 0.0
                room.playback.control_version += 1
            elif event_type == "movie_cleared":
                room.playback.movie_title = None
                room.playback.duration = 0.0
                room.playback.is_playing = False
                room.playback.position = 0.0
                room.playback.control_version += 1
            elif event_type == "playback_duration":
                room.playback.duration = max(0.0, float(payload.get("duration", 0.0)))
                room.playback.control_version += 1
            elif event_type == "playback_play":
                room.playback.is_playing = True
                room.playback.position = float(payload.get("position", room.playback.position))
                room.playback.control_version += 1
            elif event_type == "playback_pause":
                room.playback.is_playing = False
                room.playback.position = float(payload.get("position", room.playback.position))
                room.playback.control_version += 1
            elif event_type == "playback_seek":
                room.playback.position = max(0.0, float(payload.get("position", 0.0)))
                room.playback.control_version += 1

            room.playback.last_update = datetime.utcnow()
            room_service.save_room(room)

            await ws_manager.broadcast(
                room_code.upper(),
                {
                    "type": event_type,
                    "room_code": room_code.upper(),
                    "sender_id": participant_id,
                    "payload": payload,
                },
            )
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("Room WebSocket failed for room=%s participant=%s", room_code, participant_id)
        try:
            await websocket.close(code=1011, reason="WebSocket server error")
        except Exception:
            pass
    finally:
        ws_manager.disconnect(room_code.upper(), participant_id)
        try:
            room_service.set_participant_status(room_code, participant_id, ConnectionStatus.DISCONNECTED)
        except (ParticipantNotFoundError, RoomNotFoundError):
            pass
        await ws_manager.broadcast(
            room_code.upper(),
            {
                "type": "participant_left",
                "room_code": room_code.upper(),
                "sender_id": participant_id,
                "payload": {
                    "participant_id": participant_id,
                    "status": "disconnected",
                    "display_name": room.participants[participant_id].display_name
                    if participant_id in room.participants
                    else "Participant",
                },
            },
        )
