// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * D113(本票):extension 工具流中 diff 预览接线自证。
 *
 * 三层与小程序那一把尺子同形(见 `apps/miniapp-taro/tests/tool-delta-frames.test.ts`):
 *  ① 纯逻辑:applyToolDelta 覆盖写语义 + applyToolCallStart 的重复帧保预览语义;
 *  ② 端到端:逐字取自 llm.py 生产者形态的真实帧,经共享 parseSSEChunk 解析后直接喂归并层;
 *  ③ 源码级接线:解析开关 → dispatch 分支 → 端内回调注册 → result 清除 → 投影 → 渲染条件,
 *     任一环节被摘掉即红("造好没装车"是本仓最高频失效型,只测纯函数测不出断链)。
 *
 * 立项与结论(用户决策 2026-09-27「开通,扩展也要流中预览」→ 实测后收回):第 ④ 组原本要钉
 * "扩展必须真的把文件族带进请求",落地前逐条量了执行面,结论相反 —— 服务端对话链的
 * `__user_role` 恒为 0,而 `write_file`/`file_edit` 属 `_ADMIN_ONLY_TOOLS`;本端又不送
 * `workspace_context`,委托分支(`llm.py` 的 `if req.workspace_context and … in _FS_DEPENDENT_TOOLS`)
 * 结构上不成立 ⇒ 带过去只会出现"先给一条流中 diff、再报权限失败"的承诺落空画面;而只读族会在
 * **服务端**工作区上执行,那是越权面变更。所以本端不带文件族,第 ④ 组改钉"不带"并锁住理由。
 * 客户端管线(① ② ③)保留且必须绿:委托面到位之日就是它生效之时,而"帧到本端没人接"才是本仓最贵的一型。
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { parseSSEChunk } from '@ihui/shared/utils/sse-parse'
import type { ToolCall } from '@ihui/types/chat'

import { applyToolCallStart, applyToolDelta } from '../lib/tool-call-frames'
import { toolsForChatRequest } from '../lib/ui-control-tools'

const END_ROOT = join(__dirname, '..')
/** tests → extension → apps → 仓库根:少算一层不是判红而是 ENOENT,所以根要当场验
 *  一枚只存在于根的文件(本票第一次跑就少算了一层,红得毫无信息量)。 */
const REPO_ROOT = resolve(__dirname, '../../..')
if (!existsSync(join(REPO_ROOT, 'pnpm-workspace.yaml'))) {
  throw new Error(`REPO_ROOT 解析异常:${REPO_ROOT} 下没有 pnpm-workspace.yaml ⇒ 相对层数写错`)
}

/** llm.py 的 _pv_evt 真实形态:type/toolCallId/seq/partialText(截断时多一个 truncated) */
const TOOL_DELTA_FRAME =
  'event: tool-delta\n' +
  'data: {"type":"tool-delta","toolCallId":"call-1","seq":1,' +
  '"partialText":"@@ -1,0 +1,1 @@\\n+const a = 1\\n"}\n\n'

const running: ToolCall = {
  id: 'call-1',
  toolName: 'write_file',
  args: { path: 'a.ts' },
  status: 'running',
}

describe('applyToolDelta(D113 纯逻辑)', () => {
  it('按 toolCallId 覆盖式写入 partialDiff,其余字段不动', () => {
    const next = applyToolDelta([running], { toolCallId: 'call-1', partialText: 'v1' })
    expect(next[0]).toEqual({ ...running, partialDiff: 'v1' })
  })

  it('累积文本整帧替换(不是追加),同 seq 重放逐字段幂等', () => {
    const once = applyToolDelta([running], { toolCallId: 'call-1', partialText: 'line1' })
    const twice = applyToolDelta(once, { toolCallId: 'call-1', partialText: 'line1\nline2' })
    expect(twice[0]?.partialDiff).toBe('line1\nline2')
    expect(applyToolDelta(twice, { toolCallId: 'call-1', partialText: 'line1\nline2' })).toEqual(
      twice,
    )
  })

  it('空 toolCallId 整帧丢弃,零写入(后端 tc.get("id","") 可给出空串)', () => {
    expect(applyToolDelta([running], { toolCallId: '', partialText: 'x' })).toEqual([running])
  })

  it('start 帧未到的 toolCallId 不凭空造条目', () => {
    expect(applyToolDelta([], { toolCallId: 'ghost', partialText: 'x' })).toEqual([])
  })

  it('不同 toolCallId 互不串扰(并行多工具各显各的预览)', () => {
    const other: ToolCall = { id: 'call-2', toolName: 'read_file', args: {}, status: 'running' }
    const next = applyToolDelta([running, other], { toolCallId: 'call-1', partialText: 'v' })
    expect(next[0]?.partialDiff).toBe('v')
    expect(next).toHaveLength(2)
    expect(next[1]?.partialDiff).toBeUndefined()
  })
})

