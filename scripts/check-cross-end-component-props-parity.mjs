// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console */
/**
 * check-cross-end-component-props-parity.mjs —— 守门 288:两端同名组件 props 键集/必选性的
 * **台账制差值棘轮**(判据引擎 = scripts/lib/component-props-parity.mjs,本文件零复算)。
 *
 * 立因:跨端对账族的最后一格零尺 —— 同名组件对的 props 行为对称性(键集缺失/必选性漂移)
 * 此前只随门 128 读数打印、不判(门 128 头注明写"props 命名只随读数打印,不是观感本身")。
 * 失效型是静默的:调用端把一个只有对端消费的 prop 传出去 ⇒ 本端无该腿、不报错、看不出错
 * (与 badge-spec 的"缺档静默掉色"同族,从档降到腿)。补齐后本门随提交链与守护巡检自跑。
 *
 * 档位(§12e 恒红门禁令):2026-11-03 现读存量 = 18 对里 17 对有差、0 全对齐、1 未判定 ——
 * 全量绝对判红结构上是恒红门,唯一结局是逼人 --no-verify 连坐全部守门。所以:
 *   · 基线台账(scripts/data/cross-end-props-parity-baseline.json)登记当下账;
 *   · 只拦**新增退化**:在册对的 onlyRn/onlyMini/reqDrift 出现台账之外的新键 ⇒ 红(逐键点名);
 *     全新同名对带着漂移进仓而台账没记 ⇒ 红(出路=显式 --update-baseline 落账,不许静默入账);
 *   · 键集缩小 = 向统一收敛 ⇒ 绿并提示可收紧台账;
 *   · undetermined 一律 warn 点名(判红=把类型面一时解析不出冒成违规;判绿=把没量冒成量过,§0.3);
 *   · 唯一例外 = 台账里已裁决的 `not-applicable`:必须 owner + expires + evidence(仓库内 文件:行)
 *     + why 四件齐全、未到期、证据行真落在文件内,该对才计"已裁决(整对不构成对账对象)"(读数仍逐条打印)。
 *     裁决可用于两种对:① undetermined(把"没读到"显式裁决掉);② 已能量出的同名不同物整对
 *     (ui 完全不同,如 FloatBox=RN 顶部 toast vs mini 悬浮入口组)—— 后者至少要 2 条证据覆盖双端,
 *     且该对存量从"漂移键总数"里剔除、不进新键棘轮(整对已判过)。缺字段/过期/证据指空/证据不足
 *     ⇒ 裁决无效:undetermined 照旧点名,可测对直接判红 invalid-not-applicable-ruling —— 禁止用它把
 *     单键缺口洗成"整对不适用";裁决也不会被 --update-baseline 冲成 ok,只能显式撤销。
 *   · 升绝对零的唯一前置 = 存量归零(数字现读,不写死在本文件)。
 *
 * 取材面(§0.4 横向口径):默认 HEAD blob;--staged 判索引;两面旗同给 exit 2;
 * 取不到被审面(门 128 collect 失踪/基线坏)⇒ exit 2 未判定,绝不回落另一个面。
 *
 * 用法:
 *   node scripts/check-cross-end-component-props-parity.mjs                 # 人读(HEAD 面)
 *   node scripts/check-cross-end-component-props-parity.mjs --staged|--json|--quiet
 *   node scripts/check-cross-end-component-props-parity.mjs --update-baseline # 落账(带保护)
 *   node scripts/check-cross-end-component-props-parity.mjs --self-test       # 纯函数正反例
 * 应急: HUSKY_SKIP_CROSS_END_PROPS_PARITY=1 git commit ...(跳门必须留痕,守门 89 同款纪律)
 */
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { computeParity, EQUIVALENCE_REL } from './lib/component-props-parity.mjs'
// 取材面(§0.4/§12e):本门此前用 readFileSync + join(root, rel) 直接按磁盘取内容,属散写;
// 现统一经 face-reader 的磁盘面入口 readWorktreeFile(root, rel)。它的语义与 readFileSync 等价
// (缺失返回 null、读失败抛 Undetermined),故判定结论逐字节不变,只换了取材管道。
// 之所以固定走 worktree 面而不按 selectFace 分流:本门被判的组件正文已由
// computeParity(ROOT, face) 按 face 取(HEAD/索引),其余被读的都是**台账与证据落点**
// (基线/裁决/映射表/证据指到的源码行);其中的证据解析 resolveEvidence/validateJudged/
// validateNotApplicable 是对任意 rootDir(含测试临时夹具)的通用函数,按 git 面取会把
// 仓外夹具读成"文件不存在" ⇒ 语义改变。另 --update-baseline 是写盘操作,读取也必须与
// 即将覆写的同一份磁盘账同面。写回仍用 writeFileSync(取材层只提供读,不提供写)。
import { readWorktreeFile } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_REL = 'scripts/data/cross-end-props-parity-baseline.json'
const EQUIV_KINDS = new Set(['event', 'content', 'style'])

/**
 * 语义等价映射表体检(只认「同一槽位两端命名不同」;行为缺口由人审不入表):
 * 必填字段齐 + kind 合法 + 重复条目 + evidence 双端落点。
 * evidence 两种写法:
 *   · `文件:行`(旧写法,兼容保留):该行真含符号 ⇒ 通过;行号因插注释/挪块漂移 ⇒ 按符号名
 *     在文件内**按声明形态**重定位(上移/下移/中间插注释不再误红),重定位不到 ⇒ 判红;
 *   · `文件#符号名`(新写法):直接按声明形态定位,不写死行号 —— 根治"加注释即红"。
 * 强度不打折:文件不存在/读不到、符号真的不存在(只在注释里出现也不算)一律判红;
 * 读不到按门的三态纪律点名,不冒充"没有差"。
 * 任何一条不合格 ⇒ 门判红(映射表是判据输入,坏表 = 静默洗白通道)。
 */
