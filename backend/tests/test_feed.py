from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

import httpx
import pytest
from fastapi import HTTPException
from pydantic import SecretStr

from app.config import ConfigurationError, Settings, normalize_database_url, normalize_supabase_url
from app.main import create_app
from app.seed import sample_image
from app.storage import ensure_bucket


def test_database_url_keeps_special_password_characters():
    url = normalize_database_url("postgres://user:pa@ss!!@localhost:5432/postgres")
    assert url.drivername == "postgresql+pg8000"
    assert url.password == "pa@ss!!"
    assert url.host == "localhost"
    assert normalize_database_url("postgresql://user:pa%40ss@localhost/postgres").password == "pa@ss"
    with pytest.raises(ConfigurationError):
        normalize_database_url("sqlite:///local.db")
    assert normalize_supabase_url("https://example.supabase.co. ") == "https://example.supabase.co"


def test_feed_response_and_authorization():
    now = datetime.now(timezone.utc)
    post = SimpleNamespace(id=1, image_url="https://example.test/image.png", caption="hello", location=None, created_at=now)
    author = SimpleNamespace(id=2, username="student", display_name="Student", avatar_url=None)
    class Session:
        def execute(self, statement):
            return [(post, author, 3, 4)]
    app = create_app()
    app.state.settings = Settings(normalize_database_url('postgres://u:p@localhost/db'), 'https://example.test', SecretStr('secret'))
    route = next(route for route in app.routes if getattr(route, 'path', None) == '/api/posts')
    item = route.endpoint(session=Session(), q=None, author_id=None, authorization=None)[0].model_dump()
    assert item['author']['username'] == 'student'
    assert (item['like_count'], item['comment_count'], item['is_liked']) == (3, 4, False)
    assert 'password_hash' not in str(item)
    with pytest.raises(HTTPException) as error:
        route.endpoint(session=Session(), q=None, author_id=None, authorization='Bearer invalid')
    assert error.value.status_code == 401


def test_bucket_created_only_when_absent():
    requests = []
    def respond(request):
        requests.append(request.method)
        if len(requests) == 1:
            return httpx.Response(404)
        if request.method == 'POST':
            return httpx.Response(200, json={'name': 'post-images'})
        return httpx.Response(200, json={'public': True})
    settings = Settings(normalize_database_url('postgres://u:p@localhost/db'), 'https://example.test', SecretStr('secret'))
    original = httpx.Client
    with patch('app.storage.httpx.Client', side_effect=lambda **kwargs: original(transport=httpx.MockTransport(respond), **kwargs)):
        storage = ensure_bucket(settings)
        storage.close()
    assert requests == ['GET', 'POST', 'GET']
    assert sample_image(0).startswith(b'\x89PNG')
