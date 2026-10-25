// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// 一次性诊断：直接拉起桥(捕获 stderr)，用真实 qoder 号分别打流式/非流式，定位非流式 95ms 失败根因。
try { process.loadEnvFile?.() } catch {}

import { spawn } from 'node:child_process'
import { eq } from 'drizzle-orm'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const EXE = 'D:/电脑软件/Qoder CN/.qoder-versions/0.4.9/Qoder CN.exe'
// 桥脚本在仓库根 scripts/（与 qoder-bridge-client.ts 的 REPO_ROOT/scripts 一致）
const BRIDGE = fileURLToPath(new URL('../../../scripts/qoder-chat-bridge.mjs', import.meta.url))

async function main(): Promise<void> {
  const { db } = await import('../src/db/index.js')
  const { sql } = await import('drizzle-orm')
  const { decryptAccountCredentials } = await import('../src/services/relay-account-pool-service.js')

  // dev 的 @ihui/database drizzle schema 与 DB 列不同步(缺 owner_user_id)，
  // 改用原生 SQL 只取需要的列，绕过 schema 校验。
  const res = (await db.execute(sql`SELECT id, name, token_enc AS "tokenEnc", refresh_token_enc AS "refreshTokenEnc", token_expires_at AS "tokenExpiresAt" FROM ai_relay_account_pool WHERE provider_code = 'qoder' AND is_enabled = true LIMIT 1`)) as unknown
  // postgres-js 返回数组
  const rows = Array.isArray(res) ? res : (res as { rows?: unknown[] })?.rows ?? []
  if (rows.length === 0) throw new Error('无 qoder 账号')
  const row = rows[0] as Record<string, unknown>
  const creds = decryptAccountCredentials(row as never)
  console.log(`[test] qoder 账号=${row['name']} token长度=${creds.token.length} exp=${String(row['token_expires_at'])}`)
  const token = creds.token
  const expRaw = row['token_expires_at']
  const expiresAt = expRaw instanceof Date ? expRaw.getTime() : (typeof expRaw === 'string' && !Number.isNaN(Date.parse(expRaw)) ? Date.parse(expRaw) : Date.now() + 3600_000)

  const key = crypto.randomBytes(16).toString('hex')
  const cwd = path.join(os.tmpdir(), `qb-test-${Date.now()}`)
  fs.mkdirSync(cwd, { recursive: true })

  const proc = spawn(EXE, [BRIDGE, '--port', '0', '--key', key, '--cwd', cwd], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }) as unknown as { pid: number; stderr?: { on: (e: string, cb: (d: Buffer) => void) => void } }
  let errBuf = ''
  proc.stderr?.on('data', (d: Buffer) => { errBuf += d.toString('utf8') })
  console.log(`[test] 桥 PID=${proc.pid} 启动中… cwd=${cwd}`)

  let port = 0
  let buf = ''
  await new Promise<void>((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('桥启动超时')), 90_000)
    proc.stdout?.on('data', (d: Buffer) => {
      buf += d.toString('utf8')
      const i = buf.indexOf('QODER_BRIDGE_READY ')
      if (i >= 0) {
        const nl = buf.indexOf('\n', i)
        const line = buf.slice(i + 'QODER_BRIDGE_READY '.length, nl < 0 ? undefined : nl).trim()
        try { port = JSON.parse(line).port; clearTimeout(to); resolve() } catch {}
      }
    })
    proc.on('exit', (c: number) => { clearTimeout(to); reject(new Error(`桥提前退出 code=${c} stderr=${errBuf.slice(-1500)}`)) })
  })
  console.log(`[test] 桥就绪 port=${port}`)

  const base = `http://127.0.0.1:${port}`
  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
    'x-qoder-token-exp': String(expiresAt),
    'x-qoder-bridge-key': key,
  }
  const body = { model: 'auto', messages: [{ role: 'user', content: '只回答两个字：你好' }] }

  // 非流式
  try {
    const t0 = Date.now()
    const r = await fetch(`${base}/v1/chat/completions`, { method: 'POST', headers: { ...headers, accept: 'application/json' }, body: JSON.stringify(body) })
    const txt = await r.text()
    console.log(`[test] 非流式 HTTP ${r.status} 耗时 ${Date.now()-t0}ms`)
    console.log(`[test] 非流式 body: ${txt.slice(0, 800)}`)
  } catch (e) { console.log(`[test] 非流式 异常: ${(e as Error).message}`) }

  // 流式
  try {
    const t0 = Date.now()
    const r = await fetch(`${base}/v1/chat/completions`, { method: 'POST', headers: { ...headers, accept: 'text/event-stream' }, body: JSON.stringify({ ...body, stream: true }) })
    console.log(`[test] 流式 HTTP ${r.status} 耗时 ${Date.now()-t0}ms`)
    const txt = await r.text()
    console.log(`[test] 流式 帧数=${txt.split('\n').filter(l=>l.startsWith('data:')).length} 末段: ${txt.slice(-400)}`)
  } catch (e) { console.log(`[test] 流式 异常: ${(e as Error).message}`) }

  console.log(`[test] 桥 stderr 日志: ${errLog}`)
  try { process.kill(proc.pid, 'SIGTERM') } catch {}
  setTimeout(() => process.exit(0), 300).unref()
}

main().catch((e) => { console.error('[test] FATAL', e); process.exit(1) })
