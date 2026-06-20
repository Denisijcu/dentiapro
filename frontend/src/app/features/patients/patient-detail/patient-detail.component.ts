import { Component, OnInit, signal, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { PatientService, Patient } from '@core/services/patient.service';
import { XrayService, XRayAnalysis } from '@core/services/xray.service';
import { AppointmentService, Appointment } from '@core/services/appointment.service';
import { HistoriaClinicaService } from '../../historia-clinica/historia-clinica.service';
import { EntradaHistoria, NuevaEntrada, ActualizarEntrada } from '../../historia-clinica/historia-clinica.models';

type Tab = 'info' | 'history' | 'xray' | 'appointments';

@Component({
  selector: 'app-patient-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReactiveFormsModule],
  template: `
    <div class="page">
      <a routerLink="/patients" class="back-link">← Volver a pacientes</a>

      @if (loading()) {
        <div class="loading-page">Cargando paciente...</div>
      } @else if (patient()) {

        <div class="patient-header">
          <div class="patient-avatar-lg">{{ initials() }}</div>
          <div class="patient-info">
            <h1 class="patient-name">{{ patient()!.full_name }}</h1>
            <div class="patient-meta">
              @if (patient()!.national_id) { <span>CI: {{ patient()!.national_id }}</span> }
              <span>{{ formatDate(patient()!.date_of_birth) }}</span>
              <span>{{ patient()!.phone }}</span>
              @if (patient()!.email) { <span>{{ patient()!.email }}</span> }
            </div>
          </div>
          <div class="patient-actions">
            <a class="btn-primary" [routerLink]="['/xray']" [queryParams]="{patientId: patient()!.id}">
              Subir Rayos X
            </a>
          </div>
        </div>

        <div class="tabs">
          @for (tab of tabs; track tab.id) {
            <button class="tab" [class.active]="activeTab() === tab.id" (click)="setTab(tab.id)">
              {{ tab.label }}
            </button>
          }
        </div>

        <div class="tab-content">

          <!-- ── INFO ── -->
          @if (activeTab() === 'info') {
            <div class="info-grid">
              <div class="info-section">
                <h3>Datos personales</h3>
                <div class="info-rows">
                  <div class="info-row"><span>Nombre completo</span><strong>{{ patient()!.full_name }}</strong></div>
                  <div class="info-row"><span>Fecha de nac.</span><strong>{{ formatDate(patient()!.date_of_birth) }}</strong></div>
                  <div class="info-row"><span>Teléfono</span><strong>{{ patient()!.phone }}</strong></div>
                  <div class="info-row"><span>Email</span><strong>{{ patient()!.email ?? '—' }}</strong></div>
                  <div class="info-row"><span>Cédula</span><strong>{{ patient()!.national_id ?? '—' }}</strong></div>
                </div>
              </div>
              <div class="info-section">
                <h3>Datos médicos</h3>
                <div class="info-rows">
                  <div class="info-row"><span>Tipo de sangre</span>
                    <span class="badge-blood">{{ patient()!.blood_type }}</span>
                  </div>
                  <div class="info-row"><span>Alergias</span><strong>{{ patient()!.allergies ?? 'Ninguna conocida' }}</strong></div>
                  <div class="info-row"><span>Medicamentos</span><strong>{{ patient()!.current_medications ?? '—' }}</strong></div>
                  <div class="info-row"><span>Seguro</span><strong>{{ patient()!.insurance_provider ?? '—' }}</strong></div>
                </div>
              </div>
            </div>
          }

          <!-- ── HISTORIA CLÍNICA ── -->
          @if (activeTab() === 'history') {
            <div class="hc-section">
              <div class="hc-toolbar">
                <h3>Entradas clínicas</h3>
                <button class="btn-primary btn-sm" (click)="abrirModalEntrada()">+ Nueva entrada</button>
              </div>

              @if (loadingHistory()) {
                <div class="loading-state">Cargando historial...</div>
              } @else if (entradas().length === 0) {
                <div class="empty-state">
                  <p>No hay entradas clínicas registradas.</p>
                  <button class="btn-primary" (click)="abrirModalEntrada()">Agregar primera entrada</button>
                </div>
              } @else {
                <div class="timeline">
                  @for (e of entradas(); track e.id) {
                    <div class="timeline-item">
                      <div class="timeline-dot"></div>
                      <div class="timeline-content">
                        <div class="entry-header">
                          <span class="entry-badge">Consulta</span>
                          <div class="entry-right">
                            <span class="entry-date">{{ e.visit_date | date:'dd/MM/yyyy HH:mm' }}</span>
                            <button class="btn-icon" (click)="abrirModalEditar(e)" title="Editar">✏️</button>
                          </div>
                        </div>
                        <div class="entry-fields">
                          <p><strong>Motivo:</strong> {{ e.chief_complaint }}</p>
                          <p><strong>Diagnóstico:</strong> {{ e.diagnosis }}</p>
                          @if (e.treatment_performed) { <p><strong>Tratamiento:</strong> {{ e.treatment_performed }}</p> }
                          @if (e.treatment_plan)      { <p><strong>Plan:</strong> {{ e.treatment_plan }}</p> }
                          @if (e.prescriptions)       { <p><strong>Prescripciones:</strong> {{ e.prescriptions }}</p> }
                          @if (e.notes)               { <p><strong>Notas:</strong> {{ e.notes }}</p> }
                          @if (e.follow_up_date)      { <p>📅 <strong>Próxima cita:</strong> {{ e.follow_up_date | date:'dd/MM/yyyy' }}</p> }
                        </div>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }

          <!-- ── RAYOS X ── -->
          @if (activeTab() === 'xray') {
            @if (loadingXrays()) {
              <div class="loading-state">Cargando análisis...</div>
            } @else if (xrays().length === 0) {
              <div class="empty-state">
                <p>No hay radiografías registradas para este paciente.</p>
                <a class="btn-primary" [routerLink]="['/xray']">Subir primera radiografía</a>
              </div>
            } @else {
              <div class="xray-grid">
                @for (xray of xrays(); track xray.id) {
                  <div class="xray-card">
                    <div class="xray-img-wrap">
                      <img [src]="xray.heatmap_url || xray.image_url" [alt]="'RX ' + xray.image_type" class="xray-img"/>
                      <span class="xray-status" [class]="'xstatus-' + xray.status">{{ xray.status }}</span>
                    </div>
                    <div class="xray-meta">
                      <div class="xray-type">{{ xray.image_type }}</div>
                      <div class="xray-date">{{ formatDate(xray.created_at) }}</div>
                      @if (xray.ai_confidence_score) {
                        <div class="xray-confidence">Confianza IA: <strong>{{ (xray.ai_confidence_score * 100).toFixed(0) }}%</strong></div>
                      }
                      @if (xray.ai_diagnosis) { <p class="xray-diagnosis">{{ xray.ai_diagnosis }}</p> }
                    </div>
                  </div>
                }
              </div>
            }
          }

          <!-- ── CITAS ── -->
          @if (activeTab() === 'appointments') {
            @if (loadingAppts()) {
              <div class="loading-state">Cargando citas...</div>
            } @else if (appointments().length === 0) {
              <div class="empty-state"><p>No hay citas registradas para este paciente.</p></div>
            } @else {
              <div class="appt-list">
                @for (appt of appointments(); track appt.id) {
                  <div class="appt-row">
                    <div class="appt-date">
                      <div class="appt-day">{{ formatDay(appt.scheduled_at) }}</div>
                      <div class="appt-month">{{ formatMonth(appt.scheduled_at) }}</div>
                    </div>
                    <div class="appt-body">
                      <div class="appt-time">{{ formatTime(appt.scheduled_at) }}</div>
                      <div class="appt-type">{{ appt.appointment_type }}</div>
                      @if (appt.reason) { <div class="appt-reason">{{ appt.reason }}</div> }
                    </div>
                    <span class="badge" [class]="'status-' + appt.status">{{ appt.status }}</span>
                  </div>
                }
              </div>
            }
          }

        </div>
      }
    </div>

    <!-- ── MODAL NUEVA / EDITAR ENTRADA ── -->
    @if (modalEntrada()) {
      <div class="modal-overlay" (click)="cerrarModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ entradaEditando() ? 'Editar entrada' : 'Nueva entrada clínica' }}</h3>
            <button class="btn-close" (click)="cerrarModal()">✕</button>
          </div>
          <form [formGroup]="entradaForm" (ngSubmit)="guardarEntrada()" class="modal-body">

            <div class="form-group">
              <label>Motivo de consulta *</label>
              <textarea formControlName="chief_complaint" rows="2" placeholder="Motivo principal de la visita…"></textarea>
              @if (entradaForm.get('chief_complaint')?.invalid && entradaForm.get('chief_complaint')?.touched) {
                <span class="field-error">Mínimo 5 caracteres</span>
              }
            </div>

            <div class="form-group">
              <label>Diagnóstico *</label>
              <textarea formControlName="diagnosis" rows="2" placeholder="Diagnóstico clínico…"></textarea>
              @if (entradaForm.get('diagnosis')?.invalid && entradaForm.get('diagnosis')?.touched) {
                <span class="field-error">Mínimo 5 caracteres</span>
              }
            </div>

            <div class="form-group">
              <label>Tratamiento realizado</label>
              <textarea formControlName="treatment_performed" rows="2" placeholder="Tratamiento aplicado…"></textarea>
            </div>

            <div class="form-group">
              <label>Plan de tratamiento</label>
              <textarea formControlName="treatment_plan" rows="2" placeholder="Próximos pasos…"></textarea>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Prescripciones</label>
                <input formControlName="prescriptions" type="text" placeholder="Medicamentos…" />
              </div>
              <div class="form-group">
                <label>Próxima cita</label>
                <input formControlName="follow_up_date" type="date" />
              </div>
            </div>

            <div class="form-group">
              <label>Notas adicionales</label>
              <textarea formControlName="notes" rows="2" placeholder="Observaciones…"></textarea>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-ghost" (click)="cerrarModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="entradaForm.invalid || guardando()">
                {{ guardando() ? 'Guardando…' : 'Guardar entrada' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    .page { padding: 28px 32px; max-width: 1100px; }
    .back-link { font-size: 13px; color: #0D6E6E; text-decoration: none; font-weight: 500; display: inline-block; margin-bottom: 20px; }

    .patient-header { display: flex; align-items: center; gap: 20px; background: #fff; border-radius: 14px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .patient-avatar-lg { width: 64px; height: 64px; border-radius: 50%; background: #0D6E6E; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; flex-shrink: 0; }
    .patient-info { flex: 1; }
    .patient-name { font-size: 20px; font-weight: 700; color: #0D3D3D; margin: 0 0 8px; }
    .patient-meta { display: flex; gap: 16px; flex-wrap: wrap; }
    .patient-meta span { font-size: 12px; color: #6B7280; }
    .patient-actions { display: flex; gap: 10px; }

    .tabs { display: flex; gap: 4px; border-bottom: 1.5px solid #E5E7EB; margin-bottom: 24px; }
    .tab { padding: 9px 16px; font-size: 13px; font-weight: 500; color: #6B7280; background: none; border: none; border-bottom: 2px solid transparent; margin-bottom: -1.5px; cursor: pointer; transition: color 0.15s, border-color 0.15s; }
    .tab.active { color: #0D6E6E; border-bottom-color: #0D6E6E; }

    /* Info */
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .info-section { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .info-section h3 { font-size: 13px; font-weight: 600; color: #0D3D3D; margin: 0 0 14px; text-transform: uppercase; letter-spacing: 0.05em; }
    .info-rows { display: flex; flex-direction: column; gap: 10px; }
    .info-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
    .info-row span:first-child { color: #6B7280; }
    .info-row strong { color: #111827; font-weight: 500; }
    .badge-blood { background: #FEF2F2; color: #EF4444; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 20px; }

    /* Historia Clínica */
    .hc-section { }
    .hc-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .hc-toolbar h3 { margin: 0; font-size: 15px; font-weight: 700; color: #0D3D3D; }
    .timeline { display: flex; flex-direction: column; gap: 0; }
    .timeline-item { display: flex; gap: 16px; position: relative; }
    .timeline-item:not(:last-child)::before { content: ''; position: absolute; left: 11px; top: 28px; bottom: -12px; width: 2px; background: #E5E7EB; }
    .timeline-dot { width: 24px; height: 24px; border-radius: 50%; background: #0D6E6E; box-shadow: 0 0 0 3px rgba(13,110,110,0.15); flex-shrink: 0; margin-top: 14px; }
    .timeline-content { flex: 1; background: #fff; border-radius: 10px; padding: 14px 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .entry-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .entry-badge { background: #E6F4F4; color: #0D6E6E; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; text-transform: uppercase; }
    .entry-right { display: flex; align-items: center; gap: 10px; }
    .entry-date { font-size: 11px; color: #9CA3AF; }
    .entry-fields p { font-size: 13px; color: #374151; margin: 4px 0; line-height: 1.5; }
    .entry-fields p strong { color: #111827; }

    /* XRay */
    .xray-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
    .xray-card { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .xray-img-wrap { position: relative; aspect-ratio: 1; background: #0D3D3D; }
    .xray-img { width: 100%; height: 100%; object-fit: cover; }
    .xray-status { position: absolute; top: 8px; right: 8px; font-size: 10px; font-weight: 600; padding: 3px 7px; border-radius: 20px; text-transform: uppercase; }
    .xstatus-analyzed { background: #ECFDF5; color: #059669; }
    .xstatus-processing { background: #FFFBEB; color: #D97706; }
    .xstatus-uploaded { background: #EFF6FF; color: #2563EB; }
    .xstatus-reviewed { background: #F3E8FF; color: #7C3AED; }
    .xray-meta { padding: 12px; }
    .xray-type { font-size: 13px; font-weight: 600; color: #0D3D3D; text-transform: capitalize; }
    .xray-date { font-size: 11px; color: #9CA3AF; margin-top: 2px; }
    .xray-confidence { font-size: 12px; color: #6B7280; margin-top: 6px; }
    .xray-diagnosis { font-size: 11px; color: #374151; margin: 6px 0 0; line-height: 1.4; }

    /* Appointments */
    .appt-list { display: flex; flex-direction: column; gap: 8px; }
    .appt-row { display: flex; align-items: center; gap: 16px; background: #fff; border-radius: 10px; padding: 14px 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .appt-date { text-align: center; min-width: 44px; }
    .appt-day { font-size: 22px; font-weight: 700; color: #0D3D3D; line-height: 1; }
    .appt-month { font-size: 11px; color: #9CA3AF; text-transform: uppercase; }
    .appt-body { flex: 1; }
    .appt-time { font-size: 14px; font-weight: 600; color: #0D6E6E; }
    .appt-type { font-size: 12px; color: #374151; text-transform: capitalize; }
    .appt-reason { font-size: 11px; color: #9CA3AF; margin-top: 2px; }
    .badge { font-size: 11px; font-weight: 500; padding: 3px 8px; border-radius: 20px; }
    .status-scheduled { background: #EFF6FF; color: #2563EB; }
    .status-confirmed { background: #ECFDF5; color: #059669; }
    .status-completed { background: #F3F4F6; color: #6B7280; }
    .status-cancelled { background: #FEF2F2; color: #EF4444; }

    /* Buttons */
    .btn-primary { display: inline-flex; align-items: center; gap: 6px; background: #0D6E6E; color: #fff; border: none; padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; transition: background 0.15s; }
    .btn-primary:hover:not(:disabled) { background: #0A5555; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-sm { padding: 6px 12px; font-size: 12px; }
    .btn-ghost { background: transparent; color: #6B7280; border: 1px solid #E5E7EB; padding: 8px 16px; border-radius: 8px; font-size: 13px; cursor: pointer; }
    .btn-ghost:hover { background: #F9FAFB; }
    .btn-icon { background: none; border: none; cursor: pointer; font-size: 14px; padding: 4px; border-radius: 4px; }
    .btn-icon:hover { background: #F3F4F6; }
    .btn-close { background: none; border: none; font-size: 1rem; cursor: pointer; color: #6B7280; padding: 4px 8px; }

    /* Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.15s ease; }
    .modal { background: #fff; border-radius: 14px; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.2); animation: slideUp 0.2s ease; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px 0; }
    .modal-header h3 { margin: 0; font-size: 1rem; color: #111827; }
    .modal-body { padding: 20px 24px; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding-top: 16px; border-top: 1px solid #E5E7EB; margin-top: 16px; }

    /* Form */
    .form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .form-group label { font-size: 12px; font-weight: 600; color: #374151; }
    .form-group input, .form-group textarea { padding: 9px 12px; border: 1px solid #D1D5DB; border-radius: 8px; font-size: 13px; outline: none; font-family: inherit; resize: vertical; }
    .form-group input:focus, .form-group textarea:focus { border-color: #0D6E6E; box-shadow: 0 0 0 3px rgba(13,110,110,0.1); }
    .field-error { font-size: 11px; color: #EF4444; }

    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px; color: #9CA3AF; font-size: 13px; }
    .loading-state { padding: 32px; text-align: center; color: #9CA3AF; font-size: 13px; }
    .loading-page { padding: 48px; text-align: center; color: #9CA3AF; }

    @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
  `],
})
export class PatientDetailComponent implements OnInit {
  @Input() id!: string;

