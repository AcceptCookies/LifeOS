import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';

const MONO = 'Courier New';

interface Option {
  label: string;
  value: string;
}

interface PickerModalProps {
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  placeholder?: string;
  style?: object;
}

export default function PickerModal({ value, options, onChange, placeholder, style }: PickerModalProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  const displayLabel = selected?.label ?? placeholder ?? '—';

  return (
    <>
      <TouchableOpacity style={[S.trigger, style]} onPress={() => setOpen(true)}>
        <Text style={[S.triggerText, !selected && S.placeholder]}>{displayLabel}</Text>
        <Text style={S.arrow}>▾</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={S.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={S.sheet}>
            <View style={S.sheetHeader}>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={S.doneBtn}>Zavrieť</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {placeholder !== undefined && (
                <TouchableOpacity
                  style={[S.option, value === '' && S.optionSelected]}
                  onPress={() => { onChange(''); setOpen(false); }}
                >
                  <Text style={[S.optionText, S.placeholder]}>{placeholder}</Text>
                </TouchableOpacity>
              )}
              {options.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[S.option, opt.value === value && S.optionSelected]}
                  onPress={() => { onChange(opt.value); setOpen(false); }}
                >
                  <Text style={[S.optionText, opt.value === value && S.optionTextSelected]}>
                    {opt.label}
                  </Text>
                  {opt.value === value && <Text style={S.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const S = StyleSheet.create({
  trigger: {
    backgroundColor: '#0c0c0c',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 7,
    paddingHorizontal: 11,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerText: {
    color: '#d0d0d0',
    fontSize: 13,
    flex: 1,
  },
  placeholder: { color: '#555' },
  arrow: { color: '#444', fontSize: 12, marginLeft: 6 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    maxHeight: 400,
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  doneBtn: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: MONO,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
  },
  optionSelected: { backgroundColor: '#0a1a0a' },
  optionText: { color: '#888', fontSize: 15, flex: 1 },
  optionTextSelected: { color: '#22c55e' },
  checkmark: { color: '#22c55e', fontSize: 16 },
});
