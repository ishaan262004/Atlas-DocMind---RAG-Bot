import os
os.environ["ANONYMIZED_TELEMETRY"] = "false"
os.environ["CHROMA_TELEMETRY"]     = "false"

from langchain.schema import Document
from services.vectorstore import get_vectorstore, drop_collection
import logging

logger = logging.getLogger(__name__)


def create_collection_name(filename: str, session_id: str) -> str:
    """Generate a unique collection name for the vector store."""
    safe_name = "".join(c for c in filename if c.isalnum() or c in "_-")[:20]
    short_id = session_id[:8]
    return f"doc_{safe_name}_{short_id}"


def store_chunks(chunks: list[Document], collection_name: str):
    """Embed and store document chunks (pgvector or Chroma)."""
    logger.info(f"Storing {len(chunks)} chunks in collection: {collection_name}")

    vectorstore = get_vectorstore(collection_name)
    vectorstore.add_documents(chunks)

    logger.info(f"Successfully stored chunks in collection: {collection_name}")
    return vectorstore


def load_collection(collection_name: str):
    """Load an existing collection."""
    return get_vectorstore(collection_name)


def delete_collection(collection_name: str) -> bool:
    """Delete a collection and its vectors."""
    return drop_collection(collection_name)