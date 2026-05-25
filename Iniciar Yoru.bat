@echo off
REM ============================================================
REM  YORU - Iniciar todo el sistema con un solo doble-click
REM ============================================================
REM  Levanta:
REM    - Docker (Postgres x4, RabbitMQ, MinIO)
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
echo  Para detener todo: doble-click a "Detener Yoru.bat"
echo ============================================================
echo.
echo (Pulsa cualquier tecla para cerrar esta ventana)
pause >nul
