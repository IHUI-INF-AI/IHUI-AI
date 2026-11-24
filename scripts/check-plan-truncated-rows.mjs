#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 只读尺子为 CLI 工具,读数必须打到 stdout 交人现读 */
/**
 * check-plan-truncated-rows.mjs —— 台账残行的**只读 + 基线棘轮尺子**(2026-10-25 立)。
 *
 * 立项出处(内容锚点,不用行号也不用短 sha —— §1 禁止行号/短 sha 指针):
 *   台账里那条「台账里有两类"正文被吃掉"的残行,先造只读尺子再谈修器物」的未取号登记行。
 *   票面现读的两型:
 *     ① 空正文型 —— 复选框后除括号标记之外没有任何正文(`- [ ]（认领已释放@…#seq）` 这一形);
 *     ② 截断收尾型 —— 正文以续写标点 `,` `;` `、` 收尾,句子被切在半截处。
 *   票面明说"先造尺子":本档只点名 + 只拦新增,**不修台账、不改复选框、不代任何席位开处方**。
 *
 * 判据不复制(§0.6 / §22c —— 这条是本次实现的关键约束)
 *   两型的**识别**早已有唯一实现 = `scripts/check-plan-fragment-rows.mjs` 的
 *   `findFragmentRows`(F1 空正文 / F2 续写标点收尾)。本档**不另写第二份正则**,
 *   只 import 它的 `findFragmentRows` / `readFace` / `pickFace` / `inspectFace`,
 *   在其上补这一层此前没有的能力:**基线棘轮 + 可回写的基线档**。
 *   违规身份 = `keyOfRow`(复合主键,单源 import)优先;无主键行退化为整行文本
 *   (空正文行天然无主键,这是唯一稳定的身份 —— 与 `check-plan-row-length.mjs` 的 `violationKey` 同法)。
 *
 * 两型判据编号(点名时必须带编号,机读与人读同一套字面)
 *   R1 = `empty-body`     空正文行(复选框后剥尽括号标记,正文残留 0 字)
 *   R2 = `trailing-punct` 截断收尾行(整行末个非空白字符是续写标点)
 *   两型互斥,同一行最多落一型(空正文优先;由单源 `findFragmentRows` 保证)。
 *
 * 棘轮语义(§0.5 / §12e)
 *   基线档 = `scripts/check-plan-truncated-rows-baseline.json`(与既有 `scripts/*-baseline.json`
 *   同目录同形态)。存量只报数;**只有「身份不在基线里」的命中才判红**。
 *   基线档缺失 / 解析失败 ⇒ **未判定 exit 2**,绝不把"读不到基线"读成 0 存量(§0.3)。
 *
 * 取材面(§0.4 fail-closed)
 *   默认判 **HEAD blob**(`git show HEAD:PROJECT_PLAN.md`);`--staged` 判索引 blob;
 *   `--worktree` 只是人工逃生舱。被审面取不到/取空 ⇒ exit 2 显式「未判定」,不回落另一个面;
 *   枚举到 0 枚登记行 ⇒ exit 2(不读成"干净")。
 *
 * 接线(2026-10-25 主会话补,纠正本节旧陈述):本档已注册为 guardian-runner **门 249**
 *   (blocking,`skipEnv='HUSKY_SKIP_PLAN_TRUNCATED_ROWS'`,`onFailHint` 写明 R1/R2 修法),
 *   根 `package.json` 有 `check:plan-truncated-rows`;AGENTS.md「计划/台账」点名行已补(R4)。
 *   与 `check-plan-fragment-rows.mjs` 的分工照旧:那个判**单枚提交**是否把残行带进来(索引面),
 *   本档判**存量棘轮** —— 基线只拦新增,存量非零只报数,所以它不会因存量恒红而逼人跳门。
 *
 * 用法(§0.8:每条都真跑得通)
 *   node scripts/check-plan-truncated-rows.mjs                  # HEAD blob,按基线只拦新增
 *   node scripts/check-plan-truncated-rows.mjs --json           # 机读(TRUNCATED-ROWS-SUMMARY / -HIT)
 *   node scripts/check-plan-truncated-rows.mjs --self-test      # 构造面正反对照,零 git、零写盘
 *   node scripts/check-plan-truncated-rows.mjs --staged         # 索引 blob
 *   node scripts/check-plan-truncated-rows.mjs --worktree       # 人工逃生舱:磁盘副本
 *   node scripts/check-plan-truncated-rows.mjs --update-baseline  # 把 HEAD 现读存量写进基线(唯一写盘出口)
 * 退出码:0 = 判过且无新增残行 / 1 = 判过且基线外有新增 / 2 = 未判定(取材不到、0 枚登记行、基线坏、参数非法)。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { FACE_LABEL, assertRepoRoot } from './lib/face-reader.mjs'
import { keyOfRow, parseTaskRows } from './lib/plan-task-index.mjs'
import {
  DOC,
  TYPE_EMPTY,
  TYPE_TRUNCATED,
  findFragmentRows,
  pickFace,
  readFace,
} from './check-plan-fragment-rows.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15:共享工作区 cwd 不可靠,不得 process.cwd() 定根) */
const ROOT = path.resolve(HERE, '..')

