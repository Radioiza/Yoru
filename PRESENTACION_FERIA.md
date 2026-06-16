# YORU — Guion para la Feria de Proyectos

> Audiencia: maestros de **matemáticas**, **criptografía** y **programación**.
> Este documento es tu guion + banco de preguntas y respuestas. Todo el contenido
> está basado en el código real del proyecto (rutas de archivos incluidas).

---

## ÍNDICE DE DIAPOSITIVAS

1. Portada
2. El problema
3. La solución en una frase
4. Qué hace Yoru (demo)
5. Arquitectura de microservicios
6. ¿Por qué criptografía de llave pública y no solo contraseñas?
7. ECDSA y la curva P-256 (las matemáticas)
8. Fase 1 — Generación de llaves (código)
9. Fase 2 — Firma digital (código)
10. Fase 3 — Verificación (código)
11. Reto–respuesta: el nonce anti-replay
12. La llave privada nunca sale del dispositivo
13. Contraseñas: scrypt + salt + comparación en tiempo constante
14. Sesiones con JWT (HS256)
15. Kill switch automático (arquitectura orientada a eventos)
16. Resumen de seguridad
17. Limitaciones y trabajo futuro
18. Cierre + preguntas

---

## DIAPOSITIVA 1 — PORTADA

**YORU**
Identidad digital para líneas telefónicas, protegida con criptografía de curva elíptica.

- Subtítulo: "Tu línea, vinculada a ti con matemáticas, no con papeleo."
- Equipo / Feria de proyectos / Fecha.

**Notas para hablar:** Preséntate, di en una frase qué resuelve: evitar el robo de identidad
en la contratación de líneas móviles usando una firma criptográfica que solo tú controlas.

---

## DIAPOSITIVA 2 — EL PROBLEMA

- En México, al comprar un chip, **no se valida rigurosamente** la identidad del dueño.
- Esto facilita el **robo de identidad** y el **secuestro de SMS** (SIM swapping) para
  entrar a cuentas bancarias y apps que usan el SMS como segundo factor.
- Una vez que un atacante "clona" tu línea, recibe tus códigos y toma tus cuentas.

**Dato para defender:** el SMS sigue siendo el segundo factor más usado, y a la vez el más
vulnerable cuando la portabilidad/activación no verifica al titular.

---

## DIAPOSITIVA 3 — LA SOLUCIÓN EN UNA FRASE

> "Tu cuenta usa correo + contraseña como cualquier otra. Tu archivo **.pem** es tu
> salvavidas criptográfico: le demuestra al sistema, con matemáticas, que eres tú —
> sin pasar por un humano. Si alguien intenta clonar tu identidad, lo detectamos y
> bloqueamos tu línea automáticamente."

---

## DIAPOSITIVA 4 — QUÉ HACE YORU (DEMO)

Flujo del usuario:
1. **Registro**: teléfono + CURP + INE (PDF) + selfie + correo + contraseña.
2. Se **genera un par de llaves ECDSA P-256 en el navegador**; se descarga un `.pem`.
3. **Verificación por correo** (código de 5 dígitos) → recién ahí se crea la cuenta.
4. **Login** normal con correo + contraseña.
5. **Panel**: ver líneas, "Reportar robo" (kill switch), agregar otra línea (SMS + `.pem`).
6. **Recuperación** si olvidas la contraseña: subes tu `.pem` y firmas un reto.

**Sugerencia:** ten la app corriendo en vivo (`python iniciar.py`) por si piden demo.

---

## DIAPOSITIVA 5 — ARQUITECTURA DE MICROSERVICIOS

5 microservicios (Node.js + Fastify), 1 base de datos por servicio:

| Servicio | Puerto | Responsabilidad |
|---|---|---|
| auth-service | 3001 | cuentas, login, JWT, retos, recuperación |
| pki-service | 3002 | llaves **públicas** y verificación de firmas ECDSA |
| kyc-service | 3003 | INE + selfie (presigned URLs a MinIO) |
| telecom-service | 3004 | líneas y kill switch |
| notification-service | 3005 | correos y SMS (consume eventos) |

