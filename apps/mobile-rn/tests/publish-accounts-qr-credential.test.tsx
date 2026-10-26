// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 平台账号扫码页二维码这一腿的凭据判据(2026-10-26 审计第 2 条)。
 *
 * 病灶:`<Image source={{ uri, headers }}> headers` 直传 `getToken()` 快照 —— access token
 * 只有 15 分钟,而这条请求不经过 api-client 的 401 重放(它是 RN 原生图片加载器发的),
 * 过期后二维码就是**一张裂图且永不自愈**。扫码等待经常超过 15 分钟。
 *
 * 这一格钉四件事(都按可观察面断言,不读实现内部):
 * ① 出图前必须先过 `ensureFreshToken()`(剩余 ≤5 分钟先续期)——图在票落定之前不出现;
 * ② 拿不到票(未登录/存储空)时不发这一发,停在 loading,而不是发一发必被拒的匿名请求;
 * ③ 取图失败只允许**一次**"续期 + 换 ?r= 重取"额度(第二发仍失败就不再刷凭据);
 * ④ 重取后仍失败 ⇒ 可见错误上屏(不许把营销位留成空白)。
 *
 * 取舍(与实现处的注释同一份):审计首选的"改走 fetchRaw 取 blob"在 RN 落不了地
 * (Hermes 无 URL.createObjectURL / FileReader,`<Image>` 只吃 uri),所以走第二条出路
 * "过期先续期再渲染 + 一次重取";判据本体(该不该续期、只重试一次)在 lib/token,
 * 用例在 tests/token.test.ts,这里只测这一屏的接线与重试额度。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const api = vi.hoisted(() => ({
  fetchApi: vi.fn(),
  ensureFreshToken: vi.fn(),
  appAlert: vi.fn(),
  showToast: vi.fn(),
}))

vi.mock('@ihui/api-client', () => ({ fetchApi: api.fetchApi }))
vi.mock('../src/lib/token', () => ({ ensureFreshToken: api.ensureFreshToken }))
vi.mock('../src/components/BottomPops', () => ({ appAlert: api.appAlert, showToast: api.showToast }))
vi.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: vi.fn() }) }))
vi.mock('lucide-react-native', () => {
  const icon = () => createElement('i')
  return { X: icon, QrCode: icon, Trash2: icon, AlertCircle: icon }
})
// 页头两件套不是本屏判据;替身做掉,免得为它们各自的图标具名清单兜圈子
// (漏一枚就是"Element type is invalid"整屏渲染失败 —— 那是夹具的洞,不是被测面的洞)。
vi.mock('../src/components/NavChrome', () => ({
  NavChrome: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
}))
vi.mock('../src/components/NavBar', () => ({
  NavBar: ({ title }: { title?: string }) => createElement('div', null, title),
}))

import { I18nProvider, messages, getValueByPath } from '../src/i18n'
import PublishAccountsScreen from '../src/screens/PublishAccountsScreen'

const zh = messages['zh-CN'] as Record<string, unknown>
const val = (key: string): string => getValueByPath(zh, key) as string

const ACCOUNT = {
  id: 1,
  platform: 'demo',
  displayName: 'Demo',
  status: 'active',
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find((b) =>
    (b.textContent ?? '').includes(text),
  ) as HTMLButtonElement | undefined
}

/** 账号行 → 面板(替身把 TouchableOpacity 落成 <button>,按文案找入口) */
async function openPanel(container: HTMLElement) {
  await waitFor(() => expect(container.textContent).toContain(val('publishAccounts.title')))
  const row = buttonByText(container, ACCOUNT.displayName)
  expect(row, '账号列表里没有那一行(取数腿没接上?)').toBeTruthy()
  fireEvent.click(row!)
  await waitFor(() => expect(container.textContent).toContain(val('publishAccounts.platform')))
}

/** 面板 → 点「重新授权」→ 轮询出 has_qr */
async function startScan(container: HTMLElement) {
  const reauth = buttonByText(container, val('publishAccounts.reauth'))
  expect(reauth, '面板里没有「重新授权」入口').toBeTruthy()
  fireEvent.click(reauth!)
}

