// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-815952:已入库迁移的正文不可就地改写 —— 这条纪律要判红,不能只当评审约定。
 *
 * 在修什么(2026-09-30,PROJECT_PLAN G-815952,ZCode 吸收线·迁移族):
 *   一条已经进过 journal、已经在别人库上跑过的 .sql,若被就地改正文,则旧库不会重放它、
 *   新库拿到的是另一份结构 ⇒ **同一个版本号有两份 schema**,而账面仍然"迁移都跑成功"
 *   (drizzle 只按 journal 的 when 与库内 hash 记账,从不回看 .sql 正文)。
 *   上游把这条做成硬约束:`ensureMigrationChecksum` 在**已拿锁的事务内**逐条比对,不等即抛
 *   `checksum mismatch … Historical migrations are immutable; add a new migration instead.`
 *   (出处 `apps/zcode-cli/packages/adapters/src/storage/session-store/migration-runner.ts:300-315`)。
 *   我方此前**只有散文**。而且不是假想:2026-09-26 真发生过一次 —— `215d4c1e10`
 *   ("迁移注释里的分段标记字面量会把语句切坏")改掉了 `20260927100000_tenant_rls_policies_batch1.sql`
 *   首次入库时的正文。改动本身有理,但它证明的是"这条路真的会走到",走到之后没有任何东西会红。
 *
 * 与既有守门的分工(互补不重叠,别误以为这一格已经有尺子):
 *   · 守门 49 `check-migration-bookkeeping.mjs` 判**结构**:journal ↔ .sql 一一对应、tag 唯一、
 *     when 严格递增、库内记账双射。它的 B9 只判"库里那行 hash 是不是合法 sha256 且不重复",
 *     **从不把 .sql 正文与入库 hash 对账**;同文件背景段 `:19` 还明写了不比对的理由 ——
 *     迁移文件被注入零宽溯源水印后内容会变,旧 hash 全失效。
 *   · 本门补的正是那一格,并且**先剥水印再比**:不剥的话本门出生即恒红(`:19` 记的就是这个坑)。
 *   · 存在性/删除属守门 49 / 99 / 168 的射程,本门只判正文内容,不判"文件在不在"。
 *   · **与同仓另一条"内容不可变"判据的分工(2026-10-01 现读,别把两把尺子读成一条)**:
 *     守门 49 在飞的 B11 问的是「**库内 `__drizzle_migrations.hash`** 与当前正文配不配」,
 *     它要连库或喂 `--ledger-from` 夹具,本机长期报"未判定";本门问的是「当前正文与
 *     **git 里首次入库那次提交**的正文配不配」,只需对象库,提交链跑得动。
 *     两问的失效形态不同(B11 抓"库已应用而正文漂了",本门抓"正文被就地改写"这个动作本身),
 *     所以两边都判红时**不是重复计账**;接线时不要把其中一条当另一条的替代品摘掉。
 *
 * 判据两条,对照面不同、不得互相顶账:
 *   IM1 正文对"首次入库那次提交"不可变 —— 被审面 blob 与该路径历史上第一次以 A 出现时的 blob,
 *        归一后不等 ⇒ 该 tag 已被就地改写。全量档(HEAD)量到的是**存量**(立项现读 1 条,见上),
 *        默认只报数,`--strict` 才判红:把与本次提交无关的存量挂成 blocking,唯一结局是逼人
 *        `--no-verify` 连带废掉链上全部守门(AGENTS §12e)。
 *   IM2 本次提交不得改动已入库正文 —— 索引面 blob 与 HEAD 面 blob 归一后不等,且该路径在 HEAD
 *        已存在(⇒ 它确实"已入库")⇒ 判红。这条**不需要基线清单、也不会因存量而恒红**:
 *        比的恰是"这次改动有没有动它",存量红(IM1)不落在本次头上。
 *
 * 归一化口径(为什么"只改水印/空白"必须绿、"加一行注释"必须红 —— 票面两条正反成对):
 *   ① 剔掉水印结构行(横幅文案行 + 文件末尾隐写标记行)—— 唯一实现是
 *      `scripts/lib/watermark-lines.mjs` 的 `stripWatermarkStructure`,本门不得再抄一份正则
 *      (两处算同一件事必漂移,AGENTS §22c);
 *   ② 逐行 trim(首尾空白一并去掉,顺带吃掉 CRLF 的 `\r`);
 *   ③ 丢掉归一后为空的行。
 *   ⇒ 只动水印/缩进/空行/行尾空格 ⇒ 行序列逐字相同 ⇒ 绿;加一行注释或改一个 SQL 词 ⇒
 *     非空行的 trim 后内容变 ⇒ 红。松紧是有意的:能改变这份迁移做什么的改动,一定会改变
 *     某个非空行 trim 后的内容。
 *
 * 取材面纪律(与守门 70/77/83/98/101/118 同口径,守门 118 也判本门自己有没有守):
 *   全量档判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 只作人工逃生舱;
 *   两面旗同给 ⇒ exit 2;清单与内容**同面同轮**(一次 catBatch 读满 journal + 该面全部候选 .sql);
 *   取不到 ⇒ **未判定**并逐条点名,**绝不回落到另一个面**(回落就是把"没判"写成"判过了");
 *   **枚举到 0 个候选判死不记绿**(journal 0 条 tag / 该面一个 .sql 都没有 / 历史里连一条 A 都
 *   拿不到 ⇒ exit 2,而不是"干净")。
 *   "首次入库那次提交"取的是**历史面**(`git log --no-renames --diff-filter=A`),它是"这条正文
 *   第一次进仓时长什么样"的定义,不是第二个被审面;IM2 的对照取 HEAD 面,同理。
 *   `--no-renames` 是必需的:开着改名检测时一次搬家被写成 `R`,而 `--diff-filter=A` 不收 R
 *   ⇒ 该路径拿不到基线,整型静默退成未判定。
 *
 * 接线状态(2026-10-06 现读,已漂移):**已接入** —— `guardian-runner.mjs` 现注册
 *   `id:'185'` / `mode:'blocking'` / `skipEnv: HUSKY_SKIP_MIGRATION_IMMUTABLE` /
 *   `stagedTriggers: ['packages/database/','apps/api/src/']`。
 *   下面那段「定级建议」是**立项时的建议原文**,它已被原样采纳(连 `stagedTriggers`
 *   都与注册块一致),保留在此作为定级理由的存档 —— **不要再把它读成待办**。
 *   ⚠️ 本门测试 `check-migration-immutable.test.mjs` 的 T1 正是「按注册表真值反查
 *   头注是否说谎」的方向锁:注册表里有的门,头注不得仍自称未接线。修好判据那一刻
 *   它是红的,因为头注欠账 —— **绿不是从来如此,是欠账还完了**。
 *
 * 定级建议(立项原文,已采纳 —— 见上方接线状态):
 *   · 建议 blocking,`stagedTriggers=packages/database/`;
 *   · 建议应急变量 `HUSKY_SKIP_MIGRATION_IMMUTABLE=1`(门体自身也读它,手动复跑同样生效);
 *   · 可以直挂 blocking 的依据:提交链档只走 IM2(无基线、存量不背),IM1 存量在默认档只报数;
 *   · 接线前置(AGENTS 守门 146/152 那一课):门体与镜像测试必须**同枚**入库,否则 HEAD 里
 *     会留一条指向不存在脚本的注册,而守门 89 对这一格结构上失明。
 *
 * 手动:
 *   node scripts/check-migration-immutable.mjs              # 全量档(HEAD):IM1 存量只报数
 *   node scripts/check-migration-immutable.mjs --staged     # 提交链档:IM2 不等 ⇒ exit 1
 *   node scripts/check-migration-immutable.mjs --worktree   # 人工逃生舱(盘上,不作门禁)
 *   node scripts/check-migration-immutable.mjs --strict     # 问责档:存量红 ⇒ 1,未判定 ⇒ 2
 *   node scripts/check-migration-immutable.mjs --json
 *   node scripts/check-migration-immutable.mjs --self-test
 *   node scripts/check-migration-immutable.mjs --root <目录>   # 镜像测试通道(临时 git 仓)
 * 镜像:node --test scripts/tests/check-migration-immutable.test.mjs
 * 退出码:0 过 / 1 判红 / 2 无法判定(含"枚举到 0 个候选")
 */

