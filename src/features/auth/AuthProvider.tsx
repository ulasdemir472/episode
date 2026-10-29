import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { EmailOtpType, Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { router, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '@/infrastructure/supabase/client';
import { hydrateAndSyncUser, persistCurrentUserState, StaleSyncError } from '@/features/sync/user-sync-service';
import { deleteUserAccount } from './account-service';
import { unregisterPushToken } from '@/features/notifications/device-service';
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
  flushSync: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  deleteAccount: () => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const activeUserId = useRef<string | undefined>(undefined);
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
  const visibility = useProfileStore((state) => state.visibility);
  const avatarUrl = useProfileStore((state) => state.avatarUrl);
  const coverUrl = useProfileStore((state) => state.coverUrl);
  const favorites = useProfileStore((state) => state.favorites);
  const communityChanges = useCommunityStore((state) => state.pendingChanges);
  const deletedCommentIds = useCommunityStore((state) => state.deletedCommentIds);

  const retrySync = useCallback(async (operation: SyncOperation = 'hydrate') => {
    const userId = session?.user.id;
    if (!userId || activeUserId.current !== userId) return;
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
      const isCurrent = () => activeUserId.current === userId;
      if (operation === 'hydrate') await hydrateAndSyncUser(userId, isCurrent);
      else await persistCurrentUserState(userId, isCurrent);
      if (!isCurrent()) return;
      syncReady.current = true;
      syncRetryAttempt.current = 0;
      setSyncStatus('ready');
    } catch (error: unknown) {
      if (error instanceof StaleSyncError || activeUserId.current !== userId) return;
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
    let generation = 0;
    const acceptSession = async (nextSession: Session | null) => {
      const currentGeneration = ++generation;
      const previousUserId = activeUserId.current;
      activeUserId.current = nextSession?.user.id;
      const stores = [useLibraryStore, useProfileStore, useCommunityStore];
      await Promise.all(stores.map((store) => store.persist.hasHydrated() ? Promise.resolve() : store.persist.rehydrate()));
      if (!active || generation !== currentGeneration) return;
      if (nextSession) {
        for (const store of stores) store.getState().bindUser(nextSession.user.id);
      }
      if (previousUserId !== nextSession?.user.id) queryClient.clear();
      setSession(nextSession);
      setLoading(false);
    };
    supabase.auth.getSession().then(({ data }) => { if (generation === 0) return acceptSession(data.session); }).catch(() => active && setLoading(false));
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (active) {
        if (event !== 'TOKEN_REFRESHED') void acceptSession(nextSession);
        else setSession(nextSession);
        if (event === 'PASSWORD_RECOVERY') {
          router.push('/reset-password' as Href);
        }
      }
    });
    return () => {
      active = false;
      activeUserId.current = undefined;
      listener.subscription.unsubscribe();
    };
  }, [queryClient]);

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
  }, [avatarUrl, communityChanges, coverUrl, deletedCommentIds, favorites, firstName, language, lastName, libraryItems, retrySync, session?.user.id, syncStatus, username, visibility, watchedEpisodes]);

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
    flushSync: async () => { const id = session?.user.id; if (!id) throw new StaleSyncError('Session changed'); await persistCurrentUserState(id, () => activeUserId.current === id); },
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
      try { if (session?.user.id) { await persistCurrentUserState(session.user.id, () => activeUserId.current === session.user.id); await unregisterPushToken(session.user.id); } }
      catch { return { error: language === 'en' ? 'Your changes could not be synced. Please try again before signing out.' : 'Değişikliklerin senkronize edilemedi. Çıkış yapmadan önce tekrar dene.' }; }
      const { error } = await supabase.auth.signOut();
      if (error) return { error: error.message };
      activeUserId.current = undefined;
      queryClient.clear();
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
      activeUserId.current = undefined;
      try { await deleteUserAccount(); }
      catch { activeUserId.current = userId; void retrySync('hydrate'); return { error: language === 'en' ? 'Your account could not be deleted. Check your connection and try again.' : 'Hesabın silinemedi. Bağlantını kontrol edip tekrar dene.' }; }
      await supabase.auth.signOut().catch(() => undefined);
      queryClient.clear();
      useLibraryStore.getState().clearUserData();
      useProfileStore.getState().clearUserData();
      useCommunityStore.getState().clearUserData();
      setSession(null);
      setSyncStatus('idle');
      setSyncError(undefined);
      return {};
    },
  }), [language, loading, queryClient, retrySync, session, syncError, syncStatus]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth, AuthProvider içinde kullanılmalıdır.');
  return context;
}