const EVIDENCE_SPEC_RE = /^([^\s:#]+)(?:#([A-Za-z_$][\w$]*)|:(\d+))$/

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 逐行剥注释(保留行结构与字符串内的 `//`);块注释状态跨行推进。 */
export function stripComments(lines) {
  const out = []
  let inBlock = false
  for (const raw of lines) {
    let text = ''
    let quote = null
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i]
      if (inBlock) {
        if (ch === '*' && raw[i + 1] === '/') {
          inBlock = false
          i++
        }
        continue
      }
      if (quote) {
        text += ch
        if (ch === '\\') {
          if (i + 1 < raw.length) text += raw[++i]
        } else if (ch === quote) quote = null
        continue
      }
      if (ch === '/' && raw[i + 1] === '/') break
      if (ch === '/' && raw[i + 1] === '*') {
        inBlock = true
        i++
        continue
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch
        text += ch
        continue
      }
      text += ch
    }
    out.push(text)
  }
  return out
}

/**
 * 按"声明形态"在文件内找符号,返回 1-based 行号(找不到 = 0)。
 * 认的形态:类型/接口字段(`name?: T`)、类型/函数/常量声明(`type|interface|function|const|let|var|class name`)、
 * 方法签名(`name(`)、解构/简写字段(`name,` `name =` `name }`)。
 * 注释里出现的同名不算声明(防注释洗白);按行取第一个命中。
 */
export function findDeclarationLine(lines, symbol) {
  if (typeof symbol !== 'string' || !symbol) return 0
  const s = escapeRe(symbol)
  const shapes = [
    new RegExp(`^\\s*(?:readonly\\s+|public\\s+|private\\s+|protected\\s+|static\\s+|declare\\s+)*${s}\\s*[?!]?\\s*:`),
    new RegExp(
      `^\\s*(?:export\\s+)?(?:declare\\s+)?(?:default\\s+)?(?:async\\s+)?(?:function|const|let|var|type|interface|class|enum|namespace)\\s+${s}\\b`,
    ),
    new RegExp(`^\\s*(?:public\\s+|private\\s+|protected\\s+|static\\s+|async\\s+|get\\s+|set\\s+)*${s}\\s*(?:<[^>]*>)?\\s*\\(`),
    new RegExp(`^\\s*${s}\\s*[,\\}=]`),
    new RegExp(`(?:const|let|var)\\s*\\{[^}]*\\b${s}\\b`),
  ]
  const code = stripComments(lines)
  for (let i = 0; i < code.length; i++) {
    if (!code[i].trim()) continue
    if (shapes.some((re) => re.test(code[i]))) return i + 1
  }
  return 0
}

/**
 * 单条证据落点解析。返回 {ok, rel, line, moved} 或 {ok:false, problem}。
 * 旧 `文件:行` 先按原行匹配(与旧判据强度一致),未命中再按声明形态重定位并回报 moved。
 */
export function resolveEvidence(rootDir, raw, symbol) {
  const m = typeof raw === 'string' ? raw.trim().match(EVIDENCE_SPEC_RE) : null
  if (!m) return { ok: false, problem: '必须形如 文件:行 或 文件#符号名' }
  const rel = m[1]
  let text
  try {
    text = readWorktreeFile(rootDir, rel)
  } catch {
    return { ok: false, problem: `文件读不到 ${rel}(不记绿)` }
  }
  if (text === null) return { ok: false, problem: `文件不存在 ${rel}` }
  const lines = text.split(/\r?\n/)
  const token = typeof symbol === 'string' ? symbol : ''
  const code = stripComments(lines)
  if (m[2]) {
    const ln = findDeclarationLine(lines, m[2])
    if (!ln) return { ok: false, problem: `全文件按声明形态未找到 ${m[2]}(${rel}#${m[2]})` }
    return { ok: true, rel, line: ln, moved: false }
  }
  const ln = Number(m[3])
  if (ln >= 1 && ln <= lines.length && token && new RegExp(`\\b${escapeRe(token)}\\b`).test(code[ln - 1]))
    return { ok: true, rel, line: ln, moved: false }
  const hit = token ? findDeclarationLine(lines, token) : 0
  if (hit) return { ok: true, rel, line: hit, moved: true }
  if (ln < 1 || ln > lines.length)
    return { ok: false, problem: `行号越界 ${rel}:${ln}(共 ${lines.length} 行),且全文件未找到 ${token} 声明` }
  return { ok: false, problem: `${rel}:${ln} 未见 ${token} 声明,全文件按声明形态亦未命中(符号真不存在)` }
}

export function validateEquivalence(table, rootDir = ROOT) {
  const bad = []
  if (!table || !Array.isArray(table.entries)) return ['映射表结构坏:缺少 entries 数组']
  const seen = new Set()
  table.entries.forEach((e, i) => {
    const at = `entries[${i}](${e?.pair ?? '?'})`
    for (const f of ['pair', 'ours', 'theirs', 'owner', 'rationale'])
      if (typeof e?.[f] !== 'string' || !e[f].trim()) bad.push(`${at}: 缺 ${f}(必填)`)
    if (!EQUIV_KINDS.has(e?.kind)) bad.push(`${at}: kind=${String(e?.kind)} 不在 event|content|style`)
    const key = `${e?.pair}|${e?.ours}|${e?.theirs}`
    if (seen.has(key)) bad.push(`${at}: 重复条目 ${key}`)
    seen.add(key)
    for (const side of ['rn', 'mini']) {
      const token = side === 'rn' ? e.ours : e.theirs
      const r = resolveEvidence(rootDir, e?.evidence?.[side], token)
      if (!r.ok) bad.push(`${at}: evidence.${side} ${r.problem}`)
    }
  })
  return bad
}

const RULING_WHY_MIN = 24

/**
 * 逐键裁决台账(scripts/data/cross-end-props-judged.json):把「已登记平台/承载差异」的单键从存差
 * 移入 judged 桶。口径:
 *   存差 = 未实现 + 未映射 + 未裁决
 * 因此 judged 键仍逐条审计(owner/expires/evidence≥2 条/rationale),且:
 *   · 证据必须双端落点(每条 ≥1 侧),且至少一条在键的声明侧真含该键名(防拿两枚无关行凑数);
 *   · 同一 pair|key 不得重复裁决;不得与映射表同键(一键两归 = 判红);
 *   · 键已不在漂移集仍留在台账 = 判红(会吞掉以后同键的漂移,必须撤销条目);
 *   · 过期 / 缺字段 / 证据不足 = 坏裁决,判红且 --update-baseline 拒写。
 */
