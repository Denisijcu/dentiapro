import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  styles: [`
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    .not-found-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
    }

    .not-found-card {
      max-width: 420px;
      width: 100%;
      background: white;
      border-radius: 24px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      padding: 48px 40px;
      text-align: center;
    }

    .error-badge {
      display: inline-block;
      background: #fef2f2;
      color: #dc2626;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 16px;
      border-radius: 9999px;
      margin-bottom: 24px;
      letter-spacing: 0.5px;
      border: 1px solid #fecaca;
    }

    .error-number {
      font-size: 120px;
      font-weight: 900;
      color: #0f172a;
      line-height: 1;
      margin-bottom: 8px;
      letter-spacing: -4px;
    }

    .error-divider {
      width: 60px;
      height: 4px;
      background: #14b8a6;
      border-radius: 9999px;
      margin: 0 auto 20px;
    }

    .error-title {
      font-size: 24px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 12px;
    }

    .error-message {
      font-size: 14px;
      color: #64748b;
      line-height: 1.6;
      margin-bottom: 32px;
    }

    .btn-primary {
      display: block;
      width: 100%;
      padding: 12px;
      background: #14b8a6;
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s;
      cursor: pointer;
      margin-bottom: 10px;
    }

    .btn-primary:hover {
      background: #0d9488;
      box-shadow: 0 10px 25px -5px rgba(20, 184, 166, 0.3);
    }

    .btn-secondary {
      display: block;
      width: 100%;
      padding: 10px;
      background: #f1f5f9;
      color: #475569;
      border: none;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      transition: all 0.2s;
      cursor: pointer;
    }

    .btn-secondary:hover {
      background: #e2e8f0;
    }

    .footer-text {
      margin-top: 24px;
      font-size: 11px;
      color: #94a3b8;
      letter-spacing: 0.5px;
    }

    .footer-text span {
      color: #cbd5e1;
    }

    @media (max-width: 480px) {
      .not-found-card {
        padding: 32px 24px;
      }
      
      .error-number {
        font-size: 80px;
      }
    }
  `],
  template: `
    <div class="not-found-container">
      <div class="not-found-card">
        <!-- Badge -->
        <div class="error-badge">
          ⚡ Error 404
        </div>

        <!-- 404 -->
        <div class="error-number">404</div>
        <div class="error-divider"></div>

        <!-- Mensaje -->
        <h1 class="error-title">Página no encontrada</h1>
        <p class="error-message">
          Lo sentimos, la página que buscas no existe o ha sido movida a otra ubicación.
        </p>

        <!-- Acciones -->
        <a routerLink="/dashboard" class="btn-primary">
          ← Volver al dashboard
        </a>
        <button (click)="goBack()" class="btn-secondary">
          Página anterior
        </button>

        <!-- Footer -->
        <div class="footer-text">
          DentalPro · <span>{{ diagId }}</span>
        </div>
      </div>
    </div>
  `
})
export class NotFoundComponent {
  public diagId: string = 'ERR-' + Date.now().toString(36).toUpperCase();

  goBack() {
    window.history.back();
  }
}