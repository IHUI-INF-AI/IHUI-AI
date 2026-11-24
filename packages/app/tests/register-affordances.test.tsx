// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// 共享注册屏的「对齐端口」回归钉(2026-11-15)。
//
// 这个文件存在的理由不是"组件能渲染",而是钉住四件在别处会静默坏掉的事:
//   1. **端口缺省必须真的什么都不做** —— `phonePrefix` / `onTogglePasswordVisible` 是
//      为小程序薄壳新增的可选端口,RN 与 web 的既有调用方一个都没传。若缺省时仍渲染区号块
//      或切换按钮,等于给两端白送一块 UI 位移。所以"不注入 ⇒ 不渲染"要有断言,不能只写在注释里。
//   2. **注入后必须真的改变输入框性质** —— 密码可见性如果只翻了一个不受控的 state 而没落到
//      输入框的 secureTextEntry 上,屏幕上看不出任何变化,而单测若只查"按钮文本变了"会全绿。
//      这里查的是 `input[type=password]` 与 `input[type=text]` 的实际迁移,并同时确认
//      **确认密码框不受牵连**(两枚密码框同屏,漏了这条就无法区分"改错了格子")。
//   3. **可见文案与无障碍标签是两套键,不可互相顶替** —— 可见键 `register.show/hide` 是 2 字
//      按钮面(受布局宽度约束),a11y 键 `a11y.showPassword/hidePassword` 描述"点它会做什么"
//      (与 LoginScreen / ApiSettingsScreen 同一对正典)。混用会让读屏念出"显示密码"时按钮上
//      写的是"显示",或反过来把 4 字塞进 2 字的位。两条都要分别取到。
//   4. **两端词典都得有这些键** —— 共享屏由 `@ihui/rn-app` 提供、宿主只传自己的 t。取键名写对
//      而词典缺键,屏幕上剩下的是裸键名,比中文更糟(与 login-screen-sso-label 同族判据)。
//      小程序端历史上 `tt(key, fallback)` 兜着,词典缺键也看不出来 —— 正是这种"兜底遮住了缺口"
//      让缺口能活到转壳那天。故这里不以任何一端为参照,两端逐键查实。
//
// 判据一律落在渲染出的 DOM 与词典 JSON 上,不查截图、不查"调用过 setState"。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement, useState, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'

import { RegisterScreen } from '../src/features/register/RegisterScreen'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCREEN_SRC = join(HERE, '../src/features/register/RegisterScreen.tsx')
const MSG_DIR = join(HERE, '../../i18n/messages')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

/** 取键标记:让「哪个键被取用」在 DOM 里可读,而不是被译文掩盖 */
const MARKED = (key: string) => `«${key}»`

vi.mock('lucide-react-native', () => {
  // 图标只保「有个节点」:本用例判的是端口接线,不是字形
  const Glyph = () => createElement('i')
  return { ChevronLeft: Glyph, Check: Glyph }
})

