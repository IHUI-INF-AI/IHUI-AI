// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 能力一：工具调用正确性。
 *
 * 判据全部落在可观测事实上：
 *  - 模型给出 tool_call 后，实际执行的工具名/参数是否就是任务所需（选择正确性）；
 *  - 非法参数是否被运行时挡下（不会带病执行）、模型补正后能否一次修好（修复轮次）；
 *  - 工具结果是否真的回到下一轮请求里（否则模型只能瞎猜）；
 *  - 只读任务结束后工作区必须一字未变（防止"评测通过但把现场改了"）。
 */
import { createCase, runTurn } from '../harness.js'
import { loadRecording, loadWorkspaceSeed } from '../fixtures.js'
import type { CaseResult } from '../types.js'
import { seedWorkspace, snapshotWorkspace } from '../workspace.js'

function normalizeSeed(seed: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [rel, content] of Object.entries(seed)) out[rel] = content.replace(/\r\n/g, '\n')
  return out
}

/** 检查最后一次模型请求里是否带回了指定工具结果正文（证明 tool_result 真进了上下文） */
export function lastRequestCarriesToolOutput(
  requests: Array<Record<string, unknown>>,
  needle: string,
): boolean {
  const last = requests[requests.length - 1]
  if (!last) return false
  const messages = (last.messages ?? []) as Array<{ role?: string; content?: unknown }>
  return messages.some((m) => {
    if (m.role !== 'tool' && m.role !== 'user') return false
    const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
    return content.includes(needle)
  })
}

export async function directReadCase(): Promise<CaseResult> {
  const builder = createCase('tool-call.direct-read', 'tool-call')
  const seed = loadWorkspaceSeed('ops-notes')
  const dir = seedWorkspace('tool-call.direct-read', seed)
  const outcome = await runTurn({
    caseId: 'tool-call.direct-read',
    workspacePath: dir,
    messages: [{ role: 'user', content: '读取 notes.md，告诉我文件里记录的口令是什么。' }],
    recording: loadRecording('tool-call/direct-read'),
    maxIterations: 4,
  })

  const calls = outcome.toolCalls
  builder.check(
    '模型给出的工具序列恰好是 read_file',
    calls.length === 1 && calls[0]!.name === 'read_file',
    calls,
  )
  builder.check(
    'read_file 参数指向 notes.md',
    calls[0]?.arguments.path === 'notes.md',
    calls[0]?.arguments,
  )
  builder.check(
    '工具执行成功',
    outcome.toolResults.length === 1 && outcome.toolResults[0]!.success,
    outcome.toolResults,
  )
  builder.check(
    '最终答复包含文件中的口令',
    outcome.result.assistantText.includes('ZEBRA-42'),
    outcome.result.assistantText,
  )
  builder.check('回合正常结束', outcome.result.stopReason === 'end_turn', outcome.result.stopReason)
  builder.check(
    '第二轮请求带回了工具结果正文',
    lastRequestCarriesToolOutput(outcome.requests, 'ZEBRA-42'),
    outcome.requests.length,
  )
  const before = normalizeSeed(seed)
  const after = snapshotWorkspace(dir)
  builder.check(
    '只读任务未改动工作区',
    JSON.stringify(after) === JSON.stringify(before),
    Object.keys(after),
  )

  builder.metric('tool-call.correct_selections', 1)
  builder.metric('tool-call.invalid_argument_calls', 0)
  builder.metric('tool-call.repair_rounds', 0)
  builder.metric('tool-call.executed_calls', outcome.toolResults.length)
  builder.metric('tool-call.workspace_state_correct', true)
  builder.metric('tool-call.stop_reason', outcome.result.stopReason)
  builder.evidence(
    'tool_calls',
    calls.map((c) => ({ name: c.name, path: c.arguments.path ?? null })),
  )
  builder.evidence(
    'tool_success',
    outcome.toolResults.map((r) => r.success),
  )
  builder.evidence('served_model_calls', outcome.servedCalls)
  builder.evidence('workspace_files', Object.keys(after).sort())
  return builder.finish()
}

