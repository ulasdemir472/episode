import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCommunityStore } from '@/store/community-store';
import { useProfileStore } from '@/store/profile-store';
import { colors, radius, spacing } from '@/theme/tokens';
import { MotionPressable } from '@/components/MotionPressable';
import { useScrollToScreenEnd } from '@/components/Screen';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchCommunitySnapshot, persistComment, persistRating, softDeleteComment } from '@/features/community/community-repository';
import { isSupabaseConfigured, supabase } from '@/infrastructure/supabase/client';

export function CommunityPanel({ targetKey, title, canReview }: { targetKey: string; title?: string; canReview: boolean }) {
  const [text, setText] = useState('');
  const allComments = useCommunityStore((state) => state.comments);
  const localComments = useMemo(() => allComments.filter((comment) => comment.targetKey === targetKey), [allComments, targetKey]);
  const localRating = useCommunityStore((state) => state.ratings[targetKey]);
  const addComment = useCommunityStore((state) => state.addComment);
  const removeComment = useCommunityStore((state) => state.removeComment);
  const rate = useCommunityStore((state) => state.rate);
  const profile = useProfileStore();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const communityQuery = useQuery({ queryKey: ['community', targetKey], queryFn: () => fetchCommunitySnapshot(targetKey), enabled: isSupabaseConfigured, staleTime: 30_000 });
  const comments = useMemo(() => {
    const merged = [...(communityQuery.data?.comments ?? []), ...localComments];
    return merged.filter((comment, index) => merged.findIndex((item) => item.id === comment.id) === index);
  }, [communityQuery.data?.comments, localComments]);
  const rating = auth.user ? communityQuery.data?.ratings.find((item) => item.userId === auth.user!.id)?.score ?? localRating : localRating;
  const canInteract = Boolean(auth.user && canReview);
  const scrollToScreenEnd = useScrollToScreenEnd();
  const en = profile.language === 'en';
  const author = `${profile.firstName} ${profile.lastName}`.trim() || (en ? 'Episode User' : 'Episode Kullanıcısı');
  const openAuth = () => router.push('/auth' as Href);

  useEffect(() => {
    const client = supabase;
    if (!client || !isSupabaseConfigured) return;
    const channel = client
      .channel(`community:${targetKey}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `target_key=eq.${targetKey}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['community', targetKey] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ratings', filter: `target_key=eq.${targetKey}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['community', targetKey] });
      })
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [queryClient, targetKey]);

  const submit = async () => {
    if (!auth.user) { openAuth(); return; }
    if (!canReview || !text.trim()) return;
    const comment = addComment(targetKey, auth.user.id, author, text);
    setText('');
    try {
      await persistComment(comment);
      await queryClient.invalidateQueries({ queryKey: ['community', targetKey] });
    } catch {
      Alert.alert('Yorum cihazda saklandı', 'Sunucuya gönderilemedi. Bağlantı veya veritabanı kurallarını kontrol et.');
    }
  };
  const submitRating = async (score: number) => {
    if (!auth.user) { openAuth(); return; }
    if (!canReview) return;
    rate(targetKey, score);
    try {
      await persistRating(auth.user.id, targetKey, score);
      await queryClient.invalidateQueries({ queryKey: ['community', targetKey] });
    } catch {
      Alert.alert('Puan cihazda saklandı', 'Sunucuya gönderilemedi. Bağlantı veya veritabanı kurallarını kontrol et.');
    }
  };
  const confirmRemove = (commentId: string) => Alert.alert(en ? 'Delete comment?' : 'Yorum silinsin mi?', en ? 'This action cannot be undone.' : 'Bu işlem geri alınamaz.', [
    { text: en ? 'Cancel' : 'İptal', style: 'cancel' },
    { text: en ? 'Delete' : 'Sil', style: 'destructive', onPress: async () => {
      removeComment(commentId);
      if (auth.user) await softDeleteComment(auth.user.id, commentId).catch(() => undefined);
      await queryClient.invalidateQueries({ queryKey: ['community', targetKey] });
    } },
  ]);

  return <View style={styles.root}>
    <Text style={styles.title}>{title ?? (en ? 'Ratings & comments' : 'Puanlar ve yorumlar')}</Text>
    <Text style={styles.label}>{en ? 'Your rating' : 'Puanın'} {rating ? `· ${rating}/10` : ''}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ratings}>{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <MotionPressable key={value} accessibilityLabel={en ? `Rate ${value} out of 10` : `${value} puan ver`} disabled={!canInteract} onPress={() => submitRating(value)} style={[styles.rating, rating === value && styles.ratingActive]}><Text style={[styles.ratingText, rating === value && styles.ratingTextActive]}>{value}</Text></MotionPressable>)}</ScrollView>
    {comments.length === 0 ? <Text style={styles.empty}>{en ? 'No comments yet.' : 'Henüz yorum yok.'}</Text> : comments.map((comment) => <View key={comment.id} style={styles.comment}><View style={styles.commentHead}><Text style={styles.author}>{comment.author}</Text><View style={styles.commentTools}><Text style={styles.date}>{new Date(comment.createdAt).toLocaleDateString(en ? 'en-US' : 'tr-TR')}</Text>{(!comment.authorId || comment.authorId === profile.id || comment.authorId === auth.user?.id) && <MotionPressable accessibilityLabel={en ? 'Delete comment' : 'Yorumu sil'} onPress={() => confirmRemove(comment.id)} style={styles.delete}><Ionicons name="trash-outline" size={14} color={colors.primary} /></MotionPressable>}</View></View><Text style={styles.commentText}>{comment.text}</Text></View>)}
    {!auth.user ? <View style={styles.locked}><Ionicons name="person-circle-outline" size={18} color={colors.warning} /><Text style={styles.lockedText}>{en ? 'Sign in to rate or comment.' : 'Puanlamak veya yorum yapmak için giriş yapmalısın.'}</Text><MotionPressable onPress={openAuth} style={styles.login}><Text style={styles.loginText}>{en ? 'Sign in' : 'Giriş'}</Text></MotionPressable></View> : canReview ? <View style={styles.composer}><TextInput value={text} onChangeText={setText} onFocus={scrollToScreenEnd} multiline placeholder={en ? 'Write a spoiler-free comment…' : 'Spoiler vermeden yorum yaz…'} placeholderTextColor={colors.muted} style={styles.input} /><MotionPressable accessibilityLabel={en ? 'Send comment' : 'Yorumu gönder'} onPress={submit} style={styles.send}><Ionicons name="send" size={17} color="#fff" /></MotionPressable></View> : <View style={styles.locked}><Ionicons name="lock-closed" size={16} color={colors.warning} /><Text style={styles.lockedText}>{en ? 'You need to watch this title or episode before rating or commenting.' : 'Puanlamak veya yorum yapmak için önce bu yapımı ya da bölümü izlemelisin.'}</Text></View>}
  </View>;
}

