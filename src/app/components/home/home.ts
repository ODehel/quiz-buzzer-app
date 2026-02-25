import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api';
import { WebsocketService } from '../../services/websocket';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeComponent {
  // Angular 21 : inject() au lieu du constructeur
  private apiService = inject(ApiService);
  private websocketService = inject(WebsocketService);
  private authService = inject(AuthService);
  private router = inject(Router);

  // Angular 21 : Signals au lieu de propriétés simples
  isLoading = signal(false);
  errorMessage = signal('');
  currentStep = signal('');

  /**
   * Lancer la connexion au serveur
   */
  async launch(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      // 1. Vérifier le serveur HTTP
      this.currentStep.set('Vérification du serveur...');
      await this.checkServer();

      // 2. Connexion WebSocket
      this.currentStep.set('Connexion WebSocket...');
      await this.connectWebSocket();

      // 3. Authentification simple (dev)
      this.currentStep.set('Authentification...');
      await this.authenticate();

      // 4. Navigation vers le lobby
      this.currentStep.set('Connexion réussie !');
      setTimeout(() => {
        this.router.navigate(['/lobby']);
      }, 500);

    } catch (error: any) {
      this.isLoading.set(false);
      this.errorMessage.set(error.message || 'Erreur inconnue');
      console.error('Launch error:', error);
    }
  }

  private checkServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.apiService.checkServerStatus().subscribe({
        next: (response) => {
          if (response.status === 'ok') {
            resolve();
          } else {
            reject(new Error('Serveur non prêt'));
          }
        },
        error: (err) => reject(err)
      });
    });
  }

  private connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.websocketService.connect();

      const subscription = this.websocketService.messages$.subscribe({
        next: (message) => {
          if (message.type === 'CONNECTED') {
            subscription.unsubscribe();
            resolve();
          }
        },
        error: (err) => {
          subscription.unsubscribe();
          reject(err);
        }
      });

      setTimeout(() => {
        subscription.unsubscribe();
        reject(new Error('WebSocket timeout'));
      }, 5000);
    });
  }

  private authenticate(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.authService.simpleAuth('admin').subscribe({
        next: () => resolve(),
        error: (err) => reject(err)
      });
    });
  }

  retry(): void {
    this.errorMessage.set('');
    this.launch();
  }
}