// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 能力四：错误恢复行为。
 *
 * 聚焦「工具执行失败之后」的运行时行为（参数校验错误已由 tool-call 用例覆盖，这里不重复）：
 *  - 可恢复：先读不存在的文件 → 读失败结果必须**如实回灌**给模型（success=false + 错误正文），
 *    模型据此改用 list_dir 找到真实文件，再读成功并给出正确结论；
 *  - 不可恢复：模型连续 3 次用同一参数读同一个不存在的文件，运行时必须**有界收敛**
 *    （不无限重试、不把失败结果当成功），且重复无进展的调用被计量。
 *
 * 被测链路全部是真实实现：
 *  - 工具错误信封 / 参数校验 / 内置工具：apps/cli/src/tools/{index,argument-validator,builtins}.ts
 *  - 循环终止判定：apps/cli/src/commands/agent.ts 的 runToolLoop
 *    （stuck 签名、doom-loop 滑动窗口、failure-streak、maxIterations 的收口顺序）。
 */
import { createCase, runTurn } from '../harness.js'
import { loadRecording, loadWorkspaceSeed } from '../fixtures.js'
import type { CaseResult } from '../types.js'
import { seedWorkspace, snapshotWorkspace } from '../workspace.js'

const KEY_FACT = 'WALRUS-77'
/** 读失败的文件名（与夹具里的真实文件名编辑距离 > 3，不会触发 did-you-mean 建议） */
const MISSING_FILE = 'secret.md'
const REAL_FILE = 'notes.md'

/**
 * 按实现固化的终态值（静态核对 apps/cli/src/commands/agent.ts 的收口顺序）：
 *  - 3 轮相同 `read_file` 调用在**第 3 轮采样后即被 stuck 签名检测收口**（
 *    agent.ts:2484-2492），该轮工具不再执行 ⇒ 实际执行次数 2；
 *  - 对应终态分支 agent.ts:2853-2855 把 `signatureDoomDetected` 记为 `'error'`
 *    （比 doom-loop 滑动窗口 agent.ts:2569-2586 更早命中，不会走到 `'doom_loop'`）。
 * 运行后若实测值不同，以实测为准并同步这里（禁止放宽断言）。
 */
const REPEATED_FAILURE_STOP_REASON = 'error'
const REPEATED_FAILURE_ATTEMPTS = 2

function normalizeSeed(seed: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [rel, content] of Object.entries(seed)) out[rel] = content.replace(/\r\n/g, '\n')
  return out
}

/** 第 index 次模型请求里任意消息是否带指定正文（证明工具结果真进了下一轮上下文） */
function requestCarries(
  requests: Array<Record<string, unknown>>,
  index: number,
  needle: string,
): boolean {
  const request = requests[index]
  if (!request) return false
  const messages = (request.messages ?? []) as Array<{ role?: string; content?: unknown }>
  return messages.some((m) => {
    const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
    return content.includes(needle)
  })
}

/** 可恢复用例：失败 → 换工具发现真实文件名 → 成功并给出正确结论 */
export async function missingFileThenListCase(): Promise<CaseResult> {
  const builder = createCase('recovery.missing-file-then-list', 'error-recovery')
  const seed = loadWorkspaceSeed('recovery-missing-file')
  const dir = seedWorkspace('recovery.missing-file-then-list', seed)

  const outcome = await runTurn({
    caseId: 'recovery.missing-file-then-list',
    workspacePath: dir,
    messages: [{ role: 'user', content: `读取 ${MISSING_FILE}，告诉我文件里记录的口令是什么。` }],
    recording: loadRecording('error-recovery/missing-file-then-list'),
    maxIterations: 5,
  })

  const calls = outcome.toolCalls
  const results = outcome.toolResults
  const sequenceOk =
    calls.length === 3 &&
    calls[0]!.name === 'read_file' &&
    calls[0]!.arguments.path === MISSING_FILE &&
    calls[1]!.name === 'list_dir' &&
    calls[1]!.arguments.path === '.' &&
    calls[2]!.name === 'read_file' &&
    calls[2]!.arguments.path === REAL_FILE

  const failureIsError =
    results.length === 3 && results[0]!.success === false && results[0]!.name === 'read_file'
  const errorFedBack = requestCarries(outcome.requests, 1, `文件不存在: ${MISSING_FILE}`)
  const recoveredByListing =
    results[1]?.success === true &&
    results[1]?.name === 'list_dir' &&
    results[2]?.success === true &&
    results[2]?.name === 'read_file'
  const answerCorrect = outcome.result.assistantText.includes(KEY_FACT)
  const workspaceUntouched =
    JSON.stringify(snapshotWorkspace(dir)) === JSON.stringify(normalizeSeed(seed))

  builder.check('工具序列为「读失败 → 列目录 → 读成功」', sequenceOk, calls)
  builder.check('第一次 read_file 以 success=false 落地', failureIsError, results)
  builder.check('失败错误正文进入下一轮模型请求', errorFedBack, outcome.requests.length)
  builder.check('改用 list_dir 后 read_file 成功', recoveredByListing, results)
  builder.check('最终答复包含文件中的口令', answerCorrect, outcome.result.assistantText)
  builder.check(
    '回合正常结束（end_turn）',
    outcome.result.stopReason === 'end_turn',
    outcome.result.stopReason,
  )
  builder.check(
    '只读恢复未改动工作区',
    workspaceUntouched,
    Object.keys(snapshotWorkspace(dir)).sort(),
  )

  const recovered =
    failureIsError &&
    errorFedBack &&
    recoveredByListing &&
    answerCorrect &&
    outcome.result.stopReason === 'end_turn'
  builder.metric('recovery.recovered', recovered)
  builder.metric('recovery.attempts', results.length)
  builder.metric('recovery.wasted_side_effects', 0)
  builder.metric('recovery.final_state_correct', answerCorrect && workspaceUntouched)
  builder.metric('recovery.stop_reason', outcome.result.stopReason)

  builder.evidence(
    'tool_calls',
    calls.map((c) => ({ name: c.name, path: c.arguments.path ?? null })),
  )
  builder.evidence(
    'tool_success',
    results.map((r) => r.success),
  )
  builder.evidence('failure_feedback_in_requests', [
    requestCarries(outcome.requests, 1, `文件不存在: ${MISSING_FILE}`),
  ])
  builder.evidence('served_model_calls', outcome.servedCalls)
  builder.evidence('workspace_files', Object.keys(snapshotWorkspace(dir)).sort())
  return builder.finish()
}

