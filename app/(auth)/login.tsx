import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { auth } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Logo from '@/components/Logo';
import * as WebBrowser from 'expo-web-browser';
import { Phone } from 'lucide-react-native';
import Svg, { Path, G, ClipPath, Defs } from 'react-native-svg';

export default function LoginScreen() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSocialLoading, setIsSocialLoading] = useState<boolean>(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState<boolean>(false);
  const { setUser, setCompany } = useApp();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // Listen to keyboard events
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  const handleLogin = async () => {
    // Validation
    if (!email.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Error\n\nPlease enter your email address');
      } else {
        Alert.alert('Error', 'Please enter your email address');
      }
      return;
    }

    if (!password) {
      if (Platform.OS === 'web') {
        window.alert('Error\n\nPlease enter your password');
      } else {
        Alert.alert('Error', 'Please enter your password');
      }
      return;
    }

    setIsLoading(true);

    try {
      console.log('[Login] Attempting login for:', email);

      const result = await auth.signIn(email.toLowerCase().trim(), password);

      if (!result.success) {
        if (Platform.OS === 'web') {
          window.alert(`Login Failed\n\n${result.error || 'Invalid email or password'}`);
        } else {
          Alert.alert('Login Failed', result.error || 'Invalid email or password');
        }
        return;
      }

      console.log('[Login] Login successful');
      console.log('[Login] User:', result.user?.name);
      console.log('[Login] Company:', result.user?.companies?.name);

      // Update app context with user and company data
      if (result.user) {
        setUser({
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          companyId: result.user.company_id || '',
          isActive: result.user.is_active,
          createdAt: result.user.created_at,
          phone: result.user.phone || undefined,
          address: result.user.address || undefined,
          hourlyRate: result.user.hourly_rate || undefined,
          avatar: result.user.avatar || undefined,
          customPermissions: result.user.custom_permissions || undefined,
        });

        // @ts-ignore - companies is joined in the query
        if (result.user.companies) {
          // @ts-ignore
          const companyData = result.user.companies;
          setCompany({
            id: companyData.id,
            name: companyData.name,
            brandColor: companyData.brand_color,
            subscriptionStatus: companyData.subscription_status,
            subscriptionPlan: companyData.subscription_plan,
            subscriptionStartDate: companyData.subscription_start_date,
            employeeCount: companyData.employee_count,
            companyCode: companyData.company_code,
            settings: companyData.settings,
            createdAt: companyData.created_at,
            updatedAt: companyData.updated_at,
            logo: companyData.logo || undefined,
            licenseNumber: companyData.license_number || undefined,
            officePhone: companyData.office_phone || undefined,
            cellPhone: companyData.cell_phone || undefined,
            address: companyData.address || undefined,
            email: companyData.email || undefined,
            website: companyData.website || undefined,
            slogan: companyData.slogan || undefined,
            estimateTemplate: companyData.estimate_template || undefined,
            subscriptionEndDate: companyData.subscription_end_date || undefined,
            stripePaymentIntentId: companyData.stripe_payment_intent_id || undefined,
            stripeCustomerId: companyData.stripe_customer_id || undefined,
            stripeSubscriptionId: companyData.stripe_subscription_id || undefined,
          });
        }
      }

      // On web, reload the page to trigger data loading with the new company
      // This fixes the issue where tRPC dynamic imports don't work in production builds
      if (Platform.OS === 'web') {
        console.log('[Login] Reloading page to load company data...');
        window.location.href = '/(tabs)/dashboard';
      } else {
        // Navigate to dashboard on native
        router.replace('/(tabs)/dashboard');
      }
    } catch (error: any) {
      console.error('[Login] Error:', error);
      if (Platform.OS === 'web') {
        window.alert(error.message || 'An unexpected error occurred');
      } else {
        Alert.alert(t('common.error'), error.message || 'An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };



  const handleOAuthLogin = async (provider: 'google' | 'apple') => {
    setIsSocialLoading(true);
    try {
      const result = await auth.signInWithOAuth(provider);
      if (!result.success || !result.url) {
        Alert.alert('Error', result.error || 'OAuth login failed');
        return;
      }
      if (Platform.OS === 'web') {
        window.location.href = result.url;
      } else {
        const redirectUrl = process.env.EXPO_PUBLIC_API_URL
          ? `${process.env.EXPO_PUBLIC_API_URL}/auth/callback`
          : 'https://legacy-prime-workflow-suite.vercel.app/auth/callback';
        const browserResult = await WebBrowser.openAuthSessionAsync(result.url, redirectUrl);
        if (browserResult.type === 'success') {
          // onAuthStateChange in _layout.tsx will detect the new session
          router.replace('/(tabs)/dashboard');
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An unexpected error occurred');
    } finally {
      setIsSocialLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        {!isKeyboardVisible && (
          <View style={styles.languageSwitcherContainer}>
            <LanguageSwitcher />
          </View>
        )}

        <View style={styles.header}>
          <Logo size={100} />
          <Text style={styles.title}>Legacy Prime</Text>
          <Text style={styles.subtitle}>{t('login.subtitle')}</Text>
        </View>

        <View style={styles.form}>

          <TextInput
            style={styles.input}
            placeholder={t('login.emailPlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder={t('login.passwordPlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.forgotPasswordButton}
            onPress={() => router.push('/(auth)/forgot-password')}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.loginButtonText}>{t('login.loginButton')}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Phone Login */}
          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => router.push('/(auth)/phone-login')}
            disabled={isSocialLoading}
          >
            <View style={styles.socialButtonInner}>
              <Phone size={20} color="#1F2937" strokeWidth={2} />
              <Text style={styles.socialButtonText}>Continue with Phone</Text>
            </View>
          </TouchableOpacity>

          {/* Google Login */}
          <TouchableOpacity
            style={[styles.socialButton, isSocialLoading && styles.socialButtonDisabled]}
            onPress={() => handleOAuthLogin('google')}
            disabled={isSocialLoading}
          >
            {isSocialLoading ? (
              <ActivityIndicator color="#1F2937" />
            ) : (
              <View style={styles.socialButtonInner}>
                {/* Official Google "G" logo */}
                <Svg width={20} height={20} viewBox="0 0 48 48">
                  <Defs>
                    <ClipPath id="g">
                      <Path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" />
                    </ClipPath>
                  </Defs>
                  <G>
                    <Path fill="#FBBC05" d="M0 37V11l17 13z" />
                    <Path fill="#EA4335" d="M0 11l17 13 7-6.1L48 14V0H0z" />
                    <Path fill="#34A853" d="M0 37l30-23 7.9 1L48 0v48H0z" />
                    <Path fill="#4285F4" d="M48 48L17 24l-4-3 35-10z" />
                  </G>
                </Svg>
                <Text style={styles.socialButtonText}>Continue with Google</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Apple Login — only show on iOS and web */}
          {Platform.OS !== 'android' && (
            <TouchableOpacity
              style={[styles.socialButton, styles.appleButton, isSocialLoading && styles.appleButtonDisabled]}
              onPress={() => handleOAuthLogin('apple')}
              disabled={isSocialLoading}
            >
              {isSocialLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.socialButtonInner}>
                  {/* Official Apple logo */}
                  <Svg width={18} height={22} viewBox="0 0 814 1000">
                    <Path
                      fill="#FFFFFF"
                      d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 405.8 1 326.8 1 251.4c0-141.9 92.4-216.7 182.5-216.7 49.3 0 90.5 32.3 121.6 32.3 29.9 0 77.2-34.5 134.2-34.5 27.4 0 121.5 2.6 190.4 103.8zm-162.5-153.4c27.4-34.5 46.4-82.5 46.4-130.5 0-6.5-.6-13-1.3-19.5-44.1 1.6-97 29.9-128.8 68.7-23.4 26.7-46.4 74.7-46.4 123.1 0 6.5 1.3 13 1.9 15.6 2.6.6 6.5 1.3 10.4 1.3 39.9 0 90.5-26.8 117.8-58.7z"
                    />
                  </Svg>
                  <Text style={[styles.socialButtonText, styles.appleButtonText]}>Continue with Apple</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.signupContainer}>
            <Text style={styles.noAccountText}>{t('login.noAccount')} </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
              <Text style={styles.signupText}>{t('login.signUp')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  languageSwitcherContainer: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
  },
  form: {
    width: '100%',
  },
  socialButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  socialButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  appleButton: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  appleButtonText: {
    color: '#FFFFFF',
  },
  socialButtonDisabled: {
    opacity: 0.5,
  },
  appleButtonDisabled: {
    opacity: 0.5,
  },
  loginButtonDisabled: {
    opacity: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500' as const,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 12,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 4,
    marginTop: -4,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#2563EB',
  },
  loginButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  noAccountText: {
    fontSize: 15,
    color: '#6B7280',
  },
  signupText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  createAccountText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#2563EB',
    textAlign: 'center',
  },
});
