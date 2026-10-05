import { useEffect, useMemo, useRef, useState } from 'react'
import { isBlackKey, physicalKey, noteCents, parseNote, LETTER_AR } from '../data/notes'
import { engine, type Voice } from '../audio/engine'
import { AccGlyph } from './NoteName'

export interface KeyMark {
  note: string
  detune: number
  role: 'tonic' | 'ghammaz' | 'note'
  /** رقم الجنس للتلوين */
  jins: number
}

interface Props {
  /** نغمات المقام/الجنس المعروض */
  notes: string[]
  /** نغمات إضافية (مثل نغمات الهبوط) تظهر بلون أخف */
  extraNotes?: string[]
  tonic?: number
  ghammaz?: number
  /** رقم الجنس لكل درجة */
  jinsOf?: (degree: number) => number
  /** المفاتيح المضيئة حالياً أثناء التشغيل (بالسنت) */
  lit?: Set<number>
  keyboardShortcuts?: boolean
}

const HOME_ROW = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote']
const TOP_ROW = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight']

function whiteFloor(semi: number) {
  while (isBlackKey(semi)) semi--
  return semi
}
function whiteCeil(semi: number) {
  while (isBlackKey(semi)) semi++
  return semi
}

export function Keyboard({ notes, extraNotes = [], tonic = 0, ghammaz, jinsOf, lit, keyboardShortcuts = true }: Props) {
  // خريطة المفاتيح: كل مفتاح فيزيائي ← النغمة المضبوطة عليه في هذا المقام
  const marks = useMemo(() => {
    const m = new Map<number, KeyMark & { extra?: boolean }>()
    extraNotes.forEach((n) => {
      const { key, detune } = physicalKey(noteCents(n))
      if (!m.has(key)) m.set(key, { note: n, detune, role: 'note', jins: -1, extra: true })
    })
    const tonicCents = noteCents(notes[tonic])
    notes.forEach((n, i) => {
      const c = noteCents(n)
      const { key, detune } = physicalKey(c)
      const role = (c - tonicCents) % 1200 === 0 ? 'tonic' : i === ghammaz ? 'ghammaz' : 'note'
      m.set(key, { note: n, detune, role, jins: jinsOf ? jinsOf(i) : 0 })
    })
    return m
  }, [notes, extraNotes, tonic, ghammaz, jinsOf])

  const [low, high] = useMemo(() => {
    const keys = [...marks.keys()]
    let lo = whiteFloor(Math.min(...keys) - 2)
    let hi = whiteCeil(Math.max(...keys) + 2)
    // حد أدنى لعرض لوحة مريحة
    let whites = 0
    for (let s = lo; s <= hi; s++) if (!isBlackKey(s)) whites++
    while (whites < 11) {
      hi = whiteCeil(hi + 1)
      whites++
      if (whites < 11) {
        lo = whiteFloor(lo - 1)
        whites++
      }
    }
    return [lo, hi]
  }, [marks])

  const whites: number[] = []
  const blacks: { semi: number; before: number }[] = []
  for (let s = low; s <= high; s++) {
    if (isBlackKey(s)) blacks.push({ semi: s, before: whites.length })
    else whites.push(s)
  }

  const voices = useRef(new Map<number, Voice>())
  const [pressed, setPressed] = useState<Set<number>>(new Set())

  const centsFor = (semi: number) => semi * 100 + (marks.get(semi)?.detune ?? 0)

  const down = (semi: number) => {
    if (voices.current.has(semi)) return
    voices.current.set(semi, engine.noteOn(centsFor(semi)))
    setPressed((p) => new Set(p).add(semi))
  }
  const up = (semi: number) => {
    voices.current.get(semi)?.stop()
    voices.current.delete(semi)
    setPressed((p) => {
      const n = new Set(p)
      n.delete(semi)
      return n
    })
  }

  // إيقاف أي نغمة ممسوكة عند تغيّر المقام
  useEffect(() => {
    const v = voices.current
    return () => {
      v.forEach((x) => x.stop())
      v.clear()
      setPressed(new Set())
    }
  }, [marks])

  const codeMap = useMemo(() => {
    const map = new Map<string, number>()
    whites.forEach((s, i) => HOME_ROW[i] && map.set(HOME_ROW[i], s))
    blacks.forEach((b) => TOP_ROW[b.before] && map.set(TOP_ROW[b.before], b.semi))
    return map
  }, [low, high])

  const downRef = useRef(down)
  const upRef = useRef(up)
  downRef.current = down
  upRef.current = up

  useEffect(() => {
    if (!keyboardShortcuts) return
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return
      const s = codeMap.get(e.code)
      if (s !== undefined) {
        e.preventDefault()
        downRef.current(s)
      }
    }
    const onUp = (e: KeyboardEvent) => {
      const s = codeMap.get(e.code)
      if (s !== undefined) upRef.current(s)
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [codeMap, keyboardShortcuts])

  const isLit = (semi: number) => pressed.has(semi) || (lit ? lit.has(centsFor(semi)) : false)

  const keyProps = (semi: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
      down(semi)
    },
    onPointerUp: () => up(semi),
    onPointerLeave: () => up(semi),
    onPointerCancel: () => up(semi),
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.buttons === 1) down(semi)
    },
  })

  const label = (mark: KeyMark) => {
    const p = parseNote(mark.note)
    return (
      <span className="key-label">
        {LETTER_AR[p.letter]}
        <AccGlyph acc={p.acc} />
      </span>
    )
  }

  const cls = (semi: number, base: string) => {
    const mark = marks.get(semi)
    const c = [base]
    if (mark) {
      c.push(mark.extra ? 'in-extra' : `in-maqam jins-${mark.jins}`)
      if (mark.role === 'tonic') c.push('is-tonic')
      if (mark.role === 'ghammaz') c.push('is-ghammaz')
      if (mark.detune) c.push('is-quarter')
    }
    if (isLit(semi)) c.push('lit')
    return c.join(' ')
  }

  const W = whites.length

  return (
    <div className="keyboard-wrap">
      <div className="keyboard" dir="ltr" style={{ ['--w' as string]: W }}>
        {whites.map((s) => {
          const mark = marks.get(s)
          return (
            <button key={s} type="button" className={cls(s, 'key white')} {...keyProps(s)} aria-label={mark?.note ?? `key ${s}`}>
              {mark?.detune ? <span className="quarter-badge">¼↓</span> : null}
              {mark ? label(mark) : null}
            </button>
          )
        })}
        {blacks.map(({ semi, before }) => {
          const mark = marks.get(semi)
          return (
            <button
              key={semi}
              type="button"
              className={cls(semi, 'key black')}
              style={{ ['--b' as string]: before }}
              {...keyProps(semi)}
              aria-label={mark?.note ?? `key ${semi}`}
            >
              {mark?.detune ? <span className="quarter-badge">¼↓</span> : null}
              {mark ? label(mark) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
