#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder 常驻 chat 桥 —— 把官方 Agent SDK 包装成 OpenAI 兼容 HTTP 端点。
 *
 * 为什么需要桥（2026-10-23 实证）：
 * - chat 真实端点 POST /algo/api/v2/service/pro/sse/agent_chat_generation 要求 **umid 设备签名**，
 *   签名由 resources/umid/runtime-info.exe + sgsdk.dll 生成，外部不可复刻。
 * - 官方 SDK（@qoder-ai/qoder-cn-agent-sdk，包内真名 @ali/qodercn-agent-sdk-next）的 worker
 *   自己会走 umid 签名 ⇒ 唯一可持续通路。
 * - 鉴权走 **jobToken**（= worker 侧 applyExternalToken(token,"host-job-token")），
 *   即 IDE 把 device token 交给 worker 的官方通道：**不需要 PAT、不需要浏览器授权**。
 *
 * 安全红线：
 * - `options.tools = []` 必须显式传（实测：init 帧 tools=[] 且模型照常作答）。
 *   不传则默认挂 Agent/Bash/Edit/Write 等 18 个工具，上游模型可能在本机真的执行命令。
 * - cwd 必须是**干净空目录**：worker 会自动读取 cwd 下的 AGENTS.md / 项目上下文喂给上游
 *   （实测在 D:/IHUI-AI 触发 AGENTS_MD_SIZE_THRESHOLD_REACHED，96KB）。
 * - 只监听 127.0.0.1，并要求 X-Qoder-Bridge-Key 与启动时下发的随机 key 一致。
 *
 * 协议（OpenAI 兼容子集）：
 *   POST /v1/chat/completions   {model, messages, stream, ...} → chat.completion | SSE
 *   GET  /healthz               → {ok, pid, sdk, uptime_ms, inflight}
 *
 * 用法（父进程据此拉起）：
 *   ELECTRON_RUN_AS_NODE=1 "Qoder CN.exe" <this> --port 0 --key <random> --cwd <clean dir>
 *   启动成功后 stdout 打一行：QODER_BRIDGE_READY {"port":12345,"pid":...}
 *
 * 说明：上游不返回 token 计量（usage 恒为 0），只返回 credits 计费。
 *      本桥**如实透传 0** 并把 credits 放进 x_qoder_credits，绝不编造 token 数。
 *
 * 2026-10-23 计量取证结论（三层全量转储，见 outputs/qoder-usage-*-*.json）：
 *   ① SDK 帧 schema 齐全 —— assistant/result 帧带 Anthropic 式 usage
 *      (input_tokens/output_tokens/cache_read_input_tokens/cache_creation_*)、
 *      modelUsage{<model>:{inputTokens,...,credits}}、total_cost_usd、total_credits；
 *      但**网关恒填 0**（worker 自身日志 `model.response.completed input_tokens=0 ...` 同为零，
 *      换 auto/kmodel/qmodel_38max 均 0），故零值源头在上游解码层，不是本桥丢字段。
 *   ② 配额端点 GET /api/v2/quota/usage 回 usageType="credits"，
 *      只有 userQuota/addOnQuota 的 credits 总数/已用/剩余；7 个候选 token 计量端点全 404。
 *   ③ 官方 IDE 包内消费的也仅 credits 字段（userQuota/addOnQuota/totalUsagePercentage），
 *      全站无 token 计量 UI —— 产品口径就是积分，不暴露 token。
 *   ④ usage.context_usage_ratio 存在但**不是真实 token 数**：与 prompt 字数严格线性
 *      且恒为 2 字符/token（0.01392→0.033925→0.093925 对应 7/8008/32008 字），
 *      属本地启发式估算 ⇒ 只原样透传，绝不拿它反推 prompt_tokens。
 *   结论：唯一真实可得的计量是 credits（含 original_credits/billable/request_id）。
 */
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

// ───────────────────────────── 参数 ─────────────────────────────
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback
}

