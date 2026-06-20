import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppointmentService, Appointment, AppointmentCreate } from '@core/services/appointment.service';
import { PatientService, Patient } from '@core/services/patient.service';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Citas</h1>
          <p class="page-sub">{{ total() }} citas en total</p>
        </div>
        <button class="btn-primary" (click)="openModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nueva cita
        </button>
      </div>

      <div class="filters">
        <select class="filter-select" [(ngModel)]="statusFilter" (ngModelChange)="onFilterChange()">
          <option value="">Todos los estados</option>
          <option value="scheduled">Programadas</option>
          <option value="confirmed">Confirmadas</option>
          <option value="in_progress">En curso</option>
          <option value="completed">Completadas</option>
          <option value="cancelled">Canceladas</option>
          <option value="no_show">No asistió</option>
        </select>
        <input type="date" class="filter-select" [(ngModel)]="dateFrom" (ngModelChange)="onFilterChange()" placeholder="Desde"/>
        <input type="date" class="filter-select" [(ngModel)]="dateTo" (ngModelChange)="onFilterChange()" placeholder="Hasta"/>
      </div>

      <div class="appt-list">
        @if (loading()) {
          @for (i of [1,2,3,4]; track i) {
            <div class="skeleton-row"></div>
          }
        } @else if (appointments().length === 0) {
          <div class="empty-state">
            <p>No hay citas para los filtros seleccionados</p>
          </div>
        } @else {
          @for (appt of appointments(); track appt.id) {
            <div class="appt-card">
              <div class="appt-date-block">
                <div class="appt-day">{{ formatDay(appt.scheduled_at) }}</div>
                <div class="appt-month">{{ formatMonth(appt.scheduled_at) }}</div>
                <div class="appt-year">{{ formatYear(appt.scheduled_at) }}</div>
              </div>
              <div class="appt-divider"></div>
              <div class="appt-body">
                <div class="appt-time-type">
                  <span class="appt-time">{{ formatTime(appt.scheduled_at) }}</span>
                  <span class="appt-type">{{ appt.appointment_type }}</span>
                </div>
                <div class="appt-patient">Paciente #{{ appt.patient_id }}</div>
                @if (appt.reason) { <div class="appt-reason">{{ appt.reason }}</div> }
              </div>
              <div class="appt-duration">{{ appt.duration_minutes }} min</div>
              <span class="appt-badge" [class]="'status-' + appt.status">
                {{ statusLabel(appt.status) }}
              </span>
              <div class="appt-actions">
                @if (appt.status === 'scheduled') {
                  <button class="action-btn confirm-btn" (click)="updateStatus(appt.id, 'confirmed')">Confirmar</button>
                }
                @if (['scheduled','confirmed'].includes(appt.status)) {
                  <button class="action-btn cancel-btn" (click)="updateStatus(appt.id, 'cancelled')">Cancelar</button>
                }
                @if (appt.status === 'confirmed') {
                  <button class="action-btn complete-btn" (click)="updateStatus(appt.id, 'completed')">Completar</button>
                }
                @if (appt.status === 'completed') {
                  <button class="action-btn" style="background:#FEF2F2;color:#EF4444;" (click)="updateStatus(appt.id, 'no_show')">No asistió</button>
                }
              </div>
            </div>
          }
        }
      </div>

      @if (total() > 0) {
        <div class="pagination">
          <span class="pag-info">Página {{ page() }} de {{ totalPages() }}</span>
          <div class="pag-btns">
            <button class="pag-btn" [disabled]="page() === 1" (click)="goPage(page()-1)">← Anterior</button>
            <button class="pag-btn" [disabled]="page() === totalPages() || appointments().length < 20" (click)="goPage(page()+1)">Siguiente →</button>
          </div>
        </div>
      }
    </div>

    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Nueva cita</h2>
            <button class="modal-close" (click)="closeModal()">✕</button>
          </div>
          <form class="modal-form" (ngSubmit)="createAppointment()">
            <div class="field" style="position:relative">
              <label>Paciente *</label>
              <input type="text" 
                     class="field-input" 
                     [(ngModel)]="patientSearch" 
                     name="ps"
                     placeholder="Buscar paciente (mínimo 2 caracteres)..." 
                     autocomplete="off"
                     (input)="onSearchInput($event)"
                     (blur)="checkPatientStatus()"
                     [class.input-error]="formError() && !form.patient_id" />
                     
              @if (patientResults().length > 0) {
                <div class="patient-dropdown">
                  @for (p of patientResults(); track p.id) {
                    <div class="patient-option" (mousedown)="selectPatient(p)">
                      <strong>{{ p.full_name ?? p.first_name }}</strong>
                      <span>{{ p.phone }}</span>
                    </div>
                  }
                </div>
              }
              @if (form.patient_id) {
                <div class="selected-tag">✓ Paciente seleccionado</div>
              }
            </div>

            <div class="form-row">
              <div class="field">
                <label>Fecha y hora *</label>
                <input type="datetime-local" class="field-input" [(ngModel)]="localDatetime" name="sat" required/>
              </div>
              <div class="field">
                <label>Duración (min)</label>
                <select class="field-input" [(ngModel)]="form.duration_minutes" name="dur">
                  <option [value]="30">30 min</option>
                  <option [value]="60">60 min</option>
                  <option [value]="90">90 min</option>
                  <option [value]="120">2 horas</option>
                </select>
              </div>
            </div>

            <div class="field">
              <label>Tipo de cita</label>
              <select class="field-input" [(ngModel)]="form.appointment_type" name="atype">
                <option value="consultation">Consulta general</option>
                <option value="cleaning">Limpieza dental</option>
                <option value="xray">Radiografía</option>
                <option value="extraction">Extracción</option>
                <option value="root_canal">Endodoncia</option>
                <option value="orthodontics">Ortodoncia</option>
                <option value="surgery">Cirugía oral</option>
                <option value="followup">Seguimiento</option>
              </select>
            </div>

            <div class="field">
              <label>Motivo</label>
              <input type="text" class="field-input" [(ngModel)]="form.reason" name="reason" placeholder="Dolor molar, control rutinario..."/>
            </div>

            @if (formError()) {
              <div class="form-error">{{ formError() }}</div>
            }
            <div class="modal-actions">
              <button type="button" class="btn-outline" (click)="closeModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="saving()">
                {{ saving() ? 'Guardando...' : 'Programar cita' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [
    `
    .page { padding: 28px 32px; max-width: 1000px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-title { font-size: 22px; font-weight: 600; color: #0D3D3D; margin: 0 0 4px; }
    .page-sub { font-size: 13px; color: #6B7280; margin: 0; }
    .btn-primary { display: flex; align-items: center; gap: 6px; background: #0D6E6E; color: #fff; border: none; padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
    .btn-primary:hover:not(:disabled) { background: #0A5555; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-outline { background: #fff; color: #374151; border: 1.5px solid #E5E7EB; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; }
    .filters { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
    .filter-select { padding: 8px 12px; border: 1.5px solid #E5E7EB; border-radius: 8px; font-size: 13px; background: #fff; outline: none; cursor: pointer; }
    .filter-select:focus { border-color: #0D6E6E; }
    .appt-list { display: flex; flex-direction: column; gap: 10px; }
    .appt-card { background: #fff; border-radius: 12px; padding: 16px 20px; display: flex; align-items: center; gap: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); transition: box-shadow 0.15s; flex-wrap: wrap; }
    .appt-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .appt-date-block { text-align: center; min-width: 44px; flex-shrink: 0; }
    .appt-day { font-size: 24px; font-weight: 700; color: #0D3D3D; line-height: 1; }
    .appt-month { font-size: 11px; color: #0D6E6E; font-weight: 600; text-transform: uppercase; }
    .appt-year { font-size: 10px; color: #9CA3AF; }
    .appt-divider { width: 1px; height: 40px; background: #E5E7EB; flex-shrink: 0; }
    .appt-body { flex: 1; min-width: 150px; }
    .appt-time-type { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; flex-wrap: wrap; }
    .appt-time { font-size: 15px; font-weight: 700; color: #0D6E6E; }
    .appt-type { font-size: 12px; color: #6B7280; background: #F3F4F6; padding: 2px 8px; border-radius: 20px; text-transform: capitalize; }
    .appt-patient { font-size: 13px; font-weight: 500; color: #111827; }
    .appt-reason { font-size: 12px; color: #9CA3AF; margin-top: 2px; }
    .appt-duration { font-size: 12px; color: #9CA3AF; flex-shrink: 0; }
    .appt-badge { font-size: 11px; font-weight: 500; padding: 4px 10px; border-radius: 20px; flex-shrink: 0; }
    .status-scheduled { background: #EFF6FF; color: #2563EB; }
    .status-confirmed { background: #ECFDF5; color: #059669; }
    .status-in_progress { background: #FFFBEB; color: #D97706; }
    .status-completed { background: #F3F4F6; color: #6B7280; }
    .status-cancelled { background: #FEF2F2; color: #EF4444; }
    .status-no_show { background: #FEF2F2; color: #DC2626; }
    .appt-actions { display: flex; gap: 6px; flex-shrink: 0; flex-wrap: wrap; }
    .action-btn { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 6px; border: none; cursor: pointer; transition: opacity 0.15s; }
    .action-btn:hover { opacity: 0.8; }
    .confirm-btn { background: #ECFDF5; color: #059669; }
    .cancel-btn { background: #FEF2F2; color: #EF4444; }
    .complete-btn { background: #F3E8FF; color: #7C3AED; }
    .pagination { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; flex-wrap: wrap; gap: 10px; }
    .pag-info { font-size: 12px; color: #6B7280; }
    .pag-btns { display: flex; gap: 8px; }
    .pag-btn { font-size: 12px; padding: 6px 12px; border: 1.5px solid #E5E7EB; border-radius: 6px; background: #fff; cursor: pointer; transition: all 0.15s; }
    .pag-btn:hover:not(:disabled) { background: #F3F4F6; }
    .pag-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px; color: #9CA3AF; font-size: 13px; background: #fff; border-radius: 12px; }
    .skeleton-row { height: 76px; background: linear-gradient(90deg,#F3F4F6 25%,#E5E7EB 50%,#F3F4F6 75%); background-size: 200%; animation: shimmer 1.5s infinite; border-radius: 12px; }
    @keyframes shimmer { 0%{background-position:200%} 100%{background-position:-200%} }
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
    .modal { background: #fff; border-radius: 14px; padding: 28px; width: 520px; max-width: 95vw; max-height: 90vh; overflow-y: auto; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    .modal-header h2 { font-size: 17px; font-weight: 600; color: #0D3D3D; margin: 0; }
    .modal-close { background: none; border: none; font-size: 18px; cursor: pointer; color: #9CA3AF; padding: 4px 8px; border-radius: 4px; }
    .modal-close:hover { background: #F3F4F6; }
    .modal-form { display: flex; flex-direction: column; gap: 14px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .field { display: flex; flex-direction: column; gap: 5px; }
    .field label { font-size: 12px; font-weight: 500; color: #374151; }
    .field-input { padding: 9px 12px; border: 1.5px solid #E5E7EB; border-radius: 7px; font-size: 13px; outline: none; transition: border-color 0.15s; background: #fff; width: 100%; box-sizing: border-box; }
    .field-input:focus { border-color: #0D6E6E; }
    .field-input.input-error { border-color: #EF4444; }
    .patient-dropdown { position: absolute; top: 100%; left: 0; right: 0; z-index: 20; background: #fff; border: 1.5px solid #E5E7EB; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); max-height: 200px; overflow-y: auto; }
    .patient-option { padding: 10px 12px; cursor: pointer; display: flex; justify-content: space-between; font-size: 13px; align-items: center; }
    .patient-option:hover { background: #F0F4F8; }
    .patient-option span { font-size: 12px; color: #9CA3AF; }
    .selected-tag { font-size: 12px; color: #059669; background: #ECFDF5; padding: 5px 10px; border-radius: 6px; margin-top: 4px; }
    .form-error { font-size: 12px; color: #EF4444; background: #FEF2F2; padding: 8px 12px; border-radius: 6px; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
    @media (max-width: 640px) {
      .page { padding: 16px; }
      .form-row { grid-template-columns: 1fr; }
      .appt-card { flex-direction: column; align-items: stretch; }
      .appt-divider { display: none; }
    }
    `
  ]
})
export class AppointmentsComponent implements OnInit {
  appointments = signal<Appointment[]>([]);
  total = signal(0);
  loading = signal(true);
  showModal = signal(false);
  saving = signal(false);
  formError = signal('');
  page = signal(1);
  statusFilter = '';
  dateFrom = '';
  dateTo = '';
  
