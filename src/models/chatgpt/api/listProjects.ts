/**
 * Enumerate the user's recent conversations and group them by the project
 * gizmo that ChatGPT attaches. Projects have gizmo ids of the form
 * `g-p-<uuid>-<slug>`.
 *
 * ChatGPT does not expose a clean public "list my projects" endpoint. Worse,
 * the `gizmo_id` field on conversation items isn't consistently populated —
 * some recently moved-in conversations stick the id under other keys. So we
 * collect candidate ids from several fields and trust whatever the server
 * echoes back.
 */

const PAGE_SIZE = 50
const MAX_PAGES = 10 // up to 500 recent conversations

export type ChatGPTProject = {
  gizmo_id: string
  /** Best-effort human label; falls back to a short form of the gizmo_id. */
  title: string
  /** How many conversations in the recent window belong to this project. */
  conversationCount: number
}

type ConversationItem = {
  id: string
  title?: string
  gizmo_id?: string | null
  conversation_template_id?: string | null
  project_id?: string | null
  async_status?: number
}

const PROJECT_PREFIX = "g-p-"
const PROJECT_TEMPLATE_PREFIX = "g-p-" // templates sometimes also carry g-p-

/**
 * Find every string on a conversation item that looks like a project gizmo id.
 * Some items carry the project id under `gizmo_id`, others under
 * `conversation_template_id`, others under a nested field. We scan defensively.
 */
const collectProjectIdsFromItem = (item: any): string[] => {
  const found = new Set<string>()
  const visit = (v: any) => {
    if (v == null) return
    if (typeof v === "string" && v.startsWith(PROJECT_PREFIX)) found.add(v)
    else if (Array.isArray(v)) v.forEach(visit)
    else if (typeof v === "object") Object.values(v).forEach(visit)
  }
  visit(item)
  return Array.from(found)
}

export const listChatGPTProjects = async (
  headers: any
): Promise<ChatGPTProject[]> => {
  const byId = new Map<string, ChatGPTProject>()
  let sampleLoggedOnce = false

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE
    try {
      const res = await fetch(
        `https://chatgpt.com/backend-api/conversations?offset=${offset}&limit=${PAGE_SIZE}&order=updated`,
        {
          method: "GET",
          headers: headers,
          credentials: "include"
        }
      )
      if (!res.ok) break
      const data = await res.json()
      const items: ConversationItem[] = data?.items ?? []
      if (items.length === 0) break

      if (!sampleLoggedOnce && items.length > 0) {
        // Help debugging: dump the keys we actually have to work with.
        console.log(
          "[chatgpt-to-notion] sample conversation item keys:",
          Object.keys(items[0]),
          "first item:",
          items[0]
        )
        sampleLoggedOnce = true
      }

      for (const item of items) {
        const projectIds = collectProjectIdsFromItem(item)
        for (const pid of projectIds) {
          const existing = byId.get(pid)
          if (existing) existing.conversationCount++
          else
            byId.set(pid, {
              gizmo_id: pid,
              title: deriveProjectTitle(pid),
              conversationCount: 1
            })
        }
      }

      const total: number | undefined = data?.total
      if (typeof total === "number" && offset + items.length >= total) break
    } catch (err) {
      console.error("listChatGPTProjects failed on page", page, err)
      break
    }
  }

  // Try to upgrade each title via the gizmo details endpoint. Best-effort;
  // silently skip on failure.
  await Promise.all(
    Array.from(byId.values()).map(async (project) => {
      try {
        const res = await fetch(
          `https://chatgpt.com/backend-api/gizmos/${project.gizmo_id}`,
          { method: "GET", headers, credentials: "include" }
        )
        if (!res.ok) return
        const data = await res.json()
        const name =
          data?.gizmo?.display?.name ??
          data?.gizmo?.short_url ??
          data?.gizmo?.name ??
          data?.display?.name
        if (typeof name === "string" && name.length > 0) {
          project.title = name
        }
      } catch {
        // keep derived title
      }
    })
  )

  return Array.from(byId.values()).sort(
    (a, b) => b.conversationCount - a.conversationCount
  )
}

const deriveProjectTitle = (gizmoId: string) => {
  // "g-p-<uuid>-<slug-with-hyphens>" — try to pull out the slug portion.
  const slugPart = gizmoId.replace(/^g-p-[0-9a-f]+-?/i, "")
  if (!slugPart || slugPart === gizmoId) {
    return `Project ${gizmoId.slice(-8)}`
  }
  return slugPart.replace(/-/g, " ")
}

/**
 * Fetch every conversation id that belongs to a given project.
 *
 * Strategy:
 *  1. Try the dedicated project endpoint (`/backend-api/gizmos/<id>/conversations`).
 *  2. Fall back to the conversations listing with a `gizmo_id` query parameter.
 *  3. Last resort: fetch the generic listing and filter client-side across
 *     every field that might carry a project id.
 *
 * Only the ids we can confirm belong to the target project are returned.
 */
