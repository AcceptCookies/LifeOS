import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';

const MONO = 'Courier New';
const MONTHS_SK = ['jan','feb','mar','apr','máj','jún','júl','aug','sep','okt','nov','dec'];
const DAYS_SK = ['Pondelok','Utorok','Streda','Štvrtok','Piatok','Sobota','Nedeľa'];
const DAYS_SHORT = ['Po','Ut','St','Št','Pi','So','Ne'];

function todayStr() { return new Date().toISOString().slice(0, 10); }
function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()}. ${MONTHS_SK[d.getMonth()]} ${d.getFullYear()}`;
}
function todayDow() { return (new Date().getDay() + 6) % 7; }

interface Exercise { id: number; name: string; }
interface MuscleGroup { id: number; name: string; exercises: Exercise[]; }
interface SessionExercise { exercise_id: number; sets?: number; reps?: number; weight?: number; }
interface WorkoutSession { id: number; date: string; muscle_ids: number[]; exercises: SessionExercise[]; notes?: string; }
interface WeeklySession { week_start: string; count: number; }
interface MuscleFreq { muscle_id: number; count: number; }
interface WorkoutStats { weekly_sessions: WeeklySession[]; muscle_freq: MuscleFreq[]; }
type Schedule = Record<number, number[]>;
interface ExInputVal { sets: string; reps: string; weight: string; }

// ── Toast helper ──────────────────────────────────────────────────────────────

function Toast({ msg }: { msg: string }) {
  return (
    <View style={T.toast} pointerEvents="none">
      <Text style={T.toastText}>{msg}</Text>
    </View>
  );
}
const T = StyleSheet.create({
  toast: {
    position: 'absolute', bottom: 28, left: 0, right: 0,
    alignItems: 'center', zIndex: 9999,
  },
  toastText: {
    fontSize: 12, color: '#22c55e', backgroundColor: '#0a1a0a',
    borderWidth: 1, borderColor: '#22c55e22', borderRadius: 7,
    paddingHorizontal: 18, paddingVertical: 9, fontFamily: MONO,
    letterSpacing: 1,
  },
});

// ── Import placeholder ────────────────────────────────────────────────────────

function ImportNotice({ onClose }: { onClose: () => void }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={IM.overlay} activeOpacity={1} onPress={onClose}>
        <View style={IM.box}>
          <Text style={IM.title}>Import</Text>
          <Text style={IM.msg}>Import CSV je dostupný v webovej verzii na rovnakej adrese backendu.</Text>
          <TouchableOpacity style={IM.btn} onPress={onClose}>
            <Text style={IM.btnText}>Zavrieť</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
const IM = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  box: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, padding: 24, width: '100%', maxWidth: 340 },
  title: { fontSize: 14, fontWeight: '600', color: '#e0e0e0', fontFamily: MONO, marginBottom: 12 },
  msg: { fontSize: 13, color: '#666', lineHeight: 20, marginBottom: 20 },
  btn: { borderWidth: 1, borderColor: '#22c55e44', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#22c55e', fontSize: 14, fontWeight: '600' },
});

// ── Log Tab ───────────────────────────────────────────────────────────────────

interface LogTabProps {
  muscles: MuscleGroup[];
  sessions: WorkoutSession[];
  schedule: Schedule;
  todayMuscles: Set<number>;
  todayExercises: Record<number, ExInputVal>;
  todayNotes: string;
  setTodayNotes: (v: string) => void;
  toggleMuscle: (id: number) => void;
  setExField: (exId: number, field: keyof ExInputVal, value: string) => void;
  saveToday: () => void;
  saving: boolean;
  saveState: 'idle'|'saving'|'ok'|'err';
  muscleMap: Record<number, string>;
  onReload: () => void;
}

function LogTab(p: LogTabProps) {
  const today = todayStr();
  const dow = todayDow();
  const plannedToday = p.schedule[dow] || [];
  const muscleNamesPlanned = plannedToday.map(id => p.muscleMap[id]).filter(Boolean);
  const [showImport, setShowImport] = useState(false);

  function applyPlan() {
    plannedToday.forEach(id => { if (!p.todayMuscles.has(id)) p.toggleMuscle(id); });
  }

  return (
    <>
      {showImport && <ImportNotice onClose={() => setShowImport(false)} />}

      {muscleNamesPlanned.length > 0 && (
        <View style={S.planHint}>
          <Text style={S.planHintText}>
            Podľa plánu dnes: <Text style={{ fontWeight: '700' }}>{muscleNamesPlanned.join(', ')}</Text>
          </Text>
          <TouchableOpacity style={S.planHintBtn} onPress={applyPlan}>
            <Text style={S.planHintBtnText}>Použiť</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={S.sectionTitle}>Dnešný tréning</Text>
      <View style={S.card}>
        {p.muscles.length === 0 ? (
          <Text style={S.empty}>Najprv pridaj partie v záložke "Cviky"</Text>
        ) : (
          p.muscles.map(m => {
            const checked = p.todayMuscles.has(m.id);
            return (
              <View key={m.id}>
                <TouchableOpacity style={S.muscleRow} onPress={() => p.toggleMuscle(m.id)}>
                  <View style={[S.checkbox, { borderColor: checked ? '#ef4444' : '#333' }, checked && { backgroundColor: '#ef444420' }]}>
                    {checked && <Text style={[S.checkmark, { color: '#ef4444' }]}>✓</Text>}
                  </View>
                  <Text style={[S.muscleName, { color: checked ? '#ef4444' : '#888' }]}>{m.name}</Text>
                  {m.exercises.length > 0 && (
                    <Text style={S.exCountLabel}>{m.exercises.length} cvikov</Text>
                  )}
                </TouchableOpacity>
                {checked && m.exercises.length > 0 && (
                  <View style={S.exInputBlock}>
                    {m.exercises.map(ex => {
                      const val = p.todayExercises[ex.id] || { sets: '', reps: '', weight: '' };
                      return (
                        <View key={ex.id} style={S.exInputRow}>
                          <Text style={S.exInputName}>{ex.name}</Text>
                          <View style={S.exInputFields}>
                            {(['sets','reps','weight'] as (keyof ExInputVal)[]).map(field => (
                              <View key={field} style={S.exInputGroup}>
                                <Text style={S.exInputFieldLabel}>
                                  {field === 'sets' ? 'sety' : field === 'reps' ? 'rep' : 'kg'}
                                </Text>
                                <TextInput
                                  style={S.exInput}
                                  keyboardType="numeric"
                                  placeholder="—"
                                  placeholderTextColor="#444"
                                  value={val[field]}
                                  onChangeText={v => p.setExField(ex.id, field, v)}
                                />
                              </View>
                            ))}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>

      <TextInput
        style={S.notes}
        placeholder="Poznámky k tréningu..."
        placeholderTextColor="#333"
        value={p.todayNotes}
        onChangeText={p.setTodayNotes}
        multiline
        numberOfLines={2}
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[S.saveBtn, { opacity: p.saving ? 0.6 : 1 },
          p.saveState === 'err' ? { borderColor: '#ef444430' } : { borderColor: '#22c55e30' }]}
        onPress={p.saveToday}
        disabled={p.saving}
      >
        <Text style={[S.saveBtnText, { color: p.saveState === 'err' ? '#ef4444' : '#22c55e' }]}>
          {p.saveState === 'saving' ? 'Ukladám...' : p.saveState === 'ok' ? '✓ Uložené' : p.saveState === 'err' ? '✗ Chyba' : 'Uložiť'}
        </Text>
      </TouchableOpacity>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={[S.sectionTitle, { marginBottom: 0 }]}>História</Text>
        <TouchableOpacity style={S.importBtn} onPress={() => setShowImport(true)}>
          <Text style={S.importBtnText}>Import</Text>
        </TouchableOpacity>
      </View>

      {p.sessions.length === 0 ? (
        <Text style={[S.empty, { padding: 12 }]}>Žiadne tréningy ešte</Text>
      ) : (
        p.sessions.map(sess => (
          <View key={sess.id} style={[S.histRow, {
            backgroundColor: sess.date === today ? '#0e1a0e' : '#141414',
            borderColor: sess.date === today ? '#22c55e20' : '#1e1e1e',
          }]}>
            <View style={S.histTop}>
              <Text style={S.histDate}>{formatDate(sess.date)}</Text>
              <View style={S.badges}>
                {sess.muscle_ids.length === 0
                  ? <Text style={S.badgeEmpty}>—</Text>
                  : sess.muscle_ids.map(mid => (
                      <View key={mid} style={S.badge}>
                        <Text style={S.badgeText}>{p.muscleMap[mid] || '?'}</Text>
                      </View>
                    ))}
              </View>
            </View>
            {sess.exercises?.length > 0 && (
              <View style={S.histExercises}>
                {sess.exercises.map(ex => {
                  const parts: string[] = [];
                  if (ex.sets) parts.push(`${ex.sets}×`);
                  if (ex.reps) parts.push(`${ex.reps}`);
                  if (ex.weight) parts.push(`${ex.weight}kg`);
                  return (
                    <View key={ex.exercise_id} style={S.histEx}>
                      <Text style={S.histExText}>{parts.join(' ')}</Text>
                    </View>
                  );
                })}
              </View>
            )}
            {!!sess.notes && <Text style={S.histNotes}>{sess.notes}</Text>}
          </View>
        ))
      )}
    </>
  );
}

// ── Plan Tab ──────────────────────────────────────────────────────────────────

function PlanTab({ muscles, schedule, setSchedule }: {
  muscles: MuscleGroup[];
  schedule: Schedule;
  setSchedule: React.Dispatch<React.SetStateAction<Schedule>>;
}) {
  const [selectedDay, setSelectedDay] = useState(todayDow());
  const [saving, setSaving] = useState(false);

  async function toggleScheduleMuscle(muscleId: number) {
    const current = schedule[selectedDay] || [];
    const next = current.includes(muscleId)
      ? current.filter(id => id !== muscleId)
      : [...current, muscleId];
    setSchedule(prev => ({ ...prev, [selectedDay]: next }));
    setSaving(true);
    try {
      await api.workout.schedule.setDay(selectedDay, next);
    } catch {
      setSchedule(prev => ({ ...prev, [selectedDay]: current }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Text style={S.sectionTitle}>Týždenný rozvrh</Text>

      <View style={S.dayGrid}>
        {DAYS_SHORT.map((label, i) => {
          const hasMuscles = (schedule[i] || []).length > 0;
          const isSelected = selectedDay === i;
          const isToday = i === todayDow();
          return (
            <TouchableOpacity
              key={i}
              style={[S.dayBtn, isSelected && S.dayBtnActive, isToday && !isSelected && S.dayBtnToday]}
              onPress={() => setSelectedDay(i)}
            >
              <Text style={[S.dayBtnLabel, isSelected ? { color: '#ef4444' } : isToday ? { color: '#888' } : { color: '#444' }]}>
                {label}
              </Text>
              {hasMuscles && <View style={S.dayDot} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Text style={S.planDayName}>{DAYS_SK[selectedDay]}</Text>
        {saving && <Text style={{ fontSize: 11, color: '#3a3a3a' }}>ukladám...</Text>}
      </View>

      <View style={S.card}>
        {muscles.length === 0 ? (
          <Text style={S.empty}>Najprv pridaj partie v záložke "Cviky"</Text>
        ) : (
          muscles.map(m => {
            const checked = (schedule[selectedDay] || []).includes(m.id);
            return (
              <TouchableOpacity key={m.id} style={S.muscleRow} onPress={() => toggleScheduleMuscle(m.id)}>
                <View style={[S.checkbox, { borderColor: checked ? '#ef4444' : '#333' }, checked && { backgroundColor: '#ef444420' }]}>
                  {checked && <Text style={[S.checkmark, { color: '#ef4444' }]}>✓</Text>}
                </View>
                <Text style={[S.muscleName, { color: checked ? '#ef4444' : '#888' }]}>{m.name}</Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <Text style={S.sectionTitle}>Prehľad týždňa</Text>
      {DAYS_SK.map((day, i) => {
        const dayMuscleIds = schedule[i] || [];
        return (
          <TouchableOpacity
            key={i}
            style={[S.weekDay, i === todayDow() && S.weekDayToday]}
            onPress={() => setSelectedDay(i)}
          >
            <Text style={S.weekDayLabel}>{DAYS_SHORT[i]}</Text>
            {dayMuscleIds.length === 0
              ? <Text style={S.weekDayEmpty}>voľno</Text>
              : dayMuscleIds.map(id => {
                  const name = muscles.find(m => m.id === id)?.name;
                  return name ? (
                    <View key={id} style={S.weekMuscle}>
                      <Text style={S.weekMuscleText}>{name}</Text>
                    </View>
                  ) : null;
                })}
          </TouchableOpacity>
        );
      })}
    </>
  );
}

// ── Stats Tab ─────────────────────────────────────────────────────────────────

function StatsTab({ stats, muscles }: { stats: WorkoutStats | null; muscles: MuscleGroup[] }) {
  if (!stats) return <Text style={S.empty}>Načítavam...</Text>;

  const maxWeekly = Math.max(...(stats.weekly_sessions || []).map(w => w.count), 1);
  const maxMuscle = Math.max(...(stats.muscle_freq || []).map(m => m.count), 1);

  const allMusclesWithCount = muscles.map(m => {
    const found = stats.muscle_freq.find(s => s.muscle_id === m.id);
    return { id: m.id, name: m.name, count: found ? found.count : 0 };
  }).sort((a, b) => b.count - a.count);

  return (
    <>
      <Text style={S.sectionTitle}>Tréningy za posledných 8 týždňov</Text>
      {stats.weekly_sessions.length === 0 ? (
        <Text style={[S.empty, { marginBottom: 24 }]}>Žiadne dáta</Text>
      ) : (
        <View style={S.statBars}>
          {stats.weekly_sessions.map(w => {
            const d = new Date(w.week_start + 'T12:00:00');
            const label = `${d.getDate()}. ${MONTHS_SK[d.getMonth()]}`;
            const pct = (w.count / maxWeekly) * 100;
            return (
              <View key={w.week_start} style={S.statBarRow}>
                <Text style={S.statBarLabel}>{label}</Text>
                <View style={S.statBarTrack}>
                  <View style={[S.statBarFill, { width: `${pct}%` as any, backgroundColor: '#ef4444' }]} />
                </View>
                <Text style={S.statBarVal}>{w.count}</Text>
              </View>
            );
          })}
        </View>
      )}

      <Text style={S.sectionTitle}>Partie za posledných 30 dní</Text>
      <View style={S.statBars}>
        {allMusclesWithCount.map(m => {
          const pct = (m.count / maxMuscle) * 100;
          return (
            <View key={m.id} style={S.statBarRow}>
              <Text style={S.statBarLabel}>{m.name}</Text>
              <View style={S.statBarTrack}>
                <View style={[S.statBarFill, { width: `${pct}%` as any, backgroundColor: m.count > 0 ? '#ef4444' : '#2a2a2a' }]} />
              </View>
              <Text style={[S.statBarVal, { color: m.count > 0 ? '#e0e0e0' : '#444' }]}>{m.count}×</Text>
            </View>
          );
        })}
      </View>
    </>
  );
}

// ── Manage Tab ────────────────────────────────────────────────────────────────

function ManageTab({ muscles, onReload, showToast }: {
  muscles: MuscleGroup[];
  onReload: () => void;
  showToast: (msg: string) => void;
}) {
  const [expandedMuscle, setExpandedMuscle] = useState<number | null>(null);
  const [editingMuscle, setEditingMuscle] = useState<{ id: number; name: string } | null>(null);
  const [newMuscle, setNewMuscle] = useState('');
  const [addingMuscle, setAddingMuscle] = useState(false);
  const [editingExercise, setEditingExercise] = useState<{ id: number; name: string } | null>(null);
  const [addingExerciseTo, setAddingExerciseTo] = useState<number | null>(null);
  const [newExercise, setNewExercise] = useState('');
  const [showImport, setShowImport] = useState(false);

  async function addMuscle() {
    if (!newMuscle.trim()) return;
    try {
      await api.workout.muscles.add(newMuscle.trim());
      setNewMuscle(''); setAddingMuscle(false); await onReload(); showToast('Partia pridaná');
    } catch {}
  }

  async function saveMuscle() {
    if (!editingMuscle?.name.trim()) return;
    try {
      await api.workout.muscles.update(editingMuscle.id, editingMuscle.name.trim());
      setEditingMuscle(null); await onReload(); showToast('Partia uložená');
    } catch {}
  }

  async function deleteMuscle(id: number) {
    try {
      await api.workout.muscles.delete(id);
      if (expandedMuscle === id) setExpandedMuscle(null);
      await onReload(); showToast('Partia vymazaná');
    } catch { await onReload(); }
  }

  async function addExercise(muscleGroupId: number) {
    if (!newExercise.trim()) return;
    try {
      await api.workout.exercises.add(muscleGroupId, newExercise.trim());
      setNewExercise(''); setAddingExerciseTo(null); await onReload(); showToast('Cvik pridaný');
    } catch {}
  }

  async function saveExercise() {
    if (!editingExercise?.name.trim()) return;
    try {
      await api.workout.exercises.update(editingExercise.id, editingExercise.name.trim());
      setEditingExercise(null); await onReload(); showToast('Cvik uložený');
    } catch {}
  }

  async function deleteExercise(id: number) {
    try {
      await api.workout.exercises.delete(id); await onReload(); showToast('Cvik vymazaný');
    } catch { await onReload(); }
  }

  return (
    <>
      {showImport && <ImportNotice onClose={() => setShowImport(false)} />}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={[S.sectionTitle, { marginBottom: 0 }]}>Partie a cviky</Text>
        <TouchableOpacity style={S.importBtn} onPress={() => setShowImport(true)}>
          <Text style={S.importBtnText}>Import</Text>
        </TouchableOpacity>
      </View>

      {muscles.length === 0 && <Text style={[S.empty, { marginBottom: 12 }]}>Zatiaľ žiadne partie</Text>}

      {muscles.map(muscle => {
        const isExpanded = expandedMuscle === muscle.id;
        const isEditing = editingMuscle?.id === muscle.id;
        return (
          <View key={muscle.id} style={S.muscleBlock}>
            <View style={S.muscleHeader}>
              {isEditing ? (
                <TextInput
                  style={[S.inlineInput, { flex: 1 }]}
                  value={editingMuscle!.name}
                  autoFocus
                  onChangeText={name => setEditingMuscle({ ...editingMuscle!, name })}
                  onSubmitEditing={saveMuscle}
                  returnKeyType="done"
                />
              ) : (
                <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  onPress={() => setExpandedMuscle(isExpanded ? null : muscle.id)}>
                  <Text style={{ color: '#3a3a3a', fontSize: 12 }}>{isExpanded ? '▾' : '▸'}</Text>
                  <Text style={S.muscleName}>{muscle.name}</Text>
                  {muscle.exercises.length > 0 && (
                    <Text style={{ fontSize: 11, color: '#3a3a3a', fontFamily: MONO }}>{muscle.exercises.length}</Text>
                  )}
                </TouchableOpacity>
              )}
              <View style={S.rowActions}>
                {isEditing ? (
                  <>
                    <TouchableOpacity style={S.actionBtnGreen} onPress={saveMuscle}>
                      <Text style={{ color: '#22c55e', fontSize: 11 }}>Uložiť</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={S.actionBtn} onPress={() => setEditingMuscle(null)}>
                      <Text style={{ color: '#484848', fontSize: 11 }}>Zrušiť</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity style={S.actionBtn} onPress={() => setEditingMuscle({ id: muscle.id, name: muscle.name })}>
                      <Text style={{ color: '#484848', fontSize: 11 }}>Upraviť</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={S.actionBtnRed} onPress={() => deleteMuscle(muscle.id)}>
                      <Text style={{ color: '#ef4444', fontSize: 11 }}>Zmazať</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>

            {isExpanded && (
              <View style={S.exerciseList}>
                {muscle.exercises.length === 0 && <Text style={{ fontSize: 12, color: '#333', padding: 4 }}>Žiadne cviky</Text>}
                {muscle.exercises.map(ex => {
                  const isEditingEx = editingExercise?.id === ex.id;
                  return (
                    <View key={ex.id} style={S.exerciseRow}>
                      {isEditingEx ? (
                        <TextInput
                          style={[S.inlineInput, { flex: 1 }]}
                          value={editingExercise!.name}
                          autoFocus
                          onChangeText={name => setEditingExercise({ ...editingExercise!, name })}
                          onSubmitEditing={saveExercise}
                          returnKeyType="done"
                        />
                      ) : (
                        <Text style={[S.exerciseName, { flex: 1 }]}>· {ex.name}</Text>
                      )}
                      <View style={S.rowActions}>
                        {isEditingEx ? (
                          <>
                            <TouchableOpacity style={S.actionBtnGreen} onPress={saveExercise}>
                              <Text style={{ color: '#22c55e', fontSize: 11 }}>Uložiť</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={S.actionBtn} onPress={() => setEditingExercise(null)}>
                              <Text style={{ color: '#484848', fontSize: 11 }}>Zrušiť</Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <>
                            <TouchableOpacity style={S.actionBtn} onPress={() => setEditingExercise({ id: ex.id, name: ex.name })}>
                              <Text style={{ color: '#484848', fontSize: 11 }}>Upraviť</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={S.actionBtnRed} onPress={() => deleteExercise(ex.id)}>
                              <Text style={{ color: '#ef4444', fontSize: 11 }}>Zmazať</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                  );
                })}

                {addingExerciseTo === muscle.id ? (
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'center' }}>
                    <TextInput
                      style={[S.inlineInput, { flex: 1 }]}
                      placeholder="Názov cviku..."
                      placeholderTextColor="#333"
                      value={newExercise}
                      autoFocus
                      onChangeText={setNewExercise}
                      onSubmitEditing={() => addExercise(muscle.id)}
                      returnKeyType="done"
                    />
                    <TouchableOpacity style={S.actionBtnGreen} onPress={() => addExercise(muscle.id)}>
                      <Text style={{ color: '#22c55e', fontSize: 11 }}>Pridať</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={S.actionBtn} onPress={() => { setAddingExerciseTo(null); setNewExercise(''); }}>
                      <Text style={{ color: '#484848', fontSize: 11 }}>Zrušiť</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => { setAddingExerciseTo(muscle.id); setNewExercise(''); setEditingExercise(null); }}>
                    <Text style={{ color: '#3a3a3a', fontSize: 12, paddingVertical: 6 }}>+ Pridať cvik</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        );
      })}

      {addingMuscle ? (
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'center' }}>
          <TextInput
            style={[S.inlineInput, { flex: 1 }]}
            placeholder="Názov partie..."
            placeholderTextColor="#333"
            value={newMuscle}
            autoFocus
            onChangeText={setNewMuscle}
            onSubmitEditing={addMuscle}
            returnKeyType="done"
          />
          <TouchableOpacity style={S.actionBtnGreen} onPress={addMuscle}>
            <Text style={{ color: '#22c55e', fontSize: 11 }}>Pridať</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.actionBtn} onPress={() => { setAddingMuscle(false); setNewMuscle(''); }}>
            <Text style={{ color: '#484848', fontSize: 11 }}>Zrušiť</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={S.addMuscleBtn} onPress={() => { setAddingMuscle(true); setNewMuscle(''); }}>
          <Text style={{ color: '#3a3a3a', fontSize: 13 }}>+ Pridať partiu</Text>
        </TouchableOpacity>
      )}
    </>
  );
}

// ── WorkoutScreen ─────────────────────────────────────────────────────────────

const TABS_DEF = [
  { key: 'log', label: 'Tréning' },
  { key: 'plan', label: 'Plán' },
  { key: 'stats', label: 'Štatistiky' },
  { key: 'manage', label: 'Cviky' },
];

export default function WorkoutScreen() {
  const [muscles, setMuscles] = useState<MuscleGroup[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [schedule, setSchedule] = useState<Schedule>({});
  const [stats, setStats] = useState<WorkoutStats | null>(null);
  const [tab, setTab] = useState('log');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [todayMuscles, setTodayMuscles] = useState<Set<number>>(new Set());
  const [todayExercises, setTodayExercises] = useState<Record<number, ExInputVal>>({});
  const [todayNotes, setTodayNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<'idle'|'saving'|'ok'|'err'>('idle');
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const [mRes, sRes, schRes, stRes] = await Promise.all([
        api.workout.muscles.list(), api.workout.sessions.list(),
        api.workout.schedule.get(), api.workout.stats.get(),
      ]);
      const [m, s, sch, st] = await Promise.all([
        mRes!.json(), sRes!.json(), schRes!.json(), stRes!.json(),
      ]);
      setMuscles(m); setSessions(s); setSchedule(sch); setStats(st);

      const today = todayStr();
      const todaySess: WorkoutSession | undefined = s.find((sess: WorkoutSession) => sess.date === today);
      if (todaySess) {
        setTodayMuscles(new Set(todaySess.muscle_ids));
        setTodayNotes(todaySess.notes || '');
        const exMap: Record<number, ExInputVal> = {};
        for (const ex of todaySess.exercises) {
          exMap[ex.exercise_id] = { sets: String(ex.sets ?? ''), reps: String(ex.reps ?? ''), weight: String(ex.weight ?? '') };
        }
        setTodayExercises(exMap);
      }
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveToday() {
    setSaving(true); setSaveState('saving');
    try {
      const checkedExercises: SessionExercise[] = [];
      for (const muscle of muscles) {
        if (!todayMuscles.has(muscle.id)) continue;
        for (const ex of muscle.exercises) {
          const val = todayExercises[ex.id];
          if (!val) continue;
          const entry: SessionExercise = { exercise_id: ex.id };
          const setsN = parseInt(val.sets); const repsN = parseInt(val.reps); const weightN = parseFloat(val.weight);
          if (val.sets && !isNaN(setsN)) entry.sets = setsN;
          if (val.reps && !isNaN(repsN)) entry.reps = repsN;
          if (val.weight && !isNaN(weightN)) entry.weight = weightN;
          if (entry.sets !== undefined || entry.reps !== undefined || entry.weight !== undefined) {
            checkedExercises.push(entry);
          }
        }
      }
      await api.workout.sessions.save(todayStr(), [...todayMuscles], checkedExercises, todayNotes);
      await load(); setSaveState('ok'); setTimeout(() => setSaveState('idle'), 2000); showToast('Tréning uložený');
    } catch { setSaveState('err'); setTimeout(() => setSaveState('idle'), 3000); }
    finally { setSaving(false); }
  }

  function toggleMuscle(id: number) {
    setTodayMuscles(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function setExField(exId: number, field: keyof ExInputVal, value: string) {
    setTodayExercises(prev => ({ ...prev, [exId]: { ...(prev[exId] || {}), [field]: value } }));
  }

  const muscleMap: Record<number, string> = Object.fromEntries(muscles.map(m => [m.id, m.name]));

  if (loading) {
    return (
      <SafeAreaView style={S.page} edges={['top']}>
        <ActivityIndicator color="#ef4444" size="large" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={S.page} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#ef4444', marginBottom: 12 }}>Chyba načítania</Text>
          <TouchableOpacity style={S.retryBtn} onPress={load}>
            <Text style={{ color: '#888', fontSize: 13 }}>Skúsiť znova</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.page} edges={['top']}>
      <ScrollView contentContainerStyle={S.container} showsVerticalScrollIndicator={false}>
        {/* Sub-tabs */}
        <View style={S.tabs}>
          {TABS_DEF.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[S.tab, tab === key && S.tabActive]}
              onPress={() => setTab(key)}
            >
              <Text style={[S.tabText, tab === key && S.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'log' && (
          <LogTab
            muscles={muscles} sessions={sessions} schedule={schedule}
            todayMuscles={todayMuscles} todayExercises={todayExercises}
            todayNotes={todayNotes} setTodayNotes={setTodayNotes}
            toggleMuscle={toggleMuscle} setExField={setExField}
            saveToday={saveToday} saving={saving} saveState={saveState}
            muscleMap={muscleMap} onReload={load}
          />
        )}
        {tab === 'plan' && (
          <PlanTab muscles={muscles} schedule={schedule} setSchedule={setSchedule} />
        )}
        {tab === 'stats' && <StatsTab stats={stats} muscles={muscles} />}
        {tab === 'manage' && (
          <ManageTab muscles={muscles} onReload={load} showToast={showToast} />
        )}
      </ScrollView>
      {toast && <Toast msg={toast} />}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0f0f0f' },
  container: { padding: 16, paddingBottom: 32 },

  tabs: { flexDirection: 'row', gap: 4, marginBottom: 28, flexWrap: 'wrap' },
  tab: {
    borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 6,
    paddingHorizontal: 16, paddingVertical: 7,
  },
  tabActive: { backgroundColor: '#0e0e1a', borderColor: '#ef444430' },
  tabText: { color: '#444', fontSize: 12, fontWeight: '600', letterSpacing: 1, fontFamily: MONO },
  tabTextActive: { color: '#ef4444' },

  sectionTitle: {
    fontSize: 11, color: '#3a3a3a', textTransform: 'uppercase',
    letterSpacing: 3, marginBottom: 12, fontFamily: MONO,
  },

  card: {
    backgroundColor: '#141414', borderRadius: 10, borderWidth: 1,
    borderColor: '#1e1e1e', marginBottom: 14, overflow: 'hidden',
  },
  muscleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#181818',
  },
  checkbox: {
    width: 22, height: 22, borderWidth: 1.5, borderRadius: 5,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkmark: { fontSize: 13, fontWeight: '700' },
  muscleName: { fontSize: 15, fontWeight: '500', flex: 1 },
  exCountLabel: { fontSize: 11, color: '#3a3a3a', fontFamily: MONO },

  exInputBlock: { paddingLeft: 51, paddingRight: 18, paddingBottom: 12, paddingTop: 4, gap: 10 },
  exInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  exInputName: { fontSize: 13, color: '#666', flex: 1, minWidth: 80 },
  exInputFields: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  exInputGroup: { alignItems: 'center', gap: 3 },
  exInputFieldLabel: {
    fontSize: 9, color: '#3a3a3a', textTransform: 'uppercase',
    letterSpacing: 1, fontFamily: MONO,
  },
  exInput: {
    backgroundColor: '#0c0c0c', borderWidth: 1, borderColor: '#1e1e1e',
    borderRadius: 5, color: '#e8e8e8', fontSize: 14,
    paddingHorizontal: 6, paddingVertical: 5, width: 52,
    textAlign: 'center', fontFamily: MONO,
  },

  notes: {
    backgroundColor: '#0c0c0c', borderWidth: 1, borderColor: '#222',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    color: '#e8e8e8', fontSize: 14, marginBottom: 14, minHeight: 60,
  },

  saveBtn: {
    borderWidth: 1, borderRadius: 8, paddingVertical: 15,
    alignItems: 'center', marginBottom: 40,
  },
  saveBtnText: { fontSize: 14, fontWeight: '600', letterSpacing: 2 },

  // Plan tab
  planHint: {
    backgroundColor: '#0e0e1a', borderWidth: 1, borderColor: '#ef444420',
    borderRadius: 8, padding: 16, marginBottom: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap',
  },
  planHintText: { fontSize: 13, color: '#888', flex: 1 },
  planHintBtn: { borderWidth: 1, borderColor: '#ef444430', borderRadius: 5, paddingHorizontal: 12, paddingVertical: 4 },
  planHintBtnText: { color: '#ef4444', fontSize: 11 },

  dayGrid: { flexDirection: 'row', gap: 4, marginBottom: 16 },
  dayBtn: {
    flex: 1, backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e',
    borderRadius: 7, paddingVertical: 8, paddingHorizontal: 2,
    alignItems: 'center', gap: 4,
  },
  dayBtnActive: { backgroundColor: '#0e0e1a', borderColor: '#ef444440' },
  dayBtnToday: { borderColor: '#383838' },
  dayBtnLabel: { fontSize: 11, fontWeight: '600', fontFamily: MONO },
  dayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#ef4444', opacity: 0.7 },
  planDayName: { fontSize: 14, fontWeight: '600', color: '#d0d0d0', marginBottom: 12 },
  weekDay: {
    backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e',
    borderRadius: 7, paddingHorizontal: 14, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap',
  },
  weekDayToday: { borderColor: '#383838' },
  weekDayLabel: { fontSize: 11, color: '#444', fontFamily: MONO, minWidth: 20 },
  weekDayEmpty: { fontSize: 11, color: '#282828' },
  weekMuscle: { borderWidth: 1, borderColor: '#ef444420', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 1, backgroundColor: '#160e0e' },
  weekMuscleText: { fontSize: 11, color: '#ef4444' },

  // History
  histRow: { borderRadius: 8, borderWidth: 1, padding: 10, gap: 6, marginBottom: 5 },
  histTop: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  histDate: { fontSize: 12, color: '#666', fontFamily: MONO, minWidth: 110 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, flex: 1 },
  badge: { backgroundColor: '#160e0e', borderWidth: 1, borderColor: '#ef444425', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, color: '#ef4444', fontWeight: '500' },
  badgeEmpty: { fontSize: 12, color: '#333' },
  histExercises: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  histEx: { backgroundColor: '#111', borderRadius: 3, paddingHorizontal: 6, paddingVertical: 1 },
  histExText: { fontSize: 11, color: '#555', fontFamily: MONO },
  histNotes: { fontSize: 12, color: '#555', fontStyle: 'italic' },

  // Stats
  statBars: { gap: 10, marginBottom: 32 },
  statBarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statBarLabel: { fontSize: 12, color: '#666', minWidth: 70, textAlign: 'right', flexShrink: 0 },
  statBarTrack: { flex: 1, height: 6, backgroundColor: '#181818', borderRadius: 3, overflow: 'hidden' },
  statBarFill: { height: '100%' as any, borderRadius: 3 },
  statBarVal: { fontSize: 12, fontFamily: MONO, color: '#e0e0e0', minWidth: 28, textAlign: 'right' },

  // Manage tab
  muscleBlock: {
    backgroundColor: '#141414', borderRadius: 10, borderWidth: 1,
    borderColor: '#1e1e1e', marginBottom: 6, overflow: 'hidden',
  },
  muscleHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8 },
  exerciseList: { borderTopWidth: 1, borderTopColor: '#181818', paddingHorizontal: 14, paddingLeft: 28, paddingBottom: 14, paddingTop: 8, gap: 4 },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  exerciseName: { fontSize: 13, color: '#888' },
  rowActions: { flexDirection: 'row', gap: 5, flexShrink: 0 },
  actionBtn: { borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 5, paddingHorizontal: 10, paddingVertical: 4 },
  actionBtnGreen: { borderWidth: 1, borderColor: '#22c55e30', borderRadius: 5, paddingHorizontal: 10, paddingVertical: 4 },
  actionBtnRed: { borderWidth: 1, borderColor: '#ef444430', borderRadius: 5, paddingHorizontal: 10, paddingVertical: 4 },
  addMuscleBtn: {
    borderWidth: 1, borderColor: '#1e1e1e', borderStyle: 'dashed', borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 13, marginTop: 4,
  },
  inlineInput: {
    backgroundColor: '#0c0c0c', borderWidth: 1, borderColor: '#222',
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6,
    color: '#e8e8e8', fontSize: 14,
  },

  importBtn: { borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 5, paddingHorizontal: 10, paddingVertical: 4 },
  importBtnText: { color: '#3a3a3a', fontSize: 10, fontWeight: '600', fontFamily: MONO, textTransform: 'uppercase' },
  retryBtn: { borderWidth: 1, borderColor: '#333', borderRadius: 7, paddingHorizontal: 20, paddingVertical: 8 },
  empty: { padding: 16, fontSize: 13, color: '#444', textAlign: 'center' },
});
