#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 迁移记账守门(check-migration-bookkeeping.mjs)
 *
 * 校验 packages/database/drizzle 的 journal 与 .sql 是否严格一一对应、when 是否
 * 严格单调唯一;并可选(--db)对库内 drizzle.__drizzle_migrations 做双射强校验。
 *
 * 背景(2026-09-13 实测):
 *   1. drizzle-kit migrate 的判据是 `Number(DB.created_at) < entry.when`。
 *      本仓库 journal 的 when 一度是**合成时间戳**(等差 +86400000,止于 1721513600000),
 *      而库内 created_at 是真实时间(1788717703662)→ 判据恒假 → migrate 每轮空转、
 *      一条也不应用。修复后 journal 与库双射对齐(254 ↔ 254,when 集合完全相同)。
 *   2. 另一条基于 sha256 记账的旧通道(D:/DevEnv/tools/apply-migrations.py)与磁盘
 *      .sql **0 命中** —— 迁移文件被注入零宽溯源水印后内容改变,旧 hash 全失效。
 *   → 结构性事实(journal↔sql 一一对应、when 单调唯一、库↔journal 双射)必须有守门,
 *     否则下一次漂移仍会静默发生。
 *
 * 检测维度:
 *   离线(默认;CI 安全、无 DB 依赖):
 *     B1 journal 的 tag 集合 == drizzle/*.sql 的 basename 集合(双向)
 *        ⚠️ **判定面**(2026-09-28 收口到本仓现行口径,与守门 36/70/77/83/93/98/103/118/124 同形):
 *          · 默认档(全量审计)= **HEAD blob** —— journal 取 `HEAD:meta/_journal.json`,
 *            .sql 清单取 `git ls-tree -r --name-only -z HEAD`。
 *            此前它判磁盘,于是同一份 HEAD 代码在"干净检出"与"本机共享工作树"上给出**相反结论**
 *            (2026-09-28 实测:`git archive HEAD` 解出的干净检出 exit 0「295 条」,而本机因并行会话
 *            把 journal 的工作树副本改成 296 条而判红「.sql 存在但 journal 未登记」,红的是别人在飞,
 *            不是本枚提交 —— 这正是本档要消灭的那一格)。
 *          · `--staged`(pre-commit)= **索引 blob**:journal 与 .sql 清单**同面同轮**取自索引。
 *          · `--worktree` = **磁盘**,只作人工/验生成器写回的逃生舱,提交链不走这一档。
 *          · `--staged` 与 `--worktree` 同时给 ⇒ 两个互斥面无法同时成立 ⇒ **exit 2 判死**,不猜。
 *          · 任一面取不到(路径不存在 / 不是 blob / git 失败 / **枚举到 0 个 .sql** /
 *            **journal 0 条 entries**)⇒ **exit 2 显式「无法判定」并点名**,既不回落到另一个面
 *            (回落就是把"没判"写成"判过了"),也绝不静默记绿。
 *        真实拦截力**没有削弱,还多了一格**:索引里有 journal 条目而对应 .sql 没进索引 ⇒ 判红
 *        (旧写法在这一型上是**假绿**——它按磁盘读,盘上恰好躺着那枚未跟踪文件;这正是 B10 头注
 *        记过的"绿只是因为该门按工作树取材")。
 *        "磁盘比索引新"在 `--staged` 档**必须点名但不得判红**(B1 段末尾那一行逐条列出受控路径,
 *        措辞沿用 B10 的"有人在飞"风格 —— 别人的在飞改动不是本枚提交的错,AGENTS §12e)。
 *     B2 tag 唯一
 *     B3 when 严格递增且唯一
 *     B4 idx 唯一(idx 断号仅告警 —— drizzle 按 tag 配对 SQL、按 when 排序,idx 只是元数据)
 *     B5 journal 结构完整(version / dialect / entries 数组,entry 必含 idx/tag/when)
 *   在线(--db 或 --db-ledger 快照通道):
 *     B6 库内行数 == journal 条目数
 *     B7 库内 created_at 集合 == journal when 集合(严格双射)
 *     B8 max(created_at) == max(when)(migrate「不空转」的充要条件)
 *     B9 库内每行 hash 均为合法 sha256(64 位十六进制)且唯一 —— 防再现 2026-09-13 的
 *        污染形态(453 行中含 153 个重复 hash 与 `NOFILE:` / `manual_` 伪值)
 *     B11 **已应用迁移的内容 ↔ 账本 hash 逐条对账**(2026-09-28 立,本票新增)——
 *        对 journal 里每一个「库内已有账本行(账本 created_at == 条目 when)」的 tag,
 *        按 drizzle 那把算法现算被审面上 .sql 内容的 sha256,与账本 hash 比对,不等即红。
 *        · 立项凭据(实测,不是推测):`drizzle-orm/pg-core/dialect.js:44-71` 的 migrate()
 *          只问 `Number(lastDbMigration.created_at) < migration.folderMillis`,**从不读回 hash**
 *          —— hash 只在插入时写一次(`migrator.js:23` 的
 *          `createHash("sha256").update(整份 .sql 原文).digest("hex")`)。
 *          ⇒ 改一枚**已应用**迁移的一个字符 = **静默分叉**(P1:既不重跑也不报错,库里永远是旧结构,
 *            而 git 里那份 .sql 从此没人执行过),不是「按 hash 判未应用而重跑」(P0)。
 *            既然运行时永远不会自己发现这一格,这道对账就是唯一的尺子 ⇒ **在 --db 档直接判红**。
 *          本门头注第 2 条记过的旧事故(「迁移文件被注入零宽溯源水印后内容改变,旧 hash 全失效」)
 *          当时的处置是**躲开水印器**,没留尺子 —— B11 补的就是那一格。
 *        · 离线档(不给 --db / --db-ledger)**判「未判定」并给原因,绝不记绿**:没有账本就没人能
 *          说"内容没被改过"。本机无 PG 时这是常态(AGENTS §5b:凡"要不要怕影响生产"先实测端口)。
 *        · **未应用的新迁移不判红** —— 它的内容当然还可以改;判据只认"账本里已有那一行"。
 *        · 禁止的处置:**改 .sql 去凑 hash、或"重算并覆盖账本 hash"**(那是给分叉发通行证)。
 *          唯一出路是把改动挪成一枚**新迁移**。
 *        · `--db-ledger <快照>` 是**取证/无库通道**:喂 `psql -t -A -F'|' -c
 *          'SELECT created_at, hash FROM drizzle.__drizzle_migrations ORDER BY created_at'`
 *          的**原样输出**落盘件,只供 B11 比对;B6~B9 判的是库内实时状态,该通道下如实报
 *          「未判定」,不得拿快照冒充"连过库"。与 `--db` 同给 ⇒ 两个账本来源互斥 ⇒ exit 2。
 *        · 定级:提交链(runner id 49 的 `args: []`)**不带 --db**,所以 B11 的红不会变成每台每次的
 *          恒红门(AGENTS §12e);它只在被明确要求的库内对账里说话。`--strict` 另把「未判定」
 *          也升为判红(问责档拒绝出合格证)。
 *   旁路(warn 级,**不并入 B1-B5 的判红面**,也不改它们的退出码):
 *     B10 journal 登记表当前是否「无人 in flight」—— 报五路径( journal / 两张 schema /
 *        api 的 chat 路由与查询 )的 git 状态(已暂存 / 仅工作树脏 / 干净),以及
 *        packages/database/drizzle 下**未跟踪的 .sql** 清单。
 *        起因(2026-09-25 实测):本门离线 B1-B5 全过、exit 0,而绿**只是因为该门按工作树取材、
 *        磁盘上正躺着别人未跟踪的迁移文件**,journal 的脏改动也没暂存。于是「账目结构合法」
 *        与「这张登记表当前无人在飞」被混为一谈,后来者会据绿抢跑追加 idx。
 *        本判据就是把第二件事变成机器可判的 —— 但只**报状态**,不判红:
 *        别人的在飞改动不是本次提交的错(同守门 70/77/83 的"恒红门只会逼人 --no-verify")。
 *        要问责请跑 `--require-idle`(CI / 巡检),默认不改退出码。
 *
 * 用法:
 *   node scripts/check-migration-bookkeeping.mjs               # 离线全量审计(**判 HEAD blob**)
 *   node scripts/check-migration-bookkeeping.mjs --staged      # pre-commit(判索引面,同面同轮)
 *   node scripts/check-migration-bookkeeping.mjs --worktree    # 磁盘逃生舱(人工 / 验生成器写回)
 *   node scripts/check-migration-bookkeeping.mjs --require-idle # B10 由「只报」升为「判红」(CI / 巡检)
 *   node scripts/check-migration-bookkeeping.mjs --strict       # B11 的「未判定」升为判死(问责档)
 *   node scripts/check-migration-bookkeeping.mjs --db-ledger f  # B11 用落盘账本快照(不连库;B6~B9 未判定)
 *   node scripts/check-migration-bookkeeping.mjs --db          # 追加库校验(B11 也用它)
 *       (DSN 取自 $DATABASE_URL,否则读 apps/api/.env 的 DATABASE_URL;
 *        psql 取自 $IHUI_PSQL,否则 D:\DevEnv\runtimes\pgsql\bin\psql.exe,否则 PATH 上的 psql)
 *       说明:B6~B9 比对的是**库内实时状态**(那是被审对象本身,不是"取哪个面的仓库正文"),
 *       所以这一档的取数方式本票一字未动;它旁边的 journal 一侧随所选判定面走(默认 HEAD)。
 *   node scripts/check-migration-bookkeeping.mjs --self-test   # 成对正反例(临时 git 仓夹具,零副作用于真仓)
 *   node scripts/check-migration-bookkeeping.mjs --root <dir>  # **测试通道**,只给 --self-test 与镜像测试用:
 *       仓库根由脚本自身位置推导之后,靠 cwd 定位夹具的调用**结构上失效**(守门 70 的镜像测试
 *       13/14 恒红、13c 的 11/13 例其实在审真仓 —— 同一型)。生产路径不带这个参数。
 */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveGitBin } from './lib/gitdir.mjs'
// 取材走统一层(守门 118 的判据口径):`catBatch` 取 journal 正文、`readWorktreeFile` 取磁盘面、
// `gitRaw` 只做**枚举与状态查询**(`ls-tree` / `ls-files` 列路径清单,不读 blob)、`selectFace` 出面旗
// 判死。此前本门把 journal 与 .sql 全按磁盘读,而"按磁盘判的门"在滞后/被并行会话污染的共享工作树
// 上会在恒红与假绿之间来回跳。
import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
  FACE_LABEL,
} from './lib/face-reader.mjs'
// 临时夹具唯一落点(§26 / 守门 118 实测过两个禁止理由:不得用 os.tmpdir(),不得落仓库树内)
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** 仓库根:由脚本自身位置推导(§15,不写死盘符也不信 cwd)。 */
function resolveRoot(argv) {
  const i = argv.indexOf('--root')
  if (i >= 0) {
    const p = argv[i + 1]
    if (!p || p.startsWith('--')) throw new Error('--root 需要一个目录参数')
    return resolve(p)
  }
  return resolve(HERE, '..')
}

const MIG_DIR_REL = 'packages/database/drizzle'
const JOURNAL_REL = `${MIG_DIR_REL}/meta/_journal.json`

const args = process.argv.slice(2)
const ROOT = resolveRoot(args)
const wantDb = args.includes('--db')
// B10 定级开关:默认 warn(只报不改退出码);--require-idle 才升成判红(供 CI / 巡检问责)
const requireIdle = args.includes('--require-idle')
// B11 的问责档:默认把「没账本可比」如实报成未判定而**不改退出码**(提交链不带 --db,
// 但巡检/CI 可能带别的档;与改动无关的恒红只会逼人 --no-verify,AGENTS §12e 同型)。
// `--strict` 才把「未判定」也升成判死 —— 它是"拒绝出具合格证",不是"仓库有罪"。
const strict = args.includes('--strict')

/**
 * 纯函数:argv → `--db-ledger <快照文件>` 的解析结果。
 *
 * 为什么要有这一档(它**不是**后门):B11 比的是「.sql 内容 ↔ 库内账本 hash」,而本机无 PG 时
 * (AGENTS §5b:凡"要不要怕影响生产"先实测端口)这一格永远判不到 —— 那既不该被记成通过,
 * 也不该让这张票的成对取证只能靠连生产库来做(§5 测试隔离铁律)。快照通道的输入是
 * `psql -t -A -F'|' -c 'SELECT created_at, hash FROM drizzle.__drizzle_migrations ORDER BY created_at'`
 * 的**原样输出**(部署机落盘件),用它跑出来的结论**必须在输出里自报"来源是快照文件,没连库"**,
 * 免得下一个人把这一格读成"B6~B9 也对照过"。
 * 与 `--db` 同给 ⇒ 两个账本来源(实时库 / 落盘快照)互斥,判死而不是猜用哪个(与两面旗同给同一规矩)。
 * @returns {{file:string|null, error:string|null}}
 */
