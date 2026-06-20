import {
    Component, OnInit, inject, signal, computed, DestroyRef, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
    FormsModule, ReactiveFormsModule, FormBuilder,
    FormArray, Validators, AbstractControl
} from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject, catchError, of, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FacturacionService } from '../facturacion.service';
import { HistoriaClinicaService } from '../../historia-clinica/historia-clinica.service';
import {
    Factura,
    NuevaFactura,
    ResumenFacturacion,
    InvoiceStatus,
    INVOICE_STATUS_LABELS,
    RegistrarPago,
    AnularFactura
} from '../facturacion.models';
import { Paciente, PacienteResumen } from '../../historia-clinica/historia-clinica.models';

@Component({
    selector: 'app-facturacion-lista',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<div class="fac-layout">

  <!-- Toast de notificaciones -->
  @if (toastMessage()) {
    <div class="toast" [class.toast-success]="toastType() === 'success'" 
         [class.toast-error]="toastType() === 'error'">
      {{ toastMessage() }}
      <button class="toast-close" (click)="toastMessage.set('')">✕</button>
    </div>
  }

  <div class="fac-topbar">
    <div class="topbar-left">
      <h1>Facturación</h1>
      <span class="subtitle">Gestión de facturas y pagos</span>
    </div>
    <button class="btn btn-primary" (click)="abrirModalNueva()">
      + Nueva Factura
    </button>
  </div>

  @if (resumen()) {
    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-label">Total Facturado</span>
        <span class="kpi-value">{{ resumen()!.total_facturado | currency:'USD':'symbol':'1.2-2' }}</span>
        <span class="kpi-trend">{{ resumen()!.facturas_mes }} facturas este mes</span>
      </div>
      <div class="kpi-card kpi-green">
        <span class="kpi-label">Total Cobrado</span>
        <span class="kpi-value">{{ resumen()!.total_cobrado | currency:'USD':'symbol':'1.2-2' }}</span>
        <span class="kpi-trend">{{ resumen()!.porcentaje_cobrado || 0 }}% cobrado</span>
      </div>
      <div class="kpi-card kpi-orange">
        <span class="kpi-label">Pendiente de Cobro</span>
        <span class="kpi-value">{{ resumen()!.total_pendiente | currency:'USD':'symbol':'1.2-2' }}</span>
        <span class="kpi-trend">{{ resumen()!.facturas_pendientes || 0 }} facturas pendientes</span>
      </div>
      <div class="kpi-card kpi-blue">
        <span class="kpi-label">Pagos del Mes</span>
        <span class="kpi-value">{{ resumen()!.pagos_mes || 0 }}</span>
        <span class="kpi-trend">+{{ resumen()!.crecimiento_mensual || 0 }}% vs mes anterior</span>
      </div>
    </div>
  }

  <div class="filtros-bar">
    <div class="search-box">
      <span>🔍</span>
      <input
        type="text"
        placeholder="Buscar por paciente, número de factura..."
        [(ngModel)]="searchQuery"
        (ngModelChange)="onSearch($event)"
        class="search-input"
      />
    </div>
    <div class="estado-filters">
      @for (e of estados; track e.valor) {
        <button
          class="filter-chip"
          [class.active]="filtroEstado() === e.valor"
          (click)="setFiltroEstado(e.valor)"
        >{{ e.label }}</button>
      }
    </div>
    <div class="filtros-extra">
      <input type="date" class="filter-date" [(ngModel)]="fechaDesde" (ngModelChange)="onFilterChange()" />
      <span class="filter-sep">a</span>
      <input type="date" class="filter-date" [(ngModel)]="fechaHasta" (ngModelChange)="onFilterChange()" />
      <button class="btn btn-ghost btn-sm" (click)="limpiarFiltros()">Limpiar</button>
    </div>
  </div>

  <div class="tabla-container">
    @if (loading()) {
      <div class="loading-row">
        <div class="spinner"></div>
        <span>Cargando facturas...</span>
      </div>
    } @else {
      <table class="tabla">
        <thead>
          <tr>
            <th>Número</th>
            <th>Paciente</th>
            <th>Fecha</th>
            <th>Total</th>
            <th>Pagado</th>
            <th>Saldo</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          @for (f of facturas(); track f.id) {
            <tr>
              <td><span class="fac-num">#{{ f.invoice_number }}</span></td>
              <td>
                <div class="pac-cell">
                  <span class="pac-nombre">{{ f.patient_name }}</span>
                  <span class="pac-cedula">{{ f.patient_national_id ?? 'N/A' }}</span>
                </div>
              </td>
              <td>{{ f.issue_date | date:'dd/MM/yyyy' }}</td>
              <td class="amount">{{ f.total | currency:'USD':'symbol':'1.2-2' }}</td>
              <td class="amount green">{{ getTotalPagado(f) | currency:'USD':'symbol':'1.2-2' }}</td>
              <td class="amount" [class.red]="getSaldoPendiente(f) > 0 && f.status !== 'paid'">
                {{ getSaldoPendiente(f) | currency:'USD':'symbol':'1.2-2' }}
              </td>
              <td>
                <span class="estado-badge estado-{{ f.status }}">{{ labelEstado(f.status) }}</span>
              </td>
              <td>
                <div class="acciones">
                  <button class="btn-icon" title="Ver detalle" (click)="verDetalle(f)">👁️</button>
                  @if (f.status !== 'cancelled' && f.status !== 'paid' && getSaldoPendiente(f) > 0) {
                    <button class="btn-icon" title="Registrar pago" (click)="abrirPago(f)">💳</button>
                  }
                  <button class="btn-icon" title="Descargar PDF" (click)="descargarPDF(f)">📄</button>
                  @if (f.status !== 'cancelled' && f.status !== 'paid') {
                    <button class="btn-icon danger" title="Anular" (click)="confirmarAnular(f)">🚫</button>
                  }
                </div>
              </td>
            </tr>
          }
          @if (facturas().length === 0) {
            <tr>
              <td colspan="8" class="empty-cell">
                <div class="empty-state">
                  <span class="empty-icon">📭</span>
                  <p>No hay facturas que coincidan con los filtros</p>
                  <button class="btn btn-ghost btn-sm" (click)="limpiarFiltros()">Limpiar filtros</button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </table>

      @if (totalFacturas() > pageSize) {
        <div class="paginacion">
          <button class="btn btn-ghost btn-sm" [disabled]="paginaActual() === 1" (click)="cambiarPagina(paginaActual() - 1)">← Anterior</button>
          <span>Página {{ paginaActual() }} de {{ totalPaginas() }}</span>
          <span class="pag-info">Mostrando {{ facturas().length }} de {{ totalFacturas() }} facturas</span>
          <button class="btn btn-ghost btn-sm" [disabled]="paginaActual() >= totalPaginas()" (click)="cambiarPagina(paginaActual() + 1)">Siguiente →</button>
        </div>
      }
    }
  </div>
</div>

<!-- Modal Detalle -->
@if (facturaDetalle()) {
  <div class="modal-overlay" (click)="facturaDetalle.set(null)">
    <div class="modal modal-lg" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div>
          <h3>{{ facturaDetalle()!.invoice_number }}</h3>
          <span class="estado-badge estado-{{ facturaDetalle()!.status }}">{{ labelEstado(facturaDetalle()!.status) }}</span>
        </div>
        <button class="btn-close" (click)="facturaDetalle.set(null)">✕</button>
      </div>
      <div class="modal-body">
        <div class="detalle-grid">
          <div>
            <p class="det-label">Paciente</p>
            <p class="det-val">{{ facturaDetalle()!.patient_name }}</p>
          </div>
          <div>
            <p class="det-label">Cédula / ID</p>
            <p class="det-val">{{ facturaDetalle()!.patient_national_id ?? 'N/A' }}</p>
          </div>
          <div>
            <p class="det-label">Fecha emisión</p>
            <p class="det-val">{{ facturaDetalle()!.issue_date | date:'dd/MM/yyyy' }}</p>
          </div>
          <div>
            <p class="det-label">Vencimiento</p>
            <p class="det-val">{{ facturaDetalle()!.due_date ? (facturaDetalle()!.due_date | date:'dd/MM/yyyy') : 'N/A' }}</p>
          </div>
        </div>

        <table class="tabla tabla-items">
          <thead>
            <tr>
              <th>Descripción</th>
              <th>Cant.</th>
              <th>Precio Unit.</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            @for (item of facturaDetalle()!.items; track $index) {
              <tr>
                <td>{{ item.description }}</td>
                <td>{{ item.quantity }}</td>
                <td>{{ item.unit_price | currency:'USD':'symbol':'1.2-2' }}</td>
                <td>{{ item.subtotal | currency:'USD':'symbol':'1.2-2' }}</td>
              </tr>
            }
          </tbody>
        </table>

        <div class="totales">
          <div class="total-row">
            <span>Subtotal</span>
            <span>{{ facturaDetalle()!.subtotal | currency:'USD':'symbol':'1.2-2' }}</span>
          </div>
          @if (facturaDetalle()!.discount_amount > 0) {
            <div class="total-row discount">
              <span>Descuento</span>
              <span>- {{ facturaDetalle()!.discount_amount | currency:'USD':'symbol':'1.2-2' }}</span>
            </div>
          }
          @if (facturaDetalle()!.tax_amount > 0) {
            <div class="total-row">
              <span>IVA ({{ (facturaDetalle()!.tax_rate * 100).toFixed(0) }}%)</span>
              <span>{{ facturaDetalle()!.tax_amount | currency:'USD':'symbol':'1.2-2' }}</span>
            </div>
          }
          <div class="total-row total-final">
            <span>TOTAL</span>
            <span>{{ facturaDetalle()!.total | currency:'USD':'symbol':'1.2-2' }}</span>
          </div>
          @if (facturaDetalle()!.payments && facturaDetalle()!.payments.length > 0) {
            <div class="pagos-realizados">
              <p class="det-label">Pagos realizados</p>
              @for (pago of facturaDetalle()!.payments; track $index) {
                <div class="pago-row">
                  <span>{{ pago.payment_date | date:'dd/MM/yyyy' }} - {{ pago.method }}</span>
                  <span class="amount green">{{ pago.amount | currency:'USD':'symbol':'1.2-2' }}</span>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  </div>
}

<!-- Modal Nueva Factura -->
@if (modalNueva()) {
  <div class="modal-overlay" (click)="cerrarModalNueva()">
    <div class="modal modal-lg" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <h3>Nueva Factura</h3>
        <button class="btn-close" (click)="cerrarModalNueva()">✕</button>
      </div>
      <form [formGroup]="nuevaForm" (ngSubmit)="crearFactura()" class="modal-body">

        <div class="form-group">
          <label>Paciente *</label>
          <div class="search-wrapper">
            <input
              type="text"
              placeholder="Buscar paciente por nombre o cédula..."
              [(ngModel)]="searchPaciente"
              [ngModelOptions]="{standalone: true}"
              (ngModelChange)="onSearchPaciente($event)"
              class="search-input-full"
            />
            @if (busquedaPacientesLoading()) {
              <div class="search-spinner"></div>
            }
          </div>
          @if (pacientesResultado().length > 0) {
            <div class="dropdown-list">
              @for (p of pacientesResultado(); track p.id) {
                <div class="dropdown-item" (mousedown)="seleccionarPacienteFactura(p)">
                  <div class="dropdown-item-content">
                    <span class="dropdown-name">{{ p.full_name }}</span>
                    <span class="dropdown-cedula">{{ p.phone }}</span>
                  </div>
                </div>
              }
            </div>
          }
          @if (pacienteFactura()) {
            <div class="paciente-seleccionado">
              <span class="paciente-icon">✅</span>
              <span class="paciente-info">
                {{ pacienteFactura()!.full_name }}
                <span class="paciente-doc">({{ pacienteFactura()!.national_id }})</span>
              </span>
              <button type="button" class="btn-clear" (click)="limpiarPaciente()">✕</button>
            </div>
          }
          @if (errorPaciente()) {
            <div class="form-error">{{ errorPaciente() }}</div>
          }
        </div>

        <div class="items-section">
          <div class="items-header">
            <label>Servicios / Procedimientos *</label>
            <button type="button" class="btn btn-ghost btn-sm" (click)="addItem()">
              + Agregar ítem
            </button>
          </div>
          <div formArrayName="items">
            @for (ctrl of itemsArray.controls; track $index; let i = $index) {
              <div class="item-row" [formGroupName]="i">
                <input formControlName="descripcion" placeholder="Descripción" class="item-desc" />
                <input formControlName="cantidad" type="number" min="1" placeholder="Cant." class="item-qty" />
                <input formControlName="precio_unitario" type="number" min="0" step="0.01" placeholder="Precio" class="item-price" />
                <span class="item-sub">
                  {{ getItemSubtotal(i) | currency:'USD':'symbol':'1.2-2' }}
                </span>
                <button type="button" class="btn-icon danger" (click)="removeItem(i)" [disabled]="itemsArray.length === 1">🗑️</button>
              </div>
            }
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Descuento ($)</label>
            <input type="number" formControlName="descuento" min="0" step="0.01" />
          </div>
          <div class="form-group">
            <label>IVA (%)</label>
            <input type="number" formControlName="impuesto" min="0" max="100" step="0.01" />
          </div>
        </div>

        <div class="preview-total">
          <div class="preview-details">
            <span>Subtotal: {{ getSubtotal() | currency:'USD':'symbol':'1.2-2' }}</span>
            <span>Descuento: -{{ nuevaForm.get('descuento')?.value || 0 | currency:'USD':'symbol':'1.2-2' }}</span>
            <span>IVA: {{ getIVA() | currency:'USD':'symbol':'1.2-2' }}</span>
          </div>
          <div class="preview-final">
            <span>Total estimado: <strong>{{ totalCalculado() | currency:'USD':'symbol':'1.2-2' }}</strong></span>
          </div>
        </div>

        <div class="form-group">
          <label>Notas</label>
          <textarea formControlName="notas" rows="2" placeholder="Observaciones opcionales…"></textarea>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" (click)="cerrarModalNueva()">Cancelar</button>
          <button
            type="submit"
            class="btn btn-primary"
            [disabled]="!pacienteFactura() || nuevaForm.invalid || guardando()"
          >
            {{ guardando() ? 'Creando...' : 'Crear Factura' }}
          </button>
        </div>
      </form>
    </div>
  </div>
}

<!-- Modal Pago -->
@if (facturaAPagar()) {
  <div class="modal-overlay" (click)="facturaAPagar.set(null)">
    <div class="modal" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <h3>Registrar Pago</h3>
        <button class="btn-close" (click)="facturaAPagar.set(null)">✕</button>
      </div>
      <form [formGroup]="pagoForm" (ngSubmit)="registrarPago()" class="modal-body">
        <div class="pago-info">
          <div class="pago-info-item">
            <span>Factura:</span>
            <strong>{{ facturaAPagar()!.invoice_number }}</strong>
          </div>
          <div class="pago-info-item">
            <span>Saldo pendiente:</span>
            <strong class="amount red">{{ getSaldoPendiente(facturaAPagar()!) | currency:'USD':'symbol':'1.2-2' }}</strong>
          </div>
          <div class="pago-info-item">
            <span>Paciente:</span>
            <strong>{{ facturaAPagar()!.patient_name }}</strong>
          </div>
        </div>
        
        <div class="form-group">
          <label>Monto a pagar *</label>
          <input type="number" formControlName="monto" min="0.01" step="0.01" />
          @if (pagoForm.get('monto')?.hasError('max')) {
            <div class="form-error">El monto no puede exceder el saldo pendiente</div>
          }
        </div>
        
        <div class="form-group">
          <label>Método de pago *</label>
          <select formControlName="metodo_pago">
            <option value="cash">Efectivo</option>
            <option value="card">Tarjeta de crédito/débito</option>
            <option value="transfer">Transferencia bancaria</option>
            <option value="insurance">Seguro médico</option>
            <option value="other">Otro</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>Referencia / Comprobante</label>
          <input type="text" formControlName="referencia" placeholder="Número de transacción, comprobante..." />
        </div>
        
        <div class="form-group">
          <label>Notas</label>
          <input type="text" formControlName="notas" placeholder="Observaciones adicionales..." />
        </div>

        @if (errorPago()) {
          <div class="form-error">{{ errorPago() }}</div>
        }

        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" (click)="facturaAPagar.set(null)">Cancelar</button>
          <button type="submit" class="btn btn-primary" [disabled]="pagoForm.invalid || guardando()">
            {{ guardando() ? 'Registrando...' : 'Registrar Pago' }}
          </button>
        </div>
      </form>
    </div>
  </div>
}

<!-- Modal Anular -->
@if (facturaAAnular()) {
  <div class="modal-overlay" (click)="facturaAAnular.set(null)">
    <div class="modal modal-sm" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <h3>⚠️ Anular Factura</h3>
        <button class="btn-close" (click)="facturaAAnular.set(null)">✕</button>
      </div>
      <div class="modal-body">
        <p>¿Deseas anular la factura <strong>{{ facturaAAnular()!.invoice_number }}</strong>?</p>
        <p class="warning-text">Esta acción no se puede deshacer.</p>
        <div class="form-group">
          <label>Motivo *</label>
          <textarea [(ngModel)]="motivoAnulacion" rows="2" placeholder="Motivo de anulación..." class="field-input"></textarea>
        </div>
        @if (errorAnulacion()) {
          <div class="form-error">{{ errorAnulacion() }}</div>
        }
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" (click)="facturaAAnular.set(null)">Cancelar</button>
        <button class="btn btn-danger" [disabled]="!motivoAnulacion.trim() || guardando()" (click)="anularFactura()">
          {{ guardando() ? 'Anulando...' : 'Anular' }}
        </button>
      </div>
    </div>
  </div>
}`,
    styles: [`.fac-layout { padding: 24px; max-width: 1280px; margin: 0 auto; font-family: 'Inter', sans-serif; }
.fac-topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
.fac-topbar h1 { margin: 0; font-size: 1.5rem; font-weight: 700; color: #1a202c; }
.subtitle { font-size: 0.875rem; color: #718096; margin-left: 8px; }
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.kpi-card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); display: flex; flex-direction: column; gap: 4px; border-left: 4px solid #e2e8f0; transition: transform 0.2s; }
.kpi-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
.kpi-card.kpi-green { border-left-color: #48bb78; }
.kpi-card.kpi-orange { border-left-color: #ed8936; }
.kpi-card.kpi-blue { border-left-color: #4299e1; }
.kpi-label { font-size: 0.75rem; color: #718096; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
.kpi-value { font-size: 1.5rem; font-weight: 700; color: #2d3748; }
.kpi-trend { font-size: 0.75rem; color: #a0aec0; margin-top: 4px; }
.filtros-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.search-box { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; flex: 1; min-width: 200px; }
.search-box:focus-within { border-color: #4299e1; box-shadow: 0 0 0 3px rgba(66,153,225,0.1); }
.search-input { border: none; outline: none; font-size: 0.875rem; width: 100%; background: transparent; }
.filtros-extra { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.filter-date { padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.8rem; background: #fff; }
.filter-date:focus { border-color: #4299e1; outline: none; }
.filter-sep { color: #718096; font-size: 0.8rem; }
.estado-filters { display: flex; gap: 6px; flex-wrap: wrap; }
.filter-chip { padding: 5px 12px; border: 1px solid #e2e8f0; border-radius: 20px; background: #fff; font-size: 0.75rem; cursor: pointer; color: #718096; transition: all 0.15s; white-space: nowrap; }
.filter-chip:hover { border-color: #4299e1; color: #4299e1; background: #f7fafc; }
.filter-chip.active { background: #4299e1; color: #fff; border-color: #4299e1; }
.tabla-container { background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); overflow: hidden; }
.tabla { width: 100%; border-collapse: collapse; }
.tabla th { background: #f7fafc; padding: 12px 16px; text-align: left; font-size: 0.75rem; font-weight: 600; color: #718096; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0; }
.tabla td { padding: 14px 16px; border-bottom: 1px solid #f0f4f8; font-size: 0.875rem; color: #4a5568; }
.tabla tbody tr:hover { background: #f7fafc; }
.tabla tbody tr:last-child td { border-bottom: none; }
.fac-num { font-weight: 600; color: #2b6cb0; font-family: 'Courier New', monospace; }
.pac-cell { display: flex; flex-direction: column; gap: 2px; }
.pac-nombre { font-weight: 500; }
.pac-cedula { font-size: 0.75rem; color: #a0aec0; }
.amount { font-family: 'Courier New', monospace; text-align: right; font-weight: 500; }
.amount.green { color: #38a169; }
.amount.red { color: #e53e3e; }
.estado-badge { padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; display: inline-block; }
.estado-draft { background: #edf2f7; color: #718096; }
.estado-issued { background: #fefcbf; color: #7b341e; }
.estado-paid { background: #f0fff4; color: #276749; }
.estado-overdue { background: #fff5f5; color: #c53030; }
.estado-cancelled { background: #f7fafc; color: #718096; }
.acciones { display: flex; gap: 4px; flex-wrap: wrap; }
.empty-cell { text-align: center; padding: 32px !important; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; color: #a0aec0; }
.empty-icon { font-size: 2rem; }
.paginacion { display: flex; align-items: center; justify-content: center; gap: 16px; padding: 16px; font-size: 0.875rem; color: #718096; flex-wrap: wrap; }
.pag-info { font-size: 0.75rem; color: #a0aec0; }
.loading-row { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 40px; color: #718096; }
.spinner { width: 28px; height: 28px; border: 3px solid #e2e8f0; border-top-color: #4299e1; border-radius: 50%; animation: spin 0.7s linear infinite; }
.search-spinner { width: 16px; height: 16px; border: 2px solid #e2e8f0; border-top-color: #4299e1; border-radius: 50%; animation: spin 0.7s linear infinite; position: absolute; right: 10px; top: 50%; transform: translateY(-50%); }
.search-wrapper { position: relative; }
.search-input-full { width: 100%; padding: 9px 12px; border: 1px solid #cbd5e0; border-radius: 8px; font-size: 0.875rem; outline: none; transition: border-color 0.2s; box-sizing: border-box; }
.search-input-full:focus { border-color: #4299e1; box-shadow: 0 0 0 3px rgba(66,153,225,0.1); }
.items-section { margin-bottom: 16px; }
.items-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px; }
.items-header label { font-size: 0.8rem; font-weight: 600; color: #4a5568; }
.item-row { display: grid; grid-template-columns: 1fr 70px 100px 100px 32px; gap: 8px; align-items: center; margin-bottom: 8px; }
.item-desc, .item-qty, .item-price { padding: 8px 10px; border: 1px solid #cbd5e0; border-radius: 6px; font-size: 0.85rem; outline: none; transition: border-color 0.2s; }
.item-desc:focus, .item-qty:focus, .item-price:focus { border-color: #4299e1; box-shadow: 0 0 0 3px rgba(66,153,225,0.1); }
.item-sub { font-size: 0.85rem; font-family: 'Courier New', monospace; color: #4a5568; text-align: right; font-weight: 500; }
.preview-total { background: #f7fafc; border-radius: 8px; padding: 12px 16px; margin: 12px 0; }
.preview-details { display: flex; gap: 16px; font-size: 0.8rem; color: #718096; flex-wrap: wrap; margin-bottom: 8px; }
.preview-final { font-size: 0.9rem; color: #4a5568; text-align: right; }
.preview-final strong { color: #2d3748; font-size: 1.1rem; }
.detalle-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin-bottom: 20px; }
.det-label { margin: 0; font-size: 0.75rem; color: #a0aec0; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
.det-val { margin: 2px 0 0; font-size: 0.95rem; font-weight: 600; color: #2d3748; }
.totales { margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
.total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 0.875rem; color: #4a5568; }
.total-row.total-final { font-weight: 700; font-size: 1rem; color: #1a202c; border-top: 2px solid #e2e8f0; margin-top: 6px; padding-top: 10px; }
.total-row.discount { color: #e53e3e; }
.pagos-realizados { margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
.pago-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 0.8rem; color: #4a5568; }
.pago-info { background: #ebf8ff; border-radius: 8px; padding: 12px; margin-bottom: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.pago-info-item { font-size: 0.85rem; color: #2b6cb0; display: flex; justify-content: space-between; align-items: center; }
.dropdown-list { position: absolute; z-index: 100; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); max-height: 200px; overflow-y: auto; width: 100%; }
.dropdown-item { padding: 8px 12px; cursor: pointer; transition: background 0.15s; }
.dropdown-item:hover { background: #f7fafc; }
.dropdown-item-content { display: flex; justify-content: space-between; align-items: center; }
.dropdown-name { font-weight: 500; color: #2d3748; }
.dropdown-cedula { font-size: 0.75rem; color: #a0aec0; }
.form-group { position: relative; display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.form-group label { font-size: 0.8rem; font-weight: 600; color: #4a5568; }
.form-group input, .form-group select, .form-group textarea { padding: 9px 12px; border: 1px solid #cbd5e0; border-radius: 8px; font-size: 0.875rem; outline: none; transition: border-color 0.2s; font-family: inherit; width: 100%; box-sizing: border-box; }
.form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: #4299e1; box-shadow: 0 0 0 3px rgba(66,153,225,0.1); }
.field-input { width: 100%; padding: 9px 12px; border: 1px solid #cbd5e0; border-radius: 8px; font-size: 0.875rem; outline: none; font-family: inherit; box-sizing: border-box; }
.field-input:focus { border-color: #4299e1; box-shadow: 0 0 0 3px rgba(66,153,225,0.1); }
.form-error { color: #e53e3e; font-size: 0.8rem; margin-top: 4px; }
.paciente-seleccionado { display: flex; align-items: center; gap: 8px; margin-top: 6px; background: #f0fff4; border: 1px solid #9ae6b4; border-radius: 6px; padding: 6px 10px; font-size: 0.85rem; color: #276749; }
.paciente-icon { margin-right: 4px; }
.paciente-info { flex: 1; }
.paciente-doc { font-size: 0.75rem; color: #48bb78; }
.btn-clear { background: none; border: none; cursor: pointer; color: #718096; font-size: 0.9rem; padding: 0 4px; transition: color 0.15s; }
.btn-clear:hover { color: #e53e3e; }
.btn { padding: 8px 18px; border-radius: 8px; border: none; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px; }
.btn-sm { padding: 5px 12px; font-size: 0.8rem; }
.btn-primary { background: #4299e1; color: #fff; }
.btn-primary:hover:not(:disabled) { background: #3182ce; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(66,153,225,0.3); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
.btn-ghost { background: transparent; color: #718096; border: 1px solid #e2e8f0; }
.btn-ghost:hover:not(:disabled) { background: #f7fafc; border-color: #cbd5e0; }
.btn-danger { background: #fc8181; color: #fff; }
.btn-danger:hover:not(:disabled) { background: #f56565; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(245,101,101,0.3); }
.btn-icon { background: none; border: none; cursor: pointer; font-size: 0.9rem; padding: 4px; border-radius: 4px; transition: all 0.15s; }
.btn-icon:hover { background: #f7fafc; transform: scale(1.1); }
.btn-icon.danger:hover { background: #fff5f5; }
.btn-close { background: none; border: none; font-size: 1rem; cursor: pointer; color: #718096; padding: 4px 8px; border-radius: 4px; transition: all 0.15s; }
.btn-close:hover { background: #f7fafc; color: #e53e3e; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.15s ease; padding: 20px; }
.modal { background: #fff; border-radius: 14px; width: 100%; max-width: 540px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.2); animation: slideUp 0.2s ease; }
.modal-lg { max-width: 720px; }
.modal-sm { max-width: 420px; }
.modal-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 20px 24px 0; flex-wrap: wrap; gap: 8px; }
.modal-header h3 { margin: 0 0 4px; font-size: 1rem; color: #1a202c; }
.modal-body { padding: 20px 24px; }
.modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding-top: 16px; border-top: 1px solid #e2e8f0; margin-top: 16px; flex-wrap: wrap; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.warning-text { color: #e53e3e; font-size: 0.85rem; margin: 8px 0; }
.toast { position: fixed; top: 20px; right: 20px; z-index: 2000; padding: 12px 20px; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.15); animation: slideIn 0.3s ease; display: flex; align-items: center; gap: 12px; max-width: 400px; }
.toast-success { background: #f0fff4; color: #276749; border: 1px solid #9ae6b4; }
.toast-error { background: #fff5f5; color: #c53030; border: 1px solid #feb2b2; }
.toast-close { background: none; border: none; cursor: pointer; color: inherit; font-size: 1rem; padding: 0 4px; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes slideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
@keyframes slideIn { from { transform: translateX(20px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
@media (max-width: 1024px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 768px) {
  .kpi-grid { grid-template-columns: 1fr 1fr; }
  .filtros-bar { flex-direction: column; align-items: stretch; }
  .estado-filters { flex-wrap: wrap; }
  .filtros-extra { flex-wrap: wrap; }
  .item-row { grid-template-columns: 1fr 60px 80px 70px 28px; }
  .form-row { grid-template-columns: 1fr; }
  .pago-info { grid-template-columns: 1fr; }
  .detalle-grid { grid-template-columns: 1fr; }
  .modal { max-width: 100%; margin: 10px; }
  .fac-layout { padding: 16px; }
}
@media (max-width: 480px) {
  .kpi-grid { grid-template-columns: 1fr; }
  .tabla { font-size: 0.75rem; }
  .tabla th, .tabla td { padding: 8px 10px; }
  .acciones { flex-direction: column; }
}`],
})
export class FacturacionListaComponent implements OnInit {
    private readonly svc = inject(FacturacionService);
    private readonly pacSvc = inject(HistoriaClinicaService);
    private readonly fb = inject(FormBuilder);
    private readonly destroyRef = inject(DestroyRef);

    // Signals
    facturas = signal<Factura[]>([]);
    resumen = signal<ResumenFacturacion | null>(null);
    loading = signal(false);
    guardando = signal(false);
    busquedaPacientesLoading = signal(false);
    totalFacturas = signal(0);
    paginaActual = signal(1);
    pageSize = 20;

    // Search subjects
    private searchSubject = new Subject<string>();
    private searchPacienteSubject = new Subject<string>();

    // Filtros
    filtroEstado = signal<string>('');
    searchQuery = '';
    fechaDesde = '';
    fechaHasta = '';

    // Modal states
    modalNueva = signal(false);
    facturaDetalle = signal<Factura | null>(null);
    facturaAPagar = signal<Factura | null>(null);
    facturaAAnular = signal<Factura | null>(null);
    motivoAnulacion = '';

    // Paciente search
    pacienteFactura = signal<Paciente | null>(null);
    pacientesResultado = signal<PacienteResumen[]>([]);
    searchPaciente = '';

    // Errors
    errorPaciente = signal('');
    errorPago = signal('');
    errorAnulacion = signal('');

    // Toast
    toastMessage = signal('');
    toastType = signal<'success' | 'error'>('success');

    estados = [
        { valor: '', label: 'Todas' },
        { valor: 'draft', label: 'Borrador' },
        { valor: 'issued', label: 'Emitida' },
        { valor: 'paid', label: 'Pagada' },
        { valor: 'overdue', label: 'Vencida' },
        { valor: 'cancelled', label: 'Cancelada' }
    ];

    // Métodos de pago disponibles
    paymentMethods = [
        { value: 'cash', label: 'Efectivo' },
        { value: 'card', label: 'Tarjeta' },
        { value: 'transfer', label: 'Transferencia' },
        { value: 'insurance', label: 'Seguro médico' },
        { value: 'other', label: 'Otro' }
    ];

    // Forms
    nuevaForm = this.fb.group({
        descuento: [0, [Validators.min(0)]],
        impuesto: [0, [Validators.min(0), Validators.max(100)]],
        notas: [''],
        items: this.fb.array([])
    });

    pagoForm = this.fb.group({
        monto: [0, [Validators.required, Validators.min(0.01)]],
        metodo_pago: ['cash', Validators.required],
        referencia: [''],
        notas: ['']
    }, { validators: this.validarMontoPago.bind(this) });

    get itemsArray(): FormArray { return this.nuevaForm.get('items') as FormArray; }

    totalPaginas = computed(() => Math.ceil(this.totalFacturas() / this.pageSize));

    ngOnInit() {
        this.cargarResumen();
        this.cargarFacturas();

        // Búsqueda de facturas con debounce
        this.searchSubject.pipe(
            debounceTime(400),
            distinctUntilChanged(),
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(() => {
            this.paginaActual.set(1);
            this.cargarFacturas();
        });

        // Búsqueda de pacientes con debounce
        this.searchPacienteSubject.pipe(
            debounceTime(350),
            distinctUntilChanged(),
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(q => {
            if (!q.trim() || q.length < 2) {
                this.pacientesResultado.set([]);
                this.busquedaPacientesLoading.set(false);
                return;
            }
            this.busquedaPacientesLoading.set(true);

            this.pacSvc.buscarPacientes(q, 10).pipe(
                catchError(() => {
                    this.busquedaPacientesLoading.set(false);
                    return of([]);
                }),
                finalize(() => this.busquedaPacientesLoading.set(false))
            ).subscribe((ps) => {
                this.pacientesResultado.set(ps);
            });
        });

        // Validación de monto máximo en pago
        this.pagoForm.get('monto')?.valueChanges.pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(() => {
            this.errorPago.set('');
        });
    }

    // ===== UTILIDADES =====
    getTotalPagado(factura: Factura): number {
        if (factura.status === 'paid') return factura.total;
        if (factura.payments && factura.payments.length > 0) {
            return factura.payments.reduce((sum, p) => sum + p.amount, 0);
        }
        return 0;
    }

    getSaldoPendiente(factura: Factura): number {
        if (factura.status === 'paid') return 0;
        if (factura.status === 'cancelled') return 0;
        const pagado = this.getTotalPagado(factura);
        return Math.max(0, factura.total - pagado);
    }

    getItemSubtotal(index: number): number {
        const item = this.itemsArray.at(index);
        const cantidad = item.get('cantidad')?.value || 0;
        const precio = item.get('precio_unitario')?.value || 0;
        return cantidad * precio;
    }

    getSubtotal(): number {
        let total = 0;
        for (let i = 0; i < this.itemsArray.length; i++) {
            total += this.getItemSubtotal(i);
        }
        return total;
    }

    getIVA(): number {
        const subtotal = this.getSubtotal();
        const descuento = this.nuevaForm.get('descuento')?.value || 0;
        const impuesto = this.nuevaForm.get('impuesto')?.value || 0;
        const base = Math.max(0, subtotal - descuento);
        return base * (impuesto / 100);
    }

    totalCalculado = computed(() => {
        const subtotal = this.getSubtotal();
        const descuento = this.nuevaForm.get('descuento')?.value || 0;
        const impuesto = this.nuevaForm.get('impuesto')?.value || 0;
        const base = Math.max(0, subtotal - descuento);
        return base * (1 + impuesto / 100);
    });

    // ===== VALIDACIONES =====
    validarMontoPago(group: AbstractControl) {
        const monto = group.get('monto')?.value || 0;
        const factura = this.facturaAPagar();
        if (factura && monto > this.getSaldoPendiente(factura)) {
            return { max: true };
        }
        return null;
    }

    // ===== CARGA DE DATOS =====
    cargarResumen() {
        this.svc.getResumen().subscribe({
            next: (r) => {
                this.resumen.set({
                    ...r,
                    porcentaje_cobrado: r.total_facturado > 0
                        ? Math.round((r.total_cobrado / r.total_facturado) * 100)
                        : 0
                });
            },
            error: () => this.showToast('Error al cargar resumen', 'error')
        });
    }

    cargarFacturas() {
        this.loading.set(true);
        const params: any = {
            page: this.paginaActual(),
            page_size: this.pageSize
        };

        if (this.filtroEstado()) params.status = this.filtroEstado();
        if (this.searchQuery) params.query = this.searchQuery;
        if (this.fechaDesde) params.date_from = this.fechaDesde;
        if (this.fechaHasta) params.date_to = this.fechaHasta;

        this.svc.listar(params).subscribe({
            next: (res) => {
                this.facturas.set(res.items);
                this.totalFacturas.set(res.total);
                this.loading.set(false);
            },
            error: () => {
                this.loading.set(false);
                this.showToast('Error al cargar facturas', 'error');
            }
        });
    }

    // ===== FILTROS =====
    onSearch(q: string) { this.searchSubject.next(q); }
    onSearchPaciente(q: string) { this.searchPacienteSubject.next(q); }

    setFiltroEstado(e: string) {
        this.filtroEstado.set(e);
        this.paginaActual.set(1);
        this.cargarFacturas();
    }

    onFilterChange() {
        this.paginaActual.set(1);
        this.cargarFacturas();
    }

    limpiarFiltros() {
        this.filtroEstado.set('');
        this.searchQuery = '';
        this.fechaDesde = '';
        this.fechaHasta = '';
        this.paginaActual.set(1);
        this.cargarFacturas();
    }

    cambiarPagina(p: number) {
        if (p < 1 || p > this.totalPaginas()) return;
        this.paginaActual.set(p);
        this.cargarFacturas();
    }

    // ===== TOAST =====
    showToast(message: string, type: 'success' | 'error' = 'success') {
        this.toastMessage.set(message);
        this.toastType.set(type);
        setTimeout(() => this.toastMessage.set(''), 5000);
    }

    // ===== MODALES =====
    abrirModalNueva() {
        this.nuevaForm.reset({ descuento: 0, impuesto: 0, notas: '' });
        while (this.itemsArray.length) this.itemsArray.removeAt(0);
        this.addItem();
        this.pacienteFactura.set(null);
        this.pacientesResultado.set([]);
        this.searchPaciente = '';
        this.errorPaciente.set('');
        this.modalNueva.set(true);
    }

    cerrarModalNueva() {
        this.modalNueva.set(false);
        this.pacientesResultado.set([]);
    }

    verDetalle(f: Factura) { this.facturaDetalle.set(f); }

    // ===== ITEMS =====
    addItem() {
        const itemGroup = this.fb.group({
            descripcion: ['', [Validators.required, Validators.minLength(3)]],
            cantidad: [1, [Validators.required, Validators.min(1)]],
            precio_unitario: [0, [Validators.required, Validators.min(0.01)]]
        });
        this.itemsArray.push(itemGroup);
    }

    removeItem(i: number) {
        if (this.itemsArray.length > 1) {
            this.itemsArray.removeAt(i);
        }
    }

    // ===== PACIENTES =====
    seleccionarPacienteFactura(p: PacienteResumen) {
        this.busquedaPacientesLoading.set(true);

        this.pacSvc.getPaciente(p.id).subscribe({
            next: (pacienteCompleto) => {
                this.pacienteFactura.set(pacienteCompleto);
                this.pacientesResultado.set([]);
                this.searchPaciente = '';
                this.errorPaciente.set('');
                this.busquedaPacientesLoading.set(false);
                // ✅ Forzar validación del formulario
                this.nuevaForm.updateValueAndValidity();
            },
            error: (e) => {
                console.error('Error al cargar paciente completo:', e);
                this.busquedaPacientesLoading.set(false);
                this.pacientesResultado.set([]);
                this.searchPaciente = '';
                this.showToast('Error al cargar los datos del paciente', 'error');
            }
        });
    }

    limpiarPaciente() {
        this.pacienteFactura.set(null);
        this.searchPaciente = '';
        this.pacientesResultado.set([]);
        this.errorPaciente.set('');
        this.nuevaForm.updateValueAndValidity();
    }

    // ===== CREAR FACTURA =====
    crearFactura() {
        if (this.nuevaForm.invalid || !this.pacienteFactura()) {
            if (!this.pacienteFactura()) {
                this.errorPaciente.set('Debes seleccionar un paciente.');
            }
            return;
        }

        this.guardando.set(true);
        this.errorPaciente.set('');

        const val = this.nuevaForm.value;
        const items = (val.items as any[]).map(i => ({
            description: i.descripcion,
            quantity: i.cantidad,
            unit_price: i.precio_unitario
        }));

        const data: NuevaFactura = {
            patient_id: this.pacienteFactura()!.id,
            issue_date: new Date().toISOString().split('T')[0],
            discount_amount: val.descuento ?? 0,
            tax_rate: (val.impuesto ?? 0) / 100,
            notes: val.notas ?? '',
            items: items
        };

        this.svc.crear(data).subscribe({
            next: (f) => {
                this.facturas.update(fs => [f, ...fs]);
                this.guardando.set(false);
                this.cerrarModalNueva();
                this.cargarResumen();
                this.showToast(`Factura ${f.invoice_number} creada exitosamente`, 'success');
            },
            error: (e) => {
                this.guardando.set(false);
                const msg = e.error?.detail || 'Error al crear la factura';
                this.errorPaciente.set(msg);
                this.showToast(msg, 'error');
            }
        });
    }

    // ===== PAGOS =====
    abrirPago(f: Factura) {
        this.facturaAPagar.set(f);
        const saldo = this.getSaldoPendiente(f);
        this.pagoForm.patchValue({
            monto: saldo,
            metodo_pago: 'cash',
            referencia: '',
            notas: ''
        });
        this.errorPago.set('');
    }

    registrarPago() {
        if (this.pagoForm.invalid || !this.facturaAPagar()) {
            if (this.pagoForm.hasError('max')) {
                this.errorPago.set('El monto no puede exceder el saldo pendiente.');
            }
            return;
        }

        this.guardando.set(true);
        this.errorPago.set('');

        // ✅ Usamos el endpoint simple /pay
        this.svc.marcarPagada(this.facturaAPagar()!.id).subscribe({
            next: (f) => {
                this.facturas.update(fs => fs.map(x => x.id === f.id ? f : x));
                this.guardando.set(false);
                this.facturaAPagar.set(null);
                this.cargarResumen();
                this.showToast(`Factura ${f.invoice_number} marcada como pagada`, 'success');
            },
            error: (e) => {
                this.guardando.set(false);
                const msg = e.error?.detail || 'Error al registrar el pago';
                this.errorPago.set(msg);
                this.showToast(msg, 'error');
            }
        });
    }
    // ===== ANULAR FACTURA =====
    confirmarAnular(f: Factura) {
        this.facturaAAnular.set(f);
        this.motivoAnulacion = '';
        this.errorAnulacion.set('');
    }

    anularFactura() {
        if (!this.facturaAAnular() || !this.motivoAnulacion.trim()) {
            this.errorAnulacion.set('Debes ingresar un motivo para la anulación.');
            return;
        }

        this.guardando.set(true);
        this.errorAnulacion.set('');

        this.svc.cancelar(this.facturaAAnular()!.id, this.motivoAnulacion.trim()).subscribe({
            next: (f) => {
                this.facturas.update(fs => fs.map(x => x.id === f.id ? f : x));
                this.guardando.set(false);
                this.facturaAAnular.set(null);
                this.cargarResumen();
                this.showToast(`Factura ${f.invoice_number} anulada`, 'success');
            },
            error: (e) => {
                this.guardando.set(false);
                const msg = e.error?.detail || 'Error al anular la factura';
                this.errorAnulacion.set(msg);
                this.showToast(msg, 'error');
            }
        });
    }

    // ===== DESCARGA PDF =====
    descargarPDF(f: Factura) {
        this.svc.descargarPDF(f.id).subscribe({
            next: (blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${f.invoice_number}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                this.showToast(`Descargando ${f.invoice_number}`, 'success');
            },
            error: () => {
                this.showToast('Error al descargar el PDF', 'error');
            }
        });
    }

    // ===== LABELS =====
    labelEstado(e: InvoiceStatus): string {
        return INVOICE_STATUS_LABELS[e] || 'Desconocido';
    }
}