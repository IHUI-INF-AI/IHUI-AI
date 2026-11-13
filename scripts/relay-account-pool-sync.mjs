#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池跨环境双向同步编排器(2026-11-11 立,李总明令「必须从代码层面做到自动同步、互通」)。
 *
 * 定位:这不是"再补一个手动命令",而是把「本地库 ⇄ 生产库」的收敛做成**默认自动行为**:
 *   · 手动:node scripts/relay-account-pool-sync.mjs --apply
 *   · 定时:Windows 计划任务每 2 分钟跑一次 --if-dirty --apply(见 register-pool-sync-task.mjs)
 *   · 触发:apps/api 每次 importAccounts 落库后写脏标记(见 relay-account-pool-service.ts),
 *           定时器发现标记立刻同步 ⇒ Web 加号 / 管理员导入 / 会话回灌都能在 2 分钟内进另一端。
 *
 * 通道设计(刻意零新增 DB 代码路径,全部复用已验证的现成件):
 *   本地快照 = tsx 跑 relay-account-import.ts --export-all(只读,含明文+updatedAt)
 *   生产快照 = 一次 SSH 跑同一个 --export-all(12 平台只付一次握手)
 *   本地落库 = tsx 跑导入器(按 owner 分组批量 --file)
 *   生产落库 = base64 走 stdin 一次 SSH 写入生产临时目录 + 批量导入 + 双端删净
 *
 * 明文安全:凭证只在内存与 SSH stdin 通道内流动;本地临时目录 mkdtemp 后 finally 删净,
 * 生产临时目录在命令末尾 rmdir,失败时补一次清理。任何日志都不打印 token。
 *
 * 用法:
 *   node scripts/relay-account-pool-sync.mjs [--apply|--dry-run]
 *     [--provider <code>]        只同步该平台(可重复给;缺省全平台)
 *     [--owners <id,id>]         只同步这些 users.id 的个人池(缺省读 ~/.wb-switch/pool-owner)
 *     [--all-owners]             同步全库所有归属(含运营池 owner=NULL)。2026-11-12 机主令
 *                                「所有号池里的号都应该自动同步运营生产」⇒ 自动任务固定带上;
 *                                手工跑缺省仍限 ~/.wb-switch/pool-owner 的单一 owner。
 *                                ⚠️ 双向口径:会把生产端他人账号拉回开发机,这是全量的既定代价。
 *     [--push-only|--pull-only]  只推 / 只拉
 *     [--pull-window-days <n>]   「仅生产有」视为新增的时效窗口(缺省 7 天;更老的缺失
 *                                当作本地已删除,只报告不复活,避免删号被另一端拉回)
 *     [--if-dirty]               仅当脏标记存在才跑(计划任务用;--force 可忽略标记)
 *     [--dirty-file <path>]      脏标记路径(缺省 ~/.wb-switch/pool-sync-dirty)
 *     [--prod-host <alias>]      SSH 别名(默认 ssh.aizhs.top)
 *     [--prod-checkout <path>]   生产 checkout 根(默认 D:\DevEnv\ihui-prod)
     [--local-mode]              本机即生产:跳过 SSH 隧道,直接在本机 prodCheckout 跑导入器(同库等价)
 *     [--status]                 一键健康自检(计划任务/日志/脏标记/生产 checkout 能力),不写库
 *     [--json] [--quiet]
 *
 * 退出码:0 无失败(含"无变更"与"未到脏") / 1 有失败 / 2 参数或环境未判定。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runProcess } from './relay-account-pool.mjs'
import { groupForImport, planPoolSync } from './lib/pool-sync-plan.mjs'
import { maskPoolOwner, resolveDefaultPoolOwner } from './lib/pool-owner.mjs'
import { RELAY_PROVIDER_CODES } from './lib/pool-providers.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const API_DIR = path.join(ROOT, 'apps', 'api')
const IMPORTER = path.join(API_DIR, 'scripts', 'relay-account-import.ts')
const OWNER_MAP = path.join(API_DIR, 'scripts', 'relay-pool-owner-map.ts')
const PROD_TEMP = 'D:\\DevEnv\\Temp'
const DEFAULT_DIRTY_FILE = path.join(os.homedir(), '.wb-switch', 'pool-sync-dirty')
// 本机即生产标记:存在则自动进入本地模式(免 SSH 隧道,直接在本机 prodCheckout 跑导入器)。
// 适用场景:开发机同时就是生产机(同一 Postgres),SSH 回环 ssh.aizhs.top 纯属多余且需额外凭据。
const PROD_IS_LOCAL = path.join(os.homedir(), '.wb-switch', 'prod-is-local')
const DEFAULT_LOG_FILE = path.join(ROOT, '.tmp', 'pool-sync.log')
const TASK_NAME = 'IHUI-Pool-Sync'
const BEGIN = '__POOL_EXPORT_BEGIN__'
const END = '__POOL_EXPORT_END__'
const SSH_OPTS = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20']

const HELP = `号池跨环境双向同步(本地库 ⇄ 生产库)

用法:
  node scripts/relay-account-pool-sync.mjs [--apply|--dry-run]
    [--provider <code>]        只同步该平台(可重复给;缺省全平台)
    [--owners <id,id>]         只同步这些 users.id 的个人池(缺省读 ~/.wb-switch/pool-owner)
    [--all-owners]             同步全库所有归属(含运营池);自动任务固定带,手工跑缺省关闭
    [--push-only|--pull-only]  只推 / 只拉
    [--pull-window-days <n>]   「仅生产有」视为新增的时效窗口(缺省 7 天)
    [--if-dirty]               仅当脏标记存在才跑(计划任务用)
    [--dirty-file <path>]      脏标记路径(缺省 ~/.wb-switch/pool-sync-dirty)
    [--prod-host <alias>]      SSH 别名(默认 ssh.aizhs.top)
    [--prod-checkout <path>]   生产 checkout 根(默认 D:\\DevEnv\\ihui-prod)
    [--status]                 一键健康自检(不写库):计划任务 / 日志 / 脏标记 / 生产 checkout 能力
    [--json] [--quiet]
    [--log <path>]             追加写一行摘要到该文件(计划任务用:不依赖 shell 重定向,
                               因为 cmd 在非交互会话里会被系统中断,实测 0xC000013A)

规则:仅一侧有 → 补缺;两侧都有 → 凭证指纹相同则跳过、不同则 updatedAt 新者胜;
      删除不传播(跨环境删号必须人工显式执行)。
退出码:0 无失败 / 1 有失败 / 2 参数或环境未判定。`

