import { useSyncExternalStore } from 'react'

// Tiny hash router: "#/" is the workspace, "#/admin" is the admin panel
const subscribe = (cb) => { addEventListener('hashchange', cb); return () => removeEventListener('hashchange', cb) }
export const useHash = () => useSyncExternalStore(subscribe, () => location.hash || '#/')
export const go = (hash) => { location.hash = hash }
