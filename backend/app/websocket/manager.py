import json
import asyncio
import logging
from uuid import uuid4
from typing import Any

from fastapi import WebSocket
from redis.asyncio import Redis

from app.core.config import settings

logger = logging.getLogger(__name__)


class ConnectionManager:
    """WebSocket connection manager for room events (Phase 4)."""

    def __init__(self) -> None:
        self._connections: dict[str, dict[str, WebSocket]] = {}
        self._instance_id = str(uuid4())
        self._redis: Redis | None = None
        self._redis_listener: asyncio.Task[None] | None = None

    async def _ensure_redis_listener(self) -> None:
        if not settings.redis_url or self._redis_listener and not self._redis_listener.done():
            return
        try:
            self._redis = Redis.from_url(settings.redis_url, decode_responses=True)
            self._redis_listener = asyncio.create_task(self._listen_for_remote_events())
        except Exception:
            # A malformed or unavailable optional Redis URL must not prevent
            # local WebSocket clients from using chat and room events.
            logger.exception("Redis listener could not be initialized")
            self._redis = None
            self._redis_listener = None

    async def _listen_for_remote_events(self) -> None:
        if self._redis is None:
            return
        pubsub = self._redis.pubsub()
        try:
            await pubsub.psubscribe("cinetogether:room:*")
            while True:
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=1.0,
                )
                if not message or not isinstance(message.get("data"), str):
                    continue
                envelope = json.loads(message["data"])
                if envelope.get("instance_id") == self._instance_id:
                    continue
                await self._broadcast_local(envelope["room_code"], envelope["event"])
        except asyncio.CancelledError:
            raise
        except Exception:
            # Redis is optional for single-instance development.
            return
        finally:
            await pubsub.aclose()

    async def _broadcast_local(self, room_code: str, event: dict[str, Any]) -> None:
        if room_code not in self._connections:
            return
        message = json.dumps(event)
        dead: list[str] = []
        for pid, ws in self._connections[room_code].items():
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(pid)
        for pid in dead:
            self.disconnect(room_code, pid)

    async def connect(self, room_code: str, participant_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        if room_code not in self._connections:
            self._connections[room_code] = {}
        self._connections[room_code][participant_id] = websocket
        await self._ensure_redis_listener()

    def disconnect(self, room_code: str, participant_id: str) -> None:
        if room_code in self._connections:
            self._connections[room_code].pop(participant_id, None)
            if not self._connections[room_code]:
                del self._connections[room_code]

    async def broadcast(self, room_code: str, event: dict[str, Any]) -> None:
        await self._broadcast_local(room_code, event)
        if not settings.redis_url:
            return
        await self._ensure_redis_listener()
        if self._redis is None:
            return
        try:
            await self._redis.publish(
                f"cinetogether:room:{room_code}",
                json.dumps(
                    {
                        "instance_id": self._instance_id,
                        "room_code": room_code,
                        "event": event,
                    }
                ),
            )
        except Exception:
            # Local WebSocket delivery remains available if Redis is temporarily down.
            return

    async def send(self, room_code: str, participant_id: str, event: dict[str, Any]) -> None:
        websocket = self._connections.get(room_code, {}).get(participant_id)
        if websocket is not None:
            await websocket.send_text(json.dumps(event))

    def get_connection_count(self, room_code: str) -> int:
        return len(self._connections.get(room_code, {}))


ws_manager = ConnectionManager()