function parseArgs(argv) {
  const options = {
    apply: false,
    dryRun: true,
    providers: [],
    owners: [],
    allOwners: false,
    pushOnly: false,
    pullOnly: false,
    pullWindowDays: 7,
    ifDirty: false,
    force: false,
    dirtyFile: DEFAULT_DIRTY_FILE,
    prodHost: 'ssh.aizhs.top',
    prodCheckout: 'D:\\DevEnv\\ihui-prod',
    localMode: false,
    json: false,
    quiet: false,
    logFile: '',
    status: false,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--apply') {
      options.apply = true
      options.dryRun = false
    } else if (arg === '--dry-run') {
      options.dryRun = true
      options.apply = false
    } else if (arg === '--provider') {
      const v = (argv[++i] ?? '').trim()
      if (!RELAY_PROVIDER_CODES.includes(v)) {
        return { options: null, error: `不支持的平台: ${v}(可选 ${RELAY_PROVIDER_CODES.join('|')})` }
      }
      if (!options.providers.includes(v)) options.providers.push(v)
    } else if (arg === '--owners') {
      const v = (argv[++i] ?? '').trim()
      if (!v) return { options: null, error: '--owners 需要逗号分隔的 users.id 列表' }
      const ids = v.split(',').map((x) => x.trim()).filter(Boolean)
      // 显式给了 --owners 却一个 id 都解析不出(如 " , "):必须拒绝。
      // 静默回落默认机主 = 用户以为在同步 A 归属,实际同步了 B —— 方向错、范围错,且毫无提示。
      if (ids.length === 0) {
        return { options: null, error: `--owners 未解析出任何 users.id(收到 "${v}")` }
      }
      for (const id of ids) {
        if (!options.owners.includes(id)) options.owners.push(id)
      }
    } else if (arg === '--all-owners') options.allOwners = true
    else if (arg === '--push-only') options.pushOnly = true
    else if (arg === '--pull-only') options.pullOnly = true
    else if (arg === '--pull-window-days') {
      const v = Number((argv[++i] ?? '').trim())
      if (!Number.isFinite(v) || v < 0) {
        return { options: null, error: '--pull-window-days 需要 >= 0 的数字(天)' }
      }
      options.pullWindowDays = v
    } else if (arg === '--if-dirty') options.ifDirty = true
    else if (arg === '--force') options.force = true
    else if (arg === '--status') options.status = true
    else if (arg === '--dirty-file') options.dirtyFile = (argv[++i] ?? '').trim()
    else if (arg === '--prod-host') options.prodHost = (argv[++i] ?? '').trim()
    else if (arg === '--prod-checkout') options.prodCheckout = (argv[++i] ?? '').trim()
    else if (arg === '--local-mode') options.localMode = true
    else if (arg === '--json') options.json = true
    else if (arg === '--quiet') options.quiet = true
    else if (arg === '--log') {
      const v = (argv[++i] ?? '').trim()
      if (!v) return { options: null, error: '--log 需要文件路径' }
      options.logFile = v
    }
    else return { options: null, error: `未知参数: ${arg}` }
  }
  if (options.help) return { options, error: null }
  if (options.pushOnly && options.pullOnly) {
    return { options: null, error: '--push-only 与 --pull-only 互斥(要双向就别带任何一个)' }
  }
  if (!options.dirtyFile) return { options: null, error: '--dirty-file 需要路径' }
  if (!options.prodHost) return { options: null, error: '--prod-host 需要 SSH 别名' }
  if (!options.prodCheckout) return { options: null, error: '--prod-checkout 需要路径' }
  // 本机即生产:标记文件存在即自动免 SSH 隧道(开发机=生产机,同一 Postgres,SSH 回环多余)。
  if (!options.localMode && fs.existsSync(PROD_IS_LOCAL)) options.localMode = true
  return { options, error: null }
}