  patientSearch = '';
  patientResults = signal<Patient[]>([]);
  localDatetime = '';

  form: AppointmentCreate & { duration_minutes: number; appointment_type: string } = {
    patient_id: 0, doctor_id: 0, scheduled_at: '',
    duration_minutes: 60, appointment_type: 'consultation',
  };

  constructor(
    private svc: AppointmentService,
    private patientSvc: PatientService,
    private auth: AuthService,
  ) {}

  ngOnInit() { this.load(); }

  onFilterChange() {
    this.page.set(1);
    this.load();
  }

  load() {
    this.loading.set(true);
    const filters: any = { page: this.page(), per_page: 20 };
    
    if (this.statusFilter) filters.status = this.statusFilter;
    if (this.dateFrom) filters.date_from = this.dateFrom + 'T00:00:00';
    if (this.dateTo) filters.date_to = this.dateTo + 'T23:59:59';
    
    this.svc.list(filters).subscribe({
      next: (res) => {
        this.appointments.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (e) => {
        console.error('Error al cargar citas:', e);
        this.loading.set(false);
      }
    });
  }

  goPage(p: number) { 
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p); 
    this.load(); 
  }

  totalPages(): number {
    return Math.ceil(this.total() / 20) || 1;
  }

  onSearchInput(event: Event) {
    const term = (event.target as HTMLInputElement).value;
    this.form.patient_id = 0; 
    
    if (term.length < 2) { 
      this.patientResults.set([]); 
      return; 
    }
    
    this.patientSvc.list(1, 6, term).subscribe({
      next: (res) => this.patientResults.set(res.items),
      error: () => this.patientResults.set([])
    });
  }

