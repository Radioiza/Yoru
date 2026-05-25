@echo off
REM ============================================================
REM  YORU - Detener todo el sistema con un solo doble-click
REM ============================================================
REM  Cierra:
REM    - Docker Compose (Postgres x4, RabbitMQ, MinIO)
REM    - Las ventanas de PowerShell de los microservicios
REM    - Las ventanas de PowerShell de Prisma Studio
REM
REM  Las pestanias del navegador NO se cierran automaticamente,
REM  cierralas tu mismo si quieres.
REM ============================================================

cd /d "%~dp0"
python iniciar.py --stop

echo.
echo ============================================================
echo  Detencion completada.
echo  Si dejaste pestanias del navegador abiertas, cierralas tu.
echo ============================================================
echo.
pause
