@echo off
REM ============================================================
REM  YORU - Iniciar todo el sistema con un solo doble-click
REM ============================================================
REM  Levanta:
REM    - Docker (Postgres x4, RabbitMQ, MinIO)
REM    - Inicializa MinIO: coloca credenciales (kyc-service/.env) y crea el
REM      bucket "kyc-documents" donde se guardan las INE y selfies.
REM    - 5 microservicios (auth, pki, kyc, telecom, notification)
REM    - 4 Prisma Studio (UI web de cada base de datos)
REM    - Frontend React
REM  Abre el navegador con el frontend + las 4 BDs en pestanias.
REM ============================================================

cd /d "%~dp0"
python iniciar.py

echo.
echo ============================================================
echo  Esta ventana se puede cerrar. Los servicios siguen corriendo
echo  en sus propias ventanas.
echo.
echo  MinIO (archivos INE/selfie):  http://localhost:9001
echo    usuario: yoru   contrasena: yoru_dev_minio   bucket: kyc-documents
echo.
echo  Para detener todo: doble-click a "Detener Yoru.bat"
echo ============================================================
echo.
echo (Pulsa cualquier tecla para cerrar esta ventana)
pause >nul
