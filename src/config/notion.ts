// initialize notion sdk
import { Client } from "@notionhq/client"

import { Storage } from "~utils/storage"

import { STORAGE_KEYS } from "~utils/consts"

const getNotion = async () => {
  const storage = new Storage({
    area: "local",
    secretKeyList: ["token"]
  })
  const token = await storage.get(STORAGE_KEYS.token)
  const notion = new Client({
    auth: token ?? ""
  })
  return notion
}

export default getNotion
