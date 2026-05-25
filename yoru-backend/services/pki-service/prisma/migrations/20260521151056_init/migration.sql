-- CreateTable
CREATE TABLE "public_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "public_key_pem" TEXT NOT NULL,
    "curva" TEXT NOT NULL DEFAULT 'P-256',
    "revocada" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "public_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signatures" (
    "id" TEXT NOT NULL,
    "public_key_id" TEXT NOT NULL,
    "challenge_id" TEXT,
    "payload_hash" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "public_keys_user_id_idx" ON "public_keys"("user_id");

-- CreateIndex
CREATE INDEX "signatures_public_key_id_idx" ON "signatures"("public_key_id");

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_public_key_id_fkey" FOREIGN KEY ("public_key_id") REFERENCES "public_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
