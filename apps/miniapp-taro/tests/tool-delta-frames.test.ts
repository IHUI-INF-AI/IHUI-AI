// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * D113(本票):miniapp-taro 工具流中 diff 预览接线自证。
 *
 * 三层同 terminal-delta 那把尺子(见 src/pkg-ai/ai/cards/__tests__/terminal-delta.test.ts):
 *  ① 纯逻辑:applyToolDelta 的覆盖写语义(写入 / 覆盖 / 同 seq 重放幂等 / 空 id 丢弃 / 不造条目);
 *  ② 源码级接线:解析器认领 → dispatch case → 回调表 → chat.tsx 注册与 result 清除 → 渲染条件,
 *     任一环节被摘掉即红("造好没装车"是本仓最高频失效型,只测纯函数测不出断链);
 *  ③ 端到端:逐字取自 llm.py 生产者形态的真实帧,经共享 parseSSEChunk 解析后直接喂归并层。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { parseSSEChunk } from '@ihui/shared/utils/sse-parse'

import { applyToolCallStart, applyToolDelta, type ToolCallView } from '../src/pkg-ai/ai/cards/types'

const END_ROOT = join(__dirname, '..')

/** llm.py 的 _pv_evt 真实形态:type/toolCallId/seq/partialText(截断时多一个 truncated) */
const TOOL_DELTA_FRAME =
  'event: tool-delta\n' +
  'data: {"type":"tool-delta","toolCallId":"call-1","seq":1,' +
  '"partialText":"@@ -1,0 +1,1 @@\\n+const a = 1\\n"}\n\n'

const running: ToolCallView = { id: 'call-1', name: 'write_file', status: 'running' }

describe('applyToolDelta(D113 纯逻辑)', () => {
  it('按 toolCallId 覆盖式写入 partialDiff,其余字段不动', () => {
    const out = applyToolDelta([running], { toolCallId: 'call-1', partialText: '+a\n' })
    expect(out).toHaveLength(1)
    expect(out[0]?.partialDiff).toBe('+a\n')
    expect(out[0]?.status).toBe('running')
    expect(out[0]?.name).toBe('write_file')
  })

  it('累积文本整帧替换:后到的帧覆盖前一帧(不是追加),同 seq 重放逐字段幂等', () => {
    const once = applyToolDelta([running], { toolCallId: 'call-1', partialText: 'v1' })
    const twice = applyToolDelta(once, { toolCallId: 'call-1', partialText: 'v1\nv2' })
    expect(twice).toHaveLength(1)
    expect(twice[0]?.partialDiff).toBe('v1\nv2')
    const replay = applyToolDelta(twice, { toolCallId: 'call-1', partialText: 'v1\nv2' })
    expect(replay[0]).toEqual(twice[0])
  })

  it('空 toolCallId 整帧丢弃,零写入(后端 tc.get("id","") 可给出空串)', () => {
    const out = applyToolDelta([running], { toolCallId: '', partialText: '不该显示' })
    expect(out).toEqual([running])
    expect(out[0]?.partialDiff).toBeUndefined()
  })

  it('start 帧未到的 toolCallId 不凭空造条目', () => {
    const out = applyToolDelta([running], { toolCallId: 'call-9', partialText: 'x' })
    expect(out).toHaveLength(1)
    expect(out[0]?.id).toBe('call-1')
  })

  it('不同 toolCallId 互不串扰(并行多工具各显各的预览)', () => {
    const two: ToolCallView[] = [running, { id: 'call-2', name: 'file_edit', status: 'running' }]
    const out = applyToolDelta(two, { toolCallId: 'call-2', partialText: 'only-2' })
    expect(out[0]?.partialDiff).toBeUndefined()
    expect(out[1]?.partialDiff).toBe('only-2')
  })
})

describe('D113 端到端:真实帧经共享 parser 解析后可直接喂归并层', () => {
  it('parseSSEChunk(TOOL_DELTA_FRAME) → evt.toolDelta → applyToolDelta', () => {
    const { events } = parseSSEChunk(TOOL_DELTA_FRAME)
    const delta = events.find((e) => e.type === 'tool-delta')?.toolDelta
    expect(delta).toBeDefined()
    expect(delta).toMatchObject({ toolCallId: 'call-1', seq: 1 })
    const calls = applyToolDelta([running], delta!)
    expect(calls[0]?.partialDiff).toBe('@@ -1,0 +1,1 @@\n+const a = 1\n')
    // 预览文本不得混进聊天正文(与 D19-A1 同一条判据)
    expect(events.find((e) => e.type === 'chunk')).toBeUndefined()
  })
})

