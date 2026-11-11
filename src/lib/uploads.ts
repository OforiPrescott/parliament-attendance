import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ApiError } from "./api";

const ROOT = resolve(process.env.UPLOAD_DIR ?? "./storage/uploads");
const MAX_BYTES = 2 * 1024 * 1024;

const SIGNATURES: { type: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { type: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/png", ext: "png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: "image/webp", ext: "webp", test: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
];

/**
 * Stores an MP photograph outside the web root under a random name.
 * The file type is decided by its magic bytes, never by the client's
 * filename or Content-Type, so a disguised script cannot be uploaded.
 */
export async function savePhoto(file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new ApiError(413, "Photograph must be 2 MB or smaller.");
  const buf = Buffer.from(await file.arrayBuffer());
  const sig = SIGNATURES.find((s) => s.test(buf));
  if (!sig) throw new ApiError(415, "Upload a JPEG, PNG or WebP image.");
  const dir = join(ROOT, "mps");
  await mkdir(dir, { recursive: true });
  const name = `${randomBytes(16).toString("hex")}.${sig.ext}`;
  await writeFile(join(dir, name), buf, { mode: 0o640 });
  return `mps/${name}`;
}

export async function readPhoto(relPath: string): Promise<{ data: Buffer; type: string } | null> {
  if (!/^mps\/[a-f0-9]{32}\.(jpg|png|webp)$/.test(relPath)) return null; // path traversal guard
  try {
    const data = await readFile(join(ROOT, relPath));
    const type = relPath.endsWith(".png") ? "image/png" : relPath.endsWith(".webp") ? "image/webp" : "image/jpeg";
    return { data, type };
  } catch {
    return null;
  }
}

export async function deletePhoto(relPath: string | null) {
  if (!relPath || !/^mps\/[a-f0-9]{32}\.(jpg|png|webp)$/.test(relPath)) return;
  await unlink(join(ROOT, relPath)).catch(() => undefined);
}
