import { StorageManager } from '@/utils/storage'

export interface Translation {
  key: string
  value: string
  context?: string
}

export interface Language {
  code: string
  name: string
  nativeName: string
  rtl: boolean
  progress: number
}

export interface TranslationFile {
  language: string
  version: number
  translations: Record<string, string>
  updatedAt: number
}

export interface TranslationDiff {
  key: string
  oldValue: string
  newValue: string
  status: 'added' | 'modified' | 'deleted'
}

const LANGUAGES_KEY = 'tour_languages'
const TRANSLATIONS_KEY = 'tour_translations'
const CURRENT_LANG_KEY = 'tour_current_language'

const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'zh-CN', name: 'Chinese Simplified', nativeName: '简体中文', rtl: false, progress: 100 },
  { code: 'zh-TW', name: 'Chinese Traditional', nativeName: '繁體中文', rtl: false, progress: 85 },
  { code: 'en', name: 'English', nativeName: 'English', rtl: false, progress: 100 },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', rtl: false, progress: 80 },
  { code: 'ko', name: 'Korean', nativeName: '한국어', rtl: false, progress: 75 },
  { code: 'es', name: 'Spanish', nativeName: 'Español', rtl: false, progress: 70 },
  { code: 'fr', name: 'French', nativeName: 'Français', rtl: false, progress: 65 },
  { code: 'de', name: 'German', nativeName: 'Deutsch', rtl: false, progress: 60 },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true, progress: 50 },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', rtl: false, progress: 55 },
]

class TourI18nService {
  private languages: Language[] = []
  private translations: Map<string, TranslationFile> = new Map()
  private currentLanguage: string = 'zh-CN'
  private missingKeys: Set<string> = new Set()

  constructor() {
    this.load()
  }

  private load(): void {
    this.languages = StorageManager.getItem<Language[]>(LANGUAGES_KEY) || SUPPORTED_LANGUAGES
    
    const stored = StorageManager.getItem<Record<string, TranslationFile>>(TRANSLATIONS_KEY)
    if (stored) {
      Object.entries(stored).forEach(([lang, file]) => {
        this.translations.set(lang, file)
      })
    }

    this.currentLanguage = StorageManager.getItem<string>(CURRENT_LANG_KEY) || 'zh-CN'
  }

  private save(): void {
    StorageManager.setItem(LANGUAGES_KEY, this.languages)
    
    const obj: Record<string, TranslationFile> = {}
    this.translations.forEach((file, lang) => {
      obj[lang] = file
    })
    StorageManager.setItem(TRANSLATIONS_KEY, obj)
    StorageManager.setItem(CURRENT_LANG_KEY, this.currentLanguage)
  }

  getSupportedLanguages(): Language[] {
    return [...this.languages]
  }

  getCurrentLanguage(): string {
    return this.currentLanguage
  }

  setCurrentLanguage(code: string): boolean {
    if (!this.languages.find(l => l.code === code)) return false
    this.currentLanguage = code
    this.save()
    return true
  }

  getTranslation(key: string, language?: string): string | null {
    const lang = language || this.currentLanguage
    const file = this.translations.get(lang)
    
    if (!file || !file.translations[key]) {
      this.missingKeys.add(`${lang}:${key}`)
      return null
    }
    
    return file.translations[key]
  }

  setTranslation(key: string, value: string, language?: string): void {
    const lang = language || this.currentLanguage
    let file = this.translations.get(lang)
    
    if (!file) {
      file = {
        language: lang,
        version: 1,
        translations: {},
        updatedAt: Date.now(),
      }
      this.translations.set(lang, file)
    }
    
    file.translations[key] = value
    file.updatedAt = Date.now()
    this.save()
  }

  setTranslations(translations: Record<string, string>, language?: string): void {
    const lang = language || this.currentLanguage
    let file = this.translations.get(lang)
    
    if (!file) {
      file = {
        language: lang,
        version: 1,
        translations: {},
        updatedAt: Date.now(),
      }
      this.translations.set(lang, file)
    }
    
    file.translations = { ...file.translations, ...translations }
    file.updatedAt = Date.now()
    this.save()
  }

  getAllTranslations(language?: string): Record<string, string> {
    const lang = language || this.currentLanguage
    const file = this.translations.get(lang)
    return file?.translations || {}
  }

  async autoTranslate(text: string, targetLanguage: string, sourceLanguage?: string): Promise<string> {
    await this.simulateDelay()
    
    const translations: Record<string, Record<string, string>> = {
      'zh-CN': {
        'en': 'Welcome to use our product!',
        'ja': '製品をご利用いただきありがとうございます！',
        'ko': '제품을 사용해 주셔서 감사합니다!',
      },
      'en': {
        'zh-CN': '欢迎使用我们的产品！',
        'ja': '製品をご利用いただきありがとうございます！',
        'ko': '제품을 사용해 주셔서 감사합니다!',
      },
    }

    const source = sourceLanguage || this.currentLanguage
    const _key = text.substring(0, 50)
    
    if (translations[source]?.[targetLanguage]) {
      return translations[source][targetLanguage]
    }

    return `[${targetLanguage}] ${text}`
  }

