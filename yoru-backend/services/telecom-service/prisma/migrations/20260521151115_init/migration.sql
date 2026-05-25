-- CreateEnum
CREATE TYPE "EstadoLinea" AS ENUM ('vinculada', 'activa', 'bloqueada', 'kill_switched');

-- CreateTable
CREATE TABLE "lineas" (
    "id" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "public_key_id" TEXT,
    "estado" "EstadoLinea" NOT NULL DEFAULT 'vinculada',
    "fecha_vinculacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lineas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_linea" (
    "id" TEXT NOT NULL,
    "linea_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "detalle" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_linea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lineas_telefono_key" ON "lineas"("telefono");

-- CreateIndex
CREATE INDEX "lineas_user_id_idx" ON "lineas"("user_id");

-- CreateIndex
CREATE INDEX "eventos_linea_linea_id_idx" ON "eventos_linea"("linea_id");

-- AddForeignKey
ALTER TABLE "eventos_linea" ADD CONSTRAINT "eventos_linea_linea_id_fkey" FOREIGN KEY ("linea_id") REFERENCES "lineas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
