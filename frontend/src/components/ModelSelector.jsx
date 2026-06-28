import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Cpu, ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";

const FALLBACK_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "gemma2-9b-it",
];

const PRETTY = {
  "llama-3.3-70b-versatile": "Llama 3.3 70B",
  "llama-3.1-8b-instant": "Llama 3.1 8B",
  "gemma2-9b-it": "Gemma 2 9B",
};
const pretty = (m) => PRETTY[m] || m;

export default function ModelSelector({ value, onChange }) {
  const [models, setModels] = useState(FALLBACK_MODELS);
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const buttonRef = useRef(null);

  useEffect(() => {
    fetchModels();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleClose = () => setIsOpen(false);
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
    };
  }, [isOpen]);

  const handleOutsideClick = (e) => {
    if (buttonRef.current && !buttonRef.current.contains(e.target)) {
      const portal = document.getElementById("model-selector-portal");
      if (portal && portal.contains(e.target)) return;
      setIsOpen(false);
    }
  };

  const calculatePosition = () => {
    if (!buttonRef.current) return {};
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownWidth = 200;
    const dropdownHeight = 260;
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;

    let left = rect.right - dropdownWidth;
    if (left < 8) left = 8;
    if (left + dropdownWidth > viewportW - 8) left = viewportW - dropdownWidth - 8;

    const spaceBelow = viewportH - rect.bottom;
    const spaceAbove = rect.top;
    let top, transformOrigin;

    if (spaceBelow >= dropdownHeight || spaceBelow >= spaceAbove) {
      top = rect.bottom + 4;
      transformOrigin = "top right";
    } else {
      top = rect.top - dropdownHeight - 4;
      transformOrigin = "bottom right";
    }

    return {
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      width: `${dropdownWidth}px`,
      zIndex: 99999,
      transformOrigin,
    };
  };

  const handleToggle = () => {
    if (!isOpen) setDropdownStyle(calculatePosition());
    setIsOpen((prev) => !prev);
  };

  const fetchModels = async () => {
    try {
      const { data } = await axios.get("http://localhost:11434/api/tags", { timeout: 3000 });
      const names = data.models?.map((m) => m.name) || [];
      if (names.length > 0) setModels(names);
    } catch {
      // Silent fallback
    }
  };

  const selectedLabel = pretty(value || "llama-3.3-70b-versatile");

  const DropdownPortal = () =>
    createPortal(
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="model-selector-portal"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            style={{
              ...dropdownStyle,
              background: "#0A0A0A",
              border: "1px solid #242424",
              borderRadius: "6px",
              overflow: "hidden",
              boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "8px 12px",
                borderBottom: "1px solid #242424",
              }}
            >
              <p
                style={{
                  fontSize: "10px",
                  color: "#555555",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Available Models
              </p>
            </div>

            {/* Model list */}
            <div style={{ padding: "4px", maxHeight: "200px", overflowY: "auto" }}>
              {models.map((model) => {
                const isSelected = value === model;
                return (
                  <button
                    key={model}
                    onClick={() => {
                      onChange(model);
                      setIsOpen(false);
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      padding: "8px 10px",
                      borderRadius: "4px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontFamily: "'Inter', sans-serif",
                      cursor: "pointer",
                      background: isSelected ? "#1A1A1A" : "transparent",
                      color: isSelected ? "#FFFFFF" : "#A0A0A0",
                      border: "none",
                      transition: "background 100ms ease, color 100ms ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "#111111";
                        e.currentTarget.style.color = "#FFFFFF";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "#A0A0A0";
                      }
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {pretty(model)}
                    </span>
                    {isSelected && <Check size={11} style={{ color: "#FFFFFF", flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "8px 12px",
                borderTop: "1px solid #242424",
              }}
            >
              <p
                style={{
                  fontSize: "10px",
                  color: "#555555",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                ⚡ Powered by Groq
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
    );

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "5px 10px",
          background: "#111111",
          border: "1px solid #242424",
          borderRadius: "4px",
          fontSize: "11px",
          fontFamily: "'Inter', sans-serif",
          color: "#A0A0A0",
          cursor: "pointer",
          transition: "border-color 120ms ease, color 120ms ease",
          whiteSpace: "nowrap",
          zIndex: 10,
          position: "relative",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#333333";
          e.currentTarget.style.color = "#FFFFFF";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "#242424";
          e.currentTarget.style.color = "#A0A0A0";
        }}
      >
        <Cpu size={11} />
        <span
          style={{
            fontWeight: 500,
            maxWidth: "96px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selectedLabel}
        </span>
        <ChevronDown
          size={11}
          style={{
            flexShrink: 0,
            color: "#555555",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 150ms ease",
          }}
        />
      </button>
      <DropdownPortal />
    </>
  );
}
