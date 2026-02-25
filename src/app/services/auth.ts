import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.serverUrl + '/api/auth';
  private http = inject(HttpClient);

  // Signal pour le token JWT
  private _token = signal<string | null>(localStorage.getItem('token'));
  public token = this._token.asReadonly();

  // Signal dérivé : est-ce que l'utilisateur est authentifié ?
  public isAuthenticated = computed(() => !!this._token());

  /**
   * Authentification simple (développement)
   */
  simpleAuth(username: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/simple`, { username }).pipe(
      tap((response: any) => {
        if (response.success && response.token) {
          this.setToken(response.token);
        }
      })
    );
  }

  /**
   * Enregistrer le token
   */
  setToken(token: string): void {
    localStorage.setItem('token', token);
    this._token.set(token);
  }

  /**
   * Déconnexion
   */
  logout(): void {
    localStorage.removeItem('token');
    this._token.set(null);
  }
}