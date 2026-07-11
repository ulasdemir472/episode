import { decode } from 'base64-arraybuffer';
import { requireSupabase } from '@/infrastructure/supabase/client';

type UploadAvatarInput = {
  userId: string;
  base64: string;
  mimeType?: string;
};

function extensionFromMimeType(mimeType?: string): 'jpg' | 'png' | 'webp' {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

export async function uploadAvatar({ userId, base64, mimeType }: UploadAvatarInput): Promise<string> {
  const client = requireSupabase();
  const extension = extensionFromMimeType(mimeType);
  const path = `${userId}/profile.${extension}`;
  const { error } = await client.storage.from('avatars').upload(path, decode(base64), {
    cacheControl: '3600',
    contentType: mimeType ?? 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  const { data } = client.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
