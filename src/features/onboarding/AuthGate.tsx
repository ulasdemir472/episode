import { PropsWithChildren, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import type { Href } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfileStore } from '@/store/profile-store';
import { colors } from '@/theme/tokens';
import { OnboardingTutorial } from './OnboardingTutorial';

export function AuthGate({ children }: PropsWithChildren) {
  const auth = useAuth();
  const pathname = usePathname();
  const hasSeenTutorial = useProfileStore((state) => state.hasSeenTutorial);
  const completeTutorial = useProfileStore((state) => state.completeTutorial);
  const isAuthRoute = pathname === '/auth' || pathname === '/reset-password';

  useEffect(() => {
    if (!auth.loading && !auth.user && !isAuthRoute) {
      router.replace('/auth' as Href);
    }
  }, [auth.loading, auth.user, isAuthRoute]);

  if (auth.loading || (!auth.user && !isAuthRoute)) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.primary} /></View>;
  }

  return <>
    {children}
    {auth.user && !hasSeenTutorial && !isAuthRoute ? <OnboardingTutorial onFinish={completeTutorial} /> : null}
  </>;
}
