from typing import Any

from sqlalchemy import JSON, MetaData, String, Table, Column, create_engine, delete, insert, select, update

from app.core.config import settings
from app.models.room import Room


class RoomRepository:
    """PostgreSQL-backed room documents, with no database in local test mode."""

    def __init__(self) -> None:
        self._engine = create_engine(settings.database_url, pool_pre_ping=True) if settings.database_url else None
        self._metadata = MetaData()
        self._rooms = Table(
            "rooms",
            self._metadata,
            Column("code", String(6), primary_key=True),
            Column("data", JSON, nullable=False),
        )
        if self._engine:
            self._metadata.create_all(self._engine)

    @property
    def enabled(self) -> bool:
        return self._engine is not None

    def get(self, code: str) -> Room | None:
        if not self._engine:
            return None
        with self._engine.connect() as connection:
            row = connection.execute(
                select(self._rooms.c.data).where(self._rooms.c.code == code.upper())
            ).first()
        return Room.model_validate(row.data) if row else None

    def save(self, room: Room) -> None:
        if not self._engine:
            return
        data: dict[str, Any] = room.model_dump(mode="json")
        with self._engine.begin() as connection:
            existing = connection.execute(
                select(self._rooms.c.code).where(self._rooms.c.code == room.code.upper())
            ).first()
            if existing:
                connection.execute(
                    update(self._rooms).where(self._rooms.c.code == room.code.upper()).values(data=data)
                )
            else:
                connection.execute(insert(self._rooms).values(code=room.code.upper(), data=data))

    def delete(self, code: str) -> None:
        if not self._engine:
            return
        with self._engine.begin() as connection:
            connection.execute(delete(self._rooms).where(self._rooms.c.code == code.upper()))

    def all(self) -> list[Room]:
        if not self._engine:
            return []
        with self._engine.connect() as connection:
            rows = connection.execute(select(self._rooms.c.data)).all()
        return [Room.model_validate(row.data) for row in rows]


room_repository = RoomRepository()