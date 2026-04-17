import type { PlasmoCSConfig } from "plasmo"

// Local-only build: OAuth code-handling disabled.
// Kept as an empty content script to avoid breaking any lingering references.
export const config: PlasmoCSConfig = {
  matches: [
    "https://theo-lartigau.notion.site/ChatGPT-to-Notion-af29d9538dca4493a15bb4ed0fde7f91*"
  ]
}

export {}