export const JUDGED_REL = 'scripts/data/cross-end-props-judged.json'
const END_ROOTS = { rn: ['apps/mobile-rn/', 'packages/app/'], mini: ['apps/miniapp-taro/'] }

function parseEvidencePoint(raw) {
  const m = typeof raw === 'string' ? raw.match(/^([^\s:]+):(\d+)(?:-(\d+))?$/) : null
  if (!m) return null
  return { rel: m[1], start: Number(m[2]), end: m[3] ? Number(m[3]) : Number(m[2]) }
}

/** 逐键裁决体检:结构 + owner/expires/rationale + 证据双端落点 + 声明侧真含键名。 */
export function validateJudged(ledger, { now = new Date(), rootDir = ROOT } = {}) {
  const bad = []
  if (!ledger || !Array.isArray(ledger.entries)) return { ok: false, bad: ['裁决台账结构坏:缺少 entries 数组'] }
  const seen = new Set()
  ledger.entries.forEach((e, i) => {
    const at = `entries[${i}](${e?.pair ?? '?'}/${e?.key ?? '?'})`
    for (const f of ['pair', 'key', 'owner', 'rationale'])
      if (typeof e?.[f] !== 'string' || !e[f].trim()) bad.push(`${at}: 缺 ${f}(必填)`)
    if (!['rn', 'mini'].includes(e?.side)) bad.push(`${at}: side=${String(e?.side)} 不在 rn|mini`)
    if (typeof e?.rationale === 'string' && e.rationale.trim().length < RULING_WHY_MIN)
      bad.push(`${at}: rationale 过短(< ${RULING_WHY_MIN} 字)`)
    const expiresRaw = typeof e?.expires === 'string' ? e.expires.trim() : ''
    const expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(expiresRaw) ? new Date(`${expiresRaw}T23:59:59`) : null
    if (!expiresAt || Number.isNaN(expiresAt.getTime())) bad.push(`${at}: 缺 expires(YYYY-MM-DD)`)
    else if (expiresAt.getTime() < now.getTime()) bad.push(`${at}: expires 已到期(${expiresRaw})`)
    const dedupe = `${e?.pair}|${e?.key}`
    if (seen.has(dedupe)) bad.push(`${at}: 重复裁决 ${dedupe}(一键两账)`)
    seen.add(dedupe)
    const evidence = Array.isArray(e?.evidence) ? e.evidence : []
    if (evidence.length < 2) bad.push(`${at}: evidence 不足 2 条(已能量出的单键差异不得用单条证据裁决)`)
    const ends = new Set()
    let declarationHit = false
    for (const raw of evidence) {
      const p = parseEvidencePoint(raw)
      if (!p) {
        bad.push(`${at}: evidence 不是 文件:行 形态:${String(raw)}`)
        continue
      }
      if (p.start < 1 || p.start > p.end) {
        bad.push(`${at}: evidence 行号非法:${raw}`)
        continue
      }
      let text
      try {
        text = readWorktreeFile(rootDir, p.rel)
      } catch {
        bad.push(`${at}: evidence 读不到:${p.rel}`)
        continue
      }
      if (text === null) {
        bad.push(`${at}: evidence 文件不存在:${p.rel}`)
        continue
      }
      const lines = text.split(/\r?\n/)
      if (p.end > lines.length) {
        bad.push(`${at}: evidence 行号越界:${raw}(共 ${lines.length} 行)`)
        continue
      }
      for (const [end, roots] of Object.entries(END_ROOTS))
        if (roots.some((r) => p.rel.startsWith(r))) ends.add(end)
      if (typeof e?.key === 'string' && new RegExp(`\\b${e.key}\\b`).test(lines[p.start - 1])) declarationHit = true
    }
    if (ends.size < 2) bad.push(`${at}: evidence 未覆盖双端(需 rn 与 mini 各至少 1 条)`)
    if (!declarationHit) bad.push(`${at}: evidence 无一条落在声明侧且真含键名 ${String(e?.key)}`)
  })
  return { ok: bad.length === 0, bad }
}

/**
 * 把 judge 命中的键从存差里剔除(纯函数,镜像测试直接喂 pairDelta 同形对象)。
 * 只认 side 对应的 onlyRn/onlyMini;键不复现 = judged-stale(判红,不许留账吞未来漂移)。
 * 与映射表同键 = 一键两归;未在册对 = judged-unknown-pair。
 */
export function applyJudged(deltas, judgedEntries = [], equivalenceEntries = []) {
  const byPair = new Map()
  for (const e of judgedEntries) {
    if (!e?.pair || !e?.key) continue
    if (!byPair.has(e.pair)) byPair.set(e.pair, [])
    byPair.get(e.pair).push(e)
  }
  const bad = []
  const applied = []
  const adjusted = deltas.map((d) => {
    const rulings = byPair.get(d.name)
    if (!rulings || d.state === 'undetermined') {
      if (rulings && d.state === 'undetermined')
        bad.push({ pair: d.name, kind: 'judged-on-undetermined', detail: '该对未判定,不得用逐键裁决冒充对齐' })
      return { ...d }
    }
    const mappedKeys = new Set(
      equivalenceEntries.filter((x) => x?.pair === d.name).flatMap((x) => [x.ours, x.theirs]),
    )
    const dropRn = new Set()
    const dropMini = new Set()
    for (const r of rulings) {
      if (mappedKeys.has(r.key))
        bad.push({
          pair: d.name,
          kind: 'judged-mapped-double-count',
          detail: `键 ${r.key} 同时出现在映射表与裁决台账(一键两归)`,
        })
      const inRn = (d.onlyRn ?? []).includes(r.key)
      const inMini = (d.onlyMini ?? []).includes(r.key)
      if (r.side === 'rn' ? !inRn : !inMini)
        bad.push({
          pair: d.name,
          kind: 'judged-stale',
          detail: `裁决键 ${r.key}(${r.side}) 已不在本轮漂移集 —— 撤销条目,否则会吞掉同键未来漂移`,
        })
      if (r.side === 'rn') dropRn.add(r.key)
      else dropMini.add(r.key)
      applied.push({ pair: d.name, key: r.key, side: r.side, owner: r.owner, expires: r.expires })
    }
    const onlyRn = (d.onlyRn ?? []).filter((k) => !dropRn.has(k))
    const onlyMini = (d.onlyMini ?? []).filter((k) => !dropMini.has(k))
    return { ...d, onlyRn, onlyMini, judged: rulings.map((r) => r.key), driftTotal: onlyRn.length + onlyMini.length + (d.reqDrift?.length ?? 0) }
  })
  for (const name of byPair.keys())
    if (!deltas.some((d) => d.name === name))
      bad.push({ pair: name, kind: 'judged-unknown-pair', detail: '裁决台账里的对不在本轮配对集(改名/拆族/消失)' })
  return { deltas: adjusted, applied, bad }
}

