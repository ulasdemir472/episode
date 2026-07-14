import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MotionPressable } from '@/components/MotionPressable';
import { useScrollToScreenEnd } from '@/components/Screen';
import { useAuth } from '@/features/auth/AuthProvider';
import { uploadCommentImage } from '@/features/community/comment-image-service';
import { CommunitySnapshot, fetchCommunitySnapshot, persistComment, persistRating, softDeleteComment, toggleCommentLike } from '@/features/community/community-repository';
import { SubmissionLock } from '@/features/community/submission-lock';
import { isSupabaseConfigured, supabase } from '@/infrastructure/supabase/client';
import { CommunityComment, useCommunityStore } from '@/store/community-store';
import { useProfileStore } from '@/store/profile-store';
import { colors, radius, spacing } from '@/theme/tokens';

export function CommunityPanel({ targetKey, title, canReview }: { targetKey: string; title?: string; canReview: boolean }) {
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<CommunityComment>();
  const [pendingImage, setPendingImage] = useState<{ uri: string; base64: string; mimeType?: string }>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionLock = useRef(new SubmissionLock());
  const allComments = useCommunityStore((state) => state.comments);
  const localComments = useMemo(() => allComments.filter((comment) => comment.targetKey === targetKey), [allComments, targetKey]);
  const localRating = useCommunityStore((state) => state.ratings[targetKey]);
  const deletedCommentIds = useCommunityStore((state) => state.deletedCommentIds);
  const profile = useProfileStore();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['community', targetKey], queryFn: () => fetchCommunitySnapshot(targetKey), enabled: isSupabaseConfigured, staleTime: 30_000 });
  const comments = useMemo(() => {
    const merged = [...(query.data?.comments ?? []), ...localComments].filter((comment) => !deletedCommentIds.includes(comment.id));
    return merged.filter((comment, index) => merged.findIndex((item) => item.id === comment.id) === index);
  }, [deletedCommentIds, localComments, query.data?.comments]);
  const roots = comments.filter((comment) => !comment.parentCommentId);
  const rating = auth.user ? query.data?.ratings.find((item) => item.userId === auth.user?.id)?.score ?? localRating : localRating;
  const canInteract = Boolean(auth.user && canReview);
  const en = profile.language === 'en';
  const scrollToEnd = useScrollToScreenEnd();
  const author = `${profile.firstName} ${profile.lastName}`.trim() || (profile.username ? `@${profile.username}` : en ? 'Episode User' : 'Episode Kullanıcısı');

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return;
    const channel = supabase.channel(`community:${targetKey}`).on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `target_key=eq.${targetKey}` }, () => queryClient.invalidateQueries({ queryKey: ['community', targetKey] })).on('postgres_changes', { event: '*', schema: 'public', table: 'ratings', filter: `target_key=eq.${targetKey}` }, () => queryClient.invalidateQueries({ queryKey: ['community', targetKey] })).on('postgres_changes', { event: '*', schema: 'public', table: 'comment_likes' }, () => queryClient.invalidateQueries({ queryKey: ['community', targetKey] })).subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [queryClient, targetKey]);

  const chooseImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('İzin gerekli', 'Yoruma fotoğraf eklemek için fotoğraf erişimine izin vermelisin.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.72, base64: true });
    if (!result.canceled && result.assets[0]?.base64) setPendingImage({ uri: result.assets[0].uri, base64: result.assets[0].base64!, mimeType: result.assets[0].mimeType });
  };

  const submit = async () => {
    if (!auth.user) { router.push('/auth' as Href); return; }
    if (!canReview || (!text.trim() && !pendingImage) || !submissionLock.current.tryAcquire()) return;
    setIsSubmitting(true);
    let imageUrl: string | undefined;
    try {
      if (pendingImage) imageUrl = await uploadCommentImage({ userId: auth.user.id, base64: pendingImage.base64, mimeType: pendingImage.mimeType });
      const comment = useCommunityStore.getState().addComment(targetKey, auth.user.id, author, text.trim() || '📷', { parentCommentId: replyTo?.id, imageUrl });
      setText(''); setPendingImage(undefined); setReplyTo(undefined);
      await persistComment(comment);
      await queryClient.invalidateQueries({ queryKey: ['community', targetKey] });
    } catch (error) {
      Alert.alert('Yorum gönderilemedi', error instanceof Error ? error.message : 'Bağlantını kontrol edip tekrar dene.');
    } finally { submissionLock.current.release(); setIsSubmitting(false); }
  };

  const submitRating = async (score: number) => {
    if (!auth.user) { router.push('/auth' as Href); return; }
    if (!canReview) return;
    useCommunityStore.getState().rate(targetKey, score);
    try { await persistRating(auth.user.id, targetKey, score); await queryClient.invalidateQueries({ queryKey: ['community', targetKey] }); }
    catch { Alert.alert('Puan cihazda saklandı', 'Sunucuya gönderilemedi.'); }
  };

  const like = async (comment: CommunityComment) => {
    if (!auth.user) { router.push('/auth' as Href); return; }
    queryClient.setQueryData<CommunitySnapshot>(['community', targetKey], (snapshot) => snapshot ? { ...snapshot, comments: snapshot.comments.map((item) => item.id === comment.id ? { ...item, likedByMe: !item.likedByMe, likeCount: Math.max(0, (item.likeCount ?? 0) + (item.likedByMe ? -1 : 1)) } : item) } : snapshot);
    try { await toggleCommentLike(auth.user.id, comment.id, Boolean(comment.likedByMe)); }
    catch { await queryClient.invalidateQueries({ queryKey: ['community', targetKey] }); }
  };

  const remove = (comment: CommunityComment) => Alert.alert('Yorum silinsin mi?', 'Bu işlem geri alınamaz.', [{ text: 'İptal', style: 'cancel' }, { text: 'Sil', style: 'destructive', onPress: async () => {
    useCommunityStore.getState().removeComment(comment.id);
    queryClient.setQueryData<CommunitySnapshot>(['community', targetKey], (snapshot) => snapshot ? { ...snapshot, comments: snapshot.comments.filter((item) => item.id !== comment.id && item.parentCommentId !== comment.id) } : snapshot);
    if (auth.user) try { await softDeleteComment(auth.user.id, comment.id); useCommunityStore.getState().acknowledgeCommentDeletion(comment.id); } catch { /* retry during sync */ }
  } }]);

  const renderComment = (comment: CommunityComment, nested = false) => <View key={comment.id} style={[styles.comment, nested && styles.reply]}>
    <View style={styles.commentHead}>
      <Pressable onPress={() => comment.authorId && router.push(`/profile/${comment.authorId}` as Href)} style={styles.authorRow}>{comment.authorAvatarUrl ? <Image source={{ uri: comment.authorAvatarUrl }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Ionicons name="person" size={12} color={colors.muted} /></View>}<Text style={styles.author}>{comment.author}</Text></Pressable>
      <Text style={styles.date}>{new Date(comment.createdAt).toLocaleDateString(en ? 'en-US' : 'tr-TR')}</Text>
    </View>
    {comment.imageUrl ? <Image source={{ uri: comment.imageUrl }} style={styles.commentImage} resizeMode="cover" /> : null}
    <Text style={styles.commentText}>{comment.text === '📷' && comment.imageUrl ? '' : comment.text}</Text>
    <View style={styles.commentActions}>
      <MotionPressable accessibilityLabel="Yorumu beğen" onPress={() => void like(comment)} style={styles.inlineAction}><Ionicons name={comment.likedByMe ? 'heart' : 'heart-outline'} size={15} color={comment.likedByMe ? colors.primary : colors.muted} /><Text style={styles.inlineText}>{comment.likeCount ?? 0}</Text></MotionPressable>
      {!nested && <MotionPressable accessibilityLabel="Yoruma yanıt ver" onPress={() => { setReplyTo(comment); scrollToEnd(); }} style={styles.inlineAction}><Ionicons name="return-down-forward-outline" size={15} color={colors.muted} /><Text style={styles.inlineText}>{en ? 'Reply' : 'Yanıtla'}</Text></MotionPressable>}
      {comment.authorId === auth.user?.id && <MotionPressable accessibilityLabel="Yorumu sil" onPress={() => remove(comment)} style={styles.inlineAction}><Ionicons name="trash-outline" size={14} color={colors.primary} /></MotionPressable>}
    </View>
    {!nested && comments.filter((item) => item.parentCommentId === comment.id).reverse().map((reply) => renderComment(reply, true))}
  </View>;

  return <View style={styles.root}>
    <View style={styles.titleRow}><Text style={styles.title}>{title ?? (en ? 'Ratings & comments' : 'Puanlar ve yorumlar')}</Text>{query.data?.averageRating ? <View style={styles.average}><Ionicons name="star" size={14} color={colors.warning} /><Text style={styles.averageText}>{query.data.averageRating}/10</Text><Text style={styles.averageCount}>({query.data.ratings.length})</Text></View> : null}</View>
    <Text style={styles.label}>{en ? 'Your rating' : 'Puanın'} {rating ? `· ${rating}/10` : ''}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ratings}>{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <MotionPressable key={value} accessibilityLabel={`${value} puan ver`} disabled={!canInteract} onPress={() => void submitRating(value)} style={[styles.rating, rating === value && styles.ratingActive]}><Text style={[styles.ratingText, rating === value && styles.ratingTextActive]}>{value}</Text></MotionPressable>)}</ScrollView>
    {roots.length === 0 ? <Text style={styles.empty}>{en ? 'No comments yet.' : 'Henüz yorum yok.'}</Text> : roots.map((comment) => renderComment(comment))}
    {!auth.user ? <Locked text={en ? 'Sign in to rate or comment.' : 'Puanlamak veya yorum yapmak için giriş yapmalısın.'} onPress={() => router.push('/auth' as Href)} /> : canReview ? <View style={styles.composerWrap}>
      {replyTo ? <View style={styles.replying}><Text style={styles.replyingText}>@{replyTo.author} yorumuna yanıt</Text><Pressable onPress={() => setReplyTo(undefined)}><Ionicons name="close" size={17} color={colors.muted} /></Pressable></View> : null}
      {pendingImage ? <View style={styles.previewWrap}><Image source={{ uri: pendingImage.uri }} style={styles.preview} /><Pressable style={styles.previewRemove} onPress={() => setPendingImage(undefined)}><Ionicons name="close" size={15} color="#fff" /></Pressable></View> : null}
      <View style={styles.composer}><MotionPressable accessibilityLabel="Fotoğraf ekle" onPress={() => void chooseImage()} style={styles.photoButton}><Ionicons name="image-outline" size={19} color={colors.text} /></MotionPressable><TextInput value={text} onChangeText={setText} onFocus={scrollToEnd} multiline placeholder={replyTo ? 'Yanıtını yaz…' : 'Spoiler vermeden yorum yaz…'} placeholderTextColor={colors.muted} style={styles.input} /><MotionPressable accessibilityLabel="Yorumu gönder" disabled={isSubmitting} onPress={() => void submit()} style={[styles.send, isSubmitting && styles.disabled]}><Ionicons name="send" size={17} color="#fff" /></MotionPressable></View>
    </View> : <Locked text={en ? 'Watch this title or episode before rating or commenting.' : 'Puanlamak veya yorum yapmak için önce bu yapımı ya da bölümü izlemelisin.'} />}
  </View>;
}

