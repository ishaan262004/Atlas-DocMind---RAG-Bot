import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, SlidersHorizontal, Sparkles, Volume2 } from "lucide-react";

const DEFAULTS = {
  temperature: 0.7,
  systemPrompt: "",
  autoSpeak: false,
};

const PERSONAS = [
  { name: "Default", desc: "Balanced", prompt: "" },
  {
    name: "Concise",
    desc: "Short answers",
    prompt:
      "You are concise and direct. Answer in as few words as possible while staying correct. Prefer bullet points.",
  },
  {
    name: "Mentor",
    desc: "Detailed guide",
    prompt:
      "You are a patient senior engineer mentoring a junior. Explain the why, give examples, and suggest best practices.",
  },
  {
    name: "Creative",
    desc: "Imaginative",
    prompt:
      "You are imaginative and playful. Use vivid language and think outside the box while staying helpful.",
  },
];

export function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem("atlas_settings") || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

export default function SettingsModal({ open, onClose, onChange }) {
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    if (open) setSettings(loadSettings());
  }, [open]);

  const update = (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    localStorage.setItem("atlas_settings", JSON.stringify(next));
    onChange?.(next);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            zIndex: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            style={{
              background: "#0A0A0A",
              border: "1px solid #242424",
              borderRadius: "8px",
              width: "100%",
              maxWidth: "480px",
              maxHeight: "85vh",
              overflowY: "auto",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 24px",
                borderBottom: "1px solid #242424",
              }}
            >
              <span
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontWeight: 600,
                  fontSize: "14px",
                  color: "#FFFFFF",
                }}
              >
                Settings
              </span>
              <button
                onClick={onClose}
                className="atlas-btn-ghost"
                style={{ padding: "4px", width: "28px", height: "28px" }}
              >
                <X size={14} />
              </button>
            </div>

            {/* ── Temperature ───────────────────────────────────── */}
            <div>
              <p
                style={{
                  padding: "20px 24px 8px",
                  fontSize: "10px",
                  fontWeight: 500,
                  color: "#555555",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Generation
              </p>
              <div style={{ padding: "0 24px 16px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      color: "#A0A0A0",
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    Temperature
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      color: "#FFFFFF",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {settings.temperature.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={settings.temperature}
                  onChange={(e) =>
                    update({ temperature: parseFloat(e.target.value) })
                  }
                  style={{
                    width: "100%",
                    accentColor: "#FFFFFF",
                    cursor: "pointer",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: "4px",
                    fontSize: "10px",
                    color: "#555555",
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  <span>Precise</span>
                  <span>Balanced</span>
                  <span>Creative</span>
                </div>
              </div>
            </div>

            <div className="atlas-divider" />

            {/* ── Persona ───────────────────────────────────────── */}
            <div>
              <p
                style={{
                  padding: "20px 24px 8px",
                  fontSize: "10px",
                  fontWeight: 500,
                  color: "#555555",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Persona
              </p>
              <div style={{ padding: "0 24px 16px" }}>
                {/* Persona cards */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "8px",
                    marginBottom: "12px",
                  }}
                >
                  {PERSONAS.map((p) => {
                    const isActive = settings.systemPrompt === p.prompt;
                    return (
                      <button
                        key={p.name}
                        onClick={() => update({ systemPrompt: p.prompt })}
                        className="atlas-card"
                        style={{
                          padding: "10px 8px",
                          textAlign: "center",
                          cursor: "pointer",
                          border: `1px solid ${isActive ? "#FFFFFF" : "#242424"}`,
                          background: isActive ? "#1A1A1A" : "#111111",
                          borderRadius: "8px",
                          transition: "all 120ms ease",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: 500,
                            color: "#FFFFFF",
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
                          {p.name}
                        </div>
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#555555",
                            marginTop: "2px",
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
                          {p.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* System prompt textarea */}
                <textarea
                  value={settings.systemPrompt}
                  onChange={(e) => update({ systemPrompt: e.target.value })}
                  placeholder="Custom system instructions (optional)…"
                  rows={4}
                  className="atlas-input"
                  style={{
                    resize: "none",
                    fontSize: "13px",
                    lineHeight: 1.6,
                    height: "96px",
                  }}
                />
              </div>
            </div>

            <div className="atlas-divider" />

            {/* ── Auto-speak ────────────────────────────────────── */}
            <div style={{ padding: "16px 24px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: "13px",
                      color: "#A0A0A0",
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    Auto-speak replies
                  </span>
                  <p
                    style={{
                      fontSize: "11px",
                      color: "#555555",
                      marginTop: "1px",
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    Read responses aloud automatically
                  </p>
                </div>
                {/* Toggle */}
                <button
                  onClick={() => update({ autoSpeak: !settings.autoSpeak })}
                  style={{
                    width: "32px",
                    height: "16px",
                    background: settings.autoSpeak ? "#FFFFFF" : "#242424",
                    borderRadius: "8px",
                    position: "relative",
                    cursor: "pointer",
                    border: "none",
                    transition: "background 120ms ease",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: "2px",
                      width: "12px",
                      height: "12px",
                      background: settings.autoSpeak ? "#000000" : "#555555",
                      borderRadius: "50%",
                      transition: "left 120ms ease, background 120ms ease",
                      left: settings.autoSpeak ? "18px" : "2px",
                    }}
                  />
                </button>
              </div>
            </div>

            <div className="atlas-divider" />

            {/* Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
                padding: "16px 24px",
              }}
            >
              <button onClick={onClose} className="atlas-btn-secondary" style={{ fontSize: "12px" }}>
                Cancel
              </button>
              <button onClick={onClose} className="atlas-btn-primary" style={{ fontSize: "12px" }}>
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
