import type { Media } from './media';

export interface PersonSummary {
  id: number;
  name: string;
  profileUrl: string;
  character?: string;
}

export interface PersonDetails extends PersonSummary {
  biography: string;
  credits: Media[];
}
