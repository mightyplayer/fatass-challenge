import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Картинки храним в S3-совместимом хранилище (например, Timeweb Cloud S3),
// а если оно не настроено — на локальном диске в UPLOAD_DIR.
const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/heic", "heic"],
]);
const MAX_BYTES = 10 * 1024 * 1024;

export const uploadDir = () => path.resolve(process.env.UPLOAD_DIR ?? "./uploads");

let s3: S3Client | null = null;
function getS3() {
  if (!process.env.S3_BUCKET) return null;
  s3 ??= new S3Client({
    region: process.env.S3_REGION ?? "ru-1",
    endpoint: process.env.S3_ENDPOINT ?? "https://s3.twcstorage.ru",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? "",
      secretAccessKey: process.env.S3_SECRET_KEY ?? "",
    },
  });
  return s3;
}

/** Сохраняет картинку и возвращает публичный URL. Пустой файл → null. */
export async function saveImage(file: File | null | undefined): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const ext = ALLOWED.get(file.type);
  if (!ext) throw new Error("Поддерживаются только изображения JPG, PNG, WEBP, GIF, HEIC");
  if (file.size > MAX_BYTES) throw new Error("Файл больше 10 МБ");

  const key = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  return putObject(key, Buffer.from(await file.arrayBuffer()), file.type);
}

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Скачивает аватар из Telegram и кладёт копию к себе: ссылки t.me открываются не у всех.
 * Ключ постоянный на пользователя, ?v= сбрасывает кэш браузера. При ошибке — null.
 */
export async function cacheAvatar(url: string, owner: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: "follow" });
    const header = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const body = res.ok ? Buffer.from(await res.arrayBuffer()) : Buffer.alloc(0);
    // Telegram иногда отдаёт image/jpg или octet-stream — тогда тип определяем по содержимому
    const type = ALLOWED.has(header) ? header : header === "image/jpg" ? "image/jpeg" : sniffImage(body);
    const ext = type ? ALLOWED.get(type) : undefined;
    if (!res.ok || !type || !ext || body.length === 0 || body.length > AVATAR_MAX_BYTES) {
      console.error(`Аватар не сохранён: HTTP ${res.status}, ${header || "без типа"}, ${body.length} байт`);
      return null;
    }
    const saved = await putObject(`avatars/${owner}.${ext}`, body, type);
    return `${saved}?v=${Date.now().toString(36)}`;
  } catch (e) {
    console.error("Не удалось сохранить аватар", e);
    return null;
  }
}

function sniffImage(b: Buffer): string | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (b.toString("ascii", 0, 3) === "GIF") return "image/gif";
  return null;
}

async function putObject(key: string, body: Buffer, contentType: string): Promise<string> {
  const client = getS3();
  if (client) {
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        ACL: "public-read",
      }),
    );
    const base = process.env.S3_PUBLIC_URL ?? `${process.env.S3_ENDPOINT ?? "https://s3.twcstorage.ru"}/${process.env.S3_BUCKET}`;
    return `${base.replace(/\/$/, "")}/${key}`;
  }

  const target = path.join(uploadDir(), key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body);
  return `/uploads/${key}`;
}

const MIME = new Map([...ALLOWED].map(([type, ext]) => [ext, type]));
export const mimeByExt = (ext: string) => MIME.get(ext.toLowerCase()) ?? null;
