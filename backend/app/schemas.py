"""Public API responses; password hashes are deliberately not exposed."""

from datetime import datetime, timezone

from pydantic import BaseModel, field_serializer


class AuthorResponse(BaseModel):
    id: int
    username: str
    display_name: str
    avatar_url: str | None


class PostResponse(BaseModel):
    id: int
    author: AuthorResponse
    image_url: str
    caption: str
    location: str | None
    created_at: datetime
    like_count: int
    comment_count: int
    is_liked: bool = False

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
