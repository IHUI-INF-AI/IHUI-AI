export interface ThemeHistoryEntry {
  timestamp: number
  fromMode: string
  toMode: string
  source: 'user' | 'system' | 'keyboard' | 'storage' | 'init'
}

export interface ThemeHistoryReport {
  entries: ThemeHistoryEntry[]
  totalSwitches: number
  mostUsedMode: string
  lastSwitch: ThemeHistoryEntry | null
  switchesToday: number
  switchesThisWeek: number
}

const STORAGE_KEY = 'theme-history'
const MAX_ENTRIES = 50

class ThemeHistoryManager {
  private entries: ThemeHistoryEntry[] = []

  constructor() {
    this.loadEntries()
  }

  private loadEntries() {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        this.entries = JSON.parse(stored)
      }
    } catch {
      this.entries = []
    }
  }

  private saveEntries() {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries))
    } catch {
      this.entries = this.entries.slice(-MAX_ENTRIES / 2)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries))
      } catch {
        // Ignore
      }
    }
  }

  addEntry(fromMode: string, toMode: string, source: ThemeHistoryEntry['source'] = 'user'): ThemeHistoryEntry {
    const entry: ThemeHistoryEntry = {
      timestamp: Date.now(),
      fromMode,
      toMode,
      source
    }

    this.entries.push(entry)

    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(-MAX_ENTRIES)
    }

    this.saveEntries()
    return entry
  }

  getEntries(): ThemeHistoryEntry[] {
    return [...this.entries]
  }

  getReport(): ThemeHistoryReport {
    const totalSwitches = this.entries.length
    const lastSwitch = this.entries.length > 0 ? this.entries[this.entries.length - 1] : null

    const modeCounts: Record<string, number> = {}
    this.entries.forEach(entry => {
      modeCounts[entry.toMode] = (modeCounts[entry.toMode] || 0) + 1
    })

    let mostUsedMode = 'light'
    let maxCount = 0
    Object.entries(modeCounts).forEach(([mode, count]) => {
      if (count > maxCount) {
        maxCount = count
        mostUsedMode = mode
      }
    })

    const now = Date.now()
    const oneDayMs = 24 * 60 * 60 * 1000
    const oneWeekMs = 7 * oneDayMs

    const switchesToday = this.entries.filter(
      e => now - e.timestamp < oneDayMs
    ).length

    const switchesThisWeek = this.entries.filter(
      e => now - e.timestamp < oneWeekMs
    ).length

    return {
      entries: this.entries,
      totalSwitches,
      mostUsedMode,
      lastSwitch,
      switchesToday,
      switchesThisWeek
    }
  }

  clearHistory() {
    this.entries = []
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  getEntriesBySource(source: ThemeHistoryEntry['source']): ThemeHistoryEntry[] {
    return this.entries.filter(e => e.source === source)
  }

  getEntriesByMode(mode: string): ThemeHistoryEntry[] {
    return this.entries.filter(e => e.toMode === mode)
  }
}

export const themeHistoryManager = new ThemeHistoryManager()