describe('applyToolCallStart(D113:重复 start 帧不得抹掉流中预览)', () => {
  const evt = { toolCallId: 'call-1', toolName: 'write_file', args: { path: 'a.ts' } }

  it('空列表:新建一条 running', () => {
    expect(applyToolCallStart([], evt)).toEqual([
      { ...running, serverSource: undefined, serverId: undefined, serverName: undefined },
    ])
  })

  it('重复 start 帧:partialDiff 原样保留(本端此前是 ...list + 新条目,会把预览抹空)', () => {
    const withPreview = applyToolDelta([running], {
      toolCallId: 'call-1',
      partialText: 'partial',
    })
    const next = applyToolCallStart(withPreview, evt)
    expect(next).toHaveLength(1)
    expect(next[0]?.partialDiff).toBe('partial')
    expect(next[0]?.status).toBe('running')
  })

  it('重复 start 帧不追加第二条,也不改动同卡其他工具', () => {
    const other: ToolCall = { id: 'call-2', toolName: 'read_file', args: {}, status: 'success' }
    const next = applyToolCallStart([other, running], evt)
    expect(next.map((c) => c.id)).toEqual(['call-2', 'call-1'])
  })
})

describe('D113 端到端:真实帧经共享 parser 解析后可直接喂归并层', () => {
  it('parseSSEChunk(TOOL_DELTA_FRAME) → events → applyToolDelta', () => {
    const { events } = parseSSEChunk(TOOL_DELTA_FRAME)
    const delta = events.find((e) => e.type === 'tool-delta')?.toolDelta
    expect(delta).toBeDefined()
    expect(delta).toMatchObject({ toolCallId: 'call-1', seq: 1 })
    const merged = applyToolDelta([running], delta!)
    expect(merged[0]?.partialDiff).toBe('@@ -1,0 +1,1 @@\n+const a = 1\n')
    // 预览文本不得混进聊天正文(与小程序那把尺子同一条判据,也是 D19-A1 的口径)
    expect(events.find((e) => e.type === 'chunk')).toBeUndefined()
  })
})

describe('D113 能力面:扩展会话刻意不带文件族工具(带过去必然执行失败)', () => {
  /** prettier 会把长 import 折行 —— 形状锁必须比归一化后的文本(本仓记过多次) */
  const flat = (s: string) => s.replace(/\s+/g, ' ')

  it('操控+改文件混合话术 ⇒ UI 族照常带,文件族一个不带(不带≠整族关掉)', () => {
    // 这条刻意用混合句:只测"普通问答不带宽具"会是空集恒真,那等于没判
    const tools = toolsForChatRequest('打开设置页面,帮我修改 src/a.ts 文件的代码逻辑')
    const FILE_FAMILY =
      /(^|_)(read|write|edit|create|delete|move)_?file|file_(search|edit)|search_codebase|analyze_code|list_files/
    expect(tools.some((n) => n.startsWith('ext_ui_') || n.startsWith('api_'))).toBe(true)
    expect(tools.filter((n) => FILE_FAMILY.test(n))).toEqual([])
  })

  it('端内不得 import 那份策略,也不得自写第二份正则(补回 import = 塞进两个必败工具)', () => {
    const src = readFileSync(join(END_ROOT, 'lib/ui-control-tools.ts'), 'utf8')
    expect(flat(src)).not.toContain("from '@ihui/shared/chat/file-tool-intent'")
    expect(src).not.toMatch(/FILE_(READ|WRITE)_INTENT_RE\s*=\s*\//)
    // 而"为什么不带"必须写在文件里 —— 没有理由的排除,下一个人一定会"顺手补回来"
    expect(flat(src)).toContain('_ADMIN_ONLY_TOOLS')
    expect(flat(src)).toContain('workspace_context')
  })
})

describe('D113 接线自证(源码级):解析 / dispatch / 注册 / 清除 / 投影 / 渲染缺一即红', () => {
  const client = readFileSync(join(REPO_ROOT, 'packages/api-client/src/client.ts'), 'utf8')
  const page = readFileSync(join(END_ROOT, 'entrypoints/sidepanel/pages/ChatPage.tsx'), 'utf8')
  const renderModel = readFileSync(
    join(REPO_ROOT, 'packages/shared/src/chat/render-model.ts'),
    'utf8',
  )
  const card = readFileSync(
    join(END_ROOT, 'entrypoints/sidepanel/components/MessageContent.tsx'),
    'utf8',
  )

  it('api-client:注册才解析(开关在)且 dispatch 有 tool-delta 分支', () => {
    expect(client).toMatch(/const hasToolDelta = typeof opts\.onToolDelta === 'function'/)
    expect(client).toMatch(/case 'tool-delta':/)
  })

  it('ChatPage:回调表里真出现 onToolDelta 并调用 applyToolDelta(不注册=静默丢帧)', () => {
    expect(page).toMatch(/onToolDelta:\s*\(event\)\s*=>\s*\{[\s\S]{0,200}?applyToolDelta\(/)
  })

  it('ChatPage:start 走 applyToolCallStart、result 分支清 partialDiff', () => {
    expect(page).toMatch(/toolCalls:\s*applyToolCallStart\(/)
    expect(page).toMatch(/partialDiff:\s*undefined,/)
  })

  it('共享投影层:ToolRenderBlock 带 partialDiff 且由 call.partialDiff 喂入', () => {
    expect(renderModel).toMatch(/partialDiff\?:\s*string/)
    expect(renderModel).toMatch(/partialDiff:\s*call\.partialDiff,/)
  })

  it('渲染条件是 running && 非空 partialDiff(完成态不得残留预览框)', () => {
    expect(card).toMatch(/block\.status === 'running' && block\.partialDiff/)
    expect(card).toContain('data-testid="tool-call-partial-diff"')
  })
})
