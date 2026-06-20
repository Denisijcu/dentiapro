import { Routes } from '@angular/router';

export const HISTORIA_CLINICA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lista-historias/lista-historias.component').then(
        m => m.ListaHistoriasComponent
      )
  }
];