import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/theme/tokens';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60_000, retry: 2 } } });
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });

export default function RootLayout() {
  useEffect(() => { Notifications.setBadgeCountAsync(0).catch(() => undefined); }, []);
  return <SafeAreaProvider><QueryClientProvider client={queryClient}><StatusBar style="light" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }}><Stack.Screen name="(tabs)" /><Stack.Screen name="media/[id]" options={{ presentation: 'card' }} /></Stack></QueryClientProvider></SafeAreaProvider>;
}