/* eslint-disable no-console -- 守门脚本是 CLI 工具,诊断信息必须打到 stdout/stderr */
import { readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { stripWatermarkStructure } from './lib/watermark-lines.mjs'
import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(AGENTS §15,禁止写死盘符) */
const ROOT = resolve(HERE, '..')

/** 应急跳过变量(**现读已随 runner 条目声明** —— 见头注「接线状态」)。 */
export const SELF_SKIP = 'HUSKY_SKIP_MIGRATION_IMMUTABLE'

/**
 * 迁移目录。票面写的是 `packages/database/migrations/**`,本仓实际落盘路径是
 * `packages/database/drizzle/**`(实测 `git ls-files` 只有后者有 .sql)。
 * 登记这一格,是为了下一个人不必重新去证明"目录不存在"。
 */
export const MIG_DIR = 'packages/database/drizzle'
export const JOURNAL_REL = `${MIG_DIR}/meta/_journal.json`

const GIT_TIMEOUT = 180000
const GIT_MAX_BUFFER = 1 << 28

/** 被审面的 rev 前缀:索引面 = ''(`:<path>`),HEAD 面 = 'HEAD'。worktree 不批量取。 */
export function faceRev(face) {
  return face === 'staged' ? '' : 'HEAD'
}

// ---------------------------------------------------------------------------
// 归一化与判据内核(纯函数:不碰 git、不碰磁盘,构造面即可证明)
// ---------------------------------------------------------------------------

/**
 * 把一份迁移正文归一成"可比对的语义行序列":剔水印结构行 → 逐行 trim → 丢空行。
 * @param {string} text 原文
 * @returns {{text:string, removed:number, lines:string[]}} removed 是被剔掉的水印行数,
 *   必须如实带出来 —— "判据看不见了几行"这件事不得静默(AGENTS §5e"失败必须响"同一条禁令)。
 */
export function normalizeMigrationBody(text) {
  const stripped = stripWatermarkStructure(String(text ?? ''))
  const lines = stripped.text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
  return { text: lines.join('\n'), removed: stripped.removed, lines }
}

/**
 * IM1 / IM2 共用的判读内核:两侧各归一后逐行比。
 * 两条判据必须走同一份归一化 —— 各自归一一遍必然漂开,而漂开的表现不是报错,
 * 是"同一次改动在一档红、在另一档绿"。
 * @param {{faceText:string|null, baseText:string|null}} p
 * @returns {{red:boolean, removedFace:number, removedBase:number, firstDiffLine:number, faceLine:string, baseLine:string}}
 */
export function judgePair({ faceText, baseText }) {
  const a = normalizeMigrationBody(faceText)
  const b = normalizeMigrationBody(baseText)
  if (a.text === b.text) {
    return {
      red: false,
      removedFace: a.removed,
      removedBase: b.removed,
      firstDiffLine: 0,
      faceLine: '',
      baseLine: '',
    }
  }
  // 只点名第一条对不上的行:定位交给工具,diff 是另一件事,本门不造第二个 diff 器
  let firstDiffLine = 0
  for (let i = 0; i < Math.max(a.lines.length, b.lines.length); i++) {
    if (a.lines[i] !== b.lines[i]) {
      firstDiffLine = i + 1
      break
    }
  }
  return {
    red: true,
    removedFace: a.removed,
    removedBase: b.removed,
    firstDiffLine,
    faceLine: a.lines[firstDiffLine - 1] ?? '(本侧归一后没有这一行:少了一行)',
    baseLine: b.lines[firstDiffLine - 1] ?? '(基线归一后没有这一行:多了一行)',
  }
}

// ---------------------------------------------------------------------------
// 被审面取材(清单与内容同面同轮)
// ---------------------------------------------------------------------------

/**
 * 该面上的 `MIG_DIR/*.sql` 清单。
 * · head   → `git ls-tree -r --name-only -z HEAD -- <dir>`
 * · staged → `git ls-files -s -z -- <dir>`(未合并条目 stage>0,原样标出供未判定档点名)
 * · worktree → 磁盘目录(只作人工逃生舱,提交链不走这一档)
 * @param {string} root
 * @param {string} face
 * @returns {{paths:string[], byPath:Set<string>, unmerged:string[]}}
 */
export function listSqlOnFace(root, face) {
  const add = (arr, set, p) => {
    if (!set.has(p)) {
      set.add(p)
      arr.push(p)
    }
  }
  if (face === 'worktree') {
    const paths = []
    const set = new Set()
    let names
    try {
      names = readdirSync(join(root, MIG_DIR))
    } catch (e) {
      throw new Undetermined(`${MIG_DIR} 目录读不到(worktree 面): ${e?.message ?? e}`)
    }
    for (const n of names) if (n.endsWith('.sql')) add(paths, set, `${MIG_DIR}/${n}`)
    return { paths, byPath: set, unmerged: [] }
  }
  const args =
    face === 'staged'
      ? ['ls-files', '-s', '-z', '--', MIG_DIR]
      : ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', MIG_DIR]
  const out = gitRaw(args, root, { timeout: GIT_TIMEOUT, maxBuffer: GIT_MAX_BUFFER })
  const paths = []
  const set = new Set()
  const unmerged = []
  for (const rec of String(out).split('\0')) {
    if (!rec.trim()) continue
    let p = rec
    if (face === 'staged') {
      const tab = rec.indexOf('\t')
      if (tab < 0) continue
      p = rec.slice(tab + 1)
      const stage = Number((rec.split(' ')[2] ?? '0').trim())
      if (stage > 0) unmerged.push(p)
    }
    if (p.endsWith('.sql') && p.startsWith(`${MIG_DIR}/`)) add(paths, set, p)
  }
  return { paths, byPath: set, unmerged }
}

/**
 * 一次 catBatch 读满整批候选正文 —— 清单与内容同面同轮的落地点。
 * @param {string} root
 * @param {string} face
 * @param {string[]} paths
 * @returns {Map<string,string|null>} 按**路径**索引(不是按规格),取不到为 null
 */
export function readFaceBlobs(root, face, paths) {
  const map = new Map()
  if (paths.length === 0) return map
  if (face === 'worktree') {
    for (const p of paths) map.set(p, readWorktreeFile(root, p))
    return map
  }
  const rev = faceRev(face)
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(root, specs, { timeout: GIT_TIMEOUT, maxBuffer: GIT_MAX_BUFFER })
  specs.forEach((spec, i) => map.set(paths[i], got.get(spec) ?? null))
  return map
}

/**
 * journal 原文。调用方(runAudit)把它与 .sql 清单放**同一轮**取,不在这里各派一次 git。
 * @param {Map<string,string|null>} blobs 已按路径索引的面 blob(含 JOURNAL_REL 时)
 */
export function takeJournalText(blobs) {
  return blobs.get(JOURNAL_REL) ?? null
}

/**
 * 解析 journal → tag 清单。坏 JSON / 缺 entries ⇒ 抛 Undetermined(那是"没判成",
 * 不是"没有迁移");同 tag 重复登记计 dup,只留一份基线,不静默取其一。
 * @param {string|null} text
 */
export function parseJournal(text) {
  if (text === null || text === undefined) return { tags: [], dup: [], declared: 0 }
  let json
  try {
    json = JSON.parse(text)
  } catch (e) {
    throw new Undetermined(`journal(${JOURNAL_REL}) 不是合法 JSON,本门无从判读: ${e?.message ?? e}`)
  }
  const entries = Array.isArray(json?.entries) ? json.entries : null
  if (!entries) throw new Undetermined('journal 里没有 entries 数组 ⇒ 无法判定(不是"没有迁移")')
  const tags = []
  const seen = new Set()
  const dup = []
  for (const e of entries) {
    const tag = typeof e?.tag === 'string' ? e.tag.trim() : ''
    if (!tag) continue
    const rel = `${MIG_DIR}/${tag}.sql`
    if (seen.has(rel)) {
      dup.push(rel)
      continue
    }
    seen.add(rel)
    tags.push({ tag, rel })
  }
  return { tags, dup, declared: entries.length }
}

/**
 * "该路径首次以 A 出现的那次提交"—— IM1 基线面的取法,只走一遍历史。
 * @param {string} root
 * @returns {Map<string,string>} rel → commit sha
 */
export function firstAdditionMap(root) {
  const out = gitRaw(
    ['log', '--no-renames', '--format=@%H', '--name-only', '--diff-filter=A', '--', MIG_DIR],
    root,
    { timeout: GIT_TIMEOUT, maxBuffer: GIT_MAX_BUFFER },
  )
  const map = new Map()
  let cur = null
  for (const line of String(out).split('\n')) {
    if (line.startsWith('@')) {
      cur = line.slice(1).trim()
      continue
    }
    const rel = line.trim()
    if (!rel || !cur) continue
    // 只认最早那次:git log 自新向旧,后写覆盖会把基线漂成"最后一次新增"(浅历史/反复删复时出错)
    if (!map.has(rel)) map.set(rel, cur)
  }
  return map
}

// ---------------------------------------------------------------------------
// 汇总判定
// ---------------------------------------------------------------------------

/**
 * 三档读数折成退出码。三态绝不并桶:
 *   未判定(取材失败 / 基线不可考)⇒ 2(优先于 1:结论无效时不得冒充"判过了")
 *   判红(提交链档的 IM2;或 --strict 下的 IM1 存量)⇒ 1
 *   其余 ⇒ 0(存量红仍逐条点名,不静默)
 * 枚举到 0 个候选由 runAudit 直接抛 Undetermined,不走这一层。
 */
export function decide({ commitReds, stockReds, undetermined, mode, strict }) {
  if (undetermined.length) return { exit: 2, reason: 'undetermined' }
  if (mode === 'staged' && commitReds.length) return { exit: 1, reason: 'im2' }
  if (strict && stockReds.length) return { exit: 1, reason: 'im1-stock-strict' }
  return { exit: 0, reason: 'ok' }
}

/**
 * 主判读。
 * @param {string} root
 * @param {'head'|'staged'|'worktree'} face
 * @param {{strict?:boolean}} [opts]
 */
export function runAudit(root, face, { strict = false } = {}) {
  // 1) 该面的 .sql 清单 + journal 内容:同面、同一轮批量取
  const faceFiles = listSqlOnFace(root, face)
  const readSet = [...faceFiles.paths, JOURNAL_REL]
  const blobs = readFaceBlobs(root, face, readSet)

  const journalText = takeJournalText(blobs)
  if (journalText === null) {
    throw new Undetermined(`${face} 面取不到 ${JOURNAL_REL} —— 无从判定(不回落另一个面)`)
  }
  const journal = parseJournal(journalText)
  if (journal.tags.length === 0) {
    throw new Undetermined(
      `${face} 面 journal 有效 tag 为 0 条(声明 ${journal.declared} 条)⇒ 空扫不记绿`,
    )
  }
  if (faceFiles.paths.length === 0) {
    throw new Undetermined(`${face} 面在 ${MIG_DIR} 枚举到 0 个 .sql ⇒ 空扫不记绿`)
  }

  // 2) 已入库基线面(HEAD):IM2 的对照,兼"这条迁移到底入库了没有"的判据
  const landed = face === 'head' ? faceFiles : listSqlOnFace(root, 'head')
  const headBlobs = face === 'head' ? blobs : readFaceBlobs(root, 'head', landed.paths)

  // 3) IM1 基线:每个路径首次入库那次提交
  const adds = firstAdditionMap(root)
  if (adds.size === 0) {
    throw new Undetermined(`${MIG_DIR} 的历史里一条 "A(新增)" 记录都没有 ⇒ 基线不可考,判死不记绿`)
  }
  const baseSpecs = []
  for (const t of journal.tags) {
    const sha = adds.get(t.rel)
    if (sha) baseSpecs.push(`${sha}:${t.rel}`)
  }
  const baseBlobs = baseSpecs.length
    ? catBatch(root, baseSpecs, { timeout: GIT_TIMEOUT, maxBuffer: GIT_MAX_BUFFER })
    : new Map()

  const stockReds = []
  const commitReds = []
  const undetermined = []
  const notLanded = []
  let compared = 0

  for (const t of journal.tags) {
    if (!landed.byPath.has(t.rel)) {
      // 该面清单里没有 ⇒ 它此刻还不算"已入库"(新增迁移),或已被删除(那属守门 49/99/168)
      notLanded.push(t.rel)
      continue
    }
    const faceText = blobs.get(t.rel)
    if (faceText === null || faceText === undefined) {
      undetermined.push(`${t.rel} —— ${face} 面取不到正文(索引未合并或该面缺件),无法对账`)
      continue
    }
    const headText = headBlobs.get(t.rel)
    if (headText === null || headText === undefined) {
      undetermined.push(`${t.rel} —— HEAD 面取不到正文,IM2 无从对照`)
      continue
    }
    const baseSha = adds.get(t.rel)
    if (!baseSha) {
      undetermined.push(`${t.rel} —— 历史里找不到"首次入库那次提交"(浅克隆或历史被改写过),基线不可考`)
      continue
    }
    const baseText = baseBlobs.get(`${baseSha}:${t.rel}`)
    if (baseText === null || baseText === undefined) {
      undetermined.push(`${t.rel} —— 首次入库提交 ${baseSha.slice(0, 10)} 的 blob 取不到,基线不可考`)
      continue
    }

    compared++
    const im1 = judgePair({ faceText, baseText })
    if (im1.red) {
      stockReds.push({
        file: t.rel,
        tag: t.tag,
        base: baseSha,
        firstDiffLine: im1.firstDiffLine,
        faceLine: im1.faceLine,
        baseLine: im1.baseLine,
      })
    }
    if (face !== 'head') {
      const im2 = judgePair({ faceText, baseText: headText })
      if (im2.red) {
        commitReds.push({
          file: t.rel,
          tag: t.tag,
          firstDiffLine: im2.firstDiffLine,
          faceLine: im2.faceLine,
          headLine: im2.baseLine,
        })
      }
    }
  }

  const verdict = decide({ commitReds, stockReds, undetermined, mode: face, strict })
  return {
    exit: verdict.exit,
    reason: verdict.reason,
    face,
    strict,
    counts: {
      journalDeclared: journal.declared,
      journalTags: journal.tags.length,
      journalDup: journal.dup.length,
      faceSqlFiles: faceFiles.paths.length,
      landed: landed.paths.length,
      compared,
      notLanded: notLanded.length,
      stockReds: stockReds.length,
      commitReds: commitReds.length,
      undetermined: undetermined.length,
    },
    stockReds,
    commitReds,
    undetermined,
    notLanded,
    journalDup: journal.dup,
  }
}

// ---------------------------------------------------------------------------
// 自检(纯函数 + 构造面,零副作用;--self-test 连跑两次 rc 必须相同)
// ---------------------------------------------------------------------------

/** 真仓 .sql 的水印头三行形态(`--` 注释前缀),用于证明"先剥水印"这一步真的在起作用。 */
const SQL_WATERMARK_HEAD =
  '-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top\n' +
  '-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。\n' +
  '-- [IHUI-AI-PROVENANCE]:\u2060\u200b\u200c\u200b\u200c\u200d\u200d\n'

function selfTest() {
  let ran = 0
  let fail = 0
  /**
   * cond 必须是**已求值的布尔**。传函数进去 `!!fn` 恒真 ⇒ 断言从写下起从未求值,
   * 账面却记着 ✅(AGENTS 门 150 票㉛ 那一格:恒绿的断言比没有断言更糟)。
   */
  const t = (name, cond, extra = '') => {
    ran++
    if (typeof cond === 'function') {
      fail++
      console.log(`  ❌ ${name} —— cond 是函数 ⇒ 该断言从未求值(应写成 (() => {...})())`)
      return
    }
    if (cond === true) console.log(`  ✅ ${name}`)
    else {
      fail++
      console.log(`  ❌ ${name}${extra ? `\n      ${extra}` : ''}`)
    }
  }

  const BODY = 'INSERT INTO t (a) VALUES (1);\n'

  // —— 票面两条正反成对(纯函数层;端到端在镜像测试的临时仓里再走一遍)——
  t(
    'S1 只加水印结构行必须放过(票面:同一文件只改水印/空白 ⇒ 必绿)',
    (() => judgePair({ faceText: SQL_WATERMARK_HEAD + BODY, baseText: BODY }).red)() === false,
  )
  t(
    'S2 只改缩进/行尾空格/空行/CRLF 必须放过',
    (() =>
      judgePair({ faceText: BODY.replace('INSERT', '   INSERT').replace('\n', '  \r\n') + '\n\n', baseText: BODY })
        .red)() === false,
  )
  t(
    'S3 正文里加一行注释必须判红(票面:已登记 .sql 正文加一行注释 ⇒ 必红)',
    (() => judgePair({ faceText: BODY + '-- 事后补的说明\n', baseText: BODY }).red)() === true,
  )
  t(
    'S4 改一个 SQL 词必须判红并点名第一条不等行',
    (() => {
      const r = judgePair({ faceText: 'INSERT INTO t (a) VALUES (2);\n', baseText: BODY })
      return r.red === true && r.firstDiffLine === 1 && r.faceLine.includes('VALUES (2)')
    })(),
  )
  t(
    'S5 不剥水印就会恒红:归一化确实剔掉 3 行水印结构(证明 S1 不是空转)',
    (() => {
      const n = normalizeMigrationBody(SQL_WATERMARK_HEAD + BODY)
      return n.removed === 3 && n.lines.length === 1
    })(),
  )
  t('S6 空正文两侧一致放过(空 ≠ 缺件)', (() => judgePair({ faceText: '', baseText: '\n  \n' }).red)() === false)
  t('S7 空 vs 非空必须判红(整份被清空也是改写)', (() => judgePair({ faceText: BODY, baseText: '' }).red)() === true)
  t(
    'S8 归一化幂等:判据自己不引入抖动',
    (() => {
      const once = normalizeMigrationBody(SQL_WATERMARK_HEAD + '  A  \n\n\nB\n').text
      return once === normalizeMigrationBody(once + '\n').text
    })(),
  )

  // —— journal 解析三态 ——
  t(
    'S9 坏 JSON 抛"无法判定",不当成"没有迁移"',
    (() => {
      try {
        parseJournal('{')
        return false
      } catch (e) {
        return e instanceof Undetermined
      }
    })(),
  )
  t(
    'S10 缺 entries 抛"无法判定"',
    (() => {
      try {
        parseJournal('{"version":"7"}')
        return false
      } catch (e) {
        return e instanceof Undetermined
      }
    })(),
  )
  t(
    'S11 同 tag 重复登记:计 dup 并只留一份基线(不静默取其一)',
    (() => {
      const j = parseJournal('{"entries":[{"tag":"a"},{"tag":"a"},{"tag":"b"}]}')
      return j.tags.length === 2 && j.dup.length === 1 && j.declared === 3
    })(),
  )
  t('S12 null journal 返回空清单(由调用方判死)', (() => parseJournal(null).tags.length)() === 0)

  // —— decide:三态不并桶 + 防恒红 ——
  const one = [{ file: 'x.sql' }]
  const none = []
  t(
    'S13 有未判定一律 exit 2(优先于判红;结论无效不得冒充"判过了")',
    (() => decide({ commitReds: one, stockReds: one, undetermined: ['y'], mode: 'staged', strict: false }).exit)() ===
      2,
  )
  t(
    'S14 提交链档 IM2 ⇒ 1(新动作直接拦)',
    (() => decide({ commitReds: one, stockReds: none, undetermined: none, mode: 'staged', strict: false }).exit)() === 1,
  )
  t(
    'S15 全量档存量红默认 ⇒ 0(防恒红门:与本次提交无关的红只会逼人跳门)',
    (() => decide({ commitReds: none, stockReds: one, undetermined: none, mode: 'head', strict: false }).exit)() === 0,
  )
  t(
    'S16 --strict 存量红 ⇒ 1(问责档拒绝放行)',
    (() => decide({ commitReds: none, stockReds: one, undetermined: none, mode: 'head', strict: true }).exit)() === 1,
  )
  t('S17 全干净 ⇒ 0', (() => decide({ commitReds: none, stockReds: none, undetermined: none, mode: 'staged' }).exit)() === 0)
  t(
    'S18 面旗互斥由 selectFace 判死(--staged + --worktree ⇒ error)',
    (() => selectFace({ staged: true, worktree: true, def: 'head' }).error !== null)(),
  )
  t('S19 默认档取 HEAD 面', (() => selectFace({ staged: false, worktree: false, def: 'head' }).face)() === 'head')
  t('S20 索引面 rev 前缀必须是空串(`:path`),不是 HEAD', faceRev('staged') === '')
  t('S21 全量档 rev 前缀必须是 HEAD', faceRev('head') === 'HEAD')

  console.log(`自检:${ran - fail}/${ran} 通过`)
  return fail === 0 ? 0 : 1
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(argv) {
  if (process.env[SELF_SKIP] === '1') {
    console.log(
      `⏭️  ${SELF_SKIP}=1,本门跳过(跳过即放弃"已入库迁移正文不可就地改写"这一格不变量,须在提交信息里写明理由与清偿票)`,
    )
    return 0
  }
  if (argv.includes('--self-test')) return selfTest()

  let root = ROOT
  const ri = argv.indexOf('--root')
  if (ri >= 0) {
    const token = argv[ri + 1]
    if (typeof token !== 'string' || token === '' || token.startsWith('-')) {
      console.error(
        `❌ 无法判定(exit 2): --root 没收到有效目录 —— 紧邻 token 实得:${
          token === undefined ? '(其后没有任何参数)' : JSON.stringify(token)
        }`,
      )
      return 2
    }
    root = resolve(token)
  }
  const strict = argv.includes('--strict')
  const { face, error } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (error) {
    console.error(`❌ 无法判定: ${error}`)
    return 2
  }
  try {
    assertRepoRoot(root, '本门')
  } catch (e) {
    console.error(`❌ 无法判定(exit 2): ${e instanceof Undetermined ? e.message : String(e?.message ?? e)}`)
    return 2
  }

  let out
  try {
    out = runAudit(root, face, { strict })
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`❌ 无法判定(exit 2): ${e.message}`)
      return 2
    }
    console.error(`❌ 无法判定(exit 2): 脚本自身异常 ${e?.message ?? String(e)}`)
    console.error(e?.stack ?? '')
    return 2
  }

  if (argv.includes('--json')) {
    console.log(JSON.stringify(out, null, 2))
    return out.exit
  }

  for (const u of out.undetermined) console.error(`❓ 未判定(${out.face} 面): ${u}`)
  if (out.commitReds.length) {
    console.error(
      `❌ IM2 检出 ${out.commitReds.length} 条**已入库**迁移的正文被本次改动改写(${out.face} 面 vs HEAD):`,
    )
    for (const r of out.commitReds) {
      console.error(`   ${r.file} 首个不等行 ${r.firstDiffLine}`)
      console.error(`     ${out.face} 面:${r.faceLine}`)
      console.error(`     HEAD    :${r.headLine}`)
    }
    console.error('   出路:新建一枚迁移去修正它(add a new migration instead),不得回头改已入库的 .sql;')
    console.error('        确属撤回误入库的新迁移,走删除路径(守门 49/99/168),而不是改正文。')
  }
  if (out.stockReds.length) {
    console.error(
      `${out.strict ? '❌' : '⚠️'} IM1 检出 ${out.stockReds.length} 条正文与"首次入库那次提交"不等 —— ${
        out.strict ? '--strict 问责档:存量判红' : '存量(默认档只报数,不判死)'
      }:`,
    )
    for (const r of out.stockReds) {
      console.error(
        `   ${r.file} ← 基线 ${r.base.slice(0, 10)} 首个不等行 ${r.firstDiffLine}:基线写「${r.baseLine}」/ 现面写「${r.faceLine}」`,
      )
    }
  }
  if (out.notLanded.length) {
    const head = out.notLanded.slice(0, 5).join(', ')
    console.log(
      `ℹ️  ${out.face} 面有 ${out.notLanded.length} 条 tag 不在已入库清单里(新增迁移 ⇒ 不可变性还不适用;整份被删则属守门 49/99/168 射程):${head}${
        out.notLanded.length > 5 ? ' …' : ''
      }`,
    )
  }
  if (out.journalDup.length) {
    console.error(`⚠️  journal 同 tag 重复登记 ${out.journalDup.length} 处(结构维归守门 49):${out.journalDup.join(', ')}`)
  }

  const c = out.counts
  console.log(
    `${out.exit === 0 ? '✅' : out.exit === 2 ? '❌ 无法判定' : '❌ 判红'} [判定面=${out.face}${
      out.strict ? ' +strict' : ''
    }] journal tag ${c.journalTags}(声明 ${c.journalDeclared})/ 该面 .sql ${c.faceSqlFiles}/ 可比对 ${c.compared}/ IM2 本次改写 ${c.commitReds}/ IM1 存量不等 ${c.stockReds}/ 未判定 ${c.undetermined}/ 未入库新增 ${c.notLanded}`,
  )
  console.log(
    '   单独复现:node scripts/check-migration-immutable.mjs [--staged|--strict|--json]  自检:--self-test  镜像:node --test scripts/tests/check-migration-immutable.test.mjs',
  )
  return out.exit
}

// §22d isDirectRun:被镜像测试 import 时不得跑 CLI 主流程。
// Windows 反斜杠必须经 pathToFileURL 归一(§22d 跨平台陷阱),裸拼 file:// 永不成立。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)))
}

export const __test__ = {
  SELF_SKIP,
  MIG_DIR,
  JOURNAL_REL,
  faceRev,
  normalizeMigrationBody,
  judgePair,
  listSqlOnFace,
  readFaceBlobs,
  takeJournalText,
  parseJournal,
  firstAdditionMap,
  decide,
  runAudit,
  SQL_WATERMARK_HEAD,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
