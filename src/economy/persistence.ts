import { syncSave } from "@/lib/arena/server-fns";
import { migrateSave, writeSave, type Save } from "./save";

/**
 * Persist locally first, then merge this device's progress with the caller's
 * authenticated cloud save. Call only after the session has been verified by
 * useCurrentUserState; guests remain local-only.
 */
export async function syncArenaSave(save: Save): Promise<Save> {
  const result = await syncSave({ data: { blob: JSON.stringify(save) } });
  const merged = migrateSave(JSON.parse(result.blob) as unknown);
  writeSave(merged);
  return merged;
}
