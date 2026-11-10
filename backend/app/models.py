"""The four application tables described in docs/database.md."""

from datetime import datetime

from sqlalchemy import (
    CheckConstraint, DateTime, ForeignKey, Identity, Index, Integer,
    MetaData, String, Text, UniqueConstraint, func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    metadata = MetaData(
        schema="app",
        naming_convention={
            "ix": "ix_%(table_name)s_%(column_0_name)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        },
    )


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("char_length(username) BETWEEN 3 AND 30", name="username_length"),
        CheckConstraint("username = lower(btrim(username))", name="username_normalized"),
        CheckConstraint("char_length(btrim(display_name)) BETWEEN 1 AND 50", name="display_name_length"),
        CheckConstraint("char_length(password_hash) > 0", name="password_hash_not_empty"),
    )

    id: Mapped[int] = mapped_column(Integer, Identity(), primary_key=True)
    username: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str] = mapped_column(String(50), nullable=False)
    bio: Mapped[str] = mapped_column(String(150), nullable=False, default="", server_default="")
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class Post(Base):
    __tablename__ = "posts"
    __table_args__ = (
        CheckConstraint("char_length(btrim(image_url)) > 0", name="image_url_not_empty"),
    )

    id: Mapped[int] = mapped_column(Integer, Identity(), primary_key=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("app.users.id", ondelete="RESTRICT"), nullable=False)
    image_url: Mapped[str] = mapped_column(Text, nullable=False)
    caption: Mapped[str] = mapped_column(String(2000), nullable=False, default="", server_default="")
    location: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class Like(Base):
    __tablename__ = "likes"
    __table_args__ = (UniqueConstraint("user_id", "post_id", name="uq_likes_user_post"),)

    id: Mapped[int] = mapped_column(Integer, Identity(), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("app.users.id", ondelete="RESTRICT"), nullable=False)
    post_id: Mapped[int] = mapped_column(ForeignKey("app.posts.id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class Comment(Base):
    __tablename__ = "comments"
    __table_args__ = (
        CheckConstraint("char_length(btrim(body)) BETWEEN 1 AND 500", name="body_length"),
    )

    id: Mapped[int] = mapped_column(Integer, Identity(), primary_key=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("app.users.id", ondelete="RESTRICT"), nullable=False)
    post_id: Mapped[int] = mapped_column(ForeignKey("app.posts.id", ondelete="RESTRICT"), nullable=False)
    body: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


Index("ix_posts_created_at_id", Post.created_at.desc(), Post.id.desc())
Index("ix_posts_author_created_at_id", Post.author_id, Post.created_at.desc(), Post.id.desc())
Index("ix_likes_post_id", Like.post_id)
Index("ix_comments_post_created_at_id", Comment.post_id, Comment.created_at, Comment.id)
Index("ix_comments_author_id", Comment.author_id)
