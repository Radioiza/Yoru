"""
YORU - Script de arranque automatico del stack completo.

Levanta:
  - Docker Compose: Postgres x4, RabbitMQ, MinIO
  - 5 microservicios: auth, pki, kyc, telecom, notification
  - 4 Prisma Studio (UI web para cada BD)
  - Frontend React (Vite)
  - Abre el navegador con el frontend + las 4 BDs en pestanias

Lo que hace por debajo:
  1. Verifica que Docker CLI, Docker daemon, Node y npm esten instalados.
  2. Ejecuta docker compose up -d (levanta los 6 contenedores).
  3. Espera a que cada Postgres y RabbitMQ respondan en su puerto.
  4. Por cada microservicio:
     - npm install (solo si no existe node_modules)
     - prisma db push --accept-data-loss (sincroniza el schema con la BD,
       idempotente: si esta al dia no hace nada; si hay un campo nuevo lo
       aplica automaticamente).
     - prisma generate (regenera el cliente)
  5. Lanza cada servicio en una ventana de PowerShell separada con titulo
     "YORU - <servicio>" para que se vean los logs y se puedan cerrar luego.
  6. Lanza el frontend Vite igual.
  7. Espera ~6 segundos y abre el navegador.

Uso:
  python iniciar.py             arrancar todo
  python iniciar.py --stop      detener docker y cerrar ventanas YORU
  python iniciar.py --no-browser arrancar sin abrir navegador
  python iniciar.py --help      mostrar ayuda

Requisitos:
  - Python 3.8+
  - Docker Desktop (corriendo)
  - Node.js 20+
"""

import argparse
import os
import socket
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

# ===================== CONFIGURACION =====================
PROJECT_ROOT = Path(__file__).parent.resolve()
BACKEND_DIR  = PROJECT_ROOT / "yoru-backend"
FRONTEND_DIR = PROJECT_ROOT / "registro" / "registro"
SERVICES_DIR = BACKEND_DIR / "services"

# (nombre, puerto_api, tiene_bd, puerto_bd)
SERVICIOS = [
    ("auth-service",         3001, True,  5433),
    ("pki-service",          3002, True,  5434),
    ("kyc-service",          3003, True,  5435),
    ("telecom-service",      3004, True,  5436),
    ("notification-service", 3005, False, None),
]

# Puertos del Prisma Studio (UI web para inspeccionar/editar BDs).
# Uno por servicio con BD; cada uno arranca en su propio puerto.
PRISMA_STUDIO_PORTS = {
    "auth-service":    5555,
    "pki-service":     5556,
    "kyc-service":     5557,
    "telecom-service": 5558,
}


# ===================== COLORES =====================
class C:
    RED    = "\033[91m"
    GREEN  = "\033[92m"
    YELLOW = "\033[93m"
    BLUE   = "\033[94m"
    PURPLE = "\033[95m"
    CYAN   = "\033[96m"
    BOLD   = "\033[1m"
    RESET  = "\033[0m"


def p(color, msg):
    print(f"{color}{msg}{C.RESET}")


def banner():
    print()
    p(C.PURPLE + C.BOLD, "=" * 60)
    p(C.PURPLE + C.BOLD, "   YORU  -  Sistema de identidad digital")
    p(C.PURPLE + C.BOLD, "   Launcher automatico")
    p(C.PURPLE + C.BOLD, "=" * 60)


# ===================== VALIDACIONES =====================
def check_cmd(cmd, nombre, install_url=None):
    """Verifica si un comando responde correctamente."""
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, shell=True, timeout=10)
        if r.returncode == 0:
            primera_linea = r.stdout.strip().split("\n")[0]
            p(C.GREEN, f"  [OK]  {nombre}: {primera_linea}")
            return True
    except Exception:
        pass
    p(C.RED, f"  [X]   {nombre} no encontrado o no funciona")
    if install_url:
        p(C.YELLOW, f"        Instala desde: {install_url}")
    return False


def docker_daemon_corriendo():
    try:
        r = subprocess.run("docker ps", capture_output=True, text=True, shell=True, timeout=5)
        return r.returncode == 0
    except Exception:
        return False


