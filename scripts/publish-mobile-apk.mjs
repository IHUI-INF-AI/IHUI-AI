#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * publish-mobile-apk.mjs — 把 mobile-rn release APK 发到固定的公网地址(2026-10-29 立)
 *
 * 固定地址(用户永远用这一条,不再跟着版本号换):
 *   https://www.aizhs.top/remote-images/download/ihui-ai-latest.apk   (站点 CDN 腿,EdgeOne,国内实测 1–4 MB/s)
 *
 * 为什么只剩一条腿:COS/CF 备用腿(dl.aizhs.top → 腾讯云 COS 桶 ihui-download-1367022840)已于
 * 2026-10-30 整桶下线。它按外网下行流量计费(0.5 元/GB),建桶当天被下载 3.48GB 就扣了 1.54 元
 * 并把账户打成欠费;而它本身只是冗余(实测国内 3–6 KB/s,比站点腿慢两个数量级)。站点腿同文件
 * 同字节且本月零扣费 —— 要再开第二条收费腿,先把这笔账算清。
 *
 * 为什么要这一步:出包脚本只管产出 app-release.apk,而"把包交到手机上"此前每次都要人工
 * 找地方传、再贴一条带版本号的地址(用户手里那条旧地址随后就失效)。现在出包链末尾直接
 * 落版本名副本 + 翻指针 ⇒ 链接恒定,版本信息走 `--version/--version-code`。
 *
 * 链路形状(2026-10-29 实测):
 *   站点腿:本机 → `deploy/server-root/remote-images/download/`(线上 cdn-server 的 --root)
 *           → EdgeOne → 用户。`…/ihui-ai-latest.apk` 不是实物文件,而是 cdn-server 读旁边
 *           `ihui-ai-latest.apk.redirect.json` 转出的 no-cache 302;真正被边缘长缓存的是带
 *           版本号那份(字节恒定才谈得上缓存)。
 *
 * latest 指针必须 `no-cache`:否则任一层把旧包缓存住,用户拿到的还是上一版,
 * 而页面/文件名看不出差别(与"线上版本标记会骗"同型)。带版本号的副本反过来给长缓存。
 *
 * 站点腿落点不写死盘符:经 scripts/seal-c-root-stray.mjs 的 devEnvRoot() 解析生产签出,
 * 两处都不存在 ⇒ exit 2 点名已试路径(静默跳过 = 对外地址停在旧包而账面是绿的)。
 *
 * 用法:
 *   node scripts/publish-mobile-apk.mjs --apk <path> --version 0.0.9 --version-code 26102816
 *   node scripts/publish-mobile-apk.mjs --apk <path> --version 0.0.9 --version-code 26102816 --dry-run
 *
 * 发布链最后一环 = 登记 app_versions 的 latest 行(Y-14 结构性根因,2026-10-31 立):
 * 线上更新卡读 `GET /api/app-version/latest?platform=android`,判据是 `status='latest'` 行本身;
 * 表里没有 ⇒ 端点 200 回空 data ⇒ 用户没有可点的下载按钮,而监控侧永远是一条 200。此前本脚本
 * 全文零处引用 app_versions ⇒ 发布链只推包、从不登记,手工登记一次下次发布照样空。
 * 三态判据(noop/update/create)、参数校验与写后自证**全部复用** register-app-version-latest.mjs
 * 的出口(buildPlan 经 applyViaDb/applyViaApi 单源执行,§0.6/§22c,本文件不复抄)。
 * 选腿(env 实有凭据,db 优先):DATABASE_URL ⇒ `--via db` 腿;否则 IHUI_ADMIN_TOKEN ⇒ api 腿;
 * 两者皆无 ⇒ 站点腿照常落地,但打印「未登记 + 缺哪条凭据 + 唯一可复制整改命令」并**以 1 退出**
 * (§0.10:失效方向恒为"多喊一次",绝不静默成功——静默正是本票的病根)。
 * 〔原头注登记的 `--no-latest` 示例 parseArgs 从未实现,按 §0.8 删除死出路〕
 *
 * 退出码:0 成功(站点腿 + 登记腿都落地或本就 noop)/ 1 失败(落盘、公网自证不过,或
 *        app_versions 未登记/登记执行失败)/ 2 未判定(缺参数、APK、站点落点,或参数做不出合法登记行)
 */
