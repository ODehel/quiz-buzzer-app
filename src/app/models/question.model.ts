export interface Question {
  id?: number;
  text: string;
  type: 'mcq' | 'buzzer';
  options?: string[];
  correctAnswer?: number;
  expectedAnswer?: string; // Réponse attendue pour les questions de rapidité
  timeLimit?: number;
  points?: number;
  category?: string;
  difficulty?: string;
}