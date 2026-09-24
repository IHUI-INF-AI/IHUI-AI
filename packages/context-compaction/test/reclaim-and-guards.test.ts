// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 旧工具结果回收(reclaim)+ 三道有效性守卫的单测。
//
// 三条"反向对照"是本文件的重点(每条都用一对正反断言把判据钉住,
// 避免判据失效时测试仍然绿):
//   1. 收益不足 **不改写**(below-min-benefit 必须原样返回同一数组引用)
//   2. 溢出丢弃 **不截断 tool_call/tool_result 配对**(并用"故意截断必被检出"证明探针有效)
//   3. 熔断 **在第三次** 才触发(第二次必须仍未熔断,否则判据被放宽成一次即熔断也测不出)

import { describe, expect, it } from 'vitest'

import {
  ENVELOPE_CLOSE_MARKER,
  ENVELOPE_OPEN_MARKER,
  ENVELOPE_PREVIEW_FOOTER,
  NON_RECLAIMABLE_EDIT_TOOLS,
  RECLAIM_MIN_RESULT_TOKENS,
  RECLAIM_PLACEHOLDER,
  RefillBreaker,
  buildRefillDiagnostic,
  findOrphanToolMessages,
  hasMultimodalBlock,
  isEnvelopeContent,
  reclaimStaleToolResults,
  reverifyContextAfterCompaction,
  retryAfterOverflowDrop,
  splitAssistantRounds,
  type ChatMessage,
} from '../src/index.js'

/** ~10 tokens/次的英文句子,拼体积用(取值只影响断言里的相对量,不锚定绝对值) */
function filler(times: number): string {
  return 'The quick brown fox jumps over the lazy dog. '.repeat(times)
}

/** OpenAI 形态的一轮:assistant(tool_calls) + 对应 tool 结果 */
function toolRound(name: string, id: string, body: string): ChatMessage[] {
  return [
    {
      role: 'assistant',
      content: `调用 ${name}`,
      tool_calls: [{ id, type: 'function', function: { name, arguments: '{}' } }],
    },
    { role: 'tool', content: body, tool_call_id: id },
  ]
}

/** IHUI 内嵌形态的一轮:assistant 文本 + user 消息里的 [工具结果 ✓] 分段 */
function embeddedRound(parts: string[]): ChatMessage[] {
  return [
    { role: 'assistant', content: '我来查一下' },
    { role: 'user', content: parts.join('\n\n') },
  ]
}

function embeddedChunk(name: string, body: string, status: '✓' | '✗' = '✓'): string {
  return `[工具结果 ${status}] ${name}\n${body}`
}

