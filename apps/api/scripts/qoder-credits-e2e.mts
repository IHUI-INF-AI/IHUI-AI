// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
/**
 * Qoder 计量端到端验收（一次性，2026-10-23 立）。
 *
 * 验的是「真实扣减量 credits 能否从桥一路走到对外 /v1 响应」：
 *   建临时 Key（余额置无限）→ 打生产 8802 /v1/chat/completions（模型 qoder/auto）
 *   → 流式带 stream_options.include_usage → 断言终止 usage 帧出现 credits → 删 Key。
 *
 * 运行：pnpm --filter @ihui/api exec tsx scripts/qoder-credits-e2e.mts
 * 退出码：全断言通过 0，否则 1。
 */
try {
  process.loadEnvFile?.()
} catch {
  /* 依赖外部注入 */
}

import { eq } from 'drizzle-orm'

const BASE = process.env.E2E_BASE || 'http://127.0.0.1:8802'
const MODEL = process.env.E2E_MODEL || 'qoder/auto'

async function main(): Promise<void> {
  const { db } = await import('../src/db/index.js')
  const { developerApiKeys, users } = await import('@ihui/database')
  const { createKey } = await import('../src/services/developer-api-keys-service.js')

  const admin = (await db.select().from(users).limit(1))[0]
  if (!admin) throw new Error('无用户可挂 Key')

  const { apiKey, secret } = await createKey(String(admin.id), { name: `e2e-credits-${Date.now()}` })
  await db
    .update(developerApiKeys)
    .set({ tokenBalance: -1, costBalanceCents: -1 })
    .where(eq(developerApiKeys.id, apiKey.id))
  const key = String(apiKey.key)
  const credential = `${key}.${secret}`
  console.log(`[e2e] key=${key.slice(0, 10)}… secret=${secret.slice(0, 8)}…`)

  try {
    // ---- 流式 ----
    const res = await fetch(`${BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${credential}` },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        stream_options: { include_usage: true },
        messages: [{ role: 'user', content: '只回答两个字：你好' }],
      }),
    })
    console.log(`[e2e] stream HTTP ${res.status}`)
    if (!res.ok) throw new Error(`stream 非 200: ${await res.text()}`)
    const text = await res.text()
    const lines = text.split('\n').filter((l) => l.startsWith('data: '))
    const usageFrame = lines.find((l) => l.includes('"usage"') && l.includes('"choices":[]'))
    console.log(`[e2e] 帧数=${lines.length} DONE=${lines.filter((l) => l.trim() === 'data: [DONE]').length}`)
    console.log(`[e2e] usage 帧: ${usageFrame?.slice(0, 300) ?? '(缺失)'}`)
    const hasCredits = !!usageFrame && /"credits":\s*[0-9.]+/.test(usageFrame)
    console.log(`[e2e] credits 出现在终止 usage 帧: ${hasCredits ? 'PASS' : 'FAIL'}`)

    // ---- 非流式 ----
    const res2 = await fetch(`${BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${credential}` },
      body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: '只回答两个字：你好' }] }),
    })
    const body2 = (await res2.json()) as Record<string, unknown>
    const u2 = (body2['usage'] ?? {}) as Record<string, unknown>
    console.log(`[e2e] 非流式 HTTP ${res2.status} usage.credits=${String(u2['credits'])} x_qoder_credits=${String(body2['x_qoder_credits'])}`)
    console.log(`[e2e] 非流式 body: ${JSON.stringify(body2).slice(0, 500)}`)
    const hasCredits2 = typeof u2['credits'] === 'number' || typeof body2['x_qoder_credits'] === 'number'

    const ok = hasCredits && hasCredits2
    console.log(`[e2e] 结论: ${ok ? 'PASS' : 'FAIL'}`)
    process.exitCode = ok ? 0 : 1
  } finally {
    await db.delete(developerApiKeys).where(eq(developerApiKeys.id, apiKey.id))
    console.log('[e2e] 临时 Key 已删除')
  }
  // 关闭连接池/保活，确保脚本退出（否则 node 进程常驻）
  setTimeout(() => process.exit(process.exitCode ?? 0), 200).unref()
}

main().catch((e) => {
  console.error('[e2e] FATAL', e)
  process.exit(1)
})
