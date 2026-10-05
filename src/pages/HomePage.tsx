import { FAMILIES, MAQAMAT, MAQAM_BY_ID } from '../data/maqamat'
import { maqamEvents } from '../audio/phrases'
import { usePlayback } from '../usePlayback'
import { useSettings } from '../store'
import { href } from '../router'
import { NoteName } from '../components/NoteName'
import { Disc, Star } from '../components/Disc'
import { arNum } from '../format'

export function HomePage() {
  const { playing, play, stop } = usePlayback()
  const { bpm } = useSettings()
  const basicCount = MAQAMAT.filter((m) => m.basic).length
  const clipCount = MAQAMAT.reduce((n, m) => n + m.examples.length, 0)

  const toggle = (id: string) => {
    if (playing === id) return stop()
    play(id, maqamEvents(MAQAM_BY_ID[id], 'up', bpm * 1.4))
  }
  const heroPlaying = playing === 'rast-hero'

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-text">
          <div className="kicker">
            <Star /> الدرس الأول: الأذن قبل الاسم
          </div>
          <h1>
            المقام يُسمَع
            <br />
            <em>قبل أن يُسمّى.</em>
          </h1>
          <p className="lead">
            اختر مقاماً واسمعه على أورغ مضبوط بأرباع التون. شاهد أجناسه على المفاتيح، ثم اسمعه في مقاطع من أغانٍ تعرفها، وبعدها اختبر أذنك.
          </p>
          <div className="hero-cta">
            <a className="btn btn-primary btn-lg" href={href.maqam('rast')}>
              ابدأ بمقام الراست
            </a>
            <a className="btn btn-lg" href={href.quiz()}>
              اختبر أذنك
            </a>
          </div>
        </div>

        <div className="hero-disc">
          <button
            type="button"
            className="disc-btn"
            onClick={() => (heroPlaying ? stop() : play('rast-hero', maqamEvents(MAQAM_BY_ID.rast, 'phrase', bpm)))}
            aria-label={heroPlaying ? 'إيقاف' : 'استمع إلى جملة من مقام الراست'}
          >
            <Disc label="راست" sub="على دو" spinning={heroPlaying} />
            <span className="disc-cue">{heroPlaying ? '■ إيقاف' : '▶︎ ضع الإبرة'}</span>
          </button>
        </div>
      </section>

      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          {[0, 1].map((k) => (
            <span key={k}>
              {MAQAMAT.map((m) => (
                <span key={m.id} className="ticker-item">
                  {m.name} <Star />
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      <ol className="programme">
        <li>
          <b>اختر مقاماً</b>
          <span>
            {arNum(MAQAMAT.length)} مقاماً من {arNum(FAMILIES.length)} عائلات، منها {arNum(basicCount)} أساسية.
          </span>
        </li>
        <li>
          <b>اسمع وجرّب</b>
          <span>اعزف على اللوحة وشاهد الأجناس والمسافات بين النغمات.</span>
        </li>
        <li>
          <b>اسمعه في الأغاني</b>
          <span>{arNum(clipCount)} مقطعاً قصيراً مختاراً من يوتيوب.</span>
        </li>
        <li>
          <b>اختبر أذنك</b>
          <span>نعزف مقاماً وأنت تعرفه.</span>
        </li>
      </ol>

      <section className="index">
        <header className="section-head">
          <h2>الفهرس</h2>
          <p className="muted">
            المقامات حسب العائلة. المعلّمة بـ<Star className="inline" /> أساسية، فابدأ بها.
          </p>
        </header>
        <div className="index-grid">
          {FAMILIES.map((f, fi) => (
            <div key={f.id} className="index-family">
              <h3>
                <span className="index-num">{arNum(fi + 1)}</span>
                {f.name}
              </h3>
              <ul>
                {MAQAMAT.filter((m) => m.family === f.id).map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className={`mini-play ${playing === m.id ? 'playing' : ''}`}
                      aria-label={`استمع إلى ${m.name}`}
                      onClick={() => toggle(m.id)}
                    >
                      {playing === m.id ? '■' : '▶︎'}
                    </button>
                    <a href={href.maqam(m.id)}>
                      {m.name}
                      {m.basic && <Star className="inline" />}
                    </a>
                    <span className="leader" />
                    <span className="tonic-hint">
                      <NoteName note={m.notes[0]} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <aside className="margin-note">
        <div className="margin-glyph" aria-hidden="true">
          ¼
        </div>
        <div>
          <h2>ما هو ربع التون؟</h2>
          <p>
            في الموسيقى العربية نغمات تقع بين مفاتيح البيانو العادية، مثل <b>مي نصف بيمول</b> (السيكاه). على الأورغ الشرقي يُعزف ربع التون بالضغط على
            المفتاح نفسه بعد خفضه ربع تون، ولهذا ترى على اللوحة علامة <b>¼↓</b> فوق هذه المفاتيح. كل مقام هنا يضبط اللوحة تلقائياً كما يفعل العازف على
            أورغه.
          </p>
        </div>
      </aside>
    </div>
  )
}
