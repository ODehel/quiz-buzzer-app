export interface Game {
  id: string;
  name: string;
  status: 'created' | 'started' | 'paused' | 'ended';
  questionIds: number[];
  currentQuestionIndex: number;
  totalQuestions: number;
  playerCount: number;
  settings?: GameSettings;
}

export interface GameSettings {
  mcqDuration: number;
  buzzerDuration: number;
  showCorrectAnswer: boolean;
  showIntermediateRanking: boolean;
}

export interface Player {
  rank?: number;
  buzzerID: string;
  name: string;
  score: number;
  correctAnswers: number;
  totalAnswers: number;
  totalResponseTime: number;
  avgResponseTime: number;
  fastestResponseTime: number;
  slowestResponseTime: number;
}