import { useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { NotificationSettings } from '@/components/NotificationSettings';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchBlockedProfiles, unblockUser } from '@/features/community/community-repository';
import { useProfileStore } from '@/store/profile-store';
import { t } from '@/i18n/strings';
import { colors, radius, spacing } from '@/theme/tokens';

export default function SettingsScreen() {
  const auth = useAuth();
  const profile = useProfileStore();
  const en = profile.language === 'en';
  const [privacySaving, setPrivacySaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteLock = useRef(false);
  const client = useQueryClient();
  const blocked = useQuery({ queryKey: ['blocked-profiles', auth.user?.id], queryFn: fetchBlockedProfiles, enabled: Boolean(auth.user), staleTime: 15_000 });
  const unblock = useMutation({ mutationFn: (id: string) => unblockUser(auth.user!.id, id), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['blocked-profiles', auth.user?.id] }); await client.invalidateQueries({ queryKey: ['community'] }); }, onError: () => Alert.alert(t(profile.language, 'error')) });
  const visibility = async (value: 'private' | 'friends' | 'members') => {
    if (privacySaving) return;
    const previous = profile.visibility;
    setPrivacySaving(true);
    profile.setVisibility(value);
    try { await auth.flushSync(); }
    catch { profile.setVisibility(previous); Alert.alert(t(profile.language, 'error'), en ? 'Your privacy setting could not be saved. Please try again.' : 'Gizlilik ayarın kaydedilemedi. Lütfen tekrar dene.'); }
    finally { setPrivacySaving(false); }
  };
  const deleteAccount = () => Alert.alert(en ? 'Delete account?' : 'Hesabın silinsin mi?', en ? 'Your profile, lists, ratings and comments will be permanently deleted.' : 'Profilin, listelerin, puanların ve yorumların kalıcı olarak silinecek.', [{ text: t(profile.language, 'cancel'), style: 'cancel' }, { text: en ? 'Delete account' : 'Hesabımı sil', style: 'destructive', onPress: async () => {
    if (deleteLock.current) return;
    deleteLock.current = true;
    setDeleting(true);
    const result = await auth.deleteAccount();
    if (result.error) { Alert.alert(t(profile.language, 'error'), result.error); deleteLock.current = false; setDeleting(false); }
    else router.replace('/auth');
  } }]);
  return <Screen><View style={styles.header}><Pressable accessibilityLabel={t(profile.language, 'back')} onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable><Text style={styles.title}>{en ? 'Settings' : 'Ayarlar'}</Text></View><NotificationSettings />
    <View style={styles.panel}><Text style={styles.heading}>{en ? 'App language' : 'Uygulama dili'}</Text><View style={styles.options}>{(['tr','en'] as const).map((language) => <Pressable key={language} accessibilityRole="radio" accessibilityState={{ selected: profile.language === language }} onPress={() => profile.setLanguage(language)} style={[styles.option, profile.language === language && styles.active]}><Text style={styles.label}>{language === 'tr' ? 'Türkçe' : 'English'}</Text></Pressable>)}</View></View>
    <View style={styles.panel}><Text style={styles.heading}>{en ? 'Who can see my viewing history?' : 'İzleme geçmişimi kim görebilir?'}</Text><Text style={styles.body}>{en ? 'Applies to your library, episode history and favorites. Your profile name and public reviews remain visible to members.' : 'Listeni, bölüm geçmişini ve favorilerini kapsar. Profil adın ve herkese açık yorumların üyeler tarafından görülebilir.'}</Text>{(['private','friends','members'] as const).map((value) => <Pressable key={value} disabled={privacySaving} accessibilityRole="radio" accessibilityState={{ selected: profile.visibility === value }} onPress={() => void visibility(value)} style={styles.row}><Text style={styles.label}>{value === 'private' ? (en ? 'Only me' : 'Yalnızca ben') : value === 'friends' ? (en ? 'Friends' : 'Arkadaşlarım') : (en ? 'All members' : 'Tüm üyeler')}</Text><Ionicons name={profile.visibility === value ? 'radio-button-on' : 'radio-button-off'} size={23} color={colors.primary} /></Pressable>)}</View>
    <View style={styles.panel}><Text style={styles.heading}>{en ? 'Blocked users' : 'Engellenen kullanıcılar'}</Text>{blocked.isError ? <Pressable onPress={() => blocked.refetch()}><Text style={styles.body}>{t(profile.language, 'retry')}</Text></Pressable> : blocked.data?.length ? blocked.data.map((person) => <View key={person.id} style={styles.row}><Text style={styles.label}>{`${person.first_name} ${person.last_name}`.trim() || person.username || 'Episode'}</Text><Pressable disabled={unblock.isPending} onPress={() => unblock.mutate(person.id)} style={styles.option}><Text style={styles.link}>{en ? 'Unblock' : 'Engellemeyi kaldır'}</Text></Pressable></View>) : <Text style={styles.body}>{en ? 'You have not blocked anyone.' : 'Engellediğin bir kullanıcı yok.'}</Text>}</View>
    {auth.user && <View style={styles.panel}><Text style={styles.heading}>{en ? 'Account' : 'Hesap'}</Text><Text style={styles.body}>{auth.user.email}</Text><Text style={styles.body}>{auth.syncStatus === 'error' ? (en ? 'Some changes have not synced. Tap to retry.' : 'Bazı değişiklikler senkronize edilemedi. Yeniden dene.') : auth.syncStatus === 'syncing' ? (en ? 'Syncing…' : 'Senkronize ediliyor…') : (en ? 'Your changes sync automatically.' : 'Değişikliklerin otomatik senkronize edilir.')}</Text>{auth.syncStatus === 'error' && <Pressable onPress={() => void auth.retrySync()} style={styles.row}><Text style={styles.link}>{t(profile.language, 'retry')}</Text></Pressable>}<Pressable onPress={() => router.push('/reset-password')} style={styles.row}><Text style={styles.label}>{en ? 'Change password' : 'Şifre değiştir'}</Text></Pressable><Pressable onPress={() => { void auth.signOut().then((result) => { if (result.error) Alert.alert(t(profile.language, 'error'), result.error); }); }} style={styles.row}><Text style={styles.label}>{en ? 'Sign out' : 'Çıkış yap'}</Text></Pressable><Pressable disabled={deleting} onPress={deleteAccount} style={styles.row}><Text style={styles.link}>{deleting ? t(profile.language, 'loading') : (en ? 'Delete account' : 'Hesabımı sil')}</Text></Pressable></View>}
    <View style={styles.panel}><Pressable onPress={() => router.push('/privacy' as Href)} style={styles.row}><Text style={styles.label}>{t(profile.language, 'privacy')}</Text><Ionicons name="chevron-forward" color={colors.muted} size={20} /></Pressable><Pressable onPress={() => { void Linking.openURL('mailto:ulasdemir472@gmail.com?subject=Episode%20Support').catch(() => Alert.alert(t(profile.language, 'error'))); }} style={styles.row}><Text style={styles.label}>{t(profile.language, 'support')}</Text><Ionicons name="mail-outline" size={20} color={colors.muted} /></Pressable></View>
  </Screen>;
}
const styles = StyleSheet.create({ header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md }, back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, title: { color: colors.text, fontSize: 27, fontWeight: '900' }, panel: { marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, heading: { color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: spacing.sm }, body: { color: colors.muted, fontSize: 13, lineHeight: 20, marginBottom: spacing.sm }, options: { flexDirection: 'row', gap: spacing.sm }, option: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.elevated }, active: { backgroundColor: colors.secondary }, label: { color: colors.text, fontSize: 14, flexShrink: 1 }, row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }, link: { color: colors.primary, fontSize: 13, fontWeight: '700' } });