describe('reclaim(零模型请求的旧工具结果回收)', () => {
  it('完全不请求模型:同步返回,不产生 Promise,且不需要任何 sampler/provider 配置', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      ...toolRound('read_file', 'a1', filler(50)),
      ...toolRound('run_command', 'a2', filler(50)),
      ...toolRound('grep', 'a3', filler(50)),
      ...toolRound('read_file', 'a4', filler(50)),
      { role: 'user', content: '继续' },
    ]
    const out = reclaimStaleToolResults(messages, { contextLimit: 1000 })
    expect(out).not.toBeInstanceOf(Promise)
    expect(out.applied).toBe(true)
    expect(out.reason).toBe('applied')
  })

  it('双触发之一:占窗口比例达阈值即回收(与是否空闲无关)', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      ...toolRound('read_file', 'b1', filler(50)),
      ...toolRound('run_command', 'b2', filler(50)),
      ...toolRound('grep', 'b3', filler(50)),
      ...toolRound('read_file', 'b4', filler(50)),
      { role: 'user', content: '继续' },
    ]
    const out = reclaimStaleToolResults(messages, {
      contextLimit: 1000,
      nowMs: 1_700_000_000_000,
      lastActivityAtMs: 1_700_000_000_000, // 空闲 0ms:只有比例触发能成立
    })
    expect(out.trigger).toBe('window-ratio')
    expect(out.applied).toBe(true)
    expect(out.savedTokens).toBeGreaterThan(0)
  })

  it('双触发之二:会话空闲达时长即回收(此时占比远低于阈值)', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      ...toolRound('read_file', 'c1', filler(50)),
      ...toolRound('run_command', 'c2', filler(50)),
      ...toolRound('grep', 'c3', filler(50)),
      ...toolRound('read_file', 'c4', filler(50)),
      { role: 'user', content: '继续' },
    ]
    const out = reclaimStaleToolResults(messages, {
      contextLimit: 500_000, // 占比 ~0.004,比例触发不成立
      nowMs: 2_000_000,
      lastActivityAtMs: 0, // 空闲 2000s > 120s
    })
    expect(out.usageRatio).toBeLessThan(0.1)
    expect(out.trigger).toBe('idle')
    expect(out.applied).toBe(true)
  })

  it('两个触发都不满足时不改写(not-triggered)', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      ...toolRound('read_file', 'd1', filler(50)),
      ...toolRound('run_command', 'd2', filler(50)),
      ...toolRound('grep', 'd3', filler(50)),
      { role: 'user', content: '继续' },
    ]
    const out = reclaimStaleToolResults(messages, {
      contextLimit: 500_000,
      nowMs: 10_000,
      lastActivityAtMs: 0, // 空闲 10s < 120s
    })
    expect(out.reason).toBe('not-triggered')
    expect(out.messages).toBe(messages)
    expect(out.savedTokens).toBe(0)
  })

  it('最近 N 轮整轮保护:刚产出的结果一个字都不动', () => {
    const fresh = filler(50)
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      ...toolRound('read_file', 'e0', filler(50)),
      ...toolRound('run_command', 'e1', filler(50)),
      ...toolRound('grep', 'e2', filler(50)),
      ...toolRound('read_file', 'e3', fresh),
      { role: 'user', content: '继续' },
    ]
    const out = reclaimStaleToolResults(messages, {
      contextLimit: 1000,
      keepRecentRounds: 3,
      minSavedTokens: 1, // 绕开收益门槛,单独验轮次保护
    })
    expect(out.applied).toBe(true)
    expect(out.reclaimedCount).toBe(2) // 5 轮里只有最老 2 轮在范围内
    // 最近一轮(e3)的正文仍是原文
    expect(out.messages.some((m) => m.content === fresh)).toBe(true)
  })

  it('白名单是显式清单:非名单工具(如 todo_write)不回收', () => {
    const body = filler(60)
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      ...toolRound('todo_write', 'f1', body),
      ...toolRound('read_file', 'f2', filler(50)),
      ...toolRound('grep', 'f3', filler(50)),
      ...toolRound('run_command', 'f4', filler(50)),
      { role: 'user', content: '继续' },
    ]
    const out = reclaimStaleToolResults(messages, {
      contextLimit: 1000,
      minSavedTokens: 1,
    })
    const todo = out.messages.find((m) => m.tool_call_id === 'f1')
    expect(todo?.content).toBe(body) // 未被改写
    const readMsg = out.messages.find((m) => m.tool_call_id === 'f2')
    expect(readMsg?.content).toBe(RECLAIM_PLACEHOLDER) // 白名单内被改写
    const grepMsg = out.messages.find((m) => m.tool_call_id === 'f3')
    expect(grepMsg?.content).not.toBe(RECLAIM_PLACEHOLDER) // 落在保护轮内
  })

  it('编辑类工具一票否决:即便被塞进白名单也不回收', () => {
    const body = filler(60)
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      ...toolRound('edit_file', 'g1', body),
      ...toolRound('read_file', 'g2', filler(50)),
      ...toolRound('grep', 'g3', filler(50)),
      ...toolRound('run_command', 'g4', filler(50)),
      { role: 'user', content: '继续' },
    ]
    const out = reclaimStaleToolResults(messages, {
      contextLimit: 1000,
      minSavedTokens: 1,
      // 故意把编辑类工具也放进白名单,验证黑名单优先级更高
      reclaimableTools: [...NON_RECLAIMABLE_EDIT_TOOLS, 'edit_file', 'read_file', 'grep'],
    })
    expect(out.applied).toBe(true)
    expect(out.messages.find((m) => m.tool_call_id === 'g1')?.content).toBe(body)
    expect(out.messages.find((m) => m.tool_call_id === 'g2')?.content).toBe(RECLAIM_PLACEHOLDER)
  })

  it('多模态块不回收(图片/文件回收后模型再也看不到)', () => {
    const img =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4' +
      '2mNkYAAAAAYAAjCBGAAEAAAAASUVORK5CYII='
    const body = `看图:\n${img}\n` + filler(60)
    expect(hasMultimodalBlock(body)).toBe(true)
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      ...toolRound('read_file', 'h1', body),
      ...toolRound('read_file', 'h2', filler(50)),
      ...toolRound('grep', 'h3', filler(50)),
      ...toolRound('run_command', 'h4', filler(50)),
      { role: 'user', content: '继续' },
    ]
    const out = reclaimStaleToolResults(messages, { contextLimit: 1000, minSavedTokens: 1 })
    expect(out.applied).toBe(true)
    expect(out.messages.find((m) => m.tool_call_id === 'h1')?.content).toBe(body)
    expect(out.messages.find((m) => m.tool_call_id === 'h2')?.content).toBe(RECLAIM_PLACEHOLDER)
  })

  it('结果信封不回收(撕掉信封=让模型找不回大输出的产物路径)', () => {
    // 用真标记拼一份信封,避免测试里再抄一份字面量;刻意不含空行 ——
    // 内嵌形态按 \n\n 分段,含空行会让信封被切成两半而测不到判据。
    const envelopePreview = filler(30).trim()
    const envelope =
      `${ENVELOPE_OPEN_MARKER}\n` +
      '工具: read_file\n' +
      '源文件: src/foo.ts\n' +
      '完整输出: .ihui-agent/tmp/artifacts/foo-1.txt (共 900000 字符 / 21000 行,上下文预算 4000 字符)\n' +
      `预览(前 ${envelopePreview.length} 字符):\n` +
      envelopePreview + '\n' +
      `${ENVELOPE_PREVIEW_FOOTER}\n${ENVELOPE_CLOSE_MARKER}\n` +
      '正文未进入上下文。需要更多内容请对上列路径用 read_file 分块读取(带 offset/limit),不要重复执行原工具。'
    expect(isEnvelopeContent(envelope)).toBe(true)
    expect(envelope).not.toContain('\n\n')

    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      // OpenAI 形态:信封整条不动,同批的普通大结果照收
      ...toolRound('read_file', 'env1', envelope),
      ...toolRound('read_file', 'env2', filler(50)),
      // IHUI 内嵌形态:同一条 user 消息里,信封分段不动、另一分段回收
      ...embeddedRound([
        embeddedChunk('grep', envelope),
        embeddedChunk('grep', filler(60)),
      ]),
      { role: 'user', content: '继续' },
    ]
    const out = reclaimStaleToolResults(messages, {
      contextLimit: 1000,
      keepRecentRounds: 1,
      minSavedTokens: 1,
    })
    expect(out.applied).toBe(true)
    expect(out.messages.find((m) => m.tool_call_id === 'env1')?.content).toBe(envelope)
    expect(out.messages.find((m) => m.tool_call_id === 'env2')?.content).toBe(RECLAIM_PLACEHOLDER)
    const carrier = out.messages.find((m) => m.role === 'user' && m.content.includes('工具结果'))!
    expect(carrier.content).toContain(envelope) // 信封分段逐字保留
    expect(carrier.content).toContain('.ihui-agent/tmp/artifacts/foo-1.txt') // 产物路径没被换掉
    expect(carrier.content).toContain(RECLAIM_PLACEHOLDER) // 另一分段确实被回收了
    expect(carrier.content).not.toContain(filler(60)) // 反向对照:非信封正文已消失
  })

  it('IHUI 内嵌形态:只替换结果正文,同消息的提醒段原样保留且 ✓/✗ 标记不丢', () => {
    const warnReminder = '[系统提示] 工具 run_command 已连续失败 2 次。请反思'
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      ...embeddedRound([
        embeddedChunk('read_file', filler(60)),
        embeddedChunk('run_command', filler(60), '✗'),
        warnReminder,
      ]),
      ...embeddedRound([embeddedChunk('grep', filler(60))]),
      { role: 'assistant', content: '结论如下' },
      { role: 'user', content: '继续' },
    ]
    const out = reclaimStaleToolResults(messages, {
      contextLimit: 100,
      keepRecentRounds: 1,
      minSavedTokens: 1,
    })
    expect(out.applied).toBe(true)
    const carriers = out.messages.filter((m) => m.role === 'user' && m.content.includes('工具结果'))
    expect(carriers.length).toBeGreaterThan(0)
    const first = carriers[0]!.content
    expect(first).toContain(RECLAIM_PLACEHOLDER)
    expect(first).toContain(warnReminder) // 提醒段未被牵连
    expect(first).toContain('[工具结果 ✗] run_command') // 失败标记保留
    expect(first).not.toContain(filler(60)) // 正文已替换
  })

  it('反向对照①:收益不足最小门槛时放弃改写(返回同一数组引用)', () => {
    // 只有一轮可回收、且正文体积小于 RECLAIM_MIN_SAVED_TOKENS ⇒ 必须整笔放弃
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      ...toolRound('read_file', 'i1', filler(25)), // ~250 tokens
      ...toolRound('read_file', 'i2', filler(25)),
      ...toolRound('read_file', 'i3', filler(25)),
      { role: 'user', content: '继续' },
    ]
    const out = reclaimStaleToolResults(messages, { contextLimit: 300 })
    expect(out.reason).toBe('below-min-benefit')
    expect(out.applied).toBe(false)
    expect(out.messages).toBe(messages) // 同一引用:零改写
    expect(out.savedTokens).toBe(0)
    // 对照:把门槛降到门槛值以下即会真改写 ⇒ 证明上一行的"没改"是门槛导致,不是没识别到
    const lowered = reclaimStaleToolResults(messages, {
      contextLimit: 300,
      minSavedTokens: 10,
    })
    expect(lowered.applied).toBe(true)
    expect(lowered.savedTokens).toBeLessThan(600)
  })

  it('正文太短(低于单条下限)不计入回收:nothing-reclaimable', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      ...toolRound('read_file', 'j1', 'ok'),
      ...toolRound('grep', 'j2', 'nope'),
      { role: 'user', content: '继续' },
    ]
    const out = reclaimStaleToolResults(messages, { contextLimit: 10, keepRecentRounds: 1 })
    expect(out.reason).toBe('nothing-reclaimable')
    expect(out.messages).toBe(messages)
    expect(RECLAIM_MIN_RESULT_TOKENS).toBeGreaterThan(1)
  })

  it('幂等:已回收的二次调用不再改写(reclaimedCount=0)', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      ...toolRound('read_file', 'k1', filler(60)),
      ...toolRound('run_command', 'k2', filler(60)),
      ...toolRound('grep', 'k3', filler(60)),
      ...toolRound('read_file', 'k4', filler(60)),
      { role: 'user', content: '继续' },
    ]
    const first = reclaimStaleToolResults(messages, { contextLimit: 1000 })
    expect(first.applied).toBe(true)
    const second = reclaimStaleToolResults(first.messages, { contextLimit: 1000 })
    expect(second.applied).toBe(false)
    expect(second.reason).toBe('nothing-reclaimable')
    expect(second.messages).toBe(first.messages)
  })

  it('轮次切分:tool 结果与其 assistant 同轮(边界天然不拆配对)', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: '问题' },
      ...toolRound('read_file', 'l1', 'x'),
      ...toolRound('grep', 'l2', 'y'),
      { role: 'assistant', content: '答复' },
    ]
    const rounds = splitAssistantRounds(messages.slice(1))
    expect(rounds).toHaveLength(4) // user问题 / assistant+tool / assistant+tool / assistant答复
    expect(rounds[1]).toHaveLength(2)
    expect(rounds[1]!.map((m) => m.role)).toEqual(['assistant', 'tool'])
  })
})

