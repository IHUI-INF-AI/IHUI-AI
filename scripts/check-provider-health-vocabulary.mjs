#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * provider 健康四档「单一真相源 + 不得自立第三份」对账门(台账 G-814416,2026-10-08 立)。
 *
 * 【接线状态:尚未接提交链】本门**没有** scripts/guardian-runner.mjs 注册条目,也没有应急
 * 跳过 env(既不在 runner 里,就不存在 skipEnv —— 如实登记,免得下一个人去找不存在的出路)。
 * 注册表由主会话单写,注册与 AGENTS.md 点名都不在本票交付范围内(守门 89 R2 会对"谎称已接线"
 * 逐次提交判红,所以这里只能自称未接)。人工跑法见文末 usage。
 *
 * 在修什么(现读取证,2026-10-08):
 *   provider 健康档位 unknown/healthy/degraded/down 是**落库列 + REST 字段 + 前端徽章**三重
 *   对外契约,而这一族今天没有任何提交链判据(现跑 `git grep -n -F check-provider-health HEAD
 *   -- scripts` 零命中)。守门 151(check-agent-status-vocabulary-parity)的射程只有代理任务态
 *   六档与回合终态封闭集,不含本域。2026-10-07 机主拍板「并表」(不扩 151 射程):值域收归
 *   apps/web/app/(main)/settings/llm/types-v2.ts 的 PROVIDER_HEALTH_STATUSES 一处,
 *   channels-api.ts 的 RelayKeyPoolHealthStatus 改为指向同一来源的本域别名。
 *   **本门守的就是这次并表不许再分叉** —— 并表是语义决策,腐烂是时间问题,没有门的登记表一定回退
 *   (§4 对 RN_ONLY_BRAND_KEYS 的教训同型)。
 *
 * 判据(输入按被审面现读,不 import、不执行被审实现;成员集合由 canonical 面解析得出,
 * 门内零手抄值域 —— 预筛因此天然是判据的严格超集,不靠人记得同步模式串):
 *   PV1 唯一真相源自洽:canonical 文件的 `PROVIDER_HEALTH_STATUSES = [...] as const` 解析得出
 *     成员集合;`ProviderHealthStatus` 必须是 `(typeof …)[number]` 派生形态。它自己退化成手抄
 *     字面量联合 ⇒ 红;锚点符号解析不到 ⇒ 未判定(不猜、不记绿)。
 *   PV1b 同一文件内不得有两份表:预筛把 canonical 自己排除在候选之外(不然它当然是第一份),
 *     所以 canonical 面**单独再判一遍** —— 该文件里除锚点符号外的任一声明形态与成员集合全等
 *     ⇒ 红。排除项必须自带兜底,否则"在真相源文件里再抄一份"正好从这道缝里漏掉。
 *   PV2 全仓不得出现第二份**同值**声明:任一非 canonical 文件,其代码面(注释不计)的声明形态
 *     —— const 数组字面量 / 字面量联合 `type` / `z.enum([...])` / TS `enum` —— 的字面量集合与
 *     成员集合**全等** ⇒ 红。档数多于 canonical 的**超集**是另一张表(不是同值副本),只报名;
 *     少于它的**真子集**同样只报名(见下方覆盖边界)。
 *   PV3 已并表的别名不得回退:channels-api.ts 的 RelayKeyPoolHealthStatus 必须是**指向
 *     ProviderHealthStatus 的类型别名**;改回手抄联合 ⇒ 红(这一型 PV2 抓不到 —— 该文件仍
 *     import canonical 类型,按"引用即合规"的豁免放行的正是守门 151 SV3 自己登记的那一格失明,
 *     本门对这个已知站点不留这一格),指向别的名字 ⇒ 红,别名整面缺席 ⇒ note(搬家不读成判过)。
 *
 * 三态绝不并桶:输入取不到 / 声明解析不到 / 候选枚举到 0 ⇒ 未判定 exit 2(既不冒红也绝不记绿)。
 * 定级:默认档违规只报数 exit 0,--strict 才判红 —— 与本次提交无关的恒红门唯一结局是逼人
 * --no-verify、连带废掉全部守门(AGENTS §12e)。口径同 77/83/151:全量判 **HEAD blob**、
 * --staged 判**索引 blob**(棘轮锚点 = 同一判据在 HEAD 面的结果 ⇒ 只有新增才红,存量只报名)、
 * --worktree 仅人工逃生舱、两旗同给 exit 2、取不到不回落。取数一律走 lib/face-reader(层兜住
 * git 绝对路径 / batch stdio / fork 风暴 / junction / maxBuffer),遮罩只引 lib/code-mask 那一份。
 *
 * 覆盖边界(如实登记,不得读成"已确认没有"):
 *   ① 判的是**同值副本**,不是"任何含这四档的表"。HEAD 现读的三型近邻:
 *      apps/api/src/services/relay-health-check-service.ts:28 `type HealthStatus =
 *      'healthy'|'degraded'|'down'` 是本域**缺 unknown 的真子集**(落库缺省档恰是 unknown,
 *      这一格由 PV2 的 subset note 报名,补齐第 4 档即翻红 —— 镜像测试 T4 用这行真文做了对照);
 *      packages/api-client/src/endpoints/llm.ts:237 的上游可用性表 7 档但**不含 unknown**,
 *      与四档既不全等也非超集 ⇒ 落 other 不报名(今天全仓没有超集活样本,超集通道由 T4 用同一
 *      行真文补 unknown 的前视形态钉住);packages/types 的 PillarHealthStatus 与
 *      orchestration-hub-panel 的 HealthStatus 用 `unhealthy` 而非 `down`(types-v2 头注明写这两张
 *      表**刻意不许并**,并了会同时改坏两个域的文案)—— 都不判红。改判需另票。
 *   ①b 同名不同域(本门判值不判名,故看不见):apps/web/src/lib/models-api.ts:274 与
 *      apps/ai-service/app/services/model_availability.py:265 各有一个叫 ProviderHealthStatus
 *      的类型,值域与四档无关 —— 名字撞上唯一真相源的导出名,按名寻路的人会取错表。本门不判红
 *      也不报名,已回报告给主会话定性(是否另立一票归机主)。
 *   ② 落库列 health_status 的**默认档**与值域的对账不在本门:它已由
 *      apps/web/tests/provider-health-badge.test.ts(schema 现读 default('unknown') 同档断言)钉住,
 *      再造一台判同一件事的门是第二把尺子(§22c)。
 *   ③ 只判 TS/JS 面:.py 侧 key_pool_selector.py 等写档位的字符串不在射程(跨语言对账归守门 151
 *      的域,机主已裁决不扩)。
 *   ④ 测试断言里的**枚举 oracle**(toEqual(['degraded','down','healthy','unknown']))不是声明形态
 *      (前面没有 `=`、不在 enum(…) 里)⇒ 不判红;它是独立的反向对照,判红会逼人删尺子。
 *      反向说:把同一份四档**赋值**给常量(哪怕该文件同时 import 了 canonical)即 PV2 红 ——
 *      本门刻意不设"引用即合规"的豁免,豁免清单必然腐烂(§4)。
 *   ⑤ --worktree 档的预筛用 `git grep` 不带 rev ⇒ 只搜**已跟踪**文件,新建的未跟踪文件看不见
 *      (那一档本来就只是人工排查逃生舱,不得作为提交门禁;HEAD/--staged 两面都看得见新文件,
 *      因为提交前它必然已进索引)。镜像测试 T12 把"清单面 = 判定面"钉住。
 *   ⑥ 判的是**静态声明面**,不执行被审实现:把四档改成运行时算出来(如从接口回包收集档位)
 *      这一格没有静态判据,归运行时面(apps/web/tests/provider-health-badge.test.ts 的封闭档断言)。
 */

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { maskComments } from './lib/code-mask.mjs'
import { Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** PV1 锚点:唯一真相源的路径与两个符号名。改名必须与被审面**同笔**,否则判未判定而不是静默绿。 */
export const CANON = {
  rel: 'apps/web/app/(main)/settings/llm/types-v2.ts',
  arraySymbol: 'PROVIDER_HEALTH_STATUSES',
  typeSymbol: 'ProviderHealthStatus',
}

/** PV3 锚点:2026-10-07 并表落地的第二域别名(它必须一直指向 canonical 类型)。 */
export const ALIAS = {
  rel: 'apps/web/app/(main)/models/channels/channels-api.ts',
  typeSymbol: 'RelayKeyPoolHealthStatus',
  pointsTo: CANON.typeSymbol,
}

/** 票面档位「四档」只是**说明性**期望:不符就 note,不当尺子用(尺子永远来自被审面)。 */
export const DOC_MEMBER_COUNT = 4

/** 扫描面(目录前缀 + 扩展名二者必须同时是判据的超集 —— 守门 77/102 的"预筛漏形态=门全盲"同型) */
const SCAN_PREFIXES = ['apps/', 'packages/', 'scripts/']
const SCAN_EXTS = ['.ts', '.tsx', '.js', '.mjs']
/**
 * 刻意**不**排除 tests/:第二份声明落在测试目录一样会让生产面腐烂。
 * (与守门 151 SV3 的差别在此,差异是判据的一部分,不是漏写。)
 */
const SKIP_RE = /(^|\/)(node_modules|dist|\.next|\.nuxt|coverage|\.venv|build)\//

/**
 * 本门与它的镜像测试必然逐字写出四档成员(夹具不写就没法证明判据有牙),按路径前缀自豁免 ——
 * 与守门 79/102/151 同一护栏形态;不自豁免的话门会把自己判成第二份抄本,而落地那枚提交恰好是
 * **新增**,棘轮救不了它(AGENTS §"门不得读自己")。
 */
export const SELF_EXEMPT_RE = /check-provider-health-vocabulary/

// ---- 遮噪与取材:遮罩实现只有一份(code-mask),本门不得留第二份 ----

/** 等长遮罩:抹注释、**保留字符串**(要认的成员字面量就住在字符串里,抹串等于没收尺子)。 */
export function mask(src) {
  return maskComments(String(src).replace(/\r\n/g, '\n'))
}

/** 逐行"是否为代码行"(遮罩后仍有非空白字符即为代码行)。 */
export function codeFlags(maskedSrc) {
  return maskedSrc.split('\n').map((l) => l.trim() !== '')
}

/** 三种引号的字面量体(与 code-mask 的字符串分词同形,只在已遮注释的面上取)。 */
const LIT_RE = /'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`/g

/** 从 openIdx(指向开括号)起按括号配平找闭括号,**只用遮罩面计数**(注释里的括号不再干扰)。 */
export function balanceRange(masked, openIdx, open = '[', close = ']') {
  let depth = 0
  for (let i = openIdx; i < masked.length; i++) {
    const ch = masked[i]
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return { start: openIdx, end: i }
    }
  }
  return null
}

