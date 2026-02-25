import { Component, inject, signal, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api';

@Component({
  selector: 'app-results',
  imports: [DecimalPipe],
  templateUrl: './results.html',
  styleUrl: './results.css'
})
export class ResultsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private apiService = inject(ApiService);

  gameId = signal('');
  ranking = signal<any[]>([]);
  stats = signal<any[]>([]);
  isLoading = signal(true);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.gameId.set(id);
      this.loadResults();
    }
  }

  private loadResults(): void {
    this.apiService.getRanking(this.gameId()).subscribe({
      next: (ranking) => {
        this.ranking.set(ranking);
      }
    });

    this.apiService.getStats(this.gameId()).subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.isLoading.set(false);
      }
    });
  }
}