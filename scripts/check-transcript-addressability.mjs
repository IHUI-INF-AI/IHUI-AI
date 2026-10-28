#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-679 可寻址性守恒尺（transcript addressability）——**只读**尺子，不在提交链上。
 *
 * 票面（逐字，2026-09-29 立项）：
 *   渲染出来的每个行内动作/按钮，target 必须能被**同一次冷 materialization 的 resolver 精确命中**；
 *   "文本还在但按钮点了必 stale" 是这一型的唯一发现手段；启发式项只报数、崩溃与可寻址失败才判红。
 *   落点 scripts/check-transcript-addressability.mjs（源取 ~/.ihui/audit.jsonl 历史，只读复制）。
 *
 * ── 源数据的真实形状（2026-10-08 现读抽样，不是设想）──────────────────────────────
 * `~/.ihui/audit.jsonl` = 8037 行 / 3,620,070 B，每行一条 JSON，0 行坏 JSON。顶层键只有五种组合：
 *   {timestamp,tool,input,success} / {…,error} / {…,output,durationMs} —— 全部 8037 行都带 `tool` + `input`。
 * `tool` 共 26 种：`permission_lease_*` 合计 6414 行、`tool_call_denied` 772 行（这两族占了 8037 行的 89%）；
 * 其余 851 行才是通常"渲染成一行行内动作"的那些 —— read_file(382)/edit_file(174)/glob(68)/
 * run_command(58)/write_file(56)/list_dir(46)/grep(22)/todo_write(13)/git_add(9)/batch_edit(7)/
 * git_commit(3)/terminal_*(4)/run_tests(3)/git_status(2)/gh_pr_create(1)/batch_undo(1)/delete_file(1)。
 * **能支撑"动作 → target"这一对的字段只有两类**（现读结论）：
 *   ① 流内标识符 `input.auditRef`（**6414 行携带**；生产点 = `permission_lease_granted` 2269 行，
 *      消费点 = used(477)/content_drift(1328)/revoked(178)/slot_digest_recorded(1600)/
 *      slot_digest_refused(562) 共 4145 行）
 *      —— 审计流内**自带生产点**，所以"这一次 materialization 里能不能寻到"是可机判的。
 *   ② 文件类 `input.path` / `input.files[]` / `input.operations[].path`（48 个去重目标，全部相对路径）
 *      —— 记录里**没有 cwd / workspace 身份字段**，因此"在本次 materialization 中是否仍可寻址"
 *      结构上判不了。判红它等于造一台恒红门（§12e），所以这一族一律落 `未判定` 并逐条点名。
 *   另有 `input.sessionId`(1 行) / `input.checkpointId`(1 行)：注册表不住在 audit.jsonl，
 *   流内零生产点 ⇒ 同样判不了，落 `未判定`（**不得**把"流内查不到"读成"点了必 stale"）。
 *
 * ── 判据分档（三态绝不并桶）──────────────────────────────────────────────
 *   命中        resolved          —— 消费行的 target 在同一代索引里**恰好一个**生产点。
 *   放过(报数)  heuristic         —— 天然模糊、按定义不承诺可点：glob/grep 模式、命令串、
 *                                  todo 条目、commit 文案、denied 指纹、lease scope 等。
 *   未判定      undetermined      —— 逐条点名 + 原因：文件类 target（无工作区身份）、
 *                                  sessionId/checkpointId（流内无生产点）、target 取不出、
 *                                  条目无 input / input 非对象、源文件取不到。
 *   判红        red               —— **只有两条**，与票面同形：
 *                                  R1 可寻址失败：流内可判族（auditRef）的消费行拿不到任何生产点；
 *                                  R2 不精确：同一 target 有多个生产点（点了会落错行 = 另一种必 stale）。
 *   崩溃        crash ⇒ exit 2    —— 源取不到 / 枚举到 0 条 / 解析器整体失败 / 脚本自身异常。
 *                                  崩溃**不**冒充"判红"，也**不**冒充"通过"。
 *
 * ── "同一次冷 materialization" 是本尺子的本体，不是措辞 ─────────────────────────
 * `materialize()` 一次性把文本解析成条目、并在**同一遍**里建好 resolver 索引，盖上 `generation`。
 * 渲染行与索引必须同代：`resolveTarget` 见到跨代配对（文本来自 A 次、索引来自 B 次）直接判 R3 红 ——
 * 那正是"文本还在但按钮点了必 stale"的机制本身，也是"用旧索引判新快照"这类伪绿的唯一解药。
 *
 * ── 退出码 ────────────────────────────────────────────────────────────
 *   0 = 无判红且无崩溃；1 = 有判红（R1/R2/R3）；2 = 无法判定/参数错/枚举 0 条判死（含 --strict 下有未判定）。
 * `--strict` 只是把"有未判定"从"报数"升成"拒绝出具合格证"（exit 2），**不**新增任何判红维度。
 *
 * 只读纪律（§26/§12）：源文件一律 `realpathSync` 解 junction 真身后**复制**进
 * `scripts/lib/scratch-dir.mjs` 的临时夹具目录再解析，绝不写回源、绝不在仓库树里造夹具；
 * 派生任何进程都显式带 `stdio`（§12g 的 EBUSY 病灶），递归/枚举前先判重解析点。
 *
 * 用法：node scripts/check-transcript-addressability.mjs
 *       [--source <file>] [--json] [--strict] [--top N] [--keep-fixture] [--self-test]
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const SELF = 'check-transcript-addressability.mjs'
/** 本文件所在目录（`scripts/`）：§15 铁律 —— ROOT 由脚本自身位置推导，不得靠 cwd/盘符。 */
const HERE = path.dirname(pathToFileURL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/i, '$1'))

