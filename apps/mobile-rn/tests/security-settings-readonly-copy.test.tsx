// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全设置屏「只读提示」的诚实性自证。
 *
 * 立因:RN 薄壳把共享屏的 `readOnly` 置真(apps/mobile-rn/src/screens/SecuritySettingsScreen.tsx),
 * 共享屏随之上屏 `securitySettings.readOnlyHint`。那句话的原值是「以下为当前真实状态，后端暂不支持
 * 修改」—— 而 MFA/2FA 的写端点早已在共享层(/api/mfa/enable|disable、/api/auth/2fa/setup|verify|
 * disable),端内「安全中心」屏整条流程也已经跑通。对用户说"不支持修改"而实际支持,那是撒谎,
 * 不是保守。本套件钉的是**渲上屏的那行字**,不是键名。
 *
 * 五格判据:
 *  ① 正向:薄壳渲染出的提示 == 真词包 zh-CN 的该键值,且点名端内真实存在的入口(securityCenter.title)
 *     与它承载的那一项(securitySettings.twoFactor);裸键名不得漏上屏。
 *  ② 反证:五语言逐条同判。任何一枚 locale 被改回"后端不支持修改"那一句概览式否认 ⇒ 本用例翻红
 *     (改回原形态时"点名入口"这一条必然先不成立,不依赖存旧字符串当对照)。
 *  ③ 只读形态不得有假开关,且状态读数与 settings 逐行对得上;正向对照:撤掉 readOnly 后四枚
 *     开关真的上屏 —— 否则"零枚开关"是一条恒真的空判据。
 *  ④ 本页不得偷偷发写请求:成功面恰好一次 GET,取数失败(含 401)面零次追加动作。
 *  ⑤ ④ 的探测器有牙:手工发一枚写请求必须被点名,否则 ④ 只是没测。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import type * as ApiClient from '@ihui/api-client'
import type * as I18nModule from '../src/i18n'

const api = vi.hoisted(() => ({ fetchApi: vi.fn() }))

// 取数腿只有 fetchApi 一处出口;其余出口一律用真实现,免得"测的是替身"。
vi.mock('@ihui/api-client', async (importOriginal) => {
  const real = await importOriginal<typeof ApiClient>()
  return { ...real, fetchApi: api.fetchApi }
})

// 真词包取词,但 useI18n 必须返回**稳定引用**:薄壳的 useEffect 依赖 [t],
// 每次渲染发新对象会让取数无限重跑(与同端 security-ip-panel.test.tsx 同一处理)。
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
  useNavigation: () => ({ goBack: vi.fn(), navigate: vi.fn(), setOptions: vi.fn() }),
}))
vi.mock('@react-navigation/native-stack', () => ({}))

// 端内 `@ihui/rn-app` 的别名指向 tests/__mocks__/ihui-rn-app.ts 那份具名替身,而它没有
// SecuritySettingsScreen 出口;本判据量的是共享屏真身渲出的那行字 ⇒ 按相对路径直连源文件转发
// (与 g-469-course-filter-axis-e2e.test.tsx 同一写法:转发真身,不复刻实现)。
vi.mock('@ihui/rn-app', async () => {
  const shared = await import(
    '../../../packages/app/src/features/security-settings/SecuritySettingsScreen'
  )
  return { SecuritySettingsScreen: shared.SecuritySettingsScreen }
})

// 返回键字形(共享 BackChevron 用 ChevronLeft);图标不是本页判据。
vi.mock('lucide-react-native', () => ({
  ChevronLeft: () => createElement('i', { 'data-icon': 'chevron-left' }),
}))

import { SecuritySettingsScreen as RnSecuritySettingsShell } from '../src/screens/SecuritySettingsScreen'
import {
  SecuritySettingsScreen as SharedSecuritySettingsScreen,
  type SecuritySettingsItem,
} from '../../../packages/app/src/features/security-settings/SecuritySettingsScreen'
import { messages, getValueByPath } from '../src/i18n'
import type { Locale } from '../src/i18n'

const LOCALES: Locale[] = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']

/**
 * 「本屏不提供入口」是事实;「后端(整体)不支持修改」是谎。这条尺只拦后者 ——
 * 它不枚举哪些项可写(§0.6:可写性的真相源是端点本身,不在文案里建第二份清单)。
 */
const BLANKET_DENIAL_RE =
  /不支持修改|不支援修改|后端.{0,12}不支持|後端.{0,12}不支援|not supported yet|変更にはまだ対応していません|변경은 아직 지원되지 않습니다/

const SETTINGS: SecuritySettingsItem = {
  passwordEnabled: true,
  biometricEnabled: false,
  twoFactorEnabled: true,
  loginAlert: false,
}

const ok = (data: unknown) => ({ success: true as const, data })
const fail = (error: string, status?: number) => ({ success: false as const, error, status })

function textOf(locale: Locale, key: string): string {
  const v = getValueByPath(messages[locale], key)
  expect(typeof v, `词包 ${locale} 缺键 ${key}`).toBe('string')
  return v as string
}

