import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCommunityStore } from '@/store/community-store';
import { useProfileStore } from '@/store/profile-store';
import { colors, radius, spacing } from '@/theme/tokens';

export function CommunityPanel({ targetKey, title }: { targetKey: string; title?: string }) {
  const [text, setText] = useState('');
  const comments = useCommunityStore((state) => state.comments.filter((comment) => comment.targetKey === targetKey));
  const rating = useCommunityStore((state) => state.ratings[targetKey]);
  const addComment = useCommunityStore((state) => state.addComment);
  const rate = useCommunityStore((state) => state.rate);
  const profile = useProfileStore();
  const en = profile.language === 'en';
  const author = `${profile.firstName} ${profile.lastName}`.trim() || (en ? 'Episode User' : 'Episode Kullanıcısı');
  const submit = () => { if (!text.trim()) return; addComment(targetKey, author, text); setText(''); };

  return <View style={styles.root}>
    <Text style={styles.title}>{title ?? (en ? 'Ratings & comments' : 'Puanlar ve yorumlar')}</Text>
    <Text style={styles.label}>{en ? 'Your rating' : 'Puanın'} {rating ? `· ${rating}/10` : ''}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ratings}>{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <Pressable key={value} onPress={() => rate(targetKey, value)} style={[styles.rating, rating === value && styles.ratingActive]}><Text style={[styles.ratingText, rating === value && styles.ratingTextActive]}>{value}</Text></Pressable>)}</ScrollView>
    <View style={styles.composer}><TextInput value={text} onChangeText={setText} multiline placeholder={en ? 'Write a spoiler-free comment…' : 'Spoiler vermeden yorum yaz…'} placeholderTextColor={colors.muted} style={styles.input} /><Pressable accessibilityLabel={en ? 'Send comment' : 'Yorumu gönder'} onPress={submit} style={styles.send}><Ionicons name="send" size={17} color="#fff" /></Pressable></View>
    {comments.length === 0 ? <Text style={styles.empty}>{en ? 'No comments yet.' : 'Henüz yorum yok.'}</Text> : comments.map((comment) => <View key={comment.id} style={styles.comment}><View style={styles.commentHead}><Text style={styles.author}>{comment.author}</Text><Text style={styles.date}>{new Date(comment.createdAt).toLocaleDateString(en ? 'en-US' : 'tr-TR')}</Text></View><Text style={styles.commentText}>{comment.text}</Text></View>)}
  </View>;
}

const styles = StyleSheet.create({
  root: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border }, title: { color: colors.text, fontSize: 20, fontWeight: '900' }, label: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: spacing.md }, ratings: { gap: 6, paddingVertical: spacing.sm }, rating: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, ratingActive: { backgroundColor: colors.warning, borderColor: colors.warning }, ratingText: { color: colors.muted, fontSize: 11, fontWeight: '800' }, ratingTextActive: { color: colors.background }, composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.sm }, input: { flex: 1, minHeight: 48, maxHeight: 110, color: colors.text, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 12 }, send: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, empty: { color: colors.muted, fontSize: 12, marginTop: spacing.lg }, comment: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm }, commentHead: { flexDirection: 'row', justifyContent: 'space-between' }, author: { color: colors.text, fontSize: 12, fontWeight: '800' }, date: { color: colors.muted, fontSize: 9 }, commentText: { color: '#C7C5CA', fontSize: 13, lineHeight: 19, marginTop: 7 },
});
