// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder CLI 桥接式 executeChat(2026-10-23 立)。
 *
 * 立因:Qoder CN 的 chat 上游(POST gateway.qoder.com.cn .../sse/agent_chat_generation,
 * SSE 响应、错误包在 data:{headers,body,statusCodeValue} wrapper)要求内嵌 HMAC/wasm
 * 计算的 Signature 头,服务端无法复现(直连实证 403 "Signature invalid")⇒ HTTP 直连被否决。
 * 唯一可行通路:spawn Qoder 官方 CLI,用其 SDK 的 query() 拿流(已实证,参考
 * .ihui-agent/tmp/qoder-chat-probe/run/test-query.mjs,勿改动该探测产物)。
 *
 * 进程协议(spawn process.execPath 跑 scripts/qoder-chat-runner.mjs,NDJSON 逐行):
 * - stdin:一行 JSON 请求 {prompt, cwd, model, configDir, sdkPath, cliPath};
 * - stdout:逐行 JSON(原样转发 SDK query() 的消息),由 translateRunnerMessage
 *   翻译为 OpenAI chat.completion.chunk 序列;result 终态后 runner 自行退出。
 *
 * 纪律(不冒充可用):
 * - env/文件缺失 ⇒ 抛 QoderBridgeError(statusCode 0)让调度按 network 冷却自愈,
 *   绝不假成功;
 * - 路径 env 可覆写(QODER_BRIDGE_RUNNER/QODER_SDK_PATH/QODER_CLI_PATH/
 *   QODER_CONFIG_DIR|QODERCN_CONFIG_DIR);production 必须显式 env,非 production
 *   才允许实证默认值(runner = 本包 scripts,SDK/CLI = 探测产物目录,登录态 = 本机
 *   .qoder-cn)——CLI exe 与登录态永不入库;
 * - CLI 单登录态 ⇒ 模块级互斥锁,同一时刻只允许一个在飞会话(等锁可被 signal 取消);
 * - generator 结束/abort/异常一律 kill 子进程(Windows 下 taskkill /T 整树防孤儿)。
 */
import { spawn as nodeSpawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isProductionGuard } from '../../config/index.js'
import type { NormalizedChatRequest } from '../relay-upstream-adapters.js'

// =============================================================================
// 错误与状态
// =============================================================================

/** 桥接失败(带 HTTP 语义状态码;转发层据此入调度分类) */
export class QoderBridgeError extends Error {
  readonly statusCode: number
  constructor(statusCode: number, message: string) {
    super(message.slice(0, 500))
    this.name = 'QoderBridgeError'
    this.statusCode = statusCode
  }
}

/**
 * CLI/SDK 失败文本 → 状态码:登录态问题如实上报 401(调度按 session_dead 摘除),
 * 其余归 0 = network 类(60s 冷却自愈,不误伤号)。
 */
function statusCodeForBridgeFailure(text: string): number {
  return /\b401\b|unauthorized|unauthori[sz]ed|not logged in|log ?in (required|expired)|please [^.]*log ?in|authentication (failed|expired)|token (expired|invalid|missing)|session (expired|invalid)|登录|未登录|鉴权|凭证过期/i.test(
    text,
  )
    ? 401
    : 0
}

// =============================================================================
// 路径解析与门控
// =============================================================================

const PROBE_RUN_REL = join('.ihui-agent', 'tmp', 'qoder-chat-probe', 'run')

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))

function up(levels: number): string {
  let p = MODULE_DIR
  for (let i = 0; i < levels; i += 1) p = dirname(p)
  return p
}

/** 包根(apps/api;src 与 dist 同深度) */
const APP_DIR = up(3)
/** 仓库根(src|dist → services → src|dist → api → apps → root) */
const REPO_ROOT = up(5)

export interface QoderBridgePaths {
  runnerPath: string
  sdkPath: string
  cliPath: string
  configDir: string
}

function envPath(name: string): string {
  return process.env[name]?.trim() || ''
}