export const GATE = 'check-plan-truncated-rows'
export const BASELINE_REL = 'scripts/check-plan-truncated-rows-baseline.json'
export const RULE = { [TYPE_EMPTY]: 'R1', [TYPE_TRUNCATED]: 'R2' }
export const RULE_NAME = { R1: '空正文行', R2: '截断收尾行' }
const TYPES = [TYPE_EMPTY, TYPE_TRUNCATED]
const KNOWN_FLAGS = new Set([
  '--json',
  '--self-test',
  '--staged',
  '--worktree',
  '--update-baseline',
  '--help',
  '-h',
])

/**
 * 违规身份(棘轮认领用):有主键按主键,无主键退化为整行文本。
 * 为什么不用行号:一次 append 就挪位(§1),基线会整族漂成"全是新增"。
 * 为什么不用 preview:preview 截在 80 字,两行前 80 字相同即撞身份。
 */
export function identityOf(raw) {
  const s = String(raw ?? '')
  const k = keyOfRow(s)
  return k ? `K:${String(k).trim()}` : `T:${s.trim()}`
}

/**
 * 在一段文档文本上收集两型命中(纯函数,不碰 git ⇒ `--self-test` 与镜像测试直接喂构造文本)。
 * 识别委派单源 `findFragmentRows`;本层只补 `rule`(判据编号)与 `key`(棘轮身份)。
 */
export function collect(text) {
  const doc = findFragmentRows(text)
  const rawByLine = new Map(parseTaskRows(String(text ?? '')).map((r) => [r.line, r.raw]))
  const hits = doc.hits.map((h) => {
    const raw = rawByLine.get(h.line)
    return {
      line: h.line,
      state: h.state,
      type: h.type,
      rule: RULE[h.type],
      ruleName: RULE_NAME[RULE[h.type]],
      key: raw === undefined ? `P:${h.preview}` : identityOf(raw),
      preview: h.preview,
      note: h.note,
    }
  })
  return { hits, counts: doc.counts, denominator: doc.denominator }
}

/** 基线档解析:形状不对一律 null(交调用方落「未判定」,绝不按空表继续 —— §0.3)。 */
export function parseBaseline(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return null
  let obj
  try {
    obj = JSON.parse(raw)
  } catch {
    return null
  }
  if (!obj || typeof obj !== 'object' || obj.version !== 1) return null
  const types = obj.types
  if (!types || typeof types !== 'object') return null
  for (const type of TYPES) {
    const entry = types[type]
    if (!entry || !Array.isArray(entry.keys) || entry.keys.some((k) => typeof k !== 'string'))
      return null
  }
  return obj
}