/** 文本内的去重字面量(保序)。 */
export function literalsIn(text) {
  const out = []
  for (const m of text.matchAll(LIT_RE)) {
    const v = m[1] ?? m[2] ?? m[3]
    if (v !== undefined && !out.includes(v)) out.push(v)
  }
  return out
}

const lineIndexOf = (src, idx) => (src.slice(0, idx).match(/\n/g) || []).length

/**
 * 取 `type NAME …=` 的右值文本。仓内多数文件不带分号,所以不能按 `[^;]*` 吞到下一个声明,
 * 只能按"续行以 `|` 开头 / 上一段以 `|` 结尾"这条联合语法的真实边界收口(否则字面量集合被
 * 下一个 type 污染,判据方向就变成误伤)。
 */
export function typeRhs(src, typeName) {
  const re = new RegExp(
    `^[ \\t]*(?:export[ \\t]+)?type[ \\t]+${typeName}[ \\t]*(?:<[^>\\n]*>)?[ \\t]*=[ \\t]*`,
    'm',
  )
  const m = re.exec(src)
  if (!m) return null
  const lines = src.split('\n')
  const startLine = lineIndexOf(src, m.index)
  const col = m.index + m[0].length - (src.lastIndexOf('\n', m.index - 1) + 1)
  let first = lines[startLine].slice(col)
  const semi = first.indexOf(';')
  if (semi >= 0) first = first.slice(0, semi)
  const chunks = [first]
  let i = startLine
  for (;;) {
    const prev = chunks[chunks.length - 1].trim()
    const next = lines[i + 1]
    if (next === undefined) break
    const t = next.trim()
    if (t === '') break
    // 续行三种真形:`| X` 起头、上一段以 `|` 收尾、以及 `type X =` 后**换行再列档位**
    // (实测 packages/api-client/src/endpoints/llm.ts:237-238 就是最后这一形;漏了它,右值读成
    // 空 ⇒ 档位集合为空 ⇒ 这一格整个失明,而失明长得和通过一模一样)
    if (t.startsWith('|') || prev.endsWith('|') || prev === '') {
      const cut = t.indexOf(';')
      chunks.push(cut >= 0 ? next.slice(0, next.indexOf(';')) : next)
      i++
      continue
    }
    break
  }
  return { text: chunks.join('\n'), line: startLine + 1 }
}

