import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Usuario, NuevoUsuario, EditarUsuario, CambiarPasswordPayload
} from './usuarios.models';

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly http = inject(HttpClient);
  private readonly base = 'http://localhost:8000/api/v1';

  // GET /api/v1/users
  listar(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(`${this.base}/users`);
  }

  // GET /api/v1/users/{id}
  getById(id: number): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.base}/users/${id}`);
  }

  // POST /api/v1/users
  // Recuerda: password necesita mayúscula + dígito
  crear(data: NuevoUsuario): Observable<Usuario> {
    return this.http.post<Usuario>(`${this.base}/users`, data);
  }

  // PATCH /api/v1/users/{id}
  // Solo: first_name, last_name, phone, specialty, license_number
  editar(id: number, data: EditarUsuario): Observable<Usuario> {
    return this.http.patch<Usuario>(`${this.base}/users/${id}`, data);
  }

  // PATCH /api/v1/users/{id}/active
  toggleActivo(id: number, isActive: boolean): Observable<Usuario> {
    return this.http.patch<Usuario>(
      `${this.base}/users/${id}/active`,
      { is_active: isActive }
    );
  }

  // POST /api/v1/users/{id}/password
  cambiarPassword(id: number, newPassword: string): Observable<void> {
    return this.http.post<void>(
      `${this.base}/users/${id}/password`,
      { new_password: newPassword } as CambiarPasswordPayload
    );
  }

  // DELETE /api/v1/users/{id}  — desactiva, no borra físicamente
  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/users/${id}`);
  }
}