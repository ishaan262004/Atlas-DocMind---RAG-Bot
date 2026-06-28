import { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { v4 as uuidv4 } from "uuid";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import CinematicLoader from "./components/CinematicLoader";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

export default function App() {
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [booting, setBooting] = useState(true);
  const isMobile = useIsMobile();

  const handleNewChat = useCallback(() => {
    setCurrentSessionId(null);
  }, []);

  const handleSelectSession = useCallback((sessionId) => {
    setCurrentSessionId(sessionId);
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, []);

  const handleNewSessionCreated = useCallback(() => {
    const newId = uuidv4();
    setCurrentSessionId(newId);
    return newId;
  }, []);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: "#000000",
        position: "relative",
      }}
    >
      {/* Cinematic boot sequence */}
      <AnimatePresence>
        {booting && (
          <CinematicLoader key="loader" onComplete={() => setBooting(false)} />
        )}
      </AnimatePresence>

      {/* Desktop sidebar — inline flex child (no Tailwind breakpoints) */}
      {!isMobile && (
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.div
              key="sidebar-desktop"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 256, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              style={{
                flexShrink: 0,
                overflow: "hidden",
                height: "100%",
              }}
            >
              <div style={{ width: "256px", height: "100%" }}>
                <Sidebar
                  currentSessionId={currentSessionId}
                  onNewChat={handleNewChat}
                  onSelectSession={handleSelectSession}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Mobile sidebar — fixed overlay */}
      {isMobile && (
        <AnimatePresence>
          {sidebarOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.7)",
                  zIndex: 30,
                }}
              />
              {/* Drawer */}
              <motion.div
                key="sidebar-mobile"
                initial={{ x: -256 }}
                animate={{ x: 0 }}
                exit={{ x: -256 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                style={{
                  position: "fixed",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: "256px",
                  zIndex: 40,
                  height: "100%",
                }}
              >
                <Sidebar
                  currentSessionId={currentSessionId}
                  onNewChat={handleNewChat}
                  onSelectSession={handleSelectSession}
                  onClose={() => setSidebarOpen(false)}
                  isMobile={true}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      )}

      {/* Main Chat Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          height: "100%",
          overflow: "hidden",
          background: "#000000",
        }}
      >
        <ChatWindow
          sessionId={currentSessionId}
          onNewSession={handleNewSessionCreated}
          onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
        />
      </div>
    </div>
  );
}