export function ledgerFileFromArgv(argv) {
  const list = argv || []
  const i = list.findIndex((a) => a === '--db-ledger' || String(a).startsWith('--db-ledger='))
  if (i < 0) return { file: null, error: null }
  const a = String(list[i])
  const p = a.includes('=') ? a.slice(a.indexOf('=') + 1) : list[i + 1]
  if (!p || String(p).startsWith('--'))
    return { file: null, error: '--db-ledger 需要一个文件参数(psql 原样输出,不加注释行)' }
  return { file: p, error: null }
}

const LEDGER_ARG = ledgerFileFromArgv(args)
const LEDGER_FILE = LEDGER_ARG.file

/**
 * 纯函数:argv → 判定面。**默认 `head`**(全量审计判 HEAD blob)。
 *
 * 为什么必须导出它、还必须有构造面断言:本票改的正是"默认判哪个面"这一格。若只靠人跑一次真仓
 * 看结论行,那行文字会被下一次顺手改写;函数不会 —— 门 124 头注记的同一条理由。
 * 两旗同给的判死交给取材层的 `selectFace`(三门共用一条,免得某道门悄悄少一个面)。
 */
export function faceFromArgv(argv) {
  return selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
}

/** 人读的判定面措辞(层里的 FACE_LABEL 是"机制名",这里补一句"它为什么是这一面")。 */
export const FACE_TXT = {
  head: 'HEAD blob(全量审计:干净检出与本机必须同答)',
  staged: '索引 blob(本次提交会带走的那一份)',
  worktree: '工作树(磁盘;逃生舱,提交链不走这一档)',
}

/**
 * 纯函数:判定面 → journal 正文的 `cat-file --batch` 规格(`--worktree` 给 null,由磁盘面自己读)。
 * 单独导出是为了让"三个面各取哪一份"能被构造面钉死,而不是埋在 CLI 流程里。
 */
export function faceJournalSpec(face) {
  if (face === 'staged') return `:${JOURNAL_REL}`
  if (face === 'head') return `HEAD:${JOURNAL_REL}`
  return null
}

/** 纯函数:判定面 → .sql **枚举**用的 git 参数(`--worktree` 给 null,由 readdirSync 列目录)。 */
export function faceSqlListArgs(face) {
  if (face === 'staged') return ['ls-files', '-z', '--', MIG_DIR_REL]
  if (face === 'head') return ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', MIG_DIR_REL]
  return null
}

/**
 * 纯函数:`git ls-files -z` / `git ls-tree -r --name-only -z` 的输出 → **本次判定面里**
 * drizzle/*.sql 的 basename 集合(去 .sql)。
 * 只认 `packages/database/drizzle/` 下**恰好一层**的 .sql —— 与 `--worktree` 档的
 * `readdirSync(DIR)` 同形(不递归 meta/),否则两档判的就不是同一件事。
 * 分隔符 NUL 与换行都收:`-z` 是本门实际用的形态,而万一某台 git 不认 `-z`,换行输出也必须
 * 仍被读成清单(而不是被当成一整个怪路径 ⇒ "枚举到 0 个"那种指错方向的假无法判定)。
 */
export function sqlBasenamesFromListing(zLines) {
  const prefix = `${MIG_DIR_REL}/`
  const out = new Set()
  for (const raw of String(zLines ?? '').split(/[\0\n]/)) {
    const p = raw.trim().replace(/\\/g, '/')
    if (!p.startsWith(prefix)) continue
    const rest = p.slice(prefix.length)
    if (!rest || rest.includes('/') || rest.includes('\0')) continue
    if (!rest.endsWith('.sql')) continue
    out.add(rest.slice(0, -4))
  }
  return out
}

/**
 * 纯函数:journal tag 与 .sql basename 的**双向**差集 —— B1 的唯一实现,两档(工作树 / 索引)
 * 都调它,不在别处再抄一遍集合运算。
 * @returns {{journalNoSql:string[], sqlNoJournal:string[]}}
 */
export function diffJournalVsSql(tags, sqls) {
  const tagSet = new Set(tags)
  const sqlSet = new Set(sqls)
  return {
    journalNoSql: tags.filter((t) => !sqlSet.has(t)),
    sqlNoJournal: sqls.filter((s) => !tagSet.has(s)),
  }
}

/**
 * 纯函数:journal 正文 → entries 数组。
 * 抛 `Undetermined` 的两种情形都属"这一格没判",而不是"记账合法":
 *   · 正文不是合法 JSON —— 不,这一条**不**走这里(它是真红,由调用方按 B5 判 exit 1);
 *   · 解析出来但 `entries` 缺失/不是数组/长度为 0 ⇒ 空枚举。空枚举不得记绿:本门的判据全是
 *     "tag ↔ .sql 双向配对",0 条 tag 会让 B1–B4 全部退化成"无违规",而那种绿与"根本没看"同形
 *     (守门 78「扫到 0 条链接一律判红」、门 111/148「枚举到 0 个候选判死」同一条规矩)。
 * 非法 JSON 在这里**原样抛 SyntaxError**(不打 Undetermined 标记),由调用方折成 exit 1 ——
 * 那是被审正文真的坏了,是红,不是"取不到"。
 */
export function journalEntriesOf(text, faceLabel) {
  // 非法 JSON 原样抛(SyntaxError,不是 Undetermined)—— 调用方据此把"正文真的坏了"(真红 exit 1)
  // 与"这一面取不到"(exit 2 无法判定)分开。两种颜色混在一起 = 把没判写成判过了。
  const journal = JSON.parse(text)
  if (!Array.isArray(journal.entries) || journal.entries.length === 0)
    throw new Undetermined(
      `${faceLabel} 的 journal entries 缺失或为 0 条 —— 空枚举不记绿(B1–B4 会全部退化成"无违规")`,
    )
  return journal
}

/**
 * 纯函数:`git status --porcelain=v1 -z` 的记录 → `[{xy, path}]`。
 * 用 `-z` 而不是按行切:中文/空格路径在默认 `core.quotepath` 下会被转义成带引号的一坨,
 * 按行切要把引号与 `->` 重命名两种形态都再解一遍(本门只需要 XY + 路径,不必背那套解析)。
 * 记录形状恒为 `XY␠path`(前两位状态字节 + 一个空格分隔),所以取 `slice(3)`。
 */
export function parsePorcelainZ(text) {
  const out = []
  for (const rec of String(text ?? '').split('\0')) {
    if (rec.length < 4) continue
    const xy = rec.slice(0, 2)
    const p = rec.slice(3).replace(/\\/g, '/').trim()
    if (!p) continue
    out.push({ xy, path: p })
  }
  return out
}

/**
 * 纯函数: porcelain 记录 → **仅工作树脏**的路径(索引 == HEAD,而磁盘比它新)。
 * 判序:`xy[0] === ' '`(索引相对 HEAD 没动)且 `xy[1] !== ' '`(工作树相对索引有改动)。
 * `??` 未跟踪(x y 都是 `?`)与 `M␠` 已暂存都不算 —— 前者由 B1 段的"未跟踪 .sql"那一格点名,
 * 后者已经进了本次提交面,归 B1 判红射程,不得混进"仅工作树脏"里被免判。
 */
export function worktreeOnlyDirtyPaths(rows) {
  return (rows || []).filter((r) => r.xy[0] === ' ' && r.xy[1] !== ' ').map((r) => r.path)
}

/** 把层里/别的异常折成一句人话(不吞类型:Undetermined 与真红必须能被调用方分开)。 */
function faceErrText(e) {
  if (e instanceof Undetermined) return e.message
  return String(e?.message ?? e).split(/\r?\n/)[0]
}

/**
 * 按判定面取**这一轮要用的两份输入**(journal 正文 + .sql 清单),**同面同轮**。
 * @returns {{journalText:string, sqls:string[], face:string}}
 * 取不到一律抛 `Undetermined`(调用方折成 exit 2),**不回落**到另一个面 ——
 * 回落就是把"没判"写成"判过了"(守门 93/124 各记过一次)。
 */
export function readAuditFace(root, face) {
  if (face === 'worktree') {
    // 逃生舱允许作用于"根本不在 git 里"的目录(镜像 T5 就是这么造的),所以这一档不碰 git。
    const journalText = readWorktreeFile(root, JOURNAL_REL)
    if (typeof journalText !== 'string')
      throw new Undetermined(`${FACE_LABEL.worktree} 取不到 ${JOURNAL_REL}(不存在 / 不是文本)`)
    let names
    try {
      names = readdirSync(join(root, MIG_DIR_REL))
    } catch (e) {
      throw new Undetermined(`${FACE_LABEL.worktree} 列目录失败 ${MIG_DIR_REL}:${faceErrText(e)}`)
    }
    const sqls = names.filter((f) => f.endsWith('.sql')).map((f) => f.slice(0, -4))
    if (sqls.length === 0)
      throw new Undetermined(
        `${FACE_LABEL.worktree} 在 ${MIG_DIR_REL} 枚举到 0 个 .sql —— 空扫不记绿`,
      )
    return { journalText, sqls, face }
  }

  // 清单(枚举)与正文(catBatch)必须同一轮取自同一个面:一个来自磁盘、一个来自索引/HEAD,
  // 会在并行会话刚推进的那一瞬间产出自洽却错位的尺子(守门 101/118 各记过同型)。
  let listed
  try {
    assertRepoRoot(root, `本门(${face})`)
    listed = sqlBasenamesFromListing(gitRaw(faceSqlListArgs(face), root, { timeout: 60000 }))
  } catch (e) {
    throw new Undetermined(`${FACE_LABEL[face]} 清单取不到:${faceErrText(e)}`)
  }
  const spec = faceJournalSpec(face)
  let journalText
  try {
    journalText = catBatch(root, [spec]).get(spec)
  } catch (e) {
    throw new Undetermined(`${FACE_LABEL[face]} blob 取不到:${faceErrText(e)}`)
  }
  if (typeof journalText !== 'string') {
    throw new Undetermined(
      `${FACE_LABEL[face]} 里没有 ${JOURNAL_REL}(未入库 / 被暂存删除 / unmerged)——` +
        `本次无法与 .sql 清单(实测 ${listed.size} 个)对账`,
    )
  }
  if (listed.size === 0)
    throw new Undetermined(`${FACE_LABEL[face]} 在 ${MIG_DIR_REL} 枚举到 0 个 .sql —— 空扫不记绿`)
  return { journalText, sqls: [...listed], face }
}

/**
 * 判定面**自证行**(纯按面分流,只报数 + 点名,永不判红、永不抛)。
 *
 * 为什么必须有:一道按某一面判的门,最容易产的假象就是"绿得和没看一样"。
 * 本函数把"本面之外还躺着什么"写成结论行 —— 否则"索引里没有那枚 .sql"与"仓库里根本没有"
 * 在账面上逐字相同,而这两种处置动作完全不同(前者不用管,后者要补文件)。
 * 判据本体(`diffJournalVsSql`)一字不读这些行,所以它们改不了退出码。
 *
 * 取不到探针 ⇒ 明写「未判定」,绝不静默省掉那一行(与守门 5e"失败必须响"同一条禁令)。
 */
export function faceSelfProof(root, face, faceSqls) {
  const n = faceSqls.length
  const lines = [`B1 判定面=${FACE_TXT[face]}(${n} 个 .sql 在册)。`]
  if (face === 'worktree') {
    lines.push(
      '本档判磁盘:与 HEAD / 索引可能不同 ⇒ **只作人工排查与验生成器写回**,不得当提交门禁、不得据它以记绿。',
    )
    return lines
  }

  // ── 未跟踪的 .sql(只躺在磁盘上,任何 git 面都不含它)──
  let untracked = null
  try {
    untracked = [
      ...sqlBasenamesFromListing(
        gitRaw(['ls-files', '--others', '--exclude-standard', '-z', '--', MIG_DIR_REL], root, {
          timeout: 15000,
        }),
      ),
    ]
  } catch {
    untracked = null
  }

  // ── 仅工作树脏:索引 == HEAD,而磁盘比它新(并行会话在飞,不属本枚)──
  let dirty = null
  try {
    dirty = worktreeOnlyDirtyPaths(
      parsePorcelainZ(
        gitRaw(['status', '--porcelain=v1', '-z', '--', MIG_DIR_REL], root, { timeout: 15000 }),
      ),
    )
  } catch {
    dirty = null
  }

  const list = (arr) =>
    arr.length === 0 ? '' : `;逐条 ${arr.slice(0, 5).join(', ')}${arr.length > 5 ? ' …' : ''}`
  const untrackedTxt =
    untracked === null
      ? '盘上未跟踪 .sql 的数量**未判定**(git 问不到)——不得据此认为没有'
      : `盘上另有 ${untracked.length} 枚未跟踪 .sql(不属本枚提交${list(untracked)})`
  const dirtyTxt =
    dirty === null
      ? '"仅工作树脏"的受控路径数量**未判定**(git 问不到)——不得据此认为没有'
      : `另有 ${dirty.length} 个受控路径仅工作树脏(索引 == HEAD 而磁盘比它新${list(dirty)})`
  lines.push(
    `${untrackedTxt};${dirtyTxt} —— 两者都不计入本面、**不据此判红**:` +
      '别人的在飞改动不是本枚提交的红(AGENTS §12e)。',
  )

  if (face === 'head') {
    // HEAD 档独有的一格:索引里已经存在而 HEAD 里还没有的 .sql(= 还没提交的在途迁移)。
    try {
      const idx = sqlBasenamesFromListing(
        gitRaw(['ls-files', '-z', '--', MIG_DIR_REL], root, { timeout: 15000 }),
      )
      const ahead = [...idx].filter((s) => !faceSqls.includes(s))
      lines.push(
        ahead.length === 0
          ? '索引里没有 HEAD 尚缺的 .sql(HEAD ↔ 索引这一维同集)。'
          : `索引另有 ${ahead.length} 枚 .sql 尚未入库(${ahead.slice(0, 5).join(', ')}${
              ahead.length > 5 ? ' …' : ''
            })—— 不属 HEAD 这一份,不计入本面;要审"这枚提交会不会带走它"请跑 --staged。`,
      )
    } catch {
      lines.push('索引 ↔ HEAD 这一维的差异**未判定**(git 问不到)——不得据此认为没有。')
    }
  }
  return lines
}

