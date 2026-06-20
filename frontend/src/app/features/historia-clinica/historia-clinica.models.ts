// Mapeo exacto contra ClinicalHistoryResponse + PatientResponse del backend

export interface Paciente {
  id: number;
  clinic_id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  date_of_birth: string;
  phone: string;
  email?: string;
  national_id?: string;
  address?: string;
  gender?: string;
  blood_type: string;       // "A+","B-","AB+","O+","O-","unknown"…
  allergies?: string;
  current_medications?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  insurance_provider?: string;
  insurance_policy_number?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// PatientSummary — lo que devuelve /patients/search
export interface PacienteResumen {
  id: number;
  full_name: string;
  date_of_birth: string;
  phone: string;
  email?: string;
  is_active: boolean;
}

// GET /api/v1/clinical-history/patient/{id}  →  ClinicalHistoryResponse[]
export interface EntradaHistoria {
  id: number;
  patient_id: number;
  doctor_id: number;
  appointment_id?: number;
  visit_date: string;           // datetime ISO
  chief_complaint: string;
  diagnosis: string;
  treatment_performed?: string;
  treatment_plan?: string;
  prescriptions?: string;
  notes?: string;
  follow_up_date?: string;      // date "YYYY-MM-DD"
  dental_chart?: string;        // JSON string
  created_at: string;
  updated_at: string;
}

// POST /api/v1/clinical-history  →  ClinicalHistoryCreate
export interface NuevaEntrada {
  patient_id: number;
  appointment_id?: number;
  chief_complaint: string;      // min 5 chars
  diagnosis: string;            // min 5 chars
  treatment_performed?: string;
  treatment_plan?: string;
  prescriptions?: string;
  notes?: string;
  follow_up_date?: string;      // "YYYY-MM-DD"
  dental_chart?: string;
}

// PATCH /api/v1/clinical-history/{id}  →  ClinicalHistoryUpdate
export interface ActualizarEntrada {
  chief_complaint?: string;
  diagnosis?: string;
  treatment_performed?: string;
  treatment_plan?: string;
  prescriptions?: string;
  notes?: string;
  follow_up_date?: string;
  dental_chart?: string;
}