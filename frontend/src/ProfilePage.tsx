import { useState, useEffect } from "react";
import { api } from "./api";

const MONO = "'SF Mono', 'Fira Code', 'Consolas', monospace";

const HABITS = [
  { key: "strength_training", label: "Silový tréning", color: "#ef4444" },
  { key: "cardio",            label: "Kardio",          color: "#f97316" },
  { key: "walking",           label: "Chôdza",          color: "#22c55e" },
  { key: "running",           label: "Beh",             color: "#eab308" },
  { key: "stretching",        label: "Strečing",        color: "#06b6d4" },
  { key: "meditation",        label: "Meditácia",       color: "#a78bfa" },
  { key: "learning",          label: "Učenie",          color: "#3b82f6" },
  { key: "cheat_food",        label: "Cheat jedlo",     color: "#6b7280" },
];

const DOW = ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"];
const MONTHS_SK = ["jan", "feb", "mar", "apr", "máj", "jún", "júl", "aug", "sep", "okt", "nov", "dec"];

interface PublicUser {
  id: number;
  email: string;
  name: string;
}

interface Session {
  id: number;
  date: string;
  notes: string;
  muscle_ids: number[];
}

interface MuscleGroup {
  id: number;
  name: string;
}

interface MuscleStat {
  muscle_id: number;
  name: string;
  count: number;
}

interface WeekStat {
  week_start: string;
  count: number;
}

interface HabitLog {
  date: string;
  strength_training: boolean;
  cardio: boolean;
  walking: boolean;
  running: boolean;
  stretching: boolean;
  meditation: boolean;
  learning: boolean;
  cheat_food: boolean;
}

interface UserProfile {
  id: number;
  email: string;
  name: string;
  workout: {
    sessions: Session[];
    stats: { weekly_sessions: WeekStat[]; muscle_freq: MuscleStat[] };
    muscles: MuscleGroup[];
  };
  habits: {
    history: HabitLog[];
    streaks: Record<string, number>;
  };
}

function initials(user: PublicUser): string {
  if (user.name) return user.name.slice(0, 2).toUpperCase();
  return user.email.slice(0, 2).toUpperCase();
}

function displayName(user: PublicUser): string {
  return user.name || user.email.split("@")[0];
}

