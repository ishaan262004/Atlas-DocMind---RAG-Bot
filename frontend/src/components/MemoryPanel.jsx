import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  X,
  Plus,
  Trash2,
  Pencil,
  Check,
  Search,
  MessageSquareQuote,
} from "lucide-react";
import { addMemory, deleteMemory, updateMemory } from "../services/api";
import { format } from "date-fns";

const CATEGORY_OPTIONS = [
  "general",
  "technical",
  "preference",
  "professional",
  "goal",
];

export default function MemoryPanel({
  sessionId,
  memories,
  onClose,
  onMemoryChange,
}) {
  const [newFact, setNewFact] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [isAdding, setIsAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const [editingId, setEditingId] = useState(null);
  const [editFact, setEditFact] = useState("");
  const [editCategory, setEditCategory] = useState("general");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return memories.filter((m) => {
      if (filter !== "all" && m.category !== filter) return false;
      if (q && !m.fact.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [memories, query, filter]);

  const handleAddMemory = async () => {
    if (!newFact.trim()) return;
    setIsAdding(true);
    try {
      await addMemory({
        session_id: sessionId,
        fact: newFact.trim(),
        category: newCategory,
      });
      setNewFact("");
      setShowAddForm(false);
      onMemoryChange?.();
    } catch (err) {
      console.error("Failed to add memory:", err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteMemory = async (memoryId) => {
    try {
      await deleteMemory(memoryId);
      onMemoryChange?.();
    } catch (err) {
      console.error("Failed to delete memory:", err);
    }
  };

  const startEdit = (memory) => {
    setEditingId(memory.id);
    setEditFact(memory.fact);
    setEditCategory(memory.category || "general");
  };

  const saveEdit = async () => {
    if (!editFact.trim()) return;
    try {
      await updateMemory(editingId, {
        fact: editFact.trim(),
        category: editCategory,
      });
      setEditingId(null);
      onMemoryChange?.();
    } catch (err) {
      console.error("Failed to update memory:", err);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "288px",
        background: "#0A0A0A",
        borderLeft: "1px solid #242424",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #242424",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'Sora', sans-serif",
                fontWeight: 600,
                fontSize: "14px",
                color: "#FFFFFF",
              }}
            >
              Memory
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "#555555",
                marginTop: "2px",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              What Atlas Docmind remembers about you
            </div>
          </div>
          <button
            onClick={onClose}
            className="atlas-btn-ghost"
            style={{ padding: "4px" }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #242424",
          flexShrink: 0,
        }}
      >
        <div
          className="atlas-input-area"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 12px",
          }}
        >
          <Search size={12} style={{ color: "#555555", flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search memories..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: "13px",
              color: "#FFFFFF",
              fontFamily: "'Inter', sans-serif",
            }}
          />
        </div>
      </div>

      {/* Category filter pills */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "10px 16px",
          borderBottom: "1px solid #242424",
          overflowX: "auto",
          flexShrink: 0,
        }}
      >
        {["all", ...CATEGORY_OPTIONS].map((c) => {
          const isActive = filter === c;
          return (
            <button
              key={c}
              onClick={() => setFilter(c)}
              style={{
                padding: "4px 10px",
                fontSize: "11px",
                fontFamily: "'Inter', sans-serif",
                color: isActive ? "#FFFFFF" : "#555555",
                background: isActive ? "#1A1A1A" : "transparent",
                border: `1px solid ${isActive ? "#555555" : "#242424"}`,
                borderRadius: "4px",
                cursor: "pointer",
                transition: "all 120ms ease",
                whiteSpace: "nowrap",
                flexShrink: 0,
                textTransform: "capitalize",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "#FFFFFF";
                  e.currentTarget.style.borderColor = "#333333";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "#555555";
                  e.currentTarget.style.borderColor = "#242424";
                }
              }}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* Add memory button */}
      <div style={{ padding: "8px 16px", flexShrink: 0 }}>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "8px",
            fontSize: "12px",
            color: "#555555",
            background: "transparent",
            border: "1px dashed #333333",
            borderRadius: "6px",
            cursor: "pointer",
            fontFamily: "'Inter', sans-serif",
            transition: "color 120ms ease, border-color 120ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#FFFFFF";
            e.currentTarget.style.borderColor = "#555555";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#555555";
            e.currentTarget.style.borderColor = "#333333";
          }}
        >
          <Plus size={12} />
          Add Memory
        </button>

        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: "hidden", marginTop: "8px" }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <textarea
                  value={newFact}
                  onChange={(e) => setNewFact(e.target.value)}
                  placeholder="Enter a fact to remember…"
                  rows={3}
                  className="atlas-input"
                  style={{ resize: "none", fontSize: "12px" }}
                />
                <div style={{ display: "flex", gap: "6px" }}>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="atlas-input"
                    style={{ flex: 1, fontSize: "12px" }}
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c} style={{ background: "#111111", color: "#FFFFFF" }}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddMemory}
                    disabled={!newFact.trim() || isAdding}
                    className="atlas-btn-primary"
                    style={{ padding: "6px 12px", fontSize: "12px" }}
                  >
                    {isAdding ? "..." : "Save"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Memory list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        {filtered.length === 0 ? (
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
            <Brain size={20} style={{ color: "#333333" }} />
            <span style={{ fontSize: "12px", color: "#555555", fontFamily: "'Inter', sans-serif" }}>
              {memories.length === 0 ? "No memories yet" : "No matches"}
            </span>
            {memories.length === 0 && (
              <span
                style={{
                  fontSize: "11px",
                  color: "#333333",
                  fontFamily: "'Inter', sans-serif",
                  textAlign: "center",
                  maxWidth: "180px",
                  lineHeight: 1.5,
                }}
              >
                Chat naturally and memories will form automatically.
              </span>
            )}
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map((memory, index) => (
              <motion.div
                key={memory.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ delay: Math.min(index * 0.02, 0.2) }}
                className="atlas-card-hover group"
                style={{ padding: "12px" }}
              >
                {editingId === memory.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <textarea
                      value={editFact}
                      onChange={(e) => setEditFact(e.target.value)}
                      rows={3}
                      className="atlas-input"
                      style={{
                        resize: "none",
                        fontSize: "12px",
                        background: "transparent",
                        border: "none",
                        borderBottom: "1px solid #333333",
                        borderRadius: 0,
                        padding: "0 0 4px",
                      }}
                    />
                    <div style={{ display: "flex", gap: "6px" }}>
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="atlas-input"
                        style={{ flex: 1, fontSize: "11px" }}
                      >
                        {CATEGORY_OPTIONS.map((c) => (
                          <option key={c} value={c} style={{ background: "#111111", color: "#FFFFFF" }}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={saveEdit}
                        disabled={!editFact.trim()}
                        className="atlas-btn-primary"
                        style={{
                          padding: "4px 10px",
                          fontSize: "11px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Check size={11} /> Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="atlas-btn-ghost"
                        style={{ padding: "4px 6px" }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Top row: category + actions */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "8px",
                        marginBottom: "8px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 500,
                          color: "#555555",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          fontFamily: "'Inter', sans-serif",
                        }}
                      >
                        {memory.category}
                      </span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "2px",
                          opacity: 0,
                          flexShrink: 0,
                        }}
                        className="group-hover:opacity-100"
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                      >
                        <button
                          onClick={() => startEdit(memory)}
                          className="atlas-btn-ghost"
                          style={{ padding: "3px" }}
                          title="Edit"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={() => handleDeleteMemory(memory.id)}
                          className="atlas-btn-ghost"
                          style={{ padding: "3px" }}
                          title="Delete"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>

                    {/* Memory text */}
                    <p
                      style={{
                        fontSize: "13px",
                        color: "#FFFFFF",
                        lineHeight: 1.55,
                        fontFamily: "'Inter', sans-serif",
                      }}
                    >
                      {memory.fact}
                    </p>

                    {/* Confidence bar */}
                    {memory.confidence !== undefined && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginTop: "8px",
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            height: "1px",
                            background: "#242424",
                          }}
                        >
                          <div
                            style={{
                              height: "1px",
                              background: "#333333",
                              width: `${Math.round(memory.confidence * 100)}%`,
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: "10px",
                            color: "#555555",
                            fontFamily: "'Inter', sans-serif",
                            flexShrink: 0,
                          }}
                        >
                          {Math.round(memory.confidence * 100)}%
                        </span>
                      </div>
                    )}

                    {/* Source message */}
                    {memory.source_message && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "4px",
                          marginTop: "6px",
                        }}
                      >
                        <MessageSquareQuote
                          size={11}
                          style={{ color: "#333333", marginTop: "1px", flexShrink: 0 }}
                        />
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#555555",
                            fontStyle: "italic",
                            fontFamily: "'Inter', sans-serif",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          "{memory.source_message}"
                        </span>
                      </div>
                    )}

                    {/* Timestamp */}
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#333333",
                        marginTop: "6px",
                        fontFamily: "'Inter', sans-serif",
                      }}
                    >
                      {format(new Date(memory.created_at), "MMM d, HH:mm")}
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
