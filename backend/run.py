import uvicorn
import os
from pathlib import Path

# Absolute path to backend directory only
BACKEND_DIR = Path(__file__).parent.resolve()

if __name__ == "__main__":
    print(f"👀 Watching: {BACKEND_DIR}")
    print(f"🚫 venv location: {BACKEND_DIR.parent / 'venv'}")

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[str(BACKEND_DIR)],   # Only watch backend/ — absolute path
        reload_excludes=[
            "*.pyc",
            "*.pyo",
            "*__pycache__*",
            "*.db",
            "*.db-shm",
            "*.db-wal",
            "chroma_db/*",
            "uploads/*",
            "*.log",
        ],
        log_level="info",
        workers=1,
    )