// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// 一次性诊断：只对生产 8802 打非流式 qoder/auto，隔离「流式先发→非流式并发」交互。
try {
  process.loadEnvFile?.()
} catch {}

import { eq } from 'drizzle-orm'

const BASE = process.env.E2E_BASE || 'http://127.0.0.1:8802'
const MODEL = process.env.E2E_MODEL || 'qoder/auto'

async function main(): Promise<void> {
  const { db } = await import('../src/db/index.js')
  const { developerApiKeys, users } = await import('@ihui/database')
  const { createKey } = await import('../src/services/developer-api-keys-service.js')

  const admin = (await db.select().from(users).limit(1))[0]
  if (!admin) throw new Error('无用户可挂 Key')
  const { apiKey, secret } = await createKey(String(admin.id), { name: `ns-probe-${Date.now()}` })
  await db.update(developerApiKeys).set({ tokenBalance: -1, costBalanceCents: -1 }).where(eq(developerApiKeys.id, apiKey.id))
  const credential = `${apiKey.key}.${secret}`

  try {
    const t0 = Date.now()
    const res2 = await fetch(`${BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${credential}` },
      body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: '只回答两个字：你好' }] }),
    })
    const dt = Date.now() - t0
    const text2 = await res2.text()
    let body2: Record<string, unknown> = {}
    try { body2 = JSON.parse(text2) } catch {}
    const u2 = (body2['usage'] ?? {}) as Record<string, unknown>
    console.log(`[ns-probe] 非流式 HTTP ${res2.status} 耗时 ${dt}ms`)
    console.log(`[ns-probe] usage.credits=${String(u2['credits'])} x_qoder_credits=${String(body2['x_qoder_credits'])} x_qoder_sdk_model=${String(body2['x_qoder_sdk_model'])}`)
    console.log(`[ns-probe] body: ${JSON.stringify(body2).slice(0, 600)}`)
    console.log(`[ns-probe] 结论: ${res2.ok && (typeof u2['credits'] === 'number' || typeof body2['x_qoder_credits'] === 'number') ? 'PASS' : 'FAIL'}`)
  } finally {
    await db.delete(developerApiKeys).where(eq(developerApiKeys.id, apiKey.id))
    console.log('[ns-probe] 临时 Key 已删除')
  }
  setTimeout(() => process.exit(process.exitCode ?? 0), 200).unref()
}

main().catch((e) => { console.error('[ns-probe] FATAL', e); process.exit(1) })
