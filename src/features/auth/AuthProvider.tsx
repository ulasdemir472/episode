import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { EmailOtpType, Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { router, type Href } from 'expo-router';
import { isSupabaseConfigured, supabase } from '@/infrastructure/supabase/client';
import { hydrateAndSyncUser, persistCurrentUserState } from '@/features/sync/user-sync-service';
import { useLibraryStore } from '@/store/library-store';
import { useProfileStore } from '@/store/profile-store';
import { useCommunityStore } from '@/store/community-store';

type AuthResult = { error?: string; needsEmailConfirmation?: boolean };

const authRedirectUrl = 'episode://auth';
const resetPasswordRedirectUrl = 'episode://reset-password';
const emailOtpTypes = new Set(['signup', 'email', 'magiclink', 'recovery', 'invite', 'email_change']);
const syncRetryDelays = [2_000, 5_000, 15_000, 30_000, 60_000] as const;
type SyncOperation = 'hydrate' | 'persist';

function readAuthParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  configured: boolean;
  syncStatus: 'idle' | 'syncing' | 'ready' | 'error';
  syncError?: string;
  retrySync: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  deleteAccount: () => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [syncStatus, setSyncStatus] = useState<AuthContextValue['syncStatus']>('idle');
  const [syncError, setSyncError] = useState<string>();
  const syncReady = useRef(false);
  const syncInFlight = useRef(false);
  const syncRerunRequested = useRef(false);
  const pendingSyncOperation = useRef<SyncOperation>('hydrate');
  const syncRetryAttempt = useRef(0);
  const syncRetryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const runSyncRef = useRef<(operation?: SyncOperation) => Promise<void>>(async () => undefined);
  const libraryItems = useLibraryStore((state) => state.items);
  const watchedEpisodes = useLibraryStore((state) => state.watchedEpisodes);
  const firstName = useProfileStore((state) => state.firstName);
  const lastName = useProfileStore((state) => state.lastName);
  const username = useProfileStore((state) => state.username);
  const language = useProfileStore((state) => state.language);
  const avatarUrl = useProfileStore((state) => state.avatarUrl);
  const coverUrl = useProfileStore((state) => state.coverUrl);
  const favorites = useProfileStore((state) => state.favorites);

  const retrySync = useCallback(async (operation: SyncOperation = 'hydrate') => {
    const userId = session?.user.id;
    if (!userId) return;
    pendingSyncOperation.current = operation;
    if (syncInFlight.current) {
      syncRerunRequested.current = true;
      return;
    }
    if (syncRetryTimer.current) clearTimeout(syncRetryTimer.current);
    syncRetryTimer.current = undefined;
    syncInFlight.current = true;
    if (operation === 'hydrate') syncReady.current = false;
    setSyncError(undefined);
    if (operation === 'hydrate') setSyncStatus('syncing');
    try {
      if (operation === 'hydrate') await hydrateAndSyncUser(userId);
      else await persistCurrentUserState(userId);
      syncReady.current = true;
      syncRetryAttempt.current = 0;
      setSyncStatus('ready');
    } catch (error: unknown) {
      setSyncError(error instanceof Error ? error.message : 'Senkronizasyon başarısız.');
      setSyncStatus('error');
      const baseDelay = syncRetryDelays[Math.min(syncRetryAttempt.current, syncRetryDelays.length - 1)]!;
      const delay = Math.round(baseDelay * (0.75 + Math.random() * 0.5));
      syncRetryAttempt.current += 1;
      syncRetryTimer.current = setTimeout(() => {
        syncRetryTimer.current = undefined;
        void runSyncRef.current(pendingSyncOperation.current);
      }, delay);
    } finally {
      syncInFlight.current = false;
      if (syncRerunRequested.current) {
        syncRerunRequested.current = false;
        void runSyncRef.current(pendingSyncOperation.current);
      }
    }
  }, [session?.user.id]);

  useEffect(() => {
    runSyncRef.current = retrySync;
  }, [retrySync]);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setLoading(false);
      }
    }).catch(() => active && setLoading(false));
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setLoading(false);
        if (event === 'PASSWORD_RECOVERY') {
          router.push('/reset-password' as Href);
        }
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const exchangeAuthCode = async (url: string | null) => {
      if (!url) return;
      const parsed = Linking.parse(url);
      let type = readAuthParam(parsed.queryParams?.type);
      const code = readAuthParam(parsed.queryParams?.code);
      const tokenHash = readAuthParam(parsed.queryParams?.token_hash);

      if (url.includes('#')) {
        const hash = url.split('#')[1];
        if (hash) {
          const hashParams = new URLSearchParams(hash);
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          const hashType = hashParams.get('type');
          if (hashType) type = hashType;
          if (accessToken && refreshToken) {
            await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).catch(() => undefined);
          }
        }
      }

      if (code) await client.auth.exchangeCodeForSession(code).catch(() => undefined);
      if (tokenHash && type && emailOtpTypes.has(type)) {
        await client.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType }).catch(() => undefined);
      }

      const isRecovery =
        type === 'recovery' ||
        parsed.path === 'reset-password' ||
        parsed.hostname === 'reset-password' ||
        url.includes('reset-password');
      if (isRecovery) {
        router.push('/reset-password' as Href);
      }
    };
    Linking.getInitialURL().then(exchangeAuthCode).catch(() => undefined);
    const subscription = Linking.addEventListener('url', ({ url }) => {
      exchangeAuthCode(url);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    syncReady.current = false;
    syncRetryAttempt.current = 0;
    if (syncRetryTimer.current) clearTimeout(syncRetryTimer.current);
    syncRetryTimer.current = undefined;
    if (!userId) return;
    const initialSyncTimer = setTimeout(() => void retrySync('hydrate'), 0);
    return () => {
      clearTimeout(initialSyncTimer);
      if (syncRetryTimer.current) clearTimeout(syncRetryTimer.current);
      syncRetryTimer.current = undefined;
    };
  }, [retrySync, session?.user.id]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId || !syncReady.current || syncStatus !== 'ready') return;
    const timeout = setTimeout(() => {
      void retrySync('persist');
    }, 900);
    return () => clearTimeout(timeout);
  }, [avatarUrl, coverUrl, favorites, firstName, language, lastName, libraryItems, retrySync, session?.user.id, syncStatus, username, watchedEpisodes]);

  useEffect(() => {
    if (!session?.user.id) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void retrySync('hydrate');
    });
    return () => subscription.remove();
  }, [retrySync, session?.user.id]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    configured: isSupabaseConfigured,
    syncStatus,
    syncError,
    retrySync: () => retrySync('hydrate'),
    signIn: async (email, password) => {
      if (!supabase) return { error: 'Supabase bağlantısı yapılandırılmamış.' };
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      return error ? { error: error.message } : {};
    },
    signUp: async (email, password) => {
      if (!supabase) return { error: 'Supabase bağlantısı yapılandırılmamış.' };
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: authRedirectUrl },
      });
      return error ? { error: error.message } : { needsEmailConfirmation: !data.session };
    },
    resetPassword: async (email) => {
      if (!supabase) return { error: 'Supabase bağlantısı yapılandırılmamış.' };
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: resetPasswordRedirectUrl,
      });
      return error ? { error: error.message } : {};
    },
    updatePassword: async (password) => {
      if (!supabase) return { error: 'Supabase bağlantısı yapılandırılmamış.' };
      const { error } = await supabase.auth.updateUser({ password });
      return error ? { error: error.message } : {};
    },
    signOut: async () => {
      if (!supabase) return {};
      const { error } = await supabase.auth.signOut();
      if (error) return { error: error.message };
      useLibraryStore.getState().clearUserData();
      useProfileStore.getState().clearUserData();
      useCommunityStore.getState().clearUserData();
      setSyncStatus('idle');
      setSyncError(undefined);
      return {};
    },
    deleteAccount: async () => {
      if (!supabase) return { error: 'Supabase bağlantısı yapılandırılmamış.' };
      const userId = session?.user.id;
      if (!userId) return { error: 'Oturum açmış kullanıcı bulunamadı.' };
      try {
        const { error: rpcError } = await supabase.rpc('delete_user_account');
        if (rpcError) {
          await supabase.from('profiles').delete().eq('id', userId);
          await supabase.from('user_library').delete().eq('user_id', userId);
        }
      } catch {
        // Continue clearing client state even if backend network error occurs
      }
      await supabase.auth.signOut().catch(() => undefined);
      useLibraryStore.getState().clearUserData();
      useProfileStore.getState().clearUserData();
      useCommunityStore.getState().clearUserData();
      setSession(null);
      setSyncStatus('idle');
      setSyncError(undefined);
      return {};
    },
  }), [loading, retrySync, session, syncError, syncStatus]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth, AuthProvider içinde kullanılmalıdır.');
  return context;
}
