import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { XrayService, XRayAnalysis } from '@core/services/xray.service';
import { PatientService, Patient } from '@core/services/patient.service';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-xray',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Análisis de Rayos X</h1>
          <p class="page-sub">Sube una radiografía y el modelo de IA la analizará automáticamente</p>
        </div>
      </div>

      <div class="xray-layout">
        <!-- Upload panel -->
        <div class="upload-panel">
          <h2 class="panel-title">Subir radiografía</h2>

          <!-- Patient selector -->
          <div class="field">
            <label>Paciente *</label>
            <input
              type="text"
              class="field-input"
              placeholder="Buscar paciente..."
              [(ngModel)]="patientSearch"
              (ngModelChange)="searchPatients($event)"
            />
            @if (patientResults().length > 0) {
              <div class="patient-dropdown">
                @for (p of patientResults(); track p.id) {
                  <div class="patient-option" (click)="selectPatient(p)">
                    <strong>{{ p.full_name }}</strong>
                    <span>{{ p.phone }}</span>
                  </div>
                }
              </div>
            }
            @if (selectedPatient()) {
              <div class="selected-patient">
                <span>✓ {{ selectedPatient()!.full_name }}</span>
                <button (click)="clearPatient()">✕</button>
              </div>
            }
          </div>

          <!-- Image type -->
          <div class="field">
            <label>Tipo de radiografía *</label>
            <select class="field-input" [(ngModel)]="imageType">
              <option value="panoramic">Panorámica</option>
              <option value="periapical">Periapical</option>
              <option value="bitewing">Aleta de mordida (Bitewing)</option>
              <option value="cephalometric">Cefalométrica</option>
              <option value="cbct">CBCT (Tomografía)</option>
            </select>
          </div>

          <!-- Drop zone -->
          <div
            class="dropzone"
            [class.drag-over]="dragOver()"
            [class.has-file]="selectedFile()"
            (dragover)="$event.preventDefault(); dragOver.set(true)"
            (dragleave)="dragOver.set(false)"
            (drop)="onDrop($event)"
            (click)="fileInput.click()"
          >
            @if (selectedFile()) {
              <div class="file-preview">
                <img [src]="previewUrl()" alt="Preview" class="preview-img"/>
                <div class="file-info">
                  <div class="file-name">{{ selectedFile()!.name }}</div>
                  <div class="file-size">{{ formatSize(selectedFile()!.size) }}</div>
                </div>
              </div>
            } @else {
              <div class="drop-content">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <p>Arrastra la imagen aquí o <span>haz clic para seleccionar</span></p>
                <small>JPEG, PNG, WebP o DICOM · Máx. 50MB</small>
              </div>
            }
          </div>
          <input #fileInput type="file" hidden accept="image/*,.dcm" (change)="onFileSelected($event)"/>

          @if (uploadError()) {
            <div class="error-msg">{{ uploadError() }}</div>
          }

          <button
            class="btn-upload"
            [disabled]="!selectedFile() || !selectedPatient() || uploading()"
            (click)="upload()"
          >
            @if (uploading()) {
              <span class="spinner"></span> Analizando con IA...
            } @else {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M12 2a10 10 0 110 20A10 10 0 0112 2z"/><path d="M9 12h6M12 9v6"/>
              </svg>
              Analizar con IA
            }
          </button>
        </div>

        <!-- Results panel -->
        <div class="results-panel">
          @if (currentResult()) {
            <div class="result-card">
              <div class="result-header">
                <h2 class="panel-title">Resultado del análisis</h2>
                <span class="conf-badge">
                  Confianza: {{ (currentResult()!.ai_confidence_score! * 100).toFixed(0) }}%
                </span>
              </div>

              <!-- Images comparison -->
              <div class="images-compare">
                <div class="img-block">
                  <div class="img-label">Original</div>
                  <img [src]="currentResult()!.image_url" alt="Original" class="result-img"/>
                </div>
                @if (currentResult()!.heatmap_url) {
                  <div class="img-block">
                    <div class="img-label">Mapa de activación IA</div>
                    <img [src]="currentResult()!.heatmap_url" alt="Heatmap" class="result-img"/>
                  </div>
                }
              </div>

              <!-- AI Findings -->
              <div class="finding-section">
                <h3>Hallazgos detectados</h3>
                <div class="finding-text">{{ currentResult()!.ai_findings }}</div>
              </div>

              <!-- AI Diagnosis -->
              <div class="finding-section diagnosis-section">
                <h3>Diagnóstico preliminar IA</h3>
                <div class="finding-text">{{ currentResult()!.ai_diagnosis }}</div>
              </div>

              <!-- Recommendations -->
              <div class="finding-section">
                <h3>Recomendaciones</h3>
                <div class="finding-text rec-text">{{ currentResult()!.ai_recommendations }}</div>
              </div>

              <!-- Doctor review form -->
              @if (currentResult()!.status !== 'reviewed') {
                <div class="review-form">
                  <h3>Revisión del doctor</h3>
                  <textarea
                    class="review-input"
                    placeholder="Diagnóstico confirmado por el doctor..."
                    [(ngModel)]="doctorDiagnosis"
                    rows="3"
                  ></textarea>
                  <textarea
                    class="review-input"
                    placeholder="Notas adicionales (opcional)..."
                    [(ngModel)]="doctorNotes"
                    rows="2"
                  ></textarea>
                  <button class="btn-review" [disabled]="!doctorDiagnosis || reviewing()" (click)="submitReview()">
                    {{ reviewing() ? 'Guardando...' : '✓ Confirmar diagnóstico' }}
                  </button>
                </div>
              } @else {
                <div class="reviewed-badge">
                  ✓ Revisado por el doctor · {{ formatDate(currentResult()!.reviewed_at!) }}
                </div>
              }
            </div>
          } @else {
            <div class="empty-results">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="56" height="56">
                <path d="M3 9V5a2 2 0 012-2h4M15 3h4a2 2 0 012 2v4M21 15v4a2 2 0 01-2 2h-4M9 21H5a2 2 0 01-2-2v-4"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
              </svg>
              <p>Sube una radiografía para ver el análisis de IA aquí</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 28px 32px; max-width: 1200px; }
    .page-header { margin-bottom: 28px; }
    .page-title { font-size: 22px; font-weight: 600; color: #0D3D3D; margin: 0 0 4px; }
    .page-sub { font-size: 13px; color: #6B7280; margin: 0; }
    .xray-layout { display: grid; grid-template-columns: 380px 1fr; gap: 24px; align-items: start; }
    .panel-title { font-size: 15px; font-weight: 600; color: #0D3D3D; margin: 0 0 18px; }

    /* Upload panel */
    .upload-panel {
      background: #fff; border-radius: 14px; padding: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; position: relative; }
    .field label { font-size: 12px; font-weight: 500; color: #374151; }
    .field-input {
      padding: 9px 12px; border: 1.5px solid #E5E7EB;
      border-radius: 8px; font-size: 13px; outline: none;
      transition: border-color 0.15s; background: #fff;
    }
    .field-input:focus { border-color: #0D6E6E; }

    .patient-dropdown {
      position: absolute; top: 100%; left: 0; right: 0; z-index: 10;
      background: #fff; border: 1.5px solid #E5E7EB; border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12); max-height: 200px; overflow-y: auto;
    }
    .patient-option {
      padding: 10px 12px; cursor: pointer; display: flex; justify-content: space-between;
      font-size: 13px; transition: background 0.1s;
    }
    .patient-option:hover { background: #F0F4F8; }
    .patient-option span { font-size: 12px; color: #9CA3AF; }
    .selected-patient {
      display: flex; align-items: center; justify-content: space-between;
      background: #ECFDF5; color: #059669; padding: 7px 10px;
      border-radius: 6px; font-size: 12px; font-weight: 500;
    }
    .selected-patient button { background: none; border: none; cursor: pointer; color: #059669; font-size: 14px; }

    .dropzone {
      border: 2px dashed #E5E7EB; border-radius: 10px;
      padding: 24px; text-align: center; cursor: pointer;
      transition: border-color 0.15s, background 0.15s; margin-bottom: 14px;
    }
    .dropzone:hover, .dropzone.drag-over { border-color: #0D6E6E; background: #F0FAF9; }
    .drop-content { display: flex; flex-direction: column; align-items: center; gap: 8px; color: #9CA3AF; }
    .drop-content svg { stroke: #9CA3AF; }
    .drop-content p { font-size: 13px; margin: 0; }
    .drop-content p span { color: #0D6E6E; font-weight: 500; }
    .drop-content small { font-size: 11px; }
    .file-preview { display: flex; align-items: center; gap: 12px; }
    .preview-img { width: 60px; height: 60px; object-fit: cover; border-radius: 6px; }
    .file-name { font-size: 12px; font-weight: 500; color: #111827; }
    .file-size { font-size: 11px; color: #9CA3AF; }

    .error-msg { background: #FEF2F2; color: #EF4444; font-size: 12px; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; }

    .btn-upload {
      width: 100%; background: #0D6E6E; color: #fff;
      border: none; border-radius: 8px; padding: 12px;
      font-size: 14px; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      transition: background 0.15s;
    }
    .btn-upload:hover:not(:disabled) { background: #0A5555; }
    .btn-upload:disabled { opacity: 0.5; cursor: not-allowed; }
    .spinner {
      width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff; border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Results panel */
    .results-panel { min-height: 400px; }
    .result-card { background: #fff; border-radius: 14px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .result-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    .conf-badge {
      background: #ECFDF5; color: #059669;
      font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 20px;
    }
    .images-compare { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .img-block { display: flex; flex-direction: column; gap: 6px; }
    .img-label { font-size: 11px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em; }
    .result-img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 10px; background: #0D3D3D; }
    .finding-section { margin-bottom: 16px; }
    .finding-section h3 { font-size: 12px; font-weight: 600; color: #0D3D3D; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px; }
    .finding-text { font-size: 13px; color: #374151; line-height: 1.6; white-space: pre-line; }
    .diagnosis-section { background: #F0FAF9; border-radius: 8px; padding: 12px; }
    .rec-text { font-size: 12px; }
    .review-form { border-top: 1px solid #F0F0F0; padding-top: 18px; margin-top: 4px; }
    .review-form h3 { font-size: 13px; font-weight: 600; color: #0D3D3D; margin: 0 0 10px; }
    .review-input {
      width: 100%; padding: 9px 12px; border: 1.5px solid #E5E7EB;
      border-radius: 8px; font-size: 13px; outline: none; resize: vertical;
      font-family: inherit; margin-bottom: 8px; box-sizing: border-box;
      transition: border-color 0.15s;
    }
    .review-input:focus { border-color: #0D6E6E; }
    .btn-review {
      background: #7C3AED; color: #fff; border: none;
      border-radius: 8px; padding: 10px 18px; font-size: 13px; font-weight: 600;
      cursor: pointer; transition: background 0.15s;
    }
    .btn-review:hover:not(:disabled) { background: #6D28D9; }
    .btn-review:disabled { opacity: 0.5; cursor: not-allowed; }
    .reviewed-badge {
      background: #ECFDF5; color: #059669; padding: 10px 14px;
      border-radius: 8px; font-size: 12px; font-weight: 500;
      border-top: 1px solid #F0F0F0; margin-top: 12px;
    }
    .empty-results {
      height: 400px; background: #fff; border-radius: 14px;
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 12px; color: #9CA3AF;
      font-size: 13px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }

    @media (max-width: 900px) {
      .xray-layout { grid-template-columns: 1fr; }
      .images-compare { grid-template-columns: 1fr; }
    }
  `],
})
export class XrayComponent implements OnInit {
  selectedPatient = signal<Patient | null>(null);
  patientResults = signal<Patient[]>([]);
  patientSearch = '';
  imageType = 'panoramic';
  selectedFile = signal<File | null>(null);
  previewUrl = signal('');
  dragOver = signal(false);
  uploading = signal(false);
  uploadError = signal('');
  currentResult = signal<XRayAnalysis | null>(null);
  doctorDiagnosis = '';
  doctorNotes = '';
  reviewing = signal(false);

  constructor(
    private xraySvc: XrayService,
    private patientSvc: PatientService,
  ) {}

  ngOnInit() {}

  searchPatients(term: string) {
    if (term.length < 2) { this.patientResults.set([]); return; }
    this.patientSvc.list(1, 8, term).subscribe(res => this.patientResults.set(res.items));
  }

  selectPatient(p: Patient) {
    this.selectedPatient.set(p);
    this.patientSearch = p.full_name;
    this.patientResults.set([]);
  }

  clearPatient() {
    this.selectedPatient.set(null);
    this.patientSearch = '';
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.dragOver.set(false);
    const file = e.dataTransfer?.files[0];
    if (file) this.setFile(file);
  }

  onFileSelected(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.setFile(file);
  }

  setFile(file: File) {
    this.selectedFile.set(file);
    const reader = new FileReader();
    reader.onload = (e) => this.previewUrl.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  upload() {
    if (!this.selectedFile() || !this.selectedPatient()) return;
    this.uploading.set(true);
    this.uploadError.set('');

    this.xraySvc.upload(this.selectedPatient()!.id, this.imageType, this.selectedFile()!).subscribe({
      next: (result) => {
        this.uploading.set(false);
        this.currentResult.set(result);
        // Poll for AI results if still processing
        if (result.status === 'processing' || result.status === 'uploaded') {
          this.pollForResults(result.id);
        }
      },
      error: (e) => {
        this.uploading.set(false);
        this.uploadError.set(e.error?.detail ?? 'Error al subir la imagen.');
      },
    });
  }

  pollForResults(xrayId: number, attempts = 0) {
    if (attempts > 20) return; // max 60 segundos
    setTimeout(() => {
      this.xraySvc.get(xrayId).subscribe(result => {
        this.currentResult.set(result);
        if (result.status === 'processing' || result.status === 'uploaded') {
          this.pollForResults(xrayId, attempts + 1);
        }
      });
    }, 3000);
  }

  submitReview() {
    if (!this.doctorDiagnosis || !this.currentResult()) return;
    this.reviewing.set(true);
    this.xraySvc.review(this.currentResult()!.id, this.doctorDiagnosis, this.doctorNotes).subscribe({
      next: (result) => { this.currentResult.set(result); this.reviewing.set(false); },
      error: () => this.reviewing.set(false),
    });
  }

  formatSize(bytes: number): string {
    return bytes > 1024 * 1024
      ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
      : `${(bytes / 1024).toFixed(0)} KB`;
  }

  formatDate(iso: string) { return new Date(iso).toLocaleDateString('es-ES'); }
}