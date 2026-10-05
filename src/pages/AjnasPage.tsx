import { useState } from 'react'
import { AJNAS } from '../data/ajnas'
import { MAQAMAT } from '../data/maqamat'
import { noteCents } from '../data/notes'
import { engine } from '../audio/engine'
import { notesEvents } from '../audio/phrases'
import { Keyboard } from '../components/Keyboard'
import { ScaleStrip } from '../components/ScaleStrip'
import { SoundSettings } from '../components/SoundSettings'
import { usePlayback } from '../usePlayback'
import { useSettings } from '../store'
import { href } from '../router'
import { arNum } from '../format'

export function AjnasPage() {
  const [sel, setSel] = useState(AJNAS[0].id)
  const { playing, litDegree, lit, play, stop } = usePlayback()
  const settings = useSettings()
  const jins = AJNAS.find((j) => j.id === sel)!

  const playJins = (id: string) => {
    const j = AJNAS.find((x) => x.id === id)!
    setSel(j.id)
    if (playing === id) return stop()
    play(id, notesEvents(j.notes, settings.bpm, { updown: true }))
  }

  return (
    <div className="ajnas-page">
      <header className="page-head">
        <h1>الأجناس</h1>
        <p className="lead">
          الجنس مجموعة صغيرة من 3 إلى 5 نغمات متتالية، وهو اللبنة التي يُبنى منها المقام. كل مقام يتكوّن عادةً من جنسين: جنس أول على القرار وجنس ثانٍ يبدأ
          من الغمّاز. إذا عرفت الأجناس بأذنك، صار التعرّف على المقامات أسهل بكثير.
        </p>
      </header>

      <section className="panel organ-panel sticky-organ">
        <div className="panel-label">الآلة</div>
        <div className="controls">
          <div className="now-showing">
            <span>على اللوحة الآن</span>
            <b>جنس {jins.name}</b>
          </div>
          <button type="button" className={`btn btn-play ${playing === jins.id ? 'playing' : ''}`} onClick={() => playJins(jins.id)}>
            <span className="ico">{playing === jins.id ? '■' : '▶︎'}</span> استمع
          </button>
        </div>
        <Keyboard notes={jins.notes} lit={lit} />
        <ScaleStrip
          notes={jins.notes}
          litDegree={litDegree}
          showTraditional={settings.showTraditional}
          onNote={(i) => engine.playNote(noteCents(jins.notes[i]), 0.7)}
        />
        <SoundSettings />
      </section>

      <div className="ajnas-grid">
        {AJNAS.map((j, ji) => {
          const used = MAQAMAT.filter((m) => m.ajnas.some((p) => p.jins === j.id))
          return (
            <article key={j.id} className={`jins-card ${sel === j.id ? 'selected' : ''}`}>
              <span className="jins-num">{arNum(ji + 1, 2)}</span>
              <div className="jins-card-head">
                <button type="button" className={`mini-play ${playing === j.id ? 'playing' : ''}`} onClick={() => playJins(j.id)} aria-label={`استمع إلى جنس ${j.name}`}>
                  {playing === j.id ? '■' : '▶︎'}
                </button>
                <h3>
                  <button type="button" className="link-btn" onClick={() => setSel(j.id)}>
                    {j.name}
                  </button>
                </h3>
                {!j.basic && <span className="tag">متقدم</span>}
              </div>
              <p>{j.summary}</p>
              {used.length > 0 && (
                <div className="used-in">
                  <span className="muted">يدخل في:</span>
                  {used.map((m) => (
                    <a key={m.id} className="pill pill-sm" href={href.maqam(m.id)}>
                      {m.name}
                    </a>
                  ))}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
