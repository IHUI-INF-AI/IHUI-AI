/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MONITORING_WS_URL?: string
  readonly [key: string]: any
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
