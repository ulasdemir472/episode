import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import { colors } from '@/theme/tokens';

const icons = { index: ['home-outline', 'home'], discover: ['search-outline', 'search'], releases: ['calendar-outline', 'calendar'], library: ['albums-outline', 'albums'] } as const;

export default function TabLayout() {
  return <Tabs screenOptions={({ route }) => ({ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarStyle: styles.tab, tabBarBackground: () => <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFill} />, tabBarIcon: ({ color, focused, size }) => <Ionicons name={icons[route.name as keyof typeof icons]?.[focused ? 1 : 0] ?? 'ellipse'} size={size} color={color} />, tabBarLabelStyle: styles.label })}>
    <Tabs.Screen name="index" options={{ title: 'Ana Sayfa' }} />
    <Tabs.Screen name="discover" options={{ title: 'Keşfet' }} />
    <Tabs.Screen name="releases" options={{ title: 'Yeni Bölümler' }} />
    <Tabs.Screen name="library" options={{ title: 'Listem' }} />
  </Tabs>;
}
const styles = StyleSheet.create({ tab: { position: 'absolute', height: 82, borderTopColor: colors.border, backgroundColor: 'transparent', paddingTop: 8 }, label: { fontSize: 10, fontWeight: '700', marginTop: 2 } });

