# YORU

Sistema de identidad digital para usuarios de telefonía móvil, basado en criptografía ECDSA P-256 y arquitectura de microservicios.

## ¿Qué hace?

Vincula tu línea telefónica a tu identidad oficial (CURP + INE + selfie) usando una llave criptográfica que solo vive en tu dispositivo. Si alguien intenta usar tu cuenta desde otro lado, el sistema lo detecta y bloquea la línea automáticamente.

## Arquitectura

- **5 microservicios** (Node.js + Fastify):
  - `auth-service` — registro y sesiones (JWT)
  - `pki-service` — llaves públicas y verificación de firmas
  - `kyc-service` — validación de INE + selfie
  - `telecom-service` — gestión de líneas y kill switch
  - `notification-service` — consumidor de eventos del bus
- **4 PostgreSQL** (una BD por servicio)
- **RabbitMQ** como bus de eventos asíncronos
- **MinIO** (S3-compatible) para documentos KYC
- **Frontend** React + Vite + Tailwind CSS

## Arrancar todo

Requisitos: Docker Desktop, Node.js 20+, Python 3.8+.

### Forma rápida (un comando)

```powershell
python iniciar.py
```

O doble-click a `Iniciar Yoru.bat` en Windows.

El navegador se abre solo en `http://localhost:5173`.

### Para detener

```powershell
python iniciar.py --stop
```

## Documentación

- [`INSTRUCCIONES.txt`](INSTRUCCIONES.txt) — pasos detallados para levantar todo
- [`COMO_FUNCIONA.txt`](COMO_FUNCIONA.txt) — explicación pedagógica del sistema, tecnologías y flujos
- [`ARQUITECTURA.txt`](ARQUITECTURA.txt) — diagrama de componentes y endpoints
- [`GUION_DEMO.txt`](GUION_DEMO.txt) — script para presentación en vivo

## Estructura

```
.
├── yoru-backend/
│   ├── docker-compose.yml
│   └── services/
│       ├── auth-service/
│       ├── pki-service/
│       ├── kyc-service/
│       ├── telecom-service/
│       └── notification-service/
├── registro/registro/        # frontend React
├── iniciar.py                # launcher automático
├── Iniciar Yoru.bat
├── Detener Yoru.bat
└── *.txt                     # documentación
```

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS v4, Web Crypto API |
| Backend | Node.js 20, Fastify, Prisma ORM, amqplib, jsonwebtoken |
| Bases de datos | PostgreSQL 16 (x4) |
| Broker | RabbitMQ 3 |
| Storage | MinIO (S3-compatible) |
| Criptografía | ECDSA P-256, SHA-256, JWT HS256 |
| Infra | Docker Compose |

## Notas

Proyecto académico. Las llaves y secretos en los `.env` son valores de demo.
En producción se reemplazan por valores reales gestionados por un secret manager.
