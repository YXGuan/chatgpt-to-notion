import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "~utils/storage"

import { listChatGPTProjects } from "~models/chatgpt/api/listProjects"
import { STORAGE_KEYS } from "~utils/consts"
import { convertHeaders } from "~utils/functions"
import type { ModelHeaders, SupportedModels } from "~utils/types"

const handler: PlasmoMessaging.MessageHandler = async (_req, res) => {
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

    if (!cacheHeaders) {
      res.send({ projects: [], err: "No captured headers yet — open a chat." })
      return
    }

    if (model !== cacheHeaders.model) {
      res.send({
        projects: [],
        err: "Model mismatch, please refresh this conversation's tab."
      })
      return
    }

    if (model !== "chatgpt") {
      res.send({ projects: [], err: "Projects are only supported on ChatGPT." })
      return
    }

    const headers = convertHeaders(cacheHeaders.headers)
    const projects = await listChatGPTProjects(headers)
    res.send({ projects })
  } catch (err) {
    console.error(err)
    res.send({ projects: [], err: (err as any)?.message ?? "Unknown error" })
  }
}

export default handler
