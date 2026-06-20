import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-page">
      <div class="login-card">
        <!-- Brand -->
        <div class="login-brand">
          <div class="login-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2C8 2 5 5 5 9c0 2.5 1 4.5 2.5 6L9 21h6l1.5-6C18 13.5 19 11.5 19 9c0-4-3-7-7-7z"/>
            </svg>
          </div>
          <h1 class="login-title">DentiaPro</h1>
          <p class="login-subtitle">Plataforma de gestión dental con IA</p>
        </div>

        <!-- Form -->
        <form class="login-form" (ngSubmit)="onSubmit()">
          <div class="field">
            <label class="field-label">Correo electrónico</label>
            <input
              class="field-input"
              type="email"
              [(ngModel)]="email"
              name="email"
              placeholder="doctor@clinica.com"
              autocomplete="email"
              required
            />
          </div>

          <div class="field">
            <label class="field-label">Contraseña</label>
            <input
              class="field-input"
              [type]="showPass() ? 'text' : 'password'"
              [(ngModel)]="password"
              name="password"
              placeholder="••••••••"
              autocomplete="current-password"
              required
            />
            <button type="button" class="pass-toggle" (click)="showPass.set(!showPass())">
              {{ showPass() ? 'Ocultar' : 'Mostrar' }}
            </button>
          </div>

          @if (error()) {
            <div class="login-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {{ error() }}
            </div>
          }

          <button class="login-btn" type="submit" [disabled]="loading()">
            @if (loading()) {
              <span class="spinner"></span> Ingresando...
            } @else {
              Ingresar
            }
          </button>
        </form>

        <p class="login-hint">Vertex Coders LLC · DentiaPro v1.0</p>
      </div>

      <!-- Background decoration -->
      <div class="login-bg">
        <div class="bg-circle c1"></div>
        <div class="bg-circle c2"></div>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0A2828;
      position: relative;
      overflow: hidden;
    }
    .login-card {
      background: #fff;
      border-radius: 16px;
      padding: 48px 40px;
      width: 100%;
      max-width: 400px;
      position: relative;
      z-index: 1;
      box-shadow: 0 24px 64px rgba(0,0,0,0.3);
    }
    .login-brand { text-align: center; margin-bottom: 36px; }
    .login-logo {
      width: 56px; height: 56px;
      background: #0D6E6E;
      border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 14px;
    }
    .login-logo svg { width: 28px; height: 28px; stroke: #fff; }
    .login-title { font-size: 26px; font-weight: 700; color: #0D3D3D; margin: 0 0 6px; letter-spacing: -0.5px; }
    .login-subtitle { font-size: 13px; color: #6B7280; margin: 0; }
    .login-form { display: flex; flex-direction: column; gap: 18px; }
    .field { display: flex; flex-direction: column; gap: 6px; position: relative; }
    .field-label { font-size: 13px; font-weight: 500; color: #374151; }
    .field-input {
      padding: 10px 14px;
      border: 1.5px solid #E5E7EB;
      border-radius: 8px;
      font-size: 14px;
      color: #111827;
      outline: none;
      transition: border-color 0.15s;
    }
    .field-input:focus { border-color: #0D6E6E; }
    .pass-toggle {
      position: absolute; right: 12px; bottom: 10px;
      background: none; border: none; font-size: 12px;
      color: #0D6E6E; cursor: pointer; font-weight: 500;
    }
    .login-error {
      display: flex; align-items: center; gap: 8px;
      background: #FEF2F2; color: #EF4444;
      border-radius: 8px; padding: 10px 12px;
      font-size: 13px;
    }
    .login-btn {
      background: #0D6E6E; color: #fff;
      border: none; border-radius: 8px;
      padding: 12px; font-size: 15px; font-weight: 600;
      cursor: pointer; transition: background 0.15s;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      margin-top: 4px;
    }
    .login-btn:hover:not(:disabled) { background: #0A5555; }
    .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .spinner {
      width: 16px; height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .login-hint { text-align: center; font-size: 11px; color: #9CA3AF; margin: 24px 0 0; }
    .login-bg { position: absolute; inset: 0; pointer-events: none; }
    .bg-circle {
      position: absolute; border-radius: 50%;
      background: rgba(16, 185, 129, 0.08);
    }
    .c1 { width: 400px; height: 400px; top: -100px; right: -100px; }
    .c2 { width: 300px; height: 300px; bottom: -80px; left: -80px; }
  `],
})
export class LoginComponent {
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');
  showPass = signal(false);

  constructor(private auth: AuthService, private router: Router) {}

  onSubmit() {
    if (!this.email || !this.password) return;
    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err.status === 401
            ? 'Credenciales incorrectas. Verifica tu email y contraseña.'
            : 'Error de conexión. Intenta de nuevo.'
        );
      },
    });
  }
}