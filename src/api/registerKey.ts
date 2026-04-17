// Local-only build: premium server calls removed.
export const registerKey = async (_license_key: string) => {
  return { ok: false, reason: "local-only-build" }
}
