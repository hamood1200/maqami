import { noteCents } from '../data/notes'
import { descendingNote, type Maqam } from '../data/maqamat'
import type { SeqEvent } from './engine'

export type PlayMode = 'up' | 'down' | 'updown' | 'phrase'

/** الدرجة + المدة بالنبضات */
type Step = [degree: number, beats: number]

// جمل لحنية بسيطة تحاكي "سير" المقام: تبدأ من القرار، تتحرك حول الجنس الأول، تلمس الغماز وتعود.
const PHRASES: Step[][] = [
  [[0, 1], [1, 0.5], [2, 0.5], [3, 1], [2, 0.5], [1, 0.5], [2, 0.5], [1, 0.5], [0, 2]],
  [[0, 0.5], [1, 0.5], [2, 0.5], [3, 0.5], [4, 1.5], [3, 0.5], [2, 0.5], [3, 0.5], [2, 0.5], [1, 0.5], [0, 2]],
  [[2, 0.5], [3, 0.5], [4, 1], [5, 0.5], [4, 0.5], [3, 0.5], [2, 0.5], [1, 1], [2, 0.5], [1, 0.5], [0, 2]],
  [[0, 0.5], [2, 0.5], [1, 0.5], [3, 0.5], [2, 0.5], [4, 1], [5, 0.5], [6, 0.5], [7, 1.5], [6, 0.5], [5, 0.5], [4, 1], [3, 0.5], [2, 0.5], [1, 0.5], [0, 2]],
  [[4, 1], [3, 0.5], [2, 0.5], [3, 0.5], [2, 0.5], [1, 0.5], [0, 0.5], [1, 0.5], [2, 0.5], [1, 0.5], [0, 2]],
]

export function phraseCount() {
  return PHRASES.length
}

export function maqamEvents(m: Maqam, mode: PlayMode, bpm: number, opts: { transpose?: number; phrase?: number } = {}): SeqEvent[] {
  const beat = 60 / bpm
  const tr = opts.transpose ?? 0
  const n = m.notes.length
  const up = m.notes.map((note, i) => ({ cents: noteCents(note) + tr, tag: i }))
  const down = Array.from({ length: n }, (_, k) => {
    const d = n - 1 - k
    return { cents: noteCents(descendingNote(m, d)) + tr, tag: d }
  })

  let seq: { cents: number; tag: number; beats: number }[] = []
  if (mode === 'up') seq = up.map((x, i) => ({ ...x, beats: i === n - 1 ? 2 : 1 }))
  else if (mode === 'down') seq = down.map((x, i) => ({ ...x, beats: i === n - 1 ? 2 : 1 }))
  else if (mode === 'updown')
    seq = [...up.map((x) => ({ ...x, beats: 1 })), ...down.slice(1).map((x, i, a) => ({ ...x, beats: i === a.length - 1 ? 2 : 1 }))]
  else {
    const p = PHRASES[(opts.phrase ?? 0) % PHRASES.length]
    let prev = -1
    seq = p.map(([deg, beats]) => {
      // في الحركة الهابطة نستخدم نغمات الهبوط إن اختلفت
      const goingDown = prev > deg
      prev = deg
      const note = goingDown ? descendingNote(m, deg) : m.notes[deg]
      return { cents: noteCents(note) + tr, tag: deg, beats }
    })
  }

  let t = 0
  return seq.map((s) => {
    const e: SeqEvent = { cents: s.cents, t, dur: s.beats * beat, tag: s.tag }
    t += s.beats * beat
    return e
  })
}

export function notesEvents(notes: string[], bpm: number, opts: { updown?: boolean; transpose?: number } = {}): SeqEvent[] {
  const beat = 60 / bpm
  const tr = opts.transpose ?? 0
  const idx = notes.map((_, i) => i)
  const order = opts.updown ? [...idx, ...idx.slice(0, -1).reverse()] : idx
  return order.map((i, k) => ({
    cents: noteCents(notes[i]) + tr,
    t: k * beat,
    dur: k === order.length - 1 ? beat * 2 : beat,
    tag: i,
  }))
}

/** نغمة من لحن أغنية: [الطبقة بالسنت من C4، بدايتها من أول الجملة، مدتها] بالثواني */
export type SongNote = [cents: number, t: number, dur: number]

/** جملة مستخرجة من لحن أغنية (src/data/clipPhrases.json): نفس نغمات المطرب وطبقته وإيقاعه، ملقوطة على نغمات المقام */
export function songPhraseEvents(notes: SongNote[]): SeqEvent[] {
  return notes.map(([cents, t, dur], i) => ({ cents, t, dur: i === notes.length - 1 ? Math.max(dur, 0.6) : Math.max(dur, 0.15) }))
}
