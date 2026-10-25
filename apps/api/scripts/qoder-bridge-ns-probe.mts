// © 2026 IHUI AI. 一次性：raw SQL 取 token → 起桥 → 非流式 HTTP 调桥 → dump 全响应。
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
const exp = rows[0].token_expires_at instanceof Date ? rows[0].token_expires_at.getTime() : Date.now() + 3600000
console.log('token len=', token?.length)

const cleanDir = mkdtempSync(join(tmpdir(), 'qb-ns-'))
const key = 'probe-' + Date.now().toString(36)
const bridgePath = 'D:/IHUI-AI/scripts/qoder-chat-bridge.mjs'
const child = spawn('D:/电脑软件/Qoder CN/Qoder CN.exe', [bridgePath, '--port', '0', '--key', key, '--cwd', cleanDir], {
  env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'],
})
let port = 0
let buf = ''
const onData = (d: Buffer) => {
  buf += d.toString('utf8')
  const m = buf.match(/QODER_BRIDGE_READY\s*(\{.*\})/)
  if (m && !port) { try { port = JSON.parse(m[1]).port; console.log('bridge ready port=', port) } catch {} }
}
child.stdout.on('data', onData)
child.stderr.on('data', (d) => { const s = d.toString('utf8'); if (s.includes('QODER_BRIDGE_READY')) onData(Buffer.from(s)); else if (/listening|error|ERROR/.test(s)) process.stderr.write('[bridge] ' + s) })

const to = setTimeout(() => { console.error('bridge start timeout'); child.kill('SIGKILL'); process.exit(3) }, 60000)
await new Promise<void>((res) => { const t = setInterval(() => { if (port) { clearInterval(t); res() } }, 200); setTimeout(() => res(), 55000) })
clearTimeout(to)
if (!port) { child.kill('SIGKILL'); process.exit(3) }

const res2 = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'x-qoder-token-exp': String(exp), 'x-qoder-bridge-key': key },
  body: JSON.stringify({ model: 'auto', messages: [{ role: 'user', content: '只回答两个字：你好' }] }),
})
const text = await res2.text()
console.log('bridge non-stream HTTP', res2.status)
console.log('bridge BODY:', text.slice(0, 1000))
child.kill('SIGKILL')
await sql.end()
process.exit(0)