/** 默认源：`~/.ihui/audit.jsonl`（本仓 §26 记过它是 junction 改道项 ⇒ 必须 realpath 解真身）。 */
const DEFAULT_SOURCE = path.join(os.homedir(), '.ihui', 'audit.jsonl')

/** 判红规则号（写进输出，便于后来人按号找判据，不写行号 —— §1 禁行号指针）。 */
const RULE_UNADDRESSABLE = 'R1'
const RULE_AMBIGUOUS = 'R2'
const RULE_CROSS_GENERATION = 'R3'

/**
 * 流内标识符族登记表。**唯一实现**，镜像测试不得再抄一份（§22c）。
 * `producerTool === null` = 该族在 audit.jsonl 内没有生产点 ⇒ `judgeable:false`，
 * 消费行只能落未判定；这一维**刻意不判红**（把"流内查不到"读成"必 stale"是本仓
 * "把没看清写成有问题"那一型，见头注 ②）。
 */
const REF_KINDS = [
  {
    kind: 'auditRef',
    producerTool: 'permission_lease_granted',
    judgeable: true,
    note: '租约授予行 = 生产点；同流内其余携带 auditRef 的行 = 消费点',
  },
  {
    kind: 'sessionId',
    producerTool: null,
    judgeable: false,
    note: '终端会话注册表不住在 audit.jsonl，流内零生产点 ⇒ 无从判定',
  },
  {
    kind: 'checkpointId',
    producerTool: null,
    judgeable: false,
    note: '批量检查点注册表在内存/别的落点，流内零生产点 ⇒ 无从判定',
  },
]

/**
 * 文件类 target 的抽取式（键名逐字取自现读抽样）。这些一律落未判定，
 * 原因写死在下面 `PATH_UNDETERMINED_REASON`，不许被读成"文件已不存在"。
 */
const PATH_TARGET_SHAPES = [
  { key: 'path' },
  { key: 'files', array: true },
  { key: 'operations', array: true, nestedKey: 'path' },
]
const PATH_UNDETERMINED_REASON =
  'audit 记录不含工作区身份（无 cwd/workspace 字段）⇒ 本次 materialization 可否寻址判不了'

/** 天然模糊、不承诺可点（只报数）。键名即"为什么这一族永不算红"的清单。 */
const HEURISTIC_SHAPES = [
  'glob-pattern',
  'grep-pattern',
  'command-string',
  'todo-items',
  'commit-message',
  'denied-fingerprint',
  'lease-scope',
  'pr-body',
  'test-filter',
  'arg-keys',
]

/** target 抽取结果的四个归档（字符串常量，输出与 --json 共用同一份名字）。 */
const BUCKET_RESOLVED = 'resolved'
const BUCKET_HEURISTIC = 'heuristic'
const BUCKET_UNDETERMINED = 'undetermined'
const BUCKET_RED = 'red'
const BUCKET_NO_TARGET = 'noTarget'

// ──────────────────────────────────────────────────────────────────────────────
// 纯判据层（无 IO）：materialize / classifyEntry / resolveTarget / summarize
// ──────────────────────────────────────────────────────────────────────────────

/** 把一行 JSON 安全解析成条目；坏行返回 `{ok:false}` 而不是抛（坏行属崩溃维，聚合后判 2）。 */
function parseLine(line) {
  const t = line.trim()
  if (!t) return { ok: true, entry: null, empty: true }
  try {
    const obj = JSON.parse(t)
    if (!obj || typeof obj !== 'object' || Array.isArray(obj))
      return { ok: false, error: 'not-an-object' }
    return { ok: true, entry: obj }
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) }
  }
}

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v)
}

