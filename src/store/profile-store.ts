import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Media } from '@/domain/media';

export type AppLanguage = 'tr' | 'en';

type ProfileState = {
  id: string;
  firstName: string;
  lastName: string;
  language: AppLanguage;
  coverUrl?: string;
  favorites: Media[];
  setName: (firstName: string, lastName: string) => void;
  setLanguage: (language: AppLanguage) => void;
  setCover: (coverUrl: string) => void;
  toggleFavorite: (media: Media) => void;
  isFavorite: (mediaId: number) => boolean;
  mergeRemote: (profile: { firstName: string; lastName: string; language: AppLanguage; coverUrl?: string; favorites: Media[] }) => void;
  clearUserData: () => void;
};

const createLocalProfileId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const useProfileStore = create<ProfileState>()(persist((set, get) => ({
  id: createLocalProfileId(), firstName: '', lastName: '', language: 'tr', coverUrl: undefined, favorites: [],
  setName: (firstName, lastName) => set({ firstName: firstName.trim(), lastName: lastName.trim() }),
  setLanguage: (language) => set({ language }),
  setCover: (coverUrl) => set({ coverUrl }),
  toggleFavorite: (media) => set((state) => ({ favorites: state.favorites.some((item) => item.id === media.id) ? state.favorites.filter((item) => item.id !== media.id) : [...state.favorites, media] })),
  isFavorite: (mediaId) => get().favorites.some((item) => item.id === mediaId),
  mergeRemote: (remote) => set((state) => ({
    firstName: state.firstName || remote.firstName,
    lastName: state.lastName || remote.lastName,
    language: state.language ?? remote.language,
    coverUrl: state.coverUrl || remote.coverUrl,
    favorites: [...remote.favorites, ...state.favorites].filter((media, index, all) => all.findIndex((item) => item.id === media.id && item.type === media.type) === index),
  })),
  clearUserData: () => set((state) => ({ firstName: '', lastName: '', coverUrl: undefined, favorites: [], language: state.language })),
}), { name: 'episode-profile-v1', storage: createJSONStorage(() => AsyncStorage) }));
