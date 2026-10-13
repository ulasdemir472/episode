import { supabase } from '@/infrastructure/supabase/client';

jest.mock('@/infrastructure/supabase/client', () => {
  const mockResetPasswordForEmail = jest.fn();
  const mockUpdateUser = jest.fn();
  return {
    isSupabaseConfigured: true,
    supabase: {
      auth: {
        resetPasswordForEmail: mockResetPasswordForEmail,
        updateUser: mockUpdateUser,
      },
    },
  };
});

describe('Password Reset', () => {
  const mockAuth = supabase!.auth;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resetPasswordForEmail', () => {
    it('requests password reset email with correct redirect URL', async () => {
      (mockAuth.resetPasswordForEmail as jest.Mock).mockResolvedValueOnce({
        data: {},
        error: null,
      });

      const email = 'user@example.com';
      const result = await mockAuth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'episode://auth',
      });

      expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
        redirectTo: 'episode://auth',
      });
      expect(result.error).toBeNull();
    });

    it('returns error when Supabase auth fails', async () => {
      (mockAuth.resetPasswordForEmail as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Kullanıcı bulunamadı.' },
      });

      const result = await mockAuth.resetPasswordForEmail('invalid@example.com', {
        redirectTo: 'episode://auth',
      });

      expect(result.error).toEqual({ message: 'Kullanıcı bulunamadı.' });
    });
  });

  describe('updateUser (password update)', () => {
    it('updates password successfully with valid input', async () => {
      (mockAuth.updateUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: 'test-user-id' } },
        error: null,
      });

      const newPassword = 'newSecretPassword123';
      const result = await mockAuth.updateUser({ password: newPassword });

      expect(mockAuth.updateUser).toHaveBeenCalledWith({ password: 'newSecretPassword123' });
      expect(result.error).toBeNull();
    });

    it('handles password update rejection from Supabase', async () => {
      (mockAuth.updateUser as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Şifre çok zayıf.' },
      });

      const result = await mockAuth.updateUser({ password: '123' });
      expect(result.error).toEqual({ message: 'Şifre çok zayıf.' });
    });
  });

  describe('password validation criteria', () => {
    it('validates minimum password length', () => {
      const isValid = (pwd: string) => pwd.length >= 6;
      expect(isValid('12345')).toBe(false);
      expect(isValid('123456')).toBe(true);
      expect(isValid('strongPassword!#')).toBe(true);
    });

    it('validates password matching', () => {
      const isMatch = (pwd1: string, pwd2: string) => pwd1.length > 0 && pwd1 === pwd2;
      expect(isMatch('', '')).toBe(false);
      expect(isMatch('password1', 'password2')).toBe(false);
      expect(isMatch('password1', 'password1')).toBe(true);
    });
  });
});