  private readonly hcSvc = inject(HistoriaClinicaService);
  private readonly fb    = inject(FormBuilder);

  patient      = signal<Patient | null>(null);
  xrays        = signal<XRayAnalysis[]>([]);
  appointments = signal<Appointment[]>([]);
  entradas     = signal<EntradaHistoria[]>([]);
  loading        = signal(true);
  loadingXrays   = signal(false);
  loadingAppts   = signal(false);
  loadingHistory = signal(false);
  guardando      = signal(false);
  activeTab      = signal<Tab>('info');
  modalEntrada   = signal(false);
  entradaEditando = signal<EntradaHistoria | null>(null);

  tabs = [
    { id: 'info'         as Tab, label: 'Información' },
    { id: 'history'      as Tab, label: 'Historia clínica' },
    { id: 'xray'         as Tab, label: 'Rayos X' },
    { id: 'appointments' as Tab, label: 'Citas' },
  ];

  entradaForm = this.fb.group({
    chief_complaint:     ['', [Validators.required, Validators.minLength(5)]],
    diagnosis:           ['', [Validators.required, Validators.minLength(5)]],
    treatment_performed: [''],
    treatment_plan:      [''],
    prescriptions:       [''],
    notes:               [''],
    follow_up_date:      [''],
  });

  constructor(
    private patientSvc: PatientService,
    private xraySvc: XrayService,
    private apptSvc: AppointmentService,
  ) {}

