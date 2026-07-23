import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

import { NotFoundComponent } from './features/404/not-found.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      // Gestión de pacientes
      {
        path: 'patients',
        loadComponent: () => import('./features/patients/patients.component').then(m => m.PatientsComponent),
      },
      {
        path: 'patients/:id',
        loadComponent: () => import('./features/patients/patient-detail/patient-detail.component').then(m => m.PatientDetailComponent),
      },
      // Módulos con rutas hijas (Lazy Loading optimizado)
      {
        path: 'clinical-history',
        loadChildren: () => import('./features/historia-clinica/historia-clinica.routes').then(m => m.HISTORIA_CLINICA_ROUTES)
      },
      {
        path: 'invoices',
        loadChildren: () => import('./features/facturacion/facturacion.routes').then(m => m.FACTURACION_ROUTES)
      },
      // Admin Only
      {
        path: 'users',
        loadChildren: () => import('./features/usuarios/usuarios.routes').then(m => m.USUARIOS_ROUTES),
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
      },
      // Otros
      {
        path: 'appointments',
        loadComponent: () => import('./features/appointments/appointments.component').then(m => m.AppointmentsComponent),
      },
      {
        path: 'xray',
        loadComponent: () => import('./features/xray/xray.component').then(m => m.XrayComponent),
      },
    ],
  },
 { 
    path: '**', 
    component: NotFoundComponent,
    title: '404 - Sistema no encontrado'
  },
];