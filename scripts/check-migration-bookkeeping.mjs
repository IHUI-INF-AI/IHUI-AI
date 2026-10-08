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
 *     B12 **同一份 .sql 跨目录并存对账(G-1058522:全仓同名 .sql 只许住一个目录)**
 *        立因:同一份迁移曾同时躺在 `packages/database/scripts/manual-sql/` 与
 *        `packages/database/drizzle/`(20261003103000_chat_messages_created_at_idx_CONCURRENTLY.sql),
 *        而 B1 的枚举面**只有 drizzle/ 恰好一层** —— 于是 B1 报的是"那枚副本没登记",
 *        而不是"同一份 .sql 现在有两处";副本人肉删掉后,**union 的「对侧删除不随合并传播」会把整文件取回**,
 *        该循环已复发 4 次。缺口是**没有一条判据专门拦跨目录同名 .sql**,不是"还有人手工删"。
 *        红条件只有一个口径:**同一个 basename 出现在 ≥2 个不同目录** ⇒ 判红并逐条点名两处路径 + 字节数差
 *        (git 里同目录同 basename 就是同一条路径,所以按目录数判与按出现次数判同值,而前者不误导重构)。
 *        三条不可漂:① 清单与字节**同面同轮**(head ⇒ `ls-tree -r --name-only HEAD` / staged ⇒ `ls-files`,
 *        尺寸向同一面 `cat-file --batch-check` 现问),**不读工作树**;② 权威面是 `scripts/manual-sql/`
 *        那一侧 —— 错的是"又长出一份副本",所以出路是删多余那份或改名,**不得**把它挪进 drizzle/
 *        补 journal 登记(那是 B1 的地盘,也是另一条路);③ 三态不并桶:面取不到 / 枚举到 0 个 /
 *        `--worktree` 档(递归扫盘要判重解析点,§26;提交链从不走这一档)⇒ 一律落「未判定」,
 *        大声点名原因且**跟着汇总行一起说**,既不冒红也绝不记绿。
 *        零容忍、**无基线、无行内豁免通道**的依据:现读 HEAD 面全仓同名 .sql 跨目录并存 **0 组**
 *        (`git ls-tree -r --name-only HEAD` 的 basename 重项为空)⇒ 接线不产生恒红面(AGENTS §12e)。
 *   在线(--db):
 *     B6 库内行数 == journal 条目数
 *     B7 库内 created_at 集合 == journal when 集合(严格双射)
 *     B8 max(created_at) == max(when)(migrate「不空转」的充要条件)
 *     B9 库内每行 hash 均为合法 sha256(64 位十六进制)且唯一 —— 防再现 2026-09-13 的
 *        污染形态(453 行中含 153 个重复 hash 与 `NOFILE:` / `manual_` 伪值)
 *     B11 **已应用迁移的内容不可变对账(G-657:判定只认锁内重读的那份账本)**
 *        立因:drizzle 记进 `__drizzle_migrations.hash` 的是 `sha256(整份 .sql 原文)`
 *        (`drizzle-orm/migrator.js:23` —— 读文件全文、不切 statement-breakpoint、不改换行),
 *        所以"某枚已应用的迁移后来被改过"这件事**只有拿这一列对内容才算判过**。B6~B9 只核
 *        行数 / 时间戳集合 / hash 的形状与唯一性,**一条都不看内容** —— 账目结构合法而内容被
 *        逐字改写,今天整套判据全绿。
 *        三条不可漂的写法(本票的增量就住在第 ② 条):
 *          ① 判定基准取**当前判定面**的那一份正文(head ⇒ HEAD blob / staged ⇒ 索引 blob /
 *             worktree ⇒ 磁盘),与 B1~B5 同面同轮,不得混面;
 *          ② 账本必须在**一个带行锁的事务里重读**(`SELECT … FOR UPDATE` 连读两次),
 *             判据只认锁内那一份;事务外预检(= B6~B9 读的那次)与锁内不同形时**必须明写预检作废**,
 *             锁内两次不同形 ⇒ 整维判「未判定」—— 那说明账本正在被人写,此时任何结论都是猜的。
 *             为什么"只在事务外预检"不够:预检与判定之间账本可能已经被 deploy 推进,结论对着
 *             一份已经不存在的账本打分,而账面读起来像"刚查过";
 *          ③ 不中集合必须逐枚去**相邻版本**(索引 / HEAD / HEAD^ / 磁盘)作证:某一枚相邻版本的
 *             内容(原文,或**剥掉水印结构行**之后)的 sha256 恰等于账本 hash ⇒ 记账内容今天仍找得回来,
 *             而当前判定面与它不同 ⇒ 这就是"已应用迁移被改过",判红 `checksum_mismatch`。
 *             找不到任何作证份时按正文**有没有水印痕迹**分档:有痕迹 ⇒ 记档那份字节已被零宽水印改写、
 *             当前面无从还原 ⇒ 落「无从归因」(**逐条点名、不计合规、`--strict` 拒绝出合格证**);
 *             无痕迹 ⇒ 没有借口,判红。
 *        为什么不把"不中"一律判红(本仓最高频自伤是恒红门,AGENTS §12e):2026-10-01 实测真库
 *        账本 286 行 / journal 303 条,逐枚比 sha256 的命中拆成
 *        **原样中 133 / 不中 152**;而 152 枚不中里,拿四种正文形态(判定面原文、剥水印结构、
 *        只去零宽、剥水印+只去零宽)加相邻版本**一列都配不上** ⇒ 若直接判红,`--db` 面就是
 *        与任何提交都无关的恒红,唯一结局是这台机每次跑 `--db` 都被迫忽略它。
 *        数字一律当次现读(`--json` 的 `b11.states`),不得照本行派单。
 *        已知判不了的一格(如实登记,不得读成已覆盖):作证份只取**相邻版本**,更早的历史版本不作证
 *        —— 若有人改完还把它 commit 了多次,本判据会落「无从归因」而不是红(全史扫描另计一票);
 *        `journal 有条目而账本没有行`的那 18 枚属 B6/B7 的地盘,本维**不判**但仍报数。
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
 *   node scripts/check-migration-bookkeeping.mjs --db          # 追加库校验
 *       (DSN 取自 $DATABASE_URL,否则读 apps/api/.env 的 DATABASE_URL;
 *        psql 候选序(G-815987,2026-10-07 起,共用层 lib/psql-client-locate.mjs):
 *        $IHUI_PSQL → $PG_CLIENT_DIR/psql.exe → 自动探测
 *        C:/Program Files/PostgreSQL/<版本>/bin/psql.exe(版本号数值取最大在位者)→
 *        D:\DevEnv\runtimes\pgsql\bin\psql.exe → PATH;全落空时逐条报告试过的候选,
 *        结论句明说"不代表本机没有 PostgreSQL 服务")
 *       说明:B6~B9 比对的是**库内实时状态**(那是被审对象本身,不是"取哪个面的仓库正文"),
 *       所以这一档的取数方式本票一字未动;它旁边的 journal 一侧随所选判定面走(默认 HEAD)。
 *       B11 同属这一档(它必须有账本),且额外要求一次带行锁的重读 —— 见上。
 *   node scripts/check-migration-bookkeeping.mjs --strict      # 问责档:B11 有「无从归因 / 未判定」即 exit 2
 *       (拒绝出具合格证;默认档不因此改任何既有退出码语义)
 *   node scripts/check-migration-bookkeeping.mjs --ledger-from <json>  # **取证通道**,只给 --self-test
 *       与镜像测试用:B11 的账本取自该夹具文件而非 psql(本机 psql 常不可达,而"判据在、无人调"
 *       正是本仓记过最多次的失明型 —— 没有这条通道,B11 的 CLI 接线无法被端到端证明)。
 *       用了它,输出行必须逐字带「取证通道:不代表库内实态」,且 B6~B9 仍按 psql 实态判、不受它影响。
 *   node scripts/check-migration-bookkeeping.mjs --self-test   # 成对正反例(临时 git 仓夹具,零副作用于真仓)
 *   node scripts/check-migration-bookkeeping.mjs --root <dir>  # **测试通道**,只给 --self-test 与镜像测试用:
 *       仓库根由脚本自身位置推导之后,靠 cwd 定位夹具的调用**结构上失效**(守门 70 的镜像测试
 *       13/14 恒红、13c 的 11/13 例其实在审真仓 —— 同一型)。生产路径不带这个参数。
 */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { dirname, join, resolve, isAbsolute } from 'node:path'
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
  catBatchSizes,
  gitRaw,
  readWorktreeFile,
  selectFace,
  FACE_LABEL,
} from './lib/face-reader.mjs'
// 临时夹具唯一落点(§26 / 守门 118 实测过两个禁止理由:不得用 os.tmpdir(),不得落仓库树内)
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
// psql 客户端定位的唯一实现(G-815987,2026-10-07):与 check-migration-from-zero 门共用,
// 两处各写一份候选表必然漂开 —— 本门正是漂掉了"C 盘自动探测"档,才把在位的 PG18 报成 ENOENT。
import { locatePsqlClient, psqlLocateMissText } from './lib/psql-client-locate.mjs'
// B11 的"剥零宽水印"维必须引这一份实现(唯一实现),不得在本门再抄一份正则:
// 水印结构行的识别住在 `lib/watermark-lines.mjs`,注入器 / 归档生成器 / 旁路落地器都读它 ——
// 本门是第四个消费者(§22c:两处各写一遍"哪一行算水印"必然漂开)。
import {
  hasAnyWatermarkTrace,
  stripWatermarkStructure,
  CANONICAL_BANNER_LINES,
} from './lib/watermark-lines.mjs'

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
// B11 问责档(G-657):默认档只对"无从归因 / 未判定"报数不改退出码,--strict 才 exit 2 拒绝出合格证。
// 为什么默认档不能判红:真库现读有 152 枚账本 hash 找不到任何作证份(见文件头 B11 段的实测数),
// 当场 blocking 就是一台与任何提交都无关的恒红门,唯一结局是每次跑 --db 都被忽略(AGENTS §12e)。
const b11Strict = args.includes('--strict')
/** 取证通道:`--ledger-from <json>` 给 B11 喂夹具账本(只为证明"判据有人调",不代表库内实态)。 */
const ledgerFromPath = (() => {
  const i = args.indexOf('--ledger-from')
  if (i < 0) return null
  const p = args[i + 1]
  if (!p || p.startsWith('--')) throw new Error('--ledger-from 需要一个 JSON 文件参数')
  return isAbsolute(p) ? p : resolve(ROOT, p)
})()

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
  // 面 → 规格 的映射只有一份实现(`faceBlobSpecFor`),这里就是它对 journal 路径的投影。
  // 曾在这里另写一遍 if 链 —— 那正是"journal 按一个面、.sql 按另一个面"的漂移温床。
  return faceBlobSpecFor(face, JOURNAL_REL)
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

