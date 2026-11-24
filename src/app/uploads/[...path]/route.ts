import { readFile } from "node:fs/promises";
import path from "node:path";
import { mimeByExt, uploadDir } from "@/lib/storage";

// Раздаёт картинки из UPLOAD_DIR, когда S3 не настроен (посты, отчёты, аватары).
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const root = uploadDir();
  const file = path.resolve(root, ...parts);
  const type = mimeByExt(path.extname(file).slice(1));
  if (!file.startsWith(root + path.sep) || !type) return new Response("Not found", { status: 404 });
  try {
    const body = await readFile(file);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
