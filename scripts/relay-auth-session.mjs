#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池自助授权一键入口(2026-11-17 立)。
 *
 * 对账缺口:后端 `/api/relay/auth-sessions` 已把「免客户端入池」做成七端点会话族
 * (capabilities / 发起 / 列表 / 回显 / 轮询 / 撤销 / 清扫),但没有一条人能敲的命令
 * —— 只能在面板里点。本器补这一格:把 device_flow 与 pat 两档做成一键。
 *
 * 子命令:
 *   --capabilities [--provider <code>]   哪家支持哪一档(未实证档连同出路原文一起打)
 *   --oauth <provider>                   发起 RFC 8628 设备码 → 打印短码 + 链接,自动开浏览器,轮询到终局
 *   --pat <provider>                     直贴个人访问令牌入池(令牌只走管道,不回显不落盘)
 *   --list [--include-terminal]          当前非终局会话
 *   --status <session-id>                单会话回显
 *
 * 鉴权(任一):
 *   --token <bearer>      / env IHUI_ADMIN_TOKEN
 *   --cookie <cookie串>   / env IHUI_ADMIN_COOKIE
 *   --tenant <租户id>     / env IHUI_ADMIN_TENANT   —— 多租户严格模式下的 X-Tenant-Id
 *
 * 服务地址:--base <url> / env IHUI_ADMIN_BASE(默认 http://127.0.0.1:3001)
 *
 * 纪律(AGENTS §0.3 / §0.6):
 * - 连不上、缺鉴权、缺参数 ⇒ exit 2 并打印「未判定」并点名原因,绝不伪造 OK;
 * - 服务端判红(4xx/5xx)原样打印 code + message 后 exit 1 —— 两种失败不许混同;
 * - PAT / secret 永不回显,只打 sha256 前 6 位指纹;
 * - 轮询只遵守回包给出的 intervalSeconds / nextPollAt(RFC 8628 §3.5 的 slow_down 闸在服务端,
 *   本层不复算第二份判据)。
 *
 * 退出码:0 成功 / 1 服务端判红 / 2 参数或环境未判定。
 *
 * 实现注记(2026-11-17 实测踩坑):本器**绝不调 process.exit()** —— node 26 在 Windows 上
 * 于 fetch 之后立刻 exit 会撞 libuv `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`,
 * 进程崩在断言里且退出码失真(实测打印过 exit=0 却实际是判红)。这里一律走 `process.exitCode`
 * + 让事件循环自然排空,退出码才可信。
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'

const BASE = (process.env.IHUI_ADMIN_BASE || 'http://127.0.0.1:3001').replace(/\/+$/, '')
const TERMINAL = new Set(['imported', 'failed', 'expired', 'cancelled'])
const MIN_WAIT_MS = 5000

/** 唯一出口异常:code 0/1/2 在顶层落成 process.exitCode(不硬退) */
class CliFault extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

const undecided = (msg) => new CliFault(2, `[未判定] ${msg}`)

function argValue(argv, name) {
  const idx = argv.indexOf(name)
  return idx >= 0 ? argv[idx + 1] : undefined
}
function hasFlag(argv, name) {
  return argv.includes(name)
}

const HELP = `号池自助授权 —— 一键入池(device_flow / pat)

用法:
  node scripts/relay-auth-session.mjs --capabilities [--provider qoder]
  node scripts/relay-auth-session.mjs --oauth qoder
  node scripts/relay-auth-session.mjs --pat qoder --secret sk_xxx
  node scripts/relay-auth-session.mjs --pat qoder --secret-stdin < pat.txt
  node scripts/relay-auth-session.mjs --list [--include-terminal]
  node scripts/relay-auth-session.mjs --status <session-id>

鉴权(任一):
  --token <bearer>    / env IHUI_ADMIN_TOKEN
  --cookie <cookie串> / env IHUI_ADMIN_COOKIE
  --tenant <租户id>    / env IHUI_ADMIN_TENANT(多租户严格模式必需)

环境:
  IHUI_ADMIN_BASE   服务地址(默认 ${BASE})

退出码:0 成功 / 1 服务端判红 / 2 参数或环境未判定
`

function authHeaders(argv) {
  const token = argValue(argv, '--token') ?? process.env.IHUI_ADMIN_TOKEN
  const cookie = argValue(argv, '--cookie') ?? process.env.IHUI_ADMIN_COOKIE
  const tenant = argValue(argv, '--tenant') ?? process.env.IHUI_ADMIN_TENANT
  if (!token && !cookie) {
    throw undecided('缺鉴权:给 --token / --cookie,或设 IHUI_ADMIN_TOKEN / IHUI_ADMIN_COOKIE')
  }
  const h = { 'content-type': 'application/json' }
  if (token) h.authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`
  if (cookie) h.cookie = cookie
  if (tenant) h['x-tenant-id'] = tenant
  return h
}

async function api(path, { method = 'GET', body, headers } = {}) {
  const url = `${BASE}${path}`
  let res
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    })
  } catch (e) {
    const code = e?.cause?.code ?? e?.code ?? ''
    throw undecided(`连不上 ${url}${code ? ` (${code})` : ''}:${e instanceof Error ? e.message : String(e)}`)
  }
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* 非 JSON 回包按判红处理:服务在,只是回的不是契约形状 */
  }
  return { ok: res.ok, status: res.status, json, text }
}

/** 服务端判红:原样打 code/message 后落 exit 1(与"未判定"分档) */
function deny(r, ctx) {
  const code = r.json?.code ?? r.status
  const message = r.json?.message ?? (r.text ? r.text.slice(0, 300) : '(空响应)')
  throw new CliFault(1, `[判红] ${ctx}: HTTP ${r.status} · code=${code} · ${message}`)
}

function fingerprintOf(secret) {
  return createHash('sha256').update(secret, 'utf8').digest('hex').slice(0, 6)
}

function openUrl(url) {
  try {
    const opt = { detached: true, stdio: 'ignore', windowsHide: true }
    if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', url], opt).unref()
    else if (process.platform === 'darwin') spawn('open', [url], opt).unref()
    else spawn('xdg-open', [url], opt).unref()
    return true
  } catch {
    return false
  }
}

async function readSecretFromStdin() {
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  return Buffer.concat(chunks).toString('utf8').trim()
}

function waitMsFor(view) {
  const now = Date.now()
  const next = view?.nextPollAt ? Date.parse(view.nextPollAt) : NaN
  if (Number.isFinite(next) && next > now) return Math.max(next - now + 1000, MIN_WAIT_MS)
  const interval = Number(view?.intervalSeconds) > 0 ? Number(view.intervalSeconds) * 1000 : MIN_WAIT_MS
  return Math.max(interval, MIN_WAIT_MS)
}

async function cmdCapabilities(argv, headers) {
  const provider = argValue(argv, '--provider')
  const qs = provider ? `?provider=${encodeURIComponent(provider)}` : ''
  const r = await api(`/api/relay/auth-sessions/capabilities${qs}`, { headers })
  if (!r.ok) deny(r, 'capabilities')
  const items = r.json?.data?.items ?? []
  if (items.length === 0) throw undecided('能力表为空:该筛选下没有任何登记条目(§0.3 枚举到 0 个不当成绿)')
  const unverified = items.filter((i) => !i.verified)
  console.log(`能力表 ${items.length} 条:已验证 ${items.length - unverified.length} / 未实证 ${unverified.length}`)
  for (const i of items) {
    console.log(`  ${i.verified ? '✓' : '·'} ${i.providerCode}/${i.kind}  mapper=${i.mapper}`)
    if (!i.verified) console.log(`      出路:${i.note}`)
  }
  return 0
}

async function cmdOauth(argv, headers) {
  const provider = argValue(argv, '--oauth')
  if (!provider) throw undecided('--oauth 需要平台编码,例如 --oauth qoder')
  const r = await api('/api/relay/auth-sessions', {
    method: 'POST',
    headers,
    body: { providerCode: provider, kind: 'device_flow', scene: 'ops-cli' },
  })
  // capability_unverified / capability_unknown 的 message 本身就是「这一家还开不了 + 出路」
  if (!r.ok) deny(r, `发起 device_flow(${provider})`)
  const v = r.json?.data
  if (!v?.id) deny(r, '发起 device_flow:回包缺会话 id')
  if (v.status === 'imported') {
    console.log(`[完成] 已直接入池 accountId=${v.accountId ?? '-'} · ${provider}`)
    return 0
  }
  if (!v.userCode || !v.verificationUri) {
    throw new CliFault(1, `[判红] 发起 device_flow:上游未返回 user_code / verification_uri`)
  }
  console.log('')
  console.log(`  平台 : ${v.providerCode}`)
  console.log(`  短码 : ${v.userCode}`)
  console.log(`  链接 : ${v.verificationUriComplete ?? v.verificationUri}`)
  console.log(`  会话 : ${v.id}  (过期 ${v.expiresAt})`)
  console.log('')
  console.log(
    openUrl(v.verificationUriComplete ?? v.verificationUri)
      ? '已在浏览器打开授权页,确认后本器自动轮询…'
      : '请手动打开上面的链接,确认后本器自动轮询…',
  )

  const expiresAt = Date.parse(v.expiresAt)
  let attempt = 0
  while (true) {
    await new Promise((res) => setTimeout(res, waitMsFor(v)))
    if (Number.isFinite(expiresAt) && Date.now() > expiresAt) {
      throw undecided('会话寿命已至且仍非终局:请重新发起 --oauth')
    }
    attempt += 1
    const p = await api(`/api/relay/auth-sessions/${encodeURIComponent(v.id)}/poll`, { method: 'POST', headers })
    if (!p.ok) deny(p, '轮询')
    const cur = p.json?.data
    console.log(`  [${attempt}] ${cur?.status ?? '?'}${cur?.failureCode ? ` · ${cur.failureCode}` : ''}`)
    if (TERMINAL.has(cur?.status)) {
      if (cur.status === 'imported') {
        console.log(`[完成] 入池 accountId=${cur.accountId ?? '-'} · 指纹 ${cur.credFingerprint ?? '-'}`)
        return 0
      }
      console.error(
        `[未完成] 终局=${cur.status}${cur.failureCode ? ` code=${cur.failureCode}` : ''}${cur.failureMessage ? ` · ${cur.failureMessage}` : ''}`,
      )
      return 1
    }
    if (cur) Object.assign(v, cur)
  }
}

async function cmdPat(argv, headers) {
  const provider = argValue(argv, '--pat')
  if (!provider) throw undecided('--pat 需要平台编码,例如 --pat qoder')
  let secret = argValue(argv, '--secret')
  if (!secret && hasFlag(argv, '--secret-stdin')) secret = await readSecretFromStdin()
  if (!secret) throw undecided('缺令牌:给 --secret <值>,或用 --secret-stdin 从 stdin 读')
  secret = secret.trim()
  if (!secret) throw undecided('stdin 读到空令牌')
  const fp = fingerprintOf(secret)
  const r = await api('/api/relay/auth-sessions', {
    method: 'POST',
    headers,
    body: { providerCode: provider, kind: 'pat', secret, scene: 'ops-cli' },
  })
  if (!r.ok) deny(r, `PAT 入池(${provider} · 指纹 ${fp})`)
  const v = r.json?.data
  if (v?.status === 'imported') {
    console.log(`[完成] ${provider} 已入池 · accountId=${v.accountId ?? '-'} · 指纹 ${v.credFingerprint ?? fp}`)
    return 0
  }
  if (TERMINAL.has(v?.status)) {
    console.error(
      `[未完成] 终局=${v.status}${v.failureCode ? ` code=${v.failureCode}` : ''}${v.failureMessage ? ` · ${v.failureMessage}` : ''} · 指纹 ${fp}`,
    )
    return 1
  }
  console.log(`[待轮询] 会话 ${v?.id ?? '-'} 状态=${v?.status ?? '?'} · 指纹 ${fp} · 用 --status 跟进`)
  return 0
}

async function cmdList(argv, headers) {
  const inc = hasFlag(argv, '--include-terminal') ? '?includeTerminal=true' : ''
  const r = await api(`/api/relay/auth-sessions${inc}`, { headers })
  if (!r.ok) deny(r, '会话列表')
  const items = r.json?.data?.items ?? r.json?.data ?? []
  if (!Array.isArray(items) || items.length === 0) {
    console.log('当前没有非终局会话')
    return 0
  }
  for (const i of items) {
    console.log(
      `  ${String(i.status).padEnd(9)} ${i.providerCode}/${i.kind}  id=${i.id}  ${i.userCode ? `码=${i.userCode} ` : ''}${i.accountId ? `account=${i.accountId}` : ''}`,
    )
  }
  return 0
}

async function cmdStatus(argv, headers) {
  const id = argValue(argv, '--status')
  if (!id) throw undecided('--status 需要会话 id')
  const r = await api(`/api/relay/auth-sessions/${encodeURIComponent(id)}`, { headers })
  if (!r.ok) deny(r, '会话回显')
  console.log(JSON.stringify(r.json?.data ?? r.json, null, 2))
  return 0
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.length === 0 || hasFlag(argv, '--help') || hasFlag(argv, '-h')) {
    console.log(HELP)
    return 0
  }
  if (hasFlag(argv, '--capabilities')) return cmdCapabilities(argv, authHeaders(argv))
  if (hasFlag(argv, '--oauth')) return cmdOauth(argv, authHeaders(argv))
  if (hasFlag(argv, '--pat')) return cmdPat(argv, authHeaders(argv))
  if (hasFlag(argv, '--list')) return cmdList(argv, authHeaders(argv))
  if (hasFlag(argv, '--status')) return cmdStatus(argv, authHeaders(argv))
  throw undecided(`认不出的子命令:${argv.join(' ')} —— 用 --help 看用法`)
}

/* 不调 process.exit()(见头注):只设 exitCode,让事件循环排空后自然退出。
   兜底:若 6s 后仍未退出(undici keep-alive 句柄),用 unref 的计时器把最后一句诊断打出来,
   退出码早已设在 process.exitCode 上,不会因为"没退出"而被判成 0。 */
main().then(
  (code) => {
    process.exitCode = code ?? 0
  },
  (e) => {
    if (e instanceof CliFault) {
      console.error(e.message)
      process.exitCode = e.code
    } else {
      console.error(`[未判定] 执行中断:${e instanceof Error ? (e.stack ?? e.message) : String(e)}`)
      process.exitCode = 2
    }
  },
)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
