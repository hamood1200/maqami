import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AJNAS } from '../data/ajnas'
import { MAQAMAT, type JinsPlacement } from '../data/maqamat'
import { intervalShort, noteCents } from '../data/notes'
import { engine } from '../audio/engine'
import { notesEvents } from '../audio/phrases'
import { NoteName } from '../components/NoteName'
import { SoundSettings } from '../components/SoundSettings'
import { usePlayback } from '../usePlayback'
import { useSettings } from '../store'
import { href } from '../router'
import { arNum } from '../format'

// الديوان دائرة: فوق دو، وكل نصف تون 30°. المقام يصير شكلاً، والفرق بين مقامين يُرى بالعين.

interface Shape {
  key: string
  name: string
  kind: 'jins' | 'maqam'
  /** نغمات الشكل صعوداً (للمقام: بدون الجواب) */
  notes: string[]
  /** هل يُغلق الشكل بالرجوع إلى القرار (المقام كامل) */
  closed: boolean
  ajnas?: JinsPlacement[]
  ghammaz?: number
  maqamId?: string
}

const SHAPES: Shape[] = [
  ...AJNAS.map((j) => ({ key: `j:${j.id}`, name: `جنس ${j.name}`, kind: 'jins' as const, notes: j.notes, closed: false })),
  ...MAQAMAT.map((m) => ({
    key: `m:${m.id}`,
    name: `مقام ${m.name}`,
    kind: 'maqam' as const,
    notes: m.notes.slice(0, -1),
    closed: true,
    ajnas: m.ajnas,
    ghammaz: m.ghammaz,
    maqamId: m.id,
  })),
]
const byKey = (k: string) => SHAPES.find((s) => s.key === k)

/** أزواج تعليمية جاهزة */
const PAIRS: { a: string; b: string; real?: boolean; label: string }[] = [
  { a: 'j:ajam', b: 'j:nahawand', label: 'عجم ↔ نهاوند' },
  { a: 'j:rast', b: 'j:nahawand', label: 'راست ↔ نهاوند' },
  { a: 'j:bayati', b: 'j:saba', label: 'بياتي ↔ صبا' },
  { a: 'j:kurd', b: 'j:hijaz', label: 'كرد ↔ حجاز' },
  { a: 'm:hijaz', b: 'm:hijazkar', label: 'حجاز ↔ حجاز كار' },
  { a: 'm:rast', b: 'm:bayati', real: true, label: 'راست وبياتي على الدائرة الحقيقية' },
]

