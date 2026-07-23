import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

import { environment } from '../../../environments/environment';

export interface Patient {
  id: number;
  clinic_id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  date_of_birth: string;
  phone: string;
  email?: string;
  national_id?: string;
  blood_type: string;
  allergies?: string;
  current_medications?: string;
  insurance_provider?: string;
  is_active: boolean;
  created_at: string;
}

export interface PatientCreate {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  phone: string;
  email?: string;
  national_id?: string;
  blood_type?: string;
  allergies?: string;
  current_medications?: string;
}

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  page_size: number;
  items: T[];
}

//const API = 'http://localhost:8000/api/v1';
const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class PatientService {
  private url = `${API}/patients`;
  constructor(private http: HttpClient) {}

  list(page = 1, pageSize = 20, search = '') {
    let params = new HttpParams().set('page', page).set('page_size', pageSize);
    if (search) params = params.set('search', search);
    return this.http.get<PaginatedResponse<Patient>>(this.url, { params });
  }

  get(id: number)                    { return this.http.get<Patient>(`${this.url}/${id}`); }
  create(payload: PatientCreate)     { return this.http.post<Patient>(this.url, payload); }
  update(id: number, payload: any)   { return this.http.patch<Patient>(`${this.url}/${id}`, payload); }
  deactivate(id: number)             { return this.http.delete(`${this.url}/${id}`); }
  delete(id: number)                 { return this.http.delete(`${this.url}/${id}`); }
}