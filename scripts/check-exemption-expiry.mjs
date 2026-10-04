// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 豁免到期账(exemption expiry ledger)—— 独立一道门,不塞进守门 103。
//
// 为什么要有它:本仓 100+ 道守门几乎每道都留了行内豁免出口(`*-exempt: <原因>`),那是防
// "恒红逼人 --no-verify" 的必要设计(本仓最高频教训)。代价是**豁免只有出生、没有死亡**:
// 立票时实测 HEAD 面 12 类标记、248 处、105 个文件(现值一律跑 `--all` 看末行,不得照抄这
// 个数 —— 本门自己的夹具里就带标记字符串,数字会随每次提交变),**带到期日 0 处**(规格写
// "1 处",那 1 处是 `scripts/_i18n-scan-helpers.mjs:449` 的散文引用 —— 日期在标记**之前**,
// 不是任何一笔豁免的到期日)。没有任何机器判据知道某条豁免是为了绕哪一次事故、该什么时候销账。
//
// 三条判据(必须与"防恒红"同时成立):
//   E1 新增豁免不带到期日 → 红。棘轮锚点 = 基线里该 (文件,族) 的**无日期存量数**,所以存量
//      248 处全部只报数、不判红(否则本门上线当场恒红 = 没有门)。
//   E2 已到期的豁免仍在生效 → **无条件红**,基线救不了它。这是"临时豁免=借来的时间"与
//      "永久出口"的分界:到期即把"已豁免"变回"新的"。
//   E3 基线自身带到期日 grandfatherUntil → 过期仍有无日期存量时整门判红。这一条让"过期未
//      销账**自己**变红",否则 E1 的棘轮就成了新的永久出口。
//   E5 新增 lint 抑制(eslint-disable / @ts-ignore)不带同行到期豁免 → 红上棘轮,锚点 =
//      max(基线, HEAD 现测);存量只报数,HEAD 锚点取不到时退回只报数(G-666)。
//
// 记账面只覆盖**被豁免的那一侧**:HEAD 面实测 372 条标记里有 125 条(34%)落在 `scripts/**`,
// 那一面上的标记是"门在描述自己的出口"(正则定义 / 头注 / 自检夹具),不是一次正在生效的豁免。
// 把它们入账的后果是 E1 在**任何新增一道带豁免出口的门**的那枚提交上必红(锚点 = 该文件 HEAD
// 自身的 0,而门必须写出标记形状才能工作 ⇒ 没有合法出口),且 E3 的宽限期永远销不完。
// 详见 TOOL_FACE_RE 注释与 G01–G03b 成对用例。
//
// 第二类账(规格 §7 + G-666 的 E5):lint 抑制面 eslint-disable / @ts-ignore。实测
// 312 处 / 260 文件(md 除外),一次全额判红必然逼人绕钩子;原只走"只减不增"的可见性棘轮
// 不计红,但守门 34 是 warn、本门 E3 只报数 ⇒ "新增一条无到期豁免的抑制"长期无闸。G-666 起
// 升级为 **E5 棘轮判红**:锚点 = max(基线 suppressionUndatedCounts, HEAD 现测),新增须同行带
// `until YYYY-MM-DD`,存量照旧只报数;HEAD 锚点取不到时退回只报数(宁漏判不恒红,G-174 同款)。
// 独立键空间 suppressionUndatedCounts,kind(eslint-disable/ts-ignore)不是豁免族名 ——
// 不得混入 undatedCounts(会被 E1 连带判红 / 被 mergeBaseline 的族清除误清),也不参与族清除。
// 规格明写"不得独立新建第二道同类门",所以判据仍落在本门内。
//
// 各族真实语法差异(判据必须容得下,拿一种正则统一扫会同时产出假红与假绿):
//   · 挂靠两种 —— **同行尾注释**(radius 绝大多数)与**紧邻上一行**独立注释(77 :259、
//     93 :885、81 :283、门 52 配套那处 :223 都显式读 lines[idx-1])。两种都要认,且到期日挂在
//     **标记所在行**,不是被豁免的那行代码。
//   · `*-exempt-file:`(i18n-content-exempt-file:)是**文件级**声明,守门 70 还要求理由 ≥12 字
//     (scan-hardcoded-zh.mjs:90)→ 按文件计一笔,不得按出现次数计。
//   · ihui-allow-important 拼写不同(前缀 `--`、只认同行,check-no-important.mjs:35),套不进
//     `-exempt` 正则。
//
// 判据红线:只判、只报,**永不改文件、永不自动删豁免行**(自动删 = 把别人欠的债当场变成红,
// 等价制造恒红门)。唯一写盘动作是 --update-baseline,且是"并集 + 只下调"。
//
// 用法:node scripts/check-exemption-expiry.mjs [--all|--json|--staged|--worktree|--self-test
//       |--update-baseline|--root <dir>]
// 退出码:0 通过 / 1 判据红 / 2 无法判定(取材失败,不冒红也不记绿)。
// 接线由主会话统一做(guardian-runner 取当时最大 id+1、blocking、skipEnv
// HUSKY_SKIP_EXEMPTION_EXPIRY=1);本文件自身不提供任何绕过钩子的开关。

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitBinary,
  gitErrText,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const GIT_BIN = gitBinary()
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_REL = 'scripts/exemption-expiry-baseline.json'
/** 未登记族的默认存活期(天)。刻意给一个值而不是"无限期"——本门的存在理由就是没有永久出口。 */
const DEFAULT_LIFETIME_DAYS = 90
/** 已知族的建议存活期(天)。改这里就是改策略,不得在各门里各抄一份。 */
const FAMILY_LIFETIME_DAYS = {
  /**
   * 圆角的两个豁免族(角色档那一族与档位表那一族)已于 2026-09-29 O81 票㊵ **整体移除**:
   * 项目定档「不允许有任何豁免」,而留在表里就等于本门还在替一条不存在的出口背书 —— 豁免账的
   * 登记表只能是"合法出口的清单",不能是"历史名字的纪念馆"。判红由守门 77 的 B8 接手
   * (写这条标记本身就是违规,而不是"写了之后有 90 天寿命")。
   * 表里若再出现它们,即"通道被悄悄接回来",由门 77 的镜像 T-B8 与本门的族表用例各拦一半。
   */
  'arch-exempt': 90,
  // 守门「教育欠费口径单一出口对账」(check-edu-arrears-single-source)的行内出口:
  // 豁免的是"这里确实需要在出口外表达一次欠费"的待偿算法债,出路只有把算式并入出口或
  // 引用 arrearsSqlExpr()/hasArrearsCond() 两条,所以取最短档 30 天,到期由人重新定性。
  // 同笔登记的理由:一条没有到期档的豁免出口 = 无人看管的出口,而守门 108 对未登记族
  // 只报数不判红,账面看起来是绿的。
  'arrears-single-source-exempt': 30,
  'ihui-allow-important': 90,
  'brand-mail-exempt': 30,
  // 守门 137(名字承诺/实现兑现对账)的行内出口:豁免的是"命名没错、判据看不见"的那一类,
  // 命名债本身必须改名收口而不是靠它遮 —— 所以给最短档 30 天,到期由人工重新定性。
  'digest-name-exempt': 30,
  'statusbar-exempt': 30,
  'glyph-arrow-exempt': 30,
  'alpha-plugin-exempt': 30,
  'r5-cta-exempt': 60,
  // 入站契约豁免族(G-674 的出口):30 天 —— 它是**待偿的契约债**(出路只有补 .strict()/z.strictObject,
  // 或删掉这条静默接受未知字段的入站面),不是结构性定性;到期只判红点名、绝不自动摘除。
  'inbound-strict-exempt': 30,
  'r3-cta-exempt': 60,
  'r7-nest-exempt': 60,
  /**
   * 守门 93 R8(手抄色值对账)的合法例外通道:某处确实要写死一个"源头已有"的色值时,
   * 必须写 `handcopy-token-exempt: <原因>`。取 **60 天**,与同门的 `r5-cta-exempt` /
   * `r7-nest-exempt` 同档 —— 它和那两条是同一类东西:**待偿的迁移债**(改调用点要跨包回归,
   * 所以比 `glyph-arrow-exempt` 的 30 天长),而不是 `back-label-exempt` 那种"结构性定性"
   * (那种取 365,短到期只会逼人删标记、删了又被原判据红,两道门互咬)。
   */
  'handcopy-token-exempt': 60,
  /**
   * 守门 83 R8(描边不得取墨档)的合法例外通道。取 **30 天**,与 `glyph-arrow-exempt` /
   * `statusbar-exempt` 同档 —— 这一族的典型用法是**待偿**:该处确实要留一道墨色边,但要改成
   * `border.*` / `brandAccent.*` 或干脆删掉(零消费者死件),所以短周期逼办。
   * 2026-09-26 之前它一直是**未登记族**(走 90 天默认值)—— 不是没人用它,是它从没被策略化。
   * 登记时 HEAD 面实有 4 处:2 处属零消费者死件(30 天等删除票),2 处属 Switch 新拟态定稿
   * (框与 3px 硬投影同色才成立体感,改档即破定稿)—— 后者按 `back-label-exempt` 的同一道理
   * 显式写 365 天:**结构性定性**给短周期,只会逼人删标记、删了又被 R8 判红,两道门互咬。
   * 族值管"新增时建议多久",显式 `until` 管"这一处实际到什么时候"。
   */
  'border-ink-exempt': 30,
  /**
   * 守门 131(RN 函数形态 style 被 cssInterop 吃掉)的合法例外通道。取 **30 天**,与
   * `glyph-arrow-exempt` / `statusbar-exempt` 同档 —— 它是**待偿的迁移债**(改回数组形态
   * 要顺带给按压反馈找落点,可能涉及组件结构),不是"结构性定性";写长周期会让人把
   * 一处本该改掉的写法永久留在树上。
   */
  'interop-style-exempt': 30,
  // 守门 135 的行内出口:同一条"豁免不得只出生不死亡"规矩,30 天(与它守的那一型同寿命档 ——
  // 迁移是排期活,不是结构性定性,所以不取 back-label-exempt 的 365 天)
  'api-error-exempt': 30,
  /**
   * 守门 `check-error-code-not-text-matching`(G-710:失败码不得由文本决定)的行内出口。
   * 取 **30 天**,与 `api-error-exempt` / `interop-style-exempt` / `border-ink-exempt` 同档 ——
   * 这一族豁免的是**待偿的补码债**:那一处确实只能按上游文本判定(第三方驱动/CLI 没给错误码),
   * 出路只有两条 —— 给抛出方补 `ToolError(code, …)`,或把判定挪到结构化字段(`errorCode` / `status`)。
   * 不给长周期:本票立项的原因恰恰是"文本判分支活得比它服务的契约长",365 天等于把它登记成永久惯例;
   * 也不走 `DEFAULT_LIFETIME_DAYS` 的 90 天默认档(没人给它拍过寿命)。
   * 判据侧要求带原因、只救本行与紧邻上一纯注释行(与 135/131 同一条收紧)。
   */
  'error-code-exempt': 30,
  /**
   * 双层页头对账(check-rn-double-header,判据 DH1/DH2)的行内出口。取 **30 天** —— 它豁免的是
   * "这一处确实要两条 chrome,但收口要动共享屏的 props 契约"的**待偿迁移债**(共享侧补抑制通道
   * 再在调用点传入),不是 `back-label-exempt` 那种结构性定性:给长周期等于把双层页头登记成永久惯例,
   * 而它的故障形态(同屏两条页头 + 抽屉/返回键被压在下面)正是用户实拍要消灭的那个。
   * 判据侧要求带原因、只本行与紧邻上一纯注释行生效。
   */
  'double-header-exempt': 30,
  /**
   * 桌面端事件链路接线守门(`check-desktop-event-wiring.mjs` 规则 **G9**)的行内出口:
   * 「这一处整页导航确实不需要先触发存草稿」(典型:冷启动首屏尚未渲染、离线兜底页本身没有
   * 输入框)。取 **30 天**,与 `interop-style-exempt` / `api-error-exempt` /
   * `double-header-exempt` 同档 —— 它是**待偿债**:正当出路是在发起点前补
   * `.emit("desktop-before-close", …)` 或调同一个草稿落盘出口,而不是把这条导航永久登记成惯例。
   * 刻意**不取** `back-label-exempt` 的 365 天:那一族是"这个位置的「返回」是按钮文案"式的
   * 结构性定性(位置性质不随时间改变),而"这条导航要不要存草稿"会随功能变化(输入框一
   * 进到那个页面,豁免就该到期重判)。判据侧要求带原因、只本行与紧邻上一行生效。
   */
  'page-nav-exempt': 30,
  /**
   * 守门 156(自检登记函数求值对账 `check-selftest-registrant-evaluates`)的行内出口。取 **30 天** ——
   * 它是**待偿债**:该出口只救"这一处登记函数确实不求值"的情况,出路是把登记侧改成求值或直接传
   * 函数结果(门自己头注写的两条正当形态),不是 `back-label-exempt` 那种结构性定性(那种取 365,
   * 短周期到期只会逼人删标记、删了又被原判据红,两道门互咬)。刻意不给 `DEFAULT_LIFETIME_DAYS`
   * 的 90 天默认档:156 与它守的那一型同走"先报数、存量清零后才谈 blocking"的路线,豁免档必须
   * 与那条路线同寿命 —— 给长周期等于把一处"暂时不求值"登记成永久惯例。判据侧要求带原因、只救本行。
   */
  'selftest-registrant-exempt': 30,
  /**
   * 守门 157(`check-credential-presence-bypass.mjs`,按凭据存在性豁免对账)的行内出口。取 **30 天**
   * —— 它是**待偿的裁决债**:该出口只救"这一处确实只按存在性判定、且有别的不变量兜住"的情况,
   * 出路是把验真补进条件(`===` / `secretsEqual` / `timingSafeEqual` / `isVerified…`),或改走台账
   * `scripts/data/credential-presence-exemptions.json` 的 `file + anchor + reason + reviewBy`
   * (那条有独立的复核日,不归本表管)。不是 `back-label-exempt` 那种结构性定性,所以不取 365;
   * 更不取 `DEFAULT_LIFETIME_DAYS` 的 90 天默认档 —— 默认档意味着"没人给它拍过寿命",而这一族
   * 豁免的是鉴权路径上的一次跳过,寿命必须由被豁免的那一侧决定(§5「认证不等于授权」同族)。
   * **同笔登记的真正理由**:本族若不在表里,任何人在 `apps/api` 写第一次行内豁免都会被守门 157 的
   * 邻居 E4 判成"新引入的未登记豁免族"—— 一道门自己的合法出口被另一道门钉红,就是本节上面反复
   * 写的"两道门互咬"(radius-role-exempt / border-ink-exempt 都记过同一课)。
   */
  'credential-presence-exempt': 30,
  /**
   * `check-batch-write-count-honesty` 的 B1/B2 判据(假删除 ack)的合法例外通道:确属"该 delete/update
   * 由触发器/UPSERT 语义保证必命中一行"时才允许保留字面量 `deleted: true`。取 **30 天**,与
   * `glyph-arrow-exempt` / `statusbar-exempt` / `api-error-exempt` 同档 —— 这一族是**待偿的迁移债**,
   * 不是结构性定性:并行改造正把"无条件回已删"的端点逐批改回库里真删一行
   * (`.returning()` / `batchWriteOutcome()`),行内标记只是给同批次来不及迁的点的临时落脚点;
   * 给长周期等于把"假 ack"登记成永久惯例,而它的故障形态(删不存在的行也回"已删除")恰是
   * 拍板要消灭的那个。判据侧要求带原因、只本行生效。
   * ⚠️ 本条曾被 `518c5d56942`(守门 135 上线)从一份滞后基线整块回写时抹掉 —— 该提交在这个文件里
   * 只加了自己那 3 行、连带删掉本表的 10 行(取证:`git show 518c5d56942 -- <本文件>`)。
   * 发现方式不是人眼,是守门 134 的镜像锁 M15(它断言"登记的豁免族必须在存活期表里且取 30 天")。
   * **所以这条注释的作用是:让下一次有人整文件重写这里时,红点能立刻对上"这不是原始版本"。**
   */
  'delete-ack-exempt': 30,
  /**
   * 守门 146(README 表格完整性对账)的行内出口:某一格确实要塞长文时,写
   * `<!-- table-cell-exempt: <原因> -->` 只救本 run。取 **30 天** —— 它是**待偿的改写债**
   * (内容该挪出表格或拆条目),不是结构性定性;长周期等于把碎表登记成永久惯例。
   */
  'table-cell-exempt': 30,
  'rust-state-exempt': 60,
  'i18n-content-exempt-file': 180,
  /**
   * 守门 102 GA4 的合法例外通道：该位置的「返回」是按钮文案(错误态卡片/翻页/弹窗关闭)，
   * 不是页头导航箭头。取 365 天而非同门的 30 天 —— 它是**结构性定性**而不是待偿债务，
   * 位置性质不随时间改变；短周期到期会逼人删标记，删了就被 GA4 判红，两道门互咬
   * (恒红门的结局是跳门、连带全部守门作废 —— §12e 同型)。
   */
  'back-label-exempt': 365,
  /**
   * 守门 102 GA6 的合法例外通道:该页页内的"返回"回退的是**面板内局部 state**而不是路由栈,
   * 原生导航栏结构上退不了它,所以这一屏的"页内返回 affordance"不是重复箭头而是另一个东西。
   * 与 back-label-exempt 同取 365 天而不是同门的 30/90 —— 它同样是**结构性定性**(页面有几个
   * 视图不随时间改变),短周期到期只会逼人删标记,删了就被 GA6 判红,两道门互咬(§12e 同型)。
   * 判据侧要求带原因,且 GA6 是文件级豁免:它的"错"是页面配置 × 页面渲染的组合,不落在某一行上。
   */
  'nav-chrome-exempt': 365,
  /**
   * 守门 128 的 IC 判据(图标载体对账)的合法例外通道:确属**多色品牌插画**而不是功能图标时
   * 才允许保留 CDN 位图。取 365 天而不是 30/90 —— 与 back-label-exempt / nav-chrome-exempt 同因:
   * 一张插画是不是"UI 图标"由它的用途决定,是**结构性定性**,不随时间改变;短周期到期只会
   * 逼人删标记,删了又被 IC 判红,两道门互咬(§12e 同型)。判据侧要求带原因。
   */
  'icon-bitmap-exempt': 365,
}
/** 标记词表按**形状**发现而不是白名单:清单会腐烂,新门刚加的族必须当天就被看见。 */
const MARKER_RE = /(?:[a-z][a-z0-9-]*-exempt(?:-file)?|ihui-allow-important)\s*:/gi
const DATE_RE = /(20\d{2})-(\d{2})-(\d{2})/
/**
 * 预筛模式串必须是判据的严格超集(筛不动 = 整类隐身)。两个 git 专属陷阱,写门当场各踩一次:
 *   ① git 的 -E 是 **POSIX ERE**,不支持 `(?:...)` —— 用了整条 grep 直接失败,而失败会被上层
 *      读成"取材失败"而不是"判据写错了";
 *   ② 模式串以 `-` 开头会被当成**选项**,必须 `-e <pattern>` 显式分隔。
 */
