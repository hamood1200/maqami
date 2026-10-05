import { useSyncExternalStore } from 'react'
import { MAQAMAT, type Clip, type Maqam } from './data/maqamat'
import { readJSON, writeJSON } from './store'

// تعديلات توقيت المقاطع تُحفظ محلياً ثم تُصدَّر لتُنسخ إلى ملف البيانات.
type Overrides = Record<string, { start: number; end: number }>

const KEY = 'maqami.clipOverrides'
const EDIT_KEY = 'maqami.editMode'

let overrides: Overrides = readJSON(KEY, {})
let editMode: boolean = new URLSearchParams(location.search).has('edit') || readJSON(EDIT_KEY, false)
const listeners = new Set<() => void>()
let version = 0
const emit = () => {
  version++
  listeners.forEach((l) => l())
}

export const clipKey = (maqamId: string, c: Clip) => `${maqamId}:${c.videoId}`

export function effectiveClip(maqamId: string, c: Clip): Clip {
  const o = overrides[clipKey(maqamId, c)]
  return o ? { ...c, ...o, needsReview: false } : c
}

export function saveOverride(maqamId: string, c: Clip, start: number, end: number) {
  overrides = { ...overrides, [clipKey(maqamId, c)]: { start: Math.round(start), end: Math.round(end) } }
  writeJSON(KEY, overrides)
  emit()
}

export function clearOverride(maqamId: string, c: Clip) {
  const { [clipKey(maqamId, c)]: _, ...rest } = overrides
  void _
  overrides = rest
  writeJSON(KEY, overrides)
  emit()
}

export function hasOverride(maqamId: string, c: Clip) {
  return clipKey(maqamId, c) in overrides
}

export function setEditMode(on: boolean) {
  editMode = on
  writeJSON(EDIT_KEY, on)
  emit()
}

export function useClipState() {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => version,
  )
  return { editMode, overrides }
}

export function exportOverrides(): string {
  return JSON.stringify(overrides, null, 2)
}

export interface ClipRef {
  maqam: Maqam
  clip: Clip
}

export function allClips(filter?: (m: Maqam) => boolean): ClipRef[] {
  return MAQAMAT.filter((m) => !filter || filter(m)).flatMap((m) => m.examples.map((clip) => ({ maqam: m, clip })))
}