describe('守卫一:压缩后真值复测', () => {
  it('provider usage 可得时覆盖估算值,并以真值判定"是否真的压下去了"', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: filler(50) },
    ]
    const out = reverifyContextAfterCompaction({
      messages,
      usage: { promptTokens: 9000 },
      contextLimit: 10_000,
    })
    expect(out.source).toBe('provider-usage')
    expect(out.authoritativeTokens).toBe(9000)
    expect(out.effectiveTokens).toBe(9000)
    expect(out.effectiveTokens).not.toBe(out.estimatedTokens)
    expect(out.estimateDriftTokens).toBe(9000 - out.estimatedTokens)
    expect(out.meetsTarget).toBe(false) // 摘要"生成成功"但体量没降 → 判不达标
    expect(out.nextTurnWouldTrigger).toBe(true)
  })

  it('真值不可得时退回估算,并如实标 source=estimate(drift 为 null,不假装复测过)', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: filler(50) },
    ]
    const out = reverifyContextAfterCompaction({ messages, contextLimit: 10_000 })
    expect(out.source).toBe('estimate')
    expect(out.authoritativeTokens).toBeNull()
    expect(out.estimateDriftTokens).toBeNull()
    expect(out.effectiveTokens).toBe(out.estimatedTokens)
  })

  it('压到目标以下 → meetsTarget 为真且预测下一轮不再触发', () => {
    const out = reverifyContextAfterCompaction({
      tokensAfterCompaction: 1000,
      usage: { promptTokens: 1000 },
      contextLimit: 10_000,
    })
    expect(out.meetsTarget).toBe(true)
    expect(out.nextTurnWouldTrigger).toBe(false)
  })
})

