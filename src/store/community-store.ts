import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface CommunityComment {
  id: string;
  targetKey: string;
  authorId?: string;
  author: string;
  text: string;
  createdAt: string;
}

type CommunityState = {
  comments: CommunityComment[];
  ratings: Record<string, number>;
  addComment: (targetKey: string, authorId: string, author: string, text: string) => void;
  removeComment: (commentId: string) => void;
  rate: (targetKey: string, rating: number) => void;
};

export const useCommunityStore = create<CommunityState>()(persist((set) => ({
  comments: [], ratings: {},
  addComment: (targetKey, authorId, author, text) => set((state) => ({ comments: [{ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, targetKey, authorId, author: author.trim() || 'Episode User', text: text.trim(), createdAt: new Date().toISOString() }, ...state.comments] })),
  removeComment: (commentId) => set((state) => ({ comments: state.comments.filter((comment) => comment.id !== commentId) })),
  rate: (targetKey, rating) => set((state) => ({ ratings: { ...state.ratings, [targetKey]: Math.max(1, Math.min(10, rating)) } })),
}), { name: 'episode-community-v1', storage: createJSONStorage(() => AsyncStorage) }));