/** 基线档写形(与仓内 `scripts/*-baseline.json` 同族:version / anchor / reason / 面 / 键集)。 */
export function buildBaseline(hits, now = new Date()) {
  const types = {}
  for (const type of TYPES) {
    const keys = hits
      .filter((h) => h.type === type)
      .map((h) => h.key)
      .sort()
    types[type] = { count: keys.length, keys }
  }
  return {
    version: 1,
    gate: GATE,
    anchor:
      '两型残行的违规身份键(type+身份;有主键按复合主键,无主键退化为整行文本)。只拦新增,存量只报数。',
    reason:
      '票面「台账里有两类正文被吃掉的残行,先造只读尺子再谈修器物」的存量锚点。2026-10-25 首次写入时 HEAD 面两型现读均为 0 枚;此后任何身份不在本档的命中都算新增并判红。',
    face: 'head',
    doc: DOC,
    writtenAt: now.toISOString(),
    types,
  }
}

/**
 * 基线棘轮(多重集,按 `type\0身份` 认领):基线内只报数,基线外判红。
 * `baseline === null` ⇒ 未判定,既不记绿也不冒红。
 */
export function judgeRatchet(hits, baseline) {
  if (baseline === null || baseline === undefined) {
    return { state: 'undetermined', why: '基线档取不到或形状不合法', fresh: [], stock: [] }
  }
  const pool = new Map()
  for (const type of TYPES) {
    for (const k of baseline.types[type].keys) {
      const id = `${type}\u0000${k}`
      pool.set(id, (pool.get(id) || 0) + 1)
    }
  }
  const fresh = []
  const stock = []
  for (const h of hits) {
    const id = `${h.type}\u0000${h.key}`
    const n = pool.get(id) || 0
    if (n > 0) {
      pool.set(id, n - 1)
      stock.push(h)
    } else fresh.push(h)
  }
  return { state: fresh.length ? 'blocking' : 'ok', fresh, stock }
}

function baselinePath(argv) {
  const eq = argv.find((a) => a.startsWith('--baseline='))
  if (eq) return path.resolve(ROOT, String(eq).split('=').slice(1).join('='))
  const i = argv.indexOf('--baseline')
  if (i >= 0) {
    const v = argv[i + 1]
    return v && !v.startsWith('--') ? path.resolve(ROOT, v) : null
  }
  return path.join(ROOT, BASELINE_REL)
}

function loadBaseline(file) {
  if (!file) return { file, raw: null, why: '--baseline 缺路径值' }
  try {
    return { file, raw: readFileSync(file, 'utf8'), why: null }
  } catch (e) {
    return { file, raw: null, why: `读不到 ${file}:${e?.code ?? e?.message ?? e}` }
  }
}

function printHuman(view) {
  console.log(
    `[台账残行棘轮] 判定面:${FACE_LABEL[view.face]} · 文档 ${DOC} · 登记行 ${view.denominator.rows} 枚` +
      `(未勾 ${view.denominator.open} / 已勾 ${view.denominator.done} · 有主键 ${view.denominator.keyed}) · 基线 ${view.baselineFile}`,
  )
  for (const type of TYPES) {
    const rule = RULE[type]
    const now = view.hits.filter((h) => h.type === type)
    const fresh = view.fresh.filter((h) => h.type === type)
    console.log(
      `  ${rule} ${RULE_NAME[rule]}(${type}):现读 ${now.length} 枚 · 基线内 ${now.length - fresh.length} · 新增 ${fresh.length}`,
    )
  }
  for (const h of view.fresh) {
    console.log(`❌ 新增 L${h.line} [${h.rule}/${h.ruleName}] 前 80 字:${h.preview}`)
    console.log(`    判据:${h.note}`)
    console.log(`    身份:${h.key.slice(0, 100)}`)
  }
  for (const h of view.stock.slice(0, 5)) {
    console.log(`· 存量 L${h.line} [${h.rule}/${h.ruleName}] 前 80 字:${h.preview}`)
  }
  if (view.stock.length > 5) console.log(`· …另有 ${view.stock.length - 5} 枚存量同档报数`)
  if (view.state === 'blocking') {
    console.log(
      '❌ 基线外新增残行 —— 本尺只拦新增,存量只报数;新增行请由持有人补正文/删空行(本尺不代改台账)。',
    )
    return
  }
  console.log('✅ 基线内残行只报数,基线外新增 0 枚(判过 ≠ 永不再出现)。')
}