- **RabbitMQ** = bus de eventos (exchange `yoru.events`, tipo topic, durable).
- **MinIO** = almacén S3-compatible para PDFs y selfies.
- **4× PostgreSQL** (database-per-service: aíslan los datos y obligan a comunicarse por API/eventos).

**Por qué microservicios:** separación de responsabilidades; el servicio que guarda las
llaves (PKI) está aislado del que guarda las cuentas (auth). Aunque comprometieran uno,
no se llevan todo.

---

## DIAPOSITIVA 6 — ¿POR QUÉ LLAVE PÚBLICA Y NO SOLO CONTRASEÑAS?

- Una contraseña es un **secreto compartido**: el servidor también la conoce (su hash).
  Si roban la base de datos, el atacante puede atacar todos los hashes.
- En criptografía **asimétrica**, el servidor solo guarda la **llave pública**. Con ella
  **puede verificar** firmas pero **no puede firmar** ni deducir la privada.
- La **llave privada** (lo que te identifica de verdad) **nunca llega al servidor**: vive
  solo en tu archivo `.pem`.
- Resultado: el robo de la base de datos del servidor **no permite suplantarte**.

> Yoru usa contraseña para el día a día (cómodo) y la firma ECDSA para lo crítico
> (recuperación de cuenta y autorización de nuevas líneas).

---

## DIAPOSITIVA 7 — ECDSA Y LA CURVA P-256 (LAS MATEMÁTICAS)

**ECDSA** = Elliptic Curve Digital Signature Algorithm.

- Curva **P-256** (también llamada secp256r1 / prime256r1), ecuación de Weierstrass:
  `y² = x³ - 3x + b  (mod p)`
  con `p = 2²⁵⁶ − 2²²⁴ + 2¹⁹² + 2⁹⁶ − 1` (un primo de 256 bits).
- Los puntos de la curva forman un **grupo cíclico** de orden primo `n`, con un punto
  generador `G`.
- **Operación base:** "multiplicación escalar" `k·G` = sumar `G` consigo mismo `k` veces
  (con la suma de puntos de la curva).

**Seguridad — el problema difícil (ECDLP):**
Dado `Q = d·G`, recuperar `d` (el "logaritmo discreto en la curva elíptica") es
computacionalmente inviable. No se conoce algoritmo eficiente.

- P-256 ofrece ~**128 bits de seguridad** con llaves de solo 256 bits.
- Equivale a RSA de ~3072 bits → llaves mucho más pequeñas y firmas más rápidas.
  Por eso es la que usa el navegador (Web Crypto API) de forma nativa.

---

## DIAPOSITIVA 8 — FASE 1: GENERACIÓN DE LLAVES (CÓDIGO)

`registro/registro/src/screens/Generacion.jsx`

```js
// 3) Generar par ECDSA P-256 (en el navegador, con Web Crypto API).
const keyPair = await window.crypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,                 // exportable: para poder guardarlo en el .pem
  ['sign', 'verify'],
);
const publicKeyPem  = await publicKeyToPem(keyPair.publicKey);   // SPKI
const privateKeyPem = await privateKeyToPem(keyPair.privateKey); // PKCS8
```

**Matemática detrás:** se elige `d` aleatorio en `[1, n−1]` (la llave privada) y se calcula
`Q = d·G` (la llave pública). El navegador hace esto por nosotros.

**Formato:** la pública se exporta en **SPKI** y la privada en **PKCS8**, ambas en base64
dentro de bloques PEM. Solo la **pública** se envía al servidor (`pki-service`).

---

## DIAPOSITIVA 9 — FASE 2: FIRMA DIGITAL (CÓDIGO)

`registro/registro/src/api.js`

