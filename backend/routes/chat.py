from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db, ChatSession, ChatMessage, UploadedDocument
from memory.store import retrieve_relevant_memories, store_memory
from memory.extractor import extract_memories_from_conversation
from rag.retriever import retrieve_relevant_chunks, format_context_from_docs
from services.llm import get_llm
from services.cache import cache_get, cache_set, cache_del
from langchain.prompts import ChatPromptTemplate
from langchain.schema.runnable import RunnableSequence
import uuid
import json
import logging
from datetime import datetime
from config import settings
from typing import Optional
router = APIRouter()
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are Atlas Docmind, an intelligent AI assistant with persistent memory.

You have access to:
1. Long-term memories about the user from previous conversations
2. Relevant context from uploaded documents (if available)

Instructions:
- Use the provided memories naturally in your responses
- When answering from documents, cite the source
- Be conversational, helpful, and technically precise
- If you reference a memory, you can mention "I remember you mentioned..."
- Keep responses clear and well-formatted using markdown when appropriate

{memory_context}

{document_context}"""


class ChatRequest(BaseModel):
    message:       str
    session_id:    Optional[str] = None
    model:         Optional[str] = None
    stream:        bool = True
    temperature:   Optional[float] = None
    system_prompt: Optional[str] = None  # persona / custom instructions


class ChatResponse(BaseModel):
    response: str
    session_id: str
    memories_used: int
    docs_retrieved: int


@router.post("/chat")
async def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    x_client_id: Optional[str] = Header(default=None),
):
    # Create or get session
    session_id = request.session_id or str(uuid.uuid4())

    session = db.query(ChatSession).filter(
        ChatSession.session_id == session_id
    ).first()

    if not session:
        session = ChatSession(
            session_id=session_id,
            client_id=x_client_id,
            title=request.message[:40] + "..." if len(request.message) > 40 else request.message,
        )
        db.add(session)
        db.commit()

    # Store user message
    user_msg = ChatMessage(
        session_id=session_id,
        role="user",
        content=request.message,
    )
    db.add(user_msg)
    db.commit()

    # The session list + this session's messages changed.
    cache_del(f"msgs:{session_id}", f"sessions:{x_client_id}")

    # Retrieve relevant memories (cross-session, scoped to this client)
    memories = retrieve_relevant_memories(
        query=request.message,
        session_id=session_id,
        client_id=x_client_id,
        k=settings.MAX_MEMORY_CONTEXT,
    )

    memory_context = ""
    if memories:
        memory_list = "\n".join(f"- {m}" for m in memories)
        memory_context = f"### Relevant Memories About User:\n{memory_list}"

    # Retrieve relevant document chunks
    doc_context = ""
    docs_retrieved = 0
    citations = []

    documents = (
        db.query(UploadedDocument)
        .filter(UploadedDocument.session_id == session_id)
        .all()
    )

    if documents:
        all_chunks = []
        for doc in documents:
            chunks = retrieve_relevant_chunks(
                query=request.message,
                collection_name=doc.collection_name,
                k=2,
            )
            all_chunks.extend(chunks)

        if all_chunks:
            docs_retrieved = len(all_chunks)
            top = all_chunks[:settings.RETRIEVAL_K]
            context_text = format_context_from_docs(top)
            doc_context = f"### Context From Your Documents:\n{context_text}"

            # Inline citations surfaced to the UI.
            for c in top:
                src = str(c.metadata.get("source") or "document")
                src = src.split("/")[-1].split("\\")[-1]
                page = c.metadata.get("page")
                citations.append({
                    "source": src,
                    "page": (page + 1) if isinstance(page, int) else None,
                    "snippet": (c.page_content or "")[:160].strip(),
                })

    # Get recent conversation history
    recent_messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.timestamp.desc())
        .limit(10)
        .all()
    )
    recent_messages.reverse()

    # Build conversation for history
    conversation_history = []
    for msg in recent_messages[:-1]:  # Exclude the message we just added
        conversation_history.append({
            "role": msg.role,
            "content": msg.content,
        })

    # Build the system message (optionally prefixed with a custom persona)
    system_message = SYSTEM_PROMPT.format(
        memory_context=memory_context,
        document_context=doc_context,
    )
    if request.system_prompt and request.system_prompt.strip():
        system_message = request.system_prompt.strip() + "\n\n" + system_message

    # Summarize older turns so long conversations stay coherent (only the last
    # 6 messages are sent verbatim; everything before is condensed).
    older = conversation_history[:-6] if len(conversation_history) > 6 else []
    if len(older) >= 4:
        try:
            summ_llm = get_llm(temperature=0.3)
            convo_text = "\n".join(
                f"{m['role']}: {m['content']}" for m in older
            )
            summary = summ_llm.invoke(
                "Summarize the key points, decisions, and facts from this "
                "earlier conversation in 3-5 short bullet points:\n\n"
                + convo_text
            )
            if summary and str(summary).strip():
                system_message += (
                    "\n\n### Summary of earlier conversation:\n" + str(summary).strip()
                )
        except Exception as e:
            logger.warning(f"History summarization failed: {e}")

    # Build LangChain messages. Escape literal braces in dynamic content
    # (memories, document chunks, history) so ChatPromptTemplate doesn't
    # misread JSON-like "{...}" as template variables. Only {user_input}
    # remains a real variable, filled with the raw (unparsed) message value.
    def _esc(text: str) -> str:
        return text.replace("{", "{{").replace("}", "}}")

    prompt_messages = [("system", _esc(system_message))]
    for msg in conversation_history[-6:]:
        prompt_messages.append((msg["role"], _esc(msg["content"])))
    prompt_messages.append(("human", "{user_input}"))

    prompt = ChatPromptTemplate.from_messages(prompt_messages)

    model_name = request.model or settings.OLLAMA_MODEL

    if request.stream:
        # Streaming response
        async def generate():
            full_response = ""
            llm = get_llm(model=model_name, streaming=True, temperature=request.temperature)
            chain = prompt | llm

            try:
                # Send metadata first
                metadata = json.dumps({
                    "type": "metadata",
                    "session_id": session_id,
                    "memories_used": len(memories),
                    "docs_retrieved": docs_retrieved,
                    "citations": citations,
                })
                yield f"data: {metadata}\n\n"

                # Stream tokens
                async for chunk in chain.astream({"user_input": request.message}):
                    if chunk:
                        full_response += chunk
                        token_data = json.dumps({
                            "type": "token",
                            "content": chunk,
                        })
                        yield f"data: {token_data}\n\n"

                # Store assistant response
                assistant_msg = ChatMessage(
                    session_id=session_id,
                    role="assistant",
                    content=full_response,
                )
                db.add(assistant_msg)
                db.commit()

                # Extract and store memories asynchronously
                all_msgs = conversation_history + [
                    {"role": "user", "content": request.message},
                    {"role": "assistant", "content": full_response},
                ]

                new_memories = extract_memories_from_conversation(all_msgs)
                for mem in new_memories:
                    store_memory(
                        db=db,
                        session_id=session_id,
                        fact=mem["fact"],
                        category=mem["category"],
                        confidence=mem.get("confidence", 1.0),
                        source_message=request.message,
                        client_id=x_client_id,
                    )

                # Assistant message + possibly new memories were stored.
                cache_del(
                    f"msgs:{session_id}",
                    f"sessions:{x_client_id}",
                    f"mem:{x_client_id}",
                )

                # Send done signal
                done_data = json.dumps({"type": "done"})
                yield f"data: {done_data}\n\n"

            except Exception as e:
                logger.error(f"Streaming error: {e}")
                error_data = json.dumps({
                    "type": "error",
                    "content": f"An error occurred: {str(e)}",
                })
                yield f"data: {error_data}\n\n"

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    else:
        # Non-streaming response
        try:
            llm = get_llm(model=model_name, streaming=False, temperature=request.temperature)
            chain = prompt | llm
            response = chain.invoke({"user_input": request.message})

            # Store response
            assistant_msg = ChatMessage(
                session_id=session_id,
                role="assistant",
                content=str(response),
            )
            db.add(assistant_msg)
            db.commit()

            return ChatResponse(
                response=str(response),
                session_id=session_id,
                memories_used=len(memories),
                docs_retrieved=docs_retrieved,
            )

        except Exception as e:
            logger.error(f"Chat error: {e}")
            raise HTTPException(status_code=500, detail=str(e))


@router.get("/chat/sessions")
async def get_sessions(
    db: Session = Depends(get_db),
    x_client_id: Optional[str] = Header(default=None),
):
    """Get chat sessions for THIS client only (per-browser isolation)."""
    # Without a client id, return nothing rather than leaking other users' chats.
    if not x_client_id:
        return []

    ck = f"sessions:{x_client_id}"
    cached = cache_get(ck)
    if cached is not None:
        return cached

    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.client_id == x_client_id)
        .order_by(ChatSession.updated_at.desc())
        .limit(50)
        .all()
    )
    result = [
        {
            "session_id": s.session_id,
            "title": s.title,
            "created_at": s.created_at.isoformat(),
            "updated_at": s.updated_at.isoformat(),
        }
        for s in sessions
    ]
    cache_set(ck, result)
    return result


def _assert_owner(db, session_id, x_client_id):
    """Block access to a session that belongs to a different client."""
    sess = (
        db.query(ChatSession)
        .filter(ChatSession.session_id == session_id)
        .first()
    )
    if sess and sess.client_id and x_client_id and sess.client_id != x_client_id:
        raise HTTPException(status_code=403, detail="Not your session")


@router.get("/chat/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    db: Session = Depends(get_db),
    x_client_id: Optional[str] = Header(default=None),
):
    """Get all messages for a session (only if it's yours)."""
    _assert_owner(db, session_id, x_client_id)

    ck = f"msgs:{session_id}"
    cached = cache_get(ck)
    if cached is not None:
        return cached

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.timestamp.asc())
        .all()
    )
    result = [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "timestamp": m.timestamp.isoformat(),
        }
        for m in messages
    ]
    cache_set(ck, result)
    return result


@router.delete("/chat/sessions/{session_id}")
async def delete_session(
    session_id: str,
    db: Session = Depends(get_db),
    x_client_id: Optional[str] = Header(default=None),
):
    """Delete a chat session and its messages (only if it's yours)."""
    _assert_owner(db, session_id, x_client_id)
    cache_del(f"msgs:{session_id}", f"sessions:{x_client_id}")
    db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).delete()
    db.query(ChatSession).filter(
        ChatSession.session_id == session_id
    ).delete()
    db.commit()
    return {"status": "deleted"}