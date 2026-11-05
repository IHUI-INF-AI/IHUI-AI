// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「两步验证」行从只读变成真能改 —— props 注入式接线锁。
 *
 * 立因:共享屏 `SecuritySettingsScreen` 的 twoFactorEnabled 行此前只能读,而同一读数在 RN
 * 「安全中心」屏(apps/mobile-rn/src/screens/SecurityCenterScreen.tsx)有真写面
 * (/api/auth/2fa/setup|verify|disable)。本次给共享屏加**可选** prop `onOpenTwoFactor`:
 * RN 薄壳在**当前宿主在册 SecurityCenter** 时注入跳转;小程序端没有那一屏
 * (rn-compat 的 routeNames 取 RN_ROUTE_MAP ⇒ 不含)⇒ 不注入,那一行渲染与改前逐字一致。
 * 「不传即旧行为」是向后兼容的唯一保证,所以正反两面都必须钉住:
 *   ① 注入 ⇒ 该行是真实可点的入口(矢量箭头、点击恰好跳一次、不顺手发写请求);
 *   ② 不注入 ⇒ 与"无注入直调共享屏"逐字节相同(整卡 HTML 相等,不是口头兼容);
 *   ③ 注入只落在那一行 ⇒ 其余三行 HTML 逐字节不动;
 *   ④ 宿主屏名判不出 ⇒ 不注入(拿不到读数不得当成"在册",§0.3);
 *   ⑤ 一行不得同时有开关与跳转(两个意图必有一个是假的);
 *   ⑥ 反证锁有牙:摘掉注入 ⇒ ① 的可点节点必须当场消失(① 因此不可能是恒真判据)。
 *
 * 目录用 tests/(§23:`__*` 会被 .gitignore 静默吞掉)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { render, cleanup, waitFor, fireEvent, within } from '@testing-library/react'
import type * as ApiClient from '@ihui/api-client'
import type * as I18nModule from '../src/i18n'

const api = vi.hoisted(() => ({ fetchApi: vi.fn() }))
const nav = vi.hoisted(() => ({
  navigate: vi.fn(),
  goBack: vi.fn(),
  /** null = 宿主拿不到在册屏名(未判定);数组 = 宿主登记的屏名 */
  routeNames: null as string[] | null,
}))

vi.mock('@ihui/api-client', async (importOriginal) => {
  const real = await importOriginal<typeof ApiClient>()
  return { ...real, fetchApi: api.fetchApi }
})

// 真词包取词;useI18n 必须返回**稳定引用**(薄壳 useEffect 依赖 [t],每次新对象会无限重跑取数)。
vi.mock('../src/i18n', async (importOriginal) => {
  const mod = await importOriginal<typeof I18nModule>()
  const t = (key: string) => {
    const v = mod.getValueByPath(mod.messages['zh-CN'], key)
    return typeof v === 'string' ? v : key
  }
  const value = { locale: 'zh-CN' as const, setLocale: async () => {}, t }
  return { ...mod, useI18n: () => value }
})

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: nav.navigate,
    goBack: nav.goBack,
    setOptions: vi.fn(),
    getState: () => (nav.routeNames === null ? undefined : { routeNames: nav.routeNames }),
  }),
}))
vi.mock('@react-navigation/native-stack', () => ({}))

// 端内 @ihui/rn-app 的别名指向具名替身;本判据量的是共享屏真身 ⇒ 按相对路径转发真身(不复刻实现)。
vi.mock('@ihui/rn-app', async () => {
  const shared = await import(
    '../../../packages/app/src/features/security-settings/SecuritySettingsScreen'
  )
  return { SecuritySettingsScreen: shared.SecuritySettingsScreen }
})

// 图标**不替身**:门 102 判的是"箭头是不是矢量出口",替身会把这条判据测成测 mock。
// packages/app 那侧的 lucide-react-native 由该包自己解析(vi.mock 的键按解析后的绝对路径生效,
// 从本端解析到的那份替身管不到它)⇒ 这里直接量真身渲出的 <svg>,并反向钉死"不得用字符当箭头"。
const GLYPH_ARROW_CHARS = /[›»→‹←]/

import { SecuritySettingsScreen as RnShell } from '../src/screens/SecuritySettingsScreen'
import {
  SecuritySettingsScreen as SharedScreen,
  type SecuritySettingsItem,
} from '../../../packages/app/src/features/security-settings/SecuritySettingsScreen'
import { messages, getValueByPath } from '../src/i18n'

