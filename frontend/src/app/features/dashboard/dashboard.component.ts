import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '@core/services/auth.service';
import { PatientService } from '@core/services/patient.service';
import { AppointmentService, Appointment } from '@core/services/appointment.service';
import { forkJoin } from 'rxjs';
import { catchError, of } from 'rxjs';

import { environment } from '../../../environments/environment';

const API = environment.apiUrl;

interface StatCard {
  label: string;
  value: string | number;
  sub: string;
  color: string;
  icon: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Buenos días, {{ firstName() }} 👋</h1>
          <p class="page-sub">{{ today() }} · Clínica DentiaPro</p>
        </div>
        <a routerLink="/appointments" class="btn-primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nueva cita
        </a>
      </div>

      <!-- Stats -->
      <div class="stats-grid">
        @for (stat of stats(); track stat.label) {
          <div class="stat-card" [style.border-left-color]="stat.color">
            <div class="stat-icon" [style.background]="stat.color + '18'" [style.color]="stat.color"
                 [innerHTML]="stat.icon"></div>
            <div class="stat-body">
              <div class="stat-value">{{ stat.value }}</div>
              <div class="stat-label">{{ stat.label }}</div>
              <div class="stat-sub">{{ stat.sub }}</div>
            </div>
          </div>
        }
      </div>

      <div class="dashboard-grid">
        <!-- Citas de hoy -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Citas de hoy</h2>
            <a routerLink="/appointments" class="card-link">Ver todas</a>
          </div>
          @if (loadingAppts()) {
            <div class="loading-row">
              @for (i of [1,2,3]; track i) { <div class="skeleton-row"></div> }
            </div>
          } @else if (todayAppointments().length === 0) {
            <div class="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <p>No hay citas programadas para hoy</p>
            </div>
          } @else {
            <div class="appt-list">
              @for (appt of todayAppointments(); track appt.id) {
                <div class="appt-row">
                  <div class="appt-time">{{ formatTime(appt.scheduled_at) }}</div>
                  <div class="appt-info">
                    <div class="appt-patient">Paciente #{{ appt.patient_id }}</div>
                    <div class="appt-type">{{ appt.appointment_type }}</div>
                  </div>
                  <span class="appt-badge" [class]="'status-' + appt.status">
                    {{ statusLabel(appt.status) }}
                  </span>
                </div>
              }
            </div>
          }
        </div>

        <!-- Acciones rápidas -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Acciones rápidas</h2>
          </div>
          <div class="quick-grid">
            @for (action of quickActions; track action.label) {
              <a class="quick-action" [routerLink]="action.route">
                <div class="quick-icon" [style.background]="action.bg" [innerHTML]="action.icon"></div>
                <span class="quick-label">{{ action.label }}</span>
              </a>
            }
          </div>

