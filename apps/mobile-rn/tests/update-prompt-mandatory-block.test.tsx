// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * UpdatePrompt 的 mandatory 强制更新行为取证(2026-11-13,#5 展示面)。
 *
 * lib/__tests__/ota-update.test.ts 钉的是**状态机字段**(mandatory 怎么从 expo-updates
 * 的 isMandatory 落到 store);本套件钉的是**可见承诺** —— 用户在屏幕上到底看到什么:
 *   ① mandatory=false + ready ⇒ 顶部下滑横幅,有关闭 X(可关闭),[更新] 在;
 *   ② mandatory=true + ready ⇒ 升级为非关闭全屏阻塞层:**没有关闭 X**、[更新] 是唯一出口;
 *   ③ mandatory=true 但仍在 downloading ⇒ 不提前卡死,仍走顶部横幅带读条;
 *   ④ 阻塞层的 [更新] 点下去真的调 applyOtaUpdate(不能是个点不动的空壳)。
 *
 * 只 mock 呈现依赖(ota/apk store、i18n、theme、Tappable、BottomPops);react-native /
 * design-tokens / lucide / svg 走 vitest.config 的全局别名替身。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

// 可控的 OTA 状态:每个用例改这一份再重渲染。
const ota = vi.hoisted(() => ({
  state: 'ready' as string,
  dismissed: false,
  downloadProgress: 0,
  mandatory: false,
  applyOtaUpdate: vi.fn(async () => true),
}))

vi.mock('../src/lib/ota-update', () => ({
  useOtaUpdate: () => ({
    state: ota.state,
    dismissed: ota.dismissed,
    downloadProgress: ota.downloadProgress,
    mandatory: ota.mandatory,
  }),
  applyOtaUpdate: ota.applyOtaUpdate,
  checkOtaUpdate: vi.fn(async () => 'ready'),
  dismissOtaPrompt: vi.fn(),
  runningBundle: () => ({ kind: 'embedded', id: null }),
  shouldAutoRecheck: () => false,
}))

// 整包(APK)通道:测试只关心 OTA 强制面,APK 恒为 idle 且不可见。
vi.mock('../src/lib/apk-update', () => ({
  useApkUpdate: () => ({ state: 'idle', dismissed: false }),
  checkApkUpdate: vi.fn(async () => undefined),
  onApkAppForeground: vi.fn(),
  shouldAutoRecheckApk: () => false,
  isApkPromptVisible: () => false,
}))
vi.mock('../src/lib/auto-install', () => ({ tryAutoApplyApk: vi.fn(async () => false) }))
vi.mock('../src/components/AutoInstallGuide', () => ({
  AutoInstallGuide: () => createElement('div', { 'data-testid': 'auto-install-guide' }),
}))
vi.mock('../src/components/ApkUpdatePrompt', () => ({
  ApkUpdatePromptView: () => null,
  isApkPromptVisible: () => false,
}))
vi.mock('../src/components/BottomPops', () => ({ appAlert: vi.fn() }))
vi.mock('../src/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
// 主题替身:组件在模块求值期(StyleSheet.create)读一大片 token 路径(tokens.overlay.loading /
// surface.inputBg / brandAccent.deep …)。用嵌套代理让任意 `tokens.x.y` 都返回字符串,避免
// 逐键手抄漏一就整份套件收集期炸。颜色值与断言无关(断言走 accessibilityLabel),不掩盖任何行为。
function tokenProxy(): unknown {
  const leaf = 'rgba(0,0,0,0)'
  return new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === Symbol.toPrimitive) return () => leaf
      if (prop === 'toString') return () => leaf
      if (prop === 'valueOf') return () => leaf
      return tokenProxy()
    },
    apply: () => leaf,
  })
}
vi.mock('../src/theme/active-tokens', () => ({ tokens: tokenProxy() }))
// design-tokens 的 rnSpacing/rnRadius/rnType/ELEVATION_STEPS 同在 StyleSheet.create 顶层展开,
// 同样用代理兜任意 `rnSpacing.md` / `ELEVATION_STEPS.lg` 读数。
vi.mock('@ihui/design-tokens', () => ({
  tokens: tokenProxy(),
  rnSpacing: tokenProxy(),
  rnRadius: tokenProxy(),
  rnType: tokenProxy(),
  ELEVATION_STEPS: tokenProxy(),
  getRnTokens: () => tokenProxy(),
}))
// Tappable 薄壳 → 可点击元素(与 edu-attendance-screens 同型)。
// accessibilityLabel 必须映射到 aria-label:共享 RN mock 的 mk() 做了这件事(替身 API 面纪律),
// 这里自建的 Tappable 替身同样要补,否则 getByLabelText 检索不到 [更新]/关闭钮。
vi.mock('@ihui/ui-native', () => ({
  Tappable: (props: { children?: ReactNode; onPress?: () => void; accessibilityLabel?: string; [k: string]: unknown }) => {
    const { children, onPress, accessibilityLabel, ...rest } = props
    const extra: Record<string, unknown> = {}
    if (typeof accessibilityLabel === 'string') extra['aria-label'] = accessibilityLabel
    return createElement('button', { ...rest, ...extra, onClick: onPress }, children)
  },
}))

