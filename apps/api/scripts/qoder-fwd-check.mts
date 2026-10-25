// © 2026 IHUI AI. 一次性：带 userId 直接调 forwardToChannel（非流式 qoder/auto）看是否返回 ok 且带 x_qoder_credits。
try { process.loadEnvFile?.() } catch {}
import { eq } from 'drizzle-orm'
const { db } = await import('../src/db/index.js')
const { users } = await import('@ihui/database')
const { forwardToChannel } = await import('../src/services/relay-upstream-forwarder.js')
const { registerAllRelayAdapters } = await import('../src/services/upstream-adapters/index.js')
await registerAllRelayAdapters()
const admin = (await db.select().from(users).limit(1))[0]
const userId = String(admin.id)
console.log('using userId=', userId)
const r = await forwardToChannel({
  model: 'qoder/auto',
  messages: [{ role: 'user', content: '只回答两个字：你好' }],
  stream: false,
  userId,
})
console.log('result ok=', !!r?.ok, 'channel=', r?.channel?.providerCode, 'status=', (r as any)?.response?.status, 'reason=', (r as any)?.reason)
if (r?.ok) {
  const j = await r.response.json()
  console.log('body has x_qoder_credits=', typeof j['x_qoder_credits'], '=', j['x_qoder_credits'])
  console.log('usage=', JSON.stringify(j['usage']))
  console.log('model=', j['model'])
} else {
  console.log('full reason=', JSON.stringify(r))
}
process.exit(0)
