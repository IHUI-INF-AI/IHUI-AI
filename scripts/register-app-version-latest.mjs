#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * register-app-version-latest.mjs — 把「某个 APK 版本」登记成 app_versions 的 latest 行(2026-10-29 立,Y-14)
 *
 * 为什么要它:更新卡读的是 `GET /api/app-version/latest?platform=android`,服务端判据是
 * `status='latest'` + platform(见 apps/api/src/routes/app-version.ts 的 /latest 处理),
 * 不是"取 buildNumber 最大的那行"。所以表里没有 latest 行时,端点会 200 回一个空 data,
 * App 侧就"没有可点的下载按钮"。§"登记"必须有可重复执行的器物,而不是让人去后台点三下。
 *
 * 两条执行腿(都能幂等,都不手改生产库):
 *   A. `--via api`(默认):走 admin 端点 `POST/PUT /api/app-version`。
 *      前置:一枚管理员 JWT(roleId>=1 的人用令牌)。`requireAdmin` 只认人用 JWT,
 *      internal service token **不能**打开 admin 面(见 plugins/require-permission.ts 注释)。
 *      ⇒ 这一腿是 OWNER-ONLY:令牌只能机主自己登录后给。
 *   B. `--via db`:直连生产库执行单事务 UPDATE/INSERT。
 *      前置:一台能连生产库的机器 + DATABASE_URL。生产库无直连通道、生产 Windows 部署机
 *      无 SSH ⇒ 这一腿同样只能在生产机上由机主执行,属于 OWNER-ONLY。
 *
 * 幂等(三态, 由 buildPlan() 纯函数决定):
 *   noop   —— 已有唯一 latest 行且 version/buildNumber/downloadUrl 全等 ⇒ 一个字节都不写
 *   update —— 有同 version 行但状态/地址/构建号不符,或同平台存在多条 latest ⇒ 收敛到一行
 *   create —— 表里完全没有该 version 行 ⇒ INSERT(status='latest')
 *
 * 安全默认:`--apply` 不加就只打印计划(dry-run),绝不写。凭据缺失一律 exit 2「未判定」。
 *
 * 用法:
 *   node scripts/register-app-version-latest.mjs --help
 *   node scripts/register-app-version-latest.mjs                       # 打印计划(dry-run)
 *   node scripts/register-app-version-latest.mjs --apply --via api --admin-token "$JWT"
 *   node scripts/register-app-version-latest.mjs --apply --via db --db-url "$DATABASE_URL"
 *
 * 退出码:0 已执行或 dry-run 计划已打印 / 1 执行失败 / 2 未判定(缺凭据、缺参数、前置不满足)
 */
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..')

// 与票面/线上 apk 端点实测同源:0.0.9 / 26102816 来自 apk 文件名 ihui-ai-0.0.9-26102816.apk
// 与 302 响应头 x-release-version / x-release-version-code,不是抄票面文字。
export const DEFAULTS = {
  platform: 'android',
  version: '0.0.9',
  buildNumber: 26102816,
  downloadUrl: 'https://www.aizhs.top/remote-images/download/ihui-ai-latest.apk',
  baseUrl: 'https://www.aizhs.top',
}

// =============================================================================
// 纯决策(不碰网络/DB ⇒ 幂等性可被镜像测试逐条钉)
// =============================================================================

/**
 * @param {{id:string,version:string,buildNumber:number,status:string,downloadUrl?:string|null}[]} rows 同平台全部行
 * @param {{version:string,buildNumber:number,downloadUrl:string}} desired
 * @returns {{action:'noop'|'update'|'create', targetId?:string, demoteIds:string[], reason:string}}
 */
