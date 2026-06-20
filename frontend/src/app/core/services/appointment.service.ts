import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from './patient.service';

export interface Appointment {
  id: number;
  clinic_id: number;
  patient_id: number;
  doctor_id: number;
  scheduled_at: string;
  duration_minutes: number;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  appointment_type: string;
  reason?: string;
  notes?: string;
  created_at: string;
}

export interface AppointmentCreate {
  patient_id: number;
  doctor_id: number;
  scheduled_at: string;
  duration_minutes?: number;
  appointment_type?: string;
  reason?: string;
}

@Injectable({ providedIn: 'root' })
export class AppointmentService {
  private url = `${environment.apiUrl}/appointments`;

  constructor(private http: HttpClient) {}

  list(filters: { doctor_id?: number; patient_id?: number; date_from?: string; date_to?: string; page?: number } = {}) {
    let params = new HttpParams().set('page', filters.page ?? 1);
    if (filters.doctor_id) params = params.set('doctor_id', filters.doctor_id);
    if (filters.patient_id) params = params.set('patient_id', filters.patient_id);
    if (filters.date_from) params = params.set('date_from', filters.date_from);
    if (filters.date_to) params = params.set('date_to', filters.date_to);
    return this.http.get<PaginatedResponse<Appointment>>(this.url, { params });
  }

  get(id: number) {
    return this.http.get<Appointment>(`${this.url}/${id}`);
  }

  create(payload: AppointmentCreate) {
    return this.http.post<Appointment>(this.url, payload);
  }

  updateStatus(id: number, status: string, cancellation_reason?: string) {
    return this.http.patch<Appointment>(`${this.url}/${id}`, { status, cancellation_reason });
  }
}