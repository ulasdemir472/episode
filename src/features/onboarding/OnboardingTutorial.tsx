import { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotionPressable } from '@/components/MotionPressable';
import { colors, radius, spacing } from '@/theme/tokens';
import { useProfileStore } from '@/store/profile-store';

type Step = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
};

export function OnboardingTutorial({ onFinish }: { onFinish: () => void }) {
  const language = useProfileStore((state) => state.language);
  const [index, setIndex] = useState(0);
  const en = language === 'en';
  const steps = useMemo<Step[]>(() => en ? [
    { icon: 'search-outline', title: 'Discover what to watch', body: 'Use Discover to search movies and shows, then open the detail page for seasons, episodes and ratings.' },
    { icon: 'heart-outline', title: 'Build your taste', body: 'Tap the heart on detail pages to add favorites. Use list buttons to mark watching, watchlist or completed.' },
    { icon: 'checkmark-done-outline', title: 'Track every episode', body: 'On show details, mark episodes as watched. If you jump ahead, Episode can mark previous episodes for you.' },
    { icon: 'chatbubble-ellipses-outline', title: 'Rate and comment', body: 'After watching, add ratings and spoiler-free comments. Unwatched titles stay locked.' },
    { icon: 'people-outline', title: 'Add friends', body: 'Go to Profile, set a username, upload a photo, then search friends by username and send requests.' },
  ] : [
    { icon: 'search-outline', title: 'Ne izleyecegini kesfet', body: 'Kesfet tabindan film ve dizi ara; detay ekraninda sezonlari, bolumleri ve puanlari gor.' },
    { icon: 'heart-outline', title: 'Zevkini olustur', body: 'Detay ekraninda kalbe basarak favorilere ekle. Liste butonlariyla izliyorum, izleyecegim veya izledim olarak isaretle.' },
    { icon: 'checkmark-done-outline', title: 'Bolumleri tek tek takip et', body: 'Dizi detayinda bolumleri izlendi isaretle. Ileri bir bolume atlarsan oncekileri topluca isaretleyebilirsin.' },
    { icon: 'chatbubble-ellipses-outline', title: 'Puan ver ve yorum yap', body: 'Izledikten sonra puan ve yorumu ekle. Izlemedigin yapimlar yorum ve puana kapali kalir.' },
    { icon: 'people-outline', title: 'Arkadas ekle', body: 'Profilde kullanici adi belirle, fotograf yukle, sonra arkadasini kullanici adiyla ara ve istek gonder.' },
  ], [en]);
  const step = steps[index]!;
  const isLast = index === steps.length - 1;

  return <Modal visible transparent animationType="fade">
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <View style={styles.brand}><Text style={styles.logo}>episode<Text style={styles.dot}>.</Text></Text></View>
        <View style={styles.icon}><Ionicons name={step.icon} size={34} color="#fff" /></View>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.body}>{step.body}</Text>
        <View style={styles.dots}>{steps.map((_, dotIndex) => <View key={dotIndex} style={[styles.dotItem, dotIndex === index && styles.dotActive]} />)}</View>
        <View style={styles.actions}>
          <MotionPressable onPress={onFinish} style={styles.skip}><Text style={styles.skipText}>{en ? 'Skip' : 'Gec'}</Text></MotionPressable>
          <MotionPressable onPress={() => isLast ? onFinish() : setIndex((current) => current + 1)} style={styles.next}><Text style={styles.nextText}>{isLast ? (en ? 'Start' : 'Basla') : (en ? 'Next' : 'Devam')}</Text></MotionPressable>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.72)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, alignItems: 'center' },
  brand: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: 'rgba(255,90,71,.12)', borderWidth: 1, borderColor: 'rgba(255,90,71,.24)' },
  logo: { color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -1 },
  dot: { color: colors.primary },
  icon: { width: 74, height: 74, borderRadius: 37, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl },
  title: { color: colors.text, fontSize: 25, lineHeight: 30, fontWeight: '900', textAlign: 'center', marginTop: spacing.lg },
  body: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: spacing.md },
  dots: { flexDirection: 'row', gap: 7, marginTop: spacing.xl },
  dotItem: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { width: 22, backgroundColor: colors.primary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl, alignSelf: 'stretch' },
  skip: { flex: 1, height: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  skipText: { color: colors.muted, fontWeight: '800' },
  next: { flex: 1, height: 48, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  nextText: { color: '#fff', fontWeight: '900' },
});
