#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-batch-write-count-honesty.mjs — 批量写端点的 affected/deleted 不得由请求侧自算
 *
 * 在修什么(本批实测成因,不是抽象理由):同一批里人肉逐文件找到 8 处"批量写端点把
 * affected/deleted 由请求侧 `.length` 自算"的静默失真(chat.ts 批量、admin-sys/role-routes.ts
 * cancelAll+selectAll、admin-demand-square.ts、admin/_shared.ts registerCrud 批量删、
 * message.ts 批量删、workspace.ts batch-delete/batch-restore)。症状是**改了 0 行与改成功返回完全
 * 同形** —— 不报错、typecheck 全绿、单测不红,只有用户看到"已删除 3 条"而库里一条没动。修法是唯一
 * 出口 `apps/api/src/utils/batch-outcome.ts`(dedupeIds / batchWriteOutcome)+ db 层用
 * `.returning({id})` 回报真实命中集合。**没有尺子,下一批同类端点照样进 HEAD** —— 这正是本仓全部
 * 守门的立项理由。
 *
 * 判据(一条,窄口径,宁漏不误报):在 `apps/api/src/routes/**` 与 `apps/api/src/db/**` 的
 * 跟踪文件里,同一**函数体**内
 *   ① 有一条 `db|tx|trx` 发起的 `.delete(`/`.update(` 链,链上带 `.where(` 且其中出现 `inArray(`;
 *   ② 且该链**之后**有 `.send(success({ … (deleted|affected|restored|removed|count): <点号链>.length … }))`。
 *
 * 四条放过通道(任一成立即不算违规,各有一支正反对照钉住):
 *   E1 链上带 `.returning(` —— 计数来自库确认的返回集;
 *   E1b 计数根标识符可追到库确认的集合(归属预查询 `select … where inArray(…)` / returning 结果,
 *       ≤2 跳)。必须有这一条:唯一出口自己的定义就是"affected 由库确认的集合(… / **归属预查询
 *       命中集**)推出",只看 `.returning(` 会把 `business-card-routes.ts` 那种正确写法判成红。
 *   E2 该文件 import 了 `utils/batch-outcome`(已在唯一出口上);
 *   E3 命中行或其紧邻上一行有行内豁免 `batch-count-exempt: <原因>` —— **必须带非空原因**,裸标记
 *       不算(与门 102/108 同规矩),且必须在注释里(否则把标记写进字符串就能冒充豁免)。
 *
 * 刻意不判的邻近形状(反向锁,不得为消红放宽判据):N1 `success({ deleted: true })` 布尔确认里
 * **与写链无关的那一型**(同函数体内没有 db|tx|trx 的 delete/update ⇒ 它只是"惯例 ack",改它属
 * 全 API 语义决策,不归这道门顺手做;带写链的那一半自 2026-09-27 起升级成判据 **B1**,见下一段)
 * 与 `deleted: ids.length > 0` 这类比较式;N2 `count: rows.length` 读查询计数(函数体内无写链);
 * N3 注释与字符串里的字样 —— 判据跑在"剥注释 + 抹字符串"的代码面上,模块说明符是唯一例外(E2 只能
 * 从字符串里读),所以 import 判据跑在另一档上;两型遮噪方向不同,门 118 头注记过同一条教训,各有用例。
 *
 * B1(2026-09-27 立):布尔 ack 里**可判的那一部分**从"只报数"升级成棘轮判据。用户已拍板把
 * `deleted: true` 改成真实语义(= 库里真删了一行,6 路并行改造在跑),所以"函数里真发了 delete/update,
 * 却无条件回 `deleted: true`"从惯例变成了**已知在偿的债** —— 新写一处这种假 ack、或把已改真的点改回
 * 字面量,都必须当场红;而 HEAD 存量不判红(与改动无关的恒红门唯一结局是逼人 `--no-verify`,§12e)。
 *   判据一条:同一**函数体**内 ① 有一条 `db|tx|trx` 发起的 `.delete(`/`.update(` 链(不要求 inArray ——
 *     B1 只问"这一屏真的发了写",不问命中集算法),② 有 `.send(<X>success({ … deleted: true … }))`
 *     字面量(与 V1 **共用同一份取材**:`sendSuccessObjects` + `findBooleanAckSends`,两处各扫一遍必漂移,
 *     M13 的 send-success 扫描式单点锁同时管住这一族),③ 体内没有 `.returning(`、也没有 `batchWriteOutcome(`
 *     ⇒ 违规。判据只在**响应对象面**里找 `deleted: true` —— select 结果映射、类型注解、注释、字符串里的
 *     同字样一律不算(所以它不是整行 grep,`B1r` 用例钉死这一点)。
 *   两条放过通道(与违规判据同一次扫描内判定,各配正反用例):
 *     F1 同函数体有 `.returning(` 或 `batchWriteOutcome(` 调用 —— 已是库确认口径(注释/字符串里的这两个
 *        字样不算:判据跑在遮蔽后的代码面上);
 *     F2 行内豁免 `delete-ack-exempt: <原因>` —— **必须带非空原因**(裸标记不计,同门 102/108 的
 *        "注释闭合符冒充原因"教训)、**必须落在注释里**(字符串里的标记不算)、**只命中本行生效**(比
 *        `batch-count-exempt` 的"本行或紧邻上一行"更严:假 ack 的标记写在上一行是直觉动作,那条通道
 *        宽一寸,一个标记就能救整块,反向锁由 `B1p②c` 钉住)。它已登记进守门 108 的
 *        `FAMILY_LIFETIME_DAYS` 取 **30 天** —— 这是待偿的迁移债,不是结构性定性。
 *   **E2(文件级 import 唯一出口)刻意不救 B1**:import 了 `utils/batch-outcome` 不等于这一处 ack
 *     走了库确认(实测 fixture `b1OutletFileStillJudged`),文件级放过是计数判据的口径,搬过来就
 *     把最典型的"迁了一半的端点"洗成通过。
 *   棘轮锚点 = **该文件 HEAD 自身的 B1 计数**(与门 70/77/83/98 同形,禁止手工白名单文件清单 ——
 *     清单必然腐烂):存量只报数、新增即红、把已改真的点改回字面量即红、清掉后锚点自动下降。
 *   结构性看不见的一格如实报数:布尔 ack 落在**解析不出函数体**的位置(模块顶层、class 方法简写等)
 *     ⇒ `b1NoBody` 只报数不判红也不记绿;`--strict` 下与既有未判定同档 ⇒ 拒绝出合格证(exit 2)。
 *
 * B2(2026-09-27 立,与 B1 并列、各计各的):**把"一跳委托"接进判据 —— 防的是摘掉 .returning( 的回退**。
 *   B1 只看**同一函数体**内有没有写链,而 HEAD 面 38 处布尔 ack 里有一批的写法是
 *   `await deleteXxx(id)` + `deleted: true` —— 真 `db.delete()` 住在**另一个文件**的被委托函数里,
 *   函数体看不见写链 ⇒ **B1 结构上失明**。第二十六批刚把这一族改成"委托函数回报 RETURNING 命中集";
 *   以后谁把某个委托函数里的 `.returning(` 摘掉(或把路由改回 `deleted: true`),B1 一声不响,
 *   而账面仍是"这一族已清零"。B2 就是把这一跳接上。
 *   判据:ack 所在函数体 ①**没有**直接写链(有链那一子集归 B1,同一格不得两道判据各计一次),
 *   ②体内 `await` 了**经 import 说明符解析到本仓 `apps/api/src` 文件**的具名导出函数(一跳,不追传递闭包),
 *   ③被调函数体含 `db|tx|trx` 上带 `.where(` 的 `.delete(`/`.update(` 链、**该链没有 `.returning(`**,
 *   ④被调函数体内也没有 `batchWriteOutcome(` ⇒ 违规。
 *   三条刻意收窄,每条都落到"未判定"并报数、在结论行点名(绝不静默算通过,也绝不因判不出而判红):
 *     N1 命名空间转发(`import * as ns` + `await ns.del()`)、`export * from` / `export {} from` 再导出、
 *        第三方与 workspace 包(`fastify` / `@ihui/database`)、被调文件不在所判面、相对/别名路径解析不到、
 *        被调符号不是可解析的函数导出、被调链 opaque(where 里混函数字面量)⇒ **未判定**;
 *     N2 被调函数体解析到了但**根本没有带 where 的写链**(纯归属预查、软删标记走别的路径)⇒
 *        判"无写链",这是真绿,不塞进未判定充数;
 *     N3 ack 体内既没有被 await 的 import 具名函数、也没有 N1 那些形态 ⇒ **不入 B2 的账**
 *        (它已由 V1 的布尔 ack 惯例数逐条点名,再计一次就是把同一格算两遍)。
 *   豁免:与 B1 **同一条通道、同一份实现** —— `delete-ack-exempt: <原因>`,只本行生效,原因不得由
 *     注释闭合符冒充(M16 那把"不得另写第二份豁免判法"的锁同时管住这一族)。
 *   取材:被调函数体与调用方**同面同轮**(head 判 HEAD、staged 判索引、worktree 判磁盘),needs 清单由
 *     调用方那一遍得出、在同一次 analyze 里一次读满;枚举表(`ls-tree`/`ls-files`)也按同一面取,
 *     不得"清单来自磁盘 + 内容来自 HEAD"。
 *
 * 两份"惯例存量"计数(可见性,不是判据 —— **永不影响退出码**):上面那两个"刻意放过"的形状此前只有
 * 注释里的一句"全仓 257 处"撑着,而那句是人肉量的,下次谁扩面/收面账面没人知道它变了多少。现由本门
 * 每次现读数并报数:
 *   V1 `booleanAckSites` / `booleanAckFiles` —— 窄到形态:`.send(<X>success({ … deleted: true … }))`
 *      对象字面量里 **键逐字为 `deleted`、值为布尔字面量 `true`、其后紧跟 `,` 或 `}`**。
 *      因此 `deleted: affected` / `deleted: rows.length` / `deleted: true === x` / `isDeleted: true` /
 *      `restored: true`(别的键族)**一律不混进这一计数**。
 *      **V1 仍是全形态的"现读可见性"数,自身依旧不参与任何退出码**;但自 2026-09-27 起它是 B1 的
 *      超集 —— 其中"同函数体有写链且无库确认"的那一子集被 B1 判据问责(走 `b1*` 自己的键,
 *      V1 的读数一字不动)。"布尔 ack 惯例不计红"这句现在只对**无写链**的那一半成立。
 *   V2 `readQueryCountSites` / `readQueryCountFiles` —— N2 那一族,复用同一份 sends 判据而不是另写
 *      正则(两处算同一件事必漂移):键为 `count` 且**函数体内没有任何批量写链**(有链而顺序不成立
 *      的那些已经落在 U1 未判定里,不重复计)。
 *   两型各计各的,**混计就等于没有信息**。口径与违规判据同面同轮,所以 U2(词法未闭合)那一份文件
 *   两份都不计 —— 该文件已在"未判定"清单里逐条点名,不会静默少掉。
 *   **锚点边界(不是漏判,是口径,扩面前先读这句)**:V1 只认 `.send(<X>success({ … deleted: true … }))`
 *   这一个形态。同族但形态不同的一律不进这一数 —— ① 裸 `return { deleted: true }`(legacy-ask /
 *   legacy-exam / zhs-legacy / tenant);② `reply.send({ … deleted: true })` 不走 success 信封的
 *   OpenAI 兼容契约(v1-assistants);③ 代码生成器**模板字符串**里的该字样(gen-table,由遮蔽面排除,
 *   与 V1c 同一把锁);④ SCAN_DIRS 之外的落点(如 `apps/api/src/plugins/ws-chat.ts`)。
 *   上一轮人肉量的"257 处"就是这么来的:它按 `grep "deleted: true"` 数整个 `apps/api/src`,
 *   把这四类全算进去了。要并掉①②④必须**同批改枚举表与判据两半**(§4 圆角那条记过只改一半 ⇒
 *   整块动静默失效而门照报绿),并另立键族;不得只放宽正则把一个数做大。
 *
 * 判不了 / 未判定(如实登记,绝不静默成"看起来全绿"):U1 链在 send 之后 ⇒ 顺序不成立,计入未判定
 * 并点名;U2 词法状态到文件末尾没闭合(疑正则字面量吞掉引号)⇒ 整份文件结论不可信 ⇒ 未判定,不冒红;
 * U3 写链在 db 层函数里、计数在路由 handler 里(如 workspace.ts 的 batchSoftDelete)⇒ 本门结构上
 * 看不见 —— 这是窄口径的代价,登记为已知空档,不得为覆盖它去猜跨函数归属。
 *
 * 口径纪律(与 36/70/77/83/93/98/101/103/118 同形):全量档判 **HEAD blob**、`--staged` 判**索引
 * blob**、`--worktree` 只作人工逃生舱、两面旗同给 ⇒ exit 2;清单与内容**同面同轮**;任一面取不到
 * ⇒ exit 2 显式"无法判定"且**不回落**另一个面;枚举到 0 个候选文件 ⇒ 判死,不记为通过。
 * **棘轮锚点 = 该文件 HEAD 自身的违规数** —— 只拦"这次改动把计数自算加回来了",存量不当场判红
 * (与改动无关的恒红门唯一结局是逼人 `--no-verify`,一次绕过等于全部守门作废,§12e)。
 * 取材走 `scripts/lib/face-reader.mjs` 的读取入口(catBatch / readWorktreeFile),枚举走 gitRaw
 * (ls-tree / ls-files 不产正文,不算散写读内容)。ROOT 由脚本自身位置推导(§15),`--root <dir>`
 * 是显式测试通道(换根后清单与内容仍同面,故无双根分裂)。
 *
 * 用法:node scripts/check-batch-write-count-honesty.mjs
 *   [--staged|--worktree] [--strict] [--explain] [--json] [--files a,b] [--root <dir>] [--self-test]
 * 退出码:0 = 通过(或全量档只报数);1 = 判红;2 = 无法判定(不冒红也不记绿)。
 * **V1/V2 两份惯例存量计数不参与任何一档退出码**(含 --strict);--explain 会逐条点名它们的 file:line,
 * --json 在 counts 里追加 booleanAckSites/booleanAckFiles/readQueryCountSites/readQueryCountFiles
 * 四个新字段,既有字段名与取值形态逐字不变。
 * **B1 是判据不是可见性数**,自带一组 `b1*` 键进 counts 与退出码:staged 档走「该文件 HEAD 自身
 * B1 计数」的差值棘轮判红;全量档默认只报数、--strict 判红;--json 既有四个判据数
 * (candidates/violations/undetermined/exempt)的取值**逐字不变**(B1 不并入,只追加)。
 *
 * 本门**已接入提交链**(guardian-runner id 134,blocking,`stagedTriggers=apps/api/src/routes/` +
 * `apps/api/src/db/`):暂存档走「该文件 HEAD 自身 B1/违规计数」的差值棘轮判红。
 * 编号一律以 runner 现值为准,照本行派单前先 `grep -n "check-batch-write-count-honesty" scripts/guardian-runner.mjs`。
 * 应急跳过 HUSKY_SKIP_BATCH_WRITE_COUNT_HONESTY=1。
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitBinary,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..') // ROOT 由脚本自身位置推导(§15,不写死盘符)

export const GATE = 'check-batch-write-count-honesty'
export const SELF_SKIP = 'HUSKY_SKIP_BATCH_WRITE_COUNT_HONESTY'
/** 覆盖面只有这两面(批量写的落点就在这里)。扩面必须同批改"枚举表 + 判据"两半 —— §4 记过同型。 */
export const SCAN_DIRS = ['apps/api/src/routes', 'apps/api/src/db']
export const EXEMPT_TOKEN = 'batch-count-exempt'
/** B1 的行内豁免族(守门 108 FAMILY_LIFETIME_DAYS 取 30 天:待偿的迁移债,不是结构性定性)。 */
export const DELETE_ACK_EXEMPT_TOKEN = 'delete-ack-exempt'
export const UNIQUE_OUTLET = 'utils/batch-outcome'
const WRITE_RECEIVERS = new Set(['db', 'tx', 'trx'])
const COUNT_KEYS = 'deleted|affected|restored|removed|count'
const FILE_RE = /\.(ts|mts|cts)$/
const SKIP_RE = /(^|\/)(?:tests?|__tests__|e2e)\//
const SPEC_RE = /(?:from|require\()\s*['"][^'"]*utils\/batch-outcome(?:\.js)?['"]/
// B1 放过通道 F1:同函数体内出现库确认调用。跑在**遮蔽后的代码面**上,所以注释/字符串里的
// `.returning(` 或 `batchWriteOutcome(` 不配放过(否则一句解释性注释就能给假 ack 发合格证)。
const RETURNING_IN_BODY_RE = /\.\s*returning\s*\(/
const BATCH_OUTCOME_IN_BODY_RE = /\bbatchWriteOutcome\s*\(/

/* ------------------------------- 词法遮噪 ------------------------------- */

/**
 * 剥注释(两档都剥);`blankStrings` 档另把字符串/模板字面量的内容与引号抹成空格。
 * 逐字符保位(换行原样),所以"遮蔽后的下标"仍能映射回原始行号 —— 行内豁免要吃原始行,靠这一点。
 * 为什么这一档要抹字符串:被抹掉的 token(inArray(、deleted: x.length)没有一个会合法地出现在
 * 字符串里;反过来保留字符串,一句 OpenAPI 描述就会替门产出一个"从字符串里 harvest 出来的假用量"
 * (守门 93 R6 正是栽在这一格)。唯一反例是 E2 的模块说明符 —— 它必须在字符串里才读得到。
 * 正则字面量按"值位置才是正则"的启发式跳过:不认它,里面的引号会把整份文件读盲
 * (实测真仓 13 个文件因此失明,判据看不见存量却一路报绿)。
 * @returns {{text:string, leaks:string[]}} leaks 非空 ⇒ 状态机没走干净(见 U2)
 */
export function maskText(src, { blankStrings = true } = {}) {
  const n = src.length
  const kill = new Uint8Array(n)
  const K = (i) => {
    if (blankStrings) kill[i] = 1
  }
  const stack = [{ kind: 'root', depth: 0 }]
  const leaks = []
  let lastSig = '' // 上一个有意义的代码字符:判 `/` 是除法还是正则开头
  let word = ''
  let i = 0
  while (i < n) {
    const top = stack[stack.length - 1]
    const c = src[i]
    const d = src[i + 1]
    if (top.kind === 'tpl') {
      if (c === '\\') {
        K(i)
        K(i + 1)
        i += 2
        continue
      }
      if (c === '`') {
        stack.pop()
        K(i)
        lastSig = '`'
        i++
        continue
      }
      if (c === '$' && d === '{') {
        stack.push({ kind: 'interp', depth: 1 })
        K(i)
        K(i + 1)
        i += 2
        continue
      }
      K(i)
      i++
      continue
    }
    if (c === '/' && d === '/') {
      let j = i
      while (j < n && src[j] !== '\n') kill[j++] = 1
      i = j
      continue
    }
    if (c === '/' && d === '*') {
      let j = i
      while (j < n && !(src[j] === '*' && src[j + 1] === '/')) kill[j++] = 1
      if (j < n) {
        kill[j] = 1
        kill[j + 1] = 1
        i = j + 2
      } else {
        leaks.push('块注释未闭合')
        i = n
      }
      continue
    }
    // 正则字面量按"值位置才是正则"的启发式跳过:不认它,里面的引号会把整份文件读盲
    // (实测真仓 13 个文件因此失明,判据看不见存量却一路报绿)。
    if (c === '/' && regexMayStartHere(lastSig, word)) {
      const end = scanRegexLiteral(src, i)
      if (end > 0) {
        for (let j = i; j < end; j++) K(j)
        lastSig = '/'
        i = end
        continue
      }
    }
    if (c === "'" || c === '"') {
      let j = i + 1
      let closed = false
      while (j < n) {
        if (src[j] === '\\') {
          K(j)
          K(j + 1)
          j += 2
          continue
        }
        if (src[j] === '\n') break
        if (src[j] === c) {
          closed = true
          break
        }
        K(j)
        j++
      }
      if (closed) {
        K(i)
        K(j)
        lastSig = c
        i = j + 1
      } else {
        leaks.push(`第 ${lineAt(src, i)} 行的 ${c} 未闭合(疑正则字面量)`)
        i = j
      }
      continue
    }
    if (c === '`') {
      stack.push({ kind: 'tpl', depth: 0 })
      K(i)
      i++
      continue
    }
    if (top.kind === 'interp') {
      if (c === '{') top.depth++
      else if (c === '}') {
        top.depth--
        if (top.depth === 0) {
          stack.pop()
          K(i)
          i++
          continue
        }
      }
    }
    if (!/\s/.test(c)) {
      lastSig = c
      word = /[\w$]/.test(c) ? (word + c).slice(-12) : ''
    }
    i++
  }
  if (stack.length > 1) leaks.push(`模板/插值嵌套未收平(残留 ${stack.length - 1} 层)`)
  let out = ''
  for (let k = 0; k < n; k++) {
    const ch = src[k]
    out += kill[k] && ch !== '\n' && ch !== '\r' ? ' ' : ch
  }
  return { text: out, leaks }
}

function lineAt(src, idx) {
  let line = 1
  for (let i = 0; i < idx && i < src.length; i++) if (src[i] === '\n') line++
  return line
}

const REGEX_AFTER = new Set([
  '(',
  ',',
  '=',
  ':',
  '[',
  '!',
  '&',
  '|',
  '?',
  '{',
  '}',
  ';',
  '>',
  '<',
  '+',
  '*',
  '%',
  '^',
  '~',
  '',
])
const REGEX_WORDS = new Set([
  'return',
  'typeof',
  'case',
  'in',
  'of',
  'do',
  'else',
  'yield',
  'await',
  'delete',
  'void',
])
function regexMayStartHere(lastSig, word) {
  return REGEX_WORDS.has(word) || lastSig === '' || REGEX_AFTER.has(lastSig)
}

/** 扫一个正则字面量(含字符类里的 `/` 与尾随 flag)。本行没有收尾的 `/` ⇒ 返回 -1,按普通字符走。 */
function scanRegexLiteral(src, i) {
  let j = i + 1
  let inClass = false
  let body = ''
  while (j < src.length) {
    const c = src[j]
    if (c === '\\') {
      body += 'x'
      j += 2
      continue
    }
    if (c === '\n') return -1
    if (inClass) {
      if (c === ']') inClass = false
      body += c
      j++
      continue
    }
    if (c === '[') {
      inClass = true
      body += c
      j++
      continue
    }
    if (c === '/') {
      if (!body) return -1 // 空的 `//` 已在注释分支处理;`a / /` 之类不是正则
      let k = j + 1
      while (k < src.length && /[a-z]/i.test(src[k])) k++
      return k
    }
    body += c
    j++
  }
  return -1
}

/* ------------------------------- 结构扫描 ------------------------------- */

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

/**
 * `db|tx|trx` 发起的 `.delete(` / `.update(` 调用链(逐链走括号,不按行切 —— 跨行写法实测存在)。
 * 接收者白名单是防误伤的第一道:实测 HEAD 面 `*.delete(` 里路由注册(server.delete)387 处、
 * Map/Set 的 .delete 上百处,远多于 `db.delete(` 242 处 —— 不认接收者就等于把路由注册当违规数。
 * 链上必须有 `.where(`(裸 `db.delete(table)` 全表删除不属本型);`opaque` 那支承认自己分不清。
 */
export function findWriteChains(code) {
  const out = []
  const re = /\.(delete|update)\s*\(/g
  let m
  while ((m = re.exec(code)) !== null) {
    const rec = /([A-Za-z_$][\w$]*)\s*$/.exec(code.slice(0, m.index))
    if (!rec || !WRITE_RECEIVERS.has(rec[1])) continue
    const end0 = closeParen(code, code.indexOf('(', m.index))
    if (end0 < 0) continue
    const links = [{ name: m[1], text: code.slice(m.index + m[0].length, end0 - 1) }]
    let cur = end0
    for (;;) {
      const cm = /^\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/.exec(code.slice(cur, cur + 80))
      if (!cm) break
      const open = cur + cm[0].length - 1
      const cend = closeParen(code, open)
      if (cend < 0) break
      links.push({ name: cm[1], text: code.slice(open + 1, cend - 1) })
      cur = cend
    }
    out.push({
      start: m.index,
      end: cur,
      receiver: rec[1],
      names: links.map((l) => l.name),
      hasWhere: links.some((l) => l.name === 'where'),
      hasInArray: links.some((l) => /\binArray\s*\(/.test(l.text)),
      hasReturning: links.some((l) => l.name === 'returning'),
      opaque: links.some((l) => /=>|\bfunction\b/.test(l.text)),
    })
  }
  return out
}

/**
 * 函数体 = `=>` 后紧跟 `{`,或 `function` 头部之后的第一个顶层 `{`。
 * 为什么必须是函数体而不是"任意最小花括号块":取"同时包住链与 send 的最小块"会让兄弟 handler
 * 互相借链(A 里的链替 B 里的 send 定罪)—— 那等于把判据建立在花括号几何上。
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
    while (i < code.length && code[i] !== '{' && code[i] !== ';' && code[i] !== '}') i++
    push(i)
  }
  return bodies
}

function enclosingBody(bodies, idx) {
  let best = null
  for (const b of bodies)
    if (idx >= b.start && idx < b.end && (!best || b.start > best.start)) best = b
  return best
}

const DB_CONFIRMED_RE =
  /\.(?:returning|select|execute|insert|update|delete)\s*\(|\bawait\s+[\w$.]*\bdb\b|dbRead|dbWrite/
const CONTINUE_CHARS = new Set([
  '.',
  ',',
  '+',
  '-',
  '*',
  '/',
  '%',
  '&',
  '|',
  '^',
  '?',
  ':',
  ')',
  '}',
  ']',
  '=',
  '<',
  '>',
  '`',
])
const NOT_IDENT = new Set([
  'const',
  'let',
  'var',
  'await',
  'async',
  'return',
  'if',
  'else',
  'for',
  'of',
  'in',
  'new',
  'map',
  'filter',
  'from',
  'where',
  'and',
  'or',
  'eq',
  'inArray',
  'set',
  'then',
  'length',
  'ids',
  'String',
  'Number',
  'Boolean',
  'Array',
  'Object',
  'JSON',
  'Math',
  'Date',
  'size',
  'join',
  'split',
  'includes',
  'some',
  'every',
  'push',
])

/** 语句结尾:深度 0 处的 `;`,或深度 0 处换行且下一行不是续行。 */
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

function initializersOf(code, span, name) {
  const re = new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=`, 'g')
  const out = []
  let m
  while ((m = re.exec(code)) !== null) {
    if (m.index < span.start || m.index >= span.end) continue
    const eq = m.index + m[0].length - 1
    out.push(code.slice(eq + 1, statementEnd(code, eq + 1, span.end)))
  }
  return out
}

/** E1b:计数根标识符是否可追到库确认的集合(≤2 跳)。查不到声明 ⇒ 不放过(参数/请求侧解构都是这种)。 */
function resolveConfirmed(code, span, name, depth) {
  if (depth > 2) return false
  for (const rhs of initializersOf(code, span, name)) {
    if (rhs.length > 4000) continue
    if (DB_CONFIRMED_RE.test(rhs)) return true
    if (depth >= 2) continue
    for (const mm of rhs.matchAll(/[A-Za-z_$][\w$]*/g)) {
      if (!NOT_IDENT.has(mm[0]) && resolveConfirmed(code, span, mm[0], depth + 1)) return true
    }
  }
  return false
}

/** `.send(<X>success({ … }))` 的对象字面量 —— 违规判据与两份惯例计数**共用这一遍取材**。
 *  为什么必须共用:两处各扫一遍 send 形态,一处改了另一处不会跟着改,惯例数就会和违规数说不同的话
 *  (本仓"两处算同一件事必须共用一份实现"记过多次)。 */
function* sendSuccessObjects(code) {
  const sendRe = /\.\s*send\s*\(\s*\w*[Ss]uccess\s*\(\s*\{/g
  let m
  while ((m = sendRe.exec(code)) !== null) {
    const objOpen = code.indexOf('{', m.index + m[0].length - 1)
    const objEnd = closeBrace(code, objOpen)
    if (objEnd < 0) continue
    yield { objOpen, objText: code.slice(objOpen, objEnd) }
  }
}

/** `.send(<X>success({ … deleted: true … }))` 的**布尔 ack** 落点(V1,只报数不判红)。
 *  窄到形态才算:键逐字 `deleted`(故 `isDeleted:` / `deleted_count:` 不纳)、值逐字 `true`
 *  (故 `deleted: affected` / `rows.length` 不纳 —— 那一型归违规判据)、值后必须紧跟 `,` 或 `}`
 *  (故 `deleted: true ? a : b` / `deleted: trueOrFalse` 不纳)。键族刻意只有 `deleted`:
 *  `restored: true` 是另一种语义(可撤销的软删),混进来就等于把两型合成一个没有信息的数。 */
const BOOL_ACK_RE = /[{,]\s*deleted\s*:\s*true\s*(?=[,}])/g
export function findBooleanAckSends(code) {
  const out = []
  for (const { objOpen, objText } of sendSuccessObjects(code)) {
    BOOL_ACK_RE.lastIndex = 0
    let k
    while ((k = BOOL_ACK_RE.exec(objText)) !== null)
      out.push({
        index: objOpen + k.index + k[0].indexOf('deleted'),
        key: 'deleted',
        value: 'true',
      })
  }
  return out
}

/**
 * B1(2026-09-27):布尔 ack 中**可判的那一子集** —— 同一函数体内有 `db|tx|trx` 的 `.delete(`/`.update(`
 * 写链、且体内无库确认(`.returning(` / `batchWriteOutcome(`)、且命中行无带原因豁免 ⇒ 假 ack 违规。
 *
 * 三条设计决定,每条都有用例钉住(改任何一条前先读它的反例):
 *  ① **落点取材与 V1 共用 `findBooleanAckSends`**(同一处 `sendSuccessObjects` 扫描,扫描式在源码里
 *    只许出现一次 —— M13 的单点锁同时管住这一族)—— 两处各扫
 *    一遍 send 形态,一处改了另一处不跟着改,惯例数和判据数就会说不同的话(§"两处算同一件事"教训);
 *    也因此 B1 结构上只会看见**响应对象面**里的 `deleted: true`,select 映射 / 类型注解 / 注释 /
 *    字符串里的同字样不进面(判据不退化成整行 grep)。
 *  ② **函数体而不是"最小花括号块"**(沿用 findFunctionBodies 的理由):取最小块会让兄弟 handler
 *    互相借链 —— A 里的 delete 替 B 里的 ack 定罪/发合格证,判据就建立在花括号几何上了。
 *  ③ **写链不要求 inArray/.where**:计数判据问"affected 怎么算的",B1 只问"这一屏是否真发了写并
 *    无条件回已删";opaque 链(混进函数字面量、U0 那一型)在这里**照算写链** —— 接收者是 db|tx|trx、
 *    动词是 delete/update 这一点不受参数里有什么影响,分不清的是命中数而不是"有没有写"。
 * 找不到所属函数体的布尔 ack 记 `noBodySites`(不判红也不记绿 —— 静默跳过就是这一族门最常犯的假绿)。
 */
export function findBoolAckB1Sites(relPath, code, rawLines, allChains = null, ackSites = null) {
  const bodies = findFunctionBodies(code)
  const chains = allChains || findWriteChains(code)
  const out = {
    file: relPath,
    candidates: [],
    violations: [],
    exempt: { confirmed: 0, marker: 0 },
    bareExempt: 0,
    noBodySites: [],
  }
  for (const b of ackSites || findBooleanAckSends(code)) {
    const line = lineAt(code, b.index)
    const body = enclosingBody(bodies, b.index)
    if (!body) {
      out.noBodySites.push({ file: relPath, line })
      continue
    }
    const chain = chains.find((c) => c.start >= body.start && c.end <= body.end)
    if (!chain) continue // 同函数体无写链:纯惯例面(V1 已计),B1 不判
    const site = { file: relPath, line, receiver: chain.receiver }
    out.candidates.push(site)
    const bodyText = code.slice(body.start, body.end)
    if (RETURNING_IN_BODY_RE.test(bodyText) || BATCH_OUTCOME_IN_BODY_RE.test(bodyText)) {
      site.disposition = 'db-confirmed'
      out.exempt.confirmed++
      continue
    }
    // F2 只命中本行生效(刻意比 batch-count-exempt 的"本行或紧邻上一行"严一档,见头注 F2)。
    const mk = readExemptMarker(rawLines[line - 1] || '', DELETE_ACK_EXEMPT_TOKEN)
    if (mk.state === 'ok') {
      site.disposition = 'marker'
      out.exempt.marker++
      continue
    }
    if (mk.state === 'bare') out.bareExempt++
    site.disposition = 'violation'
    out.violations.push(site)
  }
  return out
}

/** `.send(<X>success({ … <key>: <点号链>.length … }))` 的每一处落点。 */
export function findCountSends(code) {
  const value = String.raw`[A-Za-z_$][\w$]*(?:\s*(?:\?\.|\.\s*[A-Za-z_$][\w$]*|\[[^\]]*\]|\([^)]*\)))*\s*(?:\?\.|\.)\s*length\b`
  const keyRe = new RegExp(`\\b(${COUNT_KEYS})\\s*:\\s*(${value})`, 'g')
  const out = []
  for (const { objOpen, objText } of sendSuccessObjects(code)) {
    keyRe.lastIndex = 0
    let k
    while ((k = keyRe.exec(objText)) !== null) {
      const nxt = /^\s*(.)/.exec(objText.slice(k.index + k[0].length))
      // `deleted: ids.length > 0` / `… .length + 1` 是布尔或算式,不是自算计数(N1 那一族)。
      if (nxt && nxt[1] && /[<>!=+*/%&|?-]/.test(nxt[1])) continue
      out.push({ index: objOpen + k.index, key: k[1], expr: k[2].replace(/\s+/g, '') })
    }
  }
  return out
}

/**
 * 行内豁免 `<token>: <原因>`(两条通道共用这一份实现 —— 各写一份"须带原因"的判法必然漂移):
 * `batch-count-exempt`(计数判据,本行或紧邻上一行)与 `delete-ack-exempt`(B1,只本行,调用方决定)。
 * 两件事各堵一个洞 —— 原因由注释闭合符冒充(先剥尾随闭合符与前导星号再判空,门 102 的 GA1
 * 就漏在这一格);把标记写进字符串冒充(判"标记之前是否有注释起始符")。
 * @returns {{state:'none'|'ok'|'bare', reason:string}}
 */
export function readExemptMarker(rawLine, token = EXEMPT_TOKEN) {
  const at = rawLine.indexOf(`${token}:`)
  const idx = at >= 0 ? at : rawLine.indexOf(`${token} :`)
  if (idx < 0) return { state: 'none', reason: '' }
  const head = rawLine.slice(0, idx)
  if (!/(?:^|[^\S\n])(?:\/\/|\/\*|\*)/.test(head)) return { state: 'none', reason: '' }
  const rest = rawLine
    .slice(idx + token.length + 1)
    .replace(/\*\/\s*$/, '')
    .replace(/^[:*\s]+/, '')
    .trim()
  return rest ? { state: 'ok', reason: rest } : { state: 'bare', reason: '' }
}

/* ------------------------- B2:一跳委托的删除 ack ------------------------- */

/** 被调文件的解析域:只有 apps/api/src 之内的模块算"本仓一跳"(实测量够、也能按同一面取到)。 */
export const API_SRC_DIR = 'apps/api/src'
/** apps/api/tsconfig.json 的 compilerOptions.paths 实测声明 `"@/*": ["./src/*"]`。
 *  HEAD 面 `apps/api/src` 内 `from '@/'` 用量 0 处 —— 认它不是为了数现在的东西,而是为了让
 *  "下一次有人改用别名"不被读成"解析不到";解析表只这一条别名,不臆造第二条。 */
const ALIAS_AT = '@/'
const TS_EXT_LIST = ['.ts', '.mts', '.cts']
const JS_TO_TS = { '.js': '.ts', '.mjs': '.mts', '.cjs': '.cts' }

function posixDirname(p) {
  const i = p.lastIndexOf('/')
  if (i < 0) return ''
  const d = p.slice(0, i)
  return d === '' ? '.' : d
}

/** 只按 `/` 走(git 给的路径恒是正斜杠);不引 node:path,免得 Windows 反斜杠把清单里的路径改弯。 */
function posixJoin(base, rel) {
  const segs = (base === '' || base === '.' ? [] : base.split('/')).concat(rel.split('/'))
  const out = []
  for (const s of segs) {
    if (s === '' || s === '.') continue
    if (s === '..') out.pop()
    else out.push(s)
  }
  return out.join('/')
}

/**
 * import 说明符 → 候选模块路径(相对 / `@/` 别名 / `.js`→`.ts` / 目录 index)。
 * 返回 `{outside:true}` = 裸包名(fastify、zod、@ihui/database、node:*)⇒ 被调函数在 apps/api/src
 * 之外,按 N1 落未判定;返回 `{candidates:[…]}` = 交给所判面的文件清单去验(解析不到同样落 N1)。
 */
export function moduleSpecCandidates(spec, fromFile) {
  const clean = String(spec).trim().replace(/\\/g, '/')
  if (!clean) return { outside: true }
  let base = null
  if (clean.startsWith(ALIAS_AT)) base = `${API_SRC_DIR}/${clean.slice(ALIAS_AT.length)}`
  else if (clean === '.' || clean === '..' || clean.startsWith('./') || clean.startsWith('../'))
    base = posixJoin(posixDirname(fromFile), clean)
  else return { outside: true }
  if (base !== API_SRC_DIR && !base.startsWith(`${API_SRC_DIR}/`)) return { outside: true }
  const m = /\.([A-Za-z0-9]+)$/.exec(base)
  const mapped = m ? JS_TO_TS[`.${m[1]}`] : undefined
  const alreadyTs = m ? TS_EXT_LIST.includes(`.${m[1]}`) : false
  // 把"扩展名替换"落成"去掉旧扩展名再逐个试 TS 三扩展":mapped 是**扩展名本身**,不是整路径
  // (第一版直接把它当 stem 用,候选就成了 `.ts.ts` 这种谁也找不到的东西 ⇒ 整族未判定)。
  const stem = m && (mapped || alreadyTs) ? base.slice(0, m.index) : base
  const out = []
  for (const e of TS_EXT_LIST) {
    out.push(stem + e)
    out.push(`${stem}/index${e}`)
  }
  // 末尾那段既不是 js 族也不是 ts 族(.json / .node / 无扩展名歧义)⇒ 原样也试一次,
  // 落在"面里有但不是可解析 TS 模块"那一档,而不是悄悄猜成 .ts。
  if (m && !mapped && !alreadyTs) out.push(base)
  return { candidates: out }
}

/** 在**同一面**的文件清单里挑第一个命中的候选;都不在 ⇒ 未判定(unresolved-spec)。 */
function resolveModuleSpec(spec, fromFile, knownPaths) {
  const r = moduleSpecCandidates(spec, fromFile)
  if (r.outside) return { kind: 'outside-src' }
  for (const c of r.candidates) {
    if (!knownPaths || !knownPaths.has(c)) continue
    return TS_EXT_LIST.some((e) => c.endsWith(e)) ? { path: c } : { kind: 'non-ts-module' }
  }
  return { kind: 'unresolved-spec' }
}

/**
 * import/export ... from '…' 的具名绑定表。跑在**保留字符串**那一档(模块说明符只活在那里,
 * 与 E2 同一条教训:连字符串一起抹会直接失明),但**起始位必须同时在遮蔽后的代码面上** ——
 * 否则一段模板字符串里的 "import x from 'y'" 就能凭空造出一条委托边。
 * 只收具名绑定:`import * as ns` 记进 namespaces(N1 未判定),default / type-only 一律不认作可调用边。
 */
const IMPORT_FROM_RE = /\b(?:import|export)\s+([\s\S]*?)\bfrom\s*['"]([^'"]*)['"]/g
export function parseImportBindings(nonBlankText, blankText) {
  const named = new Map()
  const namespaces = new Set()
  let m
  IMPORT_FROM_RE.lastIndex = 0
  while ((m = IMPORT_FROM_RE.exec(nonBlankText)) !== null) {
    if (blankText[m.index] !== nonBlankText[m.index]) continue // 起始位落在字符串/注释里 ⇒ 不是语句
    const clause = m[1]
    const spec = m[2]
    if (/^\s*type\b/.test(clause)) continue
    const rest = clause
      .replace(/\{[\s\S]*\}/, '')
      .replace(/\s+/g, ' ')
      .trim()
    const ns = /\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(rest)
    if (ns) namespaces.add(ns[1])
    const brace = /\{([\s\S]*)\}/.exec(clause)
    if (!brace) continue
    for (const part of brace[1].split(',')) {
      const t = part.trim()
      if (!t || /^type\b/.test(t)) continue
      const mm = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(t)
      if (!mm) continue
      if (!named.has(mm[2] || mm[1]))
        named.set(mm[2] || mm[1], { exported: mm[1], specifier: spec })
    }
  }
  return { named, namespaces }
}

/** 体内 `await foo(...)` / `await ns.foo(...)` 的被调表达式(不含 `await db.delete()` 那种链)。 */
const AWAIT_CALL_RE = /\bawait\s+([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*)\s*(?:[<(]|as\s)/g

/**
 * 被调文件的导出索引(跑在遮蔽后的代码面上:注释里的 `// export async function del()` 不得算导出)。
 *  byName        函数形态的具名导出 → { bodyText }
 *  starReexport  文件里有 `export * from …`  ⇒ 名单不可枚举 ⇒ N1 未判定
 *  reexportNames `export { A } from …` 的再导出名(同样不当作"本体的函数体")
 */
export function indexExportedFns(code) {
  const byName = new Map()
  const reexportNames = new Set()
  let starReexport = false
  let m
  const fnRe = /\bexport\s+(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g
  while ((m = fnRe.exec(code)) !== null) {
    const open = code.indexOf('(', m.index + m[0].length - 1)
    const close = open >= 0 ? closeParen(code, open) : -1
    if (close < 0) continue
    let i = close
    while (i < code.length && code[i] !== '{' && code[i] !== ';' && code[i] !== ')') i++
    const end = closeBrace(code, i)
    if (end > 0 && !byName.has(m[1])) byName.set(m[1], { bodyText: code.slice(i, end) })
  }
  const varRe = /\bexport\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*/g
  while ((m = varRe.exec(code)) !== null) {
    if (byName.has(m[1])) continue
    const from = m.index + m[0].length
    const slice = code.slice(from, from + 400)
    const block = /^(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/.exec(slice)
    if (block) {
      const bi = from + block[0].length - 1
      const end = closeBrace(code, bi)
      if (end > 0) {
        byName.set(m[1], { bodyText: code.slice(bi, end) })
        continue
      }
    }
    const expr = /^(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/.exec(slice)
    if (expr) {
      const s0 = from + expr[0].length
      byName.set(m[1], { bodyText: code.slice(s0, statementEnd(code, s0, code.length)) })
      continue
    }
    const kf = /^function\b/.exec(slice)
    if (kf) {
      let i = from + kf[0].length
      while (i < code.length && code[i] !== '{') i++
      const end = closeBrace(code, i)
      if (end > 0) byName.set(m[1], { bodyText: code.slice(i, end) })
    }
  }
  const namedRe = /\bexport\s*\{([\s\S]*?)\}\s*from/g
  while ((m = namedRe.exec(code)) !== null)
    for (const p of m[1].split(',')) {
      const t = p.trim().replace(/^type\s+/, '')
      const mm = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(t)
      if (mm) reexportNames.add(mm[2] || mm[1])
    }
  if (/\bexport\s*\*\s*(?:as\s+[A-Za-z_$][\w$]*\s*)?from/g.test(code)) starReexport = true
  return { byName, reexportNames, starReexport }
}

/** 被调函数体的定性:有没有"带 where 而无 returning、也无唯一出口"的那一条写链。 */
function classifyCalleeBody(bodyText) {
  if (BATCH_OUTCOME_IN_BODY_RE.test(bodyText))
    return { state: 'confirmed', why: 'batchWriteOutcome' }
  const chains = findWriteChains(bodyText).filter((c) => c.hasWhere)
  if (!chains.length) return { state: 'no-write' }
  if (chains.some((c) => !c.hasReturning && !c.opaque)) return { state: 'violation' }
  if (chains.every((c) => c.opaque)) return { state: 'undetermined', kind: 'opaque-callee-chain' }
  return { state: 'confirmed', why: 'returning' }
}

/**
 * B2 的第一遍:纯本地信息(调用方正文 + 同面文件清单)⇒ 每个待判 ack 记下"要读哪个被调文件"。
 * 刻意不调 git —— 自检可以只给一张 knownPaths 与一份被调正文就跑完整条判据(判据只此一份实现)。
 */
export function planDelegatedAckSites(
  relPath,
  code,
  rawLines,
  ackSites,
  allChains,
  imports,
  knownPaths,
) {
  const bodies = findFunctionBodies(code)
  const sites = []
  const needs = []
  for (const b of ackSites) {
    const body = enclosingBody(bodies, b.index)
    if (!body) continue // 解析不出函数体那一格归 B1 的 noBodySites,两道判据不重复计同一处
    if (allChains.some((c) => c.start >= body.start && c.end <= body.end)) continue // 归 B1
    const bodyText = code.slice(body.start, body.end)
    const line = lineAt(code, b.index)
    const site = {
      file: relPath,
      line,
      needs: [],
      undetermined: [],
      marker: readExemptMarker(rawLines[line - 1] || '', DELETE_ACK_EXEMPT_TOKEN),
    }
    AWAIT_CALL_RE.lastIndex = 0
    let m
    while ((m = AWAIT_CALL_RE.exec(bodyText)) !== null) {
      const parts = m[1].split(/\s*\.\s*/)
      const base = parts[0]
      if (parts.length > 1) {
        // `await ns.del()`:命名空间转发 ⇒ 具名导出边判不出(N1),但**不**因此放过整处
        if (imports.namespaces.has(base))
          site.undetermined.push({ kind: 'namespace-forward', name: m[1] })
        continue
      }
      const binding = imports.named.get(base)
      if (!binding) continue // 本地 helper / 全局函数:不是"经 import 解析到仓内文件"那一跳
      const r = resolveModuleSpec(binding.specifier, relPath, knownPaths)
      if (!r.path) {
        site.undetermined.push({ kind: r.kind, name: base, specifier: binding.specifier })
        continue
      }
      site.needs.push({ path: r.path, name: binding.exported, local: base })
      needs.push({ path: r.path })
    }
    // N3:既没有可判的一跳、也没有解析不到的形态 ⇒ 不入 B2 的账(V1 已逐条点名这一处)
    if (!site.needs.length && !site.undetermined.length) continue
    sites.push(site)
  }
  return { sites, needs }
}

/**
 * B2 的第二遍:用**同面**取到的被调正文落结论。
 *  任一被调体真发了无 returning 的写链 ⇒ 违规(标记只救"已判违规"那一处,与 B1 同序);
 *  全部被调体都是 no-write/confirmed ⇒ 放过;
 *  没有违规而有任一解析不出 ⇒ 未判定(不记为通过,也不冒红)。
 */
export function finishDelegatedAckSite(site, calleeIndex) {
  const states = []
  for (const n of site.needs) {
    const idx = calleeIndex && calleeIndex.get ? calleeIndex.get(n.path) : null
    if (!idx) {
      states.push({
        state: 'undetermined',
        kind: 'callee-face-missing',
        name: n.local,
        file: n.path,
      })
      continue
    }
    const fn = idx.byName.get(n.name)
    if (!fn) {
      states.push({
        state: 'undetermined',
        kind:
          idx.starReexport || idx.reexportNames.has(n.name) ? 'reexport' : 'callee-not-exported',
        name: n.local,
        file: n.path,
      })
      continue
    }
    const c = classifyCalleeBody(fn.bodyText)
    states.push({ ...c, name: n.local, file: n.path })
  }
  const undet = site.undetermined.concat(states.filter((s) => s.state === 'undetermined'))
  const violation = states.find((s) => s.state === 'violation')
  const confirmed = states.find((s) => s.state === 'confirmed')
  const out = {
    file: site.file,
    line: site.line,
    states,
    undetermined: undet,
    disposition: 'none',
  }
  if (violation) {
    if (site.marker.state === 'ok') out.disposition = 'marker'
    else out.disposition = 'violation'
    out.callee = { file: violation.file, name: violation.name }
  } else if (confirmed) {
    out.disposition = 'db-confirmed'
    out.callee = { file: confirmed.file, name: confirmed.name, why: confirmed.why }
  } else if (undet.length) out.disposition = 'undetermined'
  else out.disposition = 'no-write'
  out.bareExempt = violation && site.marker.state === 'bare' ? 1 : 0
  return out
}

/** 空壳:B2 自己的五个键(与 B1 同形,既有的 candidates/violations/undetermined/exempt 一字不并入)。 */
function emptyB2() {
  return {
    sites: [],
    candidates: [],
    violations: [],
    undetermined: [],
    exempt: { confirmed: 0, marker: 0 },
    bareExempt: 0,
    needs: [],
  }
}

/** 把 planDelegatedAckSites 的落点跑成结论并写进 res.b2(自检与 analyze 共用这一份归集实现)。 */
export function aggregateB2(res, judged) {
  for (const j of judged) {
    if (j.disposition === 'none') continue
    res.b2.candidates.push(j)
    if (j.disposition === 'violation') res.b2.violations.push(j)
    else if (j.disposition === 'db-confirmed') res.b2.exempt.confirmed++
    else if (j.disposition === 'marker') res.b2.exempt.marker++
    else if (j.disposition === 'undetermined') res.b2.undetermined.push(j)
    res.b2.bareExempt += j.bareExempt || 0
  }
  return res
}

/* ------------------------------- 单文件判据 ------------------------------- */

/** 纯函数:一份文件正文 → 候选与处置。自检与端到面都跑它(判据只此一份实现)。 */
export function scanFileText(relPath, text, opts = {}) {
  const masked = maskText(text, { blankStrings: true })
  const code = masked.text
  const rawLines = text.split(/\r?\n/)
  const bodies = findFunctionBodies(code)
  const batchChains = findWriteChains(code).filter((c) => c.hasWhere && c.hasInArray && !c.opaque)
  const sends = findCountSends(code)
  const usesOutlet = SPEC_RE.test(maskText(text, { blankStrings: false }).text)
  const res = {
    file: relPath,
    candidates: [],
    violations: [],
    exempt: { returning: 0, db: 0, outlet: 0, marker: 0 },
    undetermined: [],
    bareExempt: 0,
    leaks: masked.leaks,
    usesOutlet,
    batchChains: batchChains.length,
    // 两份"惯例存量"落点(可见性,不进 decide、不进四个判据数)。U2 那份文件在此提前 return  ⇒ 两份都不计,
    // 而该文件已在 undetermined 清单里点名 —— 少掉的数有对应的名字,不是静默少掉。
    booleanAck: [],
    readQuery: [],
    // B1(判据,自带 b1* 键;既有四数 candidates/violations/undetermined/exempt 一字不并入)。
    b1: {
      candidates: [],
      violations: [],
      exempt: { confirmed: 0, marker: 0 },
      bareExempt: 0,
      noBodySites: [],
    },
    // B2 必须在**建壳那一刻**就在位:U2 那一支在下面提前 return,漏了这行就会让 analyze 读到
    // undefined.needs —— 一份"别人写坏的词法"把整道门换成 exit 2,而 exit 2 看起来像"无法判定",
    // 实际是本门自己崩了。
    b2: emptyB2(),
  }
  if (res.leaks.length) {
    res.undetermined.push({
      file: relPath,
      line: 0,
      why: `词法状态未闭合(${res.leaks[0]}${res.leaks.length > 1 ? ` 等 ${res.leaks.length} 处` : ''})⇒ 整文件不判(U2)`,
    })
    return res
  }
  for (const s of sends) {
    const line = lineAt(code, s.index)
    const body = enclosingBody(bodies, s.index)
    const scope = body ? batchChains.filter((c) => c.start >= body.start && c.end <= body.end) : []
    const before = scope.filter((c) => c.end <= s.index)
    if (!before.length) {
      if (scope.length)
        res.undetermined.push({
          file: relPath,
          line,
          why: `${s.key}: ${s.expr} 在同函数体内只有其后的 inArray 批量写链 ⇒ 顺序不成立,不判红也不记绿(U1)`,
        })
      // V2:函数体内**完全没有**批量写链且键为 count ⇒ N2 读查询计数那一族(只报数)。
      // 刻意不在 U1 那一支计:那处已经作为"未判定"点名过,再计一次就是把同一格算进两个惯例族。
      else if (s.key === 'count')
        res.readQuery.push({ file: relPath, line, key: s.key, expr: s.expr })
      continue // 函数体内没有批量写链:读查询/布尔确认(N1/N2),不入面
    }
    const chain = before[before.length - 1]
    const site = { file: relPath, line, key: s.key, expr: s.expr, receiver: chain.receiver }
    res.candidates.push(site)
    const mk = readExemptMarker(rawLines[line - 1] || '')
    const prev = line >= 2 ? readExemptMarker(rawLines[line - 2] || '') : { state: 'none' }
    const marked = mk.state === 'ok' || prev.state === 'ok'
    if (mk.state === 'bare' || prev.state === 'bare') res.bareExempt++
    const root = /^([A-Za-z_$][\w$]*)/.exec(s.expr)?.[1] || ''
    const dbDerived = !!root && resolveConfirmed(code, body, root, 0)
    // 四条放过通道按" cheapest 且最能说明意图"排序;每支各有反面对照(见 selfTest 的 P1b/P2)。
    const kind = usesOutlet
      ? 'outlet'
      : marked
        ? 'marker'
        : chain.hasReturning
          ? 'returning'
          : dbDerived
            ? 'db'
            : 'violation'
    if (kind === 'violation') {
      site.disposition = 'violation'
      res.violations.push(site)
    } else {
      site.disposition = {
        outlet: 'outlet',
        marker: 'marker',
        returning: 'returning',
        db: 'db-confirmed',
      }[kind]
      res.exempt[kind]++
    }
  }
  // V1:布尔 ack 惯例落点(DELETE 幂等确认)。与违规判据同面同轮、同一份遮蔽后的代码面,
  // 所以注释/字符串里的 `deleted: true` 不计数(N3 那一型),而跨行对象字面量数得到。
  // B1 从**这一份落点清单**里派生(findBoolAckSends 只调一次)—— 惯例面与判据面若各扫一遍,
  // 一处改了另一处不会跟着改,V1 的数就会与 B1 的子集对不上账(M13 同源的一条锁)。
  const boolSites = findBooleanAckSends(code)
  res.booleanAck = boolSites.map((b) => ({
    file: relPath,
    line: lineAt(code, b.index),
    key: b.key,
    value: b.value,
  }))
  const allChains = findWriteChains(code)
  res.b1 = findBoolAckB1Sites(relPath, code, rawLines, allChains, boolSites)
  // B2(一跳委托):第一遍只用**本地**信息(调用方正文 + 同面文件清单)得出"要读哪些被调文件";
  // 被调正文由 analyze 在同一面一次读满后再跑第二遍。acks 与 B1 共用**同一份** boolSites —— 两处
  // 各扫一遍 send 形态必然漂移(M16 那把锁的同族)。
  res.b2 = emptyB2()
  if (!res.leaks.length) {
    const imports = parseImportBindings(
      maskText(text, { blankStrings: false }).text,
      code, // 遮蔽后的代码面:起始位不在这一面上就说明那条 import 活在字符串/注释里
    )
    const plan = planDelegatedAckSites(
      relPath,
      code,
      rawLines,
      boolSites,
      allChains,
      imports,
      opts.knownPaths,
    )
    res.b2.sites = plan.sites
    res.b2.needs = plan.needs
    // 自检/夹具走这一档:被调正文由调用方直接给,不必派生 git(判据仍是同一份实现)。
    if (opts.calleeIndex)
      aggregateB2(
        res,
        plan.sites.map((s) => finishDelegatedAckSite(s, opts.calleeIndex)),
      )
  }
  for (const c of allChains.filter((x) => x.opaque))
    res.undetermined.push({
      file: relPath,
      line: lineAt(code, c.start),
      why: `${c.receiver}.${c.names.join('.')} 链里混进函数字面量 ⇒ 分不清批量写还是路由注册,不计入本门(U0)`,
    })
  return res
}

/* ------------------------------ 取材(同面同轮) ------------------------------ */

export function listCandidates(root, face) {
  const out =
    face === 'head'
      ? gitRaw(['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', ...SCAN_DIRS], root)
      : gitRaw(['ls-files', '-z', '--', ...SCAN_DIRS], root)
  return String(out)
    .split('\0')
    .filter(Boolean)
    .filter((p) => FILE_RE.test(p) && !SKIP_RE.test(p))
}

/** 一次 `cat-file --batch` 把同一面全部候选读满(清单与内容同面同轮;取不到即抛,不回落)。 */
export function readCandidates(root, face, paths) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) {
      const t = readWorktreeFile(root, p)
      if (t === null || t === undefined) throw new Undetermined(`工作树(逃生舱)取不到 ${p}`)
      map.set(p, t)
    }
    return map
  }
  const specs = paths.map((p) => (face === 'staged' ? ':' : 'HEAD:') + p)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: 180000 })
  paths.forEach((p, k) => {
    const t = got.get(specs[k])
    if (t === null || t === undefined)
      throw new Undetermined(
        `${face === 'staged' ? '索引' : 'HEAD'} 取不到 ${p} ⇒ 不回落另一个面(回落就是把"没判"写成"判过了")`,
      )
    map.set(p, t)
  })
  return map
}

/**
 * 同一面的 `apps/api/src` 文件全集(B2 解析 import 说明符用)。
 * 枚举走 gitRaw(ls-tree / ls-files **不产正文**,不算散写读内容 —— 与 listCandidates 同一条口径),
 * 且刻意按**所判的那一面**取:清单来自磁盘 + 内容来自 HEAD 就是自洽却错位的尺子(门 118 那一型)。
 * --worktree 是人工逃生舱档:路径清单仍取跟踪面,面里没有的被调文件按"未判定"点名而不是猜。
 */
export function listFacePaths(root, face) {
  const out =
    face === 'head'
      ? gitRaw(['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', API_SRC_DIR], root)
      : gitRaw(['ls-files', '-z', '--', API_SRC_DIR], root)
  return new Set(String(out).split('\0').filter(Boolean))
}

/**
 * 被调文件的正文:与调用方**同面**,但取不到**不判死**。
 * 这个不对称是刻意的:调用方文件取不到 = 本门没法审它 ⇒ exit 2;被调文件取不到 = 本门承认看不见
 * 这一跳(N1 未判定),不能让"别人那半个还没 add 的文件"把整道门判死(恒红门同罪)。
 */
export function readCalleeTexts(root, face, paths) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) {
      const t = readWorktreeFile(root, p)
      if (typeof t === 'string') map.set(p, t)
    }
    return map
  }
  const specs = paths.map((p) => (face === 'staged' ? ':' : 'HEAD:') + p)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: 180000 })
  paths.forEach((p, k) => {
    const t = got.get(specs[k])
    if (typeof t === 'string') map.set(p, t)
  })
  return map
}

/**
 * 一整个面的跑法:候选正文 → 逐文件判据 → B2 第二遍用**同一面**的被调正文落结论。
 * 自检与 analyze 都走它 ⇒ "同面同轮"这件事只有一处实现,不会一处做到了另一处漏掉。
 */
export function scanFaceBundle(root, face, paths, texts, knownPaths) {
  const per = paths.map((p) => scanFileText(p, texts.get(p), { knownPaths }))
  const needs = new Set()
  for (const r of per) for (const n of r.b2.needs) needs.add(n.path)
  const idx = new Map()
  // needs 为空**不等于**没有 B2 要判:一整批"那一跳解析不到"的落点就是 needs 为空、sites 非空,
  // 早退会把它们静默吞成 0 条(第一版就是这么把 25 处未判定读成 0 的 —— 判据失效的表现永远是安静)。
  if (needs.size) {
    const calleeTexts = readCalleeTexts(root, face, [...needs])
    for (const [p, t] of calleeTexts) idx.set(p, indexExportedFns(maskText(t).text))
  }
  for (const r of per) {
    if (!r.b2.sites.length) continue
    aggregateB2(
      r,
      r.b2.sites.map((s) => finishDelegatedAckSite(s, idx)),
    )
  }
  return per
}

export function analyze(root, face, opts = {}) {
  assertRepoRoot(root, GATE)
  const paths = listCandidates(root, face)
  if (paths.length === 0)
    throw new Undetermined(
      `${face} 面在 ${SCAN_DIRS.join(' / ')} 下枚举到 0 个候选源文件 —— 判据失效,不计通过`,
    )
  const texts = readCandidates(root, face, paths)
  const only = opts.onlyFiles && opts.onlyFiles.length ? new Set(opts.onlyFiles) : null
  const scanned = only ? paths.filter((p) => only.has(p)) : paths
  if (only && scanned.length === 0)
    throw new Undetermined(
      `--files 指定的路径没有一个落在本门覆盖面(${SCAN_DIRS.join(' / ')} · ${face} 面)⇒ 判据失效,不计通过`,
    )
  const per = scanFaceBundle(root, face, scanned, texts, listFacePaths(root, face))
  const violations = per.flatMap((r) => r.violations)
  const undetermined = per.flatMap((r) => r.undetermined)
  const b1Violations = per.flatMap((r) => r.b1.violations)
  const b1NoBody = per.reduce((a, r) => a + r.b1.noBodySites.length, 0)
  const b2Violations = per.flatMap((r) => r.b2.violations)
  const b2Undetermined = per.flatMap((r) => r.b2.undetermined)
  const exempt = ['returning', 'db', 'outlet', 'marker'].reduce(
    (a, k) => ({ ...a, [k]: per.reduce((x, r) => x + r.exempt[k], 0) }),
    {},
  )
  const counts = {
    files: scanned.length,
    enumerated: paths.length,
    candidates: per.reduce((a, r) => a + r.candidates.length, 0),
    violations: violations.length,
    undetermined: undetermined.length,
    exempt: exempt.returning + exempt.db + exempt.outlet + exempt.marker,
    bareExempt: per.reduce((a, r) => a + r.bareExempt, 0),
    // 两份惯例存量:可见性字段,**不参与 decide**。刻意各计各的 —— 混计成一个数就等于没有信息。
    booleanAckSites: per.reduce((a, r) => a + r.booleanAck.length, 0),
    booleanAckFiles: per.filter((r) => r.booleanAck.length > 0).length,
    readQueryCountSites: per.reduce((a, r) => a + r.readQuery.length, 0),
    readQueryCountFiles: per.filter((r) => r.readQuery.length > 0).length,
    // B1(判据)自己的键 —— 既有四数(candidates/violations/undetermined/exempt)刻意不并入 B1。
    b1Candidates: per.reduce((a, r) => a + r.b1.candidates.length, 0),
    b1Violations: b1Violations.length,
    b1Files: per.filter((r) => r.b1.violations.length > 0).length,
    b1ExemptConfirmed: per.reduce((a, r) => a + r.b1.exempt.confirmed, 0),
    b1ExemptMarker: per.reduce((a, r) => a + r.b1.exempt.marker, 0),
    b1BareExempt: per.reduce((a, r) => a + r.b1.bareExempt, 0),
    b1NoBody,
    // B2(一跳委托)自己的五个键 —— 既有四数与 booleanAck* / b1* / readQuery* 的取值一字不并入。
    b2Candidates: per.reduce((a, r) => a + r.b2.candidates.length, 0),
    b2Violations: b2Violations.length,
    b2Files: per.filter((r) => r.b2.violations.length > 0).length,
    b2Undetermined: b2Undetermined.length,
    b2Exempt: per.reduce((a, r) => a + r.b2.exempt.confirmed + r.b2.exempt.marker, 0),
  }
  // 棘轮锚点:只在这一档才回读 HEAD 面(全量档本来就是 HEAD)。新文件不在 HEAD ⇒ 锚点 0,
  // 这是"第一个端点第一次就写错"必须判红的那一格;锚点文件取不到则判死,不拿 0 顶替。
  // 三条判据(计数自算 / B1 假 ack / B2 一跳委托)各按**各自**的 HEAD 计数当锚点 —— 共用一个数就是
  // 互相顶账(门 67/83 记过"同一笔债两道门各计一次会让两份基线互相顶掉"的反面:键必须分开)。
  let ratcheted = null
  if (face === 'staged' && (violations.length || b1Violations.length || b2Violations.length)) {
    const legacyByFile = new Map()
    for (const v of violations) legacyByFile.set(v.file, (legacyByFile.get(v.file) || 0) + 1)
    const b1ByFile = new Map()
    for (const v of b1Violations) b1ByFile.set(v.file, (b1ByFile.get(v.file) || 0) + 1)
    const b2ByFile = new Map()
    for (const v of b2Violations) b2ByFile.set(v.file, (b2ByFile.get(v.file) || 0) + 1)
    const files = [...new Set([...legacyByFile.keys(), ...b1ByFile.keys(), ...b2ByFile.keys()])]
    const headSet = new Set(listCandidates(root, 'head'))
    const need = files.filter((p) => headSet.has(p))
    // B2 的锚点必须也在 HEAD 面把那一跳读完:索引面的 ack 数与 HEAD 面的 ack 数若各自用**自己那一面**
    // 的被调正文,才是"同一把尺子在两个面上量出两个基准"的正解(反之混用就是自洽却错位的尺子)。
    const headPer = need.length
      ? scanFaceBundle(
          root,
          'head',
          need,
          readCandidates(root, 'head', need),
          listFacePaths(root, 'head'),
        )
      : []
    const headByFile = new Map(headPer.map((r) => [r.file, r]))
    ratcheted = []
    for (const file of files) {
      let anchorLegacy = 0
      let anchorB1 = 0
      let anchorB2 = 0
      if (headSet.has(file)) {
        const hr = headByFile.get(file)
        if (!hr)
          throw new Undetermined(`HEAD 取不到棘轮锚点文件 ${file} ⇒ 无法判定(不回落、不拿 0 顶替)`)
        anchorLegacy = hr.violations.length
        anchorB1 = hr.b1.violations.length
        anchorB2 = hr.b2.violations.length
      }
      const nowLegacy = legacyByFile.get(file) || 0
      if (nowLegacy > anchorLegacy)
        ratcheted.push({ file, kind: 'count', now: nowLegacy, anchor: anchorLegacy, added: nowLegacy - anchorLegacy })
      const nowB1 = b1ByFile.get(file) || 0
      if (nowB1 > anchorB1)
        ratcheted.push({ file, kind: 'b1', now: nowB1, anchor: anchorB1, added: nowB1 - anchorB1 })
      const nowB2 = b2ByFile.get(file) || 0
      if (nowB2 > anchorB2)
        ratcheted.push({ file, kind: 'b2', now: nowB2, anchor: anchorB2, added: nowB2 - anchorB2 })
    }
  }
  const exit = decide({
    face,
    violations,
    undetermined,
    ratcheted,
    strict: !!opts.strict,
    b1Violations,
    b1NoBody,
    b2Violations,
    b2Undetermined,
  })
  return {
    face,
    strict: !!opts.strict,
    counts,
    violations,
    undetermined,
    exempt,
    ratcheted,
    per,
    exit,
    b1Violations,
    b1NoBody,
    b2Violations,
    b2Undetermined,
  }
}

/**
 * 纯映射:面 + 结论 → 退出码。判红只算两型:staged 的差值棘轮、全量档的 --strict。
 * 全量档默认不判红是设计前提而不是偷懒:HEAD 有存量时当场判红 = 恒红门(§12e)。
 * 未判定永不冒红,但 --strict 下拒绝出合格证 ⇒ exit 2(不冒红也不记绿)。
 * **签名即判据(2026-09-27 更新)**:本函数收 violations / undetermined / ratcheted / strict,
 * 外加 **B1 的 b1Violations / b1NoBody** 与 **B2 的 b2Violations / b2Undetermined** —— 两条都是判据,
 * 进退出码是它们的本职(默认档仍只由 staged 棘轮与 --strict 触发,存量不冒红)。而两份**惯例存量**
 * 计数(booleanAck* / readQueryCount*)**依旧刻意不在参数里**,所以"把可见性计数接进退出码"这一改法
 * 在结构上就要求改签名,而那一步由 self-test 的 X1/X1b + 镜像 M13 判红(惯例存量是**决策依据**不是**债**)。
 */
export function decide({
  face,
  violations,
  undetermined,
  ratcheted,
  strict,
  b1Violations = [],
  b1NoBody = 0,
  b2Violations = [],
  b2Undetermined = [],
}) {
  if (strict) {
    // 未判定(B1 找不到函数体 / B2 那一跳解析不到)在 --strict 下与既有 undetermined 同档:拒绝出合格证。
    if (undetermined.length || b1NoBody || b2Undetermined.length) return 2
    if (
      face === 'staged'
        ? ratcheted && ratcheted.length
        : violations.length || b1Violations.length || b2Violations.length
    )
      return 1
    return 0
  }
  if (face === 'staged') return ratcheted && ratcheted.length ? 1 : 0
  return 0
}

/* ------------------------------- 报告 ------------------------------- */

const FACE_TXT = {
  head: 'HEAD blob(全量审计)',
  staged: '索引 blob(本次提交会带走的那一份)',
  worktree: '工作树(人工逃生舱,提交链不走这档)',
}

export function formatReport(out) {
  const L = []
  const c = out.counts
  const b1v = out.b1Violations || []
  const b2v = out.b2Violations || []
  const b2u = out.b2Undetermined || []
  if (out.ratcheted && out.ratcheted.length) {
    const nLegacy = out.ratcheted.filter((r) => (r.kind || 'count') === 'count').length
    const nB1 = out.ratcheted.filter((r) => r.kind === 'b1').length
    const nB2 = out.ratcheted.filter((r) => r.kind === 'b2').length
    L.push(
      `❌ 判红:${out.ratcheted.length} 条净新增越线(按 文件×判据;计数自算 ${nLegacy} · B1 假 ack ${nB1} · B2 委托假 ack ${nB2};锚点 = 该文件 HEAD 自身同判据计数)`,
    )
    for (const r of out.ratcheted)
      L.push(
        `   [${{ b1: 'B1假ack', b2: 'B2委托假ack' }[r.kind] || '计数自算'}] ${r.file}:索引 ${r.now} 处 > HEAD ${r.anchor} 处 ⇒ 净新增 ${r.added} 处`,
      )
    if (nLegacy) {
      L.push(
        `   修法二选一:① db 层补 .returning({id}) 并以真实命中集算 affected;② 走唯一出口 ${UNIQUE_OUTLET} 的 batchWriteOutcome(requested, confirmed)。`,
      )
      L.push(`   确属有意(如全量改写后必得请求数):写行内豁免 ${EXEMPT_TOKEN}: <一句话原因>。`)
    }
    if (nB1) {
      L.push(
        '   B1 修法:deleted 取库里真删的行(rows.length > 0 / batchWriteOutcome 的 affected > 0)—— 用户已拍板改真实语义,不得再无条件回 true。',
      )
      L.push(
        `   确属有意(如该表有触发器保证必删):写**同行**行内豁免 ${DELETE_ACK_EXEMPT_TOKEN}: <一句话原因>(须带原因,只本行生效,守门 108 按 30 天到期账管它)。`,
      )
    }
    if (nB2) {
      L.push(
        '   B2 修法:回**被委托函数**里补 .returning({id}) 并让调用方按命中行回报(或直接走 batchWriteOutcome)——',
      )
      L.push(
        '   摘掉被调函数里的 .returning( 就是这一型回退:缺陷隔了一个文件,B1 看不见,只有 B2 会红。',
      )
      L.push(
        `   同一处确属有意(如级联清理必删主记录):写**同行**行内豁免 ${DELETE_ACK_EXEMPT_TOKEN}: <原因>(与 B1 同一条通道)。`,
      )
    }
  } else if (out.face === 'staged')
    L.push(
      '✅ 索引面未见新增"批量写自算计数 / B1 假 ack / B2 委托假 ack"(存量按各文件 HEAD 自身计数豁免,不代裁)。',
    )
  if (out.face !== 'staged' && c.violations) {
    L.push(
      `${out.strict ? '❌' : '⚠️'} 全量档现读 ${c.violations} 处自算计数${out.strict ? '(--strict 判红)' : '(只报数,不拦提交:与改动无关的恒红门只会逼人 --no-verify,§12e)'}`,
    )
    for (const v of out.violations)
      L.push(`   ${v.file}:${v.line}  ${v.key}: ${v.expr}  (写链=${v.receiver}.… 无 .returning())`)
  }
  if (out.face !== 'staged' && c.b1Violations) {
    L.push(
      `${out.strict ? '❌' : '⚠️'} 全量档现读 B1 假 ack ${c.b1Violations} 处 / ${c.b1Files} 文件(同函数体有 db/tx 写链、回 deleted: true 字面量、体内无 .returning()/batchWriteOutcome())${out.strict ? ' —— --strict 判红' : ' —— 存量只报数不拦提交;提交链走差值棘轮,新增即红(§12e)'}`,
    )
    for (const v of b1v.slice(0, 40))
      L.push(`   ${v.file}:${v.line}  (写链=${v.receiver}.delete/update,响应 deleted: true)`)
    if (c.b1Violations > 40) L.push(`   …另 ${c.b1Violations - 40} 处(--explain 看全量)`)
  }
  // B2 与 B1 同档:它是判据不是可见性数 —— 全量默认档只报数(HEAD 有存量),--strict 才问责,
  // 提交链走"该文件 HEAD 自身 B2 计数"的差值棘轮。措辞与上一段同形,免得两型读起来不一样。
  if (out.face !== 'staged' && c.b2Violations) {
    L.push(
      `${out.strict ? '❌' : '⚠️'} 全量档现读 B2 委托假 ack ${c.b2Violations} 处 / ${c.b2Files} 文件(ack 体内无直接写链、await 了本仓具名导出函数、被调体有带 where 的写链而无 .returning()/batchWriteOutcome())${out.strict ? ' —— --strict 判红' : ' —— 存量只报数不拦提交;提交链走差值棘轮,新增即红(§12e)'}`,
    )
    for (const v of b2v.slice(0, 40))
      L.push(
        `   ${v.file}:${v.line}  → ${v.callee?.file ?? '?'}#${v.callee?.name ?? '?'}(被调体写链无 .returning(),响应 deleted: true)`,
      )
    if (c.b2Violations > 40) L.push(`   …另 ${c.b2Violations - 40} 处(--explain 看全量)`)
  }
  if (c.undetermined) {
    L.push(`⚠️ 未判定 ${c.undetermined} 处 —— **未判定不等于通过**,下列每一处本门都承认自己看不见:`)
    for (const u of out.undetermined.slice(0, 40)) L.push(`   ${u.file}:${u.line}  ${u.why}`)
    if (c.undetermined > 40) L.push(`   …另 ${c.undetermined - 40} 处(--explain 看全量)`)
  }
  if (c.b1NoBody)
    L.push(
      `⚠️ B1 未判定 ${c.b1NoBody} 处(布尔 ack 落在解析不出函数体的位置,如模块顶层/class 方法简写)—— 这**同样是未判定而不是通过**:判不了,不冒红也不记绿。`,
    )
  if (c.b2Undetermined) {
    L.push(
      `⚠️ B2 未判定 ${c.b2Undetermined} 处(那一跳解析不到:命名空间转发 / export * 再导出 / 第三方或 workspace 包 / 被调文件不在所判面 / 别名相对路径解不开 / 被调链 opaque)—— **未判定不是通过,也不是违规**:不冒红、不记绿,逐条点名如下:`,
    )
    let shown = 0
    for (const u of b2u)
      for (const k of u.undetermined) {
        if (shown++ >= 40) break
        L.push(
          `   ${u.file}:${u.line}  ${k.kind}${k.name ? ` (${k.name})` : ''}${k.specifier ? ` ← '${k.specifier}'` : ''}`,
        )
      }
    if (shown > 40) L.push(`   …另 ${shown - 40} 条(--explain 看全量)`)
  }
  if (out.strict && (c.undetermined || c.b1NoBody || c.b2Undetermined))
    L.push('❌ --strict 下未判定即拒绝出合格证 ⇒ exit 2(不冒红也不记绿)。')
  if (
    out.face !== 'staged' &&
    !c.violations &&
    !c.undetermined &&
    !c.b1Violations &&
    !c.b1NoBody &&
    !c.b2Violations &&
    !c.b2Undetermined
  )
    L.push('✅ 通过:覆盖面内无自算计数、无 B1/B2 假 ack,且无未判定项。')
  if (
    out.face === 'staged' &&
    !out.ratcheted?.length &&
    (c.undetermined || c.b1NoBody || c.b2Undetermined)
  )
    L.push('ℹ️ 本门未拦本次提交,但上面列出的未判定项**没有被判过** —— 别让绿灯替它们说话。')
  L.push(
    `候选 ${c.candidates} / 违规 ${c.violations} / 未判定 ${c.undetermined} / 豁免 ${c.exempt}` +
      `(库确认·链 ${out.exempt.returning} / 库确认·预查询 ${out.exempt.db} / 唯一出口 ${out.exempt.outlet} / 行内标记 ${out.exempt.marker})` +
      `  [裸标记不计 ${c.bareExempt};文件 ${c.files}/${c.enumerated};取材面:${FACE_TXT[out.face] || out.face}]` +
      // 结论行必须**点名**两份惯例存量:放着一个不喊出的数,读报告的人就会以为覆盖面内没有这两种形状
      // ("判据失效的表现永远是安静"同型)。它们不参与退出码 —— 措辞里"不计红"是这一句的约束力所在。
      ` 布尔 ack 惯例(不计红,仅现读计数): ${c.booleanAckSites} 处 / ${c.booleanAckFiles} 文件` +
      `;读查询 count 惯例(不计红,仅现读计数): ${c.readQueryCountSites} 处 / ${c.readQueryCountFiles} 文件` +
      // B1 是判据,结论行同样必须现读点名(含 0):它的"存量只报数"与"新增即红"共用这份数字,
      // 少喊一句,读报告的人就分不清"这一族没扫过"和"扫了是 0"。
      `;B1 假 ack(判据:违规 ${c.b1Violations ?? 0} 处 / ${c.b1Files ?? 0} 文件,` +
      `库确认放过 ${c.b1ExemptConfirmed ?? 0} · 行内标记 ${c.b1ExemptMarker ?? 0} 只报数,` +
      `裸标记不计 ${c.b1BareExempt ?? 0},找不到函数体不判 ${c.b1NoBody ?? 0})` +
      // B2 与 B1 同形:措辞里"0 处 ≠ 没扫过"由这一句自己承担;五个键一律现读,不并入任何既有数。
      `;B2 委托假 ack(判据:违规 ${c.b2Violations ?? 0} 处 / ${c.b2Files ?? 0} 文件,` +
      `候选 ${c.b2Candidates ?? 0},放过 ${c.b2Exempt ?? 0} 只报数,` +
      `那一跳解析不到不判 ${c.b2Undetermined ?? 0})`,
  )
  return L
}

const USAGE = `用法: node scripts/${GATE}.mjs [--staged|--worktree] [--strict] [--explain] [--json] [--files a,b] [--root <dir>] [--self-test]
  判据一(计数诚实性):同函数体内 inArray 批量写链 + .send(success({ deleted|affected|… : <请求侧>.length }))
    放过:链带 .returning( / 计数根可追到库确认集 / import ${UNIQUE_OUTLET} / 行内 ${EXEMPT_TOKEN}: <原因>(须带原因)
  判据二(B1 假 ack,2026-09-27):同函数体内 db|tx|trx .delete(/.update( 写链 + 响应对象里 deleted: true 字面量
    放过:体内 .returning( / 体内 batchWriteOutcome( / **同行**行内 ${DELETE_ACK_EXEMPT_TOKEN}: <原因>(须带原因)
  判据三(B2 委托假 ack,2026-09-27):ack 体内**无**直接写链(那一子集归 B1),但 await 了经 import 解析到
    ${API_SRC_DIR} 内某文件的具名导出函数,而被调函数体有带 .where( 的写链却无 .returning( / batchWriteOutcome(
    放过:被调体走库确认 / **同行**行内 ${DELETE_ACK_EXEMPT_TOKEN}: <原因>(与 B1 同一条通道)
    那一跳解析不到 ⇒ 计"未判定"并逐条点名(不记通过、也不因判不出而判红)
  只报数不判红(现读惯例存量,写在结论行):布尔 ack \`deleted: true\`(无写链的那一半)与读查询 \`count: X.length\`;--explain 逐条点名
  三条判据的存量都按「该文件 HEAD 自身同判据计数」差值棘轮:全量档只报数(恒红门=逼人 --no-verify,§12e),
  提交链档与 --strict 才问责。
  紧急跳过(接入提交链后):${SELF_SKIP}=1`

function main(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return void console.log(USAGE)
  if (argv.includes('--self-test')) return selfTest(argv)
  const { face, error } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (error) {
    console.error(`[${GATE}] ❌ 无法判定:${error}`)
    return 2
  }
  const ri = argv.indexOf('--root')
  const root = ri >= 0 && argv[ri + 1] ? resolve(argv[ri + 1]) : ROOT
  const fi = argv.includes('--files') ? argv.indexOf('--files') : -1
  const onlyFiles =
    fi >= 0 && argv[fi + 1]
      ? argv[fi + 1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : null
  let out
  try {
    out = analyze(root, face, { strict: argv.includes('--strict'), onlyFiles })
  } catch (e) {
    console.error(
      `[${GATE}] 无法判定(exit 2):${e instanceof Undetermined ? e.message : `${e?.message ?? e}\n${e?.stack ?? ''}`}`,
    )
    return 2
  }
  if (argv.includes('--explain')) {
    for (const r of out.per)
      for (const c of r.candidates)
        console.log(`  · ${c.file}:${c.line} ${c.key}: ${c.expr} ⇒ ${c.disposition}`)
    // 两份惯例存量的抽样出口:阳性对照要能"数到"并"点名",只有聚合数字就等于没法复核判据。
    for (const r of out.per)
      for (const b of r.booleanAck)
        console.log(`  · 布尔ack ${b.file}:${b.line} ${b.key}: ${b.value}(不计红)`)
    for (const r of out.per)
      for (const q of r.readQuery)
        console.log(`  · 读查询count ${q.file}:${q.line} ${q.key}: ${q.expr}(不计红)`)
    // B1 的逐条处置(V1 的子集,处置各说各话时这里就是复核入口)。
    for (const r of out.per)
      for (const s of r.b1.candidates)
        console.log(`  · B1假ack ${s.file}:${s.line} (写链=${s.receiver}.…) ⇒ ${s.disposition}`)
    for (const r of out.per)
      for (const n of r.b1.noBodySites)
        console.log(`  · B1未判定 ${n.file}:${n.line} 布尔 ack 解析不出所属函数体,不判红也不记绿`)
    // B2 的逐条处置:每条都带"哪一跳、被调文件里的哪一个函数",这样判红时才复核得了结论。
    for (const r of out.per)
      for (const s of r.b2.candidates)
        console.log(
          `  · B2委托ack ${s.file}:${s.line} → ${s.callee ? `${s.callee.file}#${s.callee.name}` : '(未解析)'} ⇒ ${s.disposition}`,
        )
    for (const r of out.per)
      for (const u of r.b2.undetermined)
        for (const k of u.undetermined)
          console.log(
            `  · B2未判定 ${u.file}:${u.line} ${k.kind}${k.name ? ` (${k.name})` : ''}${k.specifier ? ` ← '${k.specifier}'` : ''} 那一跳判不出,不记通过也不判红`,
          )
  }
  if (argv.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          gate: GATE,
          root,
          face: out.face,
          strict: out.strict,
          counts: out.counts,
          exempt: out.exempt,
          violations: out.violations,
          undetermined: out.undetermined,
          ratcheted: out.ratcheted,
          exit: out.exit,
          // B1 / B2 自己的键一律**追加在末尾**:既有顶层字段名与 counts 既有字段名的取值形态逐字不变
          // (镜像 M10 钉这一点)。
          b1Violations: out.b1Violations,
          b1NoBody: out.b1NoBody,
          b2Violations: out.b2Violations,
          b2Undetermined: out.b2Undetermined,
        },
        null,
        2,
      ),
    )
    return out.exit
  }
  for (const line of formatReport(out)) console.log(`[${GATE}] ${line}`)
  return out.exit
}