```js
export async function signWithPrivateKey(privateKey, payload) {
  const dataBytes = new TextEncoder().encode(payload);   // el "reto" (nonce)
  const sigBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },                  // hash + firma
    privateKey,
    dataBytes,
  );
  return btoa(String.fromCharCode(...new Uint8Array(sigBuffer))); // base64
}
```

**Matemática detrás (firmar el mensaje `m`):**
1. `e = SHA-256(m)`
2. Elegir `k` aleatorio en `[1, n−1]`
3. `(x₁, y₁) = k·G`  →  `r = x₁ mod n`
4. `s = k⁻¹ (e + r·d) mod n`
5. La firma es el par **`(r, s)`** (formato IEEE P1363 / "raw", 64 bytes).

**Punto fino que pueden preguntar:** `k` debe ser **único y secreto** en cada firma; si se
repite o se filtra, se puede despejar `d`. Web Crypto lo genera de forma segura por nosotros.

---

## DIAPOSITIVA 10 — FASE 3: VERIFICACIÓN (CÓDIGO)

`yoru-backend/services/pki-service/src/routes/pki.js`

```js
const publicKey = await importPublicKeyPem(key.publicKeyPem); // SPKI -> CryptoKey
const sigBytes  = Buffer.from(signatureB64, 'base64');
const dataBytes = new TextEncoder().encode(payload);

valida = await crypto.subtle.verify(
  { name: 'ECDSA', hash: 'SHA-256' },
  publicKey, sigBytes, dataBytes
);
```

**Matemática detrás (verificar `(r, s)` sobre `m` con la pública `Q`):**
1. `e = SHA-256(m)`
2. `w = s⁻¹ mod n`
3. `u₁ = e·w mod n`,  `u₂ = r·w mod n`
4. `(x₁, y₁) = u₁·G + u₂·Q`
5. La firma es **válida** si `r ≡ x₁ (mod n)`.

El servidor **solo necesita la llave pública** para esto. Además registra cada verificación
(`Signature`: hash del payload + resultado) como **bitácora de auditoría**.

---

## DIAPOSITIVA 11 — RETO–RESPUESTA: EL NONCE ANTI-REPLAY

`yoru-backend/services/auth-service/src/routes/auth.js`

```js
const nonce = crypto.randomUUID() + '.' + Date.now();
const expiresAt = new Date(Date.now() + 5 * 60 * 1000);   // 5 minutos
await prisma.challenge.create({
  data: { userId, nonce, proposito: 'recovery', expiresAt },
});
```

- El servidor manda un **reto único** (nonce). El cliente lo **firma** con su llave privada.
- El servidor verifica la firma contra la llave pública.
- El reto es de **un solo uso** (`usado: true`) y **expira en 5 min** → previene **replay**
  (un atacante no puede reusar una firma capturada).
- `proposito` distingue el uso: `recovery` (recuperación) o `add_line` (nueva línea).

**Esto es lo importante:** nunca se transmite la llave privada ni un secreto reutilizable;
solo una firma de un reto que sirve una sola vez.

---

## DIAPOSITIVA 12 — LA LLAVE PRIVADA NUNCA SALE DEL DISPOSITIVO

`registro/registro/src/api.js`

```js
export async function importPrivateKeyFromPem(pem) {
  const der = pemToDer(pem, 'PRIVATE KEY');
  return crypto.subtle.importKey(
    'pkcs8', der,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,            // extractable:false -> no se puede volver a exportar
    ['sign'],         // solo permiso para FIRMAR
  );
}
```

- Al cargar el `.pem`, la privada se re-importa como **no exportable** y solo con permiso de
  **firmar**. Ni siquiera el código de la página puede volver a leerla en claro.
- El `.pem` tiene 3 bloques: `YORU IDENTITY` (metadata), `PUBLIC KEY`, `PRIVATE KEY`.
- La privada **nunca** se sube; viaja por la red solo la firma. Esto cambia la categoría de
  ataques: "rompo el servidor y me llevo las llaves" deja de existir.

