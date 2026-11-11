import { body, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { exec, transaction } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { settingsSchema } from "@/lib/validation";

export const GET = route({ permission: "settings.manage" }, async () => getSettings());

export const PATCH = route({ permission: "settings.manage" }, async ({ req, user }) => {
  const d = await body(req, settingsSchema);
  const before = await getSettings();
  const changed = Object.entries(d).filter(([k, v]) => v !== undefined && String((before as Record<string, unknown>)[k]) !== String(v));
  if (!changed.length) return { ok: true };
  await transaction(async (tx) => {
    for (const [k, v] of changed) {
      await exec(
        "INSERT INTO settings (setting_key, setting_value, updated_by) VALUES (?,?,?) ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_by = EXCLUDED.updated_by",
        [k, String(v), user.id], tx,
      );
    }
    await audit(user, {
      action: "SETTINGS_UPDATE", entityType: "settings",
      summary: `Changed ${changed.map(([k]) => k).join(", ")}`,
      before: Object.fromEntries(changed.map(([k]) => [k, (before as Record<string, unknown>)[k]])),
      after: Object.fromEntries(changed),
    }, tx);
  });
  return { ok: true };
});
