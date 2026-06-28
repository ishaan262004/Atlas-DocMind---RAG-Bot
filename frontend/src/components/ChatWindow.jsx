import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Brain,
  Paperclip,
  ChevronDown,
  Menu,
  ArrowUp,
  Square,
  RotateCcw,
  Settings,
  Mic,
  Download,
  X,
  FileText,
  History,
  Sparkles,
  ShieldCheck,
  Gauge,
  ArrowUpRight,
} from "lucide-react";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import UploadSection from "./UploadSection";
import MemoryPanel from "./MemoryPanel";
import ModelSelector from "./ModelSelector";
import SettingsModal, { loadSettings } from "./SettingsModal";
import { useChat } from "../hooks/useChat";
import { getSessionMessages, getMemories } from "../services/api";
import { createRecognizer, speechSupported, speak } from "../utils/voice";

// Atlas logo mark — white rect, black triangle
function AtlasLogoMark({ size = 18 }) {
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

export default function ChatWindow({
  sessionId,
  onNewSession,
  onSidebarToggle,
}) {
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("llama-3.3-70b-versatile");
  const [showUpload, setShowUpload] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [memories, setMemories] = useState([]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const lastSpokenRef = useRef(null);
  const justCreatedRef = useRef(false);

  const {
    messages,
    setMessages,
    isStreaming,
    streamingContent,
    error,
    sendMessage,
    stopStreaming,
  } = useChat(sessionId);

  useEffect(() => {
    if (sessionId) {
      if (justCreatedRef.current) {
        justCreatedRef.current = false;
        loadMemories();
      } else {
        loadSessionHistory();
        loadMemories();
      }
    } else {
      setMessages([]);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!showScrollButton) {
      scrollToBottom();
    }
  }, [messages, streamingContent]);

  useEffect(() => {
    if (isStreaming) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    if (lastSpokenRef.current === last.id) return;
    lastSpokenRef.current = last.id;
    if (loadSettings().autoSpeak) speak(last.content);
  }, [messages, isStreaming]);

  const loadSessionHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const data = await getSessionMessages(sessionId);
      setMessages(data);
      lastSpokenRef.current = data[data.length - 1]?.id || null;
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadMemories = async () => {
    if (!sessionId) return;
    try {
      const data = await getMemories(sessionId);
      setMemories(data.memories || []);
    } catch (err) {
      console.error("Failed to load memories:", err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollButton(distanceFromBottom > 200);
  };

  const sendText = async (text) => {
    const message = (text || "").trim();
    if (!message || isStreaming) return;
    let activeSessionId = sessionId;
    if (!activeSessionId) {
      justCreatedRef.current = true;
      activeSessionId = onNewSession();
    }
    await sendMessage(message, selectedModel, activeSessionId);
    setTimeout(() => loadMemories(), 2500);
  };

  const handleSlash = (raw) => {
    const [cmd, ...rest] = raw.slice(1).split(" ");
    const arg = rest.join(" ").trim();
    switch (cmd.toLowerCase()) {
      case "clear":
        setMessages([]);
        return true;
      case "help":
        setMessages((prev) => [
          ...prev,
          {
            id: `help-${Date.now()}`,
            role: "assistant",
            content:
              "**Slash commands**\n\n- `/summarize` — summarize this conversation\n- `/translate <lang> <text>` — translate text\n- `/clear` — clear the screen\n- `/help` — show this help",
            timestamp: new Date().toISOString(),
          },
        ]);
        return true;
      case "summarize":
        sendText("Summarize our conversation so far in a few concise bullet points.");
        return true;
      case "translate": {
        const sp = arg.indexOf(" ");
        if (sp > 0) {
          const lang = arg.slice(0, sp);
          const text = arg.slice(sp + 1);
          sendText(`Translate the following into ${lang}:\n\n${text}`);
        }
        return true;
      }
      default:
        return false;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const message = input.trim();
    if (message.startsWith("/") && handleSlash(message)) {
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      return;
    }
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await sendText(message);
  };

  const handleExport = () => {
    if (!messages.length) return;
    const md = messages
      .map((m) => {
        const who = m.role === "user" ? "**You**" : "**Atlas**";
        return `${who}:\n\n${m.content}\n`;
      })
      .join("\n---\n\n");
    const blob = new Blob([`# Atlas Docmind — Conversation\n\n${md}`], {
      type: "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `atlas-chat-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRegenerate = () => {
    if (isStreaming) return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setMessages((prev) => {
      const copy = [...prev];
      while (copy.length && copy[copy.length - 1].role === "assistant") copy.pop();
      return copy;
    });
    sendMessage(lastUser.content, selectedModel, sessionId, {
      skipUserMessage: true,
    });
  };

  const handleEditResend = (messageId, newContent) => {
    if (isStreaming || !newContent.trim()) return;
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === messageId);
      if (idx === -1) return prev;
      return [
        ...prev.slice(0, idx),
        { ...prev[idx], content: newContent.trim() },
      ];
    });
    sendMessage(newContent.trim(), selectedModel, sessionId, {
      skipUserMessage: true,
    });
  };

  const handleSuggestion = (s) => {
    if (isStreaming) return;
    if (s.action === "upload") {
      if (!sessionId) {
        justCreatedRef.current = true;
        onNewSession();
      }
      setShowUpload(true);
      return;
    }
    sendText(s.prompt);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  };

  // ── Welcome Screen ──────────────────────────────────────────────
  if (!sessionId && messages.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#000000" }}>
        <SettingsModal
          open={showSettings}
          onClose={() => setShowSettings(false)}
        />
        <TopBar
          onSidebarToggle={onSidebarToggle}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          showMemory={showMemory}
          setShowMemory={setShowMemory}
          memoryCount={memories.length}
          sessionId={sessionId}
          onOpenSettings={() => setShowSettings(true)}
          onExport={handleExport}
          canExport={messages.length > 0}
        />
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px 0",
          }}
        >
          <WelcomeScreen onSuggestion={handleSuggestion} />
        </div>
        <InputBar
          input={input}
          setInput={handleTextareaChange}
          onSend={handleSend}
          onStop={stopStreaming}
          isStreaming={isStreaming}
          onKeyDown={handleKeyDown}
          textareaRef={textareaRef}
          showUpload={showUpload}
          setShowUpload={setShowUpload}
          sessionId={sessionId}
          onUploadComplete={() => {}}
          onVoiceText={(t) => setInput(t)}
        />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Main chat column */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          minHeight: 0,
          height: "100%",
          background: "#000000",
          position: "relative",
        }}
      >
        <TopBar
          onSidebarToggle={onSidebarToggle}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          showMemory={showMemory}
          setShowMemory={setShowMemory}
          memoryCount={memories.length}
          sessionId={sessionId}
          onOpenSettings={() => setShowSettings(true)}
          onExport={handleExport}
          canExport={messages.length > 0}
        />

        {/* Messages scroll area */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          style={{ flex: 1, minHeight: 0, overflowY: "auto", background: "#000000" }}
        >
          <div
            style={{
              maxWidth: "680px",
              margin: "0 auto",
              padding: "24px 16px",
            }}
          >
            {isLoadingHistory ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "80px",
                  fontSize: "12px",
                  color: "#555555",
                }}
              >
                Loading history...
              </div>
            ) : (
              <>
                <AnimatePresence initial={false}>
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isStreaming={false}
                      onEdit={handleEditResend}
                    />
                  ))}
                </AnimatePresence>

                {isStreaming && streamingContent && (
                  <MessageBubble
                    message={{
                      id: "streaming",
                      role: "assistant",
                      content: streamingContent,
                      timestamp: new Date().toISOString(),
                    }}
                    isStreaming={true}
                  />
                )}

                {isStreaming && !streamingContent && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </div>

        {/* Scroll to bottom button */}
        <AnimatePresence>
          {showScrollButton && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              onClick={scrollToBottom}
              className="atlas-btn-ghost"
              style={{
                position: "absolute",
                bottom: "100px",
                right: "24px",
                zIndex: 10,
                border: "1px solid #242424",
                background: "#111111",
                padding: "6px",
              }}
            >
              <ChevronDown size={16} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Upload panel */}
        <AnimatePresence>
          {showUpload && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                borderTop: "1px solid #242424",
                padding: "12px 16px",
                overflow: "hidden",
                background: "#000000",
                flexShrink: 0,
              }}
            >
              <UploadSection
                sessionId={sessionId}
                onUploadComplete={() => loadMemories()}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Regenerate */}
        {!isStreaming &&
          messages.length > 0 &&
          messages[messages.length - 1].role === "assistant" && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                paddingBottom: "4px",
                flexShrink: 0,
              }}
            >
              <button
                onClick={handleRegenerate}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "11px",
                  color: "#555555",
                  background: "#111111",
                  border: "1px solid #242424",
                  borderRadius: "4px",
                  padding: "4px 10px",
                  cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                  transition: "color 120ms ease, border-color 120ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#FFFFFF";
                  e.currentTarget.style.borderColor = "#333333";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#555555";
                  e.currentTarget.style.borderColor = "#242424";
                }}
              >
                <RotateCcw size={11} />
                Regenerate
              </button>
            </div>
          )}

        <InputBar
          input={input}
          setInput={handleTextareaChange}
          onSend={handleSend}
          onStop={stopStreaming}
          isStreaming={isStreaming}
          onKeyDown={handleKeyDown}
          textareaRef={textareaRef}
          showUpload={showUpload}
          setShowUpload={setShowUpload}
          sessionId={sessionId}
          onUploadComplete={() => loadMemories()}
          onVoiceText={(t) => setInput(t)}
        />
      </div>

      {/* Memory side panel */}
      <AnimatePresence>
        {showMemory && sessionId && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 288 }}
            exit={{ width: 0 }}
            transition={{ duration: 0.18 }}
            style={{ flexShrink: 0, overflow: "hidden", height: "100%" }}
          >
            <MemoryPanel
              sessionId={sessionId}
              memories={memories}
              onClose={() => setShowMemory(false)}
              onMemoryChange={loadMemories}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