/** 单遍扫描里顺手把一个 target 记进索引（生产者侧）。 */
function indexProducer(index, kind, ref, rowNo) {
  if (!index.byKind[kind]) index.byKind[kind] = new Map()
  const m = index.byKind[kind]
  const arr = m.get(ref)
  if (arr) arr.push(rowNo)
  else m.set(ref, [rowNo])
}

/**
 * 一次冷 materialization：解析文本 → 条目数组 + 同代 resolver 索引。
 * 返回 `{entries, index, generation, badLines, emptyLines}`；`generation` 是自增计数由调用方给，
 * 目的是让"跨代配对"这件事**可判**（见头注本体那段），不是装饰。
 */
function materialize(text, generation = 1) {
  const lines = String(text).split('\n')
  const entries = []
  const index = { byKind: {}, generation }
  let badLines = 0
  let emptyLines = 0
  for (let i = 0; i < lines.length; i++) {
    const parsed = parseLine(lines[i])
    if (parsed.empty) {
      emptyLines++
      continue
    }
    if (!parsed.ok) {
      badLines++
      continue
    }
    const rowNo = entries.length + 1
    const entry = {
      rowNo,
      tool: typeof parsed.entry.tool === 'string' ? parsed.entry.tool : '(no-tool)',
      raw: parsed.entry,
    }
    entries.push(entry)
    // 同一遍里建索引：只把登记表里声明为生产点的行喂进去。
    for (const k of REF_KINDS) {
      if (!k.producerTool || entry.tool !== k.producerTool) continue
      const ref = isPlainObject(entry.raw.input) ? entry.raw.input[k.kind] : undefined
      if (typeof ref === 'string' && ref) indexProducer(index, k.kind, ref, rowNo)
    }
  }
  return { entries, index, generation, badLines, emptyLines }
}

/** 从一条条目里抽 target。返回 `{kind, value, via}` 或 `{kind:'path-ish'|'heuristic'|'none'}`。 */
function extractTarget(entry) {
  const input = isPlainObject(entry.raw.input) ? entry.raw.input : null
  if (!input) return { kind: 'no-input' }

  // ① 流内标识符族优先（这是唯一可机判的那一族）。
  for (const k of REF_KINDS) {
    const v = input[k.kind]
    if (typeof v === 'string' && v) {
      return {
        kind: k.kind,
        value: v,
        producerTool: k.producerTool,
        judgeable: k.judgeable,
        note: k.note,
      }
    }
  }

  // ② 文件类 target（判不了，但必须点名，不能悄悄并进"没抽到"）。
  for (const shape of PATH_TARGET_SHAPES) {
    if (shape.array) {
      const arr = input[shape.key]
      if (Array.isArray(arr)) {
        const vals = arr
          .map((x) => (shape.nestedKey ? (isPlainObject(x) ? x[shape.nestedKey] : undefined) : x))
          .filter((x) => typeof x === 'string' && x)
        if (vals.length) return { kind: 'path-ish', values: vals }
      }
    } else if (typeof input[shape.key] === 'string' && input[shape.key]) {
      return { kind: 'path-ish', values: [input[shape.key]] }
    }
  }

  // ③ 启发式族：按键名归堆，只报数。
  if (entry.tool === 'glob' && typeof input.pattern === 'string')
    return { kind: 'heuristic', via: 'glob-pattern' }
  if (entry.tool === 'grep' && typeof input.pattern === 'string')
    return { kind: 'heuristic', via: 'grep-pattern' }
  if (typeof input.command === 'string') return { kind: 'heuristic', via: 'command-string' }
  if (Array.isArray(input.todos)) return { kind: 'heuristic', via: 'todo-items' }
  if (typeof input.message === 'string') return { kind: 'heuristic', via: 'commit-message' }
  if (
    typeof input.argsFingerprint === 'string' ||
    typeof input.argKeys === 'string' ||
    Array.isArray(input.argKeys)
  ) {
    return { kind: 'heuristic', via: 'denied-fingerprint' }
  }
  if (typeof input.scope === 'string') return { kind: 'heuristic', via: 'lease-scope' }
  if (typeof input.body === 'string' || typeof input.title === 'string')
    return { kind: 'heuristic', via: 'pr-body' }
  if (typeof input.filter === 'string') return { kind: 'heuristic', via: 'test-filter' }
  return { kind: 'none' }
}

/**
 * 用**这一次** materialization 的索引解析一个 target。
 * 跨代配对（索引 generation ≠ target 所属条目 generation）⇒ 直接判 R3，绝不返回"找到了"。
 */