  selectPatient(p: Patient) {
    this.form.patient_id = p.id;
    this.patientSearch = p.full_name ?? p.first_name ?? 'Paciente';
    this.patientResults.set([]);
    this.formError.set('');
  }

  checkPatientStatus() {
    setTimeout(() => {
      if (this.patientSearch && this.form.patient_id === 0 && this.showModal()) {
        this.formError.set('Por favor, selecciona un paciente de la lista.');
      } else if (this.form.patient_id) {
        this.formError.set('');
      }
    }, 200);
  }

  openModal() {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
    now.setSeconds(0);
    now.setMilliseconds(0);
    
    // Ajuste para zona horaria local
    const offset = now.getTimezoneOffset();
    now.setMinutes(now.getMinutes() - offset);
    
    this.localDatetime = now.toISOString().slice(0, 16);
    this.showModal.set(true);
    this.formError.set('');
    this.patientResults.set([]);
  }

  closeModal() {
    this.showModal.set(false);
    this.form = { patient_id: 0, doctor_id: 0, scheduled_at: '', duration_minutes: 60, appointment_type: 'consultation' };
    this.patientSearch = '';
    this.localDatetime = '';
    this.formError.set('');
    this.patientResults.set([]);
  }

  createAppointment() {
    this.formError.set('');

    if (!this.form.patient_id) {
      this.formError.set('Por favor, selecciona un paciente de la lista.');
      return;
    }
    
    if (!this.localDatetime) {
      this.formError.set('Selecciona fecha y hora para la cita.');
      return;
    }

    try {
      const dateObj = new Date(this.localDatetime);
      if (isNaN(dateObj.getTime())) {
        this.formError.set('Formato de fecha inválido.');
        return;
      }
      this.form.scheduled_at = dateObj.toISOString();
    } catch (e) {
      this.formError.set('Error al procesar la fecha.');
      return;
    }

    const user = this.auth.currentUser();
    this.form.doctor_id = user?.id ?? 1;
    this.saving.set(true);

    this.svc.create(this.form).subscribe({
      next: () => { 
        this.saving.set(false); 
        this.closeModal(); 
        this.load(); 
      },
      error: (e) => { 
        this.saving.set(false); 
        console.error('Error al crear cita:', e);
        
        if (e.status === 422 && e.error?.detail) {
          const details = e.error.detail;
          if (Array.isArray(details) && details.length > 0) {
            const msg = details[0]?.msg || 'Error de validación de datos';
            this.formError.set(`Error: ${msg}`);
          } else if (typeof details === 'string') {
            this.formError.set(`Error: ${details}`);
          } else {
            this.formError.set('Error de validación de datos. Verifica todos los campos.');
          }
        } else if (e.error?.detail) {
          this.formError.set(`Error: ${e.error.detail}`);
        } else if (e.status === 409) {
          this.formError.set('El paciente ya tiene una cita programada en ese horario.');
        } else {
          this.formError.set('Error de servidor al guardar la cita. Por favor, intenta nuevamente.');
        }
      },
    });
  }

  updateStatus(id: number, status: string) {
    if (!id) return;
    
    this.svc.updateStatus(id, status).subscribe({
      next: () => this.load(),
      error: (e) => {
        console.error('Error al actualizar estado:', e);
        alert('Error al actualizar el estado de la cita.');
      }
    });
  }

  statusLabel(s: string): string {
    const map: Record<string, string> = { 
      scheduled: 'Programada', 
      confirmed: 'Confirmada', 
      in_progress: 'En curso', 
      completed: 'Completada', 
      cancelled: 'Cancelada', 
      no_show: 'No asistió' 
    };
    return map[s] ?? s;
  }
  
  formatDay(iso: string) { 
    if (!iso) return '';
    return new Date(iso).getDate(); 
  }
  
  formatMonth(iso: string) { 
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-ES', { month: 'short' }); 
  }
  
  formatYear(iso: string) { 
    if (!iso) return '';
    return new Date(iso).getFullYear(); 
  }
  
  formatTime(iso: string) { 
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); 
  }
}