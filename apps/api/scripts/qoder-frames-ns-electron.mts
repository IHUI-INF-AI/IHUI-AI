// © 2026 IHUI AI. 一次性：在 Electron(asar 支持)下直连 SDK 非流式，dump 每帧定位 credits。
import { spawn } from 'node:child_process'
// ── 自举为 Electron-as-Node（为 asar 支持）──
if (!process.versions.electron) {
  const exe = 'D:/电脑软件/Qoder CN/Qoder CN.exe'
  const child = spawn(exe, [process.argv[1], ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  })
  child.on('exit', (c) => process.exit(c ?? 0))
  process.on('SIGTERM', () => child.kill('SIGTERM'))
  process.on('SIGINT', () => child.kill('SIGINT'))
  await new Promise(() => {})
}

import { readFileSync } from 'node:fs'
import { createDecipheriv } from 'node:crypto'
import postgres from 'postgres'

const envText = readFileSync('D:/IHUI-AI/apps/api/.env', 'utf8')
const env: Record<string, string> = {}
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const KEY = (env['CREDENTIALS_ENCRYPTION_KEY'] || '').slice(0, 32)
function decryptField(stored: string): string {
  const parsed = JSON.parse(stored)
  const { iv, ciphertext, tag } = parsed
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(KEY), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  const pt = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()])
  const text = pt.toString('utf8')
  try { return JSON.parse(text) } catch { return text }
}

const sql = postgres(env['DATABASE_URL'] || '')
const rows = await sql`select token_enc, token_expires_at from ai_relay_account_pool where provider_code = 'qoder' limit 2`
console.log('qoder rows=', rows.length)
const token = decryptField(rows[0].token_enc)
console.log('token len=', token?.length)

const SDK = 'file:///' + 'D:/电脑软件/Qoder CN/.qoder-versions/0.4.9/resources/app.asar/node_modules/@qoder-ai/qoder-cn-agent-sdk/dist/index.js'.replace(/\\/g, '/')
const mod: any = await import(SDK)
const auth = mod.jobToken(async () => ({ token, expiresAt: Date.now() + 3600000 }))
const it = mod.query({ prompt: '只回答两个字：你好', options: { cwd: 'D:/IHUI-AI/.qoder-bridge-cwd', auth, tools: [] } })
let n = 0
for await (const msg of it) {
  n++
  const keys = Object.keys(msg || {})
  const summary: any = { type: msg?.type, subtype: msg?.subtype }
  if (msg?.message?.usage) summary.usage = msg.message.usage
  if (msg?.total_credits !== undefined) summary.total_credits = msg.total_credits
  if (msg?.modelUsage) summary.modelUsage = msg.modelUsage
  if (msg?.request_id) summary.request_id = msg.request_id
  if (msg?.usage) summary.usage_top = msg.usage
  if (msg?.result && typeof msg.result === 'string') summary.result_len = msg.result.length
  console.log(`FRAME ${n} :: ${JSON.stringify(summary).slice(0, 800)}`)
}
console.log('total frames=', n)
await sql.end()
process.exit(0)
