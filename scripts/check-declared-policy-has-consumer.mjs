#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门:「策略/契约的声明必须有非测试消费者」对账(2026-09-26 立,第八批 8F/8A 取证落地票)
//
// 在修什么(本仓最高频失效型:"造好没装车"):
//   1. `apps/cli/src/sessions/state-store.ts` 的 `DEFAULT_MAX_AGE_MS`(7 天会话保留策略)与
//      `pruneOldSessions()` —— 实测全仓零非测试调用方,一条"已声明、从未执行"的保留策略;
//   2. `packages/types/src/tool-contract.ts` 的 `ToolResultBudgetContract` 与契约谓词
//      (`mayWriteWorkspace`/`touchesExternalWorld`)—— 非测试面零 importer(注释提及不算)。
//   这类声明在类型系统、typecheck、lint 里全都不红:写下来 = 看起来存在,执行 = 无人保证。
//   本门把「声明 ↔ 消费者」变成机器事实:**策略/契约一类的声明必须有非测试消费者**。
//
// 判据形态(按本仓实际取,宁窄不误报;判不出的只报数不判红):
//   C1 策略常量:顶层 const/let/var 名含 MAX_AGE / MAXAGE / TTL / RETENTION 族(大写-下划线形态,
//      故 camelCase 的 `artifactRetentionDays` 不误纳;非导出的模块私有常量也立案 ——
//      "已声明、从未执行"最常见就是这种);
//   C2 名字含 `BudgetContract` 的任何顶层声明;
//   C3 `packages/types/src` 里 `export interface|type *Contract(s)`;
//   C4 `packages/types/src` 里 `export function (may|should|must|can|touches|requires)[A-Z]…` 谓词;
//   C5 任意扫描根里 `export function (prune|cleanup|purge|expire|sweep)[A-Z_]…` 清理函数
//      (8F A8F-6:"每个保留策略必须有可指认的触发消费者")。
//   C6(G-816043)i18n 码表键:`packages/i18n/messages/<面板>/<lang>.json` 里**五语言全有**
//      的键,反查全仓生产面发射点 —— "有译文却零生产者"是 C1~C5 都看不见的一种未接线。
//      零发射 ⇒ 未接线(按面板归 `…/<面板>/en.json` 计数,走同一棘轮;动态拼键只报数)。
//   C7(G-816034 ①②)工厂族:任意扫描根里**导出**且名字形如 `create*Handler` / `create*Transport`
//      的**工厂**(本票立项的那一格:造好没装车 + 带着绿灯测试却零生产调用方 —— C1~C5 看不见它:
//      它既不是 TTL/预算常量、也不是 `*Contract`、也不是 `(prune|cleanup|…)` 清理函数)。
//      立案要**两条**都成立:① 名字 `^create(非小写)…(Handler|Transport)$` 且 `export`;
//      ② **定义形态读得出是工厂**(函数声明,或 `const/let = function|箭头`,允许中间夹返回类型标注)。
//      ②就是票面那条「同词不同义」的落地:**不得按名字一律算候选** —— 同名的
//      `interface`/`type`/`class`/对象初值/方法都判"不是工厂"(实测真仓两处正是这一型:
//      `apps/api/src/plugins/upload-scanner.ts:270` 的接口字段、`apps/api/src/services/email-service.ts:100`
//      的 `createTransport(opts…)` 方法,连顶层声明都不是);名字命中但**声明行读不出初值**
//      (如 `export let createXHandler`)⇒ **报数并逐条点名、不立案**(判不了 ≠ 判没有,也 ≠ 判红 ——
//      与本门 C6 对"判不了"的既有口径同一:动态拼键/歧义绑定只报数;把它并进 exit 2 会让一种合法
//      写法成为与任何提交无关的恒红门,§12e)。真正让 C7 落**未判定**的是"集合根本推不出来":
//      扫描根文件在判定面取不到内容 ⇒ undetermined ⇒ exit 2(不记绿,沿用本门既有那条)。
//      定级**沿用本门既有口径**,本票不升级:全量档只报数不判红、`--staged` 与 C1~C6 走**同一条**
//      perFile 棘轮(新增即拦、存量不追)。升 blocking 的前置 = 该族存量清零(§12e:与任何提交
//      无关的恒红门只会逼人 `--no-verify`、连带废掉全部守门)。
//      新族的存量读数由 judge() 的 `factory` 字段当场给出(候选数 / 零生产调用方逐条点名 /
//      读不出形态逐条点名),全量档打印在 C7 行,`--json` 里同名可读。
//      现读(2026-10-05,HEAD 面,本枚改动跑出来的):候选 21 / 零生产调用方 6 / 形态读不出 0。
//      这 6 条里 4 条是真零调用方,2 条(`createTaroTransport`、`createTaroStreamTransport`)是
//      下面"已知限制"里"取用面从第一个顶层声明起算"那一型 —— 消费者真在生产面,只是写在前面。
//
// "接线"的算法(与守门 64/115 同族的收口点):
//   - 消费者 = **生产面文件**(扫描根 apps/*/src + packages/*/src;测试面整面排除:
//     `**/tests?/**`、`**/__tests__/**`、`*.test.*`、`*.spec.*`、`**/e2e/**` —— "组件自带测试
//     会让孤儿全绿"是登记在案的失效型;scripts/ 是工具层,按名扫字符串不算 runtime 消费者);
//   - 引用必须**成链**:消费者要有指向声明方模块的 import 绑定(specifier 能对上声明文件的
//     基名/父目录/所属 `@ihui/<pkg>` 包名),且导入名(或其别名)在 import 语句之外被真的用到;
//     **注释与字符串里的提及一律不算**(本仓"看起来有、其实没装车"最高频形态就是注释提及);
//     文件自己还声明同名符号 ⇒ 不算消费别人的(同名不同物,如 apps/api 也有自己的 listSessions);
//     `export { X } from` 纯 re-export 不算消费者(barrel 不消费)。
//   - **传递闭包**:同文件内"甲的声明体引用了乙"记一条甲→乙边;甲被生产面消费 ⇒ 乙也算被消费。
//     这是保留策略的真实形状:常量喂给 prune 函数、prune 挂在写生命周期点、写入口被命令面 import。
//     没有闭包,"给签名默认值接一处调用"的正常修法会被误判红;有了闭包,它仍拦得住
//     "整条链没有任何外部入口"的死声明 —— 两条变异对照(--self-test M1/M2)分别禁用
//     no-closure 与 no-external-refs 一支,已接线夹具必须从绿退回红,否则那条分支是恒真摆设。
//   - **C6 的接线**(i18n 键反查生产点):发射形态按本仓实际 ——
//     `const t = useTranslations('chat')` / `await getTranslations('chat')` 按**变量名**绑 ns
//     (嵌套 ns 带点照收);`t('key')` / `t.rich|raw|markup('key',…)` ⇒ 全键 = ns + '.' + key;
//     `t(`items.${x}`)` ⇒ 静态前缀 `ns.items.` 覆盖其下所有键;`` t(`${x}`) ``/`t(表达式)`/
//     动态 ns ⇒ 计动态报数(不接线、不判红 —— 判不了 ≠ 判没有);同文件同名变量绑两个
//     不同的 ns ⇒ 计歧义报数,同样不接线。运行时各端词包经 packages/i18n/src/loader.ts 的
//     mergeMessages **深合并成一棵树**,故发射点全键与任一面板词表同串即算接线(跨面板
//     不区分,这是运行时的真实形状)。
//   - **C6 的第二族发射形态**(非 next-intl,cli/miniapp-taro/mobile-rn/extension 的真实形状):
//     `import { t } from '…i18n…'` ⇒ `t('全键')` 直发;`import { i18n }` ⇒ `i18n.t('全键')`;
//     `import { translate } from '…i18n…'` ⇒ `translate('key',…)` 单参形与
//     `translate(messages,'key',…)` 双参形(mobile-rn/extension 各占其一);
//     `const tt = useTt()` / `const { t } = useI18n()` 钩子返回的取词函数。
//     这族全按**根 ns**处理:字符串实参本身即全键;specifier 认 "i18n" 字样
//     (next-intl 不含,不撞)。残余不可见形(如 extension 里"本地包装函数再转 translate"
//     的中转层、未绑定接收者的 `deps.translate('key')`)如实登记为已知限制。
//
// 判据不会恒红(本仓反复付学费换来的一条):存量走**棘轮**,锚点 = 该文件在 HEAD 自身的
// 未接线数 —— 只拦"这次改动把未接线加回来了",不追仓库既有债。与改动无关的 blocking 红
// 只会逼人 `--no-verify`,连带废掉全部守门。
//
// 三种取材口径(同 70/77/83/98/101/103/112/113):
//   缺省(全量)判 HEAD blob(报存量清单,不判红;`--strict` 才按"存在未接线"判红,供 CI 问责);
//   `--staged` 判索引 blob(被审内容判索引、锚点判 HEAD,两面各判一次再逐文件比对);
//   `--worktree` 仅人工逃生舱;`--staged` 与 `--worktree` 同给 ⇒ 判死;
//   任一候选文件内容取不到 ⇒ exit 2「无法判定」(既不冒红也绝不记绿);
//   判定面枚举到 0 个扫描根源文件 ⇒ 判死(空扫不记绿)。
//
// 已知限制(如实登记,不以豁免遮):
//   - specifier 兼容判定只认"文件基名 / 直接父目录 / @ihui/<pkg>"三种链形,更深的 barrel 跳数
//     不追(失误方向是把"已接线"错判成"未接线",由棘轮与全量档只报数兜住);
//   - **取用面从该文件第一个顶层声明起算**(`parseFile` 的 uses/edges 先要认出一个 host):
//     写在所有顶层声明**之前**的模块级调用(入口文件最常见的 `setTransport(createXTransport())`
//     形态)不被认成消费者。这一条自 C1~C5 立项就在,方向同样是"把已接线判成未接线"(更严),
//     由棘轮与全量档只报数兜住;本票**不改它** —— 动 `uses` 的收集范围会换掉既有四族与 C6 的
//     现读数,那是另一枚票的活(改哪一面都要同枚重述存量)。C7 现读 6 条里的
//     `apps/miniapp-taro/src/utils/api-client-transport.ts:32 createTaroTransport` 与
//     `apps/miniapp-taro/src/utils/taro-stream-transport.ts:46 createTaroStreamTransport` 正是
//     这一型(消费方 `apps/miniapp-taro/src/app.tsx:56/57` 真在调,而那两行位于第 118 行第一个
//     顶层声明之前);其余 4 条经逐条读定义确认是真零生产调用方。
//   - 类型可达 ≠ 运行时供给:接口字段把某契约类型引到位,闭包会判"已接线"。
//     "工具字面量到底有没有供 contract(含 resultBudget)"由守门 111 按同族判据管,两门互补。
//   - C6(G-816043):「有值」只认票面五语言(en/ja/ko/zh-CN/zh-TW)全有,缺任一语言的面板
//     整面板跳过并报数(不静默算绿);import 别名(`useTranslations as ut`)与内联调用
//     `(await getTranslations('ns'))('key')` 形态不追(本仓 src 实测零使用,追了会扩误报面,
//     失误方向是把已接线判未接线,棘轮兜住);模板前缀覆盖可能偏宽(`items${i}` 连
//     itemsFoo 一起盖住)—— 宁可少红不假绿;泛用变量名(如 t)若还兼作他用会误接线,
//     同由全量档只报数与棘轮兜底。
//   - C7(G-816034):形状判据读的是**遮噪后的顶层声明行**(与 C1~C5 同一份 parseFile 面,注释与
//     字符串里的同名提及因此天然不可见),只看这一行:`= …` 换行才写初值的读成"非工厂"(漏报方向)、
//     一行多个声明符只读第一个(同上)、`= 别的工厂调用`(如 `= composeHandlers(…)`)读不出返回类型
//     也归"非工厂"。名字命中而**整行没有 `=`** 的 ⇒ 报数逐条点名、不立案(不判红也不 exit 2,
//     理由见上面 C7 那段与 §12e);出路是把它写成函数形态或就地赋值,不是给门加豁免。
//
// 手动:
//   node scripts/check-declared-policy-has-consumer.mjs                # 全量(HEAD)报存量
//   node scripts/check-declared-policy-has-consumer.mjs --staged       # 提交链(索引 vs HEAD 锚点)
//   node scripts/check-declared-policy-has-consumer.mjs --strict       # 存量问责档(CI)
//   node scripts/check-declared-policy-has-consumer.mjs --self-test    # 判据自检(零副作用)
// 紧急跳过:HUSKY_SKIP_DECLARED_POLICY_CONSUMER=1

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, assertRepoRoot, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15,不得写死盘符) */
const ROOT = resolve(HERE, '..')

