"""Vector store factory.

Uses pgvector (Postgres) when DATABASE_URL points at Postgres so embeddings
PERSIST across restarts; falls back to local ChromaDB for local dev.
"""
import logging
from config import settings
from services.llm import get_embeddings
from database import SQLALCHEMY_DATABASE_URL, IS_POSTGRES

logger = logging.getLogger(__name__)


def get_vectorstore(collection_name: str):
    """Return a vector store bound to `collection_name`."""
    embeddings = get_embeddings()

    if IS_POSTGRES:
        from langchain_community.vectorstores import PGVector

        return PGVector(
            connection_string=SQLALCHEMY_DATABASE_URL,
            collection_name=collection_name,
            embedding_function=embeddings,
        )

    from langchain_chroma import Chroma

    return Chroma(
        collection_name=collection_name,
        embedding_function=embeddings,
        persist_directory=str(settings.CHROMA_DIR),
    )


def drop_collection(collection_name: str) -> bool:
    """Delete an entire collection (PGVector or Chroma)."""
    try:
        store = get_vectorstore(collection_name)
        store.delete_collection()
        logger.info(f"Deleted collection: {collection_name}")
        return True
    except Exception as e:
        logger.error(f"Failed to delete collection {collection_name}: {e}")
        return False