// ════════════════════════════════════════════════════════════════════════════
// B12(G-1058522)同一份 .sql 跨目录并存对账 —— 判据层全部是纯函数(§22c:镜像测试直接
// import 这一份,不得在测试里抄第二遍集合运算)。
// 立因(票面实测,不是假想):同一份迁移曾**同时**躺在
//   packages/database/scripts/manual-sql/20261003103000_chat_messages_created_at_idx_CONCURRENTLY.sql
//   packages/database/drizzle/20261003103000_chat_messages_created_at_idx_CONCURRENTLY.sql
// 而记账器 B1 判的是「journal tag 集合 ↔ **drizzle/*.sql** 的 basename 集合双向一一对应」——
// 它的枚举面只有 `drizzle/` 恰好一层(见 sqlBasenamesFromListing),所以"权威面那一份"根本不在
// B1 的视野里:面内 .sql 数 309 对 journal 308 ⇒ B1 报的是**那枚副本没登记**,而不是
// 「同一份 .sql 现在有两处」。副本已由人肉删除(枚 5a3696714f),但让它可以复发的机制一个字没改
// —— union 收敛的「对侧删除不随合并传播」会把整文件取回,该循环已复发过 4 次。
// ⇒ 缺口是**判据维度**,不是"还有人手工删":全仓没有任何一条判据专门拦跨目录同名 .sql。
//
// 三条不可漂的写法:
//   ① 枚举与内容**同面同轮**:路径清单按被审面取(head ⇒ `ls-tree -r --name-only HEAD` /
//      staged ⇒ `ls-files`),字节数只在**确有双份**时才由同一个面的 `cat-file --batch-check`
//      现问 —— 不得读工作树(拿磁盘判会把别人在飞的副本算成本枚提交的账,AGENTS §12e)。
//   ② 红条件只看**目录数**:同一个 basename 出现在 ≥2 个不同目录 ⇒ 判红,并逐条点名两处路径 +
//      字节数差。**不判**同目录内的正常文件(git 里同目录同路径不可能重名,所以目录数是唯一量纲),
//      也**不把 `scripts/manual-sql/` 一侧一律当错** —— 那一侧是权威面,错的是"又长出一份副本",
//      所以处置动作是「删掉多出来的那一份 / 改名」,不是「把它挪进 drizzle/ 并补 journal 登记」
//      (后者会让 B1 立刻判红,是另一条路)。
//   ③ 三态绝不并桶:命中(dup)⇒ 判红进 `fail`;判净(clean)⇒ 绿;**未判定**(面取不到 / 枚举到
//      0 个 / worktree 档刻意不判)⇒ 大声报名字与原因,既不冒红也绝不记绿,并且汇总行必须带着这句
//      (把没判写成判过了是本仓最高频失效型)。
//
// 为什么可以零容忍、不需要基线:现读全仓(HEAD 面)**没有任何同名 .sql 跨目录并存**
// (`git ls-tree -r --name-only HEAD` 的 basename 重项实测为空),所以上线不产生恒红面。
// 无行内豁免通道 —— 这一型的正解只有"删掉多余那一份或改名",给它开一条"标一下跳过"的口子
// 等于把本票要拦的形态重新变成合法。
// ════════════════════════════════════════════════════════════════════════════

/**
 * 纯函数:判定面 → **全仓**(不是只有 `drizzle/` 那一层).sql 路径枚举用的 git 参数。
 * `worktree` 档给 `null` —— 本维在磁盘档**不判**:全仓枚举要递归扫盘,而 §26 明令任何递归枚举
 * 前必须逐条判重解析点(junction 穿透一次就替别人把真实目录读成"我们的双份"),而 `--worktree`
 * 只是人工逃生舱、提交链从不走它。调用方据 null 落「未判定」并点名原因,绝不静默跳过。
 * 与 `faceSqlListArgs` 一样单独导出:三面各取哪一份必须能被构造面钉死,不能埋在 CLI 流程里。
 */
export function sqlUniverseListArgs(face) {
  if (face === 'staged') return ['ls-files', '-z']
  if (face === 'head') return ['ls-tree', '-r', '--name-only', '-z', 'HEAD']
  return null
}

/**
 * 纯函数:git 路径清单(`-z` 输出,也容忍换行输出)→ 归一后的**全仓 .sql 相对路径**数组(升序)。
 * 分隔符 NUL 与换行都收的理由同 `sqlBasenamesFromListing`:万一某台 git 不认 `-z`,换行输出
 * 也必须仍被读成清单,而不是被当成一整个怪路径 ⇒ "枚举到 0 个"那种指错方向的假无法判定。
 */
export function sqlPathsFromListing(zLines) {
  const seen = new Set()
  const out = []
  for (const raw of String(zLines ?? '').split(/[\0\n]/)) {
    const p = raw.trim().replace(/\\/g, '/')
    if (!p || p.includes('\0')) continue
    if (!p.endsWith('.sql')) continue
    if (seen.has(p)) continue
    seen.add(p)
    out.push(p)
  }
  return out.sort()
}

/**
 * 纯函数:.sql 路径数组 → **同名出现在 ≥2 个不同目录**的分组(按名字升序,输出确定)。
 * 只数目录、不数出现次数:git 里"同目录同 basename"就是同一条路径,所以按目录判与"红条件只看
 * 目录数"这条口径一致,也不会把 `dirs` 相同的两组误合成一组。
 * @returns {Array<{name:string, dirs:string[], paths:string[]}>}
 */
export function sqlDupAcrossDirs(paths) {
  const byName = new Map()
  for (const p of paths || []) {
    const i = p.lastIndexOf('/')
    const name = i < 0 ? p : p.slice(i + 1)
    const dir = i < 0 ? '' : p.slice(0, i)
    if (!name.endsWith('.sql')) continue
    if (!byName.has(name)) byName.set(name, { name, dirs: [], paths: [] })
    const g = byName.get(name)
    g.paths.push(p)
    if (!g.dirs.includes(dir)) g.dirs.push(dir)
  }
  return [...byName.values()]
    .filter((g) => g.dirs.length >= 2)
    .map((g) => ({ name: g.name, dirs: [...g.dirs].sort(), paths: [...g.paths].sort() }))
    .sort((a, b) => (a.name === b.name ? 0 : a.name < b.name ? -1 : 1))
}

/**
 * 纯函数:一组双份 → 点名字串(两处路径逐条列出 + 字节数差)。
 * `sizeOf(path)` 返回字节数或 null;尺寸取不到**不降级判红**(红条件只由清单成立),但必须写
 * "未取到" —— 否则读报告的人会以为两份字节相同。
 */
export function b12FindingLine(group, sizeOf) {
  const sizes = (group.paths || []).map((p) =>
    typeof sizeOf === 'function' ? sizeOf(p) : null,
  )
  const parts = group.paths.map((p, i) =>
    Number.isFinite(sizes[i]) ? `${p} (${sizes[i]} B)` : `${p} (字节数未取到)`,
  )
  const known = sizes.filter((s) => Number.isFinite(s))
  const diff =
    known.length === group.paths.length
      ? `字节数差 ${Math.max(...known) - Math.min(...known)} B`
      : '字节数差 未取到(不影响判红)'
  return (
    `B12 同一份 .sql 跨目录并存:${group.name} 在 ${group.dirs.length} 个目录里各有一份 —— ` +
    `${parts.join(' ↔ ')};${diff}`
  )
}

/**
 * 纯函数:B12 的三态结论(命中 / 判净 / 未判定),**不派生、不判红、不改退出码** —— 退出码归调用方。
 * `error` 与空枚举都落未判定:把"没看清"写成"没有问题"是本仓最贵的那一类假绿。
 * @returns {{state:'dup'|'clean'|'undetermined', groups:Array, scanned:number, reason:string, line:string}}
 */
export function b12Outcome({ paths, error }) {
  if (error)
    return {
      state: 'undetermined',
      groups: [],
      scanned: 0,
      reason: String(error),
      line: `B12 未判定:${error} —— 该行不代表"全仓无同名 .sql 跨目录并存"已判`,
    }
  const list = Array.isArray(paths) ? paths : []
  if (list.length === 0)
    return {
      state: 'undetermined',
      groups: [],
      scanned: 0,
      reason: '判定面枚举到 0 个 .sql —— 空扫不记绿(B12 不据此判"没有双份")',
      line: 'B12 未判定:判定面枚举到 0 个 .sql —— 空扫不记绿(B12 不据此判"没有双份")',
    }
  const groups = sqlDupAcrossDirs(list)
  if (groups.length)
    return {
      state: 'dup',
      groups,
      scanned: list.length,
      reason: '',
      line: `B12 ✗ ${groups.length} 组同名 .sql 跨目录并存(扫 ${list.length} 个 .sql)`,
    }
  return { state: 'clean', groups: [], scanned: list.length, reason: '', line: '' }
}

// ════════════════════════════════════════════════════════════════════════════
// B11(G-657)已应用迁移内容不可变对账 —— 判据层全部是纯函数。
// 为什么必须整层是纯函数:本维问的是"账本这一行 ↔ 正文这一份字节"配不配,
// 而真仓的 psql 面在本机长期取不到(实测候选表里没有 C 盘那一条 ⇒ `spawnSync psql ENOENT`)。
// 若判据只住在 CLI 流程里,它在本机永远只能"跑不到",而 AGENTS 记过两次:
// **判据失效的表现不是红,是安静**。把判定与取材拆开之后,构造面能证明判据有牙,
// 而 `--ledger-from` 那条取证通道能证明**有人调它**(守门 70/76/81/115 同族)。
// ════════════════════════════════════════════════════════════════════════════

/** drizzle 记进 `__drizzle_migrations.hash` 的就是这个式子(migrator.js:23,对**字符串全文**做 sha256)。 */
export function sha256Hex(text) {
  return createHash('sha256').update(String(text ?? ''), 'utf8').digest('hex')
}

