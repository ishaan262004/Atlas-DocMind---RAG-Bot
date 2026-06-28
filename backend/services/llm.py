import httpx
import logging
from config import settings
from langchain_core.output_parsers import StrOutputParser

logger = logging.getLogger(__name__)


def use_groq() -> bool:
    """True when a Groq API key is configured — chat then runs on Groq."""
    return bool(settings.GROQ_API_KEY)


def get_llm(model: str = None, streaming: bool = False, temperature: float = None):
    """
    Get the configured chat LLM.

    When GROQ_API_KEY is set, returns a Groq chat model wrapped in a
    StrOutputParser so callers receive plain string chunks (same shape as the
    Ollama string LLM, so chat.py / extractor.py work unchanged).
    Otherwise falls back to a local Ollama model.
    """
    temp = 0.7 if temperature is None else max(0.0, min(2.0, float(temperature)))

    if use_groq():
        from langchain_groq import ChatGroq
        chat = ChatGroq(
            model=settings.GROQ_MODEL,
            api_key=settings.GROQ_API_KEY,
            temperature=temp,
        )
        return chat | StrOutputParser()

    model_name = model or settings.OLLAMA_MODEL

    # Try langchain-ollama first (newer, preferred)
    try:
        from langchain_ollama import OllamaLLM
        return OllamaLLM(
            model=model_name,
            base_url=settings.OLLAMA_BASE_URL,
            temperature=temp,
        )
    except Exception:
        pass

    # Fallback to langchain-community Ollama
    try:
        from langchain_community.llms import Ollama
        return Ollama(
            model=model_name,
            base_url=settings.OLLAMA_BASE_URL,
            temperature=temp,
        )
    except Exception as e:
        logger.error(f"Failed to load any LLM: {e}")
        raise


def get_embeddings():
    """
    Get configured embeddings model.
    Tries multiple import paths for compatibility across langchain versions.
    """

    # ── Local CPU embeddings (default; no Ollama needed) ───────────
    if settings.USE_LOCAL_EMBEDDINGS or use_groq():
        from langchain_community.embeddings import SentenceTransformerEmbeddings
        logger.info(
            f"Using local SentenceTransformerEmbeddings ({settings.LOCAL_EMBEDDING_MODEL})"
        )
        return SentenceTransformerEmbeddings(
            model_name=settings.LOCAL_EMBEDDING_MODEL
        )

    # ── Strategy 1: langchain-ollama (newest) ──────────────────────
    try:
        from langchain_ollama import OllamaEmbeddings
        logger.info("Using langchain_ollama.OllamaEmbeddings")
        return OllamaEmbeddings(
            model=settings.OLLAMA_EMBEDDING_MODEL,
            base_url=settings.OLLAMA_BASE_URL,
        )
    except (ImportError, Exception) as e:
        logger.warning(f"langchain_ollama OllamaEmbeddings failed: {e}")

    # ── Strategy 2: langchain-community without base_url ───────────
    try:
        from langchain_community.embeddings import OllamaEmbeddings
        logger.info("Using langchain_community.OllamaEmbeddings (no base_url)")
        return OllamaEmbeddings(
            model=settings.OLLAMA_EMBEDDING_MODEL,
        )
    except (ImportError, Exception) as e:
        logger.warning(f"langchain_community OllamaEmbeddings (no base_url) failed: {e}")

    # ── Strategy 3: langchain-community with base_url ──────────────
    try:
        from langchain_community.embeddings import OllamaEmbeddings
        logger.info("Using langchain_community.OllamaEmbeddings (with base_url)")
        return OllamaEmbeddings(
            model=settings.OLLAMA_EMBEDDING_MODEL,
            base_url=settings.OLLAMA_BASE_URL,
        )
    except (ImportError, Exception) as e:
        logger.warning(f"langchain_community OllamaEmbeddings (with base_url) failed: {e}")

    # ── Strategy 4: sentence-transformers fallback ─────────────────
    try:
        from langchain_community.embeddings import SentenceTransformerEmbeddings
        logger.info("Falling back to SentenceTransformerEmbeddings")
        return SentenceTransformerEmbeddings(
            model_name="all-MiniLM-L6-v2"
        )
    except (ImportError, Exception) as e:
        logger.warning(f"SentenceTransformerEmbeddings failed: {e}")

    raise RuntimeError(
        "No embeddings backend available. "
        "Run: pip install langchain-ollama"
    )


async def check_llm_health() -> dict:
    """Provider-aware health: reports Groq when configured, else Ollama."""
    if use_groq():
        return {
            "status":        "healthy",
            "provider":      "groq",
            "models":        [settings.GROQ_MODEL],
            "current_model": settings.GROQ_MODEL,
        }
    return await check_ollama_health()


async def check_ollama_health() -> dict:
    """Check if Ollama is running and models are available."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.OLLAMA_BASE_URL}/api/tags",
                timeout=5.0,
            )
            if response.status_code == 200:
                data   = response.json()
                models = [m["name"] for m in data.get("models", [])]
                return {
                    "status":        "healthy",
                    "models":        models,
                    "current_model": settings.OLLAMA_MODEL,
                }
    except Exception as e:
        logger.error(f"Ollama health check failed: {e}")

    return {
        "status": "unhealthy",
        "error":  "Cannot reach Ollama at " + settings.OLLAMA_BASE_URL,
        "models": [],
    }


async def list_available_models() -> list:
    """Fetch available models (Groq model when configured, else Ollama)."""
    if use_groq():
        return [settings.GROQ_MODEL]
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.OLLAMA_BASE_URL}/api/tags",
                timeout=5.0,
            )
            if response.status_code == 200:
                data = response.json()
                return [m["name"] for m in data.get("models", [])]
    except Exception as e:
        logger.error(f"Failed to list models: {e}")

    return [settings.OLLAMA_MODEL]