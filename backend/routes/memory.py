from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db, MemoryEntry
from memory.store import (
    store_memory,
    get_all_memories,
    get_client_memories,
    get_global_memories,
    update_memory,
    delete_memory,
)
from services.cache import cache_get, cache_set, cache_del

router = APIRouter()


def _serialize(m: MemoryEntry) -> dict:
    return {
        "id": m.id,
        "fact": m.fact,
        "category": m.category,
        "confidence": m.confidence,
        "source_message": m.source_message,
        "created_at": m.created_at.isoformat(),
        "session_id": m.session_id,
    }


class ManualMemoryRequest(BaseModel):
    session_id: Optional[str] = None
    fact: str
    category: str = "general"


class UpdateMemoryRequest(BaseModel):
    fact: Optional[str] = None
    category: Optional[str] = None


@router.get("/memory/{session_id}")
async def get_memories(
    session_id: str,
    db: Session = Depends(get_db),
    x_client_id: Optional[str] = Header(default=None),
):
    """Get memories for this client across ALL sessions (cross-session recall).

    Falls back to per-session if no client id is present.
    """
    if x_client_id:
        ck = f"mem:{x_client_id}"
        cached = cache_get(ck)
        if cached is not None:
            return cached
        memories = get_client_memories(db=db, client_id=x_client_id)
        result = {
            "session_id": session_id,
            "total": len(memories),
            "memories": [_serialize(m) for m in memories],
        }
        cache_set(ck, result)
        return result

    memories = get_all_memories(db=db, session_id=session_id)
    return {
        "session_id": session_id,
        "total": len(memories),
        "memories": [_serialize(m) for m in memories],
    }


@router.get("/memory")
async def get_all_memories_global(
    db: Session = Depends(get_db),
    x_client_id: Optional[str] = Header(default=None),
):
    """Get all memories for this client (or global if no client id)."""
    if x_client_id:
        memories = get_client_memories(db=db, client_id=x_client_id)
    else:
        memories = get_global_memories(db=db)

    return {
        "total": len(memories),
        "memories": [_serialize(m) for m in memories],
    }


@router.post("/memory")
async def add_memory_manually(
    request: ManualMemoryRequest,
    db: Session = Depends(get_db),
    x_client_id: Optional[str] = Header(default=None),
):
    """Manually add a memory entry (no dedup — user is explicit)."""
    entry = store_memory(
        db=db,
        session_id=request.session_id or "manual",
        fact=request.fact,
        category=request.category,
        confidence=1.0,
        client_id=x_client_id,
        dedup=False,
    )

    cache_del(f"mem:{x_client_id}")

    return {
        "status": "stored",
        "id": entry.id,
        "fact": entry.fact,
        "category": entry.category,
    }


@router.put("/memory/{memory_id}")
async def edit_memory(
    memory_id: int,
    request: UpdateMemoryRequest,
    db: Session = Depends(get_db),
    x_client_id: Optional[str] = Header(default=None),
):
    """Edit a memory's fact and/or category."""
    entry = update_memory(
        db=db,
        memory_id=memory_id,
        fact=request.fact,
        category=request.category,
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Memory not found.")

    cache_del(f"mem:{x_client_id}")
    return {"status": "updated", **_serialize(entry)}


@router.delete("/memory/{memory_id}")
async def remove_memory(
    memory_id: int,
    db: Session = Depends(get_db),
    x_client_id: Optional[str] = Header(default=None),
):
    """Delete a specific memory entry."""
    success = delete_memory(db=db, memory_id=memory_id)
    if not success:
        raise HTTPException(status_code=404, detail="Memory not found.")

    cache_del(f"mem:{x_client_id}")
    return {"status": "deleted", "id": memory_id}
