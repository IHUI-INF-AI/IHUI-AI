// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 号池 → wb-switch 明文副本导出腿(2026-11-17 立)。
 *
 * ## 为什么要有这条腿
 *
 * `workbuddy-growth-sweep.mjs` / `workbuddy-growth-daily.mjs` 的凭据来源是
 * `~/.wb-switch/backups/workbuddy-desktop.pool-<uid>.info` 明文副本(见
 * `workbuddy-growth-experts.mjs` 的 `listPoolAccounts` / `readPoolCredential`)。
 * 而号池真相源在数据库 `ai_relay_account_pool`。二者之间此前**没有任何自动同步**:
 * 副本目录为空时,整条签到/领奖编排腿 `--dry-run` 直接 exit 2「号池里没有可用账号副本」,
 * 且计划任务从未安装 —— 功能开发了但两条都没落地(2026-11-17 实测)。
 *
 * 本腿把数据库里 enabled 的 workbuddy 行逐行解密,按 wb-switch 快照形状写成 .info:
 *
 *   { account: { uid, nickname, phoneNumber }, auth: { accessToken, refreshToken, domain } }
 *
 * ## 红线
 *
 * · 只读数据库,不写库;
 * · 明文 token 只落 `~/.wb-switch/backups`(该目录本就是 wb-switch 的凭据目录,设计内);
 * · stdout 永不回显 token 全文,只打长度与 sha12;
 * · 取不到 DATABASE_URL / 解密失败 ⇒ 该行跳过并点名,绝不写半残副本。
 *
 * ## 用法
 *
 *   node scripts/workbuddy-pool-info-export.mjs            # 导出
 *   node scripts/workbuddy-pool-info-export.mjs --dry-run  # 只报将写哪些,零写盘
 *
 * 环境: DATABASE_URL + CREDENTIALS_ENCRYPTION_KEY(优先进程环境,回落到 --env-file 或默认生产 .env)。
 * 退出码: 0 至少导出一份 / 1 全部失败 / 2 未判定(无库可用或副本目录不可建)。
 */
import { createDecipheriv, createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { join, resolve } from 'node:path'

const DEFAULT_ENV_FILE = 'D:\\DevEnv\\ihui-prod\\apps\\api\\.env'

/** 解析命令行(纯函数,离线可测) */
export function parseArgs(argv) {
  const opts = { dryRun: false, help: false, envFile: null }
  const arr = Array.isArray(argv) ? argv : []
  for (let i = 0; i < arr.length; i++) {
    const a = arr[i]
    if (a === '--dry-run') opts.dryRun = true
    else if (a === '--help' || a === '-h') opts.help = true
    else if (a === '--env-file') opts.envFile = arr[i + 1] ?? null
  }
  return opts
}

/** 极简 .env 解析(纯函数):忽略注释与空行,去成对引号 */
export function parseEnvText(text) {
  const map = {}
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if (v.length >= 2) {
      const q = v[0]
      if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
    }
    map[m[1]] = v
  }
  return map
}

/** AES-256-GCM 解密(与 api 侧同参数);payload 为 {iv,ciphertext,tag} base64 的 JSON 字符串 */
export function decryptStored(stored, keyBuf) {
  if (stored === null || stored === undefined) return null
  let p
  try {
    p = JSON.parse(stored)
  } catch {
    return String(stored)
  }
  if (!p || typeof p !== 'object' || typeof p.ciphertext !== 'string') return String(stored)
  try {
    const d = createDecipheriv('aes-256-gcm', keyBuf, Buffer.from(p.iv, 'base64'))
    d.setAuthTag(Buffer.from(p.tag, 'base64'))
    const out = Buffer.concat([d.update(Buffer.from(p.ciphertext, 'base64')), d.final()]).toString('utf8')
    try {
      return JSON.parse(out)
    } catch {
      return out
    }
  } catch {
    return null
  }
}

/** 从解密结果里取 accessToken(容忍字符串或对象两态) */
export function accessTokenOf(decrypted) {
  if (typeof decrypted === 'string') return decrypted
  if (decrypted && typeof decrypted === 'object') {
    const v = decrypted.accessToken ?? decrypted.access_token ?? decrypted.token
    if (typeof v === 'string' && v) return v
  }
  return null
}

/** 快照文件路径(与 wb-switch 同形:workbuddy-desktop.pool-<uid>.info) */
export function snapshotPath(dir, uid) {
  return join(dir, `workbuddy-desktop.pool-${uid}.info`)
}

/** 组装快照树(纯函数):形状对齐 workbuddy-growth-experts 的读取面 */
export function buildSnapshotTree({ uid, name, accessToken, refreshToken, domain, rowId, now }) {
  return {
    account: { uid: String(uid), nickname: String(name ?? ''), phoneNumber: String(name ?? '') },
    auth: {
      accessToken: String(accessToken),
      refreshToken: String(refreshToken ?? ''),
      domain: String(domain || 'copilot.tencent.com'),
    },
    _source: {
      from: 'ai_relay_account_pool',
      rowId: String(rowId),
      poolUid: String(uid),
      generatedAt: String(now ?? new Date().toISOString()),
    },
  }
}

