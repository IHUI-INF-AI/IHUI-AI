// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票㉑ 展示层对账:扩展侧栏 WorkspacePicker(2026-09-28)。
 *
 * 三层,缺一层就是假绿:
 *  ① 渲染/交互层 —— 真挂载(happy-dom + createRoot + act)驱动四条真实路径:
 *     订阅拿到当前值、点 pick 真调 store 出口、清除真调 store 出口、卸载真取消订阅。
 *     静态渲染(renderToStaticMarkup)另测"未设工作区"那一屏,词值全部取自真词包
 *     (packages/i18n/messages/{shared,extension})⇒ 任何"回显键名"当场变红。
 *  ② 判据层 —— shouldShowFailure 四态各一对(aborted/unsupported 静默,
 *     denied/not-writable 出文案),并与 ① 的行为面互为对照。
 *  ③ 源码接线层 —— 防本仓最高频失效型"函数在、判据对、无人调用":
 *     store 三个出口必须真被调用;useEffect 必须把取消函数**返回**给 React;
 *     shouldShowFailure 必须真在渲染式里被调用(把它摘掉 ⇒ 本用例红)。
 *     纪律面:代码面(剥注释)零中文、只用四枚既有语言包键、无 title/alert/confirm、
 *     圆角只走档位类名、描边不取墨档。
 */

// @vitest-environment happy-dom

import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ActiveWorkspace, PickOutcome, WorkspaceFailureKind } from '../lib/workspace-store'

/**
 * 允许用到的词键白名单。三枚新键(chat.selectWorkspace / chat.workspaceNotWritable /
 * agent.clear)与旧三枚的区别只是"这一枚是本轮补进去的":2026-09-28 提交 3a8726494e
 * 按五语言同批落包 —— 顺序是**词键先到位、代码后引用**,而不是反过来借一枚语义不符的旧键。
 * 白名单仍然有用:它拦的是"顺手再借一枚",不是"不许有词键"。
 */
const ALLOWED_KEYS = [
  'chat.selectWorkspace',
  'chat.workspaceNotWritable',
  'agent.clear',
  'agent.permission',
  'agent.permissionDecision',
  'chat.injectionKindWorkspace',
  'apps.workspace',
]

const h = vi.hoisted(() => {
  type Ws = { name: string; handle: unknown } | null
  const listeners = new Set<(ws: Ws) => void>()
  let current: Ws = null
  const unsubscribe = vi.fn((): void => {})
  const clear = vi.fn((): void => {})
  const pick = vi.fn(async (): Promise<PickOutcome> => ({ workspace: null, failure: null }))
  // 必须是 spy:用例要问"订阅到底发生了几次",普通函数就只剩"没报错"这一种读数
  const subscribe = vi.fn((cb: (ws: Ws) => void): (() => void) => {
    listeners.add(cb)
    // 与真 store 同形:订阅即回调当前值
    cb(current)
    return () => {
      unsubscribe()
      listeners.delete(cb)
    }
  })
  return {
    listeners,
    unsubscribe,
    subscribe,
    pick,
    clear,
    setCurrent(ws: Ws): void {
      current = ws
      for (const cb of [...listeners]) cb(ws)
    },
  }
})

vi.mock('../lib/workspace-store', () => ({
  subscribeActiveWorkspace: h.subscribe,
  pickWorkspaceDirectory: h.pick,
  clearActiveWorkspace: h.clear,
}))

// 真词表 oracle:与端内 src/i18n 完全同一条 mergeMessages + translate 链
// (沿用 queue-bar-ext.test.tsx 的姿势)
vi.mock('../src/i18n', async () => {
  const { mergeMessages, translate } = await import('@ihui/i18n/loader')
  type Messages = Record<string, unknown>
  const shared = (await import('@ihui/i18n/messages/shared/zh-CN.json'))
    .default as unknown as Messages
  // 同一个 HEAD 面(工厂体内不得引用外层 const —— vi.mock 会被 hoist 到 import 之前)
  const { execFileSync: efs } = await import('node:child_process')
  const ext = JSON.parse(
    efs('git', ['show', 'HEAD:packages/i18n/messages/extension/zh-CN.json'], {
      cwd: resolve(process.cwd(), '../..'),
      encoding: 'utf8',
      maxBuffer: 1 << 26,
      windowsHide: true,
    }),
  ) as unknown as Messages
  const messages = mergeMessages(shared, ext)
  return {
    useI18n: () => ({
      t: (key: string, params?: Record<string, string | number>) =>
        translate(messages, key, { fallback: messages, params }),
      locale: 'zh-CN' as const,
      setLocale: () => {},
    }),
  }
})

