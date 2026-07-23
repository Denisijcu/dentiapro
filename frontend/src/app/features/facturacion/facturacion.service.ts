// facturacion.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Factura, 
  NuevaFactura, 
  ResumenFacturacion, 
  FacturasPaginadas,
  RegistrarPago,
  AnularFactura
} from './facturacion.models';

import { environment } from '../../../environments/environment.prod';

@Injectable({ providedIn: 'root' })
export class FacturacionService {
  private readonly http = inject(HttpClient);
 private readonly base = `${environment.apiUrl}/api/v1`;


  // GET /api/v1/invoices/summary
  getResumen(): Observable<ResumenFacturacion> {
    return this.http.get<ResumenFacturacion>(`${this.base}/invoices/summary`);
  }

  // GET /api/v1/invoices?status=issued&page=1&page_size=20
  listar(filtros: {
    status?: string;
    page?: number;
    page_size?: number;
    query?: string;
    date_from?: string;
    date_to?: string;
  } = {}): Observable<FacturasPaginadas> {
    let params = new HttpParams()
      .set('page', String(filtros.page ?? 1))
      .set('page_size', String(filtros.page_size ?? 20));
    
    if (filtros.status) params = params.set('status', filtros.status);
    if (filtros.query) params = params.set('query', filtros.query);
    if (filtros.date_from) params = params.set('date_from', filtros.date_from);
    if (filtros.date_to) params = params.set('date_to', filtros.date_to);
    
    return this.http.get<FacturasPaginadas>(`${this.base}/invoices`, { params });
  }

  // GET /api/v1/invoices/{id}
  getById(id: number): Observable<Factura> {
    return this.http.get<Factura>(`${this.base}/invoices/${id}`);
  }

  // GET /api/v1/invoices/patient/{patient_id}
  getByPaciente(patientId: number): Observable<Factura[]> {
    return this.http.get<Factura[]>(`${this.base}/invoices/patient/${patientId}`);
  }

  // POST /api/v1/invoices
  crear(data: NuevaFactura): Observable<Factura> {
    return this.http.post<Factura>(`${this.base}/invoices`, data);
  }

  // POST /api/v1/invoices/{id}/payments
  registrarPago(id: number, data: RegistrarPago): Observable<Factura> {
    return this.http.post<Factura>(`${this.base}/invoices/${id}/payments`, data);
  }

  // POST /api/v1/invoices/{id}/pay (método simple, mantener por compatibilidad)
  marcarPagada(id: number): Observable<Factura> {
    return this.http.post<Factura>(`${this.base}/invoices/${id}/pay`, {});
  }

  // POST /api/v1/invoices/{id}/cancel
  cancelar(id: number, motivo: string): Observable<Factura> {
    return this.http.post<Factura>(`${this.base}/invoices/${id}/cancel`, { reason: motivo });
  }

  // GET /api/v1/invoices/{id}/pdf  → Blob para descarga
  descargarPDF(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/invoices/${id}/pdf`, { 
      responseType: 'blob' 
    });
  }
}