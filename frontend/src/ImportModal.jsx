import { useState, useRef } from "react";
import { api } from "./api";

const MONO = "'SF Mono', 'Fira Code', 'Consolas', monospace";

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        inQuotes = !inQuotes;
      } else if (line[i] === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += line[i];
      }
    }
    values.push(current.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  });
}

export default function ImportModal({ blueprint, onClose, onSuccess }) {
  const [step, setStep] = useState("prompt"); // prompt | preview | importing | done | error
  const [rows, setRows] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const fileRef = useRef();

  function downloadTemplate() {
    const headers = blueprint.columns.map((c) => c.key).join(",");
    const examples = blueprint.exampleRows
      .map((row) => blueprint.columns.map((c) => row[c.key] ?? "").join(","))
      .join("\n");
    const csv = headers + "\n" + examples;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${blueprint.apiEndpoint.split("/").pop()}_sablona.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyPrompt() {
    navigator.clipboard.writeText(blueprint.botPrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result);
      if (parsed.length === 0) {
        setErrorMsg("CSV je prazdne alebo ma nespravny format.");
        setStep("error");
        return;
      }
      setRows(parsed);
      setStep("preview");
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  }

  async function doImport() {
    setStep("importing");
    try {
      const res = await api.post(blueprint.apiEndpoint, rows);
      if (!res || !res.ok) {
        const data = await res?.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res?.status ?? "?"}`);
      }
      setStep("done");
      setTimeout(() => { onSuccess?.(); onClose(); }, 1200);
    } catch (err) {
      setErrorMsg(err.message);
      setStep("error");
    }
  }

  return (
    <div style={M.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={M.modal}>
        <div style={M.header}>
          <span style={M.title}>Import — {blueprint.label}</span>
          <button style={M.closeBtn} onClick={onClose}>x</button>
        </div>

        {step === "prompt" && (
          <>
            <div style={M.stepLabel}>1 — Skopiruj prikaz pre AI bota</div>
            <pre style={M.promptBox}>{blueprint.botPrompt}</pre>
            <button style={M.ghostBtn} onClick={copyPrompt}>
              {copied ? "Skopirovane" : "Kopirovat prikaz"}
            </button>

            <div style={M.sep} />

            <div style={M.stepLabel}>2 — Stiahni CSV sablonu</div>
            <div style={M.colGrid}>
              {blueprint.columns.map((col) => (
                <div key={col.key} style={M.colRow}>
                  <code style={M.colKey}>{col.key}</code>
                  <span style={M.colDesc}>
                    {col.required && <span style={M.required}>* </span>}
                    {col.description || col.label}
                  </span>
                </div>
              ))}
            </div>
            <button style={M.ghostBtnDim} onClick={downloadTemplate}>
              Stiahnut sablonu (.csv)
            </button>

            <div style={M.sep} />

            <div style={M.stepLabel}>3 — Nahraj vyplnene CSV</div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={handleFile}
            />
            <button style={M.uploadBtn} onClick={() => fileRef.current.click()}>
              Vybrat subor...
            </button>
          </>
        )}

        {step === "preview" && (
          <>
            <div style={M.previewInfo}>
              Nahlad — <strong style={{ color: "#e0e0e0" }}>{rows.length}</strong> riadkov
            </div>
            <div style={M.tableWrap}>
              <table style={M.table}>
                <thead>
                  <tr>
                    {blueprint.columns.map((col) => (
                      <th key={col.key} style={M.th}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 8).map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "#141414" : "#101010" }}>
                      {blueprint.columns.map((col) => (
                        <td key={col.key} style={M.td}>{row[col.key] || <span style={{ color: "#333" }}>-</span>}</td>
                      ))}
                    </tr>
                  ))}
                  {rows.length > 8 && (
                    <tr>
                      <td colSpan={blueprint.columns.length} style={{ ...M.td, color: "#333", textAlign: "center" }}>
                        + dalsich {rows.length - 8} riadkov
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={M.previewActions}>
              <button style={M.backBtn} onClick={() => { setStep("prompt"); setRows([]); }}>
                Spat
              </button>
              <button style={M.importBtn} onClick={doImport}>
                Importovat {rows.length} riadkov
              </button>
            </div>
          </>
        )}

        {step === "importing" && (
          <div style={M.statusMsg}>Importujem...</div>
        )}

        {step === "done" && (
          <div style={{ ...M.statusMsg, color: "#22c55e" }}>Import dokonceny</div>
        )}

        {step === "error" && (
          <>
            <div style={M.errorMsg}>{errorMsg}</div>
            <button style={M.backBtn} onClick={() => setStep(rows.length ? "preview" : "prompt")}>
              Spat
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const M = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.85)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "16px",
  },
  modal: {
    background: "#0f0f0f",
    border: "1px solid #1e1e1e",
    borderRadius: 12,
    width: "100%",
    maxWidth: 520,
    maxHeight: "90vh",
    overflowY: "auto",
    padding: "28px 24px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    boxShadow: "0 32px 80px rgba(0,0,0,0.8)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    color: "#888",
    letterSpacing: "0.06em",
    fontFamily: MONO,
    textTransform: "uppercase",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#444",
    fontSize: 20,
    cursor: "pointer",
    lineHeight: 1,
    padding: "0 4px",
  },
  stepLabel: {
    fontSize: 11,
    color: "#3a3a3a",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontFamily: MONO,
  },
  promptBox: {
    background: "#080808",
    border: "1px solid #1a1a1a",
    borderRadius: 8,
    padding: "14px 16px",
    color: "#666",
    fontSize: 12,
    fontFamily: MONO,
    lineHeight: 1.7,
    whiteSpace: "pre-wrap",
    margin: 0,
    maxHeight: 200,
    overflowY: "auto",
  },
  ghostBtn: {
    background: "transparent",
    border: "1px solid #22c55e30",
    borderRadius: 6,
    color: "#22c55e",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.04em",
    padding: "9px 16px",
    cursor: "pointer",
    alignSelf: "flex-start",
    transition: "border-color 0.2s",
  },
  ghostBtnDim: {
    background: "transparent",
    border: "1px solid #1e1e1e",
    borderRadius: 6,
    color: "#555",
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: "0.04em",
    padding: "9px 16px",
    cursor: "pointer",
    alignSelf: "flex-start",
    transition: "border-color 0.2s",
  },
  sep: {
    borderTop: "1px solid #141414",
    margin: "4px 0",
  },
  colGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  colRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 10,
  },
  colKey: {
    fontFamily: MONO,
    fontSize: 11,
    color: "#555",
    background: "#141414",
    border: "1px solid #1e1e1e",
    borderRadius: 4,
    padding: "2px 7px",
    flexShrink: 0,
  },
  colDesc: {
    fontSize: 12,
    color: "#3a3a3a",
  },
  required: {
    color: "#ef4444",
    marginRight: 4,
  },
  uploadBtn: {
    background: "transparent",
    border: "1px dashed #1e1e1e",
    borderRadius: 8,
    color: "#555",
    fontSize: 13,
    padding: "13px 20px",
    cursor: "pointer",
    width: "100%",
    textAlign: "left",
    letterSpacing: "0.02em",
    transition: "border-color 0.2s",
  },
  previewInfo: {
    fontSize: 13,
    color: "#555",
    marginBottom: 4,
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #1a1a1a",
    borderRadius: 8,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12,
    fontFamily: MONO,
  },
  th: {
    padding: "8px 12px",
    textAlign: "left",
    color: "#444",
    fontWeight: 600,
    letterSpacing: "0.06em",
    fontSize: 10,
    textTransform: "uppercase",
    background: "#0a0a0a",
    borderBottom: "1px solid #1a1a1a",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "7px 12px",
    color: "#888",
    borderBottom: "1px solid #111",
    whiteSpace: "nowrap",
  },
  previewActions: {
    display: "flex",
    gap: 8,
    justifyContent: "flex-end",
    marginTop: 4,
  },
  backBtn: {
    background: "none",
    border: "1px solid #1e1e1e",
    borderRadius: 6,
    color: "#555",
    fontSize: 12,
    padding: "8px 16px",
    cursor: "pointer",
  },
  importBtn: {
    background: "transparent",
    border: "1px solid #22c55e30",
    borderRadius: 6,
    color: "#22c55e",
    fontSize: 12,
    fontWeight: 600,
    padding: "8px 20px",
    cursor: "pointer",
    letterSpacing: "0.04em",
  },
  statusMsg: {
    textAlign: "center",
    padding: "32px 0",
    fontSize: 15,
    color: "#555",
    fontFamily: MONO,
  },
  errorMsg: {
    background: "#160a0a",
    border: "1px solid #ef444420",
    borderRadius: 8,
    padding: "14px 16px",
    color: "#ef4444",
    fontSize: 13,
    fontFamily: MONO,
  },
};
