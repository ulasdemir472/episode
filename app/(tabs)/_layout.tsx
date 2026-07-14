import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import { colors } from '@/theme/tokens';
import { useProfileStore } from '@/store/profile-store';

const icons = { index: ['home-outline', 'home'], discover: ['search-outline', 'search'], releases: ['calendar-outline', 'calendar'], library: ['albums-outline', 'albums'], profile: ['person-outline', 'person'] } as const;

export default function TabLayout() {
  const en = useProfileStore((state) => state.language) === 'en';
  return <Tabs detachInactiveScreens={false} screenOptions={({ route }) => ({ headerShown: false, animation: 'none', freezeOnBlur: false, sceneStyle: styles.scene, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarStyle: styles.tab, tabBarBackground: () => <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFill} />, tabBarIcon: ({ color, focused, size }) => <Ionicons name={icons[route.name as keyof typeof icons]?.[focused ? 1 : 0] ?? 'ellipse'} size={size} color={color} />, tabBarLabelStyle: styles.label })}>
    <Tabs.Screen name="index" options={{ title: en ? 'Home' : 'Ana Sayfa' }} />
    <Tabs.Screen name="discover" options={{ title: en ? 'Discover' : 'Keşfet' }} />
    <Tabs.Screen name="releases" options={{ title: en ? 'Episodes' : 'Bölümler' }} />
    <Tabs.Screen name="library" options={{ title: en ? 'Library' : 'Listem' }} />
    <Tabs.Screen name="profile" options={{ title: en ? 'Profile' : 'Profil' }} />
  </Tabs>;
}
const styles = StyleSheet.create({ scene: { backgroundColor: colors.background }, tab: { position: 'absolute', height: 82, borderTopColor: colors.border, backgroundColor: 'transparent', paddingTop: 8 }, label: { fontSize: 9, fontWeight: '700', marginTop: 2 } });
