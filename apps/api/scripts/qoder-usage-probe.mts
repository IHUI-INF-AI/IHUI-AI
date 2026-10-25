// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder token 计量取证探针（一次性，2026-10-23 立）。
 *
 * 背景：`usage` 在网关上恒 0，需判定「上游是否真的没有 token 维度」，而不是我们取错层。
 * 本探针做三件事：
 *   1) 从 ai_relay_account_pool 解出 qoder 账号的 device token / 刷新票 / Cosy 设备头；
 *   2) 打官方配额端点 GET /api/v2/quota/usage，**全量原样**转储（不挑键），
 *      看除 addOnQuota.remaining 外是否存在 token / 请求数 / 明细维度；
 *   3) 探测若干候选计量端点（只读 GET，404/403 只记不炸），给出可达性。
 *
 * 运行：
 *   pnpm --filter @ihui/api exec tsx scripts/qoder-usage-probe.mts
 * 产物：outputs/qoder-quota-usage-raw.json（全量回包），终端打印键树 + token 直传行。
 * 注意：会把 device token 打到 stdout（供下一步 SDK 转储复用），不落盘。
 */
try {
  process.loadEnvFile?.()
} catch {
  // 依赖外部注入
}

import fs from 'node:fs'
import path from 'node:path'
import { and, eq } from 'drizzle-orm'

const BASE = 'https://gateway.qoder.com.cn'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Qoder/0.4.9 Chrome/120.0.0.0 Electron/28.0.0 Safari/537.36'

type AnyRow = Record<string, unknown>

function safe(v: unknown, depth = 0): unknown {
  if (depth > 8) return '[depth]'
  if (v === null || typeof v !== 'object') return v
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => safe(x, depth + 1))
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(v as object)) {
    try {
      out[k] = safe((v as AnyRow)[k], depth + 1)
    } catch {
      out[k] = '[throw]'
    }
  }
  return out
}

function keyTree(v: unknown, p = '', acc: string[] = [], depth = 0): string[] {
  if (depth > 8 || v === null || typeof v !== 'object') return acc
  if (Array.isArray(v)) {
    if (v.length > 0) keyTree(v[0], `${p}[0]`, acc, depth + 1)
    return acc
  }
  for (const k of Object.keys(v as object)) {
    const np = p ? `${p}.${k}` : k
    const val = (v as AnyRow)[k]
    const shown =
      val === null || typeof val === 'object'
        ? Array.isArray(val)
          ? `array(${val.length})`
          : 'object'
        : JSON.stringify(val)
    acc.push(`${np} = ${shown}`)
    keyTree(val, np, acc, depth + 1)
  }
  return acc
}

async function main(): Promise<void> {
  const { db } = await import('../src/db/index.js')
  const { aiRelayAccountPool } = await import('@ihui/database')
  const pool = await import('../src/services/relay-account-pool-service.js')
  const adapterMod = await import('../src/services/upstream-adapters/qoder-adapter.js')

  const rows = (await db
    .select()
    .from(aiRelayAccountPool)
    .where(and(eq(aiRelayAccountPool.providerCode, 'qoder'), eq(aiRelayAccountPool.isEnabled, true)))) as AnyRow[]

  if (rows.length === 0) {
    console.error('NO_QODER_ACCOUNT')
    process.exit(2)
  }
  console.log(`[probe] qoder 启用账号 ${rows.length} 个`)

  const report: AnyRow[] = []

  for (const row of rows) {
    const creds = pool.decryptAccountCredentials(row as never)
    const ctx = {
      row,
      credentials: {
        token: creds.token,
        refreshToken: creds.refreshToken,
        cookies: creds.cookies,
        secrets: creds.secrets ?? {},
      },
      extraMetadata: row['extraMetadata'] ?? {},
    }
    const headers = adapterMod.buildCosyHeaders(ctx as never)
    const token = String(creds.token || '')
    console.log(
      `\n[probe] 账号 #${String(row['id'])} name=${String(row['name'] ?? '')} token=${token.slice(0, 10)}…(${token.length}) exp=${String(row['tokenExpiresAt'] ?? '')}`
    )
    console.log(`  TOKEN=${token}`)
    console.log(`  EXP=${new Date(String(row['tokenExpiresAt'] ?? 0)).getTime()}`)
    console.log(`  cosyHeaders=${JSON.stringify(Object.keys(headers))}`)

    const common = {
      accept: 'application/json',
      'accept-language': 'zh-CN',
      'content-type': 'application/json',
      'user-agent': UA,
      authorization: `Bearer ${token}`,
      ...headers,
    } as Record<string, string>

    // 已知配额端点 + 候选计量端点（只读 GET）
    const endpoints = [
      '/api/v2/quota/usage',
      '/api/v2/quota/statistics',
      '/api/v2/quota/detail',
      '/api/v2/quota/usage/detail',
      '/api/v2/user/usage',
      '/api/v2/usage/token',
      '/api/v2/billing/usage',
      '/api/v2/usage',
    ]

    const perAccount: AnyRow = { accountId: row['id'], name: row['name'], endpoints: {} }
    for (const ep of endpoints) {
      const url = BASE + ep
      const started = Date.now()
      try {
        const res = await fetch(url, { method: 'GET', headers: common })
        const text = await res.text()
        let body: unknown = text
        try {
          body = JSON.parse(text)
        } catch {
          /* 非 JSON 原样保留 */
        }
        const entry = {
          status: res.status,
          ms: Date.now() - started,
          bytes: text.length,
          body: res.status === 200 ? safe(body) : text.slice(0, 400),
        }
        ;(perAccount['endpoints'] as AnyRow)[ep] = entry
        console.log(`  GET ${ep} → ${res.status} ${text.length}B ${entry.ms}ms`)
      } catch (e) {
        ;(perAccount['endpoints'] as AnyRow)[ep] = { error: (e as Error).message }
        console.log(`  GET ${ep} → ERR ${(e as Error).message}`)
      }
    }
    report.push(perAccount)
  }

  const out = path.resolve('../../outputs/qoder-quota-usage-raw.json')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, JSON.stringify(report, null, 2))
  console.log(`\n[probe] wrote ${out}`)

  // 键树：把每个 200 回包的所有键路径打出来，专看有没有 token 维度
  for (const acct of report) {
    const eps = acct['endpoints'] as AnyRow
    for (const [ep, entry] of Object.entries(eps)) {
      const e = entry as AnyRow
      if (e['status'] !== 200) continue
      console.log(`\n[probe] === ${String(ep)} 键树 ===`)
      for (const line of keyTree(e['body'], '')) console.log('  ' + line)
    }
  }
}

main().catch((e) => {
  console.error('[probe] FATAL', e)
  process.exit(1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
