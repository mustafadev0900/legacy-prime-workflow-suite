import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { History, Clock, ChevronRight, ChevronDown } from "lucide-react-native";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";
import type { ClockEntry, GeoPoint } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 6;
const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];
const ANCHOR = new Date("2025-01-06T00:00:00").getTime();
const DAY_MS = 86_400_000;

type PeriodMode = "Weekly" | "Biweekly" | "Monthly";

interface Period {
  label: string;
  start: Date;
  end: Date;
}

interface PeriodSummary {
  period: Period;
  sessions: number;
  netHours: number;
  pay: number;
}

// ─── Generate all historical periods (up to 2 years back) ────────────────────
function getAllPeriods(mode: PeriodMode): Period[] {
  const now = new Date();
  if (mode === "Weekly") {
    const dow = now.getDay();
    const daysToMon = dow === 0 ? 6 : dow - 1;
    const thisMonday = new Date(now);
    thisMonday.setHours(0, 0, 0, 0);
    thisMonday.setDate(thisMonday.getDate() - daysToMon);
    return Array.from({ length: 104 }, (_, k) => {
      const s = new Date(thisMonday.getTime() - k * 7 * DAY_MS);
      const e = new Date(s.getTime() + 6 * DAY_MS);
      e.setHours(23, 59, 59, 999);
      const f = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;
      return { label: `${f(s)} – ${f(e)}, ${e.getFullYear()}`, start: s, end: e };
    });
  }
  if (mode === "Biweekly") {
    const cur = Math.floor((now.getTime() - ANCHOR) / (14 * DAY_MS));
    return Array.from({ length: 52 }, (_, k) => {
      const i = cur - k;
      if (i < 0) return null!;
      const s = new Date(ANCHOR + i * 14 * DAY_MS);
      const e = new Date(s.getTime() + 13 * DAY_MS);
      e.setHours(23, 59, 59, 999);
      const f = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;
      return { label: `${f(s)} – ${f(e)}, ${e.getFullYear()}`, start: s, end: e };
    }).filter(Boolean);
  }
  return Array.from({ length: 24 }, (_, k) => {
    const s = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const e = new Date(now.getFullYear(), now.getMonth() - k + 1, 0);
    e.setHours(23, 59, 59, 999);
    return { label: `${MONTHS[s.getMonth()]} ${s.getFullYear()}`, start: s, end: e };
  });
}

// ─── Data helpers ─────────────────────────────────────────────────────────────
function normLoc(l: any): GeoPoint {
  if (!l || typeof l !== "object") return { latitude: 0, longitude: 0 };
  const lat = parseFloat(l.latitude ?? l.lat ?? 0);
  const lng = parseFloat(l.longitude ?? l.lng ?? l.lon ?? 0);
  return { latitude: isNaN(lat) ? 0 : lat, longitude: isNaN(lng) ? 0 : lng };
}
function validLocOrUndef(l: any): GeoPoint | undefined {
  if (!l) return undefined;
  const g = normLoc(l);
  return g.latitude !== 0 || g.longitude !== 0 ? g : undefined;
}
function mapRow(r: any): ClockEntry {
  return {
    id: r.id,
    employeeId: r.employee_id,
    projectId: r.project_id,
    clockIn: r.clock_in,
    clockOut: r.clock_out ?? undefined,
    location: normLoc(r.location),
    clockOutLocation: validLocOrUndef(r.clock_out_location),
    workPerformed: r.work_performed ?? undefined,
    category: r.category ?? undefined,
    lunchBreaks: (r.lunch_breaks ?? []).map((lb: any) => ({
      startTime: lb.startTime ?? lb.start_time ?? lb.start ?? "",
      endTime: lb.endTime ?? lb.end_time ?? lb.end ?? "",
      startLocation: validLocOrUndef(lb.startLocation ?? lb.start_location),
      endLocation: validLocOrUndef(lb.endLocation ?? lb.end_location),
    })),
    hourlyRate: r.hourly_rate ?? undefined,
  };
}