/** --update-baseline 前置闸:坏裁决一律拒写(不许借重落账把坏裁决冲成 ok)。 */
export function updateGuard({ judgedLedger, deltas, equivalenceEntries, now, rootDir = ROOT }) {
  const v = validateJudged(judgedLedger, { now, rootDir })
  const a = v.ok ? applyJudged(deltas, judgedLedger.entries, equivalenceEntries) : { bad: [], deltas }
  return { ok: v.ok && a.bad.length === 0, bad: [...v.bad, ...a.bad.map((b) => `${b.pair}:${b.kind} ${b.detail}`)] }
}

/**
 * 台账 not-applicable 裁决校验:三字段(owner/expires/evidence)+ why + 证据落点。
 * 只有 ok 才允许把该对记成"已裁决";可测对(measurable)还要求 ≥2 条证据覆盖双端。
 * 否则裁决无效、仍按 undetermined 点名 / 可测对直接判红
 * (§0.3:不得把"没读到"洗成"判过了",也不得把单键缺口洗成整对不适用)。
 * evidence 形如 `仓库相对路径:行`(可带 `-行` 区间)。
 */
export function validateNotApplicable(entry, { now = new Date(), rootDir = ROOT, measurable = false } = {}) {
  const problems = []
  if (!entry || entry.state !== 'not-applicable') problems.push('state 必须是 not-applicable')
  const owner = typeof entry?.owner === 'string' ? entry.owner.trim() : ''
  if (!owner) problems.push('缺 owner')
  const expiresRaw = typeof entry?.expires === 'string' ? entry.expires.trim() : ''
  const expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(expiresRaw) ? new Date(`${expiresRaw}T23:59:59`) : null
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) problems.push('缺 expires(YYYY-MM-DD)')
  else if (expiresAt.getTime() < now.getTime()) problems.push(`expires 已到期(${expiresRaw})`)
  const why = typeof entry?.why === 'string' ? entry.why.trim() : ''
  if (!why) problems.push('缺 why(为什么不构成对账对象)')
  else if (why.length < RULING_WHY_MIN) problems.push(`why 过短(< ${RULING_WHY_MIN} 字):不得只写一句理由`)
  const evidence = Array.isArray(entry?.evidence) ? entry.evidence : []
  if (evidence.length === 0) problems.push('缺 evidence(仓库内 文件:行)')
  else if (measurable && evidence.length < 2)
    problems.push('已能量出的对至少要 2 条证据(整对不适用必须双端落点,单条不足以否掉一个可测对)')
  for (const raw of evidence) {
    const m = typeof raw === 'string' ? raw.match(/^([^\s:]+):(\d+)(?:-(\d+))?$/) : null
    if (!m) {
      problems.push(`evidence 不是 文件:行 形态:${String(raw)}`)
      continue
    }
    let text
    try {
      text = readWorktreeFile(rootDir, m[1])
    } catch {
      problems.push(`evidence 读不到:${m[1]}`)
      continue
    }
    if (text === null) {
      problems.push(`evidence 文件不存在:${m[1]}`)
      continue
    }
    const lines = text.split(/\r?\n/).length
    const start = Number(m[2])
    const end = m[3] ? Number(m[3]) : start
    if (start < 1 || start > end || end > lines) problems.push(`evidence 行号越界:${raw}(文件共 ${lines} 行)`)
  }
  return { ok: problems.length === 0, problems }
}

const argv = process.argv.slice(2)
const jsonMode = argv.includes('--json')
const quietMode = argv.includes('--quiet')
const stagedMode = argv.includes('--staged')
const worktreeMode = argv.includes('--worktree')
const updateMode = argv.includes('--update-baseline')

if (process.env.HUSKY_SKIP_CROSS_END_PROPS_PARITY) {
  console.log('⏭️ skipped: HUSKY_SKIP_CROSS_END_PROPS_PARITY set')
  process.exit(0)
}
const log = (...a) => {
  if (!jsonMode && !quietMode) console.log(...a)
}
const die = (msg, code = 1) => {
  console.error(`❌ ${msg}`)
  process.exit(code)
}