const hintOf = (locale: Locale) => textOf(locale, 'securitySettings.readOnlyHint')
const entryOf = (locale: Locale) => textOf(locale, 'securityCenter.title')
const itemOf = (locale: Locale) => textOf(locale, 'securitySettings.twoFactor')
const zh = (key: string) => textOf('zh-CN', key)

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
/** 写请求的口径:方法名(承载层显式写的)或命中的是 MFA/2FA 那条路径。 */
function writeCalls(): unknown[][] {
  return api.fetchApi.mock.calls.filter(([path, opts]) => {
    const method = (opts as { method?: string } | undefined)?.method
    return (
      (typeof method === 'string' && WRITE_METHODS.has(method.toUpperCase())) ||
      /\/api\/(mfa|auth\/2fa)\b/i.test(String(path))
    )
  })
}

const shellT = (key: string) => zh(key)

describe('安全设置屏只读提示:不得对用户说"后端不支持修改"', () => {
  beforeEach(() => {
    cleanup()
    api.fetchApi.mockReset()
  })
  afterEach(() => cleanup())

  it('① 正向:薄壳上屏的提示等于真词包那行,且点名真实入口与真实那一项', async () => {
    api.fetchApi.mockResolvedValue(ok(SETTINGS))
    render(createElement(RnSecuritySettingsShell))

    const hint = hintOf('zh-CN')
    await waitFor(() => expect(screen.getByText(hint)).toBeTruthy())

    expect(hint).toContain(entryOf('zh-CN'))
    expect(hint).toContain(itemOf('zh-CN'))
    expect(hint).not.toMatch(BLANKET_DENIAL_RE)
    // 裸键名漏上屏 = 取词没接上,同样是对用户撒谎
    expect(screen.queryByText('securitySettings.readOnlyHint')).toBeNull()
  })

  it('② 反证:五语言逐条同判,改回"后端不支持修改"原形态即翻红', () => {
    for (const locale of LOCALES) {
      const hint = hintOf(locale)
      expect(hint, `${locale}:提示未点名端内真实入口`).toContain(entryOf(locale))
      expect(hint, `${locale}:提示未点名可修改的那一项`).toContain(itemOf(locale))
      expect(hint, `${locale}:仍在声称后端不支持修改`).not.toMatch(BLANKET_DENIAL_RE)
    }
    // 反证的可判性自证:五语言的原值若逐字搬回来,上面三条不可能全绿
    const legacy = '以下为当前真实状态，后端暂不支持修改'
    expect(legacy).toMatch(BLANKET_DENIAL_RE)
    expect(legacy).not.toContain(entryOf('zh-CN'))
  })

  it('③ 只读形态零枚假开关,且读数逐行如实(正向对照:撤掉 readOnly 四枚开关真上屏)', async () => {
    api.fetchApi.mockResolvedValue(ok(SETTINGS))
    const { container } = render(createElement(RnSecuritySettingsShell))
    await waitFor(() => expect(screen.getByText(zh('securitySettings.title'))).toBeTruthy())

    // 共享替身把 RN <Switch> 落成 input[type=checkbox];本屏不传 onToggle 时必须是 0 枚。
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0)
    expect(screen.getAllByText(zh('securitySettings.stateOn'))).toHaveLength(2)
    expect(screen.getAllByText(zh('securitySettings.stateOff'))).toHaveLength(2)

    cleanup()
    const control = render(
      createElement(SharedSecuritySettingsScreen, {
        t: shellT,
        settings: SETTINGS,
        loading: false,
        error: '',
        onToggle: vi.fn(),
        onBack: () => {},
      }),
    )
    expect(control.container.querySelectorAll('input[type="checkbox"]')).toHaveLength(4)
    expect(
      Array.from(control.container.querySelectorAll('span')).filter(
        (el) => el.textContent === zh('securitySettings.stateOn'),
      ),
    ).toHaveLength(0)
  })

  it('④ 本页不发写请求:成功面恰好一次 GET;取数失败面零次追加动作', async () => {
    api.fetchApi.mockResolvedValue(ok(SETTINGS))
    render(createElement(RnSecuritySettingsShell))
    await waitFor(() => expect(screen.getByText(hintOf('zh-CN'))).toBeTruthy())

    expect(api.fetchApi).toHaveBeenCalledTimes(1)
    expect(api.fetchApi).toHaveBeenCalledWith('/user/security')
    expect(writeCalls()).toEqual([])

    cleanup()
    api.fetchApi.mockReset()
    api.fetchApi.mockResolvedValue(fail('未授权', 401))
    render(createElement(RnSecuritySettingsShell))
    await waitFor(() => expect(screen.getByText('未授权')).toBeTruthy())

    // 失败后不得"顺手补一刀写请求":整轮仍只有那一次读,且没有一枚是写。
    expect(api.fetchApi).toHaveBeenCalledTimes(1)
    expect(writeCalls()).toEqual([])
  })

  it('⑤ ④ 的探测器有牙:手工塞一枚 POST 写请求必须被点名', async () => {
    api.fetchApi.mockResolvedValue(ok(SETTINGS))
    render(createElement(RnSecuritySettingsShell))
    await waitFor(() => expect(api.fetchApi).toHaveBeenCalledTimes(1))
    expect(writeCalls()).toEqual([])

    api.fetchApi('/api/mfa/disable', { method: 'POST', body: '{}' })
    await waitFor(() => expect(api.fetchApi).toHaveBeenCalledTimes(2))
    expect(writeCalls()).toHaveLength(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
