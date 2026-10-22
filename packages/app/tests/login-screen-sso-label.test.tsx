// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-959:共享登录屏(`packages/app`)的 SSO 按钮文案不得再写死中文。
//
// 这个文件存在的理由不是"组件能渲染",而是钉住三件在别处会静默坏掉的事:
//   1. **该屏的文案必须经 t() 取键** —— 该屏由 `@ihui/rn-app` 提供、宿主只传自己语言的 t,
//      所以任何写死的中文字符串都会让非中文档案直接看到简体中文(票面那两枚即此型)。
//   2. **新键必须五语言同批落在它实际读取的那份语言包** —— 取键名字写对而词典缺键,
//      屏幕上剩下的是裸键名,比中文更糟(AGENTS §19「parity 绿 ≠ 语种对」同族)。
//      实际读取面 = `packages/i18n/messages/shared/*.json` 作底 + `mobile-rn/*.json` 覆盖
//      (apps/mobile-rn/src/i18n/index.tsx 的 mergeMessages),本包其余键同一口径。
//   3. **已复核为零消费者的死键不得回潮** —— `login.ssoLogin`(值 "SSO 登录")就是本票要收的
//      黑话本身;留着的下一站就是某个新调用方把它接上屏幕。
//
// 断言取的是 fake t 落进 DOM 的文本,而不是截图:键名是契约,渲染出的中文还是键名才是判据。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

import { LoginScreen } from '../src/features/login/LoginScreen'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCREEN_SRC = join(HERE, '../src/features/login/LoginScreen.tsx')
const SHARED_DIR = join(HERE, '../../i18n/messages/shared')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

/** 取键标记:让「哪个键被取用」在 DOM 里可读,而不是被译文掩盖 */
const MARKED = (key: string) => `«${key}»`

vi.mock('lucide-react-native', () => {
  // 图标只保「有个节点」这件事:本用例判的是文案取源,不是字形
  const Glyph = () => createElement('i')
  const names = ['AlertTriangle', 'Check', 'ChevronDown', 'Eye', 'EyeOff', 'QrCode', 'X']
  return Object.fromEntries(names.map((n) => [n, Glyph]))
})

vi.mock('react-native', () => {
  // 只把能落进 DOM 的键交给宿主元素:RN 专有键(style/hitSlop/numberOfLines/…)原样透传
  // 会让 jsdom 刷一屏警告,而警告堆里恰好藏着真正的失效信号。
  const pick = (p: Record<string, unknown>) => {
    const out: Record<string, unknown> = {}
    if (typeof p.onPress === 'function') out.onClick = p.onPress as () => void
    if (typeof p.testID === 'string') out['data-testid'] = p.testID
    out.children = p.children as ReactNode
    return out
  }
  const box = (tag: string) => (p: Record<string, unknown>) => createElement(tag, pick(p))
  const TextInput = (p: Record<string, unknown>) =>
    createElement('input', {
      'data-testid': 'rn-textinput',
      defaultValue: String(p.value ?? ''),
      readOnly: true,
    })
  return {
    View: box('div'),
    Text: box('span'),
    Pressable: box('div'),
    TouchableOpacity: box('div'),
    TextInput,
    ActivityIndicator: () => createElement('div', { 'data-testid': 'rn-activity' }),
    Image: () => createElement('img', { 'data-testid': 'rn-image' }),
    Linking: { openURL: () => Promise.resolve() },
    StyleSheet: { create: (s: unknown) => s, flatten: (s: unknown) => s ?? {}, hairlineWidth: 1 },
    Platform: { OS: 'web', select: (o: Record<string, unknown>) => o.web ?? o.default },
    PixelRatio: { getFontScale: () => 1 },
    useColorScheme: () => 'light',
  }
})

const t = ((key: string) => MARKED(key)) as never

/** 只填必填面(LoginScreenProps 的 10 个必填形参),其余走屏内默认值 */
const renderScreen = (over: Record<string, unknown> = {}) => {
  const r = render(
    createElement(LoginScreen, {
      t,
      account: 'tester',
      password: 'secret',
      loading: false,
      ssoLoading: false,
      error: '',
      onAccountChange: () => {},
      onPasswordChange: () => {},
      onLogin: () => {},
      onSsoLogin: () => {},
      ...over,
    } as never),
  )
  return { text: () => r.container.textContent ?? '' }
}

