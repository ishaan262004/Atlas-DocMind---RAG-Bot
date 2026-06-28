import os
os.environ["ANONYMIZED_TELEMETRY"] = "false"
os.environ["CHROMA_TELEMETRY"] = "false"
os.environ["POSTHOG_DISABLED"] = "true"

from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Float,
    text,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import logging
from config import settings

logger = logging.getLogger(__name__)

# Normalize the DB URL so SQLAlchemy uses the psycopg2 driver for Postgres
# (Supabase gives "postgresql://..."). SQLite stays as-is for local dev.
_db_url = settings.DATABASE_URL
if _db_url.startswith("postgres://"):
    _db_url = _db_url.replace("postgres://", "postgresql+psycopg2://", 1)
elif _db_url.startswith("postgresql://"):
    _db_url = _db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

SQLALCHEMY_DATABASE_URL = _db_url
IS_POSTGRES = _db_url.startswith("postgresql")

if IS_POSTGRES:
    # Poolers drop idle connections — pre_ping + recycle keeps them healthy.
    engine = create_engine(
        _db_url,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=5,
        max_overflow=10,
    )
else:
    engine = create_engine(
        _db_url,
        connect_args={"check_same_thread": False},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, index=True)
    # Per-browser owner id (sent by the client). Scopes sessions so each
    # visitor only sees their own chats — no cross-user leakage.
    client_id = Column(String, index=True, nullable=True)
    title = Column(String, default="New Chat")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True)
    role = Column(String)  # "user" or "assistant"
    content = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)


class MemoryEntry(Base):
    __tablename__ = "memory_entries"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True)
    # Owner of the memory — enables cross-session recall scoped per browser.
    client_id = Column(String, index=True, nullable=True)
    fact = Column(Text)
    category = Column(String, default="general")
    embedding_id = Column(String, nullable=True)
    confidence = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    source_message = Column(Text, nullable=True)


class UploadedDocument(Base):
    __tablename__ = "uploaded_documents"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True)
    filename = Column(String)
    file_path = Column(String)
    storage_path = Column(String, nullable=True)  # object key in Supabase Storage
    chunk_count = Column(Integer, default=0)
    collection_name = Column(String)
    uploaded_at = Column(DateTime, default=datetime.utcnow)


def _run_light_migrations():
    """Add columns that were introduced after a table was first created.
    create_all() never ALTERs existing tables, so on a long-lived Postgres DB
    we patch in new nullable columns idempotently."""
    if not IS_POSTGRES:
        return  # local SQLite is recreated from the models anyway
    stmts = [
        "ALTER TABLE uploaded_documents ADD COLUMN IF NOT EXISTS storage_path VARCHAR",
        "ALTER TABLE memory_entries ADD COLUMN IF NOT EXISTS client_id VARCHAR",
        "ALTER TABLE memory_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
        "ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS client_id VARCHAR",
    ]
    try:
        with engine.begin() as conn:
            for s in stmts:
                conn.execute(text(s))
        logger.info("✅ Light migrations applied")
    except Exception as e:
        logger.warning(f"Light migration skipped: {e}")


def init_db():
    Base.metadata.create_all(bind=engine)
    _run_light_migrations()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()