import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Media } from '@/domain/media';

export type AppLanguage = 'tr' | 'en';

type ProfileState = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  language: AppLanguage;
  avatarUrl?: string;
  coverUrl?: string;
  favorites: Media[];
  setProfileDetails: (details: { firstName: string; lastName: string; username: string; avatarUrl?: string }) => void;
  setName: (firstName: string, lastName: string) => void;
  setAvatar: (avatarUrl?: string) => void;
  setLanguage: (language: AppLanguage) => void;
  setCover: (coverUrl: string) => void;
  toggleFavorite: (media: Media) => void;
  isFavorite: (mediaId: number) => boolean;
  mergeRemote: (profile: { username: string; firstName: string; lastName: string; language: AppLanguage; avatarUrl?: string; coverUrl?: string; favorites: Media[] }) => void;
  clearUserData: () => void;
};

const createLocalProfileId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const normalizeUsername = (username: string) => username.trim().toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 24);

export const useProfileStore = create<ProfileState>()(persist((set, get) => ({
  id: createLocalProfileId(), username: '', firstName: '', lastName: '', language: 'tr', avatarUrl: undefined, coverUrl: undefined, favorites: [],
  setProfileDetails: ({ firstName, lastName, username, avatarUrl }) => set({ firstName: firstName.trim(), lastName: lastName.trim(), username: normalizeUsername(username), avatarUrl: avatarUrl?.trim() || undefined }),
  setName: (firstName, lastName) => set({ firstName: firstName.trim(), lastName: lastName.trim() }),
  setAvatar: (avatarUrl) => set({ avatarUrl: avatarUrl?.trim() || undefined }),
  setLanguage: (language) => set({ language }),
  setCover: (coverUrl) => set({ coverUrl }),
  toggleFavorite: (media) => set((state) => ({ favorites: state.favorites.some((item) => item.id === media.id) ? state.favorites.filter((item) => item.id !== media.id) : [...state.favorites, media] })),
  isFavorite: (mediaId) => get().favorites.some((item) => item.id === mediaId),
  mergeRemote: (remote) => set((state) => ({
    username: state.username || remote.username,
    firstName: state.firstName || remote.firstName,
    lastName: state.lastName || remote.lastName,
    language: state.language ?? remote.language,
    avatarUrl: state.avatarUrl || remote.avatarUrl,
    coverUrl: state.coverUrl || remote.coverUrl,
    favorites: [...remote.favorites, ...state.favorites].filter((media, index, all) => all.findIndex((item) => item.id === media.id && item.type === media.type) === index),
  })),
  clearUserData: () => set((state) => ({ username: '', firstName: '', lastName: '', avatarUrl: undefined, coverUrl: undefined, favorites: [], language: state.language })),
}), { name: 'episode-profile-v1', storage: createJSONStorage(() => AsyncStorage) }));
