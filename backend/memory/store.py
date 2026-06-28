import os
os.environ["ANONYMIZED_TELEMETRY"] = "false"
os.environ["CHROMA_TELEMETRY"]     = "false"

from sqlalchemy.orm import Session
from langchain.schema import Document
from database import MemoryEntry
from services.vectorstore import get_vectorstore
from config import settings
import logging
import uuid

logger = logging.getLogger(__name__)

MEMORY_COLLECTION = "nexus_long_term_memory"

# Two facts whose vectors are at least this similar are treated as duplicates.
DEDUP_THRESHOLD = 0.92


def get_memory_vectorstore():
    """Get or create the memory vector store (pgvector or Chroma)."""
    return get_vectorstore(MEMORY_COLLECTION)


def _is_duplicate(fact: str, client_id: str) -> bool:
    """True if a near-identical fact already exists for this client."""
    if not client_id:
        return False
    try:
        vectorstore = get_memory_vectorstore()
        results = vectorstore.similarity_search_with_relevance_scores(
            query=fact,
            k=1,
            filter={"client_id": client_id},
        )
        if results and results[0][1] >= DEDUP_THRESHOLD:
            logger.info(f"Skipping duplicate memory: {fact[:50]}...")
            return True
    except Exception as e:
        logger.warning(f"Dedup check failed: {e}")
    return False


def store_memory(
    db: Session,
    session_id: str,
    fact: str,
    category: str = "general",
    confidence: float = 1.0,
    source_message: str = None,
    client_id: str = None,
    dedup: bool = True,
) -> MemoryEntry:
    """Store a memory fact in both SQLite and ChromaDB (deduplicated)."""
    if dedup and _is_duplicate(fact, client_id):
        return None

    embedding_id = str(uuid.uuid4())

    entry = MemoryEntry(
        session_id=session_id,
        client_id=client_id,
        fact=fact,
        category=category,
        embedding_id=embedding_id,
        confidence=confidence,
        source_message=source_message,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    vectorstore = get_memory_vectorstore()
    vectorstore.add_documents(
        documents=[
            Document(
                page_content=fact,
                metadata={
                    "session_id": session_id,
                    "client_id": client_id or "",
                    "category": category,
                    "memory_id": str(entry.id),
                    "confidence": confidence,
                },
            )
        ],
        ids=[embedding_id],
    )

    logger.info(f"Stored memory [{category}]: {fact[:60]}...")
    return entry


def retrieve_relevant_memories(
    query: str,
    session_id: str = None,
    client_id: str = None,
    k: int = None,
) -> list[str]:
    """Retrieve semantically relevant memories, scoped to the client when given."""
    k = k or settings.MEMORY_RETRIEVAL_K

    try:
        vectorstore = get_memory_vectorstore()

        # Prefer cross-session client scope; fall back to session scope.
        flt = {"client_id": client_id} if client_id else {"session_id": session_id}

        results = vectorstore.similarity_search_with_relevance_scores(
            query=query,
            k=k,
            filter=flt,
        )

        relevant = [doc.page_content for doc, score in results if score > 0.3]
        logger.info(
            f"Retrieved {len(relevant)} relevant memories for: '{query[:40]}'"
        )
        return relevant

    except Exception as e:
        logger.error(f"Memory retrieval failed: {e}")
        return []


def get_all_memories(db: Session, session_id: str) -> list[MemoryEntry]:
    """Get all memories for a session."""
    return (
        db.query(MemoryEntry)
        .filter(MemoryEntry.session_id == session_id)
        .order_by(MemoryEntry.created_at.desc())
        .all()
    )


def get_client_memories(db: Session, client_id: str) -> list[MemoryEntry]:
    """Get all memories for a client across every session (cross-session recall)."""
    if not client_id:
        return []
    return (
        db.query(MemoryEntry)
        .filter(MemoryEntry.client_id == client_id)
        .order_by(MemoryEntry.created_at.desc())
        .limit(300)
        .all()
    )


def get_global_memories(db: Session) -> list[MemoryEntry]:
    """Get all memories across all sessions."""
    return (
        db.query(MemoryEntry)
        .order_by(MemoryEntry.created_at.desc())
        .limit(100)
        .all()
    )


def update_memory(
    db: Session,
    memory_id: int,
    fact: str = None,
    category: str = None,
) -> MemoryEntry:
    """Edit a memory's fact/category and keep the vector store in sync."""
    entry = db.query(MemoryEntry).filter(MemoryEntry.id == memory_id).first()
    if not entry:
        return None

    if category is not None:
        entry.category = category

    fact_changed = fact is not None and fact.strip() and fact != entry.fact
    if fact_changed:
        entry.fact = fact.strip()

    db.commit()
    db.refresh(entry)

    # Re-embed if the text changed.
    if fact_changed and entry.embedding_id:
        try:
            vectorstore = get_memory_vectorstore()
            vectorstore.delete(ids=[entry.embedding_id])
            vectorstore.add_documents(
                documents=[
                    Document(
                        page_content=entry.fact,
                        metadata={
                            "session_id": entry.session_id,
                            "client_id": entry.client_id or "",
                            "category": entry.category,
                            "memory_id": str(entry.id),
                            "confidence": entry.confidence,
                        },
                    )
                ],
                ids=[entry.embedding_id],
            )
        except Exception as e:
            logger.warning(f"Could not re-embed updated memory: {e}")

    return entry


def delete_memory(db: Session, memory_id: int) -> bool:
    """Delete a specific memory entry."""
    entry = db.query(MemoryEntry).filter(MemoryEntry.id == memory_id).first()
    if not entry:
        return False

    if entry.embedding_id:
        try:
            vectorstore = get_memory_vectorstore()
            vectorstore.delete(ids=[entry.embedding_id])
        except Exception as e:
            logger.warning(f"Could not delete from ChromaDB: {e}")

    db.delete(entry)
    db.commit()
    return True