const PORT = Number(arg('port', process.env.QODER_BRIDGE_PORT || 0))
const KEY = arg('key', process.env.QODER_BRIDGE_KEY || '')
const CLEAN_CWD = arg('cwd', process.env.QODER_BRIDGE_CWD || '')
const MAX_CONCURRENCY = Number(process.env.QODER_BRIDGE_MAX_CONCURRENCY || 4)
const REQUEST_TIMEOUT_MS = Number(process.env.QODER_BRIDGE_TIMEOUT_MS || 180000)

/** 候选安装根目录（env 优先） */
const APP_DIR_CANDIDATES = [
  process.env.QODER_APP_DIR,
  'D:/电脑软件/Qoder CN',
  'C:/Program Files/Qoder CN',
  'C:/Program Files (x86)/Qoder CN',
].filter(Boolean)

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

function isFile(p) {
  try {
    return fs.statSync(p).isFile()
  } catch {
    return false
  }
}

function resolveRuntimeRoot() {
  for (const dir of APP_DIR_CANDIDATES) {
    if (!isDir(dir)) continue
    const versionsDir = path.join(dir, '.qoder-versions')
    if (isDir(versionsDir)) {
      const vers = fs
        .readdirSync(versionsDir)
        .filter((v) => /^\d+\.\d+\.\d+$/.test(v))
        .sort((a, b) => {
          const pa = a.split('.').map(Number)
          const pb = b.split('.').map(Number)
          for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pb[i] - pa[i]
          return 0
        })
      for (const v of vers) {
        const root = path.join(versionsDir, v)
        if (isFile(path.join(root, 'Qoder CN.exe'))) return { root, version: v }
      }
    }
    if (isFile(path.join(dir, 'Qoder CN.exe'))) return { root: dir, version: 'unknown' }
  }
  return null
}

// ─────────────────── 非 Electron：自举为 Electron-as-Node ───────────────────
if (!process.versions.electron) {
  const rt = resolveRuntimeRoot()
  if (!rt) {
    console.error('QODER_APP_NOT_FOUND: 未找到 Qoder CN 安装（设置 QODER_APP_DIR）')
    process.exit(3)
  }
  const exe = path.join(rt.root, 'Qoder CN.exe')
  const child = spawn(exe, [process.argv[1], ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  })
  child.on('exit', (c) => process.exit(c ?? 0))
  process.on('SIGTERM', () => child.kill('SIGTERM'))
  process.on('SIGINT', () => child.kill('SIGINT'))
  // 阻塞等待子进程
  await new Promise(() => {})
}

// ───────────────────────── 加载官方 SDK ─────────────────────────
const rt = resolveRuntimeRoot()
if (!rt) {
  console.error('QODER_APP_NOT_FOUND')
  process.exit(3)
}
const sdkEntry = path.join(
  rt.root,
  'resources/app.asar/node_modules/@qoder-ai/qoder-cn-agent-sdk/dist/index.js',
)
if (!fs.existsSync(sdkEntry)) {
  console.error(`SDK_NOT_FOUND: ${sdkEntry}`)
  process.exit(3)
}
const mod = await import('file:///' + sdkEntry.replace(/\\/g, '/'))
const SDK_VERSION = '0.4.9'

// 干净 cwd：必须是空目录，阻断 AGENTS.md / 项目上下文外泄
const workDir = CLEAN_CWD || path.join(process.cwd(), '.qoder-bridge-cwd')
fs.mkdirSync(workDir, { recursive: true })

const startedAt = Date.now()
let inflight = 0
const queue = []
let seq = 0

function log(...a) {
  if (process.env.QODER_BRIDGE_QUIET === '1') return
  console.error('[bridge]', ...a)
}

// ───────────────────── messages → 单轮 prompt ─────────────────────
function flattenContent(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    const parts = []
    for (const p of content) {
      if (!p || typeof p !== 'object') continue
      if (p.type === 'text' && typeof p.text === 'string') parts.push(p.text)
      else if (p.type === 'input_text' && typeof p.text === 'string') parts.push(p.text)
      // 图片/音频：上游该通道不支持，直接忽略（不假装支持）
    }
    return parts.join('\n')
  }
  return ''
}

