import { useState, useCallback, useRef, useEffect } from "react";
import { sendChatMessage } from "../services/api";
import { v4 as uuidv4 } from "uuid";

export function useChat(sessionId) {
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState(null);

  // ── Typewriter state ──────────────────────────────────────────────
  // Groq streams the whole reply almost instantly, so we buffer the
  // received text and reveal it progressively for a natural "typing" feel.
  const targetRef = useRef(""); // full text received so far
  const shownRef = useRef(""); // text currently revealed on screen
  const doneRef = useRef(false); // has the stream finished?
  const pendingRef = useRef(null); // { id, metadata } — committed once typing catches up
  const timerRef = useRef(null);
  const controllerRef = useRef(null); // AbortController for the active stream

  const stopTyping = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTyping = useCallback(() => {
    stopTyping();
    timerRef.current = setInterval(() => {
      const target = targetRef.current;
      const shown = shownRef.current;

      if (shown.length < target.length) {
        // Reveal faster when there's a big backlog, easing near the end.
        const remaining = target.length - shown.length;
        const step = Math.max(2, Math.floor(remaining / 12));
        const next = target.slice(0, shown.length + step);
        shownRef.current = next;
        setStreamingContent(next);
        return;
      }

      // Caught up. If the stream is finished, commit the final message.
      if (doneRef.current) {
        stopTyping();
        const pending = pendingRef.current;
        if (pending) {
          setMessages((prev) => [
            ...prev,
            {
              id: pending.id,
              role: "assistant",
              content: targetRef.current,
              timestamp: new Date().toISOString(),
              metadata: pending.metadata,
            },
          ]);
        }
        pendingRef.current = null;
        setStreamingContent("");
        setIsStreaming(false);
      }
      // else: caught up but more tokens may still arrive — wait.
    }, 16);
  }, [stopTyping]);

  // Clean up the interval on unmount.
  useEffect(() => stopTyping, [stopTyping]);

  const sendMessage = useCallback(
    async (content, model, overrideSessionId, options = {}) => {
      const { skipUserMessage = false } = options;
      if (!content.trim() || isStreaming) return;

      const activeSessionId = overrideSessionId || sessionId;
      if (!activeSessionId) {
        console.error("No session ID available");
        return;
      }

      setError(null);

      // Add user message immediately (skip when regenerating / editing).
      if (!skipUserMessage) {
        const userMessage = {
          id: uuidv4(),
          role: "user",
          content: content.trim(),
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMessage]);
      }

      // Reset typewriter + streaming state
      const assistantId = uuidv4();
      controllerRef.current = new AbortController();
      targetRef.current = "";
      shownRef.current = "";
      doneRef.current = false;
      pendingRef.current = { id: assistantId, metadata: null };
      setStreamingContent("");
      setIsStreaming(true);
      startTyping();

      try {
        const response = await sendChatMessage({
          message: content.trim(),
          session_id: activeSessionId,
          model: model || "llama3",
          stream: true,
          signal: controllerRef.current.signal,
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr);

              if (event.type === "metadata") {
                if (pendingRef.current) pendingRef.current.metadata = event;
              } else if (event.type === "token") {
                // Feed the buffer; the typewriter reveals it.
                targetRef.current += event.content;
              } else if (event.type === "done") {
                doneRef.current = true;
              } else if (event.type === "error") {
                throw new Error(event.content);
              }
            } catch (parseError) {
              if (parseError.message !== "Unexpected end of JSON input") {
                console.warn("SSE parse warning:", parseError.message);
              }
            }
          }
        }

        // Stream closed — whatever we have is final; let the typewriter finish.
        doneRef.current = true;
      } catch (err) {
        // User pressed Stop — keep whatever was generated so far.
        if (err.name === "AbortError") {
          stopTyping();
          const finalText = targetRef.current || shownRef.current;
          if (finalText) {
            setMessages((prev) => [
              ...prev,
              {
                id: assistantId,
                role: "assistant",
                content: finalText,
                timestamp: new Date().toISOString(),
                metadata: pendingRef.current?.metadata,
                stopped: true,
              },
            ]);
          }
          pendingRef.current = null;
          setStreamingContent("");
          setIsStreaming(false);
          return;
        }

        console.error("Chat error:", err);
        stopTyping();

        let errorMsg = "Something went wrong. Please try again.";
        if (err.message && err.message !== "[object Object]") {
          errorMsg = err.message;
        }

        setError(errorMsg);
        setStreamingContent("");
        pendingRef.current = null;

        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: "assistant",
            content: `⚠️ Error: ${errorMsg}`,
            timestamp: new Date().toISOString(),
            isError: true,
          },
        ]);
        setIsStreaming(false);
      }
    },
    [sessionId, isStreaming, startTyping, stopTyping],
  );

  const stopStreaming = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const clearMessages = useCallback(() => {
    stopTyping();
    targetRef.current = "";
    shownRef.current = "";
    doneRef.current = false;
    pendingRef.current = null;
    setMessages([]);
    setStreamingContent("");
    setError(null);
    setIsStreaming(false);
  }, [stopTyping]);

  return {
    messages,
    setMessages,
    isStreaming,
    streamingContent,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
  };
}