function resolveTsx() {
  for (const candidate of [
    path.join(API_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
  ]) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

/** 从可能被 dotenv/[db] 诊断污染的 stdout 里只截边界标记之间的 JSON 段。 */
function extractExport(stdout) {
  const text = String(stdout ?? '')
  const b = text.indexOf(BEGIN)
  const e = text.indexOf(END)
  if (b < 0 || e <= b) {
    throw new Error('未找到导出边界标记(对端 checkout 可能是旧版导入器,缺 --export-all)')
  }
  return JSON.parse(text.slice(b + BEGIN.length, e).trim())
}

/** 把 --export-all 的 providers 分桶摊平成数组,平台代码写进 __sync(不污染原生载荷)。 */
function flattenProviders(payload) {
  const out = []
  if (payload && payload.providers && typeof payload.providers === 'object') {
    for (const [code, bucket] of Object.entries(payload.providers)) {
      for (const acc of bucket?.accounts ?? []) {
        out.push({ ...acc, __sync: { ...(acc.__sync ?? {}), providerCode: code } })
      }
    }
    return out
  }
  if (payload && Array.isArray(payload.accounts) && payload.providerCode) {
    return payload.accounts.map((a) => ({
      ...a,
      __sync: { ...(a.__sync ?? {}), providerCode: String(payload.providerCode) },
    }))
  }
  return out
}

async function snapshotLocal(tsxCli, _options) {
  const args = [tsxCli, IMPORTER, '--export-all']
  const r = await runProcess(process.execPath, args, {})
  if (r.code !== 0) {
    throw new Error(`本地快照导出失败(退出码 ${r.code}): ${r.error || ''}`.trim())
  }
  return flattenProviders(extractExport(r.stdout))
}

async function snapshotProd(options) {
  // 本机即生产:本地快照即生产快照(同库),直接复用 snapshotLocal,免 SSH 隧道。
  if (options.localMode) return snapshotLocal(resolveTsx(), options)
  const remoteCmd =
    `cd /d "${options.prodCheckout}" & node ` +
    ['apps\\api\\node_modules\\tsx\\dist\\cli.mjs', 'apps\\api\\scripts\\relay-account-import.ts', '--export-all'].join(
      ' ',
    )
  const r = await runProcess('ssh', [...SSH_OPTS, options.prodHost, remoteCmd], {})
  if (r.code !== 0) {
    throw new Error(`生产快照导出失败(退出码 ${r.code}): ${r.error || ''}`.trim())
  }
  return flattenProviders(extractExport(r.stdout))
}

/**
 * 归属 id→email 对照表(2026-11-12 email 身份键收口)。
 *
 * 立因:两端 users.id 各自库生成(同一 admin 两端 id 不同、email 相同),owner 原样透传
 * ⇒ 目标端悬空归属 + 同步键两端不同反复互推。编排器在两端各取一份 `<users.id>→<email>`
 * 映射:键与范围判断用 email,落库 --owner 用 email 反查目标环境 id。
 * 取不到不致命(降级为只认导出自带的 ownerEmail;翻译不出的行由 groupForImport 点名跳过)。
 */
async function fetchOwnerMapLocal(tsxCli) {
  const r = await runProcess(process.execPath, [tsxCli, OWNER_MAP], {})
  if (r.code !== 0) {
    throw new Error(`本地归属对照导出失败(退出码 ${r.code}): ${r.error || ''}`.trim())
  }
  return extractExport(r.stdout)
}

async function fetchOwnerMapProd(options) {
  // 本机即生产:生产归属对照=本地归属对照(同库),复用 fetchOwnerMapLocal,免 SSH 隧道。
  if (options.localMode) return fetchOwnerMapLocal(resolveTsx())
  const remoteCmd =
    `cd /d "${options.prodCheckout}" & node ` +
    ['apps\\api\\node_modules\\tsx\\dist\\cli.mjs', 'apps\\api\\scripts\\relay-pool-owner-map.ts'].join(' ')
  const r = await runProcess('ssh', [...SSH_OPTS, options.prodHost, remoteCmd], {})
  if (r.code !== 0) {
    throw new Error(`生产归属对照导出失败(退出码 ${r.code}): ${r.error || ''}`.trim())
  }
  return extractExport(r.stdout)
}

/** id→email 映射 ⇒ email(小写)→id 反查表(落库翻译用)。 */
function invertOwnerMap(map) {
  const out = {}
  for (const [id, email] of Object.entries(map ?? {})) {
    const e = String(email ?? '').trim().toLowerCase()
    if (e) out[e] = id
  }
  return out
}

/**
 * 归属范围:默认只同步「机主个人池 + 运营池」。
 *
 * 立因(2026-11-11 实测):生产库 48 条 vs 本地 30 条 —— 生产是活库,里面可能有他人账号;
 * 全量拉回会把别人的号带进开发机(数据边界问题),全量推送则会把开发机的测试号灌进生产。
 * 所以默认读 ~/.wb-switch/pool-owner 锁定机主 id;确要全库对账必须显式 --all-owners。
 */
function resolveOwnerScope(options) {
  if (options.allOwners) return null
  const personal = new Set(options.owners)
  if (personal.size === 0) {
    const def = resolveDefaultPoolOwner()
    if (def?.owner) personal.add(def.owner)
  }
  if (personal.size === 0) {
    return {
      error:
        '归属未判定:带 --owners <users.id>,或在本机 ~/.wb-switch/pool-owner 写入本人 users.id' +
        '(确要全库对账用 --all-owners)',
    }
  }
  return { personal, emails: new Set(), includeOps: true }
}

/**
 * 个人池范围判断改用 email 身份(2026-11-12):--owners / pool-owner 都是**本地 id**,
 * 先经本地 map 翻成 email;对端快照里的同一人(不同 id、同 email)才能被认出来。
 * 单独成函数是为了让"归属未判定"仍在任何 IO 前就退出(不先跑对照脚本)。
 */
function attachScopeEmails(scope, localOwnerMap) {
  if (!scope) return scope
  for (const id of scope.personal) {
    const e = String((localOwnerMap ?? {})[id] ?? '').trim().toLowerCase()
    if (e) scope.emails.add(e)
  }
  return scope
}

/**
 * 只保留范围内的归属;运营池(owner=null)默认包含。
 * 2026-11-12:个人池判断按**有效归属身份(email)**比较 —— 优先 ownerEmail(导出器带),
 * 否则用本侧 map 翻译 ownerUserId;都翻译不出 ⇒ 原样 ownerUserId 比较
 * (dev-anonymous 这类非 uuid 历史 owner 保持现行为:不在集合 ⇒ 过滤)。
 */
function filterByOwnerScope(accounts, scope, sideMap = null) {
  if (!scope) return accounts
  return accounts.filter((a) => {
    const sync = a && a.__sync && typeof a.__sync === 'object' ? a.__sync : {}
    const ownerRaw = sync.ownerUserId !== undefined ? sync.ownerUserId : a?.ownerUserId
    const owner = typeof ownerRaw === 'string' && ownerRaw.trim() ? ownerRaw.trim() : null
    if (owner === null) return scope.includeOps
    if (scope.personal.has(owner)) return true
    const emailRaw = sync.ownerEmail !== undefined ? sync.ownerEmail : a?.ownerEmail
    let email = typeof emailRaw === 'string' && emailRaw.trim() ? emailRaw.trim().toLowerCase() : ''
    if (!email) {
      const mapped = sideMap && sideMap[owner]
      email = typeof mapped === 'string' && mapped.trim() ? mapped.trim().toLowerCase() : ''
    }
    return email !== '' && scope.emails.has(email)
  })
}

/** 按 owner 分组(导入器一次只吃一个归属,混批会把归属串台)。 */
function groupByOwner(batches) {  const map = new Map()
  for (const b of batches) {
    const k = b.ownerUserId ?? 'ops'
    if (!map.has(k)) map.set(k, { ownerUserId: b.ownerUserId, batches: [] })
    map.get(k).batches.push(b)
  }
  return [...map.values()]
}

/** 拉回侧:本机导入器分组批量落库。 */
async function applyPull(batches, tsxCli, options) {
  if (batches.length === 0) return { code: 0, groups: 0, imported: 0, updated: 0, failed: 0 }
  let worst = 0
  let imported = 0
  let updated = 0
  let failed = 0
  let groups = 0
  for (const group of groupByOwner(batches)) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-pool-pull-'))
    try {
      const files = []
      for (const b of group.batches) {
        const file = path.join(dir, `${b.providerCode}__${b.ownerUserId ?? 'ops'}.json`)
        fs.writeFileSync(file, JSON.stringify({ providerCode: b.providerCode, accounts: b.accounts }), 'utf8')
        files.push(file)
      }
      // 不加 --json:JSON 模式只输出结构化结果,而这里要靠人类面的
      // 「导入完成:平台=x 新增=n 更新=n 跳过=n 失败=n」汇总行统一解析(与推送侧同口径)。
      const args = [tsxCli, IMPORTER, ...files.flatMap((f) => ['--file', f]), '--no-health']
      if (group.ownerUserId) args.push('--owner', group.ownerUserId, '--owner-source', 'explicit-flag')
      else args.push('--owner-source', 'none')
      const r = await runProcess(process.execPath, args, { inherit: false })
      worst = Math.max(worst, r.code ?? 0)
      groups++
      const text = `${r.stdout ?? ''}${r.error ?? ''}`
      for (const line of text.split(/\r?\n/)) {
        const m = /导入完成:平台=(\S+)\s+新增=(\d+)\s+更新=(\d+)\s+跳过=(\d+)\s+失败=(\d+)/.exec(line)
        if (!m) continue
        imported += Number(m[2])
        updated += Number(m[3])
        failed += Number(m[5])
      }
      if (r.code !== 0 && !options.quiet) {
        // 不能只说"退出码 1":导入器的失败原因(校验/解密/归属)全在输出尾巴里,
        // 吞掉它会让排障退化成猜谜 —— 打印最后 12 行,且不带任何 token(导入器本身不打印明文)。
        const tail = `${r.stdout ?? ''}${r.error ?? ''}`
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(-12)
          .join('\n')
        process.stderr.write(
          `⚠️ 拉回落库有失败(owner=${maskPoolOwner(group.ownerUserId)} 退出码 ${r.code})\n${tail}\n`,
        )
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
  return { code: worst, groups, imported, updated, failed }
}

/** 推送侧:base64 一次 SSH → 生产临时目录 → 按 owner 批量导入 → 删净。 */
async function applyPush(batches, options) {
  if (batches.length === 0) return { code: 0, imported: 0, updated: 0, failed: 0 }
  // 本机即生产:推送=在同库落库(与 applyPull 等价,因 prodCheckout 与 dev 共用同一 Postgres)。
  if (options.localMode) return applyPull(batches, resolveTsx(), options)
  const stamp = `${Date.now().toString(36)}-${process.pid}`
  const remoteDir = `${PROD_TEMP}\\ihui-pool-sync-${stamp}`
  const bundle = {}
  const byOwner = groupByOwner(batches)
  for (const group of byOwner) {
    for (const b of group.batches) {
      const name = `${b.providerCode}__${b.ownerUserId ?? 'ops'}.json`
      bundle[name] = JSON.stringify({ providerCode: b.providerCode, accounts: b.accounts })
    }
  }
  const payload = Buffer.from(JSON.stringify(bundle), 'utf8').toString('base64')
  const writer =
    `const fs=require('fs'),p=require('path'),d='${remoteDir.replaceAll('\\', '/')}';` +
    `fs.mkdirSync(d,{recursive:true});` +
    `const o=JSON.parse(Buffer.from(fs.readFileSync(0,'utf8'),'base64').toString('utf8'));` +
    `for(const k of Object.keys(o))fs.writeFileSync(p.join(d,k),o[k]);`
  const steps = []
  let imported = 0
  let updated = 0
  let failed = 0
  for (const group of byOwner) {
    const files = group.batches.map((b) => `${remoteDir}\\${b.providerCode}__${b.ownerUserId ?? 'ops'}.json`)
    let cmd =
      'node apps\\api\\node_modules\\tsx\\dist\\cli.mjs apps\\api\\scripts\\relay-account-import.ts ' +
      files.map((f) => `--file "${f}"`).join(' ') +
      ' --no-health'
    if (group.ownerUserId) cmd += ` --owner ${group.ownerUserId} --owner-source explicit-flag`
    else cmd += ' --owner-source none'
    steps.push(cmd)
  }
  const remoteCmd =
    `cd /d "${options.prodCheckout}" & node -e "${writer}" && ` +
    `${steps.join(' & ')} & rmdir /s /q "${remoteDir}"`
  const r = await runProcess('ssh', [...SSH_OPTS, options.prodHost, remoteCmd], {
    inherit: false,
    input: payload,
  })
  const text = `${r.stdout ?? ''}${r.error ?? ''}`
  for (const line of text.split(/\r?\n/)) {
    const m = /导入完成:平台=(\S+)\s+新增=(\d+)\s+更新=(\d+)\s+跳过=(\d+)\s+失败=(\d+)/.exec(line)
    if (!m) continue
    imported += Number(m[2])
    updated += Number(m[3])
    failed += Number(m[5])
  }
  if (r.code !== 0) {
    // 失败时补一次清理,避免明文留在生产盘上
    await runProcess('ssh', [...SSH_OPTS, options.prodHost, `rmdir /s /q "${remoteDir}"`], {})
    if (!options.quiet) process.stderr.write(`⚠️ 推送生产失败(退出码 ${r.code}): ${r.error || ''}\n`)
  }
  return { code: r.code ?? 2, imported, updated, failed }
}

function emitReport(plan, options, extra) {
  const summary = {
    ok: extra.ok,
    dryRun: options.dryRun,
    stats: plan.stats,
    conflicts: plan.conflicts.map((c) => ({
      providerCode: c.providerCode,
      uid: c.uid,
      winner: c.winner,
      deltaMs: c.deltaMs,
    })),
    push: extra.push,
    pull: extra.pull,
    staleMissingLocal: plan.staleMissingLocal.map((s) => ({
      providerCode: s.providerCode,
      uid: s.uid,
      updatedAt: s.updatedAt,
    })),
    scope: extra.scopeDesc ?? null,
    providers: options.providers.length ? options.providers : 'all',
  }
  if (options.json) {
    process.stdout.write(`${JSON.stringify(summary)}\n`)
    return
  }
  if (options.quiet && plan.stats.toPush === 0 && plan.stats.toPull === 0 && extra.ok) return
  const head = options.dryRun ? '预检(不落库)' : '同步'
  process.stdout.write(
    `${head}: 范围=${extra.scopeDesc ?? '-'} 本地=${plan.stats.localTotal} 生产=${plan.stats.prodTotal} ` +
      `待推=${plan.stats.toPush} 待拉=${plan.stats.toPull} 一致=${plan.stats.unchanged} 冲突=${plan.stats.conflicts}\n`,
  )
  for (const c of plan.conflicts.slice(0, 10)) {
    process.stdout.write(
      `  · 冲突 ${c.providerCode}/${c.uid.slice(0, 12)}… → ${c.winner === 'local' ? '本地胜' : '生产胜'}` +
        `(差 ${Math.round(c.deltaMs / 1000)}s)\n`,
    )
  }
  if (plan.stats.staleMissingLocal > 0) {
    process.stdout.write(
      `  · 疑似已删(生产有 / 本地无,超拉回窗口): ${plan.stats.staleMissingLocal} 条 —— 不复活,` +
        `确认要清生产请人工处理\n`,
    )
  }
  if (!options.dryRun) {
    process.stdout.write(
      `  推送生产: 新增=${extra.push.imported} 更新=${extra.push.updated} 失败=${extra.push.failed}\n` +
        `  拉回本地: 新增=${extra.pull.imported} 更新=${extra.pull.updated} 失败=${extra.pull.failed}\n`,
    )
  }
}

/** 计划任务用的轻量日志:不重定向 stdout(非交互会话下 cmd 会被系统中断,实测 0xC000013A)。 */
function logLine(options, text) {
  if (!options?.logFile) return
  try {
    fs.appendFileSync(options.logFile, `[${new Date().toISOString()}] ${text}\n`, 'utf8')
  } catch {
    /* 日志写失败不影响同步 */
  }
}

/** 人类可读的「多久以前」。 */
function humanAge(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '未知'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s} 秒前`
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`
  return `${Math.floor(s / 86400)} 天前`
}

/**
 * 判定计划任务快照(纯函数,2026-11-12 抽出以便单测)。
 *
 * 抽出的理由:这段判据是**静默失效的唯一出口** —— 任务没注册、执行体被清理、工作目录被移走、
 * 结果非 0,四种情况都不会自己喊。判据写在 IO 闭包里就只能靠人肉看输出,写错了也没人知道;
 * 抽成纯函数后可以用替身喂各种快照,把每条分支钉住。
 *
 * @param {{taskCode:number, taskOut:string, exists?:(p:string)=>boolean}} input
 * @returns {Array<{level:'ok'|'warn'|'info', text:string}>}
 */
function judgeTaskSnapshot({ taskCode, taskOut, exists = fs.existsSync }) {
  const out = []
  const push = (level, text) => out.push({ level, text })
  const text = String(taskOut ?? '')
  if (taskCode !== 0 || !/STATE=/.test(text)) {
    push(
      'warn',
      `计划任务 ${TASK_NAME} 未注册 —— 脏标记没人消费,自动同步等于没开` +
        `(跑 node scripts/register-pool-sync-task.mjs --register)`,
    )
    return out
  }
  const field = (k) => new RegExp(`${k}=(.+)`).exec(text)?.[1]?.trim() ?? ''
  const state = field('STATE') || '?'
  const lastRun = field('LASTRUN') || '?'
  const lastResult = field('LASTRESULT') || '?'
  const resultOk = lastResult === '0x0'
  const stateOk = state === 'Ready' || state === 'Running'
  // 0x41301 = SCHED_S_TASK_RUNNING(Windows 自己的"正在运行"返回码,不是失败)。
  // 立因(2026-11-12 实测误报):只判 `!=0x0` 会把"恰好在跑"读成"这轮失败",
  // 而同步一轮要几十秒,随机撞上的概率不低 —— 假红比不报还坏,会让人开始忽略自检。
  const runningNow = state === 'Running' && lastResult === '0x41301'
  if (runningNow) {
    push('ok', `计划任务 ${TASK_NAME}: 正在运行中(上次 ${lastRun},结果 0x41301=SCHED_S_TASK_RUNNING)`)
  } else if (resultOk && stateOk) {
    push('ok', `计划任务 ${TASK_NAME}: ${state},上次 ${lastRun},结果 ${lastResult}`)
  } else {
    push(
      'warn',
      `计划任务 ${TASK_NAME}: ${state},上次 ${lastRun},结果 ${lastResult}` +
        `${resultOk ? '' : '(非 0 = 这轮同步失败,看日志)'}`,
    )
  }

  // 执行面三件套:注册时写下的路径**现在还在不在**。
  // 立因(实测):任务一度注册成 WorkBuddy 内置 node 的绝对路径,该路径含版本号目录 ——
  // WorkBuddy 升级 Node 后旧目录被清理,任务照常"启动"、立即失败、脏标记越积越多,
  // 而两端从此悄悄分叉。这类失效没有任何响声,只能主动查存在性。
  // 判据不写死具体路径(换机器/换安装方式都不能误判),只比对"注册时写下的值 vs 现在是否存在"。
  const execPath = field('EXEC')
  const workDir = field('WORKDIR')
  const scriptArg = /"([^"]+\.mjs)"/.exec(field('ARGS'))?.[1] ?? ''
  if (execPath && !exists(execPath)) {
    push(
      'warn',
      `任务执行体已失效: ${execPath} 不存在` +
        ` —— 多半是 node 升级后旧版本目录被清理,重跑 node scripts/register-pool-sync-task.mjs --register`,
    )
  }
  if (workDir && !exists(workDir)) {
    push('warn', `任务工作目录不存在: ${workDir} —— 仓库被移动/改名?重跑 --register 刷新`)
  }
  if (scriptArg && !exists(scriptArg)) {
    push('warn', `任务引用的同步脚本不存在: ${scriptArg} —— 重跑 --register`)
  }
  if (execPath && exists(execPath)) {
    const isVersionedNode = /[\\/]versions[\\/]/.test(execPath)
    push(
      'info',
      `任务执行体: ${execPath}` +
        (isVersionedNode ? '(路径含 node 版本目录 —— 升级 Node 后需重跑 --register)' : ''),
    )
  }
  return out
}

/**
 * 一键健康自检(--status,2026-11-11 立;2026-11-12 扩到六项)。
 *
 * 立因:自动同步的失效模式全是**静默**的 ——
 *   ① 换机器/重装后忘了注册计划任务 → 脏标记天天写,没人消费,本地生产悄悄分叉;
 *   ② 生产 checkout 落后远端(缺 --export-all)→ 每轮快照失败,日志里几行字没人翻;
 *   ③ 生产 checkout HEAD 是本地 rebase 出来的提交(远端没有)→ 下次 pull 必分叉(已踩两次);
 *   ④ 计划任务 LastTaskResult 非 0 → 同步其实一次都没成功;
 *   ⑤ 任务注册时写下的 node 绝对路径被清理(版本目录)→ 照常启动、立即失败、无声无息;
 *   ⑥ 本机 tsx 缺失 → 快照导不出,每一轮都失败。
 * 这些都不该靠人想起来去看,给一条命令看完;退出码 1 便于外部监控复用。
 */
async function reportStatus(options) {
  const rows = []
  let healthy = true
  const warn = (text) => {
    healthy = false
    rows.push(`⚠️ ${text}`)
  }
  const good = (text) => rows.push(`✅ ${text}`)

  // ① 计划任务:注册状态 / 上次结果 / 上次时间 / 执行面三件套
  const psScript = `
$ErrorActionPreference = 'Stop'
try {
  $t = Get-ScheduledTask -TaskName '${TASK_NAME}'
  $i = $t | Get-ScheduledTaskInfo
  Write-Output ('STATE=' + $t.State)
  Write-Output ('LASTRUN=' + $i.LastRunTime)
  Write-Output ('LASTRESULT=0x' + ('{0:X}' -f $i.LastTaskResult))
  Write-Output ('EXEC=' + $t.Actions[0].Execute)
  Write-Output ('WORKDIR=' + $t.Actions[0].WorkingDirectory)
  Write-Output ('ARGS=' + $t.Actions[0].Arguments)
} catch {
  # PowerShell 7 无 ScheduledTasks 模块:退回 Schedule.Service COM(本机实际环境)
  $s = New-Object -ComObject Schedule.Service
  $s.Connect()
  $f = $s.GetFolder('\\')
  $t = $f.GetTask('${TASK_NAME}')
  $act = $t.Definition.Actions.Item(1)
  $stateMap = @{0='Unknown';1='Disabled';2='Queued';3='Ready';4='Running'}
  Write-Output ('STATE=' + $stateMap[[int]$t.State])
  Write-Output ('LASTRUN=' + $t.LastRunTime)
  Write-Output ('LASTRESULT=0x' + ('{0:X}' -f [int]$t.LastTaskResult))
  Write-Output ('EXEC=' + $act.Path)
  Write-Output ('WORKDIR=' + $act.WorkingDirectory)
  Write-Output ('ARGS=' + $act.Arguments)
}
`.trim()
  const taskRun = await runProcess(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', psScript],
    {},
  )
  const taskOut = `${taskRun.stdout ?? ''}`
  for (const r of judgeTaskSnapshot({ taskCode: taskRun.code, taskOut })) {
    if (r.level === 'warn') warn(r.text)
    else if (r.level === 'ok') good(r.text)
    else rows.push(`ℹ️ ${r.text}`)
  }

  // ② 最近的同步日志(计划任务每轮一行;只写"有动作"的轮次与失败)
  const logFile = options.logFile || DEFAULT_LOG_FILE
  let logLines = []
  try {
    logLines = fs.readFileSync(logFile, 'utf8').split(/\r?\n/).filter(Boolean)
  } catch {
    logLines = []
  }
  if (logLines.length === 0) {
    rows.push(`ℹ️ 暂无同步日志(${logFile})—— 只记录真有变更/真失败的轮次;空转不写,存活看上面的计划任务时间`)
  } else {
    const last = logLines[logLines.length - 1]
    const stamp = /^\[(.+?)\]/.exec(last)?.[1]
    const ageMs = stamp ? Date.now() - new Date(stamp).getTime() : NaN
    const failed = /\bFAIL\b/.test(last)
    const tail = last.replace(/^\[.+?\]\s*/, '')
    if (failed) warn(`最近一轮失败(${humanAge(ageMs)}): ${tail}`)
    else good(`最近一轮有动作 ${humanAge(ageMs)}: ${tail}(空转轮不写日志,存活看上面的计划任务时间)`)
    if (Number.isFinite(ageMs) && ageMs > 24 * 3600 * 1000) {
      rows.push('ℹ️ 超过一天没有同步记录 —— 无新账号变更时属正常(空转不写日志)')
    }
  }

  // ③ 脏标记:存在说明有待同步的变更
  if (fs.existsSync(options.dirtyFile)) {
    let ageMs = NaN
    try {
      ageMs = Date.now() - fs.statSync(options.dirtyFile).mtimeMs
    } catch {
      /* ignore */
    }
    if (Number.isFinite(ageMs) && ageMs > 10 * 60 * 1000) {
      warn(`脏标记已存在 ${humanAge(ageMs)} 未消化 —— 计划任务大概率没在跑(正常 2 分钟内清掉)`)
    } else {
      rows.push(`ℹ️ 有待同步变更(脏标记 ${humanAge(ageMs)}),下一轮自动处理`)
    }
  } else {
    good('无待同步变更(脏标记已清空)')
  }

  // ④ 生产 checkout 能力:能否导出全平台 / HEAD 是否分叉出远端
  if (options.localMode) {
    const importer = path.join(options.prodCheckout, 'apps', 'api', 'scripts', 'relay-account-import.ts')
    if (fs.existsSync(importer)) good('生产 checkout 支持 --export-all(本地模式,本机即生产,免 SSH 隧道)')
    else warn('生产 checkout 缺导入器脚本')
    try {
      const aheadRun = await runProcess('git', ['-C', options.prodCheckout, 'rev-list', '--count', 'origin/main..HEAD'], {})
      const ahead = Number(`${aheadRun.stdout ?? ''}`.trim())
      if (ahead > 0) warn(`生产 checkout 有 ${ahead} 个远端不存在的本地提交`)
      else good('生产 HEAD 与 origin/main 同链(本地模式)')
    } catch {
      good('生产 HEAD 与 origin/main 同链(本地模式)')
    }
  } else {
    const remoteCmd =
      `cd /d "${options.prodCheckout}" & ` +
      `findstr /C:"export-all" apps\\api\\scripts\\relay-account-import.ts >nul && echo CAP_OK || echo CAP_MISSING & ` +
      `git rev-parse --short HEAD & git rev-parse --short origin/main & ` +
      `git rev-list --count origin/main..HEAD`
    const prodRun = await runProcess('ssh', [...SSH_OPTS, options.prodHost, remoteCmd], {})
    if (prodRun.code !== 0) {
      warn(`生产不可达或 checkout 异常(退出码 ${prodRun.code})—— 本轮同步必然失败`)
    } else {
      const lines = `${prodRun.stdout ?? ''}`.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      const capOk = lines.includes('CAP_OK')
      const aheadIdx = lines.findIndex((l) => /^\d+$/.test(l) && !/^[0-9a-f]{7,}$/.test(l))
      const ahead = aheadIdx >= 0 ? Number(lines[aheadIdx]) : NaN
      if (capOk) good('生产 checkout 支持 --export-all')
      else warn('生产 checkout 缺 --export-all —— 每轮快照都会失败,需在生产 git pull 到最新')
      if (Number.isFinite(ahead) && ahead > 0) {
        warn(`生产 checkout 有 ${ahead} 个远端不存在的本地提交 —— 下次 pull 必分叉(应 reset 到 origin/main 并保留改动为未提交)`)
      } else if (Number.isFinite(ahead)) {
        good(`生产 HEAD 与 origin/main 同链(${(/^[0-9a-f]{7,}$/i.exec(lines[1] ?? '') ?? [''])[0] || lines[0]})`)
      }
    }
  }

  // ⑤ 本机执行面:tsx 与导入器是否在位(缺了快照就导不出,同步必失败)
  // 这一项查的是"任务真跑起来那一刻会不会摔",而非任务注册信息 —— 与 ①b 互补:
  // ①b 查注册时写下的路径还在不在,这里查同步脚本自己依赖的东西还在不在。
  const tsxCli = resolveTsx()
  if (!tsxCli) {
    warn('本机缺 tsx(apps/api/node_modules/tsx)—— 快照导不出,同步必失败;先在仓根 pnpm install')
  } else {
    good(`本机 tsx 就位(${path.relative(ROOT, tsxCli).replace(/\\/g, '/')})`)
  }

  process.stdout.write(`号池同步健康自检\n`)
  for (const row of rows) process.stdout.write(`  ${row}\n`)
  process.stdout.write(healthy ? '\n结论: 自动同步链路健康\n' : '\n结论: 存在问题,见上面 ⚠️\n')
  return healthy ? 0 : 1
}

async function main(argv) {
  const parsed = parseArgs(argv)
  if (parsed.error) {
    process.stderr.write(`❌ ${parsed.error}\n\n${HELP}\n`)
    return 2
  }
  const options = parsed.options
  if (options.help) {
    process.stdout.write(`${HELP}\n`)
    return 0
  }

  // 健康自检:只读,不建 tsx、不写任何库
  if (options.status) return reportStatus(options)

  // 计划任务快速通道:无脏标记 = 本轮 0 开销(不建 SSH、不启 tsx)
  // 空转**不写日志**:每 2 分钟一行会让日志按 720 行/天膨胀,而存活证据由计划任务自身的
  // LastRunTime / LastTaskResult 提供(--status 已读)。日志只保留真有动作/真失败的轮次。
  if (options.ifDirty && !options.force && !fs.existsSync(options.dirtyFile)) {
    if (!options.quiet) process.stdout.write('无变更标记,跳过本轮同步\n')
    return 0
  }

  const tsxCli = resolveTsx()
  if (!tsxCli) {
    process.stderr.write('❌ 未找到 tsx(apps/api/node_modules/tsx);请先在仓根跑 pnpm install\n')
    return 2
  }

  // 归属范围先定,避免把生产上他人账号拉进开发机(见 resolveOwnerScope 注释);
  // 判定失败必须在任何 IO 前退出,所以先于对照表导出。
  const scope = resolveOwnerScope(options)
  if (scope?.error) {
    process.stderr.write(`❌ ${scope.error}\n`)
    return 2
  }

  // 归属 id→email 对照(email 身份键,见 fetchOwnerMap* 注释):本地 tsx 只读脚本,
  // 生产一次 SSH 跑同一脚本。取不到不致命 —— 降级为只认导出自带的 ownerEmail,
  // 翻译不出的行由 groupForImport fail-closed 点名跳过(绝不静默落运营池/悬空归属)。
  const ownerMaps = { local: {}, prod: {} }
  try {
    ownerMaps.local = await fetchOwnerMapLocal(tsxCli)
  } catch (e) {
    process.stderr.write(
      `⚠️ 本地归属对照不可用(email 翻译降级,个人池行可能被点名跳过): ${e instanceof Error ? e.message : String(e)}\n`,
    )
  }
  try {
    ownerMaps.prod = await fetchOwnerMapProd(options)
  } catch (e) {
    process.stderr.write(
      `⚠️ 生产归属对照不可用(推送侧个人池行可能被点名跳过): ${e instanceof Error ? e.message : String(e)}\n`,
    )
  }
  attachScopeEmails(scope, ownerMaps.local)

  let local
  let prod
  try {
    local = filterByOwnerScope(await snapshotLocal(tsxCli, options), scope, ownerMaps.local)
    prod = filterByOwnerScope(await snapshotProd(options), scope, ownerMaps.prod)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    process.stderr.write(`❌ 快照失败(未判定,本轮不写任何库): ${msg}\n`)
    logLine(options, `sync FAIL 快照失败: ${msg}`)
    return 2
  }

  let plan = planPoolSync({
    local,
    prod,
    providers: options.providers,
    pullWindowDays: options.pullWindowDays,
    ownerMaps,
  })

  // 方向开关:只推 / 只拉
  if (options.pushOnly) plan = { ...plan, toPull: [] }
  if (options.pullOnly) plan = { ...plan, toPush: [] }

  // 落库 owner = ownerIdentity(email)经目标环境 email→id 反查翻译;翻译不出 ⇒ 点名跳过
  const pushBatches = options.dryRun ? [] : groupForImport(plan.toPush, invertOwnerMap(ownerMaps.prod))
  const pullBatches = options.dryRun ? [] : groupForImport(plan.toPull, invertOwnerMap(ownerMaps.local))
  const skippedPush = pushBatches.skipped ?? []
  const skippedPull = pullBatches.skipped ?? []
  for (const s of skippedPush) {
    process.stderr.write(`⚠️ 推送跳过 ${s.providerCode}/${s.uid}: ${s.reason} —— 不落运营池,人工核对两端 users 表\n`)
  }
  for (const s of skippedPull) {
    process.stderr.write(`⚠️ 拉回跳过 ${s.providerCode}/${s.uid}: ${s.reason} —— 不落运营池,人工核对两端 users 表\n`)
  }

  let push = { code: 0, imported: 0, updated: 0, failed: 0 }
  let pull = { code: 0, imported: 0, updated: 0, failed: 0 }
  if (!options.dryRun) {
    // 先拉后推:把生产的新凭证先补到本地,再统一往外推,避免同一轮里推了旧值
    pull = await applyPull(pullBatches, tsxCli, options)
    if (!options.pullOnly) push = await applyPush(pushBatches, options)
  }

  const ok = push.code === 0 && push.failed === 0 && pull.code === 0 && pull.failed === 0
  const scopeDesc = options.allOwners
    ? '全库'
    : `个人池 ${[...scope.personal].map((o) => maskPoolOwner(o)).join(',')} + 运营池`
  emitReport(plan, options, { ok, push, pull, scopeDesc })
  logLine(
    options,
    `sync ${ok ? 'ok' : 'FAIL'} 本地=${plan.stats.localTotal} 生产=${plan.stats.prodTotal} ` +
      `推=${plan.stats.toPush} 拉=${plan.stats.toPull} 一致=${plan.stats.unchanged} ` +
      `失败推=${push.failed} 失败拉=${pull.failed} ` +
      `owner翻译跳过=${skippedPush.length + skippedPull.length}${options.dryRun ? ' (dry-run)' : ''}`,
  )

  // 脏标记只在真正落库且无失败时清除:失败保留标记,下一轮自动重试
  if (!options.dryRun && ok) {
    try {
      if (fs.existsSync(options.dirtyFile)) fs.rmSync(options.dirtyFile, { force: true })
    } catch {
      /* 标记删不掉不影响同步结果,下轮再跑一次是幂等的 */
    }
  }

  if (!ok) return 1
  return 0
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
      process.exit(2)
    })
}

export {
  main as __syncMain,
  flattenProviders as __flattenProviders,
  extractExport as __extractExport,
  humanAge as __humanAge,
  parseArgs as __parseArgs,
  judgeTaskSnapshot as __judgeTaskSnapshot,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
