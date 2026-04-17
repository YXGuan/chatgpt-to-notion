import type { PlasmoMessaging } from "@plasmohq/messaging"

// Local-only build: OAuth code exchange is disabled. The user supplies their
// Notion integration token directly in the Settings popup.
const handler: PlasmoMessaging.MessageHandler = async (_req, res) => {
  res.send({
    err: "OAuth disabled in local-only build. Paste your Notion integration token in Settings."
  })
}

export default handler
