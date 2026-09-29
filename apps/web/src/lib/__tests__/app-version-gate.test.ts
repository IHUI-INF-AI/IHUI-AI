// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

// G-700:app-version 强更策略判定纯函数的单测。
// 覆盖面(对齐票面):版本比较边界 / forceUpdate 与否两分支 / manual·quit 恒可用 /
// 强更期间锁死 skip·cancel 侧门 / confirm-close 触发形态 / 接线点 fail-open 与事件广播。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  APP_VERSION_GATE_EVENT,
  appVersionGate,
  appVersionGateCheck,
  compareVersions,
  gateAllowsAction,
  isActiveAppVersionGateKind,
  type AppVersionGateDecision,
} from '../app-version-gate'

vi.mock('@ihui/api-client/endpoints/system', () => ({
  checkAppVersion: vi.fn(),
}))

import { checkAppVersion } from '@ihui/api-client/endpoints/system'

const mockedCheck = checkAppVersion as unknown as ReturnType<typeof vi.fn>

describe('compareVersions(X.Y.Z 逐段数字比较)', () => {
  it('相等与缺段补零', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0)
    expect(compareVersions('1.2', '1.2.0')).toBe(0)
    expect(compareVersions('1', '1.0.0')).toBe(0)
  })
  it('逐段边界:major/minor/patch 各向', () => {
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1)
    expect(compareVersions('1.1.0', '1.0.9')).toBe(1)
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1)
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1)
  })
  it('多进位不按字典序:2.10.0 > 2.9.9', () => {
    expect(compareVersions('2.10.0', '2.9.9')).toBe(1)
    expect(compareVersions('2.9.9', '2.10.0')).toBe(-1)
  })
})

describe('appVersionGate(策略判定纯函数)', () => {
  it('低于服务端 minimumVersion ⇒ 强更会话', () => {
    const d = appVersionGate({
      currentVersion: '1.0.0',
      hasUpdate: false,
      minimumVersion: '2.0.0',
    })
    expect(d.required).toBe(true)
    expect(d.kind).toBe('checking')
    expect(d.reason).toContain('低于服务端最低版本 2.0.0')
  })
  it('等于/高于 minimumVersion ⇒ 不拦', () => {
    for (const currentVersion of ['2.0.0', '2.1.0']) {
      const d = appVersionGate({ currentVersion, hasUpdate: false, minimumVersion: '2.0.0' })
      expect(d.required).toBe(false)
      expect(d.kind).toBe('idle')
    }
  })
  it('minimumVersion=null(服务端没要求)⇒ 不按形状分支,直接看 forceUpdate 位', () => {
    const d = appVersionGate({ currentVersion: '1.0.0', hasUpdate: false, minimumVersion: null })
    expect(d.required).toBe(false)
    expect(d.reason).toContain('无更新')
  })
  it('分支一:hasUpdate && forceUpdate ⇒ 强更', () => {
    const d = appVersionGate({
      currentVersion: '1.0.0',
      hasUpdate: true,
      forceUpdate: true,
      latestVersion: '2.0.0',
      downloadUrl: 'https://example.com/dl',
    })
    expect(d.required).toBe(true)
    expect(d.kind).toBe('checking')
    expect(d.latestVersion).toBe('2.0.0')
    expect(d.downloadUrl).toBe('https://example.com/dl')
  })
  it('分支二:hasUpdate 但不强更 ⇒ 仅提示,侧门可用', () => {
    const d = appVersionGate({
      currentVersion: '1.0.0',
      hasUpdate: true,
      forceUpdate: false,
      latestVersion: '2.0.0',
    })
    expect(d.required).toBe(false)
    expect(d.kind).toBe('idle')
    expect(d.reason).toContain('未标记 forceUpdate')
  })
  it('forceUpdate 位缺省(undefined)不误判强更', () => {
    const d = appVersionGate({ currentVersion: '1.0.0', hasUpdate: true })
    expect(d.required).toBe(false)
  })
  it('当前版本形态非法 ⇒ fail-open 不拦且带留痕', () => {
    const d = appVersionGate({ currentVersion: 'abc', hasUpdate: true, forceUpdate: true })
    expect(d.required).toBe(false)
    expect(d.kind).toBe('error')
    expect(d.reason).toContain('fail-open')
  })
  it('服务端 minimumVersion 形态非法 ⇒ fail-open(同服务端配错降级哲学)', () => {
    const d = appVersionGate({
      currentVersion: '1.0.0',
      hasUpdate: false,
      minimumVersion: 'latest',
    })
    expect(d.required).toBe(false)
    expect(d.kind).toBe('error')
    expect(d.reason).toContain('minimumVersion')
  })
})