/** 与引擎 pairDelta 输出对齐的纯判定(台账 vs 本轮):返回 {bad:[], warn:[], shrunk:[], adjudicated:[]} */
export function verifyAgainstBaseline(deltas, baseline, opts = {}) {
  const bad = []
  const warn = []
  const shrunk = []
  const adjudicated = []
  const book = baseline?.pairs ?? {}
  for (const d of deltas) {
    const e = book[d.name]
    const measured = d.state !== 'undetermined'
    // pair-level 裁决优先:有效 ⇒ 已裁决(可测对也整对剔除存量);无效 ⇒ undetermined 点名 / 可测对判红
    if (e?.state === 'not-applicable') {
      const v = validateNotApplicable(e, { now: opts.now, rootDir: opts.rootDir, measurable: measured })
      if (v.ok) {
        adjudicated.push({
          pair: d.name,
          owner: e.owner,
          expires: e.expires,
          why: e.why,
          measurable: measured,
          driftKeys: measured ? (d.driftTotal ?? 0) : 0,
        })
        continue
      }
      if (!measured) {
        warn.push({
          pair: d.name,
          kind: 'undetermined',
          why: `${d.reason} · 台账 not-applicable 裁决无效:${v.problems.join(';')}`,
        })
        continue
      }
      bad.push({
        pair: d.name,
        kind: 'invalid-not-applicable-ruling',
        detail: `台账 not-applicable 裁决无效(${v.problems.join(';')});本轮已能量出 ${d.driftTotal ?? 0} 处差 —— 裁决不得洗绿,先修裁决或改回 ok`,
      })
      continue
    }
    if (!measured) {
      warn.push({ pair: d.name, kind: 'undetermined', why: d.reason })
      continue
    }
    if (!e) {
      const driftish = (d.onlyRn?.length ?? 0) + (d.onlyMini?.length ?? 0) + (d.reqDrift?.length ?? 0)
      if (driftish > 0)
        bad.push({
          pair: d.name,
          kind: 'unregistered-new-pair',
          detail: `全新同名对带 ${driftish} 处差进仓而台账没记(静默入账=没人裁决过这一对)`,
        })
      else warn.push({ pair: d.name, kind: 'unregistered-clean-pair', why: '无差且台账未记,建议 --update-baseline 落账' })
      continue
    }
    if (e.state === 'undetermined') {
      warn.push({ pair: d.name, kind: 'booked-undetermined-now-parseable', why: '台账记的是未判定,本轮已能量出 —— 可收紧台账' })
      continue
    }
    const baseRn = new Set(e.onlyRn ?? [])
    const baseMini = new Set(e.onlyMini ?? [])
    const baseDrift = new Set(e.reqDrift ?? [])
    const newRn = (d.onlyRn ?? []).filter((k) => !baseRn.has(k))
    const newMini = (d.onlyMini ?? []).filter((k) => !baseMini.has(k))
    const newDrift = (d.reqDrift ?? []).filter((k) => !baseDrift.has(k))
    if (newRn.length || newMini.length || newDrift.length) {
      bad.push({
        pair: d.name,
        kind: 'new-drift-keys',
        detail: `新增: rn侧独有不消费腿 [${newRn}] · mini侧 [${newMini}] · 必选性漂移 [${newDrift}]`,
      })
    }
    const goneRn = [...baseRn].filter((k) => !(d.onlyRn ?? []).includes(k))
    const goneMini = [...baseMini].filter((k) => !(d.onlyMini ?? []).includes(k))
    if (goneRn.length || goneMini.length) shrunk.push({ pair: d.name, goneRn, goneMini })
  }
  const live = new Set(deltas.map((d) => d.name))
  for (const k of Object.keys(book)) if (!live.has(k)) warn.push({ pair: k, kind: 'book-stale', why: '在册对本轮不在配对集(改名/拆族/可达性变化) ⇒ 复核台账,不冒红' })
  // 映射表棘轮:条目增长必须与漂移下降同轮出现(防拿映射洗白真缺口)
  const nowEntries = opts.equivalenceEntryCount ?? 0
  const prevEntries = baseline?.counts?.equivalenceEntries ?? 0
  const grow = nowEntries - prevEntries
  if (grow > 0) {
    // 已裁决不适用对不计入存量口径(与计数口径一致,否则整对剔除会被误读成"漂移下降")
    const adj = new Set(adjudicated.map((a) => a.pair))
    const nowDrift = deltas.reduce((s, d) => s + (adj.has(d.name) ? 0 : (d.driftTotal ?? 0)), 0)
    const prevDrift = baseline?.counts?.rawDriftKeysTotal ?? baseline?.counts?.driftKeysTotal
    const drop = typeof prevDrift === 'number' ? prevDrift - nowDrift : 0
    if (drop < grow)
      bad.push({
        pair: '(equivalence)',
        kind: 'equivalence-growth-without-convergence',
        detail: `映射表 +${grow} 条仅换来存量 -${drop} 键 —— 条目增长必须与漂移减少同轮(行为缺口不得入表)`,
      })
  }
  for (const d of deltas)
    for (const s of d.mappedStale ?? [])
      warn.push({
        pair: d.name,
        kind: 'equivalence-stale',
        why: `映射 ${s.ours}↔${s.theirs} 未生效(${s.why}) ⇒ 复核条目并删除或修证据`,
      })
  return { bad, warn, shrunk, adjudicated }
}

export function buildBaselineEntry(d, previous) {
  if (d.state === 'undetermined') {
    // 人工裁决不随 --update-baseline 被冲回"未判定":只能显式撤销(删条目或改成可测的 ok)
    if (previous?.state === 'not-applicable') return previous
    return { state: 'undetermined', reason: d.reason }
  }
  return {
    state: 'ok',
    onlyRn: d.onlyRn ?? [],
    onlyMini: d.onlyMini ?? [],
    reqDrift: d.reqDrift ?? [],
    mapped: (d.mapped ?? []).map((m) => ({ ours: m.ours, theirs: m.theirs, kind: m.kind })),
    driftTotal: d.driftTotal ?? 0,
  }
}

