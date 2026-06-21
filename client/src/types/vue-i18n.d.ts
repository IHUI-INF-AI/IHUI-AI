declare module 'vue-i18n' {
  interface I18nOptions {
    legacy?: boolean
    compilerOptions?: {
      isCustomElement?: (tag: string) => boolean
      whitespace?: 'condense' | 'preserve'
    }
    fallbackWarn?: boolean
    missingWarn?: boolean
  }
}

export type MessageSchema = Record<string, unknown>

export type I18nMessages = Record<string, Record<string, unknown>>
