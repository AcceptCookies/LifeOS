import { useState, useEffect, useCallback } from "react";
import { api } from "./api";
import ImportModal from "./ImportModal";
import { BLUEPRINTS } from "./importBlueprints";
import type { Blueprint } from "./importBlueprints";

const MONO = "'SF Mono', 'Fira Code', 'Consolas', monospace";
const MONTHS_SK = ["jan", "feb", "mar", "apr", "máj", "jún", "júl", "aug", "sep", "okt", "nov", "dec"];
const DAYS_SK = ["Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota", "Nedeľa"];
const DAYS_SHORT = ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()}. ${MONTHS_SK[d.getMonth()]} ${d.getFullYear()}`;
}

// 0=Monday ... 6=Sunday (ISO week)
function todayDow(): number {
  return (new Date().getDay() + 6) % 7;
}

interface Exercise {
  id: number;
  name: string;
}

interface MuscleGroup {
  id: number;
  name: string;
  exercises: Exercise[];
}

interface SessionExercise {
  exercise_id: number;
  sets?: number;
  reps?: number;
  weight?: number;
}

interface WorkoutSession {
  id: number;
  date: string;
  muscle_ids: number[];
  exercises: SessionExercise[];
  notes?: string;
}

interface WeeklySession {
  week_start: string;
  count: number;
}

interface MuscleFreq {
  muscle_id: number;
  count: number;
}

interface WorkoutStats {
  weekly_sessions: WeeklySession[];
  muscle_freq: MuscleFreq[];
}

type Schedule = Record<number, number[]>;

interface ExerciseInputValue {
  sets: string;
  reps: string;
  weight: string;
}

export default function WorkoutPage(): JSX.Element {
  const [muscles, setMuscles] = useState<MuscleGroup[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [schedule, setSchedule] = useState<Schedule>({});
  const [stats, setStats] = useState<WorkoutStats | null>(null);
  const [tab, setTab] = useState("log");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Log tab form state
  const [todayMuscles, setTodayMuscles] = useState<Set<number>>(new Set());
  const [todayExercises, setTodayExercises] = useState<Record<number, ExerciseInputValue>>({});
  const [todayNotes, setTodayNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string): void {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const [mRes, sRes, schRes, stRes] = await Promise.all([
        api.workout.muscles.list(),
        api.workout.sessions.list(),
        api.workout.schedule.get(),
        api.workout.stats.get(),
      ]);
      const [m, s, sch, st] = await Promise.all([
        mRes!.json(), sRes!.json(), schRes!.json(), stRes!.json(),
      ]);
      setMuscles(m);
      setSessions(s);
      setSchedule(sch);
      setStats(st);

      // Init today's form from saved session
      const today = todayStr();
      const todaySess: WorkoutSession | undefined = s.find((sess: WorkoutSession) => sess.date === today);
      if (todaySess) {
        setTodayMuscles(new Set(todaySess.muscle_ids));
        setTodayNotes(todaySess.notes || "");
        const exMap: Record<number, ExerciseInputValue> = {};
        for (const ex of todaySess.exercises) {
          exMap[ex.exercise_id] = {
            sets: ex.sets ?? "",
            reps: ex.reps ?? "",
            weight: ex.weight ?? "",
          };
        }
        setTodayExercises(exMap);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveToday(): Promise<void> {
    setSaving(true);
    setSaveState("saving");
    try {
      // Build exercises array from checked muscles only
      const checkedExercises: SessionExercise[] = [];
      for (const muscle of muscles) {
        if (!todayMuscles.has(muscle.id)) continue;
        for (const ex of muscle.exercises) {
          const val = todayExercises[ex.id];
          if (!val) continue;
          const entry: SessionExercise = { exercise_id: ex.id };
          const setsN = parseInt(val.sets);
          const repsN = parseInt(val.reps);
          const weightN = parseFloat(val.weight);
          if (val.sets !== "" && !isNaN(setsN)) entry.sets = setsN;
          if (val.reps !== "" && !isNaN(repsN)) entry.reps = repsN;
          if (val.weight !== "" && !isNaN(weightN)) entry.weight = weightN;
          // Only save if at least one field was filled
          if (entry.sets !== undefined || entry.reps !== undefined || entry.weight !== undefined) {
            checkedExercises.push(entry);
          }
        }
      }
      await api.workout.sessions.save(todayStr(), [...todayMuscles], checkedExercises, todayNotes);
      await load();
      setSaveState("ok");
      setTimeout(() => setSaveState("idle"), 2000);
      showToast("Tréning uložený");
    } catch {
      setSaveState("err");
      setTimeout(() => setSaveState("idle"), 3000);
    } finally {
      setSaving(false);
    }
  }

  function toggleMuscle(id: number): void {
    setTodayMuscles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setExField(exerciseId: number, field: keyof ExerciseInputValue, value: string): void {
    setTodayExercises((prev) => ({
      ...prev,
      [exerciseId]: { ...(prev[exerciseId] || {}), [field]: value },
    }));
  }

  const muscleMap: Record<number, string> = Object.fromEntries(muscles.map((m) => [m.id, m.name]));

  if (loading) {
    return <div style={S.centered}>Načítavam...</div>;
  }

  if (loadError) {
    return (
      <div style={S.centered}>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#ef4444", marginBottom: 12 }}>Chyba načítania</div>
          <button style={S.retryBtn} onClick={load}>Skúsiť znova</button>
        </div>
      </div>
    );
  }

  const TABS_DEF = [
    { key: "log", label: "Tréning" },
    { key: "plan", label: "Plán" },
    { key: "stats", label: "Štatistiky" },
    { key: "manage", label: "Cviky" },
  ];

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={S.tabs}>
          {TABS_DEF.map(({ key, label }) => (
            <button
              key={key}
              style={{ ...S.tab, ...(tab === key ? S.tabActive : {}) }}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "log" && (
          <LogTab
            muscles={muscles}
            sessions={sessions}
            schedule={schedule}
            todayMuscles={todayMuscles}
            todayExercises={todayExercises}
            todayNotes={todayNotes}
            setTodayNotes={setTodayNotes}
            toggleMuscle={toggleMuscle}
            setExField={setExField}
            saveToday={saveToday}
            saving={saving}
            saveState={saveState}
            muscleMap={muscleMap}
            onReload={load}
          />
        )}
        {tab === "plan" && (
          <PlanTab
            muscles={muscles}
            schedule={schedule}
            setSchedule={setSchedule}
            onReload={load}
          />
        )}
        {tab === "stats" && (
          <StatsTab stats={stats} muscles={muscles} />
        )}
        {tab === "manage" && (
          <ManageTab muscles={muscles} onReload={load} showToast={showToast} />
        )}
        {toast && <div style={S.toast}>{toast}</div>}
      </div>
    </div>
  );
}

// ── Log tab ────────────────────────────────────────────────────────────────

interface LogTabProps {
  muscles: MuscleGroup[];
  sessions: WorkoutSession[];
  schedule: Schedule;
  todayMuscles: Set<number>;
  todayExercises: Record<number, ExerciseInputValue>;
  todayNotes: string;
  setTodayNotes: (v: string) => void;
  toggleMuscle: (id: number) => void;
  setExField: (exerciseId: number, field: keyof ExerciseInputValue, value: string) => void;
  saveToday: () => void;
  saving: boolean;
  saveState: "idle" | "saving" | "ok" | "err";
  muscleMap: Record<number, string>;
  onReload: () => void;
}

function LogTab({ muscles, sessions, schedule, todayMuscles, todayExercises, todayNotes, setTodayNotes, toggleMuscle, setExField, saveToday, saving, saveState, muscleMap, onReload }: LogTabProps): JSX.Element {
  const today = todayStr();
  const dow = todayDow();
  const plannedToday = schedule[dow] || [];
  const muscleNamesPlanned = plannedToday.map((id) => muscleMap[id]).filter(Boolean);
  const [importBlueprint, setImportBlueprint] = useState<Blueprint | null>(null);

  function applyPlan(): void {
    plannedToday.forEach((id) => {
      if (!todayMuscles.has(id)) toggleMuscle(id);
    });
  }

  return (
    <>
      {importBlueprint && <ImportModal blueprint={importBlueprint} onClose={() => setImportBlueprint(null)} onSuccess={onReload} />}
      {/* Plan hint */}
      {muscleNamesPlanned.length > 0 && (
        <div style={S.planHint}>
          <span style={S.planHintText}>Podľa plánu dnes: <strong>{muscleNamesPlanned.join(", ")}</strong></span>
          <button style={S.planHintBtn} onClick={applyPlan}>Použiť</button>
        </div>
      )}

      <div style={S.sectionTitle}>Dnešný tréning</div>
      <div style={S.card}>
        {muscles.length === 0 ? (
          <div style={S.empty}>Najprv pridaj partie v záložke "Cviky"</div>
        ) : (
          muscles.map((m) => {
            const checked = todayMuscles.has(m.id);
            return (
              <div key={m.id}>
                <label style={S.muscleRow}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleMuscle(m.id)}
                    style={{ accentColor: "#ef4444", width: 20, height: 20, flexShrink: 0 }}
                  />
                  <span style={{ ...S.muscleName, color: checked ? "#ef4444" : "#888" }}>
                    {m.name}
                  </span>
                  {m.exercises.length > 0 && (
                    <span style={S.exCountLabel}>{m.exercises.length} cvikov</span>
                  )}
                </label>

                {/* Exercise inputs */}
                {checked && m.exercises.length > 0 && (
                  <div style={S.exInputBlock}>
                    {m.exercises.map((ex) => {
                      const val = todayExercises[ex.id] || {} as ExerciseInputValue;
                      return (
                        <div key={ex.id} style={S.exInputRow}>
                          <span style={S.exInputName}>{ex.name}</span>
                          <div style={S.exInputFields}>
                            <label style={S.exInputLabel}>
                              <span style={S.exInputFieldLabel}>sety</span>
                              <input
                                style={S.exInput}
                                type="number"
                                min="1"
                                placeholder="—"
                                value={val.sets ?? ""}
                                onChange={(e) => setExField(ex.id, "sets", e.target.value)}
                              />
                            </label>
                            <label style={S.exInputLabel}>
                              <span style={S.exInputFieldLabel}>rep</span>
                              <input
                                style={S.exInput}
                                type="number"
                                min="1"
                                placeholder="—"
                                value={val.reps ?? ""}
                                onChange={(e) => setExField(ex.id, "reps", e.target.value)}
                              />
                            </label>
                            <label style={S.exInputLabel}>
                              <span style={S.exInputFieldLabel}>kg</span>
                              <input
                                style={S.exInput}
                                type="number"
                                min="0"
                                step="0.5"
                                placeholder="—"
                                value={val.weight ?? ""}
                                onChange={(e) => setExField(ex.id, "weight", e.target.value)}
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <textarea
        style={S.notes}
        placeholder="Poznámky k tréningu..."
        value={todayNotes}
        onChange={(e) => setTodayNotes(e.target.value)}
        rows={2}
      />

      <button
        style={{
          ...S.saveBtn,
          opacity: saving ? 0.6 : 1,
          color: saveState === "err" ? "#ef4444" : "#22c55e",
          borderColor: saveState === "err" ? "#ef444430" : "#22c55e30",
        }}
        onClick={saveToday}
        disabled={saving}
      >
        {saveState === "saving" ? "Ukladám..." : saveState === "ok" ? "✓ Uložené" : saveState === "err" ? "✗ Chyba" : "Uložiť"}
      </button>

      {/* History */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}><div style={{ ...S.sectionTitle, marginBottom: 0 }}>História</div><button style={S.importBtn} onClick={() => setImportBlueprint(BLUEPRINTS.sessions)}>Import</button></div>
      {sessions.length === 0 ? (
        <div style={{ ...S.empty, padding: "12px 0" }}>Žiadne tréningy ešte</div>
      ) : (
        <div style={S.histList}>
          {sessions.map((sess) => (
            <div key={sess.id} style={{
              ...S.histRow,
              background: sess.date === today ? "#0e1a0e" : "#141414",
              borderColor: sess.date === today ? "#22c55e20" : "#1e1e1e",
            }}>
              <div style={S.histTop}>
                <span style={S.histDate}>{formatDate(sess.date)}</span>
                <div style={S.badges}>
                  {sess.muscle_ids.length === 0
                    ? <span style={S.badgeEmpty}>—</span>
                    : sess.muscle_ids.map((mid) => (
                        <span key={mid} style={S.badge}>{muscleMap[mid] || "?"}</span>
                      ))
                  }
                </div>
              </div>
              {sess.exercises && sess.exercises.length > 0 && (
                <div style={S.histExercises}>
                  {sess.exercises.map((ex) => {
                    const parts: string[] = [];
                    if (ex.sets) parts.push(`${ex.sets}×`);
                    if (ex.reps) parts.push(`${ex.reps}`);
                    if (ex.weight) parts.push(`${ex.weight}kg`);
                    return (
                      <span key={ex.exercise_id} style={S.histEx}>
                        {parts.join(" ")}
                      </span>
                    );
                  })}
                </div>
              )}
              {sess.notes && <div style={S.histNotes}>{sess.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Plan tab ───────────────────────────────────────────────────────────────

interface PlanTabProps {
  muscles: MuscleGroup[];
  schedule: Schedule;
  setSchedule: React.Dispatch<React.SetStateAction<Schedule>>;
  onReload: () => void;
}

function PlanTab({ muscles, schedule, setSchedule, onReload: _onReload }: PlanTabProps): JSX.Element {
  const [selectedDay, setSelectedDay] = useState(todayDow());
  const [saving, setSaving] = useState(false);

  async function toggleScheduleMuscle(muscleId: number): Promise<void> {
    const current = schedule[selectedDay] || [];
    const next = current.includes(muscleId)
      ? current.filter((id) => id !== muscleId)
      : [...current, muscleId];

    setSchedule((prev) => ({ ...prev, [selectedDay]: next }));
    setSaving(true);
    try {
      await api.workout.schedule.setDay(selectedDay, next);
    } catch {
      // revert optimistic update
      setSchedule((prev) => ({ ...prev, [selectedDay]: current }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div style={S.sectionTitle}>Týždenný rozvrh</div>

      {/* Day selector */}
      <div style={S.dayGrid}>
        {DAYS_SHORT.map((label, i) => {
          const hasMuscles = (schedule[i] || []).length > 0;
          const isSelected = selectedDay === i;
          const isToday = i === todayDow();
          return (
            <button
              key={i}
              style={{
                ...S.dayBtn,
                ...(isSelected ? S.dayBtnActive : {}),
                ...(isToday && !isSelected ? S.dayBtnToday : {}),
              }}
              onClick={() => setSelectedDay(i)}
            >
              <span style={S.dayBtnLabel}>{label}</span>
              {hasMuscles && <span style={S.dayDot} />}
            </button>
          );
        })}
      </div>

      {/* Muscles for selected day */}
      <div style={S.planDayHeader}>
        <span style={S.planDayName}>{DAYS_SK[selectedDay]}</span>
        {saving && <span style={S.savingLabel}>ukladám...</span>}
      </div>

      <div style={S.card}>
        {muscles.length === 0 ? (
          <div style={S.empty}>Najprv pridaj partie v záložke "Cviky"</div>
        ) : (
          muscles.map((m) => {
            const checked = (schedule[selectedDay] || []).includes(m.id);
            return (
              <label key={m.id} style={S.muscleRow}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleScheduleMuscle(m.id)}
                  style={{ accentColor: "#ef4444", width: 20, height: 20, flexShrink: 0 }}
                />
                <span style={{ ...S.muscleName, color: checked ? "#ef4444" : "#888" }}>
                  {m.name}
                </span>
              </label>
            );
          })
        )}
      </div>

      {/* Week overview */}
      <div style={S.sectionTitle}>Prehľad týždňa</div>
      <div style={S.weekOverview}>
        {DAYS_SK.map((day, i) => {
          const dayMuscleIds = schedule[i] || [];
          return (
            <div key={i} style={{ ...S.weekDay, ...(i === todayDow() ? S.weekDayToday : {}) }} onClick={() => setSelectedDay(i)}>
              <span style={S.weekDayLabel}>{DAYS_SHORT[i]}</span>
              {dayMuscleIds.length === 0
                ? <span style={S.weekDayEmpty}>voľno</span>
                : dayMuscleIds.map((id) => {
                    const name = muscles.find((m) => m.id === id)?.name;
                    return name ? <span key={id} style={S.weekMuscle}>{name}</span> : null;
                  })
              }
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Stats tab ──────────────────────────────────────────────────────────────

interface StatsTabProps {
  stats: WorkoutStats | null;
  muscles: MuscleGroup[];
}

function StatsTab({ stats, muscles }: StatsTabProps): JSX.Element {
  if (!stats) return <div style={S.empty}>Načítavam...</div>;

  const maxWeekly = Math.max(...(stats.weekly_sessions || []).map((w) => w.count), 1);
  const maxMuscle = Math.max(...(stats.muscle_freq || []).map((m) => m.count), 1);

  const allMusclesWithCount = muscles.map((m) => {
    const found = stats.muscle_freq.find((s) => s.muscle_id === m.id);
    return { id: m.id, name: m.name, count: found ? found.count : 0 };
  }).sort((a, b) => b.count - a.count);

  return (
    <>
      <div style={S.sectionTitle}>Tréningy za posledných 8 týždňov</div>
      {stats.weekly_sessions.length === 0 ? (
        <div style={{ ...S.empty, marginBottom: 24 }}>Žiadne dáta</div>
      ) : (
        <div style={S.statBars}>
          {stats.weekly_sessions.map((w) => {
            const d = new Date(w.week_start + "T12:00:00");
            const label = `${d.getDate()}. ${MONTHS_SK[d.getMonth()]}`;
            const pct = (w.count / maxWeekly) * 100;
            return (
              <div key={w.week_start} style={S.statBarRow}>
                <span style={S.statBarLabel}>{label}</span>
                <div style={S.statBarTrack}>
                  <div style={{ ...S.statBarFill, width: `${pct}%`, background: "#ef4444" }} />
                </div>
                <span style={S.statBarVal}>{w.count}</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={S.sectionTitle}>Partie za posledných 30 dní</div>
      {allMusclesWithCount.length === 0 ? (
        <div style={S.empty}>Žiadne dáta</div>
      ) : (
        <div style={S.statBars}>
          {allMusclesWithCount.map((m) => {
            const pct = (m.count / maxMuscle) * 100;
            return (
              <div key={m.id} style={S.statBarRow}>
                <span style={S.statBarLabel}>{m.name}</span>
                <div style={S.statBarTrack}>
                  <div style={{ ...S.statBarFill, width: `${pct}%`, background: m.count > 0 ? "#ef4444" : "#2a2a2a" }} />
                </div>
                <span style={{ ...S.statBarVal, color: m.count > 0 ? "#e0e0e0" : "#444" }}>{m.count}×</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── Manage tab ─────────────────────────────────────────────────────────────

interface ManageTabProps {
  muscles: MuscleGroup[];
  onReload: () => void;
  showToast: (msg: string) => void;
}

interface EditingItem {
  id: number;
  name: string;
}

function ManageTab({ muscles, onReload, showToast }: ManageTabProps): JSX.Element {
  const [expandedMuscle, setExpandedMuscle] = useState<number | null>(null);
  const [editingMuscle, setEditingMuscle] = useState<EditingItem | null>(null);
  const [newMuscle, setNewMuscle] = useState("");
  const [addingMuscle, setAddingMuscle] = useState(false);
  const [editingExercise, setEditingExercise] = useState<EditingItem | null>(null);
  const [addingExerciseTo, setAddingExerciseTo] = useState<number | null>(null);
  const [newExercise, setNewExercise] = useState("");
  const [importBlueprint, setImportBlueprint] = useState<Blueprint | null>(null);

  async function addMuscle(): Promise<void> {
    if (!newMuscle.trim()) return;
    try {
      await api.workout.muscles.add(newMuscle.trim());
      setNewMuscle("");
      setAddingMuscle(false);
      await onReload();
      showToast("Partia pridaná");
    } catch {
      // keep form open so user can retry
    }
  }

  async function saveMuscle(): Promise<void> {
    if (!editingMuscle?.name.trim()) return;
    try {
      await api.workout.muscles.update(editingMuscle.id, editingMuscle.name.trim());
      setEditingMuscle(null);
      await onReload();
      showToast("Partia uložená");
    } catch {
      // keep editing open so user can retry
    }
  }

  async function deleteMuscle(id: number): Promise<void> {
    try {
      await api.workout.muscles.delete(id);
      if (expandedMuscle === id) setExpandedMuscle(null);
      await onReload();
      showToast("Partia vymazaná");
    } catch {
      // reload anyway to sync state
      await onReload();
    }
  }

  async function addExercise(muscleGroupId: number): Promise<void> {
    if (!newExercise.trim()) return;
    try {
      await api.workout.exercises.add(muscleGroupId, newExercise.trim());
      setNewExercise("");
      setAddingExerciseTo(null);
      await onReload();
      showToast("Cvik pridaný");
    } catch {
      // keep form open so user can retry
    }
  }

  async function saveExercise(): Promise<void> {
    if (!editingExercise?.name.trim()) return;
    try {
      await api.workout.exercises.update(editingExercise.id, editingExercise.name.trim());
      setEditingExercise(null);
      await onReload();
      showToast("Cvik uložený");
    } catch {
      // keep editing open so user can retry
    }
  }

  async function deleteExercise(id: number): Promise<void> {
    try {
      await api.workout.exercises.delete(id);
      await onReload();
      showToast("Cvik vymazaný");
    } catch {
      await onReload();
    }
  }

  return (
    <>
      {importBlueprint && (
        <ImportModal
          blueprint={importBlueprint}
          onClose={() => setImportBlueprint(null)}
          onSuccess={onReload}
        />
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ ...S.sectionTitle, marginBottom: 0 }}>Partie a cviky</div>
        <div style={{ display: "flex", gap: 5 }}>
          <button style={S.importBtn} onClick={() => setImportBlueprint(BLUEPRINTS.muscles)}>
            Import partií
          </button>
          <button style={S.importBtn} onClick={() => setImportBlueprint(BLUEPRINTS.exercises)}>
            Import cvikov
          </button>
        </div>
      </div>
      {muscles.length === 0 && <div style={{ ...S.empty, marginBottom: 12 }}>Zatiaľ žiadne partie</div>}

      {muscles.map((muscle) => {
        const isExpanded = expandedMuscle === muscle.id;
        const isEditingThis = editingMuscle?.id === muscle.id;
        return (
          <div key={muscle.id} style={S.muscleBlock}>
            <div style={S.muscleHeader}>
              {isEditingThis ? (
                <input
                  style={{ ...S.inlineInput, flex: 1 }}
                  value={editingMuscle!.name}
                  autoFocus
                  onChange={(e) => setEditingMuscle({ ...editingMuscle!, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") saveMuscle(); if (e.key === "Escape") setEditingMuscle(null); }}
                />
              ) : (
                <button style={S.muscleToggle} onClick={() => setExpandedMuscle(isExpanded ? null : muscle.id)}>
                  <span style={S.muscleToggleIcon}>{isExpanded ? "▾" : "▸"}</span>
                  <span>{muscle.name}</span>
                  {muscle.exercises.length > 0 && (
                    <span style={S.exCountSmall}>{muscle.exercises.length}</span>
                  )}
                </button>
              )}
              <div style={S.rowActions}>
                {isEditingThis ? (
                  <>
                    <button style={S.actionBtnGreen} onClick={saveMuscle}>Uložiť</button>
                    <button style={S.actionBtn} onClick={() => setEditingMuscle(null)}>Zrušiť</button>
                  </>
                ) : (
                  <>
                    <button style={S.actionBtn} onClick={() => setEditingMuscle({ id: muscle.id, name: muscle.name })}>Upraviť</button>
                    <button style={S.actionBtnRed} onClick={() => deleteMuscle(muscle.id)}>Zmazať</button>
                  </>
                )}
              </div>
            </div>

            {isExpanded && (
              <div style={S.exerciseList}>
                {muscle.exercises.length === 0 && <div style={S.emptyExercise}>Žiadne cviky</div>}
                {muscle.exercises.map((ex) => {
                  const isEditingEx = editingExercise?.id === ex.id;
                  return (
                    <div key={ex.id} style={S.exerciseRow}>
                      {isEditingEx ? (
                        <input
                          style={{ ...S.inlineInput, flex: 1 }}
                          value={editingExercise!.name}
                          autoFocus
                          onChange={(e) => setEditingExercise({ ...editingExercise!, name: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") saveExercise(); if (e.key === "Escape") setEditingExercise(null); }}
                        />
                      ) : (
                        <span style={S.exerciseName}>· {ex.name}</span>
                      )}
                      <div style={S.rowActions}>
                        {isEditingEx ? (
                          <>
                            <button style={S.actionBtnGreen} onClick={saveExercise}>Uložiť</button>
                            <button style={S.actionBtn} onClick={() => setEditingExercise(null)}>Zrušiť</button>
                          </>
                        ) : (
                          <>
                            <button style={S.actionBtn} onClick={() => setEditingExercise({ id: ex.id, name: ex.name })}>Upraviť</button>
                            <button style={S.actionBtnRed} onClick={() => deleteExercise(ex.id)}>Zmazať</button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {addingExerciseTo === muscle.id ? (
                  <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
                    <input
                      style={{ ...S.inlineInput, flex: 1 }}
                      placeholder="Názov cviku..."
                      value={newExercise}
                      autoFocus
                      onChange={(e) => setNewExercise(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addExercise(muscle.id);
                        if (e.key === "Escape") { setAddingExerciseTo(null); setNewExercise(""); }
                      }}
                    />
                    <button style={S.actionBtnGreen} onClick={() => addExercise(muscle.id)}>Pridať</button>
                    <button style={S.actionBtn} onClick={() => { setAddingExerciseTo(null); setNewExercise(""); }}>Zrušiť</button>
                  </div>
                ) : (
                  <button style={S.addExBtn} onClick={() => { setAddingExerciseTo(muscle.id); setNewExercise(""); setEditingExercise(null); }}>
                    + Pridať cvik
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {addingMuscle ? (
        <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
          <input
            style={{ ...S.inlineInput, flex: 1 }}
            placeholder="Názov partie..."
            value={newMuscle}
            autoFocus
            onChange={(e) => setNewMuscle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addMuscle();
              if (e.key === "Escape") { setAddingMuscle(false); setNewMuscle(""); }
            }}
          />
          <button style={S.actionBtnGreen} onClick={addMuscle}>Pridať</button>
          <button style={S.actionBtn} onClick={() => { setAddingMuscle(false); setNewMuscle(""); }}>Zrušiť</button>
        </div>
      ) : (
        <button style={S.addMuscleBtn} onClick={() => { setAddingMuscle(true); setNewMuscle(""); }}>
          + Pridať partiu
        </button>
      )}
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  page: {
    background: "#0f0f0f",
    fontFamily: "'Inter', system-ui, sans-serif",
    color: "#e8e8e8",
    minHeight: "100vh",
  },
  container: {
    maxWidth: 480,
    width: "100%",
    margin: "0 auto",
    padding: "28px 16px 56px",
    boxSizing: "border-box",
  },
  centered: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "60vh",
    color: "#444",
  },

  // Tabs
  tabs: { display: "flex", gap: 4, marginBottom: 28, flexWrap: "wrap" },
  tab: {
    background: "none",
    border: "1px solid #1e1e1e",
    borderRadius: 6,
    color: "#444",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.04em",
    padding: "7px 16px",
    cursor: "pointer",
    fontFamily: MONO,
    transition: "all 0.2s",
  },
  tabActive: { background: "#0e0e1a", border: "1px solid #ef444430", color: "#ef4444" },

  sectionTitle: {
    fontSize: 11,
    color: "#3a3a3a",
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    marginBottom: 12,
    fontFamily: MONO,
  },

  // Card + muscle rows
  card: {
    background: "#141414",
    borderRadius: 10,
    border: "1px solid #1e1e1e",
    marginBottom: 14,
    overflow: "hidden",
  },
  muscleRow: {
    display: "flex",
    alignItems: "center",
    gap: 13,
    padding: "14px 18px",
    cursor: "pointer",
    borderBottom: "1px solid #181818",
  },
  muscleName: { fontSize: 15, fontWeight: 500, flex: 1, transition: "color 0.2s" },
  exCountLabel: { fontSize: 11, color: "#3a3a3a", fontFamily: MONO },

  // Exercise inputs
  exInputBlock: {
    padding: "4px 18px 12px 51px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    borderBottom: "1px solid #181818",
  },
  exInputRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  exInputName: { fontSize: 13, color: "#666", flex: 1, minWidth: 80 },
  exInputFields: { display: "flex", gap: 8, alignItems: "center" },
  exInputLabel: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3 },
  exInputFieldLabel: { fontSize: 9, color: "#3a3a3a", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: MONO },
  exInput: {
    background: "#0c0c0c",
    border: "1px solid #1e1e1e",
    borderRadius: 5,
    color: "#e8e8e8",
    fontSize: 14,
    padding: "5px 6px",
    width: 52,
    textAlign: "center",
    outline: "none",
    fontFamily: MONO,
  },

  // Notes
  notes: {
    background: "#0c0c0c",
    border: "1px solid #222",
    borderRadius: 8,
    padding: "10px 14px",
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
    border: "1px solid",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: "0.08em",
    padding: "15px 0",
    cursor: "pointer",
    marginBottom: 40,
    transition: "border-color 0.2s, opacity 0.15s",
  },

  // Plan hint
  planHint: {
    background: "#0e0e1a",
    border: "1px solid #ef444420",
    borderRadius: 8,
    padding: "10px 16px",
    marginBottom: 16,
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  planHintText: { fontSize: 13, color: "#888", flex: 1 },
  planHintBtn: {
    background: "none",
    border: "1px solid #ef444430",
    borderRadius: 5,
    color: "#ef4444",
    fontSize: 11,
    letterSpacing: "0.04em",
    padding: "4px 12px",
    cursor: "pointer",
    flexShrink: 0,
  },

  // History
  histList: { display: "flex", flexDirection: "column", gap: 5 },
  histRow: {
    borderRadius: 8,
    border: "1px solid",
    padding: "10px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  histTop: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  histDate: { fontSize: 12, color: "#666", fontFamily: MONO, flexShrink: 0, minWidth: 110, letterSpacing: "0.02em" },
  badges: { display: "flex", flexWrap: "wrap", gap: 5, flex: 1 },
  badge: {
    background: "#160e0e",
    border: "1px solid #ef444425",
    borderRadius: 4,
    padding: "2px 8px",
    fontSize: 11,
    color: "#ef4444",
    fontWeight: 500,
    letterSpacing: "0.02em",
  },
  badgeEmpty: { fontSize: 12, color: "#333" },
  histExercises: { display: "flex", flexWrap: "wrap", gap: 5 },
  histEx: { fontSize: 11, color: "#555", fontFamily: MONO, background: "#111", borderRadius: 3, padding: "1px 6px" },
  histNotes: { fontSize: 12, color: "#555", fontStyle: "italic" },

  // Plan tab
  dayGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 16 },
  dayBtn: {
    background: "#141414",
    border: "1px solid #1e1e1e",
    borderRadius: 7,
    color: "#444",
    fontSize: 11,
    padding: "8px 4px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    fontFamily: MONO,
    transition: "all 0.2s",
  },
  dayBtnActive: { background: "#0e0e1a", border: "1px solid #ef444440", color: "#ef4444" },
  dayBtnToday: { border: "1px solid #383838", color: "#888" },
  dayBtnLabel: { fontSize: 11, fontWeight: 600, letterSpacing: "0.02em" },
  dayDot: { width: 4, height: 4, borderRadius: "50%", background: "#ef4444", opacity: 0.7 },
  planDayHeader: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 },
  planDayName: { fontSize: 14, fontWeight: 600, color: "#d0d0d0", letterSpacing: "0.02em" },
  savingLabel: { fontSize: 11, color: "#3a3a3a" },
  weekOverview: { display: "flex", flexDirection: "column", gap: 3 },
  weekDay: {
    background: "#141414",
    border: "1px solid #1e1e1e",
    borderRadius: 7,
    padding: "8px 14px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    cursor: "pointer",
    flexWrap: "wrap",
    transition: "border-color 0.15s",
  },
  weekDayToday: { border: "1px solid #383838" },
  weekDayLabel: { fontSize: 11, color: "#444", fontFamily: MONO, minWidth: 20, letterSpacing: "0.04em" },
  weekDayEmpty: { fontSize: 11, color: "#282828" },
  weekMuscle: {
    fontSize: 11,
    color: "#ef4444",
    background: "#160e0e",
    border: "1px solid #ef444420",
    borderRadius: 4,
    padding: "1px 7px",
  },

  // Stats
  statBars: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 },
  statBarRow: { display: "flex", alignItems: "center", gap: 10 },
  statBarLabel: { fontSize: 12, color: "#666", minWidth: 70, textAlign: "right", flexShrink: 0 },
  statBarTrack: { flex: 1, height: 6, background: "#181818", borderRadius: 3, overflow: "hidden" },
  statBarFill: { height: "100%", borderRadius: 3, transition: "width 0.4s" },
  statBarVal: { fontSize: 12, fontFamily: MONO, color: "#e0e0e0", minWidth: 28, textAlign: "right" },

  // Manage tab
  muscleBlock: { background: "#141414", borderRadius: 10, border: "1px solid #1e1e1e", marginBottom: 6, overflow: "hidden" },
  muscleHeader: { display: "flex", alignItems: "center", padding: "11px 14px", gap: 8 },
  muscleToggle: {
    background: "none", border: "none", color: "#d0d0d0",
    fontSize: 14, fontWeight: 600, cursor: "pointer", padding: 0,
    display: "flex", alignItems: "center", gap: 8, flex: 1, textAlign: "left",
  },
  muscleToggleIcon: { color: "#3a3a3a", fontSize: 12, width: 12 },
  exCountSmall: { fontSize: 11, color: "#3a3a3a", fontFamily: MONO },
  exerciseList: {
    borderTop: "1px solid #181818",
    padding: "8px 14px 14px 28px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  exerciseRow: { display: "flex", alignItems: "center", gap: 8, padding: "4px 0" },
  exerciseName: { fontSize: 13, color: "#888", flex: 1 },
  emptyExercise: { fontSize: 12, color: "#333", padding: "4px 0" },
  addExBtn: {
    background: "none", border: "none", color: "#3a3a3a",
    fontSize: 12, cursor: "pointer", padding: "4px 0", marginTop: 4, textAlign: "left",
    letterSpacing: "0.02em",
  },
  addMuscleBtn: {
    background: "none", border: "1px dashed #1e1e1e", borderRadius: 8,
    color: "#3a3a3a", fontSize: 13, cursor: "pointer",
    padding: "13px 16px", width: "100%", textAlign: "left", marginTop: 4,
    letterSpacing: "0.02em",
  },
  inlineInput: {
    background: "#0c0c0c", border: "1px solid #222", borderRadius: 6,
    padding: "6px 10px", color: "#e8e8e8", fontSize: 14, outline: "none",
    minWidth: 0, fontFamily: "'Inter', system-ui, sans-serif",
  },
  rowActions: { display: "flex", gap: 5, flexShrink: 0 },
  actionBtn: {
    background: "none", border: "1px solid #1e1e1e", borderRadius: 5,
    color: "#484848", fontSize: 11, padding: "4px 10px", cursor: "pointer",
  },
  actionBtnGreen: {
    background: "none", border: "1px solid #22c55e30", borderRadius: 5,
    color: "#22c55e", fontSize: 11, padding: "4px 10px", cursor: "pointer",
  },
  actionBtnRed: {
    background: "none", border: "1px solid #ef444430", borderRadius: 5,
    color: "#ef4444", fontSize: 11, padding: "4px 10px", cursor: "pointer",
  },
  empty: { padding: "16px", fontSize: 13, color: "#444", textAlign: "center" },
  retryBtn: {
    background: "none",
    border: "1px solid #333",
    borderRadius: 7,
    color: "#888",
    fontSize: 13,
    padding: "8px 20px",
    cursor: "pointer",
  },
  toast: {
    position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
    fontSize: 12, color: "#22c55e", background: "#0a1a0a",
    border: "1px solid #22c55e22", borderRadius: 7,
    padding: "9px 18px", fontFamily: MONO, letterSpacing: "0.04em",
    zIndex: 9999, whiteSpace: "nowrap", pointerEvents: "none",
  },
  importBtn: {
    background: "none",
    border: "1px solid #1e1e1e",
    borderRadius: 5,
    color: "#3a3a3a",
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.06em",
    padding: "4px 10px",
    cursor: "pointer",
    fontFamily: MONO,
    textTransform: "uppercase",
    transition: "border-color 0.2s, color 0.2s",
  },
};