export const SELF_SKIP = 'HUSKY_SKIP_DECLARED_POLICY_CONSUMER'
const GIT_TIMEOUT = 120000
export const FACE_NAME = { head: 'HEAD blob', staged: '索引 blob', worktree: '工作树(逃生舱)' }

/** 声明候选与消费者共用的扫描根:各端/各包的 src 面。scripts/ 是工具层,刻意不入面。 */
const SCAN_ROOT_RE = /^(?:apps|packages)\/[^/]+\/src\//
const SRC_EXT_RE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/
/** 测试面:消费判定与候选判定整面排除 */
const TEST_FACE_RE = /(?:^|\/)(?:tests?|__tests__|spec|e2e)\/|\.test\.[^/]+$|\.spec\.[^/]+$/

export function inScanRoot(p) {
  return SCAN_ROOT_RE.test(p) && SRC_EXT_RE.test(p) && !TEST_FACE_RE.test(p)
}

// ==================== 候选声明的形态(C1~C5 + C7,宁窄不误报)====================

/** C1 策略常量:大写-下划线族的 MAX_AGE / MAXAGE / TTL / RETENTION */
export function isPolicyConstName(name) {
  return /(?:^|_)(?:MAX_AGE|MAXAGE|TTL|RETENTION)(?:_|$)/.test(name)
}
/** C2 名字含 BudgetContract 的任何顶层声明 */
export function isBudgetContractName(name) {
  return name.includes('BudgetContract')
}
/** C3 packages/types 里以 Contract/Contracts 结尾的导出类型 */
export function isContractTypeName(name, rel, exported) {
  return exported && rel.startsWith('packages/types/src/') && /Contracts?$/.test(name)
}
/** C4 packages/types 里情态动词开头的导出谓词函数 */
export function isPredicateFnName(name, rel, exported) {
  return (
    exported &&
    rel.startsWith('packages/types/src/') &&
    /^(?:may|should|must|can|touches|requires)[A-Z]/.test(name)
  )
}
/** C5 任意扫描根里清理族导出函数(prune/cleanup/purge/expire/sweep 前缀 + 紧跟大写/下划线/结尾) */
export function isCleanupFnName(name, exported) {
  return exported && /^(?:prune|cleanup|purge|expire|sweep)(?:[A-Z_]|$)/.test(name)
}
/**
 * C7 名字形如 create*Handler / create*Transport 的**导出**工厂(G-816034 ①②)。
 * 宁窄:`create` 之后不得紧跟小写(故 `createdHandler` 这类巧合不命中),结尾恰为
 * Handler/Transport(故 `createHandlerFactory`、复数 `…Handlers` 都不命中 —— 复数更像集合而非工厂)。
 * 名字只是**第一道**,第二道是 declShape(见下):同词不同义不得按名字一律算候选。
 */
export function isHandlerFactoryName(name, exported) {
  return exported && /^create(?![a-z])[A-Za-z0-9_$]*(?:Handler|Transport)$/.test(name)
}

// 工厂的"定义形态"三态(判据只读**声明行**这一条语法事实,不引第二台词法器):
//   'factory'     ⇒ 函数声明(含 async),或变量声明且初值是 function/箭头(允许中间夹返回类型标注)
//   'not-factory' ⇒ 明确不是工厂:interface/type/enum/class、对象/数组/字面量/别的调用
//   'unknown'     ⇒ 名字命中但声明行读不出形态(如 `export let createXHandler` 整行无初值)
// 落子规则:not-factory **不立案**(宁窄,失误方向是漏报)、unknown **报数并逐条点名但不立案**
// (判不了 ≠ 判没有,也 ≠ 判红 —— 与本门 C6 的"动态拼键/歧义绑定只报数"同口径),
// factory 才进候选集。
export const DECL_SHAPES = ['factory', 'not-factory', 'unknown']
/** 变量初值写成 function / 箭头才算工厂(`: T` 返回类型标注可以夹在参数与 `=>` 之间) */
const FACTORY_INIT_RE = /=\s*(?:async\s+)?(?:function\b|[A-Za-z0-9_$]+\s*=>|\([^)]*\)\s*(?::[^=]*)?=>)/

/**
 * 声明行 ⇒ 工厂形态三态。`kind` 是 TOP_DECL_RES 命中的规则号
 * (0=function / 1=const|let|var / 2=class / 3=interface|type|enum)。
 */
export function declShape(line, kind) {
  const l = String(line ?? '')
  if (kind === 0) return 'factory'
  if (kind === 2 || kind === 3) return 'not-factory'
  if (kind !== 1) return 'unknown'
  if (FACTORY_INIT_RE.test(l)) return 'factory'
  return l.includes('=') ? 'not-factory' : 'unknown'
}

export function candidateKinds(name, rel, exported, shape = 'unknown') {
  const kinds = []
  if (isPolicyConstName(name)) kinds.push(exported ? 'policy-const' : 'policy-const-module-private')
  if (isBudgetContractName(name)) kinds.push('budget-contract')
  if (isContractTypeName(name, rel, exported)) kinds.push('contract-type')
  if (isPredicateFnName(name, rel, exported)) kinds.push('predicate-fn')
  if (isCleanupFnName(name, exported)) kinds.push('cleanup-fn')
  // C7 只收"读得出是工厂"的声明;同名而定义是类型/对象/方法的 ⇒ 同词不同义,不立案。
  if (shape === 'factory' && isHandlerFactoryName(name, exported)) kinds.push('handler-factory')
  return kinds
}

// ==================== C6 维:i18n 码表键 ⇒ 反查生产点(G-816043)====================

/** 词表路径:packages/i18n/messages/<面板>/<lang>.json(7 面板 × 5 语言) */
export const LEXICON_RE = /^packages\/i18n\/messages\/([^/]+)\/([^/]+)\.json$/
/** 「有值」口径 = 票面五语言全有(宁窄:翻译不全的半成品键不立案,防误报) */
export const LEX_LANGS = ['en', 'ja', 'ko', 'zh-CN', 'zh-TW']

export function isLexiconPath(p) {
  return LEXICON_RE.test(p)
}

/** 词表嵌套 JSON ⇒ 点路径叶子集合(标量/数组/null 都算叶子;空对象不出路径) */
export function flattenLexicon(value, prefix = '', out = new Set()) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    if (prefix) out.add(prefix)
    return out
  }
  for (const [k, v] of Object.entries(value)) flattenLexicon(v, prefix ? `${prefix}.${k}` : k, out)
  return out
}

/**
 * 从一个源文件提出 i18n 发射点(发射形态与歧义规则见头注「C6 的接线」)。
 *
 * 为什么不复用现成两层遮噪:maskCommentsKeepStrings 会把模板串内容整段遮白 ——
 * `t(`items.${x}`)` 的静态前缀随之消失(前缀覆盖判不了);blankStringContents 更是把
 * `t('key')` 的键本体吞掉。故这里自带一台扫描器:遮注释、**保留**字符串与模板内容,
 * 同时记下「数据区」区间(字符串内容 + 模板静态段)—— 调用匹配只认落在**代码区**的
 * 发射点,字符串字面量里的 `"t('key')"` 伪调用因此不可见(方向:宁漏报不假绿)。
 */
