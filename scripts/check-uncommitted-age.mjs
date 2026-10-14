#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-uncommitted-age.mjs — 未提交源码改动「年龄」守门(B14,2026-09-21 事故配套)
 *
 * 背景(2026-09-21 真实事故,同日两次):
 *   共享工作树里某会话执行了 `git checkout` / reset 类操作,把另一会话
 *   **已验证但尚未 commit** 的未提交改动整体还原 —— 一次要重做,一次连带丢失
 *   两条常驻防漂移测试。stash 侧早有 check-stale-stashes.mjs(guardian 第 30b 项)
 *   兜住「藏进 stash 失联」,但「留在工作树里没提交」这一整类**没有任何机制覆盖**。
 *
 * 防护目标:
 *   让「源码改动长时间停在未提交状态」变得可见 —— 工作树不是暂存区,任何一次
 *   并行的 checkout/reset/clean 都会把它整体抹掉,且不留痕迹。
 *
 * 判据(两个来源,同一把尺子):
 *   ① **工作树面**(B14 原维度):`git status --porcelain -z` 取已改动(tracked)+ 未跟踪新文件
 *      清单 → 逐个取 mtime → 存在**年龄 > 阈值(默认 45 分钟)的未提交源码文件**即判风险。
 *   ② **索引面**(2026-10-15 扩面):同一份 porcelain 里**第一列**为 `M/A/D/R/C`(且非 `??`)
 *      的条目 = "已暂存未提交"。候选口径(扩展名 + 豁免)与 ① 逐字共用 isCandidatePath,
 *      年龄判定与 ① 逐字共用 classifyByAge —— 变的只是"起始时刻"怎么取(见下方 INDEX AGE ORACLE)。
 *   源码扩展名:.ts .tsx .js .jsx .mjs .cjs .py .css .sql
 *
 * 索引年龄 ORACLE(git 索引**不记录条目级 stage 时刻**,已实测:索引 v4 条目只有
 *   ctime/mtime/size 等工作区 stat;`git reflog` 只记 HEAD 移动;`.husky/reference-transaction`
 *   的 commit-witness.log 刻意不带时间戳;`.husky/` 下没有 post-index-change)。
 *   所以年龄只能取**下界** = 三把尺子里"最晚的那一个时刻":
 *     - 工作区文件 mtime(内容落盘时刻,删除态取不到);
 *     - 该路径在 `.workbuddy/safe-commit-attestation.jsonl` 里最近一次**有 headBefore 而无
 *       landedSha** 的 ts(读侧唯一出口 lib/commit-attestation.mjs 的 readLedgerRecords;
 *       语义 = 那一轮 safe-commit 声明了这些文件但提交没落地 ⇒ 至少那一刻它已在飞);
 *     - 本门自建的 first-seen 台账 `.workbuddy/index-pending-first-seen.json`
 *       (key = 暂存 blob sha + 路径,sha 变了重计;条目从索引消失即回收 —— 台账必须有终态)。
 *   三把全空 ⇒ 返回 `{state:'undetermined', reason:'stage 时刻取不到'}`,**不记绿也不冒红**
 *   (形状照 scripts/git-guardian.mjs 的 shouldAlertAlignStall:阈值 CLI>env>默认、
 *   读不到 ⇒ 不喊但理由必须可见)。
 *
 * 输出卫生:只报「文件名 + 年龄 + 建议动作」,**绝不输出文件内容**
 *   (未提交改动里可能含密钥,.env* 亦在豁免清单内)。
 *
 * 豁免(口径与仓库既有守门一致,复用 scripts/lib/exclude-dirs.mjs):
 *   通用排除目录(node_modules / dist / .next / .turbo / 虚拟环境 …)
 *   + 本脚本追加:.ihui-agent、generated、tmp
 *   + 文件级:.env*、*.gen.<源码扩展名>
 *
 * 参数:
 *   --json               机器可读输出(单 JSON 对象)
 *   --threshold-min <n>  阈值分钟数,亦支持 --threshold-min=<n>
 *                        优先级 CLI > 环境变量 IHUI_UNCOMMITTED_AGE_MIN > 默认 45
 *   --strict             存在超龄文件时 exit 1(CI/手动审计用);默认 warn-only exit 0
 *   --self-test          跑内置用例(纯函数,不碰 git/文件系统)
 *
 * 退出码:
 *   0 — 通过,或(warn-only 模式下)仅告警
 *   1 — --strict 且存在超龄源码改动
 *   2 — 脚本自身异常
 *
 * 调用方:
 *   - scripts/guardian-runner.mjs 第 54 项(warn-only)
 *   - 手动:node scripts/check-uncommitted-age.mjs
 *
 * 关于 pre-commit 传入的 --staged(2026-10-15 改口径,原排除条款已被实测否证):
 *   原文写「已 staged 的内容已由 index 保住,不在本判据内」—— 前半句成立(索引确实保住了内容,
 *   不会被并行的 checkout/reset/clean 抹掉),**后半句被 2026-10-14 的事故否证**:索引里长期挂着
 *   4 条"已暂存未提交"(3 枚纯水印注入 + 1 枚活文档旧基线),没有任何门发现过它。
 *   "丢"和"烂"是两件事:staged 内容不会被抹掉,但会被忘记 —— 所以本判据现在**同时**判索引面。
 *   仍保持全量扫描工作树(hook 里不因 --staged 收窄 ①,否则又会把"未暂存工作树"那一整类放掉);
 *   两个来源在**每次运行都同时判**(全量档与 --staged 档同形):--staged 不再作为"跳过索引面"
 *   的排除开关,那正是本次要根治的那一格。门保持 warn 不升 blocking(§12e:索引里挂着别人的
 *   条目时,提交者在结构上无法满足"替别人删/提交",blocking 的唯一结局是逼人 --no-verify)。
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { withExcludes } from './lib/exclude-dirs.mjs'
// 索引面复用的两份**既有实现**(§22c 单一真相源,本门一律不另造判据):
//  · lib/commit-attestation.mjs —— 跳门/在飞留痕台账的读侧唯一出口(键名 schema 也只由它解释)
//  · check-stale-revert.mjs     —— "暂存/工作区内容等于某祖先版本"这门判据本体(门 30b)
import { readLedgerRecords } from './lib/commit-attestation.mjs'
import { Undetermined, gitRaw } from './lib/face-reader.mjs'
// first-seen 台账的九件出口一律来自 lib(本门不留第二份实现 —— §22c 单一真相源)。名字仍从本文件
// 出口面透出:镜像测试与 __test__ 都按原名字取用,不因搬家而改出口形状。
import {
  INDEX_PENDING_LEDGER_REL,
  INDEX_PENDING_LEDGER_VERSION,
  firstSeenKeyOf,
  indexPendingLedgerPath,
  parseIndexPendingLedger,
  pruneIndexPendingLedger,
  readIndexPendingLedger,
  serializeIndexPendingLedger,
  writeIndexPendingLedger,
} from './lib/index-pending-ledger.mjs'

export {
  INDEX_PENDING_LEDGER_REL,
  INDEX_PENDING_LEDGER_VERSION,
  firstSeenKeyOf,
  indexPendingLedgerPath,
  parseIndexPendingLedger,
  pruneIndexPendingLedger,
  readIndexPendingLedger,
  serializeIndexPendingLedger,
  writeIndexPendingLedger,
}
import { analyze as analyzeIndexRevert, resolveBlobs, MAX_FILES } from './check-stale-revert.mjs'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const DEFAULT_THRESHOLD_MIN = 45
export const THRESHOLD_ENV = 'IHUI_UNCOMMITTED_AGE_MIN'

/** 参与「未提交工作丢失」判定的源码扩展名 */
export const SOURCE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.css', '.sql',
])

/** 本脚本特有的排除目录(在共享 EXCLUDE_DIRS 基础上追加) */
export const EXCLUDED_DIRS = withExcludes(['.ihui-agent', 'generated', 'tmp'])

