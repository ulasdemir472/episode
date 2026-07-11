import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/theme/tokens';
import { shouldRetryExternalApiError } from '@/services/external-api-error';
import { AuthProvider } from '@/features/auth/AuthProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 60_000,
      gcTime: 24 * 60 * 60_000,
      refetchOnMount: false,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
      retry: shouldRetryExternalApiError,
      retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 10_000),
    },
  },
});
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });

export default function RootLayout() {
  useEffect(() => { Notifications.setBadgeCountAsync(0).catch(() => undefined); }, []);
  return <SafeAreaProvider><QueryClientProvider client={queryClient}><AuthProvider><StatusBar style="light" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }}><Stack.Screen name="(tabs)" /><Stack.Screen name="media/[id]" options={{ presentation: 'card', animation: 'slide_from_right' }} /><Stack.Screen name="auth" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} /></Stack></AuthProvider></QueryClientProvider></SafeAreaProvider>;
}
