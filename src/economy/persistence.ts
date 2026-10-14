import { syncSave } from "@/lib/arena/server-fns";
import { migrateSave, writeSave, type Save } from "./save";

let syncQueue: Promise<unknown> = Promise.resolve();

/**
 * Merge a device save into the signed-in player's cloud save, then persist the
 * merged result locally. Calls are serialized so rapid purchases/settings
 * cannot let an older in-flight save overwrite a newer one.
 *
 * Call only after useCurrentUserState confirms a real authenticated user.
 * Guests remain local-only and never call this helper.
 */
export function syncArenaSave(save: Save): Promise<Save> {
  const task = syncQueue.then(async () => {
    const result = await syncSave({ data: { blob: JSON.stringify(save) } });
    const merged = migrateSave(JSON.parse(result.blob) as unknown);
    writeSave(merged);
    return merged;
  });
  syncQueue = task.then(() => undefined, () => undefined);
  return task;
}
