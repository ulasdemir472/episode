import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { MotionPressable } from '@/components/MotionPressable';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfileStore } from '@/store/profile-store';
import { colors, radius, spacing } from '@/theme/tokens';

export default function AuthScreen() {
  const en = useProfileStore((state) => state.language) === 'en';
  const auth = useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp' | 'forgotPassword'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (mode === 'forgotPassword') {
      if (!email.trim() || !email.includes('@')) {
        Alert.alert(en ? 'Check details' : 'Bilgileri kontrol et', en ? 'Please enter a valid email address.' : 'Lütfen geçerli bir e-posta adresi gir.');
        return;
      }
      setSubmitting(true);
      const result = await auth.resetPassword(email);
      setSubmitting(false);
      if (result.error) {
        Alert.alert(en ? 'Action failed' : 'İşlem tamamlanamadı', result.error);
        return;
      }
      Alert.alert(
        en ? 'Reset link sent' : 'Sıfırlama bağlantısı gönderildi',
        en ? 'Password reset link has been sent to your email address. Please check your inbox and spam folder.' : 'Şifre sıfırlama bağlantısı e-posta adresine iletildi. Lütfen gelen kutunu ve gereksiz (spam) klasörünü kontrol et.'
      );
      setMode('signIn');
      return;
    }

    if (!email.trim() || password.length < 6) {
      Alert.alert(en ? 'Check details' : 'Bilgileri kontrol et', en ? 'Please enter a valid email and a password of at least 6 characters.' : 'Geçerli bir e-posta ve en az 6 karakterli şifre girmelisin.');
      return;
    }
    setSubmitting(true);
    const result = mode === 'signIn' ? await auth.signIn(email, password) : await auth.signUp(email, password);
    setSubmitting(false);
    if (result.error) {
      Alert.alert(en ? 'Action failed' : 'İşlem tamamlanamadı', result.error);
      return;
    }
    if (result.needsEmailConfirmation) {
      Alert.alert(en ? 'Verify your email' : 'E-postanı doğrula', en ? 'Tap the link we sent to activate your account, then sign in.' : 'Hesabını etkinleştirmek için gönderdiğimiz bağlantıya dokun, ardından giriş yap.');
      setMode('signIn');
      return;
    }
    router.replace('/(tabs)');
  };

  return (
    <Screen keyboardShouldPersistTaps="handled">
      <View style={styles.header}><Text style={styles.logo}>episode<Text style={styles.dot}>.</Text></Text></View>
      <View style={styles.body}>
        <Text style={styles.kicker}>{mode === 'forgotPassword' ? (en ? 'PASSWORD RESET' : 'ŞİFRE SIFIRLAMA') : (en ? 'YOUR ACCOUNT' : 'HESABIN')}</Text>
        <Text style={styles.title}>{mode === 'signIn' ? (en ? 'Welcome back' : 'Tekrar hoş geldin') : mode === 'signUp' ? (en ? 'Join Episode' : 'Episode’a katıl') : (en ? 'Reset password' : 'Şifreni sıfırla')}</Text>
        <Text style={styles.subtitle}>{mode === 'forgotPassword' ? (en ? 'Enter your registered email address. We will send you a link to reset your password.' : 'Kayıtlı e-posta adresini gir. Sana şifreni yenileyebileceğin bir bağlantı göndereceğiz.') : (en ? 'Keep your library, watch history, ratings, and comments in sync across all devices.' : 'Listeni, izleme geçmişini, puanlarını ve yorumlarını bütün cihazlarında koru.')}</Text>
        {!auth.configured && (
          <View style={styles.warning}>
            <Ionicons name="warning-outline" size={18} color={colors.warning} />
            <Text style={styles.warningText}>{en ? 'Episode cannot connect right now. Please try again later.' : 'Episode şu anda bağlanamıyor. Lütfen daha sonra tekrar dene.'}</Text>
          </View>
        )}
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={en ? 'Email' : 'E-posta'}
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          style={styles.input}
        />
        {mode !== 'forgotPassword' && (
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={en ? 'Password' : 'Şifre'}
            placeholderTextColor={colors.muted}
            secureTextEntry
            textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
            style={styles.input}
          />
        )}
        {mode === 'signIn' && (
          <MotionPressable onPress={() => setMode('forgotPassword')} style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>{en ? 'Forgot password?' : 'Şifremi unuttum'}</Text>
          </MotionPressable>
        )}
        <MotionPressable disabled={submitting || !auth.configured} onPress={submit} style={styles.submit}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>
              {mode === 'signIn' ? (en ? 'Sign in' : 'Giriş yap') : mode === 'signUp' ? (en ? 'Create account' : 'Hesap oluştur') : (en ? 'Send reset link' : 'Sıfırlama bağlantısı gönder')}
            </Text>
          )}
        </MotionPressable>
        <MotionPressable
          onPress={() => {
            if (mode === 'forgotPassword') {
              setMode('signIn');
            } else {
              setMode((current) => (current === 'signIn' ? 'signUp' : 'signIn'));
            }
          }}
          style={styles.switch}
        >
          <Text style={styles.switchText}>
            {mode === 'signIn'
              ? (en ? "Don't have an account? Sign up" : 'Hesabın yok mu? Kayıt ol')
              : mode === 'signUp'
              ? (en ? 'Already have an account? Sign in' : 'Zaten hesabın var mı? Giriş yap')
              : (en ? 'Back to sign in' : 'Giriş ekranına geri dön')}
          </Text>
        </MotionPressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.lg }, logo: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -1.4 }, dot: { color: colors.primary }, body: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl }, kicker: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.6 }, title: { color: colors.text, fontSize: 36, fontWeight: '900', letterSpacing: -1.2, marginTop: spacing.sm }, subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: spacing.md, marginBottom: spacing.xl }, warning: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: 'rgba(248,193,92,.08)', marginBottom: spacing.md }, warningText: { flex: 1, color: colors.warning, lineHeight: 18, fontSize: 12 }, input: { height: 54, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: spacing.md, marginBottom: spacing.sm }, forgotPassword: { alignSelf: 'flex-end', paddingVertical: spacing.xs, paddingHorizontal: 2, marginBottom: spacing.sm }, forgotPasswordText: { color: colors.muted, fontSize: 12, fontWeight: '700' }, submit: { height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.primary, marginTop: spacing.sm }, submitText: { color: '#fff', fontWeight: '900' }, switch: { alignItems: 'center', padding: spacing.md }, switchText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
});
