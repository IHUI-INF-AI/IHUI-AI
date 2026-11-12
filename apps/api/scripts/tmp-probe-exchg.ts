// 一次性诊断(2026-11-12):同一枚本机设备身份 → 号池各枚 rt 能否换出票。
//
// 关键约束:换票通道 **2xx 会轮换 rt** ⇒ 池里那枚当场作废。所以本探针必须
//   ① 只跑一次(永久性跑过即跳过,见 LEDGER);
//   ② 换成功后立刻 CAS 回写,把新 rt 存回池,绝不蒸发。
// 不打印任何凭据。用法:tsx scripts/tmp-probe-exchg.ts [uid ...](缺省 = 池内全部 trae 行)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { config as dotenvConfig } from 'dotenv'

const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.resolve(API_DIR, '..', '..')
dotenvConfig({ path: path.join(API_DIR, '.env') })

const LEDGER = path.join(ROOT, '.ihui-agent', 'state', 'trae-rt-rotation-probe.json')

const ex = await import(pathToFileURL(path.join(ROOT, 'scripts/lib/trae-auth-extract.mjs')).href)
const sw = await import(pathToFileURL(path.join(ROOT, 'scripts/lib/trae-client-switch.mjs')).href)
const proto = await import('../src/services/upstream-adapters/trae-protocol.js')

const { eq } = await import('drizzle-orm')
const { aiRelayAccountPool } = await import('@ihui/database')
const { decryptField, encryptField } = await import('../src/utils/crypto.js')
const { db } = await import('../src/db/index.js')

const storageFile = sw.findStorageFile() as string
const store = JSON.parse(fs.readFileSync(storageFile, 'utf8')) as Record<string, unknown>
const dev = ex.extractDeviceMaterial(store) as {
  deviceId: string
  machineId?: string
  privateKeyPem: string
  publicKeyPem: string
} | null
if (!dev) {
  console.log('读不到本机设备身份')
  process.exit(2)
}

const ledger = fs.existsSync(LEDGER)
  ? (JSON.parse(fs.readFileSync(LEDGER, 'utf8')) as { rows: Record<string, string> })
  : { rows: {} }
console.log('本机 deviceId =', dev.deviceId)
console.log('本机 ClientVersion =', proto.TRAE_IDE_VERSION)

async function tryOne(rt: string): Promise<{ status: number; text: string; ms: number }> {
  let last = { status: 0, text: '', ms: 0 }
  for (const combo of proto.TRAE_EXCHANGE_TOKEN_COMBOS) {
    const t0 = Date.now()
    let res: Response
    let text = ''
    try {
      res = await fetch(proto.TRAE_EXCHANGE_TOKEN_PROOF_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cloudide-token': '' },
        body: JSON.stringify(
          proto.buildExchangeTokenProofBody({
            deviceId: dev!.deviceId,
            machineId: dev!.machineId || undefined,
            privateKeyPem: dev!.privateKeyPem,
            publicKeyPem: dev!.publicKeyPem,
            clientId: combo.clientId,
            platformCode: combo.platformCode,
            refreshToken: rt,
          }),
        ),
      })
      text = await res.text().catch(() => '')
    } catch (e) {
      return { status: -1, text: `net:${(e as Error).message}`, ms: Date.now() - t0 }
    }
    last = { status: res.status, text, ms: Date.now() - t0 }
    // 2xx 才轮换 rt;非 2xx 继续试下一条产品线(与切号预检口径一致)
    if (res.ok) return last
  }
  return last
}

function classify(text: string): { code: string; hint: string; view: string } {
  try {
    const j = JSON.parse(text) as Record<string, any>
    const code = String(j?.ResponseMetadata?.Error?.Code ?? '')
    const result = j?.Result ?? j?.result ?? null
    const view = result && typeof result === 'object' ? Object.keys(result).join(',') : ''
    const msg = JSON.stringify(j?.ResponseMetadata?.Error?.Data ?? {})
    const hint = /NotInCache|not in cache|device.*cache/i.test(msg) ? msg.slice(0, 140) : ''
    return { code, hint, view }
  } catch {
    return { code: '', hint: text.slice(0, 140), view: '' }
  }
}

const uids = process.argv.slice(2)
const rows = (await db
  .select()
  .from(aiRelayAccountPool)
  .where(eq(aiRelayAccountPool.providerCode, 'trae'))) as any[]

for (const r of rows) {
  const uid = String(r.uid)
  if (uids.length > 0 && !uids.includes(uid)) continue
  if (ledger.rows[uid]) {
    console.log(`\nuid=${uid} 跳过(已探过:${ledger.rows[uid]})`)
    continue
  }
  let rt = ''
  try {
    rt = r.refreshTokenEnc ? decryptField(r.refreshTokenEnc) : ''
  } catch {}
  if (!rt) {
    ledger.rows[uid] = 'no-refresh-token'
    fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2))
    continue
  }
  const res = await tryOne(rt)
  const okTicket = res.status >= 200 && res.status < 300
  const c = classify(res.text)
  let persisted = ''
  if (okTicket) {
    let payload: { token?: string; refreshToken?: string; expiresAt?: Date | null } | null = null
    try {
      payload = proto.extractTokenPayload(JSON.parse(res.text))
    } catch {}
    if (payload?.token) {
      const applied = await db
        .update(aiRelayAccountPool)
        .set({
          tokenEnc: encryptField(payload.token),
          ...(payload.refreshToken ? { refreshTokenEnc: encryptField(payload.refreshToken) } : {}),
          ...(payload.expiresAt ? { tokenExpiresAt: payload.expiresAt } : {}),
          lastRefreshAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(aiRelayAccountPool.id, r.id))
        .returning({ id: aiRelayAccountPool.id })
      persisted = applied.length > 0 ? '新票已回写池' : 'CAS 未命中'
    }
  }
  ledger.rows[uid] = okTicket ? `ok(${persisted})` : `${res.status}/${c.code || '?'}`
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2))
  console.log(
    `\nuid=${uid} name=${r.name} deviceId=${r.deviceId ?? '(none)'} → HTTP ${res.status} (${res.ms}ms) 码=${c.code || '-'} ${persisted}`,
  )
  if (!okTicket) {
    console.log('  缓存提示:', c.hint || '(无)')
    console.log('  响应顶部键:', c.view || '(无)')
    console.log('  raw(截 360):', res.text.slice(0, 360).replace(/[A-Za-z0-9+/=_-]{40,}/g, '<redacted>'))
  }
}
fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2))
await (db as any).$client?.end?.()
process.exit(0)
