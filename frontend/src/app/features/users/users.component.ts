import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';


@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page">
      <h1 class="page-title">Gestión de usuarios</h1>
      <div class="coming-soon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
        </svg>
        <p>Módulo de usuarios — disponible en próxima versión</p>
      </div>
    </div>
  `,
  styles: [`.page{padding:28px 32px} .page-title{font-size:22px;font-weight:600;color:#0D3D3D;margin:0 0 24px} .coming-soon{background:#fff;border-radius:12px;padding:48px;display:flex;flex-direction:column;align-items:center;gap:12px;color:#9CA3AF;font-size:13px;box-shadow:0 1px 3px rgba(0,0,0,.06)}`],
})
export class UsersComponent {}