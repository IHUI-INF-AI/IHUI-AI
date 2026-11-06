// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * test-health.ps1 的 llm 维判据夹具(B 票 1)。
 *
 * 立因:生产 /api/llm/providers/health 即使所有 provider 都 unreachable/invalid_key
 * 也返回 HTTP 200(错误装在 {code,message,data} 信封里)。旧判据
 * `$llmOk = ($rr.StatusCode -ge 200 -and -lt 400)` 把「HTTP 200 但 provider 全挂」
 * 判成 PASS —— 健康自检在真的全线挂掉时反而报绿。
 *
 * 修法:解析信封,要求 code=0、summary.total>0、summary.ok>0,且至少一个 provider
 * 自身可用(status=ok 且 is_in_cooldown=false 且 consecutive_failures=0)。
 *
 * 夹具跑真实脚本(本地 HTTP 桩 + 真 pwsh),不是复刻判据:
 *   T1 静态:旧 HTTP 码判据不得回潮,三枚信封字段必须在位
 *   T2 全挂(HTTP 200)必须 FAIL —— 修前此处是 PASS
 *   T3 一好一坏(好的不在冷却/无连续失败)必须 PASS —— 防空转恒红
 *   T4 全冷却(HTTP 200、summary.ok>0)必须 FAIL
 *   T5 业务 code != 0(HTTP 200)必须 FAIL
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPT = join(REPO, 'deploy', 'win', 'test-health.ps1')

function findPwsh() {
  const cands = [
    process.env.PWSH_PATH,
    'C:/Program Files/PowerShell/7/pwsh.exe',
    'C:/Program Files (x86)/PowerShell/7/pwsh.exe',
  ].filter(Boolean)
  for (const c of cands) if (existsSync(c)) return c
  return null
}

const provider = (status, cooldown = false, failures = 0) => ({
  provider: `p-${status}-${cooldown}-${failures}`,
  status,
  is_in_cooldown: cooldown,
  consecutive_failures: failures,
  model_count: status === 'ok' ? 5 : 0,
})

const envelope = (code, providers, summary) => ({ code, message: 'ok', data: { providers, total: providers.length, summary } })

const CASES = {
  'all-down': envelope(
    0,
    [provider('unreachable', false, 3), provider('invalid_key', false, 2)],
    { total: 2, ok: 0, invalid_key: 1, unreachable: 1, not_configured: 0 },
  ),
  'one-usable': envelope(
    0,
    [provider('ok', false, 0), provider('unreachable', true, 4)],
    { total: 2, ok: 1, invalid_key: 0, unreachable: 1, not_configured: 0 },
  ),
  'all-cooldown': envelope(
    0,
    [provider('ok', true, 2), provider('ok', true, 5)],
    { total: 2, ok: 2, invalid_key: 0, unreachable: 0, not_configured: 0 },
  ),
  'bad-code': envelope(
    7,
    [provider('ok', false, 0)],
    { total: 1, ok: 1, invalid_key: 0, unreachable: 0, not_configured: 0 },
  ),
}

/** 本地桩:web 页 / api health / 登录 / provider 健康信封,其余 404。 */
function startStub(mode) {
  const server = createServer((req, res) => {
    const json = (body) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    if (req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end('<!DOCTYPE html><html><body>fixture</body></html>')
      return
    }
    if (req.url === '/api/health') return json({ status: 'ok' })
    if (req.url === '/api/auth/login/username') return json({ data: { accessToken: 'fixture-token' } })
    if (req.url === '/api/llm/providers/health') return json(CASES[mode])
    res.writeHead(404)
    res.end('not found')
  })
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)))
}

const llmVerdict = (out) => {
  const m = out.match(/^(PASS|FAIL)\s+llm\b/m)
  return m ? m[1] : '(没打印 llm 行)'
}

/** 必须用异步 spawn:同步 spawnSync 会堵死本进程事件循环,桩服务器就无法应答。 */
function runPwsh(pwsh, args, opts) {
  return new Promise((done) => {
    const child = spawn(pwsh, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    const timer = setTimeout(() => child.kill(), 60_000)
    child.on('close', (status, signal) => {
      clearTimeout(timer)
      done({ status, signal, stdout, stderr })
    })
  })
}

async function runHealth(mode, t) {
  const pwsh = findPwsh()
  if (!pwsh) {
    t.skip('未判定:取不到 PowerShell 7 ⇒ 不能据此判绿(§0.3)')
    return null
  }
  const server = await startStub(mode)
  const port = server.address().port
  try {
    const r = await runPwsh(
      pwsh,
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, '-Base', `http://127.0.0.1:${port}`],
      {
        cwd: REPO,
        windowsHide: true,
        env: {
          ...process.env,
          IHUI_ADMIN_PASSWORD: 'fixture-password',
          // 端口 1 必然拒绝 ⇒ wss 维快速失败,不影响我们要断言的 llm 维
          IHUI_WS_PROBE_URL: 'ws://127.0.0.1:1/probe',
        },
      },
    )
    const out = `${r.stdout || ''}\n${r.stderr || ''}`
    assert.match(out, /^(PASS|FAIL)\s+llm\b/m, `脚本没打印 llm 维结论 ⇒ 无法判定。输出:\n${out.slice(0, 500)}`)
    return out
  } finally {
    // Invoke-WebRequest 会复用连接;不主动断掉 keep-alive 会让 node --test 挂在收尾
    server.closeAllConnections()
    server.close()
  }
}

test('T1 静态:llm 判据必须读信封,不得回潮成 HTTP 码', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  assert.ok(src.includes('function Get-LlmProvidersHealthVerdict'), '信封判据函数缺失 ⇒ 又只剩 HTTP 200')
  assert.ok(!/llmOk\s*=\s*\(\$rr\.StatusCode/.test(src), '旧判据 `$llmOk = ($rr.StatusCode ...)` 回潮了')
  for (const field of ['summary', 'is_in_cooldown', 'consecutive_failures']) {
    assert.ok(src.includes(field), `判据没有读 ${field} ⇒ 信封内的健康结论被忽略`)
  }
})

test('T2 行为:HTTP 200 但 provider 全挂 ⇒ 必须 FAIL(修前此处 PASS)', async (t) => {
  const out = await runHealth('all-down', t)
  if (!out) return
  assert.equal(llmVerdict(out), 'FAIL', `provider 全挂仍判绿:\n${out}`)
  assert.match(out, /usable=0/, '红线没给出可用 provider 数 ⇒ 无法现读故障面')
})

test('T3 行为:一个可用 + 一个冷却 ⇒ PASS(防"恒红"空转)', async (t) => {
  const out = await runHealth('one-usable', t)
  if (!out) return
  assert.equal(llmVerdict(out), 'PASS', `仍有可用 provider 却判红:\n${out}`)
  assert.match(out, /cooldown=1/, 'detail 没把冷却 provider 数写出来')
})

test('T4 行为:HTTP 200、summary.ok>0 但全部 in_cooldown ⇒ 必须 FAIL', async (t) => {
  const out = await runHealth('all-cooldown', t)
  if (!out) return
  assert.equal(llmVerdict(out), 'FAIL', `全部 provider 冷却仍判绿:\n${out}`)
})

test('T5 行为:HTTP 200 但信封 code != 0 ⇒ 必须 FAIL', async (t) => {
  const out = await runHealth('bad-code', t)
  if (!out) return
  assert.equal(llmVerdict(out), 'FAIL', `信封业务码非 0 仍判绿:\n${out}`)
  assert.match(out, /code=7/, 'detail 没带上信封 code')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
