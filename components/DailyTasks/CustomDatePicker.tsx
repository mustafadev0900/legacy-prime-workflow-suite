import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD, or empty string
  onChange: (dateString: string) => void;
  minimumDate?: Date;
}

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

export default function CustomDatePicker({ value, onChange, minimumDate }: CustomDatePickerProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Seed the visible month from the current value, or default to today
  const seed = value ? new Date(value + 'T00:00:00') : today;
  const [viewYear, setViewYear] = useState(seed.getFullYear());
  const [viewMonth, setViewMonth] = useState(seed.getMonth());

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  // Build flat array: nulls for leading empty slots + day numbers
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows = chunkArray(cells, 7);

  const toDateStr = (day: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const isDisabled = (day: number): boolean => {
    if (!minimumDate) return false;
    const min = new Date(minimumDate);
    min.setHours(0, 0, 0, 0);
    return new Date(viewYear, viewMonth, day) < min;
  };

  const isToday = (day: number): boolean =>
    viewYear === today.getFullYear() &&
    viewMonth === today.getMonth() &&
    day === today.getDate();

  const isSelected = (day: number): boolean => toDateStr(day) === value;

  return (
    <View style={styles.container}>
      {/* Month / Year navigation */}
      <View style={styles.header}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn} activeOpacity={0.7}>
          <ChevronLeft size={18} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.monthYear}>
          {MONTHS[viewMonth]} {viewYear}
        </Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn} activeOpacity={0.7}>
          <ChevronRight size={18} color="#374151" />
        </TouchableOpacity>
      </View>

      {/* Day-of-week header */}
      <View style={styles.weekRow}>
        {WEEK_DAYS.map(d => (
          <Text key={d} style={styles.weekLabel}>{d}</Text>
        ))}
      </View>

      {/* Date grid */}
      {rows.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((day, ci) => {
            if (!day) {
              return <View key={`empty-${ri}-${ci}`} style={styles.cell} />;
            }

            const disabled = isDisabled(day);
            const selected = isSelected(day);
            const todayCell = isToday(day);

            return (
              <TouchableOpacity
                key={`${ri}-${ci}`}
                style={[
                  styles.cell,
                  selected && styles.cellSelected,
                  todayCell && !selected && styles.cellToday,
                  disabled && styles.cellDisabled,
                ]}
                onPress={() => onChange(toDateStr(day))}
                activeOpacity={0.7}
                disabled={disabled}
              >
                <Text style={[
                  styles.cellText,
                  disabled && styles.cellTextDisabled,
                  todayCell && !selected && styles.cellTextToday,
                  selected && styles.cellTextSelected,
                ]}>
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
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
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthYear: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },

  // Day-of-week labels
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    paddingVertical: 4,
  },

  // Date grid
  row: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  cell: {
    flex: 1,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginHorizontal: 1,
  },
  cellSelected: {
    backgroundColor: '#10B981',
  },
  cellToday: {
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  cellDisabled: {
    opacity: 0.3,
  },
  cellText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  cellTextDisabled: {
    color: '#D1D5DB',
  },
  cellTextToday: {
    color: '#10B981',
    fontWeight: '700',
  },
  cellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
