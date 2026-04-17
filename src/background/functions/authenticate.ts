import { Storage } from "@plasmohq/storage"

import { STORAGE_KEYS } from "~utils/consts"

// Local-only auth: the user pastes their Notion internal integration token
// in the Settings popup. We never contact any third-party server.
const authenticate = async () => {
  const storage = new Storage()
  const tokenStore = new Storage({
    area: "local",
    secretKeyList: ["token"]
  })
  const token = await tokenStore.get(STORAGE_KEYS.token)
  if (token) {
    await storage.set(STORAGE_KEYS.authenticated, true)
    return true
  }
  await storage.set(STORAGE_KEYS.authenticated, false)
  return false
}

export default authenticate
