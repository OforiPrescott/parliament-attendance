import { ApiError, intParam, notFound, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { exec, one } from "@/lib/db";
import { deletePhoto, readPhoto, savePhoto } from "@/lib/uploads";

type P = { id: string };

/** Photographs are served only to signed-in users, never from /public. */
export const GET = route<P>({ permission: ["mps.view", "attendance.capture"] }, async ({ params }) => {
  const mp = await one<{ photo_path: string | null }>("SELECT photo_path FROM mps WHERE id = ?", [intParam(params.id)]);
  const photo = mp?.photo_path ? await readPhoto(mp.photo_path) : null;
  if (!photo) notFound("Photograph");
  return new Response(new Uint8Array(photo.data), {
    headers: { "Content-Type": photo.type, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
});

export const POST = route<P>({ permission: "mps.manage" }, async ({ req, user, params }) => {
  const id = intParam(params.id);
  const mp = await one<{ photo_path: string | null; last_name: string }>("SELECT photo_path, last_name FROM mps WHERE id = ?", [id]);
  if (!mp) notFound("MP");
  const form = await req.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File)) throw new ApiError(400, "Choose a photograph to upload.");
  const path = await savePhoto(file);
  await exec("UPDATE mps SET photo_path = ? WHERE id = ?", [path, id]);
  await deletePhoto(mp.photo_path);
  await audit(user, { action: "MP_PHOTO", entityType: "mp", entityId: id, summary: `Updated photograph for ${mp.last_name}` });
  return { ok: true };
});

export const DELETE = route<P>({ permission: "mps.manage" }, async ({ user, params }) => {
  const id = intParam(params.id);
  const mp = await one<{ photo_path: string | null; last_name: string }>("SELECT photo_path, last_name FROM mps WHERE id = ?", [id]);
  if (!mp) notFound("MP");
  await exec("UPDATE mps SET photo_path = NULL WHERE id = ?", [id]);
  await deletePhoto(mp.photo_path);
  await audit(user, { action: "MP_PHOTO", entityType: "mp", entityId: id, summary: `Removed photograph for ${mp.last_name}` });
  return { ok: true };
});