function printJson(view) {
  console.log(
    `TRUNCATED-ROWS-SUMMARY ${JSON.stringify({
      gate: GATE,
      face: view.face,
      doc: DOC,
      baseline: view.baselineFile,
      rows: view.denominator.rows,
      open: view.denominator.open,
      done: view.denominator.done,
      keyed: view.denominator.keyed,
      emptyBody: view.hits.filter((h) => h.type === TYPE_EMPTY).length,
      trailingPunct: view.hits.filter((h) => h.type === TYPE_TRUNCATED).length,
      fresh: view.fresh.length,
      stock: view.stock.length,
      state: view.state,
    })}`,
  )
  for (const h of view.hits) {
    console.log(
      `TRUNCATED-ROWS-HIT ${JSON.stringify({
        face: view.face,
        line: h.line,
        state: h.state,
        type: h.type,
        rule: h.rule,
        ruleName: h.ruleName,
        key: h.key,
        preview: h.preview,
        note: h.note,
        stock: view.stock.includes(h),
      })}`,
    )
  }
}

function selfTest() {
  let pass = 0
  let fail = 0
  const t = (name, ok, extra = '') => {
    if (ok) {
      pass += 1
      console.log(`✅ ${name}`)
    } else {
      fail += 1
      console.log(`❌ ${name}${extra ? `:${extra}` : ''}`)
    }
  }
  const EMPTY = '- [ ]（认领已释放@2026-10-23/stale-claim-strip#fixture-27）'
  const HEALTHY_LEAD = '- [ ]（认领已释放@2026-10-23/x） **本项遗留** ① 补 SMTP ② 补退信钩子'
  const TRUNC = '- [ ] G-9002 确认旁路仍在调用方(`commands/agent.ts:1757`),'
  const CLOSED = '- [ ] G-9003 正常一行,句中可以有逗号,收尾是句号。'
  const FIXTURE = [EMPTY, HEALTHY_LEAD, TRUNC, CLOSED].join('\n')

  const c = collect(FIXTURE)
  t(
    'R1 命中空正文 1 例',
    c.counts[TYPE_EMPTY] === 1 && c.hits.some((h) => h.line === 1 && h.rule === 'R1'),
  )
  t('R1 不收「行首标记 + 后面整段正文」', !c.hits.some((h) => h.line === 2))
  t(
    'R2 命中截断收尾 1 例',
    c.counts[TYPE_TRUNCATED] === 1 && c.hits.some((h) => h.line === 3 && h.rule === 'R2'),
  )
  t('R2 不收句中带逗号但句号收尾的正常行', !c.hits.some((h) => h.line === 4))
  t('正常行 0 误报(两型合计恰 2 枚)', c.hits.length === 2, JSON.stringify(c.counts))
  t('分母来自单源 parseTaskRows', c.denominator.rows === 4)
  t(
    '续写标点集三枚票面字符逐个命中',
    [',', ';', '、'].every((p) => collect(`- [ ] G-9 正文${p}`).counts[TYPE_TRUNCATED] === 1),
  )

  const base = buildBaseline(c.hits, new Date('2026-10-25T00:00:00Z'))
  t(
    '基线档写形:两型都在、计数与键集一致',
    base.version === 1 &&
      base.types[TYPE_EMPTY].count === 1 &&
      base.types[TYPE_TRUNCATED].keys.length === 1,
  )
  t(
    '基线内不判红(存量只报数)',
    judgeRatchet(c.hits, parseBaseline(JSON.stringify(base))).state === 'ok',
  )
  const freshHit = {
    line: 9,
    type: TYPE_TRUNCATED,
    rule: 'R2',
    key: 'K:G-9999',
    preview: 'x',
    note: 'n',
  }
  t('新增(身份不在基线)判红', judgeRatchet([...c.hits, freshHit], base).state === 'blocking')
  t('基线档缺失 ⇒ 未判定(不当 0 存量)', judgeRatchet(c.hits, null).state === 'undetermined')
  t(
    '基线档坏 JSON/坏形状 ⇒ null(交未判定)',
    parseBaseline('{') === null && parseBaseline('{"version":1}') === null,
  )
  t('枚举到 0 枚登记行 ⇒ 判死(不记绿)', collect('# 只有标题,以逗号收尾,\n').denominator.rows === 0)
  const face = pickFace([])
  t('默认档 = HEAD blob', face.face === 'head')
  t('两面旗同给 ⇒ 判死', pickFace(['--staged', '--worktree']).face === null)
  console.log(`--self-test: ${pass}/${pass + fail} 通过`)
  return fail
}

