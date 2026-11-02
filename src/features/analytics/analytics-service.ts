import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { AnalyticsEventName } from '@/domain/analytics';
import { requireSupabase } from '@/infrastructure/supabase/client';
import { AnalyticsClient } from './analytics-client';

export const useAnalyticsState = create<{ userId?: string; enabled: boolean; ready: boolean; saving: boolean; error: boolean; pendingDisable: boolean }>(() => ({ enabled: false, ready: false, saving: false, error: false, pendingDisable: false }));
let binding = 0;
let preferenceVersion = 0;
const disableKey = (userId: string) => `episode.analytics.pending-disable.${userId}`;
async function request(userId: string, body: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const result = await requireSupabase().functions.invoke('analytics', { body: { ...body, account_id: userId }, signal: controller.signal });
    if (result.error || !result.data) throw new Error('Analytics unavailable');
    return result.data;
  } finally { clearTimeout(timeout); }
}
export const analyticsClient = new AnalyticsClient({
  storage: AsyncStorage, platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
  send: async (userId, events) => { await request(userId, { operation: 'events', events }); },
});
export const trackAnalytics = (name: AnalyticsEventName, expectedUserId?: string) => {
  if (expectedUserId && useAnalyticsState.getState().userId !== expectedUserId) return;
  analyticsClient.track(name);
};
export async function bindAnalytics(userId?: string) {
  const version = ++binding;
  useAnalyticsState.setState({ userId, enabled: false, ready: false, error: false, saving: false, pendingDisable: false });
  await analyticsClient.bind(userId);
  if (version !== binding || !userId) return false;
  const pending = await AsyncStorage.getItem(disableKey(userId)).catch(() => null);
  if (version !== binding) return false;
  useAnalyticsState.setState({ pendingDisable: pending === 'true' });
  await refreshAnalyticsPreference(userId, version);
  return version === binding;
}
export async function refreshAnalyticsPreference(userId: string, version = binding) {
  if (useAnalyticsState.getState().saving) return;
  if (version !== binding || useAnalyticsState.getState().userId !== userId) return;
  if (useAnalyticsState.getState().pendingDisable) { await setAnalyticsPreference(false); return; }
  const preference = ++preferenceVersion;
  try {
    const result = await request(userId, { operation: 'status' });
    if (version !== binding || preference !== preferenceVersion || useAnalyticsState.getState().userId !== userId) return;
    analyticsClient.setEnabled(result.enabled === true);
    useAnalyticsState.setState({ enabled: result.enabled === true, ready: true, error: false });
  } catch {
    if (version === binding && preference === preferenceVersion) useAnalyticsState.setState({ ready: true, error: true });
  }
}
export async function setAnalyticsPreference(enabled: boolean) {
  const { userId, saving } = useAnalyticsState.getState(); if (!userId || saving) return;
  const version = binding; const preference = ++preferenceVersion;
  if (!enabled) { analyticsClient.setEnabled(false); useAnalyticsState.setState({ enabled: false, pendingDisable: true }); }
  useAnalyticsState.setState({ saving: true, error: false });
  if (!enabled) await AsyncStorage.setItem(disableKey(userId), 'true').catch(() => undefined);
  if (version !== binding) return;
  try {
    const result = await request(userId, { operation: 'preference', enabled });
    if (version !== binding || preference !== preferenceVersion) return;
    analyticsClient.setEnabled(result.enabled === true);
    useAnalyticsState.setState({ enabled: result.enabled === true, ready: true, pendingDisable: false });
    await AsyncStorage.removeItem(disableKey(userId)).catch(() => undefined);
    if (result.enabled === true) void analyticsClient.flush();
  } catch {
    if (version === binding && preference === preferenceVersion) useAnalyticsState.setState({ error: true, ready: true });
  } finally { if (version === binding && preference === preferenceVersion) useAnalyticsState.setState({ saving: false }); }
}
