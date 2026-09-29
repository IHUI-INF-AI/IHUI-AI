// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  SETTINGS_LAST_SECTION_STORAGE_KEY,
  SETTINGS_SECTION_INTENT_STORAGE_KEY,
  addPendingSettingsSectionListener,
  consumeInitialSettingsSection,
  consumePendingSettingsSection,
  setPendingSettingsSection,
  writeLastSettingsSectionPreference,
} from './settings-intent-channel'

/**
 * 设置页一次性导航意图双通道 单测(2026-09-30,票 G-977981)。
 *
 * 锁定五条不变量:
 *  1. 面板未开:设意图 → 挂载读消费直达且清残留
 *  2. 面板已开:设意图 → 事件即时切换且不残留 sessionStorage
 *  3. 无意图:落到"上次停留分区"
 *  4. 旧 section id 读时迁移别名生效
 *  5. storage 抛异常不阻断(只 warn 回退)
 */

beforeEach(() => {
  window.sessionStorage.clear()
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('sessionStorage 通道(面板未开)', () => {
  it('设意图 → 挂载读消费直达且清残留', () => {
    setPendingSettingsSection('models')
    // 意图已落 sessionStorage(挂载前)
    expect(window.sessionStorage.getItem(SETTINGS_SECTION_INTENT_STORAGE_KEY)).toBe('models')

    expect(consumeInitialSettingsSection('general')).toBe('models')
    // 读后即删,不留陈旧 pending
    expect(window.sessionStorage.getItem(SETTINGS_SECTION_INTENT_STORAGE_KEY)).toBeNull()
    // 再次消费回到回退语义
    expect(consumeInitialSettingsSection('general')).toBe('general')
  })

  it('意图优先于上次停留分区(显式入口直达语义)', () => {
    writeLastSettingsSectionPreference('about')
    setPendingSettingsSection('notifications')
    expect(consumeInitialSettingsSection('general')).toBe('notifications')
  })
})

describe('CustomEvent 通道(面板已开)', () => {
  it('设意图 → 已挂载面板收到事件即时切换,且不残留 sessionStorage', () => {
    const received: string[] = []
    const dispose = addPendingSettingsSectionListener((section) => {
      received.push(section)
    })

    setPendingSettingsSection('appearance')

    expect(received).toEqual(['appearance'])
    // 事件承载意图时同步清 sessionStorage,防陈旧 pending 覆盖"上次停留分区"
    expect(window.sessionStorage.getItem(SETTINGS_SECTION_INTENT_STORAGE_KEY)).toBeNull()
    dispose()
    // 退订后事件不再投递
    setPendingSettingsSection('models')
    expect(received).toEqual(['appearance'])
  })

  it('已开面板消费事件后,下次挂载落到"上次停留分区"而非陈旧意图', () => {
    writeLastSettingsSectionPreference('about')
    const dispose = addPendingSettingsSectionListener(() => {})
    setPendingSettingsSection('models')
    dispose()
    // 模拟用户切到别的分区退出后再挂载:无意图 → 上次停留
    expect(consumeInitialSettingsSection('general')).toBe('about')
  })
})

describe('无意图落"上次停留分区"', () => {
  it('无意图 → 上次停留;从未停留 → 回退默认', () => {
    expect(consumeInitialSettingsSection('general')).toBe('general')
    writeLastSettingsSectionPreference('shortcuts')
    expect(consumeInitialSettingsSection('general')).toBe('shortcuts')
  })

  it('consumePendingSettingsSection 无意图时返回 fallback', () => {
    expect(consumePendingSettingsSection('about')).toBe('about')
  })
})

describe('旧 section id 迁移', () => {
  it('上次停留分区的旧 id 读时迁移并落盘', () => {
    window.localStorage.setItem(SETTINGS_LAST_SECTION_STORAGE_KEY, 'theme')
    expect(consumeInitialSettingsSection('general')).toBe('appearance')
    // 迁移落盘,不继续传播历史路由语义
    expect(window.localStorage.getItem(SETTINGS_LAST_SECTION_STORAGE_KEY)).toBe('appearance')
  })

  it('sessionStorage 意图的旧 id 迁移', () => {
    window.sessionStorage.setItem(SETTINGS_SECTION_INTENT_STORAGE_KEY, 'apikeys')
    expect(consumePendingSettingsSection('general')).toBe('models')
    // 消费后即删
    expect(window.sessionStorage.getItem(SETTINGS_SECTION_INTENT_STORAGE_KEY)).toBeNull()
  })

  it('未知值删除持久化残留并回退', () => {
    window.localStorage.setItem(SETTINGS_LAST_SECTION_STORAGE_KEY, 'not-a-section')
    expect(consumeInitialSettingsSection('general')).toBe('general')
    expect(window.localStorage.getItem(SETTINGS_LAST_SECTION_STORAGE_KEY)).toBeNull()
  })
})

describe('storage 不可用不阻断', () => {
  it('sessionStorage 抛异常:设意图/消费都不抛,事件通道照常投递', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    vi.spyOn(window.sessionStorage, 'removeItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    const received: string[] = []
    const dispose = addPendingSettingsSectionListener((section) => received.push(section))
    expect(() => setPendingSettingsSection('models')).not.toThrow()
    // 存储坏了但事件通道仍在:已开面板仍可即时跳转
    expect(received).toEqual(['models'])
    expect(() => consumeInitialSettingsSection('general')).not.toThrow()
    dispose()
  })

  it('localStorage 抛异常:消费回退默认入口,不阻断打开设置页', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    expect(consumeInitialSettingsSection('general')).toBe('general')
    expect(() => writeLastSettingsSectionPreference('models')).not.toThrow()
  })
})
