"""Application authentication and screen APIs, backed by Supabase Postgres."""
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
from io import BytesIO
from uuid import uuid4
from urllib.parse import urlsplit

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Request, UploadFile
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from .models import User, Post, Like, Comment

hasher = PasswordHasher()


def key(settings):
    return hmac.new(settings.supabase_secret_key.get_secret_value().encode(), b'photo-feed-fastapi-token-v1', hashlib.sha256).digest()


def token_user(header, session, settings):
    try:
        if not header or not header.startswith('Bearer '):
            raise ValueError()
        payload = jwt.decode(header[7:], key(settings), algorithms=['HS256'], options={'require': ['sub', 'exp']})
        user = session.get(User, int(payload['sub']))
        if user is None:
            raise ValueError()
        return user
    except (jwt.PyJWTError, ValueError, KeyError, TypeError):
        raise HTTPException(401, '로그인이 필요합니다.') from None


def summary(user):
    return {'id': user.id, 'username': user.username, 'display_name': user.display_name, 'avatar_url': user.avatar_url}


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=4, max_length=256)
    display_name: str | None = Field(default=None, max_length=50)


class ProfileChange(BaseModel):
    display_name: str | None = Field(default=None, max_length=50)
    bio: str | None = Field(default=None, max_length=150)
    avatar_url: str | None = None


class CommentInput(BaseModel):
    body: str = Field(min_length=1, max_length=500)