export function extractI18nUsages(text) {
  const out = text.split('')
  const dataStart = []
  const dataEnd = []
  const n = text.length
  let i = 0
  while (i < n) {
    const c = text[i]
    const d = text[i + 1]
    if (c === '/' && d === '/') {
      let j = i
      while (j < n && text[j] !== '\n') j++
      for (let k = i; k < j; k++) if (out[k] !== '\n') out[k] = ' '
      i = j
      continue
    }
    if (c === '/' && d === '*') {
      let j = i + 2
      while (j < n && !(text[j] === '*' && text[j + 1] === '/')) j++
      const close = j < n ? j + 2 : n
      for (let k = i; k < close; k++) if (out[k] !== '\n') out[k] = ' '
      i = close
      continue
    }
    if (c === '"' || c === "'") {
      let j = i + 1
      while (j < n && text[j] !== c && text[j] !== '\n') {
        if (text[j] === '\\') j++
        j++
      }
      dataStart.push(i)
      dataEnd.push(Math.min(j + 1, n))
      i = Math.min(j + 1, n)
      continue
    }
    if (c === '`') {
      // 模板:静态段(反引号之间、${} 之外)是数据区;${} 插值是代码区(里面可以有真调用)
      let j = i + 1
      let depth = 0
      let segStart = j
      while (j < n) {
        if (text[j] === '\\') {
          j += 2
          continue
        }
        if (text[j] === '$' && text[j + 1] === '{') {
          if (depth === 0 && j > segStart) {
            dataStart.push(segStart)
            dataEnd.push(j)
          }
          depth++
          j += 2
          segStart = j
          continue
        }
        if (text[j] === '}' && depth > 0) {
          depth--
          j++
          segStart = j
          continue
        }
        if (depth === 0 && text[j] === '`') break
        j++
      }
      if (depth === 0 && j > segStart && segStart < n) {
        dataStart.push(segStart)
        dataEnd.push(Math.min(j, n))
      }
      i = Math.min(j + 1, n)
      continue
    }
    i++
  }
  const code = out.join('')
  // 区间按扫描顺序 push ⇒ start 单调升,二分即可
  const inData = (idx) => {
    let lo = 0
    let hi = dataStart.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (idx < dataStart[mid]) hi = mid - 1
      else if (idx >= dataEnd[mid]) lo = mid + 1
      else return true
    }
    return false
  }
  // ns 声明的实参:'ns' / { …, namespace: 'ns' } / ()空参 ⇒ 根 ns;`…`/表达式 ⇒ 动态(null)
  const parseNsArg = (rest) => {
    const sm = /^\s*(['"])((?:\\.|(?!\1).)*)\1/.exec(rest)
    if (sm) return sm[2]
    const om = /^\s*\{[^}]*?namespace:\s*(['"])((?:\\.|(?!\1).)*)\1/.exec(rest)
    if (om) return om[2]
    if (/^\s*(?:\)|\{)/.test(rest)) return ''
    return null
  }
  // 发射实参:'key' ⇒ 全键;`pre${…}` ⇒ 静态前缀;`…`无前置静态/其他表达式 ⇒ 动态
  const parseCallArg = (rest) => {
    const sm = /^\s*(['"])((?:\\.|(?!\1).)*)\1/.exec(rest)
    if (sm) return { kind: 'key', value: sm[2] }
    const tm = /^\s*`([^`]*)`/.exec(rest)
    if (tm) {
      const d = tm[1].indexOf('${')
      if (d < 0) return { kind: 'key', value: tm[1] }
      if (d === 0) return { kind: 'dynamic', value: '' }
      return { kind: 'prefix', value: tm[1].slice(0, d) }
    }
    return { kind: 'dynamic', value: '' }
  }
  const BIND_RE = /\b(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\s*\(/g
  const nsByLocal = new Map() // 变量名 → Set<ns|null>(null=动态 ns;多个不同元素 ⇒ 歧义)
  let m
  while ((m = BIND_RE.exec(code))) {
    if (inData(m.index)) continue
    const ns = parseNsArg(code.slice(m.index + m[0].length, m.index + m[0].length + 240))
    if (!nsByLocal.has(m[1])) nsByLocal.set(m[1], new Set())
    nsByLocal.get(m[1]).add(ns)
  }
  const fullKeys = []
  const prefixes = []
  let dynamic = 0
  let ambiguous = 0
  for (const [local, nsSet] of nsByLocal) {
    const callRe = new RegExp(
      `(?<![A-Za-z0-9_$.])${local.replace(/\$/g, () => '\\$')}\\s*(?:\\.(?:rich|raw|markup)\\s*)?\\(`,
      'g',
    )
    while ((m = callRe.exec(code))) {
      if (inData(m.index)) continue
      if (nsSet.size > 1) {
        ambiguous++
        continue
      }
      const ns = [...nsSet][0]
      if (ns === null) {
        dynamic++
        continue
      }
      const arg = parseCallArg(code.slice(m.index + m[0].length, m.index + m[0].length + 400))
      if (arg.kind === 'dynamic') {
        dynamic++
        continue
      }
      const full = ns ? `${ns}.${arg.value}` : arg.value
      if (arg.kind === 'prefix') prefixes.push(full)
      else fullKeys.push(full)
    }
  }
  // 第二族:非 next-intl 的取词入口(本仓 cli / miniapp-taro / mobile-rn / extension 的真实形状):
  //   import { t } from '…i18n…'        ⇒ t('cli.x') 根 ns 全键直发(cli、miniapp-taro)
  //   import { i18n } from '…i18n…'     ⇒ i18n.t('cli.x')(.t 成员)
  //   import { translate } from '…i18n…' ⇒ translate('key',…) 单参形 / translate(msgs,'key',…) 双参形
  //     (mobile-rn 把 loader 的 messages-first 包装成 key-first;extension 直用双参形)
  //   const tt = useTt() / const { t } = useI18n() ⇒ 钩子返回的取词函数,根 ns
  // 判据:import specifier 含 "i18n"(命中 @ihui/i18n、./i18n、@/i18n 等;next-intl 不含 i18n
  // 字样,不撞)。这族全按**根 ns**处理:字符串实参本身即全键。
  const rootEmitters = new Map() // local → 't' | 'i18n' | 'translate'
  CLAUSE_RE.lastIndex = 0
  while ((m = CLAUSE_RE.exec(code))) {
    if (inData(m.index)) continue
    if (m[1] !== 'import' || !/i18n/i.test(m[3])) continue
    const braces = /\{([^}]*)\}/.exec(m[2])
    const addLocal = (imported, local) => {
      if ((imported === 't' || imported === 'translate' || imported === 'i18n') && !rootEmitters.has(local))
        rootEmitters.set(local, imported)
    }
    if (braces) {
      for (const raw of braces[1].split(',')) {
        const piece = raw.trim()
        if (!piece) continue
        const asM = /^([A-Za-z0-9_$]+)\s+as\s+([A-Za-z0-9_$]+)$/.exec(piece)
        if (asM) addLocal(asM[1], asM[2])
        else if (/^[A-Za-z0-9_$]+$/.test(piece)) addLocal(piece, piece)
      }
    } else {
      const defM = /^(?:\*\s+as\s+)?([A-Za-z0-9_$]+)$/.exec(m[2].trim())
      if (defM && !rootEmitters.has(defM[1])) rootEmitters.set(defM[1], 'i18n')
    }
  }
  const HOOK_RE = /\b(?:const|let|var)\s+(?:([A-Za-z0-9_$]+)\s*=|\{([^}]+)\}\s*=)\s*(?:await\s+)?(?:useTt|useI18n)\s*\(\s*\)/g
  while ((m = HOOK_RE.exec(code))) {
    if (inData(m.index)) continue
    const add = (local) => {
      if (local && !rootEmitters.has(local)) rootEmitters.set(local, 't')
    }
    if (m[1]) add(m[1])
    else if (m[2]) for (const raw of m[2].split(',')) add((/^([A-Za-z0-9_$]+)/.exec(raw.trim()) || [])[1])
  }
  for (const [local, kind] of rootEmitters) {
    if (nsByLocal.has(local)) continue // 同名变量已被 next-intl 绑定认领,不重复计
    // i18n 对象只认 .t 成员;直发函数顺带认 .rich/.raw/.markup(与 next-intl t 同形)
    const method = kind === 'i18n' ? '\\.t\\s*' : '(?:\\.(?:t|rich|raw|markup)\\s*)?'
    const callRe = new RegExp(
      `(?<![A-Za-z0-9_$.])${local.replace(/\$/g, () => '\\$')}\\s*${method}\\(`,
      'g',
    )
    while ((m = callRe.exec(code))) {
      if (inData(m.index)) continue
      const rest = code.slice(m.index + m[0].length, m.index + m[0].length + 400)
      let arg
      if (kind === 'translate') {
        if (/^\s*['"`]/.test(rest)) {
          arg = parseCallArg(rest) // key-first 形:第一实参就是键
        } else {
          // messages-first 形:键在第二实参;第一实参近似为"到第一个顶层逗号为止"
          const m2 = /^\s*[^,)]*,\s*(?:(['"])((?:\\.|(?!\1).)*)\1|`([^`]*)`)/.exec(rest)
          if (!m2) {
            dynamic++
            continue
          }
          if (m2[1] !== undefined) arg = { kind: 'key', value: m2[2] }
          else {
            const d = m2[3].indexOf('${')
            arg =
              d < 0
                ? { kind: 'key', value: m2[3] }
                : d === 0
                  ? { kind: 'dynamic', value: '' }
                  : { kind: 'prefix', value: m2[3].slice(0, d) }
          }
        }
      } else arg = parseCallArg(rest)
      if (arg.kind === 'dynamic') {
        dynamic++
        continue
      }
      if (arg.kind === 'prefix') prefixes.push(arg.value)
      else fullKeys.push(arg.value)
    }
  }
  return { fullKeys, prefixes, dynamic, ambiguous }
}

/**
 * C6 聚合:全仓生产面发射点 vs 五语言词表对账(纯函数;自检/镜像测试都构造输入)。
 * @param files Map<rel, text|null> —— 与 C1~C5 同一判定面的扫描根源文件
 * @param lexicon Map<rel, text|null> —— 同面词表 JSON(HEAD/索引 blob,只读不改)
 * 未接线键按面板归 `packages/i18n/messages/<面板>/en.json` 计数 ⇒ 并入 perFile 走同一棘轮。
 */
export function judgeI18n(files, lexicon) {
  const emittedFull = new Set()
  const emittedPrefixes = []
  let dynamic = 0
  let ambiguous = 0
  for (const [rel, text] of files) {
    if (!inScanRoot(rel) || typeof text !== 'string') continue
    const u = extractI18nUsages(text)
    dynamic += u.dynamic
    ambiguous += u.ambiguous
    for (const k of u.fullKeys) emittedFull.add(k)
    for (const p of u.prefixes) emittedPrefixes.push(p)
  }
  const groups = new Map() // 面板 → { lang → 文本 }
  const undetermined = []
  const skipped = []
  for (const [rel, text] of lexicon) {
    const lm = LEXICON_RE.exec(rel)
    if (!lm) continue
    if (typeof text !== 'string') {
      undetermined.push(`${rel}: 判定面取不到内容`)
      continue
    }
    if (!groups.has(lm[1])) groups.set(lm[1], {})
    groups.get(lm[1])[lm[2]] = text
  }
  const byFolder = {}
  const perFile = {}
  for (const [folder, langs] of groups) {
    const missing = LEX_LANGS.filter((L) => !(L in langs))
    if (missing.length) {
      skipped.push(`面板 ${folder} 缺语言包: ${missing.join(', ')}`)
      continue
    }
    let sets
    try {
      sets = LEX_LANGS.map((L) => flattenLexicon(JSON.parse(langs[L].replace(/^\uFEFF/, ''))))
    } catch (e) {
      skipped.push(`面板 ${folder} 词表 JSON 解析失败: ${e?.message ?? e}`)
      continue
    }
    const fully = sets.reduce((acc, s) => {
      const next = new Set()
      for (const k of acc) if (s.has(k)) next.add(k)
      return next
    })
    const unwired = []
    for (const k of fully) {
      if (emittedFull.has(k)) continue
      if (emittedPrefixes.some((p) => k.startsWith(p))) continue
      unwired.push(k)
    }
    unwired.sort()
    byFolder[folder] = { keys: fully.size, unwired: unwired.length, samples: unwired.slice(0, 5) }
    if (unwired.length) perFile[`packages/i18n/messages/${folder}/en.json`] = unwired.length
  }
  return { byFolder, perFile, dynamic, ambiguous, skipped, undetermined, emitted: emittedFull.size, prefixes: emittedPrefixes.length }
}

// ==================== 遮噪(两层,方向不同,不可混用 —— 同守门 118 的告诫)====================

/**
 * 第一层:遮注释、遮**模板串内容**,但保留 ' / " 字符串内容 —— import specifier 本身就是
 * 字符串,这一层还要从里面取路径。模板整段遮掉:模块说明符在语法上不可能是模板,
 * "从模板里长出 import 语句"必是伪引用,必须让它不可见(方向:只会少判引用,
 * 而本门最怕的恰是"错判已接线"的假绿)。
 */
export function maskCommentsKeepStrings(text) {
  const out = text.split('')
  const blank = (a, b) => {
    for (let i = Math.max(0, a); i < b && i < out.length; i++) if (out[i] !== '\n') out[i] = ' '
  }
  let i = 0
  while (i < text.length) {
    const c = text[i]
    const d = text[i + 1]
    if (c === '/' && d === '/') {
      let j = i
      while (j < text.length && text[j] !== '\n') j++
      blank(i, j)
      i = j
      continue
    }
    if (c === '/' && d === '*') {
      let j = i + 2
      while (j < text.length && !(text[j] === '*' && text[j + 1] === '/')) j++
      const close = j < text.length ? j + 2 : text.length
      blank(i, close)
      i = close
      continue
    }
    if (c === '"' || c === "'") {
      let j = i + 1
      while (j < text.length && text[j] !== c && text[j] !== '\n') {
        if (text[j] === '\\') j++
        j++
      }
      i = Math.min(j + 1, text.length)
      continue
    }
    if (c === '`') {
      let j = i + 1
      let depth = 0
      while (j < text.length) {
        if (text[j] === '\\') {
          j += 2
          continue
        }
        if (text[j] === '$' && text[j + 1] === '{') {
          depth++
          j += 2
          continue
        }
        if (text[j] === '}' && depth > 0) {
          depth--
          j++
          continue
        }
        if (depth === 0 && text[j] === '`') break
        if (text[j] !== '\n') out[j] = ' '
        j++
      }
      i = Math.min(j + 1, text.length)
      continue
    }
    i++
  }
  return out.join('')
}

/** 第二层:遮掉字符串/模板**内容**(保留引号与行结构)。用于标识符取用统计与行级声明扫描。 */
export function blankStringContents(text) {
  const out = text.split('')
  const blank = (a, b) => {
    for (let i = Math.max(0, a); i < b && i < out.length; i++) if (out[i] !== '\n') out[i] = ' '
  }
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (c === '"' || c === "'") {
      let j = i + 1
      while (j < text.length && text[j] !== c && text[j] !== '\n') {
        if (text[j] === '\\') j++
        j++
      }
      blank(i + 1, Math.min(j, text.length))
      i = Math.min(j + 1, text.length)
      continue
    }
    if (c === '`') {
      let j = i + 1
      let depth = 0
      while (j < text.length) {
        if (text[j] === '\\') {
          j += 2
          continue
        }
        if (text[j] === '$' && text[j + 1] === '{') {
          depth++
          j += 2
          continue
        }
        if (text[j] === '}' && depth > 0) {
          depth--
          j++
          continue
        }
        if (depth === 0) {
          if (text[j] === '`') break
          if (text[j] !== '\n') out[j] = ' '
        }
        j++
      }
      i = Math.min(j + 1, text.length)
      continue
    }
    i++
  }
  return out.join('')
}

// ==================== 单文件解析(声明 / import 绑定 / 同文件引用边)====================

// 子句不得跨 `import`/`export`/`;`:旧写法 `[\s\S]*?` 会从一条语句"爬"到下一条的 from,
// 把中间的顶层声明整段遮蔽成 clause 区 —— 调试 C2 夹具时实测到(Tool 接口行被吞,
// 消费者判 0)。遮蔽区一旦吞掉声明行,方向是"漏候选"(漏报),但更糟的是它也会吞掉
// import 绑定本身让已接线被误判未接线 —— 两种错向都不可接受,故子句封死在单条语句内。
const CLAUSE_RE = /(?:^|[\s;}])(import|export)\s+((?:(?!import\b)(?!export\b)[^;])*?)\s*from\s*['"]([^'"]+)['"]/g
const TOP_DECL_RES = [
  /^(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/,
  /^(?:export\s+)?(?:declare\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)/,
  /^(?:export\s+)?(?:declare\s+)?class\s+([A-Za-z0-9_$]+)/,
  /^(?:export\s+)?(?:declare\s+)?(?:interface|type|enum)\s+([A-Za-z0-9_$]+)/,
]
const IDENT_RE = /[A-Za-z0-9_$]+/g

/**
 * 解析一个源文件(注释见文件头"接线算法"):
 *  - decls:   顶层声明 [{name, exported, line(0 基), shape}];行文本取自**遮噪后的代码面**
 *             (注释与字符串内容都已抹平),所以"注释里写了一句 `export function createXHandler`"
 *             既不会成为候选、也不会成为消费者 —— C7 的形态判定与这条口径共用同一份面。
 *             shape ∈ DECL_SHAPES(工厂/非工厂/读不出),只给 C7 用,C1~C5 不读它;
 *  - imports: import 绑定 [{imported, local, spec}];`export … from` 是转出不是消费,
 *             收进 reExports(只为把它从取用面遮掉,永不作消费者证据);
 *  - uses:    在 import/export-from 语句区域之外出现过的标识符集合;
 *  - edges:   同文件引用边 host→ref(某顶层声明的"行域"里出现的其他顶层声明名;自引用不成边)。
 *            接口成员行(`budget: XxxContract`)天然落在宿主接口的行域里 ⇒ 类型引用与函数
 *            调用同形处理,不再单写一套。
 */
export function parseFile(rel, text) {
  const noComments = maskCommentsKeepStrings(text)
  const imports = []
  const reExports = []
  const masked = noComments.split('')
  CLAUSE_RE.lastIndex = 0
  let m
  while ((m = CLAUSE_RE.exec(noComments))) {
    const kind = m[1]
    const clause = m[2]
    const spec = m[3]
    const blankTo = m.index + m[0].length
    for (let k = m.index; k < blankTo && k < masked.length; k++) if (masked[k] !== '\n') masked[k] = ' '
    const braces = /\{([^}]*)\}/.exec(clause)
    const target = kind === 'export' ? reExports : imports
    if (braces) {
      for (const raw of braces[1].split(',')) {
        const piece = raw.trim().replace(/^type\s+/, '')
        if (!piece || piece === 'default') continue
        const asM = /^([A-Za-z0-9_$]+)\s+as\s+([A-Za-z0-9_$]+)$/.exec(piece)
        if (asM) target.push({ imported: asM[1], local: asM[2], spec })
        else if (/^[A-Za-z0-9_$]+$/.test(piece)) target.push({ imported: piece, local: piece, spec })
      }
    } else if (kind === 'import' && /^[A-Za-z0-9_$]+$/.test(clause.trim())) {
      imports.push({ imported: 'default', local: clause.trim(), spec })
    }
  }
  const code = blankStringContents(masked.join(''))
  const lines = code.split('\n')
  const decls = []
  for (let li = 0; li < lines.length; li++) {
    for (let ki = 0; ki < TOP_DECL_RES.length; ki++) {
      const dm = TOP_DECL_RES[ki].exec(lines[li])
      if (dm) {
        decls.push({
          name: dm[1],
          exported: /^\s*export\s/.test(lines[li]),
          line: li,
          shape: declShape(lines[li], ki),
        })
        break
      }
    }
  }
  const declNames = new Set(decls.map((d) => d.name))
  const uses = new Set()
  const edges = new Map()
  for (const d of decls) edges.set(d.name, new Set())
  for (let li = 0; li < lines.length; li++) {
    let host = null
    for (const d of decls) {
      if (d.line <= li) host = d.name
      else break
    }
    if (!host) continue
    IDENT_RE.lastIndex = 0
    let t
    while ((t = IDENT_RE.exec(lines[li]))) {
      const name = t[0]
      uses.add(name)
      if (declNames.has(name) && name !== host) edges.get(host).add(name)
    }
  }
  return { rel, decls, declNames, imports, reExports, uses, edges }
}

// ==================== specifier 兼容判定(引用必须指向声明方那一条模块链)====================

function basenameNoExt(p) {
  const seg = p.split('/').pop() || ''
  return seg.replace(/\.[^.]+$/, '')
}
function parentDir(p) {
  const segs = p.split('/')
  return segs.length >= 2 ? segs[segs.length - 2] : ''
}

/**
 * 消费者 G 的 import specifier 能否"来自"声明文件 F:
 *  - F 在 packages/<pkg>/ 下且 spec 是 `@ihui/<pkg>`(或其子路径);
 *  - spec 含 F 的文件基名(state-store / tool-contract);
 *  - F 的直接父目录名(≠src/app)以路径段形态出现在 spec 里(`../sessions/index.js` 这类 barrel)。
 * 判不出 ⇒ 不兼容。失误方向是把"已接线"错判成"未接线"(更严),由棘轮锚点与全量档只报数
 * 兜住 —— 绝不反向:让注释/伪链当消费者,才是本门要拦的那一型。
 */
export function specCompat(spec, declFile) {
  if (!spec) return false
  const pkg = /^packages\/([^/]+)\//.exec(declFile)
  if (pkg && (spec === `@ihui/${pkg[1]}` || spec.startsWith(`@ihui/${pkg[1]}/`))) return true
  if (spec.includes(basenameNoExt(declFile))) return true
  const pd = parentDir(declFile)
  if (pd && pd !== 'src' && pd !== 'app') {
    const esc = pd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`(?:^|[/.])${esc}/`).test(spec)) return true
  }
  return false
}

