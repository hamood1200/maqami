import { useSyncExternalStore } from 'react'
import { engine, type Timbre } from './audio/engine'

// إعدادات بسيطة تُحفظ في متصفح المستخدم
export interface Settings {
  timbre: Timbre
  bpm: number
  volume: number
  showTraditional: boolean
}

const KEY = 'maqami.settings'
const defaults: Settings = { timbre: 'oriental', bpm: 108, volume: 0.8, showTraditional: true }

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...defaults, ...JSON.parse(raw) }
  } catch {
    /* التخزين غير متاح */
  }
  return defaults
}

let state = load()
engine.timbre = state.timbre
engine.volume = state.volume
const listeners = new Set<() => void>()

export function setSettings(patch: Partial<Settings>) {
  state = { ...state, ...patch }
  if (patch.timbre) engine.timbre = patch.timbre
  if (patch.volume !== undefined) engine.setVolume(patch.volume)
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* تجاهل */
  }
  listeners.forEach((l) => l())
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* تجاهل */
  }
}
