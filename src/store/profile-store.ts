import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Media } from '@/domain/media';

export type AppLanguage = 'tr' | 'en';

type ProfileState = {
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
};

export const useProfileStore = create<ProfileState>()(persist((set, get) => ({
  firstName: '', lastName: '', language: 'tr', coverUrl: undefined, favorites: [],
  setName: (firstName, lastName) => set({ firstName: firstName.trim(), lastName: lastName.trim() }),
  setLanguage: (language) => set({ language }),
  setCover: (coverUrl) => set({ coverUrl }),
  toggleFavorite: (media) => set((state) => ({ favorites: state.favorites.some((item) => item.id === media.id) ? state.favorites.filter((item) => item.id !== media.id) : [...state.favorites, media] })),
  isFavorite: (mediaId) => get().favorites.some((item) => item.id === mediaId),
}), { name: 'episode-profile-v1', storage: createJSONStorage(() => AsyncStorage) }));

