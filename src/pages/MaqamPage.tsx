import { useCallback, useEffect, useMemo, useState } from 'react'
import { FAMILIES, MAQAMAT, MAQAM_BY_ID, familyName, type JinsPlacement } from '../data/maqamat'
import { AJNAS_BY_ID } from '../data/ajnas'
import { noteCents } from '../data/notes'
import { tonicOptions, transposeMaqam } from '../data/transpose'
import { engine } from '../audio/engine'
import { maqamEvents, notesEvents, phraseCount, type PlayMode } from '../audio/phrases'
import { Keyboard } from '../components/Keyboard'
import { ScaleStrip } from '../components/ScaleStrip'
import { ClipCard } from '../components/ClipCard'
import { NoteName } from '../components/NoteName'
import { SoundSettings } from '../components/SoundSettings'
import { Star } from '../components/Disc'
import { usePlayback } from '../usePlayback'
import { arNum } from '../format'
import { useSettings } from '../store'
import { href } from '../router'
import { BEGINNER_MAQAMAT, BEGINNER_TEXT, isBeginnerMaqam, nextBeginner } from '../data/beginner'
import { setSettings } from '../store'

const CLIPS_SHOWN = 6
const CLIPS_SHOWN_BEGINNER = 3

export function MaqamPage({ id, shift: startShift = 0 }: { id: string; shift?: number }) {
  const m = MAQAM_BY_ID[id] ?? MAQAMAT[0]
  const settings = useSettings()
  // نسخة المبتدئ تخص المقامات الثمانية؛ المقام المتقدّم يُعرض كاملاً حتى في وضع المبتدئ
  const simple = settings.level === 'beginner' && isBeginnerMaqam(m.id)
  const clipsShown = simple ? CLIPS_SHOWN_BEGINNER : CLIPS_SHOWN
  const next = simple ? nextBeginner(m.id) : null
  const { playing, litDegree, lit, play, stop } = usePlayback()
  const [phrase, setPhrase] = useState(0)
  const [drone, setDrone] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [shift, setShift] = useState(simple ? 0 : startShift)
  const t = useMemo(() => transposeMaqam(m, shift), [m, shift])
  const tonics = useMemo(() => tonicOptions(m), [m])

  useEffect(() => {
    stop()
    engine.stopDrone()
    setDrone(false)
    setShowAll(false)
    setShift(simple ? 0 : startShift)
  }, [m.id, startShift, simple, stop])

  useEffect(() => () => engine.stopDrone(), [])

  const jinsOf = useCallback(
    (deg: number) => {
      // آخر جنس يبدأ عند هذه الدرجة أو تحتها (الغماز وما فوقه يأخذ لون الجنس الأعلى)
      let found = 0
      m.ajnas.forEach((j, k) => {
        if (deg >= j.at) found = k
      })
      return found
    },
    [m],
  )

  const run = (mode: PlayMode) => {
    if (playing === mode) return stop()
    if (mode === 'phrase') setPhrase((p) => (p + 1) % phraseCount())
    play(mode, maqamEvents(t, mode, settings.bpm, { phrase }))
  }

  const playJins = (j: JinsPlacement, k: number) => {
    const notes = t.notes.slice(j.at, j.at + j.length)
    const events = notesEvents(notes, settings.bpm, { updown: true }).map((e) => ({ ...e, tag: (e.tag ?? 0) + j.at }))
    play(`jins-${k}`, events)
  }

  const toggleDrone = () => {
    if (drone) engine.stopDrone()
    else engine.startDrone(noteCents(t.notes[0]))
    setDrone(!drone)
  }

  const changeTonic = (s: number) => {
    if (s === shift) return
    stop()
    setShift(s)
    if (drone) engine.startDrone(noteCents(transposeMaqam(m, s).notes[0]))
  }

  const extra = t.descending?.filter((n) => !t.notes.includes(n)) ?? []
  const related = MAQAMAT.filter((x) => x.family === m.family && x.id !== m.id)

  return (
    <div className="maqam-layout">
      <aside className="maqam-nav" aria-label="قائمة المقامات">
        {settings.level === 'beginner' ? (
          <div className="nav-family">
            <div className="nav-family-name">الدروس</div>
            {BEGINNER_MAQAMAT.map((x, i) => (
              <a key={x.id} href={href.maqam(x.id)} className={`nav-item ${x.id === m.id ? 'active' : ''}`}>
                {arNum(i + 1)}. {x.name}
              </a>
            ))}
          </div>
        ) : (
          FAMILIES.map((f) => (
            <div key={f.id} className="nav-family">
              <div className="nav-family-name">{f.name}</div>
              {MAQAMAT.filter((x) => x.family === f.id).map((x) => (
                <a key={x.id} href={href.maqam(x.id)} className={`nav-item ${x.id === m.id ? 'active' : ''}`}>
                  {x.name}
                  {x.basic && <span className="dot" title="مقام أساسي" />}
                </a>
              ))}
            </div>
          ))
        )}
      </aside>

      <div className="maqam-main">
        <label className="maqam-select field">
          <span>اختر المقام</span>
          <select value={m.id} onChange={(e) => (location.hash = href.maqam(e.target.value))}>
            {simple
              ? BEGINNER_MAQAMAT.map((x, i) => (
                  <option key={x.id} value={x.id}>
                    {arNum(i + 1)}. {x.name}
                  </option>
                ))
              : FAMILIES.map((f) => (
                  <optgroup key={f.id} label={f.name}>
                    {MAQAMAT.filter((x) => x.family === f.id).map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
          </select>
        </label>

        {settings.level === 'beginner' && !simple && (
          <p className="level-note">
            هذا مقام متقدّم، لذلك تظهر صفحته كاملة.{' '}
            <button type="button" className="link-btn" onClick={() => setSettings({ level: 'advanced' })}>
              انتقل إلى النسخة المتقدّمة
            </button>
          </p>
        )}
        <header className="maqam-head">
          <div className="stamp">{simple ? `الدرس ${arNum(BEGINNER_MAQAMAT.indexOf(m) + 1)}` : familyName(m.family)}</div>
          <h1>
            <small>مقام</small>
            {m.name}
          </h1>
          <p className="lead">{simple ? BEGINNER_TEXT[m.id] : m.description}</p>
          {!simple && (
            <dl className="facts">
              <div>
                <dt>القرار</dt>
                <dd>
                  <NoteName note={t.notes[0]} />
                </dd>
              </div>
              <div>
                <dt>الغمّاز</dt>
                <dd>
                  <NoteName note={t.notes[m.ghammaz]} />
                </dd>
              </div>
              <div>
                <dt>الأجناس</dt>
                <dd>{m.ajnas.map((j) => j.label ?? AJNAS_BY_ID[j.jins].name).join(' + ')}</dd>
              </div>
              <div>
                <dt>المقاطع</dt>
                <dd>{arNum(m.examples.length)}</dd>
              </div>
            </dl>
          )}
        </header>

        <section className="panel organ-panel">
          <div className="panel-label">الآلة</div>
          {!simple && (
            <div className="tonic-picker">
              <div className="tonic-head">
                <span className="small-title">القرار على</span>
                {shift !== 0 && (
                  <button type="button" className="tonic-reset" onClick={() => changeTonic(0)}>
                    رجوع إلى الأصل (<NoteName note={m.notes[0]} />)
                  </button>
                )}
              </div>
              <div className="tonic-row" role="radiogroup" aria-label="اختر القرار">
                {tonics.map((o) => (
                  <button
                    key={o.shift}
                    type="button"
                    role="radio"
                    aria-checked={o.shift === shift}
                    className={`tonic-chip ${o.shift === shift ? 'on' : ''} ${o.shift === 0 ? 'is-home' : ''}`}
                    onClick={() => changeTonic(o.shift)}
                    title={o.shift === 0 ? 'القرار الأصلي' : undefined}
                  >
                    <NoteName note={o.tonic} />
                  </button>
                ))}
              </div>
              <p className="tonic-note muted">
                {shift === 0 ? (
                  <>
                    هذا هو القرار المعتاد. اختر نغمة أخرى لتعزف {m.name} منها: المسافات نفسها، والمفاتيح تتغيّر.
                  </>
                ) : (
                  <>
                    {m.name} على <NoteName note={t.notes[0]} />: نفس المسافات، لكن انتبه للمفاتيح الملوّنة ومفاتيح الربع الجديدة.
                  </>
                )}
              </p>
            </div>
          )}
          <div className="controls">
            <div className="btn-group">
              {!simple && (
                <>
                  <PlayBtn active={playing === 'up'} onClick={() => run('up')}>
                    صعوداً
                  </PlayBtn>
                  <PlayBtn active={playing === 'down'} onClick={() => run('down')}>
                    هبوطاً
                  </PlayBtn>
                </>
              )}
              <PlayBtn active={playing === 'updown'} onClick={() => run('updown')}>
                صعود وهبوط
              </PlayBtn>
              <PlayBtn active={playing === 'phrase'} onClick={() => run('phrase')}>
                جملة لحنية
              </PlayBtn>
            </div>
            {!simple && (
              <button type="button" className={`btn btn-toggle ${drone ? 'on' : ''}`} onClick={toggleDrone} aria-pressed={drone}>
                <span className="toggle-dot" /> القرار الممتد
              </button>
            )}
          </div>

          <Keyboard notes={t.notes} extraNotes={extra} ghammaz={simple ? undefined : m.ghammaz} jinsOf={jinsOf} lit={lit} />

          <div className="legend">
            <span>
              <i className="sw sw-tonic" /> القرار
            </span>
            {!simple && (
              <span>
                <i className="sw sw-ghammaz" /> الغمّاز
              </span>
            )}
            <span>
              <i className="sw sw-quarter">¼↓</i> مفتاح مخفوض ربع تون
            </span>
            {extra.length > 0 && (
              <span>
                <i className="sw sw-extra" /> نغمة الهبوط
              </span>
            )}
            {!simple && <span className="legend-hint">اضغط المفاتيح بالفأرة أو اللمس، أو بأزرار الكيبورد A S D F…</span>}
          </div>

          <ScaleStrip
            notes={t.notes}
            ajnas={simple ? [] : m.ajnas}
            ghammaz={simple ? undefined : m.ghammaz}
            litDegree={litDegree}
            showTraditional={settings.showTraditional && !simple}
            onNote={(i) => engine.playNote(noteCents(t.notes[i]), 0.7)}
            onJins={playJins}
          />

          {t.descending && (
            <div className="descending">
              <div className="small-title">في الهبوط</div>
              <ScaleStrip notes={[...t.descending].reverse()} ghammaz={simple ? undefined : m.ghammaz} showTraditional={settings.showTraditional && !simple} onNote={(i) => engine.playNote(noteCents([...t.descending!].reverse()[i]), 0.7)} />
            </div>
          )}

          {!simple && <SoundSettings />}
        </section>

        {!simple && m.tips && m.tips.length > 0 && (
          <section className="tips">
            <h2>
              <Star /> انتبه إلى
            </h2>
            <ul>
              {m.tips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="examples">
          <header className="section-head">
            <h2>اسمعه في الأغاني</h2>
            {m.examples.length > 0 && !simple && <p className="muted">{arNum(m.examples.length)} مقطعاً. كل مقطع يبدأ عند الجزء الذي يظهر فيه المقام بوضوح.</p>}
          </header>
          {m.examples.length === 0 ? (
            <p className="muted">لا توجد مقاطع لهذا المقام بعد. جرّب المقامات الأخرى في نفس العائلة.</p>
          ) : (
            <>
              <div className="clip-grid">
                {(showAll ? m.examples : m.examples.slice(0, clipsShown)).map((c, i) => (
                  <ClipCard key={c.videoId} maqamId={m.id} clip={c} index={i + 1} />
                ))}
              </div>
              {m.examples.length > clipsShown && (
                <button type="button" className="btn more-btn" onClick={() => setShowAll(!showAll)}>
                  {showAll ? 'عرض أقل' : `عرض المزيد (${m.examples.length - clipsShown})`}
                </button>
              )}
            </>
          )}
        </section>

        {next ? (
          <section className="next-steps">
            <div>
              <h2>الدرس التالي: {next.name}</h2>
              <p className="muted">{BEGINNER_TEXT[next.id]}</p>
            </div>
            <a className="btn btn-primary" href={href.maqam(next.id)}>
              التالي ←
            </a>
          </section>
        ) : (
          <section className="next-steps">
            <div>
              <h2>{simple ? 'أنهيت الدروس الثمانية!' : 'جاهز تختبر أذنك؟'}</h2>
              <p className="muted">{simple ? 'اختبر أذنك عليها، ثم جرّب النسخة المتقدّمة.' : 'سنعزف لك مقامات عشوائية وتحاول معرفتها.'}</p>
            </div>
            <a className="btn btn-primary" href={href.quiz()}>
              ابدأ الاختبار
            </a>
          </section>
        )}

        {!simple && related.length > 0 && (
          <section className="related">
            <h2>من نفس العائلة</h2>
            <div className="chips-row">
              {related.map((r) => (
                <a key={r.id} className="pill" href={href.maqam(r.id)}>
                  {r.name}
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function PlayBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={`btn btn-play ${active ? 'playing' : ''}`} onClick={onClick}>
      <span className="ico" aria-hidden="true">
        {active ? '■' : '▶︎'}
      </span>
      {children}
    </button>
  )
}
