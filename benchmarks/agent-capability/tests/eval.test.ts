// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 评测入口（唯一测试文件）。
 *
 * 这里只做三件事：
 *  1. 把"外部不确定源"全部换成夹具：模型流（回放）、用户配置（显式声明）、审计上报（丢弃）；
 *  2. 跑完固定任务集，写出确定性快照；
 *  3. 与基线做机械比较，退化即红。
 *
 * 不在用例里写"差不多就行"的断言：每个判据都来自可观测事实（工具序列 / 文件内容 /
 * 消息形态 / 哈希），并且比较口径固定在 src/metrics.ts。
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import type * as ApiClient from '@ihui/api-client'

vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClient>()
  return {
    ...actual,
    // 评测只走本地回放 provider；远端路径一旦被走到就必须炸，不能静默降级
    streamChat: vi.fn(async () => {
      throw new Error('评测禁止调用远端 streamChat：所有模型输出必须来自录制回放')
    }),
    setBaseUrl: vi.fn(),
    setTokenProvider: vi.fn(),
    formatSSEError: (err: unknown) => ({
      severity: 'unknown' as const,
      title: 'error',
      message: err instanceof Error ? err.message : String(err),
      rawMessage: err instanceof Error ? err.message : String(err),
      requireReauth: false,
    }),
  }
})

// 审计上报：评测不验证审计链路，且不允许任何网络副作用
vi.mock('@cli/audit.js', () => ({
  auditLog: vi.fn(),
}))
vi.mock('@cli/utils/audit-ingest-client.js', () => ({
  resolveAuditIngestClient: () => undefined,
  __resetAuditIngestClientWarnForTest: vi.fn(),
}))

// 用户配置：一律读用例显式声明的配置，绝不读本机 ~/.ihui
vi.mock('@cli/commands/settings.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  const { getEvalSettings } = await import('../src/settings-state.js')
  return {
    ...actual,
    loadSettings: () => getEvalSettings(),
  }
})

import { compareSnapshots, formatComparison } from '../src/compare.js'
import { loadRecording, setRecordingOverrides } from '../src/fixtures.js'
import type { ReplayRecording } from '../src/replay.js'
import { runAllCases } from '../src/run-cases.js'
import {
  buildSnapshot,
  readBaseline,
  writeBaseline,
  writeComparison,
  writeCurrentSnapshot,
} from '../src/snapshot.js'
import { missingFileThenListCase } from '../src/suites/error-recovery.js'
import { midTurnToolPairCase } from '../src/suites/resume.js'
import { directReadCase, invalidArgRepairCase } from '../src/suites/tool-call.js'
import type { CaseResult, EvalSnapshot } from '../src/types.js'
import { cleanupTmpDir } from '../src/workspace.js'

const updateBaseline = process.env.IHUI_EVAL_UPDATE_BASELINE === '1'

let results: CaseResult[] = []
let snapshot: EvalSnapshot | null = null

beforeAll(async () => {
  cleanupTmpDir()
  results = await runAllCases()
  snapshot = buildSnapshot(results, process.env.IHUI_EVAL_COMMIT ?? 'unknown')
  writeCurrentSnapshot(snapshot)
})

afterAll(() => {
  // 临时工作区只服务于本次运行，跑完即删（证据已进快照）
  cleanupTmpDir()
})

describe('固定任务集', () => {
  it('全部用例通过（每个能力都是硬判据）', () => {
    expect(results.length).toBeGreaterThan(0)
    const failed = results.filter((item) => !item.passed)
    const detail = failed.map((item) => `- ${item.id}: ${item.failures.join(' | ')}`).join('\n')
    expect(failed, `失败用例:\n${detail}`).toHaveLength(0)
  })

  it('基线对比：能判「退化 / 提升 / 无变化」', () => {
    if (!snapshot) throw new Error('快照未生成')
    if (updateBaseline) {
      writeBaseline(snapshot)
      console.log('[eval] 已刷新基线:', snapshot.cases.length, '条用例')
      return
    }
    const baseline = readBaseline()
    expect(baseline, '基线缺失：请先执行 pnpm eval:update-baseline 生成基线').not.toBeNull()
    const comparison = compareSnapshots(baseline!, snapshot)
    const fixtureHashChanged = baseline!.fixtureHash !== snapshot.fixtureHash
    writeComparison(comparison, fixtureHashChanged)
    console.log(formatComparison(comparison, fixtureHashChanged))
    expect(comparison.status, formatComparison(comparison, fixtureHashChanged)).not.toBe(
      'regressed',
    )
  })
})

