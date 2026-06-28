"""Supabase Storage for raw uploaded files.

Gated on env vars — when SUPABASE_URL / SUPABASE_SERVICE_KEY / SUPABASE_BUCKET
are set, files persist in the bucket; otherwise the app keeps them on local
disk (ephemeral on HF, fine for local dev).
"""
import httpx
import logging
from config import settings

logger = logging.getLogger(__name__)


def storage_enabled() -> bool:
    return bool(
        settings.SUPABASE_URL
        and settings.SUPABASE_SERVICE_KEY
        and settings.SUPABASE_BUCKET
    )


def _base() -> str:
    return settings.SUPABASE_URL.rstrip("/") + "/storage/v1"


def _headers(content_type: str = None) -> dict:
    h = {
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "apikey": settings.SUPABASE_SERVICE_KEY,
    }
    if content_type:
        h["Content-Type"] = content_type
    return h


async def upload_bytes(
    object_name: str,
    data: bytes,
    content_type: str = "application/octet-stream",
) -> str | None:
    """Upload bytes to the bucket. Returns the object key on success."""
    if not storage_enabled():
        return None

    url = f"{_base()}/object/{settings.SUPABASE_BUCKET}/{object_name}"
    headers = _headers(content_type)
    headers["x-upsert"] = "true"

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(url, content=data, headers=headers)
        if r.status_code in (200, 201):
            logger.info(f"Uploaded to Supabase Storage: {object_name}")
            return object_name
        logger.error(f"Storage upload failed [{r.status_code}]: {r.text[:200]}")
    except Exception as e:
        logger.error(f"Storage upload error: {e}")
    return None


async def delete_object(object_name: str) -> None:
    if not storage_enabled() or not object_name:
        return
    url = f"{_base()}/object/{settings.SUPABASE_BUCKET}/{object_name}"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            await client.delete(url, headers=_headers())
    except Exception as e:
        logger.warning(f"Storage delete failed: {e}")


async def signed_url(object_name: str, expires_in: int = 3600) -> str | None:
    """Create a temporary signed download URL for a private object."""
    if not storage_enabled() or not object_name:
        return None
    url = f"{_base()}/object/sign/{settings.SUPABASE_BUCKET}/{object_name}"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                url,
                json={"expiresIn": expires_in},
                headers=_headers("application/json"),
            )
        if r.status_code == 200:
            signed = r.json().get("signedURL") or r.json().get("signedUrl")
            if signed:
                return _base() + signed if signed.startswith("/") else signed
        logger.error(f"Sign URL failed [{r.status_code}]: {r.text[:200]}")
    except Exception as e:
        logger.error(f"Sign URL error: {e}")
    return None
