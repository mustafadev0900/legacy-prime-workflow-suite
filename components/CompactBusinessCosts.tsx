import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Briefcase } from 'lucide-react-native';
import { useMemo } from 'react';
import type { Expense } from '@/types';

interface Props {
  expenses: Expense[];
  hoursWorked?: number;
  onDetails?: () => void;
}

export default function CompactBusinessCosts({ expenses, hoursWorked = 0, onDetails }: Props) {
  const businessExpenses = useMemo(
    () => expenses.filter(e => e.isCompanyCost),
    [expenses]
  );

  const now = new Date();
  const thisMonthTotal = useMemo(() => {
    return businessExpenses
      .filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, e) => sum + e.amount, 0);
  }, [businessExpenses]);

  // Rolling 6-month average
  const overheadPerMonth = useMemo(() => {
    if (businessExpenses.length === 0) return 0;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recent = businessExpenses.filter(e => new Date(e.date) >= sixMonthsAgo);
    if (recent.length === 0) return 0;
    const total = recent.reduce((sum, e) => sum + e.amount, 0);
    return total / 6;
  }, [businessExpenses]);

  // Minimum monthly spend
  const minMonthly = useMemo(() => {
    if (businessExpenses.length === 0) return 0;
    const byMonth: Record<string, number> = {};
    businessExpenses.forEach(e => {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      byMonth[key] = (byMonth[key] || 0) + e.amount;
    });
    const months = Object.values(byMonth);
    return months.length > 0 ? Math.min(...months) : 0;
  }, [businessExpenses]);

  // Recommended rate = overhead/mo ÷ hours worked this month
  const recRate = useMemo(() => {
    if (hoursWorked <= 0 || overheadPerMonth <= 0) return 0;
    return overheadPerMonth / hoursWorked;
  }, [overheadPerMonth, hoursWorked]);

  const fmt = (n: number) =>
    n === 0 ? '$0' : `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Briefcase size={18} color="#FFFFFF" />
        </View>
        <Text style={styles.title}>Business Costs</Text>
        {onDetails && (
          <TouchableOpacity onPress={onDetails} style={styles.detailsBtn}>
            <Text style={styles.detailsText}>Details →</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.grid}>
        <View style={styles.metric}>
          <View style={[styles.dot, { backgroundColor: '#2563EB' }]} />
          <Text style={styles.metricLabel}>This Month</Text>
          <Text style={styles.metricValue}>{fmt(thisMonthTotal)}</Text>
        </View>
        <View style={styles.metric}>
          <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.metricLabel}>Overhead/mo</Text>
          <Text style={styles.metricValue}>{fmt(overheadPerMonth)}</Text>
        </View>
        <View style={styles.metric}>
          <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
          <Text style={styles.metricLabel}>Min. Monthly</Text>
          <Text style={styles.metricValue}>{fmt(minMonthly)}</Text>
        </View>
        <View style={styles.metric}>
          <View style={[styles.dot, { backgroundColor: '#7C3AED' }]} />
          <Text style={styles.metricLabel}>Rec. Rate</Text>
          <Text style={[styles.metricValue, { color: '#7C3AED' }]}>
            {recRate > 0 ? `$${recRate.toFixed(0)}/hr` : '$0/hr'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E3A5F',
    flex: 1,
  },
  detailsBtn: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  detailsText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metric: {
    width: '47%',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 3,
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
  },
});
