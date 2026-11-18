/// <reference types="vite/client" />

/** Human-readable size of public/downloads/nms-sales-rep.apk, injected by vite.config.ts. */
declare const __REP_APK_SIZE__: string

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
