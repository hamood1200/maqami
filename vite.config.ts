import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // مسارات نسبية حتى يعمل الموقع من أي مجلد (مثل GitHub Pages: ‎/maqami/)
  base: './',
  plugins: [react()],
})
