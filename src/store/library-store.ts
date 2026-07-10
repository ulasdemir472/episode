import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { initialLibrary } from '@/data/demo';
import { LibraryItem, LibraryStatus, Media } from '@/domain/media';

type LibraryState = {
  items: LibraryItem[];
  upsert: (media: Media, status: LibraryStatus) => void;
  remove: (mediaId: number) => void;
  isSaved: (mediaId: number) => boolean;
};

export const useLibraryStore = create<LibraryState>()(persist((set, get) => ({
  items: initialLibrary,
  upsert: (media, status) => set((state) => ({ items: [...state.items.filter((item) => item.media.id !== media.id), { media, status }] })),
  remove: (mediaId) => set((state) => ({ items: state.items.filter((item) => item.media.id !== mediaId) })),
  isSaved: (mediaId) => get().items.some((item) => item.media.id === mediaId),
}), { name: 'episode-library-v1', storage: createJSONStorage(() => AsyncStorage) }));