// ════════════════════════════════════════════════════════════════════════════
// B11 —— 已应用迁移的内容不可变性对账(2026-09-28 立)。
// 这一族的三个出口都必须是**单一实现**:算法、账本解析、比对判据各住一处,
// 不得在别处再抄一遍(两处算同一件事必漂移,本仓记过多次)。
// ════════════════════════════════════════════════════════════════════════════

/**
 * drizzle 写进 `drizzle.__drizzle_migrations.hash` 的那把 hash 的**唯一算法**。
 * 出处(逐字,2026-09-28 现读):
 *   `packages/database/node_modules/drizzle-orm/migrator.js:15,23`
 *     const query = fs.readFileSync(`${folder}/${entry.tag}.sql`).toString()
 *     hash: crypto.createHash("sha256").update(query).digest("hex")
 * 两个不能改的细节:
 *   ① 是对**整份原文**算的,在按 `--> statement-breakpoint` 切句**之前**;
 *   ② **不得 .trim() / 不得归一换行** —— 账本里的字节就是磁盘当时的字节,
 *      归一化等于替"内容被改过"发通行证(本票明令禁止的处置)。
 * @param {string} text 被审面上的 .sql 正文(与 journal **同面同轮**取的那一份)
 */
export function migrationSqlHash(text) {
  return createHash('sha256').update(String(text), 'utf8').digest('hex')
}

/** 纯函数:判定面 + tag → 该 .sql 的 `cat-file --batch` 规格(`--worktree` 给 null,由磁盘面自己读)。 */
export function faceSqlBlobSpec(face, tag) {
  const rel = `${MIG_DIR_REL}/${tag}.sql`
  if (face === 'staged') return `:${rel}`
  if (face === 'head') return `HEAD:${rel}`
  return null
}

/**
 * 纯函数:账本行的解析(**一份实现同时供 psql 实时输出与 --db-ledger 快照文件用**)。
 * 输入是 `psql -t -A -F'|'` 的原样文本,行形状 `created_at|hash`;空行跳过。
 * 刻意保留旧内联实现的怪癖而不"顺手修":`created_at` 取 `Number(...)`,非数字 ⇒ NaN,
 * 由调用方的 `Number.isFinite` 滤掉(B6 的既有语义一字不动)。
 * @returns {Array<{createdAt:number, hash:string}>}
 */
export function parseLedgerRows(text) {
  const rows = []
  for (const l of String(text ?? '').split(/\r?\n/)) {
    if (l.trim() === '') continue
    const i = l.indexOf('|')
    rows.push({ createdAt: Number(l.slice(0, i).trim()), hash: l.slice(i + 1).trim() })
  }
  return rows
}

/**
 * 纯判据:B11 的内容比对。
 * @param {Array<{tag?:string, when?:number}>} entries  journal 条目(与被比对正文**同面同轮**)
 * @param {Map<string,string|null>} bodies              tag → .sql 正文;`null`/缺键 = 该面取不到正文
 * @param {Array<{createdAt:number, hash:string}>} rows 库内(或快照)账本行
 * @returns {{applied:number, compared:number, ok:number,
 *            mismatch:Array<{tag:string, when:number, ledgerHash:string, computedHash:string, eolOnly:boolean}>,
 *            notApplied:string[], unreadable:string[], noTag:number}}
 * 三态**绝不并桶**(这是本判据的全部价值):
 *   · applied 且正文取得到 → 比;等则 ok,不等则 mismatch(**含仅行尾差异,照样计红**,
 *     只在诊断里标 `eolOnly` 免得下一个人把编码问题当成 SQL 改动去查)。
 *   · applied 而正文取不到 → `unreadable`(未判定):既不是分叉也不是通过。
 *   · 账本里没有那一行(未应用的新迁移)→ `notApplied`,**不判红** —— 它的内容当然还可以改。
 */
export function compareAppliedHashes(entries, bodies, rows) {
  const byWhen = new Map()
  for (const r of rows || []) {
    if (Number.isFinite(r && r.createdAt) && typeof r.hash === 'string') byWhen.set(r.createdAt, r.hash)
  }
  const mismatch = []
  const notApplied = []
  const unreadable = []
  let applied = 0
  let ok = 0
  let noTag = 0
  for (const e of entries || []) {
    const when = Number(e && e.when)
    const ledgerHash = Number.isFinite(when) ? byWhen.get(when) : undefined
    const tag = e && typeof e.tag === 'string' ? e.tag : null
    if (!tag) {
      // entry 缺 tag:结构问题归 B5 判红,这里只如实计数,不替 B11 造出一条假分叉。
      noTag++
      continue
    }
    if (typeof ledgerHash !== 'string') {
      notApplied.push(tag)
      continue
    }
    applied++
    const body = bodies && bodies.get(tag)
    if (typeof body !== 'string') {
      unreadable.push(tag)
      continue
    }
    const computedHash = migrationSqlHash(body)
    if (computedHash === ledgerHash) {
      ok++
      continue
    }
    mismatch.push({
      tag,
      when,
      ledgerHash,
      computedHash,
      // 诊断位而非豁免通道:归一后相等 ⇒ 差异**看起来**只是换行,但仍算 mismatch(见上)。
      eolOnly: migrationSqlHash(body.replace(/\r\n/g, '\n')) === ledgerHash,
    })
  }
  return { applied, compared: applied - unreadable.length, ok, mismatch, notApplied, unreadable, noTag }
}

/** B11 判红时给的人话出口(上游同形措辞 + 唯一修法)。 */
export const MIGRATION_IMMUTABLE_HINT =
  '历史迁移不可变,请新增一枚迁移(Historical migrations are immutable; add a new migration instead.)'

/**
 * 按判定面读一批 .sql 正文(与 journal **同面同轮**,不混面)。
 * 单枚取不到 ⇒ Map 里给 null,由 `compareAppliedHashes` 归入 `unreadable`(未判定)——
 * 不冒红(那可能是 B1 已经点名的缺失),也绝不静默算通过。
 * 整批派生失败 ⇒ 抛 `Undetermined`,由调用方折成"B11 未判定 + 原因"。
 */
export function readSqlBodies(root, face, tags) {
  const list = [...(tags || [])]
  const out = new Map()
  if (list.length === 0) return out
  if (face === 'worktree') {
    for (const t of list) out.set(t, readWorktreeFile(root, `${MIG_DIR_REL}/${t}.sql`))
    return out
  }
  const specs = list.map((t) => faceSqlBlobSpec(face, t))
  const got = catBatch(root, specs)
  list.forEach((t, i) => out.set(t, got.get(specs[i]) ?? null))
  return out
}

// ════════════════════════════════════════════════════════════════════════════
// 取证夹具(2026-09-28 立)。**唯一一份实现**:`--self-test` 与 §22c 镜像测试都用它,
// 不得在测试里再抄一遍(§22c:镜像常量漂移 = 测试从防线变成缺陷的掩体)。
// 落点一律 `scripts/lib/scratch-dir.mjs` 的 mkScratch —— 两个禁止理由都由实测固化:
// ① 不得用 os.tmpdir()(活进程 TEMP 可能仍钉在 C 盘,§26);② 不得落仓库树内
//   (夹具要模拟"非 git 目录",在树内时 `git rev-parse --show-toplevel` 会向上逃逸到真仓 ⇒ 该用例恒红)。
// ════════════════════════════════════════════════════════════════════════════

/** 夹具用的 tag(与镜像测试同源,改动两处一起改)。 */
export const fixtureTagOf = (i) => `202609280000${i}_gate49_fixture_${i}`

/**
 * 造一份 B1–B5 全绿的最小记账夹具:n 条 journal 条目 + n 枚 .sql + B10 的其余四个受控路径。
 * `withSql:false` 时只写 journal(用来证"枚举到 0 个 .sql ⇒ 空扫不记绿")。
 */
export function writeGateFixture(root, n, { withSql = true } = {}) {
  const drizzle = join(root, MIG_DIR_REL)
  mkdirSync(join(drizzle, 'meta'), { recursive: true })
  const entries = Array.from({ length: n }, (_, i) => ({
    idx: i,
    tag: fixtureTagOf(i),
    when: 1760000000000 + i * 1000,
  }))
  writeFileSync(
    join(drizzle, 'meta/_journal.json'),
    `${JSON.stringify({ version: 7, dialect: 'postgresql', entries }, null, 2)}\n`,
  )
  if (withSql) for (const e of entries) writeFileSync(join(drizzle, `${e.tag}.sql`), FIXTURE_SQL)
  for (const p of FIXTURE_WATCH_OTHERS) {
    mkdirSync(dirname(join(root, p)), { recursive: true })
    writeFileSync(join(root, p), 'export {}\n')
  }
  return { drizzle, entries }
}

/** B10 的另外四个受控路径(journal 之外;与 B10_WATCH 同源)。 */
export const FIXTURE_WATCH_OTHERS = [
  'packages/database/src/schema/chat.ts',
  'packages/database/src/schema/relation-tables.ts',
  'apps/api/src/routes/chat.ts',
  'apps/api/src/db/chat-queries.ts',
]

/** 夹具 .sql 的正文(与 `writeGateFixture` 同源;改它两处一起改)。 */
export const FIXTURE_SQL = 'SELECT 1;\n'
/** 夹具里用来构造"已应用迁移被改一个字符"的那一份正文。 */
export const FIXTURE_SQL_TAMPERED = 'SELECT 2;\n'
/** 账本快照在夹具仓里的落点(放在 drizzle/ **之外**:B1 的枚举与 B10 的未跟踪面都按目录收窄)。 */
export const FIXTURE_LEDGER_REL = '.ledger/snapshot.txt'

/**
 * 造一份账本快照(形状 = `psql -t -A -F'|' -c 'SELECT created_at, hash …'` 的原样输出)。
 *
 * 它是 `--self-test` 与 §22c 镜像测试**共用**的唯一一份实现(§22c),因为 B11 的取证不能靠连库
 * (AGENTS §5 测试隔离铁律 + 本机 8810/8811 零监听实测),而"手工在测试里抄一遍 hash 拼接"
 * 会和这里的 psql 形状漂开 —— 漂开的后果不是红,是**永远不相等**或**永远相等**的假结论。
 *
 * @param {Array<{tag:string, when:number}>} entries 夹具 journal 条目(用**同一份** entries,别重造)
 * @param {{content?:Record<string,string>, notApplied?:string[], dropAll?:boolean}} [o]
 *   · `content[tag]` —— 该 tag 在"库里当年执行的那一份"的正文(默认 = 夹具当前正文)
 *   · `notApplied`   —— 这些 tag 不出现在快照里(= 尚未应用,内容可以随便改,B11 不得判红)
 *   · `dropAll`      —— 产出**空**快照(用来证"0 行账本 ⇒ 未判定,不等于通过")
 */
export function ledgerSnapshotOf(entries, o = {}) {
  if (o.dropAll) return ''
  const skip = new Set(o.notApplied || [])
  const rows = []
  for (const e of entries) {
    if (skip.has(e.tag)) continue
    const body = (o.content && o.content[e.tag]) || FIXTURE_SQL
    rows.push(`${e.when}|${migrationSqlHash(body)}`)
  }
  return `${rows.join('\n')}\n`
}

