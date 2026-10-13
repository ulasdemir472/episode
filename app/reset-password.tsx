import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { MotionPressable } from '@/components/MotionPressable';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ResetPasswordScreen() {
  const auth = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isMinLength = password.length >= 6;
  const isMatching = password.length > 0 && password === confirmPassword;
  const canSubmit = isMinLength && isMatching && !submitting;

  const handleUpdatePassword = async () => {
    if (!isMinLength) {
      Alert.alert('Geçersiz şifre', 'Şifren en az 6 karakterden oluşmalıdır.');
      return;
    }
    if (!isMatching) {
      Alert.alert('Şifreler eşleşmiyor', 'Girdiğin şifreler birbiriyle uyuşmuyor.');
      return;
    }

    setSubmitting(true);
    const result = await auth.updatePassword(password);
    setSubmitting(false);

    if (result.error) {
      Alert.alert('Şifre güncellenemedi', result.error);
      return;
    }

    Alert.alert(
      'Şifren yenilendi',
      'Yeni şifren başarıyla kaydedildi.',
      [
        {
          text: 'Tamam',
          onPress: () => {
            if (auth.user) {
              router.replace('/(tabs)');
            } else {
              router.replace('/auth');
            }
          },
        },
      ]
    );
  };

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(auth.user ? '/(tabs)' : '/auth');
    }
  };

  return (
    <Screen keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <MotionPressable onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </MotionPressable>
        <Text style={styles.logo}>
          episode<Text style={styles.dot}>.</Text>
        </Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.body}>
        <Text style={styles.kicker}>GÜVENLİK</Text>
        <Text style={styles.title}>Yeni şifre belirle</Text>
        <Text style={styles.subtitle}>
          Hesabını korumak için en az 6 karakterli güçlü yeni bir şifre gir.
        </Text>

        <View style={styles.inputWrapper}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Yeni şifre"
            placeholderTextColor={colors.muted}
            secureTextEntry={!showPassword}
            textContentType="newPassword"
            style={styles.input}
          />
          <MotionPressable
            onPress={() => setShowPassword((prev) => !prev)}
            style={styles.eyeIcon}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.muted}
            />
          </MotionPressable>
        </View>

        <View style={styles.inputWrapper}>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Yeni şifre (Tekrar)"
            placeholderTextColor={colors.muted}
            secureTextEntry={!showPassword}
            textContentType="newPassword"
            style={styles.input}
          />
        </View>

        <View style={styles.criteriaContainer}>
          <View style={styles.criterionRow}>
            <Ionicons
              name={isMinLength ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={isMinLength ? colors.success : colors.muted}
            />
            <Text style={[styles.criterionText, isMinLength && styles.criterionMet]}>
              En az 6 karakter
            </Text>
          </View>
          <View style={styles.criterionRow}>
            <Ionicons
              name={isMatching ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={isMatching ? colors.success : colors.muted}
            />
            <Text style={[styles.criterionText, isMatching && styles.criterionMet]}>
              Şifreler eşleşiyor
            </Text>
          </View>
        </View>

        <MotionPressable
          disabled={!canSubmit}
          onPress={handleUpdatePassword}
          style={[styles.submit, !canSubmit && styles.submitDisabled]}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Şifreyi Güncelle</Text>
          )}
        </MotionPressable>

        <MotionPressable onPress={handleGoBack} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Vazgeç</Text>
        </MotionPressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  placeholder: {
    width: 40,
  },
  logo: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
  dot: {
    color: colors.primary,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  kicker: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1.2,
    marginTop: spacing.sm,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  inputWrapper: {
    position: 'relative',
    marginBottom: spacing.sm,
  },
  input: {
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingRight: 48,
  },
  eyeIcon: {
    position: 'absolute',
    right: 14,
    top: 17,
  },
  criteriaContainer: {
    gap: 6,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    paddingHorizontal: 4,
  },
  criterionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  criterionText: {
    fontSize: 12,
    color: colors.muted,
  },
  criterionMet: {
    color: colors.text,
    fontWeight: '600',
  },
  submit: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 15,
  },
  cancelButton: {
    alignItems: 'center',
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  cancelText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
});
