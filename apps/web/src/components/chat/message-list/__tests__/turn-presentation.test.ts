// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 轮次呈现投影层单测(2026-10-29,对标 Qoder CN 0.4.11 第六层)。
 *
 * 成对夹具纪律(本仓硬要求,判据必须有牙):
 *  - `isExploring` 必须成对:探索型(读文件/搜索/列目录)⇒ true;思考/生成/命令/已结束 ⇒ false。
 *    只有正向一组时,"判据恒真"也能全绿 —— 这是本仓记过最多次的假绿形态。
 *  - 投影缓存必须成对:同输入两次调用 ⇒ 同一引用;输入只变最后一行 ⇒ 该行新引用,
 *    前缀行引用逐格不变(否则 React 每帧整表重渲染,`presentationStructureRevision` 就是摆设)。
 *
 * 判据不许复制(§0.6):本文件的断言只引用生产导出,不复制类目表、不复制工具名名单。
 */

import { describe, it, expect } from 'vitest'
import type { ChatMessage, ToolCall } from '@/stores/chat'
import {
  EXPLORING_CATEGORY_KEYS,
  buildActivityGroupRow,
  buildPresentationRows,
  createPresentationCache,
  currentActivityIsExploring,
  groupTurns,
  isExploringActivity,
  shouldAggregateAssistantRun,
  type ActivityGroupRow,
  type MessageRow,
  type ThinkingAgentRow,
} from '@/components/chat/message-list/turn-presentation'

let seq = 0
function tool(toolName: string, status: ToolCall['status'] = 'running'): ToolCall {
  seq += 1
  return { id: `tc-${seq}`, toolName, status, args: {} }
}

function userMsg(id: string, content = 'hi'): ChatMessage {
  return { id, role: 'user', content, createdAt: 1 }
}

function assistantMsg(id: string, patch: Partial<ChatMessage> = {}): ChatMessage {
  return { id, role: 'assistant', content: 'ok', createdAt: 2, ...patch }
}

function rowTypes(rows: readonly { type: string }[]): string[] {
  return rows.map((r) => r.type)
}

// ─── isExploring 语义位(成对)───────────────────────────────────────────

describe('isExploring 语义位 · 成对判据(探索 vs 非探索)', () => {
  it('探索型工具(读文件 / 列目录 / 代码检索 / 网页检索)⇒ true', () => {
    const exploringTools = ['read_file', 'list_dir', 'search_codebase', 'grep', 'web_search']
    for (const name of exploringTools) {
      expect(isExploringActivity(tool(name))).toBe(true)
    }
  })

  it('非探索型(生图 / 思考 / 命令 / 写文件)⇒ false', () => {
    const nonExploringTools = ['image_gen', 'think', 'run_command', 'write_file', 'edit_file']
    for (const name of nonExploringTools) {
      expect(isExploringActivity(tool(name))).toBe(false)
    }
  })

  it('语义收在现在时:最后一条是已完成/失败的读取 ⇒ false(不把完成态渲染成"探索中")', () => {
    expect(currentActivityIsExploring([tool('read_file', 'running')])).toBe(true)
    expect(currentActivityIsExploring([tool('read_file', 'success')])).toBe(false)
    expect(currentActivityIsExploring([tool('read_file', 'error')])).toBe(false)
    expect(currentActivityIsExploring([tool('read_file', 'cancelled')])).toBe(false)
  })

  it('取时序最后一条:读文件 → 生图(运行中)⇒ false;生图 → 读文件(运行中)⇒ true', () => {
    expect(currentActivityIsExploring([tool('read_file'), tool('image_gen')])).toBe(false)
    expect(currentActivityIsExploring([tool('image_gen'), tool('read_file')])).toBe(true)
  })

  it('空组 ⇒ false(不臆造)', () => {
    expect(currentActivityIsExploring([])).toBe(false)
  })

  it('类目集只含类目键,零工具名字面量(新增工具只改 tool-category.ts 一处)', () => {
    expect([...EXPLORING_CATEGORY_KEYS]).toEqual(['file_read', 'file_search', 'web_search'])
    // 反向:思考类目绝不在探索族里 —— 这正是"两种动效两种文案"的立因
    expect(EXPLORING_CATEGORY_KEYS).not.toContain('thinking')
    expect(EXPLORING_CATEGORY_KEYS).not.toContain('preview')
  })
})

// ─── 行类型判别联合 ─────────────────────────────────────────────────────

