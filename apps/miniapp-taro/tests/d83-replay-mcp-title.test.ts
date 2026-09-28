// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// D83(工具活动标题的跨端对账)· miniapp-taro **历史回放**侧的装车证明。
//
// 端上的渲染入口 `cards/tool-line.ts` 早就接上了共享层 `describeMcpToolActivity`
// (见同目录 tool-line-mcp.test.ts),但那条链在**历史回放**这一路是断的:
// `server-chat-replay.ts` 的 readToolCalls 逐字段挑着带,此前**不带** serverSource / serverName
// ⇒ 同一条工具行直播时显示「正在创建 GitHub 议题」,回放后退回裸码名。
// 这正是本仓反复登记的"链在共享层、某一格没人喂"型:渲染点判据全绿,而屏幕上没有。
//
// 三档证明:
//  ① 回放读数:落库的 serverSource / serverName 必须回到端内 ToolCallView 上;
//  ② 端到端措辞:把 ① 拿到的那一条**直接喂进本端渲染入口** toolRowTitle,
//     用真实语言包取词,断言标题字符串里真的出现 server 名 —— 只断言"函数被调用"
//     (同目录 tool-line-mcp.test.ts 的记录式 t)证明不了这一格;
//  ③ 反向对照:不带 server 字段的旧落库行形状逐字不变(既有 d20 精确等值断言不得被顶红),
//     脏 serverSource 值不得被"顺手带回来"。
import { describe, expect, it } from 'vitest'

import miniappEn from '@ihui/i18n/messages/miniapp-taro/en.json'
import miniappZhCN from '@ihui/i18n/messages/miniapp-taro/zh-CN.json'
import sharedEn from '@ihui/i18n/messages/shared/en.json'
import sharedZhCN from '@ihui/i18n/messages/shared/zh-CN.json'
import { mergeMessages, translate } from '@ihui/i18n/loader'
import type { Messages } from '@ihui/i18n/types'

import { mapServerMessage } from '@/pkg-ai/ai/server-chat-replay'
import { toolRowTitle, type TranslateFn } from '@/pkg-ai/ai/cards/tool-line'
import type { ToolCallView } from '@/pkg-ai/ai/cards/types'

// 与 apps/miniapp-taro/src/i18n/index.tsx:62 同一份合并集(shared 作 base、端包覆盖),
// 也即 `tt()` 在组件外走的同一条取词路径 —— 不写假 t。
const PACKS: Record<'zh-CN' | 'en', Messages> = {
  'zh-CN': mergeMessages(sharedZhCN as Messages, miniappZhCN as Messages),
  en: mergeMessages(sharedEn as Messages, miniappEn as Messages),
}
/** toolRowTitle 收的是端内 t(点号全路径),不是共享层的裸键 */
const endT =
  (locale: 'zh-CN' | 'en'): TranslateFn =>
  (key, params) =>
    translate(PACKS[locale], key, { fallback: PACKS['zh-CN'], params })

/** 落库一帧 → 回放后的第一条端内工具视图 */
function replayFirstToolCall(metadataToolCalls: unknown[]): ToolCallView {
  const row = mapServerMessage({
    id: 'm-1',
    conversationId: 'c-1',
    role: 'assistant',
    content: '我调用了工具',
    tokens: null,
    createdAt: '2026-09-26T00:00:00.000Z',
    metadata: { toolCalls: metadataToolCalls },
  } as never)
  const calls = row?.aiCards?.toolCalls
  if (!calls || calls.length !== 1)
    throw new Error(`回放没拿到 1 条工具行:${JSON.stringify(calls)}`)
  return calls[0] as ToolCallView
}

const PERSISTED_MCP_CALL = {
  id: 't1',
  toolName: 'create_issue',
  status: 'success',
  serverSource: 'mcp',
  serverName: 'github',
  args: {},
}