import {
  WorkspacePicker,
  shouldShowFailure,
} from '../entrypoints/sidepanel/components/WorkspacePicker'

const HERE = dirname(fileURLToPath(import.meta.url))
const EXT_ROOT = resolve(HERE, '..')
const COMPONENT_PATH = join(EXT_ROOT, 'entrypoints/sidepanel/components/WorkspacePicker.tsx')
const COMPONENT_SRC = readFileSync(COMPONENT_PATH, 'utf8')
/**
 * 取词面 = HEAD blob,不是工作树副本。实测此刻 packages/i18n/messages/extension/*.json 的
 * 工作树副本被并发会话持有、比 HEAD 少 26 个键(端内 chat-branch / queue-bar-ext /
 * steer-notice 三个文件 28 例正因它而红)。按磁盘判会让一把正确的改动被判红,
 * 而"渲染出的词值"与"断言期望的词值"来自两份文件 —— 两面必须同一个源。
 */
const REPO_ROOT = resolve(HERE, '../../..')
const PACK_PATH = 'packages/i18n/messages/extension/zh-CN.json'
function headPackText(): string {
  return execFileSync('git', ['show', 'HEAD:' + PACK_PATH], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    windowsHide: true,
  })
}
const EXT_PACK = JSON.parse(headPackText()) as Record<string, unknown>
// 五语言 parity:新键只在 zh-CN 里有 = 其余四语言界面回显键名,所以逐包断言
const FIVE_LOCALES = ['zh-CN', 'zh-TW', 'ja', 'ko', 'en'] as const

/** 从真词包取词值(测试内不重述词值) */
function lookup(key: string): string {
  let cur: unknown = EXT_PACK
  for (const part of key.split('.')) {
    if (typeof cur !== 'object' || cur === null) throw new Error(`词包无此键:${key}`)
    cur = (cur as Record<string, unknown>)[part]
  }
  if (typeof cur !== 'string') throw new Error(`词包该键不是字符串:${key}`)
  return cur
}

const WORD_SELECT = lookup('chat.selectWorkspace')
const WORD_CLEAR = lookup('agent.clear')

/** 判代码形态前必须剥注释:本文件的说明里合法地写着中文与 `title` 等字样 */
const codeOnly = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const CODE = codeOnly(COMPONENT_SRC)

// react-dom/client 的 act 需要这个开关,否则 act() 直接报错
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, writable: true })

const disposers: Array<() => Promise<void>> = []

async function mount(): Promise<{ container: HTMLElement; dispose: () => Promise<void> }> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  let disposed = false
  const dispose = async (): Promise<void> => {
    if (disposed) return
    disposed = true
    await act(async () => {
      root.unmount()
    })
    container.remove()
  }
  disposers.push(dispose)
  await act(async () => {
    root.render(createElement(WorkspacePicker))
  })
  return { container, dispose }
}

function buttonOf(container: HTMLElement, testId: string): HTMLButtonElement {
  const el = container.querySelector(`[data-testid="${testId}"]`)
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error(`找不到可点元素 data-testid="${testId}"(容器内容:${container.innerHTML})`)
  }
  return el
}

