/**
 * Thin wrapper around `@plasmohq/storage` that forces the `local` storage
 * area by default.
 *
 * Why: `@plasmohq/storage` defaults to `chrome.storage.sync`, which is
 * rate-limited to MAX_WRITE_OPERATIONS_PER_MINUTE = 120. Bulk flows
 * (saveHistory, per-chunk saveStatus updates, etc.) easily trip that quota
 * and then crash with "Extension context invalidated" as the service
 * worker falls over. `chrome.storage.local` has no write-rate quota.
 *
 * Always import Storage / useStorage from here, never directly from
 * `@plasmohq/storage` or `@plasmohq/storage/hook` (with the sole
 * exception of places that explicitly want `session` or a different area
 * and already pass it via options).
 */
import { Storage as PlasmoStorage } from "@plasmohq/storage"
import { useStorage as usePlasmoStorage } from "@plasmohq/storage/hook"

type PlasmoStorageOptions = ConstructorParameters<typeof PlasmoStorage>[0]

export class Storage extends PlasmoStorage {
  constructor(options: PlasmoStorageOptions = {}) {
    super({ area: "local", ...(options ?? {}) })
  }
}

type UseStorageArg = Parameters<typeof usePlasmoStorage>[0]
type UseStorageInit = Parameters<typeof usePlasmoStorage>[1]

export const useStorage = ((arg: UseStorageArg, init?: UseStorageInit) => {
  if (typeof arg === "string") {
    return usePlasmoStorage({ key: arg, area: "local" } as any, init as any)
  }
  return usePlasmoStorage(
    { area: "local", ...(arg as any) } as any,
    init as any
  )
}) as typeof usePlasmoStorage