describe('守卫二:快速回填熔断', () => {
  it('反向对照③:第二次快速回填仍不熔断,第三次才熔断并给诊断', () => {
    const breaker = new RefillBreaker()
    expect(breaker.observeCompaction(1).tripped).toBe(false) // 首次无参照
    const second = breaker.observeCompaction(2) // 间隔 1 轮 → 第 1 次快速回填
    expect(second.quickRefill).toBe(true)
    expect(second.consecutive).toBe(1)
    expect(second.tripped).toBe(false)
    expect(second.diagnostic).toBeNull()
    const third = breaker.observeCompaction(3) // 第 2 次快速回填 → 仍未熔断
    expect(third.consecutive).toBe(2)
    expect(third.tripped).toBe(false)
    expect(third.diagnostic).toBeNull()
    const fourth = breaker.observeCompaction(4) // 第 3 次 → 熔断
    expect(fourth.consecutive).toBe(3)
    expect(fourth.tripped).toBe(true)
    expect(fourth.diagnostic).not.toBeNull()
    expect(fourth.diagnostic).toContain('自动压缩已暂停')
    expect(fourth.diagnostic).toContain('分块')
    expect(fourth.diagnostic).toContain('新会话')
  })

  it('轮距超过窗口即归零连续计数(只罚"压完立刻又满"),但熔断锁不自动解除', () => {
    const breaker = new RefillBreaker({ windowRounds: 2, maxConsecutive: 2 })
    expect(breaker.observeCompaction(1).consecutive).toBe(0)
    expect(breaker.observeCompaction(2).consecutive).toBe(1)
    expect(breaker.observeCompaction(3).tripped).toBe(true)
    expect(breaker.observeCompaction(10).consecutive).toBe(0) // 间隔 7 轮 → 归零
    expect(breaker.tripped).toBe(true) // 需调用方 reset() 才恢复
    expect(breaker.diagnosticMessage()).toContain('自动压缩已暂停')
    breaker.reset()
    expect(breaker.tripped).toBe(false)
  })

  it('诊断文案在熔断那一刻只给一次(不逐轮刷屏)', () => {
    const breaker = new RefillBreaker({ windowRounds: 2, maxConsecutive: 1 })
    breaker.observeCompaction(1)
    expect(breaker.observeCompaction(2).diagnostic).not.toBeNull()
    expect(breaker.observeCompaction(3).diagnostic).toBeNull()
    expect(buildRefillDiagnostic(3, 2)).toContain('连续 3 次')
  })
})

