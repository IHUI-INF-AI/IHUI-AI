// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §15b 备份落点的**非导入出口**:给那些"按层序不得 import repo-tooling"的调用方一个可复制的路径。
 *
 * 为什么要有这个文件(而不是让调用方直接 import `gitArchiveDir()`):
 * 架构契约表(`config/architecture-policy.yaml`)的层序是
 * `contract(10) ← platform(20,含 packages/database) ← composite(30,含 shared) ← product(40) ← tooling(90)`,
 * 规则是"rank 小的可被 rank 大的依赖,反向即违规"。`packages/database/seed/migrate-overseas-images.ts`
 * 要写一份事前备份,它既不得 import 本层(守门 103 实测判 D1/D2/D3 红),也不得自己硬编码盘符
 * (§15b 明令禁止,本机已因此吃过"备份解析到不存在路径 ⇒ git-guardian 的 backupOk:false 静默失效")。
 * 所以落点由这里交出去、由调用方作为**入参**接收 —— 与本仓 §5d 的
 * `node scripts/secret-path.mjs <子目录> <文件名>` 是同一条设计(非导入上下文的唯一出口)。
 *
 * 用法:
 *   node scripts/archive-dir.mjs                  # 打印 <backups>/sql/image-source-migration
 *   node scripts/archive-dir.mjs --kind git        # 打印 <backups>/git(gitdir 现场归档落点)
 *   node scripts/archive-dir.mjs --kind pg         # 打印 <backups>/pg
 * stdout 恒为**一行路径或空**,诊断只写 stderr ⇒ 调用方可以 `X="$(node scripts/archive-dir.mjs)"`。
 * 退出码:0 交出落点 / 1 解析不到(盘符推导失败,属"要先修环境")/ 2 参数或工具自身异常(**无法判定**,不得读成"没有落点")。
 * 落点解析档**不建目录、不写文件** —— 建目录是调用方的事(mkdirSync recursive),这里只答"该落在哪";
 * 写盘与删除只存在于下面的保留档 `--apply`(留痕 + 经 retire-git-archive 的单一删除出口)。
 *
 * ── 保留档(G-24,2026-10-25 接进本工具)──────────────────────────────────────────────
 * 背景:`gitArchiveDir()` 下的事故现场归档此前只有 `scripts/retire-git-archive.mjs` 一处实现,
 * 而**本工具**(归档目录的唯一路径出口)对这套策略 0 命中 ⇒ "归档目录管理"分成了两个互不知情的面。
 * 本节把保留档接进同一入口,但**判据不复制**(§0.6 单一真相源):
 *   · 双上限(keepGenerations 条数 + maxTotalBytes 总字节)、保留最近 N 代、1 秒稳定窗、
 *     §5b 禁删名单 —— 全部 import 自 retire-git-archive.mjs 的 `planRetirement` / `classifyEntry`
 *     / `removeEntry` / `protectedBaseNames`;
 *   · 本文件只新增两件事:① "条目清单 → {keep, remove, reasons}" 的**纯函数** `planArchiveRetention()`;
 *     ② `--apply` 档按计划真删,并把**每一次尝试**逐行追加到 `.ihui-agent/state/archive-retention.jsonl`。
 *
 * 三条硬边界(比功能本身重要):
 *   1) **默认 dry-run**:不带 `--apply` 时一次删除都不发生;`--check` 与 `--apply` 互斥。
 *      `--apply` 必定**先打印完整候选集**(条数/名字/字节/mtime/理由)再动手。
 *   2) **不自动调度**:本档不接 guardian、不接任何定时器 —— "先只读观察一轮再谈自动删"是 G-24 的
 *      用户定档;要接线是另一票,且落在别人的改区。
 *   3) **禁删名单不回收**:活 gitdir / 本地恢复源 / 两者的 `*.broken-*` 现场(§5b)、
 *      `bundles/`(§22 lost-commit/stash 抢救 bundle)、`cold/`(冷层自身)、`broken-refs/`(正在被
 *      git-backup-refresh 写)一律不进 remove;无事故签名的条目只报"射程外",不删。
 * 台账行(ASCII 键 + ISO 时刻):{ts, path, name, reason, bytes, source:'retention', ok, why}。
 * 保留档退出码:0 完成 / 1 有删除失败或留痕写失败 / 2 无法判定(根取不到、换根未声明、枚举失败、参数错)。
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { gitArchiveDir } from './lib/gitdir.mjs'
import { requireFlagValue } from './lib/flag-value.mjs'
import {
  COLD_DIR_NAME,
  DEFAULT_KEEP_GENERATIONS,
  DEFAULT_MAX_TOTAL_BYTES,
  IN_USE_SUBPATHS,
  MIN_AGE_MS,
  classifyEntry,
  hasAccidentSignature,
  inUseReason,
  listEntries,
  planRetirement,
  protectedBaseNames,
  protectedReason,
  removeEntry,
} from './retire-git-archive.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** kind → backups 根下的子路径。只登记**已被真实写入方使用**的,不得先建表再等人用。 */
const KINDS = {
  'image-source-migration': ['sql', 'image-source-migration'],
  sql: ['sql'],
  git: ['git'],
  pg: ['pg'],
  deploy: ['deploy'],
  env: ['env'],
}