          <!-- Resumen financiero -->
          @if (invoiceSummary()) {
            <div class="fin-summary">
              <h3 class="fin-title">Resumen financiero</h3>
              <div class="fin-row">
                <span>Facturado</span>
                <strong>{{ invoiceSummary()!.total_facturado | currency:'USD':'symbol':'1.0-0' }}</strong>
              </div>
              <div class="fin-row green">
                <span>Cobrado</span>
                <strong>{{ invoiceSummary()!.total_cobrado | currency:'USD':'symbol':'1.0-0' }}</strong>
              </div>
              <div class="fin-row orange">
                <span>Pendiente</span>
                <strong>{{ invoiceSummary()!.total_pendiente | currency:'USD':'symbol':'1.0-0' }}</strong>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 28px 32px; max-width: 1200px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px; }
    .page-title { font-size: 22px; font-weight: 600; color: #0D3D3D; margin: 0 0 4px; }
    .page-sub { font-size: 13px; color: #6B7280; margin: 0; }
    .btn-primary { display: flex; align-items: center; gap: 6px; background: #0D6E6E; color: #fff; padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none; transition: background 0.15s; }
    .btn-primary:hover { background: #0A5555; }

    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: #fff; border-radius: 12px; padding: 18px; display: flex; gap: 14px; align-items: flex-start; border-left: 4px solid transparent; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .stat-icon { width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .stat-icon svg { width: 20px; height: 20px; }
    .stat-value { font-size: 26px; font-weight: 700; color: #0D3D3D; line-height: 1; margin-bottom: 4px; }
    .stat-label { font-size: 13px; font-weight: 500; color: #374151; }
    .stat-sub { font-size: 11px; color: #9CA3AF; margin-top: 2px; }

    .dashboard-grid { display: grid; grid-template-columns: 1fr 320px; gap: 20px; }
    .card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .card-title { font-size: 15px; font-weight: 600; color: #0D3D3D; margin: 0; }
    .card-link { font-size: 12px; color: #0D6E6E; text-decoration: none; font-weight: 500; }

    .appt-list { display: flex; flex-direction: column; gap: 2px; }
    .appt-row { display: flex; align-items: center; gap: 12px; padding: 10px 8px; border-radius: 8px; transition: background 0.1s; }
    .appt-row:hover { background: #F9FAFB; }
    .appt-time { font-size: 13px; font-weight: 600; color: #0D6E6E; width: 52px; flex-shrink: 0; }
    .appt-info { flex: 1; }
    .appt-patient { font-size: 13px; font-weight: 500; color: #111827; }
    .appt-type { font-size: 11px; color: #9CA3AF; text-transform: capitalize; }
    .appt-badge { font-size: 11px; font-weight: 500; padding: 3px 8px; border-radius: 20px; }
    .status-scheduled { background: #EFF6FF; color: #2563EB; }
    .status-confirmed { background: #ECFDF5; color: #059669; }
    .status-in_progress { background: #FFFBEB; color: #D97706; }
    .status-completed { background: #F3F4F6; color: #6B7280; }
    .status-cancelled { background: #FEF2F2; color: #EF4444; }

    .quick-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
    .quick-action { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px 8px; border-radius: 10px; background: #F9FAFB; text-decoration: none; transition: background 0.15s, transform 0.1s; }
    .quick-action:hover { background: #F0F4F8; transform: translateY(-1px); }
    .quick-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
    .quick-icon svg { width: 20px; height: 20px; stroke: #fff; }
    .quick-label { font-size: 12px; font-weight: 500; color: #374151; text-align: center; }

    /* Resumen financiero */
    .fin-summary { border-top: 1px solid #F3F4F6; padding-top: 16px; }
    .fin-title { font-size: 13px; font-weight: 600; color: #0D3D3D; margin: 0 0 10px; }
    .fin-row { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #6B7280; padding: 5px 0; border-bottom: 1px solid #F9FAFB; }
    .fin-row strong { font-size: 13px; color: #111827; }
    .fin-row.green strong { color: #059669; }
    .fin-row.orange strong { color: #D97706; }

    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 32px; color: #9CA3AF; font-size: 13px; }
    .loading-row { display: flex; flex-direction: column; gap: 8px; }
    .skeleton-row { height: 44px; background: #F3F4F6; border-radius: 8px; animation: pulse 1.5s ease-in-out infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }

    @media (max-width: 900px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .dashboard-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class DashboardComponent implements OnInit {
  stats             = signal<StatCard[]>([]);
  todayAppointments = signal<Appointment[]>([]);
  invoiceSummary    = signal<any>(null);
  loadingAppts      = signal(true);
  firstName         = signal('');
  today             = signal('');

  quickActions = [
    { label: 'Nuevo paciente', route: '/patients',     bg: '#0D6E6E', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>` },
    { label: 'Subir Rayos X',  route: '/xray',         bg: '#7C3AED', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9V5a2 2 0 012-2h4M15 3h4a2 2 0 012 2v4M21 15v4a2 2 0 01-2 2h-4M9 21H5a2 2 0 01-2-2v-4"/><line x1="3" y1="12" x2="21" y2="12"/></svg>` },
    { label: 'Nueva cita',     route: '/appointments', bg: '#D97706', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>` },
    { label: 'Nueva factura',  route: '/invoices',     bg: '#059669', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>` },
  ];

  constructor(
    private auth: AuthService,
    private patientSvc: PatientService,
    private apptSvc: AppointmentService,
    private http: HttpClient,
  ) {}

  ngOnInit() {
    const user = this.auth.currentUser();
    this.firstName.set(user?.first_name ?? 'Doctor');
    this.today.set(new Date().toLocaleDateString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    }));

    const todayStr = new Date().toISOString().split('T')[0];

    forkJoin({
      patients:    this.patientSvc.list(1, 1).pipe(catchError(() => of({ total: 0, items: [] }))),
      todayAppts:  this.apptSvc.list({ date_from: todayStr + 'T00:00:00', date_to: todayStr + 'T23:59:59', page: 1 }).pipe(catchError(() => of({ total: 0, items: [] }))),
      allAppts:    this.apptSvc.list({ page: 1 }).pipe(catchError(() => of({ total: 0, items: [] }))),
      invoices:    this.http.get<any>(`${API}/invoices/summary`).pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ patients, todayAppts, allAppts, invoices }) => {
        const pendientes = invoices?.total_pendiente ?? 0;

        this.stats.set([
          {
            label: 'Pacientes totales', value: patients.total, sub: 'registrados',
            color: '#0D6E6E',
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`
          },
          {
            label: 'Citas hoy', value: todayAppts.total, sub: 'programadas',
            color: '#7C3AED',
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`
          },
          {
            label: 'Citas totales', value: allAppts.total, sub: 'registradas',
            color: '#D97706',
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 110 20A10 10 0 0112 2z"/><polyline points="12 6 12 12 16 14"/></svg>`
          },
          {
            label: 'Por cobrar',
            value: pendientes > 0 ? '$' + pendientes.toLocaleString('es', { maximumFractionDigits: 0 }) : '$0',
            sub: 'facturas pendientes',
            color: '#059669',
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`
          },
        ]);

        this.todayAppointments.set(todayAppts.items.slice(0, 8));
        this.invoiceSummary.set(invoices);
        this.loadingAppts.set(false);
      },
      error: () => this.loadingAppts.set(false),
    });
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  statusLabel(s: string): string {
    const map: Record<string, string> = {
      scheduled: 'Programada', confirmed: 'Confirmada',
      in_progress: 'En curso',  completed: 'Completada',
      cancelled: 'Cancelada',   no_show: 'No asistió',
    };
    return map[s] ?? s;
  }
}