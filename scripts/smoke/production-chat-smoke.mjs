// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 冒烟脚本是 CLI 工具,需要 console 输出诊断 */
/**
 * 生产对话冒烟(2026-11-27 立)。
 *
 * 为什么需要它:2026-11-23 的商店合规实测里,审核账号能登录、模型清单能拉到,
 * 但默认档 `ihui/Auto-Model` 报"provider API key 未配置",换一档又空响应 2 分钟。
 * 这类故障不是编译期能发现的:代码全绿、包能出、商店能传,用户第一次说话就失败。
 * 所以把"真实登录 + 拉模型 + 发一句话 + 收到非空 token"做成一条可定时跑的冒烟。
 *
 * 判定口径:
 *  - public 段(免密):站点 200、/api/health 200、/api/llm/models 未登录必须 401/403。
 *  - auth 段(需要 IHUI_SMOKE_ACCOUNT / IHUI_SMOKE_PASSWORD):
 *      登录 → GET /api/llm/models(必须非空、默认档不得是 ihui//stepfun/) →
 *      POST /api/ai/chat/stream(model=auto)→ 首 token 必须在超时内到、且内容非空。
 *  - 没有配置账号 ⇒ 只跑 public 段,status=skipped,exit 0(不冒充通过,也不把
 *    未配置密钥的分支判红)。
 *
 * 用法:
 *   node scripts/smoke/production-chat-smoke.mjs                 # 有账号跑全量,没账号只跑 public
 *   node scripts/smoke/production-chat-smoke.mjs --public-only    # 只跑 public
 *   node scripts/smoke/production-chat-smoke.mjs --json           # 只输出机器可读 JSON
 * 环境变量:
 *   IHUI_SMOKE_BASE_URL(默认 https://www.aizhs.top)
 *   IHUI_SMOKE_ACCOUNT / IHUI_SMOKE_PASSWORD
 *   IHUI_SMOKE_TIMEOUT_MS(默认 45000)
 */
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const BASE = (process.env.IHUI_SMOKE_BASE_URL || 'https://www.aizhs.top').replace(/\/+$/, '')
const TIMEOUT_MS = Number(process.env.IHUI_SMOKE_TIMEOUT_MS || 45_000)
const ACCOUNT = (process.env.IHUI_SMOKE_ACCOUNT || '').trim()
const PASSWORD = (process.env.IHUI_SMOKE_PASSWORD || '').trim()
const JSON_ONLY = process.argv.includes('--json')
const PUBLIC_ONLY = process.argv.includes('--public-only')

const DEAD_PREFIXES = ['ihui/', 'stepfun/']
const isDeadModel = (id) => {
  const m = String(id || '')
    .trim()
    .toLowerCase()
  return DEAD_PREFIXES.some((p) => m.startsWith(p))
}

const checks = []
const record = (name, ok, detail, ms) => {
  checks.push({ name, ok, detail, ms })
  if (!JSON_ONLY) {
    const tag = ok ? 'PASS' : 'FAIL'
    console.log(`[${tag}] ${name} — ${detail}${ms === undefined ? '' : ` (${ms}ms)`}`)
  }
}

