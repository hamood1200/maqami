import { useState } from 'react'
import { href, useRoute } from './router'
import { exportOverrides, setEditMode, useClipState } from './clips'
import { HomePage } from './pages/HomePage'
import { MaqamPage } from './pages/MaqamPage'
import { AjnasPage } from './pages/AjnasPage'
import { QuizPage } from './pages/QuizPage'
import { CirclePage } from './pages/CirclePage'
import { Disc } from './components/Disc'
import { ThemeToggle } from './components/ThemeToggle'
import { LevelToggle } from './components/LevelToggle'
import { useSettings } from './store'

export function App() {
  const route = useRoute()
  const { editMode, overrides } = useClipState()
  const [copied, setCopied] = useState(false)
  const beginner = useSettings().level === 'beginner'

  const copyOverrides = async () => {
    const json = exportOverrides()
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('انسخ التوقيتات:', json)
    }
  }

  const navClass = (p: string) => `nav-link ${route.page === p ? 'active' : ''}`

  return (
    <div className="app">
      <header className="site-header">
        <div className="container header-inner">
          <a href={href.home} className="logo" aria-label="مقامي — الرئيسية">
            <Disc className="logo-disc" />
            <span className="logo-word">مقامي</span>
            <span className="logo-tag">
              دفتر المقامات
              <br />
              للأورغ الشرقي
            </span>
          </a>
          <nav className="main-nav" aria-label="التنقل الرئيسي">
            <a className={navClass('maqam')} href={href.maqam(route.page === 'maqam' ? route.id : 'rast')}>
              المقامات
            </a>
            {!beginner && (
              <>
                <a className={navClass('ajnas')} href={href.ajnas}>
                  الأجناس
                </a>
                <a className={navClass('circle')} href={href.circle}>
                  الدائرة
                </a>
              </>
            )}
            <a className={navClass('quiz')} href={href.quiz()}>
              اختبر أذنك
            </a>
          </nav>
          <LevelToggle />
          <ThemeToggle />
        </div>
      </header>

      <main className="container main">
        {route.page === 'home' && <HomePage />}
        {route.page === 'maqam' && <MaqamPage id={route.id} shift={route.shift} />}
        {route.page === 'ajnas' && <AjnasPage />}
        {route.page === 'circle' && <CirclePage />}
        {route.page === 'quiz' && <QuizPage key={route.focus ?? ''} focus={route.focus} />}
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="colophon">
            <span className="colophon-mark">مقامي</span>
            <p>
              دفتر لتعلّم المقامات العربية بالأذن على الأورغ الشرقي، مضبوط بأرباع التون. المقاطع الغنائية من يوتيوب لأغراض تعليمية، وحقوقها لأصحابها.
            </p>
          </div>
          <div className="footer-tools">
            <label className="check">
              <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} />
              <span>تحرير توقيت المقاطع</span>
            </label>
            {editMode && Object.keys(overrides).length > 0 && (
              <button type="button" className="btn btn-small" onClick={copyOverrides}>
                {copied ? 'تم النسخ ✓' : `نسخ التوقيتات (${Object.keys(overrides).length})`}
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
