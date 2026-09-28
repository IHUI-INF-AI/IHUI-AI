// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * D83(工具活动标题的跨端对账)在 **extension** 端的装车证明。
 *
 * 为什么单独一份:共享层 `describeMcpToolActivity` 的回落链在
 * `packages/shared/tests/chat/mcp-tool-activity.test.ts` 已有用例,但**链在共享层、装车在端内** ——
 * 本端接上之前,共享层全绿而屏幕上仍是裸码名 `create_issue`(守门 64/70/81/115 那一族
 * "造好没装车"只能由消费点自己的测试拦住)。所以本文件的判据对象是**本端渲染点实际调用的出口**
 * `mcpToolActivityTitle`,并且取词必须走本端真实语言包(shared ⊕ extension 合并集,不写假 t)。
 *
 * 三档证明,缺一不可:
 *  ① 单元:出口本身在真实语言包下给出正确措辞(正向名单成员各测一条 —— 名单可以是张死表而一路报绿);
 *  ② 渲染级:真把 MCP 工具帧喂进 `<MessageContent>`,**产出的 HTML** 里有 server 名、没有码名
 *     —— 这一档才是"上了屏"的证据,①单独绿只证明"函数会给答案";
 *  ③ 源码反向锁:渲染点的标题链必须真的经过这个出口(组件是模块私有的,②只覆盖被渲染的那条路径)。
 */
import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import extEn from '@ihui/i18n/messages/extension/en.json'
import extZhCN from '@ihui/i18n/messages/extension/zh-CN.json'
import sharedEn from '@ihui/i18n/messages/shared/en.json'
import sharedZhCN from '@ihui/i18n/messages/shared/zh-CN.json'
import { mergeMessages, translate } from '@ihui/i18n/loader'
import type { Messages } from '@ihui/i18n/types'

// 本端 `useI18n().t` 的真身(index.tsx:113-121):点号全路径 + fallback 到 zh-CN + ICU 变量。
// 测试面把 t 挂在可替换的 holder 上,是为了让 ② 的渲染级用例也在**真包**下取词,
// 而不是沿用旁边那份 `t: (key) => key` 的回显 mock —— 那种 mock 会让措辞层永远取不到值,
// 于是"接上了"与"没接上"在断言里长得一模一样。
type Translate = (key: string, params?: Record<string, string | number>) => string
const PACKS: Record<'zh-CN' | 'en', Messages> = {
  'zh-CN': mergeMessages(sharedZhCN, extZhCN) as Messages,
  en: mergeMessages(sharedEn, extEn) as Messages,
}
const realT =
  (locale: 'zh-CN' | 'en'): Translate =>
  (key, params) =>
    translate(PACKS[locale], key, { fallback: PACKS['zh-CN'], params })

/**
 * `mcpToolActivityTitle` 收的是**已补命名空间**的取词器(即渲染点传给它的 `makeToolTranslate(t)`)。
 * 单元用例必须喂同一形:否则查的是裸键 `toolMcpXxxActivity` 而不是 `taskStatus.toolMcpXxxActivity`,
 * 量到的是"测试自己接错线"而不是端上行为(本文件第一轮就因此 6 例全红)。
 */
const toolT = (locale: 'zh-CN' | 'en'): Translate => {
  const t = realT(locale)
  return (key, params) => t(`taskStatus.${key}`, params)
}

const holder = vi.hoisted((): { t: Translate } => ({ t: (key: string) => key }))
vi.mock('../src/i18n', () => ({
  useI18n: () => ({ t: holder.t, locale: 'zh-CN', setLocale: () => {} }),
}))

const { mcpToolActivityTitle, MessageContent } =
  await import('../entrypoints/sidepanel/components/MessageContent')

const row = (over: Record<string, unknown> = {}) => ({
  toolName: 'create_issue',
  status: 'running' as const,
  serverSource: 'mcp' as const,
  serverName: 'github',
  ...over,
})