async function call(path, { method = 'GET', token, body, accept } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const started = Date.now()
  try {
    const headers = { accept: accept || 'application/json' }
    if (token) headers.authorization = `Bearer ${token}`
    if (body !== undefined) headers['content-type'] = 'application/json'
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
    return { res, started }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 抽出非空正文。
 *
 * 只认结构化的 delta/message/text 字段,不做"任意 content 都算"的宽匹配 ——
 * 否则上下文注入帧里的 prompt 正文会被当成模型输出,冒烟变成假绿。
 * 帧形状以仓库既有用例为准:data: {"choices":[{"delta":{"content":"你好"}}]}
 * (apps/api/tests/f-726-stream-usage-billing.test.ts:137 / f-296:224)。
 */
function collectText(value, out = []) {
  if (!value || typeof value !== 'object') return out
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, out)
    return out
  }
  if (Array.isArray(value.choices)) {
    for (const c of value.choices) {
      const delta = c?.delta
      if (typeof delta?.content === 'string' && delta.content.trim()) out.push(delta.content)
      if (typeof delta?.reasoning_content === 'string' && delta.reasoning_content.trim()) {
        out.push(delta.reasoning_content)
      }
      if (typeof c?.message?.content === 'string' && c.message.content.trim()) {
        out.push(c.message.content)
      }
      if (typeof c?.text === 'string' && c.text.trim()) out.push(c.text)
    }
  }
  if (value.delta && typeof value.delta === 'object') {
    const d = value.delta
    if (typeof d.content === 'string' && d.content.trim()) out.push(d.content)
  }
  if (typeof value.textDelta === 'string' && value.textDelta.trim()) out.push(value.textDelta)
  if (typeof value.delta === 'string' && value.delta.trim()) out.push(value.delta)
  if (typeof value.text === 'string' && value.text.trim()) out.push(value.text)
  if (value.data && typeof value.data === 'object') collectText(value.data, out)
  return out
}

function findError(value) {
  if (!value || typeof value !== 'object') return null
  if (typeof value.error === 'string' && value.error.trim()) return value.error
  if (value.error && typeof value.error === 'object') {
    return String(value.error.message || value.error.code || 'upstream error')
  }
  if (value.type === 'error') return String(value.message || 'error frame')
  for (const val of Object.values(value)) {
    const nested = findError(val)
    if (nested) return nested
  }
  return null
}

async function publicChecks() {
  let t = Date.now()
  try {
    const { res } = await call('/')
    record('site_home', res.status === 200, `GET / => ${res.status}`, Date.now() - t)
  } catch (e) {
    record('site_home', false, `GET / => ${e.message}`, Date.now() - t)
  }

  t = Date.now()
  try {
    const { res } = await call('/api/health')
    const text = await res.text()
    record('api_health', res.status === 200, `GET /api/health => ${res.status} ${text.slice(0, 80)}`, Date.now() - t)
  } catch (e) {
    record('api_health', false, `GET /api/health => ${e.message}`, Date.now() - t)
  }

  t = Date.now()
  try {
    const { res } = await call('/api/llm/models')
    record(
      'models_requires_auth',
      res.status === 401 || res.status === 403,
      `GET /api/llm/models 未登录 => ${res.status}(必须 401/403)`,
      Date.now() - t,
    )
  } catch (e) {
    record('models_requires_auth', false, `GET /api/llm/models => ${e.message}`, Date.now() - t)
  }
}