export function archiveDirFor(kind, worktree = ROOT) {
  const sub = KINDS[kind]
  if (!sub) {
    // cause 分两档:参数错是"调用方写错了"(改调用),交不出根是"环境不可达"(先修环境)。
    // 混成一档会让人把"问错了"读成"没有落点"。
    return {
      path: null,
      cause: 'bad-arg',
      reason: `未知 kind:${kind}(在表里的:${Object.keys(KINDS).join(', ')})`,
    }
  }
  const gitArch = gitArchiveDir(worktree)
  if (!gitArch) {
    return {
      path: null,
      cause: 'unresolved',
      reason: 'gitArchiveDir() 未交出备份根(工作树所在盘不可达或仓库根解析失败)',
    }
  }
  // <X>/DevEnv/backups/git → <X>/DevEnv/backups,再拼目标子路径
  const backupsRoot = gitArch.replace(/\\/g, '/').replace(/\/+$/, '').replace(/\/git$/, '')
  return { path: [backupsRoot, ...sub].join('/'), cause: null, reason: null }
}

/** 保留台账的唯一相对路径(测试/演练用 `--ledger` 换到夹具,不得在生产面上试删)。 */
export const RETENTION_LEDGER_REL = '.ihui-agent/state/archive-retention.jsonl'

/**
 * 禁删名单里"按名字/前缀"那一半的可配置默认:
 *  - `bundles/` 是 §22 的 lost-commit / stash 抢救 bundle(retire 只按"非事故签名"把它排除出射程;
 *    这里显式登记成 protected,免得将来名字形态一变被读成垃圾);
 *  - `cold/` 与 `broken-refs/` 取自 retire 的 `COLD_DIR_NAME` / `IN_USE_SUBPATHS` —— **不写第二份字面量**。
 */
export const RETENTION_PROTECTED_PREFIXES = Object.freeze(['bundles', COLD_DIR_NAME, ...IN_USE_SUBPATHS])

/**
 * 单条归档 → 计划行。判序是安全属性,不得重排:
 * 缺 mtime(判不出新旧)⇒ 判不出 → 上游已判 undetermined / protected → §5b 名单(形态 + 派生基名)
 * → 仍被引用的子目录(cold / broken-refs)→ 前缀禁删名单(bundles 等)→ 上游已判射程外
 * → 无事故签名 ⇒ 射程外 → in-scope。
 * 除最后一项外永不进 remove;`in-scope` 才交给 retire 的 `planRetirement` 排世代/字节。
 */
