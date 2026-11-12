// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-068 回归 —— 两件事各一组:
 *  ① 封笔闸:结果行(complete)之后再冒出任何事件行都出不了闸,所以收尾的
 *     `background_drain` 结论不得再写 stdout(改走 stderr,否则严格 NDJSON 消费方解析错位);
 *  ② headless-permission 的兜底不再是死代码:生产入口(index.ts 的 runAgentAndExit)
 *     真的构造经纪并用它的结论决定会话级放宽,且未显式点名时落 deny 兜底。
 *
 * 第二组的正/反例都从 index.ts 的同一形状出发,拒绝文案由 utils/tool-denial.ts 单出口
 * 独立重算一遍做逐字对照 —— 本文件不书写任何拒绝句子。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHeadlessEventGate, type HeadlessEvent } from '../src/headless-format.js'
import { approvalSurfacePresent, createHeadlessPermissionBroker } from '../src/headless-permission.js'
import { buildToolDenial, denialErrorSuffix } from '../src/utils/tool-denial.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const indexSrc = readFileSync(path.join(here, '..', 'src', 'index.ts'), 'utf-8')

const COMPLETE_EVENT: HeadlessEvent = {
  type: 'complete',
  stopReason: 'end_turn',
  iterations: 1,
  usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, estimatedCostUsd: 0 },
}

describe('F-068 ① 封笔闸:complete 之后不再放行任何事件行', () => {
  it('封笔前:普通事件与结果行都可出门', () => {
    const gate = createHeadlessEventGate()
    expect(gate.canEmit({ type: 'message_delta', text: 'hi' })).toBe(true)
    expect(gate.canEmit({ type: 'iteration', count: 1, max: 3 })).toBe(true)
    expect(gate.canEmit(COMPLETE_EVENT)).toBe(true)
  })

  it('封笔后:只有结果行可出门,其余事件(含收尾播报形态)一律被拒', () => {
    const gate = createHeadlessEventGate()
    gate.detachEvents()
    const blocked: HeadlessEvent[] = [
      { type: 'start', prompt: 'p', model: 'm', workspace: 'w' },
      { type: 'message_delta', text: 'late' },
      { type: 'tool_call', name: 'run_command', arguments: {} },
      { type: 'tool_result', name: 'run_command', success: true, output: 'ok' },
      { type: 'iteration', count: 2, max: 3 },
      { type: 'error', message: 'late error' },
    ]
    for (const event of blocked) expect(gate.canEmit(event)).toBe(false)
    // 结果行仍能出门(它是封笔动作自身要写的那一行)
    expect(gate.canEmit(COMPLETE_EVENT)).toBe(true)
  })

  it('index.ts:drain 结论在封笔后只走 stderr,stdout 不再被追加一行', () => {
    const at = indexSrc.indexOf("type: 'background_drain'")
    expect(at).toBeGreaterThan(-1)
    const window = indexSrc.slice(at, at + 900)
    expect(window).toContain('process.stderr.write')
    expect(window).not.toContain('process.stdout.write')
  })
})

describe('F-068 ② headless-permission 兜底成为真实可达路径', () => {
  /** 与 index.ts 的 runAgentAndExit 同一构造形状:单发路径没有审批面 */
  const headlessConfig = (explicitRelaxation: boolean) => ({
    isInteractive: false,
    hasApprovalSurface: approvalSurfacePresent({
      ttyInteractive: false,
      confirmHandlerPresent: false,
    }),
    autoAllowTools: explicitRelaxation ? ['--allow-dangerous'] : [],
  })

  it('index.ts 真的消费经纪(构造 + 用结论决定会话级放宽)', () => {
    expect(indexSrc).toContain("from './headless-permission.js'")
    expect(indexSrc).toContain('createHeadlessPermissionBroker({')
    expect(indexSrc).toContain('approvalSurfacePresent({')
    expect(indexSrc).toContain(
      'headlessPermission.evaluate({ name: HEADLESS_SESSION_RELAXATION }).action === \'allow\'',
    )
  })

  it('兜底路径可触发:未显式点名 ⇒ deny,文案逐字取自单一出口', () => {
    const decision = createHeadlessPermissionBroker(headlessConfig(false)).evaluate({
      name: '--allow-dangerous',
    })
    expect(decision.action).toBe('deny')
    if (decision.action !== 'deny') return
    const canonical = buildToolDenial({
      gate: 'dangerous-gate',
      decider: 'no-confirmation-channel',
      tool: '--allow-dangerous',
    })
    expect(decision.denial).toEqual(canonical)
    expect(decision.message).toBe(denialErrorSuffix(canonical))
  })

  it('显式点名(名单命中) ⇒ allow,会话级放宽照旧生效', () => {
    const broker = createHeadlessPermissionBroker(headlessConfig(true))
    expect(broker.deniesWhenSurfaceAbsent).toBe(true)
    expect(broker.evaluate({ name: '--allow-dangerous' }).action).toBe('allow')
    // 名单是逐名例外,不是模式匹配
    expect(broker.evaluate({ name: '--allow-dangerous-anything' }).action).toBe('deny')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
