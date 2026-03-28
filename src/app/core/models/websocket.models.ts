export type GameStatus =
  | 'PENDING'
  | 'OPEN'
  | 'QUESTION_TITLE'
  | 'QUESTION_OPEN'
  | 'QUESTION_BUZZED'
  | 'QUESTION_CLOSED'
  | 'COMPLETED'
  | 'IN_ERROR';

export type QuestionType = 'MCQ' | 'SPEED';

// ── Messages Angular → Serveur ──────────────────────────────────────────────
export type OutboundMessage =
  | { type: 'auth'; token: string }
  | { type: 'auth_refresh'; token: string }
  | { type: 'trigger_title' }
  | { type: 'trigger_choices' }
  | { type: 'trigger_correction' }
  | { type: 'trigger_next_question' }
  | { type: 'validate_answer' }
  | { type: 'invalidate_answer' }
  | { type: 'trigger_intermediate_ranking' }
  | { type: 'trigger_system_sound'; sound_id: SystemSoundId; targets?: string[] }
  | { type: 'play_sound'; sound_id: string; targets?: string[] };

export type SystemSoundId =
  | 'BUZZ_PRESSED'
  | 'BUZZ_LOCKED'
  | 'BUZZ_INVALIDATED'
  | 'CORRECT_ANSWER'
  | 'WRONG_ANSWER'
  | 'TIMER_END'
  | 'GAME_START'
  | 'GAME_END'
  | 'WAITING'
  | 'SUSPENSE';

// ── Messages Serveur → Angular ──────────────────────────────────────────────
export type InboundMessage =
  | AuthSuccessMessage
  | TokenExpiringSoonMessage
  | TokenExpiredMessage
  | GameStateSyncMessage
  | QuestionTitleMessage
  | QuestionChoicesMessage
  | QuestionOpenMessage
  | TimerTickMessage
  | TimerEndMessage
  | PlayerAnsweredMessage
  | AllAnsweredMessage
  | BuzzLockedMessage
  | BuzzUnlockedMessage
  | QuestionResultSummaryMessage
  | IntermediateRankingMessage
  | ErrorMessage
  | GenericInboundMessage;

export interface AuthSuccessMessage {
  type: 'auth_success';
  expires_in: number;
}

export interface TokenExpiringSoonMessage {
  type: 'token_expiring_soon';
}

export interface TokenExpiredMessage {
  type: 'token_expired';
}

export interface GameStateSyncMessage {
  type: 'game_state_sync';
  game_id: string;
  status: GameStatus;
  quiz_id: string;
  question_index: number | null;
  question_type: QuestionType | null;
  question_title: string | null;
  choices: [string, string, string, string] | null;
  participants: ParticipantState[];
  connected_buzzers: string[];
  started_at: string | null;
  time_limit: number | null;
}

export interface QuestionTitleMessage {
  type: 'question_title';
  question_index: number;
  question_type: 'MCQ';
  title: string;
  time_limit: number;
  total_questions: number;
}

export interface QuestionChoicesMessage {
  type: 'question_choices';
  choices: [string, string, string, string];
  started_at: string;
}

export interface QuestionOpenMessage {
  type: 'question_open';
  question_index: number;
  question_type: 'SPEED';
  title: string;
  time_limit: number;
  total_questions: number;
  started_at: string;
}

export interface TimerTickMessage {
  type: 'timer_tick';
  remaining_seconds: number;
}

export interface TimerEndMessage {
  type: 'timer_end';
}

export interface PlayerAnsweredMessage {
  type: 'player_answered';
  participant_name: string;
  participant_order: number;
  choice: string;
  response_time_ms: number;
}

export interface AllAnsweredMessage {
  type: 'all_answered';
}

export interface BuzzLockedMessage {
  type: 'buzz_locked';
  participant_name: string;
  participant_order: number;
}

export interface BuzzUnlockedMessage {
  type: 'buzz_unlocked';
  remaining_seconds: number;
  invalidated_participant: string;
}

export interface McqPlayerResult {
  participant_name: string;
  participant_order: number;
  choice: string | null;
  correct: boolean;
  response_time_ms: number | null;
  points_earned: number;
}

export interface SpeedPlayerResult {
  participant_name: string;
  participant_order: number;
  winner: boolean;
  points_earned: number;
}

export interface QuestionResultSummaryMessage {
  type: 'question_result_summary';
  question_index: number;
  question_type: QuestionType;
  correct_answer: string;
  results: McqPlayerResult[] | SpeedPlayerResult[];
  ranking: RankingEntry[];
}

export interface IntermediateRankingMessage {
  type: 'intermediate_ranking';
  ranking: RankingEntry[];
}

export interface ErrorMessage {
  type: 'error';
  code: string;
  message?: string;
}

export interface GenericInboundMessage {
  type: string;
  [key: string]: unknown;
}

// ── Types partagés ────────────────────────────────────────────────────────────
export interface ParticipantState {
  order: number;
  name: string;
  cumulative_score: number;
}

export interface RankingEntry {
  rank: number;
  participant_name: string;
  participant_order: number;
  cumulative_score: number;
  total_time_ms: number;
}
