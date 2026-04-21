import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, ChevronRight, MapPin, Plus } from 'lucide-react-native';
import { Appointment, Client } from '@/types';

interface Props {
  appointments: Appointment[];
  clients: Client[];
  onAddAppointment: (date: string) => void;
  onEditAppointment: (appointment: Appointment) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function toYMD(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${FULL_DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return time;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Estimate': { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  'Site Visit': { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
  'Follow-Up': { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
  'Client Meeting': { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' },
  'Project Meeting': { bg: '#FFF1F2', text: '#E11D48', border: '#FECDD3' },
  'Other': { bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB' },
};

export default function CRMCalendar({ appointments, clients, onAddAppointment, onEditAppointment }: Props) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(toYMD(today.getFullYear(), today.getMonth(), today.getDate()));
  const [calendarView, setCalendarView] = useState<'month' | 'day'>('month');

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const todayStr = toYMD(today.getFullYear(), today.getMonth(), today.getDate());

  const apptsByDate: Record<string, Appointment[]> = {};
  for (const a of appointments) {
    if (!apptsByDate[a.date]) apptsByDate[a.date] = [];
    apptsByDate[a.date].push(a);
  }

  const selectedAppts = apptsByDate[selectedDate] ?? [];
  const selectedClient = (appt: Appointment) => clients.find(c => c.id === appt.clientId);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const prevDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(toYMD(d.getFullYear(), d.getMonth(), d.getDate()));
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };
  const nextDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    setSelectedDate(toYMD(d.getFullYear(), d.getMonth(), d.getDate()));
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <View style={styles.container}>
      {/* Month/Day navigation */}
      <View style={styles.nav}>
        <TouchableOpacity onPress={calendarView === 'month' ? prevMonth : prevDay} style={styles.navBtn}>
          <ChevronLeft size={20} color="#1E3A5F" />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>
          {calendarView === 'month'
            ? `${MONTHS[viewMonth]} ${viewYear}`
            : formatFullDate(selectedDate)
          }
        </Text>
        <TouchableOpacity onPress={calendarView === 'month' ? nextMonth : nextDay} style={styles.navBtn}>
          <ChevronRight size={20} color="#1E3A5F" />
        </TouchableOpacity>
      </View>

      {/* Toggle row: Month/Day on left, + New on right */}
      <View style={styles.toggleRow}>
        <View style={styles.toggleGroup}>
          <TouchableOpacity
            style={[styles.toggleBtn, calendarView === 'month' && styles.toggleBtnActive]}
            onPress={() => setCalendarView('month')}
          >
            <Text style={[styles.toggleText, calendarView === 'month' && styles.toggleTextActive]}>Month</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, calendarView === 'day' && styles.toggleBtnActive]}
            onPress={() => setCalendarView('day')}
          >
            <Text style={[styles.toggleText, calendarView === 'day' && styles.toggleTextActive]}>Day</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={() => onAddAppointment(selectedDate)}>
          <Plus size={14} color="#FFFFFF" />
          <Text style={styles.newBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {calendarView === 'month' ? (
        <>
          {/* Day headers */}
          <View style={styles.dayHeaders}>
            {DAYS.map(d => (
              <Text key={d} style={styles.dayHeader}>{d}</Text>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={styles.grid}>
            {cells.map((day, idx) => {
              if (!day) return <View key={`e-${idx}`} style={styles.cell} />;
              const dateStr = toYMD(viewYear, viewMonth, day);
              const dayAppts = apptsByDate[dateStr] ?? [];
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[styles.cell, isSelected && styles.cellSelectedBorder]}
                  onPress={() => setSelectedDate(dateStr)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cellDayRow}>
                    <View style={[isToday && styles.todayCircle]}>
                      <Text style={[styles.cellText, isToday && styles.cellTextToday]}>
                        {day}
                      </Text>
                    </View>
                  </View>
                  {dayAppts.slice(0, 2).map((a, i) => {
                    const c = a.clientId ? clients.find(cl => cl.id === a.clientId) : null;
                    const typeColor = TYPE_COLORS[a.type ?? 'Other'] ?? TYPE_COLORS['Other'];
                    const barBg = a.type === 'Site Visit' ? '#16A34A' : typeColor.text;
                    const timeStr = a.time ? formatTime12(a.time).replace(':00 ', ' ').replace(/^0/, '') : '';
                    const label = `${timeStr}${c ? ' ' + c.name.split(' ')[0] : ''}`.trim();
                    return (
                      <View key={a.id ?? i} style={[styles.cellApptBar, { backgroundColor: barBg }]}>
                        <Text style={styles.cellApptText} numberOfLines={1}>{label || a.title.slice(0, 10)}</Text>
                      </View>
                    );
                  })}
                  {dayAppts.length > 2 && (
                    <Text style={styles.cellMoreText}>+{dayAppts.length - 2} more</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : null}

      {/* Selected day appointments */}
      <View style={styles.daySection}>
        {calendarView === 'month' && (
          <Text style={styles.daySectionTitle}>
            {selectedDate === todayStr ? 'Today' : formatFullDate(selectedDate)}
          </Text>
        )}

        {selectedAppts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No appointments on {formatFullDate(selectedDate)}
            </Text>
            <TouchableOpacity style={styles.addAppointmentBtn} onPress={() => onAddAppointment(selectedDate)}>
              <Plus size={14} color="#2563EB" />
              <Text style={styles.addAppointmentBtnText}>Add Appointment</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {selectedAppts.map(appt => {
              const client = selectedClient(appt);
              const typeColor = TYPE_COLORS[appt.type ?? 'Other'] ?? TYPE_COLORS['Other'];
              return (
                <TouchableOpacity key={appt.id} style={styles.apptRow} onPress={() => onEditAppointment(appt)} activeOpacity={0.7}>
                  {/* Type-colored vertical bar */}
                  <View style={[styles.apptBar, { backgroundColor: typeColor.text }]} />
                  {/* Time column */}
                  <View style={styles.apptTimeCol}>
                    <Text style={styles.apptTime}>{appt.time ? formatTime12(appt.time) : '—'}</Text>
                  </View>
                  {/* Info column */}
                  <View style={styles.apptInfo}>
                    <Text style={styles.apptTitle} numberOfLines={2}>{appt.title}</Text>
                    {client && <Text style={styles.apptClient} numberOfLines={1}>{client.name}</Text>}
                    {appt.address ? (
                      <TouchableOpacity
                        style={styles.apptAddressRow}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(appt.address!)}`);
                        }}
                        activeOpacity={0.6}
                      >
                        <MapPin size={13} color="#2563EB" />
                        <Text style={styles.apptAddress} numberOfLines={1}>{appt.address}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  {/* Type badge */}
                  {appt.type && (
                    <View style={[styles.apptTypeBadge, { backgroundColor: typeColor.bg, borderColor: typeColor.border }]}>
                      <Text style={[styles.apptTypeBadgeText, { color: typeColor.text }]}>{appt.type}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.addAppointmentBtn} onPress={() => onAddAppointment(selectedDate)}>
              <Plus size={14} color="#2563EB" />
              <Text style={styles.addAppointmentBtnText}>Add Appointment</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  navBtn: { padding: 6 },
  monthLabel: { fontSize: 16, fontWeight: '700', color: '#1E3A5F' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  toggleGroup: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 8, overflow: 'hidden' },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 6 },
  toggleBtnActive: { backgroundColor: '#2563EB', borderRadius: 8 },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  toggleTextActive: { color: '#FFFFFF' },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2563EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  newBtnText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  dayHeaders: { flexDirection: 'row', paddingHorizontal: 4 },
  dayHeader: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: '#94A3B8', paddingBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 0, borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#E5E7EB' },
  cell: { width: `${100 / 7}%` as any, minHeight: 70, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#E5E7EB', padding: 3 },
  cellSelectedBorder: { backgroundColor: '#F0F5FF' },
  cellDayRow: { alignItems: 'flex-start', marginBottom: 2 },
  todayCircle: { backgroundColor: '#2563EB', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontSize: 12, color: '#1F2937', fontWeight: '500' },
  cellTextToday: { color: '#FFFFFF', fontWeight: '700' },
  cellApptBar: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 3, marginBottom: 2 },
  cellApptText: { fontSize: 9, fontWeight: '700', color: '#FFFFFF' },
  cellMoreText: { fontSize: 8, color: '#6B7280', fontWeight: '600', marginTop: 1 },
  daySection: { borderTopWidth: 1, borderTopColor: '#E5E7EB', padding: 16 },
  daySectionTitle: { fontSize: 14, fontWeight: '700', color: '#1E3A5F', marginBottom: 10 },
  emptyContainer: { alignItems: 'center', paddingVertical: 16 },
  emptyText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginBottom: 12 },
  addAppointmentBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  addAppointmentBtnText: { fontSize: 13, fontWeight: '600', color: '#2563EB' },
  apptRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14, paddingHorizontal: 4, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  apptBar: { width: 3, borderRadius: 2, alignSelf: 'stretch', marginRight: 12, minHeight: 40 },
  apptTimeCol: { width: 72, marginRight: 12, paddingTop: 2 },
  apptTime: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  apptInfo: { flex: 1, paddingTop: 1 },
  apptTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', lineHeight: 20 },
  apptClient: { fontSize: 13, color: '#6B7280', marginTop: 3 },
  apptAddressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  apptAddress: { fontSize: 13, color: '#2563EB', textDecorationLine: 'underline' },
  apptTypeBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginLeft: 8, marginTop: 2 },
  apptTypeBadgeText: { fontSize: 12, fontWeight: '600' },
});