function retentionRow(entry, { now, protectedNames, protectedPrefixes }) {
  const name = typeof entry?.name === 'string' ? entry.name : ''
  if (!name) throw new TypeError('归档条目缺 name:无法判新旧与禁删名单')
  const mtimeMs = Number(entry.mtimeMs)
  const row = {
    name,
    path: typeof entry.path === 'string' && entry.path ? entry.path : name,
    bytes:
      typeof entry.bytes === 'number' && Number.isFinite(entry.bytes) && entry.bytes >= 0
        ? entry.bytes
        : null,
    mtimeMs: Number.isFinite(mtimeMs) ? mtimeMs : null,
    ageMs: Number.isFinite(mtimeMs) ? now - mtimeMs : null,
    kind: typeof entry.kind === 'string' ? entry.kind : null,
    reason: typeof entry.reason === 'string' ? entry.reason : '',
  }
  if (!Number.isFinite(row.mtimeMs)) {
    row.kind = 'undetermined'
    row.reason = '缺 mtime ⇒ 判不出新旧,不删也不计入候选'
    return row
  }
  if (row.kind === 'undetermined') {
    row.reason = row.reason || '上游判定为"判不出"'
    return row
  }
  if (row.kind === 'protected') {
    row.reason = row.reason || '上游分类已判定不可回收'
    return row
  }
  const pr = protectedReason(name, protectedNames)
  if (pr) {
    row.kind = 'protected'
    row.reason = `P-c ${pr}`
    return row
  }
  const iu = inUseReason(name)
  if (iu) {
    row.kind = 'protected'
    row.reason = iu
    return row
  }
  const prefix = protectedPrefixes.find((p) => name === p || name.startsWith(`${p}/`))
  if (prefix) {
    row.kind = 'protected'
    row.reason = `禁删名单前缀(${prefix}):永不回收`
    return row
  }
  if (row.kind === 'out-of-scope') {
    row.reason = row.reason || '上游分类已判定不在射程'
    return row
  }
  if (row.kind !== 'in-scope') {
    if (!hasAccidentSignature(name)) {
      row.kind = 'out-of-scope'
      row.reason = '非事故归档形态(无 .broken-<ts> / .stale-* 签名)⇒ 未验明身份不删'
      return row
    }
    row.kind = 'in-scope'
    row.reason = '事故归档'
  }
  return row
}

/**
 * 纯函数:归档条目的保留计划(零 IO,判据全部来自 retire-git-archive 的单一实现)。
 *
 * @param {Array<{name:string, path?:string, mtimeMs?:number, bytes?:number|null, kind?:string, reason?:string}>} entries
 *   归档条目清单(含时间戳/大小);`kind` 可省(本函数按同一套谓词现判),也可由
 *   `classifyEntry()` 预先分类(CLI 走这条,`kind` 存在即信任,只补前缀禁删名单)。
 * @param {{keep?:number, maxTotalBytes?:number, now?:number, protectedNames?:string[], protectedPrefixes?:string[]}} [opts]
 *   `protectedNames` = §5b 派生名单(活 gitdir / 本地恢复源基名);省略时只剩形态判据
 *   (`-git-repo` / `.git-backup-`),删除档还会由 `removeEntry` 二次拒收。
 * @returns {{keep:Array<object>, remove:Array<object>, reasons:Record<string,string>,
 *   limits:{keepGenerations:number,maxTotalBytes:number}, buckets:object,
 *   retainedBytes:number, inScopeBytes:number}}
 *   `keep` + `remove` 恰好覆盖全部条目且不相交;`reasons[name]` 对每一条都给理由(含"为什么不删")。
 */
export function planArchiveRetention(entries, opts = {}) {
  if (!Array.isArray(entries)) throw new TypeError('planArchiveRetention(entries, opts): entries 必须是数组')
  const keep = opts.keep ?? DEFAULT_KEEP_GENERATIONS
  const maxTotalBytes = opts.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES
  const now = opts.now ?? Date.now()
  const protectedNames = Array.isArray(opts.protectedNames) ? opts.protectedNames : []
  const protectedPrefixes = Array.isArray(opts.protectedPrefixes)
    ? opts.protectedPrefixes
    : RETENTION_PROTECTED_PREFIXES
  const rows = entries.map((e) => retentionRow(e, { now, protectedNames, protectedPrefixes }))
  const plan = planRetirement({ entries: rows, keep, maxTotalBytes, now })
  const reasons = Object.create(null)
  for (const e of plan.inFlight) reasons[e.name] = `in-flight(mtime 距今 <${MIN_AGE_MS}ms ⇒ 稳定窗内不删)`
  for (const e of plan.keepSet) reasons[e.name] = `gen<=keep(保留最近 ${keep} 代)`
  for (const e of plan.protected) reasons[e.name] = e.reason
  for (const e of plan.outOfScope) reasons[e.name] = e.reason
  for (const e of plan.undetermined) reasons[e.name] = e.reason
  const remove = plan.retire.map((e) => ({ ...e, reason: e.retireReason }))
  for (const e of remove) reasons[e.name] = e.retireReason
  const removeNames = new Set(remove.map((e) => e.name))
  const kept = rows.filter((e) => !removeNames.has(e.name))
  for (const e of kept) if (!reasons[e.name]) reasons[e.name] = 'undetermined(计划未覆盖,不删)'
  return {
    keep: kept,
    remove,
    reasons,
    limits: { keepGenerations: keep, maxTotalBytes },
    buckets: {
      keepGenerations: plan.keepSet,
      inFlight: plan.inFlight,
      protected: plan.protected,
      outOfScope: plan.outOfScope,
      undetermined: plan.undetermined,
    },
    retainedBytes: plan.retainedBytes,
    inScopeBytes: plan.inScopeBytes,
  }
}