async function authChecks() {
  let t = Date.now()
  let token = ''
  try {
    const { res } = await call('/api/auth/login', {
      method: 'POST',
      body: { account: ACCOUNT, password: PASSWORD },
    })
    const json = await res.json()
    token = json?.data?.accessToken || ''
    record('login', res.status === 200 && Boolean(token), `POST /api/auth/login => ${res.status}`, Date.now() - t)
    if (!token) return { ok: false }
  } catch (e) {
    record('login', false, `POST /api/auth/login => ${e.message}`, Date.now() - t)
    return { ok: false }
  }

  let models = []
  let defaultModel = ''
  t = Date.now()
  try {
    const { res } = await call('/api/llm/models', { token })
    const json = await res.json()
    const data = json?.data || {}
    models = Array.isArray(data.models) ? data.models : []
    defaultModel = String(data.default || '')
    const dead = models.filter((m) => isDeadModel(m?.id)).map((m) => m.id)
    const ok =
      res.status === 200 &&
      models.length > 0 &&
      !isDeadModel(defaultModel) &&
      dead.length === 0
    record(
      'models_catalog',
      ok,
      `GET /api/llm/models => ${res.status}; models=${models.length}; default=${defaultModel || '(empty)'}; dead=${dead.join(',') || '0'}`,
      Date.now() - t,
    )
    if (!ok) return { ok: false, models, defaultModel }
  } catch (e) {
    record('models_catalog', false, `GET /api/llm/models => ${e.message}`, Date.now() - t)
    return { ok: false }
  }

  t = Date.now()
  let firstTokenMs = null
  let text = ''
  let events = 0
  let streamError = ''
  try {
    const { res } = await call('/api/ai/chat/stream', {
      method: 'POST',
      token,
      accept: 'text/event-stream',
      body: {
        model: 'auto',
        sessionId: `smoke-${Date.now()}`,
        messages: [{ role: 'user', content: '只回复两个字：正常' }],
      },
    })
    if (!res.ok) {
      const body = await res.text()
      record('chat_stream', false, `POST /api/ai/chat/stream => ${res.status} ${body.slice(0, 160)}`, Date.now() - t)
      return { ok: false, models, defaultModel }
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const deadline = Date.now() + TIMEOUT_MS
    while (Date.now() < deadline) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const frames = buffer.split('\n\n')
      buffer = frames.pop() || ''
      for (const frame of frames) {
        for (const line of frame.split('\n')) {
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          if (!payload || payload === '[DONE]') continue
          events += 1
          let json
          try {
            json = JSON.parse(payload)
          } catch {
            continue
          }
          const err = findError(json)
          if (err) streamError = err
          const pieces = collectText(json)
          if (pieces.length && firstTokenMs === null) firstTokenMs = Date.now() - t
          text += pieces.join('')
        }
      }
      if (text.trim() && firstTokenMs !== null && text.length >= 2) break
    }
    try {
      await reader.cancel()
    } catch {
      /* 收尾取消失败不影响判定 */
    }

    const ok = !streamError && firstTokenMs !== null && text.trim().length > 0
    record(
      'chat_stream',
      ok,
      `POST /api/ai/chat/stream => events=${events}; firstToken=${firstTokenMs === null ? 'none' : `${firstTokenMs}ms`}; chars=${text.trim().length}; preview=${JSON.stringify(text.trim().slice(0, 40))}${streamError ? `; error=${streamError}` : ''}`,
      Date.now() - t,
    )
    return { ok, models, defaultModel, firstTokenMs, chars: text.trim().length }
  } catch (e) {
    record('chat_stream', false, `POST /api/ai/chat/stream => ${e.message}`, Date.now() - t)
    return { ok: false, models, defaultModel }
  }
}

async function main() {
  if (!JSON_ONLY) console.log(`production chat smoke => ${BASE}`)
  await publicChecks()
  const publicOk = checks.every((c) => c.ok)

  let status = publicOk ? 'pass' : 'fail'
  let auth = null
  if (!PUBLIC_ONLY && ACCOUNT && PASSWORD) {
    auth = await authChecks()
    status = checks.every((c) => c.ok) ? 'pass' : 'fail'
  } else if (!PUBLIC_ONLY) {
    if (!JSON_ONLY) {
      console.log(
        '[SKIP] auth 段未执行 — 未提供 IHUI_SMOKE_ACCOUNT / IHUI_SMOKE_PASSWORD(public 段仍需全绿)',
      )
    }
    status = publicOk ? 'skipped' : 'fail'
  }

  const summary = {
    status,
    base: BASE,
    at: new Date().toISOString(),
    publicOk,
    checks,
    models: auth?.models ? { count: auth.models.length, default: auth.defaultModel } : null,
    chat: typeof auth?.firstTokenMs === 'number' ? { firstTokenMs: auth.firstTokenMs, chars: auth.chars } : null,
  }

  if (JSON_ONLY) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    console.log(`=> status=${status}`)
  }

  if (status === 'fail') process.exitCode = 1
}

const ENTRY = process.argv[1] ? pathToFileURL(process.argv[1]).href : ''
if (ENTRY === import.meta.url) {
  main().catch((e) => {
    console.error(`[FAIL] smoke crashed — ${e?.stack || e}`)
    process.exitCode = 1
  })
}

export { collectText, findError, isDeadModel }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