function resolveTarget(index, target) {
  if (!target || target.kind === 'none' || target.kind === 'no-input')
    return { state: BUCKET_NO_TARGET }
  if (target.kind === 'path-ish')
    return { state: BUCKET_UNDETERMINED, reason: PATH_UNDETERMINED_REASON, values: target.values }
  if (target.kind === 'heuristic') return { state: BUCKET_HEURISTIC, via: target.via }
  if (!target.judgeable) {
    return {
      state: BUCKET_UNDETERMINED,
      unjudgeableRef: true,
      refKind: target.kind,
      reason: `${target.kind}：${target.note}`,
      values: [target.value],
    }
  }
  if (!index || index.generation !== target.generation) {
    return {
      state: BUCKET_RED,
      rule: RULE_CROSS_GENERATION,
      ref: target.value,
      reason: `渲染行来自第 ${target.generation} 次 materialization，resolver 是第 ${index ? index.generation : '(无)'} 次 ⇒ 不同代配对必 stale`,
    }
  }
  const hits = (index.byKind[target.kind] && index.byKind[target.kind].get(target.value)) || []
  if (hits.length === 0) {
    return {
      state: BUCKET_RED,
      rule: RULE_UNADDRESSABLE,
      ref: target.value,
      reason: `${target.kind} 在本次 materialization 内没有任何生产点 ⇒ 文本还在，点击必 stale`,
    }
  }
  if (hits.length > 1) {
    return {
      state: BUCKET_RED,
      rule: RULE_AMBIGUOUS,
      ref: target.value,
      reason: `${target.kind} 在本次 materialization 内有 ${hits.length} 个生产点 ⇒ 不满足"精确命中"`,
    }
  }
  return { state: BUCKET_RESOLVED, ref: target.value, rowNo: hits[0] }
}

/** 把一次 materialization 跑完：逐条抽 target → 同代解析 → 分档聚合。 */
function runPass(mat) {
  const out = {
    entries: mat.entries.length,
    badLines: mat.badLines,
    buckets: {
      [BUCKET_RESOLVED]: 0,
      [BUCKET_HEURISTIC]: 0,
      [BUCKET_UNDETERMINED]: 0,
      [BUCKET_RED]: 0,
      [BUCKET_NO_TARGET]: 0,
    },
    heuristicByVia: new Map(),
    undeterminedGrouped: new Map(),
    unjudgeableRefs: [],
    reds: [],
  }
  for (const entry of mat.entries) {
    const target = extractTarget(entry)
    if (
      target.kind !== 'none' &&
      target.kind !== 'no-input' &&
      target.kind !== 'heuristic' &&
      target.kind !== 'path-ish'
    ) {
      target.generation = mat.generation
    }
    const r = resolveTarget(mat.index, target)
    out.buckets[r.state] = (out.buckets[r.state] || 0) + 1
    if (r.state === BUCKET_HEURISTIC)
      out.heuristicByVia.set(r.via, (out.heuristicByVia.get(r.via) || 0) + 1)
    if (r.state === BUCKET_UNDETERMINED) {
      const key = `${r.reason}|${(r.values || []).join(',')}`
      const g = out.undeterminedGrouped.get(key)
      if (g) g.rows.push(entry.rowNo)
      else
        out.undeterminedGrouped.set(key, {
          reason: r.reason,
          values: r.values || [],
          rows: [entry.rowNo],
        })
      // 逐条点名族里的"标识符无生产点"一支单独计数（它是无从判定，不是"流内查不到所以坏了"）。
      if (r.unjudgeableRef)
        out.unjudgeableRefs.push({
          rowNo: entry.rowNo,
          tool: entry.tool,
          kind: r.refKind,
          reason: r.reason,
        })
    }
    if (r.state === BUCKET_RED)
      out.reds.push({
        rowNo: entry.rowNo,
        tool: entry.tool,
        rule: r.rule,
        ref: r.ref,
        reason: r.reason,
      })
  }
  return out
}

/** 未判定族里"标识符无生产点"那一支的行数（供读数点名，不参与判红）。 */
function countUnjudgeableRefs(run) {
  return (run.unjudgeableRefs || []).length
}

// ──────────────────────────────────────────────────────────────────────────────
// 只读取源：realpath 解 junction ⇒ 复制进夹具 ⇒ 从副本解析（绝不写回源）
// ──────────────────────────────────────────────────────────────────────────────

/** 读源前的重解析点核验（§26：递归/枚举前必须判，junction 穿透会误读别处的真身）。 */
function inspectSource(src) {
  try {
    const st = fs.lstatSync(src)
    if (st.isSymbolicLink()) {
      const real = fs.realpathSync(src)
      return { ok: true, via: 'symlink', real, size: fs.statSync(real).size }
    }
    if (!st.isFile()) return { ok: false, reason: `源路径不是普通文件:${src}` }
    return { ok: true, via: 'plain', real: src, size: st.size }
  } catch (e) {
    return { ok: false, reason: `源文件取不到:${e && e.code ? e.code : e && e.message}` }
  }
}

