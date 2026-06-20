import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PatientService, Patient, PatientCreate } from '@core/services/patient.service';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';

@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Pacientes</h1>
          <p class="page-sub">{{ total() }} pacientes registrados</p>
        </div>
        <button class="btn-primary" (click)="showModal.set(true)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nuevo paciente
        </button>
      </div>

      <div class="search-bar">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input class="search-input" type="text" placeholder="Buscar por nombre, email o cédula..."
          [(ngModel)]="searchTerm" (ngModelChange)="onSearch($event)"/>
      </div>

      <div class="table-card">
        @if (loading()) {
          <div class="loading-state">
            @for (i of [1,2,3,4,5]; track i) { <div class="skeleton-row"></div> }
          </div>
        } @else if (patients().length === 0) {
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
            </svg>
            <p>No se encontraron pacientes</p>
            <button class="btn-outline" (click)="showModal.set(true)">Registrar primer paciente</button>
          </div>
        } @else {
          <table class="table">
            <thead>
              <tr>
                <th>Paciente</th><th>Teléfono</th><th>Email</th><th>Fecha nac.</th><th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (p of patients(); track p.id) {
                <tr [class.row-inactive]="!p.is_active">
                  <td>
                    <div class="patient-cell">
                      <div class="patient-avatar" [class.avatar-inactive]="!p.is_active">{{ initials(p) }}</div>
                      <div>
                        <div class="patient-name">{{ p.full_name }}</div>
                        @if (p.national_id) { <div class="patient-id">CI: {{ p.national_id }}</div> }
                      </div>
                    </div>
                  </td>
                  <td class="td-secondary">{{ p.phone }}</td>
                  <td class="td-secondary">{{ p.email ?? '—' }}</td>
                  <td class="td-secondary">{{ formatDate(p.date_of_birth) }}</td>
                  <td>
                    <span class="badge" [class.badge-green]="p.is_active" [class.badge-gray]="!p.is_active">
                      {{ p.is_active ? 'Activo' : 'Inactivo' }}
                    </span>
                  </td>
                  <td>
                    <div class="row-actions">
                      <a class="btn-action btn-view" [routerLink]="['/patients', p.id]">Ver</a>
                      <button
                        class="btn-action"
                        [class.btn-warn]="p.is_active"
                        [class.btn-success]="!p.is_active"
                        (click)="toggleActivo(p)"
                        [title]="p.is_active ? 'Desactivar paciente' : 'Reactivar paciente'"
                      >{{ p.is_active ? 'Desactivar' : 'Activar' }}</button>
                      <button
                        class="btn-action btn-danger"
                        (click)="confirmarEliminar(p)"
                        title="Eliminar permanentemente"
                      >Eliminar</button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
          <div class="pagination">
            <span class="pag-info">{{ pagStart() }}–{{ pagEnd() }} de {{ total() }}</span>
            <div class="pag-btns">
              <button class="pag-btn" [disabled]="page() === 1" (click)="goPage(page()-1)">← Anterior</button>
              <button class="pag-btn" [disabled]="pagEnd() >= total()" (click)="goPage(page()+1)">Siguiente →</button>
            </div>
          </div>
        }
      </div>
    </div>

    <!-- MODAL NUEVO PACIENTE -->
    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Nuevo paciente</h2>
            <button class="modal-close" (click)="closeModal()">✕</button>
          </div>
          <form class="modal-form" (ngSubmit)="createPatient()">
            <div class="form-row">
              <div class="field">
                <label>Nombre *</label>
                <input type="text" [(ngModel)]="form.first_name" name="first_name" required placeholder="Juan"/>
              </div>
              <div class="field">
                <label>Apellido *</label>
                <input type="text" [(ngModel)]="form.last_name" name="last_name" required placeholder="Pérez"/>
              </div>
            </div>
            <div class="form-row">
              <div class="field">
                <label>Teléfono *</label>
                <input type="tel" [(ngModel)]="form.phone" name="phone" required placeholder="+1-305-555-0100"/>
              </div>
              <div class="field">
                <label>Fecha de nacimiento *</label>
                <input type="date" [(ngModel)]="form.date_of_birth" name="dob" required/>
              </div>
            </div>
            <div class="form-row">
              <div class="field">
                <label>Email</label>
                <input type="email" [(ngModel)]="form.email" name="email" placeholder="juan@email.com"/>
              </div>
              <div class="field">
                <label>Cédula / ID</label>
                <input type="text" [(ngModel)]="form.national_id" name="national_id" placeholder="V-12345678"/>
              </div>
            </div>
            <div class="field">
              <label>Alergias</label>
              <input type="text" [(ngModel)]="form.allergies" name="allergies" placeholder="Penicilina, látex..."/>
            </div>
            @if (formError()) { <div class="form-error">{{ formError() }}</div> }
            <div class="modal-actions">
              <button type="button" class="btn-outline" (click)="closeModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="saving()">
                {{ saving() ? 'Guardando...' : 'Registrar paciente' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- CONFIRM ELIMINAR -->
    @if (pacienteAEliminar()) {
      <div class="modal-overlay" (click)="pacienteAEliminar.set(null)">
        <div class="modal modal-sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>⚠️ Eliminar paciente</h2>
            <button class="modal-close" (click)="pacienteAEliminar.set(null)">✕</button>
          </div>
          <div class="confirm-body">
            <p>¿Estás seguro de que deseas eliminar a <strong>{{ pacienteAEliminar()!.full_name }}</strong>?</p>
            <p class="confirm-warn">Esta acción desactiva el paciente y oculta sus registros. No se puede deshacer.</p>
          </div>
          <div class="modal-actions" style="padding: 0 0 4px">
            <button class="btn-outline" (click)="pacienteAEliminar.set(null)">Cancelar</button>
            <button class="btn-danger-solid" [disabled]="saving()" (click)="eliminarPaciente()">
              {{ saving() ? 'Eliminando...' : 'Sí, eliminar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page{padding:28px 32px;max-width:1200px}
    .page-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px}
    .page-title{font-size:22px;font-weight:600;color:#0D3D3D;margin:0 0 4px}
    .page-sub{font-size:13px;color:#6B7280;margin:0}
    .btn-primary{display:flex;align-items:center;gap:6px;background:#0D6E6E;color:#fff;border:none;padding:9px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;text-decoration:none;transition:background .15s}
    .btn-primary:hover:not(:disabled){background:#0A5555}
    .btn-primary:disabled{opacity:.6;cursor:not-allowed}
    .btn-outline{background:#fff;color:#374151;border:1.5px solid #E5E7EB;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;transition:border-color .15s}
    .btn-outline:hover{border-color:#0D6E6E;color:#0D6E6E}
    .search-bar{position:relative;margin-bottom:16px}
    .search-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);width:16px;height:16px;stroke:#9CA3AF}
    .search-input{width:100%;padding:10px 14px 10px 38px;border:1.5px solid #E5E7EB;border-radius:8px;font-size:13px;outline:none;background:#fff;box-sizing:border-box;transition:border-color .15s}
    .search-input:focus{border-color:#0D6E6E}
    .table-card{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)}
    .table{width:100%;border-collapse:collapse}
    .table thead th{text-align:left;padding:12px 16px;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:.05em;background:#F9FAFB;border-bottom:1px solid #F0F0F0}
    .table tbody tr{transition:background .1s}
    .table tbody tr:hover{background:#F9FAFB}
    .table tbody tr.row-inactive{opacity:.6}
    .table tbody td{padding:13px 16px;border-bottom:1px solid #F7F7F7}
    .td-secondary{font-size:13px;color:#6B7280}
    .patient-cell{display:flex;align-items:center;gap:10px}
    .patient-avatar{width:34px;height:34px;border-radius:50%;background:#0D6E6E1A;color:#0D6E6E;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
    .patient-avatar.avatar-inactive{background:#F3F4F6;color:#9CA3AF}
    .patient-name{font-size:13px;font-weight:500;color:#111827}
    .patient-id{font-size:11px;color:#9CA3AF;margin-top:1px}
    .badge{font-size:11px;font-weight:500;padding:3px 8px;border-radius:20px}
    .badge-green{background:#ECFDF5;color:#059669}
    .badge-gray{background:#F3F4F6;color:#9CA3AF}

    /* Acciones */
    .row-actions{display:flex;align-items:center;gap:6px}
    .btn-action{font-size:11px;font-weight:600;padding:4px 10px;border-radius:6px;border:none;cursor:pointer;text-decoration:none;transition:all .15s;display:inline-flex;align-items:center}
    .btn-view{background:#EFF6FF;color:#2563EB}
    .btn-view:hover{background:#DBEAFE}
    .btn-warn{background:#FFFBEB;color:#D97706}
    .btn-warn:hover{background:#FEF3C7}
    .btn-success{background:#ECFDF5;color:#059669}
    .btn-success:hover{background:#D1FAE5}
    .btn-danger{background:#FEF2F2;color:#DC2626}
    .btn-danger:hover{background:#FEE2E2}

    .pagination{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-top:1px solid #F0F0F0}
    .pag-info{font-size:12px;color:#6B7280}
    .pag-btns{display:flex;gap:8px}
    .pag-btn{font-size:12px;font-weight:500;padding:6px 12px;border:1.5px solid #E5E7EB;border-radius:6px;background:#fff;cursor:pointer;color:#374151;transition:all .15s}
    .pag-btn:hover:not(:disabled){border-color:#0D6E6E;color:#0D6E6E}
    .pag-btn:disabled{opacity:.4;cursor:not-allowed}
    .empty-state{display:flex;flex-direction:column;align-items:center;gap:12px;padding:48px;color:#9CA3AF;font-size:13px}
    .loading-state{display:flex;flex-direction:column;gap:0}
    .skeleton-row{height:52px;background:linear-gradient(90deg,#F3F4F6 25%,#E5E7EB 50%,#F3F4F6 75%);background-size:200%;animation:shimmer 1.5s infinite;border-bottom:1px solid #F7F7F7}
    @keyframes shimmer{0%{background-position:200%}100%{background-position:-200%}}

    .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:100}
    .modal{background:#fff;border-radius:14px;padding:28px;width:560px;max-width:95vw;max-height:90vh;overflow-y:auto}
    .modal-sm{width:420px}
    .modal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
    .modal-header h2{font-size:17px;font-weight:600;color:#0D3D3D;margin:0}
    .modal-close{background:none;border:none;font-size:18px;cursor:pointer;color:#9CA3AF;line-height:1}
    .modal-form{display:flex;flex-direction:column;gap:14px}
    .form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .field{display:flex;flex-direction:column;gap:5px}
    .field label{font-size:12px;font-weight:500;color:#374151}
    .field input{padding:9px 12px;border:1.5px solid #E5E7EB;border-radius:7px;font-size:13px;outline:none;transition:border-color .15s}
    .field input:focus{border-color:#0D6E6E}
    .form-error{font-size:12px;color:#EF4444;background:#FEF2F2;padding:8px 12px;border-radius:6px}
    .modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:8px}

    .confirm-body{margin-bottom:20px}
    .confirm-body p{font-size:13px;color:#374151;margin:0 0 8px}
    .confirm-warn{font-size:12px;color:#DC2626;background:#FEF2F2;padding:8px 12px;border-radius:6px;margin:0!important}
    .btn-danger-solid{background:#DC2626;color:#fff;border:none;padding:9px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:background .15s}
    .btn-danger-solid:hover:not(:disabled){background:#B91C1C}
    .btn-danger-solid:disabled{opacity:.6;cursor:not-allowed}
  `]
})
export class PatientsComponent implements OnInit {
  private svc = inject(PatientService);

  patients           = signal<Patient[]>([]);
  total              = signal(0);
  loading            = signal(true);
  showModal          = signal(false);
  saving             = signal(false);
  formError          = signal('');
  page               = signal(1);
  pacienteAEliminar  = signal<Patient | null>(null);
  searchTerm         = '';
  form: any          = { first_name:'', last_name:'', phone:'', date_of_birth:'' };
  private search$    = new Subject<string>();

  ngOnInit() {
    this.load();
    this.search$.pipe(
      debounceTime(350), distinctUntilChanged(),
      switchMap((term: string) => {
        this.loading.set(true); this.page.set(1);
        return this.svc.list(1, 20, term);
      })
    ).subscribe((res: any) => {
      this.patients.set(res.items); this.total.set(res.total); this.loading.set(false);
    });
  }

  load() {
    this.loading.set(true);
    this.svc.list(this.page(), 20, this.searchTerm).subscribe((res: any) => {
      this.patients.set(res.items); this.total.set(res.total); this.loading.set(false);
    });
  }

  onSearch(term: string) { this.search$.next(term); }
  goPage(p: number)      { this.page.set(p); this.load(); }
  pagStart()             { return (this.page()-1)*20+1; }
  pagEnd()               { return Math.min(this.page()*20, this.total()); }

  initials(p: Patient) {
    const n = p.full_name || '?';
    const parts = n.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase()
      : n[0].toUpperCase();
  }
  formatDate(d: string) { return new Date(d).toLocaleDateString('es-ES'); }

  closeModal() {
    this.showModal.set(false);
    this.form = { first_name:'', last_name:'', phone:'', date_of_birth:'' };
    this.formError.set('');
  }

  createPatient() {
    if (!this.form.first_name || !this.form.last_name || !this.form.phone || !this.form.date_of_birth) {
      this.formError.set('Completa los campos obligatorios.'); return;
    }
    this.saving.set(true);
    this.svc.create(this.form).subscribe({
      next: () => { this.saving.set(false); this.closeModal(); this.load(); },
      error: (e: any) => { this.saving.set(false); this.formError.set(e.error?.detail ?? 'Error al guardar.'); }
    });
  }

  // Soft toggle: activo ↔ inactivo via PATCH
  toggleActivo(p: Patient) {
    this.svc.update(p.id, { is_active: !p.is_active } as any).subscribe({
      next: updated => this.patients.update(ps => ps.map(x => x.id === updated.id ? updated : x))
    });
  }

  confirmarEliminar(p: Patient) { this.pacienteAEliminar.set(p); }

  // Hard delete: llama DELETE /patients/{id} (soft delete en backend — pone is_active=false)
  eliminarPaciente() {
    const p = this.pacienteAEliminar();
    if (!p) return;
    this.saving.set(true);
    this.svc.delete(p.id).subscribe({
      next: () => {
        this.patients.update(ps => ps.filter(x => x.id !== p.id));
        this.total.update(t => t - 1);
        this.saving.set(false);
        this.pacienteAEliminar.set(null);
      },
      error: () => this.saving.set(false)
    });
  }
}