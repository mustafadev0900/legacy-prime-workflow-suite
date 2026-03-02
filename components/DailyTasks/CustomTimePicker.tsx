import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

interface CustomTimePickerProps {
  value: string; // HH:MM 24-hour format
  onChange: (timeString: string) => void;
}

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
const QUICK_PRESETS = [
  { label: '9:00 AM', value: '09:00' },
  { label: '12:00 PM', value: '12:00' },
  { label: '5:00 PM', value: '17:00' },
];

// Parse HH:MM (24h) → { hour (1-12), minute string, ampm }
function parse24h(time: string): { hour: number; minute: string; ampm: 'AM' | 'PM' } {
  const parts = (time || '09:00').split(':');
  const h = parseInt(parts[0], 10) || 9;
  const m = parts[1] ? parts[1].padStart(2, '0') : '00';
  return {
    hour: h % 12 || 12,
    minute: m,
    ampm: h < 12 ? 'AM' : 'PM',
  };
}

// { hour12, minute, ampm } → HH:MM (24h)
function to24h(hour12: number, minute: string, ampm: 'AM' | 'PM'): string {
  let h = hour12 % 12;
  if (ampm === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${minute}`;
}

export default function CustomTimePicker({ value, onChange }: CustomTimePickerProps) {
  // Fully controlled — derive display state from value prop on every render
  const { hour: selHour, minute: selMinute, ampm: selAmpm } = parse24h(value);

  return (
    <View style={styles.container}>

      {/* Quick presets */}
      <View style={styles.presetsRow}>
        {QUICK_PRESETS.map(p => (
          <TouchableOpacity
            key={p.value}
            style={[styles.presetBtn, value === p.value && styles.presetBtnActive]}
            onPress={() => onChange(p.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.presetText, value === p.value && styles.presetTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.divider} />

      {/* Hours */}
      <Text style={styles.sectionLabel}>Hour</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {HOURS.map(h => {
          const active = selHour === h;
          return (
            <TouchableOpacity
              key={h}
              style={[styles.hourBtn, active && styles.btnActive]}
              onPress={() => onChange(to24h(h, selMinute, selAmpm))}
              activeOpacity={0.7}
            >
              <Text style={[styles.hourText, active && styles.btnTextActive]}>{h}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Minutes */}
      <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Minute</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {MINUTES.map(m => {
          const active = selMinute === m;
          return (
            <TouchableOpacity
              key={m}
              style={[styles.minuteBtn, active && styles.btnActive]}
              onPress={() => onChange(to24h(selHour, m, selAmpm))}
              activeOpacity={0.7}
            >
              <Text style={[styles.minuteText, active && styles.btnTextActive]}>:{m}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* AM / PM */}
      <View style={styles.ampmRow}>
        {(['AM', 'PM'] as const).map(a => (
          <TouchableOpacity
            key={a}
            style={[styles.ampmBtn, selAmpm === a && styles.ampmBtnActive]}
            onPress={() => onChange(to24h(selHour, selMinute, a))}
            activeOpacity={0.7}
          >
            <Text style={[styles.ampmText, selAmpm === a && styles.ampmTextActive]}>{a}</Text>
          </TouchableOpacity>
        ))}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  // Quick presets
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  presetBtnActive: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
  },
  presetText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  presetTextActive: {
    color: '#059669',
  },

  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 12,
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  scrollContent: {
    gap: 6,
    paddingBottom: 2,
  },

  // Hour buttons
  hourBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },

  // Minute buttons
  minuteBtn: {
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  minuteText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },

  // Active state (shared)
  btnActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  btnTextActive: {
    color: '#FFFFFF',
  },

  // AM / PM
  ampmRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 10,
  },
  ampmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  ampmBtnActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  ampmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
  },
  ampmTextActive: {
    color: '#FFFFFF',
  },
});
