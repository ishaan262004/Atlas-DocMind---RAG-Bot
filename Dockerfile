FROM python:3.11-slim

# Redis for in-memory caching (faster chat/document/memory loads)
RUN apt-get update && apt-get install -y --no-install-recommends redis-server \
    && rm -rf /var/lib/apt/lists/*

# Non-root user (HF Spaces runs as uid 1000)
RUN useradd -m -u 1000 user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    HF_HOME=/home/user/.cache/huggingface \
    SENTENCE_TRANSFORMERS_HOME=/home/user/.cache/sentence-transformers

WORKDIR /home/user/app

# ── Python dependencies ──────────────────────────────────────────────
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ── Application code ─────────────────────────────────────────────────
COPY --chown=user backend/ ./backend/
COPY --chown=user start.sh ./start.sh
RUN chmod +x ./start.sh

USER user

# HF Spaces expects the app on port 7860
EXPOSE 7860

CMD ["./start.sh"]
