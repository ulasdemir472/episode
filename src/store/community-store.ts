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
  addComment: (targetKey: string, authorId: string, author: string, text: string) => CommunityComment;
  removeComment: (commentId: string) => void;
  rate: (targetKey: string, rating: number) => void;
  clearUserData: () => void;
};

const createUuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
  const random = Math.floor(Math.random() * 16);
  const value = character === 'x' ? random : (random & 0x3) | 0x8;
  return value.toString(16);
});

export const useCommunityStore = create<CommunityState>()(persist((set) => ({
  comments: [], ratings: {},
  addComment: (targetKey, authorId, author, text) => {
    const comment = { id: createUuid(), targetKey, authorId, author: author.trim() || 'Episode User', text: text.trim(), createdAt: new Date().toISOString() };
    set((state) => ({ comments: [comment, ...state.comments] }));
    return comment;
  },
  removeComment: (commentId) => set((state) => ({ comments: state.comments.filter((comment) => comment.id !== commentId) })),
  rate: (targetKey, rating) => set((state) => ({ ratings: { ...state.ratings, [targetKey]: Math.max(1, Math.min(10, rating)) } })),
  clearUserData: () => set({ comments: [], ratings: {} }),
}), { name: 'episode-community-v1', storage: createJSONStorage(() => AsyncStorage) }));
