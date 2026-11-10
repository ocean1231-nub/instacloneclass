from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

import httpx
import jwt
import pytest
from fastapi import HTTPException
from pydantic import SecretStr

from app.config import ConfigurationError, Settings, normalize_database_url, normalize_supabase_url
from app.main import create_app, get_session
from app.routes import key, make_router
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
        def get(self, model, user_id):
            return author if user_id == author.id else None
        def scalar(self, statement):
            return None
    app = create_app()
    app.state.settings = Settings(normalize_database_url('postgres://u:p@localhost/db'), 'https://example.test', SecretStr('secret'))
    route = next(route for route in app.routes if getattr(route, 'path', None) == '/api/posts')
    token = jwt.encode({'sub': str(author.id), 'exp': datetime.now(timezone.utc).timestamp() + 3600}, key(app.state.settings), algorithm='HS256')
    item = route.endpoint(session=Session(), q=None, author_id=None, authorization=f'Bearer {token}')[0].model_dump()
    assert item['author']['username'] == 'student'
    assert (item['like_count'], item['comment_count'], item['is_liked']) == (3, 4, False)
    assert 'password_hash' not in str(item)
    for authorization in (None, 'Bearer invalid'):
        with pytest.raises(HTTPException) as error:
            route.endpoint(session=Session(), q=None, author_id=None, authorization=authorization)
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


def test_read_endpoints_require_authentication():
    router = make_router(get_session)
    for path in ('/api/users', '/api/users/by-username/{username}', '/api/posts/{post_id}/comments', '/api/users/me'):
        route = next(route for route in router.routes if getattr(route, 'path', None) == path and 'GET' in route.methods)
        assert any(getattr(dependency.call, '__name__', '') == 'current' for dependency in route.dependant.dependencies), path
