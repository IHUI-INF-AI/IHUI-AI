import type { ThemeMode } from '@/stores/darkMode'

export interface ScheduledSwitch {
  id: string
  mode: ThemeMode
  time: string
  enabled: boolean
  days: number[]
  label: string
}

export interface ScheduledSwitchConfig {
  enabled: boolean
  schedules: ScheduledSwitch[]
}

type ScheduledSwitchListener = (schedule: ScheduledSwitch) => void

const STORAGE_KEY = 'theme-scheduled-switches'

const DEFAULT_SCHEDULES: ScheduledSwitch[] = [
  {
    id: 'morning-light',
    mode: 'light',
    time: '08:00',
    enabled: false,
    days: [0, 1, 2, 3, 4, 5, 6],
    label: '早晨亮色'
  },
  {
    id: 'evening-dark',
    mode: 'dark',
    time: '20:00',
    enabled: false,
    days: [0, 1, 2, 3, 4, 5, 6],
    label: '傍晚暗色'
  }
]

class ThemeScheduledSwitchService {
  private config: ScheduledSwitchConfig = {
    enabled: true,
    schedules: []
  }
  private listeners: Set<ScheduledSwitchListener> = new Set()
  private checkInterval: ReturnType<typeof setInterval> | null = null
  private lastCheckedMinute: number = -1

  constructor() {
    this.loadConfig()
  }

  private loadConfig(): void {
    if (typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        this.config = {
          enabled: parsed.enabled ?? true,
          schedules: parsed.schedules || DEFAULT_SCHEDULES
        }
      } else {
        this.config.schedules = [...DEFAULT_SCHEDULES]
      }
    } catch {
      this.config.schedules = [...DEFAULT_SCHEDULES]
    }
  }

  private saveConfig(): void {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config))
    } catch {
      // Ignore storage quota exceeded
    }
  }

  private notifyListeners(schedule: ScheduledSwitch): void {
    this.listeners.forEach(listener => {
      try {
        listener(schedule)
      } catch {
        // Ignore listener errors
      }
    })
  }

  subscribe(listener: ScheduledSwitchListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getConfig(): ScheduledSwitchConfig {
    return {
      enabled: this.config.enabled,
      schedules: [...this.config.schedules]
    }
  }

  getSchedules(): ScheduledSwitch[] {
    return [...this.config.schedules]
  }

  getSchedule(id: string): ScheduledSwitch | undefined {
    return this.config.schedules.find(s => s.id === id)
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled
    this.saveConfig()
  }

  isEnabled(): boolean {
    return this.config.enabled
  }

  addSchedule(schedule: Omit<ScheduledSwitch, 'id'>): ScheduledSwitch {
    const newSchedule: ScheduledSwitch = {
      ...schedule,
      id: `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    }
    this.config.schedules.push(newSchedule)
    this.saveConfig()
    return newSchedule
  }

  updateSchedule(id: string, updates: Partial<Omit<ScheduledSwitch, 'id'>>): ScheduledSwitch | undefined {
    const index = this.config.schedules.findIndex(s => s.id === id)
    if (index === -1) return undefined

    this.config.schedules[index] = {
      ...this.config.schedules[index],
      ...updates
    }
    this.saveConfig()
    return this.config.schedules[index]
  }

  deleteSchedule(id: string): boolean {
    const index = this.config.schedules.findIndex(s => s.id === id)
    if (index === -1) return false

    this.config.schedules.splice(index, 1)
    this.saveConfig()
    return true
  }

  toggleSchedule(id: string): boolean {
    const schedule = this.config.schedules.find(s => s.id === id)
    if (!schedule) return false

    schedule.enabled = !schedule.enabled
    this.saveConfig()
    return schedule.enabled
  }

  private checkSchedules(): void {
    if (!this.config.enabled) return

    const now = new Date()
    const currentMinute = now.getHours() * 60 + now.getMinutes()

    if (currentMinute === this.lastCheckedMinute) return
    this.lastCheckedMinute = currentMinute

    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const currentDay = now.getDay()

    for (const schedule of this.config.schedules) {
      if (!schedule.enabled) continue
      if (!schedule.days.includes(currentDay)) continue
      if (schedule.time !== currentTime) continue

      this.notifyListeners(schedule)
    }
  }

  startChecking(): void {
    this.stopChecking()
    this.checkInterval = setInterval(() => this.checkSchedules(), 1000)
    this.checkSchedules()
  }

  stopChecking(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  getNextScheduledSwitch(): { schedule: ScheduledSwitch; timeUntil: number } | null {
    if (!this.config.enabled) return null

    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const currentDay = now.getDay()

    let nextSchedule: ScheduledSwitch | null = null
    let minTimeUntil = Infinity

    for (const schedule of this.config.schedules) {
      if (!schedule.enabled) continue

      const [hours, minutes] = schedule.time.split(':').map(Number)
      const scheduleMinutes = hours * 60 + minutes

      for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
        const checkDay = (currentDay + dayOffset) % 7
        if (!schedule.days.includes(checkDay)) continue

        let timeUntil = scheduleMinutes - currentMinutes + dayOffset * 24 * 60
        if (dayOffset === 0 && scheduleMinutes <= currentMinutes) continue
        if (timeUntil < minTimeUntil) {
          minTimeUntil = timeUntil
          nextSchedule = schedule
        }
        break
      }
    }

    if (nextSchedule) {
      return { schedule: nextSchedule, timeUntil: minTimeUntil }
    }

    return null
  }

  formatTimeUntil(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}分钟`
    }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (mins === 0) {
      return `${hours}小时`
    }
    return `${hours}小时${mins}分钟`
  }

  resetToDefaults(): void {
    this.config = {
      enabled: true,
      schedules: [...DEFAULT_SCHEDULES]
    }
    this.saveConfig()
  }
}

export const themeScheduledSwitch = new ThemeScheduledSwitchService()