export function buildPlan(rows, desired) {
  const list = Array.isArray(rows) ? rows : []
  const latestRows = list.filter((r) => r.status === 'latest')
  const sameVersion = list.filter((r) => String(r.version) === String(desired.version))

  if (
    latestRows.length === 1 &&
    sameVersion.length === 1 &&
    sameVersion[0].id === latestRows[0].id
  ) {
    const r = latestRows[0]
    const same =
      Number(r.buildNumber) === Number(desired.buildNumber) &&
      String(r.downloadUrl ?? '') === String(desired.downloadUrl)
    if (same) {
      return {
        action: 'noop',
        targetId: r.id,
        demoteIds: [],
        reason: `已是唯一 latest 且版本/地址一致(id=${r.id}) ⇒ 不写`,
      }
    }
    return {
      action: 'update',
      targetId: r.id,
      demoteIds: [],
      reason: `latest 行存在但内容不符(build ${r.buildNumber}→${desired.buildNumber}, url ${r.downloadUrl ?? 'null'}) ⇒ 就地收敛`,
    }
  }

  if (sameVersion.length > 0) {
    // 同 version 多行时取 buildNumber 最大的一条作为落点(其余同 version 的 latest 一并降级)
    const target = [...sameVersion].sort((a, b) => Number(b.buildNumber) - Number(a.buildNumber))[0]
    const demoteIds = latestRows.filter((r) => r.id !== target.id).map((r) => r.id)
    return {
      action: 'update',
      targetId: target.id,
      demoteIds,
      reason:
        `存在 ${sameVersion.length} 条 version=${desired.version} 行,选 buildNumber 最大的一条(id=${target.id});` +
        `另需降级 ${demoteIds.length} 条同平台 latest` +
        (latestRows.length > 1 ? `(当前同平台 latest 有 ${latestRows.length} 条,数据已腐烂)` : ''),
    }
  }

  return {
    action: 'create',
    demoteIds: latestRows.map((r) => r.id),
    reason:
      `表内没有 ${desired.version} 行 ⇒ INSERT 为 latest` +
      (latestRows.length > 0
        ? `,并把既有 ${latestRows.length} 条 latest 降级`
        : '(当前无任何 latest 行,与线上空 data 现状一致)'),
  }
}

/** 参数形状校验(不合法 ⇒ 未判定,而不是发一个注定 400 的请求)。 */
export function validateDesired({ platform, version, buildNumber, downloadUrl }) {
  const red = []
  if (!/^[a-z]+$/.test(String(platform))) red.push(`platform 非法: ${platform}`)
  if (!/^\d+\.\d+\.\d+$/.test(String(version))) red.push(`version 不是 X.Y.Z: ${version}`)
  if (!Number.isInteger(Number(buildNumber)) || Number(buildNumber) <= 0)
    red.push(`buildNumber 不是正整数: ${buildNumber}`)
  let u = null
  try {
    u = new URL(String(downloadUrl))
  } catch {
    red.push(`downloadUrl 不是绝对 URL: ${downloadUrl}`)
  }
  if (u) {
    if (u.protocol !== 'https:') red.push(`downloadUrl 不是 https: ${downloadUrl}`)
    if (!String(u.hostname).endsWith('aizhs.top')) red.push(`downloadUrl 不在自有域: ${u.hostname}`)
    if (u.pathname.length > 512) red.push('downloadUrl 超过列宽 512')
  }
  return red
}

// =============================================================================
// A 腿:admin 端点
// =============================================================================

