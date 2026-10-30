import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/theme/tokens';
import { shouldRetryExternalApiError } from '@/services/external-api-error';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { AuthGate } from '@/features/onboarding/AuthGate';
import { NotificationBridge } from '@/services/notifications';
import { UpdatePrompt } from '@/components/UpdatePrompt';

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
  return <SafeAreaProvider><QueryClientProvider client={queryClient}><AuthProvider><NotificationBridge /><UpdatePrompt /><AuthGate><StatusBar style="light" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }}><Stack.Screen name="(tabs)" /><Stack.Screen name="media/[id]" options={{ presentation: 'card', animation: 'slide_from_right' }} /><Stack.Screen name="person/[id]" options={{ animation: 'slide_from_right' }} /><Stack.Screen name="profile/[id]" options={{ animation: 'slide_from_right' }} /><Stack.Screen name="profile-activities" options={{ animation: 'slide_from_right' }} /><Stack.Screen name="friends" options={{ animation: 'slide_from_right' }} /><Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} /><Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} /><Stack.Screen name="privacy" options={{ animation: 'slide_from_right' }} /><Stack.Screen name="shared-lists" options={{ animation: 'slide_from_right' }} /><Stack.Screen name="friends-activity" options={{ animation: 'slide_from_right' }} /><Stack.Screen name="watch-wheel" options={{ animation: 'slide_from_right' }} /><Stack.Screen name="auth" options={{ animation: 'fade' }} /><Stack.Screen name="reset-password" options={{ animation: 'slide_from_right' }} /></Stack></AuthGate></AuthProvider></QueryClientProvider></SafeAreaProvider>;
}