def esperar_puerto(host, puerto, timeout=60):
    """Espera hasta que un puerto acepte conexiones TCP."""
    inicio = time.time()
    while time.time() - inicio < timeout:
        try:
            with socket.create_connection((host, puerto), timeout=1):
                return True
        except (OSError, socket.timeout):
            time.sleep(0.5)
    return False


# ===================== ACCIONES =====================
def levantar_docker():
    p(C.BLUE, "\nLevantando contenedores (Postgres x4, RabbitMQ, MinIO)...")
    r = subprocess.run(
        "docker compose up -d",
        cwd=str(BACKEND_DIR),
        shell=True,
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        p(C.RED, "  Error al ejecutar docker compose up:")
        print(r.stderr)
        return False
    p(C.GREEN, "  [OK]  docker compose up -d completado")

    p(C.BLUE, "  Esperando a que las BDs respondan en su puerto...")
    for nombre, _, tiene_bd, puerto_bd in SERVICIOS:
        if tiene_bd:
            if esperar_puerto("localhost", puerto_bd, timeout=60):
                p(C.GREEN, f"    [OK] {nombre} BD lista en puerto {puerto_bd}")
            else:
                p(C.RED, f"    [X]  {nombre} BD no respondio en puerto {puerto_bd}")
                return False

    if esperar_puerto("localhost", 5672, timeout=60):
        p(C.GREEN, "    [OK] RabbitMQ listo en puerto 5672")
    if esperar_puerto("localhost", 9000, timeout=30):
        p(C.GREEN, "    [OK] MinIO listo en puerto 9000")

    return True


def setup_servicio(nombre, tiene_bd):
    """npm install + prisma migrate la primera vez."""
    svc_dir = SERVICES_DIR / nombre

    if not (svc_dir / "node_modules").exists():
        p(C.YELLOW, f"  Instalando dependencias de {nombre} (primera vez, puede tardar)...")
        r = subprocess.run("npm install", cwd=str(svc_dir), shell=True, capture_output=True, text=True)
        if r.returncode != 0:
            p(C.RED, f"    [X] Error en npm install de {nombre}")
            print(r.stderr[-800:])
            return False

    if tiene_bd:
        # db push es idempotente: aplica el schema actual a la BD sin crear
        # migration files. Si la BD ya esta sincronizada, no hace nada.
        # Si agregamos un campo nuevo al schema, lo aplica automaticamente.
        # --accept-data-loss permite ALTER TABLE en cambios destructivos.
        # --skip-generate evita regenerar el cliente aqui (lo hacemos abajo).
        p(C.YELLOW, f"  Sincronizando base de datos de {nombre}...")
        r = subprocess.run(
            "npx prisma db push --accept-data-loss --skip-generate",
            cwd=str(svc_dir),
            shell=True,
            capture_output=True,
            text=True,
        )
        if r.returncode != 0:
            p(C.RED, f"    [X] Error en prisma db push de {nombre}")
            print(r.stderr[-800:])
            return False

        # Regenerar el Prisma Client por si hubo cambios en el schema.
        r2 = subprocess.run(
            "npx prisma generate",
            cwd=str(svc_dir),
            shell=True,
            capture_output=True,
            text=True,
        )
        if r2.returncode != 0:
            p(C.RED, f"    [X] Error en prisma generate de {nombre}")
            print(r2.stderr[-800:])
            return False

    p(C.GREEN, f"  [OK]  {nombre}")
    return True


def setup_frontend():
    if not (FRONTEND_DIR / "node_modules").exists():
        p(C.YELLOW, "  Instalando dependencias del frontend...")
        r = subprocess.run("npm install", cwd=str(FRONTEND_DIR), shell=True, capture_output=True, text=True)
        if r.returncode != 0:
            p(C.RED, "    [X] Error en npm install del frontend")
            print(r.stderr[-800:])
            return False
    p(C.GREEN, "  [OK]  frontend")
    return True


def lanzar_en_ventana(titulo, comando, cwd):
    """Abre una nueva ventana de PowerShell ejecutando un comando.

    El titulo se usa para identificar la ventana al detener.
    -NoExit mantiene la ventana abierta despues del comando.
    CREATE_NEW_CONSOLE hace que la ventana sea separada (no hereda la actual).
    """
    if os.name != "nt":
        p(C.RED, "Este script esta pensado para Windows (PowerShell + CREATE_NEW_CONSOLE).")
        sys.exit(1)

    ps_cmd = f'$Host.UI.RawUI.WindowTitle = "{titulo}"; {comando}'
    subprocess.Popen(
        ["powershell", "-NoExit", "-Command", ps_cmd],
        cwd=str(cwd),
        creationflags=subprocess.CREATE_NEW_CONSOLE,
    )


def detener():
    p(C.BLUE, "\nDeteniendo Docker Compose...")
    r = subprocess.run("docker compose down", cwd=str(BACKEND_DIR), shell=True)
    if r.returncode == 0:
        p(C.GREEN, "  [OK] Contenedores detenidos")
    else:
        p(C.RED, "  [X] Error al detener contenedores")

    p(C.BLUE, "\nCerrando ventanas de microservicios y Prisma Studio...")
    cerrados = 0
    # Las ventanas tienen titulos "YORU - ..." (servicios) y
    # "YORU Studio - ..." (BDs). Hacemos taskkill para ambos.
    for patron in ('YORU - *', 'YORU Studio - *'):
        r = subprocess.run(
            f'taskkill /F /FI "WINDOWTITLE eq {patron}"',
            shell=True,
            capture_output=True,
            text=True,
        )
        # Cuenta SUCCESS o EXITO en la salida para saber cuantas cerro
        cerrados += r.stdout.count("SUCCESS") + r.stdout.count("EXITO")

    if cerrados > 0:
        p(C.GREEN, f"  [OK] {cerrados} ventanas cerradas")
    else:
        p(C.YELLOW, "  No se cerro ninguna ventana automaticamente; cierralas a mano si quedaron abiertas.")


def imprimir_resumen(no_browser):
    print()
    p(C.GREEN + C.BOLD, "=" * 60)
    p(C.GREEN + C.BOLD, "   Todo arriba! :)")
    p(C.GREEN + C.BOLD, "=" * 60)
    print()
    p(C.CYAN, "Servicios disponibles:")
    items = [
        ("Frontend",             "http://localhost:5173"),
        ("auth-service",         "http://localhost:3001"),
        ("pki-service",          "http://localhost:3002"),
        ("kyc-service",          "http://localhost:3003"),
        ("telecom-service",      "http://localhost:3004"),
        ("notification-service", "http://localhost:3005"),
        ("RabbitMQ UI",          "http://localhost:15672"),
        ("MinIO UI",             "http://localhost:9001"),
    ]
    ancho = max(len(n) for n, _ in items)
    for nombre, url in items:
        print(f"  {C.BOLD}{nombre.ljust(ancho)}{C.RESET}  {url}")
    print()
    p(C.CYAN, "Bases de datos (Prisma Studio):")
    bd_items = [
        (f"Studio {nombre}", f"http://localhost:{PRISMA_STUDIO_PORTS[nombre]}")
        for nombre, _, tiene_bd, _ in SERVICIOS if tiene_bd
    ]
    ancho_bd = max(len(n) for n, _ in bd_items)
    for nombre, url in bd_items:
        print(f"  {C.BOLD}{nombre.ljust(ancho_bd)}{C.RESET}  {url}")
    print()
    p(C.YELLOW, "Credenciales para las UIs externas:")
    p(C.YELLOW, "  RabbitMQ:  yoru / yoru_dev")
    p(C.YELLOW, "  MinIO:     yoru / yoru_dev_minio")
    p(C.YELLOW, "  (Prisma Studio no pide credenciales)")
    print()
    p(C.PURPLE, "Para detener todo:  python iniciar.py --stop")
    print()
    if no_browser:
        p(C.YELLOW, "Navegador NO se abrira (flag --no-browser).")


# ===================== MAIN =====================
def main():
    parser = argparse.ArgumentParser(
        description="YORU - Launcher automatico del stack completo.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--stop", action="store_true", help="Detener docker compose y ventanas")
    parser.add_argument("--no-browser", action="store_true", help="No abrir el navegador al terminar")
    args = parser.parse_args()

    banner()

    if args.stop:
        detener()
        return

    # ----- PASO 1: prerequisites -----
    p(C.BLUE, "\n[1/5] Verificando requisitos...")
    ok = True
    ok &= check_cmd("docker --version", "Docker CLI",
                    "https://www.docker.com/products/docker-desktop/")
    ok &= check_cmd("node --version", "Node.js", "https://nodejs.org/")
    ok &= check_cmd("npm --version", "npm")
    if not ok:
        p(C.RED, "\nFaltan dependencias. Instalalas y vuelve a intentar.")
        sys.exit(1)

    if not docker_daemon_corriendo():
        p(C.RED, "\n  [X] Docker CLI esta instalado pero el daemon no responde.")
        p(C.YELLOW, "      Abre Docker Desktop desde el menu inicio y espera a que el")
        p(C.YELLOW, "      icono de la ballena deje de animarse. Luego vuelve a correr este script.")
        sys.exit(1)
    p(C.GREEN, "  [OK]  Docker daemon corriendo")

    # ----- PASO 2: docker compose -----
    p(C.BLUE, "\n[2/5] Levantando infraestructura...")
    if not levantar_docker():
        sys.exit(1)

    # ----- PASO 3: setup microservicios + frontend -----
    p(C.BLUE, "\n[3/5] Preparando microservicios (la primera vez tarda mas)...")
    for nombre, _, tiene_bd, _ in SERVICIOS:
        if not setup_servicio(nombre, tiene_bd):
            sys.exit(1)
    if not setup_frontend():
        sys.exit(1)

    # ----- PASO 4: lanzar microservicios -----
    p(C.BLUE, "\n[4/6] Lanzando microservicios en ventanas separadas...")
    for nombre, puerto, _, _ in SERVICIOS:
        titulo = f"YORU - {nombre} (puerto {puerto})"
        lanzar_en_ventana(titulo, "npm run dev", SERVICES_DIR / nombre)
        p(C.GREEN, f"  [OK]  {nombre} -> ventana abierta")
        time.sleep(0.7)  # espaciar el arranque para no saturar

    # ----- PASO 5: lanzar Prisma Studio para cada BD -----
    p(C.BLUE, "\n[5/6] Lanzando Prisma Studio para cada base de datos...")
    for nombre, _, tiene_bd, _ in SERVICIOS:
        if tiene_bd:
            puerto = PRISMA_STUDIO_PORTS[nombre]
            titulo = f"YORU Studio - {nombre} (puerto {puerto})"
            # --browser none evita que Prisma abra su propio navegador;
            # lo abrimos nosotros al final, todos juntos.
            comando = f"npx prisma studio --port {puerto} --browser none"
            lanzar_en_ventana(titulo, comando, SERVICES_DIR / nombre)
            p(C.GREEN, f"  [OK]  Studio de {nombre} -> puerto {puerto}")
            time.sleep(0.6)

    # ----- PASO 6: lanzar frontend -----
    p(C.BLUE, "\n[6/6] Lanzando frontend...")
    lanzar_en_ventana("YORU - Frontend (puerto 5173)", "npm run dev", FRONTEND_DIR)
    p(C.GREEN, "  [OK]  frontend -> ventana abierta")

    # ----- Abrir todo en el navegador -----
    if not args.no_browser:
        p(C.BLUE, "\nEsperando a que el frontend responda...")
        if esperar_puerto("localhost", 5173, timeout=30):
            p(C.GREEN, "  [OK] Frontend listo, abriendo pestania...")
            webbrowser.open("http://localhost:5173")
        else:
            p(C.YELLOW, "  Frontend tardo demasiado; abrelo manualmente en http://localhost:5173")

        p(C.BLUE, "\nEsperando a que cada Prisma Studio este listo...")
        for nombre, _, tiene_bd, _ in SERVICIOS:
            if tiene_bd:
                puerto = PRISMA_STUDIO_PORTS[nombre]
                if esperar_puerto("localhost", puerto, timeout=45):
                    webbrowser.open_new_tab(f"http://localhost:{puerto}")
                    p(C.GREEN, f"  [OK] Studio de {nombre} listo, pestania abierta")
                else:
                    p(C.YELLOW, f"  Studio de {nombre} tardo; abrelo manualmente en http://localhost:{puerto}")
                time.sleep(0.3)

    imprimir_resumen(args.no_browser)


if __name__ == "__main__":
    # En Windows, habilitar el procesamiento de codigos ANSI para que los colores se vean
    if os.name == "nt":
        os.system("")
    try:
        main()
    except KeyboardInterrupt:
        print()
        p(C.YELLOW, "Interrumpido por el usuario.")
        sys.exit(130)
