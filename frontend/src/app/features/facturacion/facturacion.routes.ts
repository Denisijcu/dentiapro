import { Routes } from '@angular/router';

export const FACTURACION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./facturacion-lista/facturacion-lista.component').then(
        m => m.FacturacionListaComponent
      )
  }
];