// كتابة كل ربع تون حول الدائرة (لأسماء الحلقة)
const RING_NAMES = ['C4', 'Ch#4', 'Db4', 'Dhb4', 'D4', 'Dh#4', 'Eb4', 'Ehb4', 'E4', 'Eh#4', 'F4', 'Fh#4', 'F#4', 'Ghb4', 'G4', 'Gh#4', 'Ab4', 'Ahb4', 'A4', 'Ah#4', 'Bb4', 'Bhb4', 'B4', 'Bh#4']
const NATURAL_STEPS = new Set([0, 4, 8, 10, 14, 18, 22])
const ORDINAL = ['القرار', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة']

const step = (c: number) => (((Math.round(c / 50) % 24) + 24) % 24)
const C = 200
const R = 138

/** نقطة على الدائرة: الزاوية مع عقارب الساعة من الأعلى */
function pt(cents: number, r = R) {
  const a = (cents / 1200) * 2 * Math.PI
  return { x: C + r * Math.sin(a), y: C - r * Math.cos(a) }
}
const pct = (p: { x: number; y: number }) => ({ left: `${(p.x / 400) * 100}%`, top: `${(p.y / 400) * 100}%` })

/** تحريك ناعم لمجموعة أرقام (ينزلق الشكل من مقام لآخر) */
function useTween(target: number[], ms = 650) {
  const [v, setV] = useState(target)
  const cur = useRef(target)
  const key = target.join(',')
  useEffect(() => {
    const from = cur.current
    if (from.length !== target.length || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cur.current = target
      setV(target)
      return
    }
    const t0 = performance.now()
    let id = 0
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms)
      const e = 1 - Math.pow(1 - k, 3)
      const next = target.map((x, i) => from[i] + (x - from[i]) * e)
      cur.current = next
      setV(next)
      if (k < 1) id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  // تغيّر عدد النغمات: لا نرسم القيم القديمة ولو لإطار واحد
  return v.length === target.length ? v : target
}

function visibleNotes(s: Shape, firstOnly: boolean) {
  if (!firstOnly || s.kind !== 'maqam' || !s.ajnas?.length) return { notes: s.notes, closed: s.closed }
  return { notes: s.notes.slice(0, s.ajnas[0].length), closed: false }
}

export function CirclePage() {
  const settings = useSettings()
  const { playing, litDegree, play, stop } = usePlayback()
  const [aKey, setAKey] = useState('m:rast')
  const [bKey, setBKey] = useState('')
  const [real, setReal] = useState(false)
  const [firstOnly, setFirstOnly] = useState(false)

  const A = byKey(aKey)!
  const B = bKey ? byKey(bKey) : undefined
  const a = visibleNotes(A, firstOnly)
  const b = B ? visibleNotes(B, firstOnly) : null
  const aTonic = noteCents(a.notes[0])
  const aRel = a.notes.map((n) => noteCents(n) - aTonic)
  const bTonic = b ? noteCents(b.notes[0]) : 0
  const bRel = b ? b.notes.map((n) => noteCents(n) - bTonic) : []
  // مكان قرار الثاني على الدائرة: قرار الأول (للمقارنة بالشكل) أو موضعه الحقيقي
  const bBase = real ? bTonic : aTonic

  // تدوير الدائرة: القرار فوق، أو دو فوق. نأخذ أقصر طريق.
  const rotTarget = real ? 0 : -aTonic
  const lastRot = useRef(rotTarget)
  const rotGoal = rotTarget + 1200 * Math.round((lastRot.current - rotTarget) / 1200)
  lastRot.current = rotGoal

  const [rot, ...aAbs] = useTween([rotGoal, ...aRel.map((r) => aTonic + r)])
  const bAbs = useTween(bRel.map((r) => bBase + r))

  const aSteps = new Set(aRel.map((r) => step(aTonic + r)))
  const bSteps = new Set(bRel.map((r) => step(bBase + r)))
  // نغمات الأول التي لا توجد في الثاني والعكس
  const aOnly = (i: number) => !!b && !bSteps.has(step(aTonic + aRel[i]))
  const bOnly = (i: number) => !aSteps.has(step(bBase + bRel[i]))

  const runA = () => (playing === 'a' ? stop() : play('a', notesEvents(closeNotes(A, a), settings.bpm, { updown: true })))
  const runB = () =>
    !B || !b ? undefined : playing === 'b' ? stop() : play('b', notesEvents(closeNotes(B, b), settings.bpm, { updown: true, transpose: bBase - bTonic }))

  // أي جنس يلوّن كل ضلع
  const edgeJins = (i: number) => {
    if (!A.ajnas || firstOnly) return 0
    const k = A.ajnas.findIndex((j) => i >= j.at && i < j.at + j.length - 1)
    return k < 0 ? -1 : k
  }

  const edges = (abs: number[], closed: boolean) => {
    const out: [number, number, number][] = []
    for (let i = 0; i < abs.length - 1; i++) out.push([abs[i], abs[i + 1], i])
    if (closed) out.push([abs[abs.length - 1], abs[0] + 1200, abs.length - 1])
    return out
  }

  const pathOf = (abs: number[], closed: boolean) => {
    const pts = abs.map((c) => pt(c + rot))
    return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') + (closed ? ' Z' : '')
  }

  const diffs = useMemo(() => {
    if (!b) return []
    const n = Math.min(aRel.length, bRel.length)
    const out: { i: number; d: number }[] = []
    for (let i = 1; i < n; i++) if (aRel[i] !== bRel[i]) out.push({ i, d: bRel[i] - aRel[i] })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aKey, bKey, firstOnly])

  const sharedReal = b ? [...new Set(a.notes.map((n) => step(noteCents(n))))].filter((s) => b.notes.some((n) => step(noteCents(n)) === s)).length : 0

  const pickPair = (p: (typeof PAIRS)[number]) => {
    stop()
    setAKey(p.a)
    setBKey(p.b)
    setReal(!!p.real)
  }

  // اسم درجة الثاني: الحقيقي، أو (عند المقارنة بالشكل) بحرف درجة الأول نفسها — دو# لا ري♭ في السابعة
  const bName = (i: number) => (real ? b!.notes[i] : spellAs(step(bBase + bRel[i]), a.notes[i]))

  // أسماء الحلقة: الطبيعية دائماً، وغيرها حين تقع عليه نغمة من الثاني
  const ringLabel = (s: number): ReactNode => {
    if (aSteps.has(s)) return null
    const bi = bRel.findIndex((r) => step(bBase + r) === s)
    if (bi >= 0) return <NoteName note={bName(bi)} />
    if (NATURAL_STEPS.has(s)) return <NoteName note={RING_NAMES[s]} />
    return null
  }

  return (
    <div className="circle-page">
      <header className="page-head">
        <h1>دائرة المقامات</h1>
        <p className="lead">
          تخيّل الديوان ساعة: فوق دو، وكل نصف تون ثلاثون درجة، وكل ربع تون خمس عشرة. كل جنس وكل مقام يصير شكلاً على الدائرة، فترى بعينك لماذا يختلف
          الراست عن النهاوند، والحجاز عن الكرد، قبل أن تسمعه بأذنك.
        </p>
      </header>

      <section className="panel circ-panel">
        <div className="panel-label">الدائرة</div>

        <div className="circ-controls">
          <label className="circ-field">
            <span>الشكل</span>
            <ShapeSelect value={aKey} onChange={(k) => (stop(), setAKey(k))} />
          </label>
          <label className="circ-field">
            <span>قارن مع</span>
            <ShapeSelect value={bKey} onChange={(k) => (stop(), setBKey(k))} allowNone />
          </label>
          <div className="btn-group" role="group" aria-label="طريقة العرض">
            <button type="button" className={`btn btn-small ${!real ? 'btn-primary' : ''}`} aria-pressed={!real} onClick={() => setReal(false)}>
              القرار فوق
            </button>
            <button type="button" className={`btn btn-small ${real ? 'btn-primary' : ''}`} aria-pressed={real} onClick={() => setReal(true)}>
              النغمات الحقيقية
            </button>
          </div>
          {(A.kind === 'maqam' || B?.kind === 'maqam') && (
            <label className="check">
              <input type="checkbox" checked={firstOnly} onChange={(e) => setFirstOnly(e.target.checked)} />
              <span>الجنس الأول فقط</span>
            </label>
          )}
        </div>

        <div className="circ-pairs">
          <span className="muted">جرّب:</span>
          {PAIRS.map((p) => (
            <button key={p.label} type="button" className={`pill pill-sm ${aKey === p.a && bKey === p.b ? 'is-on' : ''}`} onClick={() => pickPair(p)}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="circ-stage">
          <div className="circ-wrap">
            <svg viewBox="0 0 400 400" className="circ-svg" aria-hidden="true">
              <circle cx={C} cy={C} r={R} className="circ-ring" />
              {Array.from({ length: 24 }, (_, s) => {
                const kind = NATURAL_STEPS.has(s) ? 'nat' : s % 2 === 0 ? 'semi' : 'quarter'
                const len = kind === 'nat' ? 11 : kind === 'semi' ? 7 : 4
                const p1 = pt(s * 50 + rot, R - len)
                const p2 = pt(s * 50 + rot, R + len)
                return <line key={s} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} className={`circ-tick tick-${kind}`} />
              })}
              {/* الشكل الأول */}
              <path d={pathOf(aAbs, a.closed)} className="circ-fill" />
              {edges(aAbs, a.closed).map(([c1, c2, i]) => {
                const p1 = pt(c1 + rot)
                const p2 = pt(c2 + rot)
                return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} className={`circ-edge edge-j${edgeJins(i)}`} />
              })}
              {/* الشكل الثاني للمقارنة */}
              {b && <path d={pathOf(bAbs, b.closed)} className="circ-b-path" />}
              {b &&
                bAbs.map((c, i) => {
                  const p = pt(c + rot)
                  return <circle key={i} cx={p.x} cy={p.y} r={bOnly(i) ? 9 : 21} className={`circ-b-node ${bOnly(i) ? 'is-diff' : ''} ${playing === 'b' && litDegree === i ? 'lit' : ''}`} />
                })}
              {aAbs.map((c, i) => {
                const p = pt(c + rot)
                const cls = [
                  'circ-node',
                  i === 0 ? 'is-tonic' : '',
                  !firstOnly && i === A.ghammaz ? 'is-ghammaz' : '',
                  aOnly(i) ? 'is-diff' : '',
                  playing === 'a' && litDegree === i ? 'lit' : '',
                ].join(' ')
                return (
                  <g key={i} className={cls} onClick={() => engine.playNote(noteCents(a.notes[i]), 0.7)}>
                    <circle cx={p.x} cy={p.y} r={16} />
                    <text x={p.x} y={p.y} dy="0.36em" textAnchor="middle">
                      {arNum(i + 1)}
                    </text>
                  </g>
                )
              })}
            </svg>

            {/* أسماء الحلقة */}
            {Array.from({ length: 24 }, (_, s) => {
              const label = ringLabel(s)
              if (!label) return null
              return (
                <span key={s} className={`circ-ring-label ${bSteps.has(s) && !aSteps.has(s) ? 'is-b' : ''}`} style={pct(pt(s * 50 + rot, R + 30))}>
                  {label}
                </span>
              )
            })}
            {/* أسماء نغمات الشكل الأول */}
            {aAbs.map((c, i) => (
              <button
                key={i}
                type="button"
                className={`circ-note-label ${aOnly(i) ? 'is-diff' : ''}`}
                style={pct(pt(c + rot, R + 32))}
                onClick={() => engine.playNote(noteCents(a.notes[i]), 0.7)}
              >
                <NoteName note={a.notes[i]} />
              </button>
            ))}
            {/* المسافات على الأضلاع */}
            {edges(aAbs, a.closed).map(([c1, c2, i]) => {
              const mid = (c1 + c2) / 2
              const chord = Math.cos(((c2 - c1) / 1200) * Math.PI)
              return (
                <span key={i} className={`circ-interval edge-j${edgeJins(i)}`} style={pct(pt(mid + rot, R * chord - 16))}>
                  {intervalShort(Math.round(c2 - c1))}
                </span>
              )
            })}
          </div>

          <aside className="circ-side">
            <div className="circ-card">
              <div className="circ-card-head">
                <button type="button" className={`mini-play ${playing === 'a' ? 'playing' : ''}`} onClick={runA} aria-label={`استمع إلى ${A.name}`}>
                  {playing === 'a' ? '■' : '▶︎'}
                </button>
                <h3>{A.name}</h3>
                {A.maqamId && (
                  <a className="pill pill-sm" href={href.maqam(A.maqamId)}>
                    صفحته
                  </a>
                )}
              </div>
              <IntervalRow rel={aRel} closed={a.closed} />
              {A.ajnas && !firstOnly && (
                <p className="circ-ajnas">
                  {A.ajnas.map((j, k) => (
                    <span key={k} className={`circ-jins-tag edge-j${k}`}>
                      {j.label ?? AJNAS.find((x) => x.id === j.jins)?.name} على الدرجة {arNum(j.at + 1)}
                    </span>
                  ))}
                </p>
              )}
            </div>

            {B && b && (
              <div className="circ-card is-b">
                <div className="circ-card-head">
                  <button type="button" className={`mini-play ${playing === 'b' ? 'playing' : ''}`} onClick={runB} aria-label={`استمع إلى ${B.name}`}>
                    {playing === 'b' ? '■' : '▶︎'}
                  </button>
                  <h3>{B.name}</h3>
                  <span className="circ-b-key" aria-hidden="true" />
                </div>
                <IntervalRow rel={bRel} closed={b.closed} />
                {!real && bTonic !== aTonic && <p className="muted circ-note">نسمعه ونرسمه من قرار الأول نفسه حتى تقارن الشكلين.</p>}
              </div>
            )}

            {B && b && (
              <div className="circ-diff">
                <h4>الفرق</h4>
                {real && bTonic !== aTonic ? (
                  <p>
                    القرار مختلف: الأول على <NoteName note={a.notes[0]} /> والثاني على <NoteName note={b.notes[0]} />. يشتركان في {arNum(sharedReal)} من النغمات
                    {sharedReal >= Math.min(aRel.length, bRel.length) ? ' — أي نفس النغمات تماماً، والقرار وحده يغيّر المقام.' : '.'}
                  </p>
                ) : diffs.length === 0 ? (
                  <p>نفس المسافات في هذا الجزء؛ الفرق خارجه أو في القرار.</p>
                ) : (
                  <ul>
                    {diffs.map(({ i, d }) => (
                      <li key={i}>
                        الدرجة {ORDINAL[i] ?? arNum(i + 1)}: <NoteName note={a.notes[i]} /> في الأول، و
                        <NoteName note={bName(i)} /> في الثاني — {d > 0 ? 'أعلى' : 'أخفض'} ب{quarterWords(Math.abs(d))}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <ul className="circ-legend">
              <li>
                <i className="lg lg-tonic" /> القرار
              </li>
              {!firstOnly && A.ghammaz !== undefined && (
                <li>
                  <i className="lg lg-ghammaz" /> الغمّاز
                </li>
              )}
              {B && (
                <>
                  <li>
                    <i className="lg lg-b" /> {B.name}
                  </li>
                  <li>
                    <i className="lg lg-diff" /> نغمة مختلفة
                  </li>
                </>
              )}
            </ul>
          </aside>
        </div>
        <SoundSettings />
      </section>
    </div>
  )
}

/** نغمات التشغيل: المقام يُختم بالجواب */
function closeNotes(s: Shape, v: { notes: string[]; closed: boolean }) {
  if (!v.closed) return v.notes
  const top = MAQAMAT.find((m) => m.id === s.maqamId)?.notes.at(-1)
  return top ? [...v.notes, top] : v.notes
}

/** كتابة ربع التون بحرف نغمة معيّنة إن أمكن */
function spellAs(s: number, like?: string) {
  const letter = like?.[0]
  for (const acc of ['', 'b', '#', 'hb', 'h#']) if (letter && step(noteCents(`${letter}${acc}4`)) === s) return `${letter}${acc}4`
  return RING_NAMES[s]
}

function quarterWords(c: number) {
  const map: Record<number, string> = { 50: 'ربع تون', 100: 'نصف تون', 150: 'ثلاثة أرباع التون', 200: 'تون' }
  return map[c] ?? `${arNum(c / 200)} تون`
}

function IntervalRow({ rel, closed }: { rel: number[]; closed: boolean }) {
  const steps = rel.slice(1).map((r, i) => r - rel[i])
  if (closed) steps.push(1200 - rel[rel.length - 1])
  return (
    <div className="circ-steps" dir="ltr">
      {steps.map((s, i) => (
        <span key={i}>{intervalShort(s)}</span>
      ))}
    </div>
  )
}

function ShapeSelect({ value, onChange, allowNone }: { value: string; onChange: (k: string) => void; allowNone?: boolean }) {
  return (
    <select className="circ-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {allowNone && <option value="">— بدون —</option>}
      <optgroup label="الأجناس">
        {SHAPES.filter((s) => s.kind === 'jins').map((s) => (
          <option key={s.key} value={s.key}>
            {s.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="المقامات">
        {SHAPES.filter((s) => s.kind === 'maqam').map((s) => (
          <option key={s.key} value={s.key}>
            {s.name}
          </option>
        ))}
      </optgroup>
    </select>
  )
}