/** .env / .env.local / apps/api/.env.prod … —— 密钥载体,一律不参与判定也不输出内容 */
const DOTENV_RE = /(^|\/)\.env(\.|$)/
/** 生成物(*.gen.ts / *.gen.tsx / *.gen.css …):mtime 由生成器决定,不构成人为未提交工作 */
const GENERATED_FILE_RE = /\.gen\.(ts|tsx|js|jsx|mjs|cjs|py|css|sql)$/i

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

// ─── git 调用一律走 scripts/lib/face-reader.mjs 的 gitRaw(§5b 绝对路径 + safe.directory +
//     windowsHide + 显式 stdio 那套都在它里面;本门不再自带一份 GIT_BIN 解析 —— 守门 118:引了
//     取材层却自己派生 git = 半接线,这层看起来在用,判定面其实没换)────────────────────

/**
 * 只读 git,并**如实报成败**。
 * 旧出口只回文本、失败折成 '' —— 对 ① 无害(空清单 = 绿),但对 ② 不行:
 * "status 读失败"与"索引里没有悬留条目"在空字符串上长得一模一样,那正是 §0.3 禁的"把没判写成判过"。
 */
function runGitResult(args) {
  try {
    const text = gitRaw(args, ROOT, { timeout: 30_000, maxBuffer: 64 * 1024 * 1024 })
    return { ok: true, text: typeof text === 'string' ? text : String(text ?? ''), err: null }
  } catch (e) {
    // gitRaw 失败即抛 Undetermined;`git status` 的正常结论恒为 0(不像 git grep 无命中那样返 1),
    // 所以这里任何非零都是"没跑成"。退出码仍带进文本,排查时能分清 git 说没有与 git 没跑成。
    const st = typeof e?.status === 'number' ? ` (exit=${e.status})` : ''
    return { ok: false, text: '', err: `${String(e?.message ?? e).slice(0, 160)}${st}` }
  }
}

// 旧出口 `runGit(args)`(失败折成空文本)已整体并入 runGitResult —— 留一个"吞掉失败"的别名,
// 下一个调用点就会又把它当成"0 条改动"读(§0.3)。

// ─── 纯函数(§22c:测试直接 import,不复制实现) ────────────────────

/** 反斜杠归一为 POSIX 分隔符(git 本身输出 /,防御式归一) */
export function normalizePath(p) {
  return String(p).replace(/\\/g, '/')
}

/**
 * 解析 `git status --porcelain -z` 输出。
 * -z 记录以 NUL 分隔,格式 `XY <path>`;rename/copy 后紧跟一条 origin path(跳过)。
 * @returns {{path:string,status:string,untracked:boolean}[]}
 */
export function parsePorcelainZ(raw) {
  const parts = String(raw ?? '').split('\0')
  const out = []
  for (let i = 0; i < parts.length; i++) {
    const rec = parts[i]
    if (rec.length < 4) continue
    const xy = rec.slice(0, 2)
    const p = normalizePath(rec.slice(3))
    if (!p) continue
    out.push({ path: p, status: xy, untracked: xy === '??' })
    const isRename = xy[0] === 'R' || xy[0] === 'C' || xy[1] === 'R' || xy[1] === 'C'
    if (isRename) i++ // 下一条是 origin path,不是待判定对象
  }
  return out
}

