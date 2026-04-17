// Local-only build: OAuth flow removed. The integration token is entered by
// the user directly in the Settings popup. This stub exists only because the
// `generateToken` background message handler still imports it; it is never
// reached in normal use because `src/contents/auth.ts` is a no-op.
export const generateToken = async (_code: string) => {
  console.warn(
    "generateToken called in local-only build; OAuth is disabled. Paste your Notion integration token in the Settings popup instead."
  )
  return undefined
}
