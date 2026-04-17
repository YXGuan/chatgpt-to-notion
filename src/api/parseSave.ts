import { decompress } from "shrink-string"

import { Storage } from "~utils/storage"

import getNotion from "~config/notion"
import { i18n, limitBlockNesting } from "~utils/functions"
import {
  generateBlocks,
  generateCanvasBlocks,
  generateTagProperties
} from "~utils/functions/notion"
import type { ConversationTextdocs, StoredDatabase } from "~utils/types"

/** Notion rich_text items are capped at 2000 characters each. */
const RICH_TEXT_MAX = 2000
const toRichText = (text: string) => {
  if (!text) return []
  const chunks = text.match(new RegExp(`[\\s\\S]{1,${RICH_TEXT_MAX}}`, "g")) ?? [
    text
  ]
  return chunks.map((content) => ({ type: "text", text: { content } }))
}

// save new page to notion database
export const parseSave = async (
  params: ParseSaveParams,
  { compressed, isMarkdown }: { compressed: boolean; isMarkdown: boolean } = {
    compressed: true,
    isMarkdown: false
  }
) => {
  try {
    let { prompts, answers, textDocs, title, url, database, generateHeadings } =
      params
    const { propertiesIds } = database

    const decompressedPrompts: string[] = []
    const blocks: any[] = []
    for (let i = 0; i < prompts.length; i++) {
      let decompressedAnswer: string
      let decompressedPrompt: string
      if (compressed) {
        ;[decompressedAnswer, decompressedPrompt] = await Promise.all([
          decompress(answers[i]),
          decompress(prompts[i])
        ])
      } else {
        decompressedAnswer = answers[i]
        decompressedPrompt = prompts[i]
      }
      decompressedPrompts.push(decompressedPrompt)

      const { answerBlocks, promptBlocks } = generateBlocks(
        decompressedPrompt,
        decompressedAnswer,
        generateHeadings,
        isMarkdown
      )
      blocks.push(...promptBlocks, ...answerBlocks)
    }

    const canvasBlocks = generateCanvasBlocks(textDocs)
    blocks.push(...canvasBlocks)

    // Notion rejects any request containing `.children` more than 2 levels
    // deep. Deeply nested markdown bullets from the LLM can produce that, so
    // we flatten any extra nesting before chunking.
    const flattenedBlocks = limitBlockNesting(blocks, 0)

    const chunks: any[][] = []
    const chunkSize = 95 // We define a chunk size of 95 blocks
    // Notion API has a limit of 100 blocks per request but we'd rather be conservative
    const chunksCount = Math.ceil(flattenedBlocks.length / chunkSize)
    for (let i = 0; i < chunksCount; i++) {
      chunks.push(flattenedBlocks.slice(i * chunkSize, (i + 1) * chunkSize))
    }

    // Build the full Notion `properties` payload: title, url, every tag
    // property that has user-selected options, and (optionally) the joined
    // user prompts in a chosen rich_text property.
    const properties: Record<string, any> = {
      [propertiesIds.title]: {
        title: [{ text: { content: title } }]
      },
      [propertiesIds.url]: { url },
      ...generateTagProperties(database)
    }

    if (database.promptsPropertyId) {
      const joined = decompressedPrompts
        .map((p, i) => `Q${i + 1}: ${p}`)
        .join("\n\n")
      properties[database.promptsPropertyId] = {
        rich_text: toRichText(joined)
      }
    }

    return {
      chunks,
      database: {
        id: database.id,
        propertiesIds
      },
      properties,
      url,
      title
    }
  } catch (err) {
    console.log("Parsing failed for the following", params)
    console.error(err)
    throw err
  }
}

type ParseSaveParams = {
  prompts: string[]
  answers: string[]
  textDocs: ConversationTextdocs
  title: string
  database: StoredDatabase
  url: string
  generateHeadings: boolean
}