  ngOnInit() {
    const patientId = Number(this.id);

    this.patientSvc.get(patientId).subscribe(p => {
      this.patient.set(p);
      this.loading.set(false);
    });

    this.loadingXrays.set(true);
    this.xraySvc.getPatientXrays(patientId).subscribe(x => {
      this.xrays.set(x);
      this.loadingXrays.set(false);
    });

    this.loadingAppts.set(true);
    this.apptSvc.list({ patient_id: patientId }).subscribe(a => {
      this.appointments.set(a.items);
      this.loadingAppts.set(false);
    });
  }

  setTab(tab: Tab) {
    this.activeTab.set(tab);
    // Carga lazy de historia clínica solo cuando se abre el tab
    if (tab === 'history' && this.entradas().length === 0 && !this.loadingHistory()) {
      this.cargarHistoria();
    }
  }

  cargarHistoria() {
    const patientId = Number(this.id);
    this.loadingHistory.set(true);
    this.hcSvc.getEntradas(patientId).subscribe({
      next: e => { this.entradas.set(e); this.loadingHistory.set(false); },
      error: () => this.loadingHistory.set(false)
    });
  }

  abrirModalEntrada() {
    this.entradaEditando.set(null);
    this.entradaForm.reset();
    this.modalEntrada.set(true);
  }