/** 只读复制 ⇒ 夹具。返回 `{dir, file, real}`；调用方负责 rmScratch。 */
function copyIntoScratch(realSrc, prefix) {
  const dir = mkScratch(prefix)
  const file = path.join(dir, path.basename(realSrc))
  const buf = fs.readFileSync(realSrc) // Buffer 原字节，不 .trim()（会吃末字节换行）
  fs.writeFileSync(file, buf, { mode: 0o444 })
  return { dir, file, real: realSrc, bytes: buf.length }
}

// ──────────────────────────────────────────────────────────────────────────────
// 读数与退出码
// ──────────────────────────────────────────────────────────────────────────────

function summarize(run, opts = {}) {
  const undeterminedNamed = [...run.undeterminedGrouped.values()].reduce(
    (a, g) => a + g.rows.length,
    0,
  )
  const fallback = countUnjudgeableRefs(run)
  return {
    entries: run.entries,
    badLines: run.badLines,
    resolved: run.buckets[BUCKET_RESOLVED] || 0,
    heuristic: run.buckets[BUCKET_HEURISTIC] || 0,
    // undeterminedGrouped 已覆盖两支（文件类 + 无生产点标识符类），fallback 只作细分展示，绝不另加一次。
    undetermined: undeterminedNamed,
    noTarget: run.buckets[BUCKET_NO_TARGET] || 0,
    red: run.reds.length,
    reds: run.reds,
    redByRule: run.reds.reduce((a, r) => ({ ...a, [r.rule]: (a[r.rule] || 0) + 1 }), {}),
    heuristicByVia: [...run.heuristicByVia.entries()].sort((a, b) => b[1] - a[1]),
    undeterminedSamples: [...run.undeterminedGrouped.entries()]
      .map(([, g]) => ({
        reason: g.reason,
        values: g.values,
        rowCount: g.rows.length,
        firstRows: g.rows.slice(0, opts.top || 5),
      }))
      .sort((a, b) => b.rowCount - a.rowCount)
      .slice(0, opts.top || 12),
    undeterminedRefFallback: fallback,
  }
}

/** 纯函数：退出码判读。崩溃维（坏行/空条目）优先于判红维，与"判不了一律不冒红"同形。 */
function decideExit(sum, { strict = false, crashed = false } = {}) {
  if (crashed) return 2
  if (!(sum.entries > 0)) return 2 // 枚举到 0 条 ⇒ 判死不记绿
  if (sum.red > 0) return 1
  if (strict && sum.undetermined > 0) return 2
  return 0
}

