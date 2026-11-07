// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 能力三：多轮续跑的一致性。
 *
 * ## 被评测的真实链路（不是重实现）
 *
 * 续跑载体 = **CLI 会话落盘模块** `apps/cli/src/commands/session.ts`
 *   - `saveSession(session)`（session.ts:55-68，写 `$IHUI_CLI_SESSIONS_DIR/<id>.json`）
 *   - `loadSession(id)`（session.ts:70-83，从同一目录读回）
 *   - 这正是 headless `--resume` 的同源链路：`apps/cli/src/index.ts:293-303`
 *     的 `--resume` 分支调用 `loadSession(opts.resume)`，再把 `session.history`
 *     装配进本轮会话（index.ts:398-403）。
 *   落盘映射与真实写盘点保持一致：`apps/cli/src/commands/agent.ts:3402-3414`
 *   在 runAgent 的 finally 里执行 `messages.filter(role!=='system').map(m => ({id, role, content}))`
 *   后 `saveSession(opts.session)` —— 完成/错误/中断三条出口都会走到这里。
 *   重载后的再装配按 `apps/cli/src/server/agent-core.ts:178-205`
 *   （`[system, ...loaded.history, 新 user]`）。
 *
 * 为什么选这条、不选 `apps/cli/src/sessions/state-store.ts`：
 *   state-store 服务于 REPL/服务端的新版状态快照，但 `--resume` 命令本身经
 *   index.ts → commands/session.ts 取历史，因此本 suite 取与 `--resume` 同源的 session.ts。
 *   两条链路都只持久化 role/content（REPL 的 `messages.push` 同样只写 role/content），
 *   真实的落盘形态里没有 `tool_call_id` 字段。按"以真实行为改写断言"的要求，
 *   `resume.tool pair 完整性` 在本题里落成：
 *   ① 重载后每条历史工具结果块（`[工具结果 ✓|✗] <tool>`，formatToolResult 的唯一形态）
 *      与落盘前逐条一致；② 工具结果块数与已完成工具调用数严格 1:1；
 *   ③ 续跑首请求里历史工具结果块既不少也不重复。
 *
 * 评测覆盖的是「状态落盘 → 丢弃进程内对象 → 从磁盘重新加载 → 继续推理」这一段
 * 真实行为；模型输出由 `replay.ts` 的录制回放钉死，全程无网络、无时间戳入证据、
 * 无随机 id（写入磁盘的 id 用稳定序号，真实代码的 randomUUID 不承载语义）。
 */
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'

import { loadSession, saveSession, type ChatMessage, type Session } from '@cli/commands/session.js'
import { resetInjectionLedger } from '@cli/utils/prompt-injection-registry.js'

import { loadRecording, loadWorkspaceSeed } from '../fixtures.js'
import {
  createCase,
  runTurn,
  type EvalMessage,
  type ToolCallRecord,
  type TurnOutcome,
} from '../harness.js'
import { stableStringify } from '../replay.js'
import type { CaseResult } from '../types.js'
import { seedWorkspace, snapshotWorkspace, TMP_DIR } from '../workspace.js'

const SYSTEM_PROMPT = '你是评测用助手,只依据已读取的文件内容回答。'

interface ResumeRoundSpec {
  prompt: string
  recordingRel: string
  maxIterations: number
}

interface ResumeCaseSpec {
  id: string
  workspaceRel: string
  /** 真实 Session.workspacePath 只做落盘字段；本评测不放绝对路径进任何证据 */
  sessionWorkspacePath: string
  rounds: ResumeRoundSpec[]
  /** 前多少轮后模拟中断落盘 */
  interruptAfter: number
  /** 中断点是否停在"工具结果已落盘、助手尚未收口"的半回合 */
  expectMidTurnInterrupt?: boolean
}

