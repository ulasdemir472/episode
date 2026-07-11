import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCommunityStore } from '@/store/community-store';
import { useProfileStore } from '@/store/profile-store';
import { colors, radius, spacing } from '@/theme/tokens';
import { MotionPressable } from '@/components/MotionPressable';
import { useScrollToScreenEnd } from '@/components/Screen';

export function CommunityPanel({ targetKey, title, canReview }: { targetKey: string; title?: string; canReview: boolean }) {
  const [text, setText] = useState('');
  const allComments = useCommunityStore((state) => state.comments);
  const comments = useMemo(() => allComments.filter((comment) => comment.targetKey === targetKey), [allComments, targetKey]);
  const rating = useCommunityStore((state) => state.ratings[targetKey]);
  const addComment = useCommunityStore((state) => state.addComment);
  const removeComment = useCommunityStore((state) => state.removeComment);
  const rate = useCommunityStore((state) => state.rate);
  const profile = useProfileStore();
  const scrollToScreenEnd = useScrollToScreenEnd();
  const en = profile.language === 'en';
  const author = `${profile.firstName} ${profile.lastName}`.trim() || (en ? 'Episode User' : 'Episode Kullanıcısı');
  const submit = () => { if (!canReview || !text.trim()) return; addComment(targetKey, profile.id, author, text); setText(''); };
  const confirmRemove = (commentId: string) => Alert.alert(en ? 'Delete comment?' : 'Yorum silinsin mi?', en ? 'This action cannot be undone.' : 'Bu işlem geri alınamaz.', [
    { text: en ? 'Cancel' : 'İptal', style: 'cancel' },
    { text: en ? 'Delete' : 'Sil', style: 'destructive', onPress: () => removeComment(commentId) },
  ]);

  return <View style={styles.root}>
    <Text style={styles.title}>{title ?? (en ? 'Ratings & comments' : 'Puanlar ve yorumlar')}</Text>
    <Text style={styles.label}>{en ? 'Your rating' : 'Puanın'} {rating ? `· ${rating}/10` : ''}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ratings}>{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <MotionPressable key={value} accessibilityLabel={en ? `Rate ${value} out of 10` : `${value} puan ver`} disabled={!canReview} onPress={() => rate(targetKey, value)} style={[styles.rating, rating === value && styles.ratingActive]}><Text style={[styles.ratingText, rating === value && styles.ratingTextActive]}>{value}</Text></MotionPressable>)}</ScrollView>
    {comments.length === 0 ? <Text style={styles.empty}>{en ? 'No comments yet.' : 'Henüz yorum yok.'}</Text> : comments.map((comment) => <View key={comment.id} style={styles.comment}><View style={styles.commentHead}><Text style={styles.author}>{comment.author}</Text><View style={styles.commentTools}><Text style={styles.date}>{new Date(comment.createdAt).toLocaleDateString(en ? 'en-US' : 'tr-TR')}</Text>{(!comment.authorId || comment.authorId === profile.id) && <MotionPressable accessibilityLabel={en ? 'Delete comment' : 'Yorumu sil'} onPress={() => confirmRemove(comment.id)} style={styles.delete}><Ionicons name="trash-outline" size={14} color={colors.primary} /></MotionPressable>}</View></View><Text style={styles.commentText}>{comment.text}</Text></View>)}
    {canReview ? <View style={styles.composer}><TextInput value={text} onChangeText={setText} onFocus={scrollToScreenEnd} multiline placeholder={en ? 'Write a spoiler-free comment…' : 'Spoiler vermeden yorum yaz…'} placeholderTextColor={colors.muted} style={styles.input} /><MotionPressable accessibilityLabel={en ? 'Send comment' : 'Yorumu gönder'} onPress={submit} style={styles.send}><Ionicons name="send" size={17} color="#fff" /></MotionPressable></View> : <View style={styles.locked}><Ionicons name="lock-closed" size={16} color={colors.warning} /><Text style={styles.lockedText}>{en ? 'You need to watch this title or episode before rating or commenting.' : 'Puanlamak veya yorum yapmak için önce bu yapımı ya da bölümü izlemelisin.'}</Text></View>}
  </View>;
}

const styles = StyleSheet.create({
  root: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border }, title: { color: colors.text, fontSize: 20, fontWeight: '900' }, label: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: spacing.md }, ratings: { gap: 6, paddingVertical: spacing.sm }, rating: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, ratingActive: { backgroundColor: colors.warning, borderColor: colors.warning }, ratingText: { color: colors.muted, fontSize: 11, fontWeight: '800' }, ratingTextActive: { color: colors.background }, composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.md }, input: { flex: 1, minHeight: 48, maxHeight: 110, color: colors.text, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 12 }, send: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, locked: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, marginTop: spacing.md, borderRadius: radius.md, backgroundColor: 'rgba(248,193,92,.08)', borderWidth: 1, borderColor: 'rgba(248,193,92,.22)' }, lockedText: { flex: 1, color: colors.warning, fontSize: 11, lineHeight: 16, fontWeight: '700' }, empty: { color: colors.muted, fontSize: 12, marginVertical: spacing.lg }, comment: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm }, commentHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, commentTools: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, author: { color: colors.text, fontSize: 12, fontWeight: '800' }, date: { color: colors.muted, fontSize: 9 }, delete: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,90,71,.1)', alignItems: 'center', justifyContent: 'center' }, commentText: { color: '#C7C5CA', fontSize: 13, lineHeight: 19, marginTop: 7 },
});
