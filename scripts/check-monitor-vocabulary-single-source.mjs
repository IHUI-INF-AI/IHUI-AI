#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 监控告警词表「单一真相源 + 不得自立第二份」对账门(2026-10-31 立,守门 200 同族先例)。
 *
 * 【接线状态:刻意尚未接提交链】本门**没有** `scripts/guardian-runner.mjs` 注册条目(票面明令:
 * 注册与 README/AGENTS 文档点名由机主串行做,避免撞本仓文档债互锁 —— 守门 89 R2/R4 两头都拦,
 * 拆开落就是自造恒红)。头注自称未接,镜像测试 T10 钉住"自称未接 ⇒ runner 必须真的没有条目"。
 * 将来接线的前置 = 现读 `--strict` RC=0(存量清单与归零次序见交付报告)。
 *
 * 在修什么(现读取证 2026-10-31):
 *   `monitor_alerts.status` / `.severity` 在库里都是裸 `varchar(20)` —— 无 CHECK、无 TS 枚举,
 *   消费侧全靠 `Record<键>` 取值 ⇒ 前端各页各自抄了一套词表。HEAD 面实测到三套并存:
 *     · 后端/库侧 = `firing / suppressed / resolved`(schema/monitor.ts 默认值 + monitor-routes ack/resolve)
 *     · `admin/monitor/alerts/types.ts:11` = `active / acknowledged / resolved`
 *       —— 其中 `acknowledged` **全仓仅此一处**,后端从未写入过该值 ⇒ 该页汇总卡恒 0、确认按钮永不出现
 *     · `admin/error-dashboard/page.tsx` = `open / resolved / ignored`
 *   直接后果:`AlertTable.tsx:68` 的 `LEVEL_STYLE[a.level]` 取到 undefined 后 `.icon` 抛 TypeError 崩表。
 *   canonical 已由机主落在 `packages/types/src/monitor-vocabulary.ts`(形态照守门 200 的
 *   PROVIDER_HEALTH_STATUSES 先例)。本门守的就是这份 canonical 不许再分叉、也不许无人引用而腐烂。
 *
 * 判据(输入按被审面现读,不 import、不执行被审实现;成员集合由 canonical 面解析得出,
 * 门内零手抄档位清单 ⇒ 预筛天然是判据的严格超集,不靠人记得同步模式串):
 *   W0/W5 canonical 自洽:从 `MONITOR_ALERT_STATUSES`/`MONITOR_ALERT_SEVERITIES` 的数组字面量解析
 *     成员集合;解析不到 ⇒ 未判定(不猜一份值域去扫全仓)。`MonitorAlertStatus` 必须是
 *     `(typeof MONITOR_ALERT_STATUSES)[number]` 派生形态,手抄字面量联合 ⇒ 红;
 *     `MONITOR_ALERT_STATUS_DEFAULT` 的字面量必须落在状态集合内,否则 ⇒ 红(默认值跑出血缘 = 库里
 *     住着一个前端词表根本不认识的值)。
 *   W1 全仓不得出现第二份**同值**状态词表:任一非 canonical 文件的声明形态站点
 *     (const 数组 / 字面量联合 / 内联 `|` 联合 / z.enum / TS enum)成员集合与 canonical 全等 ⇒ 红。
 *   W1p 同族**变体**词表同样红:站点同时含 canonical 的前两档(现读 = firing 与 suppressed,
 *     这对组合只属于本族),却与 canonical 不全等(超档/缺档/换档)⇒ 红。这一维是票面
 *     「同时含 'firing' 与 'suppressed'」的实现;配对锚点按 canonical 的**位置**取,不手抄字面量。
 *   W2 canonical 自身豁免是**硬编码在判据里的具名路径豁免**(预筛把 CANON.rel 从候选里摘掉),
 *     不是行内标记、不是台账。W2b 是这道豁免的兜底:canonical 文件内除锚点符号外的任一声明形态
 *     与 canonical 全等 ⇒ 红(不补这一格,"在真相源文件里再抄一份"正好从豁免缝里漏掉)。
 *   W3 旧值当现役档位使用:代码面(注释已遮)出现**陌生/旧值 token** 的引号字面量或对象字面量键
 *     ⇒ 红。token 清单见 `LEGACY_STATUS_TOKENS`(本域专属,新增一条必须先全仓核过它确实无人写)。
 *   W6 库侧默认值落地债(**只报数,永不判红**):`packages/database/src/schema/**` 里**声明了
 *     `monitor_alerts` / `suppression_rules` 的那份文件**中,`.default('<档位字面量>')` 自写值而未取
 *     canonical 常量 ⇒ 报名并写明阻塞原因。HEAD 现读 2 处 = schema/monitor.ts:29 'warning' 与 :30 'firing',
 *     正是本票要消的"两处各写一份"。此刻不判红的理由与票面第一条同:packages/database 的 dependencies
 *     无 @ihui/types ⇒ 依赖方向不允许 import canonical,判红即 §12e 恒红门;升严前置 = 先补 workspace
 *     依赖 + `@ihui/types` 的 `./monitor-vocabulary` 导出位(现读两条皆无,见交付报告)。
 *     射程收在"本表的 schema 声明文件":若只按"值属于两条词表之一"来收,会误抓别表的 `default('info')`
 *     (content.ts / system.ts / workflow.ts 三处是另一张表的另一件事)—— 由 C25 钉住。
 *   A1 「变量下标取 Record 且无兜底出口」形态(`*_STYLE[` / `*_LABEL[` 后同段无 `??`/`||`/`?.`):
 *     **分两档 + 一个只计数面**,这是本门与票面唯一的收窄处,原因是量出来的(2026-10-31 HEAD 现读:
 *     消费面 apps/+packages/ 无兜底 142 处 = 本族目录 3 + 射程外 139;scripts/ 面另有 111 处),
 *     绝大多数属别的域(反馈单、工单、直播订阅、MCP 凭据、别的面板…)。若无差别升 blocking,
 *     本门就成了一台与本次提交内容无关的恒红门(§12e:唯一结局是逼人 --no-verify、连带废掉全部守门)。
 *       · A1-in-family —— 落在**已因 W1/W1p/W3 被点名的文件所在目录**内的无兜底下标 ⇒ 默认报数,`--strict` 判红。
 *         今天这一档恰好罩住崩表现场 `admin/monitor/alerts/`(types.ts/helpers.ts 被点名 ⇒ 同目录入族 ⇒
 *         AlertTable.tsx:68/95/99 进射程,其中 :68 `LEVEL_STYLE[a.level]` 后紧跟 `.icon` 就是那次 TypeError)。
 *       · A1-out-of-family —— 其余消费面只报总数,永不判红;跨域改造归另票。
 *       · scripts/ 面只计数不点名(边界⑦:那一族绝大多数是别的面守门自己的输出标签,下标来自同文件写全的表)。
 *     严重度档(`MONITOR_ALERT_SEVERITIES`)的**同值副本只报名不判红**(HEAD 现读 15 处):
 *     `['info','warning','critical']` 与日志级别族高度同形,其中 orchestration.ts / relay-insights-service.ts
 *     是别的域的表,判红会把别的域一起拽进来(同一 §12e 理由),升严归另票,登记为覆盖边界。
 *
 * 三态绝不并桶:输入取不到 / 声明解析不到 / 候选枚举到 0 ⇒ 未判定 exit 2(既不冒红也绝不记绿,§0.3)。
 * 定级与取材同守门 200:默认档违规只报数 exit 0,`--strict` 才判红;全量判 **HEAD blob**、
 * `--staged` 判**索引 blob**(棘轮锚点 = 同一判据在 HEAD 面的键集 ⇒ 只有新增才红,存量只报名)、
 * `--worktree` 仅人工逃生舱、两旗同给 exit 2、取不到不回落另一个面(§0.4)。取数一律走
 * lib/face-reader;遮罩与声明形态解析(数组/具名联合/z.enum/TS enum、成员提取、括号配平、
 * 与 canonical 的关系分类)一律 import 守门 200 的实现 —— 它的 mask 就是 lib/code-mask 那一份,
 * 本门**一台判据都不重写**(§0.6 单一真相源;第二把尺子必然漂移)。本门只新增三把该域特有的
 * 取材器:内联联合、旧值使用点、无兜底下标。
 *
 * 无行内豁免(照守门 200 定档):判据认的是**声明形态**,正当写法(import canonical 或从其派生)
 * 本来就绿,不存在"合理动作被误伤"因而需要逃生舱的形状;新豁免族必须同笔登记门 108 存活期表,
 * 不登记就被 E4 判成"新引入的未登记豁免族"= 两道门互咬。唯一的豁免是 W2 的具名 canonical 路径
 * 与 SELF_EXEMPT_RE(门体与它的镜像测试必然逐字写出档位与旧值 token,夹具不写就没法证明判据有牙)。
 *
 * 覆盖边界(如实登记,不得读成"已确认没有"):
 *   ① 只判 TS/JS 面;.py / .sql / drizzle/meta/*.json(迁移快照派生态)不在 SCAN_EXTS 射程。
 *   ② 判的是**静态声明面**,运行时算出来的档位这一格没有判据(归运行时面)。
 *   ③ A1 的"有无兜底"按同一表达式内 `??`/`||`/`?.` 量;用 `Object.hasOwn`/helper 包一层的兜底
 *      看不见 ⇒ 报数侧多报,不产生假绿方向的风险(判据不判红 ⇒ 升严前需人工核)。
 *   ④ `--worktree` 档的预筛用 git grep 不带 rev ⇒ 只搜已跟踪文件;新建未跟踪文件在 HEAD/--staged
 *      两面都看得见(提交前必然已进索引),那一档本来就不是提交门禁。
 *   ⑤ 数组/具名联合的**行号指针**来自共享的守门 200 解析器,它把"声明前那个换行"算进匹配起点 ⇒
 *      数组站点可能指到声明的上一行(文件指针恒准;本门不自写第二把解析器去修它,§0.6)。
 *      本门自己的三把解析器(内联联合 / 旧值站点 / 无兜底下标)行号逐字精确,由 C27 钉住。
 *   ⑥ A1 只认名字以大写蛇形(可含小写段)结尾且以 `STYLE`/`LABEL` 收口的常量表;
 *      `Record<…>` 变量名不带该后缀的(如 `MAP[k]`、`SEV_STYLE` 之外的 `OBJ[key]`)不在射程 ——
 *      那是通用形态,无差别纳入会把判据变成"扫全仓所有下标",与"本族崩溃成因"这条射程无关。
 *   ⑦ scripts/ 面的 `*_LABEL[`/`*_STYLE[` 只进总数不进清单(见上 A1 第三档)。
 *   ⑧ 旧值 token 清单(`LEGACY_STATUS_TOKENS`)是本门里**唯一不来自被审面**的输入 —— 它记的是
 *      "后端从未写入过的档",无法从 canonical 反推(全等 ⇒ 空集)。所以新增一条的前置写死在
 *      代码注释里:必须先全仓现读确认无人写入。它的失效方向是"多要一次定向说明"(多判一条红),
 *      不是"多放一次跳门"(§0.10)。
 */

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  balanceRange,
  classifyAgainst,
  classifyTypeRhs,
  declarationSites,
  literalsIn,
  mask,
  typeRhs,
} from './check-provider-health-vocabulary.mjs'
import { Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { requireFlagValue } from './lib/flag-value.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** W0/W2/W5 锚点:唯一真相源的路径与符号名。改名必须与被审面**同笔**,否则判未判定而不是静默绿。 */
export const CANON = {
  rel: 'packages/types/src/monitor-vocabulary.ts',
  statusArraySymbol: 'MONITOR_ALERT_STATUSES',
  statusTypeSymbol: 'MonitorAlertStatus',
  severityArraySymbol: 'MONITOR_ALERT_SEVERITIES',
  severityTypeSymbol: 'MonitorAlertSeverity',
  defaultSymbol: 'MONITOR_ALERT_STATUS_DEFAULT',
}

/**
 * W3 的陌生/旧值 token:后端从未写入过、却被某处当作现役档位使用的状态串。
 * 新增一条的前置 = 全仓现读它确实无人写(否则这一维会去判一个真值,方向就错了)。
 * 判据认**用法**(引号字面量 / 对象键),不认"文件里提到过这个词"。
 */
export const LEGACY_STATUS_TOKENS = ['acknowledged']

/** 票面档位「三档」只是**说明性**期望:不符就 note,不当尺子用(尺子永远来自被审面)。 */
export const DOC_STATUS_COUNT = 3
export const DOC_SEVERITY_COUNT = 3

/** 扫描面(目录前缀 + 扩展名二者必须同时是判据的超集 —— 预筛漏形态 = 门全盲)。 */
export const SCAN_PREFIXES = ['apps/', 'packages/', 'scripts/']
export const SCAN_EXTS = ['.ts', '.tsx', '.js', '.mjs']
/**
 * 迁移快照与生成物:含档位字面量但**不是声明面**(drizzle/meta/*.json 由 drizzle-kit 派生,
 * 改它 = 改迁移正文,本仓「迁移正文不可变」)。按扩展名本来也进不来,列在这里是防止日后有人
 * 给 SCAN_EXTS 加 .json 时把它一起放进来。
 */
export const GENERATED_RE = /(^|\/)drizzle\/(meta|)/

const SKIP_RE = /(^|\/)(node_modules|dist|\.next|\.nuxt|coverage|\.venv|build)\//

/**
 * 门体与它的镜像测试必然逐字写出档位与旧值 token(夹具不写就没法证明判据有牙),按路径自豁免 ——
 * 与守门 79/102/151/200 同一护栏形态;不自豁免的话门会把自己判成第二份抄本,而落地那枚提交恰好是
 * **新增**,棘轮救不了它(AGENTS:门不得读自己)。
 */
export const SELF_EXEMPT_RE = /check-monitor-vocabulary-single-source/

const lineIndexOf = (src, idx) => (src.slice(0, idx).match(/\n/g) || []).length

/**
 * 内联字面量联合(`status: 'a' | 'b' | 'c'` 这种住在属性签名里的联合)。
 * 守门 200 的 declarationSites 只认 `type NAME = …`,而本域 HEAD 现读的真实 offender
 * (`alerts/types.ts:11`)正是这一形 —— 不补这一格,崩表的那张表就从判据缝里过去。
 */
export function inlineUnionSites(src) {
  const masked = mask(src)
  const one =
    String.raw`(?:'[^'\n]*'|"[^"\n]*"|` + '`' + String.raw`[^` + '`' + String.raw`\n]*` + '`' + ')'
  const re = new RegExp(`${one}(?:[ \\t]*\\|[ \\t]*${one})+`, 'g')
  const out = []
  for (const m of masked.matchAll(re)) {
    out.push({
      kind: 'inlineUnion',
      name: '(inline union)',
      members: literalsIn(m[0]),
      line: lineIndexOf(masked, m.index) + 1,
    })
  }
  return out
}

/**
 * 一个文件的**词表候选站点** = 守门 200 的 declarationSites ∪ 内联联合,按 (行号, 成员集合) 去重。
 * 去重是必需的:`export type Narrow = 'bb' | 'cc'` 同时被两把解析器读到,不归一就会把一处漂移
 * 报成两处(计数虚高 = 交付报告与台账对不上,本仓 §10 同型)。声明形态优先(它带符号名)。
 */
export function vocabularySites(src) {
  const out = []
  const seen = new Set()
  for (const s of [...declarationSites(src), ...inlineUnionSites(src)]) {
    const k = `${s.line}|${[...new Set(s.members)].sort().join(',')}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(s)
  }
  return out
}

/** W3 取材:旧值 token 被**当档位使用**的站点(引号字面量 / 对象字面量键)。 */
export function legacyTokenSites(src, tokens = LEGACY_STATUS_TOKENS) {
  const masked = mask(src)
  const out = []
  for (const tok of tokens) {
    const esc = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    for (const m of masked.matchAll(new RegExp(`['"\`]${esc}['"\`]`, 'g'))) {
      out.push({ token: tok, form: 'string', line: lineIndexOf(masked, m.index) + 1 })
    }
    for (const m of masked.matchAll(new RegExp(`(?<![\\w$.])${esc}[ \\t]*:`, 'g'))) {
      out.push({ token: tok, form: 'key', line: lineIndexOf(masked, m.index) + 1 })
    }
  }
  return out
}

/** A1 取材:`*_STYLE[` / `*_LABEL[` 变量下标,且同一表达式内**无兜底出口**。 */
export function unguardedRecordIndexSites(src) {
  const masked = mask(src)
  const out = []
  for (const m of masked.matchAll(/\b([A-Z][A-Za-z0-9_]*(?:STYLE|LABEL))[ \t]*\[/g)) {
    const open = m.index + m[0].length - 1
    const r = balanceRange(masked, open)
    if (!r) continue
    const rest = masked.slice(r.end + 1, r.end + 1 + 120).split('\n')[0]
    if (/\?\?|\|\||\?\./.test(rest)) continue
    out.push({ name: m[1], line: lineIndexOf(masked, m.index) + 1 })
  }
  return out
}

/** W6 取材:库侧 schema 里自写档位字面量的列默认值(只报数,见头注 W6 的恒红门理由)。 */
export function schemaDefaultLiteralSites(src, statuses) {
  const masked = mask(src)
  const out = []
  const set = new Set(statuses)
  const tokAlt = [...set].map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  if (!tokAlt) return out
  const re = new RegExp(
    `[.][ \\t]*default\\([ \\t]*(?:'(${tokAlt})'|"(${tokAlt})"|` + '`' + `(${tokAlt})` + '`' + `)`,
    'g',
  )
  for (const m of masked.matchAll(re)) {
    out.push({ value: m[1] ?? m[2] ?? m[3], line: lineIndexOf(masked, m.index) + 1 })
  }
  return out
}

/** canonical 的某个数组符号:解析不出成员 ⇒ 交调用方判未判定(不猜值域)。 */
export function parseCanonicalArray(src, symbol) {
  const re = new RegExp(
    `(?:export[ \\t]+)?(?:const|let|var)[ \\t]+${symbol}[ \\t]*(?::[^=\\n]*)?[ \\t]*=[ \\t]*\\[`,
  )
  const m = re.exec(src)
  if (!m) return null
  const open = m.index + m[0].length - 1
  const r = balanceRange(src, open)
  if (!r) return null
  const members = literalsIn(src.slice(open + 1, r.end))
  if (members.length < 2) return null
  return { members, asConst: /as[ \t]+const/.test(src.slice(r.end + 1, r.end + 40)) }
}

/** canonical 的默认值字面量(`MONITOR_ALERT_STATUS_DEFAULT: T = 'firing'`)。解析不到 ⇒ null。 */
export function parseCanonicalDefault(src, symbol) {
  const re = new RegExp(
    `(?:export[ \\t]+)?(?:const|let|var)[ \\t]+${symbol}[ \\t]*(?::[^=\\n]*)?[ \\t]*=[ \\t]*['"\`]([^'"\`\n]*)['"\`]`,
  )
  const m = re.exec(src)
  if (!m) return null
  return { value: m[1], line: lineIndexOf(src, m.index) + 1 }
}

function violation(key, text) {
  return { key, text }
}

/**
 * 纯判据(全部输入是已读好的文本;candidates=null 表示"本轮不判这一维",[] 表示"枚举跑了而
 * 一个都没有"= 判死)。镜像测试只调它,不重写任何解析规则(§22c)。
 * `canonicalExempt=false` 是**测试专用**的变异开关:把 W2 的具名路径豁免摘掉,同一份文本必须
 * 翻红 —— 这一格不测,"豁免"与"失明"就长得一模一样。生产路径永远走默认 true。
 */
export function decide({
  canon,
  candidates,
  canonicalExempt = true,
  statusCount = DOC_STATUS_COUNT,
  severityCount = DOC_SEVERITY_COUNT,
}) {
  const violations = []
  const advisories = []
  const notes = []
  const undetermined = []
  const stats = {
    candidateFiles: 0,
    undeterminedFiles: 0,
    legacy: [],
    exact: [],
    variant: [],
    superset: [],
    subset: [],
    severityCopies: [],
    landingDebt: [],
    styleInFamily: [],
    styleOutOfFamily: [],
    styleScriptsFace: 0,
    familyDirs: [],
  }

  if (typeof canon !== 'string' || canon.length === 0) {
    undetermined.push(`W0 canonical 面取不到(${CANON.rel})⇒ 值域无从现读,全维不判`)
    return {
      violations,
      advisories,
      notes,
      undetermined,
      statuses: null,
      severities: null,
      defaultStatus: null,
      stats,
    }
  }
  const cm = mask(canon)
  const st = parseCanonicalArray(cm, CANON.statusArraySymbol)
  if (!st) {
    undetermined.push(`W0 解析不到 ${CANON.statusArraySymbol} 的数组字面量(锚点漂移?不猜值域)`)
    return {
      violations,
      advisories,
      notes,
      undetermined,
      statuses: null,
      severities: null,
      defaultStatus: null,
      stats,
    }
  }
  const sv = parseCanonicalArray(cm, CANON.severityArraySymbol)
  if (!sv) {
    undetermined.push(`W0 解析不到 ${CANON.severityArraySymbol} 的数组字面量(锚点漂移?不猜值域)`)
    return {
      violations,
      advisories,
      notes,
      undetermined,
      statuses: st.members,
      severities: null,
      defaultStatus: null,
      stats,
    }
  }
  const statuses = st.members
  const severities = sv.members
  const dflt = parseCanonicalDefault(cm, CANON.defaultSymbol)
  if (!dflt) {
    undetermined.push(`W0 解析不到 ${CANON.defaultSymbol} 的字符串字面量(库侧默认值的唯一来路失联)`)
  } else if (!statuses.includes(dflt.value)) {
    violations.push(
      violation(
        `W5|${CANON.rel}|${CANON.defaultSymbol}`,
        `W5 默认值跑出状态集合:${CANON.rel}:${dflt.line} ${CANON.defaultSymbol} = '${dflt.value}',不在 [${statuses.join(',')}] 内 ⇒ 库里会住进一个消费侧词表不认识的值`,
      ),
    )
  }
  if (!st.asConst)
    notes.push(`W0 ${CANON.statusArraySymbol} 未标 as const ⇒ 派生联合退化为 string[](档位不封闭)`)
  if (!sv.asConst)
    notes.push(
      `W0 ${CANON.severityArraySymbol} 未标 as const ⇒ 派生联合退化为 string[](档位不封闭)`,
    )
  if (statuses.length !== statusCount)
    notes.push(
      `W0 状态档现读 ${statuses.length} 档,与票面「${statusCount} 档」不符(改档 = 动落库/REST/徽章三重对外契约,须另票并同批改五语言词表)`,
    )
  if (severities.length !== severityCount)
    notes.push(
      `W0 严重度档现读 ${severities.length} 档,与票面「${severityCount} 档」不符(同上,归另票)`,
    )

  // ---- W5 canonical 的类型必须是派生形态 ----
  for (const [typeSymbol, arraySymbol] of [
    [CANON.statusTypeSymbol, CANON.statusArraySymbol],
    [CANON.severityTypeSymbol, CANON.severityArraySymbol],
  ]) {
    const t = classifyTypeRhs(typeRhs(cm, typeSymbol))
    if (t.kind === 'absent') {
      undetermined.push(`W5 解析不到类型声明:${typeSymbol}(锚点与被审面必须同笔)`)
    } else if (t.kind !== 'derived' || t.from !== arraySymbol) {
      violations.push(
        violation(
          `W5|${CANON.rel}|${typeSymbol}`,
          `W5 唯一真相源自己不是派生形态:${CANON.rel}:${t.line} ${typeSymbol} 现为 ${t.kind}${t.members.length > 0 ? ` [${t.members.join(',')}]` : ''},应写成 (typeof ${arraySymbol})[number]`,
        ),
      )
    }
  }

  // ---- W2b canonical 文件自己也不许有第二份(豁免必须自带兜底,否则"在真相源里再抄一份"从缝里漏掉) ----
  for (const s of declarationSites(canon)) {
    if (s.name === CANON.statusArraySymbol || s.name === CANON.severityArraySymbol) continue
    if (classifyAgainst(s.members, statuses) === 'exact') {
      violations.push(
        violation(
          `W2b|${CANON.rel}|${s.kind}|${s.name}`,
          `W2b 唯一真相源文件里出现第二份同值状态表:${CANON.rel}:${s.line} ${s.kind} ${s.name} = [${s.members.join(',')}],与同文件 ${CANON.statusArraySymbol} 重复 ⇒ 同一档位在一份文件里就有两处答案`,
        ),
      )
    }
  }
  // 注:W2 的具名路径豁免**只作用在候选面**(见下面循环里的 canonicalExempt 分支),
  // W2b 是它的兜底 —— 摘掉豁免的变异臂由镜像测试 C3 用同一份 canonical 文本喂进候选面来证。

  // ---- W1 / W1p / W3:候选面 ----
  if (candidates === null || candidates === undefined) {
    notes.push('W1/W3 本轮未提供候选清单(仅取 canonical 值域,不代表全仓无第二份)')
    return {
      violations,
      advisories,
      notes,
      undetermined,
      statuses,
      severities,
      defaultStatus: dflt ? dflt.value : null,
      stats: { ...stats, candidateFiles: -1 },
    }
  }
  if (candidates.length === 0) {
    undetermined.push('W1 候选枚举到 0 个文件 ⇒ 判死(扫描面/预筛漂了,不得当成"没有第二份")')
    return {
      violations,
      advisories,
      notes,
      undetermined,
      statuses,
      severities,
      defaultStatus: dflt ? dflt.value : null,
      stats,
    }
  }
  stats.candidateFiles = candidates.length
  const pair = [statuses[0], statuses[1]]
  for (const c of candidates) {
    if (typeof c.src !== 'string' || c.src.length === 0) {
      stats.undeterminedFiles += 1
      undetermined.push(`W1 候选取不到内容:${c.path}`)
      continue
    }
    if (canonicalExempt && c.path === CANON.rel) continue
    for (const s of vocabularySites(c.src)) {
      const rel = classifyAgainst(s.members, statuses)
      const hasPair = pair.every((p) => s.members.includes(p))
      if (rel === 'exact') {
        stats.exact.push(`${c.path}:${s.line} ${s.kind} ${s.name}`)
        violations.push(
          violation(
            `W1|${c.path}|${s.kind}|${s.name}`,
            `W1 第二份同值状态词表:${c.path}:${s.line} ${s.kind} ${s.name} = [${s.members.join(',')}],与唯一真相源 ${CANON.rel} 的 ${CANON.statusArraySymbol} 逐字同值 ⇒ 改一侧忘另一侧时两侧都不红。改法:import ${CANON.statusTypeSymbol}/${CANON.statusArraySymbol} 或从其派生`,
          ),
        )
      } else if (hasPair) {
        stats.variant.push(`${c.path}:${s.line} ${s.kind} ${s.name}[${s.members.join(',')}]`)
        violations.push(
          violation(
            `W1p|${c.path}|${s.kind}|${s.name}`,
            `W1p 自立**变体**状态词表:${c.path}:${s.line} ${s.kind} ${s.name} = [${s.members.join(',')}]:同时含 ${pair[0]} 与 ${pair[1]}(这对组合只属于本族)却与 canonical [${statuses.join(',')}] 不全等 ⇒ 同一张告警表两处答案不同,消费侧按下标取到 undefined 即崩`,
          ),
        )
      } else if (rel === 'superset') {
        stats.superset.push(`${c.path}:${s.line} ${s.kind} ${s.name}[${s.members.join(',')}]`)
      } else if (rel === 'subset') {
        stats.subset.push(`${c.path}:${s.line} ${s.kind} ${s.name}[${s.members.join(',')}]`)
      }
      if (classifyAgainst(s.members, severities) === 'exact') {
        stats.severityCopies.push(`${c.path}:${s.line} ${s.kind} ${s.name}[${s.members.join(',')}]`)
      }
    }
    for (const l of legacyTokenSites(c.src)) {
      stats.legacy.push(`${c.path}:${l.line} ${l.form} '${l.token}'`)
      violations.push(
        violation(
          `W3|${c.path}|${l.token}|${l.line}`,
          `W3 旧值被当现役档位使用:${c.path}:${l.line} 以${l.form === 'key' ? '对象字面量键' : '引号字面量'}形态使用 '${l.token}',而后端从未写入该值(canonical 状态集 = [${statuses.join(',')}])⇒ 该档永远匹配不到任何一行,汇总卡恒 0、按钮永不出现。改法:import ${CANON.statusTypeSymbol} 并把该档换成 canonical 值;'${l.token}' 若要保留,必须先在后端写入侧落地并同批改 canonical(另票)`,
        ),
      )
    }
  }

  // ---- W6 库侧默认值落地债(只报数;射程收在**本表**的 schema 声明文件) ----
  // 收窄理由(现读实测):按"值属于两条词表之一"来收会误抓别表的 default('info')
  // (content/system/workflow 三处日志/通知列),那是另一张表的另一件事;
  // 只有声明了 monitor_alerts / suppression_rules 的文件里的档位字面量默认值才是本票的落地债。
  for (const c of candidates) {
    if (typeof c.src !== 'string' || c.src.length === 0) continue
    if (!c.path.startsWith('packages/database/src/schema/')) continue
    if (!/\bpgTable\(\s*['"`](monitor_alerts|suppression_rules)['"`]/.test(c.src)) continue
    for (const d of schemaDefaultLiteralSites(c.src, [...statuses, ...severities])) {
      const fam = statuses.includes(d.value) ? CANON.statusArraySymbol : CANON.severityArraySymbol
      stats.landingDebt.push(`${c.path}:${d.line} default('${d.value}')∈${fam}`)
    }
  }

  // ---- A1 无兜底 Record 下标:先算"被点名文件所在目录"= 本族目录 ----
  const flagged = new Set()
  for (const v of violations) {
    if (v.key.startsWith('W1|') || v.key.startsWith('W1p|') || v.key.startsWith('W3|')) {
      flagged.add(v.key.split('|')[1])
    }
  }
  const dirOf = (p) => (p.lastIndexOf('/') > 0 ? p.slice(0, p.lastIndexOf('/')) : '')
  const familyDirs = new Set([...flagged].map(dirOf).filter((d) => d.length > 0))
  stats.familyDirs = [...familyDirs]
  for (const c of candidates) {
    if (typeof c.src !== 'string' || c.src.length === 0) continue
    for (const s of unguardedRecordIndexSites(c.src)) {
      // 边界⑦:scripts/ 面的 `*_LABEL[` 绝大多数是**守门自己的输出标签**(FACE_LABEL/CODE_LABEL…),
      // 下标来自同一文件里写全的常量表,不是"库里可写的裸 varchar 值" ⇒ 与本族的崩溃成因不同族。
      // 只计数不点名,免得 250 行清单里 100+ 行是门自己的散文。
      if (c.path.startsWith('scripts/')) {
        stats.styleScriptsFace += 1
        continue
      }
      const inFamily = familyDirs.has(dirOf(c.path))
      const entry = `${c.path}:${s.line} ${s.name}[…]`
      if (inFamily) stats.styleInFamily.push(entry)
      else stats.styleOutOfFamily.push(entry)
      advisories.push(
        violation(
          `A1|${c.path}|${s.name}|${s.line}`,
          `A1 变量下标取 Record 且无兜底出口:${c.path}:${s.line} ${s.name}[…] 后同段没有 ??/||/?. —— 键来自库里可写的裸 varchar 时,一个词表外的值就取到 undefined,紧接着的属性访问当场 TypeError${inFamily ? '(本族目录 ⇒ --strict 判红)' : '(射程外 ⇒ 只报数,跨域改造归另票)'}`,
        ),
      )
    }
  }

  if (stats.superset.length > 0)
    notes.push(
      `W1 超集(含全部状态档又更多档)按另一张表只报名,不判红(${stats.superset.length} 处):${stats.superset.join(' | ')}`,
    )
  if (stats.subset.length > 0)
    notes.push(
      `W1 真子集(本族档位的残缺表)只报名,不判红(${stats.subset.length} 处);补齐到全档即翻红:${stats.subset.join(' | ')}`,
    )
  if (stats.severityCopies.length > 0)
    notes.push(
      `W1 严重度同值副本只报名不判红(${stats.severityCopies.length} 处):与日志级别族高度同形,判红会拽进别的域(§12e),升严归另票:${stats.severityCopies.join(' | ')}`,
    )
  if (stats.landingDebt.length > 0)
    notes.push(
      `W6 库侧默认值仍自写档位字面量(${stats.landingDebt.length} 处,只报数):${stats.landingDebt.join(' | ')} —— 阻塞原因:packages/database 的 dependencies 无 @ihui/types ⇒ 依赖方向不允许 import canonical,判红即恒红门(§12e)。出路 = 先补 workspace 依赖 + @ihui/types 的 ./monitor-vocabulary 导出位,再把 default() 换成 ${CANON.defaultSymbol}`,
    )

  return {
    violations,
    advisories,
    notes,
    undetermined,
    statuses,
    severities,
    defaultStatus: dflt ? dflt.value : null,
    stats,
  }
}

// ---- 取材(清单与内容必须同面同轮 —— 混面取数会产出自洽却错位的尺子)----

function readContents(root, face, rels) {
  const out = {}
  if (face === 'worktree') {
    for (const rel of rels) {
      try {
        out[rel] = readWorktreeFile(root, rel)
      } catch {
        out[rel] = null
      }
    }
    return out
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const specs = rels.map((rel) => prefix + rel)
  const got = catBatch(root, specs)
  rels.forEach((rel, i) => {
    out[rel] = got.get(specs[i]) ?? null
  })
  return out
}

/**
 * 预筛必须与判定**同面同轮**,且必须是判据的**严格超集**:head ⇒ `git grep … HEAD`;staged ⇒ `--cached`;
 * worktree ⇒ 不带 rev(只搜已跟踪文件,头注边界 ④)。
 * 三组模式各有来路,少一组就有一格失明(实测踩过):
 *   · quoted(状态档 ∪ 严重度档)⇒ 只搜**引号形态**:声明形态站点的档位一定是带引号的字面量,
 *     而 `resolved`/`warning` 这类裸词在全仓以千百种无关身份出现,裸搜会把候选面炸成噪音集。
 *   · bare(旧值 token)⇒ **额外再搜裸形态**。W3 认对象字面量键(`acknowledged: '已确认'` 这种
 *     文案表键不带引号),只搜引号会让 `alerts/helpers.ts` 整档从候选面里消失 —— 判据有牙却够不着
 *     = 假绿(守门 77/102 "预筛漏形态 = 门全盲"同型)。这一组今天实测只多两枚文件,不吵。
 *   · extraFixed(`*_STYLE[` / `*_LABEL[` 下标)⇒ A1 的量面因此是全仓而不只是档位引用者;
 *     漏了它,"射程外只报数"那一档会少报 200+ 处,交付给机主的存量归零次序清单就是残缺的。
 * 三组一律按**当次现读**的 canonical 值域与被审面算,门内不手抄档位。
 */
export function grepCandidates(root, face, quoted, bare = [], extraFixed = []) {
  const args = ['grep', '-F', '-l', '--no-color']
  for (const t of quoted) args.push('-e', `'${t}'`, '-e', `"${t}"`, '-e', '`' + t + '`')
  for (const t of bare) args.push('-e', t)
  for (const t of extraFixed) args.push('-e', t)
  if (face === 'staged') args.push('--cached')
  else if (face !== 'worktree') args.push('HEAD')
  args.push('--', 'apps', 'packages', 'scripts')
  let out
  try {
    out = gitRaw(args, root)
  } catch (e) {
    if (e instanceof Undetermined && e.status === 1) return []
    throw new Undetermined(`W1 预筛派生失败(${face} 面):${e.message}`)
  }
  return out
    .split('\n')
    .map((l) => l.replace(/^HEAD:/, '').trim())
    .filter(
      (p) =>
        p.length > 0 &&
        !SKIP_RE.test(p) &&
        !GENERATED_RE.test(p) &&
        !SELF_EXEMPT_RE.test(p) &&
        p !== CANON.rel &&
        SCAN_PREFIXES.some((d) => p.startsWith(d)) &&
        SCAN_EXTS.some((e) => p.endsWith(e)),
    )
}

/** A1 的量面模式(裸串,固定不随 canonical 变):`*_STYLE[` / `*_LABEL[` 下标。 */
export const STYLE_GREP_PATTERNS = ['_STYLE[', '_LABEL[']

/** 一组预筛参数(单一出口,免得 runAudit 两处手抄不同口径)。 */
export function preScreenTokens(pre) {
  return {
    quoted: [...(pre.statuses || []), ...(pre.severities || [])],
    bare: LEGACY_STATUS_TOKENS,
    extraFixed: STYLE_GREP_PATTERNS,
  }
}

export function runAudit({ root = ROOT, face, canonicalExempt = true } = {}) {
  const sel = face
    ? { face, error: null }
    : selectFace({ staged: false, worktree: false, def: 'head' })
  if (sel.error) throw new Undetermined(sel.error)
  const canonSrc = readContents(root, sel.face, [CANON.rel])[CANON.rel]
  // 预读轮**不给 candidates**(空数组 = 枚举跑完一个都没有 = 判死,不是"这一轮不判该维")
  const pre = decide({ canon: canonSrc, candidates: null, canonicalExempt })
  if (!pre.statuses) return { face: sel.face, ...pre, fileCount: 1, inherited: [] }
  const tok = preScreenTokens(pre)
  const candPaths = grepCandidates(root, sel.face, tok.quoted, tok.bare, tok.extraFixed)
  const candContents = readContents(root, sel.face, candPaths)
  // 测试面不参与 W1/W1p/W3/A1:fixture 的职责就是**喂真值/脏值/旧值**来验兜底与筛选,
  // 把它当"现役档位声明"判红,等于逼测试不测脏值 —— 而脏值兜底正是本族崩溃的防线
  // (2026-10-31 实测:三个新测试文件分别命中 W1p/W3,全是对 fixture 的误报)。
  const isTestPath = (p) =>
    /(^|\/)(tests?|__tests__)\//.test(p) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(p)
  const candidates = candPaths
    .filter((p) => !isTestPath(p))
    .map((p) => ({ path: p, src: candContents[p] }))
  const res = decide({ canon: canonSrc, candidates, canonicalExempt })
  // --staged 的棘轮锚点 = 同一判据在 HEAD 面的键集(§12e:与本次提交无关的恒红只会逼人跳门)。
  let inherited = []
  if (sel.face === 'staged') {
    const headSrc = readContents(root, 'head', [CANON.rel])[CANON.rel]
    const headPre = decide({ canon: headSrc, candidates: null, canonicalExempt })
    // 两侧预筛**同口径不同基准**:HEAD 面用它自己的值域算 token,不借索引面的(取不到才回落)
    const htok = headPre.statuses ? preScreenTokens(headPre) : tok
    const headPaths = grepCandidates(root, 'head', htok.quoted, htok.bare, htok.extraFixed)
    const headContents = readContents(root, 'head', headPaths)
    const headRes = decide({
      canon: headSrc,
      candidates: headPaths.map((p) => ({ path: p, src: headContents[p] })),
      canonicalExempt,
    })
    const headKeys = new Set(headRes.violations.map((v) => v.key))
    inherited = res.violations.filter((v) => headKeys.has(v.key))
    res.violations = res.violations.filter((v) => !headKeys.has(v.key))
    if (headRes.undetermined.length > 0)
      res.notes.push(
        `棘轮锚点部分不可用(HEAD 面 ${headRes.undetermined.length} 项未判定)⇒ 该维存量不豁免:方向是"多要一次定向说明",不是"多放一次跳门"`,
      )
  }
  if (sel.face !== 'staged')
    res.notes.push(
      `W1/W3 本档不判"新增"的原因:被审面(${sel.face})就是锚点面 ⇒ 拿不到"新引入"这一维。要问责新增副本,跑 --staged。`,
    )
  return { face: sel.face, ...res, fileCount: 1 + candidates.length, inherited }
}

// ---- --self-test(构造面正反成对;变异一律先证明文本真被改,再断言判据红)----
// 夹具的**状态档**全是合成词(aa/bb/cc),与真仓三档无交集;旧值 token 一律从
// LEGACY_STATUS_TOKENS 取(测试不重抄字面量,§22c)。

export const FIXTURE_CANON = `
export const ${CANON.statusArraySymbol} = ['aa', 'bb', 'cc'] as const
export type ${CANON.statusTypeSymbol} = (typeof ${CANON.statusArraySymbol})[number]
export const ${CANON.severityArraySymbol} = ['xx', 'yy'] as const
export type ${CANON.severityTypeSymbol} = (typeof ${CANON.severityArraySymbol})[number]
export const ${CANON.defaultSymbol}: ${CANON.statusTypeSymbol} = 'aa'
`

const LEGAL = LEGACY_STATUS_TOKENS[0]
export const FIXTURE_COPY_ARRAY = `
export const ALERT_COLS = ['aa', 'bb', 'cc']
`
export const FIXTURE_COPY_INLINE = `
export interface Row { status: 'aa' | 'bb' | 'cc' }
`
export const FIXTURE_LEGACY_UNION = `
export interface Alert { status: 'dd' | '${LEGAL}' | 'cc' }
`
export const FIXTURE_LEGACY_KEY = `
export const STATUS_LABEL = { dd: '甲', ${LEGAL}: '乙', cc: '丙' }
`
export const FIXTURE_VARIANT_PAIR = `
export const TIERS: string[] = ['aa', 'bb', 'ee']
`
export const FIXTURE_SUBSET_ONLY = `
export type Narrow = 'bb' | 'cc'
`
export const FIXTURE_UNRELATED = `
export type TicketState = 'open' | 'closed'
`
export const FIXTURE_STYLE_UNGUARDED = `
const st = LEVEL_STYLE[a.level]
return st.icon
`
export const FIXTURE_STYLE_GUARDED = `
const st = LEVEL_STYLE[a.level] ?? FALLBACK
return st?.icon
`

function r(over, base = FIXTURE_CANON) {
  return decide({
    canon: base,
    candidates: over.candidates,
    canonicalExempt: over.canonicalExempt !== false,
    ...extra(over),
  })
}
function extra(over) {
  const o = {}
  if (over.statusCount !== undefined) o.statusCount = over.statusCount
  return o
}

export function selfTest() {
  const cases = []
  const check = (name, fn) => cases.push({ name, fn })
  const keys = (x) => x.violations.map((v) => v.key)
  const cand = (path, src) => ({ path, src })
  const FAM = 'apps/web/app/(main)/admin/monitor/alerts'

  check('C1 canonical 现读状态/严重度集合正确且零违规', () => {
    const x = r({ candidates: null })
    return (
      x.statuses.join(',') === 'aa,bb,cc' &&
      x.severities.join(',') === 'xx,yy' &&
      x.defaultStatus === 'aa' &&
      x.violations.length === 0
    )
  })
  check('C2 canonical 自身不进候选(W2 具名豁免生效)', () => {
    const x = r({ candidates: [cand(CANON.rel, FIXTURE_COPY_ARRAY)] })
    return keys(x).every((k) => !k.startsWith('W1|' + CANON.rel))
  })
  check(
    'C3 成对反向臂:同一份 canonical 文本喂进候选面 —— 豁免在 ⇒ 绿,摘掉 ⇒ 红(证明 W2 豁免有牙,不是失明)',
    () => {
      const cands = [cand(CANON.rel, FIXTURE_CANON), cand('apps/x/one.ts', FIXTURE_UNRELATED)]
      const exempted = decide({ canon: FIXTURE_CANON, candidates: cands, canonicalExempt: true })
      const revoked = decide({ canon: FIXTURE_CANON, candidates: cands, canonicalExempt: false })
      const hitOnCanon = (x) =>
        x.violations.some((v) => v.key.startsWith('W1|') && v.key.includes(`|${CANON.rel}|`))
      return (
        exempted.violations.length === 0 &&
        hitOnCanon(revoked) &&
        revoked.violations.length === exempted.violations.length + 1
      )
    },
  )
  check('C4 第二份同值 const 数组 ⇒ W1 点名文件与行号', () => {
    const x = r({ candidates: [cand('apps/x/copy.ts', FIXTURE_COPY_ARRAY)] })
    const v = x.violations.find((z) => z.key === 'W1|apps/x/copy.ts|array|ALERT_COLS')
    return (
      !!v &&
      /apps\/x\/copy\.ts:\d+ array ALERT_COLS = \[aa,bb,cc\]/.test(v.text) &&
      x.stats.exact.length === 1
    )
  })
  check('C5 第二份同值**内联联合**(alerts/types.ts 的真实形态)⇒ W1 抓得到', () => {
    const x = r({ candidates: [cand('apps/x/t.ts', FIXTURE_COPY_INLINE)] })
    return keys(x).some((k) => k.startsWith('W1|apps/x/t.ts|inlineUnion'))
  })
  check('C6 旧值当档位用(联合形态)⇒ W3 红', () => {
    const x = r({ candidates: [cand('apps/x/u.ts', FIXTURE_LEGACY_UNION)] })
    return keys(x).some((k) => k.startsWith('W3|apps/x/u.ts'))
  })
  check('C7 旧值当对象键用(STATUS_LABEL 形态)⇒ W3 红', () => {
    const x = r({ candidates: [cand('apps/x/h.ts', FIXTURE_LEGACY_KEY)] })
    return keys(x).some((k) => k.startsWith('W3|apps/x/h.ts'))
  })
  check('C8 同时含 canonical 前两档却不全等 ⇒ W1p 红(变体比副本更危险)', () => {
    const x = r({ candidates: [cand('apps/x/v.ts', FIXTURE_VARIANT_PAIR)] })
    return keys(x).includes('W1p|apps/x/v.ts|array|TIERS')
  })
  check('C9 真子集(不含那对特征档)只报名不判红', () => {
    const x = r({ candidates: [cand('apps/x/s.ts', FIXTURE_SUBSET_ONLY)] })
    return x.violations.length === 0 && x.stats.subset.length === 1
  })
  check('C10 别的域的表落 other,整个不报名(门不咬邻域)', () => {
    const x = r({ candidates: [cand('apps/x/o.ts', FIXTURE_UNRELATED)] })
    return x.violations.length === 0 && x.stats.subset.length === 0 && x.stats.superset.length === 0
  })
  check('C11 A1 无兜底 Record 下标:本族目录进 advisories 且不冒红(默认档)', () => {
    const x = r({
      candidates: [
        cand(`${FAM}/types.ts`, FIXTURE_LEGACY_UNION),
        cand(`${FAM}/AlertTable.tsx`, FIXTURE_STYLE_UNGUARDED),
      ],
    })
    return (
      x.violations.every((v) => !v.key.startsWith('A1|')) &&
      x.advisories.some((v) => v.key.startsWith(`A1|${FAM}/AlertTable.tsx|LEVEL_STYLE`)) &&
      x.stats.familyDirs.includes(FAM)
    )
  })
  check('C12 A1 有兜底(?? / ?.)⇒ 完全不报(反向锁:判据不是恒报)', () => {
    const x = r({
      candidates: [
        cand(`${FAM}/types.ts`, FIXTURE_LEGACY_UNION),
        cand(`${FAM}/Ok.tsx`, FIXTURE_STYLE_GUARDED),
      ],
    })
    return x.advisories.every((v) => !v.key.startsWith(`A1|${FAM}/Ok.tsx`))
  })
  check('C13 A1 射程外只报数,绝不进本族目录集合', () => {
    const x = r({ candidates: [cand('apps/other/Page.tsx', FIXTURE_STYLE_UNGUARDED)] })
    return (
      x.advisories.length === 1 &&
      x.stats.styleOutOfFamily.length === 1 &&
      x.stats.styleInFamily.length === 0
    )
  })
  check('C14 默认值跑出状态集合 ⇒ W5 红(变异:文本必须真被改)', () => {
    const bad = FIXTURE_CANON.replace(`= 'aa'`, `= 'zz'`)
    const x = r({ candidates: null }, bad)
    return bad !== FIXTURE_CANON && keys(x).includes(`W5|${CANON.rel}|${CANON.defaultSymbol}`)
  })
  check('C15 canonical 类型退化成手抄联合 ⇒ W5 红', () => {
    const bad = FIXTURE_CANON.replace(
      `export type ${CANON.statusTypeSymbol} = (typeof ${CANON.statusArraySymbol})[number]`,
      `export type ${CANON.statusTypeSymbol} = 'aa' | 'bb' | 'cc'`,
    )
    const x = r({ candidates: null }, bad)
    return (
      bad !== FIXTURE_CANON &&
      keys(x).some((k) => k === `W5|${CANON.rel}|${CANON.statusTypeSymbol}`)
    )
  })
  check('C16 canonical 里再抄一份同值表 ⇒ W2b 红(豁免的兜底格)', () => {
    const bad = `${FIXTURE_CANON}\nexport const DUP = ['aa', 'bb', 'cc'] as const\n`
    const x = r({ candidates: null }, bad)
    return bad !== FIXTURE_CANON && keys(x).some((k) => k.startsWith(`W2b|${CANON.rel}|array|DUP`))
  })
  check('C17 canonical 取不到 ⇒ 未判定,不记绿也不冒红', () => {
    const x = decide({ canon: null, candidates: [cand('apps/x/a.ts', FIXTURE_COPY_ARRAY)] })
    return (
      x.statuses === null &&
      x.violations.length === 0 &&
      x.undetermined.some((u) => u.startsWith('W0'))
    )
  })
  check('C18 锚点符号改名 ⇒ 未判定而不是绿', () => {
    const x = decide({ canon: `export const RENAMED = ['aa', 'bb'] as const`, candidates: null })
    return x.statuses === null && x.undetermined.some((u) => u.includes(CANON.statusArraySymbol))
  })
  check('C19 候选枚举到 0 ⇒ 判死,不得记绿(§0.3)', () => {
    const x = r({ candidates: [] })
    return x.violations.length === 0 && x.undetermined.some((u) => u.startsWith('W1 候选枚举到 0'))
  })
  check('C20 候选取不到内容 ⇒ 逐条点名未判定', () => {
    const x = r({ candidates: [cand('apps/x/gone.ts', null)] })
    return (
      x.undetermined.some((u) => u.includes('apps/x/gone.ts')) && x.stats.undeterminedFiles === 1
    )
  })
  check('C21 本轮未提供候选 ⇒ note,不读成全仓无副本', () => {
    const x = r({ candidates: null })
    return x.undetermined.length === 0 && x.notes.some((n) => n.startsWith('W1/W3 本轮未提供'))
  })
  check('C22 注释里写旧值/档位不是使用(遮罩面判据)', () => {
    const src = `// 历史上有 '${LEGAL}' 与 'aa' 'bb' 'cc' —— 注释不是声明\n/* 块注释同样不算 ${LEGAL}: */\nexport const A = 1\n`
    const x = r({ candidates: [cand('apps/x/n.ts', src)] })
    return x.violations.length === 0 && x.stats.legacy.length === 0
  })
  check('C23 严重度同值副本只报名不判红(§12e 邻域同形)', () => {
    const x = r({ candidates: [cand('apps/x/lv.ts', "export const LOG_LEVELS = ['xx', 'yy']\n")] })
    return x.violations.length === 0 && x.stats.severityCopies.length === 1
  })
  check('C24 库侧 default 自写档位字面量 ⇒ W6 只报数(依赖方向阻塞,判红即恒红门)', () => {
    const src = `export const monitorAlerts = pgTable('monitor_alerts', { status: varchar('status').default('aa').notNull() })\n`
    const x = r({ candidates: [cand('packages/database/src/schema/monitor.ts', src)] })
    return (
      x.violations.length === 0 &&
      x.stats.landingDebt.length === 1 &&
      x.notes.some((n) => n.startsWith('W6'))
    )
  })
  check('C25 W6 射程收在本表声明上(别表的 default 不算本票的落地债)', () => {
    const otherTable = `export const comments = pgTable('comments', { severity: varchar('severity').default('aa').notNull() })\n`
    const x = r({
      candidates: [
        cand('packages/database/src/schema/comments.ts', otherTable),
        cand('apps/api/src/routes/monitor.ts', `export const s = make().default('aa')\n`),
      ],
    })
    return x.stats.landingDebt.length === 0
  })
  check('C26 A1 的 scripts/ 面只计数不点名(门自己的输出标签不属本族崩溃成因)', () => {
    const x = r({ candidates: [cand('scripts/check-some-gate.mjs', FIXTURE_STYLE_UNGUARDED)] })
    return (
      x.advisories.length === 0 &&
      x.stats.styleScriptsFace === 1 &&
      x.stats.styleOutOfFamily.length === 0
    )
  })
  check('C27 行号精度:本门自写的三把解析器必须指到被点名那一行(不是文件头)', () => {
    const src = [
      '// 头注一行',
      'export interface A { x: number }',
      '',
      `export interface Alert { status: 'dd' | '${LEGAL}' | 'cc' }`,
      'export const other = 1',
      'const st = LEVEL_STYLE[Row[0]]',
    ].join('\n')
    const legacy = legacyTokenSites(src).map((s) => s.line)
    const unions = inlineUnionSites(src).map((s) => s.line)
    const style = unguardedRecordIndexSites(src).map((s) => s.line)
    return (
      legacy.length === 1 &&
      legacy[0] === 4 &&
      unions.length === 1 &&
      unions[0] === 4 &&
      style.length === 1 &&
      style[0] === 6
    )
  })
  check(
    'C28 站点归一:type NAME = 联合 不被 declarationSites 与内联联合各报一遍(计数诚实性)',
    () => {
      const sites = vocabularySites("export type Narrow = 'bb' | 'cc'\n")
      return sites.length === 1 && sites[0].kind === 'union'
    },
  )
  check('C29 真子集 + 内联联合归一后计数仍为 1', () => {
    const x = r({ candidates: [cand('apps/x/s2.ts', "interface Q { st: 'bb' | 'cc' }\n")] })
    return x.violations.length === 0 && x.stats.subset.length === 1
  })
  check('C30 状态档数与票面不符 ⇒ note 不违规(改档归另票)', () => {
    const five = FIXTURE_CANON.replace("['aa', 'bb', 'cc']", "['aa', 'bb', 'cc', 'dd', 'ee']")
    const x = r({ candidates: null }, five)
    return (
      five !== FIXTURE_CANON &&
      x.notes.some((n) => n.includes('与票面「3 档」不符')) &&
      x.violations.filter((v) => v.key.startsWith('W5')).length === 0
    )
  })

  let ok = 0
  let fail = 0
  for (const c of cases) {
    let pass = false
    let err = null
    try {
      pass = c.fn() === true
    } catch (e) {
      err = e
    }
    if (pass) ok++
    else {
      fail++
      console.info(`   ✗ ${c.name}${err ? `:${err.message}` : '(判据返回非 true)'}`)
    }
  }
  console.info(`   --self-test:${ok} 通过 / ${fail} 失败(共 ${cases.length} 例,全部真判)`)
  return fail === 0 ? 0 : 1
}

function usage() {
  console.info(
    '用法: node scripts/check-monitor-vocabulary-single-source.mjs [--staged|--worktree] [--root <dir>] [--strict] [--json] [--all] [--self-test]\n' +
      '缺省判 HEAD blob;--staged 判索引 blob;--worktree 仅人工逃生舱(--root 只在该档有效);两旗同给 exit 2。\n' +
      '默认档违规只报数(逐条打印、exit 0);--strict 才判红(问责档;A1 只有本族目录那一档参与升严)。\n' +
      '本门刻意尚未接提交链(注册与文档点名由机主串行做);无行内豁免。',
  )
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    usage()
    process.exit(0)
  }
  if (argv.includes('--self-test')) process.exit(selfTest())
  const staged = argv.includes('--staged')
  const worktree = argv.includes('--worktree')
  const strict = argv.includes('--strict')
  const json = argv.includes('--json')
  const showAll = argv.includes('--all')
  const sel = selectFace({ staged, worktree, def: 'head' })
  if (sel.error) {
    console.error(`❌ ${sel.error}`)
    process.exit(2)
  }
  let root = ROOT
  const rootFlag = requireFlagValue(argv, '--root', { noun: '目录参数' })
  if (rootFlag.error) {
    console.error(`❌ ${rootFlag.error}`)
    process.exit(2)
  }
  if (rootFlag.present) {
    if (sel.face !== 'worktree') {
      console.error('❌ --root 只在 --worktree 档有效(换根却按 HEAD/索引读 = 双根分裂)')
      process.exit(2)
    }
    root = path.resolve(rootFlag.value)
  }
  let res
  try {
    res = runAudit({ root, face: sel.face })
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`⚠️ 无法判定(取材层/预筛派生):${e.message}`)
      process.exit(2)
    }
    throw e
  }
  const a1In = res.stats?.styleInFamily ?? []
  const a1Out = res.stats?.styleOutOfFamily ?? []
  const escalated = strict
    ? a1In.map((p) => ({ key: `A1|${p}`, text: `A1(--strict 升严)${p}` }))
    : []
  const red = [...res.violations, ...escalated]

  if (json) {
    console.info(
      JSON.stringify({ face: res.face, strict, ...res, escalatedInFamily: a1In.length }, null, 2),
    )
  } else {
    if (res.statuses)
      console.info(
        `   唯一真相源:${CANON.rel} 状态 ${res.statuses.length} 档[${res.statuses.join(',')}] / 严重度 ${res.severities?.length ?? 0} 档[${(res.severities || []).join(',')}] / 默认档 ${res.defaultStatus ?? '(未解析)'} | 候选 ${res.stats.candidateFiles} 文件`,
      )
    for (const n of res.notes) console.info(`   · ${n}`)
    if (res.stats?.legacy?.length)
      console.info(`   W3 旧值站点现读:${res.stats.legacy.join(' | ')}`)
    if (res.stats?.exact?.length) console.info(`   W1 同值副本现读:${res.stats.exact.join(' | ')}`)
    if (res.stats?.variant?.length)
      console.info(`   W1p 变体词表现读:${res.stats.variant.join(' | ')}`)
    if (res.stats?.landingDebt?.length)
      console.info(`   W6 落地债(只报数):${res.stats.landingDebt.join(' | ')}`)
    if (a1In.length || a1Out.length || res.stats?.styleScriptsFace)
      console.info(
        `   A1 无兜底 Record 下标:本族目录 ${a1In.length} 处${a1In.length ? `(${a1In.join(' | ')})` : ''} / 消费面射程外 ${a1Out.length} 处(只报数,跨域改造归另票) / scripts 面 ${res.stats?.styleScriptsFace ?? 0} 处(边界⑦:只计数不点名)`,
      )
    if (showAll && a1Out.length) console.info(`   A1 射程外清单:${a1Out.join(' | ')}`)
    if (res.inherited?.length)
      console.info(
        `   存量(HEAD 面已红的同一键,按棘轮只报名):${res.inherited.map((v) => v.key).join(' | ')}`,
      )
  }
  if (res.undetermined.length > 0) {
    console.error(
      `⚠️ 无法判定:${res.undetermined.length} 项 —— ${res.undetermined.join(' | ')}(面=${res.face};既不记绿也不冒红)`,
    )
    process.exit(2)
  }
  if (red.length === 0) {
    if (!json)
      console.info(
        `✅ 监控告警词表单一真相源对账通过(面=${res.face}${strict ? ' --strict' : ''}):canonical 派生自 as const 数组、默认值在血缘内、全仓无第二份同值/变体状态词表、无旧值当现役档位`,
      )
    process.exit(0)
  }
  if (!json) {
    console.info(
      strict
        ? `❌ 检出 ${red.length} 处词表分叉(面=${res.face},--strict 判红):`
        : `⚠️ 检出 ${red.length} 处词表分叉(面=${res.face};默认档只报数,--strict 判红):`,
    )
    for (const v of red) console.info(`   · ${v.text}`)
    console.info(
      `改法:状态/严重度档位唯一真相源 = ${CANON.rel}(${CANON.statusArraySymbol} / ${CANON.severityArraySymbol} as const),\n` +
        `     类型 = ${CANON.statusTypeSymbol} / ${CANON.severityTypeSymbol},库侧默认值 = ${CANON.defaultSymbol};\n` +
        `     别处一律 import 它或从其派生,不重述档位;Record 下标必须带 ??/?. 兜底出口。\n` +
        `     不得为消红放宽判据,也不得写行内豁免消账(§4:登记表必然腐烂)。`,
    )
  }
  process.exit(strict ? 1 : 0)
}

/** 只递镜像测试真的调用的符号(多导出的解析原语无人调用 = 会腐烂的第二份入口) */
export const __test__ = {
  CANON,
  LEGACY_STATUS_TOKENS,
  DOC_STATUS_COUNT,
  DOC_SEVERITY_COUNT,
  SELF_EXEMPT_RE,
  SCAN_EXTS,
  SCAN_PREFIXES,
  GENERATED_RE,
  decide,
  runAudit,
  grepCandidates,
  preScreenTokens,
  STYLE_GREP_PATTERNS,
  declarationSites,
  vocabularySites,
  inlineUnionSites,
  legacyTokenSites,
  unguardedRecordIndexSites,
  schemaDefaultLiteralSites,
  parseCanonicalArray,
  parseCanonicalDefault,
  classifyAgainst,
  mask,
  FIXTURE_CANON,
  FIXTURE_COPY_ARRAY,
  FIXTURE_COPY_INLINE,
  FIXTURE_LEGACY_UNION,
  FIXTURE_LEGACY_KEY,
  FIXTURE_VARIANT_PAIR,
  FIXTURE_SUBSET_ONLY,
  FIXTURE_UNRELATED,
  FIXTURE_STYLE_UNGUARDED,
  FIXTURE_STYLE_GUARDED,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