export const listChatGPTProjectConversationIds = async (
  headers: any,
  projectGizmoId: string
): Promise<string[]> => {
  console.log(
    "[chatgpt-to-notion] listing conversations for project",
    projectGizmoId
  )

  // 1) Dedicated project endpoint
  const viaDedicated = await tryDedicatedProjectEndpoint(
    headers,
    projectGizmoId
  )
  if (viaDedicated) {
    console.log(
      `[chatgpt-to-notion] dedicated endpoint returned ${viaDedicated.length} ids`
    )
    return viaDedicated
  }

  // 2) Generic listing with gizmo_id query param
  const viaQueryParam = await tryGizmoIdQueryParam(headers, projectGizmoId)
  if (viaQueryParam) {
    console.log(
      `[chatgpt-to-notion] gizmo_id query param returned ${viaQueryParam.length} ids`
    )
    return viaQueryParam
  }

  // 3) Defensive client-side filter
  const viaClientFilter = await clientSideFilter(headers, projectGizmoId)
  console.log(
    `[chatgpt-to-notion] client-side filter returned ${viaClientFilter.length} ids`
  )
  return viaClientFilter
}

const tryDedicatedProjectEndpoint = async (
  headers: any,
  projectGizmoId: string
): Promise<string[] | null> => {
  const ids: string[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE
    try {
      const res = await fetch(
        `https://chatgpt.com/backend-api/gizmos/${projectGizmoId}/conversations?offset=${offset}&limit=${PAGE_SIZE}&order=updated`,
        {
          method: "GET",
          headers,
          credentials: "include"
        }
      )
      if (!res.ok) {
        if (page === 0) return null
        break
      }
      const data = await res.json()
      const items: ConversationItem[] = data?.items ?? []
      if (items.length === 0) break

      for (const item of items) ids.push(item.id)

      const total: number | undefined = data?.total
      if (typeof total === "number" && offset + items.length >= total) break
    } catch (err) {
      console.error("dedicated project endpoint failed", err)
      if (page === 0) return null
      break
    }
  }
  return ids
}

const tryGizmoIdQueryParam = async (
  headers: any,
  projectGizmoId: string
): Promise<string[] | null> => {
  // Probe page 0 to decide if this param works. If the response doesn't look
  // filtered (i.e. returns conversations with other project ids), reject.
  try {
    const res = await fetch(
      `https://chatgpt.com/backend-api/conversations?offset=0&limit=${PAGE_SIZE}&order=updated&gizmo_id=${encodeURIComponent(
        projectGizmoId
      )}`,
      { method: "GET", headers, credentials: "include" }
    )
    if (!res.ok) return null
    const data = await res.json()
    const items: ConversationItem[] = data?.items ?? []
    if (items.length === 0) {
      // Ambiguous: might be a real empty or might mean the param was ignored
      // and a user with no conversations. Bail to the client-side filter.
      return null
    }
    // Confirm filtering worked by checking every item carries the project id.
    const allMatch = items.every((item) =>
      collectProjectIdsFromItem(item).includes(projectGizmoId)
    )
    if (!allMatch) return null

    const ids: string[] = items.map((i) => i.id)
    const total: number | undefined = data?.total
    let offset = items.length
    for (let page = 1; page < MAX_PAGES; page++) {
      if (typeof total === "number" && offset >= total) break
      const r = await fetch(
        `https://chatgpt.com/backend-api/conversations?offset=${offset}&limit=${PAGE_SIZE}&order=updated&gizmo_id=${encodeURIComponent(
          projectGizmoId
        )}`,
        { method: "GET", headers, credentials: "include" }
      )
      if (!r.ok) break
      const d = await r.json()
      const it: ConversationItem[] = d?.items ?? []
      if (it.length === 0) break
      it.forEach((i) => ids.push(i.id))
      offset += it.length
    }
    return ids
  } catch (err) {
    console.error("gizmo_id query param failed", err)
    return null
  }
}

const clientSideFilter = async (
  headers: any,
  projectGizmoId: string
): Promise<string[]> => {
  const ids: string[] = []

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE
    try {
      const res = await fetch(
        `https://chatgpt.com/backend-api/conversations?offset=${offset}&limit=${PAGE_SIZE}&order=updated`,
        { method: "GET", headers, credentials: "include" }
      )
      if (!res.ok) break
      const data = await res.json()
      const items: ConversationItem[] = data?.items ?? []
      if (items.length === 0) break

      for (const item of items) {
        if (collectProjectIdsFromItem(item).includes(projectGizmoId)) {
          ids.push(item.id)
        }
      }

      const total: number | undefined = data?.total
      if (typeof total === "number" && offset + items.length >= total) break
    } catch (err) {
      console.error("clientSideFilter failed", err)
      break
    }
  }

  return ids
}
