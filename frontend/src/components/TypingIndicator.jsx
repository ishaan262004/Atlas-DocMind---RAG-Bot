import { motion } from "framer-motion";

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

export default function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        marginBottom: "16px",
      }}
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

      {/* Typing bubble */}
      <div
        style={{
          background: "#111111",
          border: "1px solid #242424",
          borderRadius: "2px 8px 8px 8px",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="typing-dot"
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "#555555",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
