import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Pressable } from 'react-native';
import { CheckCircle2, XCircle } from 'lucide-react-native';

export type DownloadResult = { status: 'success' | 'error'; message: string } | null;

interface Props {
  result: DownloadResult;
  onDismiss: () => void;
  autoDismissMs?: number;
}

// Renders as a positioned overlay (not a native Modal) so it layers reliably
// above a parent Modal on iOS — React Native's Modal cannot present over another
// Modal while that Modal is still mounted. Must be rendered *inside* the parent
// Modal's content tree.
export function DownloadResultModal({ result, onDismiss, autoDismissMs = 1800 }: Props) {
  useEffect(() => {
    if (result?.status === 'success' && autoDismissMs > 0) {
      const timer = setTimeout(onDismiss, autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [result, autoDismissMs, onDismiss]);

  if (!result) return null;

  const isSuccess = result.status === 'success';

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      <View style={styles.card}>
        {isSuccess ? (
          <CheckCircle2 size={56} color="#10B981" />
        ) : (
          <XCircle size={56} color="#EF4444" />
        )}
        <Text style={styles.title}>
          {isSuccess ? 'Download Complete' : 'Download Failed'}
        </Text>
        <Text style={styles.message}>{result.message}</Text>
        <TouchableOpacity
          style={[styles.button, isSuccess ? styles.buttonSuccess : styles.buttonError]}
          onPress={onDismiss}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>{isSuccess ? 'Done' : 'Dismiss'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 9999,
    ...Platform.select({
      web: { position: 'fixed' as any },
      default: {},
    }),
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    ...Platform.select({
      web: { boxShadow: '0 10px 30px rgba(0,0,0,0.25)' as any },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 12,
      },
    }),
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 14,
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  buttonSuccess: { backgroundColor: '#10B981' },
  buttonError: { backgroundColor: '#EF4444' },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
