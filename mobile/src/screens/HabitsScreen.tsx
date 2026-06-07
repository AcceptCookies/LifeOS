import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, Modal, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';

const MONO = 'Courier New';

const HABITS: { key: string; label: string; color: string; negative?: boolean }[] = [
  { key: 'strength_training', label: 'Silový tréning', color: '#ef4444' },
  { key: 'cardio',            label: 'Kardio',          color: '#f97316' },
  { key: 'walking',           label: 'Chôdza',          color: '#22c55e' },
  { key: 'running',           label: 'Beh',             color: '#eab308' },
  { key: 'stretching',        label: 'Strečing',        color: '#06b6d4' },
  { key: 'meditation',        label: 'Meditácia',       color: '#a78bfa' },
  { key: 'learning',          label: 'Učenie',          color: '#3b82f6' },
  { key: 'cheat_food',        label: 'Cheat jedlo',     color: '#6b7280', negative: true },
];

type HabitForm = {
  strength_training: boolean; cardio: boolean; walking: boolean; running: boolean;
  stretching: boolean; meditation: boolean; learning: boolean; cheat_food: boolean; notes: string;
};

const EMPTY_FORM: HabitForm = {
  strength_training: false, cardio: false, walking: false, running: false,
  stretching: false, meditation: false, learning: false, cheat_food: false, notes: '',
};

const DOW = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'];
const MONTHS_SK = ['jan','feb','mar','apr','máj','jún','júl','aug','sep','okt','nov','dec'];
const DAYS_SK = ['Nedeľa','Pondelok','Utorok','Streda','Štvrtok','Piatok','Sobota'];

function todayStr() { return new Date().toISOString().slice(0, 10); }

function formatDateSK(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return `${DAYS_SK[d.getDay()]}, ${d.getDate()}. ${MONTHS_SK[d.getMonth()]} ${d.getFullYear()}`;
}

function apiFormFromResponse(data: any): HabitForm {
  const f = { ...EMPTY_FORM };
  for (const h of HABITS) (f as any)[h.key] = !!data[h.key];
  f.notes = data.notes || '';
  return f;
}

// ── DayModal ──────────────────────────────────────────────────────────────────

interface DayData {
  habits?: Record<string, any>;
  muscles?: string[];
  workout_notes?: string;
  cooked_recipes?: string[];
}

