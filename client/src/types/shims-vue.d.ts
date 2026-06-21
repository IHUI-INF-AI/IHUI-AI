import type { t } from '../composables/useLang'

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $t: typeof t
  }
}

export {}