describe('① 单元:出口在真实语言包下给出 server×tool 措辞', () => {
  it('github × create_issue / running → 「正在创建 GitHub 议题」(标题里真的出现 server 名)', () => {
    const line = mcpToolActivityTitle(row(), toolT('zh-CN'))
    expect(line).toBe('正在创建 GitHub 议题')
    expect(line).toContain('GitHub')
    expect(line).not.toContain('create_issue')
    expect(line).not.toContain('toolMcp')
  })

  it('success → 完成档「已创建 GitHub 议题」,与进行中档不同文(双时态真的分档)', () => {
    const done = mcpToolActivityTitle(row({ status: 'success' }), toolT('zh-CN'))
    expect(done).toBe('已创建 GitHub 议题')
    expect(done).not.toBe(mcpToolActivityTitle(row(), toolT('zh-CN')))
  })

  it('server 已登记而该 tool 未定制 → 落第 2 级「正在调用 GitHub 工具」(仍非码名,仍带 server 名)', () => {
    expect(mcpToolActivityTitle(row({ toolName: 'archive_repo' }), toolT('zh-CN'))).toBe(
      '正在调用 GitHub 工具',
    )
  })

  it('命名空间写法 mcp__github__create_issue 同样命中定制档', () => {
    expect(
      mcpToolActivityTitle(row({ toolName: 'mcp__github__create_issue' }), toolT('zh-CN')),
    ).toBe('正在创建 GitHub 议题')
  })

  it('只有 serverId 没有 serverName 时按 serverId 回落(web 同一口径,否则这一帧永远拿不到 server)', () => {
    const line = mcpToolActivityTitle(
      { toolName: 'create_issue', status: 'running', serverSource: 'mcp', serverId: 'github' },
      toolT('zh-CN'),
    )
    expect(line).toBe('正在创建 GitHub 议题')
  })

  it('en 包同样取到值(防"只有中文接上了")', () => {
    const line = mcpToolActivityTitle(row(), toolT('en'))
    expect(line).toContain('GitHub')
    expect(line ?? '').not.toContain('create_issue')
    expect(line ?? '').not.toMatch(/Activity/)
  })

  it('未登记的 server×tool → null(交回调用方既有功能名口径,不崩不吐键名)', () => {
    expect(
      mcpToolActivityTitle(
        row({ serverName: 'not_registered', toolName: 'zzz_no_such_tool' }),
        toolT('zh-CN'),
      ),
    ).toBeNull()
  })

  it('语言包整体取不到(t 原样回显键名)时不得把键名送上界面', () => {
    expect(mcpToolActivityTitle(row(), (key) => key)).toBeNull()
  })

  it('非 MCP 来源与 error / cancelled 都不归本层(对失败声称"已完成 X"是假陈述)', () => {
    const t = toolT('zh-CN')
    expect(mcpToolActivityTitle(row({ serverSource: 'builtin' }), t)).toBeNull()
    expect(mcpToolActivityTitle(row({ serverSource: 'plugin' }), t)).toBeNull()
    expect(mcpToolActivityTitle(row({ status: 'error' }), t)).toBeNull()
    expect(
      mcpToolActivityTitle(
        {
          toolName: 'create_issue',
          status: 'cancelled',
          serverSource: 'mcp',
          serverName: 'github',
        },
        t,
      ),
    ).toBeNull()
  })
})

describe('② 渲染级:真把 MCP 工具帧喂进 MessageContent,屏幕上的那一行有 server 名', () => {
  holder.t = realT('zh-CN')

  const renderTool = (toolCall: Record<string, unknown>): string => {
    const message = {
      id: 'm1',
      role: 'assistant',
      content: '回答正文',
      toolCalls: [{ id: 'call-1', args: {}, result: undefined, ...toolCall }],
    } as unknown as ComponentProps<typeof MessageContent>['message']
    return renderToStaticMarkup(<MessageContent message={message} streaming={false} />)
  }

  it('mcp × github × create_issue → 标题位是「正在创建 GitHub 议题」,不是裸码名', () => {
    const html = renderTool(row())
    expect(html).toContain('正在创建 GitHub 议题')
    expect(html).not.toContain('create_issue')
    // 裸码名是接上之前唯一的显示形态(未登记名回落 view.codeName)
    expect(html).not.toContain('>create_issue<')
  })

  it('同一工具在内置来源下仍走既有功能名口径(本票不得顺手改掉非 MCP 行的文案)', () => {
    const html = renderTool(row({ serverSource: 'builtin' }))
    expect(html).toContain('create_issue')
    expect(html).not.toContain('正在创建 GitHub 议题')
  })

  it('行标题同时进 aria-label(屏幕外用户拿到的也是这句)', () => {
    expect(renderTool(row())).toContain('aria-label="正在创建 GitHub 议题')
  })
})

describe('③ 源码反向锁:渲染点的标题链必须真的经过这个出口', () => {
  it('ToolBlockView 把 mcpToolActivityTitle 排在既有功能名之前,并保留 ?? 兜底', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync(
        new URL('../entrypoints/sidepanel/components/MessageContent.tsx', import.meta.url),
        'utf8',
      ),
    )
    expect(src).toMatch(/mcpToolActivityTitle\(\s*block,\s*tTool\s*\)\s*\?\?\s*\(/)
    // 出口被摘线(函数在、无人调)就是守门 64/70/81 那一型:整块测试仍绿而屏幕上没有
    expect(src).toMatch(/describeMcpToolActivity/)
  })
})
