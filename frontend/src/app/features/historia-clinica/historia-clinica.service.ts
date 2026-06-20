import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  PacienteResumen, Paciente, EntradaHistoria, NuevaEntrada, ActualizarEntrada
} from './historia-clinica.models';

@Injectable({ providedIn: 'root' })
export class HistoriaClinicaService {
  private readonly http = inject(HttpClient);
  private readonly base = 'http://localhost:8000/api/v1';

  // GET /api/v1/patients/search?q=término&limit=10
  // Devuelve PatientSummary[] (id, full_name, date_of_birth, phone, email, is_active)
  buscarPacientes(query: string, limit = 10): Observable<PacienteResumen[]> {
    return this.http.get<PacienteResumen[]>(`${this.base}/patients/search`, {
      params: { q: query, limit: String(limit) }
    });
  }

  // GET /api/v1/patients/{id}  — datos completos del paciente
  getPaciente(id: number): Observable<Paciente> {
    return this.http.get<Paciente>(`${this.base}/patients/${id}`);
  }

  // GET /api/v1/clinical-history/patient/{id}?skip=0&limit=50
  getEntradas(pacienteId: number, skip = 0, limit = 50): Observable<EntradaHistoria[]> {
    return this.http.get<EntradaHistoria[]>(
      `${this.base}/clinical-history/patient/${pacienteId}`,
      { params: { skip: String(skip), limit: String(limit) } }
    );
  }

  // POST /api/v1/clinical-history
  // chief_complaint y diagnosis son requeridos, min 5 chars
  addEntrada(entrada: NuevaEntrada): Observable<EntradaHistoria> {
    return this.http.post<EntradaHistoria>(`${this.base}/clinical-history`, entrada);
  }

  // PATCH /api/v1/clinical-history/{id}
  // Solo el doctor autor o un admin puede editar
  updateEntrada(entradaId: number, data: ActualizarEntrada): Observable<EntradaHistoria> {
    return this.http.patch<EntradaHistoria>(
      `${this.base}/clinical-history/${entradaId}`,
      data
    );
  }

  // GET /api/v1/clinical-history/{id}
  getEntrada(id: number): Observable<EntradaHistoria> {
    return this.http.get<EntradaHistoria>(`${this.base}/clinical-history/${id}`);
  }
}