// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ACP 标准会话生命周期 —— **真实协议端到端验证**。
 *
 * 与 `acp-session-replay.test.ts` 的分工:
 *   - 那个文件直接调 `IhuiAcpAgent` 的方法(类级);
 *   - 本脚本起一个真实的 `ihui acp` 子进程,按 ACP 的 NDJSON/JSON-RPC 收发,
 *     证明这四个方法**在协议线上真的可达**(不是被 SDK 的 method registry 拦掉)。
 *
 * 这一点不能只靠单测:ACP SDK 对未知方法返回 `-32601 Method not found`,
 * 而"方法实现了但没注册"和"方法没实现"在客户端看是同一个错误。
 *
 * 用法:
 *   node scripts/verify-cli-acp-session-lifecycle.mjs
 * 退出码:0 全通;1 有断言失败(逐条打印失败点)。
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const cliRoot = path.resolve(import.meta.dirname, '..', 'apps', 'cli')
const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-acp-lifecycle-'))

const failures = []
function check(name, ok, detail) {
  if (ok) {
    console.log(`  ✓ ${name}`)
  } else {
    failures.push(`${name}${detail ? `: ${detail}` : ''}`)
    console.log(`  ✗ ${name}${detail ? `: ${detail}` : ''}`)
  }
}

const proc = spawn('npx', ['tsx', 'src/index.ts', 'acp'], {
  cwd: cliRoot,
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
  shell: true,
  env: { ...process.env, IHUI_CLI_SESSIONS_DIR: sessionsDir, IHUI_LOCALE: 'zh-CN' },
})

let buf = ''
const pending = new Map()
proc.stdout.on('data', (d) => {
  buf += d.toString()
  let idx
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx).trim()
    buf = buf.slice(idx + 1)
    if (!line) continue
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      continue
    }
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
    }
  }
})

let nextId = 1
function request(method, params, timeoutMs = 20000) {
  const id = nextId++
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`${method} 超时 ${timeoutMs}ms`))
    }, timeoutMs)
    pending.set(id, (msg) => {
      clearTimeout(timer)
      resolve(msg)
    })
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
  })
}

function seedSession(history) {
  const id = `sess_e2e_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
  const now = new Date().toISOString()
  const payload = {
    id,
    createdAt: now,
    updatedAt: now,
    workspacePath: process.cwd(),
    modelId: 'e2e-model',
    history,
  }
  fs.writeFileSync(path.join(sessionsDir, `${id}.json`), JSON.stringify(payload, null, 2), {
    mode: 0o600,
  })
  return id
}

async function main() {
  // 等子进程起来(tsx 编译需要时间)
  await new Promise((r) => setTimeout(r, 3500))

  const init = await request('initialize', {
    protocolVersion: 1,
    clientCapabilities: {},
    clientInfo: { name: 'verify-lifecycle', version: '1.0.0' },
  })
  check('initialize 成功', !init.error, init.error?.message)
  check('initialize 声明 loadSession', init.result?.agentCapabilities?.loadSession === true)

  const sessionId = seedSession([
    { role: 'user', content: '端到端问题一' },
    { role: 'assistant', content: '端到端回答一' },
  ])

  // ---- session/list ----
  const list = await request('session/list', { cwd: process.cwd() })
  check('session/list 不是 Method not found', list.error?.code !== -32601, JSON.stringify(list.error))
  check('session/list 返回 sessions 数组', Array.isArray(list.result?.sessions))
  check(
    'session/list 能看到刚种下的会话',
    (list.result?.sessions ?? []).some((s) => s.sessionId === sessionId),
  )
  const listed = (list.result?.sessions ?? []).find((s) => s.sessionId === sessionId)
  check('session/list 带 title', listed?.title === '端到端问题一', JSON.stringify(listed?.title))

  // ---- session/resume(带游标) ----
  const resume = await request('session/resume', {
    sessionId,
    replayFrom: { type: 'ihui.replay/turn', last: 10 },
  })
  check('session/resume 不是 Method not found', resume.error?.code !== -32601, JSON.stringify(resume.error))
  check('session/resume 无错误', resume.error === undefined, resume.error?.message)
  check('session/resume 回 planKind=window', resume.result?._meta?.planKind === 'window', JSON.stringify(resume.result?._meta))

  // ---- session/resume(非法游标必须被拒) ----
  const bad = await request('session/resume', {
    sessionId,
    replayFrom: { type: 'wrong', last: 1 },
  })
  check('非法游标被拒(有 error)', bad.error !== undefined, JSON.stringify(bad.result))
  check('非法游标不是 Method not found', bad.error?.code !== -32601)

  // ---- session/fork ----
  const fork = await request('session/fork', { sessionId })
  check('session/fork 不是 Method not found', fork.error?.code !== -32601, JSON.stringify(fork.error))
  const forkedId = fork.result?.sessionId
  check('session/fork 产出新 sessionId', typeof forkedId === 'string' && forkedId !== sessionId)
  check('fork 出的会话真的落盘', fs.existsSync(path.join(sessionsDir, `${forkedId}.json`)))

  // ---- session/delete ----
  const del = await request('session/delete', { sessionId: forkedId })
  check('session/delete 不是 Method not found', del.error?.code !== -32601, JSON.stringify(del.error))
  check('session/delete 成功后文件消失', !fs.existsSync(path.join(sessionsDir, `${forkedId}.json`)))

  // ---- 幂等:再删一次 ----
  const del2 = await request('session/delete', { sessionId: forkedId })
  check('session/delete 幂等(再删不报错)', del2.error === undefined, del2.error?.message)

  proc.kill()
  fs.rmSync(sessionsDir, { recursive: true, force: true })

  if (failures.length > 0) {
    console.error(`\n✗ ACP 会话生命周期验证失败 ${failures.length} 项:`)
    for (const f of failures) console.error(`   - ${f}`)
    process.exit(1)
  }
  console.log('\n✅ ACP 标准会话生命周期端到端验证通过(13 项断言)')
}

main().catch((e) => {
  console.error('✗ 验证脚本异常:', e?.message ?? e)
  try {
    proc.kill()
  } catch {
    /* ignore */
  }
  process.exit(1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