/** 夹具仓里跑 git:绝对路径 + safe.directory + 身份 + timeout + windowsHide(§5b / 守门 52/80)。 */
export function gitIn(dir, gitArgs, { expectOk = true } = {}) {
  const bin = resolveGitBin()
  if (!bin) throw new Error('未解析到 git 可执行文件(resolveGitBin 全部候选失败)—— 夹具无法建立')
  const r = spawnSync(
    bin,
    [
      '-c',
      'safe.directory=*',
      '-c',
      'core.quotepath=false',
      '-c',
      'user.name=f',
      '-c',
      'user.email=f@l',
      '-C',
      dir,
      ...gitArgs,
    ],
    { encoding: 'utf8', windowsHide: true, timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  if (expectOk && r.status !== 0)
    throw new Error(`git ${gitArgs.join(' ')} 失败(status=${r.status}):${r.stderr}`)
  return String(r.stdout ?? '')
}

/** 建一个"已提交且记账合法"的夹具仓(n 条迁移)。 */
export function mkFixtureRepo(prefix, n = 2) {
  const dir = mkScratch(prefix)
  writeGateFixture(dir, n)
  gitIn(dir, ['init', '-q'])
  gitIn(dir, ['add', '-A'])
  gitIn(dir, ['commit', '-q', '--no-verify', '-m', 'gate49 fixture'])
  return dir
}

/**
 * 夹具的账本快照落点(**唯一一份实现**):把 `ledgerSnapshotOf` 的文本写到
 * `<root>/.ledger/snapshot.txt`,返回可直接喂 `--db-ledger` 的**相对路径**。
 * 相对 `--root` 解析 ⇒ 与门自己的 `resolve(ROOT, LEDGER_FILE)` 同一套基准,不会双根分裂。
 */
export function writeLedgerSnapshot(dir, text) {
  const abs = join(dir, FIXTURE_LEDGER_REL)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text)
  return FIXTURE_LEDGER_REL
}

/** 以 `--root <dir>` 跑本门自身(退出码与逐字输出才是守门对外的形状)。 */
export function runGateAt(dir, extra = [], extraEnv = {}) {
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...extra, '--root', dir], {
    cwd: dir,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180000,
    stdio: ['ignore', 'pipe', 'pipe'],
    // 应急跳过变量必须对子进程清掉,否则"跳过分支"会让整套取证在账面上全绿而什么都没判。
    // `extraEnv` 同理必须**显式**能覆盖 DATABASE_URL —— 取证一律不得连生产库(AGENTS §5 测试隔离铁律)。
    env: { ...process.env, HUSKY_SKIP_MIGRATION_BOOKKEEPING: '', ...extraEnv },
  })
  const strip = (s) => String(s ?? '').replace(/\x1b\[[0-9;]*m/g, '')
  return { code: r.status, out: strip(r.stdout), err: strip(r.stderr) }
}

/**
 * `--self-test`:成对正反例 + 临时 git 仓端到面。
 * 覆盖票面点名的五条:① 索引干净而磁盘脏 ⇒ `--staged` 不判红且点名;② 索引真缺登记 ⇒ 判红;
 * ③ 同一份内容 HEAD 档与索引档结论可不同;④ 面旗同给 ⇒ exit 2;⑤ 面取不到 ⇒ exit 2 不记绿。
 */