function lastLine(sourceLabel, sum, rc, strict) {
  return (
    `末行读数：源=${sourceLabel} 条目=${sum.entries} 命中=${sum.resolved} ` +
    `放过(启发式)=${sum.heuristic} 未判定=${sum.undetermined}(其中标识符无生产点=${sum.undeterminedRefFallback}) ` +
    `无target=${sum.noTarget} 判红=${sum.red}${
      sum.red
        ? `(${Object.entries(sum.redByRule)
            .map(([k, v]) => k + '=' + v)
            .join(',')})`
        : ''
    } ` +
    `坏行=${sum.badLines} strict=${strict ? 'on' : 'off'} exit=${rc}`
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// 自检（构造面，正反成对；判据一律走上面导出的那一份，不重写）
// ──────────────────────────────────────────────────────────────────────────────

function selfTest() {
  const results = []
  const t = (name, cond, extra = '') =>
    results.push({
      name,
      ok: cond === true,
      got: typeof cond === 'boolean' ? String(cond) : `非布尔:${typeof cond}`,
      extra,
    })
  const jl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n'
  const granted = (ref) => ({
    timestamp: '2026-01-01T00:00:00.000Z',
    tool: 'permission_lease_granted',
    input: { auditRef: ref, scope: 'goal:x' },
    success: true,
  })
  const used = (ref) => ({
    timestamp: '2026-01-01T00:00:01.000Z',
    tool: 'permission_lease_used',
    input: { auditRef: ref, capability: 'write_file' },
    success: true,
  })

  // A1 阳性对照 —— **本门的存在理由**：文本还在（消费行照样渲染），target 已不可寻址 ⇒ 必判红。
  ;(() => {
    const mat = materialize(jl([used('lease-gone-1')]), 1)
    const s = summarize(runPass(mat))
    t(
      'A1 auditRef 无生产点 ⇒ R1 判红',
      s.red === 1 && s.redByRule[RULE_UNADDRESSABLE] === 1 && s.resolved === 0,
      `red=${s.red}`,
    )
  })()
  // A2 负对照：同一次 materialization 里有授予行 ⇒ 不判红。
  ;(() => {
    const mat = materialize(jl([granted('lease-ok-1'), used('lease-ok-1')]), 1)
    const s = summarize(runPass(mat))
    t(
      'A2 同代精确命中 ⇒ 不判红且计 2 次命中',
      s.red === 0 && s.resolved === 2,
      `red=${s.red} resolved=${s.resolved}`,
    )
  })()
  // A3 崩溃 ≠ 判红：坏 JSON 行进 crash 维，绝不冒充"可寻址失败"。
  ;(() => {
    const mat = materialize(
      '{"tool":"read_file","input":{"path":"a.mjs"},"success":true}\n不是JSON\n',
      1,
    )
    t(
      'A3 坏行计入 badLines 而不进判红',
      mat.badLines === 1 && mat.entries.length === 1,
      `bad=${mat.badLines} entries=${mat.entries.length}`,
    )
    t(
      'A3b 坏行 ⇒ decideExit 判 2（崩溃维）不判 1',
      decideExit(summarize(runPass(mat)), { crashed: true }) === 2,
    )
  })()
  // A4 枚举 0 条 ⇒ 判死不记绿。
  ;(() => {
    const s = summarize(runPass(materialize('', 1)))
    t('A4 空面 ⇒ exit 2', decideExit(s, {}) === 2 && s.entries === 0)
  })()
  // A5 文件类 target ⇒ 未判定（逐条点名），绝不判红（恒红门防线）。
  ;(() => {
    const rows = [
      { tool: 'read_file', input: { path: 'lib.mjs' }, success: true },
      { tool: 'git_add', input: { files: ['a.mjs', 'b.mjs'] }, success: true },
      { tool: 'batch_edit', input: { operations: [{ path: 'shared.mjs' }] }, success: true },
    ].map((r) => ({ timestamp: '2026-01-01T00:00:00.000Z', ...r }))
    const s = summarize(runPass(materialize(jl(rows), 1)))
    t(
      'A5 path target ⇒ 未判定 3、判红 0',
      s.red === 0 && s.undetermined === 3,
      `und=${s.undetermined} red=${s.red}`,
    )
    t(
      'A5b 未判定必须带原因',
      s.undeterminedSamples.every((x) => typeof x.reason === 'string' && x.reason.length > 0),
    )
  })()
  // A6 启发式只报数（glob / 命令串 / todo / commit 文案）。
  ;(() => {
    const rows = [
      { tool: 'glob', input: { pattern: '**/lib.mjs' }, success: true },
      { tool: 'run_command', input: { command: 'sed -i lib.mjs' }, success: true },
      { tool: 'todo_write', input: { todos: [{ id: 't1' }] }, success: true },
      { tool: 'git_commit', input: { message: 'fix: x' }, success: true },
    ].map((r) => ({ timestamp: '2026-01-01T00:00:00.000Z', ...r }))
    const s = summarize(runPass(materialize(jl(rows), 1)))
    t(
      'A6 启发式 4 全报数、零红零未判定',
      s.heuristic === 4 && s.red === 0 && s.undetermined === 0,
      `h=${s.heuristic}`,
    )
    t('A6b 启发式按 via 分堆不得为空', s.heuristicByVia.length === 4)
  })()
  // A7 R2 不精确命中：同一 auditRef 两个生产点 ⇒ 判红（票面"精确命中"）。
  ;(() => {
    const mat = materialize(jl([granted('lease-dup'), granted('lease-dup'), used('lease-dup')]), 1)
    const s = summarize(runPass(mat))
    t(
      'A7 两个生产点 ⇒ R2 判红',
      s.red === 3 && !!s.redByRule[RULE_AMBIGUOUS],
      `red=${s.red} rules=${JSON.stringify(s.redByRule)}`,
    )
  })()
  // A8 R3 跨代配对 —— 机制本体：把 A 次 materialization 的行交给 B 次的索引 ⇒ 必红。
  ;(() => {
    const text = jl([granted('lease-gen'), used('lease-gen')])
    const matA = materialize(text, 1)
    const matB = materialize(text, 2)
    const entry = matA.entries[1]
    const target = extractTarget(entry)
    target.generation = matA.generation
    const r = resolveTarget(matB.index, target)
    t(
      'A8 跨代 resolver ⇒ R3 判红',
      r.state === BUCKET_RED && r.rule === RULE_CROSS_GENERATION,
      `${r.state}/${r.rule}`,
    )
    const same = summarize(runPass(matB))
    t('A8b 同代跑完整遍 ⇒ 零红', same.red === 0)
  })()
  // A9 不可判族（sessionId / checkpointId）⇒ 未判定，不得判红。
  ;(() => {
    const rows = [
      { tool: 'terminal_read', input: { sessionId: 'term_1', timeout: 5000 }, success: true },
      { tool: 'batch_undo', input: { checkpointId: 'chk_1' }, success: true },
    ].map((r) => ({ timestamp: '2026-01-01T00:00:00.000Z', ...r }))
    const s = summarize(runPass(materialize(jl(rows), 1)))
    t(
      'A9 流内无生产点的标识符 ⇒ 未判定 2、判红 0',
      s.red === 0 && s.undetermined === 2,
      `und=${s.undetermined} red=${s.red}`,
    )
  })()
  // A10 --strict 只把未判定升成"拒绝合格证"，不新增判红。
  ;(() => {
    const s = summarize(
      runPass(
        materialize(
          jl([{ timestamp: 'x', tool: 'read_file', input: { path: 'a' }, success: true }]),
          1,
        ),
      ),
    )
    t(
      'A10 strict 下未判定 ⇒ exit 2',
      decideExit(s, { strict: true }) === 2 && decideExit(s, { strict: false }) === 0,
    )
    t('A10b strict 不得把命中面判红', s.red === 0)
  })()
  // A11 端到端只读复制路径（真派生一次夹具，走 mkScratch/rmScratch，不往仓库树写）。
  ;(() => {
    const fixtureBody = jl([granted('lease-e2e'), used('lease-e2e'), used('lease-missing-e2e')])
    const dir = mkScratch('g679-selftest')
    try {
      const f = path.join(dir, 'audit.jsonl')
      fs.writeFileSync(f, fixtureBody)
      const buf = fs.readFileSync(f)
      const s = summarize(runPass(materialize(buf.toString('utf8'), 1)))
      t(
        'A11 夹具端到端：命中 2、判红 1 且是 R1',
        s.resolved === 2 && s.red === 1 && s.redByRule[RULE_UNADDRESSABLE] === 1,
        `res=${s.resolved} red=${s.red}`,
      )
      t(
        'A11b 判红项必须点名行号与 ref',
        s.reds.length === 1 &&
          typeof s.reds[0].ref === 'string' &&
          Number.isInteger(s.reds[0].rowNo),
      )
    } finally {
      rmScratch(dir)
      t('A11c 夹具收尾必须回收（不留二阶目录）', !fs.existsSync(dir))
    }
  })()
  // A12 源不可用 ⇒ 崩溃维（exit 2），不得折成"0 处判红"的绿。
  ;(() => {
    const probe = inspectSource(path.join(dir0(), 'definitely-not-here.jsonl'))
    t('A12 取不到源 ⇒ ok:false 且带原因', probe.ok === false && /取不到/.test(probe.reason))
    t(
      'A12b 源取不到 ⇒ decideExit 2 而非 0',
      decideExit(
        {
          entries: 0,
          red: 0,
          undetermined: 0,
          resolved: 0,
          heuristic: 0,
          noTarget: 0,
          badLines: 0,
        },
        { crashed: true },
      ) === 2,
    )
  })()
  // A13 判据形状锁：启发式清单必须覆盖现读抽样里出现的每一族（防止"新增一族被静默丢弃"）。
  ;(() => {
    const set = new Set(HEURISTIC_SHAPES)
    t('A13 启发式族清单无重复', set.size === HEURISTIC_SHAPES.length)
    t(
      'A13b REF_KINDS 至少一族可判（否则本门对唯一可判族失明）',
      REF_KINDS.filter((k) => k.judgeable).length >= 1,
    )
    t(
      'A13c path 未判定原因必须是常量单点',
      typeof PATH_UNDETERMINED_REASON === 'string' &&
        PATH_UNDETERMINED_REASON.includes('工作区身份'),
    )
  })()
  return results
}

function dir0() {
  return HERE
}

// ──────────────────────────────────────────────────────────────────────────────
// CLI
// ──────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const o = {
    source: DEFAULT_SOURCE,
    json: false,
    strict: false,
    top: 12,
    keepFixture: false,
    selfTest: false,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--self-test') o.selfTest = true
    else if (a === '--json') o.json = true
    else if (a === '--strict') o.strict = true
    else if (a === '--keep-fixture') o.keepFixture = true
    else if (a === '--help' || a === '-h') o.help = true
    else if (a.startsWith('--source=')) o.source = a.slice(9)
    else if (a === '--source') o.source = argv[++i]
    else if (a.startsWith('--top=')) o.top = Number(a.slice(6))
    else if (a === '--top') o.top = Number(argv[++i])
    else return { error: `不认识参数:${a}` }
    if (a.startsWith('--top') && !Number.isFinite(o.top)) return { error: '--top 需要整数' }
  }
  return { opts: o }
}

