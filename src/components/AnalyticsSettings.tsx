import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useProfileStore } from '@/store/profile-store';
import { setAnalyticsPreference, useAnalyticsState } from '@/features/analytics/analytics-service';
import { colors, radius, spacing } from '@/theme/tokens';

export function AnalyticsSettings() {
  const state = useAnalyticsState();
  const en = useProfileStore((profile) => profile.language === 'en');
  if (!state.userId) return null;
  return <View style={styles.panel}>
    <View style={styles.row}><Text style={styles.heading}>{en ? 'Usage analytics' : 'Kullanım analitiği'}</Text><Switch accessibilityLabel={en ? 'Usage analytics' : 'Kullanım analitiği'} value={state.enabled} disabled={!state.ready || state.saving} onValueChange={(enabled) => { void setAnalyticsPreference(enabled); }} trackColor={{ true: colors.primary }} /></View>
    <Text style={styles.body}>{en ? 'Optional. Share app sessions, time in the foreground and feature usage counts to help improve Episode. Search text, viewing lists and comments are not collected. Turning this off removes your identifiable analytics records.' : 'İsteğe bağlıdır. Episode’u geliştirmek için oturum, uygulamanın önde kaldığı süre ve özellik kullanım sayılarını paylaşır. Arama metni, izleme listesi ve yorum içeriği toplanmaz. Kapatıldığında kimliğine bağlı analitik kayıtları kaldırılır.'}</Text>
    {state.error && <Pressable accessibilityRole="button" onPress={() => { void setAnalyticsPreference(state.enabled); }}><Text style={styles.error}>{en ? 'Your setting could not be synced. Tap to retry.' : 'Ayarın sunucuyla eşitlenemedi. Yeniden denemek için dokun.'}</Text></Pressable>}
  </View>;
}
const styles = StyleSheet.create({ panel: { marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, heading: { color: colors.text, fontSize: 17, fontWeight: '800', flexShrink: 1 }, body: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: spacing.sm }, error: { color: colors.primary, fontSize: 13, lineHeight: 20, marginTop: spacing.sm } });
