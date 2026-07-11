import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

const tutorialMovie = {
  id: 550,
  type: 'movie',
  title: 'Fight Club',
  overview: 'Bir detay sayfasinda liste, favori, puan ve yorum alanlarini burada gorebilirsin.',
  posterUrl: 'https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
  backdropUrl: 'https://image.tmdb.org/t/p/w780/hZkgoQYus5vegHoetLkCJzb17zJ.jpg',
  year: '1999',
  rating: 8.4,
  genres: ['Drama'],
};

export function OnboardingTutorial({ onFinish }: { onFinish: () => void }) {
  const language = useProfileStore((state) => state.language);
  const [index, setIndex] = useState(0);
  const en = language === 'en';
  const steps = useMemo<Step[]>(() => en ? [
    { icon: 'search-outline', route: '/(tabs)/discover' as Href, title: 'Discover what to watch', body: 'This is Discover. Search movies and shows here, then open a detail page for seasons, episodes and ratings.' },
    { icon: 'heart-outline', route: '/(tabs)/library' as Href, title: 'Build your lists', body: 'This is your Library. Titles you mark as watching, watchlist, completed or dropped are collected here.' },
    { icon: 'calendar-outline', route: '/(tabs)/releases' as Href, title: 'Follow new episodes', body: 'Episodes shows upcoming and recently aired episodes from the shows you follow.' },
    { icon: 'chatbubble-ellipses-outline', route: { pathname: '/media/[id]', params: { id: String(tutorialMovie.id), data: JSON.stringify(tutorialMovie), tutorialTarget: 'comments' } } as Href, title: 'Rate and comment after watching', body: 'This is the comments area. After watching, you can rate and write spoiler-free comments here.' },
    { icon: 'people-outline', route: { pathname: '/(tabs)/profile', params: { tutorialTarget: 'friends' } } as Href, title: 'Complete your profile', body: 'This is the friends area. Set a username above, then search friends by username and send requests here.' },
  ] : [
    { icon: 'search-outline', route: '/(tabs)/discover' as Href, title: 'Kesfet tabindan basla', body: 'Burasi Kesfet. Film ve dizi arayip detay sayfasinda sezonlari, bolumleri ve puanlari gorebilirsin.' },
    { icon: 'heart-outline', route: '/(tabs)/library' as Href, title: 'Listeni burada yonet', body: 'Burasi Listem. Izliyorum, izleyecegim, izledim veya biraktim dedigin yapimlar burada toplanir.' },
    { icon: 'calendar-outline', route: '/(tabs)/releases' as Href, title: 'Yeni bolumleri takip et', body: 'Bolumler tabinda takip ettigin dizilerin yeni ve yaklasan bolumlerini gorursun.' },
    { icon: 'chatbubble-ellipses-outline', route: { pathname: '/media/[id]', params: { id: String(tutorialMovie.id), data: JSON.stringify(tutorialMovie), tutorialTarget: 'comments' } } as Href, title: 'Yorum ve puan burada', body: 'Burasi yorum alani. Izledigin yapimlara puan ve spoiler vermeyen yorumlari buradan ekleyebilirsin.' },
    { icon: 'people-outline', route: { pathname: '/(tabs)/profile', params: { tutorialTarget: 'friends' } } as Href, title: 'Arkadas arama burada', body: 'Burasi arkadas alani. Once yukarida kullanici adi belirle, sonra arkadasini kullanici adiyla arayip istek gonder.' },
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

  return <View pointerEvents="box-none" style={styles.overlay}>
    <View pointerEvents="box-none" style={styles.backdrop}>
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
  </View>;
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'flex-start', zIndex: 999 },
  backdrop: { paddingHorizontal: spacing.md, paddingTop: spacing.lg },
  card: { width: '100%', borderRadius: 18, backgroundColor: 'rgba(17,17,22,.97)', borderWidth: 1, borderColor: colors.border, padding: spacing.md, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 12 },
  brand: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: 'rgba(255,90,71,.12)', borderWidth: 1, borderColor: 'rgba(255,90,71,.24)' },
  logo: { color: colors.text, fontSize: 17, fontWeight: '900', letterSpacing: -0.6 },
  dot: { color: colors.primary },
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  title: { color: colors.text, fontSize: 18, lineHeight: 22, fontWeight: '900', textAlign: 'center', marginTop: spacing.sm },
  body: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  dots: { flexDirection: 'row', gap: 7, marginTop: spacing.md },
  dotItem: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { width: 22, backgroundColor: colors.primary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, alignSelf: 'stretch' },
  skip: { flex: 1, height: 42, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  skipText: { color: colors.muted, fontWeight: '800' },
  next: { flex: 1, height: 42, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  nextText: { color: '#fff', fontWeight: '900' },
});