function DayModal({ date, onClose }: { date: string; onClose: () => void }) {
  const [data, setData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.day.get(date)
      .then(r => r?.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [date]);

  const habits = data?.habits;
  const doneHabits = habits ? HABITS.filter(h => habits[h.key]) : [];
  const hasWorkout = (data?.muscles?.length ?? 0) > 0;
  const hasRecipes = (data?.cooked_recipes?.length ?? 0) > 0;
  const isEmpty = !loading && doneHabits.length === 0 && !hasWorkout && !hasRecipes && !habits?.notes;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={DM.overlay} activeOpacity={1} onPress={onClose}>
        <View style={DM.modal}>
          <View style={DM.header}>
            <Text style={DM.dateTitle}>{formatDateSK(date)}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={DM.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView>
            {loading && <Text style={DM.empty}>Načítavam...</Text>}
            {!loading && isEmpty && <Text style={DM.empty}>Žiadne záznamy pre tento deň.</Text>}

            {!loading && doneHabits.length > 0 && (
              <View style={DM.section}>
                <Text style={DM.sectionTitle}>Návyky</Text>
                <View style={DM.chipRow}>
                  {doneHabits.map(({ key, label, color }) => (
                    <View key={key} style={[DM.chip, { borderColor: color }]}>
                      <Text style={[DM.chipText, { color }]}>{label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {!loading && hasWorkout && (
              <View style={DM.section}>
                <Text style={DM.sectionTitle}>Tréning</Text>
                <View style={DM.chipRow}>
                  {data!.muscles!.map((m, i) => (
                    <View key={i} style={[DM.chip, { borderColor: '#ef4444' }]}>
                      <Text style={[DM.chipText, { color: '#ef4444' }]}>{m}</Text>
                    </View>
                  ))}
                </View>
                {!!data!.workout_notes && <Text style={DM.notes}>{data!.workout_notes}</Text>}
              </View>
            )}

            {!loading && hasRecipes && (
              <View style={DM.section}>
                <Text style={DM.sectionTitle}>Jedlo</Text>
                <View style={DM.chipRow}>
                  {data!.cooked_recipes!.map((r, i) => (
                    <View key={i} style={[DM.chip, { borderColor: '#f97316' }]}>
                      <Text style={[DM.chipText, { color: '#f97316' }]}>{r}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {!loading && habits?.notes && (
              <View style={DM.section}>
                <Text style={DM.sectionTitle}>Poznámky</Text>
                <Text style={DM.notes}>{habits.notes}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const DM = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  modal: {
    backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e',
    borderRadius: 12, width: '100%', maxWidth: 380, maxHeight: '80%',
    padding: 20,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20,
  },
  dateTitle: { fontSize: 14, fontWeight: '600', color: '#e8e8e8', fontFamily: MONO },
  closeBtn: { color: '#444', fontSize: 18, padding: 4 },
  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 10, color: '#3a3a3a', textTransform: 'uppercase',
    letterSpacing: 2, fontFamily: MONO, marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 9, paddingVertical: 3 },
  chipText: { fontSize: 12, fontFamily: MONO },
  notes: { fontSize: 13, color: '#666', lineHeight: 20, marginTop: 6 },
  empty: { fontSize: 13, color: '#444', textAlign: 'center', paddingVertical: 20 },
});

// ── Main HabitsScreen ─────────────────────────────────────────────────────────

export default function HabitsScreen() {
  const [form, setForm] = useState<HabitForm>(EMPTY_FORM);
  const [history, setHistory] = useState<any[]>([]);
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<'idle'|'saving'|'ok'|'err'>('idle');
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [todayRes, histRes, streakRes] = await Promise.all([
        api.get('/api/today'), api.get('/api/history'), api.get('/api/streaks'),
      ]);
      const [todayData, histData, streakData] = await Promise.all([
        todayRes!.json(), histRes!.json(), streakRes!.json(),
      ]);
      setForm(apiFormFromResponse(todayData));
      setHistory(Array.isArray(histData) ? histData : []);
      setStreaks(streakData || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function save() {
    setSaving(true);
    setSaveState('saving');
    try {
      const body: Record<string, any> = { ...EMPTY_FORM };
      for (const h of HABITS) body[h.key] = !!(form as any)[h.key];
      body.notes = form.notes || '';
      await api.post('/api/today', body);
      const [histRes, streakRes] = await Promise.all([api.get('/api/history'), api.get('/api/streaks')]);
      const [histData, streakData] = await Promise.all([histRes!.json(), streakRes!.json()]);
      setHistory(Array.isArray(histData) ? histData : []);
      setStreaks(streakData || {});
      setSaveState('ok');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('err');
      setTimeout(() => setSaveState('idle'), 3000);
    } finally {
      setSaving(false);
    }
  }

  // Build last 30 days
  const today = todayStr();
  const last30: string[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    last30.push(d.toISOString().slice(0, 10));
  }

  const histMap: Record<string, any> = {};
  for (const h of history) histMap[h.date] = h;

  const firstDate = new Date(last30[0] + 'T12:00:00');
  const firstDow = (firstDate.getDay() + 6) % 7;
  const calCells: (string | null)[] = [...Array(firstDow).fill(null), ...last30];
  // Pad to multiple of 7
  while (calCells.length % 7 !== 0) calCells.push(null);

  // Group into rows
  const calRows: (string | null)[][] = [];
  for (let i = 0; i < calCells.length; i += 7) calRows.push(calCells.slice(i, i + 7));

  const doneCount = HABITS.filter(h => !h.negative && (form as any)[h.key]).length;

  if (loading) {
    return (
      <SafeAreaView style={S.page}>
        <ActivityIndicator color="#22c55e" size="large" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.page} edges={['top']}>
      {selectedDay && <DayModal date={selectedDay} onClose={() => setSelectedDay(null)} />}

      <ScrollView contentContainerStyle={S.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={S.header}>
          <Text style={S.appTitle}>LifeOS</Text>
          <Text style={S.dateLabel}>{formatDateSK(today)}</Text>
          <Text style={S.doneLabel}>{doneCount} / {HABITS.filter(h => !h.negative).length} návykov</Text>
        </View>

        {/* Habit checkboxes */}
        <View style={S.card}>
          {HABITS.map(({ key, label, color, negative }) => {
            const checked = !!(form as any)[key];
            return (
              <TouchableOpacity
                key={key}
                style={S.habitRow}
                onPress={() => setForm(f => ({ ...f, [key]: !(f as any)[key] }))}
                activeOpacity={0.7}
              >
                <View style={[S.checkbox, { borderColor: checked ? color : '#333' }, checked && { backgroundColor: color + '20' }]}>
                  {checked && <Text style={[S.checkmark, { color }]}>✓</Text>}
                </View>
                <Text style={[S.habitLabel, { color: checked ? color : '#888' }]}>{label}</Text>
                {(streaks[key] || 0) > 0 ? (
                  <View style={[S.streakPill, { borderColor: color }]}>
                    <Text style={[S.streakPillText, { color }]}>
                      {streaks[key]}{negative ? 'd' : '🔥'}
                    </Text>
                  </View>
                ) : (
                  <Text style={S.streakPillEmpty}>—</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Notes */}
        <TextInput
          style={S.notes}
          placeholder="Poznámky (voliteľné)..."
          placeholderTextColor="#333"
          value={form.notes}
          onChangeText={text => setForm(f => ({ ...f, notes: text }))}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Save button */}
        <TouchableOpacity
          style={[
            S.saveBtn,
            { opacity: saving ? 0.6 : 1 },
            saveState === 'err' ? { backgroundColor: '#7f1d1d', borderColor: '#ef4444' }
              : { backgroundColor: '#14532d', borderColor: '#22c55e' },
          ]}
          onPress={save}
          disabled={saving}
        >
          <Text style={[S.saveBtnText, { color: saveState === 'err' ? '#ef4444' : '#22c55e' }]}>
            {saveState === 'saving' ? 'Ukladám...' : saveState === 'ok' ? '✓ Uložené' : saveState === 'err' ? '✗ Chyba' : 'Uložiť'}
          </Text>
        </TouchableOpacity>

        {/* Streak grid */}
        <Text style={S.sectionTitle}>Série</Text>
        <View style={S.streakGrid}>
          {HABITS.map(({ key, label, color }) => {
            const n = streaks[key] || 0;
            return (
              <View key={key} style={S.streakBox}>
                <Text style={[S.streakNum, { color: n > 0 ? color : '#444' }]}>{n}</Text>
                <Text style={S.streakLabel}>{label.split(' ')[0]}</Text>
              </View>
            );
          })}
        </View>

        {/* 30-day calendar */}
        <Text style={S.sectionTitle}>Posledných 30 dní</Text>
        {/* Day-of-week header */}
        <View style={S.calRow}>
          {DOW.map(d => (
            <View key={d} style={S.calHeaderCell}>
              <Text style={S.calDow}>{d}</Text>
            </View>
          ))}
        </View>
        {calRows.map((row, ri) => (
          <View key={ri} style={S.calRow}>
            {row.map((date, ci) => {
              if (!date) return <View key={ci} style={S.calCell} />;
              const entry = histMap[date];
              const isToday = date === today;
              const dayNum = parseInt(date.slice(8), 10);
              const isFirst = dayNum === 1;
              return (
                <TouchableOpacity
                  key={ci}
                  style={[S.calCell, isToday ? S.calCellToday : S.calCellNormal]}
                  onPress={() => setSelectedDay(date)}
                  activeOpacity={0.7}
                >
                  <Text style={[S.calDay, { color: isToday ? '#e8e8e8' : '#444' }]} numberOfLines={1}>
                    {isFirst ? `${MONTHS_SK[parseInt(date.slice(5,7))-1]}${dayNum}` : dayNum}
                  </Text>
                  <View style={S.dotGrid}>
                    {HABITS.map(({ key, color }) => (
                      <View
                        key={key}
                        style={[S.dot, { backgroundColor: entry?.[key] ? color : '#2a2a2a' }]}
                      />
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Legend */}
        <View style={S.legend}>
          {HABITS.map(({ key, label, color }) => (
            <View key={key} style={S.legendItem}>
              <View style={[S.dot, { backgroundColor: color, width: 8, height: 8 }]} />
              <Text style={S.legendLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0f0f0f' },
  container: { padding: 16, paddingBottom: 32 },
  header: { marginBottom: 24 },
  appTitle: { fontSize: 26, fontWeight: '700', letterSpacing: 5, fontFamily: MONO, color: '#f0f0f0' },
  dateLabel: { fontSize: 13, color: '#555', marginTop: 5 },
  doneLabel: { fontSize: 12, color: '#444', marginTop: 3, fontFamily: MONO, letterSpacing: 1 },

  card: {
    backgroundColor: '#141414', borderRadius: 10, borderWidth: 1,
    borderColor: '#1e1e1e', marginBottom: 14, overflow: 'hidden',
  },
  habitRow: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#181818',
  },
  checkbox: {
    width: 22, height: 22, borderWidth: 1.5, borderColor: '#333',
    borderRadius: 5, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkmark: { fontSize: 13, fontWeight: '700' },
  habitLabel: { fontSize: 15, fontWeight: '500', flex: 1 },
  streakPill: {
    borderWidth: 1, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 1,
  },
  streakPillText: { fontSize: 12, fontFamily: MONO },
  streakPillEmpty: { fontSize: 12, color: '#333', fontFamily: MONO, minWidth: 28, textAlign: 'right' },

  notes: {
    backgroundColor: '#0c0c0c', borderWidth: 1, borderColor: '#222',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12,
    color: '#e8e8e8', fontSize: 14, marginBottom: 14, minHeight: 70,
  },

  saveBtn: {
    borderWidth: 1, borderRadius: 8, paddingVertical: 15,
    alignItems: 'center', marginBottom: 40,
  },
  saveBtnText: { fontSize: 14, fontWeight: '600', letterSpacing: 2 },

  sectionTitle: {
    fontSize: 11, color: '#3e3e3e', textTransform: 'uppercase',
    letterSpacing: 3, marginBottom: 12, fontFamily: MONO,
  },

  streakGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 40,
  },
  streakBox: {
    backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e',
    borderRadius: 8, padding: 14, alignItems: 'center', width: '22%',
  },
  streakNum: { fontSize: 22, fontWeight: '700', fontFamily: MONO, lineHeight: 26 },
  streakLabel: {
    fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginTop: 6,
  },

  calRow: { flexDirection: 'row', marginBottom: 3 },
  calHeaderCell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  calDow: {
    fontSize: 9, color: '#383838', fontFamily: MONO,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  calCell: {
    flex: 1, borderRadius: 5, paddingVertical: 4, paddingHorizontal: 2,
    alignItems: 'center', gap: 4,
  },
  calCellNormal: { borderWidth: 1, borderColor: '#1a1a1a', backgroundColor: '#141414' },
  calCellToday: { borderWidth: 1, borderColor: '#484848', backgroundColor: '#111320' },
  calDay: { fontSize: 9, fontFamily: MONO, fontWeight: '600', lineHeight: 12 },
  dotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, width: 24 },
  dot: { width: 5, height: 5, borderRadius: 3 },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 12 },
  legendLabel: { fontSize: 12, color: '#666' },
});