function Locked({ text, onPress }: { text: string; onPress?: () => void }) { return <View style={styles.locked}><Ionicons name={onPress ? 'person-circle-outline' : 'lock-closed'} size={17} color={colors.warning} /><Text style={styles.lockedText}>{text}</Text>{onPress ? <MotionPressable onPress={onPress} style={styles.login}><Text style={styles.loginText}>Giriş</Text></MotionPressable> : null}</View>; }

const styles = StyleSheet.create({
  root: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border }, titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }, title: { color: colors.text, fontSize: 20, fontWeight: '900', flex: 1 }, average: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(248,193,92,.1)', paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill }, averageText: { color: colors.warning, fontWeight: '900', fontSize: 12 }, averageCount: { color: colors.muted, fontSize: 9 }, label: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: spacing.md }, ratings: { gap: 6, paddingVertical: spacing.sm }, rating: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, ratingActive: { backgroundColor: colors.warning, borderColor: colors.warning }, ratingText: { color: colors.muted, fontSize: 11, fontWeight: '800' }, ratingTextActive: { color: colors.background }, empty: { color: colors.muted, fontSize: 12, marginVertical: spacing.lg },
  comment: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm }, reply: { marginLeft: spacing.lg, backgroundColor: colors.elevated, borderColor: 'rgba(255,255,255,.05)' }, commentHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }, avatar: { width: 26, height: 26, borderRadius: 13 }, avatarFallback: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' }, author: { color: colors.text, fontSize: 12, fontWeight: '800' }, date: { color: colors.muted, fontSize: 9 }, commentImage: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.sm, backgroundColor: colors.elevated, marginTop: spacing.sm }, commentText: { color: '#C7C5CA', fontSize: 13, lineHeight: 19, marginTop: 7 }, commentActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }, inlineAction: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 30 }, inlineText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  composerWrap: { marginTop: spacing.md }, composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }, input: { flex: 1, minHeight: 48, maxHeight: 110, color: colors.text, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 12 }, send: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, photoButton: { width: 42, height: 46, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: .5 }, replying: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 2, borderLeftColor: colors.primary, paddingHorizontal: spacing.sm, marginBottom: spacing.sm }, replyingText: { color: colors.muted, fontSize: 10, fontWeight: '700' }, previewWrap: { alignSelf: 'flex-start', marginBottom: spacing.sm }, preview: { width: 110, height: 76, borderRadius: radius.sm }, previewRemove: { position: 'absolute', right: -6, top: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  locked: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, marginTop: spacing.md, borderRadius: radius.md, backgroundColor: 'rgba(248,193,92,.08)', borderWidth: 1, borderColor: 'rgba(248,193,92,.22)' }, lockedText: { flex: 1, color: colors.warning, fontSize: 11, lineHeight: 16, fontWeight: '700' }, login: { borderRadius: radius.pill, backgroundColor: colors.warning, paddingHorizontal: 12, paddingVertical: 7 }, loginText: { color: colors.background, fontSize: 10, fontWeight: '900' },
});