export function runSelfTest() {
  const results = []
  const ok = (name, cond, extra = '') =>
    results.push(`${cond ? '✅' : '❌'} ${name}${extra ? ` → ${extra}` : ''}`)
  const eq = (name, got, want) =>
    results.push(
      `${String(got) === String(want) ? '✅' : '❌'} ${name} → 实得 ${String(got)} / 期望 ${String(want)}`,
    )

  // ── 纯判据层(构造面可证,不依赖仓库瞬时状态)──
  eq(
    'P1 枚举只认 drizzle/ 恰好一层(NUL 分隔)',
    [
      ...sqlBasenamesFromListing(
        ['packages/database/drizzle/a.sql', 'packages/database/drizzle/meta/b.sql', ''].join('\0'),
      ),
    ].join(','),
    'a',
  )
  eq(
    'P1b 换行输出同样被读成清单(git 不认 -z 时不得退化成"0 个")',
    sqlBasenamesFromListing('packages/database/drizzle/c.sql\npackages/database/drizzle/d.sql\n')
      .size,
    2,
  )
  eq('P1c 空清单 ⇒ 0 个(由调用方判"空扫不记绿")', sqlBasenamesFromListing('').size, 0)
  eq(
    'P2 双向差集各自独立(B1 唯一实现)',
    JSON.stringify(diffJournalVsSql(['a', 'b'], ['b', 'c'])),
    JSON.stringify({ journalNoSql: ['a'], sqlNoJournal: ['c'] }),
  )
  eq(
    'P2b 同集合 ⇒ 两向都空',
    JSON.stringify(diffJournalVsSql(['a'], ['a'])),
    JSON.stringify({ journalNoSql: [], sqlNoJournal: [] }),
  )

  // ★ 本票的核心那一格:默认档不得再是磁盘
  eq('P3 faceFromArgv 默认 = head(不是磁盘)', faceFromArgv([]).face, 'head')
  eq('P3b --staged = staged', faceFromArgv(['--staged']).face, 'staged')
  eq('P3c --worktree = worktree(逃生舱仍在位)', faceFromArgv(['--worktree']).face, 'worktree')
  ok(
    'P3d 两面旗同给 ⇒ error(判死,不猜)',
    faceFromArgv(['--staged', '--worktree']).face === null &&
      /不得同用/.test(faceFromArgv(['--staged', '--worktree']).error || ''),
    JSON.stringify(faceFromArgv(['--staged', '--worktree'])),
  )
  eq(
    'P4 三面的 journal 规格互不相同(两面真的分开取)',
    [faceJournalSpec('head'), faceJournalSpec('staged'), faceJournalSpec('worktree')]
      .map((v) => v ?? 'null')
      .join('|'),
    `HEAD:${JOURNAL_REL}|:${JOURNAL_REL}|null`,
  )
  eq(
    'P4b 三面的 .sql 枚举命令互不相同',
    JSON.stringify([
      faceSqlListArgs('head'),
      faceSqlListArgs('staged'),
      faceSqlListArgs('worktree'),
    ]),
    JSON.stringify([
      ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', MIG_DIR_REL],
      ['ls-files', '-z', '--', MIG_DIR_REL],
      null,
    ]),
  )

  // 仅工作树脏的判序。porcelain 记录形状是 `XY␠path`,所以 `' M'` 后面那个空格**不能省**——
  // 省掉会让 slice(3) 咬掉路径首字符(第一版就这么错了一次,报出 "ackages/a.sql")。
  eq(
    'P5 " M"=仅工作树脏;M␠/ MM / ?? 都不算(正反成对)',
    worktreeOnlyDirtyPaths(
      parsePorcelainZ(
        [' M packages/a.sql', 'M  packages/b.sql', 'MM packages/c.sql', '?? packages/d.sql'].join(
          '\0',
        ),
      ),
    ).join(','),
    'packages/a.sql',
  )
  eq(
    'P5b 空 porcelain ⇒ 空数组(不得读成"有脏项")',
    worktreeOnlyDirtyPaths(parsePorcelainZ('')).length,
    0,
  )

  // 空枚举不得记绿
  let undEmpty = ''
  try {
    journalEntriesOf('{"version":7,"dialect":"postgresql","entries":[]}', 'X')
  } catch (e) {
    undEmpty = e instanceof Undetermined ? 'Undetermined' : 'Other'
  }
  eq('P6 journal entries 为 0 条 ⇒ Undetermined(空枚举不记绿)', undEmpty, 'Undetermined')
  let malformedKind = ''
  try {
    journalEntriesOf('{not json', 'X')
  } catch (e) {
    malformedKind = e instanceof Undetermined ? 'Undetermined' : 'Syntax'
  }
  eq('P6b 正文非法 JSON ⇒ 真红(SyntaxError 路径),不得被折成"无法判定"', malformedKind, 'Syntax')
  eq(
    'P6c 合法 journal ⇒ 正常返回条目数',
    String(journalEntriesOf('{"entries":[{"idx":0,"tag":"t","when":1}]}', 'X').entries.length),
    '1',
  )

  // ── 端到面(临时 git 仓)──
  const cleanup = []
  // 名字刻意**不以 use 开头**:eslint 的 react-hooks/rules-of-hooks 会把 `use(d)` 当 Hook 调用,
  // 而本仓 lint 判 `error`(实测 14 处红)—— 一个纯清理登记器不该撞上前端规则的形状判据。
  const keep = (d) => {
    cleanup.push(d)
    return d
  }
  try {
    // ① 索引干净 + 磁盘脏 ⇒ --staged 不判红且点名;同一夹具 --worktree 必须判红(配对)
    const d1 = keep(mkFixtureRepo('g49-s1'))
    const j1 = join(d1, JOURNAL_REL)
    const jObj = JSON.parse(readFileSync(j1, 'utf8'))
    jObj.entries.push({ idx: 2, tag: fixtureTagOf(2), when: 1760000300000 }) // 只改磁盘,不 add
    writeFileSync(j1, JSON.stringify(jObj, null, 2) + '\n')
    const s1 = runGateAt(d1, ['--staged'])
    const w1 = runGateAt(d1, ['--worktree'])
    ok(
      'E1a 索引干净而磁盘脏 ⇒ --staged exit 0(别人的在飞不是本枚的红)',
      s1.code === 0,
      `实得 ${s1.code}`,
    )
    ok(
      'E1b --staged 必须点名"仅工作树脏"并含该路径',
      /仅工作树脏/.test(s1.out) && s1.out.includes('_journal.json'),
      (s1.out.match(/受控路径另有[^\n]*/) || ['<无该行>'])[0],
    )
    eq('E1c 同一夹具 --worktree 档必须判红(配对:证明磁盘差异真实存在)', String(w1.code), '1')
    ok(
      'E1d --worktree 的红点名 journal 有条目缺 .sql',
      /B1 journal 有条目但缺 \.sql\(1\)/.test(w1.out),
    )

    // ② 索引里真的缺 journal 登记 ⇒ --staged 判红(配对:HEAD 档不背这一格)
    const d2 = keep(mkFixtureRepo('g49-s2'))
    writeFileSync(join(d2, MIG_DIR_REL, `${fixtureTagOf(2)}.sql`), 'SELECT 2;\n')
    gitIn(d2, ['add', '--', `${MIG_DIR_REL}/${fixtureTagOf(2)}.sql`])
    const s2 = runGateAt(d2, ['--staged'])
    const h2 = runGateAt(d2)
    eq('E2a .sql 进了索引而 journal 未登记 ⇒ --staged exit 1', String(s2.code), '1')
    ok(
      'E2b 且点名那一枚 .sql',
      /B1 \.sql 存在但 journal 未登记\(1\)/.test(s2.out) && s2.out.includes(fixtureTagOf(2)),
    )
    eq('E2c 同一夹具默认(HEAD)档 ⇒ exit 0(HEAD 里没有它,不据此判红)', String(h2.code), '0')

    // ③ 同一份内容,HEAD 档与索引档结论**可以不同**(两面真的分开取)
    const d3 = keep(mkFixtureRepo('g49-s3'))
    const j3 = join(d3, JOURNAL_REL)
    const o3 = JSON.parse(readFileSync(j3, 'utf8'))
    o3.entries.push({ idx: 2, tag: fixtureTagOf(2), when: 1760000300000 })
    writeFileSync(j3, JSON.stringify(o3, null, 2) + '\n')
    gitIn(d3, ['add', '-A', '--', MIG_DIR_REL])
    gitIn(d3, ['commit', '-q', '--no-verify', '-m', 'journal ahead of sql']) // HEAD 现在缺那枚 .sql
    writeFileSync(join(d3, MIG_DIR_REL, `${fixtureTagOf(2)}.sql`), 'SELECT 3;\n')
    gitIn(d3, ['add', '--', `${MIG_DIR_REL}/${fixtureTagOf(2)}.sql`]) // 索引把它补上了
    const h3 = runGateAt(d3)
    const s3 = runGateAt(d3, ['--staged'])
    eq('E3a HEAD 档:journal 在册而 .sql 不在 HEAD ⇒ exit 1', String(h3.code), '1')
    ok('E3b HEAD 档点名缺的那枚', /B1 journal 有条目但缺 \.sql\(1\)/.test(h3.out))
    eq(
      'E3c 索引档:同一时刻 .sql 已入索引 ⇒ exit 0(两档结论相反 = 面真的分开)',
      String(s3.code),
      '0',
    )

    // ④ 面旗同给 ⇒ exit 2
    const d4 = keep(mkFixtureRepo('g49-s4'))
    const x4 = runGateAt(d4, ['--staged', '--worktree'])
    eq('E4 --staged 与 --worktree 同给 ⇒ exit 2(判死,不猜哪一个)', String(x4.code), '2')
    ok('E4b 且写明两个面旗不得同用', /不得同用/.test(x4.err) && /无法判定/.test(x4.err))

    // ⑤ 面取不到 ⇒ exit 2 且不记绿;--worktree 在同一目录必须仍能判(逃生舱真的在位)
    const d5 = keep(mkScratch('g49-s5'))
    writeGateFixture(d5, 2) // 不 git init
    const h5 = runGateAt(d5)
    const s5 = runGateAt(d5, ['--staged'])
    const w5 = runGateAt(d5, ['--worktree'])
    eq('E5a 非 git 目录:默认(HEAD)档 ⇒ exit 2', String(h5.code), '2')
    eq('E5b 非 git 目录:--staged ⇒ exit 2', String(s5.code), '2')
    ok(
      'E5c 取不到面时不得出现"全部通过"或 B1 的绿结论',
      !/全部通过/.test(h5.out + h5.err) && !/✓ B1 双向一一对应/.test(h5.out),
    )
    eq('E5d 同一目录 --worktree ⇒ exit 0(磁盘面确实还在,只是不再默认)', String(w5.code), '0')

    // ⑥ 枚举到 0 个 .sql ⇒ exit 2(空扫不记绿),三面同判
    const d6 = keep(mkScratch('g49-s6'))
    writeGateFixture(d6, 2, { withSql: false })
    gitIn(d6, ['init', '-q'])
    gitIn(d6, ['add', '-A'])
    gitIn(d6, ['commit', '-q', '--no-verify', '-m', 'journal without sql'])
    const h6 = runGateAt(d6)
    const w6 = runGateAt(d6, ['--worktree'])
    eq('E6a HEAD 档枚举到 0 个 .sql ⇒ exit 2', String(h6.code), '2')
    ok('E6b 点名"枚举到 0 个 .sql"', /枚举到 0 个 \.sql/.test(h6.err))
    eq('E6c --worktree 档同样 0 个 ⇒ 同样 exit 2(三面都拒绝出空扫合格证)', String(w6.code), '2')

    // ⑧ journal 0 条 entries(而 .sql 存在)⇒ 三面都判死:0 条会让 B1–B4 全部退化成"无违规",
    //    那种绿与"根本没看"逐字同形 —— 必须与"记账合法"分开(空枚举不记绿)。
    const d8 = keep(mkScratch('g49-s8'))
    writeGateFixture(d8, 0)
    writeFileSync(join(d8, MIG_DIR_REL, `${fixtureTagOf(0)}.sql`), 'SELECT 8;\n')
    gitIn(d8, ['init', '-q'])
    gitIn(d8, ['add', '-A'])
    gitIn(d8, ['commit', '-q', '--no-verify', '-m', 'empty journal'])
    const h8 = runGateAt(d8)
    const s8 = runGateAt(d8, ['--staged'])
    const w8 = runGateAt(d8, ['--worktree'])
    ok(
      'E8 journal 0 条 entries ⇒ 三面一致 exit 2 并点名"空枚举"(不得出合格证)',
      h8.code === 2 &&
        s8.code === 2 &&
        w8.code === 2 &&
        /entries 缺失或为 0 条/.test(h8.err + s8.err + w8.err),
      `head=${h8.code} staged=${s8.code} worktree=${w8.code}`,
    )

    // ⑦ B10 的空闲性判据不受取材面收口影响(warn 级语义一字未动)
    const d7 = keep(mkFixtureRepo('g49-s7'))
    const a7 = runGateAt(d7)
    eq('E7a 干净夹具默认档 ⇒ exit 0', String(a7.code), '0')
    ok('E7b 且 B10 报空闲', /B10 空闲/.test(a7.out))
    writeFileSync(join(d7, FIXTURE_WATCH_OTHERS[0]), 'export { inFlight }\n')
    const b7 = runGateAt(d7)
    eq('E7c 别人在飞(仅工作树脏)⇒ 默认档退出码不变(warn 级)', String(b7.code), '0')
    ok('E7d 而 B10 必须点名有人在飞', /B10 未判定,有人在飞/.test(b7.out))
    eq('E7e --require-idle 才把它升成判红', String(runGateAt(d7, ['--require-idle']).code), '1')

    // ⑩ `--db` 档连不上库时:退出码语义一字不动(B6~B9 是"可选追加",本机无 PG 是常态),
    //    但汇总行**不得**声称"库内双射已对照"—— 那是替"没判"背书(把没判写成判过了)。
    const d9 = keep(mkFixtureRepo('g49-s9'))
    // 取证一律不得连生产库(AGENTS §5 测试隔离铁律):显式把 DATABASE_URL 清空,
    // 让 --db 一定走"没有 DSN ⇒ 跳过"那一支,而不是碰 8810。
    const g9 = runGateAt(d9, ['--db'], { DATABASE_URL: '' })
    eq('E9a --db 连不上库 ⇒ 退出码仍 0(既有语义一字未动)', String(g9.code), '0')
    ok(
      'E9b 而汇总行必须写"库内双射未判定"并给原因,不得写成"已对照"',
      /库内双射\*\*未判定\*\*/.test(g9.out) && !/库内双射已对照/.test(g9.out),
      (g9.out.match(/全部通过[^\n]*/) || ['<无汇总行>'])[0],
    )
    ok(
      'E9c 不带 --db 时汇总行不得出现库内那一维(无中生有也是谎)',
      !/库内双射/.test(runGateAt(d9).out),
    )

    // ══ B11(2026-09-28 立):已应用迁移的内容 ↔ 账本 hash 对账 ══════════════
    // 票面要求的四条成对取证,全部走 `--db-ledger` 快照通道 —— **不连库**(§5 测试隔离铁律)。
    // ① 构造"已应用迁移被改一个字符"⇒ 必点名;② 同一迁移未应用 ⇒ 不红;
    // ③ 离线无账本 ⇒ "未判定"且**不记绿**;④ 纯判据层的正反例(可构造,不靠仓库瞬时状态)。

    // ④ 纯判据层
    {
      const ents = [
        { tag: 'a', when: 10 },
        { tag: 'b', when: 20 },
      ]
      const bodies = new Map([
        ['a', 'SELECT 1;\n'],
        ['b', 'SELECT 1;\n'],
      ])
      const rowsOk = [
        { createdAt: 10, hash: migrationSqlHash('SELECT 1;\n') },
        { createdAt: 20, hash: migrationSqlHash('SELECT 1;\n') },
      ]
      const p0 = compareAppliedHashes(ents, bodies, rowsOk)
      eq('P7a 账本相符 ⇒ 0 分叉 / 2 已比对', `${p0.mismatch.length}/${p0.compared}`, '0/2')
      const rowsBad = [
        { createdAt: 10, hash: migrationSqlHash('SELECT 2;\n') },
        rowsOk[1],
      ]
      const p1 = compareAppliedHashes(ents, bodies, rowsBad)
      eq(
        'P7b 已应用但内容被改 ⇒ 恰 1 枚分叉且点名 tag',
        `${p1.mismatch.length}/${p1.mismatch[0]?.tag}`,
        '1/a',
      )
      // ② 未应用的同一枚 ⇒ 不得判红
      const p2 = compareAppliedHashes(ents, bodies, [rowsOk[1]])
      eq('P7c 未应用(账本里没有那一行)⇒ 0 分叉,计入 notApplied', `${p2.mismatch.length}/${p2.notApplied.join(',')}`, '0/a')
      // 正文取不到 ⇒ 未判定,既不是分叉也不是通过
      // 正文取不到 ⇒ 未判定,既不是分叉也不是通过('a' 根本不在 Map 里、'b' 显式 null ⇒ 两枚都算取不到)
      const p3 = compareAppliedHashes(ents, new Map([['b', null]]), rowsOk)
      eq('P7d 正文取不到 ⇒ 进 unreadable 而非 mismatch', `${p3.mismatch.length}/${p3.unreadable.join(',')}`, '0/a,b')
      eq('P7d2 取不到的枚数必须从 compared 里扣掉(不得混进"已比对")', `${p3.applied}/${p3.compared}`, '2/0')
      eq('P7e 空账本 ⇒ 全条落 notApplied,applied 0(不得读成"全对")', compareAppliedHashes(ents, bodies, []).applied, 0)
      eq('P7f 缺 tag 的条目 ⇒ 不造分叉,落 noTag 计数', compareAppliedHashes([{ when: 10 }], bodies, rowsOk).noTag, 1)
      // hash 配方必须逐字等于 drizzle 的那一把(用已知向量,而不是"自己算自己比")
      eq(
        'P7g migrationSqlHash 对已知向量的十六进制长度/值(sha256("SELECT 1;\\n") 前缀)',
        `${migrationSqlHash('SELECT 1;\n').length}/${migrationSqlHash('SELECT 1;\n').slice(0, 8)}`,
        `64/${createHash('sha256').update('SELECT 1;\n', 'utf8').digest('hex').slice(0, 8)}`,
      )
      eq('P7h 一个字符之差必须换掉整把 hash(判据有牙的最低要求)', String(migrationSqlHash('SELECT 1;\n') === migrationSqlHash('SELECT 2;\n')), 'false')
      eq('P7i 三面各取哪一份 .sql 规格互不相同', [faceSqlBlobSpec('head', 'x'), faceSqlBlobSpec('staged', 'x'), faceSqlBlobSpec('worktree', 'x')].map((v) => v ?? 'null').join('|'), `HEAD:${MIG_DIR_REL}/x.sql|:${MIG_DIR_REL}/x.sql|null`)
      eq(
        'P7j 账本行解析:同一形状供 psql 与快照文件用(缺 | 的行保留旧形状,不静默丢)',
        JSON.stringify(parseLedgerRows('10|abc\n\n20|def\n')),
        JSON.stringify([
          { createdAt: 10, hash: 'abc' },
          { createdAt: 20, hash: 'def' },
        ]),
      )
      eq('P7k --db-ledger 缺文件参数 ⇒ error(不猜路径)', ledgerFileFromArgv(['--db-ledger']).error !== null, 'true')
      eq('P7l --db-ledger=x 等号形态同样被认', ledgerFileFromArgv(['--db-ledger=x.txt']).file, 'x.txt')
    }

    // 端到端:先造一份**账本与盘面一致**的快照 ⇒ B11 必须绿(否则上面那条红可能是夹具坏了)
    const dB = keep(mkFixtureRepo('g49-b11-clean'))
    const cleanSnap = ledgerSnapshotOf(
      JSON.parse(readFileSync(join(dB, JOURNAL_REL), 'utf8')).entries,
    )
    const ledB = writeLedgerSnapshot(dB, cleanSnap)
    const b0 = runGateAt(dB, ['--db-ledger', ledB])
    eq('E10a 账本与内容一致 ⇒ exit 0', String(b0.code), '0')
    ok(
      'E10b 且必须逐枚报"已比对 2 枚相符"(不是只说没违规)',
      /✓ B11 2 枚已应用迁移的内容与账本 hash 逐枚相符\(2 枚等值\)/.test(b0.out),
      (b0.out.match(/B11 [^\n]*/) || ['<无>'])[0],
    )
    ok(
      'E10c 快照通道必须自报"没连库",不得让 B6~B9 混进通过结论',
      /B6~B9 未判定:--db-ledger 快照通道未连实时库/.test(b0.out) && !/库内双射已对照/.test(b0.out),
    )

    // ① 已应用迁移被改一个字符 ⇒ 必点名 + 给出"新增一枚迁移"的出口
    const dM = keep(mkFixtureRepo('g49-b11-modified'))
    const mEntries = JSON.parse(readFileSync(join(dM, JOURNAL_REL), 'utf8')).entries
    writeFileSync(join(dM, MIG_DIR_REL, `${fixtureTagOf(1)}.sql`), FIXTURE_SQL_TAMPERED)
    gitIn(dM, ['add', '-A', '--', MIG_DIR_REL])
    gitIn(dM, ['commit', '-q', '--no-verify', '-m', 'edit an APPLIED migration in place'])
    const ledM = writeLedgerSnapshot(dM, ledgerSnapshotOf(mEntries))
    const m1 = runGateAt(dM, ['--db-ledger', ledM])
    eq('E11a 改一枚已应用迁移的一个字符 ⇒ exit 1', String(m1.code), '1')
    ok('E11b 且点名那一枚 tag', m1.err.includes(fixtureTagOf(1)) || m1.out.includes(fixtureTagOf(1)))
    ok(
      'E11c 且给出唯一修法那句(历史迁移不可变,请新增一枚迁移)',
      /历史迁移不可变,请新增一枚迁移/.test(m1.out + m1.err) &&
        /Historical migrations are immutable; add a new migration instead\./.test(m1.out + m1.err),
    )
    ok(
      'E11d 只有那一枚被计分叉(计数恰为 1,未动的条目不被牵连)',
      /B11 有 1 枚\*\*已应用\*\*迁移的内容与账本 hash 不符:/.test(m1.out) &&
        !new RegExp(`不符:[^\\n]*${fixtureTagOf(0)}`).test(m1.out),
      (m1.out.match(/B11 有[^\n]*/) || ['<无该行>'])[0],
    )
    // ② 同一枚内容被改,但账本里**没有**它(= 尚未应用)⇒ 不红
    const dN = keep(mkFixtureRepo('g49-b11-notapplied'))
    const nEntries = JSON.parse(readFileSync(join(dN, JOURNAL_REL), 'utf8')).entries
    writeFileSync(join(dN, MIG_DIR_REL, `${fixtureTagOf(1)}.sql`), FIXTURE_SQL_TAMPERED)
    gitIn(dN, ['add', '-A', '--', MIG_DIR_REL])
    gitIn(dN, ['commit', '-q', '--no-verify', '-m', 'edit a NOT-YET-APPLIED migration'])
    const ledN = writeLedgerSnapshot(
      dN,
      ledgerSnapshotOf(nEntries, { notApplied: [fixtureTagOf(1)] }),
    )
    const n1 = runGateAt(dN, ['--db-ledger', ledN])
    eq('E12a 未应用的新迁移被改内容 ⇒ exit 0(它的内容当然还可以改)', String(n1.code), '0')
    ok(
      'E12b 而它必须被**报名**(点名 tag,不是被静默吃掉)',
      /账本里没有其 when 的 journal 条目 1 条\(未应用的新迁移:/.test(n1.out) &&
        n1.out.includes(fixtureTagOf(1)),
      (n1.out.match(/账本里没有其 when[^\n]*/) || ['<无该行>'])[0],
    )
    // 同一夹具但账本一行都没有(= 空库,`check-migration-from-zero` 的真实形态)⇒ 未判定,不记绿
    const ledE = writeLedgerSnapshot(dN, ledgerSnapshotOf(nEntries, { dropAll: true }))
    const n2 = runGateAt(dN, ['--db-ledger', ledE])
    eq('E12c 空账本 ⇒ exit 0(不新增恒红门)', String(n2.code), '0')
    ok('E12d 但 B11 必须喊未判定,不得读成"已比对"', /B11 \*\*未判定\*\*/.test(n2.out) && !/已比对/.test(n2.out))
    // 反向:账本**非空**而没有一行对得上 ⇒ 那一格是"没判过",不是"判过且干净",也不是分叉
    const ledZ = writeLedgerSnapshot(
      dN,
      '999999|0000000000000000000000000000000000000000000000000000000000000000\n',
    )
    const n3 = runGateAt(dN, ['--db-ledger', ledZ])
    eq('E12e 账本有行而无一对得上 ⇒ 默认档 exit 0 但报名"一枚都没比过"', String(n3.code), '0')
    ok(
      'E12f 措辞必须是"没判过"(不得伪装成分叉计数,也不得读成通过)',
      /一枚都没比过/.test(n3.out) && !/B11 有 \d+ 枚/.test(n3.out),
      (n3.out.match(/B11 \*\*未判定\*\*[^\n]*/) || ['<无该行>'])[0],
    )
    eq('E12g 同一夹具 --strict ⇒ exit 1(问责档拒绝为"没判过"出合格证)', String(runGateAt(dN, ['--db-ledger', ledZ, '--strict']).code), '1')

    // ③ 离线档(不给 --db / --db-ledgder)⇒ 未判定 + 原因 + 不改退出码;--strict 才判死
    const dO = keep(mkFixtureRepo('g49-b11-offline'))
    const o1 = runGateAt(dO)
    eq('E13a 离线档 exit 0(提交链不带 --db ⇒ 不得新增恒红门)', String(o1.code), '0')
    ok('E13b 但 B11 必须喊"未判定"并给原因', /B11 \*\*未判定\*\* —— 原因:离线档/.test(o1.out), (o1.out.match(/B11 [^\n]*/) || ['<无该行>'])[0])
    ok('E13c 且汇总行带着那一维(不得读起来像全绿)', /B11 未判定/.test(o1.out) && !/B11 已比对/.test(o1.out))
    eq('E13d 同一夹具 --strict ⇒ exit 1(问责档拒绝出合格证)', String(runGateAt(dO, ['--strict']).code), '1')
    ok('E13e --strict 的红必须点名 B11', /B11 --strict/.test(runGateAt(dO, ['--strict']).err))

    // ④ 两个账本来源同给 ⇒ 判死,不猜用哪一份
    const dX = keep(mkFixtureRepo('g49-b11-twosources'))
    const ledX = writeLedgerSnapshot(
      dX,
      ledgerSnapshotOf(JSON.parse(readFileSync(join(dX, JOURNAL_REL), 'utf8')).entries),
    )
    eq(
      'E14 --db 与 --db-ledger 同给 ⇒ exit 2(两个账本来源互斥)',
      String(runGateAt(dX, ['--db', '--db-ledger', ledX], { DATABASE_URL: '' }).code),
      '2',
    )
    // ⑤ 缺文件参数的 --db-ledger ⇒ 判死而不是拿 undefined 当路径
    eq(
      'E14b --db-ledger 后面没给文件 ⇒ exit 2 并点名用法',
      String(runGateAt(dX, ['--db-ledger']).code),
      '2',
    )

    // ⑥ 真仓的离线形态在本机就是常态:上面 E13 已覆盖"无账本 ⇒ 未判定",这里补一条
    //    **反向锁**:未判定不得被打印成"已比对 N 枚"(那是把没判写成判过了)。
    ok(
      'E15 反向锁:离线档里不得出现"已比对"字样',
      !/已比对/.test(o1.out),
    )
  } catch (e) {
    results.push(`❌ 端到面夹具建立失败:${String(e?.message ?? e).split(/\r?\n/)[0]}`)
  } finally {
    for (const d of cleanup) {
      try {
        rmScratch(d)
      } catch {
        /* 夹具清理失败不得掩盖判据结论 */
      }
    }
  }

  for (const r of results) console.log(r)
  const failed = results.filter((r) => r.startsWith('❌')).length
  console.log(
    failed
      ? `❌ self-test 失败 ${failed}/${results.length} 条`
      : `✅ self-test 全通过(${results.length} 条)`,
  )
  process.exit(failed ? 1 : 0)
}

// §22d:本文件顶层就是 CLI(import 它会连带跑完 B1-B5 并按结果 process.exit)。isDirectRun 守卫
// 让镜像测试能**直接 import 上面的判据函数与夹具**而不触发副作用 —— §22c 的红线是"测试不得复制
// 源函数实现",没有守卫就只能 spawn,而 spawn 版测不到判据函数的分支构造面。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  // 应急跳过(与仓库其它守门一致): HUSKY_SKIP_MIGRATION_BOOKKEEPING=1 git commit ...
  if (process.env.HUSKY_SKIP_MIGRATION_BOOKKEEPING === '1') {
    console.log('[迁移记账] ⏭  已按 HUSKY_SKIP_MIGRATION_BOOKKEEPING=1 跳过')
    process.exit(0)
  }
  // 取证档不参与判定面(它自建临时 git 仓,不读真仓内容)
  if (args.includes('--self-test')) runSelfTest()

  const C = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    dim: '\x1b[2m',
    bold: '\x1b[1m',
    reset: '\x1b[0m',
  }
  const fail = []
  const warn = []
  function ok(msg) {
    console.log(`  ${C.green}✓${C.reset} ${msg}`)
  }
  function bad(msg) {
    fail.push(msg)
    console.log(`  ${C.red}✗${C.reset} ${msg}`)
  }
  function wa(msg) {
    warn.push(msg)
    console.log(`  ${C.yellow}!${C.reset} ${msg}`)
  }

  /** 判定面取不到 ⇒ 判「无法判定」并点名原因:既不冒红(不得据它定责提交者),也绝不记绿。 */
  function undetermined(msg) {
    console.error(`${C.red}[迁移记账] ✗ 无法判定(exit 2):${msg}${C.reset}`)
    console.error(
      `${C.dim}  这不是"记账合法",是"这一格没判"。取不到判定面通常是:journal 未入库 / 已被暂存删除 / ` +
        `merge 中 unmerged / 该目录不在 git 工作树内 / 该面枚举到 0 个 .sql。` +
        `本门**不回落**到另一个面(回落就是把"没判"写成"判过了");修好取材面再跑,` +
        `或按应急路径手工核验(不得当成通过)。${C.reset}`,
    )
    process.exit(2)
  }

  // ---------- 判定面选择(默认 HEAD blob;两旗同给判死)----------
  const FACE_SEL = faceFromArgv(args)
  if (FACE_SEL.error) undetermined(`面旗自相矛盾:${FACE_SEL.error}`)
  const FACE = FACE_SEL.face
  console.log(
    `${C.bold}[迁移记账] 判定面 = ${FACE_TXT[FACE]}${C.reset}`,
    FACE === 'worktree' ? `${C.yellow}(逃生舱:结论只代表本机磁盘,不得当提交门禁)${C.reset}` : '',
  )

  // ---------- B5: journal 结构(与 B1 **同面同轮**取材)----------
  let journalRaw
  let sqls
  try {
    const audit = readAuditFace(ROOT, FACE)
    journalRaw = audit.journalText
    sqls = audit.sqls
  } catch (e) {
    // readAuditFace 只会抛 Undetermined(取不到面),不会抛"正文坏了"—— 正文在本段之后才解析。
    // 这里刻意**不回落**到另一个面:回落就是把"没判"写成"判过了"(守门 93/124 同一条禁令)。
    undetermined(e instanceof Undetermined ? e.message : `取材异常:${faceErrText(e)}`)
  }
  let journal
  try {
    journal = journalEntriesOf(journalRaw, FACE_TXT[FACE])
  } catch (e) {
    if (e instanceof Undetermined) undetermined(e.message)
    // 非法 JSON **不是**"取不到":被审正文真的坏了是真红(exit 1)。
    // 两种颜色必须在账面上可分,否则"解析器读不懂"会被下游报成"这一格没判"(§5d 同族)。
    console.error(
      `${C.red}[迁移记账] ${JOURNAL_REL}(@${FACE})不是合法 JSON: ${faceErrText(e)}${C.reset}`,
    )
    process.exit(1)
  }
  console.log(`${C.bold}[迁移记账] journal 结构${C.reset}`)
  const malformed = journal.entries.filter(
    (e) => typeof e.idx !== 'number' || !e.tag || typeof e.when !== 'number',
  )
  if (malformed.length)
    bad(`B5 有 ${malformed.length} 个 entry 缺 idx/tag/when(如 ${malformed[0].tag ?? '<无 tag>'})`)
  else
    ok(
      `B5 journal 结构完整(version=${journal.version}, dialect=${journal.dialect}, ${journal.entries.length} 条)`,
    )

  // ---------- 集合准备 ----------
  const tags = journal.entries.map((e) => e.tag)
  const whens = journal.entries.map((e) => e.when)
  const idxs = journal.entries.map((e) => e.idx)
  // `sqls` 与 journal 正文**同面同轮**(见 readAuditFace):别人只在磁盘/只在索引的 .sql
  // 因此结构上进不了"另一个面"的判定面 —— 各面只判自己这一份,不混。

  // ---------- B1: 双向一一对应 ----------
  console.log(`${C.bold}[迁移记账] journal ↔ .sql 对应${C.reset}`)
  {
    const { journalNoSql, sqlNoJournal } = diffJournalVsSql(tags, sqls)
    if (journalNoSql.length)
      bad(
        `B1 journal 有条目但缺 .sql(${journalNoSql.length}): ${journalNoSql.slice(0, 5).join(', ')}`,
      )
    if (sqlNoJournal.length)
      bad(
        `B1 .sql 存在但 journal 未登记(${sqlNoJournal.length}): ${sqlNoJournal.slice(0, 5).join(', ')}`,
      )
    if (!journalNoSql.length && !sqlNoJournal.length)
      ok(`B1 双向一一对应(${tags.length} ↔ ${sqls.length})`)
    // **「没算进来」与「没有」必须可分**(本仓最高频失效型是"一次放过读起来像一次通过")。
    // 三档各有一行自证:点名本面之外还躺着什么,并明写**不据此判红**。
    const selfProof = faceSelfProof(ROOT, FACE, sqls)
    for (const line of selfProof) console.log(`  ${C.dim}${line}${C.reset}`)
  }

  // ---------- B2: tag 唯一 ----------
  console.log(`${C.bold}[迁移记账] 标识唯一性${C.reset}`)
  {
    const seen = new Set()
    const dup = []
    for (const t of tags) {
      if (seen.has(t)) dup.push(t)
      seen.add(t)
    }
    if (dup.length) bad(`B2 tag 重复(${dup.length}): ${[...new Set(dup)].slice(0, 5).join(', ')}`)
    else ok('B2 tag 唯一')
  }

  // ---------- B3: when 严格递增且唯一 ----------
  {
    const uniq = new Set(whens)
    if (uniq.size !== whens.length) {
      const dup = whens.filter((w, i) => whens.indexOf(w) !== i)
      bad(
        `B3 when 存在重复(${new Set(dup).size} 个值): ${[...new Set(dup)].slice(0, 5).join(', ')}`,
      )
    }
    let mono = true
    for (let i = 1; i < whens.length; i++) if (whens[i] <= whens[i - 1]) mono = false
    if (!mono) bad('B3 when 非严格递增(drizzle 按 when 判定是否应用,顺序错乱会漏跑迁移)')
    if (mono && uniq.size === whens.length) ok('B3 when 严格递增且唯一')
  }

  // ---------- B4: idx(仅告警) ----------
  {
    const uniq = new Set(idxs)
    if (uniq.size !== idxs.length) bad(`B4 idx 存在重复(${idxs.length - uniq.size} 个)`)
    else {
      const gaps = []
      const sorted = [...idxs].sort((a, b) => a - b)
      for (let i = 1; i < sorted.length; i++)
        if (sorted[i] !== sorted[i - 1] + 1) gaps.push(`${sorted[i - 1]}→${sorted[i]}`)
      if (gaps.length)
        wa(
          `B4 idx 断号(非阻塞): ${gaps.join(', ')} —— drizzle 按 tag 配对 SQL、按 when 排序,idx 仅元数据`,
        )
      else ok('B4 idx 唯一且连续')
    }
  }

  // ---------- B6~B8: 库内记账双射(可选) ----------
  // 账本来源只能有一个:`--db` 问实时库,`--db-ledger` 喂落盘快照。同给 ⇒ 两个来源可能互异,
  // 猜哪一个都会产出一张自洽却错位的合格证(与 `--staged`/`--worktree` 同给判死同一条规矩)。
  if (LEDGER_ARG.error) undetermined(`--db-ledger 用法错:${LEDGER_ARG.error}`)
  if (wantDb && LEDGER_FILE)
    undetermined(
      '--db(实时库)与 --db-ledger(落盘快照)不得同用(两个账本来源互斥,判死而不是猜用哪一份)',
    )
  /**
   * 库内这一维**是否真的判过**。汇总行据此说话:此前它无条件写"+ 库内双射",
   * 而 psql 不可用时 B6~B9 一条都没判 ⇒ 那句是在替"没判"背书(本仓最高频失效型:
   * 把没判写成判过了)。判据一条未改,只把结论行的措辞与实态对齐。
   */
  let dbVerdict = null
  /**
   * B11 需要的账本行(`[{createdAt, hash}]`)与"没拿到"的原因。**刻意分成两个变量而不是一个 null**:
   * 拿不到时必须能说出**为什么**拿不到(离线档 / 无 DSN / psql 失败 / 快照文件读不到)——
   * "B11 未判定"若不给原因,读报告的人会以为它判过且没事(把没判写成判过了,本仓最高频失效型)。
   */
  let ledgerRows = null
  let ledgerWhyNot = '离线档未连库(默认判定面里没有账本 hash 这一维)'
  if (wantDb) {
    console.log(`${C.bold}[迁移记账] 库内 drizzle.__drizzle_migrations 双射${C.reset}`)
    let dsn = process.env.DATABASE_URL || ''
    if (!dsn) {
      const envPath = join(ROOT, 'apps/api/.env')
      if (existsSync(envPath)) {
        const line = readFileSync(envPath, 'utf8')
          .split(/\r?\n/)
          .find((l) => /^\s*DATABASE_URL\s*=/.test(l))
        if (line)
          dsn = line
            .replace(/^\s*DATABASE_URL\s*=\s*/, '')
            .trim()
            .replace(/^["']|["']$/g, '')
      }
    }
    if (!dsn) {
      wa('B6~B8 跳过:未找到 DATABASE_URL(env 或 apps/api/.env)')
      dbVerdict = '没有 DATABASE_URL 可连(env 与 apps/api/.env 都没给)'
      ledgerWhyNot = dbVerdict
    } else {
      const psqlCandidates = [
        process.env.IHUI_PSQL,
        'D:\\DevEnv\\runtimes\\pgsql\\bin\\psql.exe',
        'psql',
      ].filter(Boolean)
      const psql = psqlCandidates.find((p) => p === 'psql' || existsSync(p))
      try {
        const out = execFileSync(
          psql,
          [
            '-d',
            dsn,
            '-t',
            '-A',
            '-F',
            '|',
            '-c',
            'SELECT created_at, hash FROM drizzle.__drizzle_migrations ORDER BY created_at',
          ],
          // 守门 80 同一条禁令:热路径的派生一律带 timeout + windowsHide —— 无界 psql 会把
          // 整条提交链挂住(本仓实测过一次 80 分钟的 execSync 挂起,而 git status/typecheck 全看不出来)。
          {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
            timeout: Number(process.env.IHUI_B49_PSQL_TIMEOUT_MS) || 120000,
            maxBuffer: 16 << 20,
          },
        )
        const rows = parseLedgerRows(out)
        // 账本行为空 ⇒ 没有一枚迁移被记成"已应用",B11 无从比对。
        // 这一格**不得**被读成"B11 通过":空账本的通过样子与"全对"逐字同形(三态不并桶)。
        if (rows.length === 0)
          ledgerWhyNot =
            '库内账本为空(0 行)⇒ 没有任何一枚迁移被记为"已应用",B11 无从比对 —— 不等于内容没被改过'
        else ledgerRows = rows
        dbVerdict = 'judged'
        const dbWhens = rows.map((r) => r.createdAt).filter((n) => Number.isFinite(n))
        if (dbWhens.length !== whens.length)
          bad(`B6 行数不符: 库 ${dbWhens.length} vs journal ${whens.length}`)
        else ok(`B6 行数一致(${dbWhens.length})`)
        // B9: hash 合法性 —— 防再现 2026-09-13 的污染形态(153 个重复 hash + `NOFILE:`/`manual_` 伪值)
        {
          const badFmt = rows.filter((r) => !/^[0-9a-f]{64}$/.test(r.hash))
          const seen = new Set()
          const dup = []
          for (const r of rows) {
            if (seen.has(r.hash)) dup.push(r.hash)
            seen.add(r.hash)
          }
          if (badFmt.length)
            bad(`B9 有 ${badFmt.length} 行 hash 非合法 sha256(如 '${badFmt[0].hash.slice(0, 24)}')`)
          else if (dup.length) bad(`B9 有 ${new Set(dup).size} 个重复 hash(污染形态)`)
          else ok(`B9 ${rows.length} 行 hash 全为合法 sha256 且唯一`)
        }
        const a = [...whens].sort((x, y) => x - y)
        const b = [...dbWhens].sort((x, y) => x - y)
        const same = a.length === b.length && a.every((v, i) => v === b[i])
        if (same) ok('B7 created_at 集合与 journal when 集合严格双射')
        else {
          const bs = new Set(b)
          const as = new Set(a)
          bad(
            `B7 双射破裂: 仅 journal 有 ${a
              .filter((x) => !bs.has(x))
              .slice(0, 3)
              .join(',')} / 仅库有 ${b
              .filter((x) => !as.has(x))
              .slice(0, 3)
              .join(',')}`,
          )
        }
        const dbMax = b.length ? b[b.length - 1] : -1
        const jMax = a.length ? a[a.length - 1] : -1
        if (dbMax === jMax) ok(`B8 max 一致(${jMax})→ migrate 不会空转,也不会重跑`)
        else if (dbMax > jMax)
          bad(
            `B8 库内 max(${dbMax})> journal max(${jMax})→ migrate 将恒空转(本仓 2026-09-13 故障形态)`,
          )
        else wa(`B8 journal max(${jMax})> 库内 max(${dbMax})→ 存在待应用迁移(下一轮 deploy 会应用)`)
      } catch (e) {
        wa(`B6~B8 跳过:psql 执行失败(${String(e.message).split('\n')[0]})`)
        dbVerdict = `psql 执行失败(${String(e.message).split('\n')[0]})`
        ledgerWhyNot = dbVerdict
      }
    }
  }

  // ---------- 快照通道:--db-ledger <psql 原样输出落盘件>(B11 专用,B6~B9 不判) ----------
  // 为什么允许它存在(它不是"伪造通过"的后门):① 本仓 §5 测试隔离铁律禁止取证连生产库,而本机
  // 无 PG(8810/8811 零监听实测)⇒ 没有这一档,B11 的成对取证就只能"永远判不到";② 落盘件是
  // 部署机 psql 的原样输出,拿它比对与拿实时库比对**是同一把判据、同一份解析实现**(parseLedgerRows),
  // 差别只在时效。差别必须在输出里喊出来,所以这一段自报"来源 = 快照文件,没有连库"。
  if (LEDGER_FILE) {
    console.log(`${C.bold}[迁移记账] 库内账本来源 = --db-ledger 快照文件${C.reset}`)
    // B6~B9 判的是**库内实时状态**,快照通道没连库 ⇒ 那两维一律未判定(汇总行据此说话,
    // 不得让它读起来像"实时双射也对照过")。
    dbVerdict = '走 --db-ledger 快照通道,未连实时库'
    wa('B6~B9 未判定:--db-ledger 快照通道未连实时库(只有 B11 用这份账本)')
    let snapText = null
    let snapErr = ''
    try {
      snapText = readFileSync(resolve(ROOT, LEDGER_FILE), 'utf8')
    } catch (e) {
      snapErr = String(e.message).split('\n')[0]
    }
    if (typeof snapText !== 'string') {
      ledgerWhyNot = `快照文件读不到(${LEDGER_FILE}):${snapErr}`
      wa(`B11 未判定:账本快照文件读不到(${LEDGER_FILE})`)
    } else {
      const rows = parseLedgerRows(snapText)
      console.log(
        `  ${C.dim}取自 ${LEDGER_FILE}:${rows.length} 行账本(格式 = psql -t -A -F'|' 的 SELECT created_at, hash 输出)` +
          `;B6~B9 判的是**库内实时状态**,本通道未连库 ⇒ 那两维**未判定**,不得读成"已对照"。${C.reset}`,
      )
      if (rows.length === 0)
        ledgerWhyNot =
          '快照文件里 0 行账本 ⇒ 没有任何一枚迁移被记为"已应用",B11 无从比对 —— 不等于内容没被改过'
      else ledgerRows = rows
    }
  }

  // ---------- B11: 已应用迁移的「.sql 内容 ↔ 账本 hash」对账 ----------
  // 这一格此前**没有任何尺子**(2026-09-28 现读:本门 B9 只看库内 hash 的形状与唯一性,从不读
  // `drizzle/*.sql` 的正文;`check-migration-from-zero.mjs` 里 `hash|checksum|sha256` 命中 0)。
  // 而 drizzle 自己永远不会发现它 —— `pg-core/dialect.js:62` 只比 `created_at`,hash 写进去就没人读回来,
  // 所以"改一枚已应用 .sql 的一个字符"是 **P1 静默分叉**:库里永远是旧结构,git 里那份永远没人执行。
  // 判据三条刻意的选择:
  //   ① 只对**账本里有那一行**的 tag 比(未应用的新迁移内容当然还可以改 ⇒ 不得判红);
  //   ② 正文与 journal **同面同轮**取(默认 HEAD blob / `--staged` 索引 blob / `--worktree` 磁盘),
  //      不另开一次磁盘读 —— 混面会产出自洽却错位的尺子(守门 101/118 各记过同型);
  //   ③ 没有账本 ⇒ **未判定 + 原因**,绝不记绿;`--strict` 才把"未判定"升成判死。
  console.log(`${C.bold}[迁移记账] B11 已应用迁移内容 ↔ 账本 hash 对账${C.reset}`)
  let b11Summary = ''
  if (!ledgerRows) {
    b11Summary = `未判定:${ledgerWhyNot}`
    console.log(`  ${C.yellow}!${C.reset} B11 **未判定** —— 原因:${ledgerWhyNot}`)
    console.log(
      `  ${C.dim}这一格不代表"迁移内容没被改过":没有账本可比,就没人知道有没有人动过已应用的 .sql。` +
        `问责出口:pnpm migration:check:db(在线)或 --db-ledger <部署机 psql 落盘件>(离线取证)。${C.reset}`,
    )
    if (strict) bad(`B11 --strict:库内账本对账未判定 —— ${ledgerWhyNot}`)
  } else {
    let bodies = null
    try {
      // 只读"账本里已存在那一行"的 tag(在线时是几百枚,一次 cat-file --batch 读完,层按字节装箱)
      const appliedTags = journal.entries
        .filter((e) => ledgerRows.some((r) => Number(r.createdAt) === Number(e.when)))
        .map((e) => e.tag)
        .filter((t) => typeof t === 'string')
      bodies = readSqlBodies(ROOT, FACE, appliedTags)
    } catch (e) {
      bodies = null
      b11Summary = '未判定:正文取材失败'
      console.log(
        `  ${C.yellow}!${C.reset} B11 **未判定** —— ${FACE_TXT[FACE]} 的 .sql 正文取不到:${faceErrText(e)}`,
      )
      if (strict) bad(`B11 --strict:正文取材失败 ⇒ 这一格没判(${faceErrText(e)})`)
    }
    if (bodies) {
      const r = compareAppliedHashes(journal.entries, bodies, ledgerRows)
      b11Summary = `已比对 ${r.compared} / 账本内 ${r.applied} / 未应用 ${r.notApplied.length} / 未判定 ${r.unreadable.length}`
      if (r.mismatch.length) {
        bad(
          `B11 有 ${r.mismatch.length} 枚**已应用**迁移的内容与账本 hash 不符:` +
            r.mismatch
              .slice(0, 8)
              .map((m) => m.tag)
              .join(', ') +
            (r.mismatch.length > 8 ? ' …' : ''),
        )
        for (const m of r.mismatch.slice(0, 8)) {
          const eolNote = m.eolOnly
            ? ` ${C.yellow}(差异看起来只出在行尾:换行归一后同值 —— 但账本是对当时磁盘字节算的,仍按分叉计)${C.reset}`
            : ''
          console.log(
            `    ${C.red}${m.tag}${C.reset} when=${m.when} 账本=${m.ledgerHash.slice(0, 16)}… 现算=${m.computedHash.slice(0, 16)}…${eolNote}`,
          )
        }
        console.log(
          `  ${C.red}${MIGRATION_IMMUTABLE_HINT}${C.reset}\n` +
            `  ${C.dim}禁止的处置:改 .sql 去凑 hash、或"重算并覆盖账本 hash"(那是给分叉发通行证)。` +
            `运行时也不会替你发现它 —— drizzle 只比 created_at,hash 从不读回(${C.reset}` +
            `${C.dim}packages/database/node_modules/drizzle-orm/pg-core/dialect.js:62)。\n` +
            `  把改动挪成一枚**新迁移**,或确认账本本身可信后用 --db 复核库内实时状态。${C.reset}`,
        )
      } else if (r.compared === 0) {
        // 账本非空而一枚都没可比 ⇒ 那一格仍然是"没判",不得读成通过(三态不并桶)
        b11Summary = '未判定:账本里没有与 journal when 对应的行'
        console.log(
          `  ${C.yellow}!${C.reset} B11 **未判定** —— 账本 ${ledgerRows.length} 行而 journal 里没有任何一条的 when 能对上,` +
            `一枚都没比过(这是 B7 双射破裂的下游症状,别把它读成"B11 干净")`,
        )
        if (strict) bad('B11 --strict:账本与 journal 无一对应 ⇒ 内容不可变性这一格没判')
      } else {
        ok(`B11 ${r.compared} 枚已应用迁移的内容与账本 hash 逐枚相符(${r.ok} 枚等值)`)
      }
      if (r.unreadable.length) {
        wa(
          `B11 另有 ${r.unreadable.length} 枚已应用迁移的 .sql 正文在${FACE}面取不到(未判定,不等于通过):` +
            r.unreadable.slice(0, 5).join(', '),
        )
        if (strict) bad(`B11 --strict:${r.unreadable.length} 枚正文取不到 ⇒ 这一格没判`)
      }
      if (r.notApplied.length)
        console.log(
          `  ${C.dim}账本里没有其 when 的 journal 条目 ${r.notApplied.length} 条(未应用的新迁移:` +
            `${r.notApplied.slice(0, 5).join(', ')}${r.notApplied.length > 5 ? ' …' : ''})` +
            `—— 内容可以改,**B11 一律不判红**;下一轮 migrate 会应用它们。${C.reset}`,
        )
    }
  }

  // ---------- B10: journal 登记表是否「无人在飞」(warn 级,不并入 B1-B5 判红面) ----------
  // 口径要点(三条都是刻意选择,改前三思):
  //   ① 判的是**工作树 + 索引 + 未跟踪面**,不是 HEAD blob —— 本门问的就是"此刻有没有别人
  //      正在改这张登记表",按 HEAD 判永远得到"空闲",等于没有这道判据。
  //      (与 B1-B5 的取材面不同是**有意**的:B1-B5 判"账目结构在所选面上是否合法"(默认 HEAD blob、
  //       `--staged` 索引 blob),B10 判"登记表当前无人动"。收口 B1-B5 的取材面时**不要**顺手把
  //       B10 也改成 HEAD —— 那会把这一格判成恒"空闲"。)

  //   ② 只报不判红。别人的在飞改动不是本次提交的错,与改动无关的 blocking 红只会逼人
  //      --no-verify 并连带废掉全部守门(AGENTS §12e 同型)。问责出口是 --require-idle。
  //   ③ 刻意**不调用 wa()**:wa() 会计入末尾「N 条告警」计数,而那个计数是 B1-B4 的口径。
  //      B10 只新增自己的段落 + 一行独立小结,既有输出行逐字不变、退出码语义一字不动。
  const B10_WATCH = [
    'packages/database/drizzle/meta/_journal.json',
    'packages/database/src/schema/chat.ts',
    'packages/database/src/schema/relation-tables.ts',
    'apps/api/src/routes/chat.ts',
    'apps/api/src/db/chat-queries.ts',
  ]
  const B10_MIG_DIR = 'packages/database/drizzle'
  const GIT_READ_TIMEOUT_MS = Number(process.env.IHUI_B10_GIT_TIMEOUT_MS) || 15000

  /** git 只读调用:绝对路径 + safe.directory=* + windowsHide + timeout(AGENTS.md §5b / 守门 80) */
  function gitReadonly(gitArgs) {
    const bin = resolveGitBin()
    if (!bin) throw new Error('未解析到 git 可执行文件(resolveGitBin 全部候选失败)')
    return execFileSync(bin, ['-c', 'safe.directory=*', '-C', ROOT, ...gitArgs], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: GIT_READ_TIMEOUT_MS,
    })
  }

  /** porcelain XY → 人话状态;同一路径多行取"更脏"的那一条 */
  function classifyXy(xy) {
    if (xy.includes('U')) return { text: '未合并(merge 冲突中)', rank: 4 }
    const x = xy[0] ?? ' '
    const y = xy[1] ?? ' '
    if (x === '?') return { text: '未跟踪', rank: 3 }
    if (x !== ' ')
      return y !== ' ' ? { text: '已暂存 + 工作树另有改动', rank: 3 } : { text: '已暂存', rank: 3 }
    if (y !== ' ') return { text: '仅工作树脏', rank: 2 }
    return { text: '干净', rank: 0 }
  }

  /**
   * 探针:返回 { verdict: 'idle'|'busy'|'undetermined', paths:[{path,state}], untrackedSql:[...], reason? }
   * 取不到 git 状态 ⇒ verdict='undetermined' 且**绝不记为空闲**(失败必须响,B10 静默绿 = 没有)。
   */
  function probeJournalIdle() {
    let inside = ''
    try {
      inside = gitReadonly(['rev-parse', '--is-inside-work-tree']).trim()
    } catch (e) {
      return {
        verdict: 'undetermined',
        paths: [],
        untrackedSql: [],
        reason: `git 不可用:${String(e.message).split('\n')[0]}`,
      }
    }
    if (inside !== 'true') {
      return {
        verdict: 'undetermined',
        paths: [],
        untrackedSql: [],
        reason: `该目录不在 git 工作树内(rev-parse 返回 ${inside || '<空>'})`,
      }
    }
    try {
      // 注意:git status --porcelain 对**不存在/未跟踪的路径**给空输出,与"干净"同形。
      // 故先用 ls-files 确认跟踪态,未跟踪一律判"无法判定",不得记为空闲。
      const tracked = new Set(
        gitReadonly(['ls-files', '--', ...B10_WATCH])
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean),
      )
      const worst = new Map()
      for (const line of gitReadonly(['status', '--porcelain', '--', ...B10_WATCH]).split(
        /\r?\n/,
      )) {
        if (line.trim() === '') continue
        const raw = line.slice(3)
        const p = (raw.includes(' -> ') ? raw.split(' -> ').pop() : raw)
          .replace(/^"|"$/g, '')
          .replace(/\\/g, '/')
        const s = classifyXy(line.slice(0, 2))
        const prev = worst.get(p)
        if (!prev || s.rank > prev.rank) worst.set(p, s)
      }
      const paths = B10_WATCH.map((p) => {
        if (!tracked.has(p)) return { path: p, state: '未被 git 跟踪', rank: -1 }
        const s = worst.get(p)
        return { path: p, state: s ? s.text : '干净', rank: s ? s.rank : 0 }
      })
      const untrackedSql = gitReadonly([
        'ls-files',
        '--others',
        '--exclude-standard',
        '--',
        B10_MIG_DIR,
      ])
        .split(/\r?\n/)
        .map((l) => l.trim().replace(/\\/g, '/'))
        .filter((l) => l.endsWith('.sql'))
      const unknown = paths.filter((p) => p.rank === -1)
      if (unknown.length) {
        return {
          verdict: 'undetermined',
          paths,
          untrackedSql,
          reason: `${unknown.length} 个受控路径未被 git 跟踪(${unknown.map((u) => u.path).join(', ')})——无法判定是否空闲`,
        }
      }
      const dirty = paths.filter((p) => p.rank > 0)
      if (dirty.length || untrackedSql.length) return { verdict: 'busy', paths, untrackedSql }
      return { verdict: 'idle', paths, untrackedSql }
    } catch (e) {
      return {
        verdict: 'undetermined',
        paths: [],
        untrackedSql: [],
        reason: `git 查询失败:${String(e.message).split('\n')[0]}`,
      }
    }
  }

  console.log(`${C.bold}[迁移记账] B10 journal 登记表空闲性(warn 级,不参与 B1-B5 判定)${C.reset}`)
  const idle = probeJournalIdle()
  for (const p of idle.paths) {
    const mark = p.rank > 0 ? C.yellow : p.rank === 0 ? C.green : C.yellow
    console.log(
      `  ${mark}${p.rank > 0 ? '!' : '✓'}${C.reset} ${p.path} ${C.dim}${p.state}${C.reset}`,
    )
  }
  for (const f of idle.untrackedSql) {
    console.log(`  ${C.yellow}!${C.reset} ${f} ${C.dim}未跟踪的迁移文件(在飞)${C.reset}`)
  }
  if (idle.verdict === 'idle') {
    ok('B10 空闲:五路径全干净且 drizzle/ 下无未跟踪 .sql')
  } else if (idle.verdict === 'busy') {
    const d = idle.paths.filter((p) => p.rank > 0).length
    console.log(
      `  ${C.yellow}! B10 未判定,有人在飞 —— 受控路径 ${d} 个脏 / 未跟踪迁移 ${idle.untrackedSql.length} 枚(已逐条点名)${C.reset}`,
    )
  } else {
    console.log(`  ${C.yellow}! B10 未判定(无法取证):${idle.reason}${C.reset}`)
  }
  console.log(
    `  ${C.dim}结论:B1-B5 绿不等于 journal 空闲,凡追加 idx / 新增迁移的票,开工前置是本判据报空闲。${C.reset}`,
  )

  // ---------- 汇总 ----------
  console.log('')
  if (warn.length) console.log(`${C.yellow}[迁移记账] ${warn.length} 条告警(非阻塞)${C.reset}`)
  if (fail.length) {
    console.error(`${C.red}${C.bold}[迁移记账] ✗ ${fail.length} 项失败${C.reset}`)
    fail.forEach((f) => console.error(`   - ${f}`))
    console.error(
      `\n修复提示:\n  node scripts/watermark.mjs list-uncovered   # 若 .sql 水印损坏导致内容变化\n  node scripts/check-migration-bookkeeping.mjs --db   # 对照库内记账\n`,
    )
    process.exit(1)
  }
  console.log(
    `${C.green}${C.bold}[迁移记账] ✓ 全部通过(${tags.length} 条迁移,离线,判定面=${FACE}` +
      (wantDb || LEDGER_FILE
        ? dbVerdict === 'judged'
          ? ',库内双射已对照'
          : `,库内双射**未判定**:${dbVerdict || '原因未记录'} —— 该行不代表 B6~B9 通过`
        : '') +
      // B11 的结论**必须出现在汇总行里**:它默认是"没判"的那一格,只在段里喊一句而汇总行读起来像
      // 全绿,就是替"没判"背书(把没判写成判过了 —— 与本门 B6~B9 那格同年修掉的是同一型)。
      `,B11 ${b11Summary}` +
      `)${C.reset}`,
  )

  // B10 问责档:只有 --require-idle 才把「非空闲 / 无法判定」升为判红。
  // 默认档(CI / 巡检跑的形态)退出码与 B1-B5 完全不变 —— 这是本票的硬约束。
  if (requireIdle && idle.verdict !== 'idle') {
    const why = idle.verdict === 'busy' ? '有人在飞' : `无法判定(${idle.reason})`
    console.error(
      `${C.red}${C.bold}[迁移记账] ✗ B10 --require-idle:journal 登记表非空闲 —— ${why}${C.reset}`,
    )
    console.error(
      `${C.dim}  开工前置未满足:等对方的迁移落地/暂存完毕,或把本次动作让给该票持有者。${C.reset}`,
    )
    process.exit(1)
  }

  // ---------- --strict:B11 的「未判定」在问责档下不等于通过 ----------
  // 与上面 B10 的 --require-idle 完全同一条设计:**默认档不改退出码**(否则本机无 PG 的每台
  // 每次提交都被逼 --no-verify,连带废掉全部守门,AGENTS §12e);问责档才拒绝出合格证。
  // 判红只在 fail 计数为 0 时才走到这里 —— 本枚真有红的话上面已经 exit 1,不会被这一格盖过。
  if (strict && !ledgerRows) {
    console.error(
      `${C.red}${C.bold}[迁移记账] ✗ B11 --strict:已应用迁移的内容不可变性这一格**未判定** —— ${ledgerWhyNot}${C.reset}`,
    )
    console.error(
      `${C.dim}  "未判定"不是"没问题":没有账本,就没人能证明没有一枚已应用的 .sql 被改过。` +
        `问责出口:pnpm migration:check:db(在线),或 --db-ledger <部署机 psql 落盘件>(离线取证)。${C.reset}`,
    )
    process.exit(1)
  }
} // ← if (isDirectRun):镜像测试 import 本模块时只拿判据函数,不跑 CLI(§22d)

