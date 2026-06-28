import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { format } from "date-fns";
import {
  FileText,
  User,
  Copy,
  Check,
  Pencil,
  X,
  Volume2,
  VolumeX,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { useState, useRef } from "react";
import { speak, stopSpeaking, ttsSupported } from "../utils/voice";

// Atlas logo mark — white rect, black triangle
function AtlasAvatarMark() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="24" height="24" rx="5" fill="#FFFFFF" />
      <path
        d="M12 6L18 18H6L12 6Z"
        fill="none"
        stroke="#000000"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9 14h6"
        stroke="#000000"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SpeakButton({ text }) {
  const [speaking, setSpeaking] = useState(false);
  if (!ttsSupported()) return null;

  const toggle = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
    } else {
      speak(text);
      setSpeaking(true);
      const t = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          setSpeaking(false);
          clearInterval(t);
        }
      }, 400);
    }
  };

  return (
    <button
      onClick={toggle}
      className="atlas-btn-ghost"
      style={{ padding: "6px" }}
      title={speaking ? "Stop" : "Read aloud"}
    >
      {speaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
    </button>
  );
}

function CopyButton({ text, style = {} }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="atlas-btn-ghost"
      style={{ padding: "6px", ...style }}
      title="Copy"
    >
      {copied ? (
        <Check size={12} style={{ color: "#A0A0A0" }} />
      ) : (
        <Copy size={12} />
      )}
    </button>
  );
}

