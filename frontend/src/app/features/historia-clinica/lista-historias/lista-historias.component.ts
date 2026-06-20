import {
  Component, OnInit, inject, signal, DestroyRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject, switchMap, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HistoriaClinicaService } from '../historia-clinica.service';
import { PacienteResumen, EntradaHistoria, NuevaEntrada, ActualizarEntrada } from '../historia-clinica.models';

@Component({
  selector: 'app-lista-historias',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
<div class="hc-layout">

  <!-- SIDEBAR -->
  <aside class="hc-sidebar">
    <div class="sidebar-header">
      <h2>Historia Clínica</h2>
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" placeholder="Buscar paciente…"
          [(ngModel)]="searchQuery" (ngModelChange)="onSearch($event)" class="search-input" />
      </div>
    </div>
    <div class="pacientes-list">
      @if (loadingSearch()) {
        <div class="loading-state"><div class="spinner-sm"></div><span>Buscando…</span></div>
      }
      @for (p of pacientes(); track p.id) {
        <div class="paciente-card" [class.active]="pacienteSeleccionado()?.id === p.id" (click)="seleccionarPaciente(p)">
          <div class="pac-avatar">{{ inicialesPac(p) }}</div>
          <div class="pac-info">
            <span class="pac-nombre">{{ p.full_name }}</span>
            <span class="pac-cedula">{{ p.phone }}</span>
          </div>
        </div>
      }
      @if (!loadingSearch() && pacientes().length === 0 && searchQuery) {
        <div class="empty-search"><p>Sin resultados para "{{ searchQuery }}"</p></div>
      }
    </div>
  </aside>

  <!-- MAIN -->
  <main class="hc-main">
    @if (!pacienteSeleccionado()) {
      <div class="empty-state">
        <div class="empty-icon">🦷</div>
        <h3>Selecciona un paciente</h3>
        <p>Busca por nombre o cédula en el panel izquierdo</p>
      </div>
    } @else if (loadingHistoria()) {
      <div class="loading-full"><div class="spinner"></div></div>
    } @else {
      <!-- CABECERA -->
      <div class="patient-header">
        <div class="patient-avatar-lg">{{ inicialesPac(pacienteSeleccionado()!) }}</div>
        <div class="patient-data">
          <h2>{{ pacienteSeleccionado()!.full_name }}</h2>
          <div class="patient-meta">
            <span>📞 {{ pacienteSeleccionado()!.phone }}</span>
            @if (pacienteSeleccionado()!.email) {
              <span>✉️ {{ pacienteSeleccionado()!.email }}</span>
            }
          </div>
        </div>
        <button class="btn btn-primary" (click)="abrirModalEntrada()">+ Nueva Entrada</button>
      </div>

      <!-- TABS -->
      <div class="tabs">
        <button class="tab" [class.active]="tabActivo() === 'entradas'" (click)="tabActivo.set('entradas')">Entradas clínicas</button>
        <button class="tab" [class.active]="tabActivo() === 'info'" (click)="tabActivo.set('info')">Info paciente</button>
      </div>

      @if (tabActivo() === 'entradas') {
        <div class="timeline">
          @for (entrada of entradas(); track entrada.id) {
            <div class="timeline-item">
              <div class="timeline-dot dot-consulta"></div>
              <div class="timeline-content">
                <div class="entry-header">
                  <div>
                    <span class="entry-tipo badge-consulta">Consulta</span>
                  </div>
                  <div class="entry-meta">
                    <span class="entry-fecha">{{ entrada.visit_date | date:'dd/MM/yyyy' }}</span>
                    <button class="btn-icon" (click)="editarEntrada(entrada)">✏️</button>
                  </div>
                </div>
                <p class="entry-field"><strong>Motivo:</strong> {{ entrada.chief_complaint }}</p>
                <p class="entry-field"><strong>Diagnóstico:</strong> {{ entrada.diagnosis }}</p>
                @if (entrada.treatment_performed) {
                  <p class="entry-field"><strong>Tratamiento:</strong> {{ entrada.treatment_performed }}</p>
                }
                @if (entrada.treatment_plan) {
                  <p class="entry-field"><strong>Plan:</strong> {{ entrada.treatment_plan }}</p>
                }
                @if (entrada.prescriptions) {
                  <p class="entry-field"><strong>Prescripciones:</strong> {{ entrada.prescriptions }}</p>
                }
                @if (entrada.notes) {
                  <p class="entry-field"><strong>Notas:</strong> {{ entrada.notes }}</p>
                }
                @if (entrada.follow_up_date) {
                  <p class="entry-field">📅 <strong>Próxima cita:</strong> {{ entrada.follow_up_date | date:'dd/MM/yyyy' }}</p>
                }
              </div>
            </div>
          }
          @if (entradas().length === 0) {
            <div class="empty-state-sm"><p>No hay entradas clínicas. Agrega la primera.</p></div>
          }
        </div>
      }

      @if (tabActivo() === 'info') {
        <div class="antecedentes-grid">
          <div class="ant-card"><h4>📅 Fecha nacimiento</h4><p>{{ pacienteSeleccionado()!.date_of_birth | date:'dd/MM/yyyy' }}</p></div>
          <div class="ant-card"><h4>📞 Teléfono</h4><p>{{ pacienteSeleccionado()!.phone }}</p></div>
          <div class="ant-card"><h4>✉️ Email</h4><p>{{ pacienteSeleccionado()!.email || 'No registrado' }}</p></div>
        </div>
      }
    }
  </main>
</div>

<!-- MODAL ENTRADA -->
@if (modalAbierto()) {
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
          <textarea formControlName="treatment_performed" rows="2" placeholder="Tratamiento aplicado en esta visita…"></textarea>
        </div>

        <div class="form-group">
          <label>Plan de tratamiento</label>
          <textarea formControlName="treatment_plan" rows="2" placeholder="Próximos pasos…"></textarea>
        </div>

        <div class="form-group">
          <label>Prescripciones</label>
          <input formControlName="prescriptions" type="text" placeholder="Medicamentos recetados…" />
        </div>

        <div class="form-group">
          <label>Notas adicionales</label>
          <textarea formControlName="notes" rows="2" placeholder="Observaciones…"></textarea>
        </div>

        <div class="form-group">
          <label>Próxima cita</label>
          <input formControlName="follow_up_date" type="date" />
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" (click)="cerrarModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary" [disabled]="entradaForm.invalid || guardando()">
            {{ guardando() ? 'Guardando…' : 'Guardar entrada' }}
          </button>
        </div>
      </form>
    </div>
  </div>
}
  `,
  styles: [`
    .hc-layout { display: flex; height: 100vh; background: #f0f4f8; font-family: 'Inter', sans-serif; }
    .hc-sidebar { width: 300px; min-width: 260px; background: #fff; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; overflow: hidden; }
    .sidebar-header { padding: 20px 16px 12px; border-bottom: 1px solid #e2e8f0; }
    .sidebar-header h2 { font-size: 1rem; font-weight: 700; color: #1a202c; margin: 0 0 12px; }
    .search-box { position: relative; }
    .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: .85rem; }
    .search-input { width: 100%; padding: 8px 12px 8px 32px; border: 1px solid #cbd5e0; border-radius: 8px; font-size: .875rem; outline: none; box-sizing: border-box; }
    .search-input:focus { border-color: #4299e1; }
    .pacientes-list { flex: 1; overflow-y: auto; padding: 8px 0; }
    .paciente-card { display: flex; align-items: center; gap: 12px; padding: 12px 16px; cursor: pointer; transition: background .15s; }
    .paciente-card:hover { background: #f7fafc; }
    .paciente-card.active { background: #ebf8ff; border-right: 3px solid #4299e1; }
    .pac-avatar { width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg,#4299e1,#3182ce); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:.8rem; flex-shrink:0; }
    .pac-info { display: flex; flex-direction: column; gap: 2px; }
    .pac-nombre { font-size: .875rem; font-weight: 600; color: #2d3748; }
    .pac-cedula { font-size: .75rem; color: #718096; }
    .hc-main { flex: 1; overflow-y: auto; padding: 24px; }
    .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60%; color: #a0aec0; gap: 12px; }
    .empty-icon { font-size: 3rem; }
    .empty-state h3 { font-size: 1.25rem; color: #718096; margin: 0; }
    .empty-state p { margin: 0; font-size: .875rem; }
    .loading-full { display: flex; justify-content: center; align-items: center; height: 40%; }
    .spinner { width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #4299e1; border-radius: 50%; animation: spin .7s linear infinite; }
    .spinner-sm { width: 16px; height: 16px; border: 2px solid #e2e8f0; border-top-color: #4299e1; border-radius: 50%; animation: spin .7s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .patient-header { display: flex; align-items: center; gap: 16px; background: #fff; padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .patient-avatar-lg { width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg,#48bb78,#38a169); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1.1rem; flex-shrink:0; }
    .patient-data { flex: 1; }
    .patient-data h2 { margin: 0 0 6px; font-size: 1.2rem; color: #1a202c; }
    .patient-meta { display: flex; gap: 16px; flex-wrap: wrap; }
    .patient-meta span { font-size: .8rem; color: #718096; }
    .tabs { display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; }
    .tab { padding: 10px 20px; border: none; background: none; font-size: .875rem; font-weight: 500; color: #718096; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all .2s; }
    .tab.active { color: #4299e1; border-bottom-color: #4299e1; }
    .timeline { display: flex; flex-direction: column; gap: 0; }
    .timeline-item { display: flex; gap: 16px; position: relative; }
    .timeline-item:not(:last-child)::before { content:''; position:absolute; left:11px; top:28px; bottom:-16px; width:2px; background:#e2e8f0; }
    .timeline-dot { width:24px; height:24px; border-radius:50%; flex-shrink:0; margin-top:16px; }
    .dot-consulta { background:#4299e1; box-shadow:0 0 0 3px rgba(66,153,225,.2); }
    .timeline-content { flex:1; background:#fff; border-radius:10px; padding:16px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,.07); }
    .entry-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; }
    .entry-tipo { display:inline-block; padding:3px 10px; border-radius:20px; font-size:.75rem; font-weight:600; text-transform:uppercase; }
    .badge-consulta { background:#ebf8ff; color:#2b6cb0; }
    .entry-meta { display:flex; align-items:center; gap:10px; }
    .entry-fecha { font-size:.78rem; color:#718096; }
    .entry-field { font-size:.875rem; color:#4a5568; margin:4px 0; line-height:1.5; }
    .antecedentes-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:16px; }
    .ant-card { background:#fff; border-radius:10px; padding:16px; box-shadow:0 1px 3px rgba(0,0,0,.07); }
    .ant-card h4 { margin:0 0 8px; font-size:.9rem; color:#2d3748; }
    .ant-card p { margin:0; font-size:.875rem; color:#718096; }
    .btn { padding:8px 18px; border-radius:8px; border:none; font-size:.875rem; font-weight:600; cursor:pointer; transition:all .2s; }
    .btn-primary { background:#4299e1; color:#fff; }
    .btn-primary:hover:not(:disabled) { background:#3182ce; }
    .btn-primary:disabled { opacity:.6; cursor:not-allowed; }
    .btn-ghost { background:transparent; color:#718096; border:1px solid #e2e8f0; }
    .btn-ghost:hover { background:#f7fafc; }
    .btn-icon { background:none; border:none; cursor:pointer; font-size:.9rem; padding:4px; border-radius:4px; }
    .btn-icon:hover { background:#f7fafc; }
    .btn-close { background:none; border:none; font-size:1rem; cursor:pointer; color:#718096; padding:4px 8px; }
    .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.45); display:flex; align-items:center; justify-content:center; z-index:1000; animation:fadeIn .15s ease; }
    .modal { background:#fff; border-radius:14px; width:100%; max-width:560px; max-height:90vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,.2); animation:slideUp .2s ease; }
    .modal-header { display:flex; justify-content:space-between; align-items:center; padding:20px 24px 0; }
    .modal-header h3 { margin:0; font-size:1rem; color:#1a202c; }
    .modal-body { padding:20px 24px; }
    .modal-footer { display:flex; justify-content:flex-end; gap:10px; padding-top:16px; border-top:1px solid #e2e8f0; margin-top:16px; }
    .form-group { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
    .form-group label { font-size:.8rem; font-weight:600; color:#4a5568; }
    .form-group input, .form-group textarea { padding:9px 12px; border:1px solid #cbd5e0; border-radius:8px; font-size:.875rem; outline:none; font-family:inherit; resize:vertical; }
    .form-group input:focus, .form-group textarea:focus { border-color:#4299e1; }
    .field-error { font-size:.75rem; color:#e53e3e; }
    .loading-state { display:flex; align-items:center; gap:8px; padding:16px; color:#718096; font-size:.875rem; }
    .empty-search { padding:20px 16px; text-align:center; color:#a0aec0; font-size:.85rem; }
    .empty-state-sm { padding:24px; text-align:center; color:#a0aec0; font-size:.875rem; }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    @keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
  `]
})
export class ListaHistoriasComponent implements OnInit {
  private readonly svc  = inject(HistoriaClinicaService);
  private readonly fb   = inject(FormBuilder);
  private readonly dr   = inject(DestroyRef);
  private readonly search$ = new Subject<string>();

  pacientes            = signal<PacienteResumen[]>([]);
  pacienteSeleccionado = signal<PacienteResumen | null>(null);
  entradas             = signal<EntradaHistoria[]>([]);
  loadingSearch        = signal(false);
  loadingHistoria      = signal(false);
  guardando            = signal(false);
  modalAbierto         = signal(false);
  tabActivo            = signal<'entradas' | 'info'>('entradas');
  entradaEditando      = signal<EntradaHistoria | null>(null);
  searchQuery          = '';

  entradaForm = this.fb.group({
    chief_complaint:     ['', [Validators.required, Validators.minLength(5)]],
    diagnosis:           ['', [Validators.required, Validators.minLength(5)]],
    treatment_performed: [''],
    treatment_plan:      [''],
    prescriptions:       [''],
    notes:               [''],
    follow_up_date:      [''],
  });

  ngOnInit() {
    this.search$.pipe(
      debounceTime(300), distinctUntilChanged(),
      switchMap(q => {
        if (!q.trim()) { this.pacientes.set([]); return of([]); }
        this.loadingSearch.set(true);
        return this.svc.buscarPacientes(q);
      }),
      takeUntilDestroyed(this.dr)
    ).subscribe({
      next: ps => { this.pacientes.set(ps); this.loadingSearch.set(false); },
      error: () => this.loadingSearch.set(false)
    });
  }

  onSearch(q: string) { this.search$.next(q); }

  seleccionarPaciente(p: PacienteResumen) {
    this.pacienteSeleccionado.set(p);
    this.loadingHistoria.set(true);
    this.svc.getEntradas(p.id).subscribe({
      next: e => { this.entradas.set(e); this.loadingHistoria.set(false); },
      error: () => this.loadingHistoria.set(false)
    });
  }

  inicialesPac(p: PacienteResumen): string {
    const parts = p.full_name.trim().split(' ');
    return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
  }

  abrirModalEntrada() {
    this.entradaEditando.set(null);
    this.entradaForm.reset();
    this.modalAbierto.set(true);
  }

  editarEntrada(e: EntradaHistoria) {
    this.entradaEditando.set(e);
    this.entradaForm.patchValue({
      chief_complaint:     e.chief_complaint,
      diagnosis:           e.diagnosis,
      treatment_performed: e.treatment_performed ?? '',
      treatment_plan:      e.treatment_plan ?? '',
      prescriptions:       e.prescriptions ?? '',
      notes:               e.notes ?? '',
      follow_up_date:      e.follow_up_date ?? '',
    });
    this.modalAbierto.set(true);
  }

  cerrarModal() { this.modalAbierto.set(false); this.entradaEditando.set(null); }

  guardarEntrada() {
    if (this.entradaForm.invalid || !this.pacienteSeleccionado()) return;
    this.guardando.set(true);
    const val = this.entradaForm.value;

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
      this.svc.updateEntrada(this.entradaEditando()!.id, data).subscribe({
        next: e => { this.entradas.update(es => es.map(x => x.id === e.id ? e : x)); this.guardando.set(false); this.cerrarModal(); },
        error: () => this.guardando.set(false)
      });
    } else {
      const data: NuevaEntrada = {
        patient_id:          this.pacienteSeleccionado()!.id,
        chief_complaint:     val.chief_complaint!,
        diagnosis:           val.diagnosis!,
        treatment_performed: val.treatment_performed || undefined,
        treatment_plan:      val.treatment_plan      || undefined,
        prescriptions:       val.prescriptions       || undefined,
        notes:               val.notes               || undefined,
        follow_up_date:      val.follow_up_date      || undefined,
      };
      this.svc.addEntrada(data).subscribe({
        next: e => { this.entradas.update(es => [e, ...es]); this.guardando.set(false); this.cerrarModal(); },
        error: () => this.guardando.set(false)
      });
    }
  }
}
