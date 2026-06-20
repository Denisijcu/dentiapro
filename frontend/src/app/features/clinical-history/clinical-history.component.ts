import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
 
// ─── Clinical History ────────────────────────────────────────────────────────
@Component({
  selector: 'app-clinical-history',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page">
      <a routerLink="/patients" class="back-link">← Volver a pacientes</a>
      <h1 class="page-title">Historia Clínica</h1>
      <div class="coming-soon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="8" y1="13" x2="16" y2="13"/>
          <line x1="8" y1="17" x2="16" y2="17"/>
        </svg>
        <p>Módulo de historia clínica — disponible en próxima versión</p>
      </div>
    </div>
  `,
  styles: [`.page{padding:28px 32px} .back-link{font-size:13px;color:#0D6E6E;text-decoration:none;font-weight:500;display:inline-block;margin-bottom:16px} .page-title{font-size:22px;font-weight:600;color:#0D3D3D;margin:0 0 24px} .coming-soon{background:#fff;border-radius:12px;padding:48px;display:flex;flex-direction:column;align-items:center;gap:12px;color:#9CA3AF;font-size:13px;box-shadow:0 1px 3px rgba(0,0,0,.06)}`],
})
export class ClinicalHistoryComponent {}