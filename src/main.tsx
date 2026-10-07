import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { loadReview } from './review'
import { App } from './App'
import './styles.css'

// أحكام أستاذ المراجعة تُطبَّق قبل أول رسم، ثم يُقرأ أحدثها من الجدول
loadReview()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