describe('投影行语义分级(message / thinkingAgent / activity-group)', () => {
  it('用户消息独占一行,不被聚合', () => {
    const rows = buildPresentationRows([userMsg('u1'), assistantMsg('a1', { content: '答案' })])
    expect(rowTypes(rows)).toEqual(['message', 'message'])
    const first = rows[0] as MessageRow
    expect(first.type).toBe('message')
    expect(first.role).toBe('user')
    expect(first.turnId).toBe('u1')
  })

  it('单条带工具的助手消息 ⇒ thinkingAgent 容器 + activity-group 子行', () => {
    const rows = buildPresentationRows([
      userMsg('u1'),
      assistantMsg('a1', { toolCalls: [tool('read_file'), tool('grep')] }),
    ])
    expect(rowTypes(rows)).toEqual(['message', 'thinkingAgent', 'activity-group'])
    const container = rows[1] as ThinkingAgentRow
    expect(container.id).toBe('thinking-agent:u1:0')
    expect(container.messages.map((m) => m.id)).toEqual(['a1'])
    const group = rows[2] as ActivityGroupRow
    expect(group.type).toBe('activity-group')
    expect(group.messageId).toBe('a1')
    expect(group.parts).toHaveLength(2)
    expect(group.startIndex).toBe(0)
    expect(group.endIndex).toBe(1)
    expect(container.activityIds).toEqual([group.id])
  })

  it('单条纯答案(无中间过程)不套容器(避免每条回答多一层空壳)', () => {
    expect(shouldAggregateAssistantRun([assistantMsg('a1', { content: '直接答案' })])).toBe(false)
    const rows = buildPresentationRows([userMsg('u1'), assistantMsg('a1', { content: '直接答案' })])
    expect(rowTypes(rows)).toEqual(['message', 'message'])
  })

  it('失败轮不可聚合(重试/交接单/额度动作是入口,不能被收进容器)', () => {
    const failed = assistantMsg('a1', { error: true, toolCalls: [tool('read_file')] })
    expect(shouldAggregateAssistantRun([failed])).toBe(false)
    const rows = buildPresentationRows([userMsg('u1'), failed])
    expect(rowTypes(rows)).toEqual(['message', 'message'])
  })

  it('同一轮内多条助手消息聚进同一容器(轮次内的连续动作)', () => {
    const rows = buildPresentationRows([
      userMsg('u1'),
      assistantMsg('a1', { toolCalls: [tool('read_file')] }),
      assistantMsg('a2', { content: '' }),
      assistantMsg('a3', { toolCalls: [tool('web_search')] }),
    ])
    expect(rowTypes(rows)).toEqual(['message', 'thinkingAgent', 'activity-group', 'activity-group'])
    const container = rows[1] as ThinkingAgentRow
    expect(container.messages.map((m) => m.id)).toEqual(['a1', 'a2', 'a3'])
    expect(container.activityIds).toHaveLength(2)
    // 无工具消息不产 activity-group(不造空组)
    expect(container.activityIds).not.toContain('activity:a2:0')
  })

  it('前导助手消息(历史截断/回放)自成一轮,轮次 id 取首条消息 id', () => {
    const turns = groupTurns([
      assistantMsg('a0', { toolCalls: [tool('read_file')] }),
      userMsg('u1'),
    ])
    expect(turns).toHaveLength(2)
    expect(turns[0]?.turnId).toBe('a0')
    expect(turns[1]?.turnId).toBe('u1')
  })

  it('工具摘要与活动序一律来自既有源,本层零复算', () => {
    const rows = buildPresentationRows([
      userMsg('u1'),
      assistantMsg('a1', { toolCalls: [tool('read_file'), tool('image_gen'), tool('read_file')] }),
    ])
    const group = rows[2] as ActivityGroupRow
    // 共享层 summarizeToolActivity 的形状:total / running / failed / byCategory(五类)
    expect(group.toolsSummary.total).toBe(3)
    expect(group.toolsSummary.running).toBe(3)
    // 共享层对象维度类目:read_file 落 file 族(两次);image_gen 未在其 IMAGE_TOOLS 白名单内
    // ⇒ 由共享层落 custom —— 本层不干预、也不另判(这里断言的是"取的是共享层的答案")
    expect(group.toolsSummary.byCategory.file).toBe(2)
    expect(group.toolsSummary.byCategory.custom).toBe(1)
    // activityOrder 逐 part 保留时序(不去重):read_file 落 file_read 类目
    expect(group.activityOrder).toHaveLength(3)
    expect(group.activityOrder[0]).toBe('file_read')
  })

  it('buildActivityGroupRow 对无工具消息返回 null(不造空组)', () => {
    expect(buildActivityGroupRow(assistantMsg('a1'), 'u1')).toBeNull()
  })

  it('容器层 isExploring 取本轮最后一条带工具消息的当前动作', () => {
    const exploringRows = buildPresentationRows([
      userMsg('u1'),
      assistantMsg('a1', { toolCalls: [tool('image_gen')] }),
      assistantMsg('a2', { toolCalls: [tool('read_file')] }),
    ])
    expect((exploringRows[1] as ThinkingAgentRow).isExploring).toBe(true)

    const thinkingRows = buildPresentationRows([
      userMsg('u1'),
      assistantMsg('a1', { toolCalls: [tool('think')] }),
    ])
    expect((thinkingRows[1] as ThinkingAgentRow).isExploring).toBe(false)
  })
})

