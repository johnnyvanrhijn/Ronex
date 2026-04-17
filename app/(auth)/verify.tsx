import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { Ionicons } from '@expo/vector-icons';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function VerifyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { verifyOtp, signIn } = useAuth();

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Auto-focus first input
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const otpString = otp.join('');
  const isComplete = otpString.length === OTP_LENGTH;

  const handleChange = useCallback(
    (text: string, index: number) => {
      // Handle paste of full code
      if (text.length > 1) {
        const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH).split('');
        const newOtp = [...otp];
        digits.forEach((digit, i) => {
          if (index + i < OTP_LENGTH) {
            newOtp[index + i] = digit;
          }
        });
        setOtp(newOtp);
        const nextIndex = Math.min(index + digits.length, OTP_LENGTH - 1);
        setActiveIndex(nextIndex);
        inputRefs.current[nextIndex]?.focus();
        return;
      }

      const newOtp = [...otp];
      newOtp[index] = text.replace(/\D/g, '');
      setOtp(newOtp);

      if (text && index < OTP_LENGTH - 1) {
        setActiveIndex(index + 1);
        inputRefs.current[index + 1]?.focus();
      }
    },
    [otp],
  );

  const handleKeyPress = useCallback(
    (key: string, index: number) => {
      if (key === 'Backspace' && !otp[index] && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        setActiveIndex(index - 1);
        inputRefs.current[index - 1]?.focus();
      }
    },
    [otp],
  );

  async function handleVerify() {
    if (!isComplete || !email) return;

    setLoading(true);
    try {
      await verifyOtp(email, otpString);
      // Navigation happens automatically via auth state listener
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : t('auth.otpInvalid');
      Alert.alert(t('common.error'), message);
      // Reset OTP on error
      setOtp(Array(OTP_LENGTH).fill(''));
      setActiveIndex(0);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendTimer > 0 || !email) return;

    try {
      await signIn(email);
      setResendTimer(RESEND_COOLDOWN);
      setOtp(Array(OTP_LENGTH).fill(''));
      setActiveIndex(0);
      inputRefs.current[0]?.focus();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : t('common.error');
      Alert.alert(t('common.error'), message);
    }
  }

  // Auto-submit when all digits are entered
  useEffect(() => {
    if (isComplete && !loading) {
      handleVerify();
    }
  }, [isComplete]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header with back button */}
        <View className="px-4 pt-2">
          <Pressable
            className="h-11 w-11 items-center justify-center rounded-full active:bg-surface"
            onPress={() => router.back()}
            accessibilityLabel={t('common.back')}
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={24} color="#FAFAFA" />
          </Pressable>
        </View>

        {/* Content */}
        <View className="flex-1 px-6 pt-8">
          <Text
            className="font-inter-bold text-display text-content"
            accessibilityRole="header"
          >
            {t('auth.otpSentTitle')}
          </Text>

          <Text className="mt-2 text-body font-inter text-content-secondary">
            {t('auth.otpSentTo', { email: email ?? '' })}
          </Text>

          {/* OTP input boxes */}
          <View className="mt-10 flex-row justify-between">
            {Array.from({ length: OTP_LENGTH }).map((_, index) => {
              const isFilled = otp[index] !== '';
              const isActive = activeIndex === index;

              return (
                <View
                  key={index}
                  className={`h-[60px] w-[48px] items-center justify-center rounded-input ${
                    isFilled
                      ? 'border-2 border-primary bg-surface'
                      : isActive
                        ? 'border-2 border-primary/50 bg-surface'
                        : 'border border-surface-elevated bg-surface'
                  }`}
                >
                  <TextInput
                    ref={(ref) => {
                      inputRefs.current[index] = ref;
                    }}
                    className="h-full w-full text-center font-inter-bold text-content"
                    style={{ fontSize: 24, lineHeight: 28 }}
                    value={otp[index]}
                    onChangeText={(text) => handleChange(text, index)}
                    onKeyPress={({ nativeEvent }) =>
                      handleKeyPress(nativeEvent.key, index)
                    }
                    onFocus={() => setActiveIndex(index)}
                    keyboardType="number-pad"
                    maxLength={OTP_LENGTH}
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                    editable={!loading}
                    selectTextOnFocus
                    accessibilityLabel={`${t('auth.otpPlaceholder')} ${index + 1}`}
                  />
                </View>
              );
            })}
          </View>

          {/* Resend link */}
          <Pressable
            className="mt-6 self-start"
            onPress={handleResend}
            disabled={resendTimer > 0}
            accessibilityLabel={
              resendTimer > 0
                ? t('auth.resendCodeIn', { seconds: resendTimer })
                : t('auth.resendCode')
            }
            accessibilityRole="button"
          >
            <Text
              className={`text-label font-inter-medium ${
                resendTimer > 0 ? 'text-content-muted' : 'text-primary'
              }`}
            >
              {resendTimer > 0
                ? t('auth.resendCodeIn', { seconds: resendTimer })
                : t('auth.resendCode')}
            </Text>
          </Pressable>
        </View>

        {/* Bottom button — thumb zone */}
        <View className="px-6 pb-4">
          <Pressable
            className={`h-14 items-center justify-center rounded-button ${
              isComplete && !loading
                ? 'bg-primary active:bg-primary-dark'
                : 'bg-surface-elevated'
            }`}
            onPress={handleVerify}
            disabled={!isComplete || loading}
            accessibilityLabel={t('auth.verifyCode')}
            accessibilityRole="button"
            accessibilityState={{ disabled: !isComplete || loading }}
          >
            {loading ? (
              <ActivityIndicator color="#0A0A0A" />
            ) : (
              <Text
                className={`text-subheading font-inter-semibold ${
                  isComplete ? 'text-background' : 'text-content-muted'
                }`}
              >
                {t('auth.verifyCode')}
              </Text>
            )}
          </Pressable>

          {/* Different email link */}
          <Pressable
            className="mt-3 h-12 items-center justify-center"
            onPress={() => router.back()}
            accessibilityLabel={t('auth.tryDifferentEmail')}
            accessibilityRole="button"
          >
            <Text className="text-label font-inter-medium text-content-secondary">
              {t('auth.tryDifferentEmail')}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
