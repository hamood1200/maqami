import { useSyncExternalStore } from 'react'

export type Route =
  | { page: 'home' }
  | { page: 'maqam'; id: string; shift?: number }
  | { page: 'ajnas' }
  | { page: 'circle' }
  | { page: 'quiz'; focus?: string }

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'maqam' && parts[1]) {
    const shift = Number(parts[2])
    return { page: 'maqam', id: parts[1], shift: Number.isInteger(shift) && shift >= -5 && shift <= 6 ? shift : undefined }
  }
  if (parts[0] === 'ajnas') return { page: 'ajnas' }
  if (parts[0] === 'circle') return { page: 'circle' }
  if (parts[0] === 'quiz') return { page: 'quiz', focus: parts[1] }
  return { page: 'home' }
}

let current = parse(location.hash)
const listeners = new Set<() => void>()
window.addEventListener('hashchange', () => {
  current = parse(location.hash)
  window.scrollTo({ top: 0 })
  listeners.forEach((l) => l())
})

export function useRoute(): Route {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}

export const href = {
  home: '#/',
  maqam: (id: string, shift?: number) => (shift ? `#/maqam/${id}/${shift}` : `#/maqam/${id}`),
  ajnas: '#/ajnas',
  circle: '#/circle',
  quiz: (focus?: string) => (focus ? `#/quiz/${focus}` : '#/quiz'),
}