/* ------------------------------- 自检 ------------------------------- */

/** 夹具骨架:一份最小路由文件,每个 handler 一组行。共用骨架才不会让"文件形状"本身成为变量。 */
const h = (...handlers) =>
  [
    "import { inArray } from 'drizzle-orm'",
    "import { success } from '../utils/envelope.js'",
    ...handlers.flatMap((b) => ['server.delete(basePath, async (request, reply) => {', ...b, '})']),
    '',
  ].join('\n')

const FIX = {
  selfCount: h([
    '  const idList = request.body.ids',
    '  await db.delete(table).where(inArray(table.id, idList))',
    '  return reply.send(success({ deleted: idList.length }))',
  ]),
  returning: h([
    '  const deleted = await db',
    '    .delete(table)',
    '    .where(inArray(table.id, ids))',
    '    .returning()',
    '  return reply.send(success({ deleted: deleted.length }))',
  ]),
  outlet:
    "import { batchWriteOutcome } from '../utils/batch-outcome.js'\n" +
    // 第二条 handler 是"同一文件里还没迁完的老端点":有唯一出口 import ⇒ 整文件放过(E2);
    // 去掉 import 就必须变红 —— 那条对照是 outletNoImport(证明 E2 不是恒真)。
    h(
      [
        '  const rows = await db.delete(table).where(inArray(table.id, idList)).returning({ id: table.id })',
        '  const o = batchWriteOutcome(idList, rows.map((r) => r.id))',
        '  return reply.send(success({ affected: o.affected, missedIds: o.missedIds }))',
      ],
      [
        '  await db.delete(table).where(inArray(table.id, idList))',
        '  return reply.send(success({ affected: idList.length }))',
      ],
    ),
  outletNoImport: h([
    '  await db.delete(table).where(inArray(table.id, idList))',
    '  return reply.send(success({ affected: idList.length }))',
  ]),
  preQuery: h([
    '  const owned = await dbRead',
    '    .select({ id: cards.id })',
    '    .from(cards)',
    '    .where(and(eq(cards.userId, userId), inArray(cards.id, body.data.ids)))',
    '  const ownedIds = owned.map((r) => r.id)',
    '  if (ownedIds.length > 0) await db.delete(cards).where(inArray(cards.id, ownedIds))',
    '  return reply.send(success({ deleted: ownedIds.length }))',
  ]),
  preQueryRequestSide: h([
    '  const owned = await dbRead',
    '    .select({ id: cards.id })',
    '    .from(cards)',
    '    .where(and(eq(cards.userId, userId), inArray(cards.id, body.data.ids)))',
    '  const ownedIds = owned.map((r) => r.id)',
    '  if (ownedIds.length > 0) await db.delete(cards).where(inArray(cards.id, ownedIds))',
    '  return reply.send(success({ deleted: body.data.ids.length }))',
  ]),
  markerOk: h([
    '  await db.delete(table).where(inArray(table.id, ids))',
    '  return reply.send(success({',
    '    // batch-count-exempt: 该表有触发器逐行归档,删除数恒等于请求数,见 docs/x.md',
    '    deleted: ids.length,',
    '  }))',
  ]),
  markerBare: h([
    '  await db.delete(table).where(inArray(table.id, ids))',
    '  return reply.send(success({ deleted: ids.length })) // batch-count-exempt:',
  ]),
  regexQuote: h([
    "  const cleaned = ids.map((x) => x.replace(/'/g, ''))",
    '  await db.delete(table).where(inArray(table.id, cleaned))',
    '  return reply.send(success({ deleted: cleaned.length }))',
  ]),
  // 字符类里的反引号/引号(真仓 feature-center.ts 的 /[*`_~]/g 就是这一型):不吞掉整段正则,
  // 整份文件就会被后面的"模板未闭合"读盲 —— 判据看不见存量却一路报绿。
  regexClass: h([
    "  const cleaned = ids.map((x) => x.replace(/[*`_'~]/g, ''))",
    '  await db.delete(table).where(inArray(table.id, cleaned))',
    '  return reply.send(success({ deleted: cleaned.length }))',
  ]),
  boolAck: h([
    '  await db.delete(table).where(eq(table.id, p.data.id))',
    '  return reply.send(success({ id: p.data.id, deleted: true }))',
  ]),
  // V1 阳性对照的三个真形态:单行无尾逗号 / 带尾逗号 / 跨行对象字面量 —— 三个都该被现读到。
  // 2026-09-27 起这里刻意**不放写链**:同函数体有 db.delete/update 的那一子集已是 B1 的射程
  // (见 FIX.b1FalseAck),R8「惯例形态不改退出码(含 --strict)」这条不变量要的是纯惯例面 ——
  // 带链的两型各有夹具,混在一起就分不清"V1 只报数"和"B1 判红"是谁的账。
  boolAckCount: h(
    ['  return reply.send(success({ deleted: true }))'],
    ['  return reply.send(success({ id: 2, deleted: true, }))'],
    ['  return reply.send(success({', '    deleted: true,', '  }))'],
  ),
  // V1 必须**不**数的近邻形状:键族别的(restored/isDeleted)、值不是布尔字面量(affected/rows.length)、
  // 字面量后面还接着算式或更长的标识符。放宽到"任何含 deleted 的行"就会把这些一并混进同一个数。
  boolAckNearMiss: h(
    ['  const affected = 1', '  return reply.send(success({ deleted: affected }))'],
    ['  return reply.send(success({ deleted: rows.length }))'],
    ['  return reply.send(success({ restored: true }))'],
    ['  return reply.send(success({ isDeleted: true }))'],
    ['  return reply.send(success({ deleted: true === flag }))'],
    ['  return reply.send(success({ deleted: trueOrFalse }))'],
  ),
  // N3 同一条遮噪方向也管惯例计数:注释与字符串里的 `deleted: true` 不得进账。
  boolAckInComment: h(
    [
      '  // 旧实现曾返回 reply.send(success({ deleted: true })) —— 现按库确认计数',
      '  return reply.send(success({ ok: true }))',
    ],
    [
      "  const doc = '形如 reply.send(success({ deleted: true })) 的响应'",
      '  return reply.send(success({ ok: true, doc }))',
    ],
  ),
  // 三族同时出现在一份文件里:违规 1 / 布尔 ack 1 / 读查询 1 —— 各计各的,谁也不得串到谁的账上。
  mixedAll: h(
    [
      '  await db.delete(table).where(inArray(table.id, idList))',
      '  return reply.send(success({ deleted: idList.length }))',
    ],
    ['  await db.delete(t).where(eq(t.id, 1))', '  return reply.send(success({ deleted: true }))'],
    [
      '  const rows = await db.select().from(t).where(inArray(t.id, ids))',
      '  return reply.send(success({ rows, count: rows.length }))',
    ],
  ),
  readQuery: h([
    '  const rows = await db.select().from(t).where(inArray(t.id, ids))',
    '  return reply.send(success({ rows, count: rows.length }))',
  ]),
  commentOnly: h([
    '  await db.delete(table).where(inArray(table.id, ids))',
    '  // 旧实现:reply.send(success({ deleted: ids.length })) —— 已改为按库确认计数',
    '  return reply.send(success({ ok: true }))',
  ]),
  stringOnly: h([
    "  const doc = '示例: db.delete(t).where(inArray(t.id, ids)) 然后 reply.send(success({ deleted: ids.length }))'",
    '  return reply.send(success({ ok: true, doc }))',
  ]),
  chainAfter: h([
    '  const r = reply.send(success({ deleted: ids.length }))',
    '  await db.delete(table).where(inArray(table.id, ids))',
    '  return r',
  ]),
  registrar: h([
    '  await db.delete(table).where(inArray(table.id, ids))',
    '  return reply.send(success({ deleted: ids.length }))',
  ]).replace('server.delete(basePath', 'server.delete("/x"'),
  // ---- B1(2026-09-27)夹具:布尔 ack × 写链 × 库确认/豁免 的成对正反例 ----
  /** 假 ack 本尊:同函数体真发了 delete,却无条件回 deleted: true(HEAD 存量主型)。 */
  b1FalseAck: h([
    '  await db.delete(table).where(eq(table.id, id))',
    '  return reply.send(success({ id, deleted: true }))',
  ]),
  /** 同文件第二处同型(供"新增即红"与"违规×2"读数)。 */
  b1FalseAckTwice: h(
    ['  await db.delete(a).where(eq(a.id, id))', '  return reply.send(success({ deleted: true }))'],
    ['  await db.update(b).set({ gone: true }).where(eq(b.id, id2))', '  return reply.send(success({ deleted: true }))'],
  ),
  /** 放过 F1a:链上 .returning( —— 体内有库确认调用即放过,不追问这条 ack 用的是不是它。 */
  b1ConfirmedReturning: h([
    '  await db.delete(table).where(eq(table.id, id)).returning({ id: table.id })',
    '  return reply.send(success({ id, deleted: true }))',
  ]),
  /** 放过 F1b:体内 batchWriteOutcome( 调用(即便这处仍回字面量,已在迁移途中,不算"新写假 ack")。 */
  b1ConfirmedOutletCall: h([
    '  const rows = await db.delete(table).where(eq(table.id, id))',
    '  const o = batchWriteOutcome(idList, rows)',
    '  return reply.send(success({ id, deleted: true }))',
  ]),
  /** F1 的反面:.returning( 只活在注释里 ⇒ 不配放过(判据跑在遮蔽后的代码面上)。 */
  b1ReturningOnlyInComment: h([
    '  await db.delete(table).where(eq(table.id, id))',
    '  // 这里本该写 .returning( 但没写,门不得被一句解释性注释骗过',
    '  return reply.send(success({ id, deleted: true }))',
  ]),
  /** 放过 F2:带原因、同行尾注释的行内豁免。 */
  b1MarkerOk: h([
    '  await db.delete(table).where(eq(table.id, id))',
    '  return reply.send(success({ id, deleted: true })) // delete-ack-exempt: 该表触发器保证必删一行,见 docs/z.md',
  ]),
  /** F2 反面①:裸标记无原因 ⇒ 仍红并计裸标记数(与门 102/108 同规矩)。 */
  b1MarkerBare: h([
    '  await db.delete(table).where(eq(table.id, id))',
    '  return reply.send(success({ id, deleted: true })) // delete-ack-exempt:',
  ]),
  /** F2 反面②:标记写在紧邻上一行 ⇒ 不放行(B1 刻意只本行生效,比 batch-count-exempt 严一档)。 */
  b1MarkerPrevLine: h([
    '  await db.delete(table).where(eq(table.id, id))',
    '  // delete-ack-exempt: 标记在上一行,这一族不走"紧邻上一行"通道',
    '  return reply.send(success({ id, deleted: true }))',
  ]),
  /** F2 反面③:标记落在字符串里 ⇒ 不是注释,不放行。 */
  b1MarkerInString: h([
    '  await db.delete(table).where(eq(table.id, id))',
    '  return reply.send(success({ id, deleted: true, doc: "delete-ack-exempt: 这不是注释" }))',
  ]),
  /** 读查询面(N3③):deleted: true 出现在 select 映射 / 字符串 / 注释 ⇒ V1 与 B1 都不进。 */
  b1ReadFace: h([
    '  await db.delete(table).where(eq(table.id, id))',
    '  const rows = await db.select({ id: t.id, deleted: true }).from(t)',
    "  const doc = '老响应形如 reply.send(success({ deleted: true }))'",
    '  // reply.send(success({ deleted: true })) 是旧写法,已废',
    '  return reply.send(success({ rows, doc, ok: true }))',
  ]),
  /** E2(文件级 import 唯一出口)不救 B1:import 了 ≠ 这一处走了库确认。 */
  b1OutletFileStillJudged:
    "import { batchWriteOutcome } from '../utils/batch-outcome.js'\n" +
    h([
      '  await db.delete(table).where(eq(table.id, id))',
      '  return reply.send(success({ id, deleted: true }))',
    ]),
  /** 找不到函数体:模块顶层的布尔 ack ⇒ B1 未判定(不判红也不记绿),也不进候选。 */
  b1NoBody: 'const legacy = api.send(success({ deleted: true }))\n',
  /** 已改真的形状(BR 棘轮序列用):库确认集合推出真值,响应里不再有字面量 true。 */
  b1Migrated: h([
    '  const rows = await db.delete(table).where(eq(table.id, id)).returning({ id: table.id })',
    '  return reply.send(success({ id, deleted: rows.length > 0 }))',
  ]),
}