/**
 * 留痕:每次删除尝试追加一行 JSONL(ASCII 键 + ISO 时刻)。
 * 写不进去必须喊(§5e 同一条禁令),并把失败交给调用方计入退出码 —— 不得静默把"没记上"读成"没发生"。
 */
export function appendRetentionLedger(file, record) {
  const line = `${JSON.stringify(record)}\n`
  try {
    mkdirSync(dirname(file), { recursive: true })
    appendFileSync(file, line, 'utf8')
    return { ok: true }
  } catch (e) {
    console.error(`⚠️ 归档保留台账写入失败(${e?.code ?? 'UNKNOWN'}):${line.trim()}`)
    return { ok: false, why: String(e?.message ?? e) }
  }
}

/**
 * 删除执行器。**默认 dry-run**:`apply !== true` 时一次删除都不发生(结构上不进入循环)。
 * 真删只调用 retire 的 `removeEntry`(全仓唯一 `rmSync` 出口 —— 重解析点/越界/§5b/稳定窗四道
 * 现场复验都在那里),每次尝试立刻写一行台账(成功与失败都写,删完再写会让崩溃变成静默)。
 *
 * @param {object} p
 * @param {string} p.root 归档根(绝对路径)
 * @param {object} [p.plan] `planArchiveRetention()` 的结果;省略时用 `entries` 现算
 * @param {Array<object>} [p.entries] 原始条目(省略 plan 时必给;用于 apply 时每条须带绝对 `path`)
 * @param {boolean} [p.apply=false] 只有 `true` 才真删
 * @param {string} [p.ledgerFile] 台账文件;`apply=true` 时必给(每次删除必须留痕)
 * @returns {{plan:object, dryRun:boolean, attempted:number, deleted:string[], failed:Array<object>,
 *   skipped:Array<object>, ledgerFailures:number, ledgerFile:string|null}}
 */
export function applyArchiveRetention({
  root,
  plan,
  entries,
  opts = {},
  apply = false,
  ledgerFile = null,
  now = Date.now(),
  protectedNames = [],
  remove = removeEntry,
  ledger = appendRetentionLedger,
} = {}) {
  if (!root) throw new TypeError('applyArchiveRetention 需要归档根 root')
  const p =
    plan ??
    planArchiveRetention(entries ?? [], {
      ...opts,
      now,
      protectedNames: opts.protectedNames ?? protectedNames,
    })
  const res = {
    plan: p,
    dryRun: !apply,
    attempted: 0,
    deleted: [],
    failed: [],
    skipped: [],
    ledgerFailures: 0,
    ledgerFile,
  }
  if (!apply) return res
  if (!ledgerFile) throw new TypeError('apply=true 必须显式交出 ledgerFile(每次删除都要留痕)')
  const baseNames = protectedNames.length ? protectedNames : undefined
  for (const e of p.remove) {
    res.attempted += 1
    const r = remove({ root, path: e.path, name: e.name, now, baseNames })
    const ok = !!(r && r.ok)
    const why = ok ? null : String((r && r.why) || '未判定(执行器未给理由)')
    const record = {
      ts: new Date().toISOString(),
      path: e.path,
      name: e.name,
      reason: e.reason,
      bytes: typeof e.bytes === 'number' ? e.bytes : null,
      source: 'retention',
      ok,
      why,
    }
    if (ok) res.deleted.push(e.name)
    else if (/正在写/.test(why)) res.skipped.push({ name: e.name, why })
    else res.failed.push({ name: e.name, why })
    const w = ledger(ledgerFile, record)
    if (w && w.ok === false) res.ledgerFailures += 1
  }
  return res
}

