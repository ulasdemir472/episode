import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { acknowledge, ChangeJournal, revision } from '@/features/sync/change-journal';

export interface CommunityComment {
  id: string;
  targetKey: string;
  authorId?: string;
  author: string;
  authorAvatarUrl?: string;
  text: string;
  createdAt: string;
  parentCommentId?: string;
  imageUrl?: string;
  likeCount?: number;
  likedByMe?: boolean;
  spoiler?: boolean;
}

type CommunityState = {
  comments: CommunityComment[];
  ratings: Record<string, number>;
  deletedCommentIds: string[];
  pendingChanges: ChangeJournal;
  ownerId?: string;
  bindUser: (userId: string) => void;
  acknowledgeChanges: (sent: ChangeJournal) => void;
  mergeRemote: (comments: CommunityComment[], ratings: Record<string, number>) => void;
  addComment: (targetKey: string, authorId: string, author: string, text: string, options?: { parentCommentId?: string; imageUrl?: string; spoiler?: boolean }) => CommunityComment;
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
  comments: [], ratings: {}, deletedCommentIds: [], pendingChanges: {},
  bindUser: (ownerId) => set((state) => state.ownerId && state.ownerId !== ownerId ? { ownerId, comments: [], ratings: {}, deletedCommentIds: [], pendingChanges: {} } : { ownerId }),
  acknowledgeChanges: (sent) => set((state) => ({ pendingChanges: acknowledge(state.pendingChanges, sent) })),
  mergeRemote: (comments, ratings) => set((state) => ({
    comments: [...comments.filter((comment) => !state.deletedCommentIds.includes(comment.id) && !state.pendingChanges[`comment:${comment.id}`]), ...state.comments.filter((comment) => state.pendingChanges[`comment:${comment.id}`])],
    ratings: { ...ratings, ...Object.fromEntries(Object.entries(state.ratings).filter(([key]) => state.pendingChanges[`rating:${key}`])) },
  })),
  addComment: (targetKey, authorId, author, text, options) => {
    const comment = { id: createUuid(), targetKey, authorId, author: author.trim() || 'Episode User', text: text.trim(), createdAt: new Date().toISOString(), parentCommentId: options?.parentCommentId, imageUrl: options?.imageUrl, spoiler: options?.spoiler ?? false, likeCount: 0, likedByMe: false };
    set((state) => ({ comments: [comment, ...state.comments], pendingChanges: { ...state.pendingChanges, [`comment:${comment.id}`]: revision() } }));
    return comment;
  },
  discardComment: (commentId) => set((state) => ({ comments: state.comments.filter((comment) => comment.id !== commentId), pendingChanges: Object.fromEntries(Object.entries(state.pendingChanges).filter(([key]) => key !== `comment:${commentId}`)) })),
  removeComment: (commentId) => set((state) => ({
    comments: state.comments.filter((comment) => comment.id !== commentId),
    deletedCommentIds: state.deletedCommentIds.includes(commentId) ? state.deletedCommentIds : [...state.deletedCommentIds, commentId],
    pendingChanges: Object.fromEntries(Object.entries(state.pendingChanges).filter(([key]) => key !== `comment:${commentId}`)),
  })),
  acknowledgeCommentDeletion: (commentId) => set((state) => ({ deletedCommentIds: state.deletedCommentIds.filter((id) => id !== commentId) })),
  rate: (targetKey, rating) => set((state) => ({ ratings: { ...state.ratings, [targetKey]: Math.max(1, Math.min(10, rating)) }, pendingChanges: { ...state.pendingChanges, [`rating:${targetKey}`]: revision() } })),
  clearUserData: () => set({ comments: [], ratings: {}, deletedCommentIds: [], pendingChanges: {}, ownerId: undefined }),
}), {
  name: 'episode-community-v1',
  version: 3,
  storage: createJSONStorage(() => AsyncStorage),
  migrate: (persisted) => {
    const state = persisted as CommunityState;
    return { ...state, deletedCommentIds: state.deletedCommentIds ?? [], pendingChanges: { ...Object.fromEntries(Object.keys(state.ratings ?? {}).map((key) => [`rating:${key}`, revision()])), ...Object.fromEntries((state.comments ?? []).map((comment) => [`comment:${comment.id}`, revision()])), ...state.pendingChanges } };
  },
}));
