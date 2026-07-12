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
  deletedCommentIds: string[];
  addComment: (targetKey: string, authorId: string, author: string, text: string) => CommunityComment;
  discardComment: (commentId: string) => void;
  removeComment: (commentId: string) => void;
  acknowledgeCommentDeletion: (commentId: string) => void;
  rate: (targetKey: string, rating: number) => void;
  clearUserData: () => void;
};

const createUuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
  const random = Math.floor(Math.random() * 16);
  const value = character === 'x' ? random : (random & 0x3) | 0x8;
  return value.toString(16);
});

export const useCommunityStore = create<CommunityState>()(persist((set) => ({
  comments: [], ratings: {}, deletedCommentIds: [],
  addComment: (targetKey, authorId, author, text) => {
    const comment = { id: createUuid(), targetKey, authorId, author: author.trim() || 'Episode User', text: text.trim(), createdAt: new Date().toISOString() };
    set((state) => ({ comments: [comment, ...state.comments] }));
    return comment;
  },
  discardComment: (commentId) => set((state) => ({ comments: state.comments.filter((comment) => comment.id !== commentId) })),
  removeComment: (commentId) => set((state) => ({
    comments: state.comments.filter((comment) => comment.id !== commentId),
    deletedCommentIds: state.deletedCommentIds.includes(commentId) ? state.deletedCommentIds : [...state.deletedCommentIds, commentId],
  })),
  acknowledgeCommentDeletion: (commentId) => set((state) => ({ deletedCommentIds: state.deletedCommentIds.filter((id) => id !== commentId) })),
  rate: (targetKey, rating) => set((state) => ({ ratings: { ...state.ratings, [targetKey]: Math.max(1, Math.min(10, rating)) } })),
  clearUserData: () => set({ comments: [], ratings: {}, deletedCommentIds: [] }),
}), {
  name: 'episode-community-v1',
  version: 2,
  storage: createJSONStorage(() => AsyncStorage),
  migrate: (persisted) => ({ ...(persisted as CommunityState), deletedCommentIds: (persisted as Partial<CommunityState>).deletedCommentIds ?? [] }),
}));
