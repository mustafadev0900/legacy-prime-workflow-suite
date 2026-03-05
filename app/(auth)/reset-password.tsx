import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { ArrowLeft, CheckCircle, Eye, EyeOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import Logo from '@/components/Logo';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const setupSession = async () => {
      // On web: extract tokens from the URL hash manually and call setSession
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        if (accessToken && refreshToken && type === 'recovery') {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            setSessionError('This reset link has expired or already been used. Please request a new one.');
          } else {
            setSessionReady(true);
            // Clean the hash from the URL without triggering navigation
            window.history.replaceState(null, '', window.location.pathname);
          }
          return;
        }
      }

      // Native or fallback: listen for PASSWORD_RECOVERY event
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
          setSessionReady(true);
        }
      });

      // Check existing session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setSessionReady(true);

      return () => subscription.unsubscribe();
    };

    setupSession();
  }, []);

  const validate = (): boolean => {
    const newErrors: { password?: string; confirm?: string } = {};

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    } else if (!/[A-Z]/.test(password) && !/[0-9]/.test(password)) {
      newErrors.password = 'Use a mix of letters and numbers for a stronger password';
    }

    if (!confirmPassword) {
      newErrors.confirm = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirm = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleReset = async () => {
    if (!validate()) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        const msg = error.message?.toLowerCase() ?? '';
        if (msg.includes('same') || msg.includes('different')) {
          setErrors({ password: 'New password must be different from your current password' });
        } else if (msg.includes('weak') || msg.includes('strong')) {
          setErrors({ password: 'Password is too weak. Use at least 6 characters with letters and numbers' });
        } else {
          setErrors({ password: error.message });
        }
        return;
      }
      await supabase.auth.signOut();
      setIsDone(true);
    } catch (e: any) {
      setErrors({ password: e.message || 'Failed to reset password. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(auth)/login')}>
        <ArrowLeft size={24} color="#2563EB" />
      </TouchableOpacity>

      <View style={styles.header}>
        <Logo size={80} />
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          {isDone ? 'Your password has been updated.' : 'Enter your new password below.'}
        </Text>
      </View>

      {isDone ? (
        <View style={styles.successContainer}>
          <CheckCircle size={64} color="#16A34A" strokeWidth={1.5} />
          <Text style={styles.successText}>Password updated successfully!</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.buttonText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      ) : sessionError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.sessionErrorText}>{sessionError}</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/(auth)/forgot-password')}>
            <Text style={styles.buttonText}>Request New Link</Text>
          </TouchableOpacity>
        </View>
      ) : !sessionReady ? (
        <View style={styles.waitingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.waitingText}>Verifying reset link...</Text>
        </View>
      ) : (
        <View style={styles.form}>
          {/* New password */}
          <Text style={styles.label}>New Password</Text>
          <View style={[styles.inputWrapper, errors.password ? styles.inputError : null]}>
            <TextInput
              style={styles.input}
              placeholder="Enter new password"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={(v) => { setPassword(v); setErrors(e => ({ ...e, password: undefined })); }}
              secureTextEntry={!showPassword}
              autoFocus
            />
            <TouchableOpacity onPress={() => setShowPassword(s => !s)} style={styles.eyeButton}>
              {showPassword ? <EyeOff size={20} color="#6B7280" /> : <Eye size={20} color="#6B7280" />}
            </TouchableOpacity>
          </View>
          {errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}

          {/* Confirm password */}
          <Text style={[styles.label, { marginTop: 16 }]}>Confirm Password</Text>
          <View style={[styles.inputWrapper, errors.confirm ? styles.inputError : null]}>
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor="#9CA3AF"
              value={confirmPassword}
              onChangeText={(v) => { setConfirmPassword(v); setErrors(e => ({ ...e, confirm: undefined })); }}
              secureTextEntry={!showConfirm}
            />
            <TouchableOpacity onPress={() => setShowConfirm(s => !s)} style={styles.eyeButton}>
              {showConfirm ? <EyeOff size={20} color="#6B7280" /> : <Eye size={20} color="#6B7280" />}
            </TouchableOpacity>
          </View>
          {errors.confirm && <Text style={styles.fieldError}>{errors.confirm}</Text>}

          <TouchableOpacity
            style={[styles.button, { marginTop: 28 }, isLoading && styles.buttonDisabled]}
            onPress={handleReset}
            disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Set New Password</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 24 },
  backButton: { marginBottom: 32 },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: '#1F2937', marginTop: 16 },
  subtitle: { fontSize: 15, color: '#6B7280', marginTop: 8, textAlign: 'center' },
  form: { width: '100%' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
  },
  inputError: { borderColor: '#EF4444' },
  input: { flex: 1, paddingVertical: 16, fontSize: 16, color: '#1F2937' },
  eyeButton: { padding: 4 },
  fieldError: { fontSize: 12, color: '#EF4444', marginTop: 4, marginBottom: 2 },
  button: { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  successContainer: { alignItems: 'center', gap: 16, marginTop: 16 },
  successText: { fontSize: 18, fontWeight: '600', color: '#16A34A', textAlign: 'center' },
  waitingContainer: { alignItems: 'center', gap: 16, marginTop: 40 },
  waitingText: { fontSize: 15, color: '#6B7280' },
  errorContainer: { alignItems: 'center', gap: 20, marginTop: 16, paddingHorizontal: 8 },
  sessionErrorText: { fontSize: 15, color: '#DC2626', textAlign: 'center', lineHeight: 22 },
});
