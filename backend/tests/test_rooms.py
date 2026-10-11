import pytest


def test_create_room(client):
    response = client.post("/api/v1/rooms", json={"display_name": "Alice"})
    assert response.status_code == 201
    data = response.json()
    assert len(data["room"]["code"]) == 6
    assert data["room"]["code"].isalnum()
    assert data["participant_id"]
    assert data["invitation_url"]
    assert data["room"]["participant_count"] == 1
    assert data["room"]["host_id"] == data["participant_id"]


def test_get_room(client):
    create = client.post("/api/v1/rooms", json={"display_name": "Host"}).json()
    code = create["room"]["code"]
    response = client.get(f"/api/v1/rooms/{code}")
    assert response.status_code == 200
    assert response.json()["code"] == code


def test_invalid_room_code(client):
    response = client.get("/api/v1/rooms/INVALID")
    assert response.status_code == 404


def test_join_room(client):
    create = client.post("/api/v1/rooms", json={"display_name": "Host"}).json()
    code = create["room"]["code"]
    response = client.post(f"/api/v1/rooms/{code}/join", json={"display_name": "Bob"})
    assert response.status_code == 200
    data = response.json()
    assert data["participant_id"]
    assert data["room"]["participant_count"] == 2


def test_room_full(client):
    create = client.post("/api/v1/rooms", json={"display_name": "Host"}).json()
    code = create["room"]["code"]
    for i in range(4):
        client.post(f"/api/v1/rooms/{code}/join", json={"display_name": f"Guest{i}"})
    response = client.post(f"/api/v1/rooms/{code}/join", json={"display_name": "Overflow"})
    assert response.status_code == 403
    assert "full" in response.json()["detail"].lower()


def test_duplicate_display_names(client):
    create = client.post("/api/v1/rooms", json={"display_name": "Alice"}).json()
    code = create["room"]["code"]
    client.post(f"/api/v1/rooms/{code}/join", json={"display_name": "Bob"})
    join2 = client.post(f"/api/v1/rooms/{code}/join", json={"display_name": "Bob"}).json()
    names = [p["display_name"] for p in join2["room"]["participants"]]
    assert "Bob" in names
    assert "Bob (2)" in names


def test_leave_room(client):
    create = client.post("/api/v1/rooms", json={"display_name": "Host"}).json()
    code = create["room"]["code"]
    host_id = create["participant_id"]
    join = client.post(f"/api/v1/rooms/{code}/join", json={"display_name": "Guest"}).json()
    guest_id = join["participant_id"]

    response = client.post(f"/api/v1/rooms/{code}/leave", json={"participant_id": guest_id})
    assert response.status_code == 200

    room = client.get(f"/api/v1/rooms/{code}").json()
    assert room["participant_count"] == 1


def test_host_leave_closes_room(client):
    create = client.post("/api/v1/rooms", json={"display_name": "Host"}).json()
    code = create["room"]["code"]
    host_id = create["participant_id"]
    client.post(f"/api/v1/rooms/{code}/join", json={"display_name": "Guest"})

    client.post(f"/api/v1/rooms/{code}/leave", json={"participant_id": host_id})
    response = client.get(f"/api/v1/rooms/{code}")
    assert response.status_code == 410


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_websocket_chat_is_sanitized_and_replayed(client):
    create = client.post("/api/v1/rooms", json={"display_name": "Alice"}).json()
    code = create["room"]["code"]
    participant_id = create["participant_id"]

    with client.websocket_connect(f"/ws/rooms/{code}?participant_id={participant_id}") as websocket:
        assert websocket.receive_json()["type"] == "playback_state"
        assert websocket.receive_json()["type"] == "chat_history"
        assert websocket.receive_json()["type"] == "participant_joined"

        websocket.send_json(
            {
                "type": "chat_message",
                "payload": {"content": "  <b>Hello</b>  ", "sender_name": "Spoofed"},
            }
        )
        event = websocket.receive_json()

        assert event["type"] == "chat_message"
        assert event["payload"]["sender_name"] == "Alice"
        assert event["payload"]["content"] == "&lt;b&gt;Hello&lt;/b&gt;"
        assert event["payload"]["id"]

    with client.websocket_connect(f"/ws/rooms/{code}?participant_id={participant_id}") as websocket:
        assert websocket.receive_json()["type"] == "playback_state"
        history = websocket.receive_json()
        assert history["type"] == "chat_history"
        assert history["payload"]["messages"][0]["content"] == "&lt;b&gt;Hello&lt;/b&gt;"


def test_playback_update_keeps_participants_joined_after_websocket_open(client):
    create = client.post("/api/v1/rooms", json={"display_name": "Host"}).json()
    code = create["room"]["code"]
    host_id = create["participant_id"]
    guest = client.post(f"/api/v1/rooms/{code}/join", json={"display_name": "Guest"}).json()

    with client.websocket_connect(f"/ws/rooms/{code}?participant_id={host_id}") as websocket:
        assert websocket.receive_json()["type"] == "playback_state"
        assert websocket.receive_json()["type"] == "chat_history"
        assert websocket.receive_json()["type"] == "participant_joined"
        websocket.send_json({"type": "movie_selected", "payload": {"title": "movie.mp4"}})
        assert websocket.receive_json()["type"] == "movie_selected"

    room = client.get(f"/api/v1/rooms/{code}").json()
    assert {participant["id"] for participant in room["participants"]} == {host_id, guest["participant_id"]}
    assert room["playback"]["movie_title"] == "movie.mp4"
