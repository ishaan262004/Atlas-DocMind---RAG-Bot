from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from config import settings
import logging

logger = logging.getLogger(__name__)


def chunk_documents(documents: list[Document]) -> list[Document]:
    """
    Split documents into semantic chunks for embedding.

    Strategy:
    - Primary separator: double newline (paragraph breaks)
    - Secondary: single newline
    - Tertiary: sentence boundary
    - Final: character-level split
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", "! ", "? ", " ", ""],
        length_function=len,
        add_start_index=True,
    )

    chunks = splitter.split_documents(documents)

    # Enrich chunk metadata
    for i, chunk in enumerate(chunks):
        chunk.metadata["chunk_index"] = i
        chunk.metadata["chunk_count"] = len(chunks)
        if "page" not in chunk.metadata:
            chunk.metadata["page"] = 0

    logger.info(
        f"Created {len(chunks)} chunks from {len(documents)} documents "
        f"(avg size: {sum(len(c.page_content) for c in chunks) // max(len(chunks), 1)} chars)"
    )

    return chunks