const PREFILTER_RE = '-exempt|ihui-allow-important|eslint-disable|@ts-(ignore|nocheck)'
/**
 * 自豁免:本门自己的源文件与镜像测试**必然**含标记字面量(每条判据都要造正反例),
 * 把它们记进账里 = 判据把自己的夹具当成债务。写门当场就被自己咬了 2 条 E2 红
 * (`until 2020-01-01` 那两条就是阳性对照用的假日期)。口径照守门 79 的 SELF_EXEMPT 先例:
 * **只按文件身份豁免这两份**,不是"scripts/ 下都不算"。
 */
const SELF_EXEMPT_RE = /^scripts[/\\](?:tests[/\\])?check-exemption-expiry(?:\.test)?\.mjs$/
/**
 * 「工具面」= 规则本身与它的镜像测试(`scripts/**`)。这一面上的标记字面量是**说明书、判据正则、
 * 自检夹具**,不是一次正在豁免代码的声明 —— HEAD 面实测 372 条里有 **125 条(34%)** 落在这一面
 * (门 103 的 7 条 arch-exempt、门 81 的 8 条 brand-mail、门 93 镜像测试里 4 条喂 R8 判据的字符串
 * 夹具……逐条读明都是"门在描述自己"),把它们记进债务账的后果有两个:E1 会在**任何新增一道带豁免
 * 出口的门**的那枚提交上判红(锚点是该文件 HEAD 自身的 0,而门必须写出标记形状才工作 ⇒ 没有合法
 * 出口,只能绕钩子),E3 会让宽限期永远销不完( prose 不是待偿债务)。
 *
 * 与 `SELF_EXEMPT` 的分工:那条是"本门不得把**自己的夹具**判成已过期"(文件身份,两处),本条是
 * "账只记**被豁免的那一侧**"(面,按路径形状)。两者方向不同且都不越界:本条**不**豁免 apps/ 与
 * packages/ 里的任何一条,所以 G02/G03 成对用例钉的是"同一行文字换个路径就必须入账"。
 */
const TOOL_FACE_RE = /^scripts\//
/**
 * 「存档面」= `.ihui-agent/archive/**` 里那些**被逐字搬走的原文副本**(AGENTS §1 的归档机制:删除
 * 必须走"搬到归档件 + 留占位",且归档锚点必须受版本控制,否则"A 机归档过"能授权"B 机删行")。
 * 归档件里的一行 `alpha-plugin-exempt: … until 2026-09-25` 描述的是一条**已撤销的豁免** ——
 * 它是历史证词,不是当下生效的出口。把它算进 E2 会让"把归档锚点入库"这个正确动作当场变红,
 * 于是门替人做出"别把证据入库"的选择(实测:枚 f2b06a395 把 3 份 09-26 去重归档件入库后,
 * E2 立刻在 `PROJECT_PLAN_dedup-2026-09-26.md.new:661` 判红一条到期豁免)。
 * 边界由 G09/G10 与镜像 T25 成对钉住:**活文件**里同一条过期豁免必须照旧无条件判红。
 */
const ARCHIVE_FACE_RE = /^\.ihui-agent\/archive\//
const SUPPRESS_KINDS = {
  'eslint-disable': /\beslint-disable(?:-next-line|-line|-unrestricted)?\b/g,
  'ts-ignore': /@ts-(?:ignore|nocheck)\b/g,
}

// ------------------------------------------------------------ 扫描(纯函数)

