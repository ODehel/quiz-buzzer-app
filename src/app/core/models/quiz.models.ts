import type { QuestionType } from './websocket.models';

export interface QuizQuestionSummary {
  total: number;
  by_level: Record<string, Record<QuestionType, number>>;
}

export interface Quiz {
  id: string;
  name: string;
  created_at: string;
  last_updated_at: string | null;
  question_summary: QuizQuestionSummary;
}

export interface QuizDetail {
  id: string;
  name: string;
  question_ids: string[];
  created_at: string;
  last_updated_at: string | null;
}

export interface QuizFilters {
  page: number;
  limit: number;
  name?: string;
}

export interface CreateQuizDto {
  name: string;
  question_ids: string[];
}

export interface QuizCreateResponse {
  id: string;
  name: string;
  question_count: number;
  created_at: string;
  last_updated_at: string | null;
}