const HELP = `用法:
  node scripts/workbuddy-pool-info-export.mjs [--dry-run] [--env-file <path>]
    从 ai_relay_account_pool 导出 enabled 的 workbuddy 凭据为 ~/.wb-switch/backups/*.info
    (workbuddy-growth-sweep / -daily 的凭据来源)

环境: DATABASE_URL + CREDENTIALS_ENCRYPTION_KEY(优先进程环境,回落 .env)
退出码: 0 有导出的份 / 1 全失败 / 2 未判定(无库或目录不可建)
`

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log(HELP)
    return 0
  }
  const envFile = opts.envFile || process.env.IHUI_ENV_FILE || DEFAULT_ENV_FILE
  const fileEnv = existsSync(envFile) ? parseEnvText(readFileSync(envFile, 'utf8')) : {}
  const databaseUrl = process.env.DATABASE_URL || fileEnv.DATABASE_URL
  const keyRaw = process.env.CREDENTIALS_ENCRYPTION_KEY || fileEnv.CREDENTIALS_ENCRYPTION_KEY
  if (!databaseUrl || !keyRaw) {
    console.log(`未判定: 缺 DATABASE_URL 或 CREDENTIALS_ENCRYPTION_KEY(envFile=${envFile})`)
    return 2
  }
  const keyBuf = Buffer.from(String(keyRaw).slice(0, 32))

  const poolDir = join(os.homedir(), '.wb-switch', 'backups')
  if (!existsSync(poolDir)) {
    if (opts.dryRun) {
      console.log(`dry-run: 副本目录尚不存在,将创建 ${poolDir}`)
    } else {
      try {
        mkdirSync(poolDir, { recursive: true })
      } catch {
        console.log(`未判定: 无法创建副本目录 ${poolDir}`)
        return 2
      }
    }
  }

  const pnpmDir = readdirSync(resolve('node_modules/.pnpm')).find((d) => /^postgres@/.test(d))
  if (!pnpmDir) {
    console.log('未判定: node_modules 里找不到 postgres 包')
    return 2
  }
  const mod = await import(`file:///${resolve(`node_modules/.pnpm/${pnpmDir}/node_modules/postgres/src/index.js`).replace(/\\/g, '/')}`)
  const pg = mod.default || mod
  const sql = pg(databaseUrl, { max: 1 })

  let rows
  try {
    rows = await sql`
      SELECT id, uid, name, token_enc, refresh_token_enc, secrets_enc
      FROM ai_relay_account_pool
      WHERE provider_code = 'workbuddy' AND is_enabled = true
      ORDER BY id
    `
  } catch (e) {
    console.log('未判定: 读库失败', String(e && e.message ? e.message : e).slice(0, 160))
    await sql.end({ timeout: 5 }).catch(() => {})
    return 2
  }

  let wrote = 0
  let failed = 0
  for (const r of rows) {
    const tok = decryptStored(r.token_enc, keyBuf)
    const accessToken = accessTokenOf(tok)
    if (!accessToken) {
      console.log(`跳过(无可用 accessToken): ${String(r.uid).slice(0, 12)} ${r.name}`)
      failed++
      continue
    }
    const ref = decryptStored(r.refresh_token_enc, keyBuf)
    const sec = decryptStored(r.secrets_enc, keyBuf)
    const domain =
      (sec && typeof sec === 'object' && (sec.domain || sec.domainId)) || 'copilot.tencent.com'
    const tree = buildSnapshotTree({
      uid: r.uid,
      name: r.name,
      accessToken,
      refreshToken: typeof ref === 'string' ? ref : ref?.refreshToken || '',
      domain,
      rowId: r.id,
    })
    const file = snapshotPath(poolDir, r.uid)
    const sha12 = createHash('sha256').update(accessToken).digest('hex').slice(0, 12)
    if (opts.dryRun) {
      console.log(`dry-run: 将写 ${file} (uid=${String(r.uid).slice(0, 12)} tokenLen=${accessToken.length} sha12=${sha12})`)
    } else {
      writeFileSync(file, JSON.stringify(tree, null, 2), 'utf8')
      console.log(`写入 ${String(r.uid).slice(0, 12)} ${r.name} tokenLen=${accessToken.length} sha12=${sha12}`)
    }
    wrote++
  }

  await sql.end({ timeout: 5 }).catch(() => {})
  console.log(`WORKBUDDY-POOL-EXPORT ${JSON.stringify({ mode: opts.dryRun ? 'dry-run' : 'apply', rows: rows.length, wrote, failed })}`)
  if (wrote > 0) return 0
  return rows.length === 0 ? 2 : 1
}

const isMain = import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`
if (isMain) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.log('未判定: 未捕获异常', String(e && e.message ? e.message : e).slice(0, 200))
      process.exit(2)
    })
}

export { main }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
