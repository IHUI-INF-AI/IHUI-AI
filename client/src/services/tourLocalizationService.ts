import { StorageManager } from '@/utils/storage'

export type SupportedLocale = 'zh-CN' | 'en' | 'ja' | 'ko'

export interface LocalizedTourStep {
  id: string
  target?: string
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  showSkip?: boolean
  title: Record<SupportedLocale, string>
  content: Record<SupportedLocale, string>
}

export interface LocalizedTourConfig {
  id: string
  name: Record<SupportedLocale, string>
  steps: LocalizedTourStep[]
  defaultLocale: SupportedLocale
}

const STORAGE_KEY = 'localized_tours'

/** 默认引导配置（空列表，可由管理后台新增） */
const defaultLocalizedTours: LocalizedTourConfig[] = []

class TourLocalizationService {
  private tours: Map<string, LocalizedTourConfig> = new Map()
  private currentLocale: SupportedLocale = 'zh-CN'
  private initialized = false

  init(): void {
    if (this.initialized) return

    const savedTours = StorageManager.getItem<LocalizedTourConfig[]>(STORAGE_KEY)
    if (savedTours && savedTours.length > 0) {
      savedTours.forEach(t => this.tours.set(t.id, t))
    } else {
      defaultLocalizedTours.forEach(t => this.tours.set(t.id, t))
      this.saveTours()
    }

    const savedLocale = StorageManager.getItem<SupportedLocale>('tour_locale')
    if (savedLocale) {
      this.currentLocale = savedLocale
    }

    this.initialized = true
  }

  private saveTours(): void {
    StorageManager.setItem(STORAGE_KEY, Array.from(this.tours.values()))
  }

  setLocale(locale: SupportedLocale): void {
    this.currentLocale = locale
    StorageManager.setItem('tour_locale', locale)
  }

  getLocale(): SupportedLocale {
    this.init()
    return this.currentLocale
  }

  getSupportedLocales(): { code: SupportedLocale; name: string }[] {
    return [
      { code: 'zh-CN', name: '简体中文' },
      { code: 'en', name: 'English' },
      { code: 'ja', name: '日本語' },
      { code: 'ko', name: '한국어' },
    ]
  }

  getLocalizedTour(tourId: string, _locale?: SupportedLocale): LocalizedTourConfig | null {
    this.init()
    const tour = this.tours.get(tourId)
    if (!tour) return null
    return tour
  }

  getLocalizedStep(
    tourId: string,
    stepId: string,
    locale?: SupportedLocale
  ): { title: string; content: string } | null {
    this.init()
    const tour = this.tours.get(tourId)
    if (!tour) return null

    const step = tour.steps.find(s => s.id === stepId)
    if (!step) return null

    const targetLocale = locale || this.currentLocale
    return {
      title: step.title[targetLocale] || step.title[tour.defaultLocale],
      content: step.content[targetLocale] || step.content[tour.defaultLocale],
    }
  }

  getLocalizedSteps(tourId: string, locale?: SupportedLocale): Array<{
    id: string
    target?: string
    placement?: string
    showSkip?: boolean
    title: string
    content: string
  }> {
    this.init()
    const tour = this.tours.get(tourId)
    if (!tour) return []

    const targetLocale = locale || this.currentLocale
    return tour.steps.map(step => ({
      id: step.id,
      target: step.target,
      placement: step.placement,
      showSkip: step.showSkip,
      title: step.title[targetLocale] || step.title[tour.defaultLocale],
      content: step.content[targetLocale] || step.content[tour.defaultLocale],
    }))
  }

  getAllTours(): LocalizedTourConfig[] {
    this.init()
    return Array.from(this.tours.values())
  }

  updateTourStep(
    tourId: string,
    stepId: string,
    locale: SupportedLocale,
    updates: { title?: string; content?: string }
  ): boolean {
    this.init()
    const tour = this.tours.get(tourId)
    if (!tour) return false

    const stepIndex = tour.steps.findIndex(s => s.id === stepId)
    if (stepIndex === -1) return false

    const step = tour.steps[stepIndex]
    if (updates.title) {
      step.title[locale] = updates.title
    }
    if (updates.content) {
      step.content[locale] = updates.content
    }

    this.saveTours()
    return true
  }

  createLocalizedTour(config: Omit<LocalizedTourConfig, 'id'>): LocalizedTourConfig {
    this.init()
    const newTour: LocalizedTourConfig = {
      ...config,
      id: `tour-${Date.now()}`,
    }
    this.tours.set(newTour.id, newTour)
    this.saveTours()
    return newTour
  }
}

export const tourLocalizationService = new TourLocalizationService()
