"""Read server-only configuration without including secrets in errors."""

from dataclasses import dataclass, field
from pathlib import Path
import os
from typing import Mapping
from urllib.parse import parse_qsl, unquote, urlsplit

from dotenv import dotenv_values
from pydantic import SecretStr
from sqlalchemy.engine import URL


BACKEND_DIR = Path(__file__).resolve().parents[1]


class ConfigurationError(ValueError):
    """A configuration problem with a safe, user-facing error message."""


def normalize_database_url(value: str) -> URL:
    """Use pg8000 and preserve passwords containing a literal @ character.

    Supabase passwords may contain @. Split the final host separator before
    parsing the endpoint, then use URL.create so SQLAlchemy does not re-parse
    the password. Percent-encoded passwords work as well.
    """
    try:
        scheme, remainder = value.strip().split("://", 1)
        if scheme not in {"postgres", "postgresql", "postgresql+psycopg"}:
            raise ValueError
        credentials, endpoint = remainder.rsplit("@", 1)
        username, password = credentials.split(":", 1)
        parsed = urlsplit("postgresql://" + endpoint)
        database = unquote(parsed.path.lstrip("/"))
        if (
            not username
            or not password
            or not parsed.hostname
            or not database
            or "/" in database
            or parsed.fragment
            or parsed.username
        ):
            raise ValueError
        port = parsed.port or 5432
        if not 1 <= port <= 65535:
            raise ValueError
        return URL.create(
            drivername="postgresql+pg8000",
            username=unquote(username),
            password=unquote(password),
            host=parsed.hostname,
            port=port,
            database=database,
            query=dict(parse_qsl(parsed.query, keep_blank_values=True)),
        )
    except (ValueError, TypeError):
        raise ConfigurationError(
            "DATABASE_URL 형식을 확인해 주세요. Supabase Session pooler 연결 문자열이 필요합니다."
        ) from None


def normalize_supabase_url(value: str) -> str:
    # A URL copied from prose can carry a final period or nonbreaking space.
    normalized = value.strip().rstrip("/").rstrip(".")
    try:
        parsed = urlsplit(normalized)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError
        _ = parsed.port
    except (ValueError, TypeError):
        raise ConfigurationError(
            "SUPABASE_URL에 프로젝트의 HTTPS Project URL을 입력해 주세요."
        ) from None
    return normalized


@dataclass(frozen=True)
class Settings:
    database_url: URL = field(repr=False)
    supabase_url: str
    supabase_secret_key: SecretStr = field(repr=False)


def load_settings(
    env_file: Path | None = None,
    environ: Mapping[str, str] | None = None,
) -> Settings:
    """Read backend/.env regardless of the shell's current directory."""
    values = dict(dotenv_values(env_file or BACKEND_DIR / ".env"))
    values.update(os.environ if environ is None else environ)
    required = ("DATABASE_URL", "SUPABASE_URL", "SUPABASE_SECRET_KEY")
    missing = [key for key in required if not (values.get(key) or "").strip()]
    if missing:
        raise ConfigurationError(
            "backend/.env를 작성해 주세요. 필요한 값: " + ", ".join(missing)
        )
    if any("YOUR_" in str(values[key]) for key in required):
        raise ConfigurationError(
            "backend/.env의 예시 값을 실제 Supabase 프로젝트 값으로 바꿔 주세요."
        )
    return Settings(
        database_url=normalize_database_url(str(values["DATABASE_URL"])),
        supabase_url=normalize_supabase_url(str(values["SUPABASE_URL"])),
        supabase_secret_key=SecretStr(str(values["SUPABASE_SECRET_KEY"]).strip()),
    )
