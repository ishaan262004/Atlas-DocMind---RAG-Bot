from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from database import get_db, UploadedDocument
from rag.loader import load_document
from rag.chunker import chunk_documents
from rag.embeddings import store_chunks, create_collection_name, delete_collection
from services.storage import (
    storage_enabled,
    upload_bytes,
    delete_object,
    signed_url,
)
from services.cache import cache_get, cache_set, cache_del
from config import settings
import aiofiles
import uuid
import logging
from pathlib import Path

router = APIRouter()
logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md", ".docx", ".csv"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    db: Session = Depends(get_db),
):
    """Upload and process a document for RAG."""

    # Validate file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file_ext}. Allowed: {ALLOWED_EXTENSIONS}",
        )

    # Generate unique filename
    unique_id = str(uuid.uuid4())[:8]
    safe_filename = f"{unique_id}_{file.filename}"
    file_path = settings.UPLOAD_DIR / safe_filename

    try:
        # Save file to disk
        async with aiofiles.open(file_path, "wb") as f:
            content = await file.read()

            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=413,
                    detail="File too large. Maximum size is 50MB.",
                )

            await f.write(content)

        logger.info(f"Saved file: {safe_filename}")

        # Load document
        documents = load_document(str(file_path))

        if not documents:
            raise HTTPException(
                status_code=422,
                detail="Could not extract text from document.",
            )

        # Chunk documents
        chunks = chunk_documents(documents)

        if not chunks:
            raise HTTPException(
                status_code=422,
                detail="Document chunking produced no results.",
            )

        # Create collection name
        collection_name = create_collection_name(file.filename, session_id)

        # Store embeddings (pgvector or Chroma)
        store_chunks(chunks=chunks, collection_name=collection_name)

        # Persist the raw file to Supabase Storage (if configured)
        storage_path = None
        if storage_enabled():
            storage_path = await upload_bytes(
                safe_filename,
                content,
                file.content_type or "application/octet-stream",
            )

        # Save document record
        doc_record = UploadedDocument(
            session_id=session_id,
            filename=file.filename,
            file_path=str(file_path),
            storage_path=storage_path,
            chunk_count=len(chunks),
            collection_name=collection_name,
        )
        db.add(doc_record)
        db.commit()
        db.refresh(doc_record)

        cache_del(f"docs:{session_id}")

        logger.info(
            f"Processed document: {file.filename} "
            f"({len(documents)} pages, {len(chunks)} chunks)"
        )

        return {
            "status": "success",
            "document_id": doc_record.id,
            "filename": file.filename,
            "pages": len(documents),
            "chunks": len(chunks),
            "collection_name": collection_name,
            "message": f"Document processed successfully. Created {len(chunks)} searchable chunks.",
        }

    except HTTPException:
        # Cleanup file on HTTP errors
        if file_path.exists():
            file_path.unlink()
        raise

    except Exception as e:
        # Cleanup file on unexpected errors
        if file_path.exists():
            file_path.unlink()
        logger.error(f"Upload processing failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Processing failed: {str(e)}",
        )


@router.get("/documents/{session_id}")
async def get_session_documents(
    session_id: str,
    db: Session = Depends(get_db),
):
    """Get all documents uploaded for a session."""
    ck = f"docs:{session_id}"
    cached = cache_get(ck)
    if cached is not None:
        return cached

    documents = (
        db.query(UploadedDocument)
        .filter(UploadedDocument.session_id == session_id)
        .order_by(UploadedDocument.uploaded_at.desc())
        .all()
    )

    result = [
        {
            "id": d.id,
            "filename": d.filename,
            "chunk_count": d.chunk_count,
            "collection_name": d.collection_name,
            "uploaded_at": d.uploaded_at.isoformat(),
        }
        for d in documents
    ]
    cache_set(ck, result)
    return result


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
):
    """Delete a document and its vector embeddings."""
    doc = (
        db.query(UploadedDocument)
        .filter(UploadedDocument.id == document_id)
        .first()
    )

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Delete vectors
    delete_collection(doc.collection_name)

    # Delete file from disk
    file_path = Path(doc.file_path)
    if file_path.exists():
        file_path.unlink()

    # Delete from Supabase Storage
    if doc.storage_path:
        await delete_object(doc.storage_path)

    # Delete record
    session_id = doc.session_id
    db.delete(doc)
    db.commit()

    cache_del(f"docs:{session_id}")

    return {"status": "deleted", "filename": doc.filename}


@router.get("/documents/{document_id}/download")
async def download_document(
    document_id: int,
    db: Session = Depends(get_db),
):
    """Redirect to a temporary signed URL for the stored file."""
    doc = (
        db.query(UploadedDocument)
        .filter(UploadedDocument.id == document_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    if doc.storage_path:
        url = await signed_url(doc.storage_path)
        if url:
            return RedirectResponse(url)

    # Fallback: local file (only present before a restart)
    if doc.file_path and Path(doc.file_path).exists():
        from fastapi.responses import FileResponse
        return FileResponse(doc.file_path, filename=doc.filename)

    raise HTTPException(status_code=410, detail="File no longer available.")