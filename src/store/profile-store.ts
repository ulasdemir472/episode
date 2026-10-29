import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Media, MediaRef, mediaKey, sameMedia } from '@/domain/media';
import { acknowledge, changedKeys, ChangeJournal, revision } from '@/features/sync/change-journal';

export type AppLanguage = 'tr' | 'en';

type ProfileState = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  language: AppLanguage;
  visibility: 'private' | 'friends' | 'members';
  setVisibility: (visibility: 'private' | 'friends' | 'members') => void;
  avatarUrl?: string;
  coverUrl?: string;
  favorites: Media[];
  hasSeenTutorial: boolean;
  pendingChanges: ChangeJournal;
  ownerId?: string;
  bindUser: (userId: string) => void;
  acknowledgeChanges: (sent: ChangeJournal) => void;
  setProfileDetails: (details: { firstName: string; lastName: string; username: string; avatarUrl?: string }) => void;
  setName: (firstName: string, lastName: string) => void;
  setAvatar: (avatarUrl?: string) => void;
  setLanguage: (language: AppLanguage) => void;
  setCover: (coverUrl?: string) => void;
  completeTutorial: () => void;
  toggleFavorite: (media: Media) => void;
  isFavorite: (media: MediaRef) => boolean;
  mergeRemote: (profile: { username: string; firstName: string; lastName: string; language: AppLanguage; visibility?: 'private' | 'friends' | 'members'; avatarUrl?: string; coverUrl?: string; favorites: Media[] }) => void;
  clearUserData: () => void;
};

const createLocalProfileId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const normalizeUsername = (username: string) => username.trim().toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 24);
const profileFields = ['username', 'firstName', 'lastName', 'language', 'avatarUrl', 'coverUrl', 'visibility'] as const;
const emptyProfile = () => ({ username: '', firstName: '', lastName: '', language: 'tr' as AppLanguage, visibility: 'members' as const, avatarUrl: undefined as string | undefined, coverUrl: undefined as string | undefined, favorites: [] as Media[], hasSeenTutorial: false, pendingChanges: {} as ChangeJournal });

function journal(state: ProfileState, patch: Partial<ProfileState>): Partial<ProfileState> {
  const pendingChanges = { ...state.pendingChanges };
  for (const field of profileFields) if (field in patch && patch[field] !== state[field]) pendingChanges[`profile:${field}`] = revision();
  if (patch.favorites) for (const key of changedKeys(state.favorites, patch.favorites, mediaKey)) pendingChanges[`favorite:${key}`] = revision();
  return { ...patch, pendingChanges };
}

export const useProfileStore = create<ProfileState>()(persist((set, get) => ({
  id: createLocalProfileId(), ...emptyProfile(),
  bindUser: (ownerId) => set((state) => state.ownerId && state.ownerId !== ownerId ? { ...emptyProfile(), ownerId } : { ownerId }),
  acknowledgeChanges: (sent) => set((state) => ({ pendingChanges: acknowledge(state.pendingChanges, sent) })),
  setProfileDetails: ({ firstName, lastName, username, avatarUrl }) => set((state) => journal(state, { firstName: firstName.trim(), lastName: lastName.trim(), username: normalizeUsername(username), avatarUrl: avatarUrl?.trim() || undefined })),
  setName: (firstName, lastName) => set((state) => journal(state, { firstName: firstName.trim(), lastName: lastName.trim() })),
  setAvatar: (avatarUrl) => set((state) => journal(state, { avatarUrl: avatarUrl?.trim() || undefined })),
  setLanguage: (language) => set((state) => journal(state, { language })),
  setVisibility: (visibility) => set((state) => journal(state, { visibility })),
  setCover: (coverUrl) => set((state) => journal(state, { coverUrl: coverUrl?.trim() || undefined })),
  completeTutorial: () => set({ hasSeenTutorial: true }),
  toggleFavorite: (media) => set((state) => journal(state, { favorites: state.favorites.some((item) => sameMedia(item, media)) ? state.favorites.filter((item) => !sameMedia(item, media)) : [...state.favorites, media] })),
  isFavorite: (media) => get().favorites.some((item) => sameMedia(item, media)),
  mergeRemote: (remote) => set((state) => ({
    ...Object.fromEntries(profileFields.map((field) => [field, state.pendingChanges[`profile:${field}`] ? state[field] : field === 'visibility' ? remote.visibility ?? 'members' : remote[field]])),
    favorites: [...remote.favorites.filter((media) => !state.pendingChanges[`favorite:${mediaKey(media)}`]), ...state.favorites.filter((media) => state.pendingChanges[`favorite:${mediaKey(media)}`])],
  })),
  clearUserData: () => set((state) => ({ ...emptyProfile(), ownerId: undefined, language: state.language })),
}), { name: 'episode-profile-v1', version: 1, storage: createJSONStorage(() => AsyncStorage), migrate: (persisted) => {
  const state = persisted as ProfileState;
  const pendingChanges = { ...state.pendingChanges };
  for (const field of profileFields) if (state[field] && field !== 'language') pendingChanges[`profile:${field}`] ??= revision();
  for (const media of state.favorites ?? []) pendingChanges[`favorite:${mediaKey(media)}`] ??= revision();
  return { ...emptyProfile(), ...state, pendingChanges };
} }));
