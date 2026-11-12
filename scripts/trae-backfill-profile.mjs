// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
/**
 * Trae 号池·裸票号档案补齐(2026-11-12 立)。
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
 * 退出码:0 成功 / 1 业务失败 / 2 未判定。
 */
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const API_DIR = path.join(ROOT, 'apps', 'api')
const GET_USER_INFO_URL = 'https://api.trae.cn/cloudide/api/v3/trae/GetUserInfo'
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

async function main(argv) {
  if (argv.length === 0 || has(argv, '--help')) {
    process.stdout.write(
      '用法: node apps/api/node_modules/tsx/dist/cli.mjs scripts/trae-backfill-profile.mjs --list\n' +
        '      ... --uid <uid> [--dry-run]\n' +
        '      ... --all-bare\n',
    )
    return argv.length === 0 ? 2 : 0
  }
  const dryRun = has(argv, '--dry-run')

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
  const cryptoMod = pathToFileURL(path.join(API_DIR, 'src', 'utils', 'crypto.js')).href
  const { decryptField, encryptField } = await import(cryptoMod)
  const { db } = await import(pathToFileURL(path.join(API_DIR, 'src', 'db', 'index.js')).href)

  const rows = await db
    .select()
    .from(aiRelayAccountPool)
    .where(eq(aiRelayAccountPool.providerCode, 'trae'))

  const sec = (r) => {
    try {
      return r.secretsEnc ? JSON.parse(decryptField(r.secretsEnc)) : null
    } catch {
      return null
    }
  }
  const hasProfile = (r) => {
    const s = sec(r)
    const a = s?.profile?.account
    return !!(a && typeof a === 'object' && Object.keys(a).length > 0)
  }

  /** 拉真实档案(客户端同款端点) */
  const fetchUserInfo = async (token) => {
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

  if (has(argv, '--list')) {
    console.log('号池 trae 各号(缺档案 = 写回后会被判 need-update ⇒ 当场登出):')
    for (const r of rows) {
      console.log(
        `  uid=${String(r.uid).padEnd(17)} ${String(r.name).padEnd(13)} ${hasProfile(r) ? '有档案 ✓' : '缺档案 ⚠'}`,
      )
    }
    await db.$client?.end?.()
    return 0
  }

  let targets = []
  if (has(argv, '--all-bare')) targets = rows.filter((r) => !hasProfile(r))
  else {
    const uid = arg(argv, '--uid')
    if (!uid) {
      process.stderr.write('❌ 需要 --uid / --all-bare / --list\n')
      return 2
    }
    const r = rows.find((x) => String(x.uid) === String(uid))
    if (!r) {
      process.stderr.write(`❌ 号池里没有 uid=${uid}\n`)
      return 1
    }
    targets = [r]
  }

  if (targets.length === 0) {
    console.log('没有缺档案的号')
    await db.$client?.end?.()
    return 0
  }

  let ok = 0
  for (const r of targets) {
    const uid = String(r.uid)
    console.log(`\n═══ 补档案 uid=${uid} ${r.name} ═══`)
    const token = r.tokenEnc ? decryptField(r.tokenEnc) : ''
    if (!token) {
      console.error('❌ 无 token(密文解不出)⇒ 未判定')
      continue
    }
    const got = await fetchUserInfo(token)
    if (got.error) {
      console.error(`❌ 拉档案失败:${got.error}`)
      continue
    }
    const upstream = got.result
    if (String(upstream.UserID) !== uid) {
      console.error(`❌ 档案 uid 不符(上游 ${upstream.UserID} ≠ ${uid})⇒ 拒绝写入,不猜`)
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
    console.log(`  档案:${account.username} / ${account.nonPlainTextMobile} / region=${account.storeRegion} / migrateToSG=${account.migrateToSG}`)

    if (dryRun) {
      console.log('  (dry-run,不写盘)')
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
      console.error('⚠️ 回写未命中(CAS)')
      continue
    }
    console.log('✅ 档案已补齐(profile + sessionTemplate)')
    ok += 1
  }

  await db.$client?.end?.()
  console.log(`\n完成:${ok}/${targets.length} 枚`)
  return ok === targets.length ? 0 : 1
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
