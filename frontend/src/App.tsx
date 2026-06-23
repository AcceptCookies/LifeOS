import { useState, useEffect, useCallback, useRef } from "react";
import { api, token } from "./api";
import AuthPage from "./AuthPage";
import BugButton from "./BugButton";
import PantryPage from "./PantryPage";
import ProfilePage from "./ProfilePage";
import WorkoutPage from "./WorkoutPage";

// Each habit: key matches backend JSON field, label in Slovak, color for dots/streaks
interface Habit {
  key: string;
  label: string;
  color: string;
  negative?: boolean;
}

const HABITS: Habit[] = [
  { key: "strength_training", label: "Silový tréning", color: "#ef4444" },
  { key: "cardio",            label: "Kardio",          color: "#f97316" },
  { key: "walking",           label: "Chôdza",          color: "#22c55e" },
  { key: "running",           label: "Beh",             color: "#eab308" },
  { key: "stretching",        label: "Strečing",        color: "#06b6d4" },
  { key: "meditation",        label: "Meditácia",       color: "#a78bfa" },
  { key: "learning",          label: "Učenie",          color: "#3b82f6" },
  { key: "cheat_food",        label: "Cheat jedlo",     color: "#6b7280", negative: true },
];

interface HabitForm {
  strength_training: boolean;
  cardio: boolean;
  walking: boolean;
  running: boolean;
  stretching: boolean;
  meditation: boolean;
  learning: boolean;
  cheat_food: boolean;
  notes: string;
}

const EMPTY_FORM: HabitForm = {
  strength_training: false,
  cardio: false,
  walking: false,
  running: false,
  stretching: false,
  meditation: false,
  learning: false,
  cheat_food: false,
  notes: "",
};

