// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D83(MCP 工具活动 server×tool 定制措辞)在 mobile-rn 端的装车证明。
//
// 为什么单独一份:共享层 `describeMcpToolActivity` 的回落链在
// `packages/shared/tests/chat/mcp-tool-activity.test.ts` 已有 21 例,但**链在共享层、
// 装车在端内** —— 本端没接上时,共享层全绿而屏幕上仍是裸码名(与守门 64/70/81/115 同型:
// "造好没装车"只能由消费点自己的测试拦住)。所以本文件的判据对象是**本端渲染点实际调用的
// 那个出口** `mcpToolActivityTitle`,并且取词必须走本端真实语言包(不写假 t)。
//
// 正向证明(名单成员各测一条,名单可以是张死表而门一路报绿):
//   词表 `SERVER_TOOL_ACTIVITY_KEYS` 里真实存在的 `github` × `create_issue` 四档
//   (active / completed / activeWithContext / completedWithContext)在 zh-CN 与 en
//   双语下都必须渲染出**各不相同的自然语言**,而不是回显键名或码名。
// 反向锁:词表里没有的 server×tool 必须落回调用方的既有功能名口径(`null`),
//   既不得崩、也不得把 `toolMcpXxxActivity` 这类键名或 `some_private_tool` 码名印到界面。
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import sharedEn from '@ihui/i18n/messages/shared/en.json'
import sharedZhCN from '@ihui/i18n/messages/shared/zh-CN.json'
import { translate } from '@ihui/i18n/loader'
import type { Messages } from '@ihui/i18n/types'
import { describeMcpToolActivity } from '@ihui/shared/chat'

import {
  mcpToolActivityTitle,
  type McpToolRowInput,
  type ToolRowTranslateFn,
} from '../src/utils/chat-render-model'

// 措辞键的权威源在 shared 包(packages/i18n/messages/mobile-rn/*.json 不覆写这 29 键,
// 实测计数 0),本端 `src/i18n` 的合并视图正是 shared ⊕ 端包 ⇒ 直接用 shared 包判等价。
const PACKS = { 'zh-CN': sharedZhCN as Messages, en: sharedEn as Messages }

/** 复刻本端 `useI18n().t`:点号全路径 + ICU 变量,取不到即回显键名(loader 既有语义) */
function endTranslate(locale: keyof typeof PACKS): ToolRowTranslateFn {
  const messages = PACKS[locale]
  return (key, params) => translate(messages, key, { fallback: messages, params })
}

const row = (over: Partial<McpToolRowInput> = {}): McpToolRowInput => ({
  name: 'create_issue',
  status: 'running',
  serverSource: 'mcp',
  serverName: 'github',
  ...over,
})