/* ---- B2(2026-09-27)夹具:一跳委托的删除 ack ----
 * 调用方与**两条腿**的正文都是夹具,判据跑在注入的 calleeIndex 上 ⇒ 自检零 git 派生也能走完整条
 * 判据(与 analyze 用的是同一份 planDelegatedAckSites / finishDelegatedAckSite 实现,不另写一份)。
 */
export const B2_CALLER = 'apps/api/src/routes/b2.ts'
export const B2_CALLEE = 'apps/api/src/db/b2-queries.ts'
const callerWith = (importLine, body) =>
  [
    "import { eq } from 'drizzle-orm'",
    "import { success } from '../utils/envelope.js'",
    importLine,
    'server.delete(basePath, async (request, reply) => {',
    '  const { id } = idParam.parse(request.params)',
    ...body,
    '  return reply.send(success({ id, deleted: true }))',
    '})',
    '',
  ].join('\n')
const namedImport = `import { deleteThing } from '${B2_CALLEE.replace('apps/api/src/', '../').replace('.ts', '.js')}'`
/** 各夹具共用的体内语句(提成常量既避长行,也让"同一形态"在夹具里只有一份写法)。 */
const AW = ['  await deleteThing(id)']
const AW_NS = ['  await q.deleteThing(id)']

const B2FIX = {
  /** 委托本体:ack 体内没有直接写链,真 delete 住在另一文件的具名导出函数里。 */
  delegated: callerWith(namedImport, AW),
  /** 被调腿:写链上没有 .returning( ⇒ 这一跳就是"库没答复"。 */
  calleeNoReturning:
    'export async function deleteThing(id: string): Promise<void> {\n  await db.delete(things).where(eq(things.id, id))\n}\n',
  /** 被调腿:第二十六批产出的形态(回报 RETURNING 命中集)⇒ 必须判放过,不得把修好的代码判红。 */
  calleeReturning:
    'export async function deleteThing(id: string): Promise<number> {\n  const rows = await db.delete(things).where(eq(things.id, id)).returning({ id: things.id })\n  return rows.length\n}\n',
  /** 被调腿走唯一出口 ⇒ 同样放过(与 B1 的 F1b 同一条理由)。 */
  calleeOutlet:
    'export async function deleteThing(id: string) {\n  return batchWriteOutcome([id], await db.delete(things).where(eq(things.id, id)).returning({ id: things.id }))\n}\n',
  /** 被调腿确实没有带 where 的写链(纯缓存清理)⇒ 真绿,不塞进未判定充数。 */
  calleeNoWrite:
    'export async function deleteThing(id: string): Promise<void> {\n  await cache.remove(id)\n}\n',
  /** 被调腿是 const + 箭头(仓内实测两种导出形态都有)⇒ 判据必须认这一种。 */
  calleeConstArrow:
    'export const deleteThing = async (id: string) => db.delete(things).where(eq(things.id, id))\n',
  /** 被调腿的 where 里混进函数字面量 ⇒ 分不清,落未判定。 */
  calleeOpaque:
    'export async function deleteThing(q: any): Promise<void> {\n  await db.delete(things).where((t) => eq(t.id, q.id))\n}\n',
  /** 被调文件用 export * 转发:名单不可枚举 ⇒ N1 未判定。 */
  calleeStar: "export * from './b2-impl.js'\n",
  /** 被调文件具名再导出 ⇒ 一跳之外还有第二跳,刻意不追 ⇒ 未判定。 */
  calleeReexport: "export { deleteThing } from './b2-impl.js'\n",
  /** 命名空间转发(await ns.del()):具名导出边判不出 ⇒ 未判定,且**不**因此放过整处。 */
  callerNamespace: callerWith(`import * as q from '../db/b2-queries.js'`, AW_NS),
  /** 裸包名 / workspace 包:被调函数在 apps/api/src 之外 ⇒ 未判定。 */
  callerBarePackage: callerWith("import { deleteThing } from '@ihui/database'", AW),
  /** 路径解析不到(改名/忘 add 的在途文件)⇒ 未判定。 */
  callerMissingModule: callerWith("import { deleteThing } from '../db/gone-mid-refactor.js'", [
    '  await deleteThing(id)',
  ]),
  /** 别名形态:apps/api/tsconfig 的 paths 声明 @/* → src/*,必须与相对路径同判(门让你怎么写,门就看得见)。 */
  callerAlias: callerWith("import { deleteThing } from '@/db/b2-queries.js'", AW),
  /** B1 射程(同函数体有直接写链):B2 不得重复计同一格。 */
  callerDirectChain: callerWith(namedImport, [
    '  await deleteThing(id)',
    '  await db.delete(other).where(eq(other.id, id))',
  ]),
  /** N3:委托给本文件里的 helper(不经 import)⇒ 不入 B2 的账,只在 V1 的惯例数里点名。 */
  callerLocalHelper: callerWith('', [
    '  await dropThing(id)',
    '  async function dropThing(x: string) {',
    '    await db.delete(things).where(eq(things.id, x))',
    '  }',
  ]),
  /** 标记三形态:同行带原因 / 裸标记 / 写在紧邻上一行(与 B1 同一条通道的三种判法)。
   *  标记必须落在 **ack 那一行** —— 命中行号取的是响应对象里 `deleted` 所在的位置。 */
  callerMarkerOk: callerWith(namedImport, AW).replace(
    '  return reply.send(success({ id, deleted: true }))',
    '  return reply.send(success({ id, deleted: true })) // delete-ack-exempt: 级联清理后主记录必删,见 docs/b2.md',
  ),
  callerMarkerBare: callerWith(namedImport, AW).replace(
    '  return reply.send(success({ id, deleted: true }))',
    '  return reply.send(success({ id, deleted: true })) // delete-ack-exempt:',
  ),
  callerMarkerPrevLine: callerWith(namedImport, AW).replace(
    '  await deleteThing(id)',
    '  // delete-ack-exempt: 标记写在上一行,这一族不走"紧邻上一行"通道\n  await deleteThing(id)',
  ),
}

