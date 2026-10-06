// ملفات صوت المقاطع المستضافة في الموقع نفسه بدل يوتيوب.
// الملف يُسمّى بمعرّف الفيديو: src/assets/clips/<videoId>.mp3 (أو m4a)،
// ويحتوي الأغنية كاملة؛ البداية والنهاية تبقيان من بيانات المقطع.
// المقطع الذي ليس له ملف يُشغَّل من يوتيوب كما كان.
// شكل الموجة محسوب مسبقاً بـ tools/clip-peaks.mjs.

import { useSyncExternalStore } from 'react'
import PEAKS from './data/clipPeaks.json'
import { engine } from './audio/engine'
import { readJSON, writeJSON } from './store'

const files = import.meta.glob('./assets/clips/*.{mp3,m4a,aac,ogg,opus}', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>

const byId = new Map(Object.entries(files).map(([path, url]) => [path.split('/').pop()!.replace(/\.[^.]+$/, ''), url]))

export function clipAudioUrl(videoId: string): string | undefined {
  return byId.get(videoId)
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
// أول مرة يُغيَّر فيها الصوت فقط (الربط لا رجعة فيه). يتطلب أن يكون الملف من نفس الموقع.
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
