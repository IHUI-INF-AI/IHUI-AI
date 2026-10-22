// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票 G-924:共享登录屏(`packages/app/src/features/login/LoginScreen.tsx`)里写死的中文必须全部取键。
//
// 计数口径(与票面一致,也是本文件存在的理由):该文件 200+ 行含中文,绝大多数是中文注释,
// 注释不是用户可感知的 ⇒ 不算债。射程 = 字符串字面量 / JSX 文本 / accessibility label
// —— a11y label 会被读屏念出来,切语言时同样露馅,所以与可见文案同判。
//
// 断言取的是**渲染产物**,不是源码字符串比对:源码里"看起来取键了"而分支上仍端出硬编码中文,
// 是这个家族最可能的失效型。mock 会把 accessibilityLabel 落成 aria-label,读屏面才可判。
// 语言包那一维判的是"键在且语种对"(AGENTS §19「parity 绿 ≠ 语种对」),译文是否地道归人工。

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'

import { LoginScreen } from '../src/features/login/LoginScreen'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCREEN_SRC = join(HERE, '../src/features/login/LoginScreen.tsx')
const SHARED_DIR = join(HERE, '../../i18n/messages/shared')
const ROOT = join(HERE, '../../..')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
const LOC_FILES = LOCALES.map((l) => `packages/i18n/messages/shared/${l}.json`)

const MARKED = (key: string) => `«${key}»`
const CJK = /[\u4e00-\u9fff]/

/** 本票新增键 = 原先写死、且词包里没有同义条目的那些。zh-CN 值必须逐字节等于改动前的屏幕输出。 */
const NEW_KEYS: { key: string; zhCN: string; placeholders?: string[] }[] = [
  { key: 'auth.loginBtnLoading', zhCN: '登录中...' },
  { key: 'auth.wechatLoginBtn', zhCN: '微信登录' },
  { key: 'auth.or', zhCN: '或' },
  { key: 'auth.qrLoading', zhCN: '二维码加载中...' },
  { key: 'auth.qrScanned', zhCN: '扫码成功,请在手机上确认' },
  { key: 'auth.qrExpired', zhCN: '二维码已过期' },
  { key: 'auth.qrLoadFailed', zhCN: '二维码加载失败' },
  { key: 'auth.qrScanTip', zhCN: '请使用{platform}扫码登录', placeholders: ['platform'] },
  { key: 'auth.qrOpenWeb', zhCN: '打开网页扫码' },
  { key: 'auth.selectAreaCode', zhCN: '选择区号' },
  { key: 'auth.selectHistoryAccount', zhCN: '选择历史账号 {account}', placeholders: ['account'] },
  { key: 'auth.agreeTermsCheckbox', zhCN: '同意协议复选框' },
]

/** 本票改为复用既键的字面量 —— 屏幕早已用同一个键渲染可见文案,a11y label 没有理由另起一名。 */
const REUSE: { literal: string; key: string }[] = [
  { literal: '服务条款', key: 'auth.termsOfService' },
  { literal: '隐私政策', key: 'auth.privacyPolicy' },
  { literal: '获取验证码', key: 'auth.getVerificationCode' },
  { literal: '忘记密码', key: 'auth.forgotPassword' },
  { literal: '立即注册', key: 'auth.registerNow' },
  { literal: '自动登录', key: 'auth.autoLogin' },
  { literal: '刷新二维码', key: 'auth.qrRefresh' },
  { literal: '隐藏密码', key: 'a11y.hidePassword' },
  { literal: '显示密码', key: 'a11y.showPassword' },
]

vi.mock('lucide-react-native', () => {
  const Glyph = () => createElement('i')
  const names = ['AlertTriangle', 'Check', 'ChevronDown', 'Eye', 'EyeOff', 'QrCode', 'X']
  return Object.fromEntries(names.map((n) => [n, Glyph]))
})