// Code block with language label + copy button
function PreBlock({ children }) {
  const ref = useRef(null);
  const [copied, setCopied] = useState(false);

  // Extract language from className on the <code> element
  const codeEl = children?.props;
  const langClass = codeEl?.className || "";
  const langMatch = langClass.match(/language-(\w+)/);
  const lang = langMatch ? langMatch[1] : "";

  const handleCopy = async () => {
    const text = ref.current?.innerText || "";
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="atlas-code-block">
      <div className="atlas-code-block-header">
        <span className="atlas-code-block-lang">{lang || "code"}</span>
        <button
          onClick={handleCopy}
          className="atlas-btn-ghost"
          style={{ padding: "2px 8px", fontSize: "11px" }}
        >
          {copied ? (
            <span style={{ color: "#A0A0A0", display: "flex", alignItems: "center", gap: "3px" }}>
              <Check size={11} /> Copied
            </span>
          ) : (
            <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
              <Copy size={11} /> Copy
            </span>
          )}
        </button>
      </div>
      <div ref={ref}>
        <pre style={{ padding: "14px", overflowX: "auto", color: "#FFFFFF", lineHeight: 1.6, margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}>
          {children}
        </pre>
      </div>
    </div>
  );
}

const MARKDOWN_COMPONENTS = { pre: PreBlock };

export default function MessageBubble({
  message,
  isStreaming = false,
  onEdit,
}) {
  const isUser = message.role === "user";
  const timestamp = message.timestamp
    ? format(new Date(message.timestamp), "HH:mm")
    : "";

  const memoriesUsed = message.metadata?.memories_used || 0;
  const docsRetrieved = message.metadata?.docs_retrieved || 0;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  // ── User Message ──────────────────────────────────────────────
  if (isUser) {
    const submitEdit = () => {
      if (draft.trim() && draft.trim() !== message.content) {
        onEdit?.(message.id, draft.trim());
      }
      setEditing(false);
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "16px",
        }}
      >
        {editing ? (
          <div
            style={{
              maxWidth: "72%",
              background: "#111111",
              border: "1px solid #333333",
              borderRadius: "8px 8px 2px 8px",
              padding: "12px 14px",
            }}
          >
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitEdit();
                }
                if (e.key === "Escape") setEditing(false);
              }}
              rows={Math.min(6, draft.split("\n").length + 1)}
              style={{
                width: "100%",
                resize: "none",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#FFFFFF",
                fontSize: "13px",
                lineHeight: 1.6,
                fontFamily: "'Inter', sans-serif",
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "6px",
                marginTop: "8px",
              }}
            >
              <button
                onClick={() => setEditing(false)}
                className="atlas-btn-ghost"
                style={{ padding: "4px 8px", fontSize: "11px" }}
              >
                Cancel
              </button>
              <button
                onClick={submitEdit}
                className="atlas-btn-primary"
                style={{ padding: "4px 12px", fontSize: "11px" }}
              >
                Send
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", maxWidth: "72%" }}>
            {/* Actions row */}
            {onEdit && (
              <div style={{ display: "flex", alignItems: "center", gap: "2px", opacity: 0 }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "0"; }}
              >
                <button
                  onClick={() => {
                    setDraft(message.content);
                    setEditing(true);
                  }}
                  className="atlas-btn-ghost"
                  style={{ padding: "4px" }}
                  title="Edit & resend"
                >
                  <Pencil size={11} />
                </button>
                <CopyButton text={message.content} />
              </div>
            )}

            {/* Bubble — white bg, black text */}
            <div
              style={{
                background: "#FFFFFF",
                color: "#000000",
                borderRadius: "8px 8px 2px 8px",
                padding: "10px 14px",
                fontSize: "13px",
                lineHeight: 1.6,
                fontFamily: "'Inter', sans-serif",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {message.content}
            </div>

            {/* Timestamp */}
            <span style={{ fontSize: "10px", color: "#555555" }}>
              {timestamp}
            </span>
          </div>
        )}
      </motion.div>
    );
  }

  // ── AI Message ────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        marginBottom: "16px",
      }}
      className="group"
    >
      {/* Avatar */}
      <div
        style={{
          width: "24px",
          height: "24px",
          borderRadius: "4px",
          background: "#111111",
          border: "1px solid #242424",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: "2px",
        }}
      >
        <AtlasAvatarMark />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Label */}
        <div
          style={{
            fontSize: "10px",
            color: "#555555",
            fontWeight: 500,
            marginBottom: "6px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Atlas
        </div>

        {/* Bubble */}
        <div
          className="atlas-card prose-atlas"
          style={{
            borderRadius: "2px 8px 8px 8px",
            padding: "14px 16px",
            display: message.isError ? "block" : undefined,
            borderColor: message.isError ? "#333333" : undefined,
          }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
            components={MARKDOWN_COMPONENTS}
          >
            {message.content}
          </ReactMarkdown>

          {/* Streaming cursor */}
          {isStreaming && <span className="atlas-cursor" />}
        </div>

        {/* Metadata badges */}
        {(memoriesUsed > 0 || docsRetrieved > 0) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "6px",
            }}
          >
            {memoriesUsed > 0 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "10px",
                  color: "#555555",
                  background: "#111111",
                  border: "1px solid #242424",
                  borderRadius: "4px",
                  padding: "2px 6px",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {memoriesUsed} memories
              </span>
            )}
            {docsRetrieved > 0 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "10px",
                  color: "#555555",
                  background: "#111111",
                  border: "1px solid #242424",
                  borderRadius: "4px",
                  padding: "2px 6px",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {docsRetrieved} chunks
              </span>
            )}
          </div>
        )}

        {/* Citations */}
        {message.metadata?.citations?.length > 0 && (
          <div style={{ marginTop: "8px" }}>
            <p
              style={{
                fontSize: "10px",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#555555",
                marginBottom: "6px",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Sources
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {message.metadata.citations.map((c, i) => (
                <div
                  key={i}
                  className="atlas-citation"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "6px",
                    padding: "6px 8px",
                    borderRadius: "4px",
                    background: "#111111",
                    border: "1px solid #242424",
                    cursor: "default",
                    margin: 0,
                  }}
                >
                  <FileText size={11} style={{ color: "#555555", marginTop: "1px", flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: "11px",
                        fontWeight: 500,
                        color: "#A0A0A0",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontFamily: "'Inter', sans-serif",
                      }}
                    >
                      {c.source}
                      {c.page ? ` · p.${c.page}` : ""}
                    </p>
                    {c.snippet && (
                      <p
                        style={{
                          fontSize: "10px",
                          color: "#555555",
                          marginTop: "2px",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          fontFamily: "'Inter', sans-serif",
                        }}
                      >
                        {c.snippet}…
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message actions — visible on group hover */}
        <div
          className="opacity-0 group-hover:opacity-100"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "2px",
            marginTop: "6px",
            transition: "opacity 100ms ease",
          }}
        >
          <CopyButton text={message.content} />
          {!isStreaming && <SpeakButton text={message.content} />}
          <button className="atlas-btn-ghost" style={{ padding: "6px" }} title="Helpful">
            <ThumbsUp size={12} />
          </button>
          <button className="atlas-btn-ghost" style={{ padding: "6px" }} title="Not helpful">
            <ThumbsDown size={12} />
          </button>
        </div>

        {/* Timestamp */}
        <div
          className="opacity-0 group-hover:opacity-100"
          style={{
            fontSize: "10px",
            color: "#555555",
            marginTop: "4px",
            transition: "opacity 100ms ease",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {timestamp}
        </div>
      </div>
    </motion.div>
  );
}
