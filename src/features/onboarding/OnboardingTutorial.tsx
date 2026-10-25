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
  placement: 'top' | 'middle' | 'bottom';
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
    { icon: 'search-outline', route: '/(tabs)/discover' as Href, placement: 'bottom', title: 'Discover', body: 'Search movies and shows here. Open a detail page for seasons, episodes and ratings.' },
    { icon: 'heart-outline', route: '/(tabs)/library' as Href, placement: 'bottom', title: 'Your Library', body: 'Watching, watchlist, completed and dropped titles collect here.' },
    { icon: 'calendar-outline', route: '/(tabs)/releases' as Href, placement: 'bottom', title: 'Episodes', body: 'Upcoming and recently aired episodes from shows you follow appear here.' },
    { icon: 'chatbubble-ellipses-outline', route: { pathname: '/media/[id]', params: { id: String(tutorialMovie.id), data: JSON.stringify(tutorialMovie), tutorialTarget: 'comments' } } as Href, placement: 'middle', title: 'Comments', body: 'After watching, rate and write spoiler-free comments in this area.' },
    { icon: 'people-outline', route: { pathname: '/(tabs)/profile', params: { tutorialTarget: 'friends' } } as Href, placement: 'middle', title: 'Friends', body: 'Set a username, then search friends and send requests here.' },
  ] : [
    { icon: 'search-outline', route: '/(tabs)/discover' as Href, placement: 'bottom', title: 'Keşfet', body: 'Film ve dizi ara. Detayda sezonları, bölümleri ve puanları gör.' },
    { icon: 'heart-outline', route: '/(tabs)/library' as Href, placement: 'bottom', title: 'Listem', body: 'İzliyorum, izleyeceğim, tamamlandı ve bıraktım dediklerin burada.' },
    { icon: 'calendar-outline', route: '/(tabs)/releases' as Href, placement: 'bottom', title: 'Bölümler', body: 'Takip ettiğin dizilerin yeni ve yaklaşan bölümleri burada.' },
    { icon: 'chatbubble-ellipses-outline', route: { pathname: '/media/[id]', params: { id: String(tutorialMovie.id), data: JSON.stringify(tutorialMovie), tutorialTarget: 'comments' } } as Href, placement: 'middle', title: 'Yorum ve puan', body: 'İzledikten sonra puan ve spoiler vermeyen yorumu bu alandan ekle.' },
    { icon: 'people-outline', route: { pathname: '/(tabs)/profile', params: { tutorialTarget: 'friends' } } as Href, placement: 'middle', title: 'Arkadaşlar', body: 'Kullanıcı adı belirle, sonra arkadaşını burada ara ve istek gönder.' },
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

  return <View pointerEvents="box-none" style={[styles.overlay, styles[step.placement]]}>
    <View pointerEvents="box-none" style={styles.backdrop}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.icon}><Ionicons name={step.icon} size={17} color="#fff" /></View>
          <View style={styles.copy}>
            <View style={styles.brandRow}><Text style={styles.logo}>episode<Text style={styles.dot}>.</Text></Text><Text style={styles.stepText}>{index + 1}/{steps.length}</Text></View>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.body}>{step.body}</Text>
          </View>
        </View>
        <View style={styles.dots}>{steps.map((_, dotIndex) => <View key={dotIndex} style={[styles.dotItem, dotIndex === index && styles.dotActive]} />)}</View>
        <View style={styles.actions}>
          <Pressable onPress={onFinish} style={styles.skip}><Text style={styles.skipText}>{en ? 'Skip' : 'Geç'}</Text></Pressable>
          <Pressable onPress={advance} style={styles.next}><Text style={styles.nextText}>{isLast ? (en ? 'Start' : 'Başla') : (en ? 'Next' : 'İlerle')}</Text></Pressable>
        </View>
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 999 },
  top: { justifyContent: 'flex-start' },
  middle: { justifyContent: 'center' },
  bottom: { justifyContent: 'flex-end' },
  backdrop: { paddingHorizontal: spacing.md, paddingBottom: 100 },
  card: { width: '100%', maxWidth: 420, alignSelf: 'center', borderRadius: 16, backgroundColor: 'rgba(17,17,22,.97)', borderWidth: 1, borderColor: colors.border, padding: spacing.md, shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 12 },
  headerRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  copy: { flex: 1 },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { color: colors.text, fontSize: 13, fontWeight: '900', letterSpacing: -0.4 },
  dot: { color: colors.primary },
  stepText: { color: colors.muted, fontSize: 10, fontWeight: '900' },
  icon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 16, lineHeight: 20, fontWeight: '900', marginTop: 3 },
  body: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  dots: { flexDirection: 'row', gap: 5, marginTop: spacing.sm, alignSelf: 'center' },
  dotItem: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { width: 16, backgroundColor: colors.primary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, alignSelf: 'stretch' },
  skip: { flex: 1, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  skipText: { color: colors.muted, fontWeight: '800', fontSize: 12 },
  next: { flex: 1, height: 36, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  nextText: { color: '#fff', fontWeight: '900', fontSize: 12 },
});