vi.mock('react-native', () => {
  // accessibilityLabel 必须落成 aria-label:本票一半射程在读屏面,把它丢掉就等于没判。
  const pick = (p: Record<string, unknown>) => {
    const out: Record<string, unknown> = {}
    if (typeof p.onPress === 'function') out.onClick = p.onPress as () => void
    if (typeof p.testID === 'string') out['data-testid'] = p.testID
    if (typeof p.accessibilityLabel === 'string') out['aria-label'] = p.accessibilityLabel
    if (typeof p.accessibilityRole === 'string') out['role'] = p.accessibilityRole
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

const BASE = {
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
}

const renderScreen = (over: Record<string, unknown> = {}) => {
  const r = render(createElement(LoginScreen, { ...BASE, ...over } as never))
  return {
    container: r.container,
    /** 屏幕墨迹 + 读屏标签合面:两族都得从 t() 取词 */
    said: () => {
      const text = r.container.textContent ?? ''
      const labels = [...r.container.querySelectorAll('[aria-label]')].map(
        (n) => n.getAttribute('aria-label') ?? '',
      )
      return { text, labels, all: [text, ...labels].join(' ') }
    },
    byLabel: (label: string) => r.container.querySelectorAll(`[aria-label="${label}"]`).length,
  }
}

/** 覆盖全部 tab 与 QR 状态的一屏矩阵;宿主入参一律给 ASCII,免得把夹具自己的中文当成屏幕的债 */
const MATRIX: { name: string; props: Record<string, unknown> }[] = [
  {
    name: 'password tab(含协议行/眼睛/自动登录/忘记密码/微信大按钮/或分隔/注册链)',
    props: {
      loading: false,
      onForgotPassword: () => {},
      autoLogin: true,
      onAutoLoginChange: () => {},
      onRegister: () => {},
      thirdPartyOptions: [
        { platform: 'wechat', label: 'WeChat', enabled: true },
        { platform: 'alipay', label: 'Alipay', enabled: true },
      ],
    },
  },
  {
    name: 'password tab 进行中(登录中...)',
    props: { loading: true, onRegister: () => {}, thirdPartyOptions: [] },
  },
  {
    name: 'email tab(获取验证码)',
    props: {
      tabs: ['email'],
      email: 'a@b.c',
      emailCode: '123456',
      onEmailChange: () => {},
      onEmailCodeChange: () => {},
      onSendEmailCode: () => {},
      onLoginByEmailCode: () => {},
    },
  },
  {
    name: 'phone tab + 区号选择器(选择区号/或分隔/获取验证码)',
    props: {
      tabs: ['phone'],
      phone: '13800000000',
      phoneCode: '123456',
      onPhoneChange: () => {},
      onPhoneCodeChange: () => {},
      onSendPhoneCode: () => {},
      onLoginByPhoneCode: () => {},
      phoneHead: '+86',
      nationShow: true,
      onToggleNationShow: () => {},
      onSelectNation: () => {},
      nations: [{ id: 1, title: 'China', content: '+86' }],
      carrierOneClickEntry: createElement('div', { 'data-testid': 'carrier' }),
    },
  },
  ...(['idle', 'loading', 'waiting', 'scanned', 'expired', 'error'] as const).map((status) => ({
    name: `qr tab 降级单平台(status=${status})`,
    props: {
      tabs: ['qr'],
      qrConfig: { status, onRefresh: () => {} },
    },
  })),
  ...(['idle', 'loading', 'waiting', 'scanned', 'expired', 'error'] as const).map((status) => ({
    name: `qr tab 平台切换(status=${status})`,
    props: {
      tabs: ['qr'],
      qrConfig: { status, onRefresh: () => {} },
      qrPlatforms: [
        { key: 'wechat', label: 'WeChat', webUrl: 'https://example.com/qr' },
        { key: 'dingtalk', label: 'DingTalk' },
      ],
    },
  })),
]

describe('G-924 ①:整屏矩阵的墨迹与读屏标签里不得有写死中文', () => {
  for (const m of MATRIX) {
    it(`${m.name}:DOM 文本与 aria-label 合面零汉字`, () => {
      const { said } = renderScreen(m.props)
      const { all, text } = said()
      // 先自证量到了东西:空 DOM 会让"没有中文"空过(§0.3 没判不得写成判过)。
      // 取"至少端出一枚键标记"这条 —— 有些分支(QR 降级单平台)结构上没有可标注的控件,
      // 硬要求 aria-label 存在会把夹具的形态当成被测对象的缺陷。
      expect(all.length).toBeGreaterThan(0)
      expect(text.trim().length).toBeGreaterThan(0)
      expect(all).toContain('«')
      expect(all).not.toMatch(CJK)
    })
  }

  it('QR 状态族逐档对号入座(全取键但仍可能错档,故逐档点名)', () => {
    const perStatus: [string, string][] = [
      ['loading', 'auth.qrLoading'],
      ['waiting', 'auth.qrScanTip'],
      ['scanned', 'auth.qrScanned'],
      ['expired', 'auth.qrExpired'],
      ['error', 'auth.qrLoadFailed'],
      ['idle', 'auth.qrScanTip'],
    ]
    for (const [status, key] of perStatus) {
      const { said } = renderScreen({ tabs: ['qr'], qrConfig: { status, onRefresh: () => {} } })
      expect(said().text, `status=${status}`).toContain(MARKED(key))
    }
    // error 档例外:宿主给了 errorText 就用宿主的(那是数据不是本屏文案)
    const host = renderScreen({
      tabs: ['qr'],
      qrConfig: { status: 'error', errorText: 'Boom', onRefresh: () => {} },
    })
    expect(host.said().text).toContain('Boom')
    expect(host.said().text).not.toContain(MARKED('auth.qrLoadFailed'))
  })

  it('协议行的复选框/条款/隐私 a11y label 走键,条款与隐私复用可见文案那两枚既键', () => {
    const { byLabel } = renderScreen()
    expect(byLabel(MARKED('auth.agreeTermsCheckbox'))).toBe(1)
    expect(byLabel(MARKED('auth.termsOfService'))).toBe(1)
    expect(byLabel(MARKED('auth.privacyPolicy'))).toBe(1)
  })

  it('眼睛按钮两态各取一枚既键(点一次翻态,读屏标签跟着翻);自动登录文案与标签同源', () => {
    const eye = renderScreen()
    expect(eye.byLabel(MARKED('a11y.showPassword'))).toBe(1)
    fireEvent.click(eye.container.querySelector(`[aria-label="${MARKED('a11y.showPassword')}"]`)!)
    expect(eye.byLabel(MARKED('a11y.hidePassword'))).toBe(1)
    expect(eye.byLabel(MARKED('a11y.showPassword'))).toBe(0)
    expect(renderScreen({ autoLogin: true }).byLabel(MARKED('auth.autoLogin'))).toBe(1)
  })

  it('微信大按钮、或分隔、注册链、忘记密码、获取验证码、区号、刷新二维码、打开网页扫码全部取键', () => {
    const p = renderScreen({
      onRegister: () => {},
      onForgotPassword: () => {},
      thirdPartyOptions: [
        { platform: 'wechat', label: 'WeChat', enabled: true },
        { platform: 'alipay', label: 'Alipay', enabled: true },
      ],
    })
    expect(p.byLabel(MARKED('auth.wechatLoginBtn'))).toBe(1)
    expect(p.byLabel(MARKED('auth.registerNow'))).toBe(1)
    expect(p.byLabel(MARKED('auth.forgotPassword'))).toBe(1)
    expect(p.said().text).toContain(MARKED('auth.or'))

    const e = renderScreen({ tabs: ['email'] })
    expect(e.byLabel(MARKED('auth.getVerificationCode'))).toBe(1)

    const ph = renderScreen({
      tabs: ['phone'],
      phoneHead: '+86',
      onToggleNationShow: () => {},
      nations: [{ id: 1, title: 'China', content: '+86' }],
    })
    expect(ph.byLabel(MARKED('auth.selectAreaCode'))).toBe(1)

    const qr = renderScreen({
      tabs: ['qr'],
      qrConfig: { status: 'expired', onRefresh: () => {} },
    })
    expect(qr.byLabel(MARKED('auth.qrRefresh'))).toBe(1)
    expect(qr.said().text).toContain(MARKED('auth.qrRefresh'))

    const qrWeb = renderScreen({
      tabs: ['qr'],
      qrPlatforms: [{ key: 'wechat', label: 'WeChat', webUrl: 'https://example.com/qr' }],
    })
    expect(qrWeb.byLabel(MARKED('auth.qrOpenWeb'))).toBe(1)
    expect(qrWeb.said().text).toContain(MARKED('auth.qrScanTip'))
  })
})

describe('G-924 ②:源码层不得回潮(逐条字面量按代码形态钉)', () => {
  const src = readFileSync(SCREEN_SRC, 'utf8')

  const FORBIDDEN_FORMS = [...NEW_KEYS.map((k) => k.zhCN), ...REUSE.map((r) => r.literal)].flatMap(
    // 只列**代码形态**:字面量 'X'、accessibilityLabel="X"、JSX 文本 >X<。
    // 注释里的 "X" 是散文(如 分隔线"或"居中),按票面口径不算债,故不进这条判据。
    (lit) => [`'${lit}'`, `accessibilityLabel="${lit}"`, `>${lit}<`],
  )

  it('写死中文的代码形态一条不剩(注释里的中文不在射程,故按代码形态判)', () => {
    for (const form of FORBIDDEN_FORMS) {
      expect(src.includes(form), form).toBe(false)
    }
  })

  it('accessibilityLabel 不再直接端出中文', () => {
    expect(src).not.toMatch(/accessibilityLabel=\{?\s*["'`][^"'`]*[\u4e00-\u9fff]/)
  })

  it('新键与复用键各有取用点(取键名与上面的形态判互为对照)', () => {
    for (const k of NEW_KEYS) expect(src).toContain(`t('${k.key}'`)
    for (const r of REUSE) expect(src).toContain(`t('${r.key}')`)
  })

  it('带参键必须把参数交给 t(),参数名与词典占位符同批', () => {
    expect(src).toMatch(/t\('auth\.qrScanTip',\s*\{\s*platform:/)
    expect(src).toMatch(/t\('auth\.selectHistoryAccount',\s*\{\s*account:/)
  })

  it('qrStatusText 必须经 t() 取词(它曾是这一族的中文出口)', () => {
    expect(src).not.toMatch(
      /function qrStatusText\([^)]*\)\s*:\s*string\s*\{[\s\S]*?'[\u4e00-\u9fff]/,
    )
  })
})

describe('G-924 ③:五语言同批 + 语种对 + 中文零改样', () => {
  const packs = Object.fromEntries(
    LOCALES.map((loc) => [
      loc,
      JSON.parse(readFileSync(join(SHARED_DIR, `${loc}.json`), 'utf8')) as Record<
        string,
        Record<string, unknown>
      >,
    ]),
  )
  const val = (loc: string, key: string): unknown => {
    const [ns, k] = key.split('.')
    return packs[loc]?.[ns]?.[k]
  }

  for (const spec of NEW_KEYS) {
    for (const loc of LOCALES) {
      it(`${spec.key} @ ${loc}:必须是非空字符串`, () => {
        expect(typeof val(loc, spec.key)).toBe('string')
        expect(String(val(loc, spec.key) ?? '').trim().length).toBeGreaterThan(0)
      })
    }

    it(`${spec.key}:zh-CN 值逐字节等于改动前的屏幕输出(取键不许顺手改中文文案)`, () => {
      expect(val('zh-CN', spec.key)).toBe(spec.zhCN)
    })

    it(`${spec.key}:五语言占位符同形,不许有语种把 {x} 写丢或改名`, () => {
      const want = (spec.placeholders ?? []).sort()
      for (const loc of LOCALES) {
        const got = [...String(val(loc, spec.key)).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
        expect(got, `${loc} 占位符`).toEqual(want)
      }
    })
  }

  it('en 译文不含汉字;ja 含假名;ko 谚文为主且不含汉字;zh-TW 不含简体残留', () => {
    // zh-TW 残留黑名单只列本票新值里出现过的简体字形(全量清扫归 scan-i18n-zh-residue 门)
    const SIMPLIFIED_ONLY = '载扫码历记录选区请确认页机过关与组装号'
    for (const spec of NEW_KEYS) {
      const en = String(val('en', spec.key))
      const ja = String(val('ja', spec.key))
      const ko = String(val('ko', spec.key))
      const tw = String(val('zh-TW', spec.key))
      expect(en, `en ${spec.key}`).not.toMatch(CJK)
      expect(ja, `ja ${spec.key}`).toMatch(/[぀-ヿ]/)
      expect(ko, `ko ${spec.key}`).toMatch(/[가-힯]/)
      expect(ko, `ko ${spec.key}`).not.toMatch(CJK)
      for (const ch of [...SIMPLIFIED_ONLY]) {
        expect(tw.includes(ch), `zh-TW ${spec.key} 残留简体「${ch}」`).toBe(false)
      }
    }
  })

  it('复用的既键在五语言里本来就有值(不是靠新增顶上)', () => {
    for (const r of REUSE) {
      for (const loc of LOCALES) {
        expect(String(val(loc, r.key) ?? '').trim().length, `${r.key} @ ${loc}`).toBeGreaterThan(0)
      }
    }
  })
})

describe('G-924 ④:已结清的 auth.ssoLogin / auth.ssoLoginLoading 不得被本次改动带动', () => {
  const git = (args: string[]): Buffer =>
    execFileSync(process.env.GIT_BIN || 'git', ['-c', 'safe.directory=*', ...args], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 120_000,
      maxBuffer: 128 * 1024 * 1024,
    })

  it('两枚键的五语言值与 HEAD blob 逐字相同', () => {
    for (const f of LOC_FILES) {
      const head = JSON.parse(git(['show', `HEAD:${f}`]).toString('utf8')) as Record<
        string,
        Record<string, string>
      >
      const work = JSON.parse(readFileSync(join(ROOT, f), 'utf8')) as Record<
        string,
        Record<string, string>
      >
      for (const k of ['ssoLogin', 'ssoLoginLoading']) {
        expect(work.auth?.[k], `${f} auth.${k}`).toBe(head.auth?.[k])
      }
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
