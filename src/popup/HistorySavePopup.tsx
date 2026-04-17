import { useEffect, useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"
import { useStorage } from "~utils/storage"

import Disclosure from "~common/components/Disclosure"
import DropdownPopup from "~common/components/Dropdown"
import Spinner from "~common/components/Spinner"
import { STORAGE_KEYS, SUPPORTED_HISTORY_SAVE } from "~utils/consts"
import { i18n } from "~utils/functions"
import type { HistorySaveError, PopupEnum, StoredDatabase } from "~utils/types"

type ChatGPTProject = {
  gizmo_id: string
  title: string
  conversationCount: number
}

function HistorySavePopup() {
  const [popup, setPopup] = useStorage<PopupEnum>(STORAGE_KEYS.popup, "history")
  const [model] = useStorage(STORAGE_KEYS.model, "chatgpt")

  const [cacheHeaders] = useStorage({
    key: STORAGE_KEYS.cacheHeaders,
    area: "session",
    isSecret: true
  })
  const [historySaveProgress] = useStorage(STORAGE_KEYS.historySaveProgress, -1)
  const [historySaveErrors] = useStorage<HistorySaveError[]>(
    STORAGE_KEYS.historySaveErrors,
    []
  )
  const [historyLength] = useStorage(STORAGE_KEYS.historyLength, 0)

  const [selectedDB, setSelectedDB] = useStorage<number>(
    STORAGE_KEYS.selectedDB,
    0
  )
  const [databases] = useStorage<StoredDatabase[]>(STORAGE_KEYS.databases, [])

  const [saving, setSaving] = useState(false)
  const [projects, setProjects] = useState<ChatGPTProject[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [projectsError, setProjectsError] = useState<string | null>(null)
  // "" = every conversation; otherwise a project gizmo_id
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")

  const currentDb = databases?.[selectedDB]

  useEffect(() => {
    if (!cacheHeaders) return
    if (model !== "chatgpt") return
    const run = async () => {
      setProjectsLoading(true)
      setProjectsError(null)
      try {
        const res: any = await sendToBackground({ name: "listProjects" })
        if (res?.err) setProjectsError(res.err)
        setProjects(res?.projects ?? [])
      } catch (err: any) {
        setProjectsError(err?.message ?? "Failed to list projects")
      } finally {
        setProjectsLoading(false)
      }
    }
    run()
  }, [cacheHeaders, model])

  const save = async () => {
    setSaving(true)
    await sendToBackground({
      name: "saveHistory",
      body: selectedProjectId ? { projectId: selectedProjectId } : undefined
    })
  }

  if (!SUPPORTED_HISTORY_SAVE.includes(model)) {
    return (
      <div>
        <p>{i18n("history_unsupported")}</p>
      </div>
    )
  }

  const selectedProjectLabel =
    selectedProjectId === ""
      ? "All conversations"
      : projects.find((p) => p.gizmo_id === selectedProjectId)?.title ??
        selectedProjectId

  if (historySaveProgress === -1)
    return (
      <div>
        <p>{i18n("history_desc")}</p>

        <div className="flex justify-between items-center my-3">
          <p className="font-bold">{i18n("index_saveTo")}</p>
          <DropdownPopup
            className="px-2 py-0.5 border border-main rounded"
            position="down"
            items={(databases ?? []).map((db, index) => (
              <button
                className="py-1 px-3"
                key={db.id}
                onClick={() => setSelectedDB(index)}>
                {db.title}
              </button>
            ))}>
            {currentDb?.title}
          </DropdownPopup>
        </div>

        {model === "chatgpt" && (
          <div className="flex justify-between items-center my-3">
            <p className="font-bold">Project</p>
            {projectsLoading ? (
              <Spinner small />
            ) : (
              <DropdownPopup
                className="px-2 py-0.5 border border-main rounded max-w-[12rem] text-right"
                position="down"
                items={[
                  <button
                    key="__all__"
                    className="py-1 px-3"
                    onClick={() => setSelectedProjectId("")}>
                    All conversations
                  </button>,
                  ...projects.map((p) => (
                    <button
                      className="py-1 px-3 text-left"
                      key={p.gizmo_id}
                      onClick={() => setSelectedProjectId(p.gizmo_id)}>
                      {p.title}{" "}
                      <span className="text-xs text-gray-500">
                        ({p.conversationCount})
                      </span>
                    </button>
                  ))
                ]}>
                <span className="truncate inline-block max-w-[11rem]">
                  {selectedProjectLabel}
                </span>
              </DropdownPopup>
            )}
          </div>
        )}

        {projectsError && (
          <p className="text-xs text-red-500 mb-2">{projectsError}</p>
        )}
        {model === "chatgpt" && !projectsLoading && projects.length === 0 && (
          <p className="text-xs text-gray-500 mb-2">
            No projects detected in your recent history. Open a conversation
            inside a Project on ChatGPT and reload this popup.
          </p>
        )}

        <button
          disabled={!cacheHeaders || saving}
          className="button w-full"
          onClick={save}>
          {!cacheHeaders ? (
            i18n("history_reload")
          ) : saving ? (
            <>
              {i18n("history_fetching")}
              <Spinner white small />
            </>
          ) : selectedProjectId ? (
            `Save this project`
          ) : (
            i18n("history_save")
          )}
        </button>
      </div>
    )

  if (historySaveProgress + historySaveErrors.length >= historyLength)
    return (
      <div>
        <p>
          <span className="font-semibold">{historySaveProgress}</span>{" "}
          {i18n("history_success")}
        </p>
        <p>
          {historySaveErrors.length} {i18n("history_fail")}
        </p>
        {historySaveErrors.length > 0 && (
          <Disclosure
            title={i18n("history_viewErrors")}
            className="w-full font-semibold text-center">
            <div className="flex flex-col h-36 overflow-y-scroll">
              {historySaveErrors.map((err) => (
                <div className="w-full" key={err.url}>
                  <a className="link" href={err.url} target="_blank">
                    {err.title}
                  </a>
                  <p className="text-red-500">{err.message}</p>
                </div>
              ))}
            </div>
          </Disclosure>
        )}
      </div>
    )

  return (
    <div>
      <p>{i18n("history_dontClose")}</p>
      <p className="font-semibold">
        {`${historySaveProgress}/${historyLength} ${i18n("history_progress")}`}
      </p>
    </div>
  )
}

export default HistorySavePopup
