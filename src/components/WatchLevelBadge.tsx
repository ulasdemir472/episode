import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing } from '@/theme/tokens';

const levelNames = ['İlk rozet yolda', 'Sahne Avcısı', 'Maratoncu', 'Gece Kuşu', 'Bölüm Ustası', 'Ekran Efsanesi'];
const palettes = [
  ['#35343C', '#1C1B21'],
  ['#B76E3C', '#6C3524'],
  ['#A8B2C1', '#566170'],
  ['#F5C65B', '#B37418'],
  ['#9B7BFF', '#5740B5'],
  ['#FF5A78', '#8F2B62'],
] as const;

export function getWatchLevel(minutes: number) {
  const hours = Math.max(0, minutes / 60);
  const level = Math.floor(hours / 100);
  const progress = Math.min(100, hours - level * 100);
  return { hours, level, progress, nextHours: (level + 1) * 100 };
}

export function WatchLevelBadge({ minutes, isLoading, language = 'tr' }: { minutes: number; isLoading: boolean; language?: 'tr' | 'en' }) {
  const { hours, level, progress, nextHours } = getWatchLevel(minutes);
  const palette = palettes[Math.min(level, palettes.length - 1)]!;
  const title = levelNames[Math.min(level, levelNames.length - 1)]!;
  const remaining = Math.max(0, Math.ceil(nextHours - hours));
  const en = language === 'en';
  return <LinearGradient colors={palette} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.root}>
    <View style={styles.shine} />
    <View style={styles.icon}><Ionicons name={level > 0 ? 'medal' : 'sparkles'} size={25} color={level > 0 ? '#FFF4C8' : colors.muted} /></View>
    <View style={styles.copy}>
      <Text style={styles.kicker}>{en ? 'WATCH BADGE' : 'İZLEME ROZETİ'}</Text>
      <Text style={styles.title}>{isLoading ? (en ? 'Calculating…' : 'Hesaplanıyor…') : en && level === 0 ? 'First badge awaits' : title}</Text>
      <Text style={styles.detail}>{isLoading ? ' ' : level === 0 ? (en ? `${remaining} hours to Level 1` : `Seviye 1 için ${remaining} saat kaldı`) : (en ? `${Math.floor(hours)} hours watched` : `${Math.floor(hours)} saat izlendi`)}</Text>
      <View style={styles.track}><View style={[styles.fill, { width: `${isLoading ? 0 : progress}%` }]} /></View>
    </View>
    <View style={styles.level}><Text style={styles.levelNumber}>{isLoading ? '–' : level}</Text><Text style={styles.levelLabel}>{en ? 'LEVEL' : 'SEVİYE'}</Text></View>
  </LinearGradient>;
}

const styles = StyleSheet.create({
  root: { minHeight: 116, marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,.13)' },
  shine: { position: 'absolute', width: 150, height: 150, borderRadius: 75, right: -50, top: -80, backgroundColor: 'rgba(255,255,255,.09)' },
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,8,12,.28)', borderWidth: 1, borderColor: 'rgba(255,255,255,.14)' },
  copy: { flex: 1 }, kicker: { color: 'rgba(255,255,255,.68)', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 }, title: { color: '#fff', fontSize: 16, fontWeight: '900', marginTop: 3 }, detail: { color: 'rgba(255,255,255,.72)', fontSize: 9, fontWeight: '700', marginTop: 3 },
  track: { height: 4, marginTop: 9, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,.25)' }, fill: { height: '100%', borderRadius: 2, backgroundColor: '#FFF4C8' },
  level: { width: 48, alignItems: 'center', paddingVertical: 8, borderRadius: radius.md, backgroundColor: 'rgba(8,8,12,.25)' }, levelNumber: { color: '#fff', fontSize: 22, fontWeight: '900' }, levelLabel: { color: 'rgba(255,255,255,.65)', fontSize: 7, fontWeight: '900', marginTop: 1 },
});
