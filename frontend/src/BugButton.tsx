import React, { useState, useEffect, useRef } from "react";
import { api } from "./api";

type BugStatus = "open" | "test" | "done";

interface Bug {
  id: number;
  text: string;
  status: BugStatus;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

const STATUS_CYCLE: Record<BugStatus, BugStatus> = { open: "test", test: "done", done: "open" };
const STATUS_LABEL: Record<BugStatus, string> = { open: "open", test: "testovať", done: "hotovo" };
const STATUS_COLOR: Record<BugStatus, string> = { open: "#dc2626", test: "#d97706", done: "#16a34a" };
const STATUS_BG: Record<BugStatus, string>    = { open: "#3f0000", test: "#3f2a00", done: "#003f10" };

export default function BugButton() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"active" | "trash">("active");
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [trash, setTrash] = useState<Bug[]>([]);
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function load() {
    api.bugs.list()
      .then((res) => res?.json())
      .then((data) => setBugs(Array.isArray(data) ? data : []))
      .catch(() => {});
  }

  function loadTrash() {
    api.bugs.trash()
      .then((res) => res?.json())
      .then((data) => setTrash(Array.isArray(data) ? data : []))
      .catch(() => {});
  }

  useEffect(() => {
    if (open) {
      load();
      loadTrash();
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (open && view === "trash") loadTrash();
  }, [view]);

  async function create() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await api.bugs.create(text.trim());
      setText("");
      load();
    } finally {
      setSaving(false);
    }
  }

  async function update(id: number) {
    if (!editText.trim()) return;
    setSaving(true);
    try {
      await api.bugs.update(id, { text: editText.trim() });
      setEditingId(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function cycleStatus(id: number, current: BugStatus) {
    const next = STATUS_CYCLE[current] ?? "open";
    await api.bugs.update(id, { status: next });
    load();
  }

  async function remove(id: number) {
    await api.bugs.delete(id);
    load();
    loadTrash();
  }

  async function restore(id: number) {
    await api.bugs.restore(id);
    load();
    loadTrash();
  }

  async function hardDelete(id: number) {
    await api.bugs.hardDelete(id);
    loadTrash();
  }

  function copyText(id: number, t: string) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(t).then(() => {
        setCopied(id);
        setTimeout(() => setCopied(null), 1500);
      });
    } else {
      const el = document.createElement("textarea");
      el.value = t;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    }
  }

  function startEdit(bug: Bug) {
    setEditingId(bug.id);
    setEditText(bug.text);
  }

  function onKey(e: React.KeyboardEvent, fn: () => void) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) fn();
    if (e.key === "Escape") {
      setEditingId(null);
      setOpen(false);
    }
  }

  const openCount = bugs.filter((b) => (b.status ?? "open") !== "done").length;
  const isMobile = window.innerWidth <= 600;

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Bug notes"
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          zIndex: 9999,
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: openCount > 0 ? "#1e1e1e" : "#1a1a1a",
          border: openCount > 0 ? "1px solid #dc2626" : "1px solid #333",
          color: openCount > 0 ? "#dc2626" : "#555",
          cursor: "pointer",
          fontSize: 15,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "border-color 0.2s, color 0.2s",
        }}
      >
        🐛
      </button>

      {open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 10000,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: isMobile ? "center" : "flex-end",
            padding: isMobile ? 0 : 60,
          }}
        >
          <div
            style={{
              background: "#1e1e1e",
              border: "1px solid #2a2a2a",
              borderRadius: isMobile ? "12px 12px 0 0" : 8,
              width: isMobile ? "100vw" : 380,
              maxHeight: isMobile ? "85vh" : "70vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #2a2a2a", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "monospace", fontSize: 12, color: "#888", letterSpacing: "0.1em" }}>
                BUG NOTES {bugs.length > 0 && <span style={{ color: "#dc2626" }}>({openCount} open)</span>}
              </span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button
                  onClick={() => setView(view === "active" ? "trash" : "active")}
                  title={view === "active" ? "Zobraziť kôš" : "Späť"}
                  style={{ background: "none", border: "none", color: view === "trash" ? "#f59e0b" : "#555", cursor: "pointer", fontSize: 13 }}
                >
                  {view === "active" ? "🗑" : "←"}
                </button>
                <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 14 }}>✕</button>
              </div>
            </div>

            {/* Trash view */}
            {view === "trash" && (
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
                <div style={{ fontFamily: "monospace", fontSize: 10, color: "#666", marginBottom: 10, letterSpacing: "0.08em" }}>
                  KOŠ — {trash.length} záznamov
                </div>
                {trash.length === 0 && (
                  <div style={{ color: "#444", fontSize: 12, fontStyle: "italic", textAlign: "center", paddingTop: 8 }}>kôš je prázdny</div>
                )}
                {trash.map((b) => (
                  <div key={b.id} style={{
                    marginBottom: 10, padding: "8px 10px", background: "#1a1a1a", borderRadius: 5,
                    border: "1px solid #2a2a2a", opacity: 0.7,
                  }}>
                    <div style={{ fontSize: 12, color: "#888", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{b.text}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: "#444", flex: 1 }}>vymazané: {b.deleted_at?.slice(0, 16)}</span>
                      <button onClick={() => restore(b.id)} style={{ ...btnStyle("#14532d"), color: "#4ade80" }}>obnoviť</button>
                      <button
                        onClick={() => { if (window.confirm("Natrvalo vymazať?")) hardDelete(b.id); }}
                        style={btnStyle("#7f1d1d")}
                      >✕✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Active view */}
            {view === "active" && (
              <>
                <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
                  {bugs.length === 0 && (
                    <div style={{ color: "#444", fontSize: 12, fontStyle: "italic", textAlign: "center", paddingTop: 8 }}>žiadne poznámky</div>
                  )}
                  {bugs.map((b) => {
                    const status: BugStatus = b.status ?? "open";
                    return (
                      <div key={b.id} style={{
                        marginBottom: 10, padding: "8px 10px", background: "#252525", borderRadius: 5,
                        border: `1px solid ${status === "done" ? "#1a1a1a" : "#2a2a2a"}`,
                        opacity: status === "done" ? 0.55 : 1,
                      }}>
                        {editingId === b.id ? (
                          <div>
                            <textarea
                              autoFocus
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={(e) => onKey(e, () => update(b.id))}
                              rows={3}
                              style={{ width: "100%", background: "#1a1a1a", border: "1px solid #3a3a3a", color: "#e0e0e0", borderRadius: 4, padding: "6px 8px", fontSize: 12, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
                            />
                            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                              <button onClick={() => update(b.id)} disabled={saving} style={btnStyle("#2563eb")}>Uložiť</button>
                              <button onClick={() => setEditingId(null)} style={btnStyle("#333")}>Zrušiť</button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontSize: 12, color: status === "done" ? "#666" : "#ccc", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{b.text}</div>
                            <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                              <button
                                onClick={() => cycleStatus(b.id, status)}
                                style={{
                                  background: STATUS_BG[status],
                                  border: `1px solid ${STATUS_COLOR[status]}44`,
                                  color: STATUS_COLOR[status],
                                  borderRadius: 4,
                                  padding: "2px 7px",
                                  fontSize: 10,
                                  cursor: "pointer",
                                  fontFamily: "monospace",
                                  letterSpacing: "0.05em",
                                  fontWeight: 700,
                                }}
                              >
                                {STATUS_LABEL[status]}
                              </button>
                              <span style={{ fontSize: 10, color: "#444", flex: 1 }}>{b.created_at?.slice(0, 16)}</span>
                              <button onClick={() => copyText(b.id, b.text)} style={{ ...btnStyle(copied === b.id ? "#14532d" : "#1e3a2a"), color: copied === b.id ? "#4ade80" : "#6ee7b7", minWidth: 36 }}>
                                {copied === b.id ? "✓" : "copy"}
                              </button>
                              <button onClick={() => startEdit(b)} style={btnStyle("#374151")}>✎</button>
                              <button onClick={() => remove(b.id)} style={btnStyle("#7f1d1d")} title="Presunúť do koša">🗑</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div style={{ padding: "10px 16px 14px", borderTop: "1px solid #2a2a2a" }}>
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => onKey(e, create)}
                    placeholder="Nová poznámka... (Ctrl+Enter)"
                    rows={2}
                    style={{ width: "100%", background: "#141414", border: "1px solid #333", color: "#e0e0e0", borderRadius: 4, padding: "7px 9px", fontSize: 12, fontFamily: "inherit", resize: "none", boxSizing: "border-box" }}
                  />
                  <button
                    onClick={create}
                    disabled={saving || !text.trim()}
                    style={{ ...btnStyle("#1d4ed8"), marginTop: 7, width: "100%", opacity: text.trim() ? 1 : 0.4, padding: "7px 0" }}
                  >
                    Pridať
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    border: "none",
    color: "#e0e0e0",
    borderRadius: 4,
    padding: "3px 8px",
    fontSize: 11,
    cursor: "pointer",
    fontFamily: "inherit",
  };
}
