import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';

export interface User {
  id: number;
  clinic_id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  specialty?: string;
  avatar_url?: string;
}

//const API = 'http://localhost:8000/api/v1';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private TOKEN_KEY = 'dp_access_token';
  private USER_KEY = 'dp_user';

  private _user = signal<User | null>(this._loadUser());
  currentUser = this._user.asReadonly();
  isAdmin = computed(() => this._user()?.role === 'admin');
  isDoctor = computed(() => ['admin','doctor'].includes(this._user()?.role ?? ''));

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string) {
    return this.http.post<any>(`${API}/auth/login`, { email, password }).pipe(
      tap((res: any) => {
        localStorage.setItem(this.TOKEN_KEY, res.access_token);
        this._fetchMe();
      })
    );
  }

  private _fetchMe() {
    this.http.get<User>(`${API}/auth/me`).subscribe((user: User) => {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      this._user.set(user);
    });
  }

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean { return !!this.getAccessToken(); }
  getAccessToken(): string | null { return localStorage.getItem(this.TOKEN_KEY); }

  private _loadUser(): User | null {
    try {
      const raw = localStorage.getItem(this.USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
}