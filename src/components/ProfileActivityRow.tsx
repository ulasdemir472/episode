import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ProfileActivity } from '@/features/friends/friends-repository';
import { parseReviewTarget } from '@/features/community/target';
import { colors, spacing } from '@/theme/tokens';
import { useProfileStore } from '@/store/profile-store';

export function ProfileActivityRow({ activity }: { activity: ProfileActivity }) {
  const en = useProfileStore((state) => state.language) === 'en';
  const target = parseReviewTarget(activity.targetKey);
  const episode = target?.targetType === 'episode' ? ` · S${target.seasonNumber} ${en ? 'E' : 'B'}${target.episodeNumber}` : '';
  const targetTitle = `${activity.media?.title ?? (en ? 'A title' : 'Bir yapım')}${episode}`;
  const date = new Date(activity.createdAt).toLocaleDateString(en ? 'en-US' : 'tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
  const openMedia = () => activity.media && router.push({ pathname: '/media/[id]', params: { id: String(activity.media.id), data: JSON.stringify(activity.media) } });
  return <Pressable disabled={!activity.media} onPress={openMedia} style={styles.activity}>
    <View style={[styles.activityIcon, activity.kind === 'rating' ? styles.ratingIcon : styles.commentIcon]}><Ionicons name={activity.kind === 'rating' ? 'star' : 'chatbubble-ellipses'} size={16} color={activity.kind === 'rating' ? colors.warning : colors.secondary} /></View>
    <View style={styles.activityCopy}>
      <Text style={styles.activityAction}>
        {activity.kind === 'rating' ? (
          en ? (
            <>Rated <Text style={styles.activityTarget}>{targetTitle}</Text> <Text style={styles.activityScore}>{activity.score}/10</Text></>
          ) : (
            <><Text style={styles.activityTarget}>{targetTitle}</Text> yapımına <Text style={styles.activityScore}>{activity.score}/10</Text> puan verdi</>
          )
        ) : (
          en ? (
            <>Commented on <Text style={styles.activityTarget}>{targetTitle}</Text></>
          ) : (
            <><Text style={styles.activityTarget}>{targetTitle}</Text> için yorum yaptı</>
          )
        )}
      </Text>
      {activity.comment ? <Text numberOfLines={3} style={styles.activityComment}>“{activity.comment}”</Text> : null}
      <Text style={styles.activityDate}>{date}</Text>
    </View>
    {activity.media ? <Ionicons name="chevron-forward" size={16} color={colors.muted} /> : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  activity: { minHeight: 76, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  activityIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, ratingIcon: { backgroundColor: 'rgba(248,193,92,.11)' }, commentIcon: { backgroundColor: 'rgba(124,92,252,.12)' }, activityCopy: { flex: 1 }, activityAction: { color: colors.muted, fontSize: 11, lineHeight: 16 }, activityTarget: { color: colors.text, fontWeight: '900' }, activityScore: { color: colors.warning, fontWeight: '900' }, activityComment: { color: '#D2D0D5', fontSize: 12, lineHeight: 17, marginTop: 5 }, activityDate: { color: colors.muted, fontSize: 9, marginTop: 6 },
});
