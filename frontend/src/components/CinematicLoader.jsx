import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function CinematicLoader({ onComplete }) {
  const [phase, setPhase] = useState(0);
  // phase 0: mount
  // phase 1: title visible (100ms)
  // phase 2: bar visible (600ms)
  // phase 3: subtitle visible (1600ms)
  // phase 4: fading out (2400ms)
  // phase 5: done (2800ms)

  const [titleVisible, setTitleVisible] = useState(false);
  const [barVisible, setBarVisible] = useState(false);
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setTitleVisible(true), 100);
    const t2 = setTimeout(() => setBarVisible(true), 600);
    const t3 = setTimeout(() => setSubtitleVisible(true), 1600);
    const t4 = setTimeout(() => setFadingOut(true), 2400);
    const t5 = setTimeout(() => onComplete?.(), 2800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [onComplete]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "24px",
        background: "#000000",
        opacity: fadingOut ? 0 : 1,
        transition: "opacity 400ms ease",
      }}
    >
      {/* Title */}
      <div
        style={{
          opacity: titleVisible ? 1 : 0,
          transition: "opacity 500ms ease",
          fontFamily: "'Sora', sans-serif",
          fontSize: "22px",
          fontWeight: 700,
          letterSpacing: "0.3em",
          color: "#FFFFFF",
          textTransform: "uppercase",
        }}
      >
        ATLAS DOCMIND
      </div>

      {/* Progress bar */}
      <div
        style={{
          opacity: barVisible ? 1 : 0,
          transition: "opacity 300ms ease",
        }}
      >
        <div className="atlas-loader-bar">
          {barVisible && (
            <div
              className="atlas-loader-fill"
              style={{
                animation: "atlas-load 900ms ease forwards",
              }}
            />
          )}
        </div>
      </div>

      {/* Subtitle */}
      <div
        style={{
          opacity: subtitleVisible ? 1 : 0,
          transition: "opacity 500ms ease",
          fontFamily: "'Inter', sans-serif",
          fontSize: "11px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "#555555",
        }}
      >
        Intelligent Document Assistant
      </div>

      {/* Skip */}
      <button
        onClick={() => onComplete?.()}
        style={{
          position: "absolute",
          bottom: "32px",
          right: "24px",
          fontFamily: "'Inter', sans-serif",
          fontSize: "11px",
          letterSpacing: "0.1em",
          color: "#333333",
          background: "none",
          border: "none",
          cursor: "pointer",
          transition: "color 120ms ease",
        }}
        onMouseEnter={(e) => (e.target.style.color = "#FFFFFF")}
        onMouseLeave={(e) => (e.target.style.color = "#333333")}
      >
        SKIP
      </button>
    </div>
  );
}
