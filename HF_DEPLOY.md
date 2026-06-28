# Deploying the Nexus Memory backend to Hugging Face Spaces (Docker + Ollama)

This runs **Ollama and the FastAPI backend together in one container**.

## ⚠️ Read first
- **Free Spaces are CPU-only.** `llama3` (8B) will be slow — often 10–30s+ per reply. For real use, upgrade the Space hardware to a **GPU** tier.
- **Free Space storage is ephemeral.** SQLite, ChromaDB vectors, and uploads are **wiped on every restart/rebuild/sleep**. Add **persistent storage** (paid) if you need data to survive.
- **First boot is slow** — the container pulls `llama3` (~4.7 GB) + `nomic-embed-text` (~274 MB). Models pull in the background so the web port still opens quickly; chat fails until the pull finishes.

## Files that make this work (already in the repo)
- `Dockerfile` — installs Ollama + Python deps, runs as uid 1000
- `start.sh` — starts `ollama serve`, pulls models, launches uvicorn on port 7860
- `.dockerignore` — keeps frontend/venv/data out of the build
- `README.md` frontmatter — tells HF to use `sdk: docker`, `app_port: 7860`

## Steps

1. **Create the Space**
   - Go to https://huggingface.co/new-space
   - SDK: **Docker** → **Blank**
   - Hardware: CPU basic (free) to try it; **GPU** for usable llama3 speed
   - (Optional) enable **Persistent storage** if you want data to survive restarts

2. **Push this repo to the Space**
   ```bash
   # from inside the nexus-memory/ folder
   git remote add space https://huggingface.co/spaces/<your-username>/<space-name>
   git push space HEAD:main
   ```
   Or clone the empty Space repo and copy these files into it.

3. **Watch the build/logs** in the Space's "Logs" tab. You'll see Ollama start, then the model pull, then `Uvicorn running on http://0.0.0.0:7860`.

4. **Test it**
   - `https://<your-username>-<space-name>.hf.space/health`
   - `https://<your-username>-<space-name>.hf.space/docs`

## Configuration (Space → Settings → Variables and secrets)
| Variable | Default | Notes |
|---|---|---|
| `OLLAMA_MODEL` | `llama3` | Swap to `llama3.2:1b` / `phi3:mini` for far faster CPU inference |
| `OLLAMA_EMBEDDING_MODEL` | `nomic-embed-text` | Leave as-is |
| `CORS_ORIGINS` | `*` | Set to your frontend URL(s), comma-separated, to lock it down |

## Pointing the frontend at it
In `frontend/src/services/api.js`, set the API base URL to your Space URL
(`https://<your-username>-<space-name>.hf.space`), then deploy the frontend
(e.g. to Vercel — that part *is* a good fit for Vercel).