import { UpdatePrompt } from '../src/components/UpdatePrompt'

function setOta(next: Partial<typeof ota>): void {
  Object.assign(ota, next)
}

describe('UpdatePrompt:mandatory 强制更新呈现', () => {
  beforeEach(() => {
    ota.applyOtaUpdate.mockClear()
    ota.applyOtaUpdate.mockResolvedValue(true)
    setOta({ state: 'ready', dismissed: false, downloadProgress: 0, mandatory: false })
  })
  afterEach(() => cleanup())

  it('① mandatory=false + ready ⇒ 顶部横幅:有关闭 X(可关闭) + [更新] 在', () => {
    render(createElement(UpdatePrompt))
    // 关闭钮在 ⇒ 用户可关掉(历史可关闭行为保持)
    expect(screen.getByLabelText('appUpdate.close')).toBeTruthy()
    // [更新] 出口在
    expect(screen.getByLabelText('appUpdate.action')).toBeTruthy()
  })

  it('② mandatory=true + ready ⇒ 全屏阻塞层:无关闭 X、[更新] 是唯一出口', () => {
    setOta({ mandatory: true, state: 'ready' })
    render(createElement(UpdatePrompt))
    // 关闭钮**不在** ⇒ 用户不能绕过强制生效
    expect(screen.queryByLabelText('appUpdate.close')).toBeNull()
    // [更新] 是唯一出口,仍在
    expect(screen.getByLabelText('appUpdate.action')).toBeTruthy()
    // 全屏阻塞容器带 alert 语义
    expect(screen.getByLabelText('appUpdate.title')).toBeTruthy()
  })

  it('③ mandatory=true 但 downloading ⇒ 不提前卡死,仍走顶部横幅(带读条、可关闭、无 [更新] 钮)', () => {
    setOta({ mandatory: true, state: 'downloading', downloadProgress: 42 })
    render(createElement(UpdatePrompt))
    // 下载途中不升级为阻塞层 ⇒ 关闭钮还在(只是这次会话可暂关,下一轮就绪再阻塞)
    expect(screen.getByLabelText('appUpdate.close')).toBeTruthy()
    // 下载中不显示 [更新] 钮(源码 downloading ? null : 钮),只有读条;避免下载途中点空
    expect(screen.queryByLabelText('appUpdate.action')).toBeNull()
  })

  it('④ 阻塞层点 [更新] ⇒ 真调 applyOtaUpdate(不是空壳)', async () => {
    setOta({ mandatory: true, state: 'ready' })
    render(createElement(UpdatePrompt))
    fireEvent.click(screen.getByLabelText('appUpdate.action'))
    // handleUpdate 先等 600ms 再 applyOtaUpdate
    await vi.waitFor(() => expect(ota.applyOtaUpdate).toHaveBeenCalledTimes(1))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
