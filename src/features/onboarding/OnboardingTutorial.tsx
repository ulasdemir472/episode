import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { colors, radius, spacing } from '@/theme/tokens';
import { useProfileStore } from '@/store/profile-store';

type Step = {
  icon: keyof typeof Ionicons.glyphMap;
  route: Href;
  title: string;
  body: string;
};

export function OnboardingTutorial({ onFinish }: { onFinish: () => void }) {
  const language = useProfileStore((state) => state.language);
  const [index, setIndex] = useState(0);
  const en = language === 'en';
  const steps = useMemo<Step[]>(() => en ? [
    { icon: 'search-outline', route: '/(tabs)/discover' as Href, title: 'Discover what to watch', body: 'This is Discover. Search movies and shows here, then open a detail page for seasons, episodes and ratings.' },
    { icon: 'heart-outline', route: '/(tabs)/library' as Href, title: 'Build your lists', body: 'This is your Library. Titles you mark as watching, watchlist, completed or dropped are collected here.' },
    { icon: 'calendar-outline', route: '/(tabs)/releases' as Href, title: 'Follow new episodes', body: 'Episodes shows upcoming and recently aired episodes from the shows you follow.' },
    { icon: 'chatbubble-ellipses-outline', route: '/(tabs)/discover' as Href, title: 'Rate and comment after watching', body: 'Open a title from Discover or Library. After watching, you can rate and write spoiler-free comments.' },
    { icon: 'people-outline', route: '/(tabs)/profile' as Href, title: 'Complete your profile', body: 'This is Profile. Set a username, upload a photo, search friends by username and send requests.' },
  ] : [
    { icon: 'search-outline', route: '/(tabs)/discover' as Href, title: 'Kesfet tabindan basla', body: 'Burasi Kesfet. Film ve dizi arayip detay sayfasinda sezonlari, bolumleri ve puanlari gorebilirsin.' },
    { icon: 'heart-outline', route: '/(tabs)/library' as Href, title: 'Listeni burada yonet', body: 'Burasi Listem. Izliyorum, izleyecegim, izledim veya biraktim dedigin yapimlar burada toplanir.' },
    { icon: 'calendar-outline', route: '/(tabs)/releases' as Href, title: 'Yeni bolumleri takip et', body: 'Bolumler tabinda takip ettigin dizilerin yeni ve yaklasan bolumlerini gorursun.' },
    { icon: 'chatbubble-ellipses-outline', route: '/(tabs)/discover' as Href, title: 'Izledikten sonra puan ver', body: 'Kesfet veya Listem uzerinden detay sayfasina gir. Izledigin yapimlara puan ve spoiler vermeyen yorum ekleyebilirsin.' },
    { icon: 'people-outline', route: '/(tabs)/profile' as Href, title: 'Profil ve arkadaslar', body: 'Burasi Profil. Kullanici adi belirle, fotograf yukle, sonra arkadasini kullanici adiyla ara ve istek gonder.' },
  ], [en]);
  const step = steps[index]!;
  const isLast = index === steps.length - 1;
  const advance = () => {
    if (isLast) {
      onFinish();
      return;
    }
    const nextIndex = index + 1;
    setIndex(nextIndex);
    router.replace(steps[nextIndex]!.route);
  };

  useEffect(() => {
    router.replace(step.route);
  }, [step.route]);

  return <Modal visible transparent animationType="slide" onRequestClose={onFinish}>
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <View style={styles.brand}><Text style={styles.logo}>episode<Text style={styles.dot}>.</Text></Text></View>
        <View style={styles.icon}><Ionicons name={step.icon} size={34} color="#fff" /></View>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.body}>{step.body}</Text>
        <View style={styles.dots}>{steps.map((_, dotIndex) => <View key={dotIndex} style={[styles.dotItem, dotIndex === index && styles.dotActive]} />)}</View>
        <View style={styles.actions}>
          <Pressable onPress={onFinish} style={styles.skip}><Text style={styles.skipText}>{en ? 'Skip' : 'Gec'}</Text></Pressable>
          <Pressable onPress={advance} style={styles.next}><Text style={styles.nextText}>{isLast ? (en ? 'Start' : 'Basla') : (en ? 'Next' : 'Devam')}</Text></Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.32)', justifyContent: 'flex-end', padding: spacing.lg },
  card: { width: '100%', borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.xl },
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