vi.mock('react-native', () => {
  /**
   * RN 的 `Pressable` 允许 children 是 **render prop**(`({pressed}) => node`,BackChevron 正是
   * 这一形态)。原样透传给 DOM 会让 React 抛 "Functions are not valid as a React child" ——
   * 而这条警告恰好会淹掉真正的失效信号。按真身语义以 `pressed:false` 求值即可。
   */
  const resolveChildren = (c: unknown): ReactNode =>
    typeof c === 'function'
      ? (c as (s: { pressed: boolean }) => ReactNode)({ pressed: false })
      : (c as ReactNode)
  const pick = (p: Record<string, unknown>, withLabel = true) => {
    const out: Record<string, unknown> = {}
    if (typeof p.onPress === 'function') out.onClick = p.onPress as () => void
    if (typeof p.testID === 'string') out['data-testid'] = p.testID
    if (withLabel && typeof p.accessibilityLabel === 'string')
      out['aria-label'] = p.accessibilityLabel
    if (withLabel && typeof p.accessibilityRole === 'string') out.role = p.accessibilityRole
    out.children = resolveChildren(p.children)
    return out
  }
  const box = (tag: string) => (p: Record<string, unknown>) => createElement(tag, pick(p))
  /**
   * 关键映射:RN 的 `secureTextEntry` 是"密码框"的唯一真身表达,jsdom 侧最近的对应物是
   * `input[type=password]`。不映射则"密码明文可见"这条端口在测试里根本量不到 ——
   * 受控值、按钮文案都对,输入框却还是密文,而断言全绿。
   */
  const TextInput = (p: Record<string, unknown>) =>
    createElement('input', {
      type: p.secureTextEntry ? 'password' : 'text',
      defaultValue: String(p.value ?? ''),
      placeholder: typeof p.placeholder === 'string' ? p.placeholder : undefined,
      'aria-label': typeof p.accessibilityLabel === 'string' ? p.accessibilityLabel : undefined,
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
    Dimensions: { get: () => ({ width: 375, height: 812 }) },
    useWindowDimensions: () => ({ width: 375, height: 812, scale: 1, fontScale: 1 }),
  }
})

const t = ((key: string) => MARKED(key)) as never

/** 只填必填面(RegisterScreenProps 的 11 个必填形参),其余走屏内默认值 */
const baseProps = (over: Record<string, unknown> = {}) => ({
  t,
  account: '13800000000',
  password: 'secret1',
  confirmPassword: 'secret1',
  loading: false,
  error: '',
  onAccountChange: () => {},
  onPasswordChange: () => {},
  onConfirmPasswordChange: () => {},
  onRegister: () => {},
  onBack: () => {},
  // 必须"真能收消息":assertRequiredPort 会把 `() => {}` 判成空实现并在 dev 直接 throw。
  // 这不是测试夹具的将就 —— 闸门要的就是"注入了能落地的 toast",占位函数不算端口。
  onToast: (msg: string) => void msg,
  ...over,
})

const renderScreen = (over: Record<string, unknown> = {}) =>
  render(createElement(RegisterScreen, baseProps(over) as never))

/** 屏内输入框顺序:手机号 → 验证码 → 密码 → 确认密码;先自证量到了 4 枚 */
const inputs = (container: HTMLElement) => {
  const list = Array.from(container.querySelectorAll('input'))
  expect(list).toHaveLength(4)
  return { account: list[0], code: list[1], password: list[2], confirm: list[3] }
}

describe('对齐端口 ①:缺省不注入 ⇒ 不新增任何 UI', () => {
  it('不传 phonePrefix 时不渲染 "+86" 区号块', () => {
    const r = renderScreen()
    expect(r.container.textContent ?? '').not.toContain('+86')
  })

  it('不传 onTogglePasswordVisible 时不渲染显示/隐藏切换(可见键一枚都不得出现)', () => {
    const text = renderScreen().container.textContent ?? ''
    expect(text).not.toContain(MARKED('register.show'))
    expect(text).not.toContain(MARKED('register.hide'))
  })

  it('缺省态密码框仍是密文 —— 端口存在不等于默认放开明文', () => {
    const { password, confirm } = inputs(renderScreen().container)
    expect(password.getAttribute('type')).toBe('password')
    expect(confirm.getAttribute('type')).toBe('password')
  })
})

describe('对齐端口 ②:phonePrefix 注入', () => {
  it('传入 "+86" 后区号成为屏上可见文本,且落在手机号输入框之前', () => {
    const r = renderScreen({ phonePrefix: '+86' })
    const text = r.container.textContent ?? ''
    expect(text).toContain('+86')
    // 顺序判据:区号必须在手机号框之前,否则是"另起一行"而不是"前缀"
    const prefixAt = text.indexOf('+86')
    const phoneAt = text.indexOf(MARKED('register.phone'))
    expect(prefixAt).toBeGreaterThanOrEqual(0)
    expect(phoneAt).toBeGreaterThanOrEqual(0)
    expect(prefixAt).toBeGreaterThan(phoneAt)
  })
})

describe('对齐端口 ③:密码可见性切换(受控真回路)', () => {
  /**
   * 用真受控 harness:可见性由父组件 state 驱动,与薄壳 `useState(showPwd)` 同形。
   * 只在测试里传死值 `passwordVisible={true}` 是量不到"点一下会不会翻"的。
   */
  const Harness = (over: Record<string, unknown>) => {
    const [visible, setVisible] = useState(false)
    return createElement(
      RegisterScreen,
      baseProps({
        passwordVisible: visible,
        onTogglePasswordVisible: () => setVisible((v) => !v),
        ...over,
      }) as never,
    )
  }

  it('初始态:密码框密文、按钮面取 register.show、a11y 取 a11y.showPassword', () => {
    const r = render(createElement(Harness, {}))
    const { password } = inputs(r.container)
    expect(password.getAttribute('type')).toBe('password')
    expect(r.container.textContent ?? '').toContain(MARKED('register.show'))
    expect(r.container.querySelector('[aria-label]')).not.toBeNull()
    expect(
      r.container.querySelector(`[aria-label="${MARKED('a11y.showPassword')}"]`),
    ).not.toBeNull()
  })

  it('点击一次:密码框转明文、按钮面转 register.hide、a11y 转 a11y.hidePassword', () => {
    const r = render(createElement(Harness, {}))
    const toggle = r.container.querySelector(`[aria-label="${MARKED('a11y.showPassword')}"]`)
    expect(toggle).not.toBeNull()
    fireEvent.click(toggle!)
    const { password } = inputs(r.container)
    expect(password.getAttribute('type')).toBe('text')
    expect(r.container.textContent ?? '').toContain(MARKED('register.hide'))
    expect(
      r.container.querySelector(`[aria-label="${MARKED('a11y.hidePassword')}"]`),
    ).not.toBeNull()
  })

  it('再点一次回到密文 —— 必须是可来回的开关,不是一次性的', () => {
    const r = render(createElement(Harness, {}))
    fireEvent.click(r.container.querySelector(`[aria-label="${MARKED('a11y.showPassword')}"]`)!)
    fireEvent.click(r.container.querySelector(`[aria-label="${MARKED('a11y.hidePassword')}"]`)!)
    const { password } = inputs(r.container)
    expect(password.getAttribute('type')).toBe('password')
  })

  it('确认密码框不受可见性开关牵连(同屏两枚密码框必须能区分)', () => {
    const r = render(createElement(Harness, {}))
    fireEvent.click(r.container.querySelector(`[aria-label="${MARKED('a11y.showPassword')}"]`)!)
    const { password, confirm } = inputs(r.container)
    expect(password.getAttribute('type')).toBe('text')
    expect(confirm.getAttribute('type')).toBe('password')
  })
})

describe('对齐端口 ④:两端词典逐键查实(裸键名不得上屏)', () => {
  const packs = (end: string, loc: string) =>
    JSON.parse(readFileSync(join(MSG_DIR, end, `${loc}.json`), 'utf8')) as Record<
      string,
      Record<string, string>
    >

  for (const end of ['miniapp-taro', 'mobile-rn'] as const) {
    for (const loc of LOCALES) {
      it(`${end}/${loc}:register.show 与 register.hide 必须都是非空译文`, () => {
        const reg = packs(end, loc).register ?? {}
        for (const key of ['show', 'hide'] as const) {
          expect(typeof reg[key]).toBe('string')
          expect((reg[key] ?? '').trim().length).toBeGreaterThan(0)
        }
      })
    }
  }

  for (const loc of LOCALES) {
    it(`shared/${loc}:a11y.showPassword 与 a11y.hidePassword 必须是非空译文(切换按钮无障碍面)`, () => {
      const a = packs('shared', loc).a11y ?? {}
      for (const key of ['showPassword', 'hidePassword'] as const) {
        expect(typeof a[key]).toBe('string')
        expect((a[key] ?? '').trim().length).toBeGreaterThan(0)
      }
    })
  }

  it('两端同名键的译文必须逐字一致(同义键不许各自漂)', () => {
    for (const loc of LOCALES) {
      const mini = packs('miniapp-taro', loc).register ?? {}
      const rn = packs('mobile-rn', loc).register ?? {}
      for (const key of ['show', 'hide'] as const) {
        expect(rn[key]).toBe(mini[key])
      }
    }
  })

  it('en 值不得夹中文;ko 值不得夹汉字 —— 键在 ≠ 语种对', () => {
    const en = [
      packs('miniapp-taro', 'en').register.show,
      packs('miniapp-taro', 'en').register.hide,
    ]
    const ko = [
      packs('miniapp-taro', 'ko').register.show,
      packs('miniapp-taro', 'ko').register.hide,
    ]
    expect(en.join('')).not.toMatch(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff]/)
    expect(ko.join('')).not.toMatch(/[\u3400-\u4dbf\u4e00-\u9fff]/)
  })
})

describe('对齐端口 ⑤:源码层不得回潮', () => {
  const src = readFileSync(SCREEN_SRC, 'utf8')

  it('按钮面必须经 t() 取 register.show / register.hide,不得写死中文', () => {
    expect(src).toMatch(/t\('register\.show'\)/)
    expect(src).toMatch(/t\('register\.hide'\)/)
    expect(src).not.toMatch(/'显示'/)
    expect(src).not.toMatch(/'隐藏'/)
  })

  it('无障碍标签必须取正典 a11y 键,不得复用可见键冒充', () => {
    expect(src).toMatch(/t\('a11y\.showPassword'\)/)
    expect(src).toMatch(/t\('a11y\.hidePassword'\)/)
  })

  it('两枚端口都必须有"未注入不渲染"的守卫,否则 RN/web 既有调用方会白捡一块 UI', () => {
    expect(src).toMatch(/phonePrefix \? \(/)
    expect(src).toMatch(/onTogglePasswordVisible \? \(/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