import { createHash } from 'node:crypto'
import { copyFileSync, createReadStream, existsSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { devEnvRoot } from './seal-c-root-stray.mjs'
import {
  applyViaApi,
  applyViaDb,
  openDbConnection,
  validateDesired,
} from './register-app-version-latest.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..')

export const LATEST_KEY = 'ihui-ai-latest.apk'

/**
 * 站点 CDN 腿(2026-10-29 立,2026-10-30 起为唯一出口)。
 *
 * 固定地址的新鲜度靠指针,不靠"同名覆盖 + 短缓存":版本名文件在边缘给 7 天长缓存(字节
 * 不变才谈得上缓存),而 `<latest>.apk` 这条请求由 cdn-server 读旁边的 `.redirect.json`
 * 转成 no-cache 302。这样"用户记一条地址"和"永远拿到最新包"同时成立,且 302 只有几百字节,
 * 每次回源的成本与包大小无关。
 */
export const SITE_LEG = {
  PublicBase: 'https://www.aizhs.top',
  UrlPrefix: '/remote-images/download',
  RelDir: join('deploy', 'server-root', 'remote-images', 'download'),
}

/** 站点腿的公网地址(版本名或固定名同一个命名空间) */
export function siteLegUrl(key) {
  return `${SITE_LEG.PublicBase}${SITE_LEG.UrlPrefix}/${key}`
}

/**
 * 落点选择:生产签出优先(线上 cdn-server 的 --root 就是它),其次本仓。
 * 两处都不存在 ⇒ chosen=null,调用方必须**失败**而不是"跳过站点腿还报成功"——
 * 静默跳过会让对外地址停留在旧包,而账面是绿的。
 */
export function siteLegPlan({ repoRoot = REPO, env = process.env, exists = existsSync, resolveDevEnvRoot = devEnvRoot } = {}) {
  const candidates = []
  let prodDir = null
  try {
    prodDir = join(resolveDevEnvRoot(repoRoot), 'ihui-prod')
  } catch {
    prodDir = null
  }
  if (prodDir) candidates.push({ source: 'prod-checkout', dir: join(prodDir, SITE_LEG.RelDir) })
  candidates.push({ source: 'repo', dir: join(repoRoot, SITE_LEG.RelDir) })
  const hit = candidates.find((c) => exists(c.dir))
  return { candidates, chosen: hit ?? null, envOverride: (env.IHUI_SITE_CDN_DIR || '').trim() || null }
}

/** 流式 sha256(81MB 不整块进内存) */
export function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256')
    createReadStream(file)
      .on('data', (c) => h.update(c))
      .on('end', () => resolve(h.digest('hex')))
      .on('error', reject)
  })
}

/**
 * 写站点腿:①先落版本名并回读大小 ②再翻指针。顺序不可颠倒——先翻指针等于把用户
 * 指向一个还没落地的文件(302 打到 404),而 404 在边缘会被当成"这个包不存在"缓存住。
 */
export function publishSiteLeg({ apk, dir, version, versionCode, sha256, size }) {
  const vKey = versionKey(version, versionCode)
  const target = join(dir, vKey)
  copyFileSync(apk, target)
  const back = statSync(target).size
  if (back !== size) throw new Error(`站点腿回读大小不符: 源 ${size} / 落点 ${back} (${target})`)
  const pointer = {
    url: siteLegUrl(vKey),
    version: String(version),
    versionCode: String(versionCode),
    size,
    sha256,
    publishedAt: new Date().toISOString(),
  }
  const pointerPath = join(dir, `${LATEST_KEY}.redirect.json`)
  writeFileSync(pointerPath, JSON.stringify(pointer, null, 2) + '\n')
  return { vKey, target, pointerPath, pointer }
}

/**
 * 公网自证:固定地址必须 302 到本次版本,且那条 Location 真的是 apk 字节。
 * 只读响应头不看正文(取完立刻 cancel,避免把 81MB 拖回来自己测自己)。
 * 判不出 ⇒ 抛错(整条发布按失败处理),不返回"大概没问题"。
 */
