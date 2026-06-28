import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  X,
  Check,
  Loader2,
  Trash2,
  Download,
  AlertCircle,
} from "lucide-react";
import {
  uploadDocument,
  deleteDocument,
  documentDownloadUrl,
} from "../services/api";

const ACCEPTED_TYPES = {
  "application/pdf": [".pdf"],
  "text/plain": [".txt"],
  "text/markdown": [".md"],
  "text/csv": [".csv"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
};

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

function humanSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${i === 0 || n >= 10 ? Math.round(n) : n.toFixed(1)} ${units[i]}`;
}

function FileItem({ file, onRemove }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 12px",
        background: "#111111",
        border: "1px solid #242424",
        borderRadius: "6px",
        overflow: "hidden",
      }}
    >
      {/* File icon */}
      <div
        style={{
          width: "32px",
          height: "32px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1A1A1A",
          border: "1px solid #333333",
          borderRadius: "4px",
        }}
      >
        <FileText size={14} style={{ color: "#A0A0A0" }} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: "12px",
            color: "#FFFFFF",
            fontFamily: "'Inter', sans-serif",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontWeight: 500,
          }}
        >
          {file.name}
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginTop: "3px",
          }}
        >
          {file.status === "uploading" && (
            <Loader2
              size={11}
              style={{ color: "#A0A0A0", animation: "spin 1s linear infinite" }}
            />
          )}
          {file.status === "processing" && (
            <Loader2
              size={11}
              style={{ color: "#A0A0A0", animation: "spin 1s linear infinite" }}
            />
          )}
          {file.status === "success" && (
            <Check size={11} style={{ color: "#A0A0A0" }} />
          )}
          {file.status === "error" && (
            <AlertCircle size={11} style={{ color: "#A0A0A0" }} />
          )}
          <span
            style={{
              fontSize: "11px",
              color: "#A0A0A0",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {file.status === "uploading" && `Uploading... ${file.progress || 0}%`}
            {file.status === "processing" && "Processing…"}
            {file.status === "success" && `${file.chunks || 0} chunks ready`}
            {file.status === "error" && (file.error || "Upload failed")}
          </span>
          {file.size > 0 && (
            <>
              <span style={{ color: "#333333" }}>·</span>
              <span
                style={{
                  fontSize: "11px",
                  color: "#555555",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {humanSize(file.size)}
              </span>
            </>
          )}
        </div>

        {/* Progress bar */}
        {file.status === "uploading" && (
          <div
            style={{
              height: "1px",
              background: "#242424",
              borderRadius: "1px",
              marginTop: "6px",
              overflow: "hidden",
            }}
          >
            <motion.div
              style={{ height: "1px", background: "#FFFFFF", borderRadius: "1px" }}
              initial={{ width: 0 }}
              animate={{ width: `${file.progress || 0}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "2px", flexShrink: 0 }}>
        {file.status === "success" && file.documentId && (
          <a
            href={documentDownloadUrl(file.documentId)}
            target="_blank"
            rel="noreferrer"
            className="atlas-btn-ghost"
            style={{ padding: "6px" }}
            title="Download"
          >
            <Download size={12} />
          </a>
        )}
        {(file.status === "success" || file.status === "error") && (
          <button
            onClick={() => onRemove(file)}
            className="atlas-btn-ghost"
            style={{ padding: "6px" }}
            title="Remove"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default function UploadSection({ sessionId, onUploadComplete }) {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);

  const updateFile = (name, updates) => {
    setUploadedFiles((prev) =>
      prev.map((f) => (f.name === name ? { ...f, ...updates } : f)),
    );
  };

  const processFile = async (file) => {
    const fileEntry = {
      id: Date.now(),
      name: file.name,
      size: file.size,
      status: "uploading",
      progress: 0,
      chunks: 0,
      documentId: null,
    };
    setUploadedFiles((prev) => [fileEntry, ...prev]);

    try {
      const result = await uploadDocument(file, sessionId, (progress) =>
        updateFile(file.name, { progress }),
      );
      updateFile(file.name, {
        status: "success",
        chunks: result.chunks,
        documentId: result.document_id,
        progress: 100,
      });
      onUploadComplete?.();
    } catch (err) {
      updateFile(file.name, {
        status: "error",
        error: err.response?.data?.detail || err.message || "Upload failed",
      });
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles, rejectedFiles) => {
      if (!sessionId) {
        alert("Please start a chat session before uploading documents.");
        return;
      }
      for (const file of acceptedFiles) {
        await processFile(file);
      }
    },
    [sessionId],
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE,
    multiple: true,
  });

  const handleRemove = async (file) => {
    if (file.documentId) {
      try {
        await deleteDocument(file.documentId);
      } catch (err) {
        console.error("Failed to delete document:", err);
      }
    }
    setUploadedFiles((prev) => prev.filter((f) => f.name !== file.name));
    onUploadComplete?.();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Dropzone */}
      <div
        {...getRootProps()}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          textAlign: "center",
          borderRadius: "6px",
          border: `1px dashed ${isDragActive ? "#555555" : "#333333"}`,
          background: isDragActive ? "#111111" : "transparent",
          cursor: "pointer",
          transition: "all 120ms ease",
        }}
      >
        <input {...getInputProps()} />
        <Upload
          size={18}
          style={{ color: isDragActive ? "#A0A0A0" : "#555555", marginBottom: "6px" }}
        />
        <p
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: "#A0A0A0",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {isDragActive ? "Drop files here" : "Upload Documents"}
        </p>
        <p
          style={{
            fontSize: "11px",
            color: "#555555",
            marginTop: "2px",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          PDF, DOCX, CSV, TXT, MD — up to 50MB
        </p>
      </div>

      {/* File list */}
      <AnimatePresence>
        {uploadedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              maxHeight: "180px",
              overflowY: "auto",
            }}
          >
            {uploadedFiles.map((file) => (
              <FileItem
                key={`${file.name}-${file.id}`}
                file={file}
                onRemove={handleRemove}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