function main(argv) {
  const parsed = parseArgs(argv)
  if (parsed.error) {
    console.error(`❌ ${parsed.error}`)
    return Promise.resolve(2)
  }
  const o = parsed.opts
  if (o.help) {
    console.log(
      `用法: node scripts/${SELF} [--source <file>] [--json] [--strict] [--top N] [--keep-fixture] [--self-test]`,
    )
    return Promise.resolve(0)
  }
  if (o.selfTest) {
    const rs = selfTest()
    let pass = 0
    let fail = 0
    for (const r of rs) {
      if (r.ok) pass++
      else fail++
      if (!r.ok) console.log(`  ❌ ${r.name} ${r.extra || ''} got=${r.got}`)
    }
    console.log(`自检末行：${SELF} --self-test ⇒ pass ${pass} / fail ${fail}（共 ${rs.length} 条）`)
    return Promise.resolve(fail === 0 ? 0 : 1)
  }

  const say = o.json ? console.error : console.log
  const srcLabel = o.source === DEFAULT_SOURCE ? '~/.ihui/audit.jsonl(只读复制)' : o.source
  const probe = inspectSource(o.source)
  if (!probe.ok) {
    say(`❌ 未判定（崩溃维）：${probe.reason}`)
    say(
      lastLine(
        srcLabel,
        {
          entries: 0,
          resolved: 0,
          heuristic: 0,
          undetermined: 0,
          undeterminedRefFallback: 0,
          noTarget: 0,
          red: 0,
          redByRule: {},
          badLines: 0,
          heuristicByVia: [],
          undeterminedSamples: [],
        },
        2,
        o.strict,
      ),
    )
    return Promise.resolve(2)
  }
  if (probe.via === 'symlink')
    say(`ℹ️ 源是重解析点，真身 = ${probe.real}（§26：junction 只管路径不管身份，这里按真身读）`)

  const fx = copyIntoScratch(probe.real, 'g679-materialize')
  let sum
  let rc
  try {
    const buf = fs.readFileSync(fx.file)
    const mat = materialize(buf.toString('utf8'), 1)
    const crashed = mat.entries.length === 0 || mat.badLines > 0
    sum = summarize(runPass(mat), { top: o.top })
    rc = decideExit(sum, { strict: o.strict, crashed })
    if (crashed && mat.entries.length > 0 && mat.badLines > 0) {
      say(
        `❌ 未判定（崩溃维）：${mat.badLines} 行 JSON 解析失败 ⇒ 本次不出具合格证（坏行不得被读成"没判"）`,
      )
    }
    if (mat.entries.length === 0) say('❌ 未判定（判死）：枚举到 0 条目 ⇒ 不记绿')
  } finally {
    if (o.keepFixture) say(`ℹ️ 夹具保留：${fx.dir}`)
    else rmScratch(fx.dir)
  }

  say(
    `源字节=${fx.bytes} 解析条目=${sum.entries} 命中=${sum.resolved} 放过=${sum.heuristic} 未判定=${sum.undetermined} 判红=${sum.red}`,
  )
  for (const [via, n] of sum.heuristicByVia) say(`  · 启发式(只报数) ${via}: ${n}`)
  for (const g of sum.undeterminedSamples) {
    say(
      `  · 未判定 ${g.rowCount} 行 前若干行号=[${g.firstRows.join(',')} ] target=[${g.values.slice(0, 6).join(', ')}] 原因：${g.reason}`,
    )
  }
  for (const r of sum.reds.slice(0, o.top))
    say(`  ❌ 判红 ${r.rule} 行#${r.rowNo} ${r.tool} ref=${r.ref} —— ${r.reason}`)
  if (sum.red > o.top) say(`  … 其余 ${sum.red - o.top} 条判红未打印（--top 调）`)
  if (o.json)
    console.log(
      JSON.stringify(
        { source: srcLabel, real: probe.real, ...sum, reds: sum.reds, exit: rc },
        null,
        2,
      ),
    )
  console.log(lastLine(srcLabel, sum, rc, o.strict))
  return Promise.resolve(rc)
}

export const __test__ = {
  SELF,
  HERE,
  DEFAULT_SOURCE,
  RULE_UNADDRESSABLE,
  RULE_AMBIGUOUS,
  RULE_CROSS_GENERATION,
  PATH_UNDETERMINED_REASON,
  HEURISTIC_SHAPES,
  REF_KINDS,
  parseLine,
  materialize,
  extractTarget,
  resolveTarget,
  runPass,
  summarize,
  decideExit,
  lastLine,
  parseArgs,
  inspectSource,
  copyIntoScratch,
  // 夹具回收出口：**只有这一份**（scratch-dir 的那把尺子），测试侧不得自建删除路径。
  rmScratch,
  mkScratch,
  selfTest,
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isDirectRun) {
  main(process.argv.slice(2))
    .then((rc) => process.exit(rc))
    .catch((e) => {
      console.error(`❌ ${e && e.message ? e.message : e}\n${e && e.stack ? e.stack : ''}`)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
