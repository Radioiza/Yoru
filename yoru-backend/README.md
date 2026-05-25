# Yoru Backend

Arquitectura de microservicios para Yoru. Cada servicio tiene su propia BD PostgreSQL.

## Stack

- **Node.js 20+** con Fastify
- **Prisma** como ORM y migrador
- **PostgreSQL 16** (una BD por servicio)
- **RabbitMQ** para eventos asíncronos
- **MinIO** (S3-compatible) para documentos KYC

## Servicios y puertos

| Servicio | Puerto API | Puerto BD |
|---|---|---|
| auth-service | 3001 | 5433 |
| pki-service | 3002 | 5434 |
| kyc-service | 3003 | 5435 |
| telecom-service | 3004 | 5436 |
| notification-service | 3005 | — |
| RabbitMQ UI | 15672 | — |
| MinIO UI | 9001 | — |

## Levantar el entorno

### 1. Requisitos

- Docker Desktop corriendo
- Node.js 20 o superior

### 2. Levantar infraestructura

```powershell
cd C:\Users\carlo\OneDrive\Escritorio\index_tuto\yoru-backend
docker compose up -d
```

Verifica que todo esté arriba:

```powershell
docker compose ps
```

### 3. Levantar cada microservicio

Cada servicio se levanta igual: en una terminal nueva, entras a su carpeta, instalas dependencias, corres la migración y arrancas. Se pueden tener los 4 corriendo en paralelo (cada uno en su propia PowerShell).

**Auth Service** (puerto 3001):
```powershell
cd services\auth-service
npm install
npx prisma migrate dev --name init
npm run dev
```

**PKI Service** (puerto 3002):
```powershell
cd services\pki-service
npm install
npx prisma migrate dev --name init
npm run dev
```

**KYC Service** (puerto 3003):
```powershell
cd services\kyc-service
npm install
npx prisma migrate dev --name init
npm run dev
```

**Telecom Service** (puerto 3004):
```powershell
cd services\telecom-service
npm install
npx prisma migrate dev --name init
npm run dev
```

## Primera petición

Healthcheck:

```powershell
curl http://localhost:3001/health
```

Registrar un usuario:

```powershell
curl -X POST http://localhost:3001/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{\"telefono\":\"5512345678\",\"curp\":\"GOMC900101HDFXXX01\"}'
```

Respuesta esperada (201):

```json
{
  "ok": true,
  "user": {
    "id": "uuid-…",
    "telefono": "5512345678",
    "curp": "GOMC900101HDFXXX01",
    "estado": "pendiente",
    "createdAt": "2026-…"
  }
}
```

## Conectar el frontend React

En `registro/registro/src/App.jsx`, cambiar `irABiometria` para que haga `fetch`:

```js
const irABiometria = async () => {
  // … validaciones locales primero …
  const r = await fetch('http://localhost:3001/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telefono, curp }),
  });
  const data = await r.json();
  if (!data.ok) {
    setErroresForm(data.errores ?? {});
    return;
  }
  // guardar data.user.id en estado y pasar a 'biometria'
};
```

CORS ya está habilitado para `http://localhost:5173`.

## Estructura

```
yoru-backend/
├── docker-compose.yml
└── services/
    ├── auth-service/          ← LISTO
    ├── pki-service/           ← LISTO
    ├── kyc-service/           ← LISTO
    ├── telecom-service/       ← LISTO (con consumers de eventos)
    └── notification-service/  ← LISTO (sin BD, consume todos los eventos)
```

## Endpoints disponibles

### auth-service (3001)
- `POST /api/auth/register` — crear usuario
- `GET  /api/auth/users/:id` — consultar
- `POST /api/auth/challenge` — generar nonce para firmar

### pki-service (3002)
- `POST /api/pki/keys` — registrar llave pública
- `GET  /api/pki/keys/:userId` — consultar llave activa
- `POST /api/pki/verify` — verificar firma ECDSA P-256
- `POST /api/pki/keys/:id/revoke` — revocar llave

### kyc-service (3003)
- `POST /api/kyc/requests` — crear solicitud (referencias S3)
- `GET  /api/kyc/requests/:userId` — consultar estado
- `POST /api/kyc/requests/:userId/approve` — aprobar (publica `kyc.completed`)
- `POST /api/kyc/requests/:userId/reject` — rechazar

### telecom-service (3004)
- `POST /api/telecom/lineas` — vincular línea a usuario
- `GET  /api/telecom/lineas/:telefono` — consultar con historial
- `POST /api/telecom/lineas/:telefono/kill-switch` — bloquear manualmente
- `POST /api/telecom/lineas/:telefono/unblock` — desbloquear
- **Consume:** `kyc.completed` (activa) y `pki.new_key_attempt` (kill switch automático)

### notification-service (3005)
- `GET /health` — status + número de notificaciones procesadas
- `GET /notifications?canal=email&severidad=critical&limit=20` — historial en memoria
- **Consume:** TODOS los eventos del exchange `yoru.events` (`#` wildcard)
- Formatea cada evento con su plantilla y lo imprime estilo correo

## Eventos publicados

| Routing key | Servicio | Cuándo |
|---|---|---|
| `auth.user_created` | auth-service | Tras crear un usuario |
| `kyc.completed` | kyc-service | Validación INE/Selfie terminada |
| `pki.new_key_attempt` | pki-service | Cliente intenta registrar nueva llave |
| `auth.failed_attempt` | auth-service | Intento de firma inválido |

Exchange: `yoru.events` (topic, durable).

## Troubleshooting

- **`prisma migrate dev` falla**: verifica que `auth-db` esté arriba y el puerto 5433 libre.
- **`broker offline` en logs**: RabbitMQ aún arrancando. El servicio funciona, solo no publica eventos. Reinicia el servicio cuando RabbitMQ esté listo.
- **Puerto 3001 ocupado**: cambia `PORT` en `.env`.
