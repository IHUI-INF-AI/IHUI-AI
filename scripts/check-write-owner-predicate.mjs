#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,结论必须走 console(与 check-*.mjs 同形) */
/**
 * check-write-owner-predicate.mjs —— 维护性写的「归属条件 / CAS / 回报计数」三态尺子(G-815920)
 *
 * 在量什么(上游出处,不是抽象理由):
 * `apps/zcode-cli/packages/adapters/src/storage/session-store/repositories/sessions.ts` 里同一族
 * 维护性写把**三件事写进同一条语句**:
 *  - `:285-286` 的成文理由:「路径自愈曾复用全字段 updateSession,把读取快照中的标题、权限、回滚和
 *    归档状态覆盖到并发新值上。维护性迁移只能拥有路径字段,并用旧路径做 CAS」;
 *  - `:289-294` 的实现:`update session set directory=?, path=?, time_updated=max(time_updated,?)
 *    where id=? and workspace_id=? and directory=? and ((? is null and path is null) or path=?)`
 *    —— **归属列在 where、CAS 旧值在 where、被改列只有它自己的**;
 *  - `:306` 的回报:`return Number(result.changes) === 1` —— 改了几行问库,不问请求。
 *    同一句回报在同文件另一处维护性写(函数 `repairLegacyRemoteSessionWorkspace` 起于 :254、回报在 :278)
 *    **逐字重复了一次**,所以它是族规矩而不是个案。
 *
 * 我方现状(票面当轮现量):`apps/api/src/db/chat-queries.ts` 写站点 27 处,窗口内含属主条件的仅 4 处;
 * 另 `:212-221` 那一型是「先 select 再比 userId 再按 id 写」—— 它挡得住越权,**挡不住 TOCTOU,
 * 也挡不住"改了 0 行回成功"**。
 *
 * **那 23 处不得直接判成 23 个敞口**:AGENTS 要求 SQL 级归属,而守门 134 的 B2 放过通道承认
 * 「调用方已用带 owner 的预查询把 id 集限死」是正确写法。所以本票的交付物是**一把尺子**,
 * 不是一次批量加 `and(eq(userId))`。本脚本**不改任何业务代码**。
 *
 * 三条判据(每条都是三态,不是二元):
 *  - **O1 归属条件维度**,逐写站点落四态之一:
 *      ① `sql-scoped` —— 该条写链的 where 里出现归属列(`userId`/`workspaceId`/`ownerId`/`memberId`/
 *         `roleId` 等)的等值或 in 条件(drizzle 谓词与裸 SQL 两种书写形态同视);
 *      ② `pre-scoped` —— 写链本身没有 SQL 级属主条件,但限死这批 id 的那次预查询**在别处**,分两档:
 *         **体内档**:同一函数体内一跳可追到带归属条件的预查询,且被写的 id 集接得上它(≤2 跳,沿具名
 *         局部变量/const 追);**一跳档(票面 ②)**:写链住在 db 层的具名导出函数里,而调用方先查 owned
 *         再把 id 传进来 —— **沿 import 解析**(说明符候选与具名绑定表都引门 134 那两份实现,含 `as` 别名)。
 *         放行条件是**全部可解析调用点都带证据**,不是任一处带证据(否则一个守法调用方就给整条 SQL 发
 *         合格证);两档都由 `connectToPreQuery` 这一份连接器判,不得各写一遍。报告里两档**分档计数**
 *         (`preScoped` 与其中的 `preScopedByHop`),因为"证据在同一屏"与"证据在调用方"的复核动作不同。
 *         ⇒ 「证据在别处」,**只报数不判红**;
 *      ③ `missing` —— 正面判出「写链的谓词可读、函数体内既无 SQL 级属主也无带属主的预查询」;
 *         这是 `--strict` 唯一判红的那一型(**"存量合法与真敞口必须逐条人工定性"**就是它不当场 blocking 的理由);
 *      ④ `undetermined` —— 形状判不了:解析不出所属函数体、where 由 `...spread`/变量间接拼出读不到、
 *         括号配平不到、有归属证据但接不上被写的 id 集,**以及上游一跳的三格盲区**:面里找不到该函数的
 *         调用点(调用方在射程外)、该模块被 `export *` 经 barrel 转发(调用方集合不可枚举)、调用方经
 *         `import * as` 命名空间引它(调用形态读不出) ⇒ **点名并计入未判定,既不冒红也不记绿**。
 *         这一档的读数一律现跑 `--json` 取,不得照本文件任何数字派单。
 *  - **O2 回报计数维度**:写链把"改了几行"取自库面(`.returning(` / 裸 SQL 的 RETURNING / `changes` /
 *     `rowCount` / 计数根来自写链返回集)还是请求侧 `.length`。**这一维只报数**:布尔/计数诚实性归守门 134,
 *     本门不得替它判红(两道门互指同一格是本仓最贵的一类事故)。
 *  - **O3 面纪律**:全量档判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 仅人工逃生舱、
 *     两面旗同给 ⇒ exit 2;内容一律经 `scripts/lib/face-reader.mjs` 的读取入口 `catBatch`(引了层却
 *     自己 `git show`/`readFileSync` = 半接线,守门 118 判红的那一型);枚举到 0 个候选 ⇒ **判死**,不记绿。
 *
 * 定级与红线(照本仓既有教训,不得自由发挥):
 *  - 默认档**只报数不判红**,`--strict` 才把 O1 的 `missing` 判红;`--strict` 下有 `undetermined`
 *    ⇒ **exit 2 拒绝出具合格证**(把没判写成判过了是本仓最高频失效型)。理由:共享工作区常年滞后 HEAD,
 *    而存量必须逐条人工定性才能分清合法与敞口;当场 blocking 就是一台与任何提交都无关的恒红门,
 *    唯一结局是逼人 `--no-verify` 连带废掉全部守门(AGENTS §12e)。
 *  - 存量按「该文件 HEAD 自身 missing 计数」套棘轮(`--staged` 档只拦"这次把敞口加回来"),
 *    不建手工白名单文件清单 —— 清单必然腐烂(同门 70/77/83/98/134)。
 *  - **不得**为让现读变好看而放宽判据,也不得给 `chat-queries.ts` 批量补 `where`。
 *  - 两条对照常驻自检(缺一条本尺就是在逼人给正确写法加噪音):
 *    反向对照 = `business-card-routes.ts` 那种「先查 owned 再删」喂进去**必须不判红**;
 *    阳性对照 = 把 `chat-queries.ts:212-221` 那型的预查询删掉后**必须点名该站点**。
 *
 * 覆盖面与如实登记的边界:
 *  - 射程 = `apps/api/src/db/` 与 `apps/api/src/routes/` 的 `.ts/.mts/.cts`(与守门 134 同一张面,
 *    两把尺子的读数以同一口径可比),排除 `tests/`、`__tests__/`、`e2e/`。
 *  - **写站点有两类来源,合成一份清单一起判**:① drizzle 的 `.update(`/`.delete(`(票面给的站点定义);
 *    ② 裸 SQL 写链 `db.execute(sql\`UPDATE/DELETE FROM/INSERT INTO/TRUNCATE\`)` —— 这一类的**定义**
 *    不重写第二份,直接 import 守门 134 的 `findRawSqlWriteChains`(它已是那一道门第三十批收进来的
 *    唯一实现)。本门对它问的是**另一个问题**(归属列在不在 WHERE),与 134 问的"affected 从哪来"
 *    不重叠,所以这一格不是"两道门互指同一格"。
 *    **两条如实的射程上限**:134 那份实现的接收者白名单是 `db|tx|trx`(不含 `dbScoped`),所以
 *    `dbScoped.execute(sql\`…\`)` 两侧都看不见;上游那种 `db.prepare(…).run(…)` 形态(node:sqlite)
 *    本仓没有(实测 `git grep -n "\.prepare(" apps/api/src` 零命中),不在射程。扩这两格属 134 的
 *    射程决策,不得由本层顺手改 —— 同 AGENTS 那条"门 71 那一面要不要同步扩,归该门持有人决定"。
 *  - **跨文件那一跳只看一跳,且只沿 import 的具名绑定**:票面 ② 要的"上游一跳预查询已限定(沿 import
 *    解析,同守门 134 的 B2 口径)"就是 `hopVerdict`/`runHopPass` 这一层;它**不复写**解析规则 ——
 *    说明符候选引 `moduleSpecCandidates`、具名绑定表引 `parseImportBindings`,都是门 134 那两份实现。
 *    **只一跳**:调用方自己又是别人的 db 层函数时不再往上追(第二跳的爆炸半径属另一票)。
 *    **证据面 ≠ 审判面**:找调用方时取材扩到 `apps/api/src`(调用方大多不住在 SCAN_DIRS 里),
 *    被审判的站点仍只有 SCAN_DIRS,且两面同一次 catBatch、同一档读满(分开读会产出自洽却错位的尺子)。
 *    因此 `missing` **不等于**"这里有敞口":它也可能只是"这一跳的证据本尺拿不到",必须逐条人工定性。
 *  - `.insert(` 不在射程:插入行的归属住在 values 里而不是谓词里,与 O1 问的不是同一件事。
 *
 * 取证(手动,例数一律以命令末行现读为准,本文不钉数字):
 *   node scripts/check-write-owner-predicate.mjs --self-test
 *   node --test scripts/tests/check-write-owner-predicate.test.mjs
 *   node scripts/check-write-owner-predicate.mjs            (全量档,判 HEAD blob)
 *   node scripts/check-write-owner-predicate.mjs --strict
 * 【接线状态:已接入】注册条目已落在 scripts/guardian-runner.mjs(id 以 runner 现值为准,
 *   勿照抄本行数字):blocking + skipEnv:HUSKY_SKIP_WRITE_OWNER_PREDICATE,带 stagedTriggers;
 *   根 package.json 另有 scripts.check:write-owner 手工问责入口(它走 --strict)。
 *   —— 本行原写"本门当前未接提交链(按任务书由主会话统一接线,注册表属共享文件)",
 *   那是立项时的实况,已过期(门早已装车);立论保留,接线事实按上条现读改写。
 * 问责档是 `--strict`。
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
import {
  blankByMask,
  maskCommentsAndStrings,
  maskedSpans,
  scanSpans,
} from './lib/code-mask.mjs'
// 「什么算一条裸 SQL 写链」不在本门重写第二份:直接引守门 134 那份唯一实现(它的动词搭配式与
// 括号配平都被自己的镜像测试钉着)。两处各扫一遍必漂移,而漂移的表现永远是"安静"(AGENTS §22c)。
import {
  findRawSqlWriteChains,
  moduleSpecCandidates,
  parseImportBindings,
} from './check-batch-write-count-honesty.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15,不写死盘符);`--root` 只作镜像测试的临时仓通道。 */
let ROOT = resolve(HERE, '..')

export const GATE = 'check-write-owner-predicate'
/** 应急跳过变量名(接线时由主会话写进 runner 条目;本脚本自身不读 env —— 没有跑不通的出路)。 */
export const SELF_SKIP = 'HUSKY_SKIP_WRITE_OWNER_PREDICATE'
/** 覆盖面只有这两面(与守门 134 同面)。扩面必须同批改「枚举表 + 判据」两半 —— AGENTS §4 记过同型。 */
export const SCAN_DIRS = ['apps/api/src/db', 'apps/api/src/routes']
/**
 * **证据面**(不是审判面):票面 ② 要求"上游一跳预查询已限定(沿 import 解析,同守门 134 的 B2 口径)",
 * 而"上游"绝大多数住在 `apps/api/src/routes/**` 之外的别处(services / 其它路由子目录),只看 SCAN_DIRS
 * 会把 db 层"调用方先查 owned、再把 id 传进来"这一族**整片算成 missing** —— 那正是票面点名禁止的
 * "逼人给正确写法加噪音"。所以找调用方时把取材扩到整个 `apps/api/src`,但**被审判的站点仍只有
 * SCAN_DIRS**,且证据与站点**同面同轮**(都走 face-reader 的同一次档;面里取不到 ⇒ 判不了,不回落)。
 * 两条有界护栏(超过就承认判不了,绝不猜合规):单模块的调用方文件数、单函数的调用点数。
 */
export const HOP_EVIDENCE_DIR = 'apps/api/src'
const HOP_MAX_IMPORTER_FILES = 24
const HOP_MAX_CALL_SITES = 40
const FILE_RE = /\.(ts|mts|cts)$/
const SKIP_RE = /(^|\/)(?:tests?|__tests__|e2e)\//
/** 自豁免:本门源码与镜像测试里全是判据字面量 */
const SELF_EXEMPT = [
  'scripts/check-write-owner-predicate.mjs',
  'scripts/tests/check-write-owner-predicate.test.mjs',
]

/**
 * 库句柄的接收者白名单。门 134 用的是 `db|tx|trx`,这里**刻意扩到 O4 数据作用域闸的那两个出口**
 * (`dbScoped` / `dbReadScoped`,见 `apps/api/src/db/index.ts:193/198`)—— 判据必须覆盖同一件事的
 * 另一种书写形态,否则经 scoped 出口发出的写整型隐身(AGENTS「一条门只管自己立项那一型,就是这一型的洞」)。
 * `dbRead` 也在列:它不是写入口,但 O1 的 pre-scoped 要找的**预查询**正是挂在它上面
 * (实测 `apps/api/src/routes/other/business-card-routes.ts:294-307` 就是 `dbRead.select` + 属主比较 + `db.delete`)。
 * 认接收者是防误伤的第一道:`server.delete(` 是路由注册(HEAD 面 408 处)、`map.delete(` 是内存 Map,
 * 两者都不是"一条被发出的 SQL"。
 */
const DB_RECEIVERS = new Set([
  'db',
  'tx',
  'trx',
  'dbScoped',
  'dbReadScoped',
  'dbRead',
  'dbWrite',
])

/**
 * 归属列名单(**单一真相**:O1 的 drizzle 判据、裸 SQL 判据、属主比较守卫判据、自检的名单正向证明
 * 四处都从这里派生,不得在别处再抄一份名字)。camel 档取 drizzle schema 的字段名,snake 档取其
 * 落库列名 —— 两种书写形态在真仓同时存在(裸 SQL 见 `apps/api/src/db/audit-queries.ts`)。
 * 名单**不收** `conversationId` / `messageId` / `agentId` 这类"内容引用":它们标识的是被操作的行,
 * 不是"这一行属于谁";把它们当归属列等于给任何按 id 的写发合格证。
 */
