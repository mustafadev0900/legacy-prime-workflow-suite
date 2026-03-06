import { View, StyleSheet } from 'react-native';
import SkeletonBox from '@/components/SkeletonBox';

export default function DashboardSkeleton() {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <SkeletonBox width={160} height={28} borderRadius={6} />
        <View style={styles.headerRight}>
          <SkeletonBox width={32} height={32} borderRadius={16} />
          <SkeletonBox width={32} height={32} borderRadius={16} style={{ marginLeft: 8 }} />
        </View>
      </View>

      {/* Filter chips */}
      <View style={styles.row}>
        <SkeletonBox width={100} height={32} borderRadius={16} />
        <SkeletonBox width={110} height={32} borderRadius={16} style={{ marginLeft: 8 }} />
        <SkeletonBox width={90} height={32} borderRadius={16} style={{ marginLeft: 8 }} />
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        {[0, 1, 2].map(i => (
          <View key={i} style={styles.statCard}>
            <SkeletonBox width={40} height={40} borderRadius={20} />
            <SkeletonBox width={60} height={20} borderRadius={4} style={{ marginTop: 10 }} />
            <SkeletonBox width={80} height={13} borderRadius={4} style={{ marginTop: 6 }} />
          </View>
        ))}
      </View>

      {/* Section title */}
      <SkeletonBox width={140} height={20} borderRadius={4} style={{ marginTop: 24, marginBottom: 12 }} />

      {/* Project cards */}
      {[0, 1, 2].map(i => (
        <View key={i} style={styles.projectCard}>
          <SkeletonBox width={64} height={64} borderRadius={10} />
          <View style={styles.projectInfo}>
            <SkeletonBox width="70%" height={16} borderRadius={4} />
            <SkeletonBox width="50%" height={13} borderRadius={4} style={{ marginTop: 8 }} />
            <SkeletonBox width="40%" height={13} borderRadius={4} style={{ marginTop: 6 }} />
          </View>
        </View>
      ))}

      {/* Chart placeholder */}
      <SkeletonBox width={140} height={20} borderRadius={4} style={{ marginTop: 28, marginBottom: 12 }} />
      <SkeletonBox height={160} borderRadius={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  projectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  projectInfo: {
    flex: 1,
  },
});
