// SyncSettingsPanel.vue 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

// mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (k: string) => k }),
}))

// mock element-plus
vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  ElMessageBox: {
    confirm: vi.fn(() => Promise.resolve('confirm')),
    alert: vi.fn(() => Promise.resolve()),
  },
}))

vi.mock('@element-plus/icons-vue', () => ({
  Monitor: defineComponent({ name: 'Monitor', render: () => h('span') }),
  Iphone: defineComponent({ name: 'Iphone', render: () => h('span') }),
  Grid: defineComponent({ name: 'Grid', render: () => h('span') }),
  QuestionFilled: defineComponent({ name: 'QuestionFilled', render: () => h('span') }),
}))

// mock 业务模块
vi.mock('@/utils/syncEncryption', () => ({
  syncEncryptionService: {
    hasKey: vi.fn(() => false),
    setKey: vi.fn(() => Promise.resolve()),
    clearKey: vi.fn(),
  },
}))

vi.mock('@/utils/syncPerformanceMonitor', () => ({
  syncPerformanceMonitor: {
    getStats: vi.fn(() => ({
      totalOperations: 10,
      successfulOperations: 8,
      failedOperations: 2,
      averageDuration: 500,
      minDuration: 100,
      maxDuration: 1000,
      averageDataSize: 1024,
      totalDataTransferred: 10240,
      successRate: 80,
    })),
    generateReport: vi.fn(() => 'report content'),
    exportMetrics: vi.fn(() => '{"data":1}'),
  },
}))

vi.mock('@/utils/deviceSyncManager', () => ({
  deviceSyncManager: {
    getDevices: vi.fn(() => [
      { id: 'd1', name: 'PC', type: 'desktop', lastSyncedAt: Date.now() - 30000, isCurrentDevice: true },
      { id: 'd2', name: 'Phone', type: 'mobile', lastSyncedAt: Date.now() - 7200000, isCurrentDevice: false },
      { id: 'd3', name: 'Old', type: 'unknown', lastSyncedAt: Date.now() - 90000000, isCurrentDevice: false },
    ]),
    getDeviceStats: vi.fn(() => ({ total: 3, active: 2 })),
    removeDevice: vi.fn(() => true),
  },
}))

import SyncSettingsPanel from '../SyncSettingsPanel.vue'

describe('SyncSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('默认挂载', () => {
    const w = mount(SyncSettingsPanel)
    expect(w.exists()).toBe(true)
  })

  it('setupEncryption 密码为空', async () => {
    const w = mount(SyncSettingsPanel)
    await w.vm.setupEncryption()
  })

  it('setupEncryption 密码设置', async () => {
    const w = mount(SyncSettingsPanel)
    w.vm.encryptionPassword = 'pwd123'
    await w.vm.setupEncryption()
  })

  it('setupEncryption 失败', async () => {
    const encMod = await import('@/utils/syncEncryption')
    ;(encMod.syncEncryptionService.setKey as any).mockRejectedValueOnce(new Error('fail'))
    const w = mount(SyncSettingsPanel)
    w.vm.encryptionPassword = 'pwd123'
    await w.vm.setupEncryption()
  })

  it('disableEncryption', async () => {
    const w = mount(SyncSettingsPanel)
    await w.vm.disableEncryption()
  })

  it('disableEncryption 取消', async () => {
    const elPlus = await import('element-plus')
    ;(elPlus.ElMessageBox.confirm as any).mockRejectedValueOnce(new Error('cancel'))
    const w = mount(SyncSettingsPanel)
    await w.vm.disableEncryption()
  })

  it('removeDevice 成功', async () => {
    const w = mount(SyncSettingsPanel)
    await w.vm.removeDevice('d2')
  })

  it('removeDevice 取消', async () => {
    const elPlus = await import('element-plus')
    ;(elPlus.ElMessageBox.confirm as any).mockRejectedValueOnce(new Error('cancel'))
    const w = mount(SyncSettingsPanel)
    await w.vm.removeDevice('d2')
  })

  it('removeDevice 失败', async () => {
    const dsmMod = await import('@/utils/deviceSyncManager')
    ;(dsmMod.deviceSyncManager.removeDevice as any).mockReturnValueOnce(false)
    const w = mount(SyncSettingsPanel)
    await w.vm.removeDevice('d2')
  })

  it('formatTime 各种时间差', () => {
    const w = mount(SyncSettingsPanel)
    const now = Date.now()
    expect(w.vm.formatTime(now - 10000)).toBe('themeSync.timeJustNow')
    expect(w.vm.formatTime(now - 1800000)).toContain('timeMinutesAgo')
    expect(w.vm.formatTime(now - 7200000)).toContain('timeHoursAgo')
    expect(w.vm.formatTime(now - 86400000 * 3)).toMatch(/\d+/)
  })

  it('formatDuration', () => {
    const w = mount(SyncSettingsPanel)
    expect(w.vm.formatDuration(500)).toContain('ms')
    expect(w.vm.formatDuration(1500)).toContain('s')
  })

  it('showPerformanceReport', async () => {
    const w = mount(SyncSettingsPanel)
    w.vm.showPerformanceReport()
  })

  it('exportPerformanceData', () => {
    const w = mount(SyncSettingsPanel)
    w.vm.exportPerformanceData()
  })

  it('loadSettings 在 onMounted', () => {
    const w = mount(SyncSettingsPanel)
    expect(w.exists()).toBe(true)
  })

  it('encryption 已启用', async () => {
    const encMod = await import('@/utils/syncEncryption')
    ;(encMod.syncEncryptionService.hasKey as any).mockReturnValueOnce(true)
    const w = mount(SyncSettingsPanel)
    await w.vm.loadSettings()
  })

  it('encryption 已启用 切到 disable 分支', async () => {
    const encMod = await import('@/utils/syncEncryption')
    ;(encMod.syncEncryptionService.hasKey as any).mockReturnValue(true)
    const w = mount(SyncSettingsPanel)
    expect(w.vm.encryptionEnabled).toBe(true)
  })
})
