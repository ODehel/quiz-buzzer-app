import type { GameStatus } from './websocket.models';

export interface Game {
  id: string;
  quiz_id: string;
  status: GameStatus;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}
