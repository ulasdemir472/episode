import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient, processLock, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const extra = Constants.expoConfig?.extra as { supabaseUrl?: string; supabasePublishableKey?: string } | undefined;
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra?.supabaseUrl;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? extra?.supabasePublishableKey;
const isJest = process.env.JEST_WORKER_ID !== undefined;

export const isSupabaseConfigured = !isJest && Boolean(supabaseUrl && supabasePublishableKey);

export const supabase: SupabaseClient<Database> | undefined = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        lock: processLock,
      },
    })
  : undefined;

export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) throw new Error('Supabase bağlantısı yapılandırılmamış. Environment değişkenlerini kontrol et.');
  return supabase;
}

if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
