// Local-only build: premium server calls removed.
export const activateTrial = async () => {
  return { ok: false, reason: "local-only-build" }
}