// ── TopBar ──────────────────────────────────────────────────────────────────

function TopBar({
  onSidebarToggle,
  selectedModel,
  setSelectedModel,
  showMemory,
  setShowMemory,
  memoryCount,
  sessionId,
  onOpenSettings,
  onExport,
  canExport,
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        height: "52px",
        borderBottom: "1px solid #242424",
        flexShrink: 0,
        background: "#000000",
      }}
    >
      {/* Left */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button
          onClick={onSidebarToggle}
          className="atlas-btn-ghost"
          style={{ padding: "6px" }}
          title="Toggle sidebar"
        >
          <Menu size={16} />
        </button>
        <span
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "#FFFFFF",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Atlas Docmind
        </span>
      </div>

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        {/* Memory toggle */}
        {sessionId && (
          <button
            onClick={() => setShowMemory(!showMemory)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 10px",
              fontSize: "11px",
              fontFamily: "'Inter', sans-serif",
              fontWeight: 500,
              background: showMemory ? "#1A1A1A" : "transparent",
              color: showMemory ? "#FFFFFF" : "#A0A0A0",
              border: "1px solid",
              borderColor: showMemory ? "#333333" : "transparent",
              borderRadius: "4px",
              cursor: "pointer",
              transition: "all 120ms ease",
              whiteSpace: "nowrap",
            }}
            title="Memory panel"
          >
            <Brain size={13} />
            {memoryCount > 0 && (
              <span
                style={{
                  background: "#242424",
                  color: "#A0A0A0",
                  padding: "0 5px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  fontWeight: 500,
                }}
              >
                {memoryCount}
              </span>
            )}
            <span className="hidden sm:block">Memory</span>
          </button>
        )}

        {/* Export */}
        {canExport && (
          <button
            onClick={onExport}
            className="atlas-btn-ghost"
            style={{ padding: "6px", width: "32px", height: "32px" }}
            title="Export chat as Markdown"
          >
            <Download size={14} />
          </button>
        )}

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="atlas-btn-ghost"
          style={{ padding: "6px", width: "32px", height: "32px" }}
          title="Settings"
        >
          <Settings size={14} />
        </button>

        {/* Model selector */}
        <ModelSelector value={selectedModel} onChange={setSelectedModel} />
      </div>
    </div>
  );
}