/** 一路推到"该出二维码"那一帧 */
async function openQrFrame(container: HTMLElement) {
  await openPanel(container)
  await startScan(container)
  await waitFor(() => expect(container.querySelector('img')).toBeTruthy(), { timeout: 4000 })
}

function mockStartScan() {
  api.fetchApi.mockImplementation(async (url: string) => {
    if (url.includes('/accounts/me')) return { success: true, data: { items: [ACCOUNT] } }
    if (url.includes('/publish/platforms')) return { success: true, data: { items: [] } }
    if (url.includes('/scan-login/platforms'))
      return { success: true, data: { platforms: [{ platform: 'demo' }] } }
    if (url.includes('/scan-login/start'))
      return { success: true, data: { task_id: 't1', status: 'waiting' } }
    if (url.includes('/status'))
      return { success: true, data: { task_id: 't1', status: 'waiting', has_qr: true } }
    return { success: true, data: {} }
  })
}

const renderScreen = () =>
  render(createElement(I18nProvider, null, createElement(PublishAccountsScreen)))

describe('PublishAccountsScreen — 二维码这一腿的凭据', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStartScan()
    api.ensureFreshToken.mockResolvedValue('fresh-ticket')
  })

  it('出图前先把凭据取新鲜:票没落定前不发这一发', async () => {
    let release!: (v: string | null) => void
    api.ensureFreshToken.mockImplementation(
      () =>
        new Promise<string | null>((resolve) => {
          release = resolve
        }),
    )
    const { container } = renderScreen()
    await openPanel(container)
    await startScan(container)

    // ensureFreshToken 已被叫到,而它还没回来 ⇒ 此刻只有 loading,没有裂图
    await waitFor(() => expect(api.ensureFreshToken).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 200))
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('loading')

    release('fresh-ticket')
    await waitFor(() => expect(container.querySelector('img')).toBeTruthy(), { timeout: 4000 })
  })

  it('拿不到凭据(未登录/存储空)⇒ 停在 loading,不发匿名请求', async () => {
    api.ensureFreshToken.mockResolvedValue(null)
    const { container } = renderScreen()
    await openPanel(container)
    await startScan(container)
    await waitFor(() => expect(api.ensureFreshToken).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 200))
    expect(container.querySelector('img')).toBeNull()
  })

  it('取图失败:只给一次"续期 + 重取"额度,第二次仍失败就不再刷凭据', async () => {
    const { container } = renderScreen()
    await openQrFrame(container)
    const callsAfterFirstPaint = api.ensureFreshToken.mock.calls.length
    expect(callsAfterFirstPaint).toBeGreaterThanOrEqual(1)

    fireEvent.error(container.querySelector('img')!)
    await waitFor(() => expect(api.ensureFreshToken.mock.calls.length).toBe(callsAfterFirstPaint + 1))

    // 第二发仍失败 ⇒ 额度用尽:不再第三次刷凭据(旧实现会一直裂、一直无人管)
    fireEvent.error(container.querySelector('img')!)
    await new Promise((r) => setTimeout(r, 200))
    expect(api.ensureFreshToken.mock.calls.length).toBe(callsAfterFirstPaint + 1)
  })

  it('重取仍失败 ⇒ 可见错误上屏(不把扫码区留成空白)', async () => {
    const { container } = renderScreen()
    await openQrFrame(container)

    fireEvent.error(container.querySelector('img')!)
    await waitFor(() => expect(container.querySelector('img')).toBeTruthy())
    fireEvent.error(container.querySelector('img')!)

    await waitFor(() => expect(container.textContent).toContain(val('common.failed')), {
      timeout: 4000,
    })
  })

  it('阳性对照(反向锁):屏里不再留 getToken() 快照,出图必须过兜带', async () => {
    const src = readFileSync(resolve(__dirname, '../src/screens/PublishAccountsScreen.tsx'), 'utf8')
    // 只认代码不认注释(注释里的说明文字不能当接线证据,与 carousel 那套同一规矩)
    const body = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
    expect(body).toContain('ensureFreshToken(')
    expect(body).toContain('onError={onQrError}')
    // 旧病灶:渲染帧直接吃凭据快照 —— 回来一次就判红一次
    expect(body).not.toContain('getToken()')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