// ─── 投影缓存 + 版本号(成对)────────────────────────────────────────────

describe('投影缓存 · 引用复用与版本号', () => {
  it('同一输入两次调用 ⇒ 同一引用(整份 projection 与 rows 都是同一份)', () => {
    const cache = createPresentationCache()
    const messages = [userMsg('u1'), assistantMsg('a1', { toolCalls: [tool('read_file')] })]
    const first = cache.project(messages)
    const second = cache.project(messages)
    expect(second).toBe(first)
    expect(second.rows).toBe(first.rows)
    expect(second.presentationStructureRevision).toBe(first.presentationStructureRevision)
  })

  it('同一数组引用(不同调用) ⇒ 同一引用', () => {
    const cache = createPresentationCache()
    const messages: ChatMessage[] = [
      userMsg('u1'),
      assistantMsg('a1', { toolCalls: [tool('grep')] }),
    ]
    const first = cache.project(messages)
    // 数组内容/引用都没换 ⇒ 命中最快路径
    const again = cache.project(messages)
    expect(again).toBe(first)
  })

  it('输入只变最后一行 ⇒ 该行新引用、前缀行引用逐格不变(流式每帧只重算最后一行)', () => {
    const cache = createPresentationCache()
    const u1 = userMsg('u1')
    const a1 = assistantMsg('a1', { toolCalls: [tool('read_file')] })
    const u2 = userMsg('u2')
    const a2 = assistantMsg('a2', { toolCalls: [tool('grep')], content: '' })
    const before = cache.project([u1, a1, u2, a2])

    // 行序:message(u1) / thinkingAgent / activity(a1) / message(u2) / thinkingAgent / activity(a2)
    expect(rowTypes(before.rows)).toEqual([
      'message',
      'thinkingAgent',
      'activity-group',
      'message',
      'thinkingAgent',
      'activity-group',
    ])

    // 模拟流式 appendToMessage:只替换最后一条消息对象,其余引用不动
    const a2Next = { ...a2, content: 'ok' }
    const after = cache.project([u1, a1, u2, a2Next])

    expect(after).not.toBe(before)
    expect(after.presentationStructureRevision).toBeGreaterThan(
      before.presentationStructureRevision,
    )

    // 前缀各行(到 message(u2) 为止)逐格引用不变
    for (let i = 0; i < 4; i += 1) {
      expect(after.rows[i]).toBe(before.rows[i])
    }
    // 最后一段的两行(u2 之后的容器与活动组)是新引用
    expect(after.rows[4]).not.toBe(before.rows[4])
    expect(after.rows[5]).not.toBe(before.rows[5])
    // 统计口径:只重算最后一段(容器 + 活动组 = 2 行),前 4 行复用
    expect(after.stats.recomputedRows).toBe(2)
    expect(after.stats.reusedRows).toBe(4)
  })

  it('输入变中间一段 ⇒ 只有那一段重算,前后段引用都不动(复用粒度是段,不是"只认尾巴")', () => {
    const cache = createPresentationCache()
    const u1 = userMsg('u1')
    const a1 = assistantMsg('a1', { toolCalls: [tool('read_file')] })
    const u2 = userMsg('u2')
    const a2 = assistantMsg('a2', { content: 'answer' })
    const before = cache.project([u1, a1, u2, a2])
    expect(rowTypes(before.rows)).toEqual([
      'message',
      'thinkingAgent',
      'activity-group',
      'message',
      'message',
    ])

    const a1Next = { ...a1, toolCalls: [tool('read_file'), tool('grep')] }
    const after = cache.project([u1, a1Next, u2, a2])

    // 第一段(u1)未变 ⇒ 引用保持
    expect(after.rows[0]).toBe(before.rows[0])
    // 第二段(容器 + 活动组)变了 ⇒ 新引用
    expect(after.rows[1]).not.toBe(before.rows[1])
    expect(after.rows[2]).not.toBe(before.rows[2])
    // 后两段(u2 消息 + a2 消息)源引用未变 ⇒ 逐格复用
    expect(after.rows[3]).toBe(before.rows[3])
    expect(after.rows[4]).toBe(before.rows[4])
    expect(after.stats.recomputedRows).toBe(2)
    expect(after.stats.reusedRows).toBe(3)
  })

  it('版本号只在结构真的变了才前进;原样重投影不前进', () => {
    const cache = createPresentationCache()
    const u1 = userMsg('u1')
    const a1 = assistantMsg('a1', { content: 'x' })
    const p1 = cache.project([u1, a1])
    const p2 = cache.project([u1, a1])
    expect(p2.presentationStructureRevision).toBe(p1.presentationStructureRevision)

    const p3 = cache.project([u1, a1, userMsg('u2')])
    expect(p3.presentationStructureRevision).toBe(p1.presentationStructureRevision + 1)
  })

  it('消息被删/被换 ⇒ 不误复用(行集合确实变了)', () => {
    const cache = createPresentationCache()
    const u1 = userMsg('u1')
    const a1 = assistantMsg('a1', { toolCalls: [tool('read_file')] })
    const before = cache.project([u1, a1])
    const after = cache.project([u1])
    expect(after.rows).toHaveLength(1)
    expect((after.rows[0] as MessageRow).message.id).toBe('u1')
    expect(after.presentationStructureRevision).toBeGreaterThan(
      before.presentationStructureRevision,
    )
  })

  it('peek 在投影前为 null,投影后可读;reset 后回到初始态(版本号从 1 重新起算)', () => {
    const cache = createPresentationCache()
    expect(cache.peek()).toBeNull()
    const p = cache.project([userMsg('u1')])
    expect(cache.peek()).toBe(p)
    cache.reset()
    expect(cache.peek()).toBeNull()
    const fresh = cache.project([userMsg('u1')])
    // reset 把计数器归零,首次投影即第一次结构变更 ⇒ 1(而不是接着旧计数往上爬)
    expect(fresh.presentationStructureRevision).toBe(1)
  })

  it('缓存版结果与无缓存纯函数逐行等值(缓存不改语义)', () => {
    const cache = createPresentationCache()
    const messages = [
      userMsg('u1'),
      assistantMsg('a1', { toolCalls: [tool('read_file')] }),
      assistantMsg('a2', { content: '结论' }),
      userMsg('u2'),
      assistantMsg('a3', { error: true, toolCalls: [tool('grep')] }),
    ]
    const cached = cache.project(messages)
    const plain = buildPresentationRows(messages)
    expect(cached.rows.map((r) => r.id)).toEqual(plain.map((r) => r.id))
    expect(cached.rows.map((r) => r.type)).toEqual(plain.map((r) => r.type))
  })

  it('容器序号按轮重置:两轮都产容器时,缓存版与纯函数的行 id 仍逐行等值', () => {
    // 2026-10-29 回归:缓存层此前把容器序号跨轮**全局累加**(第二轮成了 `:1`),
    // 而 `buildTurnRows` 每轮从 0 起算 ⇒ 同一份输入两条路径给出不同 id。
    // 上一条等值断言的夹具里第二轮助手消息恰是失败轮(不产容器)⇒ 序号没机会漂,
    // 于是它是假绿。本条把"两轮都产容器"这个形态补上。
    const cache = createPresentationCache()
    const messages = [
      userMsg('u1'),
      assistantMsg('a1', { toolCalls: [tool('read_file')] }),
      assistantMsg('a2', { toolCalls: [tool('grep')] }),
      userMsg('u2'),
      assistantMsg('a3', { toolCalls: [tool('web_search')] }),
      assistantMsg('a4', { toolCalls: [tool('think')] }),
    ]
    const cached = cache.project(messages)
    const plain = buildPresentationRows(messages)
    expect(cached.rows.map((r) => r.id)).toEqual(plain.map((r) => r.id))
    // 显式点名两个容器 id:不夹带"两轮共用同一序号"的漂移
    const containerIds = cached.rows.filter((r) => r.type === 'thinkingAgent').map((r) => r.id)
    expect(containerIds).toEqual(['thinking-agent:u1:0', 'thinking-agent:u2:0'])
  })

  it('缓存版与纯函数的**行引用**在纯函数侧不可能相同,但行内容逐字段等值(语义等价)', () => {
    const cache = createPresentationCache()
    const messages = [
      userMsg('u1'),
      assistantMsg('a1', { toolCalls: [tool('read_file')] }),
      userMsg('u2'),
      assistantMsg('a2', { toolCalls: [tool('think')] }),
    ]
    const cached = cache.project(messages)
    const plain = buildPresentationRows(messages)
    // 逐行结构与派生量等值(引用本就该不同 —— 两条路径各自构造)
    expect(cached.rows.map((r) => r.turnId)).toEqual(plain.map((r) => r.turnId))
    expect(cached.rows.map((r) => (r.type === 'thinkingAgent' ? r.isExploring : null))).toEqual(
      plain.map((r) => (r.type === 'thinkingAgent' ? r.isExploring : null)),
    )
    expect(cached.rows.map((r) => (r.type === 'activity-group' ? r.activityOrder : null))).toEqual(
      plain.map((r) => (r.type === 'activity-group' ? r.activityOrder : null)),
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
