import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { PersonSummary } from '@/domain/person';
import { colors, radius, spacing } from '@/theme/tokens';

export function PersonPortrait({ person, large = false }: { person: PersonSummary; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <View style={[styles.portrait, large && styles.largePortrait]}>
    {person.profileUrl && !failed
      ? <Image accessibilityLabel={person.name} source={{ uri: person.profileUrl }} style={StyleSheet.absoluteFill} onError={() => setFailed(true)} />
      : <Ionicons name="person-outline" size={large ? 48 : 30} color={colors.muted} />}
  </View>;
}

export function PeopleCredits({ title, people, language }: { title: string; people: PersonSummary[]; language: 'tr' | 'en' }) {
  if (!people.length) return null;
  return <View style={styles.section}><Text style={styles.heading}>{title}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.people}>
      {people.map(person => <Pressable key={person.id} accessibilityRole="button" accessibilityLabel={language === 'en' ? `View ${person.name} filmography` : `${person.name} filmografisini aç`} onPress={() => router.push({ pathname: '/person/[id]', params: { id: String(person.id) } })} style={styles.person}>
        <PersonPortrait key={`${person.id}:${person.profileUrl}`} person={person} />
        <Text numberOfLines={2} style={styles.name}>{person.name}</Text>
        {!!person.character && <Text numberOfLines={2} style={styles.character}>{person.character}</Text>}
      </Pressable>)}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.lg }, heading: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: spacing.md },
  people: { gap: spacing.md }, person: { width: 92 },
  portrait: { width: 92, height: 120, borderRadius: radius.sm, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  largePortrait: { width: 116, height: 152, borderRadius: radius.md },
  name: { color: colors.text, fontSize: 12, fontWeight: '600', lineHeight: 17, marginTop: 8 },
  character: { color: colors.muted, fontSize: 11, lineHeight: 15, marginTop: 3 },
});