export async function verifySiteLegLive({ latestUrl = siteLegUrl(LATEST_KEY), expectSize, expectVersionCode, fetchImpl = fetch, timeoutMs = 30000 } = {}) {
  const signal = () => AbortSignal.timeout(timeoutMs)
  const r = await fetchImpl(latestUrl, { redirect: 'manual', signal: signal() })
  await r.body?.cancel().catch(() => {})
  if (r.status !== 302) throw new Error(`固定地址未按 302 应答: HTTP ${r.status} (${latestUrl})`)
  const loc = r.headers.get('location') || ''
  if (!loc.startsWith('https://')) throw new Error(`302 目标不是 https: ${loc || '(缺 Location)'}`)
  if (expectVersionCode && !loc.includes(`-${expectVersionCode}.apk`)) throw new Error(`固定地址仍指向旧包: ${loc}`)
  const f = await fetchImpl(loc, { headers: { range: 'bytes=0-0' }, signal: signal() })
  await f.body?.cancel().catch(() => {})
  const ct = f.headers.get('content-type') || ''
  if (f.status !== 200 && f.status !== 206) throw new Error(`版本副本公网取不到: HTTP ${f.status} (${loc})`)
  if (!ct.includes('vnd.android.package-archive')) throw new Error(`公网 Content-Type=${ct || '(空)'},不是 apk —— 多半落到占位图/缺文件`)
  const cr = f.headers.get('content-range') || ''
  const remote = Number(cr.includes('/') ? cr.split('/')[1] : f.headers.get('content-length') || 0)
  if (expectSize && remote !== Number(expectSize)) throw new Error(`公网回读大小不符: 本地 ${expectSize} / 公网 ${remote}`)
  return { location: loc, status: f.status, contentType: ct, size: remote }
}


/** 版本副本的 key:ihui-ai-<version>-<code>.apk(与历史手工命名保持一致) */
export function versionKey(version, versionCode) {
  const v = String(version ?? '').trim()
  const c = String(versionCode ?? '').trim()
  if (!v || !c) throw new Error('versionKey: version 与 versionCode 都必须非空')
  return `ihui-ai-${v}-${c}.apk`
}

// =============================================================================
// 登记腿(Y-14 结构性根因:发布链必须把包登记进 app_versions,判据单源见头注)
// =============================================================================

/**
 * 从发布进程环境选登记腿:DATABASE_URL(db 腿)优先,其次 IHUI_ADMIN_TOKEN(api 腿)。
 * 只回凭据**名**;值仅用于传给登记器物自身的腿,永不进日志/告警正文(§5e:输出恒脱敏)。
 */
export function registerLegFromEnv(env = process.env) {
  const dbUrl = String(env.DATABASE_URL ?? '').trim()
  if (dbUrl) return { leg: 'db', credential: 'DATABASE_URL', value: dbUrl }
  const token = String(env.IHUI_ADMIN_TOKEN ?? '').trim()
  if (token) return { leg: 'api', credential: 'IHUI_ADMIN_TOKEN', value: token }
  return { leg: null, credential: null, value: '' }
}

/** 唯一可复制整改命令:只含参数与 env 名,绝不含凭据值。 */
export function registerRemediationCommand({ version, versionCode }) {
  return (
    'node scripts/register-app-version-latest.mjs --apply --via db --db-url "$DATABASE_URL"' +
    ` --version ${version} --build-number ${versionCode} --download-url ${siteLegUrl(LATEST_KEY)}`
  )
}

/**
 * 站点腿落地后的登记动作。三态/校验/写后自证全部委托 register-app-version-latest.mjs
 * (buildPlan 只在它那一处实现,§0.6);本函数只做"选腿 + 调用 + 归一结论"。
 * 返回:
 *   {status:'registered'|'noop', leg, plan} —— 登记已落地 / 数据本就一致不写一字节
 *   {status:'unregistered', leg:null}      —— 两腿凭据皆无 ⇒ 调用方必须非零退出并喊人
 * 有凭据但执行失败 ⇒ throw(由 publishRegisterStep 归一为「包已发+登记失败+命令」的喊法)。
 * deps 仅供测试注入(openDb/applyViaDb/applyViaApi),生产路径全用登记器导出的真出口。
 */
