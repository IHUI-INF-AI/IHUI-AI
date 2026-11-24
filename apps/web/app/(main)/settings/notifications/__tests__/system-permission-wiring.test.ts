// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 变异锁:系统通知权限三态必须真接进设置页。
// 三态判据本体在 ./system-permission-display,本文件锁「设置页消费方」,
// 防止「判据写了但页面没用」的半接线(对照 sendDesktopNotification 的同型锁)。
// @vitest-environment node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveSystemPermissionView } from '../system-permission-display'

const PAGE = path.resolve(__dirname, '../page.tsx')

describe('resolveSystemPermissionView - 展示态 fail-closed', () => {
  it('allowed/denied/unjudged 原样,labelKey 逐态对应', () => {
    expect(resolveSystemPermissionView('allowed')).toMatchObject({
      state: 'allowed',
      labelKey: 'systemPermissionStateAllowed',
      showDeniedHint: false,
    })
    expect(resolveSystemPermissionView('denied')).toMatchObject({
      state: 'denied',
      labelKey: 'systemPermissionStateDenied',
      showDeniedHint: true,
    })
    expect(resolveSystemPermissionView('unjudged')).toMatchObject({
      state: 'unjudged',
      labelKey: 'systemPermissionStateUnjudged',
      showDeniedHint: false,
    })
  })

  it('未查询(null)/畸形/未知态一律 unjudged,不冒充 allowed 也不冒充 denied', () => {
    for (const raw of [null, undefined, 'granted', 'allowed ', 42, {}, []]) {
      const view = resolveSystemPermissionView(raw)
      expect(view.state).toBe('unjudged')
      expect(view.showDeniedHint).toBe(false)
      expect(view.isJudged).toBe(false)
    }
  })
})

describe('设置页变异锁 - 三态消费方真装上', () => {
  it('真调用 querySystemNotificationPermission 且结果落到 state', () => {
    const src = readFileSync(PAGE, 'utf8')
    expect(src).toContain('querySystemNotificationPermission()')
    expect(src).toMatch(/querySystemNotificationPermission\(\)[\s\S]{0,300}setSystemPermission/)
    // 反向:抹掉调用后判据不再命中(证明锁有牙)
    const stripped = src.replace('querySystemNotificationPermission()', 'undefined')
    expect(stripped).not.toMatch(/querySystemNotificationPermission\(\)[\s\S]{0,300}setSystemPermission/)
  })

  it('默认 null(=未判定)且查询失败保持未判定,不预设 allowed', () => {
    const src = readFileSync(PAGE, 'utf8')
    expect(src).toMatch(/useState<SystemNotificationPermissionReport \| null>\(null\)/)
    expect(src).not.toMatch(/useState<SystemNotificationPermissionReport \| null>\(\{[^}]*state: 'allowed'/)
  })

  it('denied 提示只在 showDeniedHint 时渲染,且用独立 testid 可断言', () => {
    const src = readFileSync(PAGE, 'utf8')
    expect(src).toContain('systemView.showDeniedHint && (')
    expect(src).toContain('data-testid="system-permission-denied-hint"')
    const view = resolveSystemPermissionView('denied')
    expect(view.showDeniedHint).toBe(true)
    expect(resolveSystemPermissionView('allowed').showDeniedHint).toBe(false)
  })

  it('state 展示节点带 data-state,便于 E2E 断言三态', () => {
    const src = readFileSync(PAGE, 'utf8')
    expect(src).toContain('data-testid="system-permission-state"')
    expect(src).toContain('data-state={systemView.state}')
  })
})