function HabitCalendar({ history }: { history: HabitLog[] }) {
  const histMap: Record<string, HabitLog> = {};
  for (const h of history) histMap[h.date] = h;

  const now = new Date();
  const last30: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    last30.push(d.toISOString().slice(0, 10));
  }
  const firstDate = new Date(last30[0] + "T12:00:00");
  const firstDow = (firstDate.getDay() + 6) % 7;
  const calCells: (string | null)[] = [...Array(firstDow).fill(null), ...last30];
  const today = now.toISOString().slice(0, 10);

  return (
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
          <div key={date} style={{
            ...S.calCell,
            border: isToday ? "1px solid #484848" : "1px solid #1a1a1a",
            background: isToday ? "#111320" : "#141414",
          }}>
            <div style={{ ...S.calDay, color: isToday ? "#e8e8e8" : "#444" }}>
              {isFirst ? `${MONTHS_SK[parseInt(date.slice(5, 7)) - 1]} ${dayNum}` : dayNum}
            </div>
            <div style={S.dotGrid}>
              {HABITS.map(({ key, color }) => (
                <div key={key} style={{
                  ...S.dot,
                  background: entry?.[key as keyof HabitLog] ? color : "#2a2a2a",
                }} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function UserProfileView({ userId }: { userId: number }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.users.getProfile(userId)
      .then(r => r!.json())
      .then(setProfile)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div style={S.loadingText}>Načítavam...</div>;
  if (!profile) return <div style={S.loadingText}>Chyba načítania</div>;

  const muscleMap: Record<number, string> = {};
  for (const m of profile.workout.muscles) muscleMap[m.id] = m.name;

  return (
    <div>
      {/* Habits streaks */}
      <div style={S.sectionTitle}>Série návykov</div>
      <div style={S.streakGrid}>
        {HABITS.map(({ key, label, color }) => {
          const n = profile.habits.streaks[key] || 0;
          return (
            <div key={key} style={S.streakBox}>
              <div style={{ ...S.streakNum, color: n > 0 ? color : "#444" }}>{n}</div>
              <div style={S.streakLabel}>{label.split(" ")[0]}</div>
            </div>
          );
        })}
      </div>

      {/* Habits calendar */}
      <div style={S.sectionTitle}>Posledných 30 dní</div>
      <HabitCalendar history={profile.habits.history} />

      {/* Muscle frequency */}
      {profile.workout.stats.muscle_freq.length > 0 && (
        <>
          <div style={{ ...S.sectionTitle, marginTop: 28 }}>Svaly – posledných 30 dní</div>
          <div style={S.muscleFreqList}>
            {profile.workout.stats.muscle_freq.map((m) => (
              <div key={m.muscle_id} style={S.muscleFreqRow}>
                <span style={S.muscleFreqName}>{m.name}</span>
                <span style={S.muscleFreqCount}>{m.count}×</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Recent sessions */}
      {profile.workout.sessions.length > 0 && (
        <>
          <div style={{ ...S.sectionTitle, marginTop: 28 }}>Posledné tréningy</div>
          <div style={S.sessionList}>
            {profile.workout.sessions.map((sess) => {
              const names = sess.muscle_ids.map(id => muscleMap[id]).filter(Boolean);
              return (
                <div key={sess.id} style={S.sessionRow}>
                  <span style={S.sessionDate}>{sess.date}</span>
                  <div style={S.sessionMuscles}>
                    {names.length > 0
                      ? names.map((n, i) => <span key={i} style={S.muscleChip}>{n}</span>)
                      : <span style={{ color: "#444", fontSize: 12 }}>—</span>}
                  </div>
                  {sess.notes && <div style={S.sessionNotes}>{sess.notes}</div>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function ProfilePage(): JSX.Element {
  const [myProfile, setMyProfile] = useState<PublicUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);

  useEffect(() => {
    api.profile.get().then(r => r!.json()).then((p: PublicUser) => {
      setMyProfile(p);
      setEditName(p.name);
    });
    api.users.list().then(r => r!.json()).then(setUsers);
  }, []);

  async function saveName() {
    setSaving(true);
    const res = await api.profile.update(editName);
    const updated = await res!.json();
    setMyProfile(updated);
    setSaving(false);
    setEditing(false);
  }

  const otherUsers = users.filter(u => u.id !== myProfile?.id);
  const selectedUserData = selectedUser !== null ? users.find(u => u.id === selectedUser) : null;

  return (
    <div style={S.page}>
      <div style={S.container}>

        {/* Own profile */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <div style={S.avatar}>{myProfile ? initials(myProfile) : "—"}</div>
            <div style={S.cardInfo}>
              <div style={S.cardName}>{myProfile ? displayName(myProfile) : "..."}</div>
              <div style={S.cardEmail}>{myProfile?.email}</div>
            </div>
          </div>

          {!editing ? (
            <button style={S.editBtn} onClick={() => setEditing(true)}>
              Zmeniť meno
            </button>
          ) : (
            <div style={S.editRow}>
              <input
                style={S.nameInput}
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="Tvoje meno..."
                onKeyDown={e => e.key === "Enter" && saveName()}
                autoFocus
              />
              <button style={S.saveBtn} onClick={saveName} disabled={saving}>
                {saving ? "..." : "Uložiť"}
              </button>
              <button style={S.cancelBtn} onClick={() => { setEditing(false); setEditName(myProfile?.name || ""); }}>
                Zrušiť
              </button>
            </div>
          )}
        </div>

        {/* My own profile data */}
        {myProfile && (
          <div style={S.myProfileSection}>
            <div style={S.sectionTitle}>Môj profil</div>
            <UserProfileView userId={myProfile.id} />
          </div>
        )}

        {/* Other users */}
        {otherUsers.length > 0 && (
          <>
            <div style={{ ...S.sectionTitle, marginTop: 36 }}>Ostatní</div>
            <div style={S.userList}>
              {otherUsers.map(u => (
                <button
                  key={u.id}
                  style={{
                    ...S.userCard,
                    ...(selectedUser === u.id ? S.userCardActive : {}),
                  }}
                  onClick={() => setSelectedUser(selectedUser === u.id ? null : u.id)}
                >
                  <div style={S.userAvatar}>{initials(u)}</div>
                  <div>
                    <div style={S.userName}>{displayName(u)}</div>
                    <div style={S.userEmail}>{u.email}</div>
                  </div>
                </button>
              ))}
            </div>

            {selectedUser !== null && selectedUserData && (
              <div style={S.otherProfileSection}>
                <div style={S.otherProfileHeader}>
                  {displayName(selectedUserData)}
                </div>
                <UserProfileView userId={selectedUser} />
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}

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
    padding: "28px 16px 64px",
    boxSizing: "border-box",
  },
  card: {
    background: "#141414",
    border: "1px solid #1e1e1e",
    borderRadius: 12,
    padding: "18px 18px 14px",
    marginBottom: 24,
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "#1a2a1a",
    border: "1px solid #22c55e30",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    fontWeight: 700,
    color: "#22c55e",
    fontFamily: MONO,
    flexShrink: 0,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardName: {
    fontSize: 16,
    fontWeight: 600,
    color: "#e8e8e8",
    marginBottom: 2,
  },
  cardEmail: {
    fontSize: 12,
    color: "#555",
    fontFamily: MONO,
  },
  editBtn: {
    background: "none",
    border: "1px solid #1e1e1e",
    borderRadius: 6,
    color: "#444",
    fontSize: 12,
    padding: "6px 14px",
    cursor: "pointer",
  },
  editRow: {
    display: "flex",
    gap: 6,
    alignItems: "center",
  },
  nameInput: {
    flex: 1,
    background: "#0c0c0c",
    border: "1px solid #222",
    borderRadius: 6,
    color: "#e8e8e8",
    fontSize: 13,
    padding: "7px 10px",
    outline: "none",
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  saveBtn: {
    background: "none",
    border: "1px solid #22c55e40",
    borderRadius: 6,
    color: "#22c55e",
    fontSize: 12,
    padding: "7px 14px",
    cursor: "pointer",
  },
  cancelBtn: {
    background: "none",
    border: "1px solid #1e1e1e",
    borderRadius: 6,
    color: "#444",
    fontSize: 12,
    padding: "7px 10px",
    cursor: "pointer",
  },
  myProfileSection: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 10,
    color: "#3a3a3a",
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    fontFamily: MONO,
    marginBottom: 12,
  },
  streakGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 6,
    marginBottom: 20,
  },
  streakBox: {
    background: "#141414",
    border: "1px solid #1e1e1e",
    borderRadius: 8,
    padding: "12px 6px",
    textAlign: "center",
  },
  streakNum: {
    fontSize: 20,
    fontWeight: 700,
    fontFamily: MONO,
    lineHeight: 1,
  },
  streakLabel: {
    fontSize: 9,
    color: "#444",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginTop: 5,
  },
  calGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 3,
    marginBottom: 8,
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
  muscleFreqList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    marginBottom: 8,
  },
  muscleFreqRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 12px",
    background: "#141414",
    border: "1px solid #1a1a1a",
    borderRadius: 7,
  },
  muscleFreqName: {
    fontSize: 13,
    color: "#c8c8c8",
  },
  muscleFreqCount: {
    fontSize: 12,
    color: "#ef4444",
    fontFamily: MONO,
  },
  sessionList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 8,
  },
  sessionRow: {
    padding: "10px 12px",
    background: "#141414",
    border: "1px solid #1a1a1a",
    borderRadius: 8,
  },
  sessionDate: {
    fontSize: 11,
    color: "#555",
    fontFamily: MONO,
    display: "block",
    marginBottom: 6,
  },
  sessionMuscles: {
    display: "flex",
    flexWrap: "wrap",
    gap: 5,
  },
  muscleChip: {
    fontSize: 11,
    border: "1px solid #ef444450",
    borderRadius: 4,
    padding: "2px 8px",
    color: "#ef4444",
    fontFamily: MONO,
  },
  sessionNotes: {
    fontSize: 12,
    color: "#555",
    marginTop: 6,
    lineHeight: 1.4,
  },
  userList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 16,
  },
  userCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 16px",
    background: "#141414",
    border: "1px solid #1e1e1e",
    borderRadius: 10,
    cursor: "pointer",
    width: "100%",
    textAlign: "left",
    transition: "border-color 0.2s",
  },
  userCardActive: {
    border: "1px solid #22c55e30",
    background: "#0d1a0d",
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "#1a1a2e",
    border: "1px solid #3b82f630",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 700,
    color: "#3b82f6",
    fontFamily: MONO,
    flexShrink: 0,
  },
  userName: {
    fontSize: 14,
    fontWeight: 600,
    color: "#e8e8e8",
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 11,
    color: "#444",
    fontFamily: MONO,
  },
  otherProfileSection: {
    marginTop: 8,
    paddingTop: 20,
    borderTop: "1px solid #1a1a1a",
  },
  otherProfileHeader: {
    fontSize: 14,
    fontWeight: 600,
    color: "#e8e8e8",
    marginBottom: 16,
    fontFamily: MONO,
  },
  loadingText: {
    fontSize: 13,
    color: "#444",
    textAlign: "center",
    padding: "24px 0",
  },
};