describe('G-959 ①:SSO 按钮走 t(),不再端出硬编码中文', () => {
  it('idle 态取 auth.ssoLogin;票面那条写死文案不得出现在屏幕上', () => {
    const { text } = renderScreen()
    expect(text()).toContain(MARKED('auth.ssoLogin'))
    expect(text()).not.toContain('智汇AI网页授权登录')
  })

  it('进行中态取 auth.ssoLoginLoading —— 写死的那条带省略号文案不得出现在屏幕上', () => {
    const { text } = renderScreen({ ssoLoading: true })
    expect(text()).toContain(MARKED('auth.ssoLoginLoading'))
    expect(text()).not.toContain('打开网页登录...')
  })
})

describe('G-959 ②:源码层不得回潮', () => {
  const src = readFileSync(SCREEN_SRC, 'utf8')

  it('两枚写死中文不得再出现在该屏源码里(含未被渲染分支遮住的副本)', () => {
    expect(src).not.toMatch(/智汇AI网页授权登录/)
    expect(src).not.toMatch(/'打开网页登录\.\.\.'/)
  })

  it('SSO 按钮必须经 t() 取键(取键名与渲染断言互为对照)', () => {
    expect(src).toMatch(/t\('auth\.ssoLogin'\)/)
    expect(src).toMatch(/t\('auth\.ssoLoginLoading'\)/)
  })
})

describe('G-959 ③:五语言同批补齐 + 死键摘除', () => {
  const packs = Object.fromEntries(
    LOCALES.map((loc) => [
      loc,
      JSON.parse(readFileSync(join(SHARED_DIR, `${loc}.json`), 'utf8')) as Record<
        string,
        Record<string, string>
      >,
    ]),
  )

  for (const loc of LOCALES) {
    it(`${loc}:auth.ssoLogin / auth.ssoLoginLoading 必须都是非空译文`, () => {
      const auth = packs[loc]?.auth
      expect(typeof auth?.ssoLogin).toBe('string')
      expect((auth?.ssoLogin ?? '').trim().length).toBeGreaterThan(0)
      expect(typeof auth?.ssoLoginLoading).toBe('string')
      expect((auth?.ssoLoginLoading ?? '').trim().length).toBeGreaterThan(0)
    })
  }

  for (const loc of LOCALES) {
    it(`${loc}:死键 login.ssoLogin(值 "SSO 登录")已摘除且不得留残值`, () => {
      expect(packs[loc]?.login?.ssoLogin).toBeUndefined()
    })
  }

  it('en 值不得夹中文;ko 值必须是谚文为主且不含汉字(语种对,不只是键在)', () => {
    const en = [packs.en.auth.ssoLogin, packs.en.auth.ssoLoginLoading]
      .filter((v) => typeof v === 'string')
      .join(' ')
    const ko = [packs.ko.auth.ssoLogin, packs.ko.auth.ssoLoginLoading]
      .filter((v) => typeof v === 'string')
      .join(' ')
    // 先自证"量到了东西":空串会让下面三条判据全部空过(§0.3 不得把没判写成判过)
    expect(en.length).toBeGreaterThan(0)
    expect(ko.length).toBeGreaterThan(0)
    expect(en).not.toMatch(/[㐀-䶿一-鿿぀-ヿ]/)
    expect(ko).toMatch(/[가-힯]/)
    expect(ko).not.toMatch(/[㐀-䶿一-鿿]/)
  })

  it('新文案不得再把 SSO / 授权 这类黑话端给普通用户', () => {
    for (const loc of LOCALES) {
      const pair = [packs[loc].auth.ssoLogin, packs[loc].auth.ssoLoginLoading]
        .filter((v) => typeof v === 'string')
        .join(' ')
      // 缺键时先让它响在这里,而不是让下面两条"没匹配到黑话"空过
      expect(pair.length).toBeGreaterThan(0)
      expect(pair).not.toMatch(/SSO/i)
      expect(pair).not.toMatch(/授權|授权/)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
