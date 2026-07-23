import {
  Component, signal, inject, DestroyRef, ElementRef, ViewChild, AfterViewChecked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { environment } from '../../../environments/environment';

const API = environment.apiUrl;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<!-- FAB flotante -->
@if (!isOpen()) {
  <button class="chat-fab" (click)="open()" title="Abrir asistente DentyAI">
    <div class="fab-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
    </div>
    @if (unreadCount() > 0) {
      <span class="fab-badge">{{ unreadCount() }}</span>
    }
  </button>
}

<!-- Ventana del chat -->
@if (isOpen()) {
  <div class="chat-window" [class.minimized]="isMinimized()">

    <!-- Header -->
    <div class="chat-header" (click)="toggleMinimize()">
      <div class="header-left">
        <div class="bot-avatar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <circle cx="12" cy="8" r="4"/>
            <path d="M6 20v-2a6 6 0 0112 0v2"/>
            <line x1="8" y1="8" x2="8" y2="8" stroke-width="3" stroke-linecap="round"/>
            <line x1="16" y1="8" x2="16" y2="8" stroke-width="3" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="header-info">
          <span class="bot-name">DentyAI</span>
          <span class="bot-status">
            <span class="status-dot"></span>
            Asistente activo
          </span>
        </div>
      </div>
      <div class="header-actions" (click)="$event.stopPropagation()">
        <button class="header-btn" (click)="clearChat()" title="Nueva conversación">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
          </svg>
        </button>
        <button class="header-btn" (click)="toggleMinimize()" title="Minimizar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        <button class="header-btn header-close" (click)="close()" title="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>

    @if (!isMinimized()) {
      <!-- Mensajes -->
      <div class="chat-messages" #messagesContainer>

        <!-- Bienvenida -->
        @if (messages().length === 0) {
          <div class="welcome-msg">
            <div class="welcome-avatar">🦷</div>
            <div class="welcome-bubble">
              <p>¡Hola! Soy <strong>DentyAI</strong>, tu asistente de DentiaPro.</p>
              <p>Puedo ayudarte con:</p>
              <div class="quick-chips">
                @for (chip of quickChips; track chip) {
                  <button class="chip" (click)="sendQuick(chip)">{{ chip }}</button>
                }
              </div>
            </div>
          </div>
        }

        <!-- Historial -->
        @for (msg of messages(); track $index) {
          <div class="msg-row" [class.user-row]="msg.role === 'user'">
            @if (msg.role === 'assistant') {
              <div class="msg-avatar bot-msg-avatar">🦷</div>
            }
            <div class="msg-bubble" [class.user-bubble]="msg.role === 'user'" [class.bot-bubble]="msg.role === 'assistant'">
              <div class="msg-content" [innerHTML]="formatMessage(msg.content)"></div>
              <div class="msg-time">{{ formatTime(msg.timestamp) }}</div>
            </div>
          </div>
        }

        <!-- Typing indicator -->
        @if (loading()) {
          <div class="msg-row">
            <div class="msg-avatar bot-msg-avatar">🦷</div>
            <div class="msg-bubble bot-bubble typing-bubble">
              <span></span><span></span><span></span>
            </div>
          </div>
        }

        <!-- Error -->
        @if (error()) {
          <div class="error-msg">
            ⚠️ {{ error() }}
          </div>
        }
      </div>

      <!-- Input -->
      <div class="chat-input-area">
        <div class="input-row">
          <textarea
            #inputEl
            [(ngModel)]="inputText"
            (keydown)="onKeyDown($event)"
            placeholder="Pregunta algo… (Enter para enviar)"
            class="chat-input"
            rows="1"
            [disabled]="loading()"
          ></textarea>
          <button
            class="send-btn"
            (click)="send()"
            [disabled]="!inputText.trim() || loading()"
            title="Enviar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
        <p class="input-hint">DentyAI tiene acceso en tiempo real a los datos de la clínica</p>
      </div>
    }
  </div>
}
  `,
  styles: [`
    /* FAB */
    .chat-fab {
      position: fixed;
      bottom: 28px;
      right: 28px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0D6E6E, #0A5555);
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(13,110,110,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
      z-index: 9999;
    }
    .chat-fab:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(13,110,110,0.5); }
    .fab-icon { color: #fff; display: flex; }
    .fab-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #EF4444;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #fff;
    }

    /* Ventana */
    .chat-window {
      position: fixed;
      bottom: 28px;
      right: 28px;
      width: 380px;
      height: 560px;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.18);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 9999;
      animation: slideUp 0.2s ease;
    }
    .chat-window.minimized { height: 60px; }
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

    /* Header */
    .chat-header {
      background: linear-gradient(135deg, #0D6E6E, #0A5555);
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      flex-shrink: 0;
    }
    .header-left { display: flex; align-items: center; gap: 10px; }
    .bot-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      flex-shrink: 0;
    }
    .header-info { display: flex; flex-direction: column; }
    .bot-name { font-size: 14px; font-weight: 700; color: #fff; }
    .bot-status { display: flex; align-items: center; gap: 5px; font-size: 11px; color: rgba(255,255,255,0.8); }
    .status-dot { width: 6px; height: 6px; border-radius: 50%; background: #4ADE80; }
    .header-actions { display: flex; gap: 4px; }
    .header-btn {
      width: 26px;
      height: 26px;
      border-radius: 6px;
      background: rgba(255,255,255,0.15);
      border: none;
      cursor: pointer;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
    }
    .header-btn:hover { background: rgba(255,255,255,0.25); }
    .header-close:hover { background: rgba(239,68,68,0.5); }

    /* Mensajes */
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #F8FAFB;
    }
    .chat-messages::-webkit-scrollbar { width: 4px; }
    .chat-messages::-webkit-scrollbar-track { background: transparent; }
    .chat-messages::-webkit-scrollbar-thumb { background: #CBD5E0; border-radius: 2px; }

    /* Bienvenida */
    .welcome-msg { display: flex; gap: 10px; align-items: flex-start; }
    .welcome-avatar { font-size: 24px; flex-shrink: 0; margin-top: 4px; }
    .welcome-bubble {
      background: #fff;
      border-radius: 4px 12px 12px 12px;
      padding: 12px 14px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      max-width: 290px;
    }
    .welcome-bubble p { margin: 0 0 6px; font-size: 13px; color: #374151; line-height: 1.5; }
    .quick-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .chip {
      background: #EFF6FF;
      color: #2563EB;
      border: 1px solid #BFDBFE;
      border-radius: 20px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;
      white-space: nowrap;
    }
    .chip:hover { background: #DBEAFE; }

    /* Mensajes */
    .msg-row { display: flex; gap: 8px; align-items: flex-end; }
    .user-row { flex-direction: row-reverse; }
    .msg-avatar { font-size: 18px; flex-shrink: 0; margin-bottom: 4px; }
    .bot-msg-avatar { }
    .msg-bubble {
      max-width: 270px;
      padding: 10px 13px;
      border-radius: 12px;
      position: relative;
    }
    .bot-bubble {
      background: #fff;
      border-radius: 4px 12px 12px 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .user-bubble {
      background: linear-gradient(135deg, #0D6E6E, #0A5555);
      color: #fff;
      border-radius: 12px 4px 12px 12px;
    }
    .msg-content { font-size: 13px; line-height: 1.55; color: #374151; }
    .user-bubble .msg-content { color: #fff; }
    .msg-content strong { font-weight: 600; }
    .msg-content ul { margin: 4px 0 4px 16px; padding: 0; }
    .msg-content li { margin: 2px 0; }
    .msg-time { font-size: 10px; color: #9CA3AF; margin-top: 4px; text-align: right; }
    .user-bubble .msg-time { color: rgba(255,255,255,0.6); }

    /* Typing */
    .typing-bubble { padding: 12px 16px; }
    .typing-bubble span {
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #9CA3AF;
      margin: 0 2px;
      animation: bounce 1.2s infinite;
    }
    .typing-bubble span:nth-child(2) { animation-delay: 0.2s; }
    .typing-bubble span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }

    .error-msg {
      background: #FEF2F2;
      color: #DC2626;
      font-size: 12px;
      padding: 8px 12px;
      border-radius: 8px;
      border-left: 3px solid #EF4444;
    }

    /* Input */
    .chat-input-area {
      padding: 12px 14px 10px;
      background: #fff;
      border-top: 1px solid #F0F0F0;
      flex-shrink: 0;
    }
    .input-row { display: flex; gap: 8px; align-items: flex-end; }
    .chat-input {
      flex: 1;
      padding: 9px 12px;
      border: 1.5px solid #E5E7EB;
      border-radius: 10px;
      font-size: 13px;
      font-family: inherit;
      resize: none;
      outline: none;
      max-height: 100px;
      overflow-y: auto;
      line-height: 1.5;
      transition: border-color 0.15s;
    }
    .chat-input:focus { border-color: #0D6E6E; }
    .chat-input:disabled { background: #F9FAFB; }
    .send-btn {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: #0D6E6E;
      border: none;
      cursor: pointer;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s;
    }
    .send-btn:hover:not(:disabled) { background: #0A5555; }
    .send-btn:disabled { background: #D1D5DB; cursor: not-allowed; }
    .input-hint { font-size: 10px; color: #9CA3AF; margin: 6px 0 0; text-align: center; }
  `]
})
export class ChatWidgetComponent implements AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('inputEl') private inputEl!: ElementRef;

  private readonly http   = inject(HttpClient);
  private readonly dr     = inject(DestroyRef);

  isOpen       = signal(false);
  isMinimized  = signal(false);
  loading      = signal(false);
  error        = signal('');
  unreadCount  = signal(0);
  messages     = signal<Message[]>([]);
  inputText    = '';
  private shouldScroll = false;

  quickChips = [
    '¿Qué citas hay hoy?',
    '¿Cuánto hay pendiente de cobro?',
    '¿Cuáles son los pacientes recientes?',
    '¿Cómo creo una factura?',
    'Muéstrame las próximas citas',
  ];

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  open() {
    this.isOpen.set(true);
    this.isMinimized.set(false);
    this.unreadCount.set(0);
    setTimeout(() => this.inputEl?.nativeElement?.focus(), 100);
  }

  close() { this.isOpen.set(false); }

  toggleMinimize() { this.isMinimized.update(v => !v); }

  clearChat() { this.messages.set([]); this.error.set(''); }

  onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }

  sendQuick(text: string) {
    this.inputText = text;
    this.send();
  }

  send() {
    const text = this.inputText.trim();
    if (!text || this.loading()) return;

    this.inputText = '';
    this.error.set('');

    const userMsg: Message = { role: 'user', content: text, timestamp: new Date() };
    this.messages.update(msgs => [...msgs, userMsg]);
    this.shouldScroll = true;
    this.loading.set(true);

    // Historial para el backend (sin timestamps)
    const history = this.messages().slice(0, -1).map(m => ({
      role: m.role,
      content: m.content,
    }));

    this.http.post<{ reply: string }>(`${API}/chat`, {
      message: text,
      history,
    }).pipe(
      takeUntilDestroyed(this.dr),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: res => {
        const botMsg: Message = { role: 'assistant', content: res.reply, timestamp: new Date() };
        this.messages.update(msgs => [...msgs, botMsg]);
        this.shouldScroll = true;
        if (!this.isOpen() || this.isMinimized()) {
          this.unreadCount.update(n => n + 1);
        }
      },
      error: err => {
        this.error.set('Error al conectar con el asistente. Intenta de nuevo.');
      }
    });
  }

  formatMessage(content: string): string {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n- (.*)/g, '<br>• $1')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
  }

  formatTime(d: Date): string {
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  private scrollToBottom() {
    try {
      const el = this.messagesContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }
}