/** 路径解析:env 覆写优先;非 production 才允许实证默认值(production 留空 ⇒ 预检报未配置) */
function resolveQoderBridgePaths(): QoderBridgePaths {
  const nonProd = !isProductionGuard
  const probe = (...segs: string[]): string =>
    nonProd ? join(REPO_ROOT, PROBE_RUN_REL, ...segs) : ''
  return {
    runnerPath: envPath('QODER_BRIDGE_RUNNER') || join(APP_DIR, 'scripts', 'qoder-chat-runner.mjs'),
    sdkPath: envPath('QODER_SDK_PATH') || probe('sdk-main.mjs'),
    cliPath: envPath('QODER_CLI_PATH') || probe('cli', 'qoderclicn.exe'),
    configDir:
      envPath('QODER_CONFIG_DIR') ||
      envPath('QODERCN_CONFIG_DIR') ||
      (nonProd ? 'C:/Users/Administrator/.qoder-cn' : ''),
  }
}

/**
 * CLI 通路门控(qoder-adapter 模块加载时判定,决定路径 ② 是否挂载):
 * - QODER_BRIDGE_ENABLED=1 显式开 / =0 显式关;
 * - 未显式表态时 production 一律关(生产必须显式 env,防误走探测默认路径);
 * - 其余(非生产)按 runner/SDK/CLI 路径齐备(存在)判定。
 * 注意:=0 同时是 chat 总开关(常驻桥也一并关闭),见 qoder-adapter 的 QODER_CHAT_DISABLED。
 */
export function isQoderBridgeEnabled(): boolean {
  const flag = process.env.QODER_BRIDGE_ENABLED?.trim()
  if (flag === '1') return true
  if (flag === '0') return false
  if (isProductionGuard) return false
  const p = resolveQoderBridgePaths()
  return (
    p.runnerPath !== '' &&
    p.sdkPath !== '' &&
    p.cliPath !== '' &&
    existsSync(p.runnerPath) &&
    existsSync(p.sdkPath) &&
    existsSync(p.cliPath)
  )
}

/** 调用前预检:任何缺失一律抛 statusCode 0(未配置/CLI 缺失,不冒充可用) */
export function preflightQoderBridge(): QoderBridgePaths {
  const p = resolveQoderBridgePaths()
  const missing: string[] = []
  if (p.runnerPath === '' || !existsSync(p.runnerPath)) {
    missing.push(`runner=${p.runnerPath || '(未配置 QODER_BRIDGE_RUNNER)'}`)
  }
  if (p.sdkPath === '' || !existsSync(p.sdkPath)) {
    missing.push(`sdk=${p.sdkPath || '(未配置 QODER_SDK_PATH)'}`)
  }
  if (p.cliPath === '' || !existsSync(p.cliPath)) {
    missing.push(`cli=${p.cliPath || '(未配置 QODER_CLI_PATH)'}`)
  }
  if (p.configDir === '') missing.push('configDir=(未配置 QODER_CONFIG_DIR/QODERCN_CONFIG_DIR)')
  if (missing.length > 0) {
    throw new QoderBridgeError(
      0,
      `Qoder CLI 桥接未配置或文件缺失: ${missing.join('; ')}。` +
        '生产须设 QODER_BRIDGE_ENABLED=1 与 QODER_BRIDGE_RUNNER/QODER_SDK_PATH/QODER_CLI_PATH/' +
        'QODER_CONFIG_DIR(CLI exe 与 SDK 不入库:取自 Qoder IDE 安装目录或既有探测产物 ' +
        '.ihui-agent/tmp/qoder-chat-probe/run)',
    )
  }
  return p
}

// =============================================================================
// prompt 渲染(CLI SDK 只收单串 prompt)
// =============================================================================

function collectText(container: Record<string, unknown>): string {
  if (typeof container['text'] === 'string') return container['text']
  if (typeof container['delta'] === 'string') return container['delta']
  const content = container['content']
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    const parts: string[] = []
    for (const raw of content) {
      if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
        const text = (raw as Record<string, unknown>)['text']
        if (typeof text === 'string') parts.push(text)
      }
    }
    return parts.join('')
  }
  return ''
}

function contentText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    const parts: string[] = []
    for (const raw of content) {
      const text = contentText(raw)
      if (text !== '') parts.push(text)
    }
    return parts.join('')
  }
  if (content !== null && typeof content === 'object') {
    return collectText(content as Record<string, unknown>)
  }
  if (content === null || content === undefined) return ''
  return String(content)
}