/** §22c:核心判据经 __test__ 暴露,镜像测试直接 import,不得在测试里再抄一份集合运算/夹具 */
export const __test__ = {
  sqlBasenamesFromListing,
  diffJournalVsSql,
  resolveRoot,
  faceFromArgv,
  faceJournalSpec,
  faceSqlListArgs,
  readAuditFace,
  journalEntriesOf,
  parsePorcelainZ,
  worktreeOnlyDirtyPaths,
  faceSelfProof,
  runSelfTest,
  writeGateFixture,
  mkFixtureRepo,
  runGateAt,
  gitIn,
  fixtureTagOf,
  FIXTURE_WATCH_OTHERS,
  FACE_TXT,
  MIG_DIR_REL,
  JOURNAL_REL,
  // B11(2026-09-28):判据三出口 + 快照通道解析,全部由镜像测试**直接 import**,不得再抄第二份(§22c)
  migrationSqlHash,
  faceSqlBlobSpec,
  parseLedgerRows,
  compareAppliedHashes,
  readSqlBodies,
  ledgerFileFromArgv,
  MIGRATION_IMMUTABLE_HINT,
  ledgerSnapshotOf,
  writeLedgerSnapshot,
  FIXTURE_SQL,
  FIXTURE_SQL_TAMPERED,
  FIXTURE_LEDGER_REL,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
