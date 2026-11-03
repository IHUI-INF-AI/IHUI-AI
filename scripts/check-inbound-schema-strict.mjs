// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门:入站 Zod 契约的"未知字段表态"对账(G-674 立)。
//
// 在修什么
//   `z.object({ ... })` **默认把未知字段静默剥掉**,而 `.passthrough()` **默认把未知字段静默收下**;
//   两种默认都不报错、typecheck 也全绿。三把尺子的读数都不一样,派单一律**现读**(本门落地当轮实测):
//     · 票面写"2187 处 `z.object(` / 2 处 `.strict()` / 3 处 `.passthrough()`";
//     · `git grep` 按**行**数得 2167 行命中(`.strict()` 2、`.passthrough()` 3 与票面逐字吻合);
//     · 本门按**出现次数**判,同一候选面得 `z.object` 2549 / `z.strictObject` 10 / `z.looseObject` 45。
//   2158 → 2549 那 391 处的差**不是漏数,是书写形态**:prettier 会把长链折成
//   `const s = z` 换行 `.object({ … })`,按行 grep 的字面量 `z.object(` 结构性看不见它 ——
//   而那一族正是链上挂 `.strict()` / `.passthrough()` 的位置。判据必须覆盖被审代码实际产出的
//   形态,否则"数出来的量"就是低报的(守门 77 B6 只认 `rnRadius.` 不认 `rnRadius['2xl']` 同一课)。
//   本门不判"该不该拒",只判**有没有表态** —— 表态的形态是
//   `.strict()` / `z.strictObject()` / `.strip()`(显式剥离)三档;`.passthrough()` /
//   `.catchall(z.unknown())` / `z.looseObject()` 是**反方向表态**,按"待偿"逐条点名而不是放过
//   (它把越权字段的接受变成了默认行为)。
//
// 方向是本门的命门,所以**不猜**
//   出站面(我们构造给别人的 body)必须排除,否则就是在要求"给我们自己发出的数据加严格校验",
//   那会把门变成噪声机。判方向的证据只有三类:
//     ① 校验点实参落在 `request.*` / `req.*`(Fastify 入站)或强入站命名族(body/message/msg/payload/
//        raw/envelope/incoming/received/socket*/ws*/frame/packet/event.data)⇒ **入站**;
//     ② 实参是当场构造的字面量(`{`/`[` 开头)、`process.env`(配置)、或 `res.body`/`response.body`
//        (第三方响应,不属"客户端自报"这一 mandate)⇒ **出站 / 配置 / 第三方响应**,各自单列不判红;
//     ③ 其余 ⇒ **未判定**,逐条报名(既不冒红也不记绿)。
//   一个契约的"方向"由**校验点**给出,再沿两张边传播给被它包住的字段级契约:
//   包含边(文本嵌套)与同名词引用边(`z.array(innerSchema)` 这种按名字的组装)。
//   之所以必须传播:`.strict()` 在 zod 里**只管它自己那一层**,嵌套对象照旧静默剥 ——
//   只判最外层就等于没判(`geminiRequestSchema.strict()` 而 `generationConfig` 里的自报字段全收)。
//
// 口径同 70/77/83/98/101/103/118/135
//   全量判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 仅人工逃生舱、两面旗同给 ⇒ exit 2、
//   取不到内容 ⇒ exit 2「无法判定」(不回落另一个面);枚举与内容**同面同轮**,内容一律经
//   `scripts/lib/face-reader.mjs` 的 `catBatch`(散写 `git show` / 按磁盘 `readFileSync` 由守门 118 判)。
//
// 棘轮锚点 = **该文件在 HEAD 自身的存量数**,并且是**两维**(与 77/83/98/102/134/135 同族)
//   本门口径现读(HEAD 面,`node scripts/check-inbound-schema-strict.mjs --json` 末行,数字以现跑为准):
//   候选文件 1398 个、契约 2604 处(`z.object` 2549 / `z.looseObject` 45 / `z.strictObject` 10),
//   其中**入站且未表态 2342 处 / 其入站消费点 7293 个**、待偿(passthrough·catchall·loose)31 处
//   (消费点 32)、已表态 4 处、判不出(无校验点 220 + 接收者解析不到链 310)530 条。
//   这个量级当场判红就是一台与任何提交都无关的恒红门,唯一结局是逼人 `--no-verify` 连带废掉
//   全部守门(§12e)。所以默认档只拦"本次带进来的新增";`--strict` 才点名存量,且它有未判定
//   条目时**拒绝出具合格证**(exit 2),不写"已通过"。
//   为什么锚点必须是两维:只按"契约份数"棘轮时,给**已有的裸契约**再接一条入站路由(复用同一个
//   schema 加一个 `safeParse(request.body)`)读数不变 —— 敞口翻倍而账面净零逃逸(守门 134
//   「锚点粒度不够细 ⇒ 换个写法就净零逃逸」同一课)。两维各自只许降:份数与入站消费点数。
//
// 行内出口:`inbound-strict-exempt: <原因>`(必须带原因,裸标记不放行;只救本行或紧邻上一行注释)。
//
// 已知限制(如实登记,不等于"没有违规")
//   1. 只认 `z.object(` / `z.strictObject(` / `z.looseObject(` 三种字面形态;经工厂函数
//      (`makeSchema(...)`、`base.merge(other)`)造出的对象契约在本门眼里是"未判定"而非"没有"。
//   2. 校验点必须与被审文件里的定义同名才可解;`import` 而来的契约解析不到链 ⇒ 落未判定并报名。
//   3. `a.b.parse(x)` 这类成员接收者只取最后一段(`b`),因此 `ns.schema.parse(...)` 会被当成
//      非契约而放过。宁漏不误报。
//   4. 面 = 被审文件,跨文件的"定义在 A、入站用在 B"只把 B 的那处记进未判定,不代裁 A。
//
// 用法:node scripts/check-inbound-schema-strict.mjs [--staged|--worktree|--json|--strict|--all|--files a b|--self-test]
// 接线状态(2026-10-06 现读,已漂移):**已接入** —— `guardian-runner.mjs:4204` 起现注册
//   `id:'161'` / `mode:'blocking'` / `skipEnv: HUSKY_SKIP_INBOUND_SCHEMA_STRICT`。
//   ⚠️ 其 `stagedTriggers` 写成**逗号拼接的单字符串**
//   `['apps/api/src/,apps/cli/src/,apps/extension/,apps/desktop/']`,看着像漏了引号的老 bug,
//   但**实测不是**:`lib/guardian-triggers.mjs:27` 有 `entry.split(',')` 归一,逗号串会被正确拆开,
//   与写成多元素**行为完全一致**(含反例: 只暂存 apps/api 时命中、只暂存 README 时不命中,两者读数相同)。
//   故**刻意保留原写法**,不在本票顺手改注册表 —— 它不是缺陷,改了反而是无依据的噪音。
// 立项时那句话保留作存档:注册由主会话用 `scripts/gate-registry-insert.mjs` 统一接线,
//   接线那一笔必须同把 `inbound-strict-exempt` 挂进守门 108 的豁免存活期表(否则豁免只有出生没有死亡)。

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { maskCommentsAndStrings } from './lib/code-mask.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT = 120000