/** NormalizedChatRequest.messages → CLI 单串 prompt([role] 分段;空请求如实报 400) */
export function renderQoderPrompt(req: NormalizedChatRequest): string {
  const blocks: string[] = []
  for (const m of req.messages) {
    const text = contentText(m.content).trim()
    if (text === '') continue
    const role = typeof m.role === 'string' && m.role !== '' ? m.role : 'user'
    blocks.push(`[${role}]\n${text}`)
  }
  const prompt = blocks.join('\n\n')
  if (prompt === '') {
    throw new QoderBridgeError(400, 'Qoder CLI 桥接: 渲染后的 prompt 为空(请求无可用文本消息)')
  }
  return prompt
}

// =============================================================================
// 并发互斥(CLI 单登录态:同刻只允许一个在飞会话;等锁可被 signal 取消)
// =============================================================================

let bridgeLockTail: Promise<void> = Promise.resolve()

function abortError(): Error {
  const e = new Error('Qoder CLI 桥接: 等待互斥锁被取消')
  e.name = 'AbortError'
  return e
}

async function waitPrev(prev: Promise<void>, signal: AbortSignal | undefined): Promise<void> {
  if (!signal) return prev
  if (signal.aborted) throw abortError()
  let onAbort: (() => void) | undefined
  try {
    await Promise.race([
      prev,
      new Promise<never>((_, reject) => {
        onAbort = () => reject(abortError())
        signal.addEventListener('abort', onAbort, { once: true })
      }),
    ])
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort)
  }
}

/**
 * 取锁:返回 release(调用方 finally 必调)。取消/异常路径直接放行本槽位,
 * 队列(bridgeLockTail)只在 release 后前进 ⇒ FIFO 串行且不死锁。
 */
function acquireBridgeLock(signal: AbortSignal | undefined): Promise<() => void> {
  const prev = bridgeLockTail
  let releaseSlot: () => void = () => {}
  const slot = new Promise<void>((resolve) => {
    releaseSlot = resolve
  })
  bridgeLockTail = prev.then(() => slot)
  return (async () => {
    try {
      await waitPrev(prev, signal)
      return releaseSlot
    } catch (e) {
      releaseSlot()
      throw e
    }
  })()
}

// =============================================================================
// 子进程最小接口(测试注入假 spawn 只需实现这几员)
// =============================================================================

export interface BridgeChild {
  stdin: { write: (chunk: string) => unknown } | null
  stdout: AsyncIterable<unknown> | null
  stderr: AsyncIterable<unknown> | null
  kill: (signal?: NodeJS.Signals) => boolean
  pid?: number
  once?: (event: string, listener: (...args: unknown[]) => void) => unknown
}

export type BridgeSpawn = (
  command: string,
  args: string[],
  options: Record<string, unknown>,
) => BridgeChild

const defaultSpawn: BridgeSpawn = (command, args, options) =>
  nodeSpawn(command, args, options) as unknown as BridgeChild

/** 杀子进程:Windows 下先 taskkill /T 整树(SDK 在 runner 内再 spawn 的 CLI 会成孤儿),再 kill 兜底 */
function killBridgeChild(child: BridgeChild): void {
  try {
    if (process.platform === 'win32' && typeof child.pid === 'number' && child.pid > 0) {
      const killer = nodeSpawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      })
      killer.unref?.()
    }
  } catch {
    /* 尽力而为:进程可能已退出 */
  }
  try {
    child.kill()
  } catch {
    /* 已退出 */
  }
}

// =============================================================================
// NDJSON 读取与消息翻译
// =============================================================================

async function* readLines(stream: AsyncIterable<unknown>): AsyncGenerator<string> {
  const decoder = new TextDecoder()
  let buf = ''
  for await (const chunk of stream) {
    buf += typeof chunk === 'string' ? chunk : decoder.decode(chunk as Uint8Array, { stream: true })
    let nl = buf.indexOf('\n')
    while (nl >= 0) {
      yield buf.slice(0, nl).replace(/\r$/, '')
      buf = buf.slice(nl + 1)
      nl = buf.indexOf('\n')
    }
  }
  buf += decoder.decode()
  const tail = buf.replace(/\r$/, '')
  if (tail !== '') yield tail
}