const DOW = ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"];
const MONTHS_SK = ["jan", "feb", "mar", "apr", "máj", "jún", "júl", "aug", "sep", "okt", "nov", "dec"];
const DAYS_SK = ["Nedeľa", "Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota"];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateSK(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${DAYS_SK[d.getDay()]}, ${d.getDate()}. ${MONTHS_SK[d.getMonth()]} ${d.getFullYear()}`;
}

function apiFormFromResponse(data: any): HabitForm {
  const f = { ...EMPTY_FORM };
  for (const h of HABITS) f[h.key as keyof HabitForm] = !!data[h.key] as any;
  f.notes = data.notes || "";
  return f;
}

const MONO = "'SF Mono', 'Fira Code', 'Consolas', monospace";

interface IconProps extends React.SVGProps<SVGSVGElement> {
  d?: string;
  children?: React.ReactNode;
}

const I = ({ d, children, ...props }: IconProps): JSX.Element => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    {...props}>
    {children}
  </svg>
);

type TabKey = "habits" | "workout" | "pantry" | "shop" | "recipes" | "profile";

interface Tab {
  key: TabKey;
  label: string;
  icon: JSX.Element;
}

const TABS: Tab[] = [
  {
    key: "habits", label: "Návyky",
    icon: <I><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></I>,
  },
  {
    key: "workout", label: "Tréning",
    icon: <I><path d="M6.5 6.5h11"/><path d="M6.5 17.5h11"/><path d="M3 3v18"/><path d="M21 3v18"/><path d="M3 12h18"/></I>,
  },
  {
    key: "pantry", label: "Kuchyňa",
    icon: <I><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"/></I>,
  },
  {
    key: "shop", label: "Nákup",
    icon: <I><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></I>,
  },
  {
    key: "recipes", label: "Recepty",
    icon: <I><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></I>,
  },
  {
    key: "profile", label: "Profil",
    icon: <I><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></I>,
  },
];

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}

export default function App(): JSX.Element {
  const [authed, setAuthed] = useState(!!token.get());
  const [activePage, setActivePage] = useState<TabKey>("habits");
  const isMobile = useIsMobile();

  if (!authed) {
    return <AuthPage onAuth={() => setAuthed(true)} />;
  }

  function handleLogout(): void {
    token.clear();
    setAuthed(false);
  }

  function navigate(key: TabKey): void {
    setActivePage(key);
  }

  const content = activePage === "habits"
    ? <HabitTracker onLogout={handleLogout} />
    : activePage === "workout"
    ? <WorkoutPage />
    : activePage === "profile"
    ? <ProfilePage />
    : <PantryPage activeTab={activePage} onTabChange={setActivePage} />;

  return (
    <div style={NAV.root}>
      {/* ── Desktop top nav ── */}
      {!isMobile && (
        <div style={NAV.topBar}>
          <div style={NAV.topInner}>
            <span style={NAV.topLogo}>LifeOS</span>
            <div style={NAV.topTabs}>
              {TABS.map(({ key, label }) => (
                <button
                  key={key}
                  style={{ ...NAV.topBtn, ...(activePage === key ? NAV.topBtnActive : {}) }}
                  onClick={() => navigate(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button style={NAV.topLogout} onClick={handleLogout}>Odhlásiť</button>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div style={{
        paddingTop: isMobile ? 0 : 56,
        paddingBottom: isMobile ? 90 : 0,
        overflowX: "hidden",
        minHeight: "100vh",
      }}>
        {content}
      </div>

      {/* ── Mobile bottom tab bar ── */}
      {isMobile && (
        <div style={NAV.bottomBar}>
          {TABS.map(({ key, icon }) => (
            <button
              key={key}
              style={{ ...NAV.bottomBtn, ...(activePage === key ? NAV.bottomBtnActive : {}) }}
              onClick={() => navigate(key)}
            >
              {icon}
            </button>
          ))}
        </div>
      )}

      <BugButton />
    </div>
  );
}

const NAV: Record<string, React.CSSProperties> = {
  root: {
    background: "#0f0f0f",
    minHeight: "100vh",
    overflowX: "hidden",
    position: "relative",
  },
  // Desktop top bar
  topBar: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    background: "rgba(8,8,8,0.98)",
    borderBottom: "1px solid #181818",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    zIndex: 1000,
    height: 56,
  },
  topInner: {
    maxWidth: 960,
    margin: "0 auto",
    height: "100%",
    display: "flex",
    alignItems: "center",
    padding: "0 20px",
    gap: 12,
  },
  topLogo: {
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: "0.22em",
    fontFamily: MONO,
    color: "#f0f0f0",
    marginRight: 16,
    flexShrink: 0,
  },
  topTabs: {
    display: "flex",
    gap: 4,
    flex: 1,
  },
  topBtn: {
    background: "none",
    border: "1px solid #1e1e1e",
    borderRadius: 6,
    color: "#484848",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.03em",
    padding: "6px 16px",
    cursor: "pointer",
    fontFamily: MONO,
    transition: "all 0.2s",
  },
  topBtnActive: {
    background: "#0a1a0a",
    border: "1px solid #22c55e30",
    color: "#22c55e",
  },
  topLogout: {
    background: "none",
    border: "1px solid #181818",
    borderRadius: 6,
    color: "#2e2e2e",
    fontSize: 11,
    letterSpacing: "0.03em",
    padding: "6px 12px",
    cursor: "pointer",
    flexShrink: 0,
  },

  // Mobile bottom tab bar
  bottomBar: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    background: "rgba(8,8,8,0.97)",
    borderTop: "1px solid #161616",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    display: "flex",
    zIndex: 1000,
  },
  bottomBtn: {
    flex: 1,
    background: "none",
    border: "none",
    color: "#363636",
    fontSize: 24,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "color 0.2s",
  },
  bottomBtnActive: {
    color: "#22c55e",
  },
};

interface DayData {
  habits?: Record<string, any>;
  muscles?: string[];
  workout_notes?: string;
  cooked_recipes?: string[];
}

interface DayModalProps {
  date: string;
  onClose: () => void;
  onSaved: () => void;
}

function DayModal({ date, onClose, onSaved }: DayModalProps): JSX.Element {
  const [data, setData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<HabitForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moveDate, setMoveDate] = useState("");
  const [showMove, setShowMove] = useState(false);
  const [moving, setMoving] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.day.get(date).then(r => r!.json()).then((d: DayData) => {
      setData(d);
      if (d.habits) setForm(apiFormFromResponse(d.habits));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [date]);

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>): void {
    if (e.target === overlayRef.current) onClose();
  }

  async function handleSave(): Promise<void> {
    setSaving(true);
    const body: Record<string, unknown> = {};
    for (const h of HABITS) body[h.key] = !!form[h.key as keyof HabitForm];
    body.notes = form.notes || "";
    try {
      await api.habits.save(date, body);
      onSaved();
      onClose();
    } catch { /* keep open */ } finally { setSaving(false); }
  }

  async function handleDelete(): Promise<void> {
    if (!confirm(`Vymazať záznamy návykov pre ${formatDateSK(date)}?`)) return;
    setDeleting(true);
    try {
      await api.habits.delete(date);
      onSaved();
      onClose();
    } catch { /* keep open */ } finally { setDeleting(false); }
  }

  async function handleMove(): Promise<void> {
    if (!moveDate || moveDate === date) return;
    setMoving(true);
    const body: Record<string, unknown> = {};
    for (const h of HABITS) body[h.key] = !!form[h.key as keyof HabitForm];
    body.notes = form.notes || "";
    try {
      await api.habits.save(moveDate, body);
      await api.habits.delete(date);
      onSaved();
      onClose();
    } catch { /* keep open */ } finally { setMoving(false); }
  }

  const hasWorkout = (data?.muscles?.length ?? 0) > 0;
  const hasRecipes = (data?.cooked_recipes?.length ?? 0) > 0;

  return (
    <div ref={overlayRef} onClick={handleOverlayClick} style={DM.overlay}>
      <div style={DM.modal}>
        <div style={DM.header}>
          <div style={DM.dateTitle}>{formatDateSK(date)}</div>
          <button style={DM.closeBtn} onClick={onClose}>✕</button>
        </div>

        {loading && <div style={DM.empty}>Načítavam...</div>}

        {!loading && (
          <>
            {/* Editable habits */}
            <div style={DM.section}>
              <div style={DM.sectionTitle}>Návyky</div>
              <div style={DM.habitEditList}>
                {HABITS.map(({ key, label, color }) => {
                  const checked = !!form[key as keyof HabitForm];
                  return (
                    <label key={key} style={DM.habitEditRow}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                        style={{ accentColor: color, width: 17, height: 17, flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 13, color: checked ? color : "#555" }}>{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div style={DM.section}>
              <div style={DM.sectionTitle}>Poznámky</div>
              <textarea
                style={DM.notesInput}
                rows={2}
                placeholder="Poznámky..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {/* Workout (read-only) */}
            {hasWorkout && (
              <div style={DM.section}>
                <div style={DM.sectionTitle}>Tréning</div>
                <div style={DM.muscleList}>
                  {data!.muscles!.map((m, i) => (
                    <span key={i} style={DM.muscleChip}>{m}</span>
                  ))}
                </div>
                {data!.workout_notes && <div style={DM.notesText}>{data!.workout_notes}</div>}
              </div>
            )}

            {/* Recipes (read-only) */}
            {hasRecipes && (
              <div style={DM.section}>
                <div style={DM.sectionTitle}>Jedlo</div>
                <div style={DM.recipeList}>
                  {data!.cooked_recipes!.map((r, i) => (
                    <span key={i} style={DM.recipeChip}>{r}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={DM.actions}>
              <button style={DM.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? "Ukladám..." : "Uložiť"}
              </button>
              <button style={DM.deleteBtn} onClick={handleDelete} disabled={deleting}>
                {deleting ? "..." : "Vymazať"}
              </button>
            </div>

            {/* Move to another date */}
            {!showMove ? (
              <button style={DM.moveToggle} onClick={() => setShowMove(true)}>
                Presunúť na iný deň →
              </button>
            ) : (
              <div style={DM.moveRow}>
                <input
                  type="date"
                  style={DM.dateInput}
                  value={moveDate}
                  onChange={(e) => setMoveDate(e.target.value)}
                />
                <button style={DM.saveBtnSm} onClick={handleMove} disabled={moving || !moveDate}>
                  {moving ? "..." : "Presunúť"}
                </button>
                <button style={DM.cancelBtnSm} onClick={() => { setShowMove(false); setMoveDate(""); }}>
                  Zrušiť
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const DM: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.72)",
    zIndex: 2000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
  },
  modal: {
    background: "#141414",
    border: "1px solid #1e1e1e",
    borderRadius: 12,
    padding: "20px 20px 24px",
    width: "100%",
    maxWidth: 380,
    maxHeight: "80vh",
    overflowY: "auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  dateTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#e8e8e8",
    fontFamily: MONO,
    letterSpacing: "0.03em",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#444",
    fontSize: 16,
    cursor: "pointer",
    padding: "2px 6px",
    lineHeight: 1,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 10,
    color: "#3a3a3a",
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    fontFamily: MONO,
    marginBottom: 8,
  },
  habitList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  habitChip: {
    fontSize: 12,
    border: "1px solid",
    borderRadius: 5,
    padding: "3px 9px",
    fontFamily: MONO,
  },
  muscleList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  muscleChip: {
    fontSize: 12,
    border: "1px solid #ef4444",
    borderRadius: 5,
    padding: "3px 9px",
    color: "#ef4444",
    fontFamily: MONO,
  },
  recipeList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  recipeChip: {
    fontSize: 12,
    border: "1px solid #f97316",
    borderRadius: 5,
    padding: "3px 9px",
    color: "#f97316",
    fontFamily: MONO,
  },
  notesText: {
    fontSize: 13,
    color: "#666",
    lineHeight: 1.5,
    marginTop: 6,
  },
  empty: {
    fontSize: 13,
    color: "#444",
    textAlign: "center",
    padding: "20px 0",
  },

  // Edit controls
  habitEditList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  habitEditRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "5px 0",
    cursor: "pointer",
  },
  notesInput: {
    background: "#0c0c0c",
    border: "1px solid #222",
    borderRadius: 7,
    padding: "8px 10px",
    color: "#e8e8e8",
    fontSize: 13,
    outline: "none",
    width: "100%",
    resize: "vertical" as const,
    fontFamily: "'Inter', system-ui, sans-serif",
    lineHeight: 1.5,
    boxSizing: "border-box" as const,
  },
  actions: {
    display: "flex",
    gap: 8,
    marginTop: 4,
    marginBottom: 12,
  },
  saveBtn: {
    flex: 1,
    background: "none",
    border: "1px solid #22c55e40",
    borderRadius: 7,
    color: "#22c55e",
    fontSize: 13,
    fontWeight: 600,
    padding: "10px 0",
    cursor: "pointer",
    letterSpacing: "0.04em",
  },
  deleteBtn: {
    background: "none",
    border: "1px solid #ef444430",
    borderRadius: 7,
    color: "#ef4444",
    fontSize: 13,
    padding: "10px 16px",
    cursor: "pointer",
  },
  moveToggle: {
    background: "none",
    border: "none",
    color: "#3a3a3a",
    fontSize: 11,
    cursor: "pointer",
    padding: "4px 0",
    letterSpacing: "0.03em",
    display: "block",
  },
  moveRow: {
    display: "flex",
    gap: 6,
    alignItems: "center",
    marginTop: 4,
  },
  dateInput: {
    flex: 1,
    background: "#0c0c0c",
    border: "1px solid #222",
    borderRadius: 6,
    color: "#e8e8e8",
    fontSize: 13,
    padding: "6px 8px",
    outline: "none",
    colorScheme: "dark" as const,
  },
  saveBtnSm: {
    background: "none",
    border: "1px solid #22c55e40",
    borderRadius: 6,
    color: "#22c55e",
    fontSize: 11,
    padding: "5px 12px",
    cursor: "pointer",
  },
  cancelBtnSm: {
    background: "none",
    border: "1px solid #1e1e1e",
    borderRadius: 6,
    color: "#444",
    fontSize: 11,
    padding: "5px 10px",
    cursor: "pointer",
  },
};

interface HabitTrackerProps {
  onLogout: () => void;
}

interface HistoryEntry extends Record<string, any> {
  date: string;
}

function HabitTracker({ onLogout }: HabitTrackerProps): JSX.Element {
  const [form, setForm] = useState<HabitForm>(EMPTY_FORM);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [todayRes, histRes, streakRes] = await Promise.all([
        api.get("/api/today"),
        api.get("/api/history"),
        api.get("/api/streaks"),
      ]);
      const [todayData, histData, streakData] = await Promise.all([
        todayRes!.json(),
        histRes!.json(),
        streakRes!.json(),
      ]);
      setForm(apiFormFromResponse(todayData));
      setHistory(Array.isArray(histData) ? histData : []);
      setStreaks(streakData || {});
    } catch (e) {
      console.error("load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function save(): Promise<void> {
    setSaving(true);
    setSaveState("saving");
    try {
      const body: Record<string, any> = { ...EMPTY_FORM };
      for (const h of HABITS) body[h.key] = !!form[h.key as keyof HabitForm];
      body.notes = form.notes || "";

      await api.post("/api/today", body);

      const [histRes, streakRes] = await Promise.all([
        api.get("/api/history"),
        api.get("/api/streaks"),
      ]);
      const [histData, streakData] = await Promise.all([
        histRes!.json(),
        streakRes!.json(),
      ]);
      setHistory(Array.isArray(histData) ? histData : []);
      setStreaks(streakData || {});
      setSaveState("ok");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (e) {
      console.error("save error:", e);
      setSaveState("err");
      setTimeout(() => setSaveState("idle"), 3000);
    } finally {
      setSaving(false);
    }
  }

  const last30: string[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    last30.push(d.toISOString().slice(0, 10));
  }

  const histMap: Record<string, HistoryEntry> = {};
  for (const h of history) histMap[h.date] = h;

  const firstDate = new Date(last30[0] + "T12:00:00");
  const firstDow = (firstDate.getDay() + 6) % 7;
  const calCells: (string | null)[] = [...Array(firstDow).fill(null), ...last30];

  if (loading) {
    return (
      <div style={S.page}>
        <div style={S.centered}>Načítavam...</div>
      </div>
    );
  }

  const today = todayStr();
  const doneCount = HABITS.filter((h) => !h.negative && form[h.key as keyof HabitForm]).length;

  // suppress unused warning — onLogout is kept for potential future use
  void onLogout;

  return (
    <div style={S.page}>
      {selectedDay && (
        <DayModal date={selectedDay} onClose={() => setSelectedDay(null)} onSaved={loadAll} />
      )}
      <div style={S.container}>

        {/* ── Header ── */}
        <div style={S.header}>
          <div style={S.appTitle}>LifeOS</div>
          <div style={S.dateLabel}>{formatDateSK(today)}</div>
          <div style={S.doneLabel}>
            {doneCount} / {HABITS.filter((h) => !h.negative).length} návykov
          </div>
        </div>

        {/* ── Habit checkboxes ── */}
        <div style={S.card}>
          {HABITS.map(({ key, label, color, negative }) => {
            const checked = !!form[key as keyof HabitForm];
            return (
              <label key={key} style={S.habitRow}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                  style={{ accentColor: color, width: 20, height: 20, flexShrink: 0 }}
                />
                <span style={{ ...S.habitLabel, color: checked ? color : "#888" }}>
                  {label}
                </span>
                {(streaks[key] || 0) > 0 ? (
                  <span style={{ ...S.streakPill, borderColor: color, color }}>
                    {streaks[key]}{negative ? "d" : "🔥"}
                  </span>
                ) : (
                  <span style={S.streakPillEmpty}>—</span>
                )}
              </label>
            );
          })}
        </div>

        {/* ── Notes ── */}
        <textarea
          style={S.notes}
          placeholder="Poznámky (voliteľné)..."
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={3}
        />

        {/* ── Save ── */}
        <button
          style={{
            ...S.saveBtn,
            opacity: saving ? 0.6 : 1,
            background: saveState === "err" ? "#7f1d1d" : "#14532d",
            borderColor: saveState === "err" ? "#ef4444" : "#22c55e",
          }}
          onClick={save}
          disabled={saving}
        >
          {saveState === "saving" ? "Ukladám..." : saveState === "ok" ? "✓ Uložené" : saveState === "err" ? "✗ Chyba" : "Uložiť"}
        </button>

        {/* ── Streak grid ── */}
        <div style={S.sectionTitle}>Série</div>
        <div style={S.streakGrid}>
          {HABITS.map(({ key, label, color }) => {
            const n = streaks[key] || 0;
            return (
              <div key={key} style={S.streakBox}>
                <div style={{ ...S.streakNum, color: n > 0 ? color : "#444" }}>{n}</div>
                <div style={S.streakLabel}>{label.split(" ")[0]}</div>
              </div>
            );
          })}
        </div>

        {/* ── 30-day calendar ── */}
        <div style={S.sectionTitle}>Posledných 30 dní</div>
        <div style={S.calGrid}>
          {DOW.map((d) => (
            <div key={d} style={S.calDow}>{d}</div>
          ))}
          {calCells.map((date, i) => {
            if (!date) return <div key={`pad-${i}`} />;
            const entry = histMap[date];
            const isToday = date === today;
            const dayNum = parseInt(date.slice(8), 10);
            const isFirst = dayNum === 1;
            return (
              <div
                key={date}
                onClick={() => setSelectedDay(date)}
                style={{
                  ...S.calCell,
                  border: isToday ? "1px solid #484848" : "1px solid #1a1a1a",
                  background: isToday ? "#111320" : "#141414",
                  cursor: "pointer",
                }}
              >
                <div style={{ ...S.calDay, color: isToday ? "#e8e8e8" : "#444" }}>
                  {isFirst ? `${MONTHS_SK[parseInt(date.slice(5, 7)) - 1]} ${dayNum}` : dayNum}
                </div>
                <div style={S.dotGrid}>
                  {HABITS.map(({ key, color }) => (
                    <div
                      key={key}
                      style={{
                        ...S.dot,
                        background: entry?.[key] ? color : "#2a2a2a",
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Legend ── */}
        <div style={S.legend}>
          {HABITS.map(({ key, label, color }) => (
            <div key={key} style={S.legendItem}>
              <div style={{ ...S.dot, background: color, width: 8, height: 8 }} />
              <span style={S.legendLabel}>{label}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

/* ── Styles ── */
const S: Record<string, React.CSSProperties> = {
  page: {
    background: "#0f0f0f",
    fontFamily: "'Inter', system-ui, sans-serif",
    color: "#e8e8e8",
    overflowX: "hidden",
  },
  centered: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    color: "#444",
    fontSize: 16,
  },
  container: {
    maxWidth: 480,
    width: "100%",
    margin: "0 auto",
    padding: "28px 16px 56px",
    boxSizing: "border-box",
  },
  header: {
    marginBottom: 28,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: "0.2em",
    fontFamily: MONO,
    color: "#f0f0f0",
  },
  dateLabel: {
    fontSize: 13,
    color: "#555",
    marginTop: 5,
    letterSpacing: "0.01em",
  },
  doneLabel: {
    fontSize: 12,
    color: "#444",
    marginTop: 3,
    fontFamily: MONO,
    letterSpacing: "0.04em",
  },
  logoutBtn: {
    background: "none",
    border: "1px solid #1e1e1e",
    borderRadius: 6,
    color: "#444",
    fontSize: 12,
    padding: "5px 10px",
    cursor: "pointer",
  },
  card: {
    background: "#141414",
    borderRadius: 10,
    border: "1px solid #1e1e1e",
    marginBottom: 14,
    overflow: "hidden",
  },
  habitRow: {
    display: "flex",
    alignItems: "center",
    gap: 13,
    padding: "14px 18px",
    cursor: "pointer",
    minWidth: 0,
    borderBottom: "1px solid #181818",
    transition: "background 0.15s",
  },
  habitLabel: {
    fontSize: 15,
    fontWeight: 500,
    flex: 1,
    minWidth: 0,
    transition: "color 0.2s",
  },
  streakPill: {
    fontSize: 12,
    fontFamily: MONO,
    border: "1px solid",
    borderRadius: 4,
    padding: "1px 7px",
    whiteSpace: "nowrap",
    opacity: 0.85,
  },
  streakPillEmpty: {
    fontSize: 12,
    color: "#333",
    fontFamily: MONO,
    minWidth: 28,
    textAlign: "right",
  },
  notes: {
    background: "#0c0c0c",
    border: "1px solid #222",
    borderRadius: 8,
    padding: "12px 14px",
    color: "#e8e8e8",
    fontSize: 14,
    outline: "none",
    width: "100%",
    resize: "vertical",
    fontFamily: "'Inter', system-ui, sans-serif",
    marginBottom: 14,
    lineHeight: 1.6,
    boxSizing: "border-box",
  },
  saveBtn: {
    width: "100%",
    background: "transparent",
    border: "1px solid #22c55e30",
    borderRadius: 8,
    color: "#22c55e",
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: "0.08em",
    padding: "15px 0",
    cursor: "pointer",
    marginBottom: 40,
    transition: "border-color 0.2s, opacity 0.15s",
  },
  sectionTitle: {
    fontSize: 11,
    color: "#3e3e3e",
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    marginBottom: 12,
    fontFamily: MONO,
  },
  streakGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 6,
    marginBottom: 40,
  },
  streakBox: {
    background: "#141414",
    border: "1px solid #1e1e1e",
    borderRadius: 8,
    padding: "14px 8px",
    textAlign: "center",
  },
  streakNum: {
    fontSize: 22,
    fontWeight: 700,
    fontFamily: MONO,
    lineHeight: 1,
  },
  streakLabel: {
    fontSize: 10,
    color: "#444",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginTop: 6,
  },
  calGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 3,
    marginBottom: 14,
  },
  calDow: {
    textAlign: "center",
    fontSize: 9,
    color: "#383838",
    fontFamily: MONO,
    padding: "3px 0",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  calCell: {
    borderRadius: 5,
    padding: "4px 3px 5px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  calDay: {
    fontSize: 10,
    fontFamily: MONO,
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: "nowrap",
  },
  dotGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: "50%",
  },
  legend: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px 20px",
    marginTop: 4,
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  legendLabel: {
    fontSize: 12,
    color: "#666",
  },
};
