import { useEffect, useState } from "react"

import { useStorage } from "~utils/storage"

import { STORAGE_KEYS } from "~utils/consts"
import type { StoredDatabase } from "~utils/types"
import type { SelectPropertyResponse } from "~utils/types/notion"

type TagProp = StoredDatabase["tags"][number]

const useTags = () => {
  const [selectedDB] = useStorage<number>(STORAGE_KEYS.selectedDB, 0)
  const [databases, setDatabases] = useStorage<StoredDatabase[]>(
    STORAGE_KEYS.databases,
    []
  )

  const [db, setCurrentDB] = useState<StoredDatabase | null>(null)
  const [tagProp, setCurrentTagProp] = useState<TagProp | null>(null)
  const [selectedIndices, setSelectedIndices] = useState<number[]>([])

  useEffect(() => {
    if (!databases || databases.length == 0) return
    const _db = databases[selectedDB]
    if (!_db) return
    setCurrentDB(_db)
    if (!_db.tags || _db.tags.length == 0) {
      setCurrentTagProp(null)
      setSelectedIndices([])
      return
    }
    const prop = _db.tags[_db.tagPropertyIndex] ?? _db.tags[0]
    setCurrentTagProp(prop)
    const fromMap = _db.tagSelections?.[prop.id]
    if (fromMap && fromMap.length > 0) {
      setSelectedIndices(fromMap)
    } else if (_db.tagIndex >= 0) {
      // Legacy single-index fallback (pre-migration saves)
      setSelectedIndices([_db.tagIndex])
    } else {
      setSelectedIndices([])
    }
  }, [databases, selectedDB])

  const mutateDbs = (
    mutator: (db: StoredDatabase) => StoredDatabase
  ): Promise<StoredDatabase[]> =>
    new Promise((resolve) => {
      setDatabases((prev) => {
        if (!prev) {
          resolve([])
          return []
        }
        const next = prev.map((d, i) => (i === selectedDB ? mutator(d) : d))
        resolve(next)
        return next
      })
    })

  const selectTagProp = async (index: number) => {
    await mutateDbs((d) => ({
      ...d,
      tagPropertyIndex: index,
      tagIndex: -1
    }))
  }

  /** For single-select properties: set (or clear with -1) the single selected option. */
  const selectTag = async (index: number) => {
    const prop = tagProp
    if (!prop) return
    await mutateDbs((d) => {
      const selections = { ...(d.tagSelections ?? {}) }
      if (index === -1) delete selections[prop.id]
      else selections[prop.id] = [index]
      return {
        ...d,
        tagIndex: index,
        tagSelections: selections
      }
    })
  }

  /** For multi-select properties: toggle an option in/out of the selection. */
  const toggleTag = async (index: number) => {
    const prop = tagProp
    if (!prop) return
    await mutateDbs((d) => {
      const selections = { ...(d.tagSelections ?? {}) }
      const current = selections[prop.id] ?? []
      const exists = current.includes(index)
      const next = exists
        ? current.filter((i) => i !== index)
        : [...current, index]
      if (next.length === 0) delete selections[prop.id]
      else selections[prop.id] = next
      return {
        ...d,
        tagIndex: next[0] ?? -1,
        tagSelections: selections
      }
    })
  }

  const clearTagsForProp = async () => {
    const prop = tagProp
    if (!prop) return
    await mutateDbs((d) => {
      const selections = { ...(d.tagSelections ?? {}) }
      delete selections[prop.id]
      return {
        ...d,
        tagIndex: -1,
        tagSelections: selections
      }
    })
  }

  const selectedOptions: SelectPropertyResponse[] = tagProp
    ? selectedIndices
        .filter((i) => i >= 0 && i < tagProp.options.length)
        .map((i) => tagProp.options[i])
    : []

  return {
    db,
    tagProp,
    /** First selected option (legacy field used by existing code paths). */
    tag: selectedOptions[0] ?? null,
    /** All selected option indices for the current property. */
    selectedIndices,
    /** All selected option objects for the current property. */
    selectedTags: selectedOptions,
    selectTagProp,
    selectTag,
    toggleTag,
    clearTagsForProp
  }
}

export default useTags