// ==================== 聚合判定(judge = 纯函数;自检与镜像测试都构造输入)====================

/**
 * C7 新族的**当场读数**(票面"扩判据与清偿必须同枚":判据扩了面,门就要能说出新面的存量)。
 * @param candidates judge 的候选全集 @param unwired 其中的未接线全集 @param unreadable 名字命中但形态读不出
 * @returns {{candidates:number,unwired:string[],unreadable:string[]}}
 *   - `unwired` 走 C1~C5 同一条 perFile 棘轮(这里只是把该族单独点名);
 *   - `unreadable` **只报数**:并进 undetermined 会让一种合法写法成为与任何提交无关的恒红门(§12e),
 *     故沿用本门 C6 对"判不了"的既有口径(动态拼键/歧义绑定 = 报数,不接线也不判红)。
 */
export function factoryFace(candidates, unwired, unreadable = []) {
  const isF = (c) => c.kinds.includes('handler-factory')
  return {
    candidates: candidates.filter(isF).length,
    unwired: unwired.filter(isF).map((c) => `${c.file}:${c.line} ${c.name}`),
    unreadable,
  }
}

/**
 * @param files Map<rel, text|null> —— 同一判定面的全部扫描根源文件(清单与内容同面同轮)
 * @param opts { face?, lexicon?: Map<rel, text|null>, mutate: null|'no-external-refs'|'no-closure' }
 *   —— lexicon 给出则启用 C6(i18n 码表键对账);mutate 是**变异对照专用**通道:各禁用一支
 *   判据,已接线夹具必须退回未接线,证明两支判据都不是恒真摆设。
 */