/** 该标记是否"独立成行"(= 挂靠方式是"紧邻上一行"而非同行尾注释)。 */
function isStandaloneComment(line, markerStart) {
  const before = line.slice(0, markerStart).trim()
  if (before === '') return true
  return /^(?:\/\/|\/\*|<!--|\*|#|--(?!\s*ihui-allow-important))\s*$/.test(before)
}

/** 取标记之后的到期日与理由。理由 = 冒号后至行尾(剥掉日期片段)。 */
function parseMarkerTail(line, markerStart, markerLen) {
  const tail = line.slice(markerStart + markerLen)
  // 先认显式 `until <日期>` —— 它才是"这一处实际到什么时候"(本节上方族值/显式 until 的分工)。
  // 只取"标记后的第一个日期"是有缺陷的口径:理由里常自带事件日期(如"2026-09-26 扩判据后暴露的
  // 既有定稿 … until 2027-09-26"),于是**理由里的日期被当成到期日**,一条本来还有三年的豁免
  // 第二天就把整道 blocking 门钉红 —— 而这条门的红不等于任何人的代码有问题,唯一结局是各会话
  // 跳门、连带全部守门作废(§12e 同型)。没有 until 时仍退回"第一个日期"(存量都是那型)。
  const explicit = /until\s+(20\d{2}-\d{2}-\d{2})/i.exec(tail)
  const dm = (explicit ? new RegExp(DATE_RE.source).exec(explicit[1]) : null) || DATE_RE.exec(tail)
  let expiry = null
  if (dm) {
    const mo = Number(dm[2])
    const dy = Number(dm[3])
    // 非法月日必须判"没有日期"而不是 NaN 比较(NaN 与任何日期比较都是 false ⇒ 永不红)
    if (Number(dm[1]) >= 2000 && mo >= 1 && mo <= 12 && dy >= 1 && dy <= 31) expiry = dm[0]
  }
  const reason = tail
    .replace(/\b20\d{2}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\buntil\s+/i, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return { expiry, reason }
}

/** 扫单个文件内容 → 豁免账条目 + 抑制计数。纯函数,不碰文件系统。 */
export function scanFile(rel, text) {
  const entries = []
  const suppressions = {}
  const suppressionUndated = {}
  if (typeof text !== 'string' || text === '')
    return { entries, suppressions, suppressionUndated }
  const toolFace = TOOL_FACE_RE.test(String(rel).replace(/\\/g, '/'))
  const archiveFace = ARCHIVE_FACE_RE.test(String(rel).replace(/\\/g, '/'))
  const seenFileScoped = new Set()
  for (const [i, line] of String(text).split(/\r?\n/).entries()) {
    if (!line) continue
    for (const [kind, re] of Object.entries(SUPPRESS_KINDS)) {
      const probe = new RegExp(re.source, 'g')
      let m
      while ((m = probe.exec(line)) !== null) {
        suppressions[kind] = (suppressions[kind] || 0) + 1
        // G-666:同行带 `until <日期>` 的抑制算"有到期豁免",否则进无日期账(E5 的观测面)。
        // 行粒度与豁免账的 attach 语义一致 —— 日期挂抑制所在行,不挂被豁免的代码。
        if (!/until\s+20\d{2}-\d{2}-\d{2}/i.test(line)) {
          suppressionUndated[kind] = (suppressionUndated[kind] || 0) + 1
        }
        if (m[0].length === 0) probe.lastIndex += 1
      }
    }
    MARKER_RE.lastIndex = 0
    let mm
    while ((mm = MARKER_RE.exec(line)) !== null) {
      const family = mm[0].replace(/:\s*$/, '').toLowerCase()
      const { expiry, reason } = parseMarkerTail(line, mm.index, mm[0].length)
      const fileScoped = /-file$/.test(family)
      if (fileScoped) {
        if (seenFileScoped.has(family)) continue
        seenFileScoped.add(family)
      }
      entries.push({
        file: rel,
        family,
        line: i + 1,
        attach: isStandaloneComment(line, mm.index) ? 'prev-line' : 'inline',
        expiry,
        hasReason: reason.length > 0,
        fileScoped,
        toolFace,
        archiveFace,
        lifetimeDays: FAMILY_LIFETIME_DAYS[family] ?? DEFAULT_LIFETIME_DAYS,
        registered: isFamilyRegistered(family),
      })
    }
  }
  return { entries, suppressions, suppressionUndated }
}

/** UTC 日期差(天)。只用 YYYY-MM-DD 解析,避免时区/夏令时把到期日挪一天。 */
function dayDiff(fromIso, toIso) {
  const a = Date.parse(`${fromIso}T00:00:00Z`)
  const b = Date.parse(`${toIso}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / 86400000)
}

/**
 * "某日期是否已过去"的**唯一**出口。收成一条而不是在两处各写一次 `dayDiff(...) < 0`:写门时
 * 这里正是把方向弄反了一次,表现是 9 条自检一起红(E2 永不命中 + E3 每轮必红 = 一道恒红门)。
 * 方向由 D01–D03 钉死。约定:到期日**当天仍有效**,次日才判红。
 */
function isPast(iso, today) {
  const d = dayDiff(today, iso)
  return d !== null && d < 0
}

// ------------------------------------------------------------ 判定(纯函数)

/** 核心判据:输入"某一面的全部条目 + 基线 + 今天",输出红 / 软账 / 计数三分离。 */
/**
 * (文件,族) → 账键的**唯一**算法。analyze / writeBaseline / HEAD 锚点三处都要算它,
 * 各写一份字符串拼接必漂移(本仓最高频的那类失效)。
 */
export function undatedKey(e) {
  return `${e.file}::${e.family}`
}

/** 一组账条目 → 每 (文件,族) 的无日期计数。E1 的观测面与 HEAD 锚点面共用它。
 *  工具面(`scripts/**`,见 TOOL_FACE_RE)不入账 —— 观测侧与锚点侧走同一个函数,所以这一条
 *  改动对 E1 是**对称**的:不会出现在"锚点按新口径算、观测按旧口径算"的错位假红。 */
export function undatedCountsOf(entries) {
  const out = {}
  for (const e of entries) {
    if (e.expiry || e.toolFace || e.archiveFace) continue
    const k = undatedKey(e)
    out[k] = (out[k] || 0) + 1
  }
  return out
}

/**
 * 族是否已登记 —— "登记"的唯一真相源就是 FAMILY_LIFETIME_DAYS 的键集,判法只许这一处。
 * scanFile 的 `registered` 标记与 E4 的集合判据都走它:两处各写一次 `hasOwnProperty` 早晚会漂,
 * 而漂了的后果是"门给自己发合格证"(观测侧认为已登记、E4 侧认为没有,或反过来)。
 */
export function isFamilyRegistered(family) {
  return Object.prototype.hasOwnProperty.call(FAMILY_LIFETIME_DAYS, family)
}

/**
 * 一组账条目 → **被豁免侧**(非工具面)用到的未登记族集合。E4 的观测面与 HEAD 锚点面共用它 ——
 * 两侧必须同一个函数,否则"观测按新口径、锚点按旧口径"就产出一条没有合法出口的假红
 * (与 undatedCountsOf 那条 G01/G02 对称性同一条规矩)。
 * 登记与否按 `isFamilyRegistered` 现读,不读条目上的 `registered` 旗 —— 构造面少给一个字段就会
 * 让已登记族被算成未登记(U07 是这一格的阳性对照:判据不得依赖调用方记得填的旗)。
 * 刻意排除工具面:`scripts/**` 里的标记字面量是门在描述自己的出口(判据正则 / 头注 / 自检夹具),
 * 新立一道带豁免出口的门必然先在那一面写出族名,把它算成"用了一次未登记豁免"就等于没有合法出口。
 */
export function unregisteredUsedFamiliesOf(entries) {
  const out = new Set()
  for (const e of entries) {
    if (e.toolFace || e.archiveFace || isFamilyRegistered(e.family)) continue
    out.add(e.family)
  }
  return out
}

/**
 * E1 的锚点到底取哪一份计数 —— 抽成纯函数,好让三种情形都能被单测钉住
 * (证明锚点/取材面这类行为不能依赖仓库瞬时状态,见守门 103 的同款教训)。
 *
 *  - **面 = head(全量审计)**:"本次"就是 HEAD 自己,锚点必须等于观测值 ⇒ E1 在该档结构上
 *    不响。不是放水:E1 的语义是"相对前一状态新加了不带到期日的豁免",全量档里没有"前一状态"
 *    可比;把它硬套基线存量,得到的就是一道与任何在飞改动无关、且因基线只下调而抬不动的恒红
 *    —— 那正是 G-174 的成因。存量账在该档由 grandfatherUntil + S1「可下调」报数管,E2(已过期)
 *    与 E3(基线自身过期)照旧判红,牙齿没少。
 *  - **面 = index(提交链)**:锚点取 HEAD 的现测值 ∪ 基线(analyze 内取大)。
 *  - **HEAD 取不到**:返回 null ⇒ analyze 退回"只看基线",调用方必须把这次退化喊出来。
 */
export function resolveAnchor({ face, entries, headEntries }) {
  if (face === 'head') return undatedCountsOf(entries)
  if (!headEntries) return null
  return undatedCountsOf(headEntries)
}

/**
 * E5 的观测面/锚点面共用:(文件 → {kind → 无到期豁免的抑制数}) → `file::kind` 计数表。
 * 与 undatedCountsOf 对称:两侧走同一个函数,不会出现"锚点按新口径、观测按旧口径"的错位假红。
 * 刻意**不做工具面排除**:lint 抑制的既有报数账(suppressions)是全仓口径,head 注写得明白;
 * 本门自己与镜像测试的夹具由 SELF_EXEMPT_RE 在取材层整文件豁免,不靠这里放水。
 */
export function suppressionUndatedCountsOf(byFile) {
  const out = {}
  for (const [file, per] of Object.entries(byFile || {})) {
    for (const [kind, n] of Object.entries(per || {})) {
      if (!n) continue
      out[`${file}::${kind}`] = (out[`${file}::${kind}`] || 0) + Number(n)
    }
  }
  return out
}

/** E5 的锚点取哪一份 —— 与 resolveAnchor 同型(G-174 同款棘轮,三种情形都要能被单测钉住):
 *  - 面 = head(全量审计):本次即 HEAD 自己,自比必相等 ⇒ E5 结构上不响;
 *  - HEAD 面取不到:返回 null ⇒ analyze 退回"只报数不判红"(基线可能还没有
 *    suppressionUndatedCounts 字段,拿 0 当锚点 = 上线当场恒红 342 处);
 *  - 否则取 HEAD 现测计数,analyze 内与基线取大。 */
export function resolveSuppressionAnchor({ face, undatedByFile, headUndatedByFile }) {
  if (face === 'head') return suppressionUndatedCountsOf(undatedByFile)
  if (!headUndatedByFile) return null
  return suppressionUndatedCountsOf(headUndatedByFile)
}

export function analyze({
  entries,
  suppressionsByFile,
  suppressionUndatedByFile,
  baseline,
  today,
  headCounts,
  headUnregisteredFamilies,
  headSuppressionCounts,
}) {
  const grandfather = String(baseline?.grandfatherUntil || '')
  const grandfatherOpen = grandfather !== '' && !isPast(grandfather, today)
  const baseCounts = baseline?.undatedCounts || {}
  const red = []
  const soft = []
  const lifeOf = (f) => FAMILY_LIFETIME_DAYS[f] ?? DEFAULT_LIFETIME_DAYS

  // ① 已过期:E2 **无条件红**,基线救不了它("临时豁免=借来的时间"与"永久出口"的分界)。
  //    工具面不判(G03b 与 G03a 成对:同一行带过期日期的文字,换到 apps/ 就必须红)。
  const expired = entries.filter(
    (e) => e.expiry && !e.toolFace && !e.archiveFace && isPast(e.expiry, today),
  )
  for (const e of expired) {
    const msg = `豁免已到期仍在生效:${e.family}@${e.file}:${e.line} 的到期日 ${e.expiry} < ${today}`
    red.push({ code: 'E2', file: e.file, line: e.line, family: e.family, msg })
  }

  // ② 无日期:存量按棘轮只报数,超出基线的部分判红。键集取**并集** —— 只遍历观测键会让
  // "某文件的豁免被清到 0"这一最该喊的情况隐身(自检 R01 就是这么红过一次)。
  const obsUndated = undatedCountsOf(entries)
  const anchorSource = headCounts ? 'HEAD 现测' : '基线存量'
  for (const k of new Set([...Object.keys(obsUndated), ...Object.keys(baseCounts)])) {
    const n = obsUndated[k] || 0
    // 锚点取「基线存量」与「HEAD 现测」的**较大者**。为什么不直接取代基线:
    //  - 基线按自身口径只会下调(M02 是那道反作弊锁:不得为过门调高额度)。于是一旦某个
    //    (文件,族) 的真实数被历史低估,只读基线就产出一条**没有任何合法出口**的恒红 ——
    //    G-174 实测:基线 7 / HEAD·索引·工作树三面都是 8,而 --update-baseline 抬不上去。
    //    恒红门的结局只有 --no-verify,连带废掉全部守门。
    //  - 取大只把额度抬到"HEAD 里那一枚一枚真实存在的豁免",超出 HEAD 的增量照样红,所以
    //    "新增必须带到期日"一点都不松:A02 与 A03 一对正反例把它钉死(A01 的绿必须来自锚点,
    //    不能来自判据失效)。
    const allowed = Math.max(Number(baseCounts[k] ?? 0), Number(headCounts?.[k] ?? 0))
    const [file, family] = k.split('::')
    if (n > allowed) {
      const extra = n - allowed
      const life = lifeOf(family)
      red.push({
        code: 'E1',
        file,
        family,
        msg:
          `新增豁免不带到期日:${family}@${file} 本次 ${n} 处、锚点(${anchorSource}) ${allowed} 处,` +
          `多出的 ${extra} 处必须写 \`<族>: <原因> until YYYY-MM-DD\`(建议存活期 ${life} 天)`,
      })
    } else if (Number(baseCounts[k] ?? 0) > n) {
      soft.push({
        code: 'S1',
        msg: `可下调:${k} 基线 ${baseCounts[k]} → 现测 ${n}(跑 --update-baseline)`,
      })
    }
  }
  const stockUndated = Object.values(baseCounts).reduce((a, b) => a + Number(b || 0), 0)

  // ②b 未登记族被**真的用上**:把"新豁免族必须同笔登记进存活期表"从散文变成判据。
  //    锚点 = HEAD 面上同一份集合(与 E1 同型:面=head 时调用方不传,自己比自己 ⇒ 结构上不响,
  //    所以全量审计不会因存量红变成人人绕钩子 —— §12e 那条最高反面教训)。
  //    存量解阻前置(HEAD 面现读,跑 `--all` 复核,勿照抄本注释):被豁免侧正在用的未登记族
  //    只有 route-declare-exempt 一处(守门 127),它把"该出口属永久惯例还是待偿"定了性却没进表;
  //    清偿 = 给它补一个带理由的档位,或把它改成带显式 until 的豁免。其余未登记族只活在
  //    scripts/** 那一面(门在描述自己),按上面的口径天然不入射程。
  //    已知边界(如实登记,不当作已判):E4 问的是"族的出现与否",不问"族被用了多少次";
  //    一个未登记族被**更多次**使用由 E1 管(不带到期日时),带到期日的重复使用只报数 ——
  //    那一格要么由补登记消除,不得靠放宽 E4 掩盖。
  const obsUnregUsed = unregisteredUsedFamiliesOf(entries)
  const anchorUnregUsed = headUnregisteredFamilies || obsUnregUsed
  for (const fam of [...obsUnregUsed].sort()) {
    if (anchorUnregUsed.has(fam)) continue
    red.push({
      code: 'E4',
      family: fam,
      msg:
        `新引入的未登记豁免族:${fam} —— 它出现在被豁免侧(真有一次生效的豁免),` +
        '但 HEAD 面上没有这一族的未登记存量,也没进 FAMILY_LIFETIME_DAYS。' +
        `按 DEFAULT_LIFETIME_DAYS=${DEFAULT_LIFETIME_DAYS} 天兜底不算登记:那个默认值只保证"新族不隐身",` +
        '族值必须由立它的那道门同笔写进存活期表,并附一句"取这几天是因为它是待偿债还是结构性定性"。',
    })
  }

  // ③ 基线自身到期:未销账则整门红 —— 让"过期未销账**自己**变红"
  if (!grandfatherOpen && stockUndated > 0) {
    red.push({
      code: 'E3',
      msg:
        `存量豁免账已过期未销账:grandfatherUntil=${grandfather || '(缺失)'} 已过,仍有 ` +
        `${stockUndated} 处无日期豁免。销账 = 补当次真实日期的到期日或删掉豁免行;禁止靠延长宽限期消红。`,
    })
  }

  // ④ lint 抑制面:同一条账的第二类。总账只报数;**新增**部分由 E5 棘轮判红(G-666):
  //    锚点 = max(基线 suppressionUndatedCounts, HEAD 现测),与 E1 同型 —— 取大防"基线被历史
  //    低估 ⇒ 抬不动的恒红"(G-174),自比(face=head)结构上不响。锚点缺失(HEAD 取不到)时
  //    整维退回只报数:基线可能还没有该字段,拿 0 当锚点 = 上线当场恒红存量 342/70 处。
  const suppressTotals = {}
  let suppressFiles = 0
  for (const per of Object.values(suppressionsByFile || {})) {
    let any = 0
    for (const [k, v] of Object.entries(per)) {
      suppressTotals[k] = (suppressTotals[k] || 0) + v
      any += v
    }
    if (any > 0) suppressFiles += 1
  }

  const obsSupUndated = suppressionUndatedCountsOf(suppressionUndatedByFile)
  const baseSupCounts = baseline?.suppressionUndatedCounts || {}
  if (!headSuppressionCounts) {
    soft.push({
      code: 'S5',
      msg:
        'E5 锚点取不到(HEAD 面/基线无 suppressionUndatedCounts)⇒ lint 抑制新增本档退回只报数;' +
        `现测无到期豁免抑制 ${Object.values(obsSupUndated).reduce((a, b) => a + Number(b || 0), 0)} 处 ` +
        '(跑 --update-baseline 并账后,提交链档即恢复判红)',
    })
  } else {
    // face=head 自比时 E5 结构上不响,这段文案只会在提交链档的判红里出现。
    const supAnchorSource = 'HEAD 现测'
    for (const k of new Set([...Object.keys(obsSupUndated), ...Object.keys(baseSupCounts)])) {
      const n = obsSupUndated[k] || 0
      const allowed = Math.max(Number(baseSupCounts[k] ?? 0), Number(headSuppressionCounts[k] ?? 0))
      if (n > allowed) {
        const [file, kind] = k.split('::')
        red.push({
          code: 'E5',
          file,
          family: kind,
          msg:
            `新增 lint 抑制不带到期豁免:${kind}@${file} 本次 ${n} 处、锚点(${supAnchorSource}) ${allowed} 处,` +
            '多出的 ' + `${n - allowed} 处必须同行写 \`-- 理由 until YYYY-MM-DD\`(无到期豁免的抑制不得只出生不死亡)`,
        })
      }
    }
  }

  const countBy = (key) => {
    const out = {}
    for (const it of entries) {
      const k = key(it)
      out[k] = (out[k] || 0) + 1
    }
    return out
  }
  return {
    red,
    soft,
    totals: {
      entries: entries.length,
      toolFace: entries.filter((e) => e.toolFace).length,
      archiveFace: entries.filter((e) => e.archiveFace).length,
      files: new Set(entries.map((e) => e.file)).size,
      families: new Set(entries.map((e) => e.family)).size,
      dated: entries.filter((e) => e.expiry).length,
      expired: expired.length,
      undated: entries.filter((e) => !e.expiry && !e.toolFace && !e.archiveFace).length,
      stockUndated,
      reasonless: entries.filter((e) => !e.hasReason).length,
      byFamily: countBy((e) => e.family),
      byAttach: countBy((e) => e.attach),
      suppressTotals,
      suppressFiles,
      /** 无到期豁免的 lint 抑制总数(E5 的观测面,棘轮只拦新增,存量在此如实报数)。 */
      suppressUndatedTotal: Object.values(obsSupUndated).reduce((a, b) => a + Number(b || 0), 0),
      unregisteredFamilies: [...new Set(entries.filter((e) => !e.registered).map((e) => e.family))],
      /** 被豁免侧真的用到的未登记族(E4 的观测面)。`unregisteredFamilies` 含工具面,两者不得混用。 */
      unregisteredUsedFamilies: [...obsUnregUsed].sort(),
      /** 本轮 E4 的锚点是否来自 HEAD;'head-self' 表示全量档,E4 在该档结构上不响。 */
      e4Anchor: headUnregisteredFamilies ? 'head-measured' : 'head-self',
      staleKeys: Object.keys(baseCounts).filter((k) => !(k in obsUndated)).length,
      grandfather,
      grandfatherOpen,
    },
  }
}

// ------------------------------------------------------------ 取材(判定面)

/**
 * 候选枚举。**不能**复用 gitRaw:它的 catch 把任何非零退出折成 Undetermined 并丢掉 status,
 * 而 `git grep` 的 **exit 1 是一个有意义的业务答案**("零命中"),不是取材失败。
 * 五项硬要求(绝对路径 git / safe.directory / quotepath / windowsHide / 数字 timeout + 显式
 * stdio)与 lib/face-reader.mjs 的 gitRaw 逐条同形 —— 少一项就是一个只在服务账户下才炸的洞。
 */
function grepList(root, face) {
  const head = ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', root]
  const args = [...head, 'grep', '-l', '-I', '-z', '-E', '-e', PREFILTER_RE]
  if (face === 'staged') args.push('--cached')
  else if (face === 'head') args.push('HEAD')
  args.push('--', '.', ':(exclude)*.md')
  let out
  try {
    out = execFileSync(GIT_BIN, args, {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 64 << 20,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    if (e && e.status === 1 && !String(e.stdout ?? '').trim()) return []
    throw new Undetermined(`候选枚举失败(git grep,面=${face}): ${gitErrText(e)}`)
  }
  // ⚠️ `git grep -l <tree-ish>` 会给每条结果加 `HEAD:` 前缀(--cached / 工作树面**不加**)。
  // 不剥掉后面拼出的 blob 规格就成了 `HEAD:HEAD:a.ts` —— 表现不是报错而是**每个文件都"取不到"**,
  // 于是整门读到 0 条豁免、绿灯高挂。这条由 --self-test 的 X01(真临时仓)钉死,构造面抓不到。
  // 自豁免必须在剥前缀**之后**比(带 `HEAD:` 的原始行永远匹配不上,门会自以为豁免了而实际没豁免)。
  return String(out)
    .split('\0')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((r) => (face === 'head' && r.startsWith('HEAD:') ? r.slice(5) : r))
    .filter((r) => !SELF_EXEMPT_RE.test(r))
}

/** 同一面同轮读全部内容:清单与内容必须同面(否则"glob 读盘 + 内容读 git"造出自洽的假绿)。 */
function readFace(root, face, rels) {
  const out = new Map()
  if (face === 'worktree') {
    for (const rel of rels) out.set(rel, readWorktreeFile(root, rel))
    return out
  }
  const ref = face === 'head' ? 'HEAD' : ''
  const revs = rels.map((r) => `${ref}:${r}`)
  const map = catBatch(root, revs, { maxBuffer: 256 << 20, timeout: 180000 })
  rels.forEach((rel, i) => out.set(rel, map.get(revs[i]) ?? null))
  return out
}

export function loadBaseline(root) {
  const abs = path.join(root, BASELINE_REL)
  if (!existsSync(abs)) {
    throw new Undetermined(`基线文件缺失:${BASELINE_REL}(无基线即无法区分存量与新增)`)
  }
  let parsed
  try {
    parsed = JSON.parse(readFileSync(abs, 'utf8'))
  } catch (e) {
    // 坏 JSON 显式报错,绝不静默当空清单(那会把 248 处存量当场判红)
    throw new Undetermined(`基线 JSON 解析失败:${BASELINE_REL}: ${e.message}`)
  }
  if (!parsed || typeof parsed !== 'object' || typeof parsed.undatedCounts !== 'object') {
    throw new Undetermined(`基线结构不符(缺 undatedCounts 对象):${BASELINE_REL}`)
  }
  return parsed
}

/** 并集 + 只下调:未被本轮观测到的键一律保留(整表重写会冲掉并行会话的条目)。 */
export function mergeBaseline(old, observed) {
  const next = { ...old, undatedCounts: { ...(old.undatedCounts || {}) } }
  // G-666:第二类账(无到期豁免的 lint 抑制)独立键空间,并集 + 只下调。
  // **不参与**下面的工具面/族清除:它的 `::` 后段是 kind(eslint-disable/ts-ignore),
  // 不是豁免族名 —— 拿去查登记表必然查不到,把 isFamilyRegistered 的清除逻辑套上去
  // 会把整本抑制账一夜清光(账面读起来像"账已清完"的自洽假绿,M03b 同型的反方向)。
  next.suppressionUndatedCounts = { ...(old.suppressionUndatedCounts || {}) }
  const lowered = []
  const added = []
  const purged = []
  for (const k of Object.keys(next.undatedCounts)) {
    const file = String(k).split('::')[0] || ''
    const fam = String(k).split('::')[1] || ''
    // ① 工具面键一律不得留在账里:prose 不是待偿债务,留着 E3 的宽限期永远销不完。
    // ② 族已从登记表移除 ⇒ 它那笔额度**同时作废**(2026-09-29 O81 票㊵:圆角豁免通道整体废除)。
    //    留在账里有两个坏处:T11 判"基线里出现未登记族"而恒红(清单腐烂),而更要紧的是它读起来
    //    像"这一族还有额度" —— 那正是替一条已废除的出口继续背书。
    // 两条都写在合并层而不是"手工清一次",因为旧基线可能被一次回退带回来 ——
    // 那时下一次 --update-baseline 会自行收干净(自愈),不需要有人记得。
    // 没有 `::族` 段的旧式键不参与族判定(它没有族可判)—— 拿空串去查登记表会把所有此类键误清。
    if (!TOOL_FACE_RE.test(file) && (fam === '' || isFamilyRegistered(fam))) continue
    // 前缀把"为什么清"写进账目本身:日志只说"清掉 N 键"就会把两种完全不同的处置混成一个数
    // (工具面 prose 与"族已废除"必须分开报,否则读的人以为只是又清了一批注释)。
    const why = TOOL_FACE_RE.test(file) ? '工具面' : '族已废除'
    purged.push(`${why}:${k}=${next.undatedCounts[k]}`)
    delete next.undatedCounts[k]
  }
  for (const [k, v] of Object.entries(observed.undatedCounts || {})) {
    const cur = next.undatedCounts[k]
    if (cur === undefined) {
      next.undatedCounts[k] = v
      added.push(k)
    } else if (v < Number(cur)) {
      next.undatedCounts[k] = v
      lowered.push(`${k} ${cur}->${v}`)
    }
  }
  // 第二类账同方向合并(只下调 + 并集);报数并入同一组 lowered/added,键形态 file::kind
  // 自可分辨,不另开计数口径(两个"added 数"只会让读账的人对不上)。
  for (const [k, v] of Object.entries(observed.suppressionUndatedCounts || {})) {
    const cur = next.suppressionUndatedCounts[k]
    if (cur === undefined) {
      next.suppressionUndatedCounts[k] = v
      added.push(k)
    } else if (v < Number(cur)) {
      next.suppressionUndatedCounts[k] = v
      lowered.push(`${k} ${cur}->${v}`)
    }
  }
  if (observed.grandfatherUntil && !next.grandfatherUntil)
    next.grandfatherUntil = observed.grandfatherUntil
  if (observed.updatedAt) next.updatedAt = observed.updatedAt
  return { next, lowered, added, purged }
}

// ------------------------------------------------------------ 自检(构造面 + 一次真仓)

const TODAY = '2026-09-25'
/**
 * 夹具用的族名**不携带语义** —— 本门判的是"有没有登记 / 带不带原因 / 过没过期",与那一族管什么无关。
 * 刻意不用圆角那两族做示例:它们已从登记表移除(票㊵),夹具里再写它们就等于把"这条通道还活着"
 * 教给每一个读自检的人。
 */
const KEY = 'a.ts::border-ink-exempt'
const E = (o) => ({
  file: 'a.ts',
  family: 'border-ink-exempt',
  line: 1,
  expiry: null,
  hasReason: true,
  ...o,
})
const F_INLINE = '  borderRadius: 17, // border-ink-exempt: 正圆(直径一半)'
const F_PREV = '// border-ink-exempt: 图例微圆角\n{ borderRadius: 1 },'
const F_GLYPH = '<Text>›</Text></View> // glyph-arrow-exempt: 与封面同源的指示符'
const F_ALLOW = "s.textContent='*{c:x!important;/*!ihui-allow-important:压过外部页面*/}'"
const F_THREE =
  '// statusbar-exempt: 与封面同高\n// arch-exempt: 循环依赖\n// alpha-plugin-exempt: 色板'
const W_THREE = 'statusbar-exempt,arch-exempt,alpha-plugin-exempt'
const F_CTA = '// r5-cta-exempt: 图片浮层\n// r7-nest-exempt: 压在图上\n// r3-cta-exempt: 端内旧键'
const W_CTA = 'r5-cta-exempt,r7-nest-exempt,r3-cta-exempt'
const F_FILE =
  '// i18n-content-exempt-file: 通知侧无 i18n 运行时,本文件中文即对外 payload\nx\n' +
  '// i18n-content-exempt-file: 第二处不得重复计\n'
const F_PROSE = ' * 照守门 70 在 2026-09-24 补的 `i18n-content-exempt-file: 理由十二字以上\n'
const F_FUTURE = '// brand-new-gate-exempt: 某道新门刚加的族'
const F_ESLINT =
  '/* eslint-disable no-console */\n// eslint-disable-next-line @x/y\n// @ts-ignore\n'

function detail(
  entries,
  undated,
  gf,
  today,
  sup,
  headCounts,
  headUnregFam,
  supU,
  headSupCounts,
  supBase,
) {
  // supBase = 基线的 suppressionUndatedCounts(E5 的基线锚)。刻意独立成参而不混进 undated:
  // undated 的键集就是 undatedCounts 本身,混进去会被 E1 的键集遍历当成一条 file::family 账。
  const baseline = { grandfatherUntil: gf ?? '2099-01-01', undatedCounts: undated || {} }
  if (supBase) baseline.suppressionUndatedCounts = supBase
  return analyze({
    entries,
    suppressionsByFile: sup || {},
    suppressionUndatedByFile: supU || {},
    baseline,
    today: today ?? TODAY,
    headCounts,
    headUnregisteredFamilies: headUnregFam,
    headSuppressionCounts: headSupCounts,
  })
}

const redOf = (r) => (r.red.length > 0 ? r.red[0].code : '')
const hasRed = (r, code) => r.red.some((x) => x.code === code)
const es = (t, n) => scanFile(n ?? 't.tsx', t).entries
const e0 = (t, n) => es(t, n)[0]
const fams = (t, n) =>
  es(t, n)
    .map((x) => x.family)
    .join(',')
const shiftDay = (iso, d) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86400000).toISOString().slice(0, 10)

function selfTest() {
  const results = []
  const ok = (name, pass) => results.push([name, !!pass])
  // 语法覆盖面:两种挂靠行 × 各族真实拼写(容不下就同时产假红与假绿)
  ok('S01 同行尾注释识别为 inline', e0(F_INLINE).attach === 'inline')
  ok('S02 紧邻上一行独立注释识别为 prev-line', e0(F_PREV).attach === 'prev-line')
  ok('S03 glyph-arrow-exempt 真实拼写可扫', e0(F_GLYPH).family === 'glyph-arrow-exempt')
  ok(
    'S04 ihui-allow-important 非 -exempt 拼写同样入账',
    e0(F_ALLOW).family === 'ihui-allow-important',
  )
  ok('S05 statusbar/arch/alpha 三族一次扫齐', fams(F_THREE) === W_THREE)
  ok('S06 r5/r7/r3-cta 与 nest 变体可扫', fams(F_CTA) === W_CTA)
  const fe = es(F_FILE, 'd.ts')
  ok('S07 文件级标记按文件计一笔', fe.length === 1 && fe[0].fileScoped === true)
  ok(
    'S08 缺原因单独计数(各门自身已拦,本门不重复判红)',
    e0('x // r7-nest-exempt:').hasReason === false,
  )
  // 日期解析:四类陷阱 + 方向
  ok(
    'P01 非法月(2026-13-01)不当成到期日',
    e0('// border-ink-exempt: 原因 until 2026-13-01').expiry === null,
  )
  ok('P02 标记**之前**的散文日期不得被读成本笔到期日', e0(F_PROSE, 'h.mjs').expiry === null)
  ok(
    'P03 标记之后 until 形式解析出日期',
    e0('// arch-exempt: 等 G-200 收口 until 2026-12-31').expiry === '2026-12-31',
  )
  ok(
    'P04 prev-line 挂靠的标记也能带到期日',
    e0('// border-ink-exempt: 正圆 until 2020-05-05\n{ borderRadius: 1 }').expiry === '2020-05-05',
  )
  // 实测自伤:一条 `border-ink-exempt: … 2026-09-26 扩判据后暴露的既有定稿 … until 2027-09-26`
  // 被读成到期日 2026-09-26 ⇒ 次日整道 blocking 门恒红,而它拦的不是任何人的代码问题。
  ok(
    'P05 理由里自带事件日期时,显式 until 必须赢过"第一个日期"',
    e0(
      '// border-ink-exempt: Switch 定稿,2026-09-26 扩判据后暴露的既有定稿而非新增违规 until 2027-09-26',
    ).expiry === '2027-09-26',
  )
  ok(
    'P06 反向对照:没有 until 时仍取标记后的第一个日期(存量那一型行为不得变)',
    e0('// border-ink-exempt: 定稿,2026-09-26 暴露的既有形态').expiry === '2026-09-26',
  )
  ok(
    'P07 until 后面是坏日期 ⇒ 判"没有到期日"(宁让 E1 喊,不许偷偷退回理由里的日期)',
    e0('// arch-exempt: 事故 2026-01-02 until 2027-13-45').expiry === null,
  )
  ok('D01 昨天的日期判"已过去"', isPast('2020-01-01', TODAY))
  ok(
    'D02 明天与今天都不算已过去(到期日当天仍有效)',
    !isPast('2099-12-31', TODAY) && !isPast(TODAY, TODAY),
  )
  ok('D03 解不出的日期不得被判成已过去(判据坏了≠业务红)', !isPast('不是日期', TODAY))
  // 判据:阳性对照 + 反向对照成对
  ok('E1a 新造无日期豁免 ⇒ 判红(空基线)', redOf(detail([E()])) === 'E1')
  ok('E1b 同一条进基线后 ⇒ 不红(存量只报数)', redOf(detail([E()], { [KEY]: 1 })) === '')
  ok('E1c 基线存量计入 totals.stockUndated', detail([E()], { [KEY]: 1 }).totals.stockUndated === 1)
  const xp = detail([E({ expiry: '2020-01-01' })], { [KEY]: 1 })
  ok(
    'E2a 已过期即便在基线里 ⇒ 仍判红并点名',
    xp.red.length === 1 && xp.red[0].code === 'E2' && xp.red[0].file === 'a.ts',
  )
  const fu = detail([E({ expiry: '2099-12-31' })])
  ok('E2b 未来日期 + 原因 ⇒ 绿(反向对照)', fu.red.length === 0 && fu.totals.dated === 1)
  ok(
    'E3a 基线自身过期且有存量未销账 ⇒ 整门红',
    redOf(detail([], { 'a::b': 3 }, '2020-01-01')) === 'E3',
  )
  ok('E3b 基线过期但账已销完 ⇒ 绿(反向对照)', redOf(detail([], {}, '2020-01-01')) === '')
  ok(
    'E3c grandfatherUntil 缺失 ⇒ 判红,不许"没写=永久"',
    redOf(detail([], { 'a::b': 1 }, '')) === 'E3',
  )
  ok('R03 到期日当天不算过期(边界)', redOf(detail([E({ expiry: TODAY })])) === '')
  ok('R04 明日到期不算过期', redOf(detail([E({ expiry: shiftDay(TODAY, 1) })])) === '')
  ok('R05 昨天到期算过期', redOf(detail([E({ expiry: shiftDay(TODAY, -1) })])) === 'E2')
  const down = detail([], { 'z::border-ink-exempt': 5 })
  // 按 code 断言不锁 soft 总长:E5(G-666)起,构造面不传抑制锚点会多一条 S5(锚点缺失喊出),
  // 那是如实报数,不该让 S1 的断言跟着挂。
  ok(
    'R01 存量减少 ⇒ 绿 + 提示可下调',
    down.red.length === 0 && down.soft.some((s) => s.code === 'S1'),
  )
  ok('R02 从 0 起的新豁免 ⇒ 红', redOf(detail([E()], { [KEY]: 0 })) === 'E1')
  // G01–G08 记账面 vs 工具面(scripts/**)。**六条成对**:每一格"不红"都必须由对面那一格"红"
  // 反向钉住 —— 否则"不红"完全可能只是判据失效(本仓最高频的那型假绿)。
  const G_TXT = '// border-ink-exempt: 头像要纯圆'
  const G_KEY_TOOL = 'scripts/check-demo.mjs::border-ink-exempt'
  const G_KEY_APP = 'apps/demo/src/a.ts::border-ink-exempt'
  const gTool = es(G_TXT, 'scripts/check-demo.mjs')
  const gApp = es(G_TXT, 'apps/demo/src/a.ts')
  ok(
    'G01 同一段文字在 scripts/ 面 ⇒ 打 toolFace 且不进无日期账',
    gTool.length === 1 && gTool[0].toolFace === true && undatedCountsOf(gTool)[G_KEY_TOOL] === undefined,
  )
  ok(
    'G02 同一段文字在 apps/ 面 ⇒ 照常入账(与 G01 成对)',
    gApp.length === 1 && gApp[0].toolFace === false && undatedCountsOf(gApp)[G_KEY_APP] === 1,
  )
  ok('G03 工具面新增无日期豁免 ⇒ E1 不响(新门能被登记的那道锁)', redOf(detail(gTool)) === '')
  ok('G04 记账面新增同一段无日期豁免 ⇒ E1 红(与 G03 成对)', redOf(detail(gApp)) === 'E1')
  const xpTool = es(`${G_TXT} until 2020-01-01`, 'scripts/check-demo.mjs')
  const xpApp = es(`${G_TXT} until 2020-01-01`, 'apps/demo/src/a.ts')
  ok('G05 工具面带已过期日期 ⇒ 不判 E2', redOf(detail(xpTool)) === '')
  ok('G06 记账面带同一过期日期 ⇒ E2 无条件红(与 G05 成对)', redOf(detail(xpApp)) === 'E2')
  ok(
    'G07 totals.toolFace 如实报数,不静默并账',
    detail(xpTool).totals.toolFace === 1 && detail(xpTool).totals.undated === 0,
  )
  ok(
    'G08 判据正则字面量里的标记同属工具面(门 93 R8 那一型)',
    es("export const RE = /handcopy-token-exempt:\\s*\\S/", 'scripts/check-cross-end-tokens.mjs')[0]
      .toolFace === true,
  )
  // G09–G12 存档面(`.ihui-agent/archive/**` = 被逐字搬走的原文副本)。成对方向同 G01–G08:
  // 每一格"不红"都必须由对面那一格"仍红"钉住,否则不红就只是判据失效。
  const xpArch = es(`${G_TXT} until 2020-01-01`, '.ihui-agent/archive/PROJECT_PLAN_dedup-2026-09-26.md')
  ok(
    'G09 存档面带已过期日期 ⇒ 不判 E2(被撤销的豁免是证词,不是当下出口)',
    redOf(detail(xpArch)) === '' && xpArch[0].archiveFace === true,
  )
  ok(
    'G10 活文件带同一过期日期 ⇒ E2 照旧无条件红(与 G09 成对:存档面不削弱记账面)',
    redOf(detail(xpApp)) === 'E2' && xpApp[0].archiveFace === false,
  )
  ok(
    'G11 存档面的无日期豁免不入账,但 totals.archiveFace 如实报数(不静默并账)',
    redOf(detail(es(G_TXT, '.ihui-agent/archive/x.md'))) === '' &&
      detail(xpArch).totals.archiveFace === 1,
  )
  ok(
    'G12 存档面的未登记族 ⇒ 不触发 E4(E4 只判被豁免侧真在用的活出口)',
    redOf(detail(es('// brand-mail-exempt: x', '.ihui-agent/archive/y.md'))) === '',
  )
  // A01–A03:HEAD 现测锚点(G-174 的出口)。三条要一起读 —— A03 是 A01 的反证:同一组输入
  // 不给锚点必须红,否则 A01 的绿可能只是判据没跑起来。
  ok(
    'A01 基线被历史低估而 HEAD 里有这个数 ⇒ 不判红(否则是一条抬不动的恒红)',
    redOf(detail([E()], { [KEY]: 0 }, undefined, undefined, undefined, { [KEY]: 1 })) === '',
  )
  ok(
    'A02 比 HEAD 锚点多出一枚 ⇒ 仍判红(锚点不是放行口)',
    redOf(detail([E(), E()], { [KEY]: 0 }, undefined, undefined, undefined, { [KEY]: 1 })) === 'E1',
  )
  ok('A03 反证:同输入不给锚点 ⇒ 必须红', redOf(detail([E()], { [KEY]: 0 })) === 'E1')
  ok(
    'A04 S1 文案报的是基线值,不是取大后的锚点(否则"可下调"会喊出 HEAD 的数)',
    detail([], { [KEY]: 5 }, undefined, undefined, undefined, { [KEY]: 9 }).soft[0]?.msg.includes(
      '基线 5 → 现测 0',
    ) === true,
  )
  // N 组:锚点取哪一份(resolveAnchor)。N01 是 G-174 的直接出口,所以它的反证也要在案:
  // N02 证明索引面**不是**自我锚定(多一枚仍会红),否则 N01 的绿等于整门失效。
  const E1K = (n) => Array.from({ length: n }, (_, i) => ({ ...E(), line: i + 1 }))
  ok(
    'N01 全量档(面=head)锚点=自身观测 ⇒ E1 不响(恒红出口)',
    redOf(detail(E1K(3), { [KEY]: 1 }, undefined, undefined, undefined, resolveAnchor({ face: 'head', entries: E1K(3) }))) ===
      '',
  )
  ok(
    'N02 索引面锚点取 HEAD ⇒ 比 HEAD 多一枚仍判红(不是自我锚定)',
    JSON.stringify(resolveAnchor({ face: 'index', entries: E1K(3), headEntries: E1K(1) })) ===
      JSON.stringify({ [KEY]: 1 }),
  )
  ok(
    'N03 HEAD 取不到 ⇒ 返回 null(退回基线,且调用方必须喊出来)',
    resolveAnchor({ face: 'index', entries: E1K(3), headEntries: null }) === null,
  )
  // 第二类账:lint 抑制面只报数
  const sup = scanFile('g.ts', F_ESLINT).suppressions
  ok(
    'L01 eslint-disable 两类形态都计入抑制账',
    sup['eslint-disable'] === 2 && sup['ts-ignore'] === 1,
  )
  ok('L02 抑制面只报数不判红', redOf(detail([], {}, undefined, undefined, { 'g.ts': sup })) === '')
  // G-666:抑制账劈两半 —— 同行带 `until <日期>` 的算"有到期豁免",无 until 的进 E5 观测面。
  // L03/L04 是 scanFile 层的正反例;E5a–E5e 是 analyze 层的棘轮四向 + 阳性对照(票面验收格)。
  const supScan = scanFile('g.ts', F_ESLINT)
  const supU = supScan.suppressionUndated
  const supDated = scanFile('g.ts', '/* eslint-disable no-console */ // 等清理 until 2099-12-31')
  ok(
    'L03 同行带 until 的抑制算有到期豁免,不进无日期账(总账照旧计)',
    supDated.suppressionUndated['eslint-disable'] === undefined &&
      supDated.suppressions['eslint-disable'] === 1,
  )
  ok(
    'L04 无 until 的抑制进无日期账,计数与总账同面同轮',
    supU['eslint-disable'] === 2 && supU['ts-ignore'] === 1 && supScan.suppressions['eslint-disable'] === 2,
  )
  // E5 棘轮四向(与 E1 的 A01–A03/R02 同型):存量绿 / 新增红 / 带 until 绿 / 锚点兜底不当场红。
  // 观测面一律从 scanFile 真扫出来(阳性对照:判据吃的是扫描产物,不是手拼的计数表)。
  const e5a = detail(
    [], {}, undefined, undefined, supScan.suppressions, undefined, undefined,
    { 'g.ts': supU }, { 'g.ts::eslint-disable': 1, 'g.ts::ts-ignore': 1 },
  )
  ok(
    'E5a 新增无到期抑制超锚点 ⇒ E5 红,恰好只红多出的那一笔并点名 kind@file',
    e5a.red.length === 1 &&
      e5a.red[0].code === 'E5' &&
      e5a.red[0].file === 'g.ts' &&
      e5a.red[0].family === 'eslint-disable',
  )
  ok(
    'E5b 锚点取大(HEAD 现测兜住存量)⇒ 不红(E5a 同输入为反证:绿必须来自锚点,不是判据失效)',
    detail(
      [], {}, undefined, undefined, supScan.suppressions, undefined, undefined,
      { 'g.ts': supU }, { 'g.ts::eslint-disable': 2, 'g.ts::ts-ignore': 1 },
    ).red.length === 0,
  )
  ok(
    'E5c 基线存量额度兜底(取大含基线)⇒ 不红',
    detail(
      [], {}, undefined, undefined, supScan.suppressions, undefined, undefined,
      { 'g.ts': supU }, {}, { 'g.ts::eslint-disable': 5, 'g.ts::ts-ignore': 5 },
    ).red.length === 0,
  )
  const e5d = detail(
    [], {}, undefined, undefined, supScan.suppressions, undefined, undefined, { 'g.ts': supU },
  )
  ok(
    'E5d 锚点缺失 ⇒ E5 整维退回只报数并喊出(基线可能还没这字段,拿 0 当锚点 = 恒红存量 342/70)',
    !hasRed(e5d, 'E5') && e5d.soft.some((s) => s.code === 'S5'),
  )
  ok(
    'E5e 新增抑制带同行 until ⇒ 有到期豁免,E5 不响(出口是真的,不是判据没跑)',
    detail(
      [], {}, undefined, undefined, supDated.suppressions, undefined, undefined,
      supDated.suppressionUndated, {},
    ).red.length === 0,
  )
  ok(
    'N04 E5 锚点:面=head 自比 ⇒ 观测=锚点,结构上不响(与 N01 同型)',
    JSON.stringify(resolveSuppressionAnchor({ face: 'head', undatedByFile: { 'g.ts': supU } })) ===
      JSON.stringify({ 'g.ts::eslint-disable': 2, 'g.ts::ts-ignore': 1 }),
  )
  ok(
    'N05 E5 锚点:HEAD 取不到 ⇒ null(退回只报数,与 N03 同型)',
    resolveSuppressionAnchor({ face: 'index', undatedByFile: { 'g.ts': supU }, headUndatedByFile: null }) ===
      null,
  )
  // 清单腐烂可见性 + 基线合并方向
  const nf = e0(F_FUTURE)
  ok(
    'U01 未登记族仍入账并给默认存活期(新门加的族不得隐身)',
    nf.family === 'brand-new-gate-exempt' &&
      nf.lifetimeDays === DEFAULT_LIFETIME_DAYS &&
      !nf.registered,
  )
  ok(
    'U02 基线里本轮未观测到的键计 staleKeys(不删、只喊)',
    detail([], { 'gone.ts::border-ink-exempt': 2 }).totals.staleKeys === 1,
  )
  // U03–U08:E4「新豁免族必须同笔登记」从散文变成判据。**每一格"不红"都要有对面那一格"红"**
  // 反向钉住,否则"不红"完全可能只是判据失效(本仓最高频那型假绿)。
  // 条目一律带远期到期日 ⇒ E1 不响,红只能来自 E4 自己(两型判据不得互相顶名)。
  const U_FAM = 'brand-new-gate-exempt'
  const uApp = E({ family: U_FAM, file: 'apps/demo/src/a.ts', expiry: '2099-12-31' })
  const uTool = E({
    family: U_FAM,
    file: 'scripts/check-demo.mjs',
    expiry: '2099-12-31',
    toolFace: true,
  })
  const uReg = E({ family: 'border-ink-exempt', file: 'apps/demo/src/a.ts', expiry: '2099-12-31' })
  const uScanTool = es(F_FUTURE, 'scripts/check-demo.mjs')
  const uScanApp = es(F_FUTURE, 'apps/demo/src/a.ts')
  ok(
    'U03 被豁免侧用了 HEAD 没有的未登记族 ⇒ E4 红并点名族',
    hasRed(detail([uApp], {}, undefined, undefined, undefined, {}, new Set()), 'E4'),
  )
  ok(
    'U04 同一族在 HEAD 锚点集合里 ⇒ 绿(存量只报数,绝不当场造恒红门 —— §12e)',
    detail([uApp], {}, undefined, undefined, undefined, {}, new Set([U_FAM])).red.length === 0,
  )
  ok(
    'U05 同一行文字在 scripts/** 面 ⇒ E4 不响(否则新立一道带豁免出口的门没有合法出口)',
    detail([uTool], {}, undefined, undefined, undefined, {}, new Set()).red.length === 0 &&
      unregisteredUsedFamiliesOf([uTool]).size === 0,
  )
  const u6 = detail([uApp], {}, undefined, undefined, undefined, {}, undefined)
  ok(
    'U06 未传锚点(面=head)⇒ E4 不响且如实标 head-self',
    !hasRed(u6, 'E4') && u6.totals.e4Anchor === 'head-self',
  )
  ok(
    'U07 已登记族 ⇒ E4 不响(表里有就是登记过,不得连"族在用"一起判红)',
    detail([uReg], {}, undefined, undefined, undefined, {}, new Set()).red.length === 0,
  )
  ok(
    'U08 真扫出来的未登记族:apps 面进 E4 射程、scripts 面不进(与 U03/U05 成对,防"不红=判据失效")',
    unregisteredUsedFamiliesOf(uScanApp).has(U_FAM) &&
      unregisteredUsedFamiliesOf(uScanTool).size === 0 &&
      hasRed(detail(uScanApp, {}, undefined, undefined, undefined, {}, new Set()), 'E4'),
  )
  const mb = mergeBaseline(
    { noteBy: '他人写的台账注释', undatedCounts: { keepMe: 9, downMe: 5 } },
    { undatedCounts: { downMe: 2, newGuy: 1 }, grandfatherUntil: '2099-01-01' },
  ).next
  ok(
    'M01 只下调、他人键与未观测键均保留',
    mb.undatedCounts.downMe === 2 &&
      mb.undatedCounts.keepMe === 9 &&
      mb.undatedCounts.newGuy === 1 &&
      mb.noteBy === '他人写的台账注释',
  )
  ok(
    'M02 绝不上调额度(为过门调高额度被结构性堵住)',
    mergeBaseline({ undatedCounts: { upMe: 1 } }, { undatedCounts: { upMe: 99 } }).next
      .undatedCounts.upMe === 1,
  )
  const mp = mergeBaseline(
    { undatedCounts: { 'scripts/check-a.mjs::arch-exempt': 7, 'apps/x.ts::border-ink-exempt': 3 } },
    { undatedCounts: {} },
  )
  ok(
    'M03 工具面键不得留在账里(且只清它,别的面一条不动)',
    mp.next.undatedCounts['scripts/check-a.mjs::arch-exempt'] === undefined &&
      mp.next.undatedCounts['apps/x.ts::border-ink-exempt'] === 3 &&
      mp.purged.length === 1,
  )
  // M03b/M03c 成对:族从登记表移除 ⇒ 它那笔额度必须同时销掉;而**仍登记**的族一条都不许动。
  // 只测 M03b 会放过"purge 条件写宽了把全表清光"那一型 —— 那等于把存量债一夜抹平,
  // 而账面读起来像"账已清完"(本仓最高频的失效型就是这种自洽的假绿)。
  const abol = mergeBaseline(
    {
      undatedCounts: {
        'apps/x.ts::radius-exempt': 41,
        'apps/y.ts::border-ink-exempt': 2,
      },
    },
    { undatedCounts: {} },
  )
  ok(
    'M03b 已废除族(不在登记表里)的额度必须被清掉并点名',
    abol.next.undatedCounts['apps/x.ts::radius-exempt'] === undefined &&
      abol.purged.length === 1 &&
      abol.purged[0].startsWith('族已废除:apps/x.ts::radius-exempt='),
  )
  ok(
    'M03c 反向:仍登记的族一条不许动(清宽了就是把存量债一夜抹平)',
    abol.next.undatedCounts['apps/y.ts::border-ink-exempt'] === 2,
  )
  // M04:第二类账独立键空间 —— kind(eslint-disable/ts-ignore)不是豁免族名,不得被
  // undatedCounts 那一侧的族清除误清(清了 = 整本抑制账一夜抹平的自洽假绿)。
  const m4 = mergeBaseline(
    {
      undatedCounts: { 'apps/x.ts::radius-exempt': 41 },
      suppressionUndatedCounts: { 'g.ts::eslint-disable': 3, 'h.ts::ts-ignore': 7 },
    },
    {
      undatedCounts: {},
      suppressionUndatedCounts: { 'g.ts::eslint-disable': 2, 'i.ts::ts-ignore': 1 },
    },
  )
  ok(
    'M04 第二类账并集+只下调,且不被族清除波及(kind 不是族名)',
    m4.next.suppressionUndatedCounts['g.ts::eslint-disable'] === 2 &&
      m4.next.suppressionUndatedCounts['h.ts::ts-ignore'] === 7 &&
      m4.next.suppressionUndatedCounts['i.ts::ts-ignore'] === 1,
  )
  ok(
    'M05 绝不上调第二类账额度(与 M02 同一条反作弊锁,独立键空间各锁各的)',
    mergeBaseline(
      { suppressionUndatedCounts: { 'g.ts::eslint-disable': 1 } },
      { suppressionUndatedCounts: { 'g.ts::eslint-disable': 99 } },
    ).next.suppressionUndatedCounts['g.ts::eslint-disable'] === 1,
  )
  const e2e = endToEndCase()
  ok('X01 临时仓 HEAD 面:已过期豁免判红并点名', e2e.headRed)
  ok('X02 临时仓索引面与 HEAD 面结论不同(取材面真的有牙)', e2e.facesDiffer)

  const pass = results.filter(([, p]) => p).length
  for (const [n, p] of results) console.log(`${p ? '  ok' : 'FAIL'} ${n}`)
  console.log(`\ncheck-exemption-expiry --self-test:${pass}/${results.length} 通过`)
  return pass === results.length
}

/**
 * 端到端:真临时 git 仓造 HEAD / 索引两面,跑本门 CLI。这条不是为了"多测一例",而是排除
 * "判据恒真"—— 纯构造面证不了取材层真的在读**被判的那一面**(`HEAD:` 前缀那次故障在 30 多条
 * 构造面用例下全绿,只有这里红了)。
 */
function endToEndCase() {
  const gatePath = fileURLToPath(import.meta.url)
  let dir = null
  try {
    dir = mkScratch('exemption-expiry')
    const git = (args) => gitRaw(args, dir, { timeout: 30000 })
    git(['init', '-q'])
    git(['config', 'user.email', 'gate@test.invalid'])
    git(['config', 'user.name', 'gate'])
    mkdirSync(path.join(dir, 'scripts'), { recursive: true })
    const bl = { note: 'e2e 夹具', grandfatherUntil: '2099-01-01', undatedCounts: {} }
    writeFileSync(path.join(dir, BASELINE_REL), `${JSON.stringify(bl, null, 2)}\n`, 'utf8')
    // HEAD 面:一条**已过期**豁免 ⇒ E2 必红,且与基线无关
    writeFileSync(
      path.join(dir, 'a.ts'),
      'export const x = 1 // border-ink-exempt: 真圆 until 2020-01-01\n',
      'utf8',
    )
    git(['add', 'a.ts', BASELINE_REL])
    git(['commit', '-q', '-m', 'fixture'])
    const headOut = runGate(gatePath, dir, [])
    // 索引面:同一行改成未来日期 ⇒ 同一份判据必须给出不同结论(否则会红/绿不分)
    writeFileSync(
      path.join(dir, 'a.ts'),
      'export const x = 1 // border-ink-exempt: 真圆 until 2099-12-31\n',
      'utf8',
    )
    git(['add', 'a.ts'])
    const idxOut = runGate(gatePath, dir, ['--staged'])
    return {
      headRed: headOut.code === 1 && headOut.red.some((v) => v.code === 'E2'),
      facesDiffer: idxOut.code === 0 && idxOut.red.length === 0,
    }
  } catch {
    // 临时仓建不起来 ⇒ 两条一起判失败(不得"跳过即通过")
    return { headRed: false, facesDiffer: false }
  } finally {
    if (dir) {
      try {
        rmScratch(dir)
      } catch {
        /* 夹具残留不改判据结论,交给 §26 的 Temp 清理段 */
      }
    }
  }
}

function runGate(gatePath, dir, extraArgs) {
  // 2026-10-04：不吃的子进程必须给 stdio，否则本机报 spawnSync EBUSY
  const r = spawnSync(process.execPath, [gatePath, '--root', dir, '--json', ...extraArgs], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 32 << 20,
  })
  let parsed = { red: [] }
  try {
    parsed = JSON.parse(r.stdout || '{}')
  } catch {
    /* 解析不出来时只信退出码 ⇒ 断言会红,不会假通过 */
  }
  return { code: r.status, red: parsed.red || [] }
}

// ------------------------------------------------------------ CLI

const isoToday = () => new Date().toISOString().slice(0, 10)

function parseArgs(argv) {
  const i = argv.indexOf('--root')
  const { face, error } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
  })
  const json = argv.includes('--json')
  const all = argv.includes('--all')
  const update = argv.includes('--update-baseline')
  const root = i >= 0 ? path.resolve(argv[i + 1] || '.') : ROOT
  return { root, face, faceError: error, json, all, update }
}

function loadBaselineOrSeed(root, update) {
  try {
    return loadBaseline(root)
  } catch (e) {
    // 唯一允许"基线还不存在"的入口是 --update-baseline(建账动作本身)。其余档一律判死:
    // 没有账就分不清存量与新增,把它当"全没有存量"会让 248 处一次性判红。
    if (!(e instanceof Undetermined) || !update) throw e
    const until = shiftDay(isoToday(), 90)
    console.log(
      `基线缺失 ⇒ 由 --update-baseline 建账,grandfatherUntil=${until}(今天 +90 天,当次真实日期)`,
    )
    const note =
      '存量豁免的宽限截止日。到期仍有 undatedCounts 时本门整门判红(E3)——"过期未销账会自己变红"。'
    return { note, grandfatherUntil: until, undatedCounts: {} }
  }
}

function collect(root, face) {
  const rels = grepList(root, face)
  // 空扫不报绿:本仓 HEAD 实测 100+ 文件带豁免,零命中只可能是判据失效
  if (rels.length === 0) throw new Undetermined(`候选为 0(面=${face}),判据可能失效而非"没有豁免"`)
  const contents = readFace(root, face, rels)
  const entries = []
  const suppressionsByFile = {}
  const suppressionUndatedByFile = {}
  let unreadable = 0
  for (const rel of rels) {
    const text = contents.get(rel)
    if (text === null || text === undefined) {
      unreadable += 1
      continue
    }
    const r = scanFile(rel, text)
    entries.push(...r.entries)
    if (Object.keys(r.suppressions).length > 0) suppressionsByFile[rel] = r.suppressions
    if (Object.keys(r.suppressionUndated).length > 0)
      suppressionUndatedByFile[rel] = r.suppressionUndated
  }
  // 反"假绿"第二道:候选>0 却解析出 0 条标记,说明**判据正则失效**而不是"仓库没有豁免"
  // (这正是 `HEAD:` 前缀那次故障的形状:366 个候选、0 条账、绿灯)。宁判死不误绿。
  if (entries.length === 0) {
    throw new Undetermined(
      `${rels.length} 个候选里解析出 0 条豁免(取不到 ${unreadable} 个)` +
        '——判据可能失效,不按"没有豁免"记绿',
    )
  }
  return { entries, suppressionsByFile, suppressionUndatedByFile, scannedFiles: rels.length, unreadable }
}

// got = collect 的返回值(entries 与 suppressionUndatedByFile 同面同轮,拆开传就给了
// "观测来自这一秒、抑制账来自上一秒"的错位窗,E4 锚点那条注释同款教训)。
function writeBaseline(root, baseline, got, today, face) {
  const observed = {
    undatedCounts: undatedCountsOf(got.entries),
    suppressionUndatedCounts: suppressionUndatedCountsOf(got.suppressionUndatedByFile),
    updatedAt: today,
  }
  const { next, lowered, added, purged } = mergeBaseline(baseline, observed)
  const abs = path.join(root, BASELINE_REL)
  mkdirSync(path.dirname(abs), { recursive: true })
  writeFileSync(abs, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  const keys = Object.keys(next.undatedCounts).length
  const supKeys = Object.keys(next.suppressionUndatedCounts || {}).length
  console.log(
    `基线已合并(只下调+并集):下调 ${lowered.length} 键 / 新增 ${added.length} 键 / ` +
      `清出 ${purged.length} 键(工具面 prose ${purged.filter((p) => p.startsWith('工具面:')).length} / ` +
      `已废除族 ${purged.filter((p) => p.startsWith('族已废除:')).length})/ 现共 ${keys} 键` +
      `(另 lint 抑制无到期账 ${supKeys} 键),面=${face}`,
  )
}

function report(res, opts) {
  const t = res.totals
  const pairs = (o) =>
    Object.entries(o)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ')
  if (opts.json) {
    console.log(JSON.stringify({ ...t, red: res.red, soft: res.soft }, null, 2))
    return
  }
  console.log(
    `豁免到期账(面=${t.face}):标记 ${t.entries} 处 / ${t.files} 文件 / ${t.families} 族;` +
      `带到期日 ${t.dated}、无日期 ${t.undated}(基线存量 ${t.stockUndated})、已过期 ${t.expired}`,
  )
  console.log(
    `  工具面(scripts/** 的说明书 / 判据正则 / 自检夹具)${t.toolFace} 处 —— 只报数,不入账也不判红` +
      `;存档面(.ihui-agent/archive/** 的逐字副本)${t.archiveFace} 处同权只报数(被撤销的豁免是证词不是出口;` +
      `活文件里同一条过期豁免照旧判红 —— G09/G10 与镜像 T25 成对钉住)` +
      `(E1 锚点与观测同用 undatedCountsOf,两侧对称,不会因本条产出假红)`,
  )
  console.log(
    `  E1 锚点口径:` +
      (t.anchor === 'head-self'
        ? '全量档 —— "本次"即 HEAD 自身,E1 不响(存量由 grandfatherUntil / S1 报数管,E2/E3 照旧判红)'
        : t.anchor === 'head-measured'
          ? '提交链档 —— 取 HEAD 现测 ∪ 基线存量,两者取大'
          : `⚠ ${t.anchor}`),
  )
  console.log(
    `  挂靠方式:${pairs(t.byAttach)};缺原因 ${t.reasonless} 处(各门自身判据负责,本门只计不判红)`,
  )
  console.log(
    `  lint 抑制面(总账只报数):${pairs(t.suppressTotals)} / ${t.suppressFiles} 文件;` +
      `其中无到期豁免 ${t.suppressUndatedTotal} 处(E5 棘轮:提交链档新增须同行带 until,存量照旧只报数)`,
  )
  const fams2 = t.unregisteredFamilies.length ? t.unregisteredFamilies.join(',') : '(无)'
  const gState = t.grandfatherOpen ? '存量豁免仍只报数' : '已过期:缺日期即红'
  const g = t.grandfather || '(缺失)'
  console.log(`  未登记族:${fams2};基线 stale 键 ${t.staleKeys};grandfatherUntil=${g} (${gState})`)
  const used2 = t.unregisteredUsedFamilies.length ? t.unregisteredUsedFamilies.join(',') : '(无)'
  console.log(
    `  其中被豁免侧真在用:${used2}(E4 锚点=${t.e4Anchor};` +
      (t.e4Anchor === 'head-self'
        ? '全量档 —— "本次"即 HEAD 自身,E4 不响,存量由本行报数管'
        : '提交链档 —— 取 HEAD 现测的族集合当锚点,新增未登记族即红') +
      ';解阻前置 = 给在用族补 FAMILY_LIFETIME_DAYS 档位 + 一句理由,之后 E4 才谈收进 blocking 语义)',
  )
  console.log(`  候选文件 ${t.scannedFiles} 个,其中取不到内容 ${t.unreadable} 个`)
  if (opts.all) {
    for (const [fam, n] of Object.entries(t.byFamily).sort((a, b) => b[1] - a[1])) {
      console.log(
        `    ${fam}: ${n} 处(建议存活期 ${FAMILY_LIFETIME_DAYS[fam] ?? DEFAULT_LIFETIME_DAYS} 天)`,
      )
    }
    for (const v of res.red) console.log(`    [${v.code}] ${v.msg}`)
  }
}

function cliRun(opts) {
  const { root, face, json, update } = opts
  assertRepoRoot(root, '本门')
  const baseline = loadBaselineOrSeed(root, update)
  const got = collect(root, face)
  const today = isoToday()
  // E1 的锚点:面不是 HEAD 时,现读一份 HEAD 的同族计数当锚点(G-174)。
  // 全量档(面=head)不取 —— 自己比自己必然相等,E1 在那里结构上不该响;它本来就是"本次提交
  // 相对上一次"的棘轮,不是存量账(存量由 grandfatherUntil / S1 报数管)。
  let headEntries = null
  let headSuppressionUndatedByFile = null
  if (face !== 'head') {
    try {
      // 一次 collect 同时喂 E1/E4/E5 三把锚:E1/E4 要 entries、E5 要 suppressionUndatedByFile,
      // 拆两次 collect 会各自看见不同的仓库瞬间(同面同轮铁律)。
      const headGot = collect(root, 'head')
      headEntries = headGot.entries
      headSuppressionUndatedByFile = headGot.suppressionUndatedByFile
    } catch (e) {
      console.log(
        `  ⚠️ HEAD 锚点取不到(${e.message.slice(0, 70)})⇒ E1 退回"只看基线存量"口径,` +
          '此时若基线被历史低估,可能产出一条抬不动的恒红(见 PROJECT_PLAN G-174);' +
          'E4 同批退回"族集合自己比自己"⇒ 该档不判红;E5 整维退回只报数(基线可能还没有' +
          'suppressionUndatedCounts 字段,拿 0 当锚点 = 恒红存量)—— 不冒红也不假装判过',
      )
    }
  }
  const headCounts = resolveAnchor({ face, entries: got.entries, headEntries })
  // E4 的锚点与 E1 同一份取材(同面同轮):两次 collect 会各自看见不同的仓库瞬间,产出"观测来自
  // 索引、锚点来自上一秒的 HEAD"这种自洽却错位的尺子。面=head 时不取,自己比自己必然相等。
  const headUnregisteredFamilies =
    face === 'head' || !headEntries ? null : unregisteredUsedFamiliesOf(headEntries)
  // E5 的锚点同源同轮(与 E1 的 resolveAnchor 同型:面=head 自比必相等 ⇒ 结构上不响;
  // HEAD 取不到 ⇒ null ⇒ analyze 退回只报数)。
  const headSuppressionCounts = resolveSuppressionAnchor({
    face,
    undatedByFile: got.suppressionUndatedByFile,
    headUndatedByFile: headSuppressionUndatedByFile,
  })
  const res = analyze({
    entries: got.entries,
    suppressionsByFile: got.suppressionsByFile,
    suppressionUndatedByFile: got.suppressionUndatedByFile,
    baseline,
    today,
    headCounts,
    headUnregisteredFamilies,
    headSuppressionCounts,
  })
  res.totals.face = face
  res.totals.anchor =
    headCounts === null ? 'baseline-only(锚点取不到)' : face === 'head' ? 'head-self' : 'head-measured'
  res.totals.unreadable = got.unreadable
  res.totals.scannedFiles = got.scannedFiles
  if (update) {
    writeBaseline(root, baseline, got, today, face)
    return 0
  }
  report(res, opts)
  if (res.red.length > 0) {
    for (const v of res.red) console.error(`  ✗ [${v.code}] ${v.msg}`)
    console.error(`判红 ${res.red.length} 条`)
    return 1
  }
  // --json 档的 stdout 必须是**纯 JSON**:归因层按 JSON.parse 读失败门清单,
  // 尾巴上多一行人类文案就把整道门读成"解析不到 ⇒ 未归因"。
  if (!json) console.log('  ✓ 缺日期(新增)= 0 / 已过期 = 0 / 存量账未过期')
  return 0
}

function main(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(
      '用法:node scripts/check-exemption-expiry.mjs [--all|--json|--staged|--worktree|' +
        '--self-test|--update-baseline|--root <dir>]',
    )
    return 0
  }
  if (argv.includes('--self-test')) return selfTest() ? 0 : 1
  const opts = parseArgs(argv)
  if (opts.faceError) {
    console.error(`无法判定:${opts.faceError}`)
    return 2
  }
  try {
    return cliRun(opts)
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`无法判定:${e.message}`)
      return 2
    }
    throw e
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  process.exit(main(process.argv.slice(2)))
}

export const __test__ = {
  scanFile,
  analyze,
  mergeBaseline,
  resolveAnchor,
  resolveSuppressionAnchor,
  suppressionUndatedCountsOf,
  undatedCountsOf,
  isFamilyRegistered,
  unregisteredUsedFamiliesOf,
  undatedKey,
  loadBaseline,
  MARKER_RE,
  PREFILTER_RE,
  SELF_EXEMPT_RE,
  TOOL_FACE_RE,
  ARCHIVE_FACE_RE,
  FAMILY_LIFETIME_DAYS,
  DEFAULT_LIFETIME_DAYS,
  BASELINE_REL,
  parseMarkerTail,
  isStandaloneComment,
  dayDiff,
  isPast,
  selfTest,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