---

## DIAPOSITIVA 13 — CONTRASEÑAS: scrypt + SALT + TIEMPO CONSTANTE

`yoru-backend/services/auth-service/src/password.js`

```js
export function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');         // salt único
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(plain, hash, salt) {
  const test   = crypto.scryptSync(plain, salt, 64);
  const stored = Buffer.from(hash, 'hex');
  return crypto.timingSafeEqual(stored, test);   // comparación en tiempo constante
}
```

- **scrypt** es una función de derivación de clave **lenta y con uso intensivo de memoria**:
  encarece el ataque por fuerza bruta / GPU.
- **Salt aleatorio** por usuario: dos personas con la misma contraseña tienen hashes distintos
  (mata las "rainbow tables").
- **`timingSafeEqual`**: compara sin filtrar información por el **tiempo** de comparación
  (evita ataques de canal lateral por temporización).
- Regla de contraseña: 8+ caracteres, 1 mayúscula, 2 números, 1 carácter especial
  (validada en frontend y backend; el backend es la fuente de verdad).

---

## DIAPOSITIVA 14 — SESIONES CON JWT (HS256)

`yoru-backend/services/auth-service/src/jwt.js`

```js
const SECRET = process.env.JWT_SECRET ?? 'yoru-demo-secret-...';
export function signJwt(claims) {
  return jwt.sign(claims, SECRET, { issuer: 'yoru-auth', expiresIn: '1h' });
}
export function verifyJwt(token) {
  return jwt.verify(token, SECRET, { issuer: 'yoru-auth' });
}
```

- Tras login, el servidor emite un **JWT** firmado con **HS256** (HMAC-SHA256), válido **1 h**.
- Cada microservicio verifica el token con el secreto compartido, **sin** consultar a auth
  (stateless) → escala bien.
- Autorización por dueño: además de validar el token, se comprueba que el `userId` del token
  sea el dueño del recurso (de ahí los **403** al intentar bloquear una línea ajena).

---

## DIAPOSITIVA 15 — KILL SWITCH AUTOMÁTICO (ORIENTADO A EVENTOS)

`yoru-backend/services/pki-service/src/routes/pki.js`

```js
const llaveActiva = await prisma.publicKey.findFirst({
  where: { userId, revocada: false, committed: true },
});
if (llaveActiva) {
  // Ya hay una llave activa: intento de registrar OTRA = sospechoso.
  publishEvent('pki.new_key_attempt', { userId, previousKeyId: llaveActiva.id, ip: request.ip });
}
```

- Si alguien intenta registrar una **segunda llave** mientras hay una activa, PKI publica
  `pki.new_key_attempt`.
- `telecom-service` **consume** ese evento y **bloquea la línea automáticamente** (kill switch),
  y `notification-service` avisa al usuario.
- Es **reactivo y desacoplado**: PKI no sabe quién escucha; solo anuncia el hecho. Se pueden
  añadir más reacciones (analítica, auditoría) sin tocar al productor.

---

## DIAPOSITIVA 16 — RESUMEN DE SEGURIDAD

- Llave privada **client-side**, no exportable, nunca viaja.
- Reto–respuesta con **nonce de un solo uso** (anti-replay), expira en 5 min.
- Firmas **ECDSA P-256** verificadas server-side; **bitácora** de cada verificación.
- Contraseñas con **scrypt + salt**, comparación en **tiempo constante**.
- **JWT** HS256, 1 h, con **autorización por dueño** (authn ≠ authz).
- **Kill switch** automático ante intento de clonar la identidad.
- CORS restringido; **database-per-service**; comunicación por **eventos**.

---

## DIAPOSITIVA 17 — LIMITACIONES Y TRABAJO FUTURO (honestidad = puntos)

