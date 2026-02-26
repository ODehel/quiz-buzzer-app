import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api';
import { Jingle } from '../../models/jingle.model';

@Component({
  selector: 'app-jingles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './jingles.html',
  styleUrl: './jingles.css'
})
export class JinglesComponent implements OnInit {
  jingles: Jingle[] = [];
  showForm = false;
  editingJingle: Jingle | null = null;

  newJingle: Partial<Jingle> = {
    name: '',
    filePath: '',
    duration: undefined,
    description: '',
  };

  constructor(private apiService: ApiService, private router: Router) {}

  ngOnInit() {
    this.loadJingles();
  }

  loadJingles() {
    this.apiService.getJingles().subscribe({
      next: (jingles) => this.jingles = jingles,
      error: (err) => console.error('Erreur chargement jingles:', err)
    });
  }

  resetForm() {
    this.newJingle = {
      name: '',
      filePath: '',
      duration: undefined,
      description: '',
    };
    this.editingJingle = null;
    this.showForm = false;
  }

  openCreateForm() {
    this.resetForm();
    this.showForm = true;
  }

  openEditForm(jingle: Jingle) {
    this.editingJingle = jingle;
    this.newJingle = { ...jingle };
    this.showForm = true;
  }

  saveJingle() {
    if (this.editingJingle && this.editingJingle.id) {
      this.apiService.updateJingle(this.editingJingle.id, this.newJingle).subscribe({
        next: () => {
          this.loadJingles();
          this.resetForm();
        },
        error: (err) => console.error('Erreur mise à jour jingle:', err)
      });
    } else {
      this.apiService.createJingle(this.newJingle).subscribe({
        next: () => {
          this.loadJingles();
          this.resetForm();
        },
        error: (err) => console.error('Erreur création jingle:', err)
      });
    }
  }

  deleteJingle(id: number) {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce jingle ?')) {
      this.apiService.deleteJingle(id).subscribe({
        next: () => this.loadJingles(),
        error: (err) => console.error('Erreur suppression jingle:', err)
      });
    }
  }

  goBack() {
    this.router.navigate(['/lobby']);
  }
}