function buildPrompt(messages) {
  const list = Array.isArray(messages) ? messages : []
  const sys = list.filter((m) => m && m.role === 'system').map((m) => flattenContent(m.content))
  const turns = list.filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
  const last = turns[turns.length - 1]
  if (!last || last.role !== 'user') {
    throw Object.assign(new Error('最后一条消息必须是 user'), { statusCode: 400, code: 'invalid_messages' })
  }
  // 只有一轮 user、无 system：直接把内容当 prompt，避免无谓包装
  if (turns.length === 1 && sys.length === 0) return flattenContent(last.content)

  const lines = []
  if (sys.length) lines.push('[系统指令]', sys.join('\n'), '')
  if (turns.length > 1) {
    lines.push('[对话上下文]')
    for (const m of turns.slice(0, -1)) {
      lines.push(`${m.role === 'user' ? '用户' : '助手'}：${flattenContent(m.content)}`)
    }
    lines.push('')
  }
  lines.push('[当前用户消息]', flattenContent(last.content))
  return lines.join('\n')
}

// ───────────────────── SDK 帧 → OpenAI 片段 ─────────────────────
function toChunk(id, model, created, delta, finish) {
  return {
    id,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [{ index: 0, delta, finish_reason: finish ?? null }],
  }
}

/** 跑一次 query，把帧序列喂给 onEvent；resolve 出聚合结果 */
async function runQuery({ token, expiresAt, prompt, model, signal, onEvent }) {
  const auth = mod.jobToken(async () => ({ token, expiresAt }))
  const it = mod.query({
    prompt,
    options: {
      cwd: workDir,
      auth,
      // 安全红线：显式清空工具面（不传则挂 18 个本机工具）
      tools: [],
      ...(model && model !== 'auto' ? { model } : {}),
    },
  })

  let text = ''
  let thinking = ''
  let finish = 'stop'
  let credits
  let requestId
  let contextUsageRatio
  let stopReason
  let errored = false
  let errorText = ''
  let sdkModel = 'auto'
  const emit = typeof onEvent === 'function' ? onEvent : async () => {}

  for await (const msg of it) {
    if (signal?.aborted) {
      try {
        await it.return?.()
      } catch {
        /* ignore */
      }
      throw Object.assign(new Error('client aborted'), { statusCode: 499, code: 'aborted' })
    }
    if (!msg || typeof msg !== 'object') continue
    if (msg.type === 'system' && msg.subtype === 'init') {
      if (msg.model) sdkModel = msg.model
    } else if (msg.type === 'system' && msg.subtype === 'available_models_update') {
      // 只用于观测，不参与本次应答
    } else if (msg.type === 'assistant' && msg.message?.content) {
      for (const c of msg.message.content) {
        if (!c || typeof c !== 'object') continue
        if (c.type === 'thinking' && typeof c.thinking === 'string') {
          thinking += c.thinking
          await emit({ kind: 'thinking', text: c.thinking })
        } else if (c.type === 'text' && typeof c.text === 'string') {
          text += c.text
          await emit({ kind: 'text', text: c.text })
        }
        // tool_use 不应出现（tools 已清空）；真出现也只记录不执行
        else if (c.type === 'tool_use') {
          log('WARN unexpected tool_use', c.name)
        }
      }
      if (msg.message.stop_reason) stopReason = msg.message.stop_reason
      if (msg.message.usage?.credits !== undefined) credits = msg.message.usage.credits
      // request_id 在 assistant 帧的 usage 里（result 帧未必带）
      if (msg.message.usage?.request_id) requestId = msg.message.usage.request_id
      if (typeof msg.message.usage?.context_usage_ratio === 'number') {
        contextUsageRatio = msg.message.usage.context_usage_ratio
      }
    } else if (msg.type === 'result') {
      if (msg.is_error) {
        errored = true
        errorText = (msg.errors || []).join('; ') || msg.result || 'qoder upstream error'
        finish = 'error'
      }
      if (typeof msg.result === 'string' && msg.result && !text) text = msg.result
      if (msg.total_credits !== undefined) credits = msg.total_credits
      // 计量取证(2026-10-23 全帧转储)：result 帧的 modelUsage{<model>:{…,credits,context_usage_ratio}}
      // 也携带真实扣减量；非流式态上游有时只在 modelUsage 给 credits（assistant.usage.credits /
      // total_credits 为 undefined），不扫这里就会把本次真实计费丢成 null。
      if (msg.modelUsage && typeof msg.modelUsage === 'object') {
        for (const mv of Object.values(msg.modelUsage)) {
          if (mv && typeof mv === 'object') {
            if (typeof mv.credits === 'number') credits = mv.credits
            if (typeof mv.context_usage_ratio === 'number') contextUsageRatio = mv.context_usage_ratio
          }
        }
      }
      if (msg.request_id) requestId = msg.request_id
      if (msg.stop_reason) stopReason = msg.stop_reason
      if (typeof msg.usage?.context_usage_ratio === 'number') {
        contextUsageRatio = msg.usage.context_usage_ratio
      }
    }
  }

  if (stopReason === 'end_turn' || stopReason === 'stop_sequence') finish = errored ? 'error' : 'stop'
  if (stopReason === 'max_tokens') finish = 'length'

  return { text, thinking, finish, credits, requestId, contextUsageRatio, errored, errorText, sdkModel }
}

