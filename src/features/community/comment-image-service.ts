import { decode } from 'base64-arraybuffer';
import { requireSupabase } from '@/infrastructure/supabase/client';

export async function uploadCommentImage(input: { userId: string; base64: string; mimeType?: string }): Promise<string> {
  const client = requireSupabase();
  const mimeType = input.mimeType === 'image/png' || input.mimeType === 'image/webp' ? input.mimeType : 'image/jpeg';
  const extension = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
  const path = `${input.userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const { error } = await client.storage.from('comment-images').upload(path, decode(input.base64), { contentType: mimeType, upsert: false });
  if (error) throw error;
  return client.storage.from('comment-images').getPublicUrl(path).data.publicUrl;
}