export function judge(files, opts = {}) {
  const mutate = opts.mutate || null
  const parsed = new Map()
  const undetermined = []
  let scanned = 0
  for (const [rel, text] of files) {
    if (!inScanRoot(rel)) continue
    scanned++
    if (typeof text !== 'string') {
      undetermined.push(`${rel}: ${FACE_NAME[opts.face] || '判定面'} 取不到内容`)
      continue
    }
    parsed.set(rel, parseFile(rel, text))
  }
  if (scanned === 0) {
    return {
      scanned: 0,
      candidates: [],
      unwired: [],
      perFile: {},
      byKind: {},
      undetermined: ['判定面枚举到 0 个扫描根源文件 —— 空扫不记绿'],
      i18n: null,
      factory: factoryFace([], [], []),
    }
  }

  // 1) 候选声明
  const candidates = []
  const candidateFiles = new Set()
  // C7 的"名字命中但形态读不出"另立一档:**不立案**(宁窄,失误方向是漏报)但**报数点名**。
  // 不喂 decide() ⇒ 不判红也不进 exit 2:这是本门 C6 对"判不了"的既有口径(动态拼键/歧义绑定
  // 只报数),把它并进 undetermined 会让某个合法写法变成与任何提交无关的恒红门(§12e)。
  const factoryUnreadable = []
  for (const p of parsed.values()) {
    for (const d of p.decls) {
      if (d.shape === 'unknown' && isHandlerFactoryName(d.name, d.exported))
        factoryUnreadable.push(`${p.rel}:${d.line + 1} ${d.name}`)
      const kinds = candidateKinds(d.name, p.rel, d.exported, d.shape)
      if (!kinds.length) continue
      candidates.push({ file: p.rel, name: d.name, line: d.line + 1, kinds })
      candidateFiles.add(p.rel)
    }
  }

  // 2) 只对"候选文件里的顶层名"建消费者反向表(候选名 ∪ 中间名)
  const relevantNames = new Set()
  for (const f of candidateFiles) for (const d of parsed.get(f).decls) relevantNames.add(d.name)
  const bindingsOf = new Map() // name → [{file, local, spec}]
  for (const p of parsed.values()) {
    for (const b of p.imports) {
      if (!relevantNames.has(b.imported)) continue
      if (!bindingsOf.has(b.imported)) bindingsOf.set(b.imported, [])
      bindingsOf.get(b.imported).push({ file: p.rel, local: b.local, spec: b.spec })
    }
  }
  const declaringFilesOf = new Map() // name → [声明它的文件]
  for (const p of parsed.values()) {
    for (const d of p.decls) {
      if (!relevantNames.has(d.name)) continue
      if (!declaringFilesOf.has(d.name)) declaringFilesOf.set(d.name, [])
      declaringFilesOf.get(d.name).push(p.rel)
    }
  }

  // 3) 种子:有生产面消费者的 (name, file)
  const connected = new Set() // `name\u0000file`
  if (mutate !== 'no-external-refs') {
    for (const [name, declFiles] of declaringFilesOf) {
      const bindings = bindingsOf.get(name) || []
      if (!bindings.length) continue
      for (const F of declFiles) {
        let hit = false
        for (const b of bindings) {
          if (b.file === F) continue
          const G = parsed.get(b.file)
          if (!G) continue
          if (G.declNames.has(name)) continue // 同名自声明不是消费别人的
          if (!specCompat(b.spec, F)) continue
          if (G.uses.has(name) || (b.local !== name && G.uses.has(b.local))) {
            hit = true
            break
          }
        }
        if (hit) connected.add(`${name}\u0000${F}`)
      }
    }
  }

  // 4) 传递闭包:被消费的宿主,其声明体引用到的同文件符号也算被消费(反复扩张到不动点)
  if (mutate !== 'no-closure') {
    let grew = true
    while (grew) {
      grew = false
      for (const f of candidateFiles) {
        const p = parsed.get(f)
        if (!p) continue
        for (const [host, refs] of p.edges) {
          if (!connected.has(`${host}\u0000${f}`)) continue
          for (const r of refs) {
            const k = `${r}\u0000${f}`
            if (!connected.has(k)) {
              connected.add(k)
              grew = true
            }
          }
        }
      }
    }
  }

  const unwired = candidates.filter((c) => !connected.has(`${c.name}\u0000${c.file}`))
  const perFile = {}
  const byKind = {}
  for (const u of unwired) {
    perFile[u.file] = (perFile[u.file] || 0) + 1
    for (const k of u.kinds) byKind[k] = (byKind[k] || 0) + 1
  }
  let i18n = null
  if (opts.lexicon) {
    i18n = judgeI18n(files, opts.lexicon)
    // C6 计数并入同一 perFile ⇒ 与 C1~C5 共用 decide() 棘轮(键空间不同不相撞:
    // 词表路径不在 apps|packages/*/src 扫描根里)
    for (const [f, n] of Object.entries(i18n.perFile)) perFile[f] = (perFile[f] || 0) + n
  }
  return {
    scanned: parsed.size,
    candidates,
    unwired,
    perFile,
    byKind,
    undetermined,
    i18n,
    factory: factoryFace(candidates, unwired, factoryUnreadable),
  }
}

/**
 * 棘轮 + 退出码聚合(纯函数;自检/镜像测试靠构造输入证明有牙)。
 * 优先级:无法判定(2)> 判红(1)> 通过(0)。
 *  - mode 'staged':某文件索引面未接线数 > 其 HEAD 面自身未接线数 ⇒ 红(新增即拦,存量不追);
 *  - mode 'full':只报数;`strict` 档把"存在任何未接线"记红(CI 问责面,提交链不用它)。
 */
export function decide({ stagedCounts = {}, headCounts = {}, mode = 'full', undetermined = [], strict = false }) {
  if (undetermined.length) return { exit: 2, reds: [], undetermined, mode }
  const reds = []
  const files = new Set([...Object.keys(stagedCounts), ...Object.keys(headCounts)])
  for (const f of [...files].sort()) {
    const now = stagedCounts[f] || 0
    if (mode === 'staged') {
      const anchor = headCounts[f] || 0
      if (now > anchor) reds.push({ file: f, now, anchor })
    } else if (strict && now > 0) {
      reds.push({ file: f, now, anchor: 0 })
    }
  }
  return { exit: reds.length ? 1 : 0, reds, undetermined, mode }
}

export function listFace(root, face) {
  if (face === 'head')
    return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z'], root, { timeout: GIT_TIMEOUT }).split('\0').filter(Boolean)
  return gitRaw(['ls-files', '-z'], root, { timeout: GIT_TIMEOUT }).split('\0').filter(Boolean)
}

/** 一次 `cat-file --batch` 预取整个面;worktree 面逐盘读(仅逃生舱)。 */
export function readFace(root, face, paths) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) map.set(p, readWorktreeFile(root, p))
    return map
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  for (let i = 0; i < paths.length; i++) map.set(paths[i], got.get(specs[i]) ?? null)
  return map
}

export function analyze(root, face, opts = {}) {
  let effFace = face
  let fellBack = false
  if (face === 'staged') {
    // 词表改动也算"改动面内":只改 messages/<面板>/*.json 的提交若被这里的过滤滤掉,
    // 会退回全量档,C6 的 staged 棘轮就永远轮不到它头上
    const changed = gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], root, { timeout: GIT_TIMEOUT })
      .split('\0')
      .filter(Boolean)
      .filter((p) => inScanRoot(p) || isLexiconPath(p))
    if (changed.length === 0) {
      effFace = 'head'
      fellBack = true
    }
  }
  const allPaths = listFace(root, effFace)
  const sources = allPaths.filter(inScanRoot)
  if (sources.length === 0)
    throw new Undetermined(`${FACE_NAME[effFace]} 面枚举到 0 个扫描根源文件(apps|packages/*/src 源码) —— 空扫不记绿`)
  const lexPaths = allPaths.filter(isLexiconPath)
  const judged = judge(readFace(root, effFace, sources), { face: effFace, lexicon: readFace(root, effFace, lexPaths) })
  let headJudged = null
  if (effFace === 'staged') {
    const headAll = listFace(root, 'head')
    const headSources = headAll.filter(inScanRoot)
    if (headSources.length === 0) throw new Undetermined('HEAD 面枚举到 0 个扫描根源文件 ⇒ 棘轮锚点无从取得(不记绿)')
    headJudged = judge(readFace(root, 'head', headSources), { face: 'head', lexicon: readFace(root, 'head', headAll.filter(isLexiconPath)) })
  }
  const mode = effFace === 'staged' ? 'staged' : 'full'
  const decision = decide({
    stagedCounts: judged.perFile,
    headCounts: headJudged ? headJudged.perFile : judged.perFile,
    mode,
    undetermined: [...judged.undetermined, ...(headJudged ? headJudged.undetermined : [])],
    strict: !!opts.strict,
  })
  return { ...decision, judged, face: effFace, fellBack }
}

function unwiredNamesByFile(judged) {
  const m = new Map()
  for (const u of judged.unwired) {
    if (!m.has(u.file)) m.set(u.file, [])
    m.get(u.file).push(u.name)
  }
  return m
}