function calcSummary(entries: ClockEntry[], rate: number) {
  let netMin = 0;
  entries.forEach((e) => {
    if (!e.clockOut) return;
    const gross = Math.max(0, (new Date(e.clockOut).getTime() - new Date(e.clockIn).getTime()) / 60_000);
    const lb = e.lunchBreaks?.[0];
    const breakMin = lb?.startTime && lb?.endTime
      ? Math.max(0, (new Date(lb.endTime).getTime() - new Date(lb.startTime).getTime()) / 60_000)
      : 0;
    netMin += Math.max(0, gross - breakMin);
  });
  const netHours = netMin / 60;
  return { sessions: entries.length, netHours, pay: netHours * rate };
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function TimeCardsHistoryScreen() {
  const { employeeId } = useLocalSearchParams<{ employeeId?: string }>();
  const { companyUsers: users } = useApp();
  const { width } = useWindowDimensions();

  // Breakpoints
  const isTablet  = width >= 640;
  const isDesktop = width >= 1024;

  // Responsive layout values
  const hPad      = isDesktop ? 40 : isTablet ? 24 : 16;
  const maxWidth  = isDesktop ? 960 : undefined;

  const employee = useMemo(() => users.find((u) => u.id === employeeId), [users, employeeId]);
  const displayName = employee?.name ?? "Employee";
  const rate = employee?.hourlyRate ?? 0;

  const [periodMode, setPeriodMode] = useState<PeriodMode>("Biweekly");
  const [allEntries, setAllEntries] = useState<ClockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!employeeId) return;
    setLoading(true);
    setPage(1);
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    supabase
      .from("clock_entries")
      .select("*")
      .eq("employee_id", employeeId)
      .gte("clock_in", twoYearsAgo.toISOString())
      .order("clock_in", { ascending: false })
      .then(({ data, error }) => {
        setAllEntries(!error && data ? data.map(mapRow) : []);
        setLoading(false);
      });
  }, [employeeId]);

  const byDay = useMemo(() => {
    const m = new Map<string, ClockEntry[]>();
    allEntries.forEach((e) => {
      const k = new Date(e.clockIn).toLocaleDateString("en-CA");
      m.set(k, [...(m.get(k) ?? []), e]);
    });
    return m;
  }, [allEntries]);

  const periodsWithData = useMemo((): PeriodSummary[] => {
    const periods = getAllPeriods(periodMode);
    const result: PeriodSummary[] = [];
    for (const p of periods) {
      const periodEntries = allEntries.filter((e) => {
        const t = new Date(e.clockIn).getTime();
        return t >= p.start.getTime() && t <= p.end.getTime();
      });
      if (periodEntries.length > 0) {
        result.push({ period: p, ...calcSummary(periodEntries, rate) });
      }
    }
    return result;
  }, [allEntries, periodMode, rate, byDay]);

  const displayed = periodsWithData.slice(0, page * PAGE_SIZE);
  const hasMore = displayed.length < periodsWithData.length;

  function handleView(summary: PeriodSummary) {
    router.push(
      `/admin/time-cards?employeeId=${employeeId}&periodStart=${encodeURIComponent(summary.period.start.toISOString())}&periodMode=${periodMode}`,
    );
  }

  // Card column width for 2-up grid on tablet+
  const gap = 12;
  const cardWidth = isTablet
    ? Math.floor((width - hPad * 2 - gap) / 2)
    : undefined;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: `${displayName} — History`,
          headerBackTitle: "Time Cards",
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingHorizontal: hPad, paddingBottom: 48 },
          maxWidth && { maxWidth, alignSelf: "center" as const, width: "100%" },
        ]}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={[styles.header, isDesktop && styles.headerDesktop]}>
          <View style={[styles.headerIcon, isDesktop && styles.headerIconDesktop]}>
            <History size={isDesktop ? 24 : 20} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, isDesktop && styles.headerTitleDesktop]}>
              Pay Period History
            </Text>
            <Text style={styles.headerSub}>{displayName}</Text>
          </View>
          {isTablet && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>
                {periodsWithData.length} period{periodsWithData.length !== 1 ? "s" : ""} with entries
              </Text>
            </View>
          )}
        </View>

        {/* ── Mode tabs ───────────────────────────────────────────────────── */}
        <View style={[styles.tabs, isDesktop && styles.tabsDesktop]}>
          {(["Weekly", "Biweekly", "Monthly"] as PeriodMode[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.tab, periodMode === m && styles.tabActive]}
              onPress={() => { setPeriodMode(m); setPage(1); }}
            >
              <Text style={[styles.tabText, periodMode === m && styles.tabTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator color="#2563EB" size="large" />
            <Text style={styles.loadingText}>Loading history…</Text>
          </View>
        )}

        {/* ── Empty ───────────────────────────────────────────────────────── */}
        {!loading && periodsWithData.length === 0 && (
          <View style={styles.center}>
            <Clock size={40} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No history found</Text>
            <Text style={styles.emptySub}>
              No clock entries found for {periodMode.toLowerCase()} periods in the past 2 years.
            </Text>
          </View>
        )}

        {/* ── Card grid ───────────────────────────────────────────────────── */}
        {!loading && periodsWithData.length > 0 && (
          <View style={[styles.cardGrid, isTablet && { flexDirection: "row", flexWrap: "wrap", gap }]}>
            {displayed.map((s, idx) => (
              <View
                key={s.period.start.toISOString()}
                style={[
                  styles.card,
                  cardWidth ? { width: cardWidth } : styles.cardFull,
                ]}
              >
                {/* Card top row */}
                <View style={styles.cardTop}>
                  <View style={styles.cardIndex}>
                    <Text style={styles.cardIndexText}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cardLabel} numberOfLines={2}>
                      {s.period.label}
                    </Text>
                    <Text style={styles.cardMode}>{periodMode}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.viewBtn}
                    onPress={() => handleView(s)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.viewBtnText}>View</Text>
                    <ChevronRight size={14} color="#2563EB" />
                  </TouchableOpacity>
                </View>

                {/* Card stats bar */}
                <View style={styles.cardStats}>
                  <View style={styles.stat}>
                    <Text style={[styles.statValue, isDesktop && styles.statValueLg]}>
                      {s.netHours.toFixed(2)}h
                    </Text>
                    <Text style={styles.statLabel}>Net Hours</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.stat}>
                    <Text style={[styles.statValue, isDesktop && styles.statValueLg]}>
                      {s.sessions}
                    </Text>
                    <Text style={styles.statLabel}>Sessions</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.stat}>
                    <Text style={[styles.statValue, { color: "#10B981" }, isDesktop && styles.statValueLg]}>
                      {rate > 0 ? `$${s.pay.toFixed(2)}` : "—"}
                    </Text>
                    <Text style={styles.statLabel}>Est. Pay</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Load More ───────────────────────────────────────────────────── */}
        {!loading && hasMore && (
          <TouchableOpacity
            style={[styles.loadMoreBtn, isTablet && styles.loadMoreBtnTablet]}
            onPress={() => setPage((p) => p + 1)}
            activeOpacity={0.75}
          >
            <ChevronDown size={16} color="#2563EB" />
            <Text style={styles.loadMoreText}>
              Load More ({periodsWithData.length - displayed.length} remaining)
            </Text>
          </TouchableOpacity>
        )}

        {/* ── End of list ─────────────────────────────────────────────────── */}
        {!loading && !hasMore && periodsWithData.length > 0 && (
          <Text style={styles.endText}>
            Showing all {periodsWithData.length} {periodMode.toLowerCase()} period
            {periodsWithData.length !== 1 ? "s" : ""} with entries
          </Text>
        )}

        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>← Back to Time Cards</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  scroll: { paddingTop: 20 },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  headerDesktop: { padding: 20 },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconDesktop: { width: 48, height: 48, borderRadius: 24 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  headerTitleDesktop: { fontSize: 18 },
  headerSub: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  headerBadge: {
    backgroundColor: "#EFF6FF",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  headerBadgeText: { fontSize: 12, fontWeight: "600", color: "#2563EB" },

  // ── Tabs ────────────────────────────────────────────────────────────────────
  tabs: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 4,
  },
  tabsDesktop: { alignSelf: "flex-start", minWidth: 320 },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 7,
    alignItems: "center",
  },
  tabActive: { backgroundColor: "#2563EB" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  tabTextActive: { color: "#FFFFFF" },

  // ── Empty / loading ─────────────────────────────────────────────────────────
  center: { alignItems: "center", paddingVertical: 72, gap: 12 },
  loadingText: { color: "#6B7280", fontSize: 14, marginTop: 8 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#374151" },
  emptySub: { fontSize: 13, color: "#9CA3AF", textAlign: "center", maxWidth: 300 },

  // ── Card grid ───────────────────────────────────────────────────────────────
  cardGrid: { gap: 10 },
  cardFull: { width: "100%" },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    // shadow for depth on desktop
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  cardIndex: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardIndexText: { fontSize: 12, fontWeight: "700", color: "#2563EB" },
  cardLabel: { fontSize: 14, fontWeight: "600", color: "#111827", lineHeight: 19 },
  cardMode: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },

  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    flexShrink: 0,
  },
  viewBtnText: { fontSize: 13, fontWeight: "600", color: "#2563EB" },

  cardStats: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    backgroundColor: "#FAFAFA",
  },
  stat: { flex: 1, alignItems: "center", paddingVertical: 11 },
  statValue: { fontSize: 14, fontWeight: "700", color: "#111827" },
  statValueLg: { fontSize: 16 },
  statLabel: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  statDivider: { width: 1, backgroundColor: "#E5E7EB", marginVertical: 8 },

  // ── Load more ───────────────────────────────────────────────────────────────
  loadMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
  },
  loadMoreBtnTablet: { alignSelf: "center", paddingHorizontal: 32 },
  loadMoreText: { fontSize: 14, fontWeight: "600", color: "#2563EB" },

  endText: {
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 13,
    paddingVertical: 16,
  },

  backLink: { paddingVertical: 20, alignItems: "center" },
  backLinkText: { color: "#6B7280", fontSize: 14 },
});
