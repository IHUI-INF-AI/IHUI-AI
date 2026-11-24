// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「IHUI 自动安装」状态检测的判据(2026-11-23)。
 *
 * 钉住的四件事:
 *   ① 没有原生模块(旧包)⇒ 必须是 unknown,绝不能读成"未开启"或"已开启";
 *   ② 服务真的在跑 ⇒ 引导卡永不出现(旧实现只看"用户确认过",开好了也照样弹);
 *   ③ 确实没开 ⇒ 按 7 天节流弹;
 *   ④ 原生读数抛错 ⇒ 回落 unknown,不把异常当结论。
 *
 * react-native 用本文件内的替身(Platform=android/API36 + 可注入的 NativeModules 桥),
 * apk-update / ota-update 只被 auto-install 顶层引用,与状态判据无关,整包替身。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const bridge = vi.hoisted(() => ({
  current: null as null | { getStatus?: () => Promise<unknown> },
}))

vi.mock('react-native', () => ({
  Platform: { OS: 'android', Version: 36 },
  NativeModules: new Proxy(
    {},
    {
      get: (_target, prop) => (prop === 'AutoInstallStatus' ? bridge.current : undefined),
    },
  ),
}))

vi.mock('../src/lib/apk-update', () => ({
  applyApkUpdate: vi.fn(async () => 'available'),
  apkSnapshot: () => ({ state: 'idle' }),
}))
vi.mock('../src/lib/ota-update', () => ({
  otaSnapshot: () => ({ state: 'idle' }),
}))

import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  getAutoInstallStatus,
  hasAutoInstallStatusModule,
  normalizeAutoInstallStatus,
  shouldShowAutoInstallGuide,
  verifyAutoInstallEnabled,
} from '../src/lib/auto-install'

const GUIDE_KEY = 'ihui:a11y:guide-ack-at'
const DAY_MS = 24 * 60 * 60 * 1000

beforeEach(async () => {
  bridge.current = null
  await AsyncStorage.removeItem(GUIDE_KEY)
  vi.spyOn(Date, 'now').mockRestore()
})

describe('normalizeAutoInstallStatus', () => {
  it('代点留痕:整数与文本透传,非法类型归 null', () => {
    const ok = normalizeAutoInstallStatus({
      autoClicks: 3,
      lastClickAt: 1764000000000,
      lastClickLabel: '安装',
    })
    expect(ok.autoClicks).toBe(3)
    expect(ok.lastClickAt).toBe(1764000000000)
    expect(ok.lastClickLabel).toBe('安装')
    const bad = normalizeAutoInstallStatus({
      autoClicks: 'x',
      lastClickAt: Number.NaN,
      lastClickLabel: '   ',
    })
    expect(bad.autoClicks).toBeNull()
    expect(bad.lastClickAt).toBeNull()
    expect(bad.lastClickLabel).toBeNull()
  })

  it('缺字段一律 null,不把"读不到"说成 false', () => {
    const status = normalizeAutoInstallStatus({}, 33)
    expect(status).toEqual({
      enabled: null,
      package: null,
      installer: null,
      restrictedRisk: null,
      sdkInt: 33,
      source: 'native',
      autoClicks: null,
      lastClickAt: null,
      lastClickLabel: null,
    })
  })

  it('保留合法布尔与字符串,非法类型归 null', () => {
    const status = normalizeAutoInstallStatus({
      enabled: true,
      package: ' zh.ai.sq ',
      installer: 42,
      restrictedRisk: false,
      sdkInt: 33.9,
    })
    expect(status.enabled).toBe(true)
    expect(status.package).toBe('zh.ai.sq')
    expect(status.installer).toBeNull()
    expect(status.restrictedRisk).toBe(false)
    expect(status.sdkInt).toBe(33)
  })
})

describe('getAutoInstallStatus', () => {
  it('没有原生模块 ⇒ unavailable + unknown', async () => {
    const status = await getAutoInstallStatus()
    expect(status.source).toBe('unavailable')
    expect(status.enabled).toBeNull()
    expect(status.restrictedRisk).toBeNull()
    expect(status.sdkInt).toBe(36)
    expect(hasAutoInstallStatusModule()).toBe(false)
  })

  it('原生回包 ⇒ native 且如实反映 enabled/installer', async () => {
    bridge.current = {
      getStatus: async () => ({
        enabled: true,
        package: 'zh.ai.sq',
        installer: 'com.google.android.packageinstaller',
        restrictedRisk: true,
        sdkInt: 36,
      }),
    }
    const status = await getAutoInstallStatus()
    expect(hasAutoInstallStatusModule()).toBe(true)
    expect(status.source).toBe('native')
    expect(status.enabled).toBe(true)
    expect(status.installer).toBe('com.google.android.packageinstaller')
    expect(status.restrictedRisk).toBe(true)
  })

  it('原生读数抛错 ⇒ 回落 unknown,不抛给调用方', async () => {
    bridge.current = {
      getStatus: async () => {
        throw new Error('boom')
      },
    }
    const status = await getAutoInstallStatus()
    expect(status.source).toBe('unavailable')
    expect(status.enabled).toBeNull()
  })
})

describe('shouldShowAutoInstallGuide', () => {
  it('服务真在跑 ⇒ 永不弹(即使从未确认过)', async () => {
    bridge.current = { getStatus: async () => ({ enabled: true }) }
    expect(await shouldShowAutoInstallGuide()).toBe(false)
    expect(await AsyncStorage.getItem(GUIDE_KEY)).toBeNull()
  })

  it('确实没开且从未确认 ⇒ 弹', async () => {
    bridge.current = { getStatus: async () => ({ enabled: false }) }
    expect(await shouldShowAutoInstallGuide()).toBe(true)
  })

  it('旧包读不到状态 ⇒ 按 7 天节流(没确认过就弹)', async () => {
    expect(await shouldShowAutoInstallGuide()).toBe(true)
  })

  it('确认后 1 天内不打扰,超过 7 天再提醒', async () => {
    bridge.current = { getStatus: async () => ({ enabled: false }) }
    const now = 1_800_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(now)
    await AsyncStorage.setItem(GUIDE_KEY, String(now - DAY_MS))
    expect(await shouldShowAutoInstallGuide()).toBe(false)
    vi.spyOn(Date, 'now').mockReturnValue(now + 8 * DAY_MS)
    expect(await shouldShowAutoInstallGuide()).toBe(true)
  })
})

describe('verifyAutoInstallEnabled', () => {
  it('已开启 ⇒ true', async () => {
    bridge.current = { getStatus: async () => ({ enabled: true }) }
    expect(await verifyAutoInstallEnabled()).toBe(true)
  })

  it('读不到 ⇒ null(不能用"没读到"判"没开")', async () => {
    expect(await verifyAutoInstallEnabled()).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
