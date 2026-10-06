// ملفات صوت المقاطع بدل يوتيوب:
// - على جهاز التطوير: الأغنية كاملة من src/assets/clips/<videoId>.m4a (أو mp3)، غير مرفوعة على git.
// - على الموقع: نسخة مقصوصة (المقطع مع دقيقة قبله وبعده) في جذر Bunny CDN، تصنعها tools/bunny-clips.mjs
//   وتكتب بداية كل ملف في data/clipFiles.json. التوقيتات في الموقع تبقى بتوقيت الأغنية الكاملة.
// المقطع الذي ليس له ملف يُشغَّل من يوتيوب كما كان.
// شكل الموجة محسوب مسبقاً بـ tools/clip-peaks.mjs.

import { useSyncExternalStore } from 'react'
import PEAKS from './data/clipPeaks.json'
import FILES from './data/clipFiles.json'
import { engine } from './audio/engine'
import { readJSON, writeJSON } from './store'

const CDN = 'https://maqami.b-cdn.net/'

export interface ClipSource {
  url: string
  /** موضع بداية الملف في الأغنية الكاملة (ثوانٍ) */
  offset: number
}

export function clipSource(videoId: string): ClipSource | undefined {
  const f = (FILES as Record<string, { ext: string; offset: number }>)[videoId]
  if (!f) return undefined
  // على جهاز التطوير نقرأ الأغنية الكاملة مباشرة (بدون إدخالها في البناء)
  if (import.meta.env.DEV) return { url: `/src/assets/clips/${videoId}.${f.ext}`, offset: 0 }
  return { url: `${CDN}${videoId}.${f.ext}`, offset: f.offset }
}

/** ارتفاعات أعمدة الموجة (12–100) لمقطع الموقع، إن وُجدت */
export function clipPeaks(videoId: string): number[] | undefined {
  return (PEAKS as Record<string, number[]>)[videoId]
}

// مقطع واحد يُسمع في كل لحظة
let current: HTMLAudioElement | null = null

export function claimAudio(a: HTMLAudioElement) {
  if (current && current !== a) current.pause()
  current = a
}

/** يوقف المقطع المسموع (مثلاً قبل عزف جملة على الأورغ) */
export function pauseClip() {
  current?.pause()
}

// السرعة وعلوّ الصوت: إعداد واحد لكل المقاطع ويُحفظ في المتصفح
export interface ClipSettings {
  /** 1 أو 0.75 أو 0.5، والطبقة تبقى كما هي */
  rate: number
  /** 0–2؛ فوق 1 تقوية للتسجيلات الواطية */
  vol: number
}
const KEY = 'maqami.clipSettings'
let settings: ClipSettings = { rate: 1, vol: 1, ...readJSON<Partial<ClipSettings>>(KEY, {}) }
const subs = new Set<() => void>()

export function useClipSettings(): ClipSettings {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => settings,
  )
}

export function setClipSettings(p: Partial<ClipSettings>) {
  settings = { ...settings, ...p }
  writeJSON(KEY, settings)
  subs.forEach((f) => f())
}

// عنصر الصوت لا يعلو فوق 100%، ولا يتغيّر علوّه أصلاً على الآيفون، فنمرّره عبر Web Audio
// أول مرة يُغيَّر فيها الصوت فقط (الربط لا رجعة فيه). الملف من موقع آخر يحتاج CORS و crossOrigin وإلا يصير صامتاً.
const gains = new WeakMap<HTMLAudioElement, GainNode>()

export function applyClipSettings(a: HTMLAudioElement) {
  a.playbackRate = settings.rate
  a.preservesPitch = true
  let g = gains.get(a)
  if (!g && settings.vol !== 1) {
    const ctx = engine.ensure()
    g = ctx.createGain()
    // يمنع التشويش حين نقوّي الصوت
    const limit = ctx.createDynamicsCompressor()
    limit.threshold.value = -3
    limit.knee.value = 0
    limit.ratio.value = 20
    ctx.createMediaElementSource(a).connect(g).connect(limit).connect(ctx.destination)
    gains.set(a, g)
  }
  if (g) {
    engine.ensure()
    g.gain.value = settings.vol
  }
}
