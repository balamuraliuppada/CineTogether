# CineTogether

A real-time watch-party platform where friends watch movies together with synchronized playback, live video calling, and chat.

## Architecture Overview

| Layer        | Technology                           | Purpose                                        |
| ------------ | ------------------------------------ | ---------------------------------------------- |
| Frontend     | React + Vite + TypeScript + Tailwind | UI, local movie playback, media client         |
| Backend      | FastAPI + Python                     | Room management, auth tokens, WebSocket events |
| Video/Audio  | LiveKit (Phase 2+)                   | Participant camera/microphone via SFU          |
| Movie Stream | LiveKit tracks (Phase 3)             | Host movie audio/video as separate tracks      |

### Movie Delivery Design (Phase 3)

The host selects a local video file and plays it in an HTML5 `<video>` element. The movie's audio/video will be captured via `HTMLCanvasElement.captureStream()` + `MediaStreamDestination` and published as **dedicated LiveKit tracks** (`movie-video`, `movie-audio`), separate from the host's camera and microphone tracks.

Playback synchronization uses WebSocket events (`playback_play`, `playback_pause`, `playback_seek`, `playback_state`) with server timestamps — the SFU forwards media but does not sync playback.

**Trade-offs:** Canvas capture works in Chrome/Firefox/Edge but may have slight quality loss and ~16ms frame timing. Safari support is limited. Alternative: host-served chunked HTTP streaming (more complex, better quality).

## Current Status — Phase 5

- [x] Landing page with create/join room
- [x] Room APIs (create, join, leave, get info)
- [x] Watch room layout (movie player, video grid placeholders, chat UI)
- [x] Host local movie selection and playback
- [x] LiveKit video calling (Phase 2)
- [x] Shared movie streaming to remote participants (Phase 3)
- [x] Real-time chat via WebSocket (Phase 4)
- [x] Playback synchronization (Phase 3)
- [x] PostgreSQL persistence and Redis WebSocket fan-out (Phase 5)

## Prerequisites

- Node.js 18+
- Python 3.11+
- (Phase 2+) LiveKit Cloud account or self-hosted LiveKit server

## Setup

### Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173

### Docker Compose

Docker Compose runs FastAPI behind an Nginx-served production frontend. The frontend proxies `/api` and `/ws` to the backend, so only one port needs to be exposed.

```powershell
Copy-Item backend/.env.example backend/.env
# Edit backend/.env and set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.
docker compose up --build -d
```

Open http://localhost. For a deployed domain, set `ALLOWED_ORIGINS` in `backend/.env` to the exact browser origin, for example `https://watch.example.com`, before starting Compose.

Useful commands:

```bash
docker compose logs -f
docker compose down
```

Compose starts PostgreSQL and Redis with persistent volumes, so multiple backend replicas can share room state and WebSocket events. Configure HTTPS at the hosting platform or reverse proxy before exposing the app publicly.

## Environment Variables

See `backend/.env.example` and `frontend/.env.example`.

## Running Tests

```bash
cd backend
pytest tests/ -v
```

## API Endpoints

| Method | Path                               | Description                     |
| ------ | ---------------------------------- | ------------------------------- |
| POST   | `/api/v1/rooms`                    | Create a room                   |
| GET    | `/api/v1/rooms/{code}`             | Get room info                   |
| POST   | `/api/v1/rooms/{code}/join`        | Join a room                     |
| POST   | `/api/v1/rooms/{code}/leave`       | Leave a room                    |
| POST   | `/api/v1/rooms/{code}/media-token` | Get LiveKit token (Phase 2)     |
| WS     | `/ws/rooms/{code}`                 | Real-time room events (Phase 4) |

## Security Notes

- Room codes are cryptographically random 6-character alphanumeric strings.
- Host-only playback controls are enforced server-side (Phase 3).
- LiveKit API secrets never reach the frontend.
- Chat messages are validated, sanitized, and bounded server-side (Phase 4).

## License

MIT
