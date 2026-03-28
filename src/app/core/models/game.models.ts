import type { GameStatus } from './websocket.models';

export interface GameParticipant {
  order: number;
  name: string;
}

export interface Game {
  id: string;
  quiz_id: string;
  quiz_name: string;
  status: GameStatus;
  participants: GameParticipant[];
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface CreateGameDto {
  quiz_id: string;
  participants: string[];
}

export interface GameResultEntry {
  rank: number;
  participant_name: string;
  participant_order: number;
  cumulative_score: number;
  total_time_ms: number;
}

export interface GameResults {
  game_id: string;
  quiz_name: string;
  started_at: string;
  completed_at: string;
  rankings: GameResultEntry[];
}

export interface HealthResponse {
  status: string;
  version?: string;
}