- KYC se **auto-aprueba** en demo (sin matching facial real → Onfido/Veriff en producción).
- Sin **API Gateway** ni **rate limiting** global.
- JWT no se revocan (faltarían refresh tokens + blacklist en Redis).
- Secretos en `.env` son de **demo** (irían a un secret manager).
- Sin tests automatizados ni observabilidad centralizada (métricas/trazas).
- **WebAuthn / passkeys** sería el siguiente paso para desbloquear la llave con biometría
  del dispositivo (TouchID, Windows Hello).

---

## DIAPOSITIVA 18 — CIERRE

- Yoru vincula una línea a una persona con **matemáticas verificables**, no con confianza.
- La privada nunca sale de tu dispositivo; el servidor solo verifica.
- Detección automática de clonación.

**Gracias — ¿Preguntas?**

---

# BANCO DE PREGUNTAS Y RESPUESTAS

## Para el maestro de MATEMÁTICAS

**P: ¿Qué es exactamente una curva elíptica y por qué sirve para esto?**
R: Es el conjunto de puntos `(x, y)` que cumplen `y² = x³ − 3x + b` sobre un campo finito
`F_p` (aritmética módulo un primo `p`). Con una "suma de puntos" geométrica, los puntos
forman un grupo. La seguridad viene de que multiplicar `d·G` es fácil, pero invertirlo
(hallar `d`) es inviable: ese es el problema del logaritmo discreto elíptico (ECDLP).

**P: ¿Por qué 256 bits bastan si RSA necesita miles?**
R: Los mejores ataques contra ECDLP son de orden `√n` (≈ raíz cuadrada del tamaño del grupo),
así que 256 bits dan ~128 bits de seguridad. RSA depende de factorización, que tiene
algoritmos sub-exponenciales mejores, por eso necesita ~3072 bits para la misma seguridad.

**P: ¿Qué papel juega el número aleatorio `k` en la firma?**
R: En `s = k⁻¹(e + r·d) mod n`, `k` es un valor efímero y secreto por firma. Si se repite o
se predice, se puede despejar la llave privada `d` (el famoso fallo de la PS3 de Sony). Por
eso se genera con un RNG criptográfico; en nuestro caso lo provee Web Crypto.

**P: ¿Por qué se firma el hash y no el mensaje completo?**
R: Por eficiencia (el mensaje puede ser grande) y porque ECDSA opera con un entero `e`
acotado por `n`. SHA-256 produce un resumen de tamaño fijo que representa el mensaje; cambiar
un solo bit del mensaje cambia el hash por completo (efecto avalancha).

**P: ¿Qué es `mod n` y qué es `n`?**
R: `n` es el orden del grupo (cuántos puntos distintos genera `G`). Toda la aritmética de
escalares en la firma se hace módulo `n` para quedarse dentro del grupo cíclico.

## Para el maestro de CRIPTOGRAFÍA

**P: ¿Por qué reto–respuesta y no enviar una contraseña/firma fija?**
R: Una firma fija sería reutilizable (replay). El servidor emite un nonce único e
impredecible; la firma solo vale para ese reto, es de un solo uso y caduca en 5 minutos.

**P: ¿Cómo evitan replay y MITM?**
R: Nonce de un solo uso + expiración + marca `usado`. En producción, además, TLS para
confidencialidad e integridad del canal. La firma no revela la llave privada aunque se capture.

**P: La llave pública está en el servidor: ¿no es un riesgo?**
R: No. La pública está pensada para ser pública: permite **verificar** pero no **firmar**.
De `Q` no se obtiene `d` (ECDLP). El robo de la base de PKI no permite suplantar a nadie.

**P: ¿Por qué scrypt y no SHA-256 a secas para contraseñas?**
R: SHA-256 es rápido → malo para contraseñas (millones de intentos/seg). scrypt es lento y
usa mucha memoria a propósito (KDF "memory-hard"), encareciendo la fuerza bruta. Con salt
único por usuario eliminamos rainbow tables.

