import type { QuestionType } from './websocket.models';

export interface Question {
  id: string;
  type: QuestionType;
  theme_id: string;
  theme_name: string;
  title: string;
  choices: [string, string, string, string] | null;
  correct_answer: string;
  level: number;
  time_limit: number;
  points: number;
  image_path: string | null;
  audio_path: string | null;
  created_at: string;
  last_updated_at: string;
}

export interface Theme {
  id: string;
  name: string;
}

export interface QuestionFilters {
  page: number;
  limit: number;
  theme_id?: string;
  type?: QuestionType;
  level_min?: number;
  level_max?: number;
  points_min?: number;
  points_max?: number;
}

export interface CreateQuestionDto {
  type: QuestionType;
  theme_id: string;
  title: string;
  choices?: [string, string, string, string];
  correct_answer: string;
  level: number;
  time_limit: number;
  points: number;
}

export type PatchQuestionDto = Partial<Omit<CreateQuestionDto, 'type'>>;

export interface MediaUploadResponse {
  id: string;
  image_path: string | null;
  audio_path: string | null;
  last_updated_at: string;
}
