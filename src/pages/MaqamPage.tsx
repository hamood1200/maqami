import { useCallback, useEffect, useState } from 'react'
import { FAMILIES, MAQAMAT, MAQAM_BY_ID, familyName, type JinsPlacement } from '../data/maqamat'
import { AJNAS_BY_ID } from '../data/ajnas'
import { noteCents } from '../data/notes'
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

const CLIPS_SHOWN = 6

export function MaqamPage({ id }: { id: string }) {
  const m = MAQAM_BY_ID[id] ?? MAQAMAT[0]
  const settings = useSettings()
  const { playing, litDegree, lit, play, stop } = usePlayback()
  const [phrase, setPhrase] = useState(0)
  const [drone, setDrone] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    stop()
    engine.stopDrone()
    setDrone(false)
    setShowAll(false)
  }, [m.id, stop])

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
    play(mode, maqamEvents(m, mode, settings.bpm, { phrase }))
  }

  const playJins = (j: JinsPlacement, k: number) => {
    const notes = m.notes.slice(j.at, j.at + j.length)
    const events = notesEvents(notes, settings.bpm, { updown: true }).map((e) => ({ ...e, tag: (e.tag ?? 0) + j.at }))
    play(`jins-${k}`, events)
  }

  const toggleDrone = () => {
    if (drone) engine.stopDrone()
    else engine.startDrone(noteCents(m.notes[0]))
    setDrone(!drone)
  }

  const extra = m.descending?.filter((n) => !m.notes.includes(n)) ?? []
  const related = MAQAMAT.filter((x) => x.family === m.family && x.id !== m.id)

  return (
    <div className="maqam-layout">
      <aside className="maqam-nav" aria-label="قائمة المقامات">
        {FAMILIES.map((f) => (
          <div key={f.id} className="nav-family">
            <div className="nav-family-name">{f.name}</div>
            {MAQAMAT.filter((x) => x.family === f.id).map((x) => (
              <a key={x.id} href={href.maqam(x.id)} className={`nav-item ${x.id === m.id ? 'active' : ''}`}>
                {x.name}
                {x.basic && <span className="dot" title="مقام أساسي" />}
              </a>
            ))}
          </div>
        ))}
      </aside>

      <div className="maqam-main">
        <label className="maqam-select field">
          <span>اختر المقام</span>
          <select value={m.id} onChange={(e) => (location.hash = href.maqam(e.target.value))}>
            {FAMILIES.map((f) => (
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

        <header className="maqam-head">
          <div className="stamp">{familyName(m.family)}</div>
          <h1>
            <small>مقام</small>
            {m.name}
          </h1>
          <p className="lead">{m.description}</p>
          <dl className="facts">
            <div>
              <dt>القرار</dt>
              <dd>
                <NoteName note={m.notes[0]} />
              </dd>
            </div>
            <div>
              <dt>الغمّاز</dt>
              <dd>
                <NoteName note={m.notes[m.ghammaz]} />
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
        </header>

        <section className="panel organ-panel">
          <div className="panel-label">الآلة</div>
          <div className="controls">
            <div className="btn-group">
              <PlayBtn active={playing === 'up'} onClick={() => run('up')}>
                صعوداً
              </PlayBtn>
              <PlayBtn active={playing === 'down'} onClick={() => run('down')}>
                هبوطاً
              </PlayBtn>
              <PlayBtn active={playing === 'updown'} onClick={() => run('updown')}>
                صعود وهبوط
              </PlayBtn>
              <PlayBtn active={playing === 'phrase'} onClick={() => run('phrase')}>
                جملة لحنية
              </PlayBtn>
            </div>
            <button type="button" className={`btn btn-toggle ${drone ? 'on' : ''}`} onClick={toggleDrone} aria-pressed={drone}>
              <span className="toggle-dot" /> القرار الممتد
            </button>
          </div>

          <Keyboard notes={m.notes} extraNotes={extra} ghammaz={m.ghammaz} jinsOf={jinsOf} lit={lit} />

          <div className="legend">
            <span>
              <i className="sw sw-tonic" /> القرار
            </span>
            <span>
              <i className="sw sw-ghammaz" /> الغمّاز
            </span>
            <span>
              <i className="sw sw-quarter">¼↓</i> مفتاح مخفوض ربع تون
            </span>
            {extra.length > 0 && (
              <span>
                <i className="sw sw-extra" /> نغمة الهبوط
              </span>
            )}
            <span className="legend-hint">اضغط المفاتيح بالفأرة أو اللمس، أو بأزرار الكيبورد A S D F…</span>
          </div>

          <ScaleStrip
            notes={m.notes}
            ajnas={m.ajnas}
            ghammaz={m.ghammaz}
            litDegree={litDegree}
            showTraditional={settings.showTraditional}
            onNote={(i) => engine.playNote(noteCents(m.notes[i]), 0.7)}
            onJins={playJins}
          />

          {m.descending && (
            <div className="descending">
              <div className="small-title">في الهبوط</div>
              <ScaleStrip notes={[...m.descending].reverse()} ghammaz={m.ghammaz} showTraditional={settings.showTraditional} onNote={(i) => engine.playNote(noteCents([...m.descending!].reverse()[i]), 0.7)} />
            </div>
          )}

          <SoundSettings />
        </section>

        {m.tips && m.tips.length > 0 && (
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
            {m.examples.length > 0 && <p className="muted">{arNum(m.examples.length)} مقطعاً. كل مقطع يبدأ عند الجزء الذي يظهر فيه المقام بوضوح.</p>}
          </header>
          {m.examples.length === 0 ? (
            <p className="muted">لا توجد مقاطع لهذا المقام بعد. جرّب المقامات الأخرى في نفس العائلة.</p>
          ) : (
            <>
              <div className="clip-grid">
                {(showAll ? m.examples : m.examples.slice(0, CLIPS_SHOWN)).map((c, i) => (
                  <ClipCard key={c.videoId} maqamId={m.id} clip={c} index={i + 1} />
                ))}
              </div>
              {m.examples.length > CLIPS_SHOWN && (
                <button type="button" className="btn more-btn" onClick={() => setShowAll(!showAll)}>
                  {showAll ? 'عرض أقل' : `عرض المزيد (${m.examples.length - CLIPS_SHOWN})`}
                </button>
              )}
            </>
          )}
        </section>

        <section className="next-steps">
          <div>
            <h2>جاهز تختبر أذنك؟</h2>
            <p className="muted">سنعزف لك مقامات عشوائية وتحاول معرفتها.</p>
          </div>
          <a className="btn btn-primary" href={href.quiz()}>
            ابدأ الاختبار
          </a>
        </section>

        {related.length > 0 && (
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