/** 是否源码文件(按扩展名) */
export function isSourceFile(p) {
  const norm = normalizePath(p)
  const base = norm.slice(norm.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return false
  return SOURCE_EXTS.has(base.slice(dot).toLowerCase())
}

/** 是否命中豁免(目录段命中 EXCLUDED_DIRS / .env* / *.gen.*) */
export function isExemptPath(p, excludedDirs = EXCLUDED_DIRS) {
  const norm = normalizePath(p)
  if (DOTENV_RE.test(norm)) return true
  if (GENERATED_FILE_RE.test(norm)) return true
  const segs = norm.split('/')
  return segs.slice(0, -1).some((seg) => excludedDirs.has(seg))
}

/** 候选 = 源码文件 且 非豁免 且 非目录条目(目录条目以 / 结尾,由 walk 展开) */
export function isCandidatePath(p) {
  const norm = normalizePath(p)
  if (norm.endsWith('/')) return false
  return isSourceFile(norm) && !isExemptPath(norm)
}

/**
 * 把 porcelain 条目整理成待判定文件清单。
 * 未跟踪目录(`?? dir/`)在 porcelain 默认(-untracked-files=normal)下会被折叠,
 * 交由 listFilesInDir 展开;此处只保留文件条目并去重。
 */
export function collectCandidatePaths(entries, listFilesInDir) {
  const seen = new Set()
  for (const e of entries) {
    const norm = normalizePath(e.path)
    if (norm.endsWith('/')) {
      if (isExemptPath(norm + 'x')) continue
      // 二次过滤:注入的 listFilesInDir 若未筛(或直接返回原始 readdir 结果),
      // 也不得让非源码/豁免路径混进判定集。
      for (const f of listFilesInDir(norm)) {
        const child = normalizePath(f)
        if (isCandidatePath(child)) seen.add(child)
      }
      continue
    }
    if (isCandidatePath(norm)) seen.add(norm)
  }
  return [...seen].sort()
}

/** 阈值解析:CLI(--threshold-min n / --threshold-min=n)> env > 默认 */
export function resolveThresholdMin(argv, env) {
  const inline = argv.find((a) => a.startsWith('--threshold-min='))?.split('=')[1]
  const spacedIdx = argv.indexOf('--threshold-min')
  const spaced = spacedIdx >= 0 ? argv[spacedIdx + 1] : undefined
  const cliRaw = inline ?? spaced
  const envRaw = env?.[THRESHOLD_ENV]
  for (const raw of [cliRaw, envRaw]) {
    if (raw === undefined || raw === '') continue
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return n
  }
  return DEFAULT_THRESHOLD_MIN
}

/**
 * 核心判定(纯函数):给定带 mtime 的条目,算出扫描数与超龄数。
 * @param {{path:string,mtimeMs:number}[]} statables
 */
export function classifyByAge(statables, thresholdMin, now = Date.now()) {
  const thresholdMs = thresholdMin * 60_000
  const risky = []
  for (const s of statables) {
    if (!Number.isFinite(s.mtimeMs)) continue
    const ageMs = now - s.mtimeMs
    if (ageMs > thresholdMs) risky.push({ file: normalizePath(s.path), ageMs })
  }
  risky.sort((a, b) => b.ageMs - a.ageMs)
  return { scanned: statables.length, risky }
}

/** 人类可读年龄:<60min 用分钟,<48h 用小时,否则天 */
export function formatAge(ms) {
  const min = ms / 60_000
  if (min < 60) return `${Math.max(1, Math.round(min))} 分钟`
  const h = min / 60
  if (h < 48) return `${Math.round(h)} 小时`
  return `${(h / 24).toFixed(1)} 天`
}

// ─── 索引面(已暂存未提交):同一判据的第二个来源(2026-10-15 扩面) ───
//
// 这一族**不是另一道判据**:候选口径复用 isCandidatePath、阈值复用 resolveThresholdMin、
// 年龄复用 classifyByAge、清单复用 parsePorcelainZ —— 只有"起始时刻从哪来"是新的,
// 因为 git 索引压根不记条目级 stage 时刻(文件头注已实测列明)。

/** porcelain **第一列**(索引 vs HEAD)的这四个字母 = 该路径有一条目躺在索引里未提交 */
export const STAGED_INDEX_LETTERS = new Set(['M', 'A', 'D', 'R', 'C'])

/** first-seen 台账(schema/读写/回收)整体住在 scripts/lib/index-pending-ledger.mjs —— 与
 *  lib/commit-attestation.mjs 同构:键名形状只由那一处解释,门体不复制第二份。抽出去的另一个
 *  好处是本门不再自带 `readFileSync`:守门 118 据此把本门如实读成"不判仓库正文"(它判的是路径
 *  年龄与索引条目,本来就不是内容),而不是"引了取材层却自己读盘"那种半接线。 */

/** 台账条目恒含三把 oracle 的字段名(顺序即报告顺序,测试按同一清单核形状) */
export const STAGE_ORACLE_FIELDS = ['mtimeMs', 'attestMs', 'firstSeenMs']

/**
 * 索引面条目 = porcelain 第一列为 M/A/D/R/C 且非 `??`。
 * 只看 `entry.untracked`(第一列不可能是 `?`)与 `entry.status[0]`,复用 parsePorcelainZ 的输出。
 */
export function isStagedIndexEntry(entry) {
  if (!entry || typeof entry !== 'object') return false
  if (entry.untracked === true) return false
  const first = String(entry.status ?? '').slice(0, 1)
  return STAGED_INDEX_LETTERS.has(first)
}

/** 索引面候选清单(与 ① 共用 isCandidatePath:扩展名 + 豁免目录/文件级豁免) */
export function collectStagedCandidatePaths(entries) {
  const seen = new Set()
  for (const e of entries ?? []) {
    if (!isStagedIndexEntry(e)) continue
    const norm = normalizePath(e.path)
    if (isCandidatePath(norm)) seen.add(norm)
  }
  return [...seen].sort()
}

/**
 * 纯函数:从留痕台账(读侧唯一出口 lib/commit-attestation.mjs 的 readLedgerRecords 输出)
 * 里按路径收"**有 headBefore 而无 landedSha**"的最近一次 ts。
 * 有 landedSha = 那一轮真的落地了 ⇒ 不能当"仍在飞"的证据;
 * 无 headBefore = 连"哪一轮声明的"都绑不上 ⇒ 同样不构成证据。
 * @returns {Map<string,number>} 归一路径 → 最近一次在飞 ts(ms)
 */
export function indexInflightAttestations(records) {
  const byPath = new Map()
  for (const r of records ?? []) {
    if (!r || typeof r !== 'object') continue
    if (!r.headBefore || r.landedSha) continue
    if (!Number.isFinite(r.ms)) continue
    for (const f of r.declaredFiles ?? []) {
      const norm = normalizePath(f)
      const prev = byPath.get(norm)
      if (prev === undefined || r.ms > prev) byPath.set(norm, r.ms)
    }
  }
  return byPath
}

/**
 * 纯函数:年龄下界的"起始时刻" = 三把尺子里**最晚**的那一个(取 max ⇒ 算出的年龄是"确证悬了这么久"
 * 的下界;宁可少报,不可凭空定罪)。三把全空 ⇒ null(⇒ 调用方必须按"未判定"处理,不得折成 0)。
 */
export function resolveStageStartMs(oracle = {}) {
  const picks = []
  for (const k of STAGE_ORACLE_FIELDS) if (Number.isFinite(oracle[k])) picks.push(oracle[k])
  if (picks.length === 0) return null
  return Math.max(...picks)
}

/** 是哪把尺子给出了这个下界(报告里如实标来源;并列时全列) */
export function describeAgeSource(startMs, oracle = {}) {
  const hits = []
  if (oracle.mtimeMs === startMs) hits.push('工作区 mtime')
  if (oracle.attestMs === startMs) hits.push('在飞留痕 attestation')
  if (oracle.firstSeenMs === startMs) hits.push('本门 first-seen 台账')
  return hits.length ? hits.join(' + ') : '无(起始时刻未取到)'
}

/**
 * 纯函数核心(索引面):给定候选 + 三把 oracle + 阈值,产出「超龄 / 未判定」两堆。
 * 年龄一刀仍走 classifyByAge(§22c) —— 这里只是把它的 mtimeMs 换成"确证下界"。
 * oracle 齐备却一条不超龄 = 绿;oracle 全空 = **未判定**,既不计绿也不计红。
 */
export function evaluateIndexFace({ paths, oracles, thresholdMin, now = Date.now() }) {
  const statables = []
  const undetermined = []
  for (const raw of paths ?? []) {
    const p = normalizePath(raw)
    const o = oracles?.get?.(p) ?? {}
    const startMs = resolveStageStartMs(o)
    if (startMs === null) {
      undetermined.push({
        file: p,
        state: 'undetermined',
        reason: 'stage 时刻取不到',
        oracle: { mtimeMs: null, attestMs: null, firstSeenMs: null },
        ancestorEqual: o.ancestorEqual ?? { state: 'undetermined', reason: '祖先比对未执行' },
      })
      continue
    }
    statables.push({ path: p, mtimeMs: startMs })
  }
  const { scanned, risky } = classifyByAge(statables, thresholdMin, now)
  const startByFile = new Map(statables.map((s) => [normalizePath(s.path), s.mtimeMs]))
  const detailed = risky.map((r) => {
    const o = oracles.get(r.file) ?? {}
    const startMs = startByFile.get(r.file) ?? null
    return {
      file: r.file,
      ageMs: r.ageMs,
      startMs,
      ageSource: describeAgeSource(startMs, o),
      attestMs: Number.isFinite(o.attestMs) ? o.attestMs : null,
      firstSeenMs: Number.isFinite(o.firstSeenMs) ? o.firstSeenMs : null,
      stagedBlob: typeof o.stagedBlob === 'string' ? o.stagedBlob : null,
      ancestorEqual: o.ancestorEqual ?? { state: 'undetermined', reason: '祖先比对未执行' },
    }
  })
  // 阈值内但同样"量得到年龄"的条目也要如实报数,否则"2 条待判定"会被读成"2 条超龄"或"0 条"
  const fresh = statables.length - detailed.length
  return { scanned, risky: detailed, undetermined, fresh }
}

/**
 * 纯函数:一条超龄索引条目的**可整改出口**(§5e-1:收信人读了知道该干什么)。
 * 分流规则(本次事故的另一半:那一格里挂着的就是"活文档旧基线"):
 *   · `lagging-ancestor`(暂存 blob == 某祖先版本)**绝不建议"提交它"** —— 那等于把别人
 *     已合并的成果写回旧态,提交链上的门 30b `check-stale-revert.mjs` 正是为此而红;
 *     正确出路是把索引按 HEAD 对齐(只动索引、不动工作树,免得替别人删未提交内容),
 *     并说明"该 blob 已在历史里,可无损取回"。
 *   · `undetermined`(祖先比对没做成)⇒ 先复核再决定,不得默认"提交它"是安全的。
 * @returns {string[]} 逐行出口(第一行恒为动作,其余为取证/警告)
 */
export function indexExitLines(item = {}) {
  const file = normalizePath(item.file ?? '?')
  const st = item.ancestorEqual?.state ?? 'undetermined'
  if (st === 'lagging-ancestor') {
    const blobHint = item.stagedBlob ? `git cat-file -p ${item.stagedBlob}` : '(暂存 blob sha 未取到)'
    return [
      `出口:按 HEAD 对齐索引(只动索引、不动工作树):git restore --staged -- ${file}`,
      `     这一型**不许提交它** —— 暂存 blob 等于祖先提交 ${item.ancestorEqual.commit ?? '(未点名)'} 的版本,` +
        '提交 = 把别人的合并成果写回旧态(门 30b check-stale-revert.mjs 判红)',
      `     该 blob 已在历史里,可无损取回:git show <上述祖先提交>:${file} / ${blobHint}`,
    ]
  }
  if (st === 'undetermined') {
    return [
      `出口:先复核形态再决定 —— node scripts/check-stale-revert.mjs --staged(祖先比对本轮未判定:${item.ancestorEqual?.reason ?? '未知'})`,
      `     复核确认是真新内容才提交:node scripts/safe-commit.mjs -m "<本次改动说明>" -- ${file}`,
      `     复核确认等于某祖先版本则**不要提交**:git restore --staged -- ${file}`,
    ]
  }
  if (st === 'deleted') {
    return [
      `出口:确认这条**删除**是本意,再提交:node scripts/safe-commit.mjs -m "<说明本次删除>" -- ${file}`,
      `     不是本意 ⇒ 先把它从索引里摘回(只动索引、不动工作树):git restore --staged -- ${file}`,
      '     删除类改动一旦提交就进历史,别让它烂在索引里等下一次被顺手带上(§7 删除三问)',
    ]
  }
  if (st === 'same-as-head') {
    return [
      `出口:索引内容与 HEAD 逐字相同 ⇒ 这条目只是挂在暂存清单里,git restore --staged -- ${file} 即可摘除`,
    ]
  }
  return [`出口:node scripts/safe-commit.mjs -m "<本次改动说明>" -- ${file}`]
}

/** 一条索引条目的取证行(措辞照 check-stale-stashes.mjs:时长 + 清单 + 逐条明细,不输出内容) */
export function indexEvidenceLine(item = {}) {
  const anc = item.ancestorEqual ?? {}
  const ancText =
    anc.state === 'lagging-ancestor'
      ? `暂存 blob == 祖先版本 ${anc.commit ?? '?'}`
      : anc.state === 'deleted'
        ? '索引条目已删(删除态,无暂存 blob 可比形态)'
        : anc.state === 'same-as-head'
          ? '暂存 blob == HEAD'
          : anc.state === 'novel'
            ? '暂存 blob ≠ 任何已读祖先版本'
            : `祖先比对未判定(${anc.reason ?? '未执行'})`
  const att = Number.isFinite(item.attestMs) ? new Date(item.attestMs).toISOString() : '无在飞留痕'
  const fs = Number.isFinite(item.firstSeenMs) ? new Date(item.firstSeenMs).toISOString() : '本轮首次观测'
  return `悬留下界 ${formatAge(item.ageMs ?? 0)}(来源:${item.ageSource ?? '?'})| ${ancText} | 最近一次在飞留痕 ${att} | first-seen ${fs}`
}

/**
 * 索引面装配(有副作用:读 git/文件系统/台账;全部以显式 root 为锚,测试据此用 scratch 夹具,
 * 绝不在真仓索引面上做写)。`entries` 由调用方把**同一次** `git status --porcelain -z` 的解析
 * 结果传进来 —— 两个来源必须同轮同清单,不得各读一次 status(那会拿到两面不一致的索引快照)。
 */
export function runIndexFace({ root = ROOT, entries, thresholdMin, now = Date.now() } = {}) {
  const stagedEntries = (entries ?? []).filter(isStagedIndexEntry)
  const paths = collectStagedCandidatePaths(stagedEntries)
  const ledger = readIndexPendingLedger(root)
  const observed = new Set()

  if (paths.length === 0) {
    // 空索引面也要走回收,否则台账只进不出
    const { entries: kept, recycled } = pruneIndexPendingLedger(ledger.entries, observed)
    let writeBack = { ok: true, skipped: true }
    if (recycled.length > 0) writeBack = writeIndexPendingLedger(kept, root, new Date(now).toISOString())
    return {
      status: paths.length === 0 ? 'empty' : 'judged',
      scanned: 0,
      risky: [],
      undetermined: [],
      fresh: 0,
      stagedTotal: stagedEntries.length,
      ledgerState: ledger.state,
      ledgerWhy: ledger.why,
      recycled,
      writeBack,
      blobRead: 'not-needed',
      ancestorRead: 'not-needed',
    }
  }

  // 1) 暂存 blob sha(台账 key 的一半)+ 与 HEAD 的一致性(报告里"等于某祖先版本"那一维的输入)
  let blobMap = null
  let blobRead = 'ok'
  try {
    blobMap = resolveBlobs(root, paths.flatMap((p) => [`:${p}`, `HEAD:${p}`]))
  } catch (e) {
    blobRead = e instanceof Undetermined ? 'undetermined' : `error:${String(e?.message ?? e).slice(0, 120)}`
  }

  // 2) "陈旧回写"判定复用 check-stale-revert 的 analyze(§22c:同一把判据,不在本门重写)
  let ancestorByPath = null
  let ancestorRead = 'ok'
  const windowLoss = []
  if (paths.length > MAX_FILES) {
    ancestorRead = `not-judged(候选 ${paths.length} > 上限 ${MAX_FILES},与门 30b 同一护栏)`
  } else {
    try {
      const viol = analyzeIndexRevert(root, paths, { source: 'index', windowLoss })
      ancestorByPath = new Map(viol.map((v) => [normalizePath(v.path), v.commit]))
    } catch (e) {
      ancestorRead =
        e instanceof Undetermined
          ? `undetermined(${String(e?.message ?? e).slice(0, 120)})`
          : `error:${String(e?.message ?? e).slice(0, 120)}`
    }
  }
  const windowLossSet = new Map(windowLoss.map((w) => [normalizePath(w.path), w]))

  // 3) 在飞留痕(读侧唯一出口 readLedgerRecords;读不到 ⇒ 少一把尺子,必须在报告里可见)
  let attestMap = new Map()
  const attestLedger = readLedgerRecords(root)
  const attestNote = attestLedger.ok
    ? attestLedger.badLines.length > 0
      ? `台账 ${attestLedger.badLines.length} 行解不出(不计入证据)`
      : null
    : `attestation ${attestLedger.state}:${attestLedger.why}`
  if (attestLedger.ok) attestMap = indexInflightAttestations(attestLedger.records)

  // 4) 三把 oracle
  const oracles = new Map()
  for (const p of paths) {
    const blob = blobMap ? (blobMap.get(`:${p}`) ?? null) : undefined
    const headBlob = blobMap ? blobMap.get(`HEAD:${p}`) : undefined
    // blob 取不到那一轮**不进 observed**:否则"无法定位 key"会被当成"条目已消失",
    // 把别人攒下的 first-seen 时刻误回收(失效方向必须是少说,不是抹掉证据)。
    if (blobRead === 'ok') observed.add(firstSeenKeyOf(p, blob))
    let ancestorEqual
    if (ancestorByPath === null) {
      ancestorEqual = { state: 'undetermined', reason: ancestorRead }
    } else if (windowLossSet.has(p)) {
      const w = windowLossSet.get(p)
      ancestorEqual = { state: 'undetermined', reason: `祖先窗口 ${w.window} 枚已用尽仍未命中(没抓到 ≠ 没有回写)` }
    } else if (ancestorByPath.has(p)) {
      ancestorEqual = { state: 'lagging-ancestor', commit: ancestorByPath.get(p) }
    } else if (blob === null) {
      // 索引里没有该路径的条目 = 删除态:没有 blob 可比,不能冒充"≠ 任何祖先版本"
      ancestorEqual = { state: 'deleted' }
    } else if (blob !== undefined && blob === headBlob) {
      ancestorEqual = { state: 'same-as-head' }
    } else {
      ancestorEqual = { state: 'novel' }
    }
    oracles.set(p, {
      mtimeMs: mtimeMsOf(p, root),
      attestMs: attestMap.get(p) ?? null,
      firstSeenMs: blobRead === 'ok' ? (ledger.entries.get(firstSeenKeyOf(p, blob))?.firstSeenMs ?? null) : null,
      stagedBlob: blob === undefined ? null : blob,
      ancestorEqual,
    })
  }

  const verdict = evaluateIndexFace({ paths, oracles, thresholdMin, now })

  // 5) first-seen 台账:本轮观测到的条目盖时刻(首次观测 ⇒ now),消失的 ⇒ 回收。
  //    ⚠️ 暂存 blob 取材失败那一轮**整层冻结**:key 的 sha 那一半取不到 ⇒ observed 为空 ⇒
  //    照常回收会把别人攒下的 first-seen 时刻整个抹掉(失效方向必须是"少说",不是"毁证据")。
  let kept = ledger.entries
  let recycled = []
  let stamped = 0
  let writeBack = { ok: true, skipped: true }
  if (blobRead === 'ok') {
    const pruned = pruneIndexPendingLedger(ledger.entries, observed)
    kept = pruned.entries
    recycled = pruned.recycled
    for (const p of paths) {
      const blob = blobMap.get(`:${p}`) ?? null
      const k = firstSeenKeyOf(p, blob)
      if (!kept.has(k)) {
        kept.set(k, { firstSeenMs: now, path: p, blob: blob ?? 'no-blob' })
        stamped++
      }
    }
    const mustWrite = stamped > 0 || recycled.length > 0 || ledger.state === 'missing' || ledger.state === 'bad-json'
    if (mustWrite) writeBack = writeIndexPendingLedger(kept, root, new Date(now).toISOString())
  } else {
    writeBack = { ok: true, skipped: true, why: `暂存 blob 取材未成功(${blobRead})⇒ 台账本轮冻结:不盖时刻也不回收` }
  }

  return {
    status: 'judged',
    scanned: verdict.scanned,
    risky: verdict.risky,
    undetermined: verdict.undetermined,
    fresh: verdict.fresh,
    stagedTotal: stagedEntries.length,
    ledgerState: ledger.state,
    ledgerWhy: ledger.why,
    ledgerPath: indexPendingLedgerPath(root),
    stamped,
    recycled,
    writeBack,
    blobRead,
    ancestorRead,
    attestNote,
  }
}


// ─── 文件系统侧(仅 CLI 路径使用) ────────────────────────────────

/** 展开未跟踪目录里的候选源码文件(受限递归,防意外深/大目录) */
function walkUntrackedDir(relDir) {
  const files = []
  const abs = join(ROOT, relDir)
  const stack = [{ abs, rel: normalizePath(relDir) }]
  let budget = 5_000
  while (stack.length && budget > 0) {
    const cur = stack.pop()
    let names
    try {
      names = readdirSync(cur.abs)
    } catch {
      continue
    }
    for (const name of names) {
      if (budget-- <= 0) return files
      const childAbs = join(cur.abs, name)
      const childRel = `${cur.rel}${cur.rel.endsWith('/') ? '' : '/'}${name}`
      let st
      try {
        st = statSync(childAbs)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        if (isExemptPath(childRel + '/x')) continue
        stack.push({ abs: childAbs, rel: childRel })
        continue
      }
      if (isCandidatePath(childRel)) files.push(childRel)
    }
  }
  return files
}

function mtimeMsOf(relPath, root = ROOT) {
  try {
    return statSync(join(root, relPath)).mtimeMs
  } catch {
    return Number.NaN
  }
}

// ─── 自检(§self-test:纯函数用例,不依赖 git / 文件系统) ──────────
export function runSelfTest() {
  const results = []
  const now = 1_700_000_000_000
  const ok = (name, cond, extra = '') => results.push({ name, pass: !!cond, extra })
  const stat = (file, ageMin) => ({ path: file, mtimeMs: now - ageMin * 60_000 })

  // 1) 无改动 = pass
  const none = parsePorcelainZ('')
  ok('无改动:porcelain 解析为空', none.length === 0)
  ok('无改动:判定 pass', classifyByAge([], 45, now).risky.length === 0)

  // 2) 新改动 = pass(阈值内)
  const fresh = classifyByAge([stat('apps/web/src/a.ts', 10)], 45, now)
  ok('新改动(10 分钟):不报', fresh.risky.length === 0 && fresh.scanned === 1)

  // 3) 老改动 = fail(超阈值)
  const old = classifyByAge([stat('apps/api/src/routes/x.ts', 120)], 45, now)
  ok('老改动(2 小时):报出', old.risky.length === 1 && old.risky[0].file === 'apps/api/src/routes/x.ts')
  ok('老改动:年龄可读', old.risky[0].ageMs === 120 * 60_000)
  ok('阈值边界:恰好等于阈值不报(严格大于)', classifyByAge([stat('a.ts', 45)], 45, now).risky.length === 0)

  // 4) 豁免目录「不该被报」= fail 不成立
  const exempt = [
    '.ihui-agent/tmp/probe/old-probe.ts',
    'node_modules/pkg/index.ts',
    'apps/web/dist/old.js',
    'apps/web/.next/static/chunk.ts',
    'packages/i18n/generated/remote-locales.gen.ts',
    'apps/api/.env.local',
    'docs/notes.md',
    'node_modules/pkg/dist/a.js',
  ]
  const kept = exempt.filter(isCandidatePath)
  ok('豁免清单:目录/生成物/env/非源码全部不进入判定', kept.length === 0, kept.join(','))
  // 端到端:过滤发生在收集层而非年龄层 —— 豁免文件即便超龄也不会被报出。
  const piped = classifyByAge(
    collectCandidatePaths(
      exempt.map((f) => ({ path: f, status: ' M', untracked: false })),
      () => [],
    ).map((f) => stat(f, 600)),
    45,
    now,
  )
  ok('端到端:豁免路径经收集层后不报(即便年龄超阈)', piped.risky.length === 0 && piped.scanned === 0)
  ok('非豁免:scripts/legacy.cjs 属源码候选(不得被目录口径误伤)', isCandidatePath('scripts/legacy.cjs') === true)
  ok('豁免:.ihui-agent 命中目录豁免', isExemptPath('.ihui-agent/tmp/a.ts') === true)
  ok('豁免:generated 与 *.gen.ts 双重命中', isExemptPath('p/generated/x.ts') && isExemptPath('p/x.gen.ts'))
  ok('豁免:.env* 命中', isExemptPath('apps/api/.env') && isExemptPath('.env.production'))
  ok('非豁免:普通源码文件不误豁免', isCandidatePath('apps/api/src/main.ts') && isCandidatePath('app/styles/globals.css'))

  // 5) porcelain 解析细节
  const parsed = parsePorcelainZ(' M apps/web/src/a.ts\0?? scripts/new.mjs\0R  apps/new.ts\0apps/old.ts\0')
  ok('解析:modified + untracked + rename', parsed.length === 3 && parsed[2].path === 'apps/new.ts', JSON.stringify(parsed.map((p) => p.path)))
  ok('解析:rename 的 origin path 被跳过', !parsed.some((p) => p.path === 'apps/old.ts'))
  ok('解析:untracked 标记正确', parsed[1].untracked === true && parsed[0].untracked === false)
  ok('解析:反斜杠归一', parsePorcelainZ(' M apps\\web\\b.ts\0')[0].path === 'apps/web/b.ts')

  // 6) 未跟踪目录展开走 collectCandidatePaths
  const expanded = collectCandidatePaths(
    [{ path: 'scripts/probe/', status: '??', untracked: true }, { path: 'a.ts', status: ' M', untracked: false }],
    () => ['scripts/probe/old.ts', 'scripts/probe/readme.md'],
  )
  ok('展开:未跟踪目录内源码文件被纳入', expanded.join(',') === 'a.ts,scripts/probe/old.ts', expanded.join(','))
  ok('展开:目录内豁免路径不落单', collectCandidatePaths([{ path: 'node_modules/x/', status: '??' }], () => ['node_modules/x/a.ts']).length === 0)

  // 7) 阈值解析优先级
  ok('阈值:默认 45', resolveThresholdMin([], {}) === DEFAULT_THRESHOLD_MIN)
  ok('阈值:env 覆盖', resolveThresholdMin([], { [THRESHOLD_ENV]: '10' }) === 10)
  ok('阈值:CLI 等号形式优先于 env', resolveThresholdMin(['--threshold-min=5'], { [THRESHOLD_ENV]: '10' }) === 5)
  ok('阈值:CLI 空格形式', resolveThresholdMin(['--threshold-min', '7'], {}) === 7)
  ok('阈值:非法值回落默认', resolveThresholdMin(['--threshold-min=abc'], { [THRESHOLD_ENV]: '-1' }) === DEFAULT_THRESHOLD_MIN)

  // 8) 排序:最老的排前面(报告可读性)
  const sorted = classifyByAge([stat('new.ts', 50), stat('oldest.ts', 500), stat('mid.ts', 100)], 45, now)
  ok('排序:按年龄降序', sorted.risky.map((r) => r.file).join(',') === 'oldest.ts,mid.ts,new.ts')

  // 9) 年龄可读性
  ok('格式:分钟档', /分钟$/.test(formatAge(20 * 60_000)))
  ok('格式:小时档', /小时$/.test(formatAge(5 * 3_600_000)))
  ok('格式:天档', /天$/.test(formatAge(3 * 86_400_000)))

  // ── 索引面(2026-10-15 扩面)──
  const idx = (path, xy) => ({ path, status: xy, untracked: xy === '??' })
  const oracleMap = (rows) => new Map(rows.map(([p, o]) => [p, o]))

  // 10) 第一列口径:M/A/D/R/C 算索引面;' M'(仅工作树改动)、?? 不算
  const mixed = parsePorcelainZ(
    ['M  staged-mod.ts\0', 'A  staged-new.ts\0', 'D  staged-del.ts\0', 'R  renamed.ts\0old-name.ts\0',
     ' M worktree-only.ts\0', '?? untracked.ts\0', 'MM both-face.ts\0', ' M README.md\0'].join(''),
  )
  const stagedOnly = mixed.filter(isStagedIndexEntry)
  ok('索引面:第一列 M/A/D/R/C 入选," M"/"??" 不入选',
    stagedOnly.map((e) => e.path).join(',') === 'staged-mod.ts,staged-new.ts,staged-del.ts,renamed.ts,both-face.ts',
    stagedOnly.map((e) => e.path).join(','))
  ok('索引面:MM(两面都改)同样入选 —— 索引里那条也会被忘记',
    stagedOnly.some((e) => e.path === 'both-face.ts'))
  ok('索引面:rename 的 origin path 仍被 parsePorcelainZ 跳过(不重复计入)',
    !stagedOnly.some((e) => e.path === 'old-name.ts'))
  ok('索引面:候选口径复用 isCandidatePath(非源码/豁免目录不入选)',
    collectStagedCandidatePaths([idx('docs/a.md', 'A '), idx('node_modules/x/y.ts', 'M '), idx('src/real.ts', 'M ')])
      .join(',') === 'src/real.ts')

  // 11) oracle 下界 = 三把尺子里最晚的那一个;全空 ⇒ null(不得折成 0)
  ok('oracle:三把全空 ⇒ null(未判定,不冒充 0 分钟)',
    resolveStageStartMs({ mtimeMs: Number.NaN, attestMs: null, firstSeenMs: null }) === null)
  ok('oracle:取 max 作下界(宁少报不凭空定罪)',
    resolveStageStartMs({ mtimeMs: now - 600_000, attestMs: now - 3_600_000, firstSeenMs: now - 60_000 }) === now - 60_000)
  ok('oracle:单把尺子可用即用(mtime 缺席的删除态靠 attestation)',
    resolveStageStartMs({ mtimeMs: Number.NaN, attestMs: now - 7_200_000, firstSeenMs: null }) === now - 7_200_000)
  ok('oracle:来源标注点名是哪把尺子',
    describeAgeSource(resolveStageStartMs({ mtimeMs: now - 600_000, attestMs: now - 60_000, firstSeenMs: null }),
      { mtimeMs: now - 600_000, attestMs: now - 60_000, firstSeenMs: null }) === '在飞留痕 attestation')

  // 12) attestation 只认"有 headBefore 而无 landedSha"
  const inflight = indexInflightAttestations([
    { ms: now - 3_600_000, headBefore: 'a'.repeat(40), landedSha: '', declaredFiles: ['p/in.ts'] },
    { ms: now - 60_000, headBefore: 'b'.repeat(40), landedSha: 'c'.repeat(40), declaredFiles: ['p/landed.ts'] },
    { ms: now - 120_000, headBefore: '', landedSha: '', declaredFiles: ['p/no-head.ts'] },
    { ms: now - 7_200_000, headBefore: 'd'.repeat(40), landedSha: '', declaredFiles: ['p/in.ts', 'p/other.ts'] },
    { ms: null, headBefore: 'e'.repeat(40), landedSha: '', declaredFiles: ['p/bad-ts.ts'] },
  ])
  ok('attestation:已落地(有 landedSha)那一轮不构成"仍在飞"的证据', !inflight.has('p/landed.ts'))
  ok('attestation:绑不上 headBefore 的行不构成证据', !inflight.has('p/no-head.ts'))
  ok('attestation:ts 不可读的行不构成证据', !inflight.has('p/bad-ts.ts'))
  ok('attestation:同路径取最近一次(而非最早)', inflight.get('p/in.ts') === now - 3_600_000)
  ok('attestation:declaredFiles 多路径逐条登记', inflight.get('p/other.ts') === now - 7_200_000)

  // 13) 台账形状 / 坏 JSON / key 随 sha 变色 / 回收
  const k1 = firstSeenKeyOf('src/a.ts', 'f'.repeat(40))
  ok('台账 key:路径 + 暂存 blob sha(sha 变了即换 key ⇒ 年龄重计)',
    k1 !== firstSeenKeyOf('src/a.ts', 'e'.repeat(40)) && firstSeenKeyOf('src/a.ts', null) === `no-blob|src/a.ts`)
  const ser0 = serializeIndexPendingLedger(
    new Map([[k1, { firstSeenMs: now - 9_000_000, path: 'src/a.ts', blob: 'f'.repeat(40) }]]),
    '2026-01-01T00:00:00.000Z',
  )
  const ser = parseIndexPendingLedger(ser0)
  ok('台账:写→读 round-trip 保真(键与时刻都不丢)',
    ser.state === 'read' && ser.entries.get(k1)?.firstSeenMs === now - 9_000_000 && ser.entries.get(k1)?.path === 'src/a.ts', ser.state)
  ok('台账:坏 JSON ⇒ state=bad-json 且当空台账重新开始(不抛、不冒充"没有悬留")',
    parseIndexPendingLedger('{ 这不是 JSON').state === 'bad-json' && parseIndexPendingLedger('{ 这不是 JSON').entries.size === 0)
  ok('台账:顶层缺 entries ⇒ bad-json(不是"空台账=绿")', parseIndexPendingLedger('{"version":1}').state === 'bad-json')
  ok('台账:firstSeenMs 不可读的条目被剔出但保留其余',
    parseIndexPendingLedger('{"entries":{"a":{"firstSeenMs":"x"},"b":{"firstSeenMs":123}}}').entries.size === 1)
  const pruned = pruneIndexPendingLedger(
    new Map([
      [k1, { firstSeenMs: now, path: 'src/a.ts', blob: 'f'.repeat(40) }],
      ['gone|src/b.ts', { firstSeenMs: now, path: 'src/b.ts', blob: 'gone' }],
    ]),
    new Set([k1]),
  )
  ok('台账有终态:索引里消失的 key 被回收(不得无限增长)',
    pruned.entries.size === 1 && pruned.recycled.join(',') === 'gone|src/b.ts', pruned.recycled.join(','))

  // 14) 索引面核心判定:超龄必点名 / 新鲜不报 / 量不到 ⇒ 未判定
  const e14 = evaluateIndexFace({
    paths: ['src/old.ts', 'src/fresh.ts', 'src/nostart.ts'],
    oracles: oracleMap([
      ['src/old.ts', { mtimeMs: now - 120 * 60_000, attestMs: now - 100 * 60_000, firstSeenMs: now - 110 * 60_000, stagedBlob: 'a'.repeat(40), ancestorEqual: { state: 'lagging-ancestor', commit: 'deadbeef1' } }],
      ['src/fresh.ts', { mtimeMs: now - 10 * 60_000, attestMs: null, firstSeenMs: null }],
      ['src/nostart.ts', { mtimeMs: Number.NaN, attestMs: null, firstSeenMs: null }],
    ]),
    thresholdMin: 45,
    now,
  })
  ok('索引面:超龄条目必报且点名路径', e14.risky.length === 1 && e14.risky[0].file === 'src/old.ts', JSON.stringify(e14.risky.map((r) => r.file)))
  ok('索引面:报出的年龄 = 下界年龄(取最晚那把尺子)', e14.risky[0].ageMs === 100 * 60_000)
  ok('索引面:新鲜条目不报但如实计数(不得读成 0 条待判定)', e14.fresh === 1 && e14.scanned === 2)
  ok('索引面:量不到 stage 时刻 ⇒ undetermined 且不记红也不记绿',
    e14.undetermined.length === 1 && e14.undetermined[0].state === 'undetermined' &&
      e14.undetermined[0].reason === 'stage 时刻取不到' && !e14.risky.some((r) => r.file === 'src/nostart.ts'))
  ok('索引面:明细带"是否等于祖先版本"与最近一次 attestation(报告可整改性输入)',
    e14.risky[0].ancestorEqual.state === 'lagging-ancestor' && e14.risky[0].attestMs === now - 100 * 60_000)

  // 15) 阈值 A/B 正向对照:0 ⇒ 索引面全翻红;极大 ⇒ 全绿(照 check-stale-stashes 的窗口设 0 那套)
  const abPaths = ['src/a.ts', 'src/b.ts']
  const abOracles = oracleMap([
    ['src/a.ts', { mtimeMs: now - 60 * 60_000, attestMs: null, firstSeenMs: null }],
    ['src/b.ts', { mtimeMs: now - 5 * 60 * 60_000, attestMs: null, firstSeenMs: null }],
  ])
  ok('索引面阈值 A:threshold 0 ⇒ 全部超龄(判据确实吃阈值,不是恒绿)',
    evaluateIndexFace({ paths: abPaths, oracles: abOracles, thresholdMin: 0, now }).risky.length === 2)
  ok('索引面阈值 B:threshold 极大 ⇒ 一条也不报(判据也不是恒红)',
    evaluateIndexFace({ paths: abPaths, oracles: abOracles, thresholdMin: 10_000_000, now }).risky.length === 0)

  // 16) 祖先那一型不许建议"提交它"(出口必须分流)
  ok('出口分流:等于祖先版本 ⇒ 给"按 HEAD 对齐",不给 safe-commit 提交建议',
    indexExitLines({ file: 'src/a.ts', ancestorEqual: { state: 'lagging-ancestor', commit: 'deadbeef1' } })
      .join('\n').includes('git restore --staged --') &&
      !indexExitLines({ file: 'src/a.ts', ancestorEqual: { state: 'lagging-ancestor', commit: 'deadbeef1' } })
        .join('\n').includes('safe-commit.mjs'))
  ok('出口分流:真新内容 ⇒ 给 safe-commit 提交建议',
    indexExitLines({ file: 'src/a.ts', ancestorEqual: { state: 'novel' } }).join('\n').includes('safe-commit.mjs'))

  return results
}

// ─── 报告输出 ───────────────────────────────────────────────────
/** 索引面的取材缺口必须逐条点名(§0.3:取不到输入 ⇒ 写"未判定",绝不静默记绿) */
function printIndexFaceDiagnostics(indexFace) {
  if (!indexFace) return
  if (indexFace.statusRead && indexFace.statusRead !== 'ok') {
    console.log(`  ${C.dim}❔ 索引面取材:${indexFace.statusRead} ⇒ 本轮"没有悬留"这一结论不成立${C.reset}`)
  }
  if (indexFace.attestNote) {
    console.log(`  ${C.dim}❔ 在飞留痕那一把尺子:${indexFace.attestNote}${C.reset}`)
  }
  if (indexFace.status !== 'empty' && indexFace.ancestorRead && indexFace.ancestorRead !== 'ok') {
    console.log(`  ${C.dim}❔ 祖先比对(复用门 30b 判据):${indexFace.ancestorRead}(形态那一维未判定)${C.reset}`)
  }
  if (indexFace.status !== 'empty' && indexFace.blobRead && indexFace.blobRead !== 'ok') {
    console.log(`  ${C.dim}❔ 暂存 blob 取材:${indexFace.blobRead} ⇒ first-seen 台账本轮冻结(键需要 sha)${C.reset}`)
  }
  if (indexFace.writeBack && indexFace.writeBack.ok === false) {
    console.log(`  ${C.yellow}⚠️ first-seen 台账未写入:${indexFace.writeBack.why}(不阻塞,但下一轮年龄只能另找尺子)${C.reset}`)
  } else if (indexFace.writeBack && indexFace.writeBack.why) {
    console.log(`  ${C.dim}ℹ️ first-seen 台账:${indexFace.writeBack.why}${C.reset}`)
  }
}

function printReport({ thresholdMin, risky, scanned, strict, indexFace }) {
  const idxRisky = indexFace?.risky ?? []
  const idxUndet = indexFace?.undetermined ?? []
  // 同一路径在两个面里的形态必须互相引用(否则 ① 会建议"提交它"、② 说"别提交",报告自相矛盾)
  const indexAncestorByFile = new Map(idxRisky.map((r) => [normalizePath(r.file), r.ancestorEqual?.state]))
  const clean = risky.length === 0 && idxRisky.length === 0
  if (clean) {
    const idxNote =
      indexFace && indexFace.status === 'empty'
        ? ',索引面无已暂存未提交的源码条目'
        : indexFace
          ? `,索引面 ${indexFace.scanned ?? 0} 条悬留均在阈值内(${idxUndet.length} 条量不到时刻)`
          : ''
    console.log(
      `${C.green}✅ 未提交改动年龄守门:${scanned} 个源码改动均在 ${thresholdMin} 分钟内${idxNote}(或无源码改动)${C.reset}`,
    )
    for (const u of idxUndet) {
      console.log(`  ${C.dim}❔ 未判定:${u.file} —— ${u.reason}(既不记绿也不记红)${C.reset}`)
    }
    printIndexFaceDiagnostics(indexFace)
    return
  }
  console.log(`${C.yellow}${C.bold}⏳ 未提交源码改动守门(B14,2026-09-21 事故配套;2026-10-15 扩索引面)${C.reset}`)
  console.log(
    `  ${C.dim}阈值 ${thresholdMin} 分钟 | 工作树面:待判定 ${scanned} / 超龄 ${risky.length} | 索引面(已暂存未提交):待判定 ${indexFace?.scanned ?? 0} / 超龄 ${idxRisky.length} / 未判定 ${idxUndet.length}${C.reset}`,
  )
  printIndexFaceDiagnostics(indexFace)

  for (const r of idxRisky.slice(0, 20)) {
    console.log(`  ${C.red}📌 ${C.bold}${r.file}${C.reset}${C.red} 已暂存未提交,${C.bold}${indexEvidenceLine(r)}${C.reset}`)
    for (const line of indexExitLines(r)) {
      console.log(`     ${C.cyan}${line}${C.reset}`)
    }
  }
  if (idxRisky.length > 20) {
    console.log(`  ${C.dim}…另有 ${idxRisky.length - 20} 条超龄索引条目(全量见 --json)${C.reset}`)
  }
  for (const u of idxUndet) {
    console.log(`  ${C.dim}❔ 未判定:${u.file} —— ${u.reason};三把尺子(工作区 mtime / 在飞留痕 / first-seen 台账)全空${C.reset}`)
  }

  for (const r of risky.slice(0, 20)) {
    console.log(
      `  ${C.yellow}⚠️ ${C.dim}${r.file}${C.reset} ${C.yellow}未提交已 ${C.bold}${formatAge(r.ageMs)}${C.reset}${C.yellow}${C.reset}`,
    )
    // 同一路径若已被 ② 判成"暂存内容 == 某祖先版本",这里**不能再建议提交它** ——
    // 两条出口互相打架的报告等于没报告(§5e-1:收信人读了必须知道该干什么)。
    const st = indexAncestorByFile.get(normalizePath(r.file))
    if (st === 'lagging-ancestor') {
      console.log(`     ${C.red}这一路径的暂存内容 == 某祖先版本:上面索引面那条已给"按 HEAD 对齐"的出口,不要提交它${C.reset}`)
    } else if (st === 'undetermined') {
      console.log(`     ${C.yellow}先跑 node scripts/check-stale-revert.mjs --staged 复核形态,再决定提不提交${C.reset}`)
    } else {
      console.log(`     ${C.cyan}建议:node scripts/safe-commit.mjs -m "<本次改动说明>" -- ${r.file}${C.reset}`)
    }
  }
  if (risky.length > 20) {
    console.log(`  ${C.dim}…另有 ${risky.length - 20} 个超龄文件(全量见 --json)${C.reset}`)
  }
  if (risky.length > 0) {
    console.log(
      `\n${C.yellow}💡 共享工作树里任何一次并行的 git checkout / reset / clean 都会把这些未提交改动整体抹掉,${C.reset}`,
    )
    console.log(`${C.yellow}   且不留痕迹(2026-09-21 同日两次功能丢失即此因)。改完即提交,或按 §12d 用 worktree 隔离。${C.reset}`)
  }
  if (idxRisky.length > 0) {
    console.log(
      `\n${C.yellow}💡 索引里的条目不会被抹掉,但会被**忘记**(2026-10-14 实测:4 条"已暂存未提交"长期挂着,${C.reset}`,
    )
    console.log(`${C.yellow}   而当时本门自己把这一形态排除在判据之外)。要么提交它、要么按 HEAD 对齐,不要让它烂在索引里。${C.reset}`)
  }
  if (indexFace?.recycled?.length) {
    console.log(`  ${C.dim}first-seen 台账回收 ${indexFace.recycled.length} 条(索引里已消失),盖时刻 ${indexFace.stamped ?? 0} 条${C.reset}`)
  }
  if (indexFace?.writeBack && indexFace.writeBack.ok === false) {
    console.log(`  ${C.yellow}⚠️ first-seen 台账未写入:${indexFace.writeBack.why}(不阻塞,但下一轮年龄只能另找尺子)${C.reset}`)
  }
  if (strict) console.log(`${C.red}❌ --strict:存在超龄未提交源码改动(工作树面或索引面),判定失败${C.reset}`)
}

async function main() {
  const argv = process.argv.slice(2)

  if (argv.includes('--self-test')) {
    const results = runSelfTest()
    const failed = results.filter((r) => !r.pass)
    for (const r of results) {
      console.log(`${r.pass ? '  ✅' : `${C.red}  ❌`} ${r.name}${r.extra ? ` ${C.dim}[${r.extra}]${C.reset}` : ''}${C.reset}`)
    }
    console.log(
      failed.length === 0
        ? `${C.green}自检通过:${results.length} 例全绿${C.reset}`
        : `${C.red}自检失败:${failed.length}/${results.length}${C.reset}`,
    )
    process.exit(failed.length === 0 ? 0 : 1)
  }

  const json = argv.includes('--json')
  const strict = argv.includes('--strict')
  const stagedMode = argv.includes('--staged')
  const thresholdMin = resolveThresholdMin(argv, process.env)

  // 一次 status 读,两面共用同一份清单(不得各读一次:那会拿到两面不一致的索引快照)
  const statusRead = runGitResult(['status', '--porcelain', '-z'])
  const entries = statusRead.ok ? parsePorcelainZ(statusRead.text) : []

  // ① 工作树面(原维度):--staged 不收窄,照旧全量扫
  const candidates = collectCandidatePaths(entries, walkUntrackedDir)
  const statables = candidates
    .map((p) => ({ path: p, mtimeMs: mtimeMsOf(p) }))
    .filter((s) => Number.isFinite(s.mtimeMs))
  const { risky, scanned } = classifyByAge(statables, thresholdMin)

  // ② 索引面(2026-10-15 扩面):每一次运行都判,--staged 不再是排除开关
  const indexFace = statusRead.ok
    ? runIndexFace({ entries, thresholdMin })
    : {
        status: 'undetermined',
        scanned: 0,
        risky: [],
        undetermined: [],
        fresh: 0,
        stagedTotal: 0,
        statusRead: `git status 读取失败:${statusRead.err}`,
        ledgerState: 'not-read',
        recycled: [],
        stamped: 0,
        writeBack: { ok: true, skipped: true },
      }

  if (json) {
    console.log(
      JSON.stringify(
        {
          ok: risky.length === 0 && indexFace.risky.length === 0,
          stagedMode,
          thresholdMin,
          scanned,
          risky: risky.map((r) => ({ file: r.file, ageMin: Math.round(r.ageMs / 60_000) })),
          indexFace: {
            status: indexFace.status,
            statusRead: indexFace.statusRead ?? 'ok',
            stagedTotal: indexFace.stagedTotal,
            scanned: indexFace.scanned,
            fresh: indexFace.fresh,
            ledgerState: indexFace.ledgerState,
            ledgerWhy: indexFace.ledgerWhy ?? null,
            stamped: indexFace.stamped ?? 0,
            recycledCount: indexFace.recycled?.length ?? 0,
            ledgerWrite: indexFace.writeBack ?? null,
            blobRead: indexFace.blobRead ?? null,
            ancestorRead: indexFace.ancestorRead ?? null,
            attestNote: indexFace.attestNote ?? null,
            risky: indexFace.risky.map((r) => ({
              file: r.file,
              ageMin: Math.round(r.ageMs / 60_000),
              ageSource: r.ageSource,
              stagedBlob: r.stagedBlob,
              ancestorEqual: r.ancestorEqual,
              lastInflightAttestation: r.attestMs ? new Date(r.attestMs).toISOString() : null,
              firstSeen: r.firstSeenMs ? new Date(r.firstSeenMs).toISOString() : null,
              exits: indexExitLines(r),
            })),
            undetermined: indexFace.undetermined.map((u) => ({ file: u.file, reason: u.reason })),
          },
        },
        null,
        2,
      ),
    )
    process.exit(strict && (risky.length > 0 || indexFace.risky.length > 0) ? 1 : 0)
  }

  if (!existsSync(join(ROOT, '.git'))) {
    console.log(`${C.yellow}⚠ 非 git 工作区,跳过未提交改动年龄守门${C.reset}`)
    process.exit(0)
  }

  printReport({ thresholdMin, risky, scanned, strict, indexFace })
  process.exit(strict && (risky.length > 0 || indexFace.risky.length > 0) ? 1 : 0)
}

// ─── 入口守护(§22d):被 import 时不得触发 main() 副作用 ───
export const __test__ = {
  parsePorcelainZ,
  normalizePath,
  isSourceFile,
  isExemptPath,
  isCandidatePath,
  collectCandidatePaths,
  resolveThresholdMin,
  classifyByAge,
  formatAge,
  runSelfTest,
  SOURCE_EXTS,
  EXCLUDED_DIRS,
  DEFAULT_THRESHOLD_MIN,
  THRESHOLD_ENV,
  // 索引面(2026-10-15 扩面):镜像测试一律 import 这些出口,禁止另抄判据(§22c)
  STAGED_INDEX_LETTERS,
  INDEX_PENDING_LEDGER_REL,
  INDEX_PENDING_LEDGER_VERSION,
  STAGE_ORACLE_FIELDS,
  isStagedIndexEntry,
  collectStagedCandidatePaths,
  indexInflightAttestations,
  resolveStageStartMs,
  describeAgeSource,
  firstSeenKeyOf,
  indexPendingLedgerPath,
  parseIndexPendingLedger,
  readIndexPendingLedger,
  serializeIndexPendingLedger,
  writeIndexPendingLedger,
  pruneIndexPendingLedger,
  evaluateIndexFace,
  runIndexFace,
  indexExitLines,
  indexEvidenceLine,
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.error(`${C.red}❌ check-uncommitted-age 脚本执行异常:${e?.message ?? e}${C.reset}`)
    console.error(e?.stack ?? '(no stack)')
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