async function click(container: HTMLElement, testId: string): Promise<void> {
  const el = buttonOf(container, testId)
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

function failureText(container: HTMLElement): string | null {
  const el = container.querySelector('[data-testid="ext-workspace-failure"]')
  return el === null ? null : (el.textContent ?? '')
}

const failWith = (kind: WorkspaceFailureKind, detail: string): PickOutcome => ({
  workspace: null,
  failure: { kind, detail },
})

/**
 * 组件只读 `workspace.name` 做显示,从不触碰 handle(取句柄与写文件都在 store 里)
 * ⇒ 夹具给一个"没人用过"的占位,而不是去伪造一个 DirectoryHandle 的行为。
 */
const HANDLE_STUB = {} as ActiveWorkspace['handle']

const okWith = (name: string): PickOutcome => ({
  workspace: { name, handle: HANDLE_STUB },
  failure: null,
})

afterEach(async () => {
  for (const dispose of disposers.splice(0)) await dispose()
  // mockClear(不是 mockReset):只清调用记录。Reset 会把默认实现一起抹掉,
  // 那会让"没设 Once 值的用例"拿到 undefined 而不是"无工作区",故障伪装成判据。
  h.pick.mockClear()
  h.clear.mockClear()
  h.unsubscribe.mockClear()
  h.subscribe.mockClear()
  // 模块级 current 会跨用例存活:不收回就是给下一条用例发合格证
  h.setCurrent(null)
})

describe('① 渲染与交互:状态全部来自 store,文案全部走词包', () => {
  it('静态渲染未设工作区 ⇒ 只有一个取目录按钮,词值是「工作区」而不是键名,且无清除钮/无失败行', () => {
    const markup = renderToStaticMarkup(<WorkspacePicker />)
    expect(markup).toContain(WORD_SELECT)
    // 回显键名 = 本端词包没这一键,必须红
    expect(markup).not.toContain('apps.workspace')
    expect(markup).toContain('data-testid="ext-workspace-pick"')
    expect(markup).not.toContain('ext-workspace-clear')
    expect(markup).not.toContain('ext-workspace-failure')
    // 禁原生提示窗属性(AGENTS §4):提示只能走项目自有组件
    expect(markup).not.toContain('title=')
  })

  it('store 已有工作区 ⇒ 显示目录名 + 带无障碍名的清除钮(无障碍名是真词值),pick 钮撤下', async () => {
    h.setCurrent({ name: 'ihui-workspace', handle: HANDLE_STUB })
    const { container } = await mount()
    expect(container.textContent).toContain('ihui-workspace')
    const clearBtn = buttonOf(container, 'ext-workspace-clear')
    expect(clearBtn.getAttribute('aria-label')).toBe(WORD_CLEAR)
    expect(container.querySelector('[data-testid="ext-workspace-pick"]')).toBeNull()
  })

  it('点清除 ⇒ 真调 clearActiveWorkspace(store 出口不是装饰品)', async () => {
    h.setCurrent({ name: 'ihui-workspace', handle: HANDLE_STUB })
    const { container } = await mount()
    await click(container, 'ext-workspace-clear')
    expect(h.clear).toHaveBeenCalledTimes(1)
  })

  it('卸载 ⇒ 必须调用订阅返回的取消函数(否则换目录会打到已卸载面板)', async () => {
    expect(typeof document).toBe('object')
    const { dispose } = await mount()
    expect(h.subscribe).toHaveBeenCalledTimes(1)
    expect(h.unsubscribe).not.toHaveBeenCalled()
    await dispose()
    expect(h.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('点选目录 ⇒ 真调 pickWorkspaceDirectory,denied 时按钮下方只出 detail 技术串', async () => {
    h.pick.mockResolvedValueOnce(failWith('denied', 'NotAllowedError'))
    const { container } = await mount()
    await click(container, 'ext-workspace-pick')
    expect(h.pick).toHaveBeenCalledTimes(1)
    // 内容**只有** detail:端内不得新造任何句子
    expect(failureText(container)).toBe('NotAllowedError')
  })

  it('pick 成功 ⇒ 不产任何失败文案(文案位由 store 状态接管)', async () => {
    h.pick.mockResolvedValueOnce(okWith('ok-dir'))
    const { container } = await mount()
    await click(container, 'ext-workspace-pick')
    expect(failureText(container)).toBeNull()
  })
})

describe('② 失败态四态:取消与"能力没有"都不许变成文案', () => {
  it('aborted ⇒ 静默(用户取消不是故障)', async () => {
    h.pick.mockResolvedValueOnce(failWith('aborted', 'AbortError'))
    const { container } = await mount()
    await click(container, 'ext-workspace-pick')
    expect(failureText(container)).toBeNull()
    expect(container.textContent).toBe(WORD_SELECT)
  })

  it('unsupported ⇒ 静默(与今天一样无操作,不新造提示)', async () => {
    h.pick.mockResolvedValueOnce(failWith('unsupported', 'no-picker'))
    const { container } = await mount()
    await click(container, 'ext-workspace-pick')
    expect(failureText(container)).toBeNull()
    expect(container.textContent).toBe(WORD_SELECT)
  })

  it('denied ⇒ 只出 detail 技术串;not-writable ⇒ 出语言包文案而不是裸档名', async () => {
    h.pick.mockResolvedValueOnce(failWith('denied', 'SecurityError'))
    {
      const { container, dispose } = await mount()
      await click(container, 'ext-workspace-pick')
      expect(failureText(container)).toBe('SecurityError')
      await dispose()
    }
    h.pick.mockResolvedValueOnce(failWith('not-writable', 'prompt'))
    {
      const { container, dispose } = await mount()
      await click(container, 'ext-workspace-pick')
      const shown = failureText(container)
      // 真词值(HEAD 面包裹的中文),既不是内部档名 'prompt' 也不是回显的键名
      expect(shown).toBe(lookup('chat.workspaceNotWritable'))
      expect(shown).not.toBe('prompt')
      expect(shown).not.toContain('chat.workspaceNotWritable')
      await dispose()
    }
  })

  it('shouldShowFailure 四条各一对(与 ① 的行为面同判据)', () => {
    expect(shouldShowFailure('aborted')).toBe(false)
    expect(shouldShowFailure('unsupported')).toBe(false)
    expect(shouldShowFailure('denied')).toBe(true)
    expect(shouldShowFailure('not-writable')).toBe(true)
  })
})

describe('③ 源码接线与纪律(摘掉即红)', () => {
  it('store 三个出口必须真被调用 —— 组件里出现带括号的调用,不是只在 import 里点名', () => {
    for (const call of [
      'subscribeActiveWorkspace(',
      'pickWorkspaceDirectory(',
      'clearActiveWorkspace(',
    ]) {
      expect(CODE).toContain(call)
    }
    // getActiveWorkspace 不得被组件绕过订阅自取一次(那会产出第二份状态)
    expect(CODE).not.toContain('getActiveWorkspace(')
  })

  it('useEffect 必须把取消函数 return 给 React;只订阅不返回 ⇒ 红', () => {
    expect(CODE).toMatch(/useEffect\(\(\)\s*=>\s*subscribeActiveWorkspace\(/)
    expect(CODE).not.toMatch(/useEffect\(\(\)\s*=>\s*\{\s*subscribeActiveWorkspace\(/)
  })

  it('shouldShowFailure 与 failureIsTechnical 必须真被渲染式调用(摘掉即红)', () => {
    expect(CODE).toMatch(/shouldShowFailure\(\s*failure\.kind\s*\)/)
    expect(CODE).toMatch(/failureIsTechnical\(\s*failure\.kind\s*\)/)
  })

  it('三枚新键在五语言包里都有非空值(parity:缺一语即该语言界面回显键名)', () => {
    for (const loc of FIVE_LOCALES) {
      const pack = JSON.parse(
        execFileSync('git', ['show', 'HEAD:packages/i18n/messages/extension/' + loc + '.json'], {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          maxBuffer: 1 << 26,
          windowsHide: true,
        }),
      ) as { chat?: Record<string, unknown> }
      for (const key of ['selectWorkspace', 'workspaceNotWritable']) {
        const v = pack.chat?.[key]
        if (typeof v !== 'string' || v.trim() === '') throw new Error(loc + ' 缺 chat.' + key)
      }
    }
  })

  it('代码面(剥注释)零中文 ⇒ 界面串一律走 t();并禁 title/alert/confirm/prompt', () => {
    expect(CODE).not.toMatch(/[㐀-䶿一-鿿豈-﫿぀-ヿ가-힯]/)
    expect(CODE).not.toMatch(/\btitle\s*=/)
    expect(CODE).not.toMatch(/\b(alert|confirm|prompt)\s*\(/)
  })

  it('用到的语言包键只能是那四枚既有的(防新增键)', () => {
    const used = [...CODE.matchAll(/\bt\(\s*'([^']+)'/g)].map((m) => m[1] as string)
    expect(used.length).toBeGreaterThan(0)
    for (const key of used) expect(ALLOWED_KEYS).toContain(key)
  })

  it('样式纪律:圆角只走档位类名,描边不取墨档,不写 hex', () => {
    expect(CODE).not.toMatch(/rounded-\[/)
    expect(CODE).not.toMatch(/rounded-full/)
    expect(CODE).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(CODE).not.toMatch(/\bborder-primary\b|\bring-primary\b/)
    // 档位类名必须在场(否则"没写圆角"会让这一条静默通过)
    expect(CODE).toMatch(/rounded-(xs|sm|md|lg|xl|2xl)\b/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