  abrirModalEditar(e: EntradaHistoria) {
    this.entradaEditando.set(e);
    this.entradaForm.patchValue({
      chief_complaint:     e.chief_complaint,
      diagnosis:           e.diagnosis,
      treatment_performed: e.treatment_performed ?? '',
      treatment_plan:      e.treatment_plan      ?? '',
      prescriptions:       e.prescriptions       ?? '',
      notes:               e.notes               ?? '',
      follow_up_date:      e.follow_up_date       ?? '',
    });
    this.modalEntrada.set(true);
  }

  cerrarModal() { this.modalEntrada.set(false); this.entradaEditando.set(null); }

  guardarEntrada() {
    if (this.entradaForm.invalid) return;
    this.guardando.set(true);
    const val = this.entradaForm.value;
    const patientId = Number(this.id);

    if (this.entradaEditando()) {
      const data: ActualizarEntrada = {
        chief_complaint:     val.chief_complaint     || undefined,
        diagnosis:           val.diagnosis           || undefined,
        treatment_performed: val.treatment_performed || undefined,
        treatment_plan:      val.treatment_plan      || undefined,
        prescriptions:       val.prescriptions       || undefined,
        notes:               val.notes               || undefined,
        follow_up_date:      val.follow_up_date      || undefined,
      };
      this.hcSvc.updateEntrada(this.entradaEditando()!.id, data).subscribe({
        next: e => {
          this.entradas.update(es => es.map(x => x.id === e.id ? e : x));
          this.guardando.set(false);
          this.cerrarModal();
        },
        error: () => this.guardando.set(false)
      });
    } else {
      const data: NuevaEntrada = {
        patient_id:          patientId,
        chief_complaint:     val.chief_complaint!,
        diagnosis:           val.diagnosis!,
        treatment_performed: val.treatment_performed || undefined,
        treatment_plan:      val.treatment_plan      || undefined,
        prescriptions:       val.prescriptions       || undefined,
        notes:               val.notes               || undefined,
        follow_up_date:      val.follow_up_date      || undefined,
      };
      this.hcSvc.addEntrada(data).subscribe({
        next: e => {
          this.entradas.update(es => [e, ...es]);
          this.guardando.set(false);
          this.cerrarModal();
        },
        error: () => this.guardando.set(false)
      });
    }
  }

  initials() {
    const p = this.patient();
    return p ? `${p.first_name[0]}${p.last_name[0]}`.toUpperCase() : '?';
  }
  formatDate(d: string) { return new Date(d).toLocaleDateString('es-ES'); }
  formatTime(iso: string) { return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); }
  formatDay(iso: string) { return new Date(iso).getDate(); }
  formatMonth(iso: string) { return new Date(iso).toLocaleDateString('es-ES', { month: 'short' }); }
}