def make_router(get_session):
    router = APIRouter(prefix='/api')

    def current(request: Request, authorization: str | None = Header(default=None), session=Depends(get_session)):
        return token_user(authorization, session, request.app.state.settings)

    def profile(user, session):
        return {**summary(user), 'bio': user.bio, 'post_count': session.scalar(select(func.count()).select_from(Post).where(Post.author_id == user.id))}

    def auth_response(user, request):
        token = jwt.encode({'sub': str(user.id), 'exp': datetime.now(timezone.utc) + timedelta(hours=24)}, key(request.app.state.settings), algorithm='HS256')
        return {'user': summary(user), 'access_token': token, 'token_type': 'bearer', 'expires_in': 86400}

    @router.post('/auth/register', status_code=201)
    def register(data: Credentials, request: Request, session=Depends(get_session)):
        username = data.username.strip().lower()
        name = (data.display_name or username).strip() or username
        if len(username) < 3:
            raise HTTPException(422, '사용자 이름은 3자 이상이어야 합니다.')
        user = User(username=username, display_name=name, password_hash=hasher.hash(data.password), bio='')
        session.add(user)
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            raise HTTPException(409, '이미 사용 중인 사용자 이름입니다.') from None
        session.refresh(user)
        return auth_response(user, request)

    @router.post('/auth/login')
    def login(data: Credentials, request: Request, session=Depends(get_session)):
        user = session.scalar(select(User).where(User.username == data.username.strip().lower()))
        try:
            valid = bool(user and hasher.verify(user.password_hash, data.password))
        except (VerifyMismatchError, InvalidHashError):
            valid = False
        if not valid:
            raise HTTPException(401, '사용자 이름 또는 비밀번호를 확인해 주세요.')
        return auth_response(user, request)

    @router.get('/users/me')
    def me(user=Depends(current), session=Depends(get_session)):
        return profile(user, session)

    @router.patch('/users/me')
    def edit_profile(data: ProfileChange, request: Request, user=Depends(current), session=Depends(get_session)):
        changes = data.model_dump(exclude_unset=True)
        if 'display_name' in changes:
            name = (changes['display_name'] or '').strip()
            if not name: raise HTTPException(422, '이름을 입력해 주세요.')
            user.display_name = name
        if 'bio' in changes: user.bio = changes['bio'] or ''
        if 'avatar_url' in changes:
            avatar = (changes['avatar_url'] or '').strip() or None
            prefix = request.app.state.settings.supabase_url + '/storage/v1/object/public/post-images/'
            if avatar and not avatar.startswith(prefix): raise HTTPException(422, 'Supabase Storage 사진 주소를 입력해 주세요.')
            user.avatar_url = avatar
        session.commit()
        return profile(user, session)

    @router.get('/users')
    def users(q: str = '', user=Depends(current), session=Depends(get_session)):
        statement = select(User).order_by(User.username)
        if q.strip():
            term = '%' + q.strip().replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
            statement = statement.where(User.username.ilike(term, escape='\\') | User.display_name.ilike(term, escape='\\'))
        return [summary(u) for u in session.scalars(statement)]

    @router.get('/users/by-username/{username}')
    def user_profile(username: str, user=Depends(current), session=Depends(get_session)):
        user = session.scalar(select(User).where(User.username == username.lower()))
        if not user: raise HTTPException(404, '사용자를 찾을 수 없습니다.')
        return profile(user, session)

    def get_post(post_id, session):
        post = session.get(Post, post_id)
        if not post: raise HTTPException(404, '게시물을 찾을 수 없습니다.')
        return post

    @router.post('/posts', status_code=201)
    async def create_post(request: Request, image: UploadFile = File(...), caption: str = Form(default='', max_length=2000), user=Depends(current), session=Depends(get_session)):
        data = await image.read(5 * 1024 * 1024 + 1)
        if len(data) > 5 * 1024 * 1024: raise HTTPException(413, '사진은 5MB 이하여야 합니다.')
        try:
            with Image.open(BytesIO(data)) as photo:
                fmt = photo.format
                photo.verify()
            mime = {'JPEG': 'image/jpeg', 'PNG': 'image/png', 'WEBP': 'image/webp'}[fmt]
        except (UnidentifiedImageError, OSError, KeyError, Image.DecompressionBombError):
            raise HTTPException(415, 'JPEG, PNG, WebP 사진을 선택해 주세요.') from None
        path = f'posts/{user.id}/{uuid4().hex}'
        storage = request.app.state.storage
        try:
            url = storage.upload(path, data, mime)
            post = Post(author_id=user.id, image_url=url, caption=caption)
            session.add(post)
            session.commit()
            session.refresh(post)
        except Exception:
            session.rollback()
            try: storage.delete(path)
            except Exception: pass
            raise HTTPException(503, '사진을 저장하지 못했습니다.') from None
        return {'id': post.id, 'author': summary(user), 'image_url': url, 'caption': post.caption, 'location': None, 'created_at': post.created_at, 'like_count': 0, 'comment_count': 0, 'is_liked': False}

    @router.put('/posts/{post_id}/like')
    def like(post_id: int, user=Depends(current), session=Depends(get_session)):
        get_post(post_id, session)
        session.execute(insert(Like).values(user_id=user.id, post_id=post_id).on_conflict_do_nothing(index_elements=['user_id', 'post_id']))
        session.commit()
        return {'like_count': session.scalar(select(func.count()).select_from(Like).where(Like.post_id == post_id)), 'is_liked': True}

    @router.delete('/posts/{post_id}/like')
    def unlike(post_id: int, user=Depends(current), session=Depends(get_session)):
        get_post(post_id, session)
        from sqlalchemy import delete
        session.execute(delete(Like).where(Like.post_id == post_id, Like.user_id == user.id))
        session.commit()
        return {'like_count': session.scalar(select(func.count()).select_from(Like).where(Like.post_id == post_id)), 'is_liked': False}

    @router.get('/posts/{post_id}/comments')
    def comments(post_id: int, user=Depends(current), session=Depends(get_session)):
        get_post(post_id, session)
        rows = session.execute(select(Comment, User).join(User, User.id == Comment.author_id).where(Comment.post_id == post_id).order_by(Comment.created_at, Comment.id))
        return [{'id': c.id, 'post_id': c.post_id, 'author': summary(u), 'body': c.body, 'created_at': c.created_at} for c, u in rows]

    @router.post('/posts/{post_id}/comments', status_code=201)
    def add_comment(post_id: int, data: CommentInput, user=Depends(current), session=Depends(get_session)):
        get_post(post_id, session)
        body = data.body.strip()
        if not body: raise HTTPException(422, '댓글을 입력해 주세요.')
        comment = Comment(post_id=post_id, author_id=user.id, body=body)
        session.add(comment); session.commit(); session.refresh(comment)
        return {'comment': {'id': comment.id, 'post_id': post_id, 'author': summary(user), 'body': body, 'created_at': comment.created_at}, 'comment_count': session.scalar(select(func.count()).select_from(Comment).where(Comment.post_id == post_id))}

    return router