export const OWNER_COLUMNS = Object.freeze([
  'userId',
  'ownerId',
  'memberId',
  'roleId',
  'workspaceId',
  'createdById',
  'authorId',
  'creatorId',
  'orgId',
  'teamId',
  'accountId',
  'tenantId',
])
/** camel → snake 只按同一条规则推导(加一列不必登记两处)。 */
const OWNER_SNAKE = OWNER_COLUMNS.map((c) => c.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase())
/** drizzle 谓词里的归属条件:`eq(<表>.<归属列>, …)` / `inArray(<表>.<归属列>, …)`。 */
const OWNER_SQL_RE = new RegExp(
  `\\b(?:eq|inArray)\\s*\\(\\s*[\\w$]*(?:\\.[\\w$]+)*\\.(?:${OWNER_COLUMNS.join('|')})\\b`,
)
/** 裸 SQL(`sql\`…\``)里的归属条件:snake 列名 = ? / IN (…)。 */
const OWNER_RAW_RE = new RegExp(
  `\\b(?:${OWNER_SNAKE.join('|')})\\b\\s*(?:=|<=>|in\\s*\\(|is\\s+distinct\\s+from\\s*\\()`,
  'i',
)
/** 模板插值里直接引列:`sql\`${chatConversations.userId} = ${userId}\`` —— 也算 SQL 级归属。 */
const OWNER_INTERP_RE = new RegExp(`\\$\\{[^}]*\\.(?:${OWNER_COLUMNS.join('|')})\\s*(?:\\}|\\.)`)
/** 属主比较守卫(「先查 owned 再比」那一型):`row.userId !== userId` / `userId !== row.userId`。 */
const OWNER_GUARD_RE = new RegExp(
  `\\b[\\w$]+(?:\\.[\\w$]+)*\\.(?:${OWNER_COLUMNS.join('|')})\\s*(?:!==?|===?)\\s*[\\w$.]+` +
    `|\\b(?:${OWNER_COLUMNS.join('|')})\\s*(?:!==?|===?)\\s*[\\w$]+(?:\\.[\\w$]+)*\\b`,
)
/** 写链的回报口径:改了几行问库。`changes` / `rowCount` / `affectedRows` / `RETURNING`。 */
const LIB_CONFIRMED_RE = /\b(?:changes|rowCount|affectedRows)\b|\bRETURNING\b/i
/** 函数体内一条读链(找预查询用)。 */
const READ_VERB_RE = /\.(select|execute)\s*\(/g

const USAGE = `用法:
  node scripts/check-write-owner-predicate.mjs [--staged|--worktree] [--strict]
      [--json] [--explain] [--limit N] [--files a.ts,b.ts] [--root <git 根>] [--self-test]

  缺省档:判 HEAD blob(全量审计) —— 现读只报数,不判红(存量必须逐条人工定性,§12e)。
  --strict:问责档 —— O1 有 missing 即判红;有 undetermined 则 exit 2(拒绝出具合格证)。
  --staged:判索引 blob(提交链口径)—— missing 按「该文件 HEAD 自身计数」套棘轮,只拦新增。
  --worktree:仅人工排查(共享工作树常年滞后 HEAD,提交链不走这档)。
  --explain:逐站点点名(含判据吃到的 where 文本),复核判据时用它。
`

/* ------------------------------ 词法遮噪 ------------------------------ */

/**
 * **只把字符串/模板的内容**大写归一,代码面一个字节都不动,且保证等长。
 * 为什么需要它:门 134 那份裸 SQL 实现的动词判据是 `UPDATE\s+"?[A-Za-z_]`(不带 `i` 旗),而本票立项
 * 引用的那一族上游 SQL 写的正是小写 `update session`(`sessions.ts:289-294` 逐字)—— 直接喂原文,
 * 门对**本票自己的原始形状**整型隐身。
 * 为什么不能整张脸 `toUpperCase()`(我自己踩过,由构造面现形):那条实现的接收者匹配是**小写字面量**
 * `\bdb\b\s*\.\s*execute\s*\(`,全量归一把 `db.execute(` 变成 `DB.EXECUTE(` ⇒ 站点数直接归零。
 * 所以归一只作用在 `scanSpans()`(lib 的那一台分词器)判为 string 的区间上。
 * 等长由 `upperSameLength` 逐字符保证;归一后的面**只用于找链**,取回的区间再回原文那一档读
 * (谓词大小写敏感的东西一律不吃归一面)。
 */
export function upperInsideStringsOnly(src) {
  const s = String(src || '')
  if (!s) return ''
  let out = ''
  let pos = 0
  for (const span of scanSpans(s)) {
    if (span.kind !== 'string') continue
    if (span.start < pos) continue
    out += s.slice(pos, span.start)
    out += upperSameLength(s.slice(span.start, span.end))
    pos = span.end
  }
  out += s.slice(pos)
  return out.length === s.length ? out : s // 理论上不该不等长;真发生了就放弃归一,绝不留下错位的面
}

/**
 * **等长**大写归一:逐字符映射,凡"大写形态长度会变"的字符(如 `ß` → `SS`)一律留原样。
 * 为什么不能用 `String.prototype.toUpperCase()`:本门的下标在三档文本之间必须**逐位对齐**
 * (结构档配平出的区间要能直接喂进保留字符串那一档取模板内容),一次长度漂移就让所有行号与
 * 区间整体错位 —— 而错位表现为"判出来了",这是最难发现的那种错。
 */
export function upperSameLength(s) {
  const src = String(s || '')
  let out = ''
  for (const ch of src) {
    const u = ch.toUpperCase()
    out += u.length === ch.length ? u : ch
  }
  return out
}

/**
 * 只遮注释、**保留字符串**、且**逐字符保位**的那一档。
 * 为什么不用 `maskComments`(它也只遮注释):它把行注释整段删掉 ⇒ 列位漂移,同一个下标在两档里
 * 指向不同字符,而本门的判据要拿"结构档里配平出来的 where 区间"去原文里取模板内容。
 * 实现只做一件事:把 `maskedSpans()`(lib 的那一台分词器)给出的注释区间交给 `blankByMask()`。
 * 这里**没有第二台词法机** —— 由镜像测试锁住(不得再出现自写的字符串/注释状态机)。
 */
export function blankCommentsOnly(src) {
  if (typeof src !== 'string' || src.length === 0) return ''
  const mask = new Uint8Array(src.length)
  // maskedSpans() 同时给注释与字符串两类区间;这里**只要注释那一类** —— 字符串留着,
  // 因为裸 SQL 的归属列就住在 `sql\`…\`` 的模板体里。把两类一起抹,判据对整型缺陷就全盲
  // (与守门 93 R6"从注释文本里 harvest 出假用量"是同一条禁令的反方向)。
  for (const s of maskedSpans(src)) {
    if (s.kind !== 'comment') continue
    for (let i = s.start; i < s.end; i++) if (src[i] !== '\n') mask[i] = 1
  }
  return blankByMask(src, mask)
}

/* ------------------------------ 结构扫描 ------------------------------ */

function closePair(src, openIdx, o, c) {
  let depth = 0
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === o) depth++
    else if (src[i] === c && --depth === 0) return i + 1
  }
  return -1
}
const closeParen = (s, i) => closePair(s, i, '(', ')')
const closeBrace = (s, i) => closePair(s, i, '{', '}')

/** 下标 → 行号(从 1 起)。两档遮噪都逐字符保位,所以同一个下标对两档都成立。 */
export function lineAt(src, idx) {
  let n = 1
  const limit = Math.min(idx, src.length)
  for (let i = 0; i < limit; i++) if (src[i] === '\n') n++
  return n
}

/**
 * 函数体 = `=>` 后紧跟 `{`,或 `function` 头部之后的第一个顶层 `{`(沿用门 134 的理由:取"最小
 * 同时包住两件事的花括号块"会让兄弟 handler 互相借证据 —— 那等于把判据建立在几何上)。
 */