async function main() {
  if (stagedMode && worktreeMode) die('未判定:--staged 与 --worktree 同给,取材面不明(§0.4 不回落另一个面)', 2)
  const face = worktreeMode ? 'worktree' : stagedMode ? 'staged' : 'head'
  if (worktreeMode) die('提示:--worktree 仅人工逃生舱;提交链/守护一律 head|staged(§0.4)', 2)

  if (argv.includes('--self-test')) return selfTest()

  const par = await computeParity(ROOT, face)
  if (par.state !== 'ok') die(`未判定:${par.reason} —— 不记绿也不冒红`, 2)

  let equivTable
  try {
    const text = readWorktreeFile(ROOT, EQUIVALENCE_REL)
    if (text === null) throw new Error('文件不存在')
    equivTable = JSON.parse(text)
  } catch (e) {
    die(`映射表 ${EQUIVALENCE_REL} 读不到或 JSON 坏:${String(e?.message).slice(0, 120)} —— 判据输入缺失不记绿`, 2)
  }
  const equivBad = validateEquivalence(equivTable)
  if (equivBad.length) die(`映射表体检失败 ${equivBad.length} 处:${equivBad.join(' · ')}`, 1)
  const equivalenceEntryCount = par.equivalence?.entryCount ?? equivTable.entries.length

  let judgedLedger = { rule: '', entries: [] }
  try {
    const text = readWorktreeFile(ROOT, JUDGED_REL)
    if (text !== null) judgedLedger = JSON.parse(text)
  } catch (e) {
    die(`裁决台账 ${JUDGED_REL} 读不到或 JSON 坏:${String(e?.message).slice(0, 120)} —— 判据输入缺失不记绿`, 2)
  }
  const judgedValid = validateJudged(judgedLedger, { now: new Date(), rootDir: ROOT })
  if (!judgedValid.ok)
    die(`坏裁决 ${judgedValid.bad.length} 处(证据不足/过期/一键两归/字段缺失):${judgedValid.bad.slice(0, 8).join(' · ')}`, 1)
  // 存差 = 未实现 + 未映射 + 未裁决:judged 命中的键从本轮存差剔除,但台账逐键留审、键不入映射
  const judgedApply = applyJudged(par.deltas, judgedLedger.entries, equivTable.entries)
  if (judgedApply.bad.length)
    die(
      `坏裁决 ${judgedApply.bad.length} 处:${judgedApply.bad.map((b) => `${b.pair}:${b.kind} ${b.detail}`).join(' · ')}`,
      1,
    )
  const liveDeltas = judgedApply.deltas

  const baselineText = readWorktreeFile(ROOT, BASELINE_REL)
  const baselineExists = baselineText !== null
  let prior = { pairs: {} }
  if (baselineExists) {
    try {
      prior = JSON.parse(baselineText)
    } catch {
      // 坏账不阻断重落;旧裁决无从保留,下面逐对按本轮形态记账
    }
  }
  if (updateMode) {
    // 有效 pair-level 裁决(undetermined 或 已能量出的整对不适用)都不算"未判定",且必须原样保留;
    // 可测对的坏裁决拒写(不许借重落账把坏裁决冲成 ok)
    const keptRulings = new Set(
      par.deltas
        .filter((d) => prior?.pairs?.[d.name]?.state === 'not-applicable')
        .filter((d) => validateNotApplicable(prior.pairs[d.name], { measurable: d.state !== 'undetermined' }).ok)
        .map((d) => d.name),
    )
    const brokenRulings = par.deltas.filter(
      (d) =>
        d.state !== 'undetermined' &&
        prior?.pairs?.[d.name]?.state === 'not-applicable' &&
        !validateNotApplicable(prior.pairs[d.name], { measurable: true }).ok,
    )
    if (brokenRulings.length)
      die(
        `拒写基线:${brokenRulings.map((d) => d.name).join(', ')} 的 not-applicable 裁决无效 —— 不得用重落账把坏裁决冲成 ok`,
        2,
      )
    const undetAdjudicated = [...keptRulings].filter(
      (n) => par.deltas.find((d) => d.name === n)?.state === 'undetermined',
    ).length
    const unresolvedUndet = par.deltas.filter((d) => d.state === 'undetermined').length - undetAdjudicated
    if (par.deltas.length > 0 && unresolvedUndet / par.deltas.length > 0.5)
      die(`拒写基线:${unresolvedUndet}/${par.deltas.length} 对未判定 —— 多半是编译面瞬时取不到,不得把"没读到"誊进台账冒充"判过"`, 2)
    const live = liveDeltas.filter((d) => !keptRulings.has(d.name))
    // 重落账前置:坏裁决/失效裁决一律拒写(--update-baseline 不得吞掉判红)
    const guard = updateGuard({ judgedLedger, deltas: par.deltas, equivalenceEntries: equivTable.entries })
    if (!guard.ok) die(`拒写基线:坏裁决 ${guard.bad.length} 处 —— ${guard.bad.slice(0, 6).join(' · ')}`, 2)
    const out = {
      generatedAt: new Date().toISOString(),
      face,
      rule: '差值棘轮:在册集合只减不增;新键/新对未入账=红;undetermined=warn 点名(有效 not-applicable 裁决除外)。已能量出的整对不适用亦按 pair-level 裁决剔除存量。存差=未实现+未映射+未裁决,逐键 judged 台账仅移出存差、不入映射、逐条留审(owner/expires/evidence≥2/rationale),坏裁决/过期/一键两归/失效裁决=红且拒写。升绝对零前置=存差归零。',
      pairs: {},
      counts: {
        pairs: par.deltas.length,
        drifted: live.filter((d) => d.state === 'ok' && d.driftTotal > 0).length,
        aligned: live.filter((d) => d.state === 'ok' && d.driftTotal === 0).length,
        undetermined: unresolvedUndet,
        notApplicable: keptRulings.size,
        maxKeyDrift: live.length ? Math.max(0, ...live.map((d) => d.driftTotal ?? 0)) : 0,
        driftKeysTotal: live.reduce((s, d) => s + (d.driftTotal ?? 0), 0),
        judgedKeysTotal: judgedApply.applied.length,
        rawDriftKeysTotal: live.reduce((s, d) => s + ((d.onlyRn?.length ?? 0) + (d.onlyMini?.length ?? 0) + (d.reqDrift?.length ?? 0)), 0),
        adjudicatedDriftKeys: par.deltas
          .filter((d) => keptRulings.has(d.name))
          .reduce((s, d) => s + (d.driftTotal ?? 0), 0),
        mappedKeysTotal: par.deltas.reduce((s, d) => s + (d.mappedKeyCount ?? 0), 0),
        equivalenceEntries: equivalenceEntryCount,
      },
    }
    for (const d of par.deltas)
      out.pairs[d.name] = keptRulings.has(d.name) ? prior.pairs[d.name] : buildBaselineEntry(d, prior?.pairs?.[d.name])
    writeFileSync(join(ROOT, BASELINE_REL), JSON.stringify(out, null, 2) + '\n', 'utf8')
    log(`✅ 基线已落账 → ${BASELINE_REL}(pairs=${out.counts.pairs} 含差=${out.counts.drifted} 未判定=${out.counts.undetermined} 裁决不适用=${out.counts.notApplicable} 存差键=${out.counts.driftKeysTotal} judged=${out.counts.judgedKeysTotal})`)
    process.exit(0)
  }
  if (!baselineExists)
    die(`台账 ${BASELINE_REL} 不存在 —— 首跑请用 --update-baseline 落账(拒绝用隐式空账冒充"全对齐")`, 2)
  let baseline
  try {
    baseline = JSON.parse(baselineText)
  } catch (e) {
    die(`台账 ${BASELINE_REL} 坏:${String(e?.message).slice(0, 120)} —— 判不出不记绿(§0.3)`, 2)
  }

  const { bad, warn, shrunk, adjudicated } = verifyAgainstBaseline(par.deltas, baseline, { equivalenceEntryCount })
  const adj = new Set(adjudicated.map((a) => a.pair))
  const live = liveDeltas.filter((d) => !adj.has(d.name))
  const counts = {
    pairs: par.deltas.length,
    drifted: live.filter((d) => d.state === 'ok' && d.driftTotal > 0).length,
    undetermined: par.deltas.filter((d) => d.state === 'undetermined' && !adj.has(d.name)).length,
    notApplicable: adjudicated.length,
    adjudicatedDriftKeys: adjudicated.reduce((s, a) => s + (a.driftKeys ?? 0), 0),
    driftKeysTotal: live.reduce((s, d) => s + (d.driftTotal ?? 0), 0),
    judgedKeysTotal: judgedApply.applied.length,
    rawDriftKeysTotal: live.reduce((s, d) => s + ((d.onlyRn?.length ?? 0) + (d.onlyMini?.length ?? 0) + (d.reqDrift?.length ?? 0)), 0),
    mappedKeysTotal: par.deltas.reduce((s, d) => s + (d.mappedKeyCount ?? 0), 0),
    equivalenceEntries: equivalenceEntryCount,
    newBad: bad.length,
    warnCount: warn.length,
    shrunkPairs: shrunk.length,
  }
  if (jsonMode) console.log(JSON.stringify({ face, counts, bad, warn, shrunk, adjudicated, judged: judgedApply.applied }, null, 1))
  else {
    log(`🧩 两端同名组件 props 对账(守门 288,差值棘轮;面=${face})`)
    log(
      `  配对 ${counts.pairs} · 存差 ${counts.drifted} 对/${counts.driftKeysTotal} 键 · 已裁决 judged ${counts.judgedKeysTotal} 键 · 映射等价 ${counts.mappedKeysTotal} 键(表 ${counts.equivalenceEntries} 条) · 未判定 ${counts.undetermined}${counts.notApplicable ? ` · 已裁决不适用 ${counts.notApplicable}(另 ${counts.adjudicatedDriftKeys} 键整对外置)` : ''} · 本轮新增退化 ${bad.length}`,
    )
    for (const d of par.deltas)
      for (const m of d.mapped ?? []) log(`  ≡ 语义等价 ${d.name}:rn[${m.ours}]↔mini[${m.theirs}](${m.kind})`)
    for (const a of adjudicated)
      log(`  ⚪ ${a.pair}(not-applicable${a.measurable ? `,整对外置 ${a.driftKeys} 键` : ''}): owner=${a.owner} expires=${a.expires} —— ${a.why}`)
    for (const j of judgedApply.applied)
      log(`  🧾 judged ${j.pair}:${j.key}(${j.side}) owner=${j.owner} expires=${j.expires}`)
    for (const b of bad) log(`  🔴 ${b.pair}(${b.kind}):${b.detail ?? b.why ?? ''}`)
    for (const w of warn) log(`  ⚠️ ${w.pair}(${w.kind}):${w.why ?? ''}`)
    for (const s of shrunk) log(`  ✅ 收敛 ${s.pair}: 已消键 rn[${s.goneRn}] mini[${s.goneMini}] —— 复核后可 --update-baseline 收紧`)
    if (!bad.length && !warn.length) log('  ✅ 无新增退化,台账在册键集未见扩大')
  }
  if (bad.length) die(`新增退化 ${bad.length} 处 —— 修腿或(确属两端有意分形)在 commit message 写明后 --update-baseline 落账`, 1)
  process.exit(0)
}

