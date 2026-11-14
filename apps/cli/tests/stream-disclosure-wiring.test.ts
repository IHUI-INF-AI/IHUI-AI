// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * CLI 端流级交代帧接线锁(2026-11-13 立)。
 *
 * 立此锁的因由:台账里 cli 缺 27 项流级帧,其中多项被笼统归为「无 UI 能力」。
 * 实测证伪:CLI **本身就是终端**,`statusLine.noteLine` 早就在承载 onBudget /
 * onRetryScheduled / onCitations / onSteer / onInjectionApplied / onTerminalDelta 六族
 * (`repl.ts:2894-2915` 现读),它是通用出口,不需要卡片宿主。
 *
 * 因此本端此前对下列帧「0 命中」是**静态缺帧**,不是能力缺失:
 *   compaction / subagent_spawn|progress|end / terminal_start / fallback /
 *   tool_summary / tool_delegate / finish_reason
 *
 * 本锁钉三层:
 *   ① 声明层:RunToolLoopOptions 与 SampleWithRetryOptions 都收了这些回调;
 *   ② 透传层:两处 streamChat 调用都把它们转发下去(缺一层就断链);
 *   ③ 消费层:repl.ts 真的把每一帧写进 statusLine.noteLine(不是收进没人读的变量)。
 *
 * 反向对照:把某一条的透传摘掉,判据必须咬住 —— 证明这不是"看着像接了"。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const AGENT = readFileSync(join(HERE, '../src/commands/agent.ts'), 'utf8')
const REPL = readFileSync(join(HERE, '../src/commands/repl.ts'), 'utf8')

/** 本轮接线的帧回调清单(与台账删除的 missing 项一一对应) */
const WIRED = [
  'onCompaction',
  'onSubagentSpawn',
  'onSubagentProgress',
  'onSubagentEnd',
  'onTerminalStart',
  'onTerminalEnd',
  'onFallback',
  'onToolSummary',
  'onToolDelegate',
  'onFinishReason',
]

describe('CLI 流级交代帧:声明层', () => {
  it.each(WIRED)('%s 在 agent.ts 里有选项声明', (cb) => {
    expect(AGENT).toContain(`${cb}?:`)
  })
})

describe('CLI 流级交代帧:透传层', () => {
  it.each(WIRED)('%s 被转发到 streamChat(两处调用各一次)', (cb) => {
    // 形如 `...(opts.onXxx ? { onXxx: opts.onXxx } : {}),`
    const pattern = new RegExp(`\\.\\.\\.\\(opts\\.${cb} \\? \\{ ${cb}: opts\\.${cb} \\} : \\{\\}\\)`)
    const hits = (AGENT.match(new RegExp(pattern, 'g')) ?? []).length
    expect(hits, `${cb} 的透传应有 2 处(sampleWithRetry 与 runToolLoop),实得 ${hits}`).toBe(2)
  })
})

describe('CLI 流级交代帧:消费层(必须真上屏)', () => {
  /**
   * 取该回调**自己的块**:从注册点到下一个同级回调注册点(或文件尾)。
   *
   * 不能用"后 500 字符内出现 noteLine"——那样只要后面紧跟着另一个写了 noteLine 的回调,
   * 判据就会被借力通过。实测踩过:把 onFallback 改成 `(event) => void event,` 后,
   * 后面 onToolSummary 的 noteLine 让判据照旧全绿(30/30 passed),变异没被咬住。
   */
  const blockOf = (src: string, cb: string): string => {
    const at = src.indexOf(`      ${cb}: `)
    if (at < 0) return ''
    const rest = src.slice(at + 1)
    // 下一个同级回调(六个空格缩进的 `onXxx: `)
    const nextRel = rest.search(/\n {6}on[A-Z][A-Za-z]*: /)
    return nextRel < 0 ? rest : rest.slice(0, nextRel)
  }

  it.each(WIRED)('%s 在自己的块内写进 statusLine.noteLine', (cb) => {
    expect(REPL, `${cb} 未注册`).toContain(`${cb}:`)
    const block = blockOf(REPL, cb)
    expect(block.length, `${cb} 的块取不到 —— 锚点漂了先怀疑尺子`).toBeGreaterThan(0)
    expect(block, `${cb} 收了帧却没在自己的块里写 noteLine ⇒ 数据落进没人读的内存键`).toMatch(
      /statusLine\.noteLine\(/,
    )
  })
})

describe('CLI 流级交代帧:判据不复制', () => {
  it('截断判据走共享助手,端内不自写"哪些 finishReason 算截断"', () => {
    expect(REPL).toContain('isMaxTokensTruncatedFinishReason')
    expect(REPL).toMatch(/from '@ihui\/shared\/utils\/finish-reason'/)
    // 反向:不得出现自写的 finishReason 字面量比较
    expect(REPL).not.toMatch(/finishReason\s*===\s*['"]length['"]/)
  })

  it('准入回执的 inputId 由共享 createInputId 生成(端内不造第二源)', () => {
    expect(REPL).toContain('createInputId')
    expect(REPL).toMatch(/from '@ihui\/shared\/chat\/send-admission'/)
  })
})

describe('CLI 流级交代帧:反向对照(判据有牙)', () => {
  it('把透传行摘掉后,判据必须读成"没接上"', () => {
    const broken = AGENT.replace(
      /\.\.\.\(opts\.onFallback \? \{ onFallback: opts\.onFallback \} : \{\}\),/g,
      '',
    )
    expect(broken).not.toBe(AGENT)
    const pattern = new RegExp(
      `\\.\\.\\.\\(opts\\.onFallback \\? \\{ onFallback: opts\\.onFallback \\} : \\{\\}\\)`,
      'g',
    )
    expect((broken.match(pattern) ?? []).length).toBe(0)
  })
})