describe('mcpToolActivityTitle — 正向:词表真实成员的定制措辞真的被取到', () => {
  it('github × create_issue / running → "正在创建 GitHub 议题"(不是码名、不是键名)', () => {
    const line = mcpToolActivityTitle(row(), endTranslate('zh-CN'))
    expect(line).toBe('正在创建 GitHub 议题')
    expect(line).not.toContain('create_issue')
    expect(line).not.toContain('toolMcp')
  })

  it('同一工具 / success → 完成档"已创建 GitHub 议题"(与进行中档不同文)', () => {
    const done = mcpToolActivityTitle(row({ status: 'success' }), endTranslate('zh-CN'))
    expect(done).toBe('已创建 GitHub 议题')
    expect(done).not.toBe(mcpToolActivityTitle(row(), endTranslate('zh-CN')))
  })

  it('非中文 locale 同样取到值(en 包逐字核对,防"只有中文接上了")', () => {
    const running = mcpToolActivityTitle(row(), endTranslate('en'))
    const completed = mcpToolActivityTitle(row({ status: 'success' }), endTranslate('en'))
    expect(typeof running).toBe('string')
    expect(running).not.toBeNull()
    expect(running).not.toBe(completed)
    expect(running ?? '').not.toContain('create_issue')
    expect(running ?? '').not.toContain('toolMcp')
    // 语言包漏译时 loader 会回显键名 —— 那种形态绝不允许进界面
    expect(running ?? '').not.toMatch(/Activity/)
  })

  it('四档全部可达(active / completed / activeWithContext / completedWithContext)', () => {
    // 端内渲染点今天刻意不喂 context(对象文本由 describeToolCall 单独成行渲染,
    // 喂进措辞会同义重复 —— 见 docs/plan-audit-2026-09-25/code-d83.md §6.5)。
    // 因此带上下文的这两档直接用「本端同一取词契约」过一遍,证明两档在本端语言包
    // 里也解析得出来,而不是只有共享层测试里有真包。
    for (const [locale, expectName] of [
      ['zh-CN', '登录白屏'],
      ['en', 'login-blank'],
    ] as const) {
      const t = endTranslate(locale)
      const four = (['running', 'completed'] as const).flatMap((state) =>
        [null, expectName].map((context) =>
          describeMcpToolActivity({
            serverName: 'github',
            toolName: 'create_issue',
            state,
            context,
            translate: (key, params) => t(`taskStatus.${key}`, params),
          }),
        ),
      )
      expect(new Set(four).size).toBe(4)
      for (const line of four) {
        expect(line).not.toContain('create_issue')
        expect(line).not.toContain('toolMcp')
        expect(line.trim()).not.toBe('')
      }
      // 带上下文两档(下标 1 = running+context、3 = completed+context)必须真的把对象写进
      // 句子 —— ICU 的 {name} 没被替换 = 上下文层等于白写
      expect(four[1]).toContain(expectName)
      expect(four[3]).toContain(expectName)
      expect(four[0]).not.toContain(expectName)
      expect(four[2]).not.toContain(expectName)
    }
  })

  it('server 已登记而该 tool 未定制 → 落第 2 级"正在调用 GitHub 工具"(仍非码名)', () => {
    const line = mcpToolActivityTitle(row({ name: 'archive_repo' }), endTranslate('zh-CN'))
    expect(line).toBe('正在调用 GitHub 工具')
  })

  it('命名空间写法(mcp__github__create_issue)同样命中定制档', () => {
    expect(
      mcpToolActivityTitle(row({ name: 'mcp__github__create_issue' }), endTranslate('zh-CN')),
    ).toBe('正在创建 GitHub 议题')
  })
})

describe('mcpToolActivityTitle — 反向锁:没有定制时不得崩、不得吐键名/码名', () => {
  it('server 与 tool 两侧都未登记 → 交回 null,由调用方沿用既有功能名口径', () => {
    expect(
      mcpToolActivityTitle(
        row({ serverName: 'not_registered', name: 'zzz_no_such_tool' }),
        endTranslate('zh-CN'),
      ),
    ).toBeNull()
  })

  it('语言包整体取不到(全部回显键名)时也不得把键名送上界面', () => {
    const echo: ToolRowTranslateFn = (key) => key
    expect(mcpToolActivityTitle(row(), echo)).toBeNull()
  })

  it('error 态不进双时态链 —— 对失败的调用声称"已 X"是假陈述', () => {
    expect(mcpToolActivityTitle(row({ status: 'error' }), endTranslate('zh-CN'))).toBeNull()
  })

  it('非 MCP 来源(内置 / 插件)不归本层管', () => {
    const t = endTranslate('zh-CN')
    expect(mcpToolActivityTitle(row({ serverSource: 'builtin', name: 'read_file' }), t)).toBeNull()
    expect(
      mcpToolActivityTitle(row({ serverSource: 'plugin', name: 'create_issue' }), t),
    ).toBeNull()
    expect(mcpToolActivityTitle({ name: 'create_issue', status: 'running' }, t)).toBeNull()
  })
})

// 上面这些判据证明的是"出口会给正确答案",证不了"渲染点真的问了它"——
// 本仓最高频失效型就是"件在库、测试也绿、没人接"(守门 64/70/81/115 同族),
// 而 `ToolCallList` 是本屏私有函数(未导出),组件级渲染测不到,故用源码形状锁。
describe('装车证明:本屏工具行必须真的经过这个出口', () => {
  const screenSrc = readFileSync(
    resolve(__dirname, '../src/screens/AiAssistantN8nScreen.tsx'),
    'utf8',
  )

  it('从 chat-render-model import 了 mcpToolActivityTitle', () => {
    expect(screenSrc).toMatch(
      /mcpToolActivityTitle,[\s\S]{0,200}?from '\.\.\/utils\/chat-render-model'/,
    )
  })

  it('行标题 displayName 把它排在既有功能名之前,并保留 ?? 兜底(不得整条换掉旧链)', () => {
    expect(screenSrc).toMatch(/mcpToolActivityTitle\(\s*item\s*,\s*t\s*\)\s*\?\?/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
