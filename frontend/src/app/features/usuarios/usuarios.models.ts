// Mapeo exacto contra UserResponse / UserCreate del backend

// Enums reales del backend
export type UserRole = 'admin' | 'doctor' | 'receptionist' | 'patient';

export interface Usuario {
  id: number;
  clinic_id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  license_number?: string;
  specialty?: string;
  avatar_url?: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

// POST /api/v1/users
// IMPORTANTE: password requiere al menos 1 mayúscula + 1 dígito (validator del schema)
export interface NuevoUsuario {
  clinic_id: number;         // requerido — usar el clinic_id del usuario logueado
  email: string;
  password: string;          // min 8 chars, 1 uppercase, 1 digit
  first_name: string;
  last_name: string;
  role: UserRole;
  phone?: string;
  license_number?: string;   // solo para doctores
  specialty?: string;        // solo para doctores
}

// PATCH /api/v1/users/{id}
// Solo estos 5 campos acepta UserUpdate — role e is_active NO están aquí
export interface EditarUsuario {
  first_name?: string;
  last_name?: string;
  phone?: string;
  specialty?: string;
  license_number?: string;
}

// PATCH /api/v1/users/{id}/active  (endpoint nuevo en users.py)
export interface ToggleActivoPayload {
  is_active: boolean;
}

// POST /api/v1/users/{id}/password  (endpoint nuevo en users.py)
export interface CambiarPasswordPayload {
  new_password: string;   // min 8 chars
}

// Config visual por rol (solo frontend — no viene del backend)
export const ROL_CONFIG: Record<UserRole, {
  label: string; color: string; bg: string; permisos: string[];
}> = {
  admin: {
    label: 'Administrador',
    color: '#553c9a', bg: '#faf5ff',
    permisos: ['Acceso total', 'Gestión de usuarios', 'Configuración', 'Reportes', 'Facturación']
  },
  doctor: {
    label: 'Doctor',
    color: '#2b6cb0', bg: '#ebf8ff',
    permisos: ['Historia clínica', 'Agenda', 'Rayos X', 'Pacientes asignados']
  },
  receptionist: {
    label: 'Recepcionista',
    color: '#276749', bg: '#f0fff4',
    permisos: ['Gestión de citas', 'Registro de pacientes', 'Facturación', 'Recordatorios']
  },
  patient: {
    label: 'Paciente',
    color: '#7b341e', bg: '#fefcbf',
    permisos: ['Ver historial propio', 'Agendar citas', 'Ver facturas propias']
  }
};