/** 入站候选面(票面点名的四处)。`apps/cli|extension|desktop` 现读 0 个 `z.object(`,
 *  但**必须留在表里** —— 本门立项的那一型就是"一条门只管自己立项那一型"(守门 102 左向箭头同族)。 */
const SCAN_ROOTS = ['apps/api/src/', 'apps/cli/src/', 'apps/extension/', 'apps/desktop/']
const SCAN_EXT = /\.(ts|tsx|js|mjs|cjs)$/
const TEST_NOISE =
  /(^|\/)(tests?|__tests__|e2e|__mocks__|fixtures?)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$|\.d\.ts$/
const SELF_EXEMPT = [
  'scripts/check-inbound-schema-strict.mjs',
  'scripts/tests/check-inbound-schema-strict.test.mjs',
]
/** 豁免必须带原因(裸标记不放行 —— 守门 102/131/135 同一条收紧) */
const EXEMPT = /inbound-strict-exempt:\s*\S/

// ── 方向标记 ────────────────────────────────────────────────────────────────────
const REQUEST_MEMBER_RE =
  /\b(?:request|req|ctx\.request|fastify\.request)\s*\.\s*(?:body|params|query|headers|all|rawBody|cookies)\b/
const THIRD_PARTY_RESPONSE_RE = /\b(?:res|response|upstream|upstreamRes)\s*\.\s*body\b/
const CONFIG_RE = /\bprocess\.env\b/
const OUTBOUND_LITERAL_RE = /^\s*[[{]/
/** 强入站命名族:这些名字在校验点实参位上表示"收到的东西",不表示"我们造的东西" */
const STRONG_INBOUND_RE =
  /\b(?:body|bodyObj|reqBody|payload|message|msg|msgObj|socketMessage|wsMessage|rawBody|rawMessage|rawText|rawJson|raw|rawStr|envelope|incoming|received|frame|packet|chunk)\b|\b(?:event|evt)\s*\.\s*data\b|\b(?:ws|socket|conn|connection)\b/
/** 这些接收者一定不是 Zod 契约(避免把 `JSON.parse` / `Date.parse` 读成校验点) */
const NON_SCHEMA_RECEIVERS = new Set([
  'JSON',
  'Date',
  'Number',
  'Intl',
  'BigInt',
  'URL',
  'URLSearchParams',
  'Math',
  'Buffer',
  'process',
  'Object',
  'Array',
  'String',
  'Boolean',
  'Symbol',
  'Reflect',
])
/** 接收者像契约(用于"解析不到链 ⇒ 未判定报名"与"不像契约 ⇒ 不判"的分流) */
const SCHEMAISH_RE = /schema|Schema|validator|Validator|contract|Contract|dto|Dto|^z$/

const OCC_RE = /\bz\s*\.\s*(object|strictObject|looseObject)\s*\(/g
const SITE_RE = /\b([A-Za-z_$][\w$]*)\s*\.\s*(safeParse|parse)\s*\(/g
const CHAIN_METHOD_RE = /\.\s*(strict|passthrough|strip|catchall|looseObject|strictObject)\s*\(/g
/** 链向前扫的上限:超过它就不是"同一个表达式"了 */
const CHAIN_WINDOW = 600
/** 回溯找声明名的上限(足够覆盖多行 type 注解 + 外层对象头) */
const DECL_LOOKBACK = 2000
const DECL_RE = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]{0,400}?)?=/g

/** `s[openIdx]` 必须是 ( [ { 之一;返回配对下标,配不平返回 -1(判不出,不猜)。 */
export function matchClose(s, openIdx) {
  const want = { '(': ')', '[': ']', '{': '}' }[s[openIdx]]
  if (!want) return -1
  let depth = 0
  for (let i = openIdx; i < s.length; i++) {
    const c = s[i]
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function lineOf(text, idx) {
  let n = 1
  for (let i = 0; i < idx && i < text.length; i++) if (text[i] === '\n') n++
  return n
}

/**
 * 从 `z.object(...)` 的收尾右括号向后扫方法链,返回链结束位置(不含)。
 * 停在 `;` `,` `}` `)` `]` `?` `:` 与链窗口之外 —— 越过三元/逗号去捡别人的 `.strict()`
 * 就是给违规发合格证(过度消费 ⇒ 假合规,比假违规更贵,因为它静默)。
 */
export function chainEndOf(s, closeIdx) {
  let i = closeIdx + 1
  const stop = Math.min(s.length, closeIdx + CHAIN_WINDOW)
  while (i < stop) {
    const c = s[i]
    if (c === '\n' || c === '\r' || c === ' ' || c === '\t') {
      i++
      continue
    }
    if (c === '.') {
      let j = i + 1
      while (j < stop && /[\w$]/.test(s[j])) j++
      let k = j
      while (k < stop && /\s/.test(s[k])) k++
      if (s[k] === '(') {
        const close = matchClose(s, k)
        if (close < 0 || close > stop) return i
        i = close + 1
        continue
      }
      if (j > i + 1) {
        i = j
        continue
      }
      return i
    }
    if (c === '!') {
      i++
      continue
    }
    return i
  }
  return i
}

/** 链上**最后**一个未知字段表态决定最终形态(后一次调用产出的才是被用的那个 schema)。 */
export function strictnessOfChain(chainText) {
  let last = null
  for (const m of chainText.matchAll(CHAIN_METHOD_RE)) last = m[1]
  if (last === 'strict' || last === 'strictObject') return 'strict'
  if (last === 'passthrough' || last === 'catchall' || last === 'looseObject')
    return 'looseDeclared'
  if (last === 'strip') return 'stripDeclared'
  return 'none'
}

/** 回溯最近的 `const|let|var NAME …=`(中间不得跨 `;`)⇒ 声明名与声明起点。 */
export function declOf(masked, occStart) {
  const from = Math.max(0, occStart - DECL_LOOKBACK)
  const before = masked.slice(from, occStart)
  let picked = null
  for (const m of before.matchAll(DECL_RE)) {
    const tail = before.slice(m.index + m[0].length)
    if (tail.includes(';')) continue
    picked = { name: m[1], start: from + m.index }
  }
  return picked
}

/** 方向判定的纯出口:入站 / 第三方响应 / 配置 / 出站 / 判不出。 */
export function classifyDirection(argText) {
  const a = (argText || '').trim()
  if (!a) return 'unknown'
  if (CONFIG_RE.test(a)) return 'config'
  if (OUTBOUND_LITERAL_RE.test(a)) return 'outbound'
  if (REQUEST_MEMBER_RE.test(a)) return 'inbound'
  if (THIRD_PARTY_RESPONSE_RE.test(a)) return 'thirdParty'
  if (STRONG_INBOUND_RE.test(a)) return 'inbound'
  return 'unknown'
}

/**
 * 单文件判定(纯函数,`--self-test` 与镜像测试都喂构造面给它)。
 * 返回四态 + 三张点名清单;不读 git、不碰磁盘。
 */
export function judgeFile(text) {
  if (typeof text !== 'string') return { unreadable: true }
  const masked = maskCommentsAndStrings(text)
  const rawLines = text.split('\n')

  /** @type {Array<object>} */
  const occurrences = { total: 0, byKind: {} }
  /** @type {Array<object>} */
  const occs = []
  for (const m of masked.matchAll(OCC_RE)) {
    const open = m.index + m[0].length - 1
    const close = matchClose(masked, open)
    if (close < 0) continue // 配不平:整条不判,下面记 undeterminedOccurrences
    const chainEnd = chainEndOf(masked, close)
    const chainText = masked.slice(close + 1, chainEnd)
    const kind = m[1]
    const byKind =
      kind === 'strictObject'
        ? 'strict'
        : kind === 'looseObject'
          ? 'looseDeclared'
          : strictnessOfChain(chainText)
    const decl = declOf(masked, m.index)
    occurrences.byKind[kind] = (occurrences.byKind[kind] || 0) + 1
    occs.push({
      id: occs.length,
      start: m.index,
      bodyEnd: close,
      chainEnd,
      kind,
      strictness: byKind,
      declName: decl ? decl.name : null,
      stmtStart: decl ? decl.start : m.index,
      line: lineOf(masked, m.index),
      siteLines: [],
    })
  }

  // 校验点:① 具名接收者 `X.safeParse(arg)`;② 链内联 `z.object({...}).parse(arg)`
  /** @type {Array<object>} */
  const sites = []
  for (const m of masked.matchAll(SITE_RE)) {
    const receiver = m[1]
    if (NON_SCHEMA_RECEIVERS.has(receiver)) continue
    const open = m.index + m[0].length - 1
    const close = matchClose(masked, open)
    const arg = close < 0 ? '' : masked.slice(open + 1, close)
    sites.push({
      receiver,
      inline: false,
      idx: m.index,
      line: lineOf(masked, m.index),
      argHead: arg.trim().slice(0, 48),
      dir: close < 0 ? 'unknown' : classifyDirection(arg),
      targetId: null,
    })
  }
  for (const occ of occs) {
    const seg = masked.slice(occ.bodyEnd + 1, occ.chainEnd)
    for (const m of seg.matchAll(
      /(?:^|[^\w$])([A-Za-z_$][\w$]*)?\s*\.\s*(safeParse|parse)\s*\(/g,
    )) {
      if (m[1] && NON_SCHEMA_RECEIVERS.has(m[1])) continue
      const absOpen = occ.bodyEnd + 1 + m.index + m[0].length - 1
      const close = matchClose(masked, absOpen)
      const arg = close < 0 ? '' : masked.slice(absOpen + 1, close)
      sites.push({
        receiver: occ.declName || '<inline>',
        inline: true,
        ownerOcc: occ.id,
        idx: absOpen,
        line: lineOf(masked, absOpen),
        argHead: arg.trim().slice(0, 48),
        dir: close < 0 ? 'unknown' : classifyDirection(arg),
        targetId: occ.id,
      })
    }
  }

  // 目标解析:具名站点按"该名的最外层 occ"落点;解析不到而接收者像契约 ⇒ 未判定点名
  const headByName = new Map()
  for (const occ of occs) {
    if (!occ.declName) continue
    const cur = headByName.get(occ.declName)
    if (!cur || occ.start < cur.start) headByName.set(occ.declName, occ)
  }
  const unresolvedSites = []
  for (const site of sites) {
    if (site.inline) continue
    const occ = headByName.get(site.receiver)
    if (occ) {
      site.targetId = occ.id
      continue
    }
    if (SCHEMAISH_RE.test(site.receiver) || site.receiver === 'z') {
      unresolvedSites.push(site)
    }
  }

  // 边:包含(文本嵌套) + 同名词引用(声明范围内出现别的名)
  const namesToIds = new Map()
  for (const occ of occs) {
    if (!occ.declName) continue
    if (!namesToIds.has(occ.declName)) namesToIds.set(occ.declName, [])
    namesToIds.get(occ.declName).push(occ.id)
  }
  /** @type {Map<number,Set<number>>} */
  const adj = new Map(occs.map((o) => [o.id, new Set()]))
  const link = (a, b) => {
    if (a === b) return
    adj.get(a).add(b)
    adj.get(b).add(a)
  }
  for (const a of occs) {
    for (const b of occs) {
      if (a === b) continue
      if (a.start < b.start && b.bodyEnd <= a.bodyEnd) link(a.id, b.id)
    }
    const range = masked.slice(a.stmtStart, a.chainEnd)
    const idents = new Set(range.match(/[A-Za-z_$][\w$]*/g) || [])
    for (const name of idents) {
      for (const id of namesToIds.get(name) || [])
        if (occs[id].declName !== a.declName) link(a.id, id)
    }
  }

  // 方向传播(BFS;一个契约同时被入站与出站用到 ⇒ mixed,按入站问责)
  const dirOf = new Map()
  const setDir = (id, dir) => {
    const cur = dirOf.get(id)
    if (cur === undefined) dirOf.set(id, dir)
    else if (cur !== dir && cur && dir) {
      const pair = [cur, dir].sort()
      dirOf.set(id, pair.includes('inbound') ? 'mixed' : cur)
    }
  }
  for (const site of sites) {
    if (site.targetId === null || site.dir === 'unknown') continue
    const queue = [site.targetId]
    const seen = new Set([site.targetId])
    while (queue.length) {
      const id = queue.shift()
      setDir(id, site.dir)
      siteLinesOf(occs[id]).push({
        line: site.line,
        receiver: site.receiver,
        argHead: site.argHead,
        dir: site.dir,
      })
      for (const nb of adj.get(id) || []) {
        if (!seen.has(nb)) {
          seen.add(nb)
          queue.push(nb)
        }
      }
    }
  }

  const buckets = {
    declaredStrict: [],
    bareInbound: [],
    looseDeclared: [],
    stripDeclared: [],
    exempted: [],
    outbound: [],
    thirdParty: [],
    config: [],
    undirected: [],
  }
  for (const occ of occs) {
    const dir = dirOf.get(occ.id) || null
    const raw = siteLinesOf(occ)
    const inboundSites = raw.filter((s) => s.dir === 'inbound' || s.dir === 'mixed').length
    const rec = {
      line: occ.line,
      decl: occ.declName || '(inline)',
      kind: occ.kind,
      dir,
      inboundSites,
      sites: raw.slice(0, 3).map((s) => `${s.line}:${s.receiver}(${s.argHead})[${s.dir}]`),
      exempt: exemptNear(rawLines, occ.line),
    }
    if (!dir) {
      buckets.undirected.push(rec)
      continue
    }
    if (dir === 'outbound') buckets.outbound.push(rec)
    else if (dir === 'thirdParty') buckets.thirdParty.push(rec)
    else if (dir === 'config') buckets.config.push(rec)
    else if (occ.strictness === 'strict') buckets.declaredStrict.push(rec)
    else if (occ.strictness === 'looseDeclared') buckets.looseDeclared.push(rec)
    else if (occ.strictness === 'stripDeclared') buckets.stripDeclared.push(rec)
    else if (rec.exempt) buckets.exempted.push({ ...rec, viaExempt: true })
    else buckets.bareInbound.push(rec)
  }
  // **第二消费点也算账**:同一个裸契约多接一条入站路由,`bareInbound` 不动而敞口翻倍 ——
  // 只按"契约份数"棘轮就会替人做出"这次没加东西"的判断(守门 134「锚点粒度不够细 ⇒ 换个写法
  // 就净零逃逸」同族)。所以锚点维度是 (契约份数, 入站消费点数) 两个,各自只许降。
  const bareSites = buckets.bareInbound.reduce((n, r) => n + Math.max(1, r.inboundSites), 0)
  const looseSites = buckets.looseDeclared.reduce((n, r) => n + Math.max(1, r.inboundSites), 0)

  return {
    unreadable: false,
    occurrences: occs.length,
    byKind: occurrences.byKind,
    sites: sites.length,
    unresolvedSites: unresolvedSites.map((s) => ({
      line: s.line,
      receiver: s.receiver,
      argHead: s.argHead,
    })),
    buckets,
    counts: {
      declaredStrict: buckets.declaredStrict.length,
      bareInbound: buckets.bareInbound.length,
      bareSites,
      looseDeclared: buckets.looseDeclared.length,
      looseSites,
      stripDeclared: buckets.stripDeclared.length,
      exempted: buckets.exempted.length,
      outbound: buckets.outbound.length,
      thirdParty: buckets.thirdParty.length,
      config: buckets.config.length,
      undirected: buckets.undirected.length,
    },
  }
}

const SITE_STORE = new WeakMap()
function siteLinesOf(occ) {
  if (!SITE_STORE.has(occ)) SITE_STORE.set(occ, [])
  return SITE_STORE.get(occ)
}

/** 行内豁免只救"本行"或"紧邻上一行(且上一行是纯注释)"—— 写在更上面不算。 */
export function exemptNear(rawLines, lineNo) {
  const at = rawLines[lineNo - 1] || ''
  if (EXEMPT.test(at)) return 'same-line'
  const prev = lineNo > 1 ? rawLines[lineNo - 2] : ''
  if (prev.trim() && /^\s*(?:\/\/|\/\*|\*)/.test(prev) && EXEMPT.test(prev)) return 'prev-comment'
  return null
}

// ── 面取材 ─────────────────────────────────────────────────────────────────────
function listFacePaths(face) {
  if (face === 'head')
    return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z'], ROOT, { timeout: GIT_TIMEOUT })
      .split('\0')
      .filter(Boolean)
  if (face === 'staged')
    return gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], ROOT, {
      timeout: GIT_TIMEOUT,
    })
      .split('\0')
      .filter(Boolean)
  return gitRaw(['ls-files', '-z'], ROOT, { timeout: GIT_TIMEOUT }).split('\0').filter(Boolean)
}

export function inScope(p) {
  if (!SCAN_EXT.test(p) || TEST_NOISE.test(p)) return false
  if (SELF_EXEMPT.includes(p)) return false
  return SCAN_ROOTS.some((d) => p.startsWith(d))
}

function readFace(paths, face) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) map.set(p, readWorktreeFile(ROOT, p))
    return map
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(ROOT, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  for (let i = 0; i < paths.length; i++) map.set(paths[i], got.get(specs[i]) ?? null)
  return map
}

/**
 * 暂存档的"无射程内文件 ⇒ 回退全量"判定(纯函数,四路各有正反例):
 * 一次只改文档/语言包的提交结构上不带 .ts,把它判成空扫就是替**每一次**无关提交挡路(§12e)。
 */
export function shouldRetreatToHead({ face, hasOnlyFiles, stagedInScopeCount }) {
  return face === 'staged' && !hasOnlyFiles && stagedInScopeCount === 0
}

/** 退出码判序(纯函数,便于用构造面证明"空扫/取不到 ⇒ 2 优先于 1")。 */
export function decideExit({
  unreadableCount,
  emptyScan,
  redCount,
  strict,
  strictHits,
  undeterminedCount,
}) {
  if (emptyScan || unreadableCount > 0) return 2
  if (strict) {
    if (undeterminedCount > 0) return 2
    if (strictHits > 0) return 1
  }
  return redCount > 0 ? 1 : 0
}

function collect(faceName, onlyFiles) {
  const files = (onlyFiles ?? listFacePaths(faceName)).filter(inScope)
  const contents = readFace(files, faceName)
  const per = new Map()
  for (const f of files) per.set(f, judgeFile(contents.get(f)))
  return { files, per }
}

export function analyze(face, onlyFiles = null, { strict = false } = {}) {
  let effFace = face
  let retreatReason = null
  if (
    shouldRetreatToHead({
      face,
      hasOnlyFiles: onlyFiles !== null,
      stagedInScopeCount: face === 'staged' ? listFacePaths('staged').filter(inScope).length : -1,
    })
  ) {
    effFace = 'head'
    retreatReason = '本次暂存集里没有本门射程内的文件 ⇒ 回退 HEAD 全量面(不是"没判")'
  }
  const cur = collect(effFace, onlyFiles)
  const onlyFilesUsed = onlyFiles !== null
  const totals = {
    declaredStrict: 0,
    bareInbound: 0,
    bareSites: 0,
    looseDeclared: 0,
    looseSites: 0,
    stripDeclared: 0,
    exempted: 0,
    outbound: 0,
    thirdParty: 0,
    config: 0,
    undirected: 0,
  }
  const occurrences = { total: 0, byKind: {} }
  const unreadable = []
  const red = []
  const detail = []
  const unresolved = []

  for (const f of cur.files) {
    const r = cur.per.get(f)
    if (!r || r.unreadable) {
      unreadable.push(f)
      continue
    }
    occurrences.total += r.occurrences
    for (const [k, v] of Object.entries(r.byKind || {}))
      occurrences.byKind[k] = (occurrences.byKind[k] || 0) + v
    for (const k of Object.keys(totals)) totals[k] += r.counts[k]
    for (const s of r.unresolvedSites) unresolved.push({ file: f, ...s })
    const bad = [...r.buckets.bareInbound, ...r.buckets.looseDeclared].map((x) => ({
      file: f,
      ...x,
    }))
    if (bad.length) detail.push(...bad)
    if (!r.counts.bareInbound && !r.counts.looseDeclared) continue
    if (effFace === 'head' && !strict) continue // 全量档:存量只报数,绝不当场判红
    if (effFace === 'staged' || effFace === 'worktree') {
      // 棘轮锚点 = 该文件 **HEAD 自身**的存量,两维各自只许降:契约份数与入站消费点数。
      const headText = readFace([f], 'head').get(f)
      const capRes = headText ? judgeFile(headText) : null
      const cap = capRes && !capRes.unreadable ? capRes.counts.bareInbound : 0
      const capSites = capRes && !capRes.unreadable ? capRes.counts.bareSites : 0
      const capLoose = capRes && !capRes.unreadable ? capRes.counts.looseDeclared : 0
      const overBare = r.counts.bareInbound > cap
      const overSites = r.counts.bareSites > capSites
      const overLoose = r.counts.looseDeclared > capLoose
      if (overBare || overSites || overLoose) {
        red.push({
          file: f,
          bare: r.counts.bareInbound,
          cap,
          bareSites: r.counts.bareSites,
          capSites,
          why:
            overSites && !overBare
              ? '第二消费点(裸契约份数未变)'
              : overBare
                ? '新增裸入站契约'
                : '新增待偿入站契约',
          loose: r.counts.looseDeclared,
          capLoose,
          sites: bad.slice(0, 3),
        })
      }
    } else if (strict) {
      red.push({ file: f, bare: r.counts.bareInbound, cap: 0, sites: bad.slice(0, 3) })
    }
  }

  const emptyScan = cur.files.length === 0
  const undeterminedCount = totals.undirected + unresolved.length
  const strictHits = red.length
  const exit = decideExit({
    unreadableCount: unreadable.length,
    emptyScan,
    redCount: effFace === 'head' && !strict ? 0 : red.length,
    strict,
    strictHits,
    undeterminedCount,
  })
  return {
    face: effFace,
    requestedFace: face,
    retreatReason,
    onlyFilesUsed,
    scannedFiles: cur.files.length,
    occurrences,
    totals,
    undeterminedCount,
    unresolvedSites: unresolved,
    red,
    detail,
    unreadable,
    emptyScan,
    strict,
    exit,
  }
}

// ── 自检 ────────────────────────────────────────────────────────────────────────
const FIXTURES = {
  // 绿:入站契约显式 .strict()
  strictInbound: `const bodySchema = z.object({ name: z.string() }).strict()
const parsed = bodySchema.safeParse(request.body)`,
  // 绿:z.strictObject 同形认
  strictObjectForm: `const bodySchema = z.strictObject({ name: z.string() })
const parsed = bodySchema.safeParse(request.body)`,
  // 绿:显式声明剥离(表态了,哪怕姿态是剥)
  stripDeclared: `const bodySchema = z.object({ name: z.string() }).strip()
const parsed = bodySchema.safeParse(request.body)`,
  // 红:裸 z.object 被当请求体校验
  bareInbound: `const bodySchema = z.object({ name: z.string() })
const parsed = bodySchema.safeParse(request.body)`,
  // 红:链在下一行(.strict() 必须能被看见,否则换行就隐身)
  bareMultilineChain: `const bodySchema = z
  .object({ name: z.string() })
  .optional()
const parsed = bodySchema.parse(request.params)`,
  // 红:外层 strict 不管内层 —— 嵌套字段级契约同样静默剥
  nestedInner: `const createSchema = z
  .object({ cfg: z.object({ temp: z.number() }) })
  .strict()
const parsed = createSchema.safeParse(request.body)`,
  // 红:按名字组装的字段级契约(文本不嵌套,靠名词边)
  namedComposition: `const partSchema = z.object({ text: z.string() })
const outerSchema = z.object({ parts: z.array(partSchema) })
const parsed = outerSchema.safeParse(request.body)`,
  // 反向对照:内层已 strict、外层没表态 ⇒ 只算外层一份(证明名词边把判据落到正确的层)
  strictInnerComposition: `const partSchema = z.object({ text: z.string() }).strict()
const outerSchema = z.object({ parts: z.array(partSchema) })
const parsed = outerSchema.safeParse(request.body)`,
  // 放过:同一形状藏在字符串里(判据面连字符串一起抹)
  inString: `const doc = "旧写法: const s = z.object({ a: z.string() }); s.safeParse(request.body)"`,
  // 待偿点名:.passthrough() 是反方向表态,不是"已表态"
  passthroughInbound: `const geminiRequestSchema = z.object({ contents: z.string() }).passthrough()
const parsed = geminiRequestSchema.safeParse(request.body)`,
  // 放过:同一形状只写在注释里(判据面先剥注释 —— 门 131/135 的同一条反向锁)
  inComment: `// 旧写法:const s = z.object({ a: z.string() }); s.safeParse(request.body)
const x = 1`,
  // 放过:出站 —— 当场构造的字面量是我们自己的数据,不该由本门要求拒未知字段
  outboundLiteral: `const wireSchema = z.object({ model: z.string() })
const wire = wireSchema.parse({ model: 'x' })`,
  // 棘轮第二维用:同一个裸契约多接一个入站消费点 ⇒ 份数不变、敞口翻倍
  bareOneConsumer: `const qSchema = z.object({ q: z.string() })
const p1 = qSchema.safeParse(request.query)`,
  bareTwoConsumers: `const qSchema = z.object({ q: z.string() })
const p1 = qSchema.safeParse(request.query)
const p2 = qSchema.safeParse(request.params)`,
  // 放过:出站当场构造的字面量(证明第二维不会把"我们自己发出去的数据"算进敞口)
  outboundLiteral2: `const wireSchema = z.object({ model: z.string() })
const wire = wireSchema.parse({ model: 'a' })
const wire2 = wireSchema.parse({ model: 'b' })`,
  // 单列不判红:第三方响应(不属"客户端自报"这一 mandate)
  thirdPartyResponse: `const vendorSchema = z.object({ data: z.string() })
const got = vendorSchema.parse(res.body)`,
  // 未判定:方向判不出 —— 既不冒红也不记绿,必须报名
  unknownDirection: `const thingSchema = z.object({ a: z.string() })
const got = thingSchema.parse(someOpaqueValue)`,
  // 未判定:接收者像契约但解析不到链(import 而来)
  importedReceiver: `const parsed = chatCompletionSchema.safeParse(request.body)`,
  // 绿:带原因的行内豁免(且只救本行)
  exempted: `const bodySchema = z.object({ name: z.string() }) // inbound-strict-exempt: 兼容旧客户端灰度期,到期见守门 108
const parsed = bodySchema.safeParse(request.body)`,
  // 红:裸标记没原因不放行
  bareMarker: `const bodySchema = z.object({ name: z.string() }) // inbound-strict-exempt:
const parsed = bodySchema.safeParse(request.body)`,
  // 红:JSON.parse / Date.parse 不得被当校验点(否则门满天假红)
  notZodReceivers: `const a = JSON.parse(request.body)
const b = Date.parse(request.body)
const bodySchema = z.object({ name: z.string() })`,
}

function runSelfTest() {
  let okAll = true
  const ok = (name, pass) => {
    console.log(`${pass ? '✅' : '❌'} ${name}`)
    if (!pass) okAll = false
  }
  const c = (name) => judgeFile(FIXTURES[name]).counts
  ok(
    'S1 strict 在位 ⇒ 零违规(实得 bare ' + c('strictInbound').bareInbound + ')',
    c('strictInbound').bareInbound === 0 && c('strictInbound').declaredStrict === 1,
  )
  ok(
    'S1 z.strictObject 同形认 ⇒ 零违规',
    c('strictObjectForm').bareInbound === 0 && c('strictObjectForm').declaredStrict === 1,
  )
  ok(
    'S1 .strip() 算"已表态"(判据问的是有没有表态,不是态度对不对)',
    c('stripDeclared').bareInbound === 0 && c('stripDeclared').stripDeclared === 1,
  )
  ok('S2 裸 z.object 被当请求体校验 ⇒ 计违规', c('bareInbound').bareInbound === 1)
  ok(
    'S2 链换行不得让 .strict() 隐身(反向:这里没有 strict 也必须命中)',
    c('bareMultilineChain').bareInbound === 1,
  )
  ok(
    'S3 嵌套字段级契约必须各自判(外层 strict 管不到内层)',
    c('nestedInner').bareInbound === 1 && c('nestedInner').declaredStrict === 1,
  )
  ok(
    'S4 按名字组装的契约要靠名词边传方向(两份都算入站,不是只算最外层)',
    (() => {
      const r = judgeFile(FIXTURES.namedComposition)
      return (
        r.occurrences === 2 &&
        r.counts.bareInbound === 2 &&
        r.buckets.bareInbound.some((x) => x.decl === 'partSchema')
      )
    })(),
  )
  ok(
    'S5 .passthrough() ⇒ 待偿点名,不放过也不混进 bare',
    c('passthroughInbound').looseDeclared === 1 && c('passthroughInbound').bareInbound === 0,
  )
  ok(
    'S4b 反向对照:内层已 strict 而外层裸 ⇒ 只计外层(名词边把判据落在对的层,不是整链一把红)',
    (() => {
      const r = judgeFile(FIXTURES.strictInnerComposition)
      return (
        r.counts.bareInbound === 1 &&
        r.counts.declaredStrict === 1 &&
        r.buckets.bareInbound[0].decl === 'outerSchema'
      )
    })(),
  )
  ok(
    'S6 同一形状只写进注释 ⇒ 不得命中(门 131 刚被自己的说明咬过)',
    (() => {
      const r = judgeFile(FIXTURES.inComment)
      return r.occurrences === 0 && r.counts.bareInbound === 0
    })(),
  )
  ok(
    'S6b 同一形状写在字符串字面量里 ⇒ 不得命中',
    (() => {
      const r = judgeFile(FIXTURES.inString)
      return r.occurrences === 0 && r.sites === 0
    })(),
  )
  ok(
    'S7 出站(当场构造字面量)⇒ 排除,不判红',
    c('outboundLiteral').outbound === 1 && c('outboundLiteral').bareInbound === 0,
  )
  ok(
    'S8 第三方响应单列(不是"客户端自报"那一 mandate)',
    c('thirdPartyResponse').thirdParty === 1 && c('thirdPartyResponse').bareInbound === 0,
  )
  ok(
    'S9 方向判不出 ⇒ 未判定并报名,既不冒红也不记绿',
    c('unknownDirection').undirected === 1 && c('unknownDirection').bareInbound === 0,
  )
  ok(
    'S10 import 而来解析不到链 ⇒ 落 unresolvedSites 点名(不得静默)',
    (() => {
      const r = judgeFile(FIXTURES.importedReceiver)
      return r.unresolvedSites.length === 1 && r.counts.bareInbound === 0
    })(),
  )
  ok(
    'S11 带原因豁免放行且单独计一档(不是被静默删掉)',
    (() => {
      const r = judgeFile(FIXTURES.exempted)
      return r.counts.bareInbound === 0 && r.counts.exempted === 1 && r.counts.declaredStrict === 0
    })(),
  )
  ok('S11 裸标记(冒号后无原因)不得放行', c('bareMarker').bareInbound === 1)
  ok(
    'S12 JSON.parse / Date.parse 不得被读成校验点',
    (() => {
      const r = judgeFile(FIXTURES.notZodReceivers)
      return r.counts.bareInbound === 0 && r.sites === 0
    })(),
  )
  ok(
    'S13 反向对照:bare 与 strict 两夹具必须不同判',
    c('bareInbound').bareInbound === 1 && c('strictInbound').bareInbound === 0,
  )
  ok(
    'S14 面过滤:测试面与 .d.ts 不进射程,而生产路由仍进',
    !inScope('apps/api/src/routes/__tests__/a.test.ts') &&
      !inScope('packages/types/src/x.d.ts') &&
      inScope('apps/api/src/routes/a.ts') &&
      inScope('apps/cli/src/ipc/handler.ts'),
  )
  ok(
    'S15 候选面四处都在表里(不能只留今天有数的那一处)',
    ['apps/api/src/', 'apps/cli/src/', 'apps/extension/', 'apps/desktop/'].every((p) =>
      inScope(p + 'x.ts'),
    ),
  )
  ok(
    'S16 自豁免:门自己的源码与镜像测试不进射程',
    !inScope('scripts/check-inbound-schema-strict.mjs'),
  )
  ok(
    'S17 暂存回退四路:只有"staged 且无 --files 且射程内 0 个"才回退',
    shouldRetreatToHead({ face: 'staged', hasOnlyFiles: false, stagedInScopeCount: 0 }) &&
      !shouldRetreatToHead({ face: 'staged', hasOnlyFiles: false, stagedInScopeCount: 1 }) &&
      !shouldRetreatToHead({ face: 'staged', hasOnlyFiles: true, stagedInScopeCount: 0 }) &&
      !shouldRetreatToHead({ face: 'head', hasOnlyFiles: false, stagedInScopeCount: -1 }),
  )
  ok(
    'S18 退出码判序:空扫与取不到 ⇒ 2 优先于判红',
    decideExit({
      unreadableCount: 1,
      emptyScan: false,
      redCount: 3,
      strict: false,
      strictHits: 0,
      undeterminedCount: 0,
    }) === 2 &&
      decideExit({
        unreadableCount: 0,
        emptyScan: true,
        redCount: 3,
        strict: false,
        strictHits: 0,
        undeterminedCount: 0,
      }) === 2,
  )
  ok(
    'S19 退出码判序:--strict 有未判定 ⇒ 拒绝出具合格证(2,不是通过)',
    decideExit({
      unreadableCount: 0,
      emptyScan: false,
      redCount: 0,
      strict: true,
      strictHits: 0,
      undeterminedCount: 5,
    }) === 2,
  )
  ok(
    'S20 退出码判序:默认档存量不判红、新增才红',
    decideExit({
      unreadableCount: 0,
      emptyScan: false,
      redCount: 1,
      strict: false,
      strictHits: 1,
      undeterminedCount: 0,
    }) === 1 &&
      decideExit({
        unreadableCount: 0,
        emptyScan: false,
        redCount: 0,
        strict: false,
        strictHits: 0,
        undeterminedCount: 0,
      }) === 0,
  )
  ok(
    'S24 第二维:同一裸契约多接一个入站消费点 ⇒ 份数不变而消费点数上升(否则"复用裸 schema 加一条路由"净零逃逸)',
    (() => {
      const one = judgeFile(FIXTURES.bareOneConsumer).counts
      const two = judgeFile(FIXTURES.bareTwoConsumers).counts
      return (
        one.bareInbound === 1 && one.bareSites === 1 && two.bareInbound === 1 && two.bareSites === 2
      )
    })(),
  )
  ok(
    'S25 第二维不吃出站:同一契约被 parse 两次但都是当场构造 ⇒ 不计入站敞口',
    (() => {
      const r = judgeFile(FIXTURES.outboundLiteral2).counts
      return r.outbound === 1 && r.bareSites === 0 && r.bareInbound === 0
    })(),
  )
  // 阳性对照:真仓 HEAD 面必须看得见存量(看不见 = 判据对该形态全盲,不是"已清完")
  const head = analyze('head')
  ok(
    `S21 真仓 HEAD 阳性对照:必须看得见入站候选(实得 occurrences ${head.occurrences.total} / bare ${head.totals.bareInbound})`,
    head.occurrences.total > 1000 && head.totals.bareInbound > 100,
  )
  ok(`S22 全量档不得因存量判红(锚点=该文件自身;当场判红就是恒红门)`, head.exit !== 1)
  ok(
    `S23 面=HEAD 时 requestedFace 一致且未误回退(head 档不该有回退原因)`,
    head.face === 'head' && head.retreatReason === null,
  )
  console.log(okAll ? '--self-test: 全部通过' : '--self-test: 有失败')
  process.exitCode = okAll ? 0 : 1
}

// ── CLI ─────────────────────────────────────────────────────────────────────────
function clip(list, n, all) {
  if (all || list.length <= n) return list
  return list.slice(0, n)
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return runSelfTest()
  const picked = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (picked.error) {
    console.error(`❌ ${picked.error}`)
    process.exitCode = 2
    return
  }
  const strict = argv.includes('--strict')
  const all = argv.includes('--all')
  const fi = argv.indexOf('--files')
  const only = fi >= 0 ? argv.slice(fi + 1).filter((a) => !a.startsWith('--')) : null
  const r = analyze(picked.face, only && only.length ? only : null, { strict })
  if (argv.includes('--json')) {
    console.log(JSON.stringify(r, null, 2))
    process.exitCode = r.exit
    return
  }
  const t = r.totals
  console.log(
    `[inbound-strict] 面:${r.face}${r.face !== r.requestedFace ? `(请求:${r.requestedFace})` : ''} · 扫描 ${r.scannedFiles} 文件 · 契约 ${r.occurrences.total} 处(其中 z.object ${r.occurrences.byKind.object || 0})`,
  )
  if (r.retreatReason) console.log(`↩️ ${r.retreatReason}`)
  console.log(
    `  四态:已表态(strict/strictObject) ${t.declaredStrict} / 显式剥离(strip) ${t.stripDeclared} / 待偿(passthrough·catchall·loose) ${t.looseDeclared} / 裸(无表态) ${t.bareInbound}`,
  )
  console.log(
    `  棘轮两维(第二消费点也计账):裸契约的入站消费点 ${t.bareSites} / 待偿契约的入站消费点 ${t.looseSites}`,
  )
  console.log(
    `  非入站/判不出:出站 ${t.outbound} / 第三方响应 ${t.thirdParty} / 配置 ${t.config} / 无校验点 ${t.undirected} / 接收者解析不到链 ${r.unresolvedSites.length} / 带原因豁免 ${t.exempted}`,
  )
  if (r.emptyScan) console.log('❌ 本面枚举到 0 个候选文件 —— 判"无法判定",绝不记绿')
  if (r.unreadable.length)
    console.log(`❌ 无法判定:${r.unreadable.length} 个候选在本面取不到内容,首个:${r.unreadable[0]}`)
  for (const x of clip(r.detail, 20, all)) {
    const tag = x.dir === 'mixed' ? 'mixed(含入站)' : x.dir
    console.log(
      `   · ${x.file}:${x.line} ${x.decl} [${tag}] ${x.sites[0] || ''}${x.viaExempt ? ' (带原因豁免)' : ''}`,
    )
  }
  if (!all && r.detail.length > 20)
    console.log(`   … 其余 ${r.detail.length - 20} 条用 --all / --json 展开`)
  if (r.red.length) {
    if (strict) console.log(`❌ --strict 点名存量:${r.red.length} 个文件有未表态/待偿的入站契约:`)
    else console.log(`❌ 新增(超出该文件 HEAD 自身存量)${r.red.length} 个文件:`)
    for (const x of r.red.slice(0, 12))
      console.log(
        `   - ${x.file}: 裸 ${x.bare}(HEAD 存量 ${x.cap}) · 入站消费点 ${x.bareSites ?? '—'}(存量 ${x.capSites ?? '—'}) · 待偿 ${x.loose ?? 0}(存量 ${x.capLoose ?? 0}) [${x.why || '存量'}] 例:${x.sites?.[0]?.decl ?? ''}@${x.sites?.[0]?.line ?? ''}`,
      )
    console.log(
      '   出口:入站契约补 .strict() / z.strictObject();刻意要剥或刻意要收就显式 .strip() / 说明并写 inbound-strict-exempt: <原因>',
    )
  } else {
    console.log(
      r.face === 'head' && !strict
        ? `ℹ️ HEAD 全量档**只报数不判红**(存量按"该文件 HEAD 自身存量"棘轮兜住,要逐条问责跑 --strict)`
        : `✅ 无新增(未超出各文件 HEAD 自身存量)`,
    )
    if (r.onlyFilesUsed) console.log('ℹ️ --files 通道:只报这些文件自身的读数,不判新增')
  }
  if (strict && r.exit === 2)
    console.log(
      `⚠️ --strict 拒绝出具合格证:未判定 ${r.undeterminedCount} 条(方向或链判不出 ≠ 已表态)`,
    )
  console.log('  射程:' + SCAN_ROOTS.join(' ') + '(测试面/.d.ts/门自身不进)')
  process.exitCode = r.exit
}

export const __test__ = {
  judgeFile,
  analyze,
  inScope,
  classifyDirection,
  strictnessOfChain,
  chainEndOf,
  declOf,
  matchClose,
  exemptNear,
  shouldRetreatToHead,
  decideExit,
  SCAN_ROOTS,
  EXEMPT,
  FIXTURES,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