const SETTINGS: SecuritySettingsItem = {
  passwordEnabled: true,
  biometricEnabled: false,
  twoFactorEnabled: true,
  loginAlert: false,
}

type SharedProps = Parameters<typeof SharedScreen>[0]

const zh = (key: string) => {
  const v = getValueByPath(messages['zh-CN'], key)
  expect(typeof v, `词包 ${key} 不是字符串`).toBe('string')
  return v as string
}

const ok = (data: unknown) => ({ success: true as const, data })
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
/** 写请求口径与同端 security-settings-readonly-copy.test.tsx 一致(方法名或命中 MFA/2FA 路径)。 */
function writeCalls(): unknown[][] {
  return api.fetchApi.mock.calls.filter(([path, opts]) => {
    const method = (opts as { method?: string } | undefined)?.method
    return (
      (typeof method === 'string' && WRITE_METHODS.has(method.toUpperCase())) ||
      /\/api\/(mfa|auth\/2fa)\b/i.test(String(path))
    )
  })
}

/** 共享屏的「无注入」直调形态:薄壳不注入时,渲染面必须与它逐字节相同。 */
function renderShared(extra: Partial<Record<keyof SharedProps, unknown>> = {}) {
  const props = {
    t: zh,
    settings: SETTINGS,
    loading: false,
    error: '',
    readOnly: true,
    onBack: () => {},
    ...extra,
  } as unknown as SharedProps
  return render(createElement(SharedScreen, props))
}

/** 四行读数所在的那张卡:按「恰有四个子节点且四行标签齐备」定位,不靠 div 序号(序号一改就假绿)。 */
function rowsCard(container: HTMLElement): Element {
  const labels = [
    zh('securitySettings.password'),
    zh('securitySettings.biometric'),
    zh('securitySettings.twoFactor'),
    zh('securitySettings.loginAlert'),
  ]
  const card = Array.from(container.querySelectorAll('div')).find(
    (d) => d.children.length === 4 && labels.every((l) => (d.textContent ?? '').includes(l)),
  )
  expect(card, '未取到四行读数卡').toBeTruthy()
  return card as Element
}

const rowHtml = (container: HTMLElement): string[] =>
  Array.from(rowsCard(container).children).map((el) => el.innerHTML)

/** 卡片内**行级**可点节点(返回键也是 <button>,但不含行标签 ⇒ 天然不计入)。 */
function rowButtons(container: HTMLElement): HTMLButtonElement[] {
  const label = zh('securitySettings.twoFactor')
  return Array.from(rowsCard(container).querySelectorAll('button')).filter((b) =>
    (b.textContent ?? '').includes(label),
  ) as HTMLButtonElement[]
}

/** 等读数上屏(取数完成):只等标题会把 loading 态也算过。 */
async function waitForRows(container: HTMLElement) {
  await waitFor(() => {
    expect(rowHtml(container)).toHaveLength(4)
  })
}

