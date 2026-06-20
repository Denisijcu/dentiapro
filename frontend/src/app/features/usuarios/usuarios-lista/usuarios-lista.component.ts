import {
  Component, OnInit, inject, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { UsuariosService } from '../usuarios.service';
import {
  Usuario, NuevoUsuario, EditarUsuario, UserRole, ROL_CONFIG
} from '../usuarios.models';
import { AuthService } from '../../../core/services/auth.service'; // ajusta el path


function passwordMatchValidator(ctrl: AbstractControl): ValidationErrors | null {
  const p = ctrl.get('password_nuevo')?.value;
  const c = ctrl.get('confirmar_password')?.value;
  return p && c && p !== c ? { noMatch: true } : null;
}

@Component({
  selector: 'app-usuarios-lista',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
<div class="usr-layout">

  <div class="usr-topbar">
    <div>
      <h1>Gestión de Usuarios</h1>
      <p class="topbar-sub">{{ usuariosFiltrados().length }} usuario(s) encontrados</p>
    </div>
    <button class="btn btn-primary" (click)="abrirModalCrear()">+ Nuevo Usuario</button>
  </div>

  <div class="filtros-bar">
    <div class="search-box">
      <span>🔍</span>
      <input
        type="text"
        placeholder="Buscar por nombre o email…"
        [(ngModel)]="searchQuery"
        class="search-input"
      />
    </div>
    <div class="rol-filters">
      <button class="filter-chip" [class.active]="filtroRol() === ''" (click)="filtroRol.set('')">Todos</button>
      @for (r of roles; track r.valor) {
        <button
          class="filter-chip"
          [class.active]="filtroRol() === r.valor"
          (click)="filtroRol.set(r.valor)"
        >{{ r.label }}</button>
      }
    </div>
  </div>

  @if (loading()) {
    <div class="loading-center">
      <div class="spinner"></div>
    </div>
  } @else {
    <div class="usuarios-grid">
      @for (u of usuariosFiltrados(); track u.id) {
        <div class="usuario-card" [class.inactivo]="!u.is_active">
          <div class="card-header">
            <div class="usr-avatar" [style.background]="avatarGrad(u)">
              {{ iniciales(u) }}
            </div>
            <div class="usr-status">
              <span
                class="status-dot"
                [class.activo]="u.is_active"
                [title]="u.is_active ? 'Activo' : 'Inactivo'"
              ></span>
            </div>
          </div>

          <div class="card-body">
            <h3 class="usr-nombre">{{ u.first_name }} {{ u.last_name }}</h3>
            <p class="usr-email">{{ u.email }}</p>
            @if (u.specialty) {
              <p class="usr-especialidad">🦷 {{ u.specialty }}</p>
            }
            <span
              class="rol-badge"
              [style.color]="rolCfg(u.role).color"
              [style.background]="rolCfg(u.role).bg"
            >{{ rolCfg(u.role).label }}</span>
          </div>

          <div class="card-meta">
            <span class="meta-item">📅 Desde {{ u.created_at | date:'dd/MM/yyyy' }}</span>
            @if (u.last_login) {
              <span class="meta-item">🕐 {{ u.last_login | date:'dd/MM/yy HH:mm' }}</span>
            }
          </div>

          <div class="card-permisos">
            @for (p of rolCfg(u.role).permisos.slice(0,3); track p) {
              <span class="permiso-tag">{{ p }}</span>
            }
            @if (rolCfg(u.role).permisos.length > 3) {
              <span class="permiso-tag more">+{{ rolCfg(u.role).permisos.length - 3 }} más</span>
            }
          </div>

          <div class="card-actions">
            <button class="btn btn-ghost btn-sm" (click)="abrirModalEditar(u)">✏️ Editar</button>
            <button class="btn btn-ghost btn-sm" (click)="abrirModalPassword(u)">🔑 Password</button>
            <button
              class="btn btn-sm"
              [class.btn-warning]="u.is_active"
              [class.btn-success]="!u.is_active"
              (click)="toggleActivo(u)"
            >{{ u.is_active ? '⏸ Desactivar' : '▶ Activar' }}</button>
          </div>
        </div>
      }

      @if (usuariosFiltrados().length === 0) {
        <div class="empty-grid">
          <div class="empty-icon">👥</div>
          <p>No hay usuarios que coincidan</p>
        </div>
      }
    </div>
  }
</div>

@if (modalCrear()) {
  <div class="modal-overlay" (click)="cerrarModales()">
    <div class="modal" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <h3>Nuevo Usuario</h3>
        <button class="btn-close" (click)="cerrarModales()">✕</button>
      </div>
      <form [formGroup]="crearForm" (ngSubmit)="crearUsuario()" class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label>Nombre *</label>
            <input formControlName="nombre" type="text" placeholder="Nombre" />
            @if (crearForm.get('nombre')?.invalid && crearForm.get('nombre')?.touched) {
              <span class="field-error">Requerido</span>
            }
          </div>
          <div class="form-group">
            <label>Apellido *</label>
            <input formControlName="apellido" type="text" placeholder="Apellido" />
            @if (crearForm.get('apellido')?.invalid && crearForm.get('apellido')?.touched) {
              <span class="field-error">Requerido</span>
            }
          </div>
        </div>

        <div class="form-group">
          <label>Email *</label>
          <input formControlName="email" type="email" placeholder="correo@clinica.com" />
          @if (crearForm.get('email')?.invalid && crearForm.get('email')?.touched) {
            <span class="field-error">Email válido requerido</span>
          }
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Teléfono</label>
            <input formControlName="telefono" type="tel" placeholder="+58 412 555 0000" />
          </div>
          <div class="form-group">
            <label>Rol *</label>
            <select formControlName="rol" (change)="onRolChange()">
              @for (r of roles; track r.valor) {
                <option [value]="r.valor">{{ r.label }}</option>
              }
            </select>
          </div>
        </div>

        @if (crearForm.get('rol')?.value === 'doctor') {
          <div class="form-group">
            <label>Especialidad</label>
            <input formControlName="especialidad" type="text" placeholder="Ej. Ortodoncia, Endodoncia…" />
          </div>
        }

        <div class="form-row">
          <div class="form-group">
            <label>Contraseña *</label>
            <input formControlName="password" type="password" placeholder="Mínimo 8 caracteres" />
            @if (crearForm.get('password')?.invalid && crearForm.get('password')?.touched) {
              <span class="field-error">Mínimo 8 caracteres</span>
            }
          </div>
          <div class="form-group">
            <label>Confirmar contraseña *</label>
            <input formControlName="confirmar_password" type="password" placeholder="Repite la contraseña" />
            @if (crearForm.hasError('noMatch') && crearForm.get('confirmar_password')?.touched) {
              <span class="field-error">Las contraseñas no coinciden</span>
            }
          </div>
        </div>

        @if (crearForm.get('rol')?.value) {
          <div class="permisos-preview">
            <p class="permisos-title">Permisos del rol:</p>
            <div class="permisos-list">
              @for (p of rolCfg(crearForm.get('rol')!.value).permisos; track p) {
                <span class="permiso-tag">✓ {{ p }}</span>
              }
            </div>
          </div>
        }

        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" (click)="cerrarModales()">Cancelar</button>
          <button type="submit" class="btn btn-primary" [disabled]="crearForm.invalid || guardando()">
            {{ guardando() ? 'Creando…' : 'Crear Usuario' }}
          </button>
        </div>
      </form>
    </div>
  </div>
}

@if (modalEditar() && usuarioEditando()) {
  <div class="modal-overlay" (click)="cerrarModales()">
    <div class="modal" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <h3>Editar Usuario</h3>
        <button class="btn-close" (click)="cerrarModales()">✕</button>
      </div>
      <form [formGroup]="editarForm" (ngSubmit)="editarUsuario()" class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label>Nombre *</label>
            <input formControlName="nombre" type="text" />
          </div>
          <div class="form-group">
            <label>Apellido *</label>
            <input formControlName="apellido" type="text" />
          </div>
        </div>

        <div class="form-group">
          <label>Email</label>
          <input formControlName="email" type="email" title="El email no puede ser editado desde aquí" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Teléfono</label>
            <input formControlName="telefono" type="tel" />
          </div>
          <div class="form-group">
            <label>Rol *</label>
            <select formControlName="rol">
              @for (r of roles; track r.valor) {
                <option [value]="r.valor">{{ r.label }}</option>
              }
            </select>
          </div>
        </div>

        @if (editarForm.get('rol')?.value === 'doctor') {
          <div class="form-group">
            <label>Especialidad</label>
            <input formControlName="especialidad" type="text" />
          </div>
        }

        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" (click)="cerrarModales()">Cancelar</button>
          <button type="submit" class="btn btn-primary" [disabled]="editarForm.invalid || guardando()">
            {{ guardando() ? 'Guardando…' : 'Guardar cambios' }}
          </button>
        </div>
      </form>
    </div>
  </div>
}

@if (modalPassword() && usuarioEditando()) {
  <div class="modal-overlay" (click)="cerrarModales()">
    <div class="modal modal-sm" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <h3>🔑 Cambiar Contraseña</h3>
        <button class="btn-close" (click)="cerrarModales()">✕</button>
      </div>
      <div class="modal-body">
        <p class="pwd-user">Usuario: <strong>{{ usuarioEditando()!.first_name }} {{ usuarioEditando()!.last_name }}</strong></p>
        <form [formGroup]="passwordForm" (ngSubmit)="cambiarPassword()">
          <div class="form-group">
            <label>Nueva contraseña *</label>
            <input formControlName="password_nuevo" type="password" placeholder="Mínimo 8 caracteres" />
          </div>
          <div class="form-group">
            <label>Confirmar contraseña *</label>
            <input formControlName="confirmar_password" type="password" />
            @if (passwordForm.hasError('noMatch') && passwordForm.get('confirmar_password')?.touched) {
              <span class="field-error">Las contraseñas no coinciden</span>
            }
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-ghost" (click)="cerrarModales()">Cancelar</button>
            <button type="submit" class="btn btn-primary" [disabled]="passwordForm.invalid || guardando()">
              {{ guardando() ? 'Guardando…' : 'Cambiar' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
}
  `,
  styles: [`
    .usr-layout { padding: 24px; max-width: 1280px; margin: 0 auto; font-family: 'Inter', sans-serif; }
    .usr-topbar { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .usr-topbar h1 { margin: 0 0 4px; font-size: 1.5rem; font-weight: 700; color: #1a202c; }
    .topbar-sub { margin: 0; font-size: 0.85rem; color: #718096; }
    .filtros-bar { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
    .search-box { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; }
    .search-input { border: none; outline: none; font-size: 0.875rem; width: 220px; }
    .rol-filters { display: flex; gap: 8px; flex-wrap: wrap; }
    .filter-chip { padding: 6px 14px; border: 1px solid #e2e8f0; border-radius: 20px; background: #fff; font-size: 0.8rem; cursor: pointer; color: #718096; transition: all 0.15s; }
    .filter-chip:hover { border-color: #4299e1; color: #4299e1; }
    .filter-chip.active { background: #4299e1; color: #fff; border-color: #4299e1; }
    .usuarios-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
    .usuario-card { background: #fff; border-radius: 14px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); overflow: hidden; transition: box-shadow 0.2s, transform 0.2s; display: flex; flex-direction: column; }
    .usuario-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.12); transform: translateY(-2px); }
    .usuario-card.inactivo { opacity: 0.65; filter: grayscale(30%); }
    .card-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 20px 20px 0; }
    .usr-avatar { width: 56px; height: 56px; border-radius: 50%; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.1rem; }
    .status-dot { width: 10px; height: 10px; border-radius: 50%; background: #cbd5e0; display: block; margin-top: 4px; }
    .status-dot.activo { background: #48bb78; box-shadow: 0 0 0 3px rgba(72,187,120,0.2); }
    .card-body { padding: 12px 20px 8px; flex: 1; }
    .usr-nombre { margin: 0 0 4px; font-size: 1rem; font-weight: 700; color: #1a202c; }
    .usr-email { margin: 0 0 6px; font-size: 0.8rem; color: #718096; }
    .usr-especialidad { margin: 0 0 8px; font-size: 0.78rem; color: #4a5568; }
    .rol-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; }
    .card-meta { padding: 8px 20px; display: flex; flex-direction: column; gap: 2px; }
    .meta-item { font-size: 0.72rem; color: #a0aec0; }
    .card-permisos { padding: 8px 20px 12px; display: flex; flex-wrap: wrap; gap: 4px; }
    .permiso-tag { font-size: 0.7rem; padding: 2px 8px; background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 4px; color: #4a5568; }
    .permiso-tag.more { color: #a0aec0; }
    .card-actions { padding: 12px 20px; border-top: 1px solid #f0f4f8; display: flex; gap: 6px; flex-wrap: wrap; }
    .loading-center { display: flex; justify-content: center; align-items: center; height: 200px; }
    .empty-grid { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; padding: 60px; color: #a0aec0; gap: 12px; }
    .empty-icon { font-size: 3rem; }
    .permisos-preview { background: #f7fafc; border-radius: 8px; padding: 12px; margin-bottom: 14px; }
    .permisos-title { margin: 0 0 8px; font-size: 0.78rem; font-weight: 600; color: #718096; text-transform: uppercase; }
    .permisos-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .pwd-user { margin: 0 0 16px; font-size: 0.875rem; color: #4a5568; }
    .check-group { flex-direction: row !important; }
    .check-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.875rem; color: #4a5568; }
    .check-label input[type=checkbox] { width: 16px; height: 16px; cursor: pointer; }
    .btn { padding: 8px 18px; border-radius: 8px; border: none; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .btn-sm { padding: 6px 12px; font-size: 0.78rem; }
    .btn-primary { background: #4299e1; color: #fff; }
    .btn-primary:hover:not(:disabled) { background: #3182ce; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-ghost { background: transparent; color: #718096; border: 1px solid #e2e8f0; }
    .btn-ghost:hover { background: #f7fafc; }
    .btn-warning { background: #fbd38d; color: #7b341e; }
    .btn-warning:hover { background: #f6ad55; }
    .btn-success { background: #9ae6b4; color: #276749; }
    .btn-success:hover { background: #68d391; }
    .btn-close { background: none; border: none; font-size: 1rem; cursor: pointer; color: #718096; padding: 4px 8px; }
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.15s ease; }
    .modal { background: #fff; border-radius: 14px; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.2); animation: slideUp 0.2s ease; }
    .modal-sm { max-width: 420px; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px 0; }
    .modal-header h3 { margin: 0; font-size: 1rem; color: #1a202c; }
    .modal-body { padding: 20px 24px; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding-top: 16px; border-top: 1px solid #e2e8f0; margin-top: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .form-group label { font-size: 0.8rem; font-weight: 600; color: #4a5568; }
    .form-group input, .form-group select, .form-group textarea { padding: 9px 12px; border: 1px solid #cbd5e0; border-radius: 8px; font-size: 0.875rem; outline: none; transition: border-color 0.2s; font-family: inherit; }
    .form-group input:focus, .form-group select:focus { border-color: #4299e1; box-shadow: 0 0 0 3px rgba(66,153,225,0.15); }
    .field-error { font-size: 0.75rem; color: #e53e3e; }
    .spinner { width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #4299e1; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
  `]
})
export class UsuariosListaComponent implements OnInit {
  private readonly svc = inject(UsuariosService);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  usuarios = signal<Usuario[]>([]);
  loading = signal(false);
  guardando = signal(false);
  filtroRol = signal<string>('');
  searchQuery = '';
  modalCrear = signal(false);
  modalEditar = signal(false);
  modalPassword = signal(false);
  usuarioEditando = signal<Usuario | null>(null);

  roles = [
    { valor: 'admin' as UserRole, label: 'Administrador' },
    { valor: 'doctor' as UserRole, label: 'Odontólogo / Doctor' },
    { valor: 'receptionist' as UserRole, label: 'Recepcionista' },
    { valor: 'patient' as UserRole, label: 'Paciente' }
  ];

  usuariosFiltrados = computed(() =>
    this.usuarios().filter(u => {
      const matchRol = !this.filtroRol() || u.role === this.filtroRol();
      const q = this.searchQuery.toLowerCase();
      const matchQ = !q ||
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);
      return matchRol && matchQ;
    })
  );

  crearForm = this.fb.group({
    nombre:              ['', Validators.required],
    apellido:            ['', Validators.required],
    email:               ['', [Validators.required, Validators.email]],
    telefono:            [''],
    rol:                 ['doctor', Validators.required],
    especialidad:        [''],
    password:            ['', [Validators.required, Validators.minLength(8)]],
    confirmar_password:  ['', Validators.required]
  }, { validators: passwordMatchValidator });

  editarForm = this.fb.group({
    nombre:       ['', Validators.required],
    apellido:     ['', Validators.required],
    email:        [{value: '', disabled: true}], // FastAPI no permite editar email por aquí
    telefono:     [''],
    rol:          ['doctor', Validators.required],
    especialidad: ['']
  });

  passwordForm = this.fb.group({
    password_nuevo:      ['', [Validators.required, Validators.minLength(8)]],
    confirmar_password:  ['', Validators.required]
  }, { validators: passwordMatchValidator });

  ngOnInit() { this.cargarUsuarios(); }

  cargarUsuarios() {
    this.loading.set(true);
    this.svc.listar().subscribe({
      next: us => { this.usuarios.set(us); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  rolCfg(rol: string) { return ROL_CONFIG[rol as UserRole]; }
  iniciales(u: Usuario) { return `${u.first_name[0]}${u.last_name[0]}`.toUpperCase(); }

  avatarGrad(u: Usuario): string {
    const grads: Record<UserRole, string> = {
      admin:        'linear-gradient(135deg, #553c9a, #6b46c1)',
      doctor:       'linear-gradient(135deg, #2b6cb0, #4299e1)',
      receptionist: 'linear-gradient(135deg, #276749, #48bb78)',
      patient:      'linear-gradient(135deg, #c05621, #ed8936)'
    };
    return grads[u.role] ?? 'linear-gradient(135deg, #718096, #a0aec0)';
  }

  onRolChange() {
    if (this.crearForm.get('rol')?.value !== 'doctor') {
      this.crearForm.patchValue({ especialidad: '' });
    }
  }

  cerrarModales() {
    this.modalCrear.set(false);
    this.modalEditar.set(false);
    this.modalPassword.set(false);
    this.usuarioEditando.set(null);
  }

  abrirModalCrear() {
    this.crearForm.reset({ rol: 'doctor' });
    this.modalCrear.set(true);
  }

  crearUsuario() {
    if (this.crearForm.invalid) return;
    this.guardando.set(true);
    const val = this.crearForm.value;
    
    // Mapeo perfecto al modelo de backend (NuevoUsuario)
    const data: NuevoUsuario = {
      //clinic_id: 1, // TODO: Cablear con el clinic_id del usuario logueado en tu Auth Service
      clinic_id: this.auth.currentUser()!.clinic_id,
      email: val.email!,
      password: val.password!,
      first_name: val.nombre!,
      last_name: val.apellido!,
      role: val.rol as UserRole,
      phone: val.telefono || undefined,
      specialty: val.especialidad || undefined
    };

    this.svc.crear(data).subscribe({
      next: u => {
        this.usuarios.update(us => [u, ...us]);
        this.guardando.set(false);
        this.cerrarModales();
      },
      error: () => this.guardando.set(false)
    });
  }

  abrirModalEditar(u: Usuario) {
    this.usuarioEditando.set(u);
    this.editarForm.patchValue({
      nombre: u.first_name,
      apellido: u.last_name,
      email: u.email,
      telefono: u.phone ?? '',
      rol: u.role,
      especialidad: u.specialty ?? ''
    });
    this.modalEditar.set(true);
  }

  editarUsuario() {
    if (this.editarForm.invalid || !this.usuarioEditando()) return;
    this.guardando.set(true);
    const val = this.editarForm.value;
    
    // Mapeo estricto a EditarUsuario (excluye email y is_active que no se soportan en este endpoint)
    const data: EditarUsuario = {
      first_name: val.nombre || undefined,
      last_name: val.apellido || undefined,
      phone: val.telefono || undefined,
      specialty: val.especialidad || undefined
    };

    this.svc.editar(this.usuarioEditando()!.id, data).subscribe({
      next: u => {
        this.usuarios.update(us => us.map(x => x.id === u.id ? u : x));
        this.guardando.set(false);
        this.cerrarModales();
      },
      error: () => this.guardando.set(false)
    });
  }

  toggleActivo(u: Usuario) {
    // Pasamos directamente el booleano primitivo que espera el servicio
    this.svc.toggleActivo(u.id, !u.is_active).subscribe({
      next: updated => this.usuarios.update(us => us.map(x => x.id === updated.id ? updated : x))
    });
  }

  abrirModalPassword(u: Usuario) {
    this.usuarioEditando.set(u);
    this.passwordForm.reset();
    this.modalPassword.set(true);
  }

  cambiarPassword() {
    if (this.passwordForm.invalid || !this.usuarioEditando()) return;
    this.guardando.set(true);
    const val = this.passwordForm.value;
    
    // Pasamos directamente el string primitivo que espera el servicio
    this.svc.cambiarPassword(this.usuarioEditando()!.id, val.password_nuevo!).subscribe({
      next: () => { this.guardando.set(false); this.cerrarModales(); },
      error: () => this.guardando.set(false)
    });
  }
}