/**
 * 纯函数:一份正文的**全部合法比对照形态** —— 刻意在这里算全,判据层按形态逐个试。
 * 为什么"剥水印"必须在**本门内部**做一遍而不是改磁盘:零宽水印把不可见载荷写进了 .sql 正文,
 * 而 drizzle 当年记账时那些字节还不存在 —— 票面那句「需先剥零宽水印」说的就是这一维
 * (AGENTS §5c 同一条禁令:不得对含载荷文件做文本级批量改写,所以这里只算不写)。
 * 候选族不是随手列的,是**注入器的逆运算**(逐条对着 `watermark.mjs:394-405` 推):
 *   `body = shebang + xmlDecl + banner + sep + text`,其中
 *   `sep = text.startsWith('\n') ? '' : '\n'` ⇒ 剥掉横幅行后会留下一个人工空行;
 *   `out = body.replace(/\r?\n$/,'') + '\n' + tail + '\n'` ⇒ 末行是隐写行,正文的末尾换行被归一。
 * 所以还原式至少要有四支:剥结构行本体 / 再去掉那个前导空行 / 各自补回一个末换行。
 * **两种都留而不是挑一支**:注入时 `sep` 取决于原正文开头有没有换行,而静态判据问不出那一位 ——
 * 少一支就是把"能配上的"误判成"配不上"(多一分判红),多一支只要 hash 仍要**逐字相等**
 * 就不可能把改动洗成通过(这一维的安全性来自相等比较,不是来自候选条数)。
 */
export function b11ComparableForms(text) {
  const raw = String(text ?? '')
  const { text: stripped, removed } = stripWatermarkStructure(raw)
  const noLead = stripped.replace(/^\n/, '')
  const set = new Set([raw, stripped, noLead, stripped + '\n', noLead + '\n'])
  return {
    raw,
    stripped,
    strippedRemovedLines: removed,
    hasWatermark: hasAnyWatermarkTrace(raw),
    candidates: [...set],
  }
}

/** B11 五档语义(三态绝不并桶:命中 / 判红 / 无从归因,再加"未判定"与"无账本行")。 */
export const B11_STATES = [
  'match',
  'match_stripped',
  'checksum_mismatch',
  'unattributable',
  'no_ledger_row',
]

/** 人读措辞(唯一一份;CLI 段与 --json 段都从这里取,免得两处各写一遍再漂)。 */
export const B11_STATE_TXT = {
  match: '内容逐字未变(原样 sha256 与账本一致)',
  match_stripped: '剥水印结构后与账本一致(记账早于零宽注入,属正常形态)',
  checksum_mismatch: 'checksum_mismatch —— 账本 hash 有相邻版本作证而当前判定面与它不同',
  unattributable: '无从归因 —— 正文带零宽水印痕迹且无任何相邻版本可作证,当前面无从还原',
  no_ledger_row: 'journal 在册而账本没有这一行(属 B6/B7 的地盘,B11 不判仍报数)',
}

/**
 * 纯函数:单枚迁移的 B11 结论。
 * @param ledgerHash   账本里记的那一份 sha256(null/'' ⇒ no_ledger_row)
 * @param faceText     **当前判定面**的那一份正文(null ⇒ 这一枚未判定,不得当成通过)
 * @param attestations 相邻版本(索引 / HEAD / HEAD^ / 磁盘),**不含**被判定面自己那一份;
 *                     每项 {source, text}。判据拿它们为账本 hash 作证 —— 有作证份而当前面不同,
 *                     才是"已应用迁移被改过"的可证事实。
 */
export function classifyB11Row({ tag, ledgerHash, faceText, attestations = [] }) {
  const base = { tag, ledgerHash: ledgerHash ?? null }
  if (!ledgerHash) return { ...base, state: 'no_ledger_row', detail: '', basis: '' }
  if (typeof faceText !== 'string')
    return {
      ...base,
      state: 'unattributable',
      detail: '当前判定面取不到正文(未判定,不得读成通过)',
      basis: '',
    }
  const forms = b11ComparableForms(faceText)
  if (sha256Hex(faceText) === ledgerHash)
    return { ...base, state: 'match', detail: '', basis: '判定面原文' }
  if (forms.candidates.some((c) => c !== faceText && sha256Hex(c) === ledgerHash))
    return {
      ...base,
      state: 'match_stripped',
      detail: `按注入器逆运算还原(剥 ${forms.strippedRemovedLines} 行水印结构${forms.stripped.startsWith('\n') ? ' + 前导空行' : ''})后逐字相等`,
      basis: '判定面剥水印',
    }
  // 相邻版本作证:任一份(任一合法还原形态)的 sha256 恰等于账本 hash
  const attested = []
  for (const a of attestations || []) {
    if (!a || typeof a.text !== 'string') continue
    const f = b11ComparableForms(a.text)
    if (f.candidates.some((c) => sha256Hex(c) === ledgerHash)) attested.push(a.source)
  }
  if (attested.length)
    return {
      ...base,
      state: 'checksum_mismatch',
      detail: `账本 hash 由 ${attested.join(' / ')} 作证,而判定面正文不同`,
      basis: attested.join(' / '),
    }
  // 没有作证份 ⇒ 只能按"正文有没有被零宽水印改写过"分档,不得一律判红(恒红门,AGENTS §12e)
  if (forms.hasWatermark)
    return { ...base, state: 'unattributable', detail: '无作证份且正文带水印痕迹', basis: '' }
  return {
    ...base,
    state: 'checksum_mismatch',
    detail: '无水印痕迹、无作证份,却与账本不同 —— 没有任何借口',
    basis: '',
  }
}

/** 纯函数:把逐枚结论汇成各档计数(命中 / 判红 / 无从归因 / 无账本行)。 */
export function summarizeB11(findings) {
  const counts = {}
  for (const s of B11_STATES) counts[s] = 0
  for (const f of findings || []) if (counts[f.state] !== undefined) counts[f.state] += 1
  return counts
}

/** 账本三份读(事务外预检 / 锁内第一次 / 锁内第二次)的序列表述。 */
function ledgerSeq(rows) {
  return (rows || [])
    .map((r) => `${r.createdAt}:${r.hash}`)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .join(',')
}

/**
 * 纯函数:B11 能不能判(本票增量住在这里)。
 * 三条前提缺一律落未判定,且**绝不返回一份旧快照去凑结论**:
 *  ① 锁内两次读必须同形 —— 不同 ⇒ 有人正在写账本,此刻任何结论都是猜的;
 *  ② 锁内第一次读必须非空 —— 空账本与"psql 没答话"在两形上必须可分,所以空集另说一句;
 *  ③ 事务外预检只用来**对照**,不是判据的输入(预检与锁内不同形是常态而非事故,那正说明
 *     只按预检判会判在一份已经不存在的账本上)。
 */
export function b11LedgerAgreement({ preCheck, lockedFirst, lockedSecond }) {
  const l1 = ledgerSeq(lockedFirst)
  const l2 = ledgerSeq(lockedSecond)
  const pre = ledgerSeq(preCheck)
  if (!lockedFirst || lockedFirst.length === 0)
    return { ok: false, reason: '锁内第一次读为空集(账本空或没答话)——不判', pre, l1, l2 }
  if (l1 !== l2)
    return {
      ok: false,
      reason: '锁内两次读不同形 ⇒ 账本正被并发写,本次不作判定',
      pre,
      l1,
      l2,
    }
  return {
    ok: true,
    preStale: pre !== l1,
    reason: pre !== l1 ? '事务外预检与锁内读不同形 ⇒ 预检作废,判定只用锁内那份' : '',
    rows: lockedFirst,
    pre,
    l1,
    l2,
  }
}

/**
 * 纯函数:把带标记的 psql 输出按标记切成三份账本读(顺序即语句顺序)。
 * 每行形状 `<标记>|<created_at>|<hash>`(与 `-t -A -F '|'` 同形);标记不认识的行**忽略但计数**,
 * 计数由调用方报出(不得把"没解析出来"读成"账本就是这个数")。
 */
export function splitLedgerReads(text, marks) {
  const buckets = Object.fromEntries((marks || []).map((m) => [m, []]))
  let skipped = 0
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const t = line.trim()
    if (t === '') continue
    const idx = t.indexOf('|')
    if (idx < 0) {
      skipped++
      continue
    }
    const mark = t.slice(0, idx)
    const rest = t.slice(idx + 1)
    if (!buckets[mark]) {
      skipped++
      continue
    }
    const p = rest.indexOf('|')
    if (p < 0) {
      skipped++
      continue
    }
    buckets[mark].push({
      createdAt: Number(rest.slice(0, p).trim()),
      hash: rest.slice(p + 1).trim(),
    })
  }
  return { buckets, skipped }
}

/**
 * 纯函数:锁内重读用的那条 psql 脚本(唯一一份实现,镜像测试按形状锁它)。
 * `SET LOCAL lock_timeout` 是**护栏而不是装饰**:拿不到行锁必须在 5 秒内失败并落未判定,
 * 不得让一道只读守门把在跑的 deploy 卡住(§5b 那条"无界挂起"禁令同族)。
 * 结尾 ROLLBACK:本门一行都不写,加锁只是为了"判定期间账本不会被人推进"。
 */
export function b11LockedReadSql(lockTimeoutMs) {
  const ms = Number.isFinite(lockTimeoutMs) && lockTimeoutMs > 0 ? Math.trunc(lockTimeoutMs) : 5000
  return [
    'BEGIN;',
    `SET LOCAL lock_timeout = '${ms}ms';`,
    "SELECT 'LOCKED1|' || created_at || '|' || hash FROM drizzle.__drizzle_migrations ORDER BY created_at FOR UPDATE;",
    "SELECT 'LOCKED2|' || created_at || '|' || hash FROM drizzle.__drizzle_migrations ORDER BY created_at FOR UPDATE;",
    'ROLLBACK;',
  ].join('\n')
}

/**
 * 纯函数:psql 失败文案的**凭据脱敏**。
 * 为什么必须动这一格而不是只在 B11 里防:`execFileSync` 抛错时 `e.message` 的第一行是
 * `Command failed: <完整命令行>`,而命令行里带着 `-d postgresql://user:密码@host/db` ——
 * B6~B9 那句 catch 会把它原样打进 stdout,而 pre-commit 的 stdout 落进 `.workbuddy/hook-logs/`,
 * 于是凭据离开仓库(AGENTS §5d「密钥不入仓、不入聊天记录」)。
 * 只剥 DSN,不吞异常类型:真红与未判定的分流照旧由调用方管。
 */
