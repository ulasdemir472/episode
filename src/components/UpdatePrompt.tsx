import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { colors, radius, spacing } from '@/theme/tokens';
import { useProfileStore } from '@/store/profile-store';

const FOREGROUND_CHECK_INTERVAL_MS = 5 * 60_000;
const UPDATE_RESTART_KEY = 'episode-update-restart-pending';
const LAST_UPDATE_ID_KEY = 'episode-last-running-update-id';

export function UpdatePrompt() {
  const en = useProfileStore((state) => state.language) === 'en';
  const { currentlyRunning, isUpdateAvailable, isUpdatePending } = Updates.useUpdates();
  const [downloadedReady, setDownloadedReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const checking = useRef(false);
  const lastCheckAt = useRef(0);

  useEffect(() => {
    const updateId = currentlyRunning.updateId;
    if (__DEV__ || !updateId) return;
    Promise.all([AsyncStorage.getItem(UPDATE_RESTART_KEY), AsyncStorage.getItem(LAST_UPDATE_ID_KEY)]).then(async ([restartPending, previousUpdateId]) => {
      const silentlyApplied = !currentlyRunning.isEmbeddedLaunch && previousUpdateId !== updateId;
      await AsyncStorage.multiSet([[LAST_UPDATE_ID_KEY, updateId], [UPDATE_RESTART_KEY, '']]);
      if (restartPending || silentlyApplied) Alert.alert(en ? 'Episode updated' : 'Episode güncellendi', en ? 'New version installed successfully. Enjoy the new features.' : 'Yeni sürüm başarıyla yüklendi. Yenilikleri kullanmaya başlayabilirsin.');
    }).catch(() => undefined);
  }, [currentlyRunning.isEmbeddedLaunch, currentlyRunning.updateId, en]);

  const checkAndDownload = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled || checking.current || Date.now() - lastCheckAt.current < FOREGROUND_CHECK_INTERVAL_MS) return;
    checking.current = true;
    lastCheckAt.current = Date.now();
    try {
      const check = await Updates.checkForUpdateAsync();
      if (check.isAvailable) {
        const fetched = await Updates.fetchUpdateAsync();
        if (fetched.isNew) { setDismissed(false); setDownloadedReady(true); }
      }
    } catch {
      // Ağ yoksa mevcut sürüm kesintisiz çalışmaya devam eder.
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void checkAndDownload(), 2500);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void checkAndDownload(); });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [checkAndDownload]);

  useEffect(() => {
    if (isUpdateAvailable && !isUpdatePending && !checking.current) void checkAndDownload();
  }, [checkAndDownload, isUpdateAvailable, isUpdatePending]);

  const restart = async () => {
    setRestarting(true);
    try {
      await AsyncStorage.setItem(UPDATE_RESTART_KEY, '1');
      await Updates.reloadAsync();
    } catch {
      await AsyncStorage.removeItem(UPDATE_RESTART_KEY).catch(() => undefined);
      setRestarting(false);
    }
  };

  const visible = (isUpdatePending || downloadedReady) && !dismissed;

  return <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setDismissed(true)}>
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <View style={styles.icon}><Ionicons name="sparkles" size={24} color={colors.primary} /></View>
        <Text style={styles.title}>{en ? 'Update ready' : 'Güncelleme hazır'}</Text>
        <Text style={styles.body}>{en ? 'A new version of Episode has been downloaded. Restart to apply the update.' : 'Episode’ın yeni sürümü indirildi. Yenilikleri kullanmak için uygulamayı yeniden başlat.'}</Text>
        <Pressable disabled={restarting} onPress={() => void restart()} style={[styles.primary, restarting && styles.disabled]}><Ionicons name="refresh" size={17} color="#fff" /><Text style={styles.primaryText}>{restarting ? (en ? 'Restarting…' : 'Yeniden başlatılıyor…') : (en ? 'Restart now' : 'Şimdi yeniden başlat')}</Text></Pressable>
        <Pressable disabled={restarting} onPress={() => setDismissed(true)} style={styles.later}><Text style={styles.laterText}>{en ? 'Later' : 'Daha sonra'}</Text></Pressable>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: 'rgba(0,0,0,.72)' }, card: { alignItems: 'center', padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, icon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,90,71,.12)' }, title: { color: colors.text, fontSize: 21, fontWeight: '900', marginTop: spacing.md }, body: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: spacing.sm }, primary: { width: '100%', height: 48, marginTop: spacing.xl, borderRadius: radius.pill, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, primaryText: { color: '#fff', fontSize: 13, fontWeight: '900' }, later: { marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }, laterText: { color: colors.muted, fontSize: 12, fontWeight: '800' }, disabled: { opacity: .55 },
});