**P: ¿Qué formato de firma usan?**
R: IEEE P1363 (raw `r‖s`, 64 bytes), que es lo que produce y consume Web Crypto API. La
transmitimos en base64. (No es DER/ASN.1, que es lo que usa OpenSSL por defecto.)

**P: ¿El JWT no es vulnerable? ¿`none` algorithm?**
R: Lo firmamos y verificamos con HS256 fijando issuer y expiración; la librería rechaza
`alg:none`. La limitación honesta es que no implementamos revocación de JWT (trabajo futuro).

**P: ¿Qué pasa si pierdo el `.pem`?**
R: Para el día a día no pasa nada (entras con correo + contraseña). El `.pem` solo se necesita
para recuperación criptográfica y para autorizar nuevas líneas. Si lo pierdes, usas
"Restablecer mi seguridad" para generar una llave nueva (y se desvinculan las líneas por
seguridad).

## Para el maestro de PROGRAMACIÓN

**P: ¿Por qué microservicios y no un monolito?**
R: Aislamiento de responsabilidades y de datos (database-per-service). El servicio de llaves
está separado del de cuentas; un fallo o brecha en uno no compromete a los demás. Permite
escalar y desplegar por separado.

**P: ¿Cómo se comunican los servicios?**
R: Dos vías: HTTP/REST para llamadas síncronas (auth → pki para verificar firma) y RabbitMQ
(exchange topic `yoru.events`) para eventos asíncronos (kill switch, notificaciones).

**P: ¿Qué pasa si RabbitMQ se cae?**
R: Los clientes se reconectan solos cada 3 s y re-aplican sus suscripciones; `publishEvent`
devuelve true/false. No se pierden eventos en silencio si un servicio arrancó antes que el broker.

**P: ¿Web Crypto API en el navegador es seguro?**
R: Es la API criptográfica nativa estandarizada por la W3C, implementada por el motor del
navegador (no es JS "casero"). Permite marcar llaves como no exportables, que es justo lo que
aprovechamos para que la privada no se pueda leer desde JS.

**P: ¿Cómo suben los archivos pesados (INE, selfie)?**
R: Con **presigned URLs**: el backend firma una URL temporal y el navegador sube el archivo
**directo a MinIO**, sin pasar por nuestros servidores. Ahorra ancho de banda y escala mejor.

**P: ¿Cómo garantizan que no quedan datos huérfanos si algo falla a medio registro?**
R: El registro es **diferido**: nada se persiste en KYC/PKI/Telecom hasta verificar el correo.
Si algo falla, se hace rollback por evento `auth.user_deleted`; y un cleanup borra drafts no
confirmados a los 30 min.

**P: ¿Stack?**
R: React + Vite + Tailwind (frontend); Node.js + Fastify + Prisma (backend); PostgreSQL,
RabbitMQ, MinIO; Docker Compose para orquestar todo localmente.

---

## PREGUNTAS "TRAMPA" QUE PUEDEN HACER (y cómo salir bien)

- **"¿Esto es seguro de verdad o es un demo?"** → Es un prototipo académico: la criptografía
  (ECDSA, scrypt, JWT) es real y estándar; lo que falta para producción son KYC real,
  API Gateway, rate limiting, secret manager y tests. Lo decimos abiertamente.
- **"¿Inventaste la criptografía?"** → No. Usamos primitivas estándar de Web Crypto API y
  Node crypto; el valor del proyecto es el **diseño del sistema** que las combina para
  resolver el robo de identidad en líneas móviles.
- **"¿Dónde está la llave privada?"** → Solo en el `.pem` del usuario, no exportable al
  importarla. Nunca en el servidor ni en la base de datos.
- **"¿Por qué confiar en el correo/SMS si justo eso es lo vulnerable?"** → El correo/SMS es
  un factor de comodidad para confirmar posesión; el factor fuerte e infalsificable es la
  **firma ECDSA**. Para lo crítico siempre exigimos la llave.
</content>
</invoke>
