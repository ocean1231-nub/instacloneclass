"""PostgreSQL connections and idempotent startup schema initialization."""

import ssl
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.schema import CreateSchema

from .config import Settings
from .models import Base


TABLE_NAMES = ("users", "posts", "likes", "comments")
INITIALIZATION_LOCK = 718035014


class DatabaseInitializationError(RuntimeError):
    """Safe messages for schema or role configuration problems."""


def create_database(settings: Settings) -> tuple[Engine, sessionmaker[Session]]:
    engine = create_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=0,
        echo=False,
        hide_parameters=True,
        # Match the original libpq sslmode=require: encrypt the connection.
        # Supplying a trusted CA is required for certificate verification.
        connect_args={"ssl_context": ssl._create_unverified_context(), "timeout": 10},
    )
    return engine, sessionmaker(bind=engine, expire_on_commit=False)


def initialize_database(engine: Engine) -> None:
    """Create missing tables, then enforce owner-only access without policies.

    The transaction lock prevents two development reloads racing to create the
    same table. Existing rows, schema definitions, owners and policies are not
    replaced. Existing policies require an explicit decision by the operator.
    """
    with engine.begin() as connection:
        connection.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": INITIALIZATION_LOCK})
        connection.execute(CreateSchema("app", if_not_exists=True))
        Base.metadata.create_all(connection)
        owners = connection.execute(text(
            "SELECT c.relname, pg_get_userbyid(c.relowner) = current_user AS is_owner "
            "FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
            "WHERE n.nspname = 'app' AND c.relname IN ('users', 'posts', 'likes', 'comments') "
            "AND c.relkind = 'r'"
        )).mappings().all()
        if len(owners) != len(TABLE_NAMES) or any(not row["is_owner"] for row in owners):
            raise DatabaseInitializationError(
                "DATABASE_URL은 app 테이블을 소유한 PostgreSQL 계정으로 연결해야 합니다."
            )
        policy_count = connection.scalar(text(
            "SELECT count(*) FROM pg_policies WHERE schemaname = 'app' "
            "AND tablename IN ('users', 'posts', 'likes', 'comments')"
        ))
        if policy_count:
            raise DatabaseInitializationError(
                "app 테이블에 기존 RLS 정책이 있습니다. 정책 없는 수업용 구성인지 확인해 주세요."
            )
        client_roles = connection.scalars(text(
            "SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')"
        )).all()
        for table_name in TABLE_NAMES:
            # Identifiers come only from the fixed, application-owned list.
            connection.execute(text(f'ALTER TABLE app."{table_name}" ENABLE ROW LEVEL SECURITY'))
            connection.execute(text(f'ALTER TABLE app."{table_name}" NO FORCE ROW LEVEL SECURITY'))
            connection.execute(text(f'REVOKE ALL ON TABLE app."{table_name}" FROM PUBLIC'))
            for role in client_roles:
                connection.execute(text(f'REVOKE ALL ON TABLE app."{table_name}" FROM "{role}"'))
