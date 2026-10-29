import { useState } from 'react';
import { FlatList, Keyboard, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme/tokens';

export function ChoicePicker<T extends string | number>({ label, value, options, onChange, closeLabel }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const { height } = useWindowDimensions();
  const selected = options.find((option) => option.value === value);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${selected?.label ?? ''}`} accessibilityState={{ expanded: open }} onPress={() => { Keyboard.dismiss(); setOpen(true); }} style={styles.field}>
      <View style={styles.copy}><Text style={styles.label}>{label}</Text><Text style={styles.value} numberOfLines={1}>{selected?.label}</Text></View><Ionicons name="chevron-down" color={colors.muted} size={17} />
    </Pressable>
    <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.overlay}><Pressable accessibilityLabel={closeLabel} onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.sheet, { maxHeight: height * 0.75 }]}>
          <View style={styles.heading}><Text style={styles.title}>{label}</Text><Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={() => setOpen(false)} style={styles.close}><Ionicons name="close" color={colors.text} size={24} /></Pressable></View>
          <FlatList data={options} initialNumToRender={25} keyExtractor={(item) => String(item.value)} keyboardShouldPersistTaps="handled" renderItem={({ item }) => <Pressable accessibilityRole="radio" accessibilityLabel={item.label} accessibilityState={{ checked: item.value === value }} onPress={() => { onChange(item.value); setOpen(false); }} style={[styles.option, item.value === value && styles.selected]}><Text style={styles.optionText}>{item.label}</Text>{item.value === value && <Ionicons name="checkmark" color={colors.primary} size={21} />}</Pressable>} />
        </View>
      </View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  field: { flex: 1, minHeight: 66, minWidth: 100, flexDirection: 'row', alignItems: 'center', gap: 7, padding: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  copy: { flex: 1 }, label: { color: colors.muted, fontSize: 11, marginBottom: 5 }, value: { color: colors.text, fontWeight: '700', fontSize: 13 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.65)', justifyContent: 'flex-end' }, sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: 36 }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }, title: { color: colors.text, fontWeight: '800', fontSize: 21 }, close: { padding: 8 }, option: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderRadius: radius.sm }, selected: { backgroundColor: colors.elevated }, optionText: { color: colors.text, fontSize: 15 },
});
