import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
import { Question } from '../../models/question.model';

@Component({
  selector: 'app-questions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './questions.html',
  styleUrl: './questions.css'
})
export class QuestionsComponent implements OnInit {
  questions: Question[] = [];
  showForm = false;
  editingQuestion: Question | null = null;

  newQuestion: Question = {
    text: '',
    type: 'mcq',
    options: ['', '', '', ''],
    correctAnswer: 0,
    expectedAnswer: '',
    timeLimit: 30,
    points: 100
  };

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    this.loadQuestions();
  }

  loadQuestions() {
    this.apiService.getQuestions().subscribe({
      next: (questions) => this.questions = questions,
      error: (err) => console.error('Erreur chargement questions:', err)
    });
  }

  resetForm() {
    this.newQuestion = {
      text: '',
      type: 'mcq',
      options: ['', '', '', ''],
      correctAnswer: 0,
      expectedAnswer: '',
      timeLimit: 30,
      points: 100
    };
    this.editingQuestion = null;
    this.showForm = false;
  }

  openCreateForm() {
    this.resetForm();
    this.showForm = true;
  }

  openEditForm(question: Question) {
    this.editingQuestion = question;
    this.newQuestion = {
      ...question,
      options: question.options ? [...question.options] : ['', '', '', ''],
      expectedAnswer: question.expectedAnswer || ''
    };
    this.showForm = true;
  }

  onTypeChange() {
    if (this.newQuestion.type === 'mcq') {
      this.newQuestion.options = ['', '', '', ''];
      this.newQuestion.correctAnswer = 0;
      this.newQuestion.expectedAnswer = '';
    } else {
      this.newQuestion.options = [];
      this.newQuestion.correctAnswer = undefined;
    }
  }

  addOption() {
    if (!this.newQuestion.options) {
      this.newQuestion.options = [];
    }
    this.newQuestion.options.push('');
  }

  removeOption(index: number) {
    if (this.newQuestion.options && this.newQuestion.options.length > 2) {
      this.newQuestion.options.splice(index, 1);
      if (this.newQuestion.correctAnswer !== undefined && this.newQuestion.correctAnswer >= this.newQuestion.options.length) {
        this.newQuestion.correctAnswer = 0;
      }
    }
  }

  saveQuestion() {
    const questionToSave: Question = { ...this.newQuestion };

    if (questionToSave.type === 'mcq') {
      delete questionToSave.expectedAnswer;
    } else {
      delete questionToSave.options;
      delete questionToSave.correctAnswer;
    }

    if (this.editingQuestion && this.editingQuestion.id) {
      this.apiService.updateQuestion(this.editingQuestion.id, questionToSave).subscribe({
        next: () => {
          this.loadQuestions();
          this.resetForm();
        },
        error: (err) => console.error('Erreur mise à jour question:', err)
      });
    } else {
      this.apiService.createQuestion(questionToSave).subscribe({
        next: () => {
          this.loadQuestions();
          this.resetForm();
        },
        error: (err) => console.error('Erreur création question:', err)
      });
    }
  }

  deleteQuestion(id: number) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette question ?')) {
      this.apiService.deleteQuestion(id).subscribe({
        next: () => this.loadQuestions(),
        error: (err) => console.error('Erreur suppression question:', err)
      });
    }
  }

  trackByIndex(index: number): number {
    return index;
  }
}