export function findFunctionBodies(code) {
  const bodies = []
  const push = (b) => {
    if (b >= 0 && code[b] === '{') {
      const end = closeBrace(code, b)
      if (end > 0) bodies.push({ start: b, end })
    }
  }
  let m
  const arrow = /=>/g
  while ((m = arrow.exec(code)) !== null) {
    const rest = /^\s*\{/.exec(code.slice(m.index + 2, m.index + 12))
    if (rest) push(m.index + 2 + rest[0].length - 1)
  }
  const fn = /\bfunction\b/g
  while ((m = fn.exec(code)) !== null) {
    let i = m.index + 8
    while (i < code.length && /[\w$\s]/.test(code[i])) i++ // 函数名(匿名的 `function(` 直接跳过这一步)
    if (code[i] !== '(') continue
    const paramsEnd = closeParen(code, i)
    if (paramsEnd < 0) continue
    push(bodyOpenAfterParams(code, paramsEnd))
  }
  return bodies
}

/**
 * 形参表右括号之后,返回类型标注里第一个**不在尖括号/圆括号内**的 `{`。
 * 必须跳泛型:`): Promise<{ title: string }> {` 里第一个花括号是类型的一部分,不是函数体。
 * 走到 `;` 或深度 0 的 `}` 都算"这不是一个函数声明"(或写法超出本尺的解析能力)⇒ 返回 -1,
 * 由调用方把站点落 **undetermined** 并点名,绝不猜一个花括号当函数体 —— 拿类型标注当体会把
 * 整条判据建立在错位的区间上,而错位表现为"什么都没判出来"。
 */
function bodyOpenAfterParams(code, afterParams) {
  let depth = 0
  for (let i = afterParams; i < code.length; i++) {
    const c = code[i]
    if (c === '<' || c === '(' || c === '[') depth++
    else if (c === '>' || c === ')' || c === ']') {
      if (depth > 0) depth--
    } else if (c === '{' && depth === 0) return i
    else if (c === ';' && depth === 0) return -1
    else if (c === '}' && depth === 0) return -1
  }
  return -1
}

function enclosingBody(bodies, idx) {
  let best = null
  for (const b of bodies)
    if (idx >= b.start && idx < b.end && (!best || b.start > best.start)) best = b
  return best
}

/**
 * 一条链的全部环节(名字 + 实参文本 + 实参起点)。配平不到 ⇒ 如实报 `broken`。
 * 从 `.update(`/`.delete(`/`.select(` 那一刻往后走,所以跨行写法天然覆盖(真仓实测存在:
 * `await tx.delete(chatMessages)\n  .where(...)`)。
 */
function walkLinks(code, fromMatchEnd) {
  const links = []
  let cur = fromMatchEnd
  let broken = false
  for (;;) {
    const cm = /^\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/.exec(code.slice(cur, cur + 120))
    if (!cm) break
    const open = cur + cm[0].length - 1
    const cend = closeParen(code, open)
    if (cend < 0) {
      broken = true
      break
    }
    links.push({ name: cm[1], text: code.slice(open + 1, cend - 1), argStart: open + 1, end: cend })
    cur = cend
  }
  return { links, end: cur, broken }
}

/** 接收者 + 动词命中的一条链(drizzle 形态)。`rawSql:false` 与门 134 的返回形态同构,便于对照。 */
export function findWriteChains(code) {
  const out = []
  const re = /\.(delete|update)\s*\(/g
  let m
  while ((m = re.exec(code)) !== null) {
    const rec = /([A-Za-z_$][\w$]*)\s*$/.exec(code.slice(0, m.index))
    if (!rec || !DB_RECEIVERS.has(rec[1])) continue
    const open = code.indexOf('(', m.index)
    const callEnd = closeParen(code, open)
    if (callEnd < 0) {
      out.push({
        start: m.index,
        end: m.index,
        receiver: rec[1],
        verb: m[1],
        links: [],
        broken: true,
      })
      continue
    }
    const first = {
      name: m[1],
      text: code.slice(open + 1, callEnd - 1),
      argStart: open + 1,
      end: callEnd,
    }
    const rest = walkLinks(code, callEnd)
    out.push({
      start: m.index,
      end: rest.end,
      receiver: rec[1],
      verb: m[1],
      links: [first, ...rest.links],
      broken: rest.broken,
      hasWhere: [first, ...rest.links].some((l) => l.name === 'where'),
      hasReturning: [first, ...rest.links].some((l) => l.name === 'returning'),
    })
  }
  return out
}

/** 同一接收者发起的**读**链(`.select(` / `.execute(`),用于找预查询。 */
function findReadChains(code) {
  const out = []
  let m
  const re = /\.(select|execute)\s*\(/g
  while ((m = re.exec(code)) !== null) {
    const rec = /([A-Za-z_$][\w$]*)\s*$/.exec(code.slice(0, m.index))
    if (!rec || !DB_RECEIVERS.has(rec[1])) continue
    const open = code.indexOf('(', m.index)
    const callEnd = closeParen(code, open)
    if (callEnd < 0) continue
    const first = { name: m[1], text: code.slice(open + 1, callEnd - 1), argStart: open + 1 }
    const rest = walkLinks(code, callEnd)
    out.push({
      start: m.index,
      end: rest.end,
      receiver: rec[1],
      verb: m[1],
      links: [first, ...rest.links],
      broken: rest.broken,
    })
  }
  return out
}

const CONTINUE_CHARS = new Set(['.', ',', '+', '-', '*', '/', '%', '&', '|', '?', ':', ')', '}', ']', '=', '<', '>'])
/** 语句结尾:深度 0 的 `;`,或深度 0 换行且下一行不是续行(口径同门 134 的 statementEnd)。 */
function statementEnd(code, from, limit) {
  let depth = 0
  for (let i = from; i < limit; i++) {
    const c = code[i]
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') {
      if (depth > 0) depth--
    } else if (c === ';' && depth === 0) return i
    else if (c === '\n' && depth === 0) {
      let k = i + 1
      while (k < limit && /\s/.test(code[k])) k++
      if (k >= limit || !CONTINUE_CHARS.has(code[k])) return i
    }
  }
  return limit
}

/** 在给定区间内找 `const|let|var <name> =` 的所有右端(≤2 跳追溯用)。 */
function initializersOf(code, span, name) {
  const re = new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=`, 'g')
  const out = []
  let m
  while ((m = re.exec(code)) !== null) {
    if (m.index < span.start || m.index >= span.end) continue
    const eq = m.index + m[0].length - 1
    out.push({ rhsStart: eq + 1, rhs: code.slice(eq + 1, statementEnd(code, eq + 1, span.end)) })
  }
  return out
}

/** `const [existing] = …` / `const rows = …` 的**声明名 + 其 RHS 起点**,用于把读链结果变量认出来。 */
function declarationsOf(code, span) {
  const out = []
  const re = /\b(?:const|let|var)\s+(\[[^\]\n]{1,80}\]|[A-Za-z_$][\w$]*)\s*=/g
  let m
  while ((m = re.exec(code)) !== null) {
    if (m.index < span.start || m.index >= span.end) continue
    const eq = m.index + m[0].length - 1
    out.push({
      names: (m[1].startsWith('[') ? [...m[1].matchAll(/[A-Za-z_$][\w$]*/g)].map((x) => x[0]) : [m[1]]),
      rhsStart: eq + 1,
      rhsEnd: statementEnd(code, eq + 1, span.end),
    })
  }
  return out
}

/* ------------------------------ 判据 O1 ------------------------------ */

/** 一条 drizzle 链的 where 实参文本(可能有多条 where,全部并起来看)。 */
function whereOf(chain) {
  return (chain.links || []).filter((l) => l.name === 'where')
}

/** SQL 关键字/函数名:裸 SQL 的 WHERE 段里这些不是"被写的 id 根"。 */
const SQL_NOISE = new Set([
  'and',
  'or',
  'not',
  'where',
  'set',
  'update',
  'delete',
  'from',
  'select',
  'in',
  'is',
  'null',
  'isnull',
  'distinct',
  'case',
  'when',
  'then',
  'else',
  'end',
  'max',
  'min',
  'count',
])

/**
 * 取出一条写链的**谓词面**(判归属条件与取被写 id 根的唯一取材)。
 * 两条来源合成一份结论,避免"drizzle 走一条判据、裸 SQL 走另一条"造成同一格两种口径:
 *  - drizzle 链:每个 `.where(…)` 的实参(可再经 ≤2 跳变量解析);
 *  - 裸 SQL 链:SQL 文本里 `WHERE` 之后的那一段(条件集读不全时如实返回不可读)。
 * @returns {{preds:{text:string,rawText:string,identsText:string,mode:'sql'|'drizzle'}[], noPredicate:boolean, opaqueWhy:string}}
 */
export function predicatesOf({ code, raw, chain, span }) {
  if (chain.rawSql) {
    const sqlText = typeof raw === 'string' ? raw.slice(chain.start, chain.end) : ''
    const at = sqlText.search(/\bWHERE\b/i)
    if (at < 0) return { preds: [], noPredicate: true, opaqueWhy: '' }
    const whereSql = sqlText.slice(at)
    if (/\bsql\s*\.\s*raw\s*\(/.test(whereSql))
      return {
        preds: [{ text: whereSql, rawText: whereSql, identsText: '', mode: 'sql' }],
        noPredicate: false,
        opaqueWhy: 'WHERE 段里有 sql.raw(),条件集是拼出来的 ⇒ 读不全',
      }
    // 值侧标识符只取 `${…}` 插值里的名字:`where id = ${input.sessionID}` ⇒ 根是 `input`/`sessionID`。
    // 把列名(`id`)也当根,会让任何两次都写过 `id` 的查询互相认亲 ⇒ 敞口被洗成 pre-scoped。
    const interp = [...whereSql.matchAll(/\$\{([^{}]*)\}/g)].map((x) => x[1]).join(' ')
    if (!interp && /\?\s*(?:,|\)|$)/.test(whereSql))
      // 位置参数绑定的值住在 `.run(a, b, c)` 的参数表里,静态读不出绑定顺序 ⇒ 不猜
      return {
        preds: [{ text: whereSql, rawText: whereSql, identsText: '', mode: 'sql' }],
        noPredicate: false,
        opaqueWhy: 'WHERE 用 ? 位置参数,绑定的值读不出对应关系 ⇒ 判不了',
      }
    return {
      preds: [{ text: whereSql, rawText: whereSql, identsText: interp, mode: 'sql' }],
      noPredicate: false,
      opaqueWhy: '',
    }
  }
  const wheres = whereOf(chain)
  if (!wheres.length) return { preds: [], noPredicate: true, opaqueWhy: '' }
  const preds = []
  let opaqueWhy = ''
  for (const link of wheres) {
    const r = resolveWhereText(code, span, link)
    if (!r.readable) {
      opaqueWhy = opaqueWhy || r.why
      continue
    }
    const rawText =
      typeof raw === 'string' ? raw.slice(link.argStart, link.argStart + link.text.length) : ''
    preds.push({ text: r.text, rawText, identsText: r.text, mode: 'drizzle' })
  }
  return { preds, noPredicate: false, opaqueWhy }
}

/**
 * 取"值侧"标识符:跳过属性名(`input.sessionID` 只取 `input`)、函数调用名(`max(…`)、
 * SQL 关键字与归属列本身(归属列名是**主体的名字**,不是"被写哪一行"的名字)。
 */
export function valueIdentifiers(text) {
  const out = new Set()
  const src = String(text || '')
  for (const m of src.matchAll(/[A-Za-z_$][\w$]*/g)) {
    const id = m[0]
    if (src[m.index - 1] === '.') continue // 属性名
    if (src[m.index + id.length] === '(') continue // 函数调用名
    if (SQL_NOISE.has(id.toLowerCase()) || OWNER_COLUMNS.includes(id)) continue
    out.add(id)
  }
  return out
}

/**
 * 被写的 id 根 —— **两条来源各用各的取法,且都不许退到"整段谓词里出现过谁"**:
 *  - drizzle:只取 `eq(<表>.<列>, <值>)` / `inArray(<表>.<列>, <值>)` 的**值侧**标识符;
 *  - 裸 SQL:只取 `${…}` 插值里的对象标识符。
 * 退到"标识符全集"的松判据会让 `eq` / `and` / `id` 这类人人皆写的名字把两次无关的查询判成
 * "同一批 id",于是敞口被洗成 pre-scoped —— 那是本门最贵的一种错(它表现为"门一切正常")。
 */
export function rootsOf(preds) {
  const roots = new Set()
  for (const p of preds || []) {
    if (p.mode === 'sql') {
      for (const id of valueIdentifiers(p.identsText)) roots.add(id)
      continue
    }
    for (const r of collectIdRoots(p.text)) roots.add(r)
  }
  return roots
}

/**
 * 归属条件在不在?**两档同看**:
 *  - 结构档(注释与字符串都抹)⇒ 认 drizzle 谓词里的列名;
 *  - 保留字符串档 ⇒ 认裸 SQL 里的 snake 列名与 `${tbl.userId}` 这种模板插值。
 * 只吃结构档会把 `db.execute(sql\`… where user_id = ?\`)` 整型隐身;只吃保留字符串档会把
 * 注释里写的那句"应当带 user_id 条件"当成归属 —— 两个方向都会错,所以必须分档各认各的形态。
 */
export function hasOwnerPredicate(structText, rawText) {
  if (typeof structText !== 'string') return { hit: false, why: '取不到 where 文本' }
  if (OWNER_SQL_RE.test(structText)) return { hit: true, why: 'drizzle 谓词含归属列' }
  if (typeof rawText === 'string' && (OWNER_RAW_RE.test(rawText) || OWNER_INTERP_RE.test(rawText)))
    return { hit: true, why: '裸 SQL / 模板插值含归属列' }
  return { hit: false, why: '' }
}

/**
 * where 能不能读?三种读法都算可读:直接写着的谓词、变量指向的初值(≤2 跳)。
 * `and(...conds)` 里的 spread、以及值来自形参(函数外部)⇒ **判不了**,不得猜成合规也不得猜成违规。
 * @returns {{readable:boolean, text:string, why:string}}
 */
export function resolveWhereText(code, span, link) {
  const raw = link.text
  const spread = /\.\.\./.test(raw)
  const idOnly = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(raw)
  if (!idOnly) {
    if (spread) {
      // 直接展开出来的谓词集:整片可见时仍可读(展开的初值在别处),这里保守判不了
      return { readable: false, text: raw, why: 'where 由 ...spread 组装,条件集读不全' }
    }
    return { readable: true, text: raw, why: '' }
  }
  const name = idOnly[1]
  let cur = raw
  for (let hop = 0; hop < 2; hop++) {
    const inits = initializersOf(code, span, name)
    if (!inits.length) break
    const rhs = inits[inits.length - 1].rhs
    if (/\.\.\./.test(rhs))
      return { readable: false, text: rhs, why: `where ← ${name} 的初值含 ...spread,条件集读不全` }
    if (/\b(?:eq|inArray|and|or|sql)\b/.test(rhs)) return { readable: true, text: rhs, why: `经 ${name} 一跳` }
    cur = rhs
  }
  return { readable: false, text: cur, why: `where ← ${name} 追不到可读初值(可能来自形参/别处)` }
}

/** 被写的 id 根:谓词里等值/in 的**值侧**标识符(`eq(t.id, id)` ⇒ `id`)。 */
export function collectIdRoots(whereText) {
  const roots = new Set()
  const re = /\b(?:eq|inArray)\s*\(\s*[\w$]*(?:\.[\w$]+)*\.([\w$]+)\s*,\s*([A-Za-z_$][\w$]*)/g
  let m
  while ((m = re.exec(whereText)) !== null) {
    if (OWNER_COLUMNS.includes(m[1])) continue
    roots.add(m[2])
  }
  return roots
}

/**
 * 预查询这一侧的"身份钥匙":哪些名字能证明"这次写动的就是它查过的那一行"。
 * 三个来源,每个都**只收值侧名字**(收列名会让两次无关查询互相认亲):
 *  ① drizzle 谓词 `eq(<表>.<列>, <值>)` 的值侧标识符;
 *  ② 裸 SQL 里 `${…}` 插值的对象名;
 *  ③ 那条读链的结果变量(`const owned = await db.select()…` ⇒ `owned`)。
 */
export function readKeys(r, rText, rRaw, decls) {
  const out = new Set()
  for (const x of collectIdRoots(rText)) out.add(x)
  const interp = [...String(rRaw || '').matchAll(/\$\{([^{}]*)\}/g)].map((x) => x[1]).join(' ')
  for (const x of valueIdentifiers(interp)) out.add(x)
  for (const x of readResultNames(decls || [], r)) out.add(x)
  return out
}

/** 谓词文本里出现过的标识符(取样报告用;判据不吃它,判据只吃 readKeys / rootsOf)。 */
export function identifiersOf(text) {
  const out = new Set()
  for (const m of String(text || '').matchAll(/[A-Za-z_$][\w$]*/g)) out.add(m[0])
  return out
}

/**
 * O1 单站点判据(纯函数,输入一份文件的三档文本与一条写链)。
 *
 * 判序是**四条而不是两条**,因为"读不出来"和"读出来确实没有"在账面上必须长得不一样:
 *  ① 谓词可读且含归属列 ⇒ `sql-scoped`;
 *  ② 谓词可读、无归属列,但同一函数体内一跳可追到带归属的预查询、且接得上被写的 id ⇒ `pre-scoped`;
 *  ③ 谓词可读、体内既无 SQL 级归属也无带归属的预查询 ⇒ `missing`(`--strict` 唯一判红的那一型);
 *  ④ 其余(谓词读不全 / 有归属证据但接不上 / 括号配平不到)⇒ `undetermined`,点名并报原因。
 * 第 ④ 支存在的全部理由:把"没判"写成"判过了"是本仓最高频失效型;把它并进 ③ 就会造出一台
 * 靠判据失灵刷红的门,把它并进 ② 就是给敞口发合格证。
 * @returns {{state:'sql-scoped'|'pre-scoped'|'missing'|'undetermined', why:string, evidence?:string}}
 */
export function judgeOwner({ code, raw, chain, span, readChains, decls }) {
  if (chain.broken) return { state: 'undetermined', why: '写链括号配平不到,谓词读不全' }
  const { preds, noPredicate, opaqueWhy } = predicatesOf({ code, raw, chain, span })
  if (noPredicate)
    return {
      state: 'missing',
      why: chain.rawSql ? '裸 SQL 写没有 WHERE(全表写),谈不上归属列' : '写链根本没有 where(无条件全表写),谈不上归属列',
    }
  for (const p of preds) {
    const own = hasOwnerPredicate(p.text, p.rawText)
    if (own.hit)
      return { state: 'sql-scoped', why: own.why, evidence: (p.text || '').trim().replace(/\s+/g, ' ').slice(0, 160) }
  }
  // 有任何一条谓词读不全 ⇒ 整站判不了(绝不因为"另一条读出来没有归属列"就判成 missing)
  if (opaqueWhy) return { state: 'undetermined', why: opaqueWhy }

  const idRoots = rootsOf(preds)

  // 预查询判定走**共用连接器**(与上游一跳同一份实现,见 connectToPreQuery):
  // linked ⇒ pre-scoped;unlinked(有归属证据但接不上)⇒ undetermined;none ⇒ missing。
  // 三态各归各位:把 unlinked 并进 missing 会造出一台靠判据失灵刷红的门,并进 pre-scoped
  // 就是给敞口发合格证 —— 两条都是本仓记过最多次的失效型。
  const link = connectToPreQuery({
    code,
    raw,
    span,
    reads: readChains,
    decls,
    idRoots,
    beforeEnd: chain.start,
  })
  if (link.link === 'linked') return { state: 'pre-scoped', why: link.why, evidence: link.evidence }
  if (link.link === 'unlinked')
    return { state: 'undetermined', why: '体内有带归属的预查询,但接不上被写的 id 集(不猜合规也不猜违规)' }
  return { state: 'missing', why: '写链谓词可读、函数体内既无 SQL 级归属条件也无带归属的预查询' }
}

/** 读链的结果变量名集合(用于 B 型连接)。 */
function readResultNames(decls, read) {
  const out = new Set()
  for (const d of decls || []) {
    if (d.rhsStart <= read.start && d.rhsEnd >= read.end) for (const n of d.names) out.add(n)
  }
  return out
}

/** root 是否 ≤2 跳追到某条读链的结果变量。 */
function traceToRead(code, span, decls, read, root, depth) {
  if (depth > 2) return false
  const names = readResultNames(decls, read)
  if (names.has(root)) return true
  for (const it of initializersOf(code, span, root)) {
    if (it.rhs.length > 4000) continue
    if ([...names].some((n) => new RegExp(`\\b${n}\\b`).test(it.rhs))) return true
    if (depth < 2) {
      for (const mm of it.rhs.matchAll(/[A-Za-z_$][\w$]*/g)) {
        if (traceToRead(code, span, decls, read, mm[0], depth + 1)) return true
      }
    }
  }
  return false
}

/* ------------------------------ 判据 O1c:CAS(只报数) ------------------------------ */

/**
 * 票面 ① 的原话是「SQL 级属主 「SQL 级属主 / CAS 条件」(原文里的斜体星号会提前闭合块注释,这里是同一条说明)」,而上游那族把三件事写进同一条语句:归属列在 where、
 * **被改列的旧值也在 where**(`set directory=?, path=? … where … and directory=? and ((? is null
 * and path is null) or path=?)`)。归属列齐了 **不等于** 有 CAS:缺 CAS 的写法挡得住越权,挡不住
 * 「把读取快照里的旧值覆盖到并发新值上」—— 那正是 `chat-queries.ts:212-221` 那一型的第二格
 * (票面点名:它「挡不住 TOCTOU,也挡不住改了 0 行回成功」)。
 *
 * 判据一条:被改列集合 ∩ 谓词列集合 **非空** ⇒ cas-present;空 ⇒ cas-absent。
 * **这一维永不判红** —— 哪些站点的写属于「维护性/迁移性」而必须强制 CAS 是**人工裁决**(用户主动
 * 改标题本来就不需要 CAS),当场判红等于给全站 update 造一台与提交内容无关的恒红门(§12e)。
 * 它进报告的意义是把「归属齐了但仍会覆盖并发值」这一族**点名成可复核清单**,不替人拍板。
 * 与 O2 同为只报数:两道门互指同一格是本仓最贵的一类事故,所以 CAS 也不进 violations/decide。
 * @returns {{cas:'cas-present'|'cas-absent'|'not-applicable'|'undetermined', why:string}}
 */
export function judgeCas({ code, raw, chain, span }) {
  const setCols = new Set()
  let opaque = false
  if (chain.rawSql) {
    const sqlText = (typeof raw === 'string' ? raw.slice(chain.start, chain.end) : '').replace(/\s+/g, ' ')
    const m = /\bSET\s+(.+?)\bWHERE\b/i.exec(sqlText)
    if (!m)
      return /\bINSERT\s+INTO\b/i.test(sqlText) || /\bTRUNCATE\b/i.test(sqlText)
        ? { cas: 'not-applicable', why: 'INSERT/TRUNCATE 没有被改列,CAS 这一维不适用' }
        : { cas: 'undetermined', why: '读不到 SET 段(形态不在本尺射程)' }
    for (const part of m[1].split(',')) {
      const t = part.trim()
      const interp = /^\$\{([^}]*)\}\s*=/.exec(t)
      const plain = /^["'`]?([A-Za-z_][\w$]*)["'`]?\s*=/.exec(t)
      const col = interp ? interp[1].split('.').pop() : plain ? plain[1] : ''
      if (!col) opaque = true
      else setCols.add(col.toLowerCase())
    }
  } else {
    const setLink = (chain.links || []).find((l) => l.name === 'set')
    if (!setLink)
      return chain.verb === 'delete'
        ? { cas: 'not-applicable', why: 'DELETE 没有被改列,CAS 这一维不适用' }
        : { cas: 'undetermined', why: '链上没有 .set( 段(update 的这写法不在射程)' }
    const body = setLink.text.trim().replace(/^[{\s]+/, '').replace(/[}\s]+$/, '')
    for (const part of body.split(',')) {
      const t = part.trim()
      if (!t) continue
      if (t.startsWith('...')) {
        opaque = true
        continue
      }
      const kv = /^([A-Za-z_$][\w$]*)\s*:/.exec(t) || /^([A-Za-z_$][\w$]*)$/.exec(t)
      if (!kv) opaque = true
      else setCols.add(kv[1])
    }
  }
  if (!setCols.size)
    return { cas: 'undetermined', why: opaque ? '被改列集合含 spread/不可枚举形态 ⇒ 判不了' : '读不出被改列' }
  const { preds } = predicatesOf({ code, raw, chain, span })
  if (!preds.length) return { cas: 'undetermined', why: '谓词读不全,谈不上两个列集合求交' }
  const whereCols = new Set()
  for (const pd of preds) {
    if (pd.mode === 'sql') {
      for (const mm of String(pd.text).matchAll(/["'`]?([A-Za-z_][\w$]*)["'`]?\s*(?:=|<=>|\bin\s*\()/gi))
        whereCols.add(mm[1].toLowerCase())
      // 插值形态 `${chatConversations.userId} = ${userId}` 里,列名住在插值的**末段**
      for (const mm of String(pd.text).matchAll(/\$\{([^}]*)\}\s*=/g))
        whereCols.add(mm[1].split('.').pop().toLowerCase())
    } else {
      for (const mm of String(pd.text).matchAll(/\b(?:eq|ne|gt|gte|lt|lte|inArray)\s*\(\s*[\w$]*(?:\.[\w$]+)*\.([A-Za-z_$][\w$]*)/g))
        whereCols.add(mm[1])
    }
  }
  const hit = [...setCols].filter((c) => whereCols.has(c) || whereCols.has(c.toLowerCase()))
  if (hit.length) return { cas: 'cas-present', why: `被改列 ${hit.slice(0, 3).join(', ')} 同时出现在谓词里(旧值做 CAS)` }
  // 有 spread/不可枚举的被改列时,"没找到交集"只证明**已枚举的那几列**没做 CAS,不证明整条语句没做
  // ⇒ 判不了,不许悄悄算 absent(把没判写成判过了),也不许悄悄算 present。
  if (opaque) return { cas: 'undetermined', why: '被改列集合含 spread/不可枚举形态,已枚举部分又无交集 ⇒ 判不了' }
  return {
    cas: 'cas-absent',
    why: `被改列(${[...setCols].slice(0, 3).join(', ')})与谓词列无交集 ⇒ 归属齐了仍可能覆盖并发新值`,
  }
}

/* ------------------------------ 判据 O2(只报数) ------------------------------ */

/**
 * 回报口径:改了几行问库还是问请求。
 * 四态:`from-lib`(库确认集)/ `from-request`(请求侧 .length)/ `not-reporting`(这一屏不回计数)/
 * `undetermined`(判不了)。
 * **本维永不判红** —— 布尔/计数诚实性归守门 134,两道门互指同一格是本仓最贵的一类事故。
 */
export function judgeReportFace({ code, raw, chain, span }) {
  // 取材按链的形态分档:drizzle 的结构住在代码面(`.returning(` 是代码),
  // 裸 SQL 的 RETURNING / changes 住在**保留字符串那一档**(模板串的内容在代码面被抹平了)。
  // 两档都给会把 `.set({ note: 'RETURNING' })` 这种字符串内容当成库确认 —— 报告维度也要宁缺毋滥。
  const chainText = chain.rawSql ? (raw || '').slice(chain.start, chain.end) : code.slice(chain.start, chain.end)
  if (chain.hasReturning || LIB_CONFIRMED_RE.test(chainText))
    return { o2: 'from-lib', why: '链上带 RETURNING/changes' }
  const body = code.slice(span.start, span.end)
  const returns = []
  const rr = /\breturn\s+([^;\n]{0,200})/g
  let m
  while ((m = rr.exec(body)) !== null) {
    if (m.index + span.start < chain.end) continue // 只看写之后的回报
    returns.push(m[1].trim())
  }
  if (!returns.length) return { o2: 'not-reporting', why: '体内写之后没有 return(不回行数)' }
  const withLen = returns.filter((t) => /\.length\b/.test(t))
  if (!withLen.length) {
    if (returns.some((t) => LIB_CONFIRMED_RE.test(t))) return { o2: 'from-lib', why: 'return 里取库确认集' }
    return { o2: 'not-reporting', why: 'return 不回计数(布尔/对象形态,归门 134 的射程)' }
  }
  for (const t of withLen) {
    const root = /([A-Za-z_$][\w$]*)\s*\.length\b/.exec(t)
    if (!root) continue
    const name = root[1]
    const inits = initializersOf(code, span, name)
    if (!inits.length) return { o2: 'from-request', why: `${name}.length 且本体内无初值(来自形参/请求侧)` }
    const wroteResult = inits.some((i) => i.rhsStart <= chain.end && i.rhsEnd >= chain.start)
    if (wroteResult) return { o2: 'from-lib', why: `${name} 就是这条写链的返回值` }
    if (/\b(?:select|returning|execute)\b/.test(inits.map((i) => i.rhs).join(' ')))
      return { o2: 'from-lib', why: `${name} 追到一次读/返回集` }
  }
  return { o2: 'undetermined', why: '计数根追不到写链结果,也追不到形参' }
}

/* ------------------------------ 判据 O1 的共用连接器 ------------------------------ */

/**
 * "这一段的 id 根,是不是由体内一条**带归属证据的预查询**限死的" —— O1 的本文件判定与
 * 上游一跳(沿 import)判定**共用这一份实现**。两处各写一遍必然漂移,而漂移的代价固定是
 * "把敞口洗成 pre-scoped"(本门最贵的一种错,它表现为门一切正常)。
 *
 * 带归属证据 = ① 预查询自己的 where 里有归属列(SQL 级限死),或 ② 它返回的行在这一段里被拿去做
 * 属主比较。两种都必须**接得上**被写的 id 根(A 型:同一个名字出现在预查询谓词的值侧;
 * B 型:被写的 id 集 ≤2 跳可追到预查询的结果变量)。
 * 接不上与"根本没有预查询"是两个结论,不得并桶 —— 前者判不了,后者才允许判 missing。
 * @returns {{link:'linked'|'unlinked'|'none', why?:string, evidence?:string}}
 */
function connectToPreQuery({ code, raw, span, reads, decls, idRoots, beforeEnd }) {
  const before = (reads || []).filter(
    (r) => r.start < beforeEnd && r.start >= span.start && r.end <= span.end,
  )
  let evidenceSeen = false
  for (const r of before) {
    const rWheres = whereOf(r)
    const rText = rWheres.map((l) => l.text).join(' ')
    const rRaw = typeof raw === 'string' ? raw.slice(r.start, r.end) : ''
    const owns = hasOwnerPredicate(rText, rRaw)
    // 属主比较必须落在「预查询之后、这次写(或这次调用)之前」这一段,且不得越出本函数体 ——
    // 拿兄弟 handler 的属主校验给这次写发合格证,就是门 134 说的"判据建立在花括号几何上"那一型。
    const guardWindow = code.slice(r.end, Math.min(span.end, beforeEnd))
    const guard = OWNER_GUARD_RE.test(guardWindow)
    if (!owns.hit && !guard) continue
    evidenceSeen = true
    const from = readKeys(r, rText, rRaw, decls)
    for (const root of idRoots) {
      if (from.has(root))
        return {
          link: 'linked',
          why: owns.hit
            ? '预查询在 SQL 里带归属列,且与本次写同一枚 id'
            : '预查询的行在体内被属主比较,且与本次写同一枚 id',
          evidence: `${r.receiver}.${r.verb}(${lineAt(code, r.start)})`,
        }
      if (traceToRead(code, span, decls, r, root, 0))
        return {
          link: 'linked',
          why: '被写的 id 集 ≤2 跳可追到带归属条件的预查询',
          evidence: `${r.receiver}.${r.verb}(${lineAt(code, r.start)}) → ${root}`,
        }
    }
    // 只认上面两条"接得上"的形态,**不退到"两个谓词里有同名标识符"** —— 那条松判据会让
    // `eq` / `id` / `and` 这类人人皆写的名字把任何一次预查询都判成"证据接得上"。
    // 接不上就是接不上:落到 unlinked,不猜合规也不猜违规。
  }
  return { link: evidenceSeen ? 'unlinked' : 'none' }
}

/* ------------------------------ 判据 O1 的上游一跳(沿 import,票面 ②) ------------------------------ */

/** 具名导出名单(跑在遮蔽后的代码面上:注释里的 `// export function del()` 不得算导出)。 */
export function exportedNamesOf(code) {
  const out = new Set()
  for (const m of String(code || '').matchAll(/\bexport\s+(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/g))
    out.add(m[1])
  for (const m of String(code || '').matchAll(/\bexport\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) out.add(m[1])
  for (const m of String(code || '').matchAll(/\bexport\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const t = part.trim()
      if (!t || /^type\b/.test(t)) continue
      const mm = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(t)
      if (mm) out.add(mm[2] || mm[1])
    }
  }
  return out
}

/**
 * 函数体起点 → 这个体属于哪个**具名**函数(取不到名字一律返回 null ⇒ 不做上游一跳,
 * 站点维持原结论)。路由处理器 `async (request, reply) => {` 是匿名的,天然落 null ——
 * 这是对的:上游一跳要回答的是"db 层的具名导出函数被谁、带着什么 id 调用",
 * 匿名回调的那份证据本就该在同一个函数体里(由本文件判定负责)。
 */
export function enclosingFunctionName(code, bodyStart) {
  const src = String(code || '')
  if (src[bodyStart] !== '{') return null
  const cands = []
  for (const m of src.matchAll(/\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g))
    if (m.index < bodyStart) cands.push({ at: m.index, end: m.index + m[0].length, name: m[1] })
  for (const m of src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\()/g))
    if (m.index < bodyStart) cands.push({ at: m.index, end: m.index + m[0].length, name: m[1] })
  if (!cands.length) return null
  const last = cands.reduce((a, b) => (b.at > a.at ? b : a))
  // 表头之后到体起点之间不得出现深度 0 的 `;`(出现了就说明这个体属于另一条语句,不是这个头)
  let depth = 0
  for (let i = last.end; i < bodyStart; i++) {
    const c = src[i]
    if (c === '(' || c === '[' || c === '<') depth++
    else if (c === ')' || c === ']' || c === '>') {
      if (depth > 0) depth--
    } else if (c === ';' && depth === 0) return null
  }
  return last.name || null
}

/**
 * 一个名字在某个文件里的**调用点**(不含定义处、不含 `obj.name(` 的属性形态)。
 * 括号配平不到 ⇒ `broken`(调用实参读不出,由上游一跳那一层落判不了,不猜)。
 */
export function callSitesOf(code, name) {
  const out = []
  const src = String(code || '')
  const re = new RegExp(`\\b${name}\\s*(?:<[^<>\n]{0,60}>)?\\(`, 'g')
  let m
  while ((m = re.exec(src)) !== null) {
    const prev = src.slice(0, m.index)
    if (/[.\w$]/.test(prev.slice(-1))) continue // obj.name( / 更长的标识符
    if (/\bfunction\s*$/.test(prev)) continue // 定义处 `function name(`
    if (/\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*(?:async\s+)?function\s*$/.test(prev)) continue
    const open = m.index + m[0].length - 1
    const close = closeParen(src, open)
    if (close < 0) {
      out.push({ start: m.index, argText: '', broken: true })
      continue
    }
    out.push({ start: m.index, argText: src.slice(open + 1, close - 1), broken: false })
  }
  return out
}

/** import 说明符 → 该说明符解析到的仓内路径(候选生成引门 134 那份;解析不到如实报)。 */
export function resolveSpecPath(spec, fromFile, knownPaths) {
  const r = moduleSpecCandidates(spec, fromFile)
  if (r.outside) return null
  for (const c of r.candidates) if (knownPaths.has(c)) return c
  return null
}

/**
 * 反向 import 图:被引模块路径 -> [{file: 调用方, local: 它在本文件里的绑定名}]。
 * 具名绑定表引门 134 的 parseImportBindings(同一份实现,含 as 别名);另把 import * as ns 收进
 * nsImporters —— 命名空间转发的 ns.fnName( 形态本尺认不出调用点,所以它不构成放行证据,只把该
 * 模块的结论压成判不了(把看不见写成确信没有是本仓最高频失效型)。
 */
export function buildImportGraph(index, knownPaths) {
  const graph = new Map()
  const nsImporters = new Map()
  const starExporters = new Map()
  for (const [p, ctx] of index) {
    // 具名绑定表的两档喂法与门 134 逐字同形:**保留字符串**那一档出说明符,
    // 遮蔽那一档只用来验"起始位确实是一条语句"(否则模板字符串里写的 "import x from 'y'" 能凭空造边)。
    const blank = maskCommentsAndStrings(ctx.text)
    const { named } = parseImportBindings(ctx.raw, blank)
    for (const [local, info] of named) {
      const target = resolveSpecPath(info.specifier, p, knownPaths)
      if (!target || target === p) continue
      if (!graph.has(target)) graph.set(target, [])
      graph.get(target).push({ file: p, local, exported: info.exported })
    }
    // 说明符只活在保留字符串那一档(代码面上被抹平),所以这一遍吃 raw;候选生成仍引门 134 那一份。
    for (const m of ctx.raw.matchAll(/\bimport\s+\*\s+as\s+[A-Za-z_$][\w$]*\s+from\s*['"]([^'"\n]+)['"]/g)) {
      const target = resolveSpecPath(m[1], p, knownPaths)
      if (!target || target === p) continue
      if (!nsImporters.has(target)) nsImporters.set(target, new Set())
      nsImporters.get(target).add(p)
    }
    // **barrel 的 export * from 必须登记**:它让"谁调了这个函数"的集合不可枚举(调用方可以从
    // 转发面引名字,而那条边挂的是转发文件的路径)。现测真仓 SCAN_DIRS 内 `export * from` 为 0 处,
    // 所以这一条今天不改变任何读数;它的价值在明天有人加一个 barrel 时,本尺落"判不了"而不是
    // 拿一份不完整的调用方集合去**放行**(那是把敞口洗成合规,本门最贵的一种错)。
    for (const m of ctx.raw.matchAll(/\bexport\s+\*\s+(?:as\s+[A-Za-z_$][\w$]*\s+)?from\s*['"]([^'"]+)['"]/g)) {
      const target = resolveSpecPath(m[1], p, knownPaths)
      if (!target || target === p) continue
      if (!starExporters.has(target)) starExporters.set(target, new Set())
      starExporters.get(target).add(p)
    }
  }
  return { graph, nsImporters, starExporters }
}

/**
 * 一个 `missing` 站点的上游一跳结论。**放行条件是"所有能解析到的调用点都带属主证据"**,
 * 不是"任一处带证据" —— 后者等于"只要有一个守法调用方就给整条 SQL 发合格证",而这条函数
 * 仍然可以被另一个不守法的调用方拿到(那才是本尺要看的敞口)。
 * @returns {{action:'promote'|'keep'|'undetermined', why:string, evidence?:string, calls?:number, scoped?:number}}
 */
export function hopVerdict({ site, index, importersOf, nsImportersOf, starExportersOf }) {
  const name = site.fnName
  const selfCtx = index.get(site.file)
  if (!name || !selfCtx || !selfCtx.exports.has(name)) return { action: 'keep', why: '无具名导出,不做上游一跳' }
  const selfPath = selfCtx.path
  // 只算**真的把这个函数绑进来了**的那些文件:一个模块常被 70 个文件 import,但其中多数
  // 只引别的符号 —— 按"模块被引次数"设闸会把整族压成判不了(实测第一轮 promoted=0 就是这个原因),
  // 那不是保守,那是尺子对自己产出的形态失明。
  const importers = importersOf(selfPath).filter((i) => i.exported === name)
  if (importers.length > HOP_MAX_IMPORTER_FILES)
    return { action: 'undetermined', why: `把这个函数绑进来了的文件数 ${importers.length} > ${HOP_MAX_IMPORTER_FILES} ⇒ 判不了(不猜)` }
  const barrel = typeof starExportersOf === 'function' ? starExportersOf(selfPath) : new Set()
  if (barrel.size)
    return {
      action: 'undetermined',
      why: `本模块被 ${[...barrel].slice(0, 2).join(', ')} 的 export * 转发 ⇒ 调用方集合不可枚举,不拿不完整的集合放行`,
    }
  const nsFiles = new Set([...nsImportersOf(selfPath)])
  if (nsFiles.size)
    return {
      action: 'undetermined',
      why: `有调用方经 import * as 命名空间引本模块(${[...nsFiles].slice(0, 2).join(', ')})⇒ 调用形态静态读不全`,
    }
  const probes = [{ ctx: selfCtx, local: name }, ...importers.map((i) => ({ ctx: index.get(i.file), local: i.local })).filter((p) => p.ctx)]
  let calls = 0
  let scoped = 0
  const unscopedAt = []
  for (const p of probes) {
    for (const c of callSitesOf(p.ctx.code, p.local)) {
      if (++calls > HOP_MAX_CALL_SITES)
        return { action: 'undetermined', why: `调用点数 > ${HOP_MAX_CALL_SITES} ⇒ 判不了(不猜)` }
      if (c.broken) return { action: 'undetermined', why: `调用点 ${p.ctx.path}:${lineAt(p.ctx.code, c.start)} 括号配平不到 ⇒ 实参读不出` }
      const body = enclosingBody(p.ctx.bodies, c.start)
      if (!body)
        return {
          action: 'undetermined',
          why: `调用点 ${p.ctx.path}:${lineAt(p.ctx.code, c.start)} 在函数体外 ⇒ 无法界定它能借到哪份证据`,
        }
      const roots = valueIdentifiers(c.argText)
      if (!roots.size) {
        unscopedAt.push(`${p.ctx.path}:${lineAt(p.ctx.code, c.start)}(实参里没有可追的标识符)`)
        continue
      }
      const r = connectToPreQuery({
        code: p.ctx.code,
        raw: p.ctx.raw,
        span: body,
        reads: p.ctx.reads,
        decls: p.ctx.declsFor(body),
        idRoots: roots,
        beforeEnd: c.start,
      })
      if (r.link === 'linked') {
        scoped++
        continue
      }
      unscopedAt.push(`${p.ctx.path}:${lineAt(p.ctx.code, c.start)}(${r.link === 'unlinked' ? '有归属证据但接不上实参' : '体内无带归属的预查询'})`)
    }
  }
  if (calls === 0)
    return { action: 'undetermined', why: `沿 import 在本面找不到 ${name} 的调用点 ⇒ 调用方在射程外,无从对账` }
  if (!unscopedAt.length)
    return {
      action: 'promote',
      why: '上游一跳预查询已限定(沿 import 解析,全部可解析调用点均带属主证据)',
      evidence: `${calls} 处调用点全部接得上;首个 = ${selfPath} ← ${name}()`,
      calls,
      scoped,
    }
  return {
    action: 'keep',
    why: `调用点 ${calls} 处中 ${unscopedAt.length} 处拿不出属主预查询证据 ⇒ 维持 missing(${unscopedAt.slice(0, 3).join('; ')})`,
    calls,
    scoped,
  }
}

/* ------------------------------ 文件级扫描 ------------------------------ */

/**
 * 一份文件 → 逐站点结论。**三档文本一次算好后传给每个站点**,不在判据里再遮一遍
 * (每站遮一遍 = 同一件事被做 N 遍,漂一次就分叉)。
 *
 * 写站点有两类来源,合成一份清单一起判(同一格两种口径是本仓最贵的一类事故):
 *  ① drizzle 链 `.update(`/`.delete(`(票面给的站点定义);
 *  ② 裸 SQL 写链 `db.execute(sql\`UPDATE/DELETE FROM/INSERT INTO/TRUNCATE\`)` ——
 *    **"什么算一条裸 SQL 写链"不重写第二份,直接引守门 134 的 `findRawSqlWriteChains`**(那份的
 *    动词搭配式与括号配平都被它的镜像测试钉着)。`unparsed`(括号配平不到的 execute)也进清单,
 *    按 `undetermined` 点名 —— 静默丢掉它等于"判据失效表现为安静"那一型。
 * @param {string} rel
 * @param {string} text
 */
export function scanFileText(rel, text) {
  const code = maskCommentsAndStrings(text)
  const raw = blankCommentsOnly(text)
  const bodies = findFunctionBodies(code)
  const drizzleChains = findWriteChains(code).map((c) => ({ ...c, kind: 'drizzle' }))
  // 输入**先归一大小写**再喂给 134 那份实现:它的动词判据是 `UPDATE\s+"?[A-Za-z_]` 不带 `i` 旗,
  // 而上游那一族(SQL 出自 `apps/zcode-cli/.../sessions.ts:289-294`)写的正是小写 `update session`
  // —— 直接喂原文就会对本票立项那一型整型隐身。归一化是**等长、同下标**的输入预处理
  // (`String.prototype.toUpperCase()` 对 ASCII 逐字符保位;模板里的中文/`${…}` 长度不变),
  // 不是第二份判据:动词搭配式、括号配平、RETURNING/WHERE 的识别仍然只在那一份实现里。
  const rawFound = findRawSqlWriteChains(upperInsideStringsOnly(raw))
  const rawChains = rawFound.chains.map((c) => ({
    ...c,
    kind: 'raw-sql',
    rawSql: true,
    verb: 'execute',
    links: [],
    broken: false,
  }))
  const unparsed = rawFound.unparsed.map((u) => ({
    start: u.index,
    end: u.index,
    receiver: '(未知)',
    verb: 'execute',
    links: [],
    broken: true,
    rawSql: true,
    kind: 'raw-sql',
  }))
  const chains = [...drizzleChains, ...rawChains, ...unparsed].sort((a, b) => a.start - b.start)
  const reads = findReadChains(code)
  const sites = []
  for (const chain of chains) {
    const body = enclosingBody(bodies, chain.start)
    const line = lineAt(text, chain.start)
    if (!body) {
      sites.push({
        file: rel,
        line,
        verb: chain.verb,
        receiver: chain.receiver,
        kind: chain.kind,
        o1: 'undetermined',
        why: '解析不出所属函数体(模块顶层 / class 方法简写 / 对象字面量内)',
        cas: 'undetermined',
        casWhy: '同上',
        o2: 'undetermined',
        o2Why: '同上',
      })
      continue
    }
    const decls = declarationsOf(code, body)
    const o1 = judgeOwner({ code, raw, chain, span: body, readChains: reads, decls })
    const o2 = judgeReportFace({ code, raw, chain, span: body })
    const o1c = judgeCas({ code, raw, chain, span: body })
    sites.push({
      file: rel,
      line,
      verb: chain.verb,
      receiver: chain.receiver,
      kind: chain.kind,
      fn: lineAt(code, body.start),
      // 上游一跳(票面 ②)要拿这两格去找"这个体属于哪个具名函数、体边界在哪";
      // 取不到名字一律 null ⇒ 后续 hop 直接放过该站点(维持原结论),绝不猜一个头出来。
      fnName: enclosingFunctionName(code, body.start),
      bodyStart: body.start,
      bodyEnd: body.end,
      o1: o1.state,
      why: o1.why,
      evidence: o1.evidence || '',
      cas: o1c.cas,
      casWhy: o1c.why,
      o2: o2.o2,
      o2Why: o2.why,
    })
  }
  return { file: rel, sites }
}

/** 一整个面的跑法:清单与内容同面同轮。 */
export function scanFaceBundle(root, face, paths, texts) {
  return paths.map((p) => {
    const t = texts.get(p)
    if (typeof t !== 'string') throw new Undetermined(`${face} 面取不到 ${p} ⇒ 不回落另一个面(回落就是把"没判"写成"判过了")`)
    return scanFileText(p, t)
  })
}

/**
 * 一份文件的三档预处理(上游一跳要在调用方文件里跑同一套判据,所以每个证据文件都得有这一份)。
 * `declsFor` 按体区间缓存 `declarationsOf` —— 同一件事在一轮里算两遍就会漂(本仓通用禁令)。
 */
export function makeFileCtx(path, text) {
  const code = maskCommentsAndStrings(text)
  const raw = blankCommentsOnly(text)
  const cache = new Map()
  return {
    path,
    text,
    code,
    raw,
    bodies: findFunctionBodies(code),
    reads: findReadChains(code),
    exports: exportedNamesOf(code),
    declsFor(span) {
      const k = `${span.start}:${span.end}`
      if (!cache.has(k)) cache.set(k, declarationsOf(code, span))
      return cache.get(k)
    },
  }
}

/**
 * 证据面索引:面内每个文件一份 ctx + 「模块 → 引用它的那些文件」的反向 import 图。
 * 反向图只对**面里解析得到**的说明符建(`moduleSpecCandidates` 出候选、`knownPaths` 验在不在),
 * 解析不到不建边 —— 但也不因此放行:被审函数若一条边都没建起来,hopVerdict 落"找不到调用点 ⇒ 判不了"。
 */
export function buildFaceIndex(entries) {
  const index = new Map()
  for (const [p, t] of entries) index.set(p, makeFileCtx(p, t))
  const knownPaths = new Set(index.keys())
  const { graph, nsImporters, starExporters } = buildImportGraph(index, knownPaths)
  return {
    index,
    importersOf: (mod) => graph.get(mod) || [],
    nsImportersOf: (mod) => nsImporters.get(mod) || new Set(),
    starExportersOf: (mod) => starExporters.get(mod) || new Set(),
  }
}

/**
 * 上游一跳整面过闸:只对**本文件判定为 missing 且谓词可读**的站点跑(两种 missing 不同命 ——
 * "写链根本没有 where"的全表写**不可能**被调用方的 id 集限死,放行它等于给最危险的一族发合格证)。
 * 就地改写站点结论,并留 `hop` 台账(判据吃了哪条证据、调用点总数/带证据数),`--explain` 逐条点名。
 */
export function runHopPass(perFile, hopCtx) {
  const promoted = []
  const demoted = []
  const notes = []
  for (const rec of perFile) {
    for (const s of rec.sites) {
      if (s.o1 !== 'missing' || !/^写链谓词可读/.test(s.why || '')) continue
      const v = hopVerdict({
        site: s,
        index: hopCtx.index,
        importersOf: hopCtx.importersOf,
        nsImportersOf: hopCtx.nsImportersOf,
        starExportersOf: hopCtx.starExportersOf,
      })
      s.hop = { action: v.action, calls: v.calls ?? 0, scoped: v.scoped ?? 0 }
      if (v.action === 'promote') {
        s.o1 = 'pre-scoped'
        s.viaHop = true
        s.why = v.why
        s.evidence = v.evidence
        promoted.push(s)
      } else if (v.action === 'undetermined') {
        s.o1 = 'undetermined'
        s.why = `上游一跳:${v.why}`
        demoted.push(s)
      } else if (v.action === 'keep' && v.calls) {
        notes.push(`${s.file}:${s.line} ${v.why}`)
        s.hopNote = v.why
      }
    }
  }
  return { promoted, demoted, notes }
}

/* ------------------------------ 枚举与取材(O3) ------------------------------ */

export function listCandidates(root, face) {
  return enumerate(root, face, SCAN_DIRS)
}

/**
 * 证据面清单(上游一跳找调用方用)。**只用来读证据,不用来判站点** —— 被审判的站点仍只有
 * SCAN_DIRS 那两面(改射程属决策,不得由找证据这一层顺手扩)。
 */
export function listEvidenceCandidates(root, face) {
  return enumerate(root, face, [HOP_EVIDENCE_DIR])
}

function enumerate(root, face, dirs) {
  const out =
    face === 'head'
      ? gitRaw(['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', ...dirs], root, { timeout: 120000 })
      : gitRaw(['ls-files', '-z', '--', ...dirs], root, { timeout: 120000 })
  if (out === null || out === undefined) throw new Undetermined(`${face} 面枚举失败(git 没答话)`)
  return String(out)
    .split('\0')
    .filter(Boolean)
    .filter((p) => FILE_RE.test(p) && !SKIP_RE.test(p) && !SELF_EXEMPT.includes(p))
}

/** 一次 `cat-file --batch` 把同一面全部候选读满。 */
export function readCandidates(root, face, paths) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) {
      const t = readWorktreeFile(root, p)
      if (typeof t !== 'string') throw new Undetermined(`工作树(逃生舱)取不到 ${p}`)
      map.set(p, t)
    }
    return map
  }
  const specs = paths.map((p) => (face === 'staged' ? ':' : 'HEAD:') + p)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: 180000 })
  paths.forEach((p, k) => {
    const t = got.get(specs[k])
    if (typeof t !== 'string')
      throw new Undetermined(`${face === 'staged' ? '索引' : 'HEAD'} 取不到 ${p} ⇒ 不回落另一个面`)
    map.set(p, t)
  })
  return map
}

/* ------------------------------ 棘轮 ------------------------------ */

/**
 * 差值棘轮的判序(纯函数,两条都必须被证明):
 *  ① HEAD 没有这一型而现在有 ⇒ 红(这次把敞口加回来了);
 *  ② HEAD 本来就有 N 个 ⇒ 只报数(否则存量变成人人跳门,§12e)。
 * 锚点粒度 = **文件 × 状态**:`missing` 的额度顶不掉 `sql-scoped` 的改动(把一处 missing 改写成
 * 另一处 missing 会净零逃逸,所以还要看"新站点是不是 HEAD 里没有的函数体位置"—— 见 ratchet)。
 */
export function exceedsAnchor({ headCount, currentCount }) {
  return currentCount > headCount
}

/**
 * 逐文件把 `missing` 与 HEAD 自身存量对齐。返回"超出额度的站点"(新增),按行序取尾部 ——
 * 谁的改动是新增,尾部的就是新增;拿不到 HEAD 正文(新文件)按存量 0 处理(新文件没有欠账可豁免)。
 */
export function ratchet(perFile, headPerFile) {
  const out = []
  for (const r of perFile) {
    const cur = r.sites.filter((s) => s.o1 === 'missing')
    if (!cur.length) continue
    const anchor = (headPerFile.get(r.file) || []).filter((s) => s.o1 === 'missing').length
    if (!exceedsAnchor({ headCount: anchor, currentCount: cur.length })) continue
    out.push(...cur.slice(anchor))
  }
  return out
}

/* ------------------------------ 汇总与判读 ------------------------------ */

export function tally(perFile) {
  const c = {
    files: perFile.length,
    sites: 0,
    sqlScoped: 0,
    preScoped: 0,
    preScopedByHop: 0,
    missing: 0,
    undetermined: 0,
    casPresent: 0,
    casAbsent: 0,
    casNa: 0,
    casUndetermined: 0,
    o2FromLib: 0,
    o2FromRequest: 0,
    o2NotReporting: 0,
    o2Undetermined: 0,
  }
  const undeterminedReasons = new Map()
  for (const r of perFile)
    for (const s of r.sites) {
      c.sites++
      if (s.o1 === 'sql-scoped') c.sqlScoped++
      else if (s.o1 === 'pre-scoped') {
        c.preScoped++
        // 两条证据链的强度不同(本文件体内 vs 沿 import 的上游一跳),不得在报告里混成一桶 ——
        // 读报告的人要能看出"这一档是靠调用方的预查询顶住的",它才谈得上复核。
        if (s.viaHop) c.preScopedByHop++
      } else if (s.o1 === 'missing') c.missing++
      else {
        c.undetermined++
        undeterminedReasons.set(s.why, (undeterminedReasons.get(s.why) || 0) + 1)
      }
      if (s.cas === 'cas-present') c.casPresent++
      else if (s.cas === 'cas-absent') c.casAbsent++
      else if (s.cas === 'not-applicable') c.casNa++
      else c.casUndetermined++
      if (s.o2 === 'from-lib') c.o2FromLib++
      else if (s.o2 === 'from-request') c.o2FromRequest++
      else if (s.o2 === 'not-reporting') c.o2NotReporting++
      else c.o2Undetermined++
    }
  return { counts: c, undeterminedReasons }
}

/**
 * 退出码(纯函数)。三档各有各的语义,不得混:
 *  - **全量档(HEAD)非 strict ⇒ 恒 0**:现读只报数。存量未逐条定性前挂 blocking
 *    就是一台与任何提交都无关的恒红门(§12e),唯一结局是逼人 `--no-verify` 连带废掉全部守门。
 *  - **提交链档(`--staged` 非 strict)⇒ 差值棘轮有牙**:只有"本次把敞口加回来了"(该文件 HEAD
 *    自身 `missing` 计数被超出)才 exit 1。这一条是接线能用起来的前提 —— 若非 strict 恒 0,
 *    runner 不带 `--strict` 时本门对每一次提交都是**零拦截**,而账面读起来像"跑过了"(守门 70
 *    那条"不带参数永远 exit 0"的同型陷阱);undetermined 在这一档**只报数不判红**,因为它有
 *    52 处存量,当场判红就是把每台机器逼进跳门。
 *  - **问责档(`--strict`)⇒ 有未判定先 exit 2 拒绝出具合格证**;判红集合 = staged 用棘轮新增、
 *    全量用 missing。
 */
export function decide({ face, strict, missing, undetermined, ratcheted }) {
  if (!strict) {
    if (face === 'staged') return ratcheted > 0 ? 1 : 0
    return 0
  }
  if (undetermined > 0) return 2
  const red = face === 'staged' ? ratcheted : missing
  return red > 0 ? 1 : 0
}

/**
 * 生产入口。
 *
 * **两个面必须跑同一条流水线**(含上游一跳),否则棘轮的"存量"与"现读"用的是两把强度不同的尺子:
 * 锚点侧没跑 hop ⇒ 锚点虚高 ⇒ 本次新增的敞口能藏进别人的欠账里(守门 134 扩布尔档键时同一课)。
 * @param {string} root
 * @param {'head'|'staged'|'worktree'} face
 * @param {{strict?:boolean, onlyFiles?:string[]|null, noHop?:boolean}} opts
 */
export function analyze(root, face, opts = {}) {
  assertRepoRoot(root, GATE)
  const paths = opts.onlyFiles ? opts.onlyFiles.filter((p) => FILE_RE.test(p) && !SELF_EXEMPT.includes(p)) : listCandidates(root, face)
  if (!paths.length)
    throw new Undetermined(`${face} 面在 ${SCAN_DIRS.join(' / ')} 下枚举到 0 个候选源文件 ⇒ 判据失效,不计通过`)

  // 证据面:上游一跳要找调用方,而调用方大多不住在 SCAN_DIRS 里。清单与内容同面同轮,
  // 站点面与证据面在同一次 catBatch 里读满(分两次读会在并行会话推进的瞬间产出自洽却错位的尺子)。
  const scanOne = (which, judgedPaths) => {
    const texts = readCandidates(root, which, judgedPaths)
    const perFile = scanFaceBundle(root, which, judgedPaths, texts)
    let hop = { promoted: [], demoted: [], notes: [], evidenceFiles: 0, skipped: false }
    if (!opts.noHop) {
      const evidencePaths = listEvidenceCandidates(root, which)
      const extra = evidencePaths.filter((p) => !texts.has(p))
      const more = extra.length ? readCandidates(root, which, extra) : new Map()
      const entries = [...texts.entries(), ...more.entries()]
      if (!evidencePaths.length)
        throw new Undetermined(`${which} 面在 ${HOP_EVIDENCE_DIR} 下枚举到 0 个证据文件 ⇒ 上游一跳无从解析,不计通过`)
      hop = { ...runHopPass(perFile, buildFaceIndex(entries)), evidenceFiles: entries.length }
    }
    return { perFile, hop }
  }

  const { perFile, hop } = scanOne(face, paths)
  const { counts, undeterminedReasons } = tally(perFile)

  // 棘轮锚点:同一份判据(含 hop)跑在 HEAD 面上 —— **同一轮、同一把尺子**,不是手工清单。
  // 一处必须与"被审内容"分开的规矩:**新增文件在 HEAD 面上按定义不存在**,那不是"取不到"。
  // 若把它当取不到抛错,`--staged` 就会对每一次"新加一个 db/routes 文件"的提交 exit 2 ——
  // 那是一台与提交内容无关的恒挡门(§12e),唯一结局是各会话走应急跳门、连带全部守门作废。
  // 判据仍然是严的:只在**该面枚举清单里没有这条路径**时才算"新文件、锚点 0";
  // 清单里有而 blob 取不到,照旧走 readCandidates 的 throw(不回落另一个面)。
  let ratcheted = []
  let anchorAbsent = []
  if (face === 'staged') {
    const headKnown = new Set(listCandidates(root, 'head'))
    const anchorPaths = paths.filter((p) => headKnown.has(p))
    anchorAbsent = paths.filter((p) => !headKnown.has(p))
    const headScan = anchorPaths.length ? scanOne('head', anchorPaths) : { perFile: [] }
    const headMap = new Map(headScan.perFile.map((r) => [r.file, r.sites]))
    ratcheted = ratchet(perFile, headMap)
  }
  const violations = face === 'staged' ? ratcheted : perFile.flatMap((r) => r.sites.filter((s) => s.o1 === 'missing'))
  const exit = decide({
    face,
    strict: !!opts.strict,
    missing: counts.missing,
    undetermined: counts.undetermined,
    ratcheted: ratcheted.length,
  })
  return {
    gate: GATE,
    root,
    face,
    strict: !!opts.strict,
    counts,
    undeterminedReasons: [...undeterminedReasons.entries()].sort((a, b) => b[1] - a[1]),
    violations,
    ratcheted,
    anchorAbsent,
    hop: {
      promoted: hop.promoted.length,
      demoted: hop.demoted.length,
      partialCalls: hop.notes.length,
      evidenceFiles: hop.evidenceFiles,
      notes: hop.notes,
      skipped: !!hop.skipped,
    },
    perFile,
    exit,
  }
}

/* ------------------------------ 报告 ------------------------------ */

const FACE_TXT = {
  head: 'HEAD blob(全量审计)',
  staged: '索引 blob(本次提交会带走的那一份)',
  worktree: '工作树(人工逃生舱,提交链不走这档)',
}

export function formatReport(out, limit = 12) {
  const L = []
  const c = out.counts
  L.push(`面:${FACE_TXT[out.face]} · 射程 ${SCAN_DIRS.join(' + ')}(不含测试面)· 候选文件 ${c.files}`)
  L.push(
    `写站点 ${c.sites} · O1 sql-scoped ${c.sqlScoped} / pre-scoped ${c.preScoped}(其中上游一跳 ${c.preScopedByHop})/ missing ${c.missing} / undetermined ${c.undetermined}`,
  )
  L.push(
    `O1c CAS(只报数;哪一屏该强制 CAS 属人工裁决)present ${c.casPresent} / absent ${c.casAbsent} / 不适用 ${c.casNa} / 判不了 ${c.casUndetermined}`,
  )
  if (!out.hop.skipped)
    L.push(
      `上游一跳(沿 import,证据面 ${out.hop.evidenceFiles} 文件):放行 ${out.hop.promoted} · 判不了 ${out.hop.demoted} · 部分调用点无证据(维持 missing)${out.hop.partialCalls}`,
    )
  L.push(
    `O2(只报数,判红归门 134)from-lib ${c.o2FromLib} / from-request ${c.o2FromRequest} / 不回计数 ${c.o2NotReporting} / 判不了 ${c.o2Undetermined}`,
  )
  if (out.undeterminedReasons.length) {
    L.push('undetermined 的原因分布(把没判写成判过了是本仓最高频失效型,所以这里逐条报名):')
    for (const [why, n] of out.undeterminedReasons.slice(0, limit)) L.push(`  · ${n} × ${why}`)
    if (out.undeterminedReasons.length > limit)
      L.push(`  …另有 ${out.undeterminedReasons.length - limit} 类,全清单见 --explain`)
  }
  if (out.face === 'staged' && out.ratcheted.length) {
    if (out.anchorAbsent && out.anchorAbsent.length)
      L.push(`  锚点口径:${out.anchorAbsent.length} 个路径在 HEAD 面上不存在(新增文件)⇒ 按存量 0 计,不是"取不到"`)
    L.push(`❌ 超出「该文件 HEAD 自身存量」棘轮的新增 missing ${out.ratcheted.length} 处:`)
    for (const s of out.ratcheted.slice(0, limit))
      L.push(`   - ${s.file}:${s.line} ${s.receiver}.${s.verb} —— ${s.why}`)
    if (out.ratcheted.length > limit) L.push(`   …另 ${out.ratcheted.length - limit} 处,全清单见 --explain`)
  } else if (out.face !== 'staged' && out.strict && c.missing) {
    L.push(`❌ 问责档:missing ${c.missing} 处(**不等于"这里有敞口"** —— 合法与真敞口必须逐条人工定性)`)
  } else if (c.missing) {
    L.push(
      `⚠️ 现读 missing ${c.missing} 处,**只报数**:默认档不判红(存量未逐条定性前挂 blocking = 与任何提交无关的恒红门,§12e)。`,
    )
  }
  if (!out.strict) L.push('定级:默认档只报数。问责档 `node scripts/check-write-owner-predicate.mjs --strict`。')
  else if (out.exit === 2)
    L.push('`--strict` 下有未判定 ⇒ exit 2 **拒绝出具合格证**(既没说这里有敞口,也没说没有)。')
  L.push(
    `现读三态:sql-scoped=${c.sqlScoped} pre-scoped=${c.preScoped} missing=${c.missing} undetermined=${c.undetermined} 站点=${c.sites} exit=${out.exit}`,
  )
  return L
}

/* ------------------------------ 自检(构造面) ------------------------------ */

/**
 * 夹具:两处**逐字取自真仓**(§22c「镜像测试至少一条用例的输入必须逐字取自真实文件」):
 *  `apps/api/src/db/chat-queries.ts` 的 updateConversationTitle(:212-221 那一型)与
 *  `apps/api/src/routes/other/business-card-routes.ts` 的 DELETE /business-card/:id(:294-307)。
 * 其余为构造面,每条判据都有成对反例。
 */
export const FIXTURES = {
  /** 真仓形状:先 select 比 userId 再按 id 写 ⇒ pre-scoped(不得判红) */
  realPreSelectThenWrite: `export async function updateConversationTitle(
  id: string,
  userId: string,
  title: string,
): Promise<ChatConversation | undefined> {
  const owned = await db
    .select({ userId: chatConversations.userId })
    .from(chatConversations)
    .where(eq(chatConversations.id, id))
    .limit(1)
  const row = owned[0]
  if (!row || row.userId !== userId) return undefined

  const rows = await db
    .update(chatConversations)
    .set({ title, updatedAt: new Date() })
    .where(eq(chatConversations.id, id))
    .returning()
  return rows[0]
}`,
  /** 同一夹具**删掉那条预查询** ⇒ 必须点名(阳性对照) */
  realPreSelectRemoved: `export async function updateConversationTitle(
  id: string,
  userId: string,
  title: string,
): Promise<ChatConversation | undefined> {
  const rows = await db
    .update(chatConversations)
    .set({ title, updatedAt: new Date() })
    .where(eq(chatConversations.id, id))
    .returning()
  return rows[0]
}`,
  /** 真仓形状:预查询在 SQL 里带归属列 + 属主比较 + 按 id 删 ⇒ pre-scoped */
  realBusinessCardDelete: `server.delete('/business-card/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [existing] = await dbRead
      .select()
      .from(businessCards)
      .where(eq(businessCards.id, id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '名片不存在'))
    if (existing.userId !== request.userId)
      return reply.status(403).send(error(403, '无权删除此名片'))
    const removed = await db
      .delete(businessCards)
      .where(eq(businessCards.id, id))
      .returning({ id: businessCards.id })
    return { removed: removed.length }
})`,
  /** SQL 级归属(chat-queries 的批量删除) */
  sqlScoped: `export async function deleteConversationsBatch(userId: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const rows = await db
    .delete(chatConversations)
    .where(and(eq(chatConversations.userId, userId), inArray(chatConversations.id, ids)))
    .returning({ id: chatConversations.id })
  return rows.length
}`,
  /** 同一个批量写**摘掉归属列** ⇒ missing */
  missingBatch: `export async function deleteConversationsBatch(userId: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const rows = await db
    .delete(chatConversations)
    .where(inArray(chatConversations.id, ids))
    .returning({ id: chatConversations.id })
  return rows.length
}`,
  /** 裸 SQL:归属列在 WHERE 里(上游那一族的形状)⇒ sql-scoped */
  rawSqlScoped: `export async function repairRemoteSessionPaths(input): Promise<boolean> {
  const result = await db.execute(sql\`
    update session
       set directory = \${input.directory}, path = \${input.path}, time_updated = max(time_updated, \${input.timeUpdated})
     where id = \${input.sessionID}
       and workspace_id = \${input.workspaceID}
       and directory = \${input.expectedDirectory}
       and ((\${input.expectedPath} is null and path is null) or path = \${input.expectedPath})
  \`)
  return Number(result.changes) === 1
}`,
  /** 同一条裸 SQL**去掉 workspace_id** ⇒ missing(而 O2 仍应认它取了 changes) */
  rawSqlNoOwner: `export async function repairRemoteSessionPaths(input): Promise<boolean> {
  const result = await db.execute(sql\`
    update session
       set directory = \${input.directory}, path = \${input.path}
     where id = \${input.sessionID}
       and directory = \${input.expectedDirectory}
  \`)
  return Number(result.changes) === 1
}`,
  /** 裸 SQL 用 ? 位置参数:绑定的值对应关系静态读不出 ⇒ undetermined(不猜) */
  rawSqlPositional: `export async function repairLegacy(input): Promise<boolean> {
  const result = await db.execute(sql\`
    update session set workspace_id = ?
     where workspace_id is null and directory = ? and id in (?)
  \`)
  return Number(result.changes) === 1
}`,
  /** 裸 SQL 里条件由 sql.raw 拼出来 ⇒ undetermined(条件集读不全) */
  rawSqlRawFragment: `export async function patchWhere(extra: string, input): Promise<boolean> {
  const result = await db.execute(sql\`
    update session set directory = \${input.directory}
     where id = \${input.sessionID} and \${sql.raw(extra)}
  \`)
  return Number(result.changes) === 1
}`,
  /** 归属条件只出现在注释里 ⇒ 不得算 sql-scoped */
  ownerInCommentOnly: `async function fix(id: string, userId: string) {
  // 维护性写要学上游:归属列在 where、CAS 旧值在 where
  await db
    .update(chatConversations)
    .set({ title: 'x' })
    .where(eq(chatConversations.id, id))
}`,
  /** 归属条件只在字符串里(日志/OpenAPI 描述)⇒ 同样不得算 */
  ownerInStringOnly: `async function fix(id: string, userId: string) {
  logger.info('update where user_id = ? and id = ?', [userId, id])
  await db
    .update(chatConversations)
    .set({ title: 'x' })
    .where(eq(chatConversations.id, id))
}`,
  /** where 住在变量里且一跳可解到归属谓词 ⇒ sql-scoped */
  whereInVariable: `async function patch(input: { id: string; userId: string }) {
  const scope = and(eq(chatConversations.id, input.id), eq(chatConversations.userId, input.userId))
  return db.update(chatConversations).set({ archivedAt: null }).where(scope).returning()
}`,
  /** where 由 ...spread 组装 ⇒ undetermined(读不全就承认读不全) */
  whereSpread: `async function list(body: { ids: string[] }) {
  const conds = []
  conds.push(eq(businessCards.id, body.ids[0]))
  const where = and(...conds)
  return db.delete(businessCards).where(where).returning()
}`,
  /** 兄弟 handler 不得互借归属证据:A 里的预查询不能替 B 的写发合格证 */
  siblingBorrow: `server.delete('/a/:id', async (request) => {
  const [row] = await db.select().from(businessCards).where(eq(businessCards.id, request.params.id)).limit(1)
  if (row.userId !== request.userId) return
  await db.delete(businessCards).where(eq(businessCards.id, request.params.id))
})
server.delete('/b/:id', async (request) => {
  await db.delete(businessCards).where(eq(businessCards.id, request.params.id))
})`,
  /** 路由注册与内存 Map:根本不是"一条被发出的 SQL" */
  notWrites: `server.delete('/x/:id', async () => {})
fastify.delete('/y', async () => {})
map.delete(key)
deviceCodeStore.delete(code)`,
  /** 无条件全表写 ⇒ missing(正面判出"谈不上归属") */
  fullTableDelete: `export async function wipeSessions() {
  await db.delete(chatSessions).execute()
}`,
  /** 顶层(函数体外)的写 ⇒ undetermined(解析不出函数体) */
  topLevelWrite: `const rows = await db
  .update(chatConversations)
  .set({ archivedAt: null })
  .where(eq(chatConversations.id, id))
  .returning()
export const boot = rows`,
  /** 被写的 id 集来自带归属的预查询(B 型连接)⇒ pre-scoped */
  ownedSetFeedsWrite: `export async function archiveOwned(userId: string, ids: string[]) {
  const owned = await db
    .select({ id: chatConversations.id })
    .from(chatConversations)
    .where(and(eq(chatConversations.userId, userId), inArray(chatConversations.id, ids)))
  const ownedIds = owned.map((r) => r.id)
  return db
    .update(chatConversations)
    .set({ archivedAt: new Date() })
    .where(inArray(chatConversations.id, ownedIds))
    .returning()
}`,
  /** 体内有带归属的预查询,但被写的 id 接不上 ⇒ undetermined(不猜合规) */
  evidenceButUnlinked: `export async function patchTwoThings(userId: string, ids: string[], otherId: string) {
  const owned = await db
    .select({ id: chatConversations.id })
    .from(chatConversations)
    .where(and(eq(chatConversations.userId, userId), inArray(chatConversations.id, ids)))
  void owned
  return db
    .update(chatMessages)
    .set({ content: 'x' })
    .where(eq(chatMessages.id, otherId))
    .returning()
}`,
}

/**
 * 票面 ② 的**上游一跳**夹具(两文件一份 bundle:db 层具名导出函数 + 调用方路由)。
 * 这族的形状是"写链在 db 层、限死 id 的那次预查询在调用方" —— 只看本文件的判据对它全盲,
 * 于是把一批**正确写法**算成敞口(票面原话:逼人给正确写法加噪音)。四组各配反例:
 *  H-SCOPED 全部调用点带证据 ⇒ 由 missing 升 pre-scoped(viaHop)
 *  H-UNSCOPED 调用方没预查询 ⇒ 维持 missing(不许把"没证据"读成"有证据")
 *  H-PARTIAL 两个调用方,一带一无 ⇒ 维持 missing(**放行条件是全量,不是任一**)
 *  H-NOCALLER 面里找不到调用点 ⇒ undetermined(调用方在射程外 ≠ 已核实安全)
 *  H-FULLTABLE 无 where 的全表写,即便调用方限死了 id 也**不得**被一跳放行
 */
export const BUNDLE_FIXTURES = {
  helperFile: 'apps/api/src/db/hop-helper.ts',
  helper: `export async function deleteConversationsByIds(ids: string[]): Promise<number> {
  const rows = await db
    .delete(chatConversations)
    .where(inArray(chatConversations.id, ids))
    .returning({ id: chatConversations.id })
  return rows.length
}`,
  helperFullTable: `export async function wipeConversations(): Promise<number> {
  await db.delete(chatConversations).execute()
  return 0
}`,
  scopedCaller: (helperPath) => `import { deleteConversationsByIds } from '${relateTo('apps/api/src/routes', helperPath)}'

server.post('/conversations/batch-delete', async (request, reply) => {
  const owned = await dbRead
    .select({ id: chatConversations.id })
    .from(chatConversations)
    .where(
      and(
        eq(chatConversations.userId, request.userId),
        inArray(chatConversations.id, request.body.ids),
      ),
    )
  const ownedIds = owned.map((r) => r.id)
  const removed = await deleteConversationsByIds(ownedIds)
  return reply.send({ removed })
})`,
  unscopedCaller: (helperPath) => `import { deleteConversationsByIds } from '${relateTo('apps/api/src/routes', helperPath)}'

server.post('/conversations/batch-delete', async (request, reply) => {
  const removed = await deleteConversationsByIds(request.body.ids)
  return reply.send({ removed })
})`,
  aliasCaller: (helperPath) => `import { deleteConversationsByIds as dropConvs } from '${relateTo('apps/api/src/routes', helperPath)}'

server.post('/x', async (request) => {
  const owned = await dbRead
    .select({ id: chatConversations.id })
    .from(chatConversations)
    .where(and(eq(chatConversations.userId, request.userId), inArray(chatConversations.id, request.body.ids)))
  const ownedIds = owned.map((r) => r.id)
  return dropConvs(ownedIds)
})`,
  namespacedCaller: (helperPath) => `import * as hop from '${relateTo('apps/api/src/routes', helperPath)}'

server.post('/y', async (request) => {
  const owned = await dbRead
    .select({ id: chatConversations.id })
    .from(chatConversations)
    .where(and(eq(chatConversations.userId, request.userId), inArray(chatConversations.id, request.body.ids)))
  return hop.deleteConversationsByIds(owned.map((r) => r.id))
})`,
}

/** 面内相对说明符(夹具要写真的 `../db/...`,由门 134 那份解析表认得)。 */
function relateTo(fromDir, toPath) {
  const from = fromDir.split('/')
  const to = toPath.split('/')
  let i = 0
  while (i < from.length && i < to.length && from[i] === to[i]) i++
  const up = from.slice(i).map(() => '..')
  const stem = to.slice(i).join('/')
  const noExt = stem.replace(/\.(ts|mts|cts)$/, '')
  return [...up, noExt].join('/') || `./${noExt}`
}

/**
 * 两文件 bundle 的跑法(与生产同一条流水线:scanFileText → buildFaceIndex → runHopPass)。
 * 刻意不复用 analyze 的 git 取材 —— 构造面要零副作用、可在任何机器上跑(§22c 夹具那一型)。
 * 但它走的**必须是同一条判定链**,否则自检证明的是另一台尺子。
 */
export function scanBundleWithHop(entries) {
  const list = entries instanceof Map ? [...entries.entries()] : entries
  const texts = new Map(list)
  const paths = list.map(([p]) => p)
  const perFile = scanFaceBundle(null, 'fixture', paths, texts)
  const hop = runHopPass(perFile, buildFaceIndex(list))
  return { perFile, hop, counts: tally(perFile).counts }
}

/** 名单的**正向证明**:每个归属列名都必须真能命中(否则名单可以是张死表 —— 守门 120 那一型)。 */
export function rosterFixture(col) {
  return `async function f(t: { id: string }) {
  return db.update(chatConversations).set({ a: 1 }).where(eq(chatConversations.${col}, t.id)).returning()
}`
}

/** O2 的名单正向证明同样不能省:库面/请求侧/不回计数 三态各一条构造面。 */
export const O2_FIXTURES = {
  fromLib: `export async function del(userId: string, ids: string[]) {
  const rows = await db
    .delete(chatConversations)
    .where(and(eq(chatConversations.userId, userId), inArray(chatConversations.id, ids)))
    .returning({ id: chatConversations.id })
  return rows.length
}`,
  fromRequest: `export async function del(userId: string, ids: string[]) {
  await db
    .delete(chatConversations)
    .where(and(eq(chatConversations.userId, userId), inArray(chatConversations.id, ids)))
    .execute()
  return ids.length
}`,
}

/** 判据吃到的"结论"抽成纯函数,方便镜像测试与自检共用一份(不得在测试里再抄判据)。 */
export function judgeFixture(text) {
  const per = scanFileText('fixture.ts', text)
  return per.sites
}

function runSelfTest() {
  const checks = []
  const ok = (name, cond, extra = '') => checks.push({ name, pass: !!cond, extra })
  const first = (text) => judgeFixture(text)[0] || null
  const all = (text) => judgeFixture(text)

  // —— O1 四态各就位,成对 ——
  const pre = first(FIXTURES.realPreSelectThenWrite)
  ok('P1 真仓 :212-221 那一型 ⇒ pre-scoped(反向对照:不得判红)', !!pre && pre.o1 === 'pre-scoped', `实得 ${pre && pre.o1} · ${pre && pre.why}`)
  const cut = first(FIXTURES.realPreSelectRemoved)
  ok('P2 同一夹具删掉预查询 ⇒ 必须点名 missing(阳性对照)', !!cut && cut.o1 === 'missing', `实得 ${cut && cut.o1}`)
  const bc = first(FIXTURES.realBusinessCardDelete)
  ok('P3 真仓 business-card「先查 owned 再删」⇒ pre-scoped(反向对照)', !!bc && bc.o1 === 'pre-scoped', `实得 ${bc && bc.o1} · ${bc && bc.why}`)
  const own = first(FIXTURES.ownedSetFeedsWrite)
  ok('P4 被写的 id 集来自带归属的预查询 ⇒ pre-scoped', !!own && own.o1 === 'pre-scoped', `实得 ${own && own.o1}`)
  const sq = first(FIXTURES.sqlScoped)
  ok('P5 SQL 级归属 ⇒ sql-scoped', !!sq && sq.o1 === 'sql-scoped', `实得 ${sq && sq.o1}`)
  const mb = first(FIXTURES.missingBatch)
  ok('P6 同一批量写摘掉归属列 ⇒ missing(成对)', !!mb && mb.o1 === 'missing', `实得 ${mb && mb.o1}`)
  const rs = first(FIXTURES.rawSqlScoped)
  ok('P7 裸 SQL 的 WHERE 带 workspace_id ⇒ sql-scoped(上游那一族的形状)', !!rs && rs.o1 === 'sql-scoped', `实得 ${rs && rs.o1}`)
  ok('P7b 裸 SQL 站点必须被认出来(kind=raw-sql,不是被漏掉)', !!rs && rs.kind === 'raw-sql', `实得 ${rs && rs.kind}`)
  const rn = first(FIXTURES.rawSqlNoOwner)
  ok('P8 同一条裸 SQL 去掉归属列 ⇒ missing(成对)', !!rn && rn.o1 === 'missing', `实得 ${rn && rn.o1}`)
  const rp = first(FIXTURES.rawSqlPositional)
  ok('P20 裸 SQL 用 ? 位置参数 ⇒ undetermined(绑定顺序读不出,不猜)', !!rp && rp.o1 === 'undetermined', `实得 ${rp && rp.o1} · ${rp && rp.why}`)
  const rf = first(FIXTURES.rawSqlRawFragment)
  ok('P21 裸 SQL 的条件由 sql.raw 拼 ⇒ undetermined(条件集读不全)', !!rf && rf.o1 === 'undetermined', `实得 ${rf && rf.o1}`)
  const scoped = first(`export async function pinIt(userId: string, id: string) {
  return dbScoped
    .update(chatConversations)
    .set({ pinned: true })
    .where(and(eq(chatConversations.userId, userId), eq(chatConversations.id, id)))
    .returning()
}`)
  ok('P22 scoped 出口上的写也必须被认成站点(接收者名单的正向证明)', !!scoped && scoped.o1 === 'sql-scoped', `实得 ${scoped && scoped.o1}`)
  const scopedBare = first(`export async function pinIt(id: string) {
  return dbScoped.update(chatConversations).set({ pinned: true }).where(eq(chatConversations.id, id)).returning()
}`)
  ok('P23 同一接收者摘掉归属列 ⇒ missing(成对:名单正向证明必须有牙)', !!scopedBare && scopedBare.o1 === 'missing', `实得 ${scopedBare && scopedBare.o1}`)
  // TS 特有的陷阱:形参/返回类型标注里就带花括号。把 `{ id: string }` 当函数体,站点会因
  // "解析不出所属函数体"整片落 undetermined —— 五个归属列第一轮全被判不出就是这么来的。
  const tsAnno = first(`export async function patchTitle(
  id: string,
  data: { title: string; userId: string },
): Promise<ChatConversation | undefined> {
  const rows = await db
    .update(chatConversations)
    .set({ title: data.title })
    .where(eq(chatConversations.id, id))
    .returning()
  return rows[0]
}`)
  ok('P24 返回类型标注里的花括号不得被当函数体(TS 形状)', !!tsAnno && tsAnno.o1 === 'missing' && !/^解析不出所属函数体/.test(tsAnno.why), `实得 ${tsAnno && tsAnno.o1} · ${tsAnno && tsAnno.why}`)
  const tsAnno2 = first(`export async function patchTitle(id: string): Promise<{ title: string }> {
  const rows = await db
    .update(chatConversations)
    .set({ title: 'x' })
    .where(eq(chatConversations.id, id))
    .returning()
  return rows[0]
}`)
  ok('P25 泛型返回类型 `Promise<{…}>` 同形状 ⇒ 仍判得出(成对)', !!tsAnno2 && tsAnno2.o1 === 'missing', `实得 ${tsAnno2 && tsAnno2.o1}`)
  const ic = first(FIXTURES.ownerInCommentOnly)
  ok('P9 归属条件只在注释里 ⇒ 不得算 sql-scoped', !!ic && ic.o1 === 'missing', `实得 ${ic && ic.o1}`)
  const istr = first(FIXTURES.ownerInStringOnly)
  ok('P10 归属条件只在字符串里 ⇒ 同样不算', !!istr && istr.o1 === 'missing', `实得 ${istr && istr.o1}`)
  const wv = first(FIXTURES.whereInVariable)
  ok('P11 where 住在变量里、一跳可解到归属谓词 ⇒ sql-scoped', !!wv && wv.o1 === 'sql-scoped', `实得 ${wv && wv.o1}`)
  const ws = first(FIXTURES.whereSpread)
  ok('P12 where 由 ...spread 组装 ⇒ undetermined(既不冒红也不记绿)', !!ws && ws.o1 === 'undetermined', `实得 ${ws && ws.o1}`)
  const eb = first(FIXTURES.evidenceButUnlinked)
  ok('P13 有归属证据但接不上被写的 id ⇒ undetermined(不猜合规)', !!eb && eb.o1 === 'undetermined', `实得 ${eb && eb.o1} · ${eb && eb.why}`)
  const ft = first(FIXTURES.fullTableDelete)
  ok('P14 无条件全表写 ⇒ missing(正面判得', !!ft && ft.o1 === 'missing', `实得 ${ft && ft.o1}`)
  const tl = first(FIXTURES.topLevelWrite)
  ok('P15 函数体外的写 ⇒ undetermined 并点名原因', !!tl && tl.o1 === 'undetermined', `实得 ${tl && tl.o1} · ${tl && tl.why}`)
  const sib = all(FIXTURES.siblingBorrow)
  ok(
    'P16 兄弟 handler 不得互借归属证据:第二处写必须 missing',
    sib.length === 2 && sib[0].o1 === 'pre-scoped' && sib[1].o1 === 'missing',
    sib.map((s) => s.o1).join('/'),
  )
  const nwr = all(FIXTURES.notWrites)
  ok('P17 路由注册与内存 Map 不得被当写站点(接收者白名单)', nwr.length === 0, `实得 ${nwr.length} 站点`)

  // —— O1c CAS(只报数):归属齐了不等于有 CAS ——
  const casHit = first(`export async function bump(id: string, userId: string) {
  return db.update(chatConversations).set({ title: 'x' }).where(and(eq(chatConversations.userId, userId), eq(chatConversations.title, oldTitle))).returning()
}`)
  ok(
    'K1 被改列(title)同时是谓词列 ⇒ cas-present(上游那一族的形状)',
    casHit.cas === 'cas-present',
    `实得 ${casHit.cas} · ${casHit.casWhy}`,
  )
  const casMiss = first(`export async function renameOwned(userId: string, id: string) {
  return db.update(chatConversations).set({ title: 'x' }).where(and(eq(chatConversations.userId, userId), eq(chatConversations.id, id))).returning()
}`)
  ok(
    'K2 归属列齐了、被改列(title)不进谓词 ⇒ cas-absent 而 O1 仍 sql-scoped(两维各判各的)',
    casMiss.cas === 'cas-absent' && casMiss.o1 === 'sql-scoped',
    `实得 ${casMiss.cas} / O1 ${casMiss.o1}`,
  )
  const casDel = first(FIXTURES.sqlScoped)
  ok(
    'K2b DELETE 没有被改列 ⇒ not-applicable(不许混进 cas-absent,更不许混进"判不了"——三态不并桶)',
    casDel.cas === 'not-applicable',
    `实得 ${casDel.cas}`,
  )
  const casReal = first(FIXTURES.realPreSelectThenWrite)
  ok(
    'K3 票面点名的 :212-221 那一型:O1 有属主证据(pre-scoped)而 CAS 缺位 ⇒ cas-absent —— 这就是"挡得住越权、挡不住覆盖"那一格',
    casReal.o1 === 'pre-scoped' && casReal.cas === 'cas-absent',
    `实得 ${casReal.o1} / ${casReal.cas}`,
  )
  const rawHit = first(FIXTURES.rawSqlScoped)
  ok(
    'K4 裸 SQL:directory/path 既在 SET 又在 WHERE ⇒ cas-present(上游 :289-294 逐字形状)',
    rawHit.cas === 'cas-present',
    `实得 ${rawHit.cas} · ${rawHit.casWhy}`,
  )
  const rawMiss = first(`export async function touchSession(input): Promise<boolean> {
  const result = await db.execute(sql\`
    update session set note = \${input.note} where id = \${input.sessionID}
  \`)
  return Number(result.changes) === 1
}`)
  ok(
    'K5 裸 SQL 的 SET 列(note)不进 WHERE ⇒ cas-absent;而它归属列也缺 ⇒ O1 missing(两维各判各的)',
    rawMiss.cas === 'cas-absent' && rawMiss.o1 === 'missing',
    `实得 ${rawMiss.cas} / O1 ${rawMiss.o1}`,
  )
  ok(
    'K5b 裸 SQL 的 rawSqlNoOwner 夹具里 directory **既在 SET 又在 WHERE** ⇒ 必须是 cas-present(判据不许因为 O1 missing 就把 CAS 也判成缺位)',
    first(FIXTURES.rawSqlNoOwner).cas === 'cas-present',
    `实得 ${first(FIXTURES.rawSqlNoOwner).cas}`,
  )
  // K7 的两侧必须都写:spread 只挡"没找到交集"那一侧,找到交集仍是**正向证明** present
  const spreadNoHit = first(`export async function patch(id: string, base: object) {
  return db.update(chatConversations).set({ ...base, title: 'x' }).where(eq(chatConversations.id, id)).returning()
}`)
  const spreadHit = first(`export async function patch2(id: string, base: object) {
  return db.update(chatConversations).set({ ...base, title: 'x' }).where(eq(chatConversations.title, oldTitle)).returning()
}`)
  ok(
    'K7 被改列含 spread:无交集 ⇒ cas-undetermined(不许悄悄算 absent);有交集 ⇒ 仍 cas-present(正向证明不被 spread 抹掉)',
    spreadNoHit.cas === 'undetermined' && spreadHit.cas === 'cas-present',
    `实得 ${spreadNoHit.cas} / ${spreadHit.cas}`,
  )
  const casOnly = tally([scanFileText('c.ts', FIXTURES.realPreSelectThenWrite)])
  ok(
    'K6 CAS 永不抬起退出码:一站 cas-absent 而 O1 干净 ⇒ 默认档与 --strict 全量档判据都仍是 0',
    casOnly.counts.casAbsent === 1 &&
      casOnly.counts.missing === 0 &&
      casOnly.counts.undetermined === 0 &&
      casOnly.counts.casNa === 0 &&
      decide({ face: 'head', strict: true, missing: 0, undetermined: 0, ratcheted: 0 }) === 0,
    JSON.stringify(casOnly.counts),
  )

  // —— 票面 ②:上游一跳(沿 import)—— 每条都跑**与生产同一条流水线**(scan + buildFaceIndex + runHopPass)
  const HP = BUNDLE_FIXTURES.helperFile
  const bundle = (callers) =>
    scanBundleWithHop([
      [HP, BUNDLE_FIXTURES.helper],
      ...callers.map(([file, text]) => [file, text]),
    ])
  const site0 = (r) => r.perFile.find((x) => x.file === HP).sites[0]
  const h1 = bundle([['apps/api/src/routes/hop-a.ts', BUNDLE_FIXTURES.scopedCaller(HP)]])
  ok(
    'H1 调用方先查 owned 再把 id 传进来 ⇒ 由 missing 升 pre-scoped(票面 ② 的正例)',
    site0(h1).o1 === 'pre-scoped' && site0(h1).viaHop === true && h1.hop.promoted.length === 1,
    `实得 ${site0(h1).o1} · viaHop=${!!site0(h1).viaHop}`,
  )
  const h2 = bundle([['apps/api/src/routes/hop-b.ts', BUNDLE_FIXTURES.unscopedCaller(HP)]])
  ok(
    'H2 调用方没有任何属主预查询 ⇒ 维持 missing(不得把没证据读成有证据)',
    site0(h2).o1 === 'missing' && site0(h2).hop && site0(h2).hop.action === 'keep' && site0(h2).hop.calls === 1,
    `实得 ${site0(h2).o1} · hop=${site0(h2).hop && site0(h2).hop.action}`,
  )
  const h3 = bundle([
    ['apps/api/src/routes/hop-c.ts', BUNDLE_FIXTURES.scopedCaller(HP)],
    ['apps/api/src/routes/hop-d.ts', BUNDLE_FIXTURES.unscopedCaller(HP)],
  ])
  ok(
    'H3 两个调用方一带一无 ⇒ 仍 missing(**放行条件是全量调用点,不是任一处** —— 否则一个守法调用方就给整条 SQL 发合格证)',
    site0(h3).o1 === 'missing' && site0(h3).hop.scoped === 1 && site0(h3).hop.calls === 2,
    `实得 ${site0(h3).o1} · calls=${site0(h3).hop && site0(h3).hop.calls} scoped=${site0(h3).hop && site0(h3).hop.scoped}`,
  )
  const h4 = bundle([])
  ok(
    'H4 面里找不到调用点 ⇒ undetermined(调用方在射程外 ≠ 已核实安全;绝不静默留在 missing)',
    site0(h4).o1 === 'undetermined' && /找不到 .* 的调用点/.test(site0(h4).why),
    `实得 ${site0(h4).o1} · ${site0(h4).why}`,
  )
  const h5 = scanBundleWithHop([
    [HP, BUNDLE_FIXTURES.helperFullTable],
    ['apps/api/src/routes/hop-e.ts', `import { wipeConversations } from '${relateTo('apps/api/src/routes', HP)}'\nserver.post('/wipe', async (request) => {\n  const owned = await dbRead.select({ id: chatConversations.id }).from(chatConversations).where(eq(chatConversations.userId, request.userId))\n  void owned\n  return wipeConversations()\n})`],
  ])
  ok(
    'H5 无 where 的全表写**不得**被上游一跳放行(调用方限死 id 也救不了它 —— 那条 SQL 根本不按 id 走)',
    site0(h5).o1 === 'missing' && !site0(h5).viaHop && h5.hop.promoted.length === 0,
    `实得 ${site0(h5).o1} · promoted=${h5.hop.promoted.length}`,
  )
  const h6 = bundle([['apps/api/src/routes/hop-f.ts', BUNDLE_FIXTURES.aliasCaller(HP)]])
  ok(
    'H6 as 别名调用(`import { x as y }`)必须照样解析到 —— 漏了这一型,门对自己产出的形态失明(门 145 同课)',
    site0(h6).o1 === 'pre-scoped' && site0(h6).viaHop === true,
    `实得 ${site0(h6).o1}`,
  )
  const h7 = bundle([['apps/api/src/routes/hop-g.ts', BUNDLE_FIXTURES.namespacedCaller(HP)]])
  ok(
    'H7 经 import * as 命名空间调用 ⇒ undetermined(读不出调用点就不假装读得出)',
    site0(h7).o1 === 'undetermined' && /命名空间/.test(site0(h7).why),
    `实得 ${site0(h7).o1} · ${site0(h7).why}`,
  )
  const h9 = scanBundleWithHop([
    [HP, BUNDLE_FIXTURES.helper],
    ['apps/api/src/db/index.ts', "export * from './hop-helper'\n"],
    ['apps/api/src/routes/hop-h.ts', BUNDLE_FIXTURES.scopedCaller('apps/api/src/db/index.ts')],
  ])
  ok(
    'H9 模块被 barrel 的 export * 转发 ⇒ 调用方集合不可枚举,落 undetermined(**绝不拿不完整集合放行**)',
    site0(h9).o1 === 'undetermined' && h9.hop.promoted.length === 0 && /export \\*/.test(site0(h9).why),
    `实得 ${site0(h9).o1} · ${site0(h9).why}`,
  )
  ok(
    'H8 一跳放行的站点必须**另档计数**(preScopedByHop),与体内证据分家 —— 读报告的人得知道这一档是靠调用方顶住的',
    h1.counts.preScoped === 1 && h1.counts.preScopedByHop === 1,
    `实得 preScoped=${h1.counts.preScoped} byHop=${h1.counts.preScopedByHop}`,
  )

  // —— 名单正向证明(守门 120):每个归属列名都要真能命中 ——
  for (const col of OWNER_COLUMNS) {
    const s = first(rosterFixture(col))
    ok(`P18.${col} 名单里的归属列必须真能命中 sql-scoped`, !!s && s.o1 === 'sql-scoped', `实得 ${s && s.o1}`)
  }
  const neg = first(`async function f(t: { id: string }) {
  return db.update(chatConversations).set({ a: 1 }).where(eq(chatConversations.conversationId, t.id)).returning()
}`)
  ok('P19 非归属列(conversationId)不得被认作归属条件', !!neg && neg.o1 === 'missing', `实得 ${neg && neg.o1}`)

  // —— O2(只报数) ——
  const o2a = first(O2_FIXTURES.fromLib)
  ok('Q1 计数取自 .returning() 的返回集 ⇒ from-lib', !!o2a && o2a.o2 === 'from-lib', `实得 ${o2a && o2a.o2}`)
  const o2b = first(O2_FIXTURES.fromRequest)
  ok('Q2 计数取自请求侧 ids.length ⇒ from-request(成对)', !!o2b && o2b.o2 === 'from-request', `实得 ${o2b && o2b.o2}`)
  const o2c = first(FIXTURES.fullTableDelete)
  ok('Q3 不回行数的写 ⇒ not-reporting,而不是"违规"', !!o2c && o2c.o2 === 'not-reporting', `实得 ${o2c && o2c.o2}`)
  const o2d = first(FIXTURES.rawSqlNoOwner)
  ok('Q4 O2 与 O1 各判各的:O1 missing 的一站,O2 仍须认它取了 changes', !!o2d && o2d.o2 === 'from-lib' && o2d.o1 === 'missing')
  // 这一条是本门与守门 134 的**分工锁**:O2 无论读到什么,都不得进判红集合(两道门互指同一格 = 两份基线互相顶掉)。
  const o2Bundle = [scanFileText('o2.ts', O2_FIXTURES.fromRequest)]
  const o2Tally = tally(o2Bundle)
  ok(
    'Q5 O2 判出 from-request 而 O1 干净 ⇒ 判红集合必须为空、退出码不得被 O2 抬起',
    o2Tally.counts.o2FromRequest === 1 &&
      o2Tally.counts.missing === 0 &&
      decide({
        face: 'head',
        strict: true,
        missing: o2Tally.counts.missing,
        undetermined: o2Tally.counts.undetermined,
        ratcheted: 0,
      }) === 0,
    JSON.stringify(o2Tally.counts),
  )

  // —— 退出码与棘轮 ——
  ok('R1 默认档恒不判红(票面定级)', decide({ face: 'head', strict: false, missing: 50, undetermined: 9, ratcheted: 5 }) === 0)
  ok('R2 --strict + 有未判定 ⇒ 2(拒绝出具合格证)', decide({ face: 'head', strict: true, missing: 1, undetermined: 1, ratcheted: 0 }) === 2)
  ok('R3 --strict + 无未判定 + 有 missing ⇒ 1', decide({ face: 'head', strict: true, missing: 3, undetermined: 0, ratcheted: 0 }) === 1)
  ok('R4 --strict + 全干净 ⇒ 0', decide({ face: 'head', strict: true, missing: 0, undetermined: 0, ratcheted: 0 }) === 0)
  ok('R5 --staged --strict 用棘轮后的新增当判红集合(存量不顶在本次头上)', decide({ face: 'staged', strict: true, missing: 40, undetermined: 0, ratcheted: 0 }) === 0)
  ok('R6 --staged --strict 有新增 ⇒ 1', decide({ face: 'staged', strict: true, missing: 40, undetermined: 0, ratcheted: 2 }) === 1)
  const perFile = [
    {
      file: 'a.ts',
      sites: [
        { file: 'a.ts', line: 10, o1: 'missing' },
        { file: 'a.ts', line: 20, o1: 'missing' },
      ],
    },
  ]
  const headMap = new Map([['a.ts', [{ o1: 'missing' }, { o1: 'missing' }]]])
  ok('R7 棘轮:数量相等 ⇒ 零新增(存量不判红)', ratchet(perFile, headMap).length === 0)
  const headMap2 = new Map([['a.ts', [{ o1: 'missing' }]]])
  ok('R8 棘轮:多出一个 ⇒ 点名那一个(成对)', ratchet(perFile, headMap2).length === 1 && ratchet(perFile, headMap2)[0].line === 20)
  const headMap3 = new Map()
  ok('R9 新文件(HEAD 里没有)⇒ 按存量 0 处理,两处全算新增', ratchet(perFile, headMap3).length === 2)
  ok('R10 exceedsAnchor 只在严格大于时成立(相等不算)', exceedsAnchor({ headCount: 2, currentCount: 2 }) === false && exceedsAnchor({ headCount: 1, currentCount: 2 }) === true)
  ok('R11 sql-scoped 的改动不得顶掉 missing 的额度(锚点按状态分组)', (() => {
    const cur = [{ o1: 'missing' }, { o1: 'missing' }, { o1: 'sql-scoped' }]
    const head = [{ o1: 'missing' }]
    return ratchet([{ file: 'x', sites: cur }], new Map([['x', head]])).length === 1
  })())

  // —— 取材面与词法档 ——
  ok('S1 blankCommentsOnly 逐字符保位(两档下标必须能互换)', (() => {
    const src = 'const a = 1 // 注释里有 where user_id = ?\nconst b = "x"\n'
    const out = blankCommentsOnly(src)
    return out.length === src.length && !/user_id/.test(out) && /"x"/.test(out)
  })())
  ok('S2 maskCommentsAndStrings 连字符串一起抹(归属在字符串里必须消失)', (() => {
    const src = 'logger.info("where user_id = ?")'
    return !/user_id/.test(maskCommentsAndStrings(src))
  })())
  ok('S3 lineAt 与原文行号同形(判据报的行号要复核得了)', lineAt(FIXTURES.sqlScoped, FIXTURES.sqlScoped.indexOf('.delete(')) === 4)
  ok('S4 非字符串输入不得炸', (() => {
    const r = scanFileText('x.ts', '')
    return r.sites.length === 0
  })())
  ok('S5 覆盖面只有两面,且必须与门 134 同面(两把尺子的读数才可比)', SCAN_DIRS.length === 2 && SCAN_DIRS[0] === 'apps/api/src/db' && SCAN_DIRS[1] === 'apps/api/src/routes')
  ok('S6 归属列名单非空且去重', new Set(OWNER_COLUMNS).size === OWNER_COLUMNS.length && OWNER_COLUMNS.length >= 5)
  ok('S7 snake 档由 camel 名单推导(加一列不必登记两处)', OWNER_SNAKE.length === OWNER_COLUMNS.length && OWNER_SNAKE.includes('user_id') && OWNER_SNAKE.includes('workspace_id') && OWNER_SNAKE.includes('created_by_id'))
  ok('S9 upperInsideStringsOnly 必须等长,且**代码面一个字节不动**(归一只发生在字符串里)', (() => {
    const src = 'const r = await db.execute(sql`update session set a = 1 where user_id = ?`)'
    const out = upperInsideStringsOnly(src)
    return (
      out.length === src.length &&
      out.includes('db.execute(sql`') &&
      /UPDATE SESSION/.test(out) &&
      !/DB\.EXECUTE/.test(out)
    )
  })())
  ok('S9b 反向陷阱登记:整张脸上大写会把 134 的接收者匹配打死(站点归零)', (() => {
    const src = 'const r = await db.execute(sql`UPDATE session SET a = 1 WHERE id = 2`)'
    // 归一前找得到 ⇒ 归一后如果连链都找不到,说明有人把"归一"扩大到了代码面
    const before = findRawSqlWriteChains(src).chains.length
    const after = findRawSqlWriteChains(upperSameLength(src)).chains.length
    return before === 1 && after === 0
  })())
  ok('S10 blankCommentsOnly 与 maskCommentsAndStrings 长度同形(三档下标可互换)', (() => {
    const src = FIXTURES.ownerInCommentOnly
    return blankCommentsOnly(src).length === src.length && maskCommentsAndStrings(src).length === src.length
  })())
  ok(
    'S8 全量档(HEAD)非 strict 恒 0 —— 存量未定性前它就是只报数,不得反过来把提交链也一并按 0',
    decide({ face: 'head', strict: false, missing: 100, undetermined: 100, ratcheted: 100 }) === 0,
  )
  ok(
    'S11 提交链档(--staged 非 strict)差值棘轮必须**有牙**:超出 HEAD 自身存量 ⇒ 1(若这里也恒 0,runner 不带 --strict 时本门对每次提交零拦截 —— 守门 70 那一型)',
    decide({ face: 'staged', strict: false, missing: 100, undetermined: 100, ratcheted: 1 }) === 1,
  )
  ok(
    'S12 提交链档:ratcheted=0 ⇒ 0,即便存量 missing/undetermined 巨大(存量不顶在本次头上,§12e)',
    decide({ face: 'staged', strict: false, missing: 865, undetermined: 52, ratcheted: 0 }) === 0,
  )
  ok(
    'S13 undetermined 在提交链档只报数不判红(它有 52 处存量;当场判红 = 每台每次被逼 --no-verify)',
    decide({ face: 'staged', strict: false, missing: 0, undetermined: 52, ratcheted: 0 }) === 0,
  )

  for (const c of checks) console.log(`${c.pass ? '✅' : '❌'} ${c.name}${c.extra ? ` —— ${c.extra}` : ''}`)
  const passed = checks.filter((c) => c.pass).length
  console.log(`--self-test: ${passed}/${checks.length} 通过`)
  process.exitCode = passed === checks.length ? 0 : 1
}

/* ------------------------------ CLI ------------------------------ */

function main(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return void console.log(USAGE)
  if (argv.includes('--self-test')) return runSelfTest()
  const ri = argv.indexOf('--root')
  if (ri >= 0) {
    const dir = argv[ri + 1]
    if (!dir) {
      console.error(`[${GATE}] ❌ --root 需要一个目录参数`)
      return 2
    }
    ROOT = resolve(dir)
    assertRepoRoot(ROOT, GATE)
  }
  const picked = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (picked.error) {
    console.error(`[${GATE}] ❌ 无法判定:${picked.error}`)
    return 2
  }
  const fi = argv.indexOf('--files')
  const only =
    fi >= 0 && argv[fi + 1]
      ? argv[fi + 1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : null
  const li = argv.indexOf('--limit')
  const limit = li >= 0 && argv[li + 1] ? Number(argv[li + 1]) : 12
  let out
  try {
    out = analyze(ROOT, picked.face, { strict: argv.includes('--strict'), onlyFiles: only })
  } catch (e) {
    console.error(
      `[${GATE}] 无法判定(exit 2):${e instanceof Undetermined ? e.message : `${e?.message ?? e}\n${e?.stack ?? ''}`}`,
    )
    return 2
  }
  if (argv.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          gate: out.gate,
          face: out.face,
          strict: out.strict,
          counts: out.counts,
          undeterminedReasons: out.undeterminedReasons,
          violations: out.violations,
          ratcheted: out.ratcheted,
          anchorAbsent: out.anchorAbsent,
          hop: out.hop,
          perFile: out.perFile,
          exit: out.exit,
        },
        null,
        2,
      ),
    )
    return out.exit
  }
  if (argv.includes('--explain')) {
    for (const r of out.perFile)
      for (const s of r.sites)
        console.log(
          `  · ${s.file}:${s.line} ${s.receiver}.${s.verb} O1=${s.o1}${s.evidence ? ` 证据=${s.evidence}` : ''} O2=${s.o2} —— ${s.why}`,
        )
  }
  for (const line of formatReport(out, Number.isFinite(limit) ? limit : 12)) console.log(`[${GATE}] ${line}`)
  return out.exit
}

export const __test__ = {
  // 判据只此一份实现:镜像测试与自检都从这里取,不得在测试里再抄一份(§22c)。
  scanFileText,
  scanFaceBundle,
  judgeOwner,
  judgeReportFace,
  judgeCas,
  judgeFixture,
  hasOwnerPredicate,
  resolveWhereText,
  collectIdRoots,
  findWriteChains,
  findReadChains,
  findFunctionBodies,
  lineAt,
  blankCommentsOnly,
  upperSameLength,
  predicatesOf,
  rootsOf,
  readKeys,
  valueIdentifiers,
  exceedsAnchor,
  ratchet,
  decide,
  tally,
  analyze,
  listCandidates,
  listEvidenceCandidates,
  readCandidates,
  formatReport,
  // 上游一跳(票面 ②)的那一份实现:镜像测试与自检都从这里取,不得在测试里再抄判据(§22c)。
  connectToPreQuery,
  hopVerdict,
  runHopPass,
  buildFaceIndex,
  buildImportGraph,
  makeFileCtx,
  exportedNamesOf,
  enclosingFunctionName,
  callSitesOf,
  resolveSpecPath,
  scanBundleWithHop,
  BUNDLE_FIXTURES,
  HOP_EVIDENCE_DIR,
  HOP_MAX_IMPORTER_FILES,
  HOP_MAX_CALL_SITES,
  OWNER_COLUMNS,
  OWNER_SNAKE,
  DB_RECEIVERS,
  SCAN_DIRS,
  SELF_EXEMPT,
  GATE,
  SELF_SKIP,
  FIXTURES,
  O2_FIXTURES,
  rosterFixture,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    console.error(`[${GATE}] 脚本自身异常:${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