const styles = StyleSheet.create({
  root: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border }, title: { color: colors.text, fontSize: 20, fontWeight: '900' }, label: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: spacing.md }, ratings: { gap: 6, paddingVertical: spacing.sm }, rating: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, ratingActive: { backgroundColor: colors.warning, borderColor: colors.warning }, ratingText: { color: colors.muted, fontSize: 11, fontWeight: '800' }, ratingTextActive: { color: colors.background }, composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.md }, input: { flex: 1, minHeight: 48, maxHeight: 110, color: colors.text, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 12 }, send: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, locked: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, marginTop: spacing.md, borderRadius: radius.md, backgroundColor: 'rgba(248,193,92,.08)', borderWidth: 1, borderColor: 'rgba(248,193,92,.22)' }, lockedText: { flex: 1, color: colors.warning, fontSize: 11, lineHeight: 16, fontWeight: '700' }, login: { borderRadius: radius.pill, backgroundColor: colors.warning, paddingHorizontal: 12, paddingVertical: 7 }, loginText: { color: colors.background, fontSize: 10, fontWeight: '900' }, empty: { color: colors.muted, fontSize: 12, marginVertical: spacing.lg }, comment: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm }, commentHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, commentTools: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, author: { color: colors.text, fontSize: 12, fontWeight: '800' }, date: { color: colors.muted, fontSize: 9 }, delete: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,90,71,.1)', alignItems: 'center', justifyContent: 'center' }, commentText: { color: '#C7C5CA', fontSize: 13, lineHeight: 19, marginTop: 7 },
});
