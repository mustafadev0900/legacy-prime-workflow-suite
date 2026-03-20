import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ArrowLeft, Clock, DollarSign, Users, ChevronRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Period = 'today' | 'week' | 'month' | 'all';

interface ClockEntryRaw {
  id: string;
  employee_id: string;
  clock_in: string;
  clock_out: string | null;
  hourly_rate: number | null;
  lunch_breaks: { startTime: string; endTime?: string }[] | null;
  work_performed: string | null;
  category: string | null;
}

interface Session {
  id: string;
  clockIn: string;
  clockOut: string | null;
  hourlyRate: number | null;
  lunchBreaks: { startTime: string; endTime?: string }[];
  workPerformed: string | null;
  category: string | null;
  netHours: number;
  cost: number;
  isActive: boolean;
}

interface EmployeeSummary {
  employeeId: string;
  name: string;
  totalHours: number;
  totalCost: number;
  sessionCount: number;
  isActive: boolean;
  rate: number | null; // -1 = varies
  sessions: Session[];
}

interface DateGroup {
  dateKey: string;
  dateLabel: string;
  sessions: Session[];
  totalHours: number;
  totalCost: number;
}

function getPeriodStart(period: Period): Date | null {
  const now = new Date();
  if (period === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (period === 'week') {
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday of this week
    const mon = new Date(now);
    mon.setDate(now.getDate() + diff);
    mon.setHours(0, 0, 0, 0);
    return mon;
  }
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return null;
}

function calcNetHours(entry: ClockEntryRaw): number {
  if (!entry.clock_in) return 0;
  const clockInMs = new Date(entry.clock_in).getTime();
  const clockOutMs = entry.clock_out ? new Date(entry.clock_out).getTime() : Date.now();
  let totalMs = clockOutMs - clockInMs;
  if (entry.lunch_breaks) {
    entry.lunch_breaks.forEach(lunch => {
      const ls = new Date(lunch.startTime).getTime();
      const le = lunch.endTime ? new Date(lunch.endTime).getTime() : clockOutMs;
      if (!isNaN(ls) && !isNaN(le)) totalMs -= (le - ls);
    });
  }
  return Math.max(0, totalMs / 3_600_000);
}

function calcLunchMinutes(entry: ClockEntryRaw): number {
  if (!entry.lunch_breaks || entry.lunch_breaks.length === 0) return 0;
  const clockOutMs = entry.clock_out ? new Date(entry.clock_out).getTime() : Date.now();
  let totalMs = 0;
  entry.lunch_breaks.forEach(lunch => {
    const ls = new Date(lunch.startTime).getTime();
    const le = lunch.endTime ? new Date(lunch.endTime).getTime() : clockOutMs;
    if (!isNaN(ls) && !isNaN(le)) totalMs += le - ls;
  });
  return Math.round(totalMs / 60_000);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function formatDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  all: 'All Time',
};

export default function LaborScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { projects } = useApp();

  const project = useMemo(() => projects.find(p => p.id === id), [projects, id]);

  const [period, setPeriod] = useState<Period>('all');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [rawEntries, setRawEntries] = useState<(ClockEntryRaw & { employeeName: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setFetchError(null);
    Promise.all([
      supabase
        .from('clock_entries')
        .select('*')
        .eq('project_id', id as string)
        .order('clock_in', { ascending: false }),
      supabase.from('users').select('id, name'),
    ]).then(([{ data: clockData, error: clockErr }, { data: usersData, error: usersErr }]) => {
      if (clockErr || usersErr) {
        setFetchError((clockErr || usersErr)!.message);
        setLoading(false);
        return;
      }
      const namesMap = new Map<string, string>();
      (usersData || []).forEach((u: { id: string; name: string }) => namesMap.set(u.id, u.name));
      const enriched = (clockData || []).map((e: ClockEntryRaw) => ({
        ...e,
        employeeName: namesMap.get(e.employee_id) || 'Unknown',
      }));
      setRawEntries(enriched);
      setLoading(false);
    });
  }, [id]);

  // Filter by period
  const filteredEntries = useMemo(() => {
    const start = getPeriodStart(period);
    if (!start) return rawEntries;
    return rawEntries.filter(e => new Date(e.clock_in) >= start);
  }, [rawEntries, period]);

  // Per-employee summaries
  const employeeSummaries = useMemo((): EmployeeSummary[] => {
    const map = new Map<string, EmployeeSummary>();
    const twentyFourHoursAgo = Date.now() - 24 * 3_600_000;

    filteredEntries.forEach(entry => {
      const isActive = !entry.clock_out && new Date(entry.clock_in).getTime() > twentyFourHoursAgo;
      const netHours = calcNetHours(entry);
      const rate = entry.hourly_rate;
      const cost = rate != null ? netHours * rate : 0;

      const session: Session = {
        id: entry.id,
        clockIn: entry.clock_in,
        clockOut: entry.clock_out,
        hourlyRate: rate,
        lunchBreaks: entry.lunch_breaks || [],
        workPerformed: entry.work_performed,
        category: entry.category,
        netHours,
        cost,
        isActive,
      };

      const existing = map.get(entry.employee_id);
      if (existing) {
        existing.totalHours += netHours;
        existing.totalCost += cost;
        existing.sessionCount += 1;
        if (isActive) existing.isActive = true;
        existing.sessions.push(session);
        // Mark as varies if rates differ across sessions
        if (existing.rate !== rate && existing.rate !== -1) existing.rate = -1;
      } else {
        map.set(entry.employee_id, {
          employeeId: entry.employee_id,
          name: entry.employeeName,
          totalHours: netHours,
          totalCost: cost,
          sessionCount: 1,
          isActive,
          rate: rate ?? null,
          sessions: [session],
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours);
  }, [filteredEntries]);

  const grandTotalHours = useMemo(() =>
    employeeSummaries.reduce((s, e) => s + e.totalHours, 0), [employeeSummaries]);
  const grandTotalCost = useMemo(() =>
    employeeSummaries.reduce((s, e) => s + e.totalCost, 0), [employeeSummaries]);

  // Detail: selected employee
  const selectedEmployee = useMemo(() =>
    selectedEmployeeId ? employeeSummaries.find(e => e.employeeId === selectedEmployeeId) ?? null : null,
    [selectedEmployeeId, employeeSummaries]);

  // Group sessions by date for detail view
  const sessionsByDate = useMemo((): DateGroup[] => {
    if (!selectedEmployee) return [];
    const dateMap = new Map<string, Session[]>();
    selectedEmployee.sessions.forEach(s => {
      const key = formatDateKey(s.clockIn);
      if (!dateMap.has(key)) dateMap.set(key, []);
      dateMap.get(key)!.push(s);
    });
    return Array.from(dateMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([dateKey, sessions]) => ({
        dateKey,
        dateLabel: formatDateLabel(sessions[0].clockIn),
        sessions: sessions.sort((a, b) =>
          new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime()),
        totalHours: sessions.reduce((s, sess) => s + sess.netHours, 0),
        totalCost: sessions.reduce((s, sess) => s + sess.cost, 0),
      }));
  }, [selectedEmployee]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!project) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Project not found</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading labor data...</Text>
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {fetchError}</Text>
      </View>
    );
  }

  const headerPaddingTop = Platform.OS === 'ios' ? insets.top : (insets.top || 16);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={[styles.header, { paddingTop: headerPaddingTop + 12 }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => selectedEmployee ? setSelectedEmployeeId(null) : router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowLeft size={24} color="#1F2937" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {selectedEmployee ? selectedEmployee.name : 'Labor Management'}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>{project.name}</Text>
          </View>
        </View>

        {/* ── Period filter tabs ───────────────────────────────────────────── */}
        <View style={styles.periodTabs}>
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.periodTab, period === p && styles.periodTabActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodTabText, period === p && styles.periodTabTextActive]}>
                {PERIOD_LABELS[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedEmployee ? (
          // ── Detail view ──────────────────────────────────────────────────
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>

            {/* Employee summary card */}
            <View style={styles.empSummaryCard}>
              <View style={styles.empSummaryTop}>
                <View style={[styles.avatarLarge, selectedEmployee.isActive && styles.avatarLargeActive]}>
                  <Text style={styles.avatarLargeText}>{selectedEmployee.name.charAt(0).toUpperCase()}</Text>
                  {selectedEmployee.isActive && <View style={styles.avatarActiveDot} />}
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.empSummaryName}>{selectedEmployee.name}</Text>
                  <Text style={styles.empSummaryRate}>
                    {selectedEmployee.rate === -1
                      ? 'Multiple rates'
                      : selectedEmployee.rate != null
                        ? `$${(selectedEmployee.rate as number).toFixed(2)}/hr`
                        : 'No rate set'}
                  </Text>
                  {selectedEmployee.isActive && (
                    <View style={styles.livePill}>
                      <Text style={styles.livePillText}>● Live</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.empSummaryStats}>
                <View style={styles.empSummaryStat}>
                  <Text style={styles.empSummaryStatValue}>{selectedEmployee.totalHours.toFixed(2)}h</Text>
                  <Text style={styles.empSummaryStatLabel}>Hours</Text>
                </View>
                <View style={styles.empSummaryStatDivider} />
                <View style={styles.empSummaryStat}>
                  <Text style={[styles.empSummaryStatValue, { color: '#10B981' }]}>
                    ${selectedEmployee.totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </Text>
                  <Text style={styles.empSummaryStatLabel}>Cost</Text>
                </View>
                <View style={styles.empSummaryStatDivider} />
                <View style={styles.empSummaryStat}>
                  <Text style={styles.empSummaryStatValue}>{selectedEmployee.sessionCount}</Text>
                  <Text style={styles.empSummaryStatLabel}>Sessions</Text>
                </View>
              </View>
            </View>

            {/* Sessions grouped by date */}
            {sessionsByDate.length === 0 ? (
              <View style={styles.emptyState}>
                <Clock size={40} color="#D1D5DB" />
                <Text style={styles.emptyText}>No sessions in this period</Text>
              </View>
            ) : (
              sessionsByDate.map(group => (
                <View key={group.dateKey} style={styles.dateGroup}>
                  <View style={styles.dateGroupHeader}>
                    <Text style={styles.dateGroupLabel}>{group.dateLabel}</Text>
                    <View style={styles.dateGroupTotals}>
                      <Text style={styles.dateGroupHours}>{group.totalHours.toFixed(2)}h</Text>
                      {group.totalCost > 0 && (
                        <Text style={styles.dateGroupCost}>
                          ${group.totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </Text>
                      )}
                    </View>
                  </View>

                  {group.sessions.map(session => {
                    const lunchMin = calcLunchMinutes({
                      ...session,
                      clock_in: session.clockIn,
                      clock_out: session.clockOut,
                      hourly_rate: session.hourlyRate,
                      lunch_breaks: session.lunchBreaks,
                      work_performed: session.workPerformed,
                      employee_id: '',
                      category: session.category,
                    });

                    return (
                      <View key={session.id} style={styles.sessionCard}>
                        <View style={styles.sessionTimeRow}>
                          <View style={styles.sessionTimeItem}>
                            <Text style={styles.sessionTimeLabel}>Clock In</Text>
                            <Text style={styles.sessionTimeValue}>{formatTime(session.clockIn)}</Text>
                          </View>
                          <View style={styles.sessionTimeSeparator}>
                            <View style={styles.sessionTimeLine} />
                            <Clock size={12} color="#9CA3AF" />
                            <View style={styles.sessionTimeLine} />
                          </View>
                          <View style={styles.sessionTimeItem}>
                            <Text style={styles.sessionTimeLabel}>Clock Out</Text>
                            <Text style={[
                              styles.sessionTimeValue,
                              !session.clockOut && styles.sessionTimeLive,
                            ]}>
                              {session.clockOut ? formatTime(session.clockOut) : 'Active'}
                            </Text>
                          </View>
                        </View>

                        {(lunchMin > 0 || session.category) && (
                          <View style={styles.sessionChips}>
                            {lunchMin > 0 && (
                              <View style={styles.chip}>
                                <Text style={styles.chipText}>Lunch: {lunchMin}min</Text>
                              </View>
                            )}
                            {session.category && (
                              <View style={[styles.chip, styles.chipBlue]}>
                                <Text style={[styles.chipText, styles.chipTextBlue]}>{session.category}</Text>
                              </View>
                            )}
                          </View>
                        )}

                        <View style={styles.sessionFooter}>
                          <Text style={styles.sessionNetHours}>
                            Net: {session.netHours.toFixed(2)}h
                          </Text>
                          <Text style={[
                            styles.sessionCost,
                            session.cost > 0 ? styles.sessionCostGreen : styles.sessionCostMuted,
                          ]}>
                            {session.hourlyRate != null
                              ? `$${session.cost.toFixed(2)} @ $${session.hourlyRate.toFixed(2)}/hr`
                              : 'No rate'}
                          </Text>
                        </View>

                        {!!session.workPerformed && (
                          <Text style={styles.sessionWorkPerformed} numberOfLines={2}>
                            {session.workPerformed}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))
            )}
          </ScrollView>

        ) : (
          // ── Master / Employee list ────────────────────────────────────────
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>

            {/* Summary strip */}
            <View style={styles.summaryStrip}>
              <View style={styles.summaryStripItem}>
                <Users size={18} color="#2563EB" />
                <View style={{ marginLeft: 8 }}>
                  <Text style={styles.summaryStripValue}>{employeeSummaries.length}</Text>
                  <Text style={styles.summaryStripLabel}>Employees</Text>
                </View>
              </View>
              <View style={styles.summaryStripDivider} />
              <View style={styles.summaryStripItem}>
                <Clock size={18} color="#10B981" />
                <View style={{ marginLeft: 8 }}>
                  <Text style={[styles.summaryStripValue, { color: '#10B981' }]}>
                    {grandTotalHours.toFixed(1)}h
                  </Text>
                  <Text style={styles.summaryStripLabel}>Total Hours</Text>
                </View>
              </View>
              <View style={styles.summaryStripDivider} />
              <View style={styles.summaryStripItem}>
                <DollarSign size={18} color="#F59E0B" />
                <View style={{ marginLeft: 8 }}>
                  <Text style={[styles.summaryStripValue, { color: '#F59E0B' }]}>
                    ${grandTotalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </Text>
                  <Text style={styles.summaryStripLabel}>Total Cost</Text>
                </View>
              </View>
            </View>

            {employeeSummaries.length === 0 ? (
              <View style={styles.emptyState}>
                <Users size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>No clock entries in this period</Text>
                <Text style={styles.emptySubtext}>
                  Employees clock in to this project to see labor data here
                </Text>
              </View>
            ) : (
              <View style={styles.employeeList}>
                {employeeSummaries.map(emp => (
                  <TouchableOpacity
                    key={emp.employeeId}
                    style={styles.employeeCard}
                    onPress={() => setSelectedEmployeeId(emp.employeeId)}
                    activeOpacity={0.7}
                  >
                    {/* Avatar */}
                    <View style={[styles.avatar, emp.isActive && styles.avatarActive]}>
                      <Text style={styles.avatarText}>{emp.name.charAt(0).toUpperCase()}</Text>
                      {emp.isActive && <View style={styles.avatarDot} />}
                    </View>

                    <View style={styles.empCardBody}>
                      <View style={styles.empCardTop}>
                        <Text style={styles.empCardName} numberOfLines={1}>{emp.name}</Text>
                        <Text style={styles.empCardCost}>
                          {emp.totalCost > 0
                            ? `$${emp.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                            : '—'}
                        </Text>
                      </View>
                      <View style={styles.empCardBottom}>
                        <Text style={styles.empCardMeta}>
                          {emp.totalHours.toFixed(1)}h
                          {' · '}
                          {emp.sessionCount} session{emp.sessionCount !== 1 ? 's' : ''}
                        </Text>
                        {emp.isActive && (
                          <View style={styles.liveBadge}>
                            <Text style={styles.liveBadgeText}>● Live</Text>
                          </View>
                        )}
                        {emp.rate != null && emp.rate !== -1 && (
                          <Text style={styles.empCardRate}>
                            ${(emp.rate as number).toFixed(0)}/hr
                          </Text>
                        )}
                        {emp.rate === -1 && (
                          <Text style={styles.empCardRate}>Varies</Text>
                        )}
                      </View>
                    </View>

                    <ChevronRight size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600' as const,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 24,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 1,
  },

  // Period tabs
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  periodTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  periodTabActive: {
    backgroundColor: '#2563EB',
  },
  periodTabText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  periodTabTextActive: {
    color: '#FFFFFF',
  },

  scrollView: {
    flex: 1,
  },

  // Summary strip
  summaryStrip: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  summaryStripItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryStripDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E5E7EB',
  },
  summaryStripValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  summaryStripLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
  },

  // Employee list
  employeeList: {
    marginHorizontal: 16,
    marginTop: 16,
    gap: 10,
  },
  employeeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarActive: {
    backgroundColor: '#D1FAE5',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  avatarDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  empCardBody: {
    flex: 1,
  },
  empCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  empCardName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1F2937',
    flex: 1,
    marginRight: 8,
  },
  empCardCost: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  empCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  empCardMeta: {
    fontSize: 13,
    color: '#6B7280',
  },
  empCardRate: {
    fontSize: 12,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    fontWeight: '500' as const,
  },
  liveBadge: {
    backgroundColor: '#D1FAE5',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#059669',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#374151',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Employee detail summary card
  empSummaryCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  empSummaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLargeActive: {
    backgroundColor: '#D1FAE5',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  avatarActiveDot: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarLargeText: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  empSummaryName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 2,
  },
  empSummaryRate: {
    fontSize: 14,
    color: '#6B7280',
  },
  livePill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  livePillText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#059669',
  },
  empSummaryStats: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingVertical: 14,
  },
  empSummaryStat: {
    flex: 1,
    alignItems: 'center',
  },
  empSummaryStatDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  empSummaryStatValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  empSummaryStatLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },

  // Date groups
  dateGroup: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  dateGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  dateGroupLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateGroupTotals: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateGroupHours: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  dateGroupCost: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#10B981',
  },

  // Session card
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  sessionTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sessionTimeItem: {
    flex: 1,
    alignItems: 'center',
  },
  sessionTimeSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sessionTimeLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
  },
  sessionTimeLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 3,
  },
  sessionTimeValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  sessionTimeLive: {
    color: '#10B981',
  },
  sessionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipBlue: {
    backgroundColor: '#EFF6FF',
  },
  chipText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500' as const,
  },
  chipTextBlue: {
    color: '#2563EB',
  },
  sessionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  sessionNetHours: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
  },
  sessionCost: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  sessionCostGreen: {
    color: '#10B981',
  },
  sessionCostMuted: {
    color: '#9CA3AF',
  },
  sessionWorkPerformed: {
    marginTop: 8,
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    lineHeight: 18,
  },
});