/** 右值形态:derived=(typeof X)[number] / alias=指向某类型名 / literal=手抄字面量联合 / other。 */
export function classifyTypeRhs(rhs) {
  if (!rhs) return { kind: 'absent', members: [], line: 0 }
  const t = rhs.text.trim()
  const derived = /^\(\s*typeof\s+([A-Za-z_$][\w$]*)\s*\)\s*\[number\]$/.exec(t)
  if (derived) return { kind: 'derived', from: derived[1], members: [], line: rhs.line }
  const bare = /^[A-Za-z_$][\w$]*$/.exec(t)
  if (bare) return { kind: 'alias', from: bare[0], members: [], line: rhs.line }
  return { kind: 'literal', members: literalsIn(t), line: rhs.line }
}

/**
 * 一个文件里的**声明形态**站点(赋值常量数组 / 字面量联合 / z.enum([...]) / TS enum)。
 * 只认声明形态,不认"某处出现了这四个词" —— 后者会把徽章配色表、断言 oracle、排序表全数成红。
 */
export function declarationSites(src) {
  const masked = mask(src)
  const sites = []
  // S1: const NAME[: T] = [ … ](as const 与否都算:一份会腐烂的表不因为你没写 as const 就不是表)
  for (const m of masked.matchAll(
    /(?:^|[\s;}])(?:export[ \t]+)?(?:const|let|var)[ \t]+([A-Za-z_$][\w$]*)[ \t]*(?::[^=\n]*)?[ \t]*=[ \t]*\[/g,
  )) {
    // 开括号取**匹配末尾**:`: readonly string[]` 这类类型标注里也有 `[`,用 indexOf 会从标注
    // 里那个空括号开始配平 ⇒ 成员集合读成空,P13 夹具第一轮就是被这一格放过的
    const open = m.index + m[0].length - 1
    const r = balanceRange(masked, open)
    if (!r) continue
    sites.push({
      kind: 'array',
      name: m[1],
      members: literalsIn(masked.slice(open + 1, r.end)),
      line: lineIndexOf(masked, m.index) + 1,
    })
  }
  // S2: type NAME = …(字面量联合)
  for (const m of masked.matchAll(
    /(?:^|\n)[ \t]*(?:export[ \t]+)?type[ \t]+([A-Za-z_$][\w$]*)[ \t]*(?:<[^>\n]*>)?[ \t]*=/g,
  )) {
    const name = m[1]
    const rhs = typeRhs(masked, name)
    if (!rhs) continue
    sites.push({
      kind: 'union',
      name,
      members: literalsIn(rhs.text),
      line: rhs.line,
    })
  }
  // S3: z.enum([ … ]) / foo.enum( … )(校验器面:REST 入参自己立一张表就是这一型)
  for (const m of masked.matchAll(/[.\s]([A-Za-z_$][\w$]*)[ \t]*\(/g)) {
    if (m[1] !== 'enum' && m[1] !== 'nativeEnum') continue
    const open = m.index + m[0].length - 1
    const r = balanceRange(masked, open, '(', ')')
    if (!r) continue
    sites.push({
      kind: 'zodEnum',
      name: m[1],
      members: literalsIn(masked.slice(open + 1, r.end)),
      line: lineIndexOf(masked, m.index) + 1,
    })
  }
  // S4: enum NAME { … }(字符串枚举的值档)
  for (const m of masked.matchAll(
    /[ \t]enum[ \t]+([A-Za-z_$][\w$]*)[ \t]*(?:implements[^{]*)?\{/g,
  )) {
    const open = masked.indexOf('{', m.index)
    const r = balanceRange(masked, open, '{', '}')
    if (!r) continue
    sites.push({
      kind: 'tsEnum',
      name: m[1],
      members: literalsIn(masked.slice(open + 1, r.end)),
      line: lineIndexOf(masked, m.index) + 1,
    })
  }
  return sites
}

/** 与 canonical 成员集合的关系:全等(=第二份同值表)/ 超集 / 真子集 / 无关。 */
export function classifyAgainst(siteMembers, members) {
  const set = [...new Set(siteMembers)]
  if (set.length === 0) return 'none'
  const hit = set.filter((v) => members.includes(v))
  const extras = set.filter((v) => !members.includes(v))
  if (extras.length === 0 && hit.length === members.length) return 'exact'
  if (extras.length > 0 && hit.length === members.length) return 'superset'
  if (extras.length === 0 && hit.length >= 2) return 'subset'
  return 'other'
}

/** canonical 的数组声明:解析不出成员 ⇒ 交调用方判未判定(不猜一份值域去扫全仓)。 */
export function parseCanonicalMembers(src) {
  const re = new RegExp(
    `(?:export[ \\t]+)?(?:const|let|var)[ \\t]+${CANON.arraySymbol}[ \\t]*(?::[^=\\n]*)?[ \\t]*=[ \\t]*\\[`,
  )
  const m = re.exec(src)
  if (!m) return null
  const open = src.indexOf('[', m.index)
  const r = balanceRange(src, open)
  if (!r) return null
  const members = literalsIn(src.slice(open + 1, r.end))
  if (members.length < 2) return null
  return { members, asConst: /as[ \t]+const/.test(src.slice(r.end + 1, r.end + 40)) }
}

function violation(key, text) {
  return { key, text }
}

/**
 * 纯判据(全部输入是已读好的文本;candidates=null 表示"本轮不判这一维",[] 表示"枚举跑了而
 * 一个都没有"= 判死)。镜像测试只调它,不重写任何解析规则(§22c)。
 */
export function decide({ canon, alias, candidates, memberCount = DOC_MEMBER_COUNT }) {
  const violations = []
  const notes = []
  const undetermined = []
  if (typeof canon !== 'string' || canon.length === 0) {
    undetermined.push(`PV1 canonical 面取不到(${CANON.rel})`)
    return { violations, notes, undetermined, members: null, stats: null }
  }
  const parsed = parseCanonicalMembers(mask(canon))
  if (!parsed) {
    undetermined.push(`PV1 解析不到 ${CANON.arraySymbol} 的数组字面量(锚点漂移?不猜值域)`)
    return { violations, notes, undetermined, members: null, stats: null }
  }
  const members = parsed.members
  // PV1/PV3 也在**遮注释**的面上判:注释里写一份"改回手抄联合"的示例不得被读成现役声明
  // (守门 151 SV4 记过同型:判据开始咬自己的散文)。mask() 顺带把 CRLF 归一,
  // 于是 typeRhs 的"续行以 | 开头"边界不会被行尾 \r 骗住。
  const canonMasked = mask(canon)
  if (!parsed.asConst)
    notes.push(
      `PV1 ${CANON.arraySymbol} 未标 as const ⇒ 派生联合退化为 string[](档位不再封闭,呈现面会放行任意上游串)`,
    )
  if (members.length !== memberCount)
    notes.push(
      `PV1 现读档位数为 ${members.length},与票面「四档」不符(改档 = 动落库/REST/徽章三重对外契约,须另票并同批改五语言词表)`,
    )

  // ---- PV1:唯一真相源自己必须是派生形态 ----
  const canonType = classifyTypeRhs(typeRhs(canonMasked, CANON.typeSymbol))
  if (canonType.kind === 'absent') {
    undetermined.push(`PV1 解析不到类型声明:${CANON.typeSymbol}(锚点与被审面必须同笔)`)
  } else if (canonType.kind !== 'derived' || canonType.from !== CANON.arraySymbol) {
    violations.push(
      violation(
        `PV1|${CANON.rel}|${CANON.typeSymbol}`,
        `PV1 唯一真相源自己不是派生形态:${CANON.rel}:${canonType.line} ${CANON.typeSymbol} 现为 ${canonType.kind}${canonType.members.length > 0 ? ` [${canonType.members.join(',')}]` : ''},应写成 (typeof ${CANON.arraySymbol})[number]`,
      ),
    )
  }

  // ---- PV1b:canonical 文件自己也不许有第二份(grepCandidates 把 canonical 排除在候选之外,
  // 不补这一格的话"同一文件里再抄一份表"正好从这道缝里漏掉 —— 排除项必须自带兜底) ----
  for (const s of declarationSites(canon)) {
    if (s.name === CANON.arraySymbol || s.name === CANON.typeSymbol) continue
    if (classifyAgainst(s.members, members) !== 'exact') continue
    violations.push(
      violation(
        `PV1b|${CANON.rel}|${s.kind}|${s.name}`,
        `PV1b 唯一真相源文件里出现第二份同值表:${CANON.rel}:${s.line} ${s.kind} ${s.name} = [${s.members.join(',')}],与同文件 ${CANON.arraySymbol} 重复 ⇒ 同一档位在一份文件里就有两处答案`,
      ),
    )
  }

  // ---- PV3:已并表的别名不得回退 ----
  let aliasState = 'absent'
  if (typeof alias !== 'string' || alias.length === 0) {
    notes.push(`PV3 ${ALIAS.rel} 本轮未提供 ⇒ 不判(不代表别名已消失;全量/--staged 档会判)`)
  } else {
    const a = classifyTypeRhs(typeRhs(mask(alias), ALIAS.typeSymbol))
    aliasState = a.kind
    if (a.kind === 'absent') {
      notes.push(
        `PV3 现读 ${ALIAS.rel} 没有 ${ALIAS.typeSymbol} 声明(搬家/删除 ⇒ 这一维不判,不得读成已对账)`,
      )
    } else if (a.kind === 'literal') {
      violations.push(
        violation(
          `PV3|${ALIAS.rel}|${ALIAS.typeSymbol}`,
          `PV3 并表回退:${ALIAS.rel}:${a.line} ${ALIAS.typeSymbol} 又写成手抄字面量联合 [${a.members.join(',')}],必须 = ${ALIAS.pointsTo}(G-814416 的 2026-10-07 裁决就是并为一份)`,
        ),
      )
    } else if (a.kind === 'alias' && a.from !== ALIAS.pointsTo) {
      violations.push(
        violation(
          `PV3|${ALIAS.rel}|${a.from}`,
          `PV3 别名指向别处:${ALIAS.rel}:${a.line} ${ALIAS.typeSymbol} = ${a.from},而唯一真相源类型是 ${ALIAS.pointsTo}`,
        ),
      )
    } else if (a.kind === 'derived') {
      violations.push(
        violation(
          `PV3|${ALIAS.rel}|${ALIAS.typeSymbol}`,
          `PV3 别名不再同源:${ALIAS.rel}:${a.line} ${ALIAS.typeSymbol} 由 ${a.from} 派生,应直接 = ${ALIAS.pointsTo}`,
        ),
      )
    }
  }

  // ---- PV2:全仓第二份同值声明 ----
  const stats = { candidateFiles: 0, superset: [], subset: [], undeterminedFiles: 0 }
  if (candidates === null || candidates === undefined) {
    notes.push('PV2 本轮未提供候选清单(仅取 canonical 成员集合,不代表全仓无第二份)')
    return {
      violations,
      notes,
      undetermined,
      members,
      stats: { ...stats, candidateFiles: -1 },
      aliasState,
    }
  }
  if (candidates.length === 0) {
    undetermined.push('PV2 候选枚举到 0 个文件 ⇒ 判死(扫描面/预筛漂了,不得当成"没有第二份")')
    return { violations, notes, undetermined, members, stats, aliasState }
  }
  stats.candidateFiles = candidates.length
  for (const c of candidates) {
    if (typeof c.src !== 'string' || c.src.length === 0) {
      stats.undeterminedFiles += 1
      undetermined.push(`PV2 候选取不到内容:${c.path}`)
      continue
    }
    for (const s of declarationSites(c.src)) {
      // 别名站点由 PV3 独占归因(它对这一处更严:引用 canonical 也照判),同一处分叉不报两遍
      if (c.path === ALIAS.rel && s.name === ALIAS.typeSymbol) continue
      const rel = classifyAgainst(s.members, members)
      const key = `PV2|${c.path}|${s.kind}|${s.name}`
      if (rel === 'exact') {
        violations.push(
          violation(
            key,
            `PV2 第二份同值声明:${c.path}:${s.line} ${s.kind} ${s.name} = [${s.members.join(',')}],与唯一真相源 ${CANON.rel} 的 ${CANON.arraySymbol} 逐字同值 ⇒ 改一侧忘另一侧时两侧都不红。改法:import ${CANON.typeSymbol}/${CANON.arraySymbol} 或从其派生,不要重述档位`,
          ),
        )
      } else if (rel === 'superset') {
        stats.superset.push(`${c.path}:${s.line} ${s.kind} ${s.name}[${s.members.join(',')}]`)
      } else if (rel === 'subset') {
        stats.subset.push(`${c.path}:${s.line} ${s.kind} ${s.name}[${s.members.join(',')}]`)
      }
    }
  }
  if (stats.superset.length > 0)
    notes.push(
      `PV2 超集(含全部档位又更多档)按另一张表只报名,不判红(${stats.superset.length} 处):${stats.superset.join(' | ')}`,
    )
  if (stats.subset.length > 0)
    notes.push(
      `PV2 真子集(本族档位的残缺表)只报名,不判红(${stats.subset.length} 处);补齐到全档即翻红:${stats.subset.join(' | ')}`,
    )
  return { violations, notes, undetermined, members, stats, aliasState }
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
 * 预筛必须与判定**同面同轮**:清单来自 HEAD 而内容来自磁盘,等于拿一把基准错位的尺子
 * (守门 70/83 记过同型)。三档各有取法:
 *   head ⇒ `git grep … HEAD`;staged ⇒ `git grep --cached …`;worktree ⇒ **不带 rev**
 *   (git grep 无 rev 就是搜工作树里已跟踪的文件)。
 * 已知边界(如实登记,不得读成"全面覆盖"):--worktree 档看不见**未跟踪**文件 —— 那一档本来
 * 就只是人工排查的逃生舱,不得作为提交门禁。
 */
function grepCandidates(root, face, members) {
  const args = ['grep', '-l', '-I', '--no-color']
  for (const m of members) args.push('-e', `'${m}'`, '-e', `"${m}"`, '-e', `\`${m}\``)
  if (face === 'staged') args.push('--cached')
  else if (face !== 'worktree') args.push('HEAD')
  args.push('--', 'apps', 'packages', 'scripts')
  let out
  try {
    out = gitRaw(args, root)
  } catch (e) {
    if (e instanceof Undetermined && e.status === 1) return []
    throw new Undetermined(`PV2 预筛派生失败(${face} 面):${e.message}`)
  }
  return out
    .split('\n')
    .map((l) => l.replace(/^HEAD:/, '').trim())
    .filter(
      (p) =>
        p.length > 0 &&
        !SKIP_RE.test(p) &&
        !SELF_EXEMPT_RE.test(p) &&
        p !== CANON.rel &&
        SCAN_PREFIXES.some((d) => p.startsWith(d)) &&
        SCAN_EXTS.some((e) => p.endsWith(e)),
    )
}

export function runAudit({ root = ROOT, face } = {}) {
  const sel = face
    ? { face, error: null }
    : selectFace({ staged: false, worktree: false, def: 'head' })
  if (sel.error) throw new Undetermined(sel.error)
  const fixed = readContents(root, sel.face, [CANON.rel, ALIAS.rel])
  // 预读轮**不给 candidates**(空数组 = 枚举跑完一个都没有 = 判死,不是"这一轮不判该维")
  const pre = decide({ canon: fixed[CANON.rel], alias: fixed[ALIAS.rel], candidates: null })
  if (!pre.members) return { face: sel.face, ...pre, fileCount: 0, inherited: [] }
  const candPaths = grepCandidates(root, sel.face, pre.members)
  const candContents = readContents(root, sel.face, candPaths)
  const candidates = candPaths.map((p) => ({ path: p, src: candContents[p] }))
  const res = decide({ canon: fixed[CANON.rel], alias: fixed[ALIAS.rel], candidates })
  // --staged 的棘轮锚点 = 同一判据在 HEAD 面的键集(§12e:与本次提交无关的恒红只会逼人跳门)。
  // 键落在 (维|文件|形态|符号) 上而非文案上:换个措辞不清账,换个真分叉必红。
  let inherited = []
  if (sel.face === 'staged') {
    const headFixed = readContents(root, 'head', [CANON.rel, ALIAS.rel])
    const headPaths = grepCandidates(root, 'head', pre.members)
    const headContents = readContents(root, 'head', headPaths)
    const headRes = decide({
      canon: headFixed[CANON.rel],
      alias: headFixed[ALIAS.rel],
      candidates: headPaths.map((p) => ({ path: p, src: headContents[p] })),
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
      `PV1/PV3 本档不判"新增"的原因:被审面(${sel.face})就是锚点面 ⇒ 拿不到"新引入"这一维。要问责新增副本,跑 --staged。`,
    )
  return {
    face: sel.face,
    ...res,
    fileCount: 2 + candidates.length,
    inherited,
  }
}

// ---- --self-test(构造面正反成对;变异一律先证明文本真被改,再断言判据红)----
// 夹具档位名全是**合成词**(aa/bb/cc/dd),与真仓四档无交集:门体与测试文件里都不出现真成员
// 字面量,免得"门读自己"把前提自证洗成恒真(AGENTS §"门不得读自己")。

export const FIXTURE_CANON = `
export const PROVIDER_HEALTH_STATUSES = ['aa', 'bb', 'cc', 'dd'] as const
export type ProviderHealthStatus = (typeof PROVIDER_HEALTH_STATUSES)[number]
`
const FIXTURE_ALIAS_OK = `
import type { ProviderHealthStatus } from '../../settings/llm/types-v2'
export type RelayKeyPoolHealthStatus = ProviderHealthStatus
export interface Item { healthStatus: RelayKeyPoolHealthStatus }
`
const FIXTURE_ALIAS_LITERAL = `
import type { ProviderHealthStatus } from '../../settings/llm/types-v2'
export type RelayKeyPoolHealthStatus = 'aa' | 'bb' | 'cc' | 'dd'
`
const FIXTURE_ALIAS_DRIFT = `
export type RelayKeyPoolHealthStatus = SomeOtherHealthType
`
const FIXTURE_ALIAS_DERIVED = `
export type RelayKeyPoolHealthStatus = (typeof SOMETHING_ELSE)[number]
`
const FIXTURE_COPY_ARRAY = `
export const COLS = ['aa', 'bb', 'cc', 'dd']
`
const FIXTURE_COPY_CONST_WITH_IMPORT = `
import { PROVIDER_HEALTH_STATUSES } from '@ihui/types'
export const HEALTH_ORDER: readonly string[] = ['aa', 'bb', 'cc', 'dd']
void PROVIDER_HEALTH_STATUSES
`
const FIXTURE_COPY_UNION = `
type HealthTier = 'dd' | 'cc' | 'aa' | 'bb'
export const pick = (t: HealthTier) => t
`
const FIXTURE_COPY_ZOD = `
import { z } from 'zod'
export const HealthSchema = z.enum(['aa', 'bb', 'cc', 'dd'])
`
const FIXTURE_COPY_TSENUM = `
export enum Health {
  A = 'aa',
  B = 'bb',
  C = 'cc',
  D = 'dd',
}
`
const FIXTURE_COPY_COMMENTED = `
// 逐条列出只是说明:'aa' 'bb' 'cc' 'dd' —— 注释不是声明
/* 块注释里同样不算 'aa' 'bb' 'cc' 'dd' */
export const A = 1
`
const FIXTURE_ORACLE = `
import { PROVIDER_HEALTH_STATUSES } from '../types-v2'
expect([...PROVIDER_HEALTH_STATUSES].sort()).toEqual(['cc', 'dd', 'aa', 'bb'])
expect(PROVIDER_HEALTH_STATUSES).toContain('aa')
`
const FIXTURE_SUPERSET = `
export type UpstreamStatus = 'aa' | 'bb' | 'cc' | 'dd' | 'ee' | 'ff'
`
const FIXTURE_SUBSET = `
export type HealthStatus = 'aa' | 'bb' | 'cc'
`
const FIXTURE_OTHER_DOMAIN = `
export type PillarHealthStatus = 'aa' | 'bb' | 'ee'
`
const FIXTURE_BADGE_MAP = `
type RelayKeyPoolHealthStatus = 'aa' | 'bb' | 'cc' | 'dd'
const HEALTH_BADGE: Record<RelayKeyPoolHealthStatus, string> = {
  aa: 'x',
  bb: 'y',
  cc: 'z',
  dd: 'w',
}
`

function cand(path, src) {
  return { path, src }
}

function runFixtureCase(base, over) {
  return decide({ canon: base ?? FIXTURE_CANON, alias: over.alias, candidates: over.candidates })
}

export function selfTest() {
  const cases = []
  const check = (name, fn) => cases.push({ name, fn })
  const keys = (r) => r.violations.map((v) => v.key)
  const M = ['aa', 'bb', 'cc', 'dd']

  check('P1 canonical 现读成员集合 = 4 档合成词', () => {
    const r = runFixtureCase(FIXTURE_CANON, { alias: FIXTURE_ALIAS_OK, candidates: null })
    return !!r.members && r.members.join(',') === M.join(',') && r.undetermined.length === 0
  })
  check('P2 合规面(派生 + 别名 + 无第二份)零违规', () => {
    const r = runFixtureCase(FIXTURE_CANON, {
      alias: FIXTURE_ALIAS_OK,
      candidates: [cand('apps/x/a.ts', FIXTURE_OTHER_DOMAIN), cand('apps/x/b.ts', FIXTURE_ORACLE)],
    })
    return r.violations.length === 0 && r.undetermined.length === 0
  })
  check('P3 canonical 自己退化成手抄联合 ⇒ PV1 红', () => {
    const bad = FIXTURE_CANON.replace(
      'export type ProviderHealthStatus = (typeof PROVIDER_HEALTH_STATUSES)[number]',
      "export type ProviderHealthStatus = 'aa' | 'bb' | 'cc' | 'dd'",
    )
    const r = runFixtureCase(bad, { alias: FIXTURE_ALIAS_OK, candidates: null })
    return (
      bad !== FIXTURE_CANON &&
      keys(r).some((k) => k.startsWith('PV1|')) &&
      r.undetermined.length === 0
    )
  })
  check('P4 canonical 符号改名(锚点漂移)⇒ 未判定而不是绿', () => {
    const r = runFixtureCase("export const RENAMED = ['aa', 'bb'] as const", {
      alias: FIXTURE_ALIAS_OK,
      candidates: [cand('apps/x/a.ts', 'export const A = 1')],
    })
    return r.undetermined.length > 0 && r.members === null && r.violations.length === 0
  })
  check('P5 别名手抄回退 ⇒ PV3 红(且 PV2 的"引用即合规"这一格不留)', () => {
    const r = runFixtureCase(FIXTURE_CANON, { alias: FIXTURE_ALIAS_LITERAL, candidates: null })
    return keys(r).some((k) => k === `PV3|${ALIAS.rel}|${ALIAS.typeSymbol}`)
  })
  check('P6 别名指向别的类型 ⇒ PV3 红', () => {
    const r = runFixtureCase(FIXTURE_CANON, { alias: FIXTURE_ALIAS_DRIFT, candidates: null })
    return keys(r).some((k) => k === `PV3|${ALIAS.rel}|SomeOtherHealthType`)
  })
  check('P7 别名改成从别处派生 ⇒ PV3 红', () => {
    const r = runFixtureCase(FIXTURE_CANON, { alias: FIXTURE_ALIAS_DERIVED, candidates: null })
    return keys(r).some((k) => k.startsWith('PV3|'))
  })
  check('P8 缺席的别名面 ⇒ note,不判也不装判过', () => {
    const r = runFixtureCase(FIXTURE_CANON, {
      alias: 'export interface Other {}\n',
      candidates: null,
    })
    return r.violations.length === 0 && r.notes.some((n) => n.startsWith('PV3 现读'))
  })
  check('P9 第二份 const 数组 ⇒ PV2 点名文件与符号', () => {
    const r = runFixtureCase(FIXTURE_CANON, {
      alias: FIXTURE_ALIAS_OK,
      candidates: [cand('apps/x/copy.tsx', FIXTURE_COPY_ARRAY)],
    })
    return keys(r).some((k) => k === 'PV2|apps/x/copy.tsx|array|COLS')
  })
  check('P10 第二份字面量联合 ⇒ PV2 红', () => {
    const r = runFixtureCase(FIXTURE_CANON, {
      alias: FIXTURE_ALIAS_OK,
      candidates: [cand('packages/y/t.ts', FIXTURE_COPY_UNION)],
    })
    return keys(r).some((k) => k === 'PV2|packages/y/t.ts|union|HealthTier')
  })
  check('P11 第二份 z.enum ⇒ PV2 红(REST 入参自己立表这一型)', () => {
    const r = runFixtureCase(FIXTURE_CANON, {
      alias: FIXTURE_ALIAS_OK,
      candidates: [cand('apps/api/src/z.ts', FIXTURE_COPY_ZOD)],
    })
    return keys(r).some((k) => k === 'PV2|apps/api/src/z.ts|zodEnum|enum')
  })
  check('P12 第二份 TS enum ⇒ PV2 红', () => {
    const r = runFixtureCase(FIXTURE_CANON, {
      alias: FIXTURE_ALIAS_OK,
      candidates: [cand('packages/y/e.ts', FIXTURE_COPY_TSENUM)],
    })
    return keys(r).some((k) => k === 'PV2|packages/y/e.ts|tsEnum|Health')
  })
  check('P13 反向锁:引用 canonical 却另抄一份仍判红(不设"引用即合规"豁免)', () => {
    const r = runFixtureCase(FIXTURE_CANON, {
      alias: FIXTURE_ALIAS_OK,
      candidates: [cand('apps/x/ref.ts', FIXTURE_COPY_CONST_WITH_IMPORT)],
    })
    return keys(r).some((k) => k === 'PV2|apps/x/ref.ts|array|HEALTH_ORDER')
  })
  check('P14 注释里的档位不是声明', () => {
    const r = runFixtureCase(FIXTURE_CANON, {
      alias: FIXTURE_ALIAS_OK,
      candidates: [cand('apps/x/n.ts', FIXTURE_COPY_COMMENTED)],
    })
    return r.violations.length === 0 && r.stats.subset.length === 0
  })
  check('P15 断言 oracle(toEqual 数组)不是声明形态 ⇒ 不判红', () => {
    const r = runFixtureCase(FIXTURE_CANON, {
      alias: FIXTURE_ALIAS_OK,
      candidates: [cand('apps/web/tests/o.ts', FIXTURE_ORACLE)],
    })
    return r.violations.length === 0
  })
  check('P16 超集只报名(另一张表,不改坏两个域)', () => {
    const r = runFixtureCase(FIXTURE_CANON, {
      alias: FIXTURE_ALIAS_OK,
      candidates: [cand('packages/api-client/s.ts', FIXTURE_SUPERSET)],
    })
    return r.violations.length === 0 && r.stats.superset.length === 1
  })
  check('P17 真子集只报名,补齐到全档即翻红(变异对照)', () => {
    const sub = runFixtureCase(FIXTURE_CANON, {
      alias: FIXTURE_ALIAS_OK,
      candidates: [cand('apps/api/svc/h.ts', FIXTURE_SUBSET)],
    })
    const mutated = FIXTURE_SUBSET.replace("'cc'", "'cc', 'dd'")
    const full = runFixtureCase(FIXTURE_CANON, {
      alias: FIXTURE_ALIAS_OK,
      candidates: [cand('apps/api/svc/h.ts', mutated)],
    })
    return (
      mutated !== FIXTURE_SUBSET &&
      sub.violations.length === 0 &&
      sub.stats.subset.length === 1 &&
      full.violations.some((v) => v.key === 'PV2|apps/api/svc/h.ts|union|HealthStatus')
    )
  })
  check('P18 徽章配色表(键为裸标识符的 Record)不是字面量表 ⇒ 不判红', () => {
    const r = runFixtureCase(FIXTURE_CANON, {
      alias: FIXTURE_ALIAS_OK,
      candidates: [
        cand(
          'apps/web/p/PageClient.tsx',
          FIXTURE_BADGE_MAP.replace(
            "type RelayKeyPoolHealthStatus = 'aa' | 'bb' | 'cc' | 'dd'",
            'type RelayKeyPoolHealthStatus = ProviderHealthStatus',
          ),
        ),
      ],
    })
    return r.violations.length === 0
  })
  check('P19 候选枚举到 0 ⇒ 未判定(判死不记绿)', () => {
    const r = runFixtureCase(FIXTURE_CANON, { alias: FIXTURE_ALIAS_OK, candidates: [] })
    return r.violations.length === 0 && r.undetermined.some((u) => u.startsWith('PV2 候选枚举到 0'))
  })
  check('P20 本轮未提供候选 ⇒ note,不读成全仓无副本', () => {
    const r = runFixtureCase(FIXTURE_CANON, { alias: FIXTURE_ALIAS_OK, candidates: null })
    return r.undetermined.length === 0 && r.notes.some((n) => n.startsWith('PV2 本轮未提供'))
  })
  check('P21 候选取不到内容 ⇒ 逐条点名未判定', () => {
    const r = runFixtureCase(FIXTURE_CANON, {
      alias: FIXTURE_ALIAS_OK,
      candidates: [cand('apps/x/gone.ts', null)],
    })
    return r.undetermined.some((u) => u.includes('apps/x/gone.ts'))
  })
  check('P22 档位数为 5(改档)⇒ note 不违规(改档归另票)', () => {
    const five = FIXTURE_CANON.replace("['aa', 'bb', 'cc', 'dd']", "['aa', 'bb', 'cc', 'dd', 'ee']")
    const r = runFixtureCase(five, { alias: FIXTURE_ALIAS_OK, candidates: null })
    return (
      r.violations.filter((v) => v.key.startsWith('PV1|')).length === 0 &&
      r.notes.some((n) => n.includes('与票面「四档」不符'))
    )
  })
  check('P23 canonical 未标 as const ⇒ note(档位不封闭)', () => {
    const noAsConst = FIXTURE_CANON.replace(' as const', '')
    const r = runFixtureCase(noAsConst, { alias: FIXTURE_ALIAS_OK, candidates: null })
    return r.notes.some((n) => n.startsWith('PV1') && n.includes('未标 as const'))
  })

  check('P24 唯一真相源文件里再抄一份表 ⇒ PV1b 红(候选预筛排除 canonical 的那道缝有兜底)', () => {
    const doubled = `${FIXTURE_CANON}\nexport const HEALTH_TIERS = ['aa', 'bb', 'cc', 'dd'] as const\n`
    const r = runFixtureCase(doubled, { alias: FIXTURE_ALIAS_OK, candidates: null })
    return r.violations.length === 1 && keys(r)[0] === `PV1b|${CANON.rel}|array|HEALTH_TIERS`
  })
  check('P25 canonical 自己的两份站点(数组 + 派生类型)不误报(PV1b 只认同值表)', () => {
    const r = runFixtureCase(FIXTURE_CANON, { alias: FIXTURE_ALIAS_OK, candidates: null })
    return r.violations.length === 0
  })

  let ok = 0
  let fail = 0
  for (const c of cases) {
    let r = false
    let err = null
    try {
      r = c.fn() === true
    } catch (e) {
      err = e
    }
    if (r) ok++
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
    '用法: node scripts/check-provider-health-vocabulary.mjs [--staged|--worktree] [--root <dir>] [--strict] [--json] [--all] [--self-test]\n' +
      '缺省判 HEAD blob;--staged 判索引 blob;--worktree 仅人工逃生舱(--root 只在该档有效);两旗同给 exit 2。\n' +
      '默认档违规只报数(逐条打印、exit 0);--strict 才判红(问责档)。PV2 的新增判定只在 --staged 档生效。\n' +
      '本门尚未接提交链(无 runner 条目、无 skipEnv)。',
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
  const ri = argv.indexOf('--root')
  if (ri >= 0) {
    const val = argv[ri + 1]
    if (!val || val.startsWith('--')) {
      console.error('❌ --root 需要一个目录参数')
      process.exit(2)
    }
    if (sel.face !== 'worktree') {
      console.error('❌ --root 只在 --worktree 档有效(换根却按 HEAD/索引读 = 双根分裂)')
      process.exit(2)
    }
    root = path.resolve(val)
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
  if (json) {
    console.info(JSON.stringify({ face: res.face, ...res }, null, 2))
  } else {
    if (res.members)
      console.info(
        `   唯一真相源:${CANON.rel} 的 ${CANON.arraySymbol}(${res.members.length} 档)[${res.members.join(',')}],派生类型 ${CANON.typeSymbol} | PV2 候选 ${res.stats?.candidateFiles ?? 0} 文件 | 超集 ${res.stats?.superset.length ?? 0} / 真子集 ${res.stats?.subset.length ?? 0} | PV3 别名形态 ${res.aliasState ?? 'absent'}`,
      )
    for (const n of res.notes) console.info(`   · ${n}`)
    if (res.inherited && res.inherited.length > 0)
      console.info(
        `   存量(HEAD 面已经红的同一键,按棘轮只报名):${res.inherited.map((v) => v.key).join(' | ')}`,
      )
    if (showAll && res.stats && res.stats.candidateFiles > 0)
      console.info(
        `   PV2 候选清单(${res.stats.candidateFiles} 文件,含无声明形态者)现读为超集/真子集的逐条见上方 note`,
      )
  }
  if (res.undetermined.length > 0) {
    console.error(
      `⚠️ 无法判定:${res.undetermined.length} 项 —— ${res.undetermined.join(' | ')}(面=${res.face};既不记绿也不冒红)`,
    )
    process.exit(2)
  }
  if (res.violations.length === 0) {
    if (!json)
      console.info(
        `✅ provider 健康档位单一真相源对账通过(面=${res.face}):canonical 派生自 as const 数组、别名仍指向同一来源、全仓无第二份同值声明`,
      )
    process.exit(0)
  }
  if (!json) {
    console.info(
      strict
        ? `❌ 检出 ${res.violations.length} 处档位分叉(面=${res.face},--strict 判红):`
        : `⚠️ 检出 ${res.violations.length} 处档位分叉(面=${res.face};默认档只报数,--strict 判红):`,
    )
    for (const v of res.violations) console.info(`   · ${v.text}`)
    console.info(
      `改法:档位唯一真相源 = ${CANON.rel} 的 ${CANON.arraySymbol}(as const),类型 = ${CANON.typeSymbol};\n` +
        `     别处一律 import 它或从其派生(2026-10-07 机主裁决:并表,不扩守门 151 射程)。\n` +
        `     四档值是落库列 health_status + REST 字段 healthStatus + 前端徽章三重对外契约 ——\n` +
        `     不得改名、不得为消红放宽判据、也不得写豁免清单消账(登记表必然腐烂,§4)。`,
    )
  }
  process.exit(strict ? 1 : 0)
}

/** 只递镜像测试真的调用的符号(多导出的解析原语无人调用 = 会腐烂的第二份入口) */
export const __test__ = {
  CANON,
  ALIAS,
  DOC_MEMBER_COUNT,
  SELF_EXEMPT_RE,
  SCAN_EXTS,
  SCAN_PREFIXES,
  decide,
  runAudit,
  declarationSites,
  parseCanonicalMembers,
  classifyAgainst,
  classifyTypeRhs,
  typeRhs,
  literalsIn,
  mask,
  grepCandidates,
  FIXTURE_CANON,
  FIXTURE_ALIAS_OK,
  FIXTURE_ALIAS_LITERAL,
  FIXTURE_COPY_ARRAY,
  FIXTURE_COPY_UNION,
  FIXTURE_COPY_ZOD,
  FIXTURE_COPY_TSENUM,
  FIXTURE_COPY_COMMENTED,
  FIXTURE_ORACLE,
  FIXTURE_SUPERSET,
  FIXTURE_SUBSET,
  FIXTURE_OTHER_DOMAIN,
  FIXTURE_BADGE_MAP,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
