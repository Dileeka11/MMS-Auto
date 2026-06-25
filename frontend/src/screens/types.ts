import type { AuthUser } from '../api'

export type Go = (route: string) => void
export interface ScreenProps { go: Go; user?: AuthUser | null }
