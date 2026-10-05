import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing } from '@/theme/tokens';

const levelNames = ['İlk rozet yolda', 'Sahne Avcısı', 'Maratoncu', 'Gece Kuşu', 'Bölüm Ustası', 'Ekran Efsanesi', 'Kare Koleksiyoncusu', 'Kurgu Bilgesi', 'Zaman Bükücü', 'İzleme Titanı'];
const palettes = [
  ['#35343C', '#1C1B21'],
  ['#B76E3C', '#6C3524'],
  ['#A8B2C1', '#566170'],
  ['#F5C65B', '#B37418'],
  ['#9B7BFF', '#5740B5'],
  ['#FF5A78', '#8F2B62'],
  ['#46C2CB', '#176B87'],
  ['#5CDB95', '#1D6F55'],
  ['#FF8C42', '#9C3F16'],
  ['#E6D36A', '#6F5B17'],
] as const;

export function getWatchLevel(minutes: number) {
  const hours = Math.max(0, minutes / 60);
  if (hours < 100) return { hours, level: 0, progress: Math.min(100, hours), nextHours: 100 };
  if (hours < 1000) return { hours, level: 1, progress: Math.min(100, ((hours - 100) / 900) * 100), nextHours: 1000 };
  const level = Math.floor(hours / 1000) + 1;
  const levelStart = (level - 1) * 1000;
  const nextHours = level * 1000;
  const progress = Math.min(100, ((hours - levelStart) / 1000) * 100);
  return { hours, level, progress, nextHours };
}

export function WatchLevelBadge({ minutes, isLoading, language = 'tr' }: { minutes: number; isLoading: boolean; language?: 'tr' | 'en' }) {
  const [showInfo, setShowInfo] = useState(false);
  const { hours, level, progress, nextHours } = getWatchLevel(minutes);
  const palette = palettes[Math.min(level, palettes.length - 1)]!;
  const title = levelNames[Math.min(level, levelNames.length - 1)]!;
  const remaining = Math.max(0, Math.ceil(nextHours - hours));
  const en = language === 'en';
  return <View style={styles.wrapper}><Pressable accessibilityRole="button" accessibilityLabel={en ? 'Show level calculation' : 'Seviye hesaplamasını göster'} onPress={() => setShowInfo((current) => !current)}><LinearGradient colors={palette} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.root}>
    <View style={styles.shine} />
    <Ionicons name="information-circle-outline" size={16} color="rgba(255,255,255,.72)" style={styles.infoIcon} />
    <View style={styles.icon}><Ionicons name={level > 0 ? 'medal' : 'sparkles'} size={25} color={level > 0 ? '#FFF4C8' : colors.muted} /></View>
    <View style={styles.copy}>
      <Text style={styles.kicker}>{en ? 'WATCH BADGE' : 'İZLEME ROZETİ'}</Text>
      <Text style={styles.title}>{isLoading ? (en ? 'Calculating…' : 'Hesaplanıyor…') : en && level === 0 ? 'First badge awaits' : title}</Text>
      <Text style={styles.detail}>{isLoading ? ' ' : level === 0 ? (en ? `${remaining} hours to Level 1` : `Seviye 1 için ${remaining} saat kaldı`) : (en ? `${Math.floor(hours)} hours watched` : `${Math.floor(hours)} saat izlendi`)}</Text>
      <View style={styles.track}><View style={[styles.fill, { width: `${isLoading ? 0 : progress}%` }]} /></View>
    </View>
    <View style={styles.level}><Text style={styles.levelNumber}>{isLoading ? '–' : level}</Text><Text style={styles.levelLabel}>{en ? 'LEVEL' : 'SEVİYE'}</Text></View>
  </LinearGradient></Pressable>{showInfo ? <View style={styles.tooltip}><Text style={styles.tooltipTitle}>{en ? 'How levels work' : 'Seviye nasıl hesaplanıyor?'}</Text><Text style={styles.tooltipText}>{en ? 'Level 0 covers 0–99 hours, Level 1 covers 100–999 hours. New levels unlock at 1,000, 2,000, 3,000… watched hours.' : 'Seviye 0, 0–99 saat; Seviye 1, 100–999 saat arasıdır. Sonraki seviyeler 1.000, 2.000, 3.000… izleme saatinde açılır.'}</Text>{!isLoading ? <Text style={styles.tooltipCurrent}>{en ? `${Math.floor(hours)} hours now · next level at ${nextHours}` : `Şu an ${Math.floor(hours)} saat · sonraki seviye ${nextHours.toLocaleString('tr-TR')} saat`}</Text> : null}</View> : null}</View>;
}

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: spacing.lg, marginTop: spacing.md, zIndex: 4 }, root: { minHeight: 116, padding: spacing.md, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,.13)' },
  shine: { position: 'absolute', width: 150, height: 150, borderRadius: 75, right: -50, top: -80, backgroundColor: 'rgba(255,255,255,.09)' },
  infoIcon: { position: 'absolute', right: 10, top: 8 },
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,8,12,.28)', borderWidth: 1, borderColor: 'rgba(255,255,255,.14)' },
  copy: { flex: 1 }, kicker: { color: 'rgba(255,255,255,.68)', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 }, title: { color: '#fff', fontSize: 16, fontWeight: '900', marginTop: 3 }, detail: { color: 'rgba(255,255,255,.72)', fontSize: 9, fontWeight: '700', marginTop: 3 },
  track: { height: 4, marginTop: 9, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,.25)' }, fill: { height: '100%', borderRadius: 2, backgroundColor: '#FFF4C8' },
  level: { width: 48, alignItems: 'center', paddingVertical: 8, borderRadius: radius.md, backgroundColor: 'rgba(8,8,12,.25)' }, levelNumber: { color: '#fff', fontSize: 22, fontWeight: '900' }, levelLabel: { color: 'rgba(255,255,255,.65)', fontSize: 7, fontWeight: '900', marginTop: 1 }, tooltip: { marginTop: 7, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.elevated, borderWidth: 1, borderColor: 'rgba(255,255,255,.15)' }, tooltipTitle: { color: colors.text, fontSize: 12, fontWeight: '900' }, tooltipText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 5 }, tooltipCurrent: { color: colors.warning, fontSize: 10, fontWeight: '800', marginTop: 7 },
});