/** 并发闸：超过上限排队 */
function acquire() {
  if (inflight < MAX_CONCURRENCY) {
    inflight++
    return Promise.resolve()
  }
  return new Promise((resolve) => queue.push(resolve))
}

function release() {
  inflight--
  const next = queue.shift()
  if (next) {
    inflight++
    next()
  }
}

// ───────────────────────────── HTTP ─────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > 8 * 1024 * 1024) {
        reject(Object.assign(new Error('body too large'), { statusCode: 413 }))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res, status, obj) {
  const s = JSON.stringify(obj)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(s) })
  res.end(s)
}

function sendError(res, status, message, code) {
  sendJson(res, status, { error: { message: String(message).slice(0, 500), type: 'qoder_bridge_error', code: code || 'error' } })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1')

  if (req.method === 'GET' && url.pathname === '/healthz') {
    sendJson(res, 200, {
      ok: true,
      pid: process.pid,
      sdk: SDK_VERSION,
      runtime: rt.version,
      uptime_ms: Date.now() - startedAt,
      inflight,
      queued: queue.length,
      cwd: workDir,
      electron: process.versions.electron,
      node: process.versions.node,
    })
    return
  }

  if (url.pathname !== '/v1/chat/completions') {
    sendError(res, 404, 'not found', 'not_found')
    return
  }
  if (req.method !== 'POST') {
    sendError(res, 405, 'method not allowed', 'method_not_allowed')
    return
  }
  if (KEY && req.headers['x-qoder-bridge-key'] !== KEY) {
    sendError(res, 403, 'bridge key mismatch', 'forbidden')
    return
  }

  const auth = String(req.headers.authorization || '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  const expiresAt = Number(req.headers['x-qoder-token-exp'] || 0)
  if (!token) {
    sendError(res, 401, 'missing bearer token', 'unauthorized')
    return
  }
  if (!Number.isFinite(expiresAt) || expiresAt < 1e12) {
    sendError(res, 400, 'x-qoder-token-exp must be epoch milliseconds (>= 1e12)', 'bad_token_exp')
    return
  }

  let payload
  try {
    payload = JSON.parse(await readBody(req))
  } catch (e) {
    sendError(res, 400, `invalid json: ${e.message}`, 'bad_json')
    return
  }

  let prompt
  try {
    prompt = buildPrompt(payload.messages)
  } catch (e) {
    sendError(res, e.statusCode || 400, e.message, e.code)
    return
  }

  const wantStream = payload.stream === true
  const reqModel = typeof payload.model === 'string' && payload.model.trim() ? payload.model.trim() : 'auto'
  const id = `chatcmpl-qb-${Date.now().toString(36)}-${(seq++).toString(36)}`
  const created = Math.floor(Date.now() / 1000)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  req.on('close', () => {
    if (!res.writableEnded) controller.abort()
  })

  await acquire()
  try {
    if (wantStream) {
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
      })
      res.write(`data: ${JSON.stringify(toChunk(id, reqModel, created, { role: 'assistant', content: '' }))}\n\n`)

      const result = await runQuery({
        token,
        expiresAt,
        prompt,
        model: reqModel,
        signal: controller.signal,
        onEvent: async (ev) => {
          if (ev.kind === 'text' && ev.text) {
            res.write(`data: ${JSON.stringify(toChunk(id, reqModel, created, { content: ev.text }))}\n\n`)
          } else if (ev.kind === 'thinking' && ev.text) {
            // 推理内容走非标准字段，兼容客户端可忽略
            res.write(
              `data: ${JSON.stringify(toChunk(id, reqModel, created, { reasoning_content: ev.text }))}\n\n`,
            )
          }
        },
      })

      if (result.errored) {
        res.write(
          `data: ${JSON.stringify({ error: { message: result.errorText, type: 'qoder_upstream_error', code: 'upstream' } })}\n\n`,
        )
      } else {
        const terminal = toChunk(id, reqModel, created, {}, result.finish)
        // 流式终止帧同样携带上游唯一真实计量：
        //   credits = 本次请求扣减的积分（上游 token 字段恒 0，见文件头说明，绝不编造）；
        //   context_usage_ratio = 上游给的上下文占用比例原值（语义未全证，原样透传不换算）。
        terminal.usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        if (typeof result.credits === 'number') terminal.usage.credits = result.credits
        if (typeof result.contextUsageRatio === 'number') {
          terminal.usage.context_usage_ratio = result.contextUsageRatio
        }
        terminal.x_qoder_credits = result.credits ?? null
        terminal.x_qoder_request_id = result.requestId ?? null
        res.write(`data: ${JSON.stringify(terminal)}\n\n`)
      }
      res.write('data: [DONE]\n\n')
      res.end()
    } else {
      const events = []
      const result = await runQuery({
        token,
        expiresAt,
        prompt,
        model: reqModel,
        signal: controller.signal,
        onEvent: async (ev) => events.push(ev),
      })
      if (result.errored) {
        sendError(res, 502, result.errorText, 'upstream_error')
        return
      }
      sendJson(res, 200, {
        id,
        object: 'chat.completion',
        created,
        model: reqModel,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: result.text,
              ...(result.thinking ? { reasoning_content: result.thinking } : {}),
            },
            finish_reason: result.finish,
          },
        ],
        // 上游不返回 token 计量（实测恒 0），如实透传 0，不编造
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        x_qoder_credits: result.credits ?? null,
        x_qoder_request_id: result.requestId ?? null,
        x_qoder_context_usage_ratio: result.contextUsageRatio ?? null,
        x_qoder_sdk_model: result.sdkModel,
      })
    }
  } catch (e) {
    const status = e.statusCode || (e.name === 'AbortError' ? 504 : 500)
    if (!res.headersSent) sendError(res, status, e.message, e.code || e.name)
    else {
      try {
        res.write(`data: ${JSON.stringify({ error: { message: e.message, type: 'qoder_bridge_error' } })}\n\n`)
        res.write('data: [DONE]\n\n')
      } catch {
        /* ignore */
      }
      res.end()
    }
    log('request failed', e.name, e.message)
  } finally {
    clearTimeout(timer)
    release()
  }
})

server.listen(PORT, '127.0.0.1', () => {
  const actual = server.address().port
  process.stdout.write(
    `QODER_BRIDGE_READY ${JSON.stringify({ port: actual, pid: process.pid, runtime: rt.version, cwd: workDir })}\n`,
  )
  log(`listening 127.0.0.1:${actual} cwd=${workDir} tools=[] keyed=${KEY ? 'yes' : 'no'}`)
})

server.on('error', (e) => {
  console.error('QODER_BRIDGE_ERROR', e.message)
  process.exit(4)
})

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    log('shutting down', sig)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 3000)
  })
}

// 早退保护：SDK worker 若崩溃，桥不该静默半死
process.on('unhandledRejection', (e) => log('unhandledRejection', e?.message || e))
process.on('uncaughtException', (e) => {
  log('uncaughtException', e?.message || e)
})

void crypto
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
