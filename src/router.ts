import { useSyncExternalStore } from 'react'

export type Route =
  | { page: 'home' }
  | { page: 'maqam'; id: string }
  | { page: 'ajnas' }
  | { page: 'quiz'; focus?: string }

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'maqam' && parts[1]) return { page: 'maqam', id: parts[1] }
  if (parts[0] === 'ajnas') return { page: 'ajnas' }
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
  maqam: (id: string) => `#/maqam/${id}`,
  ajnas: '#/ajnas',
  quiz: (focus?: string) => (focus ? `#/quiz/${focus}` : '#/quiz'),
}
