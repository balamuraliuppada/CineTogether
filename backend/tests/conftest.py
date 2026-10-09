import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.room_service import room_service


@pytest.fixture(autouse=True)
def clear_rooms():
    room_service._rooms.clear()
    yield
    room_service._rooms.clear()


@pytest.fixture
def client():
    return TestClient(app)
