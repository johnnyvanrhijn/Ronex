import React, { useState, useRef, useEffect } from 'react';
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
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Auto-focus email input after mount animation
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const isValidEmail = email.trim().length > 0 && email.includes('@');

  async function handleSendOtp() {
    if (!isValidEmail) return;

    setLoading(true);
    try {
      await signIn(email.trim().toLowerCase());
      router.push({
        pathname: '/(auth)/verify',
        params: { email: email.trim().toLowerCase() },
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : t('common.error');
      Alert.alert(t('common.error'), message);
    } finally {
      setLoading(false);
    }
  }

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
            className="text-display-lg text-content"
            accessibilityRole="header"
          >
            {t('auth.loginTitle')}
          </Text>

          <Text className="mt-2 text-body font-inter text-content-secondary">
            {t('auth.emailSubtext')}
          </Text>

          {/* Email input */}
          <View className="mt-8">
            <Text className="mb-2 text-small-caps uppercase text-content-secondary">
              {t('auth.emailLabel')}
            </Text>
            <TextInput
              ref={inputRef}
              className="h-14 rounded-input bg-surface px-4 text-body font-inter text-content"
              placeholder={t('auth.emailPlaceholder')}
              placeholderTextColor="#525252"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={handleSendOtp}
              editable={!loading}
              accessibilityLabel={t('auth.emailLabel')}
            />
          </View>
        </View>

        {/* Bottom button — thumb zone */}
        <View className="px-6 pb-4">
          <Pressable
            className={`h-14 items-center justify-center rounded-button ${
              isValidEmail && !loading
                ? 'bg-primary active:bg-primary-dark'
                : 'bg-surface-elevated'
            }`}
            onPress={handleSendOtp}
            disabled={!isValidEmail || loading}
            accessibilityLabel={t('auth.sendMagicLink')}
            accessibilityRole="button"
            accessibilityState={{ disabled: !isValidEmail || loading }}
          >
            {loading ? (
              <ActivityIndicator color="#0A0A0A" />
            ) : (
              <Text
                className={`text-body font-inter-semibold ${
                  isValidEmail ? 'text-background' : 'text-content-muted'
                }`}
              >
                {t('auth.sendMagicLink')}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
