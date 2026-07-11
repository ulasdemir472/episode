import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { EmailOtpType, Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { isSupabaseConfigured, supabase } from '@/infrastructure/supabase/client';
import { hydrateAndSyncUser, persistCurrentUserState } from '@/features/sync/user-sync-service';
import { useLibraryStore } from '@/store/library-store';
import { useProfileStore } from '@/store/profile-store';
import { useCommunityStore } from '@/store/community-store';

type AuthResult = { error?: string; needsEmailConfirmation?: boolean };

const authRedirectUrl = 'episode://auth';
const emailOtpTypes = new Set(['signup', 'email', 'magiclink', 'recovery', 'invite', 'email_change']);

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
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [syncStatus, setSyncStatus] = useState<AuthContextValue['syncStatus']>('idle');
  const [syncError, setSyncError] = useState<string>();
  const syncReady = useRef(false);
  const libraryItems = useLibraryStore((state) => state.items);
  const watchedEpisodes = useLibraryStore((state) => state.watchedEpisodes);
  const firstName = useProfileStore((state) => state.firstName);
  const lastName = useProfileStore((state) => state.lastName);
  const username = useProfileStore((state) => state.username);
  const language = useProfileStore((state) => state.language);
  const avatarUrl = useProfileStore((state) => state.avatarUrl);
  const coverUrl = useProfileStore((state) => state.coverUrl);
  const favorites = useProfileStore((state) => state.favorites);

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
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setLoading(false);
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
      const code = readAuthParam(parsed.queryParams?.code);
      if (code) await client.auth.exchangeCodeForSession(code).catch(() => undefined);
      const tokenHash = readAuthParam(parsed.queryParams?.token_hash);
      const type = readAuthParam(parsed.queryParams?.type);
      if (tokenHash && type && emailOtpTypes.has(type)) {
        await client.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType }).catch(() => undefined);
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
    if (!userId) return;
    let cancelled = false;
    Promise.resolve().then(() => !cancelled && setSyncStatus('syncing'));
    hydrateAndSyncUser(userId).then(() => {
      if (!cancelled) {
        syncReady.current = true;
        setSyncError(undefined);
        setSyncStatus('ready');
      }
    }).catch((error: unknown) => {
      if (!cancelled) {
        setSyncError(error instanceof Error ? error.message : 'Senkronizasyon başarısız.');
        setSyncStatus('error');
      }
    });
    return () => { cancelled = true; };
  }, [session?.user.id]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId || !syncReady.current || syncStatus !== 'ready') return;
    const timeout = setTimeout(() => {
      persistCurrentUserState(userId).catch((error: unknown) => {
        setSyncError(error instanceof Error ? error.message : 'Senkronizasyon başarısız.');
        setSyncStatus('error');
      });
    }, 900);
    return () => clearTimeout(timeout);
  }, [avatarUrl, coverUrl, favorites, firstName, language, lastName, libraryItems, session?.user.id, syncStatus, username, watchedEpisodes]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    configured: isSupabaseConfigured,
    syncStatus,
    syncError,
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
  }), [loading, session, syncError, syncStatus]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth, AuthProvider içinde kullanılmalıdır.');
  return context;
}
