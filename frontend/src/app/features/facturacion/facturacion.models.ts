// facturacion.models.ts

// Enums reales del modelo Invoice
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled';

// Lo que devuelve _serialize_invoice() del backend
export interface Factura {
  id: number;
  patient_id: number;
  appointment_id?: number;
  invoice_number: string;
  issue_date: string;           // "YYYY-MM-DD"
  due_date?: string;
  subtotal: number;
  tax_rate: number;             // 0.0–1.0  (ej: 0.16 = 16%)
  tax_amount: number;
  discount_amount: number;      // valor absoluto, NO porcentaje
  total: number;
  status: InvoiceStatus;
  notes?: string;
  paid_at?: string;
  created_at: string;
  updated_at: string;
  // Campos enriquecidos por el backend
  patient_name: string;
  patient_national_id?: string;
  items: FacturaItem[];
  payments?: FacturaPago[];
}

export interface FacturaItem {
  description: string;
  quantity: number;
  unit_price: number;
  subtotal?: number;            // calculado en backend
}

export interface FacturaPago {
  id: number;
  amount: number;
  method: string;
  reference?: string;
  notes?: string;
  payment_date: string;
}

// POST /api/v1/invoices  →  InvoiceCreate
export interface NuevaFactura {
  patient_id: number;
  appointment_id?: number;
  issue_date: string;           // "YYYY-MM-DD"
  due_date?: string;
  items: FacturaItemCreate[];
  tax_rate: number;             // 0.0–1.0  (ej: 0.16)
  discount_amount: number;      // valor absoluto (ej: 50.00)
  notes?: string;
}

export interface FacturaItemCreate {
  description: string;
  quantity: number;             // float >= 0
  unit_price: number;           // float >= 0
}

// Registrar pago
export interface RegistrarPago {
  amount: number;
  method: string;               // 'cash' | 'card' | 'transfer' | 'insurance' | 'other'
  reference?: string;
  notes?: string;
  payment_date?: string;        // ISO datetime
}

// Anular factura
export interface AnularFactura {
  reason: string;
}

// Respuesta de GET /invoices y GET /invoices?status=...
export interface FacturasPaginadas {
  total: number;
  page: number;
  page_size: number;
  items: Factura[];
}

// Respuesta de GET /invoices/summary
export interface ResumenFacturacion {
  total_facturado: number;
  total_cobrado: number;
  total_pendiente: number;
  facturas_mes: number;
  facturas_pendientes?: number;
  pagos_mes?: number;
  crecimiento_mensual?: number;
  porcentaje_cobrado?: number;
}

// Labels visuales para los estados
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft:     'Borrador',
  issued:    'Emitida',
  paid:      'Pagada',
  overdue:   'Vencida',
  cancelled: 'Cancelada',
};

export const INVOICE_STATUS_STYLES: Record<InvoiceStatus, { color: string; bg: string }> = {
  draft:     { color: '#718096', bg: '#EDF2F7' },
  issued:    { color: '#7b341e', bg: '#FEFCBF' },
  paid:      { color: '#276749', bg: '#F0FFF4' },
  overdue:   { color: '#c53030', bg: '#FFF5F5' },
  cancelled: { color: '#718096', bg: '#F7FAFC' },
};

// Métodos de pago
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'insurance' | 'other';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  insurance: 'Seguro médico',
  other: 'Otro'
};