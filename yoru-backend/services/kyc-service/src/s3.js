import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const BUCKET = process.env.S3_BUCKET ?? 'kyc-documents';

export const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'yoru',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'yoru_dev_minio',
  },
  forcePathStyle: true, // necesario para MinIO
});

/**
 * Garantiza que el bucket exista y configura CORS para que el
 * navegador pueda hacer PUT directo con las presigned URLs.
 */
export async function bootstrapBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
    console.log(`[s3] bucket "${BUCKET}" ya existe`);
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 404 || err.name === 'NotFound') {
      await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
      console.log(`[s3] bucket "${BUCKET}" creado`);
    } else {
      console.warn('[s3] no se pudo verificar bucket:', err.message);
      return;
    }
  }

  try {
    await s3.send(new PutBucketCorsCommand({
      Bucket: BUCKET,
      CORSConfiguration: {
        CORSRules: [{
          AllowedOrigins: ['http://localhost:5173', 'http://localhost:5174'],
          AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD'],
          AllowedHeaders: ['*'],
          ExposeHeaders: ['ETag'],
          MaxAgeSeconds: 3000,
        }],
      },
    }));
    console.log('[s3] CORS configurado en el bucket');
  } catch (err) {
    console.warn('[s3] no se pudo configurar CORS (ignorable si MinIO ya lo permite por env):', err.message);
  }
}

/** Devuelve un URL firmado para PUT (subir) un objeto. Expira en 5 min. */
export async function presignPut({ key, contentType }) {
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 300 }
  );
}

/** Devuelve un URL firmado para GET (descargar) un objeto. Expira en 10 min. */
export async function presignGet({ key }) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: 600 }
  );
}