function selfTest(argv) {
  const R = []
  const eq = (name, got, want) => {
    const g = JSON.stringify(got),
      w = JSON.stringify(want)
    R.push(`${g === w ? '✅' : '❌'} ${name}${g === w ? '' : ` → 实得 ${g} 期望 ${w}`}`)
  }
  const v = (t) => scanFileText('apps/api/src/routes/x.ts', t)
  const st = (t) => {
    const r = v(t)
    return [r.candidates.length, r.violations.length, r.undetermined.length]
  }
  const trip = (t) => {
    const r = v(t)
    return [r.candidates.length, r.violations.length, r.exempt]
  }
  eq('P1 自算 count ⇒ 候选 1 违规 1', st(FIX.selfCount), [1, 1, 0])
  eq('N1 链带 .returning( ⇒ 违规 0(库确认放过)', trip(FIX.returning), [
    1,
    0,
    { returning: 1, db: 0, outlet: 0, marker: 0 },
  ])
  eq('N1b 计数根来自归属预查询 ⇒ 违规 0(库确认·预查询)', trip(FIX.preQuery), [
    1,
    0,
    { returning: 0, db: 1, outlet: 0, marker: 0 },
  ])
  eq('P1b 同一处改成请求侧集合 ⇒ 违规 1(证明 N1b 不是恒真)', trip(FIX.preQueryRequestSide), [
    1,
    1,
    { returning: 0, db: 0, outlet: 0, marker: 0 },
  ])
  eq('N2 import 唯一出口 ⇒ 违规 0(出口放过)', trip(FIX.outlet), [
    1,
    0,
    { returning: 0, db: 0, outlet: 1, marker: 0 },
  ])
  eq('P2 同一处去掉 import ⇒ 违规 1(证明 E2 不是恒真)', trip(FIX.outletNoImport), [
    1,
    1,
    { returning: 0, db: 0, outlet: 0, marker: 0 },
  ])
  eq('N3 带原因的行内豁免 ⇒ 违规 0', trip(FIX.markerOk), [
    1,
    0,
    { returning: 0, db: 0, outlet: 0, marker: 1 },
  ])
  eq(
    'P3 裸标记无原因 ⇒ 违规 1 且裸标记计数 1',
    (() => {
      const r = v(FIX.markerBare)
      return [r.violations.length, r.bareExempt, r.exempt.marker]
    })(),
    [1, 1, 0],
  )
  eq('P4 正则字面量里有引号 ⇒ 仍看得见违规(词法器不被带盲)', st(FIX.regexQuote), [1, 1, 0])
  eq(
    'P4b 字符类里有反引号/引号 ⇒ 仍看得见违规(真仓 feature-center 那一型)',
    st(FIX.regexClass),
    [1, 1, 0],
  )
  eq('N4 布尔 deleted:true ⇒ 不入面', st(FIX.boolAck), [0, 0, 0])
  eq('N5 读查询 count: rows.length ⇒ 不入面', st(FIX.readQuery), [0, 0, 0])
  // ---- V1/V2:两份"惯例存量"计数(只报数、永不判红)。六元组一次读出「两型计数 + 四个判据数」,
  //      所以同一支用例既证计数数到了,也证它没有把判据的四个数顶动一格。----
  const cc = (t) => {
    const r = v(t)
    return [
      r.booleanAck.length,
      r.readQuery.length,
      r.candidates.length,
      r.violations.length,
      r.undetermined.length,
      r.exempt.returning + r.exempt.db + r.exempt.outlet + r.exempt.marker,
    ]
  }
  eq(
    'V1 布尔 ack 三种真形态(单行 / 带尾逗号 / 跨行对象)⇒ 数到 3 处,判据四数仍 0',
    cc(FIX.boolAckCount),
    [3, 0, 0, 0, 0, 0],
  )
  eq(
    'V1b 近邻形状一律不数(affected / rows.length / restored:true / isDeleted / true===flag / trueOrFalse)',
    cc(FIX.boolAckNearMiss),
    [0, 0, 0, 0, 0, 0],
  )
  eq(
    'V1c 注释与字符串里的 deleted: true 不计数(判据与计数共用同一份遮蔽面)',
    cc(FIX.boolAckInComment),
    [0, 0, 0, 0, 0, 0],
  )
  eq(
    'V2 读查询 count: rows.length ⇒ 只进 readQuery,不混进布尔 ack',
    cc(FIX.readQuery),
    [0, 1, 0, 0, 0, 0],
  )
  eq(
    'V3 三族同文件各计各的:违规 1 / 布尔 ack 1 / 读查询 1(混计就等于没有信息)',
    cc(FIX.mixedAll),
    [1, 1, 1, 1, 0, 0],
  )
  eq(
    'V4 反向对照:加了两型计数后,自算计数那一处仍是候选 1 / 违规 1、两型计数 0',
    cc(FIX.selfCount),
    [0, 0, 1, 1, 0, 0],
  )
  eq(
    'V5 N1/N2 的"不入面"结论一字未动',
    [st(FIX.boolAck), st(FIX.readQuery)],
    [
      [0, 0, 0],
      [0, 0, 0],
    ],
  )
  eq('N6 注释里的字样 ⇒ 不计候选(剥注释锁)', st(FIX.commentOnly), [0, 0, 0])
  eq('N7 字符串里的字样 ⇒ 不入面(遮噪方向锁)', st(FIX.stringOnly), [0, 0, 0])
  eq('U1 链在 send 之后 ⇒ 未判定 1、不判红', st(FIX.chainAfter), [0, 0, 1])
  eq('N8 路由注册者不被当批量写(接收者白名单),而体内 db 链照判', st(FIX.registrar), [1, 1, 0])
  eq(
    'N8b 去掉 db 链后同一路由注册 ⇒ 不入面',
    st(FIX.registrar.replace('  await db.delete(table).where(inArray(table.id, ids))\n', '')),
    [0, 0, 0],
  )
  eq(
    'E1 两面旗同给 ⇒ 判死',
    selectFace({ staged: true, worktree: true, def: 'head' }).error,
    '--staged 与 --worktree 不得同用(两个判定面互斥)',
  )
  eq(
    'E2 默认面是 HEAD(不是磁盘)',
    selectFace({ staged: false, worktree: false, def: 'head' }).face,
    'head',
  )
  const D = (o) => decide(o)
  eq(
    'E3 全量档默认不判红(存量只报数)',
    D({ face: 'head', violations: [1, 2, 3], undetermined: [], ratcheted: null, strict: false }),
    0,
  )
  eq(
    'E4 --strict 下存量判红',
    D({ face: 'head', violations: [1, 2, 3], undetermined: [], ratcheted: null, strict: true }),
    1,
  )
  eq(
    'E5 --strict 下有未判定 ⇒ 拒绝出合格证(2 优先于 1)',
    D({ face: 'head', violations: [], undetermined: [{}], ratcheted: null, strict: true }),
    2,
  )
  eq(
    'E6 staged 差值棘轮判红',
    D({
      face: 'staged',
      violations: [1, 2],
      undetermined: [],
      ratcheted: [{ file: 'a', now: 2, anchor: 1, added: 1 }],
      strict: false,
    }),
    1,
  )
  eq(
    'E7 staged 存量持平 ⇒ 不拦',
    D({ face: 'staged', violations: [1], undetermined: [], ratcheted: [], strict: false }),
    0,
  )
  // ---- B1(2026-09-27):布尔 ack × 写链的棘轮判据。六元组 = [候选, 违规, 库确认放过, 标记放过, 裸标记, 无函数体]。----
  const b1 = (t) => {
    const r = v(t)
    return [
      r.b1.candidates.length,
      r.b1.violations.length,
      r.b1.exempt.confirmed,
      r.b1.exempt.marker,
      r.b1.bareExempt,
      r.b1.noBodySites.length,
    ]
  }
  eq('B1 命中:同函数体 db.delete + deleted:true 字面量、无库确认 ⇒ 候选 1 违规 1', b1(FIX.b1FalseAck), [
    1, 1, 0, 0, 0, 0,
  ])
  eq('B1b update 链同判(set().where() 也是写)', b1(FIX.b1FalseAckTwice), [2, 2, 0, 0, 0, 0])
  eq('B1p①a 体内 .returning( ⇒ 放过(库确认口径)', b1(FIX.b1ConfirmedReturning), [1, 0, 1, 0, 0, 0])
  eq('B1p①b 体内 batchWriteOutcome( ⇒ 放过', b1(FIX.b1ConfirmedOutletCall), [1, 0, 1, 0, 0, 0])
  eq(
    'B1f① .returning( 只活在注释里 ⇒ 不放行(判据跑在遮蔽后的代码面上,反向锁)',
    b1(FIX.b1ReturningOnlyInComment),
    [1, 1, 0, 0, 0, 0],
  )
  eq('B1p② 同行带原因 delete-ack-exempt ⇒ 放过', b1(FIX.b1MarkerOk), [1, 0, 0, 1, 0, 0])
  eq(
    'B1f② 裸标记无原因 ⇒ 仍红且裸标记计数 1("须带原因"不得被放宽成裸标记即放过)',
    b1(FIX.b1MarkerBare),
    [1, 1, 0, 0, 1, 0],
  )
  eq(
    'B1f②b 标记写在紧邻上一行 ⇒ 不放行(B1 只本行生效,刻意比 batch-count-exempt 严)',
    b1(FIX.b1MarkerPrevLine),
    [1, 1, 0, 0, 0, 0],
  )
  eq(
    'B1f②c 标记落在字符串里 ⇒ 不是注释,不放行(与门 102 的"注释闭合符冒充"同族反向锁)',
    b1(FIX.b1MarkerInString),
    [1, 1, 0, 0, 0, 0],
  )
  eq(
    'B1r 读查询面:select 映射/类型位/注释/字符串里的 deleted: true 既不进 V1 也不进 B1(不是响应对象面)',
    (() => {
      const r = v(FIX.b1ReadFace)
      return [r.booleanAck.length, r.b1.candidates.length, r.b1.violations.length]
    })(),
    [0, 0, 0],
  )
  eq(
    'B1e E2 的文件级出口 import 不救 B1(同函数体没走库确认就照判,迁一半的端点不得自我洗白)',
    b1(FIX.b1OutletFileStillJudged),
    [1, 1, 0, 0, 0, 0],
  )
  eq('B1n 顶层布尔 ack 解析不出函数体 ⇒ 未判定 1、不判红也不记绿', b1(FIX.b1NoBody), [
    0, 0, 0, 0, 0, 1,
  ])
  eq(
    'B1x 无写链的纯惯例 ack 只进 V1、B1 六数全 0(两型分家)',
    (() => {
      const r = v(FIX.boolAckCount)
      return [r.booleanAck.length, ...b1(FIX.boolAckCount)]
    })(),
    [3, 0, 0, 0, 0, 0, 0],
  )
  eq(
    'B1y B1 不改判据一的四数:selfCount 面 B1 全 0,readQuery 面 B1 全 0',
    [
      b1(FIX.selfCount),
      b1(FIX.readQuery),
      st(FIX.selfCount),
      st(FIX.readQuery),
    ],
    [
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [1, 1, 0],
      [0, 0, 0],
    ],
  )
  eq(
    'B1d decide:B1 是判据 —— 全量档默认不红、--strict 红、staged 靠 ratcheted 里 kind=b1 那条红',
    [
      D({
        face: 'head',
        violations: [],
        undetermined: [],
        ratcheted: null,
        strict: false,
        b1Violations: [{}],
      }),
      D({
        face: 'head',
        violations: [],
        undetermined: [],
        ratcheted: null,
        strict: true,
        b1Violations: [{}],
      }),
      D({
        face: 'staged',
        violations: [],
        undetermined: [],
        ratcheted: [{ file: 'x', kind: 'b1', now: 1, anchor: 0, added: 1 }],
        strict: false,
        b1Violations: [{}],
      }),
      D({
        face: 'head',
        violations: [],
        undetermined: [],
        ratcheted: null,
        strict: true,
        b1NoBody: 1,
      }),
    ],
    [0, 1, 1, 2],
  )
  // ---- B2(2026-09-27):一跳委托的删除 ack。六元组 = [候选, 违规, 放过·库确认, 放过·标记, 裸标记, 未判定]。
  //      调用方与被调腿都是夹具,calleeIndex 直接注入 ⇒ 判据实现与 analyze 走的是同一份函数。----
  const b2 = (callerText, calleeText, opt = {}) => {
    const known = opt.known === false ? new Set() : new Set([B2_CALLEE])
    const idx = new Map()
    if (calleeText !== null) idx.set(B2_CALLEE, indexExportedFns(maskText(calleeText).text))
    const r = scanFileText(B2_CALLER, callerText, { knownPaths: known, calleeIndex: idx })
    return [
      r.b2.candidates.length,
      r.b2.violations.length,
      r.b2.exempt.confirmed,
      r.b2.exempt.marker,
      r.b2.bareExempt,
      r.b2.undetermined.length,
    ]
  }
  const NO_RET = B2FIX.calleeNoReturning
  eq(
    'B2 命中:ack 体内无直接写链、await 本仓具名导出、被调体写链无 .returning( ⇒ 候选 1 违规 1',
    b2(B2FIX.delegated, NO_RET),
    [1, 1, 0, 0, 0, 0],
  )
  eq(
    'B2 违规必须点名被调文件与函数(只报"这行有问题"复核不了那一跳)',
    (() => {
      const r = scanFileText(B2_CALLER, B2FIX.delegated, {
        knownPaths: new Set([B2_CALLEE]),
        calleeIndex: new Map([[B2_CALLEE, indexExportedFns(maskText(NO_RET).text)]]),
      })
      const v = r.b2.violations[0]
      return [v.file, v.callee.file, v.callee.name]
    })(),
    [B2_CALLER, B2_CALLEE, 'deleteThing'],
  )
  eq(
    'B2p① 同一夹具只在被调体补 .returning({id}) ⇒ 违规 0、放过 1(判据必须认第二十六批产出的形态)',
    b2(B2FIX.delegated, B2FIX.calleeReturning),
    [1, 0, 1, 0, 0, 0],
  )
  eq('B2p② 被调体走唯一出口 batchWriteOutcome( ⇒ 放过', b2(B2FIX.delegated, B2FIX.calleeOutlet), [
    1, 0, 1, 0, 0, 0,
  ])
  eq(
    'B2p③ 被调腿是 const + 箭头写法 ⇒ 同一判据照样命中(仓内两种导出形态实测都有)',
    b2(B2FIX.delegated, B2FIX.calleeConstArrow),
    [1, 1, 0, 0, 0, 0],
  )
  eq(
    'B2n 被调腿没有带 where 的写链 ⇒ 判"无写链"= 真绿,既不判红也不冒充未判定',
    b2(B2FIX.delegated, B2FIX.calleeNoWrite),
    [1, 0, 0, 0, 0, 0],
  )
  eq(
    'B2u① 命名空间转发(await ns.del())⇒ 未判定 1、不判红(具名导出边判不出,但也不放过)',
    b2(B2FIX.callerNamespace, NO_RET),
    [1, 0, 0, 0, 0, 1],
  )
  eq(
    'B2u② 裸包名 / workspace 包 ⇒ 被调函数在 apps/api/src 之外 ⇒ 未判定',
    b2(B2FIX.callerBarePackage, NO_RET),
    [1, 0, 0, 0, 0, 1],
  )
  eq(
    'B2u③ 路径在面上找不到(改名 / 别人还没 add 的在途文件)⇒ 未判定,而不是判红',
    b2(B2FIX.delegated, NO_RET, { known: false }),
    [1, 0, 0, 0, 0, 1],
  )
  eq(
    'B2u③b 清单有、正文取不到(同面第二次读落空)⇒ 未判定 callee-face-missing',
    b2(B2FIX.delegated, null),
    [1, 0, 0, 0, 0, 1],
  )
  eq(
    'B2u④ export * 再导出 ⇒ 名单不可枚举 ⇒ 未判定(不猜第二跳,也不因此放过)',
    b2(B2FIX.delegated, B2FIX.calleeStar),
    [1, 0, 0, 0, 0, 1],
  )
  eq(
    'B2u④b 具名再导出 export {} from ⇒ 同样未判定',
    b2(B2FIX.delegated, B2FIX.calleeReexport),
    [1, 0, 0, 0, 0, 1],
  )
  eq(
    'B2u⑤ 被调链 opaque(where 里混函数字面量)⇒ 未判定:分不清的是命中集,不是有没有写',
    b2(B2FIX.delegated, B2FIX.calleeOpaque),
    [1, 0, 0, 0, 0, 1],
  )
  eq(
    'B2u⑥ 被调符号不是可解析的函数导出 ⇒ callee-not-exported 未判定',
    b2(B2FIX.delegated, 'export const deleteThing = 1\n'),
    [1, 0, 0, 0, 0, 1],
  )
  eq(
    'B2a 别名 @/db/…(apps/api tsconfig 的 paths 声明)与相对路径同判 —— 门让你怎么写,门就得看得见',
    b2(B2FIX.callerAlias, NO_RET),
    [1, 1, 0, 0, 0, 0],
  )
  eq(
    'B2x B1 射程不重复计:同函数体有直接写链 ⇒ B2 候选 0,而 B1 违规仍是 1',
    (() => {
      const r = scanFileText(B2_CALLER, B2FIX.callerDirectChain, {
        knownPaths: new Set([B2_CALLEE]),
        calleeIndex: new Map([[B2_CALLEE, indexExportedFns(maskText(NO_RET).text)]]),
      })
      return [r.b2.candidates.length, r.b1.candidates.length, r.b1.violations.length]
    })(),
    [0, 1, 1],
  )
  eq(
    'B2y N3:委托给本文件的本地 helper(不经 import)⇒ B2 不入账,但 V1 的惯例数照点名这一处',
    (() => {
      const r = scanFileText(B2_CALLER, B2FIX.callerLocalHelper, {
        knownPaths: new Set([B2_CALLEE]),
        calleeIndex: new Map(),
      })
      return [r.b2.candidates.length, r.b2.undetermined.length, r.booleanAck.length]
    })(),
    [0, 0, 1],
  )
  eq('B2m 同行带原因 delete-ack-exempt ⇒ 放过(与 B1 同一条通道、同一份实现)', b2(B2FIX.callerMarkerOk, NO_RET), [
    1, 0, 0, 1, 0, 0,
  ])
  eq(
    'B2f① 裸标记无原因 ⇒ 仍红且裸标记计数 1("须带原因"不得被放宽)',
    b2(B2FIX.callerMarkerBare, NO_RET),
    [1, 1, 0, 0, 1, 0],
  )
  eq(
    'B2f② 标记写在紧邻上一行 ⇒ 不放行(与 B1 同规格:只本行生效)',
    b2(B2FIX.callerMarkerPrevLine, NO_RET),
    [1, 1, 0, 0, 0, 0],
  )
  eq(
    'B2e 既有四数与 B1 六数一字不被 B2 顶动(两判据各计各的账)',
    (() => {
      const r = scanFileText(B2_CALLER, B2FIX.delegated, {
        knownPaths: new Set([B2_CALLEE]),
        calleeIndex: new Map([[B2_CALLEE, indexExportedFns(maskText(NO_RET).text)]]),
      })
      return [
        r.candidates.length,
        r.violations.length,
        r.undetermined.length,
        r.exempt.returning + r.exempt.db + r.exempt.outlet + r.exempt.marker,
        r.b1.candidates.length,
        r.b1.violations.length,
        r.booleanAck.length,
        r.readQuery.length,
      ]
    })(),
    [0, 0, 0, 0, 0, 0, 1, 0],
  )
  const D2 = (over) =>
    D({ face: 'head', violations: [], undetermined: [], ratcheted: null, strict: false, ...over })
  eq(
    'B2d decide:B2 是判据 —— 全量默认不红、--strict 红、staged 靠 kind=b2 那条红、未判定在 --strict 下 exit 2',
    [
      D2({ b2Violations: [{}] }),
      D2({ strict: true, b2Violations: [{}] }),
      D({
        face: 'staged',
        violations: [],
        undetermined: [],
        ratcheted: [{ file: 'x', kind: 'b2', now: 1, anchor: 0, added: 1 }],
        strict: false,
        b2Violations: [{}],
      }),
      D2({ strict: true, b2Undetermined: [{}] }),
      D2({ b2Undetermined: [{}] }),
    ],
    [0, 1, 1, 2, 0],
  )
  // ---- 只报数不改判据的两把锁:把惯例计数接进退出码 / 让它从结论行消失,各自必读红。----
  eq(
    'X1 惯例计数再大也不得进退出码(--strict 也一样:存量是决策依据,不是债)',
    D({
      face: 'head',
      violations: [],
      undetermined: [],
      ratcheted: null,
      strict: true,
      booleanAckSites: 9999,
      booleanAckFiles: 500,
      readQueryCountSites: 9999,
      readQueryCountFiles: 500,
    }),
    0,
  )
  eq(
    'X1b 同一条对 staged 档成立(不得用惯例数替差值棘轮加料)',
    D({
      face: 'staged',
      violations: [],
      undetermined: [],
      ratcheted: [],
      strict: false,
      booleanAckSites: 9999,
      readQueryCountSites: 9999,
    }),
    0,
  )
  const BASE_COUNTS = {
    files: 1,
    enumerated: 1,
    candidates: 0,
    violations: 0,
    undetermined: 0,
    exempt: 0,
    bareExempt: 0,
    booleanAckSites: 233,
    booleanAckFiles: 148,
    readQueryCountSites: 12,
    readQueryCountFiles: 9,
    b1Candidates: 0,
    b1Violations: 0,
    b1Files: 0,
    b1ExemptConfirmed: 0,
    b1ExemptMarker: 0,
    b1BareExempt: 0,
    b1NoBody: 0,
  }
  const fmt = (countsOver = {}) =>
    formatReport({
      face: 'head',
      strict: false,
      ratcheted: null,
      violations: [],
      undetermined: [],
      exempt: { returning: 0, db: 0, outlet: 0, marker: 0 },
      counts: { ...BASE_COUNTS, ...countsOver },
    }).join('\n')
  eq(
    'X2 结论行必须点名两份惯例存量与数字(不得被"✅ 通过"一句替它们说话)',
    /布尔 ack 惯例\(不计红,仅现读计数\): 233 处 \/ 148 文件/.test(fmt()) &&
      /读查询 count 惯例\(不计红,仅现读计数\): 12 处 \/ 9 文件/.test(fmt()),
    true,
  )
  eq(
    'X2b 四个判据数的原形态逐字不变(新增只许追加,不许改写既有结论行)',
    /^候选 0 \/ 违规 0 \/ 未判定 0 \/ 豁免 0.*取材面:HEAD blob.*布尔 ack 惯例/m.test(fmt()),
    true,
  )
  eq(
    'X2c 存量真是 0 时也必须喊出 0(0 处不等于"没扫过")',
    /布尔 ack 惯例\(不计红,仅现读计数\): 0 处 \/ 0 文件/.test(
      fmt({ booleanAckSites: 0, booleanAckFiles: 0 }),
    ),
    true,
  )
  // ---- B1 的报告面:结论行必须点名判据计数;✅/未判定 是两句话;有 B1 违规时不得出"✅ 通过"。----
  const fmtB1 = (over = {}, outOver = {}) =>
    formatReport({
      face: 'head',
      strict: false,
      ratcheted: null,
      violations: [],
      undetermined: [],
      exempt: { returning: 0, db: 0, outlet: 0, marker: 0 },
      b1Violations: [],
      ...outOver,
      counts: { ...BASE_COUNTS, ...over },
    }).join('\n')
  eq(
    'X3 结论行必须点名 B1 的现读数(违规/放过/裸标记/不判),0 也照喊(不得静默)',
    /B1 假 ack\(判据:违规 0 处 \/ 0 文件,库确认放过 0 · 行内标记 0 只报数,裸标记不计 0,找不到函数体不判 0\)/.test(
      fmtB1(),
    ),
    true,
  )
  eq(
    'X3b 全量档有 B1 违规 ⇒ 逐条点名且不再打"✅ 通过"(B1 是判据,惯例数不动)',
    (() => {
      const t = fmtB1(
        { b1Violations: 2, b1Files: 1, b1Candidates: 2 },
        { b1Violations: [{ file: 'apps/api/src/routes/x.ts', line: 7, receiver: 'db' }] },
      )
      return (
        !/✅ 通过/.test(t) &&
        /B1 假 ack 2 处 \/ 1 文件/.test(t) &&
        /apps\/api\/src\/routes\/x\.ts:7/.test(t) &&
        /^候选 0 \/ 违规 0 \/ 未判定 0 \/ 豁免 0/m.test(t)
      )
    })(),
    true,
  )
  eq(
    'X3c B1 未判定与"通过"各说各话:b1NoBody>0 既不打 ✅ 也必须单列一句未判定',
    (() => {
      const t = fmtB1({ b1NoBody: 3 })
      return !/✅ 通过/.test(t) && /B1 未判定 3 处/.test(t) && /不冒红也不记绿/.test(t)
    })(),
    true,
  )
  eq(
    'X3d staged 判红块按 kind 分列三条判据,措辞不得互相顶账',
    (() => {
      const t = formatReport({
        face: 'staged',
        strict: false,
        ratcheted: [
          { file: 'a.ts', kind: 'count', now: 2, anchor: 1, added: 1 },
          { file: 'b.ts', kind: 'b1', now: 1, anchor: 0, added: 1 },
          { file: 'c.ts', kind: 'b2', now: 1, anchor: 0, added: 1 },
        ],
        violations: [],
        undetermined: [],
        exempt: { returning: 0, db: 0, outlet: 0, marker: 0 },
        b1Violations: [],
        b2Violations: [],
        counts: BASE_COUNTS,
      }).join('\n')
      return (
        t.includes('[计数自算] a.ts') &&
        t.includes('[B1假ack] b.ts') &&
        t.includes('[B2委托假ack] c.ts') &&
        /计数自算 1 · B1 假 ack 1 · B2 委托假 ack 1/.test(t)
      )
    })(),
    true,
  )
  eq(
    'B2fmt 结论行必须现读点名 B2 的五个数(0 也照喊);有 B2 违规或未判定时不得出"✅ 通过"',
    (() => {
      const t0 = fmtB1()
      const t1 = fmtB1(
        { b2Violations: 3, b2Files: 2, b2Candidates: 5 },
        {
          b2Violations: [
            {
              file: 'apps/api/src/routes/y.ts',
              line: 9,
              callee: { file: 'apps/api/src/db/y.ts', name: 'deleteY' },
            },
          ],
        },
      )
      const t2 = fmtB1(
        { b2Undetermined: 4 },
        { b2Undetermined: [{ file: 'a.ts', line: 3, undetermined: [{ kind: 'reexport', name: 'del' }] }] },
      )
      return [
        /B2 委托假 ack\(判据:违规 0 处 \/ 0 文件,候选 0,放过 0 只报数,那一跳解析不到不判 0\)/.test(t0),
        !/✅ 通过/.test(t1) &&
          /B2 委托假 ack 3 处 \/ 2 文件/.test(t1) &&
          /apps\/api\/src\/routes\/y\.ts:9/.test(t1) &&
          /apps\/api\/src\/db\/y\.ts#deleteY/.test(t1),
        !/✅ 通过/.test(t2) && /B2 未判定 4 处/.test(t2) && /reexport/.test(t2),
        // B2 的数不得顶动既有四数与 B1 的那一句(X2b/X3 同一条要求的延续)
        /^候选 0 \/ 违规 0 \/ 未判定 0 \/ 豁免 0/m.test(t1) && /B1 假 ack\(判据:违规 0 处 \/ 0 文件/.test(t1),
      ]
    })(),
    [true, true, true, true],
  )
  eq(
    'S1 词法未闭合 ⇒ 整文件未判定(U2)',
    (() => {
      const r = v("db.delete(t).where(inArray(t.id, ids))\nconst s = '未闭合的串\n")
      return [r.violations.length, r.undetermined.length > 0]
    })(),
    [0, true],
  )
  eq(
    'S2 maskText 保行号(遮蔽不改行数)',
    maskText(FIX.selfCount).text.split('\n').length,
    FIX.selfCount.split('\n').length,
  )
  eq(
    'S3 模块说明符只在保留字符串那一档读得到',
    [
      SPEC_RE.test(maskText(FIX.outlet, { blankStrings: false }).text),
      SPEC_RE.test(maskText(FIX.outlet, { blankStrings: true }).text),
    ],
    [true, false],
  )
  let repoCases = 0
  if (!argv.includes('--no-repo')) {
    const before = R.length
    let dir = null
    try {
      git(['init', '-q'], (dir = mkScratch('bch-self-')))
      git(['config', 'user.email', 'gate@fixture.local'], dir)
      git(['config', 'user.name', 'gate-fixture'], dir)
      const stage = (rel, text) => {
        mkdirSync(join(dir, dirname(rel)), { recursive: true })
        writeFileSync(join(dir, rel), text, 'utf8')
        git(['add', '--', rel], dir)
      }
      const commit = (m) => git(['commit', '-q', '-m', m], dir)
      const X = 'apps/api/src/routes/x.ts'
      stage(X, FIX.selfCount)
      commit('fixture')
      const head = analyze(dir, 'head')
      eq(
        'R1 --root 注入临时仓:HEAD 面点名同一处存量(全量档不拦提交)',
        [head.counts.files, head.counts.violations, head.exit],
        [1, 1, 0],
      )
      stage(X, FIX.returning) // 索引:干净版本
      writeFileSync(join(dir, X), FIX.chainAfter, 'utf8') // 磁盘:第三份(链在 send 之后 ⇒ 未判定)
      const staged = analyze(dir, 'staged')
      const wt = analyze(dir, 'worktree')
      eq('R2 --staged 判索引(干净那份)⇒ 不判红', [staged.counts.violations, staged.exit], [0, 0])
      eq('R3 HEAD 仍是旧的那一处(不被索引/磁盘带跑)', analyze(dir, 'head').counts.violations, 1)
      eq(
        'R4 磁盘面是第三份 ⇒ 未判定 1、违规 0(不记绿)',
        [wt.counts.violations, wt.counts.undetermined],
        [0, 1],
      )
      commit('clean')
      stage(X, FIX.selfCount)
      const back = analyze(dir, 'staged')
      eq(
        'R5 索引把自算计数加回来(HEAD 已 0)⇒ 差值棘轮判红',
        [back.counts.violations, back.exit, back.ratcheted.length],
        [1, 1, 1],
      )
      commit('dirty')
      const flat = analyze(dir, 'staged')
      eq(
        'R5b HEAD 已带该存量、索引持平 ⇒ 不拦(防恒红门)',
        [flat.counts.violations, flat.exit],
        [1, 0],
      )
      stage('apps/api/src/routes/new-one.ts', FIX.selfCount)
      const fresh = analyze(dir, 'staged')
      eq(
        'R5c 新增文件带自算计数(HEAD 无该路径)⇒ 判红',
        [fresh.exit, fresh.ratcheted.length],
        [1, 1],
      )
      // R7 只报数最硬的形式:同面同轮取材 + 聚合,往索引里加一份**只有惯例形态**的文件 ⇒
      // 惯例数被数到,而四个判据数与退出码一字不变(X1 只能证 decide 没接,R7 证整条链都没接)。
      const beforeAck = analyze(dir, 'staged')
      stage('apps/api/src/routes/ack-only.ts', FIX.boolAckCount)
      const afterAck = analyze(dir, 'staged')
      const four = (a) => [
        a.counts.candidates,
        a.counts.violations,
        a.counts.undetermined,
        a.counts.exempt,
      ]
      eq(
        'R7 布尔 ack 现读到 3 处 / 1 文件,四个判据数与退出码一字不变(只报数)',
        [
          afterAck.counts.booleanAckSites,
          afterAck.counts.booleanAckFiles,
          JSON.stringify(four(beforeAck)) === JSON.stringify(four(afterAck)),
          beforeAck.exit === afterAck.exit,
        ],
        [3, 1, true, true],
      )
      eq(
        'R7b 读查询族同理:只顶起 readQueryCountSites,不串到布尔 ack 的账上、也不动判据四数',
        (() => {
          const b = analyze(dir, 'staged')
          stage('apps/api/src/routes/count-only.ts', FIX.readQuery)
          const a = analyze(dir, 'staged')
          return [
            a.counts.readQueryCountSites - b.counts.readQueryCountSites,
            a.counts.booleanAckSites,
            JSON.stringify(four(b)) === JSON.stringify(four(a)),
          ]
        })(),
        [1, 3, true],
      )
      // R8:上面两支都落在"索引里本来就有一处真违规"的那张面上,exit 前后都是 1 ⇒ 看不出惯例计数被接进了
      // 退出码。这一支另起一棵**干净仓**(只有放过的那一处 + 两份纯惯例文件),把 exit 与 --strict exit
      // 钉在 0:变异②(把 booleanAckSites 接进 decide)在这里必读红,而 R7 那一支顶得住。
      eq(
        'R8 干净仓只含惯例形态 ⇒ 计数有值而 exit 与 --strict exit 仍为 0(只报数不是判据)',
        (() => {
          const d2 = mkScratch('bch-conv-')
          try {
            git(['init', '-q'], d2)
            git(['config', 'user.email', 'g@f.local'], d2)
            git(['config', 'user.name', 'g'], d2)
            const st2 = (rel, text) => {
              mkdirSync(join(d2, dirname(rel)), { recursive: true })
              writeFileSync(join(d2, rel), text, 'utf8')
              git(['add', '--', rel], d2)
            }
            st2('apps/api/src/routes/ok.ts', FIX.returning) // 放过的那一处:候选 1 / 违规 0
            st2('apps/api/src/routes/ack.ts', FIX.boolAckCount) // 只含布尔 ack
            st2('apps/api/src/routes/cnt.ts', FIX.readQuery) // 只含读查询 count
            git(['commit', '-q', '-m', 'conventions'], d2)
            const a = analyze(d2, 'head')
            const s = analyze(d2, 'head', { strict: true })
            return [
              a.counts.booleanAckSites,
              a.counts.readQueryCountSites,
              a.counts.candidates,
              a.counts.violations,
              a.counts.undetermined,
              a.exit,
              s.exit,
            ]
          } finally {
            rmScratch(d2)
          }
        })(),
        [3, 1, 1, 0, 0, 0, 0],
      )
      // BR:B1 棘轮四向 —— 存量只报数 / 新增即红 / 改回字面量即红 / 清掉后锚点下降。
      // 另起一棵干净仓:上面那张面上已经叠了惯例文件与真违规文件,锚点序列必须在**只有 B1 形态**
      // 的面上走,否则"exit 前后都非零"会把判红分支的走向糊成不可分辨(与 R8 同一条理由)。
      eq(
        'BR1–BR4 B1 棘轮四向(临时仓端到面):存量报数不红、--strict 问责、新增/改回红、清掉后锚点降',
        (() => {
          const d3 = mkScratch('bch-b1-')
          try {
            git(['init', '-q'], d3)
            git(['config', 'user.email', 'g@f.local'], d3)
            git(['config', 'user.name', 'g'], d3)
            const st3 = (rel, text) => {
              mkdirSync(join(d3, dirname(rel)), { recursive: true })
              writeFileSync(join(d3, rel), text, 'utf8')
              git(['add', '--', rel], d3)
            }
            const X3 = 'apps/api/src/routes/b1.ts'
            st3(X3, FIX.b1FalseAck)
            git(['commit', '-q', '-m', 'b1-debt'], d3)
            const hd = analyze(d3, 'head')
            const hdStrict = analyze(d3, 'head', { strict: true })
            // BR1 存量只报数:HEAD 有 1 处、索引与 HEAD 持平 ⇒ staged exit 0(全量默认档也只报数),
            // 但 --strict 必须 1(它是判据不是惯例;这一条与 X1 对惯例数的要求正好相反,两型不得互抄)。
            const flat = analyze(d3, 'staged')
            // BR2 新增即红:同文件再写一处同型 ⇒ 2 > 锚点 1。
            st3(X3, FIX.b1FalseAckTwice)
            const added = analyze(d3, 'staged')
            // BR3 改回字面量即红的另一半先要在"已改真"上成立:提交修复版 ⇒ 锚点下降到 0。
            st3(X3, FIX.b1Migrated)
            const fixed = analyze(d3, 'staged')
            git(['commit', '-q', '-m', 'b1-fixed'], d3)
            const afterHead = analyze(d3, 'head')
            // BR3/BR4 把已改真的点改回字面量 true ⇒ 1 > 新锚点 0 判红(锚点随清偿自动下降,由这一次
            // 的"红"反证:若锚点还停在旧存量 1,这次改回就不会红)。
            st3(X3, FIX.b1FalseAck)
            const regressed = analyze(d3, 'staged')
            const b1Red = (a) => a.ratcheted.filter((r) => r.kind === 'b1')
            return [
              hd.counts.b1Violations,
              hd.exit,
              hdStrict.exit,
              flat.exit,
              flat.ratcheted.length,
              added.exit,
              JSON.stringify(b1Red(added)[0]).includes('"anchor":1'),
              fixed.exit,
              afterHead.counts.b1Violations,
              regressed.exit,
              regressed.ratcheted.length,
            ]
          } finally {
            rmScratch(d3)
          }
        })(),
        //             HEAD 存量1  默认0  strict1  持平0  持平无红  新增1  锚点=1    修复0   锚点降0   改回1   仅1条红
        [1, 0, 1, 0, 0, 1, true, 0, 0, 1, 1],
      )
      // B2R:B2 端到面 —— 同一棵临时仓里放"调用方 + 被调腿"两个路径,把"摘掉被调腿的 .returning("
      // 这一型在**索引面**上跑成红、在 HEAD 面上只报数。这是 B2 的装车证明:构造面只证明函数会给
      // 答案,"有人问了它"要靠真走一遍 analyze 的同面两遍取材(守门 118 的半接线同型)。
      eq(
        'B2R1–R6 端到面:HEAD 存量不红 / --strict 红 / 持平 0 / 补回 .returning( 即归零 / 摘掉必红且落在调用方 / 被调腿整文件不在面上⇒未判定不判红',
        (() => {
          const d4 = mkScratch('bch-b2-')
          const C4 = 'apps/api/src/routes/b2-caller.ts'
          const K4 = 'apps/api/src/db/b2-queries.ts'
          try {
            git(['init', '-q'], d4)
            git(['config', 'user.email', 'g@f.local'], d4)
            git(['config', 'user.name', 'g'], d4)
            const st4 = (rel, text) => {
              mkdirSync(join(d4, dirname(rel)), { recursive: true })
              writeFileSync(join(d4, rel), text, 'utf8')
              git(['add', '--', rel], d4)
            }
            // 夹具里的路径常量按真实仓形状拼,这里把两个夹具文件改成临时仓里的落点。
            const caller = (calleeRel) =>
              B2FIX.delegated.replace(
                "from '../db/b2-queries.js'",
                `from '${calleeRel}'`,
              )
            st4(C4, caller('../db/b2-queries.js'))
            st4(K4, B2FIX.calleeNoReturning)
            git(['commit', '-q', '-m', 'b2-debt'], d4)
            const hd = analyze(d4, 'head')
            const hdStrict = analyze(d4, 'head', { strict: true })
            const flat = analyze(d4, 'staged')
            st4(K4, B2FIX.calleeReturning) // 第二十六批产出的形态
            const fixed = analyze(d4, 'staged')
            git(['commit', '-q', '-m', 'b2-fixed'], d4)
            st4(K4, B2FIX.calleeNoReturning) // 回退:调用方一个字没动
            const regressed = analyze(d4, 'staged')
            const b2Red = (a) => (a.ratcheted || []).filter((x) => x.kind === 'b2')
            git(['commit', '-q', '-m', 'b2-restored', '--', K4], d4)
            // 被调腿整个不在 HEAD 面上(别人还没 add 的在途文件)⇒ 那一跳判不出 ⇒ 未判定,不判红
            git(['rm', '-q', '--cached', '-r', '--', 'apps/api/src/db'], d4)
            git(['commit', '-q', '-m', 'drop-callee'], d4)
            const gone = analyze(d4, 'head')
            return [
              hd.counts.b2Violations,
              hd.exit,
              hdStrict.exit,
              flat.exit,
              fixed.counts.b2Violations,
              fixed.exit,
              regressed.exit,
              b2Red(regressed).length,
              b2Red(regressed)[0]?.anchor,
              b2Red(regressed)[0]?.now,
              // 只有被调腿变了 ⇒ 红点必须落在**调用方**文件上(它才是那条假 ack 的主人)
              b2Red(regressed)[0]?.file,
              `${gone.counts.b2Violations}/${gone.counts.b2Undetermined}/${gone.exit}`,
            ]
          } finally {
            rmScratch(d4)
          }
        })(),
        [1, 0, 1, 0, 0, 0, 1, 1, 0, 1, 'apps/api/src/routes/b2-caller.ts', '0/1/0'],
      )
      const empty = mkScratch('bch-empty-')
      try {
        git(['init', '-q'], empty)
        git(['config', 'user.email', 'g@f.local'], empty)
        git(['config', 'user.name', 'g'], empty)
        mkdirSync(join(empty, 'docs'), { recursive: true })
        writeFileSync(join(empty, 'docs/a.md'), 'x\n', 'utf8')
        git(['add', '-A'], empty)
        git(['commit', '-q', '-m', 'empty'], empty)
        let threw = ''
        try {
          analyze(empty, 'head')
        } catch (e) {
          threw = e instanceof Undetermined ? 'undetermined' : `other:${e?.message}`
        }
        eq('R6 枚举到 0 个候选文件 ⇒ 判死而非记绿', threw, 'undetermined')
      } finally {
        rmScratch(empty)
      }
    } catch (e) {
      R.push(`❌ 端到端夹具跑挂了:${e?.message ?? e}`)
    } finally {
      if (dir) rmScratch(dir)
    }
    repoCases = R.length - before
  }
  for (const r of R) console.log(r)
  const failed = R.filter((r) => r.startsWith('❌')).length
  console.log(
    failed
      ? `❌ self-test 失败 ${failed}/${R.length} 条`
      : `✅ self-test 全通过(${R.length} 条 = 构造面 ${R.length - repoCases} + 临时 git 仓端到面 ${repoCases})`,
  )
  return failed ? 1 : 0
}

/** 自检夹具仓专用的 git(绝对路径 + windowsHide + timeout;真仓判定面一律走 face-reader)。 */
function git(args, cwd) {
  return execFileSync(gitBinary() || 'git', ['-c', 'safe.directory=*', '-C', cwd, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 32 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

// §22d:CLI 直接执行才跑主流程;被镜像测试 import 时不得有副作用。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    console.error(`[${GATE}] 脚本自身异常:${e?.message}\n${e?.stack}`)
    process.exitCode = 2
  }
}

export const __test__ = {
  // 判据只此一份实现:镜像测试与自检都从这里取,不得在测试里再抄一份(§22c)。
  // findBooleanAckSends / sendSuccessObjects 也在这里 —— 惯例计数的取材与违规判据共用同一遍 send 扫描,
  // 镜像测试要复核"数到了什么"只能调这两个出口,不得自己再写一份正则。
  // B1 同族:findBoolAckB1Sites 吃 findBooleanAckSends 的落点清单,豁免判法与判据一共用
  // readExemptMarker(换 token 不换实现)—— 测试不得另写"裸标记放不放行"的第二把尺子。
  maskText,
  findWriteChains,
  findFunctionBodies,
  findCountSends,
  findBooleanAckSends,
  findBoolAckB1Sites,
  sendSuccessObjects,
  readExemptMarker,
  scanFileText,
  listCandidates,
  readCandidates,
  analyze,
  decide,
  formatReport,
  FIXTURES: FIX,
  SELF_SKIP,
  UNIQUE_OUTLET,
  EXEMPT_TOKEN,
  DELETE_ACK_EXEMPT_TOKEN,
  SCAN_DIRS,
  // B2 同族:一跳委托的两侧取材与判定都必须从这里取(镜像测试不得另写一份 import 解析或导出索引)。
  parseImportBindings,
  moduleSpecCandidates,
  indexExportedFns,
  planDelegatedAckSites,
  finishDelegatedAckSite,
  aggregateB2,
  listFacePaths,
  readCalleeTexts,
  scanFaceBundle,
  B2_FIXTURES: B2FIX,
  B2_CALLER,
  B2_CALLEE,
  API_SRC_DIR,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