export function main(argv) {
  const ri = argv.indexOf('--root')
  const root = ri >= 0 && argv[ri + 1] ? resolve(argv[ri + 1]) : ROOT
  assertRepoRoot(root, '本门')
  const { face, error } = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (error) {
    console.error(`❌ 无法判定: ${error}`)
    return 2
  }
  let out
  try {
    out = analyze(root, face, { strict: argv.includes('--strict') })
  } catch (e) {
    const msg = e instanceof Undetermined ? e.message : e?.message ?? String(e)
    console.error(`❌ 无法判定(exit 2): ${msg}`)
    if (!(e instanceof Undetermined)) console.error(e?.stack ?? '')
    return 2
  }
  const { judged } = out
  const namesOf = unwiredNamesByFile(judged)
  const i18n = judged.i18n
  const i18nUnwiredTotal = i18n ? Object.values(i18n.byFolder).reduce((s, v) => s + v.unwired, 0) : null
  const lexSampleOf = (file) => {
    const m = /^packages\/i18n\/messages\/([^/]+)\/en\.json$/.exec(file)
    return m && i18n ? (i18n.byFolder[m[1]]?.samples ?? null) : null
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ face: out.face, fellBack: out.fellBack, exit: out.exit, mode: out.mode, scanned: judged.scanned, candidates: judged.candidates.length, unwired: judged.unwired, i18n, factory: judged.factory, reds: out.reds, undetermined: out.undetermined }, null, 2))
    return out.exit
  }
  if (out.reds.length) {
    console.error(`❌ 检出 ${out.reds.length} 个文件的「策略/契约声明无生产消费者」较 HEAD 增加(面=${FACE_NAME[out.face]},锚点=HEAD 自身未接线数):`)
    for (const r of out.reds) {
      const sample = lexSampleOf(r.file)
      const detail = sample ? `样例: ${sample.join(', ')}` : (namesOf.get(r.file) || []).join(', ')
      console.error(`   ${r.file}  未接线 ${r.now} > 锚点 ${r.anchor} ⇒ 新增 ${r.now - r.anchor} 处${detail ? `: ${detail}` : ''}`)
    }
    if (out.reds.some((r) => lexSampleOf(r.file)))
      console.error('   i18n 未接线的出路(二选一,不得留投机代码):① 在生产面把键真正发射出去(接线形态见本门头注 C6);② 从七个语言包里删掉这个键。禁止为消红把键名塞进字符串或注释。')
    console.error('   出路(二选一,不得留投机代码):① 把该策略/契约挂到真实生命周期点上(读时触发或写前触发,像 state-store 的 pruneOnWrite 那样),让消费者在**非测试生产面**能指认;② 若结构上无处可挂,删掉这条声明并在 PR 说明。禁止为消红去改锚点或给门加豁免。')
  }
  if (out.undetermined.length) {
    console.error(`⚠️  未判定 ${out.undetermined.length} 项(计入 exit 2,不计为通过):`)
    for (const u of out.undetermined.slice(0, 20)) console.error(`   · ${u}`)
  }
  if (out.fellBack) console.log('ℹ️  --staged 暂存集在扫描面内为空 ⇒ 退回全量(HEAD),防"空暂存恒绿"')
  if (out.mode === 'full' && !out.reds.length) {
    console.log(`ℹ️ 存量未接线 ${judged.unwired.length} 处 / ${namesOf.size} 个文件(面=${FACE_NAME[out.face]},只报数不判红;按形态:${Object.entries(judged.byKind).map(([k, v]) => `${k}=${v}`).join(' / ') || '无'})`)
    let i = 0
    for (const [f, names] of namesOf) {
      if (i++ >= 40) {
        console.log(`   ……其余 ${namesOf.size - 40} 个文件略(--json 看全量)`)
        break
      }
      console.log(`   · ${f} × ${names.length}: ${names.slice(0, 6).join(', ')}${names.length > 6 ? ' …' : ''}`)
    }
    // C7 新族的存量读数**当场说出**(票面"扩判据与清偿必须同枚"):总数走上面那条,这里逐条点名。
    const fac = judged.factory
    console.log(`ℹ️ 工厂族(C7,导出 create*Handler / create*Transport):候选 ${fac.candidates} / 零生产调用方 ${fac.unwired.length} / 形态读不出 ${fac.unreadable.length}(定级沿用本门:只报数不判红,升 blocking 的前置 = 存量清零)`)
    for (const u of fac.unwired) console.log(`   · ${u}`)
    for (const u of fac.unreadable) console.log(`   ⚠️ 名字命中但声明行读不出工厂形态 ⇒ 未立案(不判红也不计未判定):${u}`)
    if (i18n) {
      console.log(`ℹ️ i18n 码表(C6):未接线 ${i18nUnwiredTotal} 键(动态拼键 ${i18n.dynamic} 处、歧义绑定 ${i18n.ambiguous} 处${i18n.skipped.length ? `、异常面板 ${i18n.skipped.length} 个` : ''} —— 动态/歧义只报数不判红)`)
      for (const [f, v] of Object.entries(i18n.byFolder)) {
        if (!v.unwired) continue
        console.log(`   · 面板 ${f}: 未接线 ${v.unwired} / 五语言全有 ${v.keys} 键(样例: ${v.samples.join(', ')})`)
      }
      for (const s of i18n.skipped) console.log(`   ⚠️ ${s}`)
    }
  }
  const verdict = out.exit === 0 ? '✅ 通过' : out.exit === 2 ? '❌ 无法判定(exit 2)' : '❌ 判红(exit 1)'
  console.log(`${verdict}(面=${FACE_NAME[out.face]} 扫描 ${judged.scanned} 文件 / 候选声明 ${judged.candidates.length} / 未接线 ${judged.unwired.length}${i18n ? ` / i18n 未接线 ${i18nUnwiredTotal}` : ''} / 工厂族 C7 ${judged.factory.candidates} 候选·${judged.factory.unwired.length} 零生产调用方 / 判红文件 ${out.reds.length} / 未判定 ${out.undetermined.length})`)
  return out.exit
}

// ==================== 判据自检(纯函数 + 构造面,零副作用、不碰仓库)====================

const SS_UNWIRED = [
  'const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;',
  'function ensureStateDir(): void {}',
  'export function saveSession(id: string): void { ensureStateDir(); }',
  'export function pruneOldSessions(maxAgeMs: number = DEFAULT_MAX_AGE_MS): number { return maxAgeMs; }',
  '',
].join('\n')
/** 已接线形态:常量→prune→pruneOnWrite→saveSession,saveSession 被命令面 import 且取用 */
const SS_WIRED = [
  'const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;',
  'function pruneOnWrite(): void { pruneOldSessions(); }',
  'export function saveSession(id: string): void { pruneOnWrite(); }',
  'export function pruneOldSessions(maxAgeMs: number = DEFAULT_MAX_AGE_MS): number { return maxAgeMs; }',
  '',
].join('\n')
const REPL_CONSUMER = [
  "import { saveSession as persist } from '../sessions/state-store.js';",
  'export function loop(): void { persist("x"); }',
  '',
].join('\n')
const TC_SRC = [
  'export interface ResultBudgetContract { bytes: number }',
  'export interface ShapeContract { kind: string }',
  'export interface MountContract { contract?: ShapeContract; budget?: ResultBudgetContract }',
  'export function mayTouchThing(x: unknown): boolean { return !!x }',
  '',
].join('\n')
const TOOL_CONSUMER = [
  "import type { MountContract } from '@ihui/types';",
  'export interface Tool extends MountContract {}',
  '',
].join('\n')
// C7 工厂族夹具(G-816034 ①②)。**同一批名字**,三种定义形态各占一处:
//   createFooHandler / createBazHandler = 函数声明、createBarTransport = 箭头初值(带返回类型标注)、
//   createQuxTransport = 对象初值(读得出,**不是工厂** ⇒ 不立案)、
//   createLooseHandler = `export let` 整行无初值(读不出 ⇒ 报数点名、不立案、不进 exit 2)。
const HF_SRC = [
  'export function createFooHandler(deps: unknown): (e: unknown) => unknown { return (e) => [deps, e]; }',
  'export const createBarTransport = (): { send(): void } => ({ send() {} });',
  'export function createBazHandler(): void {}',
  'export const createQuxTransport: { send(): void } = { send() {} };',
  'export let createLooseHandler',
  '',
].join('\n')
/** 同词不同义对照:名字与 HF_SRC 里的工厂**完全同名**,定义却是 type / 接口字段 / class */
const HF_TYPE = [
  'export type createFooHandler = { run(): void }',
  'export interface UploadShape { createBarTransport: (o: unknown) => unknown }',
  'export class createBazHandler { send(): void {} }',
  '',
].join('\n')
/** 生产面消费者:三个都 import,但只取用两个 ⇒ 只 import 不取用那一支照旧红 */
const HF_CONSUMER = [
  "import { createFooHandler, createBarTransport, createBazHandler } from '../stream-handlers';",
  'export function loop(): void { createFooHandler(1); createBarTransport(); }',
  '',
].join('\n')
/** 噪声消费者:import 在、取用只写在注释与字符串里 ⇒ 一个都不算(验收②) */
const HF_NOISE = [
  "import { createFooHandler } from '../stream-handlers';",
  '// createFooHandler(1) 曾在 D113 接线 —— 注释里的提及不算消费者',
  'export const note = "createBarTransport() 也不算";',
  'export function loop(): void { return; }',
  '',
].join('\n')
const HF_DECL_FILE = 'apps/web/src/hooks/use-chat/stream-handlers.ts'
const HF_USE_FILE = 'apps/web/src/hooks/use-chat/send-message.ts'