// ── InputBar ─────────────────────────────────────────────────────────────────

function InputBar({
  input,
  setInput,
  onSend,
  onStop,
  isStreaming,
  onKeyDown,
  textareaRef,
  showUpload,
  setShowUpload,
  sessionId,
  onUploadComplete,
  onVoiceText,
}) {
  const [listening, setListening] = useState(false);
  const recognizerRef = useRef(null);

  const toggleVoice = () => {
    if (listening) {
      recognizerRef.current?.stop();
      return;
    }
    const rec = createRecognizer({
      onResult: (text) => onVoiceText?.(text),
      onEnd: () => setListening(false),
      onError: () => setListening(false),
    });
    if (!rec) return;
    recognizerRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <div
      style={{
        flexShrink: 0,
        borderTop: "1px solid #242424",
        background: "#000000",
        padding: "12px 16px",
      }}
    >
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>
        {/* Input area */}
        <div className="atlas-input-area" style={{ display: "flex", alignItems: "flex-end", gap: "8px", padding: "12px 16px" }}>
          {/* Attach */}
          <button
            onClick={() => setShowUpload(!showUpload)}
            disabled={!sessionId}
            className="atlas-btn-ghost"
            style={{
              flexShrink: 0,
              alignSelf: "flex-end",
              marginBottom: "2px",
              padding: "6px",
              color: showUpload ? "#FFFFFF" : "#555555",
              opacity: !sessionId ? 0.3 : 1,
              cursor: !sessionId ? "not-allowed" : "pointer",
            }}
            title={sessionId ? "Upload document" : "Start a chat first"}
          >
            <Paperclip size={16} />
          </button>

          {/* Voice */}
          {speechSupported() && (
            <button
              onClick={toggleVoice}
              className="atlas-btn-ghost"
              style={{
                flexShrink: 0,
                alignSelf: "flex-end",
                marginBottom: "2px",
                padding: "6px",
                color: listening ? "#FFFFFF" : "#555555",
              }}
              title={listening ? "Stop listening" : "Voice input"}
            >
              <Mic size={16} />
            </button>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={setInput}
            onKeyDown={onKeyDown}
            placeholder="Ask anything..."
            rows={1}
            disabled={isStreaming}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              resize: "none",
              color: "#FFFFFF",
              fontSize: "14px",
              fontFamily: "'Inter', sans-serif",
              lineHeight: 1.6,
              maxHeight: "160px",
              minHeight: "24px",
              padding: "0",
              fontWeight: 400,
            }}
          />

          {/* Char count */}
          {input.length > 500 && (
            <span
              style={{
                fontSize: "10px",
                color: "#555555",
                alignSelf: "flex-end",
                marginBottom: "3px",
                flexShrink: 0,
              }}
            >
              {input.length}
            </span>
          )}

          {/* Send / Stop */}
          <button
            onClick={isStreaming ? onStop : onSend}
            disabled={!isStreaming && !input.trim()}
            className="atlas-btn-primary"
            style={{
              flexShrink: 0,
              alignSelf: "flex-end",
              padding: "6px 12px",
              fontSize: "12px",
            }}
            title={isStreaming ? "Stop generating" : "Send"}
          >
            {isStreaming ? <Square size={14} fill="currentColor" /> : <ArrowUp size={14} />}
          </button>
        </div>

        {/* Hint */}
        <p
          style={{
            textAlign: "center",
            fontSize: "10px",
            color: "#555555",
            marginTop: "8px",
          }}
        >
          Atlas Docmind · lightning-fast responses · remembers you across sessions
        </p>
      </div>
    </div>
  );
}

