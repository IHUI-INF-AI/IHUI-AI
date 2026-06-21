import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresAdmin?: boolean
    title?: string
    description?: string
    keywords?: string
    preload?: boolean
    showFooter?: boolean
    transition?: string
    platform?: 'web' | 'h5' | 'alipay' | 'electron' | ('web' | 'h5' | 'alipay' | 'electron')[]
  }
}
