from langchain_chroma import Chroma
from langchain.schema import Document
from rag.embeddings import load_collection
from config import settings
import logging

logger = logging.getLogger(__name__)


def retrieve_relevant_chunks(
    query: str,
    collection_name: str,
    k: int = None,
) -> list[Document]:
    """
    Retrieve the most semantically relevant document chunks.

    Uses MMR (Maximum Marginal Relevance) to balance:
    - relevance to query
    - diversity of results
    """
    k = k or settings.RETRIEVAL_K

    try:
        vectorstore = load_collection(collection_name)

        # Prefer MMR for diverse, relevant results; fall back to plain
        # similarity if the backend (e.g. pgvector) doesn't support MMR.
        try:
            retriever = vectorstore.as_retriever(
                search_type="mmr",
                search_kwargs={
                    "k": k,
                    "fetch_k": k * 3,
                    "lambda_mult": 0.7,
                },
            )
            docs = retriever.invoke(query)
        except Exception as mmr_err:
            logger.warning(f"MMR unavailable, using similarity: {mmr_err}")
            docs = vectorstore.similarity_search(query, k=k)

        logger.info(
            f"Retrieved {len(docs)} chunks for query: '{query[:50]}...'"
        )

        return docs

    except Exception as e:
        logger.error(f"Retrieval failed for collection {collection_name}: {e}")
        return []


def format_context_from_docs(docs: list[Document]) -> str:
    """Format retrieved documents into LLM context string."""
    if not docs:
        return ""

    context_parts = []
    for i, doc in enumerate(docs, 1):
        source_info = ""
        if "source" in doc.metadata:
            filename = doc.metadata["source"].split("/")[-1]
            page = doc.metadata.get("page", 0)
            source_info = f"[Source: {filename}, Page {page + 1}]"

        context_parts.append(
            f"--- Context {i} {source_info} ---\n{doc.page_content}"
        )

    return "\n\n".join(context_parts)