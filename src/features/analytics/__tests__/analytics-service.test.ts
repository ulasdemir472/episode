import AsyncStorage from '@react-native-async-storage/async-storage';
import { bindAnalytics, refreshAnalyticsPreference, setAnalyticsPreference, useAnalyticsState } from '../analytics-service';
import { requireSupabase } from '@/infrastructure/supabase/client';
jest.mock('@/infrastructure/supabase/client', () => ({ requireSupabase: jest.fn() }));

it('preserves an offline opt-out across refresh and restart until the server confirms it', async () => {
  await AsyncStorage.clear();
  let offline = false;
  const invoke = jest.fn(async (_name: string, options: { body: { operation: string; enabled?: boolean } }) => {
    if (options.body.operation === 'preference' && !options.body.enabled) return offline ? { error: new Error('offline'), data: null } : { error: null, data: { enabled: false } };
    return { error: null, data: { enabled: true } };
  });
  jest.mocked(requireSupabase).mockReturnValue({ functions: { invoke } } as unknown as ReturnType<typeof requireSupabase>);
  await bindAnalytics('alice'); expect(useAnalyticsState.getState().enabled).toBe(true);
  offline = true; await setAnalyticsPreference(false);
  expect(useAnalyticsState.getState()).toMatchObject({ enabled: false, pendingDisable: true });
  await refreshAnalyticsPreference('alice');
  expect(useAnalyticsState.getState().enabled).toBe(false);
  await bindAnalytics(undefined); await bindAnalytics('alice');
  expect(useAnalyticsState.getState()).toMatchObject({ enabled: false, pendingDisable: true });
  offline = false; await refreshAnalyticsPreference('alice');
  expect(useAnalyticsState.getState()).toMatchObject({ enabled: false, pendingDisable: false });
  expect(await AsyncStorage.getItem('episode.analytics.pending-disable.alice')).toBeNull();
  await bindAnalytics(undefined);
});