export async function registerAppVersionAfterPublish({
  version,
  versionCode,
  platform = 'android',
  downloadUrl = siteLegUrl(LATEST_KEY),
  baseUrl = SITE_LEG.PublicBase,
  env = process.env,
  deps = {},
} = {}) {
  const buildNumber = Number(versionCode)
  const bad = validateDesired({ platform, version, buildNumber, downloadUrl })
  if (bad.length > 0) throw new Error(`登记参数不合规: ${bad.join('; ')}`)
  const sel = (deps.registerLegFromEnv ?? registerLegFromEnv)(env)
  if (!sel.leg) return { status: 'unregistered', leg: null }
  const desired = { platform, version, buildNumber, downloadUrl }
  if (sel.leg === 'db') {
    const sql = (deps.openDb ?? openDbConnection)(sel.value)
    try {
      const r = await (deps.applyViaDb ?? applyViaDb)({ sql, ...desired, apply: true })
      return { status: r.wrote ? 'registered' : 'noop', leg: 'db', plan: r.plan }
    } finally {
      if (typeof sql?.end === 'function') {
        try {
          await sql.end({ timeout: 5 })
        } catch {
          /* 关连接失败不改变登记结论(登记器 main 同款收尾) */
        }
      }
    }
  }
  const r = await (deps.applyViaApi ?? applyViaApi)({ baseUrl, token: sel.value, ...desired, apply: true })
  return { status: r.wrote ? 'registered' : 'noop', leg: 'api', plan: r.plan }
}

/**
 * main 的登记步包装:成功打 ✓,「未登记 / 登记执行失败」都打点名缺什么 + 唯一可复制命令。
 * 返回 {ok:false,...} 时 main 必须以 1 退出——这条契约由镜像测试 W4/W8 钉住。
 */
export async function publishRegisterStep({
  version,
  versionCode,
  env = process.env,
  out = (m) => console.log(m),
  err = (m) => console.error(m),
  deps = {},
} = {}) {
  const cmd = registerRemediationCommand({ version, versionCode })
  let r
  try {
    r = await registerAppVersionAfterPublish({ version, versionCode, env, deps })
  } catch (e) {
    err(
      `[publish] ✗ app_versions 登记执行失败(站点腿已落地,禁止重发整包补登记): ${String(e?.message ?? e).slice(0, 300)}\n` +
        `          修好凭据/网络后只跑登记这一条(幂等):\n          ${cmd}`,
    )
    return { ok: false, status: 'register-error' }
  }
  if (r.status === 'unregistered') {
    err(
      `[publish] ✗ app_versions 未登记:站点腿已发布,但本进程既无 DATABASE_URL(db 腿)也无 IHUI_ADMIN_TOKEN(api 腿) ⇒\n` +
        `          App 内更新卡(GET /api/app-version/latest?platform=android)仍是空/旧,用户没有可点的下载按钮。\n` +
        `          备好任一凭据后,唯一整改命令(幂等,与发布链同一三态判据):\n          ${cmd}`,
    )
    return { ok: false, status: 'unregistered' }
  }
  out(
    `[publish] ✓ app_versions 登记${r.status === 'noop' ? '无需写(已是唯一 latest,noop)' : '已落地'} leg=${r.leg} plan=${r.plan.action}`,
  )
  return { ok: true, status: r.status, leg: r.leg, plan: r.plan }
}