export function run(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(
      '用法: node scripts/check-plan-truncated-rows.mjs [--json] [--staged|--worktree] [--baseline=<path>] [--update-baseline] [--self-test]',
    )
    return 0
  }
  if (argv.includes('--self-test')) return selfTest()
  const unknown = argv.filter(
    (a) =>
      a.startsWith('-') &&
      !KNOWN_FLAGS.has(a) &&
      !(a === '--baseline' || a.startsWith('--baseline=')),
  )
  if (unknown.length) {
    console.log(`❌ 未判定:未知参数 ${unknown.join(' ')}`)
    return 2
  }
  const face = pickFace(argv)
  if (face.error) {
    console.log(`❌ 未判定:${face.error}`)
    return 2
  }
  try {
    assertRepoRoot(ROOT, GATE)
  } catch (e) {
    console.log(`❌ 未判定:基准不是仓库根 —— ${e?.message ?? e}`)
    return 2
  }
  let text
  try {
    text = readFace(face.face)
  } catch (e) {
    console.log(
      `❌ 未判定:${e?.message ?? e} —— 被审面取不到不回落另一个面(§0.4),不记绿也不冒红(§0.3)`,
    )
    return 2
  }
  const collected = collect(text)
  if (collected.denominator.rows === 0) {
    console.log(`❌ 未判定:${FACE_LABEL[face.face]} 上枚举到 0 枚登记行 ⇒ 尺子对这一面失明(§0.3)`)
    return 2
  }
  const file = baselinePath(argv)
  if (argv.includes('--update-baseline')) {
    if (face.face !== 'head') {
      console.log(
        '❌ 拒绝写基线:只有默认 HEAD 档可以写(索引/工作树可能是并行会话的半编辑态,写进去会把假存量洗成"合法")',
      )
      return 2
    }
    if (!file) {
      console.log('❌ 未判定:--baseline 缺路径值')
      return 2
    }
    const base = buildBaseline(collected.hits)
    writeFileSync(file, `${JSON.stringify(base, null, 2)}\n`, 'utf8')
    console.log(
      `📝 已写基线 ${path.relative(ROOT, file)}:R1 ${base.types[TYPE_EMPTY].count} 枚 · R2 ${base.types[TYPE_TRUNCATED].count} 枚`,
    )
    return 0
  }
  const loaded = loadBaseline(file)
  const baseline = loaded.raw === null ? null : parseBaseline(loaded.raw)
  if (baseline === null) {
    console.log(
      `❌ 未判定:${loaded.why ?? `基线档 ${loaded.file} 形状不合法`} —— 读不到基线不许当 0 存量;先用 --update-baseline 落盘`,
    )
    return 2
  }
  const verdict = judgeRatchet(collected.hits, baseline)
  const view = {
    face: face.face,
    baselineFile: file ? path.relative(ROOT, file) || file : '(未指定)',
    ...collected,
    fresh: verdict.fresh,
    stock: verdict.stock,
    state: verdict.state,
  }
  if (argv.includes('--json')) printJson(view)
  else printHuman(view)
  return verdict.state === 'blocking' ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exitCode = run(process.argv.slice(2))

export const __test__ = {
  collect,
  identityOf,
  parseBaseline,
  buildBaseline,
  judgeRatchet,
  run,
  GATE,
  BASELINE_REL,
  RULE,
  RULE_NAME,
  TYPES,
  DOC,
  TYPE_EMPTY,
  TYPE_TRUNCATED,
}
