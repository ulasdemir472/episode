import { useState } from 'react';
import { FlatList, Image, Keyboard, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Media, mediaKey } from '@/domain/media';
import { AppLanguage } from '@/store/profile-store';
import { ContentTransition } from '@/components/ContentTransition';
import { colors, radius, spacing } from '@/theme/tokens';

export function CoverPicker({ media, selectedUrl, onSelect, language }: { media: Media[]; selectedUrl?: string; onSelect: (url: string) => void; language: AppLanguage }) {
  const en = language === 'en';
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState(selectedUrl);
  const choices = media.filter((item) => Boolean(item.backdropUrl || item.posterUrl));
  const filtered = choices.filter((item) => item.title.toLocaleLowerCase(language).includes(query.trim().toLocaleLowerCase(language)));
  const selected = choices.find((item) => (item.backdropUrl || item.posterUrl) === draft);
  const close = () => setOpen(false);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={en ? 'Choose profile cover' : 'Profil kapağı seç'} onPress={() => { Keyboard.dismiss(); setDraft(selectedUrl); setQuery(''); setOpen(true); }} style={styles.launcher}>
      {selectedUrl ? <Image source={{ uri: selectedUrl }} style={styles.thumbnail} /> : <View style={styles.placeholder}><Ionicons name="images-outline" size={28} color={colors.primary} /></View>}
      <View style={styles.copy}><Text style={styles.launchTitle}>{en ? 'Choose a cover' : 'Kapak seç'}</Text><Text style={styles.hint}>{en ? 'Browse your titles and preview the image.' : 'Yapımlarına göz at ve görseli önizle.'}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={styles.modal}>
        <View style={styles.header}><Text style={styles.title}>{en ? 'Profile cover' : 'Profil kapağı'}</Text><Pressable accessibilityRole="button" accessibilityLabel={en ? 'Close cover picker' : 'Kapak seçimini kapat'} onPress={close} style={styles.close}><Ionicons name="close" size={26} color={colors.text} /></Pressable></View>
        <ContentTransition changeKey={draft ?? 'empty'} style={styles.previewWrap}>{draft ? <Image accessibilityLabel={en ? 'Cover preview' : 'Kapak önizlemesi'} source={{ uri: draft }} resizeMode="cover" style={styles.preview} /> : <View style={[styles.preview, styles.placeholder]}><Ionicons name="image-outline" size={40} color={colors.muted} /></View>}<Text style={styles.previewTitle} numberOfLines={1}>{selected?.title ?? (en ? 'Select an image below' : 'Aşağıdan bir görsel seç')}</Text></ContentTransition>
        <View style={styles.search}><Ionicons name="search" size={19} color={colors.muted} /><TextInput accessibilityLabel={en ? 'Search cover titles' : 'Kapak yapımlarında ara'} placeholder={en ? 'Search your movies and shows…' : 'Filmlerinde ve dizilerinde ara…'} placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} style={styles.input} /></View>
        <FlatList data={filtered} numColumns={2} keyExtractor={mediaKey} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.grid} columnWrapperStyle={styles.columns} ListEmptyComponent={<Text style={styles.empty}>{choices.length ? (en ? 'No matching titles.' : 'Eşleşen yapım yok.') : (en ? 'Add a title to your library or favorites first.' : 'Önce listene veya favorilerine bir yapım ekle.')}</Text>} renderItem={({ item }) => {
          const url = item.backdropUrl || item.posterUrl;
          return <Pressable accessibilityRole="radio" accessibilityLabel={item.title} accessibilityState={{ checked: draft === url }} onPress={() => setDraft(url)} style={[styles.choice, draft === url && styles.selected]}><Image source={{ uri: url }} style={styles.choiceImage} /><View style={styles.choiceFooter}><Text style={styles.choiceTitle} numberOfLines={2}>{item.title}</Text>{draft === url && <Ionicons name="checkmark-circle" color={colors.primary} size={19} />}</View></Pressable>;
        }} />
        <Pressable accessibilityRole="button" disabled={!draft} onPress={() => { if (draft) onSelect(draft); close(); }} style={[styles.apply, !draft && { opacity: 0.4 }]}><Text style={styles.applyText}>{en ? 'Use this cover' : 'Bu kapağı kullan'}</Text></Pressable>
      </SafeAreaView>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  launcher: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, marginHorizontal: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12 }, thumbnail: { width: 82, height: 55, borderRadius: radius.sm }, placeholder: { minWidth: 70, minHeight: 55, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.elevated, borderRadius: radius.sm }, copy: { flex: 1 }, launchTitle: { color: colors.text, fontSize: 15, fontWeight: '800' }, hint: { color: colors.muted, fontSize: 12, marginTop: 5, lineHeight: 17 }, modal: { flex: 1, backgroundColor: colors.background }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }, title: { color: colors.text, fontSize: 23, fontWeight: '900' }, close: { padding: 9 }, previewWrap: { marginHorizontal: spacing.lg }, preview: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md, backgroundColor: colors.elevated }, previewTitle: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 8, minHeight: 20 }, search: { flexDirection: 'row', alignItems: 'center', gap: 9, margin: spacing.lg, paddingHorizontal: 12, minHeight: 47, borderRadius: radius.md, backgroundColor: colors.surface }, input: { flex: 1, color: colors.text, fontSize: 14 }, grid: { paddingHorizontal: spacing.lg, paddingBottom: 16 }, columns: { gap: 12 }, choice: { flex: 1, maxWidth: '49%', borderWidth: 2, borderColor: 'transparent', borderRadius: radius.md, padding: 3, marginBottom: 12 }, selected: { borderColor: colors.primary }, choiceImage: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.sm }, choiceFooter: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7 }, choiceTitle: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '700' }, apply: { margin: spacing.lg, padding: 16, backgroundColor: colors.primary, alignItems: 'center', borderRadius: radius.pill }, applyText: { color: '#fff', fontSize: 15, fontWeight: '800' }, empty: { color: colors.muted, textAlign: 'center', paddingVertical: 30 },
});
