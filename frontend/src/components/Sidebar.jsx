import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  MessageSquare,
  Trash2,
  Brain,
  Search,
  Settings,
  X,
  Tag,
} from "lucide-react";
import { getSessions, deleteSession, getMemories } from "../services/api";
import { format } from "date-fns";

// Atlas Docmind logo mark — white rect, black triangle "A"
function AtlasLogoMark({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Atlas Docmind"
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

export default function Sidebar({
  currentSessionId,
  onNewChat,
  onSelectSession,
  onClose,
  isMobile = false,
}) {
  const [sessions, setSessions] = useState([]);
  const [activeTab, setActiveTab] = useState("chats");
  const [query, setQuery] = useState("");
  const [memories, setMemories] = useState([]);
  const [memoryCount, setMemoryCount] = useState(0);
  const [loadingMemories, setLoadingMemories] = useState(false);

  useEffect(() => {
    loadSessions();
  }, [currentSessionId]);

  useEffect(() => {
    if (currentSessionId && activeTab === "memory") {
      loadMemories();
    }
  }, [currentSessionId, activeTab]);

  const loadSessions = async () => {
    try {
      const data = await getSessions();
      setSessions(data);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    }
  };

  const loadMemories = async () => {
    if (!currentSessionId) return;
    setLoadingMemories(true);
    try {
      const data = await getMemories(currentSessionId);
      setMemories(data.memories || []);
      setMemoryCount(data.total || 0);
    } catch (err) {
      console.error("Failed to load memories:", err);
    } finally {
      setLoadingMemories(false);
    }
  };

  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation();
    try {
      await deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
      if (sessionId === currentSessionId) {
        onNewChat();
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const categoryStyles = {
    technical: "text-[#A0A0A0]",
    preference: "text-[#A0A0A0]",
    professional: "text-[#A0A0A0]",
    goal: "text-[#A0A0A0]",
    general: "text-[#A0A0A0]",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "256px",
        flexShrink: 0,
        background: "#0A0A0A",
        borderRight: "1px solid #242424",
        overflow: "hidden",
      }}
    >
      {/* ── Brand ──────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "20px 20px",
          borderBottom: "1px solid #242424",
          flexShrink: 0,
        }}
      >
        <AtlasLogoMark size={24} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 600,
              fontSize: "14px",
              color: "#FFFFFF",
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Atlas Docmind
          </div>
          <div
            style={{
              fontSize: "10px",
              color: "#555555",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              marginTop: "2px",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Enterprise AI Platform
          </div>
        </div>
        {isMobile && onClose && (
          <button
            onClick={onClose}
            className="atlas-btn-ghost"
            style={{ padding: "4px", flexShrink: 0 }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── New Chat ────────────────────────────────────────── */}
      <div style={{ padding: "12px 16px 0" }}>
        <button
          onClick={onNewChat}
          className="atlas-btn-primary"
          style={{ width: "100%" }}
        >
          <Plus size={14} />
          New Chat
        </button>
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #242424",
          marginTop: "12px",
        }}
      >
        {[
          { id: "chats", label: "Chats" },
          {
            id: "memory",
            label: memoryCount > 0 ? `Memory (${memoryCount})` : "Memory",
          },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: "10px 0",
              fontSize: "12px",
              fontWeight: 500,
              fontFamily: "'Inter', sans-serif",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid #FFFFFF" : "2px solid transparent",
              color: activeTab === tab.id ? "#FFFFFF" : "#555555",
              cursor: "pointer",
              transition: "color 120ms ease, border-color 120ms ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Scrollable Content ──────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
        <AnimatePresence mode="wait">
          {/* Chats Tab */}
          {activeTab === "chats" && (
            <motion.div
              key="chats"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              {/* Search */}
              {sessions.length > 0 && (
                <div
                  className="atlas-input-area"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 10px",
                    marginBottom: "6px",
                  }}
                >
                  <Search size={12} style={{ color: "#555555", flexShrink: 0 }} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search chats…"
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      color: "#FFFFFF",
                      fontSize: "12px",
                      fontFamily: "'Inter', sans-serif",
                    }}
                  />
                </div>
              )}

              {sessions.length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "160px",
                    gap: "8px",
                  }}
                >
                  <MessageSquare size={20} style={{ color: "#333333" }} />
                  <span style={{ fontSize: "12px", color: "#555555" }}>
                    No conversations yet
                  </span>
                  <span style={{ fontSize: "10px", color: "#333333" }}>
                    Start chatting below to begin
                  </span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                  {sessions
                    .filter((s) =>
                      (s.title || "").toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((session, index) => {
                      const isActive = session.session_id === currentSessionId;
                      return (
                        <motion.div
                          key={session.session_id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          onClick={() => onSelectSession(session.session_id)}
                          className={`group ${isActive ? "atlas-session-active" : ""}`}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "8px",
                            padding: isActive ? "10px 12px 10px 10px" : "10px 12px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            transition: "background 100ms ease",
                            background: isActive ? "#1A1A1A" : "transparent",
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) e.currentTarget.style.background = "#111111";
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <MessageSquare
                            size={12}
                            style={{
                              color: "#555555",
                              flexShrink: 0,
                              marginTop: "2px",
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p
                              style={{
                                fontSize: "13px",
                                color: isActive ? "#FFFFFF" : "#A0A0A0",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                lineHeight: 1.3,
                                fontFamily: "'Inter', sans-serif",
                              }}
                            >
                              {session.title}
                            </p>
                            <p
                              style={{
                                fontSize: "10px",
                                color: "#555555",
                                marginTop: "2px",
                              }}
                            >
                              {format(new Date(session.updated_at), "MMM d, HH:mm")}
                            </p>
                          </div>
                          <button
                            onClick={(e) => handleDeleteSession(e, session.session_id)}
                            className="atlas-btn-ghost"
                            style={{
                              padding: "4px",
                              opacity: 0,
                              flexShrink: 0,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.opacity = "1";
                              e.currentTarget.style.color = "#FFFFFF";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.opacity = "0";
                            }}
                            title="Delete session"
                          >
                            <Trash2 size={11} />
                          </button>
                        </motion.div>
                      );
                    })}
                </div>
              )}
            </motion.div>
          )}

          {/* Memory Tab */}
          {activeTab === "memory" && (
            <motion.div
              key="memory"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              <button
                onClick={loadMemories}
                disabled={loadingMemories}
                style={{
                  width: "100%",
                  fontSize: "11px",
                  color: "#555555",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px 0",
                  fontFamily: "'Inter', sans-serif",
                  transition: "color 120ms ease",
                }}
                onMouseEnter={(e) => (e.target.style.color = "#FFFFFF")}
                onMouseLeave={(e) => (e.target.style.color = "#555555")}
              >
                {loadingMemories ? "Loading..." : "↻ Refresh memories"}
              </button>

              {!currentSessionId ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "120px",
                    gap: "8px",
                  }}
                >
                  <Brain size={16} style={{ color: "#333333" }} />
                  <span style={{ fontSize: "11px", color: "#555555" }}>
                    Select a chat to view memories.
                  </span>
                </div>
              ) : memories.length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "120px",
                    gap: "8px",
                  }}
                >
                  <Brain size={16} style={{ color: "#333333" }} />
                  <span style={{ fontSize: "11px", color: "#555555" }}>
                    No memories yet.
                  </span>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    marginTop: "4px",
                  }}
                >
                  {memories.map((memory, index) => (
                    <motion.div
                      key={memory.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="atlas-card"
                      style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "6px" }}
                    >
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#FFFFFF",
                          lineHeight: 1.5,
                        }}
                      >
                        {memory.fact}
                      </p>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            fontSize: "10px",
                            color: "#555555",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            fontWeight: 500,
                          }}
                        >
                          {memory.category}
                        </span>
                        <span style={{ fontSize: "10px", color: "#555555" }}>
                          {format(new Date(memory.created_at), "MMM d")}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer ──────────────────────────────────────────── */}
      <div
        style={{
          borderTop: "1px solid #242424",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "#22C55E",
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: "11px", color: "#555555" }}>
            Online · Groq Llama 3.3
          </span>
        </div>
      </div>
    </div>
  );
}