  async translateTour(tourId: string, targetLanguage: string): Promise<Record<string, string>> {
    await this.simulateDelay()
    
    const sourceTranslations = this.getAllTranslations()
    const translated: Record<string, string> = {}

    for (const [key, value] of Object.entries(sourceTranslations)) {
      if (key.startsWith(tourId)) {
        translated[key] = await this.autoTranslate(value, targetLanguage)
      }
    }

    return translated
  }

  getMissingKeys(): string[] {
    return Array.from(this.missingKeys)
  }

  clearMissingKeys(): void {
    this.missingKeys.clear()
  }

  compareTranslations(lang1: string, lang2: string): TranslationDiff[] {
    const file1 = this.translations.get(lang1)
    const file2 = this.translations.get(lang2)
    
    const diffs: TranslationDiff[] = []
    const allKeys = new Set([
      ...Object.keys(file1?.translations || {}),
      ...Object.keys(file2?.translations || {}),
    ])

    allKeys.forEach(key => {
      const val1 = file1?.translations[key]
      const val2 = file2?.translations[key]

      if (!val1 && val2) {
        diffs.push({ key, oldValue: '', newValue: val2, status: 'deleted' })
      } else if (val1 && !val2) {
        diffs.push({ key, oldValue: val1, newValue: '', status: 'added' })
      } else if (val1 !== val2) {
        diffs.push({ key, oldValue: val1 || '', newValue: val2 || '', status: 'modified' })
      }
    })

    return diffs
  }

  exportTranslations(language?: string): string {
    const lang = language || this.currentLanguage
    const file = this.translations.get(lang)
    
    return JSON.stringify({
      language: lang,
      version: file?.version || 1,
      translations: file?.translations || {},
      exportedAt: Date.now(),
    }, null, 2)
  }

  importTranslations(json: string): { success: boolean; count: number; error?: string } {
    try {
      const data = JSON.parse(json)
      
      if (!data.language || !data.translations) {
        return { success: false, count: 0, error: 'Invalid format' }
      }

      const file: TranslationFile = {
        language: data.language,
        version: (data.version || 1) + 1,
        translations: data.translations,
        updatedAt: Date.now(),
      }

      this.translations.set(data.language, file)
      this.save()

      return { success: true, count: Object.keys(data.translations).length }
    } catch (e) {
      return { success: false, count: 0, error: String(e) }
    }
  }

  getTranslationProgress(): Record<string, number> {
    const baseFile = this.translations.get('zh-CN')
    const baseCount = Object.keys(baseFile?.translations || {}).length
    
    if (baseCount === 0) return {}

    const progress: Record<string, number> = {}
    
    this.translations.forEach((file, lang) => {
      const count = Object.keys(file.translations).length
      progress[lang] = Math.round((count / baseCount) * 100)
    })

    return progress
  }

  testLanguageSwitch(tourId: string): {
    languages: string[]
    missing: Record<string, string[]>
    coverage: Record<string, number>
  } {
    const languages: string[] = []
    const missing: Record<string, string[]> = {}
    const coverage: Record<string, number> = {}

    this.translations.forEach((file, lang) => {
      languages.push(lang)
      
      const tourKeys = Object.keys(file.translations).filter(k => k.startsWith(tourId))
      const totalKeys = Object.keys(this.translations.get('zh-CN')?.translations || {})
        .filter(k => k.startsWith(tourId)).length
      
      if (totalKeys > 0) {
        coverage[lang] = Math.round((tourKeys.length / totalKeys) * 100)
      } else {
        coverage[lang] = 100
      }

      if (tourKeys.length < totalKeys) {
        missing[lang] = Object.keys(this.translations.get('zh-CN')?.translations || {})
          .filter(k => k.startsWith(tourId) && !file.translations[k])
      }
    })

    return { languages, missing, coverage }
  }

  private simulateDelay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 50))
  }

  addLanguage(language: Language): void {
    if (!this.languages.find(l => l.code === language.code)) {
      this.languages.push(language)
      this.save()
    }
  }

  removeLanguage(code: string): boolean {
    const index = this.languages.findIndex(l => l.code === code)
    if (index > -1 && code !== 'zh-CN' && code !== 'en') {
      this.languages.splice(index, 1)
      this.translations.delete(code)
      this.save()
      return true
    }
    return false
  }
}

export const tourI18nService = new TourI18nService()