async function apiJson(
  url,
  { method = 'GET', token, body, fetchImpl = fetch, timeoutMs = 20000 } = {},
) {
  const res = await fetchImpl(url, {
    method,
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let parsed = null
  try {
    parsed = JSON.parse(text)
  } catch {
    /* 非 JSON 由调用方按 HTTP 状态判 */
  }
  return { httpStatus: res.status, body: parsed, raw: text.slice(0, 300) }
}

/** 拉该平台全部行(分页收敛;pageSize 上限 100 由端点 schema 钉死)。 */
export async function fetchAllRowsViaApi({
  baseUrl,
  platform,
  token,
  fetchImpl = fetch,
  timeoutMs = 20000,
} = {}) {
  const out = []
  for (let page = 1; page <= 20; page++) {
    const r = await apiJson(
      `${baseUrl}/api/app-version?platform=${platform}&page=${page}&pageSize=100`,
      { token, fetchImpl, timeoutMs },
    )
    if (r.httpStatus === 401 || r.httpStatus === 403)
      throw new Error(`admin 令牌被拒(HTTP ${r.httpStatus}): ${r.raw}`)
    if (r.httpStatus !== 200 || r.body?.code !== 0)
      throw new Error(`admin 列表失败(HTTP ${r.httpStatus}): ${r.raw}`)
    const list = r.body?.data?.list
    if (!Array.isArray(list)) throw new Error('admin 列表响应缺 data.list')
    out.push(...list)
    if (list.length < 100) break
  }
  return out
}

export async function applyViaApi({
  baseUrl,
  platform,
  version,
  buildNumber,
  downloadUrl,
  token,
  apply,
  fetchImpl = fetch,
}) {
  const rows = await fetchAllRowsViaApi({ baseUrl, platform, token, fetchImpl })
  const plan = buildPlan(rows, { version, buildNumber, downloadUrl })
  console.log(`[plan] ${plan.action}: ${plan.reason}`)
  if (plan.action === 'noop' || !apply) return { plan, wrote: false }

  if (plan.action === 'create') {
    const r = await apiJson(`${baseUrl}/api/app-version`, {
      method: 'POST',
      token,
      fetchImpl,
      body: { version, platform, buildNumber: Number(buildNumber), downloadUrl, status: 'latest' },
    })
    if (r.httpStatus !== 201 && r.httpStatus !== 200)
      throw new Error(`POST 失败(HTTP ${r.httpStatus}): ${r.raw}`)
    console.log(`[write] POST /api/app-version → 201 id=${r.body?.data?.version?.id ?? '?'}`)
  } else {
    if (!plan.targetId) throw new Error('update 计划缺 targetId')
    const r = await apiJson(`${baseUrl}/api/app-version/${plan.targetId}`, {
      method: 'PUT',
      token,
      fetchImpl,
      body: { status: 'latest', buildNumber: Number(buildNumber), downloadUrl, version },
    })
    if (r.httpStatus !== 200) throw new Error(`PUT 失败(HTTP ${r.httpStatus}): ${r.raw}`)
    console.log(`[write] PUT /api/app-version/${plan.targetId} → 200`)
  }

  // 自证:写后重读 /latest(公开端点),用与对账脚本同一判据复核
  const after = await apiJson(`${baseUrl}/api/app-version/latest?platform=${platform}`, {
    token: '',
    fetchImpl,
  })
  const row = after.body?.data?.latest
  if (!row) throw new Error('写后 /latest 仍为空 ⇒ 登记没生效(不要报成功)')
  if (String(row.version) !== String(version) || Number(row.buildNumber) !== Number(buildNumber)) {
    throw new Error(
      `写后 /latest 指向 ${row.version}/${row.buildNumber},与目标 ${version}/${buildNumber} 不符`,
    )
  }
  console.log(
    `[verify] /latest 现读 → ${row.version}/${row.buildNumber} status=${row.status} url=${row.downloadUrl}`,
  )
  return { plan, wrote: true, row }
}

// =============================================================================
// B 腿:直连库(单事务;postgres.js 从 packages/database 解析,避免根目录解析失败)
// =============================================================================

export function loadPostgresDriver() {
  const requireFromPkg = createRequire(
    pathToFileURL(join(REPO, 'packages/database/package.json')).href,
  )
  const mod = requireFromPkg('postgres')
  return mod?.default ?? mod
}

/**
 * @param {{sql:Function, platform:string, version:string, buildNumber:number, downloadUrl:string, apply:boolean}} p
 * 幂等:先读全部行 → buildPlan;noop 直接返回;否则单事务「降级其它 latest → 升格/INSERT」。
 */
export async function applyViaDb({ sql, platform, version, buildNumber, downloadUrl, apply }) {
  const rows =
    await sql`select id, version, build_number, status, download_url from app_versions where platform = ${platform}`
  const mapped = rows.map((r) => ({
    id: r.id,
    version: r.version,
    buildNumber: Number(r.build_number),
    status: r.status,
    downloadUrl: r.download_url,
  }))
  const plan = buildPlan(mapped, { version, buildNumber, downloadUrl })
  console.log(`[plan] ${plan.action}: ${plan.reason}`)
  if (plan.action === 'noop' || !apply) return { plan, wrote: false }

  await sql.begin(async (tx) => {
    if (plan.action === 'create') {
      await tx`update app_versions set status = 'history', updated_at = now() where platform = ${platform} and status = 'latest'`
      await tx`insert into app_versions (version, platform, build_number, download_url, force_update, status, created_at, updated_at)
               values (${version}, ${platform}, ${Number(buildNumber)}, ${downloadUrl}, false, 'latest', now(), now())`
    } else {
      // 先降级**其它** latest(含同 version 的重复行),再把目标行升格 —— 顺序反了会出现两条 latest
      await tx`update app_versions set status = 'history', updated_at = now()
               where platform = ${platform} and status = 'latest' and id <> ${plan.targetId}`
      await tx`update app_versions set status = 'latest', build_number = ${Number(buildNumber)},
               download_url = ${downloadUrl}, updated_at = now() where id = ${plan.targetId}`
    }
  })

  const after = await sql`select version, build_number, status, download_url from app_versions
                          where platform = ${platform} and status = 'latest'`
  if (after.length !== 1) throw new Error(`写后 latest 行数为 ${after.length},应为 1(不要报成功)`)
  const row = after[0]
  if (String(row.version) !== String(version) || Number(row.build_number) !== Number(buildNumber)) {
    throw new Error(
      `写后 latest=${row.version}/${row.build_number},与目标 ${version}/${buildNumber} 不符`,
    )
  }
  console.log(
    `[verify] db 现读 latest → ${row.version}/${row.build_number} url=${row.download_url}`,
  )
  return { plan, wrote: true, row }
}

// =============================================================================
// CLI
// =============================================================================

export function parseArgs(argv, env = process.env) {
  const out = {
    via: 'api',
    baseUrl: DEFAULTS.baseUrl,
    platform: DEFAULTS.platform,
    version: DEFAULTS.version,
    buildNumber: DEFAULTS.buildNumber,
    downloadUrl: DEFAULTS.downloadUrl,
    token: env.IHUI_ADMIN_TOKEN || '',
    dbUrl: env.DATABASE_URL || '',
    apply: false,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--via') out.via = argv[++i] ?? ''
    else if (a === '--base-url') out.baseUrl = (argv[++i] ?? '').replace(/\/+$/, '')
    else if (a === '--platform') out.platform = argv[++i] ?? ''
    else if (a === '--version') out.version = argv[++i] ?? ''
    else if (a === '--build-number') out.buildNumber = Number(argv[++i] ?? 0)
    else if (a === '--download-url') out.downloadUrl = argv[++i] ?? ''
    else if (a === '--admin-token') out.token = argv[++i] ?? ''
    else if (a === '--db-url') out.dbUrl = argv[++i] ?? ''
    else if (a === '--apply') out.apply = true
    else if (a === '--help' || a === '-h') out.help = true
    else throw new Error(`未知参数: ${a}`)
  }
  return out
}

const HELP = `用法: node scripts/register-app-version-latest.mjs [--via api|db] [选项] [--apply]

默认值(来自线上 apk 实测,不是抄票面):
  --platform android  --version 0.0.9  --build-number 26102816
  --download-url ${DEFAULTS.downloadUrl}
  --base-url ${DEFAULTS.baseUrl}

A 腿(需管理员 JWT,OWNER-ONLY):
  --via api --admin-token <JWT>   (或环境变量 IHUI_ADMIN_TOKEN)
B 腿(需生产库连接串,只能在生产机执行,OWNER-ONLY):
  --via db  --db-url <DATABASE_URL>  (或环境变量 DATABASE_URL)

不加 --apply = dry-run,只打印计划;退出码 0 未判定 2。`

async function main() {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (e) {
    console.error(`未判定: ${e.message}`)
    return 2
  }
  if (args.help) {
    console.log(HELP)
    return 0
  }
  if (args.via !== 'api' && args.via !== 'db') {
    console.error(`未判定: --via 只能是 api 或 db(收到 ${JSON.stringify(args.via)})`)
    return 2
  }
  const bad = validateDesired(args)
  if (bad.length > 0) {
    console.error(`未判定: 参数不合规 ⇒ 不发注定失败的请求\n  - ${bad.join('\n  - ')}`)
    return 2
  }

  if (args.via === 'api') {
    if (!args.token) {
      console.error(
        '未判定: A 腿缺管理员 JWT。requireAdmin 只认人用 JWT,internal token 打不开 admin 面 ⇒ 本腿 OWNER-ONLY。\n' +
          '  唯一命令(机主登录后把 JWT 填进 <JWT>):\n' +
          `  node scripts/register-app-version-latest.mjs --apply --via api --admin-token <JWT>`,
      )
      return 2
    }
    const r = await applyViaApi({ ...args, token: args.token })
    if (!r.wrote) console.log('[dry-run] 未写任何数据(加 --apply 才执行)')
    return 0
  }

  if (!args.dbUrl) {
    console.error(
      '未判定: B 腿缺 DATABASE_URL。生产库无直连通道、生产部署机无 SSH ⇒ 本腿只能在生产机上由机主执行(OWNER-ONLY)。\n' +
        '  唯一命令(在生产 Windows 机、仓库根目录、设好 DATABASE_URL 后):\n' +
        `  node scripts/register-app-version-latest.mjs --apply --via db`,
    )
    return 2
  }
  const postgres = loadPostgresDriver()
  const sql = postgres(args.dbUrl, { max: 1, idle_timeout: 5, connect_timeout: 15, prepare: false })
  try {
    const r = await applyViaDb({ sql, ...args })
    if (!r.wrote) console.log('[dry-run] 未写任何数据(加 --apply 才执行)')
    return 0
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {})
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}`)
      process.exit(1)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
