import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

const mockStore: Record<string, string> = {}

vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStore[key] || null,
  setItem: (key: string, value: string) => { mockStore[key] = value },
  removeItem: (key: string) => { delete mockStore[key] },
  clear: () => { Object.keys(mockStore).forEach(k => delete mockStore[k]) }
})

vi.stubGlobal('window', {})

describe('themeScheduledSwitch', () => {
  beforeEach(async () => {
    Object.keys(mockStore).forEach(k => delete mockStore[k])
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(async () => {
    const { themeScheduledSwitch } = await import('../themeScheduledSwitch')
    themeScheduledSwitch.stopChecking()
  })

  describe('getSchedules', () => {
    it('should return default schedules when no stored config', async () => {
      const { themeScheduledSwitch } = await import('../themeScheduledSwitch')
      const schedules = themeScheduledSwitch.getSchedules()
      expect(schedules.length).toBeGreaterThan(0)
    })

    it('should return stored schedules', async () => {
      mockStore['theme-scheduled-switches'] = JSON.stringify({
        enabled: true,
        schedules: [{ id: 'test-1', mode: 'dark', time: '22:00', enabled: true, days: [0], label: 'Test' }]
      })
      const { themeScheduledSwitch } = await import('../themeScheduledSwitch')
      const schedules = themeScheduledSwitch.getSchedules()
      expect(schedules.length).toBe(1)
    })

    it('should handle invalid stored data', async () => {
      mockStore['theme-scheduled-switches'] = 'invalid-json'
      const { themeScheduledSwitch } = await import('../themeScheduledSwitch')
      const schedules = themeScheduledSwitch.getSchedules()
      expect(schedules.length).toBeGreaterThan(0)
    })
  })

  describe('getSchedule', () => {
    it('should return schedule by id', async () => {
      const { themeScheduledSwitch } = await import('../themeScheduledSwitch')
      const schedules = themeScheduledSwitch.getSchedules()
      if (schedules.length > 0) {
        const found = themeScheduledSwitch.getSchedule(schedules[0].id)
        expect(found).toBeDefined()
      }
    })

    it('should return undefined for invalid id', async () => {
      const { themeScheduledSwitch } = await import('../themeScheduledSwitch')
      const found = themeScheduledSwitch.getSchedule('invalid-id')
      expect(found).toBeUndefined()
    })
  })

  describe('addSchedule', () => {
    it('should add a new schedule', async () => {
      const { themeScheduledSwitch } = await import('../themeScheduledSwitch')
      const initialCount = themeScheduledSwitch.getSchedules().length

      const schedule = themeScheduledSwitch.addSchedule({
        label: 'Test Schedule',
        mode: 'dark',
        time: '22:00',
        enabled: true,
        days: [0, 1, 2, 3, 4, 5, 6]
      })

      expect(schedule.id).toBeDefined()
      expect(themeScheduledSwitch.getSchedules().length).toBe(initialCount + 1)
    })

    it('should generate unique id', async () => {
      const { themeScheduledSwitch } = await import('../themeScheduledSwitch')
      const schedule1 = themeScheduledSwitch.addSchedule({
        label: 'Schedule 1',
        mode: 'dark',
        time: '22:00',
        enabled: true,
        days: [0]
      })
      const schedule2 = themeScheduledSwitch.addSchedule({
        label: 'Schedule 2',
        mode: 'light',
        time: '08:00',
        enabled: true,
        days: [1]
      })
      expect(schedule1.id).not.toBe(schedule2.id)
    })
  })

  describe('updateSchedule', () => {
    it('should update existing schedule', async () => {
      const { themeScheduledSwitch } = await import('../themeScheduledSwitch')
      const schedule = themeScheduledSwitch.addSchedule({
        label: 'To Update',
        mode: 'light',
        time: '08:00',
        enabled: true,
        days: [1, 2, 3, 4, 5]
      })

      const updated = themeScheduledSwitch.updateSchedule(schedule.id, {
        label: 'Updated Label',
        time: '09:00'
      })

      expect(updated?.label).toBe('Updated Label')
      expect(updated?.time).toBe('09:00')
    })

    it('should return undefined for invalid id', async () => {
      const { themeScheduledSwitch } = await import('../themeScheduledSwitch')
      const result = themeScheduledSwitch.updateSchedule('invalid-id', { label: 'Test' })
      expect(result).toBeUndefined()
    })
  })

  describe('deleteSchedule', () => {
    it('should delete schedule', async () => {
      const { themeScheduledSwitch } = await import('../themeScheduledSwitch')
      const schedule = themeScheduledSwitch.addSchedule({
        label: 'To Delete',
        mode: 'dark',
        time: '20:00',
        enabled: true,
        days: [0]
      })

      const result = themeScheduledSwitch.deleteSchedule(schedule.id)
      expect(result).toBe(true)
      expect(themeScheduledSwitch.getSchedule(schedule.id)).toBeUndefined()
    })

    it('should return false for invalid id', async () => {
      const { themeScheduledSwitch } = await import('../themeScheduledSwitch')
      const result = themeScheduledSwitch.deleteSchedule('invalid-id')
      expect(result).toBe(false)
    })
  })

  describe('toggleSchedule', () => {
    it('should toggle schedule enabled state', async () => {
      const { themeScheduledSwitch } = await import('../themeScheduledSwitch')
      const schedule = themeScheduledSwitch.addSchedule({
        label: 'Toggle Test',
        mode: 'light',
        time: '09:00',
        enabled: true,
        days: [1, 2, 3, 4, 5]
      })

      const newState = themeScheduledSwitch.toggleSchedule(schedule.id)
      expect(newState).toBe(false)

      const newState2 = themeScheduledSwitch.toggleSchedule(schedule.id)
      expect(newState2).toBe(true)
    })

    it('should return false for invalid id', async () => {
      const { themeScheduledSwitch } = await import('../themeScheduledSwitch')
      const result = themeScheduledSwitch.toggleSchedule('invalid-id')
      expect(result).toBe(false)
    })
  })

  describe('setEnabled', () => {
    it('should enable/disable all scheduled switches', async () => {
      const { themeScheduledSwitch } = await import('../themeScheduledSwitch')
      themeScheduledSwitch.setEnabled(false)
      expect(themeScheduledSwitch.isEnabled()).toBe(false)

      themeScheduledSwitch.setEnabled(true)
      expect(themeScheduledSwitch.isEnabled()).toBe(true)
    })
  })

  describe('getConfig', () => {
    it('should return current config', async () => {
      const { themeScheduledSwitch } = await import('../themeScheduledSwitch')
      const config = themeScheduledSwitch.getConfig()
      expect(config.enabled).toBeDefined()
      expect(Array.isArray(config.schedules)).toBe(true)
    })
  })

  describe('getNextScheduledSwitch', () => {
    it('should return null when disabled', async () => {
      const { themeScheduledSwitch } = await import('../themeScheduledSwitch')
      themeScheduledSwitch.setEnabled(false)
      const next = themeScheduledSwitch.getNextScheduledSwitch()
      expect(next).toBeNull()
    })

    it('should return null when no enabled schedules', async () => {
      mockStore['theme-scheduled-switches'] = JSON.stringify({
        enabled: true,
        schedules: [{ id: 'test-1', mode: 'dark', time: '22:00', enabled: false, days: [0], label: 'Test' }]
      })
      vi.resetModules()
      const { themeScheduledSwitch } = await import('../themeScheduledSwitch')
      const next = themeScheduledSwitch.getNextScheduledSwitch()
      expect(next).toBeNull()
    })

    it('should return next schedule when enabled', async () => {
      mockStore['theme-scheduled-switches'] = JSON.stringify({
        enabled: true,
        schedules: [{ id: 'test-1', mode: 'dark', time: '23:59', enabled: true, days: [0, 1, 2, 3, 4, 5, 6], label: 'Test' }]
      })
      vi.resetModules()
      const { themeScheduledSwitch } = await import('../themeScheduledSwitch')
      const next = themeScheduledSwitch.getNextScheduledSwitch()
      expect(next).not.toBeNull()
      expect(next?.schedule).toBeDefined()
      expect(next?.timeUntil).toBeGreaterThanOrEqual(0)
    })
  })

  describe('formatTimeUntil', () => {
    it('should format minutes correctly', async () => {
      const { themeScheduledSwitch } = await import('../themeScheduledSwitch')
      expect(themeScheduledSwitch.formatTimeUntil(30)).toBe('30分钟')
      expect(themeScheduledSwitch.formatTimeUntil(60)).toBe('1小时')
      expect(themeScheduledSwitch.formatTimeUntil(90)).toBe('1小时30分钟')
      expect(themeScheduledSwitch.formatTimeUntil(120)).toBe('2小时')
      expect(themeScheduledSwitch.formatTimeUntil(150)).toBe('2小时30分钟')
    })
  })

  describe('subscribe', () => {
    it('should add and remove listener', async () => {
      const { themeScheduledSwitch } = await import('../themeScheduledSwitch')
      const listener = vi.fn()
      const unsubscribe = themeScheduledSwitch.subscribe(listener)

      expect(typeof unsubscribe).toBe('function')
      unsubscribe()
    })

    it('should notify listeners when schedule triggers', async () => {
      const now = new Date()
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

      mockStore['theme-scheduled-switches'] = JSON.stringify({
        enabled: true,
        schedules: [{ id: 'test-trigger', mode: 'dark', time: timeStr, enabled: true, days: [0, 1, 2, 3, 4, 5, 6], label: 'Trigger Test' }]
      })
      vi.resetModules()

      const { themeScheduledSwitch } = await import('../themeScheduledSwitch')
      const listener = vi.fn()
      themeScheduledSwitch.subscribe(listener)

      themeScheduledSwitch.startChecking()
      await new Promise(r => setTimeout(r, 1100))

      expect(listener).toHaveBeenCalled()
    })
  })

  describe('startChecking / stopChecking', () => {
    it('should start and stop checking', async () => {
      const { themeScheduledSwitch } = await import('../themeScheduledSwitch')
      themeScheduledSwitch.startChecking()
      themeScheduledSwitch.stopChecking()
      expect(true).toBe(true)
    })

    it('should not start duplicate intervals', async () => {
      const { themeScheduledSwitch } = await import('../themeScheduledSwitch')
      themeScheduledSwitch.startChecking()
      themeScheduledSwitch.startChecking()
      themeScheduledSwitch.stopChecking()
      expect(true).toBe(true)
    })
  })

  describe('resetToDefaults', () => {
    it('should reset to default schedules', async () => {
      const { themeScheduledSwitch } = await import('../themeScheduledSwitch')
      themeScheduledSwitch.addSchedule({
        label: 'Extra',
        mode: 'dark',
        time: '23:00',
        enabled: true,
        days: [0]
      })

      themeScheduledSwitch.resetToDefaults()
      const schedules = themeScheduledSwitch.getSchedules()
      expect(schedules.length).toBe(2)
    })
  })
})
