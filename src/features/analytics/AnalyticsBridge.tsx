import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { usePathname } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { analyticsClient, bindAnalytics, refreshAnalyticsPreference, trackAnalytics } from './analytics-service';

export function AnalyticsBridge() {
  const userId = useAuth().user?.id;
  const pathname = usePathname();
  const route = useRef(pathname);
  useEffect(() => { route.current = pathname; }, [pathname]);
  useEffect(() => {
    void bindAnalytics(userId).then((current) => {
      if (!current) return;
      analyticsClient.setForeground(AppState.currentState === 'active');
      trackAnalytics('screen_view');
      if (/^\/media\//.test(route.current)) trackAnalytics('media_detail_opened');
      void analyticsClient.flush();
    });
    return () => { void bindAnalytics(undefined); };
  }, [userId]);
  useEffect(() => {
    trackAnalytics('screen_view');
    if (/^\/media\//.test(pathname)) trackAnalytics('media_detail_opened');
    if (pathname === '/shared-lists') trackAnalytics('shared_list_used');
  }, [pathname]);
  useEffect(() => {
    if (!userId) return;
    const listener = AppState.addEventListener('change', (state) => {
      analyticsClient.setForeground(state === 'active');
      if (state === 'active') void refreshAnalyticsPreference(userId);
      void analyticsClient.flush();
    });
    const timer = setInterval(() => { analyticsClient.heartbeat(); void analyticsClient.flush(); }, 60_000);
    return () => { listener.remove(); clearInterval(timer); };
  }, [userId]);
  return null;
}
