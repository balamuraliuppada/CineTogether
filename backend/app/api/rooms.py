from fastapi import APIRouter, HTTPException, Request
from livekit import api

from app.core.config import settings
from app.models.room import Room
from app.schemas.room import (
    CreateRoomRequest,
    CreateRoomResponse,
    JoinRoomRequest,
    JoinRoomResponse,
    LeaveRoomRequest,
    MediaTokenRequest,
    MediaTokenResponse,
    ParticipantResponse,
    PlaybackStateResponse,
    RoomResponse,
)
from app.services.room_service import (
    ParticipantNotFoundError,
    RoomClosedError,
    RoomFullError,
    RoomNotFoundError,
    room_service,
)

router = APIRouter(prefix="/api/v1/rooms", tags=["rooms"])


def _build_invitation_url(request: Request, code: str) -> str:
    origin = request.headers.get("origin") or str(request.base_url).rstrip("/")
    return f"{origin}/room/{code}"


def _room_to_response(room: Room) -> RoomResponse:
    return RoomResponse(
        code=room.code,
        host_id=room.host_id,
        state=room.state.value,
        participant_count=room.participant_count,
        max_capacity=room.max_capacity,
        participants=[
            ParticipantResponse(
                id=p.id,
                display_name=p.display_name,
                is_host=p.is_host,
                connection_status=p.connection_status.value,
                joined_at=p.joined_at,
            )
            for p in room.participants.values()
        ],
        playback=PlaybackStateResponse(
            movie_title=room.playback.movie_title,
            is_playing=room.playback.is_playing,
            position=room.playback.position,
            last_update=room.playback.last_update,
            control_version=room.playback.control_version,
        ),
        expires_at=room.expires_at,
    )


@router.post("", response_model=CreateRoomResponse, status_code=201)
async def create_room(body: CreateRoomRequest, request: Request) -> CreateRoomResponse:
    room, participant = room_service.create_room(body.display_name)
    return CreateRoomResponse(
        room=_room_to_response(room),
        participant_id=participant.id,
        invitation_url=_build_invitation_url(request, room.code),
    )


@router.get("/{room_code}", response_model=RoomResponse)
async def get_room(room_code: str) -> RoomResponse:
    try:
        room = room_service.get_room(room_code)
    except RoomNotFoundError:
        raise HTTPException(status_code=404, detail="Room not found")
    except RoomClosedError as e:
        raise HTTPException(status_code=410, detail=str(e))
    return _room_to_response(room)


@router.post("/{room_code}/join", response_model=JoinRoomResponse)
async def join_room(room_code: str, body: JoinRoomRequest) -> JoinRoomResponse:
    try:
        room, participant = room_service.join_room(room_code, body.display_name)
    except RoomNotFoundError:
        raise HTTPException(status_code=404, detail="Room not found")
    except RoomClosedError as e:
        raise HTTPException(status_code=410, detail=str(e))
    except RoomFullError:
        raise HTTPException(status_code=403, detail="Room is full (maximum 5 participants)")
    return JoinRoomResponse(room=_room_to_response(room), participant_id=participant.id)


@router.post("/{room_code}/leave")
async def leave_room(room_code: str, body: LeaveRoomRequest) -> dict:
    try:
        room_service.leave_room(room_code, body.participant_id)
    except RoomNotFoundError:
        raise HTTPException(status_code=404, detail="Room not found")
    except RoomClosedError as e:
        raise HTTPException(status_code=410, detail=str(e))
    except ParticipantNotFoundError:
        raise HTTPException(status_code=404, detail="Participant not found")
    return {"success": True}


@router.post("/{room_code}/media-token", response_model=MediaTokenResponse)
async def get_media_token(room_code: str, body: MediaTokenRequest) -> MediaTokenResponse:
    """Return a scoped LiveKit token for a participant in this room."""
    try:
        room = room_service.get_room(room_code)
    except RoomNotFoundError:
        raise HTTPException(status_code=404, detail="Room not found")
    except RoomClosedError as e:
        raise HTTPException(status_code=410, detail=str(e))

    if body.participant_id not in room.participants:
        raise HTTPException(status_code=403, detail="Not a room participant")

    if not settings.livekit_api_key or not settings.livekit_api_secret:
        raise HTTPException(
            status_code=503,
            detail="LiveKit is not configured. Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET.",
        )

    participant = room.participants[body.participant_id]
    room_name = f"cine-together-{room.code}"
    token = (
        api.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        .with_identity(participant.id)
        .with_name(participant.display_name)
        .with_grants(api.VideoGrants(room_join=True, room=room_name))
        .to_jwt()
    )
    return MediaTokenResponse(
        token=token,
        livekit_url=settings.livekit_url,
        room_name=room_name,
    )
