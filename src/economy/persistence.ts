import { loadCloudSave, purchaseBall, syncSave } from "@/lib/arena/server-fns";
import { migrateSave, writeSave, type Save } from "./save";

type PurchaseStatus = "ok" | "diamonds" | "owned" | "unknown";
let syncQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const task = syncQueue.then(operation);
  syncQueue = task.then(() => undefined, () => undefined);
  return task;
}

/**
 * For an existing account, load its canonical cloud save. For a first-time
 * account, seed the cloud with the device's guest progress once.
 */
export function hydrateArenaSave(local: Save): Promise<Save> {
  return enqueue(async () => {
    const remote = await loadCloudSave();
    if (remote.blob) {
      const canonical = migrateSave(JSON.parse(remote.blob) as unknown);
      writeSave(canonical);
      return canonical;
    }
    const result = await syncSave({ data: { blob: JSON.stringify(local) } });
    const seeded = migrateSave(JSON.parse(result.blob) as unknown);
    writeSave(seeded);
    return seeded;
  });
}

/**
 * Merge ordinary progress/preferences into the authenticated save. Calls are
 * serialized to stop older in-flight requests from overwriting newer changes.
 */
export function syncArenaSave(save: Save): Promise<Save> {
  return enqueue(async () => {
    const result = await syncSave({ data: { blob: JSON.stringify(save) } });
    const merged = migrateSave(JSON.parse(result.blob) as unknown);
    writeSave(merged);
    return merged;
  });
}

/** Spend server-held currency on one known ball and persist the canonical result. */
export function purchaseArenaBall(ballId: string): Promise<{ status: PurchaseStatus; save: Save }> {
  return enqueue(async () => {
    const result = await purchaseBall({ data: { ballId } });
    const save = migrateSave(JSON.parse(result.blob) as unknown);
    writeSave(save);
    return { status: result.status, save };
  });
}