describe('「两步验证」行的 props 注入接线', () => {
  beforeEach(() => {
    cleanup()
    api.fetchApi.mockReset()
    api.fetchApi.mockResolvedValue(ok(SETTINGS))
    nav.navigate.mockReset()
    nav.goBack.mockReset()
    nav.routeNames = null
  })
  afterEach(() => cleanup())

  it('① 正向:宿主在册 ⇒ 该行是真实可点入口,点击恰好跳一次且不发写请求', async () => {
    nav.routeNames = ['SecuritySettings', 'SecurityCenter']
    const { container } = render(createElement(RnShell))
    await waitForRows(container)

    const buttons = rowButtons(container)
    expect(buttons).toHaveLength(1)
    // 真实读数不得被入口顶掉:仍写「已开启」,不是「点这里修改」那种空话
    expect(buttons[0]?.textContent).toContain(zh('securitySettings.stateOn'))
    // 箭头必须是矢量出口(GA1:禁止字符当图标)
    expect(buttons[0]?.querySelector('svg')).toBeTruthy()
    expect(buttons[0]?.textContent ?? '').not.toMatch(GLYPH_ARROW_CHARS)

    fireEvent.click(buttons[0] as HTMLButtonElement)
    expect(nav.navigate).toHaveBeenCalledTimes(1)
    expect(nav.navigate).toHaveBeenCalledWith('SecurityCenter')
    expect(writeCalls()).toEqual([])
    // 本页取数腿仍只有那一次 GET:入口不顺手改数据
    expect(api.fetchApi).toHaveBeenCalledTimes(1)
    expect(api.fetchApi).toHaveBeenCalledWith('/user/security')
  })

  it('② 反证:宿主不在册(小程序形态)⇒ 不注入,整卡与「无注入直调共享屏」逐字节相同', async () => {
    nav.routeNames = ['SecuritySettings'] // 小程序 rn-compat:RN_ROUTE_MAP 不含 SecurityCenter
    const { container } = render(createElement(RnShell))
    await waitForRows(container)

    expect(rowButtons(container)).toHaveLength(0)
    // 未注入形态:卡片内不得长出任何图标/字符箭头(入口整体不存在,不是"藏起来")
    expect(rowsCard(container).querySelector('svg')).toBeNull()
    expect(rowsCard(container).textContent ?? '').not.toMatch(GLYPH_ARROW_CHARS)
    // 读数照旧逐行如实(入口没了,读数不能跟着没)
    expect(within(container).getAllByText(zh('securitySettings.stateOn'))).toHaveLength(2)
    expect(within(container).getAllByText(zh('securitySettings.stateOff'))).toHaveLength(2)
    expect(nav.navigate).not.toHaveBeenCalled()
    const shellHtml = rowHtml(container)
    cleanup()

    const control = renderShared()
    await waitForRows(control.container)
    expect(rowHtml(control.container)).toEqual(shellHtml)
    cleanup()
  })

  it('③ 注入只落在那一行:其余三行 HTML 逐字节不动', async () => {
    const before = renderShared()
    await waitForRows(before.container)
    const beforeRows = rowHtml(before.container)
    cleanup()

    nav.routeNames = ['SecurityCenter']
    const after = render(createElement(RnShell))
    await waitForRows(after.container)
    const afterRows = rowHtml(after.container)

    expect(afterRows).toHaveLength(4)
    // 第 0/1/3 行(密码、生物识别、登录提醒)与注入前逐字节相同;只有第 2 行变了
    for (const idx of [0, 1, 3]) {
      expect(afterRows[idx], `第 ${idx} 行被入口连带改动`).toBe(beforeRows[idx])
    }
    expect(afterRows[2]).not.toBe(beforeRows[2])
  })

  it('④ 宿主屏名判不出(getState 缺失)⇒ 不注入,不得把「没读到」当成「在册」', async () => {
    nav.routeNames = null
    const { container } = render(createElement(RnShell))
    await waitForRows(container)

    expect(rowButtons(container)).toHaveLength(0)
    const shellHtml = rowHtml(container)
    cleanup()

    const control = renderShared()
    await waitForRows(control.container)
    expect(rowHtml(control.container)).toEqual(shellHtml)
  })

  it('⑤ 一行不得同时有开关与跳转(注入形态里该行 0 枚 Switch)', async () => {
    nav.routeNames = ['SecurityCenter']
    const { container } = render(createElement(RnShell))
    await waitForRows(container)

    const buttons = rowButtons(container)
    expect(buttons).toHaveLength(1)
    expect(buttons[0]?.querySelectorAll('input[type="checkbox"]')).toHaveLength(0)
  })

  it('⑥ 反证锁有牙:摘掉注入 ⇒ ① 的可点节点当场消失', async () => {
    nav.routeNames = ['SecurityCenter']
    const wired = render(createElement(RnShell))
    await waitForRows(wired.container)
    expect(rowButtons(wired.container)).toHaveLength(1)
    const wiredRows = rowHtml(wired.container)
    cleanup()

    // 同一薄壳、同一读数:只摘掉宿主在册屏名 ⇒ 可点节点与箭头一起消失,卡片回到未注入形态
    nav.routeNames = []
    const stripped = render(createElement(RnShell))
    await waitForRows(stripped.container)
    expect(rowButtons(stripped.container)).toHaveLength(0)
    expect(rowsCard(stripped.container).querySelector('svg')).toBeNull()
    const strippedRows = rowHtml(stripped.container)
    expect(strippedRows[2]).not.toBe(wiredRows[2])
    for (const idx of [0, 1, 3]) {
      expect(strippedRows[idx]).toBe(wiredRows[idx])
    }
    cleanup()

    // 第三重:调用方根本不给这个 prop ⇒ 与摘掉注入的薄壳逐字节同形
    const sharedNoProp = renderShared()
    await waitForRows(sharedNoProp.container)
    expect(rowButtons(sharedNoProp.container)).toHaveLength(0)
    expect(rowHtml(sharedNoProp.container)).toEqual(strippedRows)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
