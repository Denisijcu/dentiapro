import { Component, signal, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { ChatWidgetComponent } from '../../shared/chat-widge/chat-widget.component';


interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles?: string[];
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, ChatWidgetComponent],
  template: `
    <div class="shell">
      <!-- Sidebar -->
      <aside class="sidebar" [class.collapsed]="collapsed()">
        <!-- Brand -->
        <div class="brand">
          <div class="brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2C8 2 5 5 5 9c0 2.5 1 4.5 2.5 6L9 21h6l1.5-6C18 13.5 19 11.5 19 9c0-4-3-7-7-7z"/>
            </svg>
          </div>
          @if (!collapsed()) {
            <span class="brand-name">DentiaPro</span>
          }
        </div>

        <!-- Nav -->
        <nav class="nav">
          @for (item of visibleNav(); track item.route) {
            <a
              class="nav-item"
              [routerLink]="item.route"
              routerLinkActive="active"
              [title]="collapsed() ? item.label : ''"
            >
              <span class="nav-icon" [innerHTML]="item.icon"></span>
              @if (!collapsed()) {
                <span class="nav-label">{{ item.label }}</span>
              }
            </a>
          }
        </nav>

        <!-- User + collapse toggle -->
        <div class="sidebar-footer">
          @if (!collapsed()) {
            <div class="user-info">
              <div class="user-avatar">
                {{ userInitials() }}
              </div>
              <div class="user-meta">
                <div class="user-name">{{ auth.currentUser()?.full_name }}</div>
                <div class="user-role">{{ auth.currentUser()?.role }}</div>
              </div>
            </div>
          }
          <div class="footer-actions">
            <button class="icon-btn" (click)="collapsed.set(!collapsed())" title="Toggle sidebar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                @if (collapsed()) {
                  <path d="M9 18l6-6-6-6"/>
                } @else {
                  <path d="M15 18l-6-6 6-6"/>
                }
              </svg>
            </button>
            <button class="icon-btn logout-btn" (click)="auth.logout()" title="Cerrar sesión">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <!-- Main content -->
      <main class="main-content">
        <router-outlet />
        <app-chat-widget></app-chat-widget>
      </main>
    </div>
  `,
  styles: [`
    .shell {
      display: flex;
      height: 100vh;
      background: #F0F4F8;
      overflow: hidden;
    }

    /* ── Sidebar ── */
    .sidebar {
      width: 240px;
      background: #0D3D3D;
      display: flex;
      flex-direction: column;
      transition: width 0.2s ease;
      flex-shrink: 0;
      overflow: hidden;
    }
    .sidebar.collapsed { width: 64px; }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .brand-icon {
      width: 34px;
      height: 34px;
      background: #10B981;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .brand-icon svg { width: 18px; height: 18px; stroke: white; }
    .brand-name {
      font-size: 17px;
      font-weight: 600;
      color: #fff;
      letter-spacing: -0.3px;
      white-space: nowrap;
    }

    /* ── Nav ── */
    .nav {
      flex: 1;
      padding: 12px 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow-y: auto;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 10px;
      border-radius: 8px;
      text-decoration: none;
      color: rgba(255,255,255,0.6);
      font-size: 13.5px;
      font-weight: 500;
      transition: background 0.15s, color 0.15s;
      white-space: nowrap;
      overflow: hidden;
    }
    .nav-item:hover { background: rgba(255,255,255,0.07); color: #fff; }
    .nav-item.active { background: #10B981; color: #fff; }
    .nav-icon { width: 20px; height: 20px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
    .nav-icon svg { width: 18px; height: 18px; }

    /* ── Footer ── */
    .sidebar-footer {
      padding: 12px 8px;
      border-top: 1px solid rgba(255,255,255,0.08);
    }
    .user-info {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px;
      margin-bottom: 8px;
    }
    .user-avatar {
      width: 34px;
      height: 34px;
      background: #10B981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      color: white;
      flex-shrink: 0;
    }
    .user-name { font-size: 13px; font-weight: 500; color: #fff; white-space: nowrap; }
    .user-role { font-size: 11px; color: rgba(255,255,255,0.45); text-transform: capitalize; }
    .footer-actions { display: flex; gap: 4px; padding: 0 2px; }
    .icon-btn {
      width: 36px; height: 36px;
      border: none;
      background: transparent;
      border-radius: 7px;
      cursor: pointer;
      color: rgba(255,255,255,0.5);
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s, color 0.15s;
    }
    .icon-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }
    .logout-btn:hover { background: rgba(239,68,68,0.15); color: #EF4444; }

    /* ── Main content ── */
    .main-content {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
    }
  `],
})
export class ShellComponent {
  collapsed = signal(false);

  private navItems: NavItem[] = [
    { label: 'Dashboard', icon: this._icon('grid'), route: '/dashboard' },
    { label: 'Pacientes', icon: this._icon('users'), route: '/patients' },
    { label: 'Citas', icon: this._icon('calendar'), route: '/appointments' },
    { label: 'Rayos X', icon: this._icon('scan'), route: '/xray' },
    { label: 'Facturas', icon: this._icon('receipt'), route: '/invoices' },
    { label: 'Usuarios', icon: this._icon('settings'), route: '/users', roles: ['admin'] },
  ];

  visibleNav = computed(() => {
    const role = this.auth.currentUser()?.role;
    return this.navItems.filter(i => !i.roles || (role && i.roles.includes(role)));
  });

  userInitials = computed(() => {
    const u = this.auth.currentUser();
    if (!u) return '?';
    return `${u.first_name[0]}${u.last_name[0]}`.toUpperCase();
  });

  constructor(readonly auth: AuthService) {}

  private _icon(name: string): string {
    const icons: Record<string, string> = {
      grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
      users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>`,
      calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
      scan: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9V5a2 2 0 012-2h4M15 3h4a2 2 0 012 2v4M21 15v4a2 2 0 01-2 2h-4M9 21H5a2 2 0 01-2-2v-4"/><line x1="3" y1="12" x2="21" y2="12"/></svg>`,
      receipt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>`,
      settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`,
    };
    return icons[name] ?? '';
  }
}