async function drainStderr(
  stream: AsyncIterable<unknown>,
  sink: (tail: string) => void,
): Promise<void> {
  const decoder = new TextDecoder()
  let buf = ''
  try {
    for await (const chunk of stream) {
      buf +=
        typeof chunk === 'string' ? chunk : decoder.decode(chunk as Uint8Array, { stream: true })
      if (buf.length > 8192) buf = buf.slice(-8192)
      sink(buf)
    }
  } catch {
    /* kill 关闭 stderr 属预期 */
  }
}

export interface RunnerTranslateState {
  id: string
  model: string
  created: number
  finished: boolean
}

export function createRunnerTranslateState(model: string): RunnerTranslateState {
  return {
    id: `chatcmpl-qoder-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    model,
    created: Math.floor(Date.now() / 1000),
    finished: false,
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

function chunkBase(state: RunnerTranslateState): Record<string, unknown> {
  return {
    id: state.id,
    object: 'chat.completion.chunk',
    created: state.created,
    model: state.model,
  }
}

function assistantText(msg: Record<string, unknown>): string {
  const own = collectText(msg)
  if (own !== '') return own
  const nested = asRecord(msg['message'])
  return nested ? collectText(nested) : ''
}

function usageOf(msg: Record<string, unknown>): Record<string, number> | null {
  const u = asRecord(msg['usage'])
  if (!u) return null
  const num = (...keys: string[]): number | null => {
    for (const k of keys) {
      const v = u[k]
      if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v)
    }
    return null
  }
  const input = num('input_tokens', 'prompt_tokens')
  const output = num('output_tokens', 'completion_tokens')
  if (input === null && output === null) return null
  const prompt = input ?? 0
  const completion = output ?? 0
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: prompt + completion,
  }
}

function resultFailureMessage(msg: Record<string, unknown>): string {
  if (typeof msg['result'] === 'string' && msg['result'] !== '') return msg['result']
  if (typeof msg['message'] === 'string' && msg['message'] !== '') return msg['message']
  const errors = msg['errors']
  if (Array.isArray(errors) && errors.length > 0) return JSON.stringify(errors).slice(0, 300)
  return `subtype=${String(msg['subtype'])}`
}

/**
 * runner 一行 JSON(SDK query() 消息)→ OpenAI chunk 序列。
 * 终态(result success)追加 usage(可得时)+ finish 帧并置 state.finished;
 * 错误消息/失败终态抛 QoderBridgeError(登录类 401,其余 0)。
 */
export function translateRunnerMessage(
  msg: unknown,
  state: RunnerTranslateState,
): Array<Record<string, unknown>> {
  const m = asRecord(msg)
  if (!m) return []
  const type = m['type']
  if (type === 'error') {
    const message = typeof m['message'] === 'string' ? m['message'] : JSON.stringify(m)
    throw new QoderBridgeError(
      statusCodeForBridgeFailure(message),
      `Qoder CLI 桥接错误: ${message}`,
    )
  }
  if (type === 'assistant') {
    const text = assistantText(m)
    const failed = m['isApiErrorMessage'] === true
    if (failed) {
      const message = text !== '' ? text : 'Qoder CLI 返回 assistant 错误消息'
      throw new QoderBridgeError(
        statusCodeForBridgeFailure(message),
        `Qoder CLI 桥接错误: ${message}`,
      )
    }
    if (text === '') return []
    return [
      {
        ...chunkBase(state),
        choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
      },
    ]
  }
  if (type === 'result') {
    const subtype = m['subtype']
    if (subtype !== 'success' || m['is_error'] === true) {
      const message = resultFailureMessage(m)
      throw new QoderBridgeError(
        statusCodeForBridgeFailure(message),
        `Qoder CLI 对话失败(${String(subtype)}): ${message}`,
      )
    }
    const chunks: Array<Record<string, unknown>> = []
    const usage = usageOf(m)
    if (usage) chunks.push({ ...chunkBase(state), choices: [], usage })
    chunks.push({
      ...chunkBase(state),
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    })
    state.finished = true
    return chunks
  }
  // system(init)/user 回显/stream_event 等:翻译层不消费
  return []
}

// =============================================================================
// 主流程:spawn runner → NDJSON → OpenAI chunk 流
// =============================================================================

export interface QoderCliChatOptions {
  prompt: string
  model?: string
  cwd?: string
  signal?: AbortSignal
  /** spawn 注入(测试假子进程);缺省 node:child_process.spawn */
  spawnImpl?: BridgeSpawn
}

function listenExit(child: BridgeChild): Promise<{ code: number | null }> | null {
  const once = child.once
  if (!once) return null
  return new Promise((resolve) => {
    once.call(child, 'close', (...args: unknown[]) => {
      const code = args[0]
      resolve({ code: typeof code === 'number' ? code : null })
    })
  })
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false
    p.then(
      (v) => {
        settled = true
        resolve(v)
      },
      () => {
        settled = true
        resolve(null)
      },
    )
    const timer = setTimeout(() => {
      if (!settled) resolve(null)
    }, ms)
    timer.unref?.()
  })
}

/**
 * 执行一次桥接对话,产出 OpenAI chunk 异步序列(转发层 chunksToSseResponse 直接消费)。
 * 预检/互斥/收尾杀进程均在 generator 内:首次 next() 才起进程,
 * return/throw/abort 一律经 finally 杀子进程并放锁。
 */
export async function* qoderCliChatChunks(
  opts: QoderCliChatOptions,
): AsyncGenerator<Record<string, unknown>> {
  const paths = preflightQoderBridge()
  const release = await acquireBridgeLock(opts.signal)
  let spawned: BridgeChild | null = null
  let onAbort: (() => void) | undefined
  let stderrTail = ''
  try {
    const spawnFn = opts.spawnImpl ?? defaultSpawn
    const cwd = opts.cwd ?? process.cwd()
    const child = spawnFn(process.execPath, [paths.runnerPath], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: process.env,
    })
    spawned = child
    if (!child.stdin) {
      throw new QoderBridgeError(0, 'Qoder CLI 桥接: 子进程 stdin 不可用')
    }
    const request = JSON.stringify({
      prompt: opts.prompt,
      cwd,
      model: opts.model ?? 'auto',
      configDir: paths.configDir,
      sdkPath: paths.sdkPath,
      cliPath: paths.cliPath,
    })
    try {
      child.stdin.write(`${request}\n`)
    } catch (e) {
      throw new QoderBridgeError(
        0,
        `Qoder CLI 桥接: 写入请求失败(runner 未启动?): ${e instanceof Error ? e.message : String(e)}`,
      )
    }

    if (opts.signal) {
      onAbort = () => killBridgeChild(child)
      if (opts.signal.aborted) onAbort()
      else opts.signal.addEventListener('abort', onAbort, { once: true })
    }
    if (child.stderr) void drainStderr(child.stderr, (tail) => (stderrTail = tail))
    const closed = listenExit(child)
    if (!child.stdout) {
      throw new QoderBridgeError(0, 'Qoder CLI 桥接: 子进程 stdout 不可用')
    }

    const state = createRunnerTranslateState(opts.model ?? 'auto')
    for await (const line of readLines(child.stdout)) {
      if (line.trim() === '') continue
      let msg: unknown
      try {
        msg = JSON.parse(line)
      } catch {
        continue // runner 只写 NDJSON;脏行忽略不中断
      }
      if (opts.signal?.aborted) break
      for (const chunk of translateRunnerMessage(msg, state)) yield chunk
      if (state.finished) break
    }

    if (opts.signal?.aborted) return // 客户端断开/被取消:静默收尾(子进程已杀)
    if (state.finished) return
    const exit = closed ? await withTimeout(closed, 3000) : null
    const detail = stderrTail !== '' ? `; stderr: ${stderrTail}` : ''
    throw new QoderBridgeError(
      statusCodeForBridgeFailure(stderrTail),
      `Qoder CLI 桥接: runner 结束但未产生 result 终态(exit=${
        exit ? String(exit.code) : '未知'
      })${detail}`,
    )
  } finally {
    if (opts.signal && onAbort) opts.signal.removeEventListener('abort', onAbort)
    if (spawned) killBridgeChild(spawned)
    release()
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