/** 不可恢复用例：连续 3 次相同失败调用，运行时必须有界收敛且不把错误当成功 */
async function repeatedFailureBoundedCase(): Promise<CaseResult> {
  const builder = createCase('recovery.repeated-failure-bounded', 'error-recovery')
  const seed = loadWorkspaceSeed('recovery-repeated-failure')
  const dir = seedWorkspace('recovery.repeated-failure-bounded', seed)

  const outcome = await runTurn({
    caseId: 'recovery.repeated-failure-bounded',
    workspacePath: dir,
    messages: [{ role: 'user', content: '读取 missing-report.md 并总结内容。' }],
    recording: loadRecording('error-recovery/repeated-failure-bounded'),
    maxIterations: 4,
  })

  const calls = outcome.toolCalls
  const results = outcome.toolResults
  // 录制里 3 次模型响应都是同一 read_file 提案，回放被恰好消费 3 次 = 模型确实连续提了 3 次；
  // 第 3 次提案在采样后被 stuck 签名检测立即收口（不再执行），故实际执行只有前 2 次。
  const proposedThreeTimes =
    outcome.servedCalls.length === 3 &&
    calls.length === REPEATED_FAILURE_ATTEMPTS &&
    calls.every((c) => c.name === 'read_file' && c.arguments.path === 'missing-report.md')
  const neverTreatedAsSuccess = results.length > 0 && results.every((r) => r.success === false)
  const feedbackEveryRound =
    results.length === REPEATED_FAILURE_ATTEMPTS &&
    Array.from({ length: results.length }, (_, i) =>
      requestCarries(outcome.requests, i + 1, '文件不存在: missing-report.md'),
    ).every(Boolean)
  const bounded =
    outcome.servedCalls.length === 3 &&
    results.length === REPEATED_FAILURE_ATTEMPTS &&
    results.length <= outcome.servedCalls.length &&
    outcome.result.iterations < 4
  const stopIsRealTerminal =
    outcome.result.stopReason === REPEATED_FAILURE_STOP_REASON &&
    outcome.result.stopReason !== 'end_turn'
  const workspaceUntouched =
    JSON.stringify(snapshotWorkspace(dir)) === JSON.stringify(normalizeSeed(seed))

  builder.check(
    '模型连续 3 次提出同一失败 read_file 调用（回放恰好消费 3 次）',
    proposedThreeTimes,
    {
      served: outcome.servedCalls,
      executed: calls,
    },
  )
  builder.check('每一次实际执行的失败结果都是 success=false', neverTreatedAsSuccess, results)
  builder.check('每轮失败正文都回灌到下一次模型请求', feedbackEveryRound, outcome.requests.length)
  builder.check('有界收敛（未跑满 maxIterations，且未执行判定收口的那一轮）', bounded, {
    servedCalls: outcome.servedCalls.length,
    attempts: results.length,
    iterations: outcome.result.iterations,
  })
  builder.check('终态是真实终态且不是 end_turn', stopIsRealTerminal, outcome.result.stopReason)
  builder.check(
    '失败任务未改动工作区',
    workspaceUntouched,
    Object.keys(snapshotWorkspace(dir)).sort(),
  )

  // 重复无进展的副作用：同参数失败调用中"第一次之后"的部分
  const wasted = Math.max(0, results.length - 1)
  builder.metric('recovery.recovered', false)
  builder.metric('recovery.attempts', results.length)
  builder.metric('recovery.wasted_side_effects', wasted)
  builder.metric('recovery.final_state_correct', workspaceUntouched)
  builder.metric('recovery.stop_reason', outcome.result.stopReason)

  builder.evidence(
    'tool_calls',
    calls.map((c) => ({ name: c.name, path: c.arguments.path ?? null })),
  )
  builder.evidence(
    'tool_success',
    results.map((r) => r.success),
  )
  builder.evidence(
    'failure_feedback_in_requests',
    results.map((_, i) => requestCarries(outcome.requests, i + 1, '文件不存在: missing-report.md')),
  )
  builder.evidence('served_model_calls', outcome.servedCalls)
  builder.evidence('iterations_before_stop', outcome.result.iterations)
  builder.evidence('workspace_files', Object.keys(snapshotWorkspace(dir)).sort())
  return builder.finish()
}

export async function run(): Promise<CaseResult[]> {
  return [await missingFileThenListCase(), await repeatedFailureBoundedCase()]
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