function parseArgs(argv) {
  const out = { apk: '', version: '', versionCode: '', dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apk') out.apk = argv[++i] ?? ''
    else if (a === '--version') out.version = argv[++i] ?? ''
    else if (a === '--version-code') out.versionCode = argv[++i] ?? ''
    else if (a === '--dry-run') out.dryRun = true
    else if (a === '--help' || a === '-h') out.help = true
    else throw new Error(`未知参数: ${a}`)
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log('用法: node scripts/publish-mobile-apk.mjs --apk <path> --version <semver> --version-code <int> [--dry-run]')
    return 0
  }
  if (!args.apk || !args.version || !args.versionCode) {
    console.error('未判定: --apk / --version / --version-code 三者都必填')
    return 2
  }
  if (!existsSync(args.apk)) {
    console.error(`未判定: APK 不存在 ${args.apk}`)
    return 2
  }
  // 做不出合法登记行的参数,要在落 85MB 包之前就地未判定(而不是站点腿翻完指针才发现登记不了)
  const regBad = validateDesired({
    platform: 'android',
    version: args.version,
    buildNumber: Number(args.versionCode),
    downloadUrl: siteLegUrl(LATEST_KEY),
  })
  if (regBad.length > 0) {
    console.error('未判定: 发布参数做不出合法 app_versions 登记行 ⇒ 拒绝落包\n  - ' + regBad.join('\n  - '))
    return 2
  }
  const size = statSync(args.apk).size
  const sha = await sha256File(args.apk)
  const plan = siteLegPlan()
  if (!plan.chosen) {
    console.error('未判定: 站点 CDN 落点不存在 ⇒ 固定地址不会更新,拒绝把发布报成成功')
    console.error('  已试: ' + plan.candidates.map((c) => `${c.source}=${c.dir}`).join(' | '))
    return 2
  }
  const vKey = versionKey(args.version, args.versionCode)

  const sizeMB = (size / 1048576).toFixed(1)
  console.log(`[publish] ${args.apk} (${sizeMB} MB, sha256=${sha.slice(0, 16)}…)`)
  console.log(`[publish]   站点腿 ${vKey}  →  ${siteLegUrl(vKey)}  (落点 ${plan.chosen.dir}, 取自 ${plan.chosen.source})`)
  console.log(`[publish]   站点腿固定地址指针 ${LATEST_KEY}.redirect.json → ${siteLegUrl(LATEST_KEY)}`)

  if (args.dryRun) {
    const sel = registerLegFromEnv()
    console.log('[publish] --dry-run: 只打印计划,未落盘')
    console.log(
      sel.leg
        ? `[publish]   --dry-run: app_versions 登记腿 = ${sel.leg}(凭据 ${sel.credential} 在位,正式发布后才执行)`
        : '[publish]   --dry-run: app_versions 登记凭据缺失(DATABASE_URL / IHUI_ADMIN_TOKEN 皆无)⇒ 正式发布时站点腿落地后仍会以 1 退出喊人,更新卡不会自己变绿',
    )
    return 0
  }

  // 版本名先落盘,指针最后翻(顺序反了等于把用户 302 到一个还不存在的文件)
  const site = publishSiteLeg({ apk: args.apk, dir: plan.chosen.dir, version: args.version, versionCode: args.versionCode, sha256: sha, size })
  console.log(`[publish] ✓ 站点腿 ${site.vKey} (${(statSync(site.target).size / 1048576).toFixed(1)} MB, 回读一致)`)
  console.log(`[publish] ✓ 指针已翻 → ${site.pointer.url}`)
  const live = await verifySiteLegLive({ expectSize: size, expectVersionCode: args.versionCode })
  console.log(`[publish] ✓ 公网自证 HTTP ${live.status} content-range 大小 ${live.size} → ${live.location}`)

  // 登记步(Y-14):没有它,发布链就是"只推包、从不登记"——手工补一次,下次发布照样空。
  const step = await publishRegisterStep({ version: args.version, versionCode: args.versionCode })
  if (!step.ok) return 1

  console.log(`\n下载地址(固定): ${siteLegUrl(LATEST_KEY)}`)
  console.log(`本次版本副本: ${siteLegUrl(vKey)}`)
  console.log(`SHA256: ${sha}`)
  return 0
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

export const __test__ = {
  versionKey,
  siteLegUrl,
  siteLegPlan,
  publishSiteLeg,
  verifySiteLegLive,
  sha256File,
  SITE_LEG,
  LATEST_KEY,
  // 登记腿(Y-14;判据本体在 register-app-version-latest.mjs,这里只是接线出口)
  registerLegFromEnv,
  registerRemediationCommand,
  registerAppVersionAfterPublish,
  publishRegisterStep,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
