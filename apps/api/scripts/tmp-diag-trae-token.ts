// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as dotenvConfig } from 'dotenv'
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const API_DIR = path.resolve(SCRIPT_DIR, '..')
dotenvConfig({ path: path.resolve(API_DIR, '.env') })
const { eq } = await import('drizzle-orm')
const { aiRelayAccountPool } = await import('@ihui/database')
const { decryptField } = await import('../src/utils/crypto.js')
const { db } = await import('../src/db/index.js')

const targets = ['340221726063980', '3770697304515840']
const rows = await db
  .select()
  .from(aiRelayAccountPool)
  .where(eq(aiRelayAccountPool.providerCode, 'trae'))
console.log('trae rows:', rows.length)
for (const r of rows as any[]) {
  if (!targets.includes(String(r.uid))) continue
  console.log('\n================ uid', r.uid, '|', r.name, '================')
  console.log(
    'health=',
    r.healthStatus,
    'enabled=',
    r.isEnabled,
    'deviceId=',
    r.deviceId ?? '(none)',
  )
  console.log(
    'tokenExpiresAt=',
    r.tokenExpiresAt,
    'refreshExpiresAt=',
    r.refreshExpiresAt,
    'lastRefreshAt=',
    r.lastRefreshAt,
    'updatedAt=',
    r.updatedAt,
  )
  let token = ''
  try {
    token = r.tokenEnc ? decryptField(r.tokenEnc) : ''
  } catch (e: any) {
    console.log('token decrypt FAIL', e.message)
  }
  console.log('token len=', token.length, 'segments=', token.split('.').length)
  const seg = token.split('.')
  if (seg.length >= 2) {
    try {
      // seg.length >= 2 已保证下标 1 存在,非空断言只收窄类型,不改运行时行为
      const p = JSON.parse(Buffer.from(seg[1]!, 'base64url').toString('utf8'))
      const pick = (o: any, d = 0): any => {
        if (d > 2) return '…'
        if (Array.isArray(o)) return `[${o.length}]`
        if (o && typeof o === 'object') {
          const x: any = {}
          for (const [k, v] of Object.entries(o)) x[k] = pick(v, d + 1)
          return x
        }
        return o
      }
      console.log('JWT payload:', JSON.stringify(pick(p)))
      if (p.exp)
        console.log(
          'exp=',
          new Date(p.exp * 1000).toISOString(),
          'now=',
          new Date().toISOString(),
          'expired=',
          Date.now() > p.exp * 1000,
        )
      if (p.iat) console.log('iat=', new Date(p.iat * 1000).toISOString())
    } catch (e: any) {
      console.log('JWT parse fail', e.message)
    }
  } else {
    console.log('token head(8)=', token.slice(0, 8), '(not JWT)')
  }
  let rt = ''
  try {
    rt = r.refreshTokenEnc ? decryptField(r.refreshTokenEnc) : ''
  } catch {}
  console.log('refreshToken len=', rt.length, 'head4=', rt.slice(0, 4))
  try {
    const s = r.secretsEnc ? JSON.parse(decryptField(r.secretsEnc)) : null
    if (s) {
      console.log('secrets keys:', Object.keys(s))
      const redact = (o: any, d = 0): any => {
        if (d > 3) return '…'
        if (Array.isArray(o)) return `[${o.length}]`
        if (o && typeof o === 'object') {
          const x: any = {}
          for (const [k, v] of Object.entries(o)) {
            x[k] =
              typeof v === 'string' && /token|key|pem|secret/i.test(k)
                ? `<len=${(v as string).length}>`
                : redact(v, d + 1)
          }
          return x
        }
        return o
      }
      console.log('secrets:', JSON.stringify(redact(s)).slice(0, 2000))
      const prof: any = (s as any).profile
      if (prof)
        console.log(
          'profile.account keys:',
          prof.account ? Object.keys(prof.account) : '(no account)',
        )
      const tpl: any = (s as any).sessionTemplate
      if (tpl)
        console.log(
          'sessionTemplate keys:',
          Object.keys(tpl),
          'account keys:',
          tpl.account ? Object.keys(tpl.account) : '(no account)',
        )
    }
  } catch (e: any) {
    console.log('secrets decrypt fail', e.message)
  }
}
await (db as any).$client?.end?.()
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
