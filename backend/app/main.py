"""Run with uv run uvicorn app.main:app from the backend directory."""

from contextlib import asynccontextmanager
import logging
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy import func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .config import ConfigurationError, load_settings
from .database import DatabaseInitializationError, create_database, initialize_database
from .models import Comment, Like, Post, User
from .schemas import AuthorResponse, PostResponse
from .seed import seed_database
from .storage import ensure_bucket


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine = None
    storage = None
    try:
        settings = load_settings()
        engine, session_factory = create_database(settings)
        initialize_database(engine)
        storage = ensure_bucket(settings)
        seed_database(session_factory, storage)
        app.state.session_factory = session_factory
        app.state.storage = storage
        app.state.settings = settings
        logger.info("Supabase 초기화 완료: 공개 피드 API를 사용할 수 있습니다.")
    except (ConfigurationError, DatabaseInitializationError) as exc:
        if engine is not None:
            engine.dispose()
        raise RuntimeError(str(exc)) from None
    except Exception:
        if engine is not None:
            engine.dispose()
        raise RuntimeError(
            "Supabase 초기화에 실패했습니다. backend/.env의 연결 정보, 테이블 소유권과 Storage 권한을 확인해 주세요."
        ) from None
    try:
        yield
    finally:
        engine.dispose()
        if storage is not None and hasattr(storage, "close"):
            storage.close()


def get_session(request: Request):
    with request.app.state.session_factory() as session:
        yield session


def create_app() -> FastAPI:
    application = FastAPI(title="사진 피드 API", version="0.1.0", lifespan=lifespan)

    @application.exception_handler(SQLAlchemyError)
    async def database_unavailable(_request: Request, _error: SQLAlchemyError):
        logger.warning("게시물 조회 중 데이터베이스 요청이 실패했습니다.")
        return JSONResponse(status_code=503, content={"detail": "게시물을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요."})

    @application.get("/api/posts", response_model=list[PostResponse])
    def list_posts(
        session: Annotated[Session, Depends(get_session)],
        q: Annotated[str | None, Query(max_length=2000)] = None,
        author_id: Annotated[int | None, Query(gt=0)] = None,
        authorization: Annotated[str | None, Header()] = None,
    ):
        from .routes import token_user
        user = token_user(authorization, session, application.state.settings) if authorization else None
        like_count = select(func.count(Like.id)).where(Like.post_id == Post.id).correlate(Post).scalar_subquery()
        comment_count = select(func.count(Comment.id)).where(Comment.post_id == Post.id).correlate(Post).scalar_subquery()
        statement = (
            select(Post, User, like_count.label("like_count"), comment_count.label("comment_count"))
            .join(User, User.id == Post.author_id)
            .order_by(Post.created_at.desc(), Post.id.desc())
        )
        if author_id is not None:
            statement = statement.where(Post.author_id == author_id)
        if q and q.strip():
            term = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            pattern = f"%{term}%"
            statement = statement.where(or_(User.username.ilike(pattern, escape="\\"), Post.caption.ilike(pattern, escape="\\")))
        return [
            PostResponse(
                id=post.id,
                author=AuthorResponse(id=author.id, username=author.username, display_name=author.display_name, avatar_url=author.avatar_url),
                image_url=post.image_url,
                caption=post.caption,
                location=post.location,
                created_at=post.created_at,
                like_count=likes,
                comment_count=comments,
                is_liked=bool(session.scalar(select(Like.id).where(Like.post_id == post.id, Like.user_id == user.id))) if user else False,
            )
            for post, author, likes, comments in session.execute(statement)
        ]

    from .routes import make_router
    application.include_router(make_router(get_session))
    return application


app = create_app()