export function psqlFailText(e, dsn) {
  const raw = String(e?.message ?? e)
  const first = raw.split(/\r?\n/)[0] ?? ''
  let s = first
  if (dsn && dsn.length > 4) s = s.split(dsn).join('postgresql://***@***')
  // 命令行里 DSN 可能被 shell 引号包过一层,或 psql 把口令 URL 编码后再显 —— 两种都盖住
  s = s.replace(/postgresql:\/\/[^\s']+/gi, 'postgresql://***@***')
  return s
}

/**
 * G-815987,2026-10-07:psql 客户端定位的唯一实现住在 `lib/psql-client-locate.mjs`
 * (与 check-migration-from-zero 门共用)。本门只留这一层薄封装:命中给路径;全落空给
 * "试过的候选 + 结论句"(结论句逐字含「未找到 psql 客户端(不代表本机没有 PostgreSQL 服务)」,
 * 不许让 ENOENT 替服务缺席背书)。镜像测试从这里进:env / opts 全部可注入,fixture 造假
 * bin 结构即可证明候选序与全落空清单,不必赌本机装没装 PG。
 */
export function resolveB11Psql(env = process.env, opts = {}) {
  const r = locatePsqlClient(env, opts)
  return {
    psql: r.psql,
    candidates: r.tried,
    missText: r.psql ? '' : psqlLocateMissText(r.tried),
  }
}

/**
 * 纯函数:B11 的退出码分流(判红 / 未判定 / 通过三态各归其位,严重度优先级不可逆)。
 * 返回 { exit: 0|1|2, line: 结论行 } —— 有判红就是 1(哪怕同时也有未判定,**不得**被"未判定"洗白,
 * 镜像 M8 同一条锁);只有未判定/无从归因时,默认档 0(与本门既有 warn 语义同形),
 * `--strict` 才是 2(拒绝出具合格证)。
 */
export function b11ExitOf({ counts, judged, strict, undeterminedReason }) {
  const c = counts || {}
  const red = c.checksum_mismatch || 0
  const unver = c.unattributable || 0
  if (!judged) {
    return {
      exit: strict ? 2 : 0,
      line: `B11 未判定:${undeterminedReason || '原因未记录'} —— 该行不代表内容不可变已判`,
    }
  }
  if (red > 0)
    return {
      exit: 1,
      line:
        `B11 ✗ checksum_mismatch ${red} 枚 —— 已应用迁移的内容与账本不符,且账本 hash 有相邻版本作证` +
        `(无从归因另 ${unver} 枚)`,
    }
  if (unver > 0)
    return {
      exit: strict ? 2 : 0,
      line:
        `B11 默认档:判红 0 / 无从归因 ${unver} 枚(逐条点名,不计合规)` +
        (strict ? ' ⇒ --strict 拒绝出合格证(exit 2)' : ' ⇒ 问责跑 --strict(exit 2)'),
    }
  return { exit: 0, line: `B11 ✓ 账本在册的每一枚内容逐字未变(共 ${(c.match || 0) + (c.match_stripped || 0)} 枚)` }
}

/**
 * 纯函数:判定面 → **任意**相对路径正文的 `cat-file --batch` 规格(worktree 档给 null,由磁盘自己读)。
 * 这是"面 → 规格"映射的**唯一一份实现**:`faceJournalSpec` 与 B11 的 .sql 取材都由它投影 ——
 * 两处各写一遍必然漂开,而漂开的表现不是报错,是"journal 按 HEAD 取、.sql 按索引取"这种
 * 自洽却错位的尺子(守门 101/118 各记过一次同型)。
 */
export function faceBlobSpecFor(face, rel) {
  if (face === 'staged') return `:${rel}`
  if (face === 'head') return `HEAD:${rel}`
  return null
}

/**
 * 纯函数:`--ledger-from` 夹具 JSON → 三份账本读(事务外预检 / 锁内第一次 / 锁内第二次)。
 * 形状不认 ⇒ 抛错由调用方折成未判定并点名 —— **不得**把"读不懂夹具"当成"账本没问题"。
 * 每行 `{createdAt, hash}`;也接受 `[createdAt, hash]` 紧凑形态(与本门自测夹具互抄成本最低)。
 */
export function parseLedgerFixture(obj) {
  const norm = (arr, name) => {
    if (!Array.isArray(arr)) throw new Error(`${name} 不是数组`)
    return arr.map((r, i) => {
      if (Array.isArray(r) && r.length === 2) return { createdAt: Number(r[0]), hash: String(r[1]) }
      if (r && typeof r === 'object' && 'hash' in r)
        return { createdAt: Number(r.createdAt), hash: String(r.hash) }
      throw new Error(`${name}[${i}] 形状不认(要 {createdAt,hash} 或 [createdAt,hash])`)
    })
  }
  return {
    preCheck: norm(obj && obj.preCheck, 'preCheck'),
    lockedFirst: norm(obj && obj.lockedFirst, 'lockedFirst'),
    lockedSecond: norm(obj && obj.lockedSecond, 'lockedSecond'),
  }
}

/**
 * 纯函数:判定面 → **相邻版本**的取材规格清单(不含被判定面自己那一份)。
 * `parentOid` 为空(仓库只有一枚提交 / 不在 git 里)时该档整条缺席 ——
 * 不得拿解析不到的规格去凑"我读过了"(那会表现为"正文取不到",是另一种颜色);
 * 也不得把判定面自己那一版当作证份(拿结论证结论)。
 * 磁盘那份由调用方走 `readWorktreeFile`,不在这张表里(它不是 git 规格)。
 */
export function b11AttestSpecs(face, rel, parentOid) {
  const all = {
    index: faceBlobSpecFor('staged', rel),
    head: faceBlobSpecFor('head', rel),
    parent: parentOid ? `${parentOid}:${rel}` : null,
  }
  const judgedKey = face === 'staged' ? 'index' : face === 'head' ? 'head' : null
  const out = []
  for (const [key, spec] of Object.entries(all)) {
    if (!spec || key === judgedKey) continue
    out.push({ source: key, spec })
  }
  return out
}

/** 把层里/别的异常折成一句人话(不吞类型:Undetermined 与真红必须能被调用方分开)。
 */
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
  if (withSql) for (const e of entries) writeFileSync(join(drizzle, `${e.tag}.sql`), 'SELECT 1;\n')
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
  } catch (e) {
    results.push(`❌ 端到面夹具建立失败:${String(e?.message ?? e).split(/\r?\n/)[0]}`)
  }

  // ── B11(G-657)判据层:成对正反例。**每条 cond 都必须是已求值布尔**(§自检 harness 红线:
  //    把箭头函数当 cond 传进去 ⇒ `!!fn` 恒真 ⇒ 那条断言从写下起从未求值,账面却一路记 ✅)。
  {
    const A = 'SELECT 1;\n'
    const hA = sha256Hex(A)
    const mk = (o) => classifyB11Row(o)
    eq('B1-P0 sha256Hex 与 drizzle 同式(对整份字符串做 sha256)', hA.length, 64)
    eq(
      'B1-P1 正文逐字对应 ⇒ match',
      mk({ tag: 't1', ledgerHash: hA, faceText: A }).state,
      'match',
    )
    eq(
      // 票面验收本体的纯函数版:账本记的是原样,判定面被改了一个字节,而原样在相邻版本里找得回来
      'B1-P2 改一字节且原样有相邻版本作证 ⇒ checksum_mismatch(判据有牙)',
      mk({
        tag: 't1',
        ledgerHash: hA,
        faceText: 'SELECT 7;\n',
        attestations: [{ source: 'head', text: A }],
      }).state,
      'checksum_mismatch',
    )
    eq(
      'B1-P2b 反向对照:同一枚正文没动 ⇒ match(红不是"存在相邻版本"带来的)',
      mk({
        tag: 't1',
        ledgerHash: hA,
        faceText: A,
        attestations: [{ source: 'head', text: A }],
      }).state,
      'match',
    )
    eq(
      'B1-P3 剥掉零宽水印结构后对上 ⇒ match_stripped(票面"需先剥零宽水印"那一维)',
      mk({
        tag: 't1',
        ledgerHash: hA,
        faceText: [
          `-- ${CANONICAL_BANNER_LINES[0]}`,
          `-- ${CANONICAL_BANNER_LINES[1]}`,
          '-- [IHUI-AI-PROVENANCE]:​‌‍',
          '',
          A,
        ].join('\n'),
      }).state,
      'match_stripped',
    )
    eq(
      'B1-P3b 剥水印只对"没改正文"放行:水印在位而正文被换 ⇒ 仍 checksum_mismatch',
      mk({
        tag: 't1',
        ledgerHash: hA,
        faceText: [`-- ${CANONICAL_BANNER_LINES[0]}`, '', 'DROP TABLE x;\n'].join('\n'),
        attestations: [{ source: 'disk', text: A }],
      }).state,
      'checksum_mismatch',
    )
    eq(
      'B1-P4 无水印痕迹、也无任何作证份,却与账本不同 ⇒ checksum_mismatch(没有借口那一档)',
      mk({ tag: 't1', ledgerHash: hA, faceText: 'DROP TABLE x;\n' }).state,
      'checksum_mismatch',
    )
    eq(
      'B1-P5 带水印痕迹且配不出证据 ⇒ unattributable(**既不判红也不记合规**,防恒红门)',
      mk({ tag: 't1', ledgerHash: 'f'.repeat(64), faceText: `-- ${CANONICAL_BANNER_LINES[0]}\n${A}` })
        .state,
      'unattributable',
    )
    eq(
      'B1-P6 journal 在册而账本没行 ⇒ no_ledger_row(B11 不判,那一格归 B6/B7)',
      mk({ tag: 't1', ledgerHash: null, faceText: A }).state,
      'no_ledger_row',
    )
    eq(
      'B1-P7 判定面正文取不到 ⇒ 未判定色并写明原因,绝不冒 match',
      (() => {
        const r = mk({ tag: 't1', ledgerHash: hA, faceText: null })
        return r.state === 'unattributable' && /取不到正文/.test(r.detail)
      })(),
      true,
    )
    // ②"判定必须落在锁内重读"这一维:四条各有正反
    eq(
      'B1-P8 预检与锁内同形 ⇒ 可判、preStale=false',
      (() => {
        const rows = [{ createdAt: 1, hash: 'a' }]
        const d = b11LedgerAgreement({ preCheck: rows, lockedFirst: rows, lockedSecond: rows })
        return d.ok === true && d.preStale === false
      })(),
      true,
    )
    eq(
      'B1-P9 预检过期而锁内自洽 ⇒ 仍判,但判定输入换成锁内那份并声明预检作废',
      (() => {
        const locked = [
          { createdAt: 1, hash: 'a' },
          { createdAt: 2, hash: 'b' },
        ]
        const d = b11LedgerAgreement({ preCheck: [{ createdAt: 1, hash: 'a' }], lockedFirst: locked, lockedSecond: locked })
        return d.ok === true && d.preStale === true && d.rows.length === 2 && !!d.reason
      })(),
      true,
    )
    eq(
      'B1-P10 锁内两次不同形 ⇒ 整维未判定(账本正被并发写时任何结论都是猜的)',
      b11LedgerAgreement({
        preCheck: [{ createdAt: 1, hash: 'a' }],
        lockedFirst: [{ createdAt: 1, hash: 'a' }],
        lockedSecond: [
          { createdAt: 1, hash: 'a' },
          { createdAt: 2, hash: 'b' },
        ],
      }).ok,
      false,
    )
    eq(
      'B1-P11 锁内读到空集 ⇒ 未判定,不读成"账本合法"',
      /空集/.test(
        b11LedgerAgreement({ preCheck: [], lockedFirst: [], lockedSecond: [] }).reason,
      ),
      true,
    )
    eq(
      'B1-P12 判据真的只用锁内那份(而非预检那份)——两值不同形时结论必须随锁内变',
      (() => {
        const d = b11LedgerAgreement({
          preCheck: [{ createdAt: 7, hash: sha256Hex(A) }],
          lockedFirst: [{ createdAt: 7, hash: 'e'.repeat(64) }],
          lockedSecond: [{ createdAt: 7, hash: 'e'.repeat(64) }],
        })
        const byWhen = new Map(d.rows.map((r) => [r.createdAt, r.hash]))
        return (
          byWhen.get(7) !== sha256Hex(A) &&
          mk({ tag: 't', ledgerHash: byWhen.get(7), faceText: A }).state === 'checksum_mismatch'
        )
      })(),
      true,
    )
    eq(
      'B1-P13 splitLedgerReads 按标记切两份,不认识的行**计数**而不是静默吞掉',
      (() => {
        const p = splitLedgerReads(
          ['LOCKED1|1|aaa', 'LOCKED1|2|bbb', 'LOCKED2|1|aaa', 'LOCKED2|2|bbb', 'ROLLBACK', 'X|1|z'].join(
            '\n',
          ),
          ['LOCKED1', 'LOCKED2'],
        )
        return p.buckets.LOCKED1.length === 2 && p.buckets.LOCKED2.length === 2 && p.skipped === 2
      })(),
      true,
    )
    eq(
      'B1-P14 锁内重读脚本形状:BEGIN / SET LOCAL lock_timeout / 两条 FOR UPDATE / ROLLBACK(不得 COMMIT)',
      (() => {
        const sql = b11LockedReadSql(5000)
        return (
          /^\s*BEGIN;/.test(sql) &&
          /SET LOCAL lock_timeout = '5000ms';/.test(sql) &&
          (sql.match(/FOR UPDATE/g) || []).length === 2 &&
          /ROLLBACK;\s*$/.test(sql) &&
          !/COMMIT;/.test(sql)
        )
      })(),
      true,
    )
    eq(
      'B1-P14b lock_timeout 非法值 ⇒ 退回 5000ms(不得产出 `NaNms` 那种 psql 直接报错的脚本)',
      /lock_timeout = '5000ms'/.test(b11LockedReadSql(NaN)),
      true,
    )
    eq(
      'B1-P15 相邻版本按面推导,且**不含判定面自己**(否则"拿结论证结论")',
      `${b11AttestSpecs('head', 'p/q.sql', 'abc')
        .map((x) => x.spec)
        .join(',')}|${b11AttestSpecs('staged', 'p/q.sql', 'abc')
        .map((x) => x.spec)
        .join(',')}`,
      ':p/q.sql,abc:p/q.sql|HEAD:p/q.sql,abc:p/q.sql',
    )
    eq(
      'B1-P16 仓库只有一枚提交时不得拿 HEAD^ 凑数(解析不到不等于看过了)',
      b11AttestSpecs('head', 'p/q.sql', '').some((x) => x.source === 'parent'),
      false,
    )
    eq(
      'B1-P17 取证通道夹具形状不认 ⇒ 抛错(调用方折成未判定,不得当"账本没问题")',
      (() => {
        try {
          parseLedgerFixture({ preCheck: [{ createdAt: 1 }], lockedFirst: [], lockedSecond: [] })
          return false
        } catch {
          return true
        }
      })(),
      true,
    )
    // ③凭据与退出码
    eq(
      'B1-P18 psql 失败文案必须剥掉 DSN(口令不得进 stdout,而 stdout 会落 hook-logs)',
      (() => {
        const dsn = 'postgresql://ihui:SECRET_pw@127.0.0.1:5432/ihui'
        const s = psqlFailText(
          new Error(`Command failed: psql.exe -d ${dsn} -t -A -F | -c SELECT 1`),
          dsn,
        )
        return !s.includes('SECRET_pw') && !s.includes(dsn) && /Command failed/.test(s)
      })(),
      true,
    )
    eq(
      'B1-P18b 脱敏只剥 DSN,不吞异常本身(ENOENT 那一类原因必须仍能被读到)',
      psqlFailText(new Error('spawnSync psql ENOENT'), 'postgresql://u:p@h/db'),
      'spawnSync psql ENOENT',
    )
    eq(
      'B1-P19 只有无从归因 ⇒ 默认档 exit 0(不造恒红),--strict exit 2(不出合格证)',
      (() => {
        const c = summarizeB11([{ state: 'match' }, { state: 'unattributable' }])
        return (
          b11ExitOf({ counts: c, judged: true, strict: false }).exit === 0 &&
          b11ExitOf({ counts: c, judged: true, strict: true }).exit === 2
        )
      })(),
      true,
    )
    eq(
      'B1-P20 有判红 ⇒ 两档一律 exit 1(红不得被"另有未判定"降格成 2)',
      (() => {
        const c = summarizeB11([{ state: 'checksum_mismatch' }, { state: 'unattributable' }])
        return (
          b11ExitOf({ counts: c, judged: true, strict: false }).exit === 1 &&
          b11ExitOf({ counts: c, judged: true, strict: true }).exit === 1
        )
      })(),
      true,
    )
    eq(
      'B1-P21 未判定的结论行必须自带"不代表内容不可变已判"(把没判写成判过了是本仓最高频失效型)',
      /不代表内容不可变已判/.test(
        b11ExitOf({ counts: null, judged: false, strict: false, undeterminedReason: 'psql 未解析到' })
          .line,
      ),
      true,
    )
    eq(
      'B1-P22 全命中 ⇒ exit 0 且结论行报名字(静默绿与"根本没跑"必须可分)',
      b11ExitOf({ counts: summarizeB11([{ state: 'match' }]), judged: true, strict: true }).exit,
      0,
    )
  }

  // ── B12(G-1058522)同名 .sql 跨目录并存:构造面成对正反例 + 真临时仓端到面。
  //    每条 cond 都必须是**已求值布尔**(§自检 harness 红线:把箭头函数当 cond 传进去 ⇒
  //    `!!fn` 恒真 ⇒ 那条断言从写下起从未求值,账面却一路记 ✅)。
  {
    const A = 'packages/database/drizzle/20261003103000_x_idx_CONCURRENTLY.sql'
    const B = 'packages/database/scripts/manual-sql/20261003103000_x_idx_CONCURRENTLY.sql'
    const C2 = 'packages/database/drizzle/20261003110000_y.sql'
    const dup = sqlDupAcrossDirs([A, B])
    eq('B12-Q1 两目录同名 ⇒ 1 组(目录数 = 2)', `${dup.length}|${dup[0]?.dirs.length}`, '1|2')
    // `g0` 兜一个空分组:红条件被人放宽时 `dup` 会是空集,那应当落成 **❌ 那一条用例**,
    // 而不是让整台自检抛 TypeError 退场 —— 栈trace 会把其余 100 余条用例的结论一起吞掉
    // (变异取证时就是这样:Q1b 崩了,后面所有 B12/别的维度的读数一行都没打出来)。
    const g0 = dup[0] || { name: '<无分组:红条件已失效>', paths: [], dirs: [] }
    ok(
      'B12-Q1b 点名字串必须同时含两处完整路径',
      b12FindingLine(g0, () => 100).includes(A) && b12FindingLine(g0, () => 100).includes(B),
      b12FindingLine(g0, () => 100),
    )
    eq(
      'B12-Q1c 字节数差必须被量出来(100 vs 160 ⇒ 60 B)',
      /字节数差 60 B/.test(b12FindingLine(g0, (p) => (p === A ? 100 : 160))),
      'true',
    )
    ok(
      'B12-Q1d 尺寸取不到 ⇒ 写"未取到"而**不降级、不消失**(红条件只由清单成立)',
      /字节数差 未取到/.test(b12FindingLine(g0, () => null)) &&
        b12FindingLine(g0, () => null).includes(A),
    )
    eq('B12-Q2 只有 manual-sql 一处 ⇒ 0 组(权威面那一份不是错)', sqlDupAcrossDirs([B]).length, 0)
    eq(
      'B12-Q3 同目录内多份不同名 ⇒ 0 组(不判同目录的正常文件)',
      sqlDupAcrossDirs([A, C2]).length,
      0,
    )
    eq(
      'B12-Q3b 同目录内**同名**不可能存在(git 唯一路径),但即便被喂重复项也只算 1 个目录 ⇒ 不判红',
      sqlDupAcrossDirs([A, A]).length,
      0,
    )
    eq('B12-Q4 面取不到 ⇒ 未判定(不冒红)', b12Outcome({ paths: null, error: 'git 问不到' }).state, 'undetermined')
    ok(
      'B12-Q4b 未判定的结论行必须自带"不代表已判"(把没判写成判过了是本仓最高频失效型)',
      /未判定/.test(b12Outcome({ paths: null, error: 'X' }).line) &&
        /不代表/.test(b12Outcome({ paths: null, error: 'X' }).line),
      b12Outcome({ paths: null, error: 'X' }).line,
    )
    eq(
      'B12-Q5 枚举到 0 个 .sql ⇒ 未判定(空扫不得读成"没有双份")',
      b12Outcome({ paths: [], error: '' }).state,
      'undetermined',
    )
    eq(
      'B12-Q6 有清单且无重复 ⇒ clean 并报扫描面大小',
      `${b12Outcome({ paths: [A, B.replace('_x_', '_z_')], error: '' }).state}|${b12Outcome({ paths: [A, B], error: '' }).state}`,
      'clean|dup',
    )
    // 三面各取哪一份必须能被钉死:head=HEAD 树 / staged=索引 / worktree=不判(给 null)。
    eq(
      'B12-Q7 三面的**全仓**枚举命令互不相同(worktree 档必须是 null)',
      JSON.stringify([
        sqlUniverseListArgs('head'),
        sqlUniverseListArgs('staged'),
        sqlUniverseListArgs('worktree'),
      ]),
      JSON.stringify([
        ['ls-tree', '-r', '--name-only', '-z', 'HEAD'],
        ['ls-files', '-z'],
        null,
      ]),
    )
    eq(
      'B12-Q8 清单解析:NUL 与换行都收、非 .sql 剔除、重复项去重(不认 -z 的 git 不得退化成 0 个)',
      sqlPathsFromListing(
        [
          'b/y.sql',
          'a/x.sql',
          'readme.md',
          'a/x.sql',
          'packages\\win\\z.sql',
          '',
        ].join('\n') + '\0c/w.sql\0',
      ).join(','),
      'a/x.sql,b/y.sql,c/w.sql,packages/win/z.sql',
    )
    eq('B12-Q8b 空输入 ⇒ 0 个(由 b12Outcome 折成未判定)', sqlPathsFromListing('').length, 0)

    // 端到面 A:真临时仓里**确有**两份同名 .sql(逐字复刻票面那两目录) ⇒ 必须 exit 1 并点名两处,
    // 而同一个夹具的 B1 仍然绿 ⇒ 证明"新增一维没有改弱既有判据、也没有替别人制造红"。
    try {
      const dA = keep(mkFixtureRepo('g49-b12-dup'))
      const jA = JSON.parse(readFileSync(join(dA, JOURNAL_REL), 'utf8'))
      const tagA = jA.entries[0].tag
      const sideA = 'packages/database/scripts/manual-sql'
      mkdirSync(join(dA, sideA), { recursive: true })
      writeFileSync(join(dA, sideA, `${tagA}.sql`), 'SELECT 1;\n')
      gitIn(dA, ['add', '-A'])
      gitIn(dA, ['commit', '-q', '--no-verify', '-m', 'B12 fixture: copy beside drizzle/'])
      const gA = runGateAt(dA)
      const gAs = runGateAt(dA, ['--staged'])
      eq('B12-E1 两份同名 .sql 已入库 ⇒ 默认(HEAD)档 exit 1', String(gA.code), '1')
      ok(
        'B12-E1b 且逐条点名两处完整路径',
        /B12 同一份 \.sql 跨目录并存/.test(gA.err + gA.out) &&
          (gA.err + gA.out).includes(`${MIG_DIR_REL}/${tagA}.sql`) &&
          (gA.err + gA.out).includes(`${sideA}/${tagA}.sql`),
        ((gA.err + gA.out).match(/B12[^\n]*/g) || ['<无 B12 行>']).join(' ⏎ '),
      )
      ok(
        'B12-E1c B1 必须仍然绿(红只来自新维:证明没顺手改弱既有判据)',
        /✓ B1 双向一一对应/.test(gA.out) && /✗ 1 项失败/.test(gA.err),
        (gA.err.match(/项失败[^\n]*/) || ['<无>'])[0],
      )
      eq('B12-E1d --staged 档同样判红(索引面也看得见那两份)', String(gAs.code), '1')

      // 端到面 B:把多余那一份删掉(唯一出路)⇒ 必须回到 exit 0 并显式报"已判"。
      gitIn(dA, ['rm', '-q', '-f', '--', `${sideA}/${tagA}.sql`])
      gitIn(dA, ['commit', '-q', '--no-verify', '-m', 'B12 fixture: copy removed'])
      const gB = runGateAt(dA)
      eq('B12-E2 只剩一处 ⇒ exit 0(权威面那一份不是错)', String(gB.code), '0')
      ok('B12-E2b 且报"✓ B12 无同名 .sql 跨目录并存"', /✓ B12 无同名 \.sql 跨目录并存/.test(gB.out))
      ok(
        'B12-E2c 汇总行必须带着 B12 已判(绿要能说出它量了什么)',
        /B12 已判\(扫 \d+ 个 \.sql,无跨目录同名\)/.test(gB.out),
        (gB.out.match(/全部通过[^\n]*/) || ['<无汇总行>'])[0],
      )

      // 端到面 C:同目录内多份不同名 ⇒ 不判(git 里正常形态)
      const dC = keep(mkFixtureRepo('g49-b12-samedir'))
      const sideC = 'packages/database/scripts/manual-sql'
      mkdirSync(join(dC, sideC), { recursive: true })
      writeFileSync(join(dC, sideC, 'one.sql'), 'SELECT 1;\n')
      writeFileSync(join(dC, sideC, 'two.sql'), 'SELECT 2;\n')
      gitIn(dC, ['add', '-A'])
      gitIn(dC, ['commit', '-q', '--no-verify', '-m', 'B12 fixture: two distinct names in one dir'])
      const gC = runGateAt(dC)
      eq('B12-E3 同目录多份不同名 ⇒ exit 0(不判同目录的正常文件)', String(gC.code), '0')

      // 端到面 D:`--worktree` 档本维**不判** ⇒ 必须大声落未判定,且汇总行不得声称 B12 已判
      const gD = runGateAt(dC, ['--worktree'])
      ok(
        'B12-E4 worktree 档 ⇒ 未判定被点名,且绝不被写成"✓ B12"/"B12 已判"',
        /B12 未判定/.test(gD.out) && !/✓ B12/.test(gD.out) && !/B12 已判/.test(gD.out),
        (gD.out.match(/B12[^\n]*/g) || ['<无 B12 行>']).join(' ⏎ '),
      )

      // 端到面 E:面取不到(无 git 提交/根本不在 git 里)⇒ 该维未判定,**不得 exit 0 冒充通过**
      const dE = keep(mkScratch('g49-b12-nogit'))
      writeGateFixture(dE, 2) // 刻意不 git init
      const gE = runGateAt(dE)
      const gEs = runGateAt(dE, ['--staged'])
      ok(
        'B12-E5 面取不到 ⇒ 退出码不得是 0(未判定 ≠ 通过)',
        gE.code !== 0 && gEs.code !== 0,
        `head=${gE.code} staged=${gEs.code}`,
      )
      ok(
        'B12-E5b 且不得出现任何 B12 的绿结论或"全部通过"',
        !/✓ B12/.test(gE.out + gEs.out) && !/全部通过/.test(gE.out + gE.err + gEs.out),
        ((gE.out + gE.err).match(/B12[^\n]*/g) || ['<无 B12 行>']).join(' ⏎ '),
      )
    } catch (e) {
      results.push(`❌ B12 端到面夹具建立失败:${String(e?.message ?? e).split(/\r?\n/)[0]}`)
    }
  }

  // ── B11 端到面:通过 `--ledger-from` 取证通道跑真 CLI,证明**判据真被接在 CLI 上**
  //    (§守门 70/76/81/115 同一条:函数在、自检过,但 `--db` 流程没调它 = 提交链上一路绿灯。)
  try {
    const dir = keep(mkFixtureRepo('g49-b11-e2e', 2))
    const j = JSON.parse(readFileSync(join(dir, JOURNAL_REL), 'utf8'))
    const rel0 = `${MIG_DIR_REL}/${j.entries[0].tag}.sql`
    const rel1 = `${MIG_DIR_REL}/${j.entries[1].tag}.sql`
    const orig0 = readFileSync(join(dir, rel0), 'utf8')
    const body1 = readFileSync(join(dir, rel1), 'utf8')
    const ledgerFile = (name, h0, h1, split = false) => {
      const rows = [
        [j.entries[0].when, h0],
        [j.entries[1].when, h1],
      ]
      const p = join(dir, name)
      writeFileSync(
        p,
        JSON.stringify({ preCheck: rows, lockedFirst: rows, lockedSecond: split ? rows.slice(0, 1) : rows }),
      )
      return name
    }
    // ① 全对上 ⇒ exit 0 并报名字
    const fOk = ledgerFile('l-ok.json', sha256Hex(orig0), sha256Hex(body1))
    const g0 = runGateAt(dir, ['--ledger-from', fOk])
    eq('B1-E0 账本与正文全对上 ⇒ exit 0', String(g0.code), '0')
    ok('B1-E0b 结论行必须写"逐字未变(共 2 枚)"', /B11 ✓ 账本在册的每一枚内容逐字未变\(共 2 枚\)/.test(g0.out), (g0.out.match(/B11 [^\n]*/) || ['<无>'])[0])
    ok(
      'B1-E0c 取证通道必须大声标注"不代表库内实态"(否则夹具档结论会被读成库内结论)',
      /取证通道/.test(g0.out) && /不代表库内实态/.test(g0.out),
    )
    // ② 票面验收本体:改一字节**历史** .sql 并 commit,账本仍记原样 ⇒ 必须报 checksum_mismatch
    writeFileSync(join(dir, rel0), orig0.replace('SELECT 1;', 'SELECT 7;'))
    gitIn(dir, ['add', '-A'])
    gitIn(dir, ['commit', '-q', '--no-verify', '-m', 'G-657 fixture: mutate one byte'])
    const fStale = ledgerFile('l-stale.json', sha256Hex(orig0), sha256Hex(body1))
    const g1 = runGateAt(dir, ['--ledger-from', fStale])
    eq('B1-E1 改一字节历史 .sql ⇒ exit 1', String(g1.code), '1')
    ok('B1-E1b 且点名 checksum_mismatch 与该 tag', /checksum_mismatch/.test(g1.out + g1.err) && g1.out.includes(j.entries[0].tag), (g1.out.match(/B11[^\n]*/g) || ['<无>']).join(' ⏎ '))
    const g1s = runGateAt(dir, ['--ledger-from', fStale, '--strict'])
    eq('B1-E2 判红不得被 --strict 降格成 exit 2(严重度优先级不可逆)', String(g1s.code), '1')
    // ③ 反向对照:账本更新成改后的正文 ⇒ 同一份改动不再判红 ⇒ 红来自"账本 vs 正文",不是"文件被碰过"
    const fNew = ledgerFile('l-new.json', sha256Hex(orig0.replace('SELECT 1;', 'SELECT 7;')), sha256Hex(body1))
    const g2 = runGateAt(dir, ['--ledger-from', fNew])
    eq('B1-E3 账本就记新正文 ⇒ exit 0(证明 E1 的红由 hash 关系带来)', String(g2.code), '0')
    // ④ 锁内两次不同形 ⇒ 一条都不判,且绝不得出现合格措辞
    const fSplit = ledgerFile('l-split.json', sha256Hex(orig0.replace('SELECT 1;', 'SELECT 7;')), sha256Hex(body1), true)
    const g3 = runGateAt(dir, ['--ledger-from', fSplit])
    ok(
      'B1-E4 锁内两次不同形 ⇒ 不判,且不得被读成通过',
      !/B11 ✓/.test(g3.out) && /B11 未判定/.test(g3.out),
      (g3.out.match(/B11[^\n]*/g) || ['<无>']).join(' ⏎ '),
    )
    // ⑤ 不带 --db 也不带夹具 ⇒ 那一维必须显式"未判定",汇总行不得声称判过
    const g4 = runGateAt(dir, [])
    ok(
      'B1-E5 离线档必须显式写 B11 未判定(而不是安静)',
      /B11 \*\*未判定\*\*|B11 未判定/.test(g4.out) && /不代表内容不可变已判/.test(g4.out),
    )
    // ⑥ 夹具 JSON 坏了 ⇒ 未判定并点名,绝不记绿
    writeFileSync(join(dir, 'l-bad.json'), '{ nope')
    const g5 = runGateAt(dir, ['--ledger-from', 'l-bad.json'])
    ok(
      'B1-E6 夹具账本读不懂 ⇒ 判据落未判定并点名原因',
      /取不到\/形状不认|形状不认|不是合法 JSON|Unexpected/.test(g5.out) && !/B11 ✓/.test(g5.out),
      (g5.out.match(/B11[^\n]*/g) || ['<无>']).join(' ⏎ '),
    )
  } catch (e) {
    results.push(`❌ B11 端到面夹具建立失败:${String(e?.message ?? e).split(/\r?\n/)[0]}`)
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

  // ---------- B12: 同一份 .sql 跨目录并存(G-1058522) ----------
  // 枚举与 B1 的 journal/.sql 同面(由 FACE 决定),字节数只在**确有双份**时才向同一个面现问。
  // 刻意**不调 wa()**:那个「N 条告警」计数是 B1-B4 的口径(镜像 T6 钉着"夹具本身零告警"),
  // 与 B10/B11 同一条规矩 —— B12 只新增自己的段落 + 一句汇总尾巴,既有输出行逐字不变。
  console.log(`${C.bold}[迁移记账] B12 全仓同名 .sql 对账${C.reset}`)
  let b12 = { state: 'clean', groups: [], scanned: 0, reason: '' }
  {
    const listArgs = sqlUniverseListArgs(FACE)
    let b12Paths = null
    let b12Error = ''
    if (!listArgs) {
      b12Error =
        `${FACE_TXT.worktree} 档不做全仓枚举(递归扫盘要逐条判重解析点,§26),` +
        '而本维没有安全的那一份磁盘清单可取 ⇒ 这一格未判定'
    } else {
      try {
        assertRepoRoot(ROOT, `B12(${FACE})`)
        b12Paths = sqlPathsFromListing(gitRaw(listArgs, ROOT, { timeout: 60000 }))
      } catch (e) {
        b12Error = `${FACE_LABEL[FACE]} 全仓 .sql 清单取不到:${faceErrText(e)}`
      }
    }
    b12 = b12Outcome({ paths: b12Paths, error: b12Error })
    if (b12.state === 'dup') {
      // 字节数取自**同一个判定面、同一轮**(`cat-file --batch-check`,只问大小不回内容)。
      // 问不到也照常判红 —— 红条件只由清单成立,尺寸是诊断不是判据。
      let sizeOf = () => null
      if (listArgs) {
        try {
          const specs = b12.groups.flatMap((g) => g.paths.map((p) => faceBlobSpecFor(FACE, p)))
          const sizes = catBatchSizes(ROOT, specs, { timeout: 60000 })
          sizeOf = (p) => sizes.get(faceBlobSpecFor(FACE, p)) ?? null
        } catch {
          sizeOf = () => null
        }
      }
      for (const g of b12.groups) bad(b12FindingLine(g, sizeOf))
      console.log(
        `  ${C.dim}  出路:删掉多出来的那一份(或改名)。不得把它挪进 ${MIG_DIR_REL}/ 并补 journal 登记 ` +
          `—— 那会让 B1 立刻判红,是另一条路。本维无行内豁免通道。${C.reset}`,
      )
    } else if (b12.state === 'clean') {
      ok(`B12 无同名 .sql 跨目录并存(扫 ${b12.scanned} 个 .sql)`)
    } else {
      // 未判定:报名字与原因,既不冒红也不记绿(绝不静默省掉这一行)。
      console.log(`  ${C.yellow}! ${b12.line}${C.reset}`)
    }
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
  /**
   * 库内这一维**是否真的判过**。汇总行据此说话:此前它无条件写"+ 库内双射",
   * 而 psql 不可用时 B6~B9 一条都没判 ⇒ 那句是在替"没判"背书(本仓最高频失效型:
   * 把没判写成判过了)。判据一条未改,只把结论行的措辞与实态对齐。
   */
  let dbVerdict = null
  // B11 要用同一份 DSN 与同一个 psql 解析结果(两处各解析一遍必然漂开,而漂开的那一份会把凭据
  // 拼进另一条错误路径 —— 见 psqlFailText 的理由)。故这里把 dsn / psql 提到 if(wantDb) 之外。
  let b11Dsn = process.env.DATABASE_URL || ''
  if (!b11Dsn) {
    const envPath = join(ROOT, 'apps/api/.env')
    if (existsSync(envPath)) {
      const line = readFileSync(envPath, 'utf8')
        .split(/\r?\n/)
        .find((l) => /^\s*DATABASE_URL\s*=/.test(l))
      if (line)
        b11Dsn = line
          .replace(/^\s*DATABASE_URL\s*=\s*/, '')
          .trim()
          .replace(/^["']|["']$/g, '')
    }
  }
  // G-815987,2026-10-07:psql 候选表抽到共用层 lib/psql-client-locate.mjs(from-zero 门同一份)。
  // 候选序:$IHUI_PSQL → $PG_CLIENT_DIR/psql.exe → 自动探测 C:/Program Files/PostgreSQL/<版本>/bin
  // (版本号数值取最大在位者)→ D:\DevEnv\runtimes\pgsql\bin\psql.exe → PATH(实探,探不中不算命中)。
  // 此前缺自动探测档,本机 PG18 客户端在位却 `spawnSync psql ENOENT`,那句被下游当成
  // "本机没有 PostgreSQL"的存在性结论;现在全落空的结论句明说"不代表本机没有 PostgreSQL 服务"。
  const b11PsqlLocated = resolveB11Psql()
  const b11Psql = b11PsqlLocated.psql
  const b11PsqlMissText = b11PsqlLocated.missText
  /** 本门仅有的两处"读机器状态":DSN 与其指向的库实时状态(AGENTS §5d:凭据绝不落日志)。 */
  function psqlQuery(sqlText, timeoutMs) {
    return execFileSync(
      b11Psql,
      ['-d', b11Dsn, '-t', '-A', '-F', '|', '-c', sqlText],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        timeout: timeoutMs,
        maxBuffer: 16 << 20,
      },
    )
  }
  /** 事务外预检读到的那一份账本(B6~B9 用它;B11 只拿它做对照,不作判据输入)。 */
  let preLedgerRows = null
  if (wantDb) {
    console.log(`${C.bold}[迁移记账] 库内 drizzle.__drizzle_migrations 双射${C.reset}`)
    const dsn = b11Dsn
    if (!dsn) {
      wa('B6~B8 跳过:未找到 DATABASE_URL(env 或 apps/api/.env)')
      dbVerdict = '没有 DATABASE_URL 可连(env 与 apps/api/.env 都没给)'
    } else {
      if (!b11Psql) {
        // 报错形状 ≠ 原因:本仓实测过把 `spawnSync psql ENOENT` 读成"本机没有 PG"并据此把票挂成
        // "等环境条件"(而 PG 其实在 5432 上跑着)。所以这里**点名试过哪些候选**,结论句由
        // 共用层出(G-815987):逐字含「未找到 psql 客户端(不代表本机没有 PostgreSQL 服务)」。
        const why = b11PsqlMissText
        wa(`B6~B8 跳过:${why}`)
        dbVerdict = why
      } else {
        try {
          const out = psqlQuery(
            'SELECT created_at, hash FROM drizzle.__drizzle_migrations ORDER BY created_at',
            Number(process.env.IHUI_B49_PSQL_TIMEOUT_MS) || 120000,
          )
          const rows = out
            .trim()
            .split(/\r?\n/)
            .filter((l) => l.trim() !== '')
            .map((l) => {
            const i = l.indexOf('|')
            return { createdAt: Number(l.slice(0, i).trim()), hash: l.slice(i + 1).trim() }
          })
        dbVerdict = 'judged'
        // 事务外预检那一份:留给 B11 做**对照**,不作 B11 判据的输入(锁内重读才是判据)。
        preLedgerRows = rows
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
        // 凭据脱敏:execFileSync 的错误首行是 `Command failed: <完整命令行>`,里面带着 `-d <DSN>`
        // (含口令)。这一句会打进 stdout,而 pre-commit 的 stdout 落进 .workbuddy/hook-logs/ ——
        // 那就是把口令写进日志(AGENTS §5d「密钥不入仓、不入日志」)。
        const why = psqlFailText(e, dsn)
        wa(`B6~B8 跳过:psql 执行失败(${why})`)
        dbVerdict = `psql 执行失败(${why})`
        }
      }
    }
  }

  // ---------- B11: 已应用迁移内容不可变对账(G-657,判定只认锁内重读的那份账本) ----------
  // 三条口径要点(与 B10 同族,改前三思):
  //   ① 判据本体全在纯函数层(classifyB11Row / b11LedgerAgreement / b11ExitOf),这一段只做取材;
  //      理由见纯函数层头注 —— psql 在本机长期取不到,判据若住在 CLI 里就永远"跑不到"。
  //   ② 刻意**不调用 wa()**:那个计数是 B1-B4 的口径(镜像 T6 钉着"夹具本身零告警")。
  //      B11 只输出自己的段落,既有输出行逐字不变。
  //   ③ 判红走 bad()(严重度优先级不可逆:有判红就是 exit 1,不得被"另有未判定"洗掉);
  //      「无从归因 / 未判定」默认档只报数,`--strict` 才 exit 2 拒绝出合格证。
  console.log(`${C.bold}[迁移记账] B11 已应用迁移内容不可变对账(锁内重读)${C.reset}`)
  let b11StrictExit = ''
  const B11_LOCK_TIMEOUT_MS = Number(process.env.IHUI_B11_LOCK_TIMEOUT_MS) || 5000
  const B11_PSQL_TIMEOUT_MS = Number(process.env.IHUI_B11_PSQL_TIMEOUT_MS) || 120000
  let b11Judged = false
  let b11Reason = ''
  let b11Counts = null
  let b11Findings = []
  let b11LedgerNote = ''
  {
    let agreement = null
    if (ledgerFromPath) {
      // 取证通道:账本来自夹具文件(只为证明 CLI 真在调这套判据,不代表库内实态)。
      try {
        const fx = parseLedgerFixture(JSON.parse(readFileSync(ledgerFromPath, 'utf8')))
        agreement = b11LedgerAgreement(fx)
        b11LedgerNote = `取证通道 --ledger-from ${ledgerFromPath}(**不代表库内实态**,不得据此出合格证)`
        if (!agreement.ok) b11Reason = agreement.reason
      } catch (e) {
        b11Reason = `夹具账本取不到/形状不认:${faceErrText(e)}`
      }
    } else if (!wantDb) {
      b11Reason = '本档未开 --db(也没有 --ledger-from 夹具)⇒ 没有账本可比,内容不可变这一维未判定'
    } else if (!b11Dsn || !b11Psql) {
      b11Reason = !b11Dsn
        ? '没有 DATABASE_URL 可连(env 与 apps/api/.env 都没给)'
        : b11PsqlMissText
      b11LedgerNote = '(psql 不可达 ⇒ 本维未判定)'
    } else {
      try {
        const out = psqlQuery(b11LockedReadSql(B11_LOCK_TIMEOUT_MS), B11_PSQL_TIMEOUT_MS)
        const parsed = splitLedgerReads(out, ['LOCKED1', 'LOCKED2'])
        agreement = b11LedgerAgreement({
          preCheck: preLedgerRows,
          lockedFirst: parsed.buckets.LOCKED1,
          lockedSecond: parsed.buckets.LOCKED2,
        })
        b11LedgerNote =
          `账本判定来源 = psql 带行锁事务内重读(FOR UPDATE,两次读同形;lock_timeout=${B11_LOCK_TIMEOUT_MS}ms)` +
          (parsed.skipped ? `,另有 ${parsed.skipped} 行输出没解析出来(不计数)` : '')
        if (!agreement.ok) b11Reason = agreement.reason
        else if (agreement.preStale)
          console.log(
            `  ${C.yellow}!${C.reset} 事务外预检与锁内读不同形 ⇒ ${agreement.reason}${C.reset}`,
          )
      } catch (e) {
        b11Reason = `锁内重读失败(psql):${psqlFailText(e, b11Dsn)}`
        b11LedgerNote = '(锁内读没拿到 ⇒ 本维未判定)'
      }
    }

    if (agreement && agreement.ok) {
      // 判定输入 = **锁内那一份**;事务外预检只用来对照(上面已打印它是否作废)。
      const byCreatedAt = new Map(agreement.rows.map((r) => [r.createdAt, r.hash]))
      // 取材必须**批量一轮读完**(每枚各起一次 cat-file 在 303 枚上会跑到分钟级,
      // 而"太慢"的下一种写法是悄悄缩小覆盖面 —— 覆盖面自证比速度重要,所以这里做批量)。
      let parentOid = ''
      try {
        parentOid = gitRaw(['rev-parse', '-q', '--verify', 'HEAD^'], ROOT, { timeout: 15000 }).trim()
      } catch {
        parentOid = ''
      }
      const relOf = (tag) => `${MIG_DIR_REL}/${tag}.sql`
      const faceTextByTag = new Map()
      {
        const specs = journal.entries
          .map((e) => faceBlobSpecFor(FACE, relOf(e.tag)))
          .filter((s) => s !== null)
        const got = specs.length ? catBatch(ROOT, specs) : new Map()
        journal.entries.forEach((e) => {
          const spec = faceBlobSpecFor(FACE, relOf(e.tag))
          faceTextByTag.set(e.tag, spec === null ? readWorktreeFile(ROOT, relOf(e.tag)) : got.get(spec) ?? null)
        })
      }
      // 只有"原样/剥水印都不中"的枚才需要相邻版本作证(把批量读花在真候选上)。
      const suspects = journal.entries.filter((e) => {
        const h = byCreatedAt.get(e.when)
        const t = faceTextByTag.get(e.tag)
        if (!h || typeof t !== 'string') return false
        const f = b11ComparableForms(t)
        return sha256Hex(t) !== h && sha256Hex(f.stripped) !== h
      })
      const attestByTag = new Map(suspects.map((e) => [e.tag, []]))
      {
        const specs = []
        const owner = new Map()
        for (const e of suspects) {
          for (const a of b11AttestSpecs(FACE, relOf(e.tag), parentOid)) {
            specs.push(a.spec)
            if (!owner.has(a.spec)) owner.set(a.spec, [])
            owner.get(a.spec).push({ tag: e.tag, source: a.source })
          }
          // 磁盘份也当相邻版本(worktree 档不适用 —— 它就是判定面自己)
          if (FACE !== 'worktree') {
            const disk = readWorktreeFile(ROOT, relOf(e.tag))
            if (typeof disk === 'string') attestByTag.get(e.tag).push({ source: 'disk', text: disk })
          }
        }
        if (specs.length) {
          const got = catBatch(ROOT, specs)
          for (const [spec, owners] of owner.entries()) {
            const t = got.get(spec)
            if (typeof t !== 'string') continue
            for (const o of owners)
              attestByTag.get(o.tag).push({ source: o.source, text: t })
          }
        }
      }
      b11Findings = journal.entries.map((e) =>
        classifyB11Row({
          tag: e.tag,
          ledgerHash: byCreatedAt.get(e.when) ?? null,
          faceText: faceTextByTag.get(e.tag) ?? null,
          attestations: attestByTag.get(e.tag) || [],
        }),
      )
      b11Counts = summarizeB11(b11Findings)
      b11Judged = true
    }
  }
  {
    const decided = b11ExitOf({
      counts: b11Counts,
      judged: b11Judged,
      strict: b11Strict,
      undeterminedReason: b11Reason,
    })
    const named = (state, limit = 10) => {
      const rows = b11Findings.filter((f) => f.state === state)
      if (!rows.length) return
      // 行首必须带**状态字面量**(票面验收要的就是 `checksum_mismatch` 这个词),措辞只从
      // B11_STATE_TXT 取一份 —— 人在读的和机器判的不得是两套话。
      console.log(
        `  ${C.dim}${state}(${B11_STATE_TXT[state]})点名 ${rows.length} 枚(至多列 ${limit}):${rows
          .slice(0, limit)
          .map((r) => `${r.tag}${r.detail ? `[${r.detail}]` : ''}`)
          .join(', ')}${rows.length > limit ? ' …' : ''}${C.reset}`,
      )
    }
    if (b11LedgerNote) console.log(`  ${C.dim}${b11LedgerNote}${C.reset}`)
    if (decided.exit === 1) {
      bad(decided.line)
      named('checksum_mismatch')
    } else {
      console.log(`  ${decided.exit === 2 ? C.yellow : C.green}${'·'}${C.reset} ${decided.line}`)
    }
    if (b11Judged) {
      const c = b11Counts
      console.log(
        `  ${C.dim}分档:命中 ${c.match} / 剥水印后命中 ${c.match_stripped} / 判红 ${c.checksum_mismatch} / ` +
          `无从归因 ${c.unattributable} / 无账本行 ${c.no_ledger_row}(journal 在册而账本没行,属 B6/B7 的地盘)${C.reset}`,
      )
      named('unattributable')
      if (c.no_ledger_row) named('no_ledger_row')
    }
    b11StrictExit = decided.exit === 2 ? decided.line : ''
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
      (wantDb
        ? dbVerdict === 'judged'
          ? ',库内双射已对照'
          : `,库内双射**未判定**:${dbVerdict || '原因未记录'} —— 该行不代表 B6~B9 通过`
        : '') +
      // B11 与 B6~B9 是两件事:双射对照过不代表内容不可变判过(反之亦然),两句分开说。
      (b11Judged
        ? `;B11 已判(${b11Counts.match + b11Counts.match_stripped} 命中 / ${b11Counts.unattributable} 无从归因)`
        : `;B11 **未判定**:${b11Reason || '原因未记录'} —— 该行不代表内容不可变已判`) +
      // B12 同理:"记账结构合法"不代表"全仓没有第二份同名 .sql",所以这一维的实态必须跟着
      // 汇总行一起说 —— 否则一句"✓ 全部通过"会把"这一格没判"读成"这一格是干净的"。
      (b12.state === 'clean'
        ? `;B12 已判(扫 ${b12.scanned} 个 .sql,无跨目录同名)`
        : `;B12 **未判定**:${b12.reason || '原因未记录'} —— 该行不代表"无跨目录同名 .sql"已判`) +
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

  // B11 问责档(G-657):默认档那句"无从归因 / 未判定"不改任何既有退出码;只有 --strict 才拒绝出合格证。
  // 顺序硬要求:这一段**必须排在 fail 的 exit 1 之后** —— 判红不得被"未判定"降格成 exit 2
  // (镜像 M8 是同一条锁:本枚在册的红不得被"另有未判定"洗掉)。
  if (b11StrictExit) {
    const c = b11Counts || {}
    console.error(
      `${C.red}${C.bold}[迁移记账] ✗ B11 --strict:拒绝出具合格证${C.reset}`,
    )
    console.error(
      `${C.dim}  分档:判红 ${c.checksum_mismatch ?? 0} / 无从归因 ${c.unattributable ?? 0} / ` +
        `未判定原因 ${b11Reason || '(账本已判,只是不中集合配不出任何相邻版本证据)'}${C.reset}`,
    )
    process.exit(2)
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
  // B12(G-1058522)判据层 —— 镜像测试直接 import 这些,不得在测试里再抄一份分组/点名字串(§22c)。
  sqlUniverseListArgs,
  sqlPathsFromListing,
  sqlDupAcrossDirs,
  b12FindingLine,
  b12Outcome,
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
  // B11(G-657)判据层 —— 镜像测试直接 import 这些,不得在测试里再抄一份 sha256/分档规则(§22c)。
  sha256Hex,
  b11ComparableForms,
  classifyB11Row,
  summarizeB11,
  b11LedgerAgreement,
  splitLedgerReads,
  b11LockedReadSql,
  psqlFailText,
  b11ExitOf,
  b11AttestSpecs,
  faceBlobSpecFor,
  parseLedgerFixture,
  B11_STATES,
  B11_STATE_TXT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