describe('① 回放读数:server 三元组必须随工具行一起回来', () => {
  it('落库 serverSource=mcp + serverName=github → 端内视图同值', () => {
    const call = replayFirstToolCall([PERSISTED_MCP_CALL])
    expect(call.serverSource).toBe('mcp')
    expect(call.serverName).toBe('github')
  })

  it('只有 serverId 没有 serverName 时按 serverId 回落(与 chat.tsx 的 live 分支同口径)', () => {
    const call = replayFirstToolCall([
      { ...PERSISTED_MCP_CALL, serverName: undefined, serverId: 'linear' },
    ])
    expect(call.serverName).toBe('linear')
  })
})

describe('② 端到端:回放出来的那一条,标题字符串里真的出现 server 名', () => {
  it('落库的 MCP 行回放后 → 「已创建 GitHub 议题」(success → completed 档)', () => {
    const title = toolRowTitle(replayFirstToolCall([PERSISTED_MCP_CALL]), endT('zh-CN'))
    expect(title).toBe('已创建 GitHub 议题')
    expect(title).toContain('GitHub')
    expect(title).not.toContain('create_issue')
    expect(title).not.toContain('toolMcp')
  })

  it('同一行 status=running → 进行中档,与完成档不同文(双时态在回放路径上也分档)', () => {
    const running = toolRowTitle(
      replayFirstToolCall([{ ...PERSISTED_MCP_CALL, status: 'running' }]),
      endT('zh-CN'),
    )
    expect(running).toBe('正在创建 GitHub 议题')
    expect(running).not.toBe(toolRowTitle(replayFirstToolCall([PERSISTED_MCP_CALL]), endT('zh-CN')))
  })

  it('server 已登记而该 tool 未定制 → 落第二级「正在调用 GitHub 工具」(仍带 server 名)', () => {
    const title = toolRowTitle(
      replayFirstToolCall([{ ...PERSISTED_MCP_CALL, toolName: 'archive_repo', status: 'running' }]),
      endT('zh-CN'),
    )
    expect(title).toBe('正在调用 GitHub 工具')
  })

  it('en 包同样取到值(防"只有中文在回放路径上接上了")', () => {
    const title = toolRowTitle(replayFirstToolCall([PERSISTED_MCP_CALL]), endT('en'))
    expect(title).toContain('GitHub')
    expect(title).not.toContain('create_issue')
  })
})

describe('③ 反向对照:不该动的一个字节都不动', () => {
  it('旧落库行(无 server 字段)→ 端内视图形状逐字不变(不新增 undefined 占位键)', () => {
    const row = mapServerMessage({
      id: 'm-1',
      conversationId: 'c-1',
      role: 'assistant',
      content: '我读了文件',
      tokens: null,
      createdAt: '2026-09-20T00:00:00.000Z',
      metadata: {
        toolCalls: [
          {
            id: 't1',
            toolName: 'read_file',
            args: { path: 'a.ts' },
            result: 'ok',
            status: 'success',
            durationMs: 12,
          },
        ],
      },
    } as never)
    expect(row?.aiCards?.toolCalls).toEqual([
      {
        id: 't1',
        name: 'read_file',
        status: 'done',
        durationMs: 12,
        args: { path: 'a.ts' },
        result: 'ok',
      },
    ])
  })

  it('脏 serverSource 值不得被带回来(它会让 MCP 判据与角标同时读到假来源)', () => {
    const call = replayFirstToolCall([{ ...PERSISTED_MCP_CALL, serverSource: 'evil' }])
    expect(call.serverSource).toBeUndefined()
    expect('serverSource' in call).toBe(false)
    const title = toolRowTitle(call, endT('zh-CN'))
    expect(title).not.toContain('toolMcp')
    expect(title).not.toBe('')
  })

  it('链尾兜底:未登记的 server×tool 仍出非空标题(activityTool 句式带原始名)', () => {
    const title = toolRowTitle(
      replayFirstToolCall([
        {
          id: 't9',
          toolName: 'nope_tool',
          status: 'success',
          serverSource: 'mcp',
          serverName: 'demo',
        },
      ]),
      endT('zh-CN'),
    )
    expect(title).toBe('调用 nope_tool')
  })
})
