# 🦷 DentiaPro VX-1002

**AI-powered Dental Clinic Management Platform**  
Built by [Vertex Coders LLC](https://vertexcoders.com) · Miami, FL

[![Angular](https://img.shields.io/badge/Angular-19-DD0031?logo=angular)](https://angular.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://postgresql.org)
[![Claude AI](https://img.shields.io/badge/Claude-AI-D4A27F?logo=anthropic)](https://anthropic.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://docker.com)

---

## 📸 Screenshots

> Dashboard · Gestión de Pacientes · Historia Clínica · Análisis IA de Rayos X · DentyAI Chatbot

---

## ✨ Features

| Módulo | Descripción |
|--------|-------------|
| 🏠 **Dashboard** | KPIs en tiempo real — pacientes, citas, facturación |
| 👥 **Pacientes** | CRUD completo con historial médico, alergias, seguros |
| 📋 **Historia Clínica** | Timeline de entradas clínicas por paciente |
| 📅 **Citas** | Agenda con estados y filtros por doctor |
| 🔬 **Rayos X + IA** | Análisis automático con Claude Vision — hallazgos, diagnóstico, recomendaciones |
| 💰 **Facturación** | Facturas, pagos parciales, PDF, resumen financiero |
| 👤 **Usuarios** | Roles: Admin, Doctor, Recepcionista — CRUD completo |
| 🤖 **DentyAI** | Chatbot flotante con acceso a DB en tiempo real |

---

## 🏗️ Stack

### Frontend
- **Angular 19** — Standalone components, Signals, inject()-based DI
- **TypeScript** — tipado estricto end-to-end
- Functional interceptors · Lazy loading · PWA-ready

### Backend
- **FastAPI** — async, auto-docs en `/docs`
- **SQLAlchemy 2.0** — async ORM con Alembic migrations
- **PostgreSQL 16** — base de datos principal
- **Redis + Celery** — tareas asíncronas (procesamiento de imágenes)
- **JWT** — autenticación con access + refresh tokens

### IA
- **Claude claude-sonnet-4-6** — análisis de radiografías dentales (Vision)
- **Claude Haiku 4.5** — DentyAI chatbot con contexto de DB en tiempo real
- **Cloudinary** — almacenamiento seguro de imágenes

### DevOps
- **Docker Compose** — orquestación completa del stack
- **Flower** — monitoreo de workers Celery

---

## 🚀 Quick Start

### Prerequisitos
- Docker Desktop instalado
- Git

### 1. Clonar el repositorio
```bash
git clone https://github.com/TU_USUARIO/dentiapro.git
cd dentiapro
```

### 2. Configurar variables de entorno
```bash
cp backend/.env.example backend/.env
```

Edita `backend/.env` con tus credenciales:
```env
SECRET_KEY=genera_uno_con_openssl_rand_hex_32
DATABASE_URL=postgresql+asyncpg://dentiapro_user:dentiapro_pass@db:5432/dentiapro_db
DATABASE_URL_SYNC=postgresql://dentiapro_user:dentiapro_pass@db:5432/dentiapro_db
ANTHROPIC_API_KEY=sk-ant-...
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
ALLOWED_ORIGINS=http://localhost:4200
```

### 3. Levantar con Docker
```bash
docker-compose up --build -d
```

### 4. Inicializar la base de datos
```bash
# Crear tablas
docker exec dentiapro_api alembic upgrade head

# Poblar con datos de demo
docker exec dentiapro_api python seed.py
```

### 5. Levantar el frontend
```bash
cd frontend
npm install
npm start
```

Abre [http://localhost:4200](http://localhost:4200)

### 🔑 Credenciales de demo
| Rol | Email | Password |
|-----|-------|----------|
| Administrador | admin@dentiapro.com | Admin123 |
| Doctor | dr.garcia@dentiapro.com | Doctor123 |
| Doctor | dr.martinez@dentiapro.com | Doctor123 |
| Recepcionista | recepcion@dentiapro.com | Recep123 |

---

## 📁 Estructura del Proyecto

```
dentiapro/
├── frontend/                    # Angular 19
│   └── src/app/
│       ├── core/                # Guards, interceptors, services
│       ├── features/            # Módulos de la aplicación
│       │   ├── dashboard/
│       │   ├── patients/
│       │   ├── historia-clinica/
│       │   ├── facturacion/
│       │   ├── usuarios/
│       │   ├── appointments/
│       │   └── xray/
│       ├── shared/
│       │   └── chat-widget/     # DentyAI chatbot
│       └── layout/
│
├── backend/                     # FastAPI
│   └── app/
│       ├── api/v1/endpoints/    # Routers
│       │   ├── auth.py
│       │   ├── patients.py
│       │   ├── clinical_history.py
│       │   ├── invoices.py
│       │   ├── users.py
│       │   ├── xray.py          # Claude Vision
│       │   └── chat.py          # DentyAI
│       ├── models/              # SQLAlchemy models
│       ├── schemas/             # Pydantic schemas
│       ├── core/                # Config, security, dependencies
│       └── db/                  # Session, migrations
│
├── xray-ai-service/             # Microservicio IA (PyTorch)
├── seed.py                      # Script de datos demo
├── reset_db.py                  # Reset de base de datos
└── docker-compose.yml
```

---

## 🔌 API Reference

La documentación completa de la API está disponible en:
- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

### Endpoints principales

```
POST   /api/v1/auth/login              # Login
GET    /api/v1/auth/me                 # Usuario actual

GET    /api/v1/patients                # Listar pacientes
POST   /api/v1/patients                # Crear paciente
GET    /api/v1/patients/search         # Búsqueda rápida
GET    /api/v1/patients/{id}           # Detalle paciente

GET    /api/v1/clinical-history/patient/{id}   # Historia clínica
POST   /api/v1/clinical-history                # Nueva entrada

GET    /api/v1/invoices                # Listar facturas
GET    /api/v1/invoices/summary        # KPIs facturación
POST   /api/v1/invoices                # Nueva factura
POST   /api/v1/invoices/{id}/pay       # Registrar pago

POST   /api/v1/xray/upload             # Subir + analizar rayos X
GET    /api/v1/xray/patient/{id}       # Rayos X por paciente

POST   /api/v1/chat                    # DentyAI chatbot

GET    /api/v1/users                   # Listar usuarios (admin)
POST   /api/v1/users                   # Crear usuario (admin)
```

---

## 🤖 DentyAI — Chatbot Inteligente

DentyAI es un asistente virtual con acceso en tiempo real a la base de datos de la clínica. Usa **Claude Haiku** para respuestas rápidas y económicas.

**Capacidades:**
- Consultar citas del día y próximas
- Verificar facturas pendientes de cobro
- Buscar información de pacientes
- Guiar al usuario en el uso del sistema
- Resumen financiero en tiempo real

El contexto se actualiza en cada request — nunca trabaja con datos desactualizados.

---

## 🔬 Análisis de Rayos X con IA

El módulo de Rayos X usa **Claude claude-sonnet-4-6 Vision** para análisis clínico automático:

1. El usuario sube una radiografía (JPEG/PNG/WebP)
2. La imagen se almacena en Cloudinary
3. Claude Vision analiza la imagen con un prompt especializado en odontología
4. Se devuelven: hallazgos, diagnóstico preliminar, recomendaciones y nivel de confianza
5. El doctor puede revisar y confirmar el diagnóstico

---

## 🗄️ Roles y Permisos

| Rol | Acceso |
|-----|--------|
| `admin` | Acceso total + gestión de usuarios |
| `doctor` | Historia clínica, rayos X, citas propias |
| `receptionist` | Pacientes, citas, facturación básica |
| `patient` | Solo lectura de su propio historial |

---

## 🚀 Deployment

### Opción recomendada (gratis para demo)

```
Frontend  →  Netlify (gratis)
Backend   →  Railway ($5 créditos/mes)
Storage   →  Cloudinary (gratis)
IA        →  Anthropic API (pay-per-use)
```

### Build de producción

```bash
# Frontend
cd frontend
ng build --configuration production
# Subir /dist/browser a Netlify

# Backend — Railway detecta el Dockerfile automáticamente
# Configura las variables de entorno en el dashboard de Railway
```

---

## 🛠️ Desarrollo

### Correr tests
```bash
cd backend
pytest app/tests/ -v
```

### Migraciones de base de datos
```bash
# Crear nueva migración
docker exec dentiapro_api alembic revision --autogenerate -m "descripcion"

# Aplicar migraciones
docker exec dentiapro_api alembic upgrade head
```

### Monitoreo de workers
Flower está disponible en [http://localhost:5555](http://localhost:5555)

---

## 📄 Licencia

Copyright © 2026 [Vertex Coders LLC](https://vertexcoders.com). Todos los derechos reservados.

Este software es propietario. No está permitida su reproducción, distribución o uso sin autorización expresa de Vertex Coders LLC.

---

## 👨‍💻 Autor

**Denis** — Founder & CEO, Vertex Coders LLC  
🌐 [vertexcoders.com](https://vertexcoders.com)  
📧 contact@vertexcoders.com

---

<div align="center">
  <sub>Built with ❤️ in Miami by Vertex Coders LLC</sub>
</div>