/** 自检:纯判据正反例(deltas 直接构造 pairDelta 同形对象,不重建类型面;镜像测试 import 同一条判据,§22c 不复刻) */
function selfTest() {
  const d = (name, extra = {}) => ({ name, state: 'ok', onlyRn: [], onlyMini: [], reqDrift: [], driftTotal: 0, ...extra })
  const base = {
    pairs: {
      Foo: { state: 'ok', onlyRn: ['onBar'], onlyMini: [], reqDrift: [] },
      U: { state: 'undetermined', reason: '上一台账周期编译面取不到' },
      ZZ: { state: 'ok', onlyRn: [], onlyMini: [], reqDrift: [] },
    },
  }
  const checks = []
  const t = (label, cond) => checks.push([label, cond])
  // 在册键复刻 ⇒ 绿
  t('在册键无新增=绿', verifyAgainstBaseline([d('Foo', { onlyRn: ['onBar'], driftTotal: 1 })], base).bad.length === 0)
  // 新键 ⇒ 红且点名
  t('新增 rn 独有不消费腿=红', (() => { const v = verifyAgainstBaseline([d('Foo', { onlyRn: ['onBar', 'onZonk'], driftTotal: 2 })], base); return v.bad.length === 1 && v.bad[0].pair === 'Foo' && v.bad[0].detail.includes('onZonk') })())
  // 键集缩小(收敛)⇒ 绿 + shrunk 提示
  t('消键收敛=绿与提示', (() => { const v = verifyAgainstBaseline([d('Foo')], base); return v.bad.length === 0 && v.shrunk.length === 1 })())
  // 全新对带差未入账 ⇒ 红;全新对无差 ⇒ 绿(建议落账)
  t('新对带差未入账=红', verifyAgainstBaseline([d('Brand', { onlyRn: ['a'], driftTotal: 1 })], base).bad.length === 1)
  t('新对无差=绿', verifyAgainstBaseline([d('CleanNew')], base).bad.length === 0)
  // 本轮 undetermined ⇒ warn 不红(在册与不在册同此);基线里 ZZ 不在本轮 ⇒ book-stale 也算 warn,只断言"无红 + U/N 都被点名"
  t('未判定=warn 不红', (() => { const v = verifyAgainstBaseline([{ name: 'U', state: 'undetermined', reason: '本轮取不到' }, { name: 'N', state: 'undetermined', reason: '新族取不到' }], base); return v.bad.length === 0 && v.warn.some((w) => w.pair === 'U' && w.kind === 'undetermined') && v.warn.some((w) => w.pair === 'N')})())
  // 在册对消失 ⇒ book-stale warn 不红
  t('台账腐烂=warn 不红', (() => { const v = verifyAgainstBaseline([d('Foo')], { pairs: { Foo: base.pairs.Foo, Gone: { state: 'ok', onlyRn: [], onlyMini: [], reqDrift: [] } } }); return v.bad.length === 0 && v.warn.some((w) => w.kind === 'book-stale' && w.pair === 'Gone') })())
  // 映射表棘轮:条目增长无同轮收敛 ⇒ 红;同轮收敛 ⇒ 绿
  t('映射表扩容无收敛=红', (() => {
    const v = verifyAgainstBaseline([d('Foo', { onlyRn: ['onBar'], driftTotal: 1 })], { pairs: base.pairs, counts: { equivalenceEntries: 0, driftKeysTotal: 1 } }, { equivalenceEntryCount: 2 })
    return v.bad.length === 1 && v.bad[0].kind === 'equivalence-growth-without-convergence'
  })())
  t('映射表扩容同轮收敛=绿', (() => {
    const v = verifyAgainstBaseline([d('Foo', { driftTotal: 0 })], { pairs: base.pairs, counts: { equivalenceEntries: 0, driftKeysTotal: 2 } }, { equivalenceEntryCount: 2 })
    return v.bad.length === 0
  })())
  // 映射条目失效 ⇒ warn 点名
  t('映射条目失效=warn 不红', (() => {
    const v = verifyAgainstBaseline([d('Foo', { mappedStale: [{ ours: 'a', theirs: 'b', why: 'declaration-missing' }] })], { pairs: base.pairs })
    return v.bad.length === 0 && v.warn.some((w) => w.kind === 'equivalence-stale')
  })())
  // 证据按符号名定位:声明形态命中真实行;注释里提及同名不算声明;符号真删 ⇒ 0
  const declFile = [
    'export interface X {',
    '  /** 文档注释(不是声明) */',
    '  // banner: 注释里提一嘴',
    '  /** 字段注释 */',
    '  banner: ReadonlyArray<string>',
    '  autoplayInterval?: number',
    '}',
  ]
  t('证据定位:按声明形态命中实际行(上下注释不干扰)', findDeclarationLine(declFile, 'banner') === 5)
  t('证据定位:注释里出现同名 ⇒ 不算声明', findDeclarationLine(['// banner: 已废弃', '/* banner */'], 'banner') === 0)
  t('证据定位:符号真删 ⇒ 0', findDeclarationLine(['export interface X {', '  other: string', '}'], 'banner') === 0)
  // not-applicable 裁决:四件齐全 + 证据落点 ⇒ undetermined 转已裁决;缺字段 ⇒ 裁决无效仍点名
  const ruling = {
    state: 'not-applicable',
    owner: 'cross-end-props-parity',
    expires: '2027-06-30',
    evidence: ['packages/app/src/components/ScreenStates.tsx:70'],
    why: 'ScreenStates 是两端文件基名配上的四组件族容器,文件内无同名组件出口,不能并成单组件 props 键集',
  }
  const fixedNow = { now: new Date('2026-11-03T00:00:00') }
  t('not-applicable 四件齐全+证据落点 ⇒ undetermined 转已裁决', (() => {
    const v = verifyAgainstBaseline([{ name: 'NA', state: 'undetermined', reason: '多组件族' }], { pairs: { NA: ruling } }, fixedNow)
    return v.bad.length === 0 && v.warn.length === 0 && v.adjudicated.length === 1
  })())
  t('not-applicable 缺 owner/expires/evidence ⇒ 裁决无效,仍按 undetermined 点名', (() => {
    const v = verifyAgainstBaseline(
      [{ name: 'NA', state: 'undetermined', reason: '多组件族' }],
      { pairs: { NA: { state: 'not-applicable', why: '不是同名组件' } } },
      fixedNow,
    )
    return v.adjudicated.length === 0 && v.warn.some((w) => w.pair === 'NA' && w.kind === 'undetermined' && /owner|expires|evidence/.test(w.why))
  })())
  // 可测对(同名不同物整对)的 pair-level 裁决:有效 ⇒ 已裁决且剔除存量;无效 ⇒ 判红,不得洗绿
  const measuredRuling = { ...ruling, evidence: [ruling.evidence[0], 'apps/miniapp-taro/src/components/ScreenStates.taro.tsx:47'] }
  t('可测对 + 有效整对裁决 ⇒ 已裁决,存量剔除且不判红', (() => {
    const v = verifyAgainstBaseline([d('FB', { onlyRn: ['a'], onlyMini: ['b'], driftTotal: 2 })], { pairs: { FB: measuredRuling } }, fixedNow)
    return v.bad.length === 0 && v.adjudicated.length === 1 && v.adjudicated[0].measurable === true && v.adjudicated[0].driftKeys === 2
  })())
  t('可测对 + 裁决仅 1 条证据 ⇒ 判红 invalid-not-applicable-ruling', (() => {
    const v = verifyAgainstBaseline(
      [d('FB', { onlyRn: ['a'], driftTotal: 1 })],
      { pairs: { FB: { ...measuredRuling, evidence: [measuredRuling.evidence[0]] } } },
      fixedNow,
    )
    return v.bad.length === 1 && v.bad[0].kind === 'invalid-not-applicable-ruling'
  })())
  t('可测对 + 裁决缺 owner ⇒ 判红(不许把单键缺口洗成整对不适用)', (() => {
    const v = verifyAgainstBaseline(
      [d('FB', { onlyMini: ['b'], driftTotal: 1 })],
      { pairs: { FB: { ...measuredRuling, owner: '' } } },
      fixedNow,
    )
    return v.bad.length === 1 && v.bad[0].kind === 'invalid-not-applicable-ruling'
  })())
  let fails = 0
  for (const [label, cond] of checks) {
    if (!cond) {
      console.error(`✗ self-test:${label}`)
      fails++
    } else console.log(`✅ ${label}`)
  }
  console.log(fails ? `❌ self-test 失败 ${fails}/${checks.length} 例` : `✅ self-test ${checks.length} 例全过`)
  process.exit(fails ? 1 : 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
export const __test__ = {
  verifyAgainstBaseline,
  buildBaselineEntry,
  validateEquivalence,
  validateNotApplicable,
  validateJudged,
  applyJudged,
  updateGuard,
  findDeclarationLine,
  resolveEvidence,
  stripComments,
  JUDGED_REL,
}
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
