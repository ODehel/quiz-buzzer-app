import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { WebsocketService } from '../../services/websocket';
import { GameService } from '../../services/game';
import { AuthService } from '../../services/auth';
import { Buzzer } from '../../models/buzzer.model';

@Component({
  selector: 'app-lobby',
  imports: [RouterLink],
  templateUrl: './lobby.html',
  styleUrl: './lobby.css'
})
export class LobbyComponent implements OnInit, OnDestroy {
  private websocketService = inject(WebsocketService);
  private gameService = inject(GameService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private subscription = new Subscription();

  // Accès direct aux signals du GameService
  buzzers = this.gameService.buzzers;
  buzzerCount = this.gameService.buzzerCount;
  hasEnoughPlayers = this.gameService.hasEnoughPlayers;
  isConnected = this.websocketService.isConnected;

  ngOnInit(): void {
    // Écouter les messages WebSocket
    this.subscription.add(
      this.websocketService.messages$.subscribe(message => {
        this.handleWebSocketMessage(message);
      })
    );

    // ⭐ Demander la liste actualisée des buzzers au serveur
    // Cela garantit que même en revenant d'une autre page,
    // on affiche les buzzers réellement connectés
    if (this.websocketService.isConnected()) {
      this.websocketService.requestBuzzerList();
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  /**
   * Gérer les messages WebSocket
   */
  private handleWebSocketMessage(message: any): void {
    switch (message.type) {
      case 'BUZZER_CONNECTED':
        // Un nouveau buzzer vient de se connecter
        const newBuzzer: Buzzer = {
          id: message.payload.buzzer.id,
          name: message.payload.buzzer.name,
          connected: true,
          connectedAt: message.payload.buzzer.connectedAt
        };

        // Vérifier qu'il n'est pas déjà dans la liste
        const exists = this.buzzers().some(b => b.id === newBuzzer.id);
        if (!exists) {
          this.gameService.addBuzzer(newBuzzer);
        }
        break;

      case 'BUZZER_DISCONNECTED':
        this.gameService.removeBuzzer(message.payload.buzzerID);
        break;

      case 'BUZZER_LIST_UPDATE':
        // ⭐ Mise à jour complète de la liste (réponse à REQUEST_BUZZER_LIST)
        const buzzerList: Buzzer[] = message.payload.buzzers.map((b: any) => ({
          id: b.id,
          name: b.name,
          connected: true,
          connectedAt: b.connectedAt,
          battery: b.battery || null,
          wifiRSSI: b.wifiRSSI || null,
          latency: b.latency || null,
        }));
        this.gameService.setBuzzers(buzzerList);
        break;

      case 'BUZZER_STATUS_UPDATE':
        // Mise à jour du statut d'un buzzer (batterie, WiFi)
        const updatedBuzzers = this.buzzers().map(b => {
          if (b.id === message.payload.buzzerID) {
            return {
              ...b,
              battery: message.payload.battery,
              wifiRSSI: message.payload.wifiRSSI,
            };
          }
          return b;
        });
        this.gameService.setBuzzers(updatedBuzzers);
        break;
    }
  }

  /**
   * Renommer un joueur
   */
  renamePlayer(buzzer: Buzzer): void {
    const newName = prompt('Nouveau nom du joueur :', buzzer.name);
    if (newName && newName.trim() && newName !== buzzer.name) {
      this.websocketService.send('PLAYER_RENAME', {
        buzzerID: buzzer.id,
        newName: newName.trim()
      });
      // Mise à jour optimiste
      this.gameService.setBuzzers(
        this.buzzers().map(b => b.id === buzzer.id ? { ...b, name: newName.trim() } : b)
      );
    }
  }

  /**
   * Déconnecter un buzzer
   */
  disconnectBuzzer(buzzer: Buzzer): void {
    if (confirm(`Déconnecter ${buzzer.name} ?`)) {
      this.websocketService.send('BUZZER_DISCONNECT', {
        buzzerID: buzzer.id
      });
      this.gameService.removeBuzzer(buzzer.id);
    }
  }

  /**
   * Aller à la configuration de la partie
   */
  goToGameConfig(): void {
    this.router.navigate(['/game-config']);
  }

  /**
   * Aller à la gestion des questions
   */
  goToQuestions(): void {
    this.router.navigate(['/questions']);
  }

  /**
   * Aller à la gestion des jingles
   */
  goToJingles(): void {
    this.router.navigate(['/jingles']);
  }

  /**
   * Se déconnecter
   */
  logout(): void {
    if (confirm('Se déconnecter ?')) {
      this.websocketService.disconnect();
      this.authService.logout();
      this.gameService.reset();
      this.router.navigate(['/']);
    }
  }
}