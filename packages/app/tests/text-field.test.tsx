// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 共享输入框 TextField 的判据锁(packages/app 层唯一实现)。
//
// 这个文件存在的理由不是"组件能渲染",而是钉住三件在别处会静默坏掉的事:
//   1. **聚焦必须取墨档**(亮 #000000 / 暗 #FFFFFF)—— 用户报"所有输入框的激活态描边没了",
//      根因就是这一族在 60+ 个输入框里从来没写过;写成 brandAccent(蓝)或 surface.light
//      (深色档案下 #262626,压在同色页面上等于没有)都会让"有聚焦态"这件事账面成立而屏幕上看不见。
//   2. **常态必须已经占好 1px 边框位**,聚焦只换颜色 —— 聚焦才加粗会让整屏内容跳动
//      (web 端 `border border-input` → `focus-visible:border-primary` 同样是换色不换宽)。
//   3. **调用方自带描边时不得被本组件覆盖** —— 否则登录页等已定稿的输入框会被顺手改脸。
//
// 断言取的是 fake TextInput 落进 DOM 的 `data-style`(flatten 后的样式对象),而不是截图:
// 颜色值必须逐字比,jsdom 会把 '#000000' 归一成 'rgb(0, 0, 0)',拿它当判据就得先归一化两边,
// 而那层归一化本身会成为新的失明点。

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

import { TextField } from '../src/components/TextField'
import { CourseScreen } from '../src/features/course-screen/CourseScreen'
import { AgentChatScreen } from '../src/features/agent-chat/AgentChatScreen'

vi.mock('lucide-react-native', () => ({
  ChevronLeft: (p: Record<string, unknown>) => createElement('i', p),
}))

vi.mock('react-native', () => {
  const flatten = (style: unknown): Record<string, unknown> => {
    if (style == null) return {}
    if (Array.isArray(style)) return style.reduce<Record<string, unknown>>((acc, s) => Object.assign(acc, flatten(s)), {})
    if (typeof style === 'object') return style as Record<string, unknown>
    return {}
  }
  const TextInput = (props: Record<string, unknown>) => {
    const flat = flatten(props.style)
    return createElement('input', {
      'data-testid': 'rn-textinput',
      'data-style': JSON.stringify(flat),
      onFocus: props.onFocus as (() => void) | undefined,
      onBlur: props.onBlur as (() => void) | undefined,
    })
  }
  const View = (p: Record<string, unknown>) => createElement('div', p)
  const Text = (p: Record<string, unknown>) => createElement('span', p)
  // 迁屏回归用桩:按下/列表/加载指示,只保结构不保视觉
  const Pressable = (p: Record<string, unknown>) => createElement('div', { onClick: p.onPress as never }, p.children as never)
  const TouchableOpacity = Pressable
  const ActivityIndicator = (p: Record<string, unknown>) => createElement('div', p)
  const FlatList = (p: Record<string, unknown>) =>
    createElement(
      'div',
      { 'data-testid': 'rn-flatlist' },
      (p.ListEmptyComponent ?? null) as never,
      ...(Array.isArray(p.data)
        ? (p.data as unknown[]).map((item, i) =>
            (p.renderItem as (a: { item: unknown; index: number }) => React.ReactNode)({ item, index: i }),
          )
        : []),
    )
  const StyleSheet = { flatten, create: (s: unknown) => s }
  return {
    TextInput,
    View,
    Text,
    Pressable,
    TouchableOpacity,
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Platform: { OS: 'web' },
    PixelRatio: { getFontScale: () => 1 },
  }
})

const styleOf = (el: HTMLElement) => JSON.parse(el.getAttribute('data-style') || '{}') as Record<string, string>

const renderField = (props: Record<string, unknown> = {}) => {
  const r = render(createElement(TextField, { colorScheme: 'light', placeholder: 'p', ...props } as never))
  // 取容器内节点而不是全局 testId:该包的 vitest 配置未开 globals,RTL 的自动 cleanup
  // 不会在每个用例后拆 DOM,同名 testId 会在第二个用例上撞成"multiple elements"。
  const input = r.container.querySelector('[data-testid="rn-textinput"]') as HTMLElement
  expect(input).toBeTruthy()
  return { input }
}

describe('TextField 聚焦描边', () => {
  it('常态取 1px 透明描边占位 —— 聚焦不得改宽度,只换颜色', () => {
    const { input } = renderField()
    const rest = styleOf(input)
    expect(rest.borderWidth).toBe(1)
    expect(rest.borderColor).toBe('transparent')

    fireEvent.focus(input)
    const focus = styleOf(input)
    expect(focus.borderWidth).toBe(1)
    expect(focus.borderColor).not.toBe('transparent')
  })

  it('浅色聚焦 = 纯黑 #000000(墨档),不是 brandAccent 蓝、也不是 surface 灰', () => {
    const { input } = renderField()
    fireEvent.focus(input)
    expect(styleOf(input).borderColor).toBe('#000000')
  })

  it('深色聚焦 = 纯白 #FFFFFF —— 旧写法取 surface.light 在深色页上是 #262626,等于看不见', () => {
    const { input } = renderField({ colorScheme: 'dark' })
    fireEvent.focus(input)
    expect(styleOf(input).borderColor).toBe('#FFFFFF')
  })

  it('失焦回到常态(聚焦态不得粘住)', () => {
    const { input } = renderField()
    fireEvent.focus(input)
    fireEvent.blur(input)
    expect(styleOf(input).borderColor).toBe('transparent')
  })

  it('调用方自带描边时逐字生效(本组件不得覆盖已定稿外观)', () => {
    const { input } = renderField({ style: { borderWidth: 2, borderColor: '#123456', height: 40 } })
    expect(styleOf(input)).toMatchObject({ borderWidth: 2, borderColor: '#123456', height: 40 })
  })

  it('focusedStyle 排在共享墨档之后,供登录页这类"聚焦加粗"的差异需求覆盖', () => {
    const { input } = renderField({ focusedStyle: { borderWidth: 2 } })
    fireEvent.focus(input)
    expect(styleOf(input).borderWidth).toBe(2)
    expect(styleOf(input).borderColor).toBe('#000000')
  })

  it('onFocus/onBlur 透传给调用方(内部记账不得吃掉宿主回调)', () => {
    let inCalls = 0
    let outCalls = 0
    const { input } = renderField({ onFocus: () => inCalls++, onBlur: () => outCalls++ })
    fireEvent.focus(input)
    fireEvent.blur(input)
    expect(inCalls).toBe(1)
    expect(outCalls).toBe(1)
  })
})

describe('TextField 与 web/小程序同源', () => {
  it('web 端聚焦仍是 border-primary(墨档),三端取同一档而非各取一档', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const css = readFileSync(join(here, '../../ui-react/src/components/input.tsx'), 'utf8')
    expect(css).toMatch(/focus-visible:border-primary/)
    expect(css).toMatch(/border border-input/)
  })
})
describe('colorScheme 必填(类型层强制,票面 G-978007 要求)', () => {
  it('TextFieldProps 的 colorScheme 是必填形参:无 ? 、无默认值(守门 91 同判,由调用点 tsc 接管)', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(join(here, '../src/components/TextField.tsx'), 'utf8')
    // 必填形态:类型注解直接落在形参上
    expect(src).toMatch(/colorScheme:\s*AppThemeMode\b/)
    // 不得可选/不得带 light 默认值 —— 那是"静默脱主题开关"的两种旧形态
    expect(src).not.toMatch(/colorScheme\?\s*:/)
    expect(src).not.toMatch(/colorScheme\s*=\s*['"]light['"]/)
  })
})

describe('迁屏回归:屏幕经 TextField 拿到墨档聚焦态(G-978007)', () => {
  const t = (k: string) => k
  const inputOf = (c: { container: HTMLElement }) =>
    c.container.querySelector('[data-testid="rn-textinput"]') as HTMLElement

  it('CourseScreen 浅色:聚焦描边逐字 #000000,换色不换宽', () => {
    const r = render(
      createElement(
        CourseScreen,
        {
          t,
          items: [],
          keyword: '',
          loading: false,
          page: 1,
          totalPages: 1,
          onKeywordChange: () => {},
          onPageChange: () => {},
          onPressItem: () => {},
          colorScheme: 'light',
        } as never,
      ),
    )
    const input = inputOf(r)
    expect(input).toBeTruthy()
    fireEvent.focus(input)
    const s = styleOf(input)
    expect(s.borderColor).toBe('#000000')
    expect(s.borderWidth).toBe(1)
  })

  it('CourseScreen 深色:聚焦描边逐字 #FFFFFF', () => {
    const r = render(
      createElement(
        CourseScreen,
        {
          t,
          items: [],
          keyword: '',
          loading: false,
          page: 1,
          totalPages: 1,
          onKeywordChange: () => {},
          onPageChange: () => {},
          onPressItem: () => {},
          colorScheme: 'dark',
        } as never,
      ),
    )
    fireEvent.focus(inputOf(r))
    expect(styleOf(inputOf(r)).borderColor).toBe('#FFFFFF')
  })

  it('AgentChatScreen 浅色:输入行走 TextField,聚焦墨档生效', () => {
    const r = render(
      createElement(
        AgentChatScreen,
        {
          t,
          title: 'agent',
          messages: [],
          loading: false,
          input: 'hi',
          sending: false,
          onInputChange: () => {},
          onSend: () => {},
          onBack: () => {},
          colorScheme: 'light',
        } as never,
      ),
    )
    const input = inputOf(r)
    expect(input).toBeTruthy()
    fireEvent.focus(input)
    expect(styleOf(input).borderColor).toBe('#000000')
  })
})

describe('RN 裸 TextInput 普查锁(G-978007 口径)', () => {
  // 白名单逐条登记原因;新增裸 TextInput 必须补处理或补白名单理由
  const ALLOWED: Record<string, string> = {
    'apps/mobile-rn/src/screens/ImageGenCreateScreen.tsx':
      'nativewind className 描边:内联 RESTING_BORDER 会与类档描边互相覆盖,无视觉通道验证不迁',
    'apps/mobile-rn/src/screens/KnowledgeRagScreen.tsx': '同上(className 描边)',
  }
  const SCAN_ROOTS = ['packages/app/src', 'apps/mobile-rn/src']

  const repoRoot = () => join(dirname(fileURLToPath(import.meta.url)), '../../..')
  const git = (args: string[], input?: Buffer): Buffer =>
    execFileSync(process.env.GIT_BIN || 'git', ['-c', 'safe.directory=*', ...args], {
      cwd: repoRoot(),
      stdio: input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 120_000,
      maxBuffer: 128 * 1024 * 1024,
      input,
    })

  // 普查面 = 提交树(HEAD),不是磁盘。此前按磁盘 readdirSync 判,于是"这台机上此刻有什么"决定了结论:
  // 别人在飞的未跟踪文件会被算进本仓债务,只能往白名单里补一条指向"只存在于某一台机"的路径;
  // 而 CI 的干净检出里没有那个文件 ⇒ 白名单自证那条(existsSync)当场判红。一台机绿、另一台机红,
  // 而红的既不是仓库内容也不是改动者的错。口径同守门 77/83/98:全量判 HEAD blob。
  function census() {
    const paths = git(['ls-tree', '-r', '--name-only', 'HEAD', '--', ...SCAN_ROOTS])
      .toString('utf8')
      .split('\n')
      .filter((line) => line.endsWith('.tsx'))
    // 预筛:三条判据都要求文件里出现字面量 TextInput,所以 git grep 的命中集是判据的**严格超集**,
    // 拿它筛面不会漏 offender(同守门 102 对"预筛必须是判据字面量超集"的对账)。不这么筛的话,
    // 490 个文件要派 490 次 git show,这条用例会变成整轮测试里的最慢项。
    const candidates = new Set(
      git(['grep', '-l', '--fixed-string', 'TextInput', 'HEAD', '--', ...SCAN_ROOTS])
        .toString('utf8')
        .split('\n')
        .map((line) => line.replace(/^HEAD:/, ''))
        .filter((line) => line.endsWith('.tsx')),
    )
    const unreadable: string[] = []
    const offenders: string[] = []
    for (const rel of paths) {
      if (!candidates.has(rel)) continue
      let text
      try {
        text = git(['show', `HEAD:${rel}`]).toString('utf8')
      } catch {
        unreadable.push(rel)
        continue
      }
      // 只盯 value 导入(import type 的 TextInput 是纯类型位,不渲染)
      if (!new RegExp("import \\{[^}]*\\bTextInput\\b[^}]*\\} from 'react-native'").test(text)) continue
      if (!/<TextInput\b/.test(text)) continue
      if (/onFocus|focused/i.test(text)) continue
      if (Object.hasOwn(ALLOWED, rel)) continue
      offenders.push(rel)
    }
    return { paths, candidates, offenders, unreadable }
  }

  it('凡 value 导入 TextInput 且有 JSX 站点的文件,必须带 onFocus/focused 处理', () => {
    const { paths, candidates, offenders, unreadable } = census()
    // 枚举到 0 个 .tsx 就是尺子根本没跑到,不得被读成"都没违规"
    expect(paths.length, 'HEAD 面上没枚举到任何 .tsx ⇒ 普查未生效').toBeGreaterThan(0)
    // 预筛集为空同样等于"没跑到":那会让 offender 恒空,把尺子失效伪装成通过
    expect(candidates.size, 'git grep 预筛一个候选都没命中 ⇒ 预筛失效,不得当作合规').toBeGreaterThan(0)
    expect(unreadable, '有文件正文取不到 ⇒ 那一格是未判定,不许记为通过').toEqual([])
    expect(offenders).toEqual([])
  })

  it('白名单条目必须落在普查面上(防陈旧条目空转)', () => {
    const face = new Set(census().paths)
    for (const rel of Object.keys(ALLOWED)) {
      expect(face.has(rel), `${rel} 不在 HEAD 的普查面里 ⇒ 这条白名单是空转的`).toBe(true)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
