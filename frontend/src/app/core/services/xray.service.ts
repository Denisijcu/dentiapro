import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../environments/environment';

export interface XRayAnalysis {
  id: number;
  patient_id: number;
  image_url: string;
  image_type: string;
  status: string;
  ai_findings?: string;
  ai_diagnosis?: string;
  ai_recommendations?: string;
  ai_confidence_score?: number;
  heatmap_url?: string;
  doctor_diagnosis?: string;
  doctor_notes?: string;
  reviewed_at?: string;
  created_at: string;
}

//const API = 'http://localhost:8000/api/v1';
const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class XrayService {
  private url = `${API}/xray`;
  constructor(private http: HttpClient) {}

  upload(patientId: number, imageType: string, file: File, clinicalHistoryId?: number) {
    const form = new FormData();
    form.append('patient_id', String(patientId));
    form.append('image_type', imageType);
    form.append('file', file);
    if (clinicalHistoryId) form.append('clinical_history_id', String(clinicalHistoryId));
    return this.http.post<XRayAnalysis>(`${this.url}/upload`, form);
  }

  getPatientXrays(patientId: number) {
    return this.http.get<XRayAnalysis[]>(`${this.url}/patient/${patientId}`);
  }

  get(id: number) { return this.http.get<XRayAnalysis>(`${this.url}/${id}`); }

  review(id: number, doctor_diagnosis: string, doctor_notes?: string) {
    return this.http.post<XRayAnalysis>(`${this.url}/${id}/review`, { doctor_diagnosis, doctor_notes });
  }
}