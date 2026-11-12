// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Trae 号池·裸票号档案补齐(2026-11-12 立,2026-11-12 二次加固)。
 *
 * 修的病灶(本机实测定位,不是猜测):号池里"裸票导入"的号(secretsEnc 为空)在写回客户端后
 * 会被**当场登出**,根因不在 ticket,而在**档案缺字段**:
 *
 *   客户端登录态判定 `uS(userInfo, isI18n)`:MARSCODE 分支先过 `wle(...)`,
 *   其谓词是 `!account.storeRegion ⇒ NEED_UPDATE`。裸票号没有 profile,
 *   写回走 `buildClientUserInfo` 的最小静态档兜底 ⇒ `storeRegion: ''`
 *   ⇒ 判 **need-update** ⇒ 客户端立刻拿 refreshToken 去换票(REFRESH_TOKEN)
 *   ⇒ 该 rt 由别的设备签发,回 20403 ⇒ 清空登录信封 = 未登录态。
 *
 *   而同一枚号的 token 本身**完全有效**(`CheckLogin` 回 `IsLogin:true`,剩 13 天),
 *   所以这不是"票废了",是"档案不全把客户端推上了它唯一走不通的那条路"。
 *
 * 修法(纯接口,零人工):用有效 token 调客户端同款 `POST /cloudide/api/v3/trae/GetUserInfo`
 * 拉真实档案 → 组装 `profile` + `sessionTemplate` 落进 secretsEnc。补齐后
 * `storeRegion='CN' / storeCountryCode / userTag='cn' / migrateToSG=false` 齐全,
 * 客户端判 `VALID_TOKEN`,直接用现成 token 登录,**不再触发 rt 换票**。
 *
 * 用法:
 *   node apps/api/node_modules/tsx/dist/cli.mjs scripts/trae-backfill-profile.mjs --list
 *   node apps/api/node_modules/tsx/dist/cli.mjs scripts/trae-backfill-profile.mjs --uid <uid> [--dry-run]
 *   node apps/api/node_modules/tsx/dist/cli.mjs scripts/trae-backfill-profile.mjs --all-bare
 *   node apps/api/node_modules/tsx/dist/cli.mjs scripts/trae-backfill-profile.mjs --ensure-uid <uid>
 *     `--ensure-uid` 是给切号腿调的前置自愈档:只在缺档案时才拉上游补,**补齐即返回 0**;
 *     该档**自动补齐全池**(不限指定 uid),因为"切号前把池子喂干净"才是根治口径。
 * 退出码:0 成功(含"无需补")/ 1 业务失败 / 2 未判定。
 */
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const API_DIR = path.join(ROOT, 'apps', 'api')
export const GET_USER_INFO_URL = 'https://api.trae.cn/cloudide/api/v3/trae/GetUserInfo'
const IDE_VERSION = '1.107.1'

const has = (argv, n) => argv.includes(n)
const arg = (argv, n, d = null) => {
  const i = argv.indexOf(n)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}

/**
 * 上游档案 → 客户端 userInfo 的 account 段(字段名逐字对齐客户端本地信封,见
 * scripts/lib/trae-client-switch.mjs 的 buildClientUserInfo 与 buildMinimalAccount)。
 * 上游给的是 BodyCase,客户端要的是 snake_case + 固定默认值 —— 缺项按本仓既有档位补,
 * **不臆造**:email/organization 上游真没给就留空串(客户端这两个字段不参与登录判定)。
 */
export function accountFromGetUserInfo(r) {
  const s = (v) => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v))
  const region = s(r.Region) || s(r.AIRegion) || 'CN'
  return {
    username: s(r.ScreenName),
    iss: '',
    iat: 0,
    organization: '',
    work_country: '',
    email: s(r.NonPlainTextEmail),
    avatar_url: s(r.AvatarUrl),
    description: s(r.Description),
    scope: 'marscode',
    loginScope: 'trae',
    nonPlainTextMobile: s(r.NonPlainTextMobile),
    storeCountryCode: '',
    storeCountrySrc: '',
    // 关键字段:客户端 `uS()` 的 MARSCODE 分支以 `!storeRegion ⇒ need-update`,
    // 空值会把号推上"rt 换票"这条路;这里必须给真实值。
    storeRegion: region,
    userTag: 'cn',
    migrateToSG: r.MigrateToSG === true,
  }
}

/** 档案完整性判据(与客户端 `uS()` 的 MARSCODE 分支同口径):storeRegion 为空即视为缺失 */
export function profileComplete(account) {
  return typeof account?.storeRegion === 'string' && account.storeRegion.trim() !== ''
}

/** 拉真实档案(客户端同款端点) */
async function fetchUserInfo(token) {
  const res = await fetch(GET_USER_INFO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cloudide-token': token },
    body: JSON.stringify({ IDEVersion: IDE_VERSION }),
  })
  const text = await res.text()
  if (!res.ok) return { error: `HTTP ${res.status}: ${text.slice(0, 160)}` }
  let j = null
  try {
    j = JSON.parse(text)
  } catch {
    return { error: `响应非 JSON: ${text.slice(0, 120)}` }
  }
  const r = j?.Result ?? j?.result ?? null
  if (!r || typeof r !== 'object') return { error: `响应无 Result: ${text.slice(0, 160)}` }
  return { result: r }
}

/**
 * 可复用的自愈核心:给一批池行补档案。返回 `{ repaired, skipped, failed }`。
 * 调用方(切号腿 / CLI)共用这一份实现 —— 不在别处再写一遍"怎么算缺档案"。
 */
export async function ensureProfiles(rows, deps, { dryRun = false } = {}) {
  const { decryptField, encryptField, db, aiRelayAccountPool, eq } = deps
  const sec = (r) => {
    try {
      return r.secretsEnc ? JSON.parse(decryptField(r.secretsEnc)) : null
    } catch {
      return null
    }
  }
  const acctOf = (r) => sec(r)?.profile?.account ?? sec(r)?.sessionTemplate?.account ?? null

  const out = { repaired: [], skipped: [], failed: [] }
  for (const r of rows) {
    const uid = String(r.uid)
    if (profileComplete(acctOf(r))) {
      out.skipped.push(uid)
      continue
    }
    const token = r.tokenEnc ? decryptField(r.tokenEnc) : ''
    if (!token) {
      out.failed.push({ uid, why: '无 token(密文解不出)' })
      continue
    }
    const got = await fetchUserInfo(token)
    if (got.error) {
      out.failed.push({ uid, why: `拉档案失败:${got.error}` })
      continue
    }
    const upstream = got.result
    if (String(upstream.UserID) !== uid) {
      out.failed.push({ uid, why: `档案 uid 不符(上游 ${upstream.UserID})` })
      continue
    }
    const account = accountFromGetUserInfo(upstream)
    const profile = {
      host: 'https://api.trae.cn',
      userRegion: { region: account.storeRegion, _aiRegion: account.storeRegion },
      tokenReleaseAt: new Date().toISOString(),
      account,
    }
    const sessionTemplate = { ...profile, userId: uid }
    if (dryRun) {
      out.repaired.push({ uid, name: r.name, account, dryRun: true })
      continue
    }
    const prev = sec(r) ?? {}
    const nextSecrets = { ...prev, profile, sessionTemplate }
    const applied = await db
      .update(aiRelayAccountPool)
      .set({ secretsEnc: encryptField(JSON.stringify(nextSecrets)), updatedAt: new Date() })
      .where(eq(aiRelayAccountPool.id, r.id))
      .returning({ id: aiRelayAccountPool.id })
    if (applied.length === 0) {
      out.failed.push({ uid, why: '回写 CAS 未命中' })
      continue
    }
    out.repaired.push({ uid, name: r.name, account })
  }
  return out
}

async function loadDeps() {
  const requireApi = createRequire(path.join(API_DIR, 'package.json'))
  const resolveApi = (s) => pathToFileURL(requireApi.resolve(s)).href
  try {
    const dotenv = await import(resolveApi('dotenv'))
    dotenv.config({ path: path.join(API_DIR, '.env') })
  } catch (e) {
    process.stderr.write(`⚠️ .env 加载失败:${e.message}\n`)
  }
  const { eq } = await import(resolveApi('drizzle-orm'))
  const { aiRelayAccountPool } = await import(resolveApi('@ihui/database'))
  const { decryptField, encryptField } = await import(
    pathToFileURL(path.join(API_DIR, 'src', 'utils', 'crypto.js')).href
  )
  const { db } = await import(pathToFileURL(path.join(API_DIR, 'src', 'db', 'index.js')).href)
  return { eq, aiRelayAccountPool, decryptField, encryptField, db }
}

async function main(argv) {
  if (argv.length === 0 || has(argv, '--help')) {
    process.stdout.write(
      '用法: node apps/api/node_modules/tsx/dist/cli.mjs scripts/trae-backfill-profile.mjs --list\n' +
        '      ... --uid <uid> [--dry-run]\n' +
        '      ... --all-bare [--dry-run]\n' +
        '      ... --ensure-uid <uid>   # 切号腿前置自愈档:缺档案才动,自动补全池\n',
    )
    return argv.length === 0 ? 2 : 0
  }
  const dryRun = has(argv, '--dry-run')
  const deps = await loadDeps()
  const { eq, aiRelayAccountPool, db } = deps

  const rows = await db
    .select()
    .from(aiRelayAccountPool)
    .where(eq(aiRelayAccountPool.providerCode, 'trae'))

  if (has(argv, '--list')) {
    console.log('号池 trae 各号(缺档案 = 写回后会被判 need-update ⇒ 当场登出):')
    for (const r of rows) {
      const a = (() => {
        try {
          const s = r.secretsEnc ? deps.decryptField(r.secretsEnc) : null
          const o = s ? JSON.parse(s) : null
          return o?.profile?.account ?? o?.sessionTemplate?.account ?? null
        } catch {
          return null
        }
      })()
      console.log(
        `  uid=${String(r.uid).padEnd(17)} ${String(r.name).padEnd(13)} ${profileComplete(a) ? '有档案 ✓' : '缺档案 ⚠'}`,
      )
    }
    await db.$client?.end?.()
    return 0
  }

  // --ensure-uid:切号腿前置自愈。缺档案才动;补完即返回。
  if (has(argv, '--ensure-uid')) {
    const uid = arg(argv, '--ensure-uid')
    if (!uid) {
      process.stderr.write('❌ --ensure-uid 需要 uid\n')
      return 2
    }
    const res = await ensureProfiles(rows, deps, { dryRun })
    if (res.repaired.length > 0) {
      console.log(
        `✅ 自愈补档案 ${res.repaired.length} 枚:` +
          res.repaired.map((x) => `${x.uid}(${x.account?.storeRegion})`).join(' / '),
      )
    }
    if (res.failed.length > 0) {
      console.log(`⚠️ ${res.failed.length} 枚补不了(多为 token 已过期):`)
      for (const f of res.failed) console.log(`   ${f.uid} —— ${f.why}`)
    }
    await db.$client?.end?.()
    // 只要目标 uid 本身不缺档案(或已补齐)就算成功;其它号的失败不拦本次切号
    const targetFailed = res.failed.some((f) => f.uid === String(uid))
    return targetFailed ? 1 : 0
  }

  let targets = []
  if (has(argv, '--all-bare')) targets = rows
  else {
    const uid = arg(argv, '--uid')
    if (!uid) {
      process.stderr.write('❌ 需要 --uid / --all-bare / --list / --ensure-uid\n')
      return 2
    }
    const r = rows.find((x) => String(x.uid) === String(uid))
    if (!r) {
      process.stderr.write(`❌ 号池里没有 uid=${uid}\n`)
      return 1
    }
    targets = [r]
  }

  const res = await ensureProfiles(targets, deps, { dryRun })
  for (const x of res.repaired) {
    console.log(
      `✅ uid=${x.uid} ${x.name}:${x.account.username} / ${x.account.nonPlainTextMobile} / region=${x.account.storeRegion} / migrateToSG=${x.account.migrateToSG}`,
    )
  }
  for (const f of res.failed) console.error(`❌ uid=${f.uid} —— ${f.why}`)
  console.log(
    `\n完成:补齐 ${res.repaired.length} / 已完整 ${res.skipped.length} / 失败 ${res.failed.length}`,
  )
  await db.$client?.end?.()
  return res.failed.length === 0 ? 0 : 1
}

const isDirect = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirect) {
  main(process.argv.slice(2))
    .then((c) => process.exit(c))
    .catch((e) => {
      process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