describe('守卫三:极端溢出的整轮丢弃重试', () => {
  /** 三轮超载消息:每轮 assistant(2 个 tool_calls) + 两条 tool 结果 */
  function overloadedMessages(): ChatMessage[] {
    const big = filler(60)
    const mk = (n: string): ChatMessage[] => [
      {
        role: 'assistant',
        content: `第 ${n} 轮`,
        tool_calls: [
          { id: `${n}-1`, type: 'function', function: { name: 'read_file', arguments: '{}' } },
          { id: `${n}-2`, type: 'function', function: { name: 'grep', arguments: '{}' } },
        ],
      },
      { role: 'tool', content: big, tool_call_id: `${n}-1` },
      { role: 'tool', content: big, tool_call_id: `${n}-2` },
    ]
    return [
      { role: 'system', content: 'sys' },
      ...mk('1'),
      ...mk('2'),
      ...mk('3'),
      { role: 'user', content: '继续' },
    ]
  }

  it('反向对照②:丢弃后配对完好,且探针本身能检出"截断配对"(证明断言不空转)', () => {
    const messages = overloadedMessages()
    const out = retryAfterOverflowDrop(messages, { contextLimit: 1200 })
    expect(out.reason).toBe('resolved')
    expect(out.droppedRounds).toBeGreaterThan(0)
    expect(findOrphanToolMessages(out.messages)).toHaveLength(0)
    // 对照:故意只丢 assistant 而留下 tool 结果 → 必须被探针抓出来
    const naive = messages.filter((m) => !(m.role === 'assistant' && m.content === '第 1 轮'))
    expect(findOrphanToolMessages(naive).length).toBeGreaterThan(0)
  })

  it('system 段与历史摘要消息不丢;最近一轮永不丢', () => {
    const big = filler(60)
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: '[上下文摘要 — 之前 8 条消息已压缩]\n旧结论正文' },
      ...toolRound('read_file', 'z1', big),
      ...toolRound('grep', 'z2', big),
      ...toolRound('run_command', 'z3', big),
      { role: 'user', content: '最后一个问题' },
    ]
    const out = retryAfterOverflowDrop(messages, { contextLimit: 1200, maxDropRounds: 6 })
    expect(out.messages.some((m) => m.role === 'system')).toBe(true)
    expect(out.messages.some((m) => m.content.startsWith('[上下文摘要'))).toBe(true)
    expect(out.messages[out.messages.length - 1]!.content).toBe('最后一个问题')
  })

  it('丢弃数受上限约束:达上限仍未达标 → cap-exceeded(不把"没到位"记成 resolved)', () => {
    // maxDropRounds=0 ⇒ 一轮都不许丢,必然解决不了 → 如实报 cap-exceeded 而不是假绿
    const out = retryAfterOverflowDrop(overloadedMessages(), {
      contextLimit: 1200,
      maxDropRounds: 0,
    })
    expect(out.resolved).toBe(false)
    expect(out.reason).toBe('cap-exceeded')
    expect(out.droppedRounds).toBe(0)
    // 对照:放开上限就能解决
    const open = retryAfterOverflowDrop(overloadedMessages(), { contextLimit: 1200 })
    expect(open.resolved).toBe(true)
    expect(open.droppedRounds).toBeGreaterThan(0)
  })

  it('未溢出不改写(not-overflow,返回原数组引用)', () => {
    const messages = overloadedMessages()
    const out = retryAfterOverflowDrop(messages, { contextLimit: 500_000 })
    expect(out.reason).toBe('not-overflow')
    expect(out.messages).toBe(messages)
  })

  it('无整轮可丢(只剩最近一轮)时如实报 nothing-to-drop 而不是假装解决', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      ...toolRound('read_file', 's1', filler(60)),
    ]
    const out = retryAfterOverflowDrop(messages, { contextLimit: 100 })
    expect(out.reason).toBe('nothing-to-drop')
    expect(out.resolved).toBe(false)
    expect(out.messages).toBe(messages)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
