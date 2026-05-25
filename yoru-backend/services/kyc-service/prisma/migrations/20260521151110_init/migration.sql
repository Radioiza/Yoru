-- CreateEnum
CREATE TYPE "EstadoKyc" AS ENUM ('pendiente', 'aprobado', 'rechazado');

-- CreateTable
CREATE TABLE "kyc_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "estado" "EstadoKyc" NOT NULL DEFAULT 'pendiente',
    "ref_ine_s3" TEXT,
    "ref_selfie_s3" TEXT,
    "score_match" DOUBLE PRECISION,
    "motivo_rechazo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kyc_requests_user_id_key" ON "kyc_requests"("user_id");