const ANSI_ESCAPE = /\u001b\[[0-9;]*m/g
const TOOL_RESULT_LINE = /\[工具结果 [✓✗]\] ([^\n]+)/g

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

/**
 * 正文哈希前抹掉 ANSI 颜色码、CRLF 与工作区绝对路径 —— 它们是终端/机器差异，
 * 不是续跑语义差异（评测要求证据里不出现绝对路径）。
 */
function canonicalBody(content: string, workspaceDir: string): string {
  let text = content.replace(ANSI_ESCAPE, '').replace(/\r\n/g, '\n')
  for (const variant of [
    workspaceDir,
    workspaceDir.replace(/\\/g, '/'),
    workspaceDir.replace(/\//g, '\\'),
  ]) {
    if (variant) text = text.split(variant).join('<workspace>')
  }
  return text
}

function toolResultNames(text: string): string[] {
  const names: string[] = []
  for (const match of text.matchAll(TOOL_RESULT_LINE)) names.push(match[1]!.trim())
  return names
}

function toolResultNamesInMessages(messages: ReadonlyArray<{ content: string }>): string[] {
  return messages.flatMap((message) => toolResultNames(message.content))
}

function callNames(calls: readonly ToolCallRecord[]): string[] {
  return calls.map((call) => call.name)
}

function callKey(call: ToolCallRecord): string {
  return `${call.name}|${stableStringify(call.arguments)}`
}

/**
 * 结构指纹：role 序列 + 每条正文哈希 + 工具调用名/参数哈希（键排序后整体 sha256）。
 * 不含 id / 时间 / 绝对路径；同一条对话在两次运行里必须逐字相同。
 */
function transcriptFingerprint(
  messages: ReadonlyArray<{ role: string; content: string }>,
  calls: readonly ToolCallRecord[],
  workspaceDir: string,
): string {
  return sha256(
    stableStringify({
      messages: messages.map((message) => ({
        role: message.role,
        body: sha256(canonicalBody(message.content, workspaceDir)),
      })),
      tool_calls: calls.map((call, index) => ({
        seq: `call-${String(index + 1).padStart(2, '0')}`,
        name: call.name,
        arguments: sha256(stableStringify(call.arguments)),
      })),
    }),
  )
}

/** 落盘形态（id 一律折成稳定序号；正文只留哈希） */
function historyShape(
  history: ReadonlyArray<{ role: string; content: string }>,
  workspaceDir: string,
): Array<{
  seq: string
  role: string
  body_sha256: string
}> {
  return history.map((message, index) => ({
    seq: `msg-${String(index + 1).padStart(3, '0')}`,
    role: message.role,
    body_sha256: sha256(canonicalBody(message.content, workspaceDir)),
  }))
}

function sessionsDirFor(caseId: string): string {
  return path.join(TMP_DIR, 'sessions', caseId.replace(/[^a-zA-Z0-9._-]/g, '_'))
}

/** 把 `IHUI_CLI_SESSIONS_DIR` 临时指向评测临时目录，避免碰本机 ~/.ihui */
function withSessionsDir<T>(dir: string, fn: () => T): T {
  const previous = process.env.IHUI_CLI_SESSIONS_DIR
  process.env.IHUI_CLI_SESSIONS_DIR = dir
  try {
    return fn()
  } finally {
    if (previous === undefined) delete process.env.IHUI_CLI_SESSIONS_DIR
    else process.env.IHUI_CLI_SESSIONS_DIR = previous
  }
}

interface PersistedSession {
  session: Session
  history: ChatMessage[]
  dir: string
}

/** 与 agent.ts:3402-3414 同形：过滤 system、补 id；id 换成稳定序号保证证据可比 */
function persistSession(
  spec: ResumeCaseSpec,
  messages: ReadonlyArray<EvalMessage>,
): PersistedSession {
  const history: ChatMessage[] = messages
    .filter((message) => message.role !== 'system')
    .map((message, index) => ({
      id: `msg-${String(index + 1).padStart(3, '0')}`,
      role: message.role as ChatMessage['role'],
      content: message.content,
    }))
  const session: Session = {
    id: `eval_${spec.id}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    workspacePath: spec.sessionWorkspacePath,
    modelId: 'eval-replay',
    history,
  }
  const dir = sessionsDirFor(spec.id)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  withSessionsDir(dir, () => saveSession(session))
  return { session, history, dir }
}

function reloadSession(persisted: PersistedSession): Session {
  const loaded = withSessionsDir(persisted.dir, () => loadSession(persisted.session.id))
  if (!loaded) throw new Error(`续跑失败：从 ${persisted.session.id}.json 重载返回 null`)
  return loaded
}

/** 重载后的续跑起点 = system + 磁盘历史 + 新一轮 prompt（agent-core.ts:178-205 同序） */
function resumeMessages(loaded: Session): EvalMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    ...loaded.history.map((message) => ({
      role: message.role as EvalMessage['role'],
      content: message.content,
    })),
  ]
}

async function runRound(
  caseId: string,
  workspacePath: string,
  messages: EvalMessage[],
  round: ResumeRoundSpec,
): Promise<TurnOutcome> {
  return runTurn({
    caseId,
    workspacePath,
    messages,
    recording: loadRecording(round.recordingRel),
    maxIterations: round.maxIterations,
  })
}

interface TurnSnapshot {
  messages: EvalMessage[]
  fingerprint: string
  calls: ToolCallRecord[]
}

async function runContinuousBaseline(spec: ResumeCaseSpec, dir: string): Promise<TurnSnapshot[]> {
  const snapshots: TurnSnapshot[] = []
  let messages: EvalMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }]
  const callsThroughTurn: ToolCallRecord[] = []
  for (const round of spec.rounds) {
    messages = [...messages, { role: 'user', content: round.prompt }]
    const outcome = await runRound(spec.id, dir, messages, round)
    messages = outcome.messages
    callsThroughTurn.push(...outcome.toolCalls)
    snapshots.push({
      messages: messages.map((message) => ({ ...message })),
      fingerprint: transcriptFingerprint(messages, callsThroughTurn, dir),
      calls: outcome.toolCalls.map((call) => ({ ...call })),
    })
  }
  return snapshots
}

async function runInterrupted(
  spec: ResumeCaseSpec,
  dir: string,
): Promise<{
  snapshots: TurnSnapshot[]
  persisted: PersistedSession
  loaded: Session
  resumedOutcome: TurnOutcome
  historicalCalls: ToolCallRecord[]
}> {
  let messages: EvalMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }]
  const allCalls: ToolCallRecord[] = []
  const snapshots: TurnSnapshot[] = []

  for (const round of spec.rounds.slice(0, spec.interruptAfter)) {
    messages = [...messages, { role: 'user', content: round.prompt }]
    const outcome = await runRound(spec.id, dir, messages, round)
    messages = outcome.messages
    allCalls.push(...outcome.toolCalls)
    snapshots.push({
      messages: messages.map((message) => ({ ...message })),
      fingerprint: transcriptFingerprint(messages, allCalls, dir),
      calls: outcome.toolCalls.map((call) => ({ ...call })),
    })
  }

  const historicalCalls = allCalls.map((call) => ({ ...call }))
  const persisted = persistSession(spec, messages)
  // 丢弃进程内对话对象：后续只允许从磁盘历史重建
  messages = []

  const loaded = reloadSession(persisted)
  let resumed: EvalMessage[] = resumeMessages(loaded)
  let resumedOutcome: TurnOutcome | null = null
  for (const round of spec.rounds.slice(spec.interruptAfter)) {
    resumed = [...resumed, { role: 'user', content: round.prompt }]
    const outcome = await runRound(spec.id, dir, resumed, round)
    resumed = outcome.messages
    allCalls.push(...outcome.toolCalls)
    snapshots.push({
      messages: resumed.map((message) => ({ ...message })),
      fingerprint: transcriptFingerprint(resumed, allCalls, dir),
      calls: outcome.toolCalls.map((call) => ({ ...call })),
    })
    if (resumedOutcome === null) resumedOutcome = outcome
  }
  if (resumedOutcome === null) throw new Error(`${spec.id}: 中断后没有剩余轮次可续跑`)

  return { snapshots, persisted, loaded, resumedOutcome, historicalCalls }
}

function requestMessages(
  outcome: TurnOutcome,
  index = 0,
): Array<{ role?: string; content?: unknown }> {
  const request = outcome.requests[index]
  const messages = request?.messages
  return Array.isArray(messages) ? (messages as Array<{ role?: string; content?: unknown }>) : []
}

function requestToolResultCount(outcome: TurnOutcome): number {
  const messages = requestMessages(outcome).map((message) => ({
    content:
      typeof message.content === 'string' ? message.content : JSON.stringify(message.content ?? ''),
  }))
  return toolResultNamesInMessages(messages).length
}

async function executeResumeCase(spec: ResumeCaseSpec): Promise<CaseResult> {
  resetInjectionLedger()
  const builder = createCase(spec.id, 'resume')
  const seed = loadWorkspaceSeed(spec.workspaceRel)
  const normalizedSeed: Record<string, string> = {}
  for (const [rel, content] of Object.entries(seed))
    normalizedSeed[rel] = content.replace(/\r\n/g, '\n')
  const dir = seedWorkspace(spec.id, seed)

  const baseline = await runContinuousBaseline(spec, dir)
  resetInjectionLedger()
  const interrupted = await runInterrupted(spec, dir)

  const roundCount = spec.rounds.length
  const consistent = interrupted.snapshots.reduce(
    (count, snapshot, index) =>
      snapshot.fingerprint === baseline[index]?.fingerprint ? count + 1 : count,
    0,
  )
  const finalFingerprintsMatch =
    baseline[roundCount - 1]!.fingerprint === interrupted.snapshots[roundCount - 1]!.fingerprint

  const persistedHistory = interrupted.persisted.history
  const loadedHistory = interrupted.loaded.history
  const persistedNames = toolResultNamesInMessages(persistedHistory)
  const restoredNames = toolResultNamesInMessages(loadedHistory)
  const historicalNames = callNames(interrupted.historicalCalls)

  const resumedCalls = interrupted.resumedOutcome.toolCalls
  const historicalKeys = new Set(interrupted.historicalCalls.map(callKey))
  const duplicateCalls = resumedCalls.filter((call) => historicalKeys.has(callKey(call)))

  const workspaceAfter = snapshotWorkspace(dir)

  builder.check(
    '落盘前每条工具结果块与已完成调用一一对应',
    persistedNames.join('|') === historicalNames.join('|'),
    { blocks: persistedNames, calls: historicalNames },
  )
  builder.check(
    '重新加载后消息条数与落盘前一致',
    loadedHistory.length === persistedHistory.length &&
      loadedHistory.length ===
        interrupted.snapshots[spec.interruptAfter - 1]!.messages.filter((m) => m.role !== 'system')
          .length,
    { persisted: persistedHistory.length, restored: loadedHistory.length },
  )
  builder.check(
    '重新加载后 role + 正文逐条一致',
    stableStringify(historyShape(loadedHistory, dir)) ===
      stableStringify(historyShape(persistedHistory, dir)),
    historyShape(loadedHistory, dir),
  )
  builder.check(
    '重新加载后历史工具结果块完整（数量与顺序不变）',
    restoredNames.length === historicalNames.length &&
      restoredNames.join('|') === historicalNames.join('|'),
    { blocks: restoredNames, calls: historicalNames },
  )
  builder.check(
    '续跑首请求带回了全部历史工具结果且不重复',
    requestToolResultCount(interrupted.resumedOutcome) === historicalNames.length,
    {
      inRequest: requestToolResultCount(interrupted.resumedOutcome),
      expected: historicalNames.length,
    },
  )
  builder.check('续跑没有重复执行已完成的工具调用', duplicateCalls.length === 0, duplicateCalls)
  builder.check('逐轮结构指纹与未中断基线逐字相等', consistent === roundCount, {
    baseline: baseline.map((snapshot) => snapshot.fingerprint),
    interrupted: interrupted.snapshots.map((snapshot) => snapshot.fingerprint),
  })
  builder.check('最终 messages 结构指纹相等', finalFingerprintsMatch, {
    baseline: baseline[roundCount - 1]!.fingerprint,
    interrupted: interrupted.snapshots[roundCount - 1]!.fingerprint,
  })
  builder.check(
    '续跑回合正常收口',
    interrupted.resumedOutcome.result.stopReason === 'end_turn',
    interrupted.resumedOutcome.result.stopReason,
  )
  if (spec.expectMidTurnInterrupt === true) {
    const midTurn = interrupted.snapshots[spec.interruptAfter - 1]!
    builder.check(
      '中断点停在半回合：工具对已执行、助手尚未收口',
      midTurn.calls.length === 2 && midTurn.messages[midTurn.messages.length - 1]!.role === 'user',
      {
        calls: callNames(midTurn.calls),
        lastRole: midTurn.messages[midTurn.messages.length - 1]?.role,
      },
    )
  }
  builder.check(
    '只读任务未改动种子工作区',
    stableStringify(workspaceAfter) === stableStringify(normalizedSeed),
    Object.keys(workspaceAfter),
  )

  builder.metric('resume.consistent_turns', consistent)
  builder.metric('resume.restored_messages', loadedHistory.length)
  builder.metric('resume.resumed_tool_calls', resumedCalls.length)
  builder.metric('resume.duplicate_side_effects', duplicateCalls.length)
  builder.metric('resume.transcript_hash_match', finalFingerprintsMatch)

  builder.evidence(
    'turns',
    baseline.map((snapshot, index) => ({
      turn: index + 1,
      message_count: snapshot.messages.length,
      roles: snapshot.messages.map((message) => message.role),
      tool_calls: snapshot.calls.map((call, callIndex) => ({
        seq: `call-${String(callIndex + 1).padStart(2, '0')}`,
        name: call.name,
        arguments_sha256: sha256(stableStringify(call.arguments)),
      })),
      fingerprint: snapshot.fingerprint,
    })),
  )
  builder.evidence('session', {
    persisted_messages: persistedHistory.length,
    restored_messages: loadedHistory.length,
    persisted_shape: historyShape(persistedHistory, dir),
    restored_shape: historyShape(loadedHistory, dir),
    historical_tool_calls: interrupted.historicalCalls.map((call, index) => ({
      seq: `call-${String(index + 1).padStart(2, '0')}`,
      name: call.name,
    })),
    restored_tool_result_names: restoredNames,
  })
  builder.evidence('resumed_turn', {
    tool_calls: resumedCalls.map((call, index) => ({
      seq: `call-${String(index + 1).padStart(2, '0')}`,
      name: call.name,
      arguments_sha256: sha256(stableStringify(call.arguments)),
    })),
    duplicate_side_effects: duplicateCalls.length,
    request_tool_result_blocks: requestToolResultCount(interrupted.resumedOutcome),
    stop_reason: interrupted.resumedOutcome.result.stopReason,
  })
  builder.evidence('fingerprints', {
    baseline: baseline.map((snapshot) => snapshot.fingerprint),
    interrupted: interrupted.snapshots.map((snapshot) => snapshot.fingerprint),
    consistent_turns: consistent,
    final_match: finalFingerprintsMatch,
  })
  builder.evidence('workspace_files', Object.keys(workspaceAfter).sort())

  return builder.finish()
}

const PERSIST_RELOAD_CONTINUE: ResumeCaseSpec = {
  id: 'resume.persist-reload-continue',
  workspaceRel: 'resume-checkpoint',
  sessionWorkspacePath: 'resume-checkpoint',
  interruptAfter: 2,
  rounds: [
    {
      prompt: '读取 notes.md，告诉我文件里的口令。',
      recordingRel: 'resume/persist-reload-continue/turn1',
      maxIterations: 3,
    },
    {
      prompt: '再读 todo.txt，数一下待办条目。',
      recordingRel: 'resume/persist-reload-continue/turn2',
      maxIterations: 3,
    },
    {
      prompt: '列出工作区文件，并复述口令。',
      recordingRel: 'resume/persist-reload-continue/turn3',
      maxIterations: 3,
    },
  ],
}

const MID_TURN_TOOL_PAIR: ResumeCaseSpec = {
  id: 'resume.mid-turn-tool-pair',
  workspaceRel: 'resume-mid-turn-pair',
  sessionWorkspacePath: 'resume-mid-turn-pair',
  interruptAfter: 2,
  expectMidTurnInterrupt: true,
  rounds: [
    {
      prompt: '把 notes.md 和 todo.txt 一起读一下。',
      recordingRel: 'resume/mid-turn-tool-pair/turn1',
      maxIterations: 3,
    },
    {
      prompt: '再同时看一下 plan.md 的阶段和目录结构。',
      recordingRel: 'resume/mid-turn-tool-pair/turn2',
      // 半回合中断：本轮只跑一次模型调用，两个工具结果落盘后循环按轮次上限收口
      maxIterations: 1,
    },
    {
      prompt: '把刚才的结果汇总，并读 summary.md 核对。',
      recordingRel: 'resume/mid-turn-tool-pair/turn3',
      maxIterations: 3,
    },
  ],
}

export async function persistReloadContinueCase(): Promise<CaseResult> {
  return executeResumeCase(PERSIST_RELOAD_CONTINUE)
}

export async function midTurnToolPairCase(): Promise<CaseResult> {
  return executeResumeCase(MID_TURN_TOOL_PAIR)
}

export async function run(): Promise<CaseResult[]> {
  return [await persistReloadContinueCase(), await midTurnToolPairCase()]
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