/**
 * 负控（negative controls）：把录制改造成"差实现"的行为，验证同一套断言会判红。
 *
 * 若这类改造仍能通过，说明夹具/断言没有区分度（真实评审事故：完全不看相关性的假实现
 * 与真实现同分）。负控只在独立 test 块里直接调用导出的用例函数，不进入 runAllCases()，
 * 因此不会写入 results/current.json 与 baseline/baseline.json。
 *
 * compaction 的「退化摘要」用例本身就是负控（退化摘要在同一用例里必须判红），故此处
 * 覆盖余下四类能力各一个负控。
 */

/** 负控专用：取一份可安全修改的录制副本（loadRecording 每次返回全新对象） */
function recordingCopy(rel: string): ReplayRecording {
  return structuredClone(loadRecording(rel))
}

/** 构造只含文本答案的模型响应帧（负控：把工具调用改成"直接作答"） */
function textOnlyFrames(text: string): Array<Record<string, unknown>> {
  return [
    { choices: [{ index: 0, delta: { role: 'assistant', content: text } }] },
    { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] },
  ]
}

/** 把第 callIndex 次录制调用里的首个工具名改掉（模拟"选错工具"） */
function renameToolInCall(rec: ReplayRecording, callIndex: number, name: string): void {
  const frame = rec.calls[callIndex]?.frames[0] as
    | {
        choices?: Array<{
          delta?: { tool_calls?: Array<{ function?: { name?: string } }> }
        }>
      }
    | undefined
  const toolCall = frame?.choices?.[0]?.delta?.tool_calls?.[0]
  if (!toolCall?.function) throw new Error('负控夹具构造失败：录制里找不到工具调用帧')
  toolCall.function.name = name
}

/** 坏行为必须让用例判红，且失败点落在预期断言上 */
function expectNegativeControl(result: CaseResult, expectedFailure: RegExp): void {
  // 打印被判红的断言正文：负控通过时它不会出现在错误信息里，必须留作一手证据
  console.log(`[负控] ${result.id} 判红断言: ${result.failures.join(' | ')}`)
  expect(
    result.passed,
    `负控：坏行为未被判红 ⇒ 断言无区分度（failures: ${result.failures.join(' | ') || '无'}）`,
  ).toBe(false)
  expect(result.failures.join('\n'), '负控：坏行为未被判红 ⇒ 断言无区分度').toMatch(expectedFailure)
}

describe('负控：差实现必须掉分', () => {
  afterEach(() => {
    // 每个负控结束都清空覆盖，避免污染后续用例（含读取同一录制的其它用例）
    setRecordingOverrides(null)
  })

  it('tool-call：把 read_file 换成 list_dir 必须掉分', async () => {
    const rec = recordingCopy('tool-call/direct-read')
    renameToolInCall(rec, 0, 'list_dir')
    setRecordingOverrides({ 'tool-call/direct-read': rec })
    const result = await directReadCase()
    expectNegativeControl(result, /工具序列/)
  })

  it('tool-call 修复：删掉补正后的成功调用必须掉分', async () => {
    const rec = recordingCopy('tool-call/invalid-arg-repair')
    // 只保留首次非法参数与最终答案，删掉"补正后成功"的那次调用
    rec.calls.splice(1, 1)
    setRecordingOverrides({ 'tool-call/invalid-arg-repair': rec })
    const result = await invalidArgRepairCase()
    expectNegativeControl(result, /补正/)
  })

  it('resume：半回合工具对消失（只给文本答案）必须掉分', async () => {
    const rec = recordingCopy('resume/mid-turn-tool-pair/turn2')
    // 半回合本轮改为"只给文本答案"：工具对不再发生，工具结果也就没有落盘
    rec.calls = [
      { label: rec.calls[0]!.label, frames: textOnlyFrames('已看过 plan.md 与目录结构。') },
    ]
    setRecordingOverrides({ 'resume/mid-turn-tool-pair/turn2': rec })
    const result = await midTurnToolPairCase()
    expectNegativeControl(result, /半回合/)
  })

  it('error-recovery：删掉失败后的 list_dir 恢复必须掉分', async () => {
    const rec = recordingCopy('error-recovery/missing-file-then-list')
    // 只留首次失败与直接回答，删掉「list_dir 发现真实文件 → 再读成功」
    rec.calls = [rec.calls[0]!, rec.calls[3]!]
    setRecordingOverrides({ 'error-recovery/missing-file-then-list': rec })
    const result = await missingFileThenListCase()
    expectNegativeControl(result, /工具序列|改用 list_dir/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