describe('D113 接线自证(源码级):解析 / dispatch / 回调表 / 消费点 / 渲染位缺一即红', () => {
  const parseSrc = readFileSync(
    join(END_ROOT, '../../packages/shared/src/utils/sse-parse.ts'),
    'utf8',
  )
  const apiSrc = readFileSync(join(END_ROOT, 'src/api/index.ts'), 'utf8')
  const chatSrc = readFileSync(join(END_ROOT, 'src/pkg-ai/ai/chat.tsx'), 'utf8')
  const cardsSrc = readFileSync(join(END_ROOT, 'src/pkg-ai/ai/cards/ai-cards.tsx'), 'utf8')
  const cssSrc = readFileSync(join(END_ROOT, 'src/pkg-ai/ai/cards/ai-cards.css'), 'utf8')

  it('共享解析器在兜底 content/delta/text 链**之前**认领 tool-delta(否则被喷成正文或静默丢)', () => {
    expect(parseSrc).toContain("if (json?.type === 'tool-delta') {")
    const guard = parseSrc.indexOf("if (json?.type === 'tool-delta') {")
    const fallback = parseSrc.indexOf("if (typeof json?.content === 'string')")
    expect(guard).toBeGreaterThan(-1)
    expect(fallback).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(fallback)
  })

  it('api/index.ts:dispatch 注册 tool-delta 分支 + 回调表声明 onToolDelta(不注册=静默丢帧)', () => {
    expect(apiSrc).toContain("case 'tool-delta':")
    expect(apiSrc).toMatch(/onToolDelta\?: \(evt: ToolDeltaEvent\) => void/)
    expect(apiSrc).toMatch(/callbacks\?\.onToolDelta\?\.\(evt\.toolDelta\)/)
  })

  it('api/index.ts:ToolDeltaEvent 取自 @ihui/api-client,端内不自造第二份契约', () => {
    expect(apiSrc).toMatch(/import type \{ ToolDeltaEvent \} from '@ihui\/api-client'/)
  })

  it('chat.tsx:注册 onToolDelta 并经 applyToolDelta 覆盖写;tool-result 分支清预览', () => {
    expect(chatSrc).toMatch(/onToolDelta: \(evt\) =>/)
    expect(chatSrc).toMatch(/applyToolDelta\(c\.toolCalls, evt\)/)
    expect(chatSrc).toMatch(/import \{[\s\S]*?applyToolDelta[\s\S]*?\} from '\.\/cards\/types'/)
    // 最终 diff 以 result 为准:result 落卡时必须整帧清掉 partialDiff
    expect(chatSrc).toContain('partialDiff: undefined,')
  })

  it('ai-cards.tsx:渲染条件是 running && 非空 partialDiff(完成态不得残留预览框)', () => {
    expect(cardsSrc).toMatch(/c\.status === 'running' && c\.partialDiff/)
  })

  it('ai-cards.css:预览块档位与 App 端逐档同值(11px/6dp/5dp/3dp ⇒ 22/12/10/6rpx)', () => {
    const block = cssSrc.slice(cssSrc.indexOf('.ai-card-tool-partial-diff {'))
    expect(block.slice(0, 300)).toMatch(/margin-top:\s*6rpx/)
    expect(block.slice(0, 300)).toMatch(/padding:\s*10rpx 12rpx/)
    const text = cssSrc.slice(cssSrc.indexOf('.ai-card-tool-partial-diff-text {'))
    expect(text.slice(0, 300)).toMatch(/font-size:\s*22rpx/)
    expect(text.slice(0, 300)).toMatch(/line-height:\s*32rpx/)
  })
})

describe('applyToolCallStart(D113:重复 start 帧不得抹掉流中预览)', () => {
  const evt = {
    toolCallId: 'call-1',
    toolName: 'write_file',
    serverSource: 'builtin',
    serverName: 'core',
    args: { path: 'a.ts' },
  }
  it('空列表:新建一条 running', () => {
    const out = applyToolCallStart([], evt, 1000)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: 'call-1', status: 'running', startedAt: 1000 })
  })
  it('重复 start 帧:partialDiff 原样保留(本端此前是 filter+append,会把预览抹空)', () => {
    const withPreview: ToolCallView[] = [{ ...running, partialDiff: '@@ -1 +1 @@\n+const a = 1' }]
    const out = applyToolCallStart(withPreview, evt, 2000)
    expect(out).toHaveLength(1)
    expect(out[0]?.partialDiff).toBe('@@ -1 +1 @@\n+const a = 1')
    expect(out[0]?.status).toBe('running')
    expect(out[0]?.startedAt).toBe(2000)
  })
  it('重复 start 帧不追加第二条,也不改动同卡其他工具', () => {
    const other: ToolCallView = {
      id: 'call-2',
      name: 'read_file',
      status: 'running',
      partialDiff: 'keep-me',
    }
    const out = applyToolCallStart([{ ...running }, other], evt, 3000)
    expect(out.filter((x) => x.id === 'call-1')).toHaveLength(1)
    expect(out.find((x) => x.id === 'call-2')?.partialDiff).toBe('keep-me')
  })
})