describe('gateAllowsAction(manual/quit 恒可用;强更锁死 skip/cancel 侧门)', () => {
  const activeStates = ['checking', 'downloading', 'ready', 'installing'] as const
  const passiveStates = ['error', 'dev-skipped', 'confirm-close', 'idle'] as const

  it('isActiveAppVersionGateKind 划出六终态机的 active 子集', () => {
    for (const s of activeStates) expect(isActiveAppVersionGateKind(s)).toBe(true)
    for (const s of passiveStates) expect(isActiveAppVersionGateKind(s)).toBe(false)
  })

  it('manual/quit 在全部状态恒可用', () => {
    for (const s of [...activeStates, ...passiveStates]) {
      for (const action of ['manual', 'quit'] as const) {
        const v = gateAllowsAction(s, { required: true }, action)
        expect(v.allowed, `${s}/${action}`).toBe(true)
      }
    }
  })

  it('active 自动态下 manual/quit 须先 confirm-close;confirm-close 态本身不再叠加确认', () => {
    for (const s of activeStates) {
      expect(gateAllowsAction(s, { required: true }, 'quit').confirmFirst).toBe(true)
      expect(gateAllowsAction(s, { required: true }, 'manual').confirmFirst).toBe(true)
    }
    expect(gateAllowsAction('confirm-close', { required: true }, 'quit').confirmFirst).toBe(false)
    expect(gateAllowsAction('idle', { required: false }, 'quit').confirmFirst).toBe(false)
  })

  it('强更会话(required=true)期间 skip/cancel 全状态锁死', () => {
    for (const s of [...activeStates, ...passiveStates]) {
      for (const action of ['skip', 'cancel'] as const) {
        const v = gateAllowsAction(s, { required: true }, action)
        expect(v.allowed, `${s}/${action}`).toBe(false)
        expect(v.reason).toContain('侧门锁死')
      }
    }
  })

  it('非强更会话 skip/cancel 侧门可用', () => {
    for (const action of ['skip', 'cancel'] as const) {
      const v = gateAllowsAction('idle', { required: false }, action)
      expect(v.allowed).toBe(true)
    }
  })
})

describe('appVersionGateCheck(接线:拉端点 + 广播决策)', () => {
  beforeEach(() => {
    mockedCheck.mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('端点返回 forceUpdate 更新 ⇒ 判强更并广播 CustomEvent', async () => {
    mockedCheck.mockResolvedValue({
      success: true,
      data: { hasUpdate: true, forceUpdate: true, latestVersion: '2.0.0' },
    })
    const events: AppVersionGateDecision[] = []
    const onDecision = (e: Event) => events.push((e as CustomEvent<AppVersionGateDecision>).detail)
    window.addEventListener(APP_VERSION_GATE_EVENT, onDecision)
    try {
      const d = await appVersionGateCheck({ currentVersion: '1.0.0' })
      expect(d.required).toBe(true)
      expect(d.kind).toBe('checking')
      expect(mockedCheck).toHaveBeenCalledWith({ version: '1.0.0', platform: 'web' })
      expect(events).toHaveLength(1)
      expect(events[0]?.required).toBe(true)
    } finally {
      window.removeEventListener(APP_VERSION_GATE_EVENT, onDecision)
    }
  })

  it('端点抛错 ⇒ fail-open 不拦,决策照常广播(留痕不静默)', async () => {
    mockedCheck.mockRejectedValue(new Error('network down'))
    const events: AppVersionGateDecision[] = []
    const onDecision = (e: Event) => events.push((e as CustomEvent<AppVersionGateDecision>).detail)
    window.addEventListener(APP_VERSION_GATE_EVENT, onDecision)
    try {
      const d = await appVersionGateCheck({ currentVersion: '1.0.0' })
      expect(d.required).toBe(false)
      expect(d.kind).toBe('error')
      expect(d.reason).toContain('network down')
      expect(events).toHaveLength(1)
    } finally {
      window.removeEventListener(APP_VERSION_GATE_EVENT, onDecision)
    }
  })

  it('端点 success=false ⇒ fail-open', async () => {
    mockedCheck.mockResolvedValue({ success: false })
    const d = await appVersionGateCheck()
    expect(d.required).toBe(false)
    expect(d.kind).toBe('error')
    expect(mockedCheck).toHaveBeenCalledWith({ version: '0.0.0', platform: 'web' })
  })
})
