import React from 'react';
import { View, Text, Pressable, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/lib/theme';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert(
      t('auth.signOut'),
      t('auth.signOutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('auth.signOut'),
          style: 'destructive',
          onPress: () => {
            signOut();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <StatusBar barStyle="light-content" />
      <View className="flex-1 items-center justify-center px-6">
        <Text className="font-inter-bold text-heading text-content">
          {t('navigation.profile')}
        </Text>
        <Text className="font-inter text-body text-content-secondary mt-2">
          {t('home.comingSoon')}
        </Text>

        <Pressable
          className="mt-8 bg-surface border border-surface-elevated rounded-button px-6 py-4 min-h-[48px] items-center justify-center active:opacity-80"
          onPress={handleSignOut}
          accessibilityLabel={t('auth.signOut')}
          accessibilityRole="button"
        >
          <Text
            className="font-inter-semibold text-body"
            style={{ color: colors.danger }}
          >
            {t('auth.signOut')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
