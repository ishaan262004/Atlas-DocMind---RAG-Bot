import os
os.environ["ANONYMIZED_TELEMETRY"] = "false"
os.environ["CHROMA_TELEMETRY"]     = "false"
os.environ["POSTHOG_DISABLED"]     = "true"

from pydantic_settings import BaseSettings
from pydantic import field_validator
from pathlib import Path
from typing import Optional


class Settings(BaseSettings):
    
    APP_NAME:    str = "Nexus Memory"
    APP_VERSION: str = "1.0.0"
    DEBUG:       bool = True

    HOST: str = "0.0.0.0"
    PORT: int = 8000

    OLLAMA_BASE_URL:       str = "http://localhost:11434"
    OLLAMA_MODEL:          str = "llama3"
    OLLAMA_EMBEDDING_MODEL: str = "nomic-embed-text"

    # Groq (fast, free hosted inference). When GROQ_API_KEY is set, chat uses
    # Groq instead of Ollama. Get a free key at https://console.groq.com
    GROQ_API_KEY: str = ""
    GROQ_MODEL:   str = "llama-3.1-8b-instant"

    # Run embeddings locally on CPU (no Ollama needed). Fast for short texts.
    USE_LOCAL_EMBEDDINGS: bool = True
    LOCAL_EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    # Supabase Storage (raw uploaded files). When all three are set, files are
    # stored in the bucket; otherwise they stay on local disk.
    SUPABASE_URL:         str = ""
    SUPABASE_SERVICE_KEY: str = ""
    SUPABASE_BUCKET:      str = "nexus-uploads"

    # Redis cache. Defaults to the in-container Redis; if unreachable, the app
    # silently falls back to querying the DB directly.
    REDIS_URL: str = "redis://localhost:6379"
    CACHE_TTL: int = 120

    BASE_DIR:     Path = Path(__file__).parent
    UPLOAD_DIR:   Path = Path(__file__).parent / "uploads"
    CHROMA_DIR:   Path = Path(__file__).parent / "chroma_db"
    DATABASE_URL: str  = (
        f"sqlite:///{Path(__file__).parent}/nexus_memory.db"
    )

    CHUNK_SIZE:    int = 1000
    CHUNK_OVERLAP: int = 200
    RETRIEVAL_K:   int = 4

    MEMORY_RETRIEVAL_K:  int = 5
    MAX_MEMORY_CONTEXT:  int = 3

    model_config = {
        "env_file":        ".env",
        "env_file_encoding": "utf-8",
        "extra":           "ignore",  
        "case_sensitive":  False,
    }


settings = Settings()

settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.CHROMA_DIR.mkdir(parents=True, exist_ok=True)