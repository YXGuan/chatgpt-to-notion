import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "~utils/storage"

import { fetchHistory, saveHistory } from "~background/functions"
import { STORAGE_KEYS } from "~utils/consts"
import type { ModelHeaders, SupportedModels } from "~utils/types"

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  try {
    const storage = new Storage()
    const session = new Storage({
      area: "session",
      secretKeyList: ["token", "cacheHeaders"]
    })

    const cacheHeaders = await session.get<ModelHeaders>(
      STORAGE_KEYS.cacheHeaders
    )
    const model = await storage.get<SupportedModels>(STORAGE_KEYS.model)
    // const model = await storage.get<string>(STORAGE_KEYS.model)
    // const model = "chatgpt"

    if (model != cacheHeaders.model) {
      throw new Error("Model mismatch, please refresh this conversation's tab")
    }

    const projectId: string | undefined = req.body?.projectId
    const fetchHistoryRes = await fetchHistory(
      model,
      cacheHeaders.headers,
      projectId
    )

    const saveHistoryRes = await saveHistory(
      model,
      fetchHistoryRes,
      cacheHeaders.headers
    )

    res.send(saveHistoryRes)
  } catch (err) {
    console.error(err)
    res.send({ err })
  }
}

export default handler
