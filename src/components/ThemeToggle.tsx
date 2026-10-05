import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'
const KEY = 'maqami-theme'

const systemTheme = (): Theme => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

function storedTheme(): Theme | null {
  try {
    const s = localStorage.getItem(KEY)
    return s === 'dark' || s === 'light' ? s : null
  } catch {
    return null
  }
}

/** زر التبديل بين الوضع الفاتح والداكن — يحفظ الاختيار، ويتبع النظام ما لم يختر المستخدم */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme as Theme) || storedTheme() || systemTheme())

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (!storedTheme()) setTheme(systemTheme())
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* التخزين غير متاح؛ يبقى الاختيار لهذه الجلسة */
    }
  }

  const dark = theme === 'dark'
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={dark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
      title={dark ? 'الوضع الفاتح' : 'الوضع الداكن'}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {dark ? (
          <g className="theme-sun">
            <circle cx="12" cy="12" r="4.5" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <line key={a} x1="12" y1="2.5" x2="12" y2="5" transform={`rotate(${a} 12 12)`} />
            ))}
          </g>
        ) : (
          <path className="theme-moon" d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
        )}
      </svg>
    </button>
  )
}