export async function invalidArgRepairCase(): Promise<CaseResult> {
  const builder = createCase('tool-call.invalid-arg-repair', 'tool-call')
  const seed = loadWorkspaceSeed('ops-notes')
  const dir = seedWorkspace('tool-call.invalid-arg-repair', seed)
  const outcome = await runTurn({
    caseId: 'tool-call.invalid-arg-repair',
    workspacePath: dir,
    messages: [{ role: 'user', content: '读取 notes.md，告诉我文件里记录的口令是什么。' }],
    recording: loadRecording('tool-call/invalid-arg-repair'),
    maxIterations: 6,
  })

  const results = outcome.toolResults
  builder.check(
    '第一次调用被参数校验挡下（不带病执行）',
    results.length >= 2 && results[0]!.success === false,
    results,
  )
  builder.check('补正后的同类调用成功', results[1]?.success === true, results)
  builder.check(
    '模型确实补正了 path 参数',
    outcome.toolCalls[1]?.arguments.path === 'notes.md',
    outcome.toolCalls,
  )
  builder.check(
    '最终答复包含口令',
    outcome.result.assistantText.includes('ZEBRA-42'),
    outcome.result.assistantText,
  )
  builder.check('回合正常结束', outcome.result.stopReason === 'end_turn', outcome.result.stopReason)

  const invalidCalls = results.filter((r) => !r.success).length
  const repairRounds = Math.max(
    0,
    results.findIndex((r) => r.success),
  )
  builder.metric('tool-call.correct_selections', 1)
  builder.metric('tool-call.invalid_argument_calls', invalidCalls)
  builder.metric('tool-call.repair_rounds', repairRounds)
  builder.metric('tool-call.executed_calls', results.length)
  builder.metric('tool-call.workspace_state_correct', true)
  builder.metric('tool-call.stop_reason', outcome.result.stopReason)
  builder.evidence(
    'tool_calls',
    outcome.toolCalls.map((c) => ({ name: c.name, path: c.arguments.path ?? null })),
  )
  builder.evidence(
    'tool_success',
    results.map((r) => r.success),
  )
  builder.evidence('served_model_calls', outcome.servedCalls)
  return builder.finish()
}

async function selectListDirCase(): Promise<CaseResult> {
  const builder = createCase('tool-call.select-list-dir', 'tool-call')
  const seed = loadWorkspaceSeed('ops-notes')
  const dir = seedWorkspace('tool-call.select-list-dir', seed)
  const outcome = await runTurn({
    caseId: 'tool-call.select-list-dir',
    workspacePath: dir,
    messages: [{ role: 'user', content: '列一下当前目录里有哪些文件。' }],
    recording: loadRecording('tool-call/select-list-dir'),
    maxIterations: 4,
  })

  builder.check(
    '选择了目录列举工具而不是读文件工具',
    outcome.toolCalls[0]?.name === 'list_dir',
    outcome.toolCalls,
  )
  builder.check('工具执行成功', outcome.toolResults[0]?.success === true, outcome.toolResults)
  builder.check(
    '答复包含两个真实文件名',
    /notes\.md/.test(outcome.result.assistantText) &&
      /todo\.txt/.test(outcome.result.assistantText),
    outcome.result.assistantText,
  )
  builder.check('回合正常结束', outcome.result.stopReason === 'end_turn', outcome.result.stopReason)

  builder.metric('tool-call.correct_selections', 1)
  builder.metric('tool-call.invalid_argument_calls', 0)
  builder.metric('tool-call.repair_rounds', 0)
  builder.metric('tool-call.executed_calls', outcome.toolResults.length)
  builder.metric('tool-call.workspace_state_correct', true)
  builder.metric('tool-call.stop_reason', outcome.result.stopReason)
  builder.evidence(
    'tool_calls',
    outcome.toolCalls.map((c) => ({ name: c.name })),
  )
  builder.evidence('workspace_root_entries', Object.keys(snapshotWorkspace(dir)).sort())
  builder.evidence('served_model_calls', outcome.servedCalls)
  return builder.finish()
}

export async function run(): Promise<CaseResult[]> {
  return [await directReadCase(), await invalidArgRepairCase(), await selectListDirCase()]
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