const normPath = (p) => String(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()

function printRetentionPlan({ root, ledgerFile, apply, plan }) {
  const b = plan.buckets
  console.log(`归档根: ${root}`)
  console.log(
    `档位: keep=${plan.limits.keepGenerations} 代 / maxTotalBytes=${plan.limits.maxTotalBytes}`,
  )
  console.log(
    `条目 ${plan.keep.length + plan.remove.length} | 保留 ${plan.keep.length} | 将删 ${plan.remove.length}` +
      ` | 保护 ${b.protected.length} | 射程外 ${b.outOfScope.length}` +
      ` | 判不出 ${b.undetermined.length} | 稳定窗内 ${b.inFlight.length}`,
  )
  console.log(`台账: ${ledgerFile}`)
  console.log(apply ? '删除档: apply(下表打印完就开始真删)' : '删除档: dry-run(未发起任何删除;真删再加 --apply)')
  if (plan.remove.length) {
    console.log(`将删(候选集 ${plan.remove.length} 项,旧 → 新):`)
    for (const e of plan.remove) {
      const bytes = typeof e.bytes === 'number' ? e.bytes : '未量到'
      const mtime = new Date(e.mtimeMs).toISOString()
      console.log(`  - ${e.name}  bytes=${bytes}  mtime=${mtime}  why=${e.reason}`)
    }
  }
  for (const [label, list] of [
    ['保护(永不回收)', b.protected],
    ['射程外(不删)', b.outOfScope],
    ['判不出(不删)', b.undetermined],
    ['稳定窗内(不删)', b.inFlight],
  ]) {
    if (!list.length) continue
    console.log(`${label} ${list.length} 项:`)
    for (const e of list) console.log(`  - ${e.name}  why=${e.reason || '未给理由'}`)
  }
}

/**
 * 保留档 CLI。只在 `--check` / `--apply` 被显式给出时进入;`--kind` 必须是 `git`
 * (双上限策略的对象是 `gitArchiveDir()` 下的事故现场归档,别的族没有这份判据)。
 */
export function runRetention({ argv, kind = 'git' }) {
  const apply = argv.includes('--apply')
  if (apply && argv.includes('--check')) {
    console.error('用法错:--check(只打印计划)与 --apply(真删)互斥,不得同给')
    return 2
  }
  if (kind !== 'git') {
    console.error(`用法错:保留策略只对事故归档根(kind=git)成立;实得 kind=${kind}`)
    return 2
  }
  const rootFlag = requireFlagValue(argv, '--root', { noun: '归档根目录' })
  if (rootFlag.error) {
    console.error(`用法错:${rootFlag.error}`)
    return 2
  }
  const ledgerFlag = requireFlagValue(argv, '--ledger', { noun: '留痕文件路径' })
  if (ledgerFlag.error) {
    console.error(`用法错:${ledgerFlag.error}`)
    return 2
  }
  const keepFlag = requireFlagValue(argv, '--keep', {
    noun: '保留代数(整数,>=0)',
    fallback: String(DEFAULT_KEEP_GENERATIONS),
  })
  if (keepFlag.error) {
    console.error(`用法错:${keepFlag.error}`)
    return 2
  }
  const bytesFlag = requireFlagValue(argv, '--max-bytes', {
    noun: '总字节上限(正整数)',
    fallback: String(DEFAULT_MAX_TOTAL_BYTES),
  })
  if (bytesFlag.error) {
    console.error(`用法错:${bytesFlag.error}`)
    return 2
  }
  const keep = Number(keepFlag.value)
  const maxTotalBytes = Number(bytesFlag.value)
  if (!Number.isInteger(keep) || keep < 0 || !Number.isFinite(maxTotalBytes) || maxTotalBytes <= 0) {
    console.error(
      `用法错:档位非法 keep=${keepFlag.value} max-bytes=${bytesFlag.value}(keep 必须整数 >=0,max-bytes 必须正整数)`,
    )
    return 2
  }
  const stdRoot = gitArchiveDir()
  if (!stdRoot) {
    console.error('判不出归档根:gitArchiveDir() 未交出备份根(盘不可达 / 夹具闸命中)⇒ 不冒删也不记通过')
    return 2
  }
  const root = rootFlag.value ? resolve(rootFlag.value) : stdRoot
  if (rootFlag.value && normPath(root) !== normPath(stdRoot)) {
    if (!argv.includes('--allow-custom-root')) {
      console.error(`越界:--root ${rootFlag.value} 不等于 gitArchiveDir()=${stdRoot}`)
      console.error('   在非归档根上执行保留策略属越界;确要换根请同时给 --allow-custom-root(仅人工/取证)')
      return 2
    }
    console.error(`⚠️ 自定义根生效:${root}(默认档是 ${stdRoot})`)
  }
  const ledgerFile = ledgerFlag.value
    ? resolve(ledgerFlag.value).replace(/\\/g, '/')
    : join(ROOT, RETENTION_LEDGER_REL).replace(/\\/g, '/')
  let names
  try {
    names = listEntries(root)
  } catch (e) {
    console.error(`无法判定:归档根枚举失败(${e.message})⇒ 记"未判定"而非"无可删"`)
    return 2
  }
  const now = Date.now()
  const baseNames = protectedBaseNames()
  const entries = names.map((name) => classifyEntry({ root, name, now, baseNames }))
  const plan = planArchiveRetention(entries, { keep, maxTotalBytes, now, protectedNames: baseNames })
  printRetentionPlan({ root, ledgerFile, apply, plan })
  if (!apply) return plan.buckets.undetermined.length ? 2 : 0
  console.log('\n[apply] 按上表开始删除……')
  const res = applyArchiveRetention({
    root,
    plan,
    apply: true,
    ledgerFile,
    now,
    protectedNames: baseNames,
  })
  console.log(
    `[apply] 已删 ${res.deleted.length} / 失败 ${res.failed.length} / 稳定窗内跳过 ${res.skipped.length}` +
      ` / 台账写失败 ${res.ledgerFailures}`,
  )
  for (const f of res.failed) console.error(`  ❌ ${f.name}: ${f.why}`)
  for (const s of res.skipped) console.error(`  ⏭ ${s.name}: ${s.why}`)
  if (res.failed.length || res.ledgerFailures) return 1
  return plan.buckets.undetermined.length ? 2 : 0
}

function main() {
  const args = process.argv.slice(2)
  // G-322(备份目录的"族名"):旧写法只挡"后面没有参数";`--kind --apply` 这类把旗标名当族名,
  // 会得到一个**新目录**当备份落点(破坏性动作前的归档写到没人期望的位置,§5b 要求归档必须可回查)。
  // 缺省档不变(不传 --kind 仍是 image-source-migration)。
  const kindFlag = requireFlagValue(args, '--kind', { noun: '族名(image-source-migration|sql|git|pg|deploy|env)' })
  if (kindFlag.error) {
    console.error(`用法错:${kindFlag.error}`)
    process.exit(2)
  }
  // 保留档:--check / --apply 显式给出才进入(缺省 kind 在保留档是 git —— 策略对象只有事故归档根)。
  if (args.includes('--check') || args.includes('--apply')) {
    // 输出可能有数百行,用 exitCode 而不是 process.exit:管道下 process.exit 会截断 stdout。
    process.exitCode = runRetention({ argv: args, kind: kindFlag.value ?? 'git' })
    return
  }
  // 路径档:保留档专属旗标在这里静默忽略,会让"我以为它按我给的根跑"成真。
  for (const flag of ['--root', '--ledger', '--allow-custom-root']) {
    if (args.includes(flag)) {
      console.error(`用法错:${flag} 只在 --check / --apply(保留档)有效;路径档只回答落点`)
      process.exit(2)
    }
  }
  const kind = kindFlag.value ?? 'image-source-migration'
  let res
  try {
    res = archiveDirFor(kind, resolve(ROOT))
  } catch (e) {
    console.error('无法判定:' + String((e && e.message) || e).slice(0, 200))
    process.exit(2)
  }
  if (!res.path) {
    console.error(
      (res.cause === 'bad-arg' ? '参数错误:' : '判不出落点:') +
        res.reason +
        ' —— 不得据此回退到仓库内或网盘(§15b)',
    )
    process.exit(res.cause === 'bad-arg' ? 2 : 1)
  }
  process.stdout.write(res.path + '\n')
}

// §22d:被 import 时不得跑 main(它按结论 process.exit,会把调用方的进程一起带走)
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    // 工具自身异常 = "无法判定"(2),不得读成"没有落点"(1)或被裸栈顶掉退出码
    console.error(`无法判定(工具自身异常):${String((e && e.message) || e).slice(0, 300)}`)
    process.exit(2)
  }
}

export const __test__ = {
  archiveDirFor,
  KINDS,
  ROOT,
  RETENTION_LEDGER_REL,
  RETENTION_PROTECTED_PREFIXES,
  planArchiveRetention,
  applyArchiveRetention,
  appendRetentionLedger,
  runRetention,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