// ── WelcomeScreen ─────────────────────────────────────────────────────────────

function WelcomeScreen({ onSuggestion }) {
  const suggestions = [
    {
      icon: Sparkles,
      category: "GET STARTED",
      title: "What can you do?",
      prompt: "What's your name and what can you do?",
      action: "send",
    },
    {
      icon: Brain,
      category: "TEACH ME A FACT",
      title: "My favorite framework is FastAPI — remember that.",
      prompt: "My favorite framework is FastAPI — remember that.",
      action: "send",
    },
    {
      icon: FileText,
      category: "CHAT WITH A PDF",
      title: "Upload a document to get started.",
      prompt: "Upload a PDF and I'll answer questions from it.",
      action: "upload",
    },
    {
      icon: History,
      category: "RECALL MEMORY",
      title: "What do you remember about me?",
      prompt: "What do you remember about me from before?",
      action: "send",
    },
  ];

  const features = [
    { icon: Brain, text: "Remembers you" },
    { icon: FileText, text: "Reads your docs" },
    { icon: Gauge, text: "Lightning fast" },
    { icon: ShieldCheck, text: "Private memory" },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        maxWidth: "680px",
        width: "100%",
        padding: "0 16px",
      }}
    >
      {/* Status pill */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 12px",
          background: "#111111",
          border: "1px solid #242424",
          borderRadius: "4px",
          fontSize: "11px",
          color: "#A0A0A0",
          marginBottom: "32px",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "#22C55E",
            flexShrink: 0,
          }}
        />
        Online · Groq Llama 3.3
      </div>

      {/* Logo */}
      <div
        style={{
          width: "64px",
          height: "64px",
          borderRadius: "12px",
          background: "#111111",
          border: "1px solid #242424",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "24px",
          flexShrink: 0,
        }}
      >
        <svg
          width="32"
          height="32"
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
      </div>

      {/* Heading */}
      <h1
        style={{
          fontFamily: "'Sora', sans-serif",
          fontSize: "30px",
          fontWeight: 700,
          color: "#FFFFFF",
          textAlign: "center",
          marginBottom: "12px",
          lineHeight: 1.2,
          letterSpacing: "-0.02em",
        }}
      >
        Welcome to Atlas Docmind
      </h1>

      {/* Subheading */}
      <p
        style={{
          color: "#A0A0A0",
          fontSize: "14px",
          textAlign: "center",
          maxWidth: "400px",
          lineHeight: 1.65,
          marginBottom: "32px",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        An enterprise AI platform that remembers you, answers from your
        documents, and replies in an instant.
      </p>

      {/* Feature pills */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "40px",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <div
              key={f.text}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                fontSize: "11px",
                color: "#A0A0A0",
                border: "1px solid #242424",
                borderRadius: "4px",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              <Icon size={12} style={{ color: "#555555" }} />
              {f.text}
            </div>
          );
        })}
      </div>

      {/* Suggestion cards — 2×2 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          width: "100%",
        }}
      >
        {suggestions.map((s, i) => {
          const Icon = s.icon;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSuggestion(s)}
              className="atlas-card-hover"
              style={{
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                textAlign: "left",
              }}
            >
              {/* Icon */}
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  background: "#1A1A1A",
                  border: "1px solid #242424",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={14} style={{ color: "#A0A0A0" }} />
              </div>

              {/* Category */}
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 500,
                  color: "#555555",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {s.category}
              </div>

              {/* Title */}
              <div
                style={{
                  fontSize: "13px",
                  color: "#A0A0A0",
                  lineHeight: 1.4,
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {s.title}
              </div>
            </button>
          );
        })}
      </div>

      {/* Hint */}
      <p
        style={{
          fontSize: "11px",
          color: "#555555",
          marginTop: "24px",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        Pick one to begin, or just start typing below
      </p>
    </div>
  );
}