function selfTest() {
  let ran = 0
  let fail = 0
  const eq = (label, got, want) => {
    ran++
    const g = JSON.stringify(got)
    const w = JSON.stringify(want)
    if (g !== w) {
      fail++
      console.log(`  ❌ ${label}\n      got  ${g}\n      want ${w}`)
    } else console.log(`  ✅ ${label}`)
  }
  const uNames = (res) => res.unwired.map((u) => u.name).sort()

  // ① 正向证明 A:真未接线夹具必红(第八批实测:"名单有、从不命中"是门自己的失明形态)
  const rOff = judge(new Map([['apps/cli/src/sessions/state-store.ts', SS_UNWIRED]]))
  eq('W1 未接线夹具 ⇒ pruneOldSessions + DEFAULT_MAX_AGE_MS 双红', uNames(rOff), ['DEFAULT_MAX_AGE_MS', 'pruneOldSessions'])
  // ② 正向证明 B:已接线夹具必绿(闭包链 saveSession→pruneOnWrite→prune→const)
  const rOn = judge(new Map([['apps/cli/src/sessions/state-store.ts', SS_WIRED], ['apps/cli/src/commands/repl.ts', REPL_CONSUMER]]))
  eq('W2 已接线夹具(写生命周期点 + 生产 importer)⇒ 0 未接线', rOn.unwired.length, 0)
  // ③ 变异对照 M1:关掉传递闭包 ⇒ W2 夹具必退回红(证明闭包一支有牙)
  eq('M1 mutate=no-closure ⇒ 已接线夹具仍判 2 处未接线(闭包不是摆设)', uNames(judge(new Map([['apps/cli/src/sessions/state-store.ts', SS_WIRED], ['apps/cli/src/commands/repl.ts', REPL_CONSUMER]]), { mutate: 'no-closure' })), ['DEFAULT_MAX_AGE_MS', 'pruneOldSessions'])
  // ④ 变异对照 M2:关掉外部消费整支 ⇒ 全链失去种子,必红(证明外部引用一支有牙)
  eq('M2 mutate=no-external-refs ⇒ 已接线夹具仍判未接线(外部消费不是摆设)', judge(new Map([['apps/cli/src/sessions/state-store.ts', SS_WIRED], ['apps/cli/src/commands/repl.ts', REPL_CONSUMER]]), { mutate: 'no-external-refs' }).unwired.length, 2)
  // ⑤ 测试面排除
  eq('T1 唯一消费者在 tests/ ⇒ 整面排除,仍判未接线', uNames(judge(new Map([['apps/cli/src/sessions/state-store.ts', SS_UNWIRED], ['apps/cli/tests/s.test.ts', REPL_CONSUMER]]))), ['DEFAULT_MAX_AGE_MS', 'pruneOldSessions'])
  // ⑥ 只 import 不取用 ⇒ 不算消费者
  eq('T2 import 了却从未取用 ⇒ 不算消费者', judge(new Map([['apps/cli/src/sessions/state-store.ts', SS_UNWIRED], ['apps/cli/src/commands/repl.ts', REPL_CONSUMER.replace('persist("x")', '1')]])).unwired.length, 2)
  // ⑦ 注释提及不算消费者(本仓最高频失效型)
  eq('T3 取用只写在注释里 ⇒ 遮噪后不可见,不算消费者', judge(new Map([['apps/cli/src/sessions/state-store.ts', SS_UNWIRED], ['apps/cli/src/commands/repl.ts', REPL_CONSUMER.replace('persist("x")', '// persist("x") 曾经接线')]])).unwired.length, 2)
  // ⑧ 纯 re-export 不算消费者
  eq('T4 barrel 只 `export { saveSession } from …` ⇒ barrel 不消费', judge(new Map([['apps/cli/src/sessions/state-store.ts', SS_UNWIRED], ['apps/cli/src/sessions/index.ts', "export { saveSession } from './state-store.js';\nexport { saveSession } from './state-store.js'\n"]])).unwired.length, 2)
  // ⑨ specifier 链不符 ⇒ 不算消费者(宁严不假绿)
  eq('T5 import 的 specifier 与声明模块无链可寻 ⇒ 不认', judge(new Map([['apps/cli/src/sessions/state-store.ts', SS_UNWIRED], ['apps/cli/src/commands/repl.ts', REPL_CONSUMER.replace('../sessions/state-store.js', '../other/store.js')]])).unwired.length, 2)
  // ⑩ 契约面:MountContract 被 tools 面取用 ⇒ 类型闭包接线;谓词无消费者 ⇒ 单点红
  const rC = judge(new Map([['packages/types/src/tool-contract.ts', TC_SRC], ['apps/cli/src/tools/index.ts', TOOL_CONSUMER]]))
  eq('C1 契约类型经 Mount 闭包接线、谓词 mayTouchThing 零消费者 ⇒ 只剩它红', uNames(rC), ['mayTouchThing'])
  const rC2 = judge(new Map([['packages/types/src/tool-contract.ts', TC_SRC], ['apps/cli/src/tools/index.ts', TOOL_CONSUMER + "import { mayTouchThing } from '@ihui/types';\nexport function gate(x: unknown): boolean { return mayTouchThing(x) }\n"]]))
  eq('C2 谓词补上生产消费者 ⇒ 0 未接线', rC2.unwired.length, 0)
  // ⑪ 形态收录边界:非导出清理函数 / camelCase 保留量 / scripts 层不立案
  eq('K1 非导出的 pruneZombie 与 artifactRetentionDays 都不是候选', judge(new Map([['apps/x/src/y.ts', 'function pruneZombie(): void {}\nconst artifactRetentionDays = 7\nexport function useIt(): void {}\n']])).unwired.length, 0)
  eq('K2 大写族命中:CACHE_TTL_MS 是候选(policy-const)', judge(new Map([['apps/api/src/z.ts', 'export const CACHE_TTL_MS = 100\n']])).unwired.map((u) => u.kinds[0]), ['policy-const'])
  eq('K3 scripts/ 与测试路径都不入扫描面', [inScanRoot('scripts/check-x.mjs'), inScanRoot('apps/web/src/a.tsx'), inScanRoot('apps/cli/tests/a.test.ts'), inScanRoot('packages/types/src/tool-contract.ts')], [false, true, false, true])
  // ⑫ specCompat 的三种链形
  eq('S1 @ihui/<pkg> 对 packages/<pkg>/src/** 兼容;父目录段/基名兼容;无关路径不兼容', [specCompat('@ihui/types', 'packages/types/src/tool-contract.ts'), specCompat('../sessions/index.js', 'apps/cli/src/sessions/state-store.ts'), specCompat('../other/store.js', 'apps/cli/src/sessions/state-store.ts')], [true, true, false])
  // ⑬ 棘轮四向(staged vs HEAD 锚点)
  eq('R1 staged 2 > 锚点 1 ⇒ 红(新增即拦)', decide({ stagedCounts: { 'f.ts': 2 }, headCounts: { 'f.ts': 1 }, mode: 'staged' }).exit, 1)
  eq('R2 齐平 ⇒ 绿(存量不追)', decide({ stagedCounts: { 'f.ts': 1 }, headCounts: { 'f.ts': 1 }, mode: 'staged' }).exit, 0)
  eq('R3 减到 0 ⇒ 绿(只减不增)', decide({ stagedCounts: {}, headCounts: { 'f.ts': 3 }, mode: 'staged' }).exit, 0)
  eq('R4 新文件带未接线(锚点缺省=0)⇒ 红', decide({ stagedCounts: { 'g.ts': 1 }, headCounts: {}, mode: 'staged' }).exit, 1)
  // ⑭ 空扫与未判定:判据失明不得表现为"通过"
  eq('E1 空扫(0 个扫描根源文件)⇒ undetermined ⇒ decide exit 2(空扫不记绿)', (() => {
    const r = judge(new Map([['README.md', 'x'], ['scripts/foo.mjs', 'x']]))
    return decide({ stagedCounts: r.perFile, mode: 'full', undetermined: r.undetermined }).exit
  })(), 2)
  eq('E2 全量档默认不判存量红(防恒红);--strict 才问责', [decide({ stagedCounts: { 'f.ts': 2 }, mode: 'full' }).exit, decide({ stagedCounts: { 'f.ts': 2 }, mode: 'full', strict: true }).exit], [0, 1])
  // ⑮ 遮噪两层的反向对照:模板里不得长出 import
  eq('N1 模板串内的伪 import 不被认成消费者', judge(new Map([['apps/cli/src/sessions/state-store.ts', SS_UNWIRED], ['apps/cli/src/commands/repl.ts', 'export function loop(): string { return "x"; }\nconst noise = `${saveSession}`;\n']])).unwired.length, 2)

  // ⑯ C6 i18n 维(G-816043):码表键 ⇒ 反查生产点,票面三验收 + 棘轮合流
  const LEX_KEYS = { chat: { hi: '你好', bye: '再见' }, items: { count: '条数' } }
  const lexText = JSON.stringify(LEX_KEYS)
  const lexMap = new Map(LEX_LANGS.map((L) => [`packages/i18n/messages/web/${L}.json`, lexText]))
  const NO_EMIT = 'export function B(): number { return 1 }\n'
  const EMIT_ALL = "const t = useTranslations('chat')\nconst u = useTranslations('items')\nexport function A(): string { return t('hi') + t('bye') + u('count') }\n"
  const iOff = judge(new Map([['apps/web/src/a.tsx', NO_EMIT]]), { lexicon: lexMap })
  eq('I1 验收① 五语言全有 + 全仓零发射点 ⇒ 3 键未接线(perFile 归 en.json 计数)', [iOff.i18n.byFolder.web.keys, iOff.i18n.byFolder.web.unwired, iOff.i18n.byFolder.web.samples, iOff.perFile['packages/i18n/messages/web/en.json']], [3, 3, ['chat.bye', 'chat.hi', 'items.count'], 3])
  const iOn = judge(new Map([['apps/web/src/a.tsx', EMIT_ALL]]), { lexicon: lexMap })
  eq('I2 验收② 发射点齐备 ⇒ 0 未接线(门对自家产出形态的必答题)', [iOn.i18n.byFolder.web.unwired, iOn.perFile['packages/i18n/messages/web/en.json']], [0, undefined])
  const lexDyn = new Map(LEX_LANGS.map((L) => [`packages/i18n/messages/web/${L}.json`, JSON.stringify({ chat: { hi: 'a', dyn: { title: 't' } } })]))
  const iDyn = judge(new Map([['apps/web/src/a.tsx', "const t = useTranslations('chat')\nexport function D(x: string): string { return t(`dyn.${x}`) }\n"]]), { lexicon: lexDyn })
  eq('I3 验收③ 模板前缀 ⇒ 前缀 chat.dyn. 覆盖子键 chat.dyn.title 摘出未接线,chat.hi 叶子仍报(不静默)', [iDyn.i18n.dynamic, iDyn.i18n.byFolder.web.unwired, iDyn.i18n.byFolder.web.samples, iDyn.i18n.prefixes], [0, 1, ['chat.hi'], 1])
  const iFullDyn = judge(new Map([['apps/web/src/a.tsx', "const t = useTranslations('chat')\nexport function K(x: string): string { return t(`${x}`) + t(x) }\n"]]), { lexicon: lexMap })
  eq('I11 全动态实参(模板无静态前缀/裸表达式)⇒ 计动态 2 处报数,任何键都不被静默盖掉', [iFullDyn.i18n.dynamic, iFullDyn.i18n.byFolder.web.unwired], [2, 3])
  const iNoise = judge(new Map([['apps/web/src/a.tsx', "// const t = useTranslations('chat')\n// t('hi')\nexport const s = \"t('hi')\";\nconst u = useTranslations('items')\nexport function E(): string { return u('count') }\n"]]), { lexicon: lexMap })
  eq('I4 注释与字符串里的伪发射都不可见 ⇒ 只有 items.count 被真接线', [iNoise.i18n.emitted, iNoise.i18n.byFolder.web.unwired], [1, 2])
  const iAmb = judge(new Map([['apps/web/src/a.tsx', "function F(): string {\n  const t = useTranslations('chat')\n  return t('hi')\n}\nfunction G(): string {\n  const t = useTranslations('items')\n  return t('count')\n}\n"]]), { lexicon: lexMap })
  eq('I5 同文件同名变量绑双 ns ⇒ 计歧义 2 处且不接线(判不了 ≠ 判没有)', [iAmb.i18n.ambiguous, iAmb.i18n.byFolder.web.unwired], [2, 3])
  const iDynNs = judge(new Map([['apps/web/src/a.tsx', 'const t = useTranslations(`chat.${x}`)\nexport function H(x: string): string { return t(`hi`) }\n']]), { lexicon: lexMap })
  eq('I9 动态 ns ⇒ 该变量的调用计动态报数(不静默)', [iDynNs.i18n.dynamic, iDynNs.i18n.byFolder.web.unwired], [1, 3])
  const iRich = judge(new Map([['apps/web/src/a.tsx', "const t = useTranslations('chat')\nexport function J(): ReactNode { return t.rich('hi', { b: (c) => c }) }\n"]]), { lexicon: lexMap })
  eq('I10 t.rich 同为发射形态 ⇒ chat.hi 接线', iRich.i18n.byFolder.web.unwired, 2)
  const lexShared = new Map(LEX_LANGS.map((L) => [`packages/i18n/messages/shared/${L}.json`, lexText]))
  const iCross = judge(new Map([['apps/web/src/a.tsx', EMIT_ALL]]), { lexicon: new Map([...lexMap, ...lexShared]) })
  eq('I6 运行时词包 mergeMessages 深合并 ⇒ 发射点跨面板同串即接线', [iCross.i18n.byFolder.web.unwired, iCross.i18n.byFolder.shared.unwired, Object.keys(iCross.i18n.perFile).length], [0, 0, 0])
  const lexPartial = new Map(LEX_LANGS.filter((L) => L !== 'ko').map((L) => [`packages/i18n/messages/api/${L}.json`, lexText]))
  const iSkip = judge(new Map([['apps/web/src/a.tsx', EMIT_ALL]]), { lexicon: new Map([...lexMap, ...lexPartial]) })
  eq('I7 面板缺 ko ⇒ 整面板跳过并报名(不静默算绿)', [iSkip.i18n.byFolder.api ?? null, iSkip.i18n.skipped.length === 1 && /api/.test(iSkip.i18n.skipped[0])], [null, true])
  eq('I8 C6 计数并入 perFile ⇒ 与 C1~C5 共用同一 decide 棘轮(词表齐平不红、src 新增照红)', decide({ stagedCounts: { 'packages/i18n/messages/web/en.json': 3, 'apps/x/src/a.ts': 1 }, headCounts: { 'packages/i18n/messages/web/en.json': 3, 'apps/x/src/a.ts': 0 }, mode: 'staged' }).exit, 1)
  // 第二族发射形态:import 的 t/translate/i18n 与 useTt/useI18n 钩子(根 ns 直发全键)
  const iImp = judge(new Map([['apps/cli/src/run.ts', "import { t } from '../i18n/index.js'\nexport function M(): string { return t('chat.hi') }\n"]]), { lexicon: lexMap })
  eq('I12 import { t } from i18n 家族 ⇒ t(全键) 根 ns 直发接线(cli 真实形状)', [iImp.i18n.emitted, iImp.i18n.byFolder.web.unwired], [1, 2])
  const iTr = judge(new Map([['apps/api/src/notify.ts', "import { translate } from '@ihui/i18n'\nexport function A(): string { return translate('chat.hi') }\nexport function B(m: unknown): string { return translate(m, 'chat.bye') }\nexport function C(m: unknown, k: string): string { return translate(m, k) }\n"]]), { lexicon: lexMap })
  eq('I13 translate 双形:单参键与双参第二实参都接线,双参变量键 ⇒ 计动态(3 发射 2 接线 1 动态)', [iTr.i18n.emitted, iTr.i18n.dynamic, iTr.i18n.byFolder.web.unwired], [2, 1, 1])
  const iHook = judge(new Map([['apps/mobile-rn/src/s.ts', "import { useTt, useI18n } from '@/i18n'\nexport function A(): string { const tt = useTt(); return tt('chat.hi') }\nexport function B(): string { const { t } = useI18n(); return t('chat.bye') }\n"]]), { lexicon: lexMap })
  eq('I14 useTt()/useI18n() 钩子(直收与解构)⇒ 返回的取词函数按根 ns 接线', [iHook.i18n.emitted, iHook.i18n.byFolder.web.unwired], [2, 1])

  // ⑰ C7 工厂族(G-816034 ①②):候选族扩到导出 create*Handler / create*Transport
  //   成对用例:命中必红 / 接线必绿 / 只 import 不取用仍红 / 注释与字符串提及不算消费者 /
  //   同名但类型不同不得算候选 / 形状读不出报数不立案 / 集合推不出来落未判定 / 定级不动。
  const fOff = judge(new Map([[HF_DECL_FILE, HF_SRC]]))
  eq('F1 验收① 新族命中必红:三个读得出是工厂的导出 ⇒ 逐条点名 3 处零生产调用方', [fOff.factory.candidates, fOff.factory.unwired.length, uNames(fOff), fOff.byKind['handler-factory']], [3, 3, ['createBarTransport', 'createBazHandler', 'createFooHandler'], 3])
  eq('F2 同词不同义的反向锁:createQuxTransport(对象初值)与 createLooseHandler 都不在候选里', fOff.candidates.map((c) => c.name).sort(), ['createBarTransport', 'createBazHandler', 'createFooHandler'])
  // 正向证明(接线必绿):同一批声明,补上真取用的生产 importer
  const HF_WIRED = "import { createFooHandler, createBarTransport, createBazHandler } from '../stream-handlers';\nexport function loop(): void { createFooHandler(1); createBarTransport(); createBazHandler(); }\n"
  const fOn = judge(new Map([[HF_DECL_FILE, HF_SRC], [HF_USE_FILE, HF_WIRED]]))
  eq('F3 三个工厂都被生产面 import 且真取用 ⇒ 0 未接线(新族不是恒真摆设)', [fOn.factory.candidates, fOn.factory.unwired.length, fOn.perFile[HF_DECL_FILE] ?? 0], [3, 0, 0])
  // 变异对照 M3:关掉外部消费整支 ⇒ 已接线夹具必退回 3 处红(证明新族走的是同一种子判据)
  eq('M3 mutate=no-external-refs ⇒ 已接线的工厂夹具仍判 3 处未接线', judge(new Map([[HF_DECL_FILE, HF_SRC], [HF_USE_FILE, HF_WIRED]]), { mutate: 'no-external-refs' }).factory.unwired.length, 3)
  // 变异对照 M4:关掉传递闭包 —— 工厂经"同文件宿主"接线的那一支必须有牙
  const HF_CLO = 'const DEFAULT_TTL_MS = 1\nfunction createWrappedHandler(): unknown { return DEFAULT_TTL_MS }\nexport function mount(): unknown { return createWrappedHandler() }\n'
  eq('M4 mutate=no-closure ⇒ 工厂喂给已接线宿主的常量仍判红(闭包对新族同样有效)', judge(new Map([[HF_DECL_FILE, HF_CLO], [HF_USE_FILE, "import { mount } from '../stream-handlers';\nexport function go(): void { mount() }\n"]]), { mutate: 'no-closure' }).unwired.map((u) => u.name), ['DEFAULT_TTL_MS'])
  eq('F4 只 import 不取用 ⇒ 新族照旧不算消费者(createBazHandler 单点红)', judge(new Map([[HF_DECL_FILE, HF_SRC], [HF_USE_FILE, HF_CONSUMER]])).factory.unwired, [`${HF_DECL_FILE}:3 createBazHandler`])
  eq('F5 验收② 注释与字符串里的提及不算消费者(遮噪后不可见,3 处照红)', judge(new Map([[HF_DECL_FILE, HF_SRC], [HF_USE_FILE, HF_NOISE]])).factory.unwired.length, 3)
  eq('F6 票面"同词不同义":与工厂**完全同名**的 type/接口字段/class 一律不立案', (() => {
    const r = judge(new Map([['apps/miniapp-taro/src/pkg-ai/ai/cards/types.ts', HF_TYPE]]))
    return [r.scanned, r.candidates.length, r.factory.candidates, r.unwired.length]
  })(), [1, 0, 0, 0])
  eq('F7 名字边界(宁窄):createdHandler/…Factory/复数/非导出都不立案,createHandler 与 create*Transport 立案', [
    isHandlerFactoryName('createToolDeltaHandler', true),
    isHandlerFactoryName('createHandler', true),
    isHandlerFactoryName('createMemoryTransport', true),
    isHandlerFactoryName('createdHandler', true),
    isHandlerFactoryName('createHandlerFactory', true),
    isHandlerFactoryName('createToolDeltaHandlers', true),
    isHandlerFactoryName('createLooseHandler', false),
  ], [true, true, true, false, false, false, false])
  eq('F8 形状三态:函数/箭头(夹返回类型标注)=factory、对象初值=not-factory、整行无初值=unknown', [
    declShape('export function createAHandler(): void {}', 0),
    declShape('export const createAHandler = (d: unknown): H => ({})', 1),
    declShape('export const createAHandler = base(H)', 1),
    declShape('export const createAHandler: H = { run() {} }', 1),
    declShape('export let createAHandler', 1),
    declShape('export interface createAHandler { run(): void }', 3),
    declShape('export class createAHandler { run() {} }', 2),
  ], ['factory', 'factory', 'not-factory', 'not-factory', 'unknown', 'not-factory', 'not-factory'])
  eq('F9 名字命中而形状读不出 ⇒ 报数逐条点名、不立案、也**不进 exit 2**(§12e:合法写法不得造恒红门)', [fOff.factory.unreadable, fOff.undetermined.length, decide({ stagedCounts: fOff.perFile, mode: 'full', undetermined: fOff.undetermined }).exit], [[`${HF_DECL_FILE}:5 createLooseHandler`], 0, 0])
  eq('F10 factoryFace 纯函数投影(候选/未接线点名/读不出三档各归各)', factoryFace(
    [{ file: 'a.ts', line: 1, name: 'createXHandler', kinds: ['handler-factory'] }, { file: 'a.ts', line: 2, name: 'K', kinds: ['policy-const'] }],
    [{ file: 'a.ts', line: 1, name: 'createXHandler', kinds: ['handler-factory'] }],
    ['a.ts:9 createYHandler'],
  ), { candidates: 1, unwired: ['a.ts:1 createXHandler'], unreadable: ['a.ts:9 createYHandler'] })
  eq('F11 集合推导失败落未判定:候选文件在判定面取不到内容 ⇒ 未判定点名,decide 给 exit 2(不记绿)', (() => {
    const r = judge(new Map([[HF_DECL_FILE, null]]), { face: 'head' })
    return [r.factory.candidates, r.undetermined.length, decide({ stagedCounts: r.perFile, mode: 'full', undetermined: r.undetermined }).exit]
  })(), [0, 1, 2])
  eq('F12 定级不动:C7 计数并入同一条 perFile 棘轮(新增即拦、齐平不红、全量档不判存量红)', [
    decide({ stagedCounts: { [HF_DECL_FILE]: 3 }, headCounts: { [HF_DECL_FILE]: 2 }, mode: 'staged' }).exit,
    decide({ stagedCounts: { [HF_DECL_FILE]: 3 }, headCounts: { [HF_DECL_FILE]: 3 }, mode: 'staged' }).exit,
    decide({ stagedCounts: fOff.perFile, headCounts: fOff.perFile, mode: 'full' }).exit,
  ], [1, 0, 0])

  console.log(fail ? `\n❌ 自检 ${fail}/${ran} 例失败` : `\n全部 ${ran} 例通过(正向证明双夹具 + 双变异对照 + 测试面/re-export/注释/specifier 四排除 + 契约闭包 + 棘轮四向 + 空扫判死 + i18n 码表三验收 + C7 工厂族四验收)`)
  process.exit(fail ? 1 : 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    selfTest()
  } else if (process.env[SELF_SKIP] === '1' && !argv.includes('--force')) {
    console.log(`⏭️  已跳过(${SELF_SKIP}=1):策略/契约消费者对账门未执行`)
    process.exit(0)
  } else {
    try {
      process.exit(main(argv))
    } catch (e) {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    }
  }
}

export const __test__ = {
  inScanRoot,
  isPolicyConstName,
  isBudgetContractName,
  isHandlerFactoryName,
  declShape,
  DECL_SHAPES,
  candidateKinds,
  factoryFace,
  isLexiconPath,
  LEX_LANGS,
  flattenLexicon,
  extractI18nUsages,
  judgeI18n,
  maskCommentsKeepStrings,
  blankStringContents,
  parseFile,
  specCompat,
  judge,
  decide,
  listFace,
  readFace,
  analyze,
  SELF_SKIP,
  FACE_NAME,
  FIXTURES: {
    SS_UNWIRED,
    SS_WIRED,
    REPL_CONSUMER,
    TC_SRC,
    TOOL_CONSUMER,
    HF_SRC,
    HF_TYPE,
    HF_CONSUMER,
    HF_NOISE,
    HF_DECL_FILE,
    HF_USE_FILE,
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
