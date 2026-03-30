import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import { useApp } from '@/contexts/AppContext';

export default function FloatingChatButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { unreadChatCount, user } = useApp();

  const isOnChatScreen = pathname === '/chat';
  const isOnAuthScreen = pathname?.includes('/login') || pathname?.includes('/subscription') || pathname?.includes('/signup') || pathname?.includes('/(auth)');

  if (isOnChatScreen || isOnAuthScreen || !user) {
    return null;
  }

  return (
    <TouchableOpacity
      style={styles.floatingButton}
      onPress={() => router.push('/chat')}
      activeOpacity={0.85}
    >
      {/* Glow ring */}
      <View style={styles.glowRing} />

      <MessageCircle size={22} color="#FFFFFF" strokeWidth={2.5} />
      <Text style={styles.label}>Chat</Text>

      {unreadChatCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadChatCount > 99 ? '99+' : unreadChatCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute' as const,
    bottom: 90,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 30,
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 997,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  glowRing: {
    position: 'absolute' as const,
    inset: -3,
    borderRadius: 33,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.3)',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
  },
  badge: {
    position: 'absolute' as const,
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
