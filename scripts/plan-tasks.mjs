#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * plan-tasks.mjs —— PROJECT_PLAN.md 任务状态的单一查询/问责入口(2026-09-26 立)
 *
 * 存在的理由:计划文档被当台账用却没有主键约束,于是"同一件事既像已完成又像没人做"
 * 可以无限累积(实测 HEAD 面 270 个复合主键里 37 组两态并存、42 行自带作废声明)。
 * 既有防护链全部**单向防丢**(门 71 / 84 / 100 / 工作区自愈),没有一道判"状态分叉"。
 * 本 CLI 把状态从文本行里抽出来,给出可复核的三条确定性判据读数,并作为派单口径的唯一出口
 * —— `--open` 才是"真没人做"的清单,而不是 `grep '^- [ ]'`。
 *
 * 用法:
 *   node scripts/plan-tasks.mjs                  # 人读汇总
 *   node scripts/plan-tasks.mjs --open           # 真·无人认领清单(已剔除他人已认领、作废声明与分叉副本)
 *   node scripts/plan-tasks.mjs --forks          # F1 同主键两态并存
 *   node scripts/plan-tasks.mjs --void           # F2 带作废声明却未落账
 *   node scripts/plan-tasks.mjs --pointers       # F3 行号指针已腐烂
 *   node scripts/plan-tasks.mjs --gate [--strict] # 判据档(默认存量只报数;--strict 判红)
 *   node scripts/plan-tasks.mjs --json | --self-test | --staged | --worktree
 *
 * 取材面纪律(同守门 70/77/83/98/101/118):全量判 **HEAD blob**、`--staged` 判**索引 blob**、
 * `--worktree` 只作人工逃生舱;两面旗同给 ⇒ exit 2;任一面取不到 ⇒ **exit 2「无法判定」,不回落**。
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { auditPlan, compositeKeyOf, parseTaskRows } from './lib/plan-task-index.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PLAN_REL = 'PROJECT_PLAN.md'
/** 真实形态样本钉在"首次归并的前一版"上 —— 清偿之后当前 HEAD 不再含那批行(见 selfTest 注释)。 */
const SAMPLE_REV = '0bc0af653df^'
const LABEL = { head: 'HEAD blob', staged: '索引 blob', worktree: '工作树(人工逃生舱)' }

function parseArgs(argv) {
  const has = (f) => argv.includes(f)
  const sel = selectFace({ staged: has('--staged'), worktree: has('--worktree'), def: 'head' })
  return {
    json: has('--json'),
    open: has('--open'),
    forks: has('--forks'),
    void: has('--void'),
    pointers: has('--pointers'),
    gate: has('--gate'),
    strict: has('--strict'),
    selfTest: has('--self-test'),
    updateBaseline: has('--update-baseline'),
    face: sel.face,
    faceError: sel.error,
    root: has('--root') ? path.resolve(argv[argv.indexOf('--root') + 1]) : ROOT,
  }
}

/** 只读一条文档。整面取不到 ⇒ 抛 Undetermined(调用方转 exit 2),绝不静默换面。 */
function readPlan(root, face) {
  if (face === 'worktree') {
    const got = readWorktreeFile(root, PLAN_REL)
    if (got === null || got === undefined) throw new Undetermined(`工作树(逃生舱)取不到 ${PLAN_REL}`)
    return got
  }
  const spec = face === 'staged' ? `:${PLAN_REL}` : `HEAD:${PLAN_REL}`
  const got = catBatch(root, [spec], { maxBuffer: 1 << 28 })
  // catBatch 返回 Map<rev, text|null> —— 按 rev 取,按数组下标取会恒得 undefined 并伪装成"取不到"
  const text = got.get(spec)
  if (text === null || text === undefined) throw new Undetermined(`${LABEL[face]} 取不到 ${PLAN_REL}`)
  return text
}

const clip = (s, n = 96) => s.replace(/\s+/g, ' ').trim().slice(0, n)

function report(a, face) {
  const c = a.counts
  console.log(`判定面:${LABEL[face]}`)
  console.log(`条目行 ${a.rows}(未勾选 ${c.open} / 已完成 ${a.doneRows}),其中带租约 ${c.claimed}`)
  console.log(`复合主键 ${a.composites} 组`)
  console.log(`  F1 同主键两态并存 : ${c.forks} 组 / 涉及未勾选行 ${c.forkOpenLines}`)
  console.log(`  F2 带作废声明未落账: ${c.voidRows} 行`)
  console.log(`  F3 行号指针已腐烂  : ${c.rotatedPointers} 处`)
  console.log(
    `  F4 同一件事多条待办: ${c.dupOpenGroups} 组 / 副本 ${c.dupOpenCopies} 行(不进派单口径)`,
  )
  console.log(`  同态重复(done 侧只报数): done ${c.dupDoneGroups} 组`)
  console.log(
    `派单口径 —— 真·无人认领: ${c.claimable} 行(= 未勾选 ${c.open} − 已认领 ${c.claimed} − 分叉副本 − 作废声明 − 同题待办副本)`,
  )
}

function listRows(rows, face) {
  console.log(`── ${rows.length} 行(判定面:${LABEL[face]})──`)
  for (const r of rows) console.log(`  L${r.line}  ${clip(r.raw)}`)
}

/**
 * 判据档。三层强度,各守不同的失效面:
 *  1. **差值棘轮(本门的主判据)**:`--staged` 档把**索引面**与 **HEAD 面**同轮各算一次,
 *     只在"本次提交让某一项变多"时判红。为什么必须是差值而不是绝对值:runner 会给每道门
 *     追加 `--staged`,而存量(F1/F2/F3)本来就非零 —— 拿绝对量判红等于把别人已入库的债
 *     钉在无关提交上,唯一结局是逼人 `--no-verify` 连带废掉全部守门(§12e 同型)。
 *     差值判据还有一条好处:**不需要维护会腐烂的基线台账**才能成立。
 *  2. **基线棘轮**(可选,`scripts/plan-task-state-baseline.json` 在位时):防"有人跳门把增长
 *     塞进 HEAD" —— 那一型差值判据看不见(索引面与 HEAD 面同时变大)。基线只许人工下调。
 *  3. **`--strict`**:存量一律判红,给人工清偿与 CI 问责。默认档只报数。
 */
const BASELINE_REL = 'scripts/plan-task-state-baseline.json'

/** 三条判据的读数,按同一顺序成对比较。 */
const probe = (a) => [
  ['F1', '同主键两态并存(组)', a.counts.forks],
  ['F2', '带作废声明未落账(行)', a.counts.voidRows],
  ['F3', '行号指针已腐烂(处)', a.counts.rotatedPointers],
  ['F4', '同一件事多条待办(副本行)', a.counts.dupOpenCopies],
]

/** 棘轮纯函数:基线里没有某项 ⇒ 不判该项(既不"0 容忍"也不"通过")。 */
export function ratchetViolations(base, items) {
  if (!base) return []
  return items
    .filter(([k, , n]) => typeof base[k] === 'number' && n > base[k])
    .map(([k, label, n]) => `${k} ${label} 由基线 ${base[k]} 涨到 ${n}`)
}

/** 差值棘轮纯函数:两把同形读数(候选面 vs 基准面)只比"变多"。 */
export function grewViolations(now, before) {
  const items = probe(now)
  const prev = new Map(probe(before).map(([k, label, n]) => [k, { label, n }]))
  return items
    .filter(([k, , n]) => typeof prev.get(k)?.n === 'number' && n > prev.get(k).n)
    .map(([k, label, n]) => `${k} ${label} 由 ${prev.get(k).n} 涨到 ${n}(+$ ${n - prev.get(k).n})`)
}

function readBaseline(root) {
  const abs = path.join(root, BASELINE_REL)
  if (!existsSync(abs)) return null
  try {
    return JSON.parse(readFileSync(abs, 'utf8'))
  } catch (e) {
    // 坏 JSON 不得静默当"没有基线" —— 那等于把棘轮关掉而不吭声
    throw new Undetermined(`${BASELINE_REL} 解析失败:${String(e?.message ?? e).split('\n')[0]}`)
  }
}

/**
 * @param a      当前判定面的读数
 * @param before 差值棘轮的基准面读数(仅 `--staged` 档给:索引面 vs HEAD 面同轮各算一次)
 *               取不到基准面 ⇒ **不判差值**并喊出来(把"没判"写成"判过了"是本仓最高频失效型)
 */
function gate(a, strict, root, before, beforeErr) {
  const items = probe(a)
  const nonZero = items.filter(([, , n]) => n > 0)
  let base = null
  try {
    base = readBaseline(root)
  } catch (e) {
    console.log(`⚠️ 无法判定 —— ${e.message}`)
    return 2
  }
  if (before) {
    const grew = grewViolations(a, before)
    if (grew.length) {
      console.log(`❌ 差值棘轮:本次改动让状态分叉变多 —— ${grew.join(';')}`)
      console.log('   归并掉新增的那几条(把副本行翻勾或改成内容锚点),别调基线、别削判据。')
      return 1
    }
    console.log(`✅ 差值棘轮:相对 HEAD,本次提交未新增状态分叉(${items.map(([k, , n]) => `${k}=${n}`).join(' ')})`)
  } else if (beforeErr) {
    console.log(`⚠️ 差值棘轮未判定 —— ${beforeErr}`)
  }
  const vsBase = ratchetViolations(base, items)
  if (vsBase.length) {
    console.log(`❌ 基线棘轮:${vsBase.join(';')}`)
    console.log(`   差值判据看不见"别人跳门把增长塞进 HEAD"那一型,这一层就是为它留的。`)
    console.log(`   出路:清偿后人工跑 \`node scripts/plan-tasks.mjs --update-baseline\` 并说明为什么 —— 调高基线等于关掉这一维。`)
    return 1
  }
  if (!nonZero.length) {
    console.log('✅ 三条状态判据全部为零')
    return 0
  }
  if (!strict) {
    console.log(`⚠️  存量只报数(默认档):${nonZero.map(([k, label, n]) => `${k} ${label} ${n}`).join(' / ')}`)
    console.log(`   问责跑 \`--strict\`;存量清到零之前不得对它升 blocking(防恒红门)。基线在位:${base ? '是' : `否(缺 ${BASELINE_REL})`}`)
    return 0
  }
  console.log(`❌ 状态判据成立:${nonZero.map(([k, label, n]) => `${k} ${label} ${n}`).join(' / ')}`)
  return 1
}

// ── 自检:判据跑在**构造面**上,不依赖仓库瞬时状态(§22c:镜像测试只复读实现就是复读机)──
const FIXTURE = [
  '# 计划',
  '- [x] ✅(2026-09-26) **D99 复合主键正例**:说明文字。',
  '- [ ] **D99 复合主键正例**:同一件事的旧副本还挂着 —— 该被 F1 点名。',
  '- [ ] **D98 未做的任务**:这条是真待办,不得被任何判据点名。',
  '- [ ] **D97 作废声明**:〔本行判:已完成,勿照本行派单〕—— 该被 F2 点名。',
  '- [ ] **D96 指针**:本行正题逐字存活于 L1 的同编号登记 —— L1 不是条目行,该被 F3 点名。',
  '- [ ]（进行中@2026-09-26/someone） **D94 别人已认领**:必须**不进**派单口径(第一版把它算进去了)。',
  // F4 夹具:两条都是未勾选、主键同题 ⇒ 副本那条不得进派单口径(同一件活不能派两遍)
  '- [ ] **D93 重复待办**:第一条登记。',
  '- [ ] **D93 重复待办**:与上一条同主键的第二次登记。',
  // F4 夹具:两条都是未勾选、主键同题 ⇒ 副本那条不得进派单口径(同一件活不能派两遍)
  '- [x] ✅(2026-09-26) **D95 重复登记已完成**:两行逐字同态。',
  '- [x] ✅(2026-09-26) **D95 重复登记已完成**:两行逐字同态。',
  '',
].join('\n')

function selfTest() {
  let pass = 0
  let fail = 0
  const ok = (cond, name) => {
    if (cond) {
      pass++
    } else {
      fail++
      console.log(`  ❌ ${name}`)
    }
  }
  const a = auditPlan(FIXTURE)
  const c = a.counts
  ok(a.rows === 10, `条目行数应为 10(含 F4 那一对同题待办),实测 ${a.rows}`)
  ok(c.forks === 1 && a.forks[0].key.startsWith('D99'), `F1 应恰好点到 D99,实测 ${a.forks.map((f) => f.key).join(',')}`)
  ok(a.forks[0].done.length === 1 && a.forks[0].open.length === 1, 'F1 组内应各一态一行')
  ok(a.voidRows.length === 1 && a.voidRows[0].raw.includes('D97'), 'F2 应点到带作废声明的那一行')
  ok(a.rotated.length === 1 && a.rotated[0].target === 1, `F3 应点到腐烂指针 L1,实测 ${JSON.stringify(a.rotated.map((r) => r.target))}`)
  ok(
    c.dupDoneGroups === 1 && c.dupOpenGroups === 1,
    `done 侧同态重复只报数、open 侧由 F4 判:实测 open=${c.dupOpenGroups} done=${c.dupDoneGroups}`,
  )
  // 派单口径:未勾选 5 行(D99 副本 / D98 / D97 / D96 / D94 已认领),
  // 扣掉 F1 分叉行、F2 作废行与**带租约的 D94** ⇒ 只剩 D98 与 D96
  ok(c.open === 7, `夹具应有 7 行未勾选,实测 ${c.open}`)
  ok(c.claimed === 1 && c.unclaimed === 6, `租约计数应为 1/6,实测 ${c.claimed}/${c.unclaimed}`)
  ok(c.claimable === 3, `派单口径应为 3(D98 + D96 + D93 幸存者),实测 ${c.claimable}`)
  ok(
    c.dupOpenGroups === 1 && c.dupOpenCopies === 1,
    `F4 应计 1 组 1 副本,实测 ${c.dupOpenGroups}/${c.dupOpenCopies}`,
  )
  ok(
    !a.claimableRows.some((r) => r.raw.includes('第一条登记')),
    'F4 的副本行不得进派单口径 —— 同一件活被派两遍,正是"计划里怎么还有重复的"那一格',
  )
  ok(
    !a.claimableRows.some((r) => r.raw.includes('D94')),
    '已带租约的行不得进派单口径 —— 否则 §1 的认领标记形同虚设,别人正在做的事会被再派一遍',
  )
  // 反向对照:一条什么都没做坏的文档不得产生任何红
  const clean = auditPlan(['- [ ] **D90 干净任务**:无人认领。', '- [x] ✅(2026-09-26) **D91 干净完成**:已落账。'].join('\n'))
  ok(clean.counts.forks === 0 && clean.counts.voidRows === 0 && clean.counts.rotatedPointers === 0, '干净文档必须三条全零')
  ok(clean.counts.claimable === 1, `干净文档派单口径应为 1,实测 ${clean.counts.claimable}`)
  // 空面不得记绿(§门 118/126 同一条禁令)
  ok(auditPlan('').rows === 0, '空文档应零条目')
  // 真实形态样本取自**固定的历史 blob**(`0bc0af653df^` = 首次归并的前一版),不取当前 HEAD:
  // 清偿之后 HEAD 上就没有"判:裸副本"的未勾选行了,拿 HEAD 当夹具的断言会在成功那一轮变红。
  // 读不到该历史版本必须失败 —— 静默跳过等于把"没判"写成"判过了"。
  let sample = ''
  try {
    sample = gitRaw(['show', `${SAMPLE_REV}:PROJECT_PLAN.md`], ROOT)
  } catch (e) {
    ok(false, `样本历史版本取不到(${SAMPLE_REV}):${String(e?.message ?? e).split('\n')[0]}`)
  }
  const real = parseTaskRows(sample).filter((r) => r.state === 'open' && /判:裸副本/.test(r.raw))
  ok(real.length > 0, `${SAMPLE_REV} 里应读到"判:裸副本"的未勾选行,否则本条正向证明失去载体`)
  const realAudit = auditPlan(real.map((r) => r.raw).join('\n'))
  ok(realAudit.voidRows.length === real.length, `真实样本 F2 应全中:${realAudit.voidRows.length}/${real.length}`)
  ok(compositeKeyOf(real[0]?.raw ?? '') !== null, '真实行应能算出复合主键')
  // 棘轮纯函数:只有"涨"才判红。等值/下降/基线缺项三种都不许点名 ——
  // 缺项判红会变成"台账没登记的维度一被扫到就红",那是替人关掉这一维的反面。
  const items = [['F1', '同主键两态并存(组)', 5], ['F2', '带作废声明未落账(行)', 3], ['F3', '行号指针已腐烂(处)', 0]]
  ok(ratchetViolations(null, items).length === 0, '没有基线时棘轮不得凭空判红')
  ok(
    ratchetViolations({ F1: 4, F2: 3, F3: 0 }, items).join() === 'F1 同主键两态并存(组) 由基线 4 涨到 5',
    `棘轮应只点名上涨的那一项,实测 ${JSON.stringify(ratchetViolations({ F1: 4, F2: 3, F3: 0 }, items))}`,
  )
  ok(ratchetViolations({ F1: 9, F2: 9 }, items).length === 0, '低于基线不得判红(清偿应当变绿)')
  ok(ratchetViolations({ F1: 'x' }, items).length === 0, '基线值不是数字时不得判红,也不得当作通过(由 --json 现读兜底)')
  // 差值棘轮(提交链上的主判据):基准取不到时调用方根本不传 before,这里只比"变多"
  const mk = (f1, f2, f3) => ({ counts: { forks: f1, voidRows: f2, rotatedPointers: f3 } })
  ok(grewViolations(mk(4, 0, 0), mk(3, 0, 0)).length === 1, '相对 HEAD 变多必须点名')
  ok(grewViolations(mk(3, 0, 0), mk(3, 0, 0)).length === 0, '等值不得判红(存量债不归本次提交)')
  ok(grewViolations(mk(2, 5, 0), mk(3, 0, 0)).length === 1, '一项降一项升时只点名上涨的那项')
  console.log(`\n自检:${pass} 通过 / ${fail} 失败`)
  return fail ? 1 : 0
}

function main() {
  const argv = process.argv.slice(2)
  const o = parseArgs(argv)
  if (o.selfTest) return selfTest()
  if (o.faceError) {
    console.log(`⚠️ 无法判定 —— ${o.faceError}`)
    return 2
  }
  let a
  try {
    a = auditPlan(readPlan(o.root, o.face))
  } catch (e) {
    const why = e instanceof Undetermined ? e.message : `取材失败:${String(e?.message ?? e).split('\n')[0]}`
    console.log(`⚠️ 无法判定 —— ${why}`)
    return 2
  }
  // ⚠ 基线取的是**当次当面的实测数**,换一次提交就会变。所以它只能由人工在清偿之后刷,
  // 且只允许在全量档执行 —— 从索引/工作树面刷基线等于把别人未提交的中间态冻进台账。
  if (o.updateBaseline) {
    if (o.face !== 'head') {
      console.log('❌ --update-baseline 只允许在全量档(HEAD blob)执行,不得从索引/工作树面刷基线')
      return 2
    }
    const body = JSON.stringify(
      {
        F1: a.counts.forks,
        F2: a.counts.voidRows,
        F3: a.counts.rotatedPointers,
        F4: a.counts.dupOpenCopies,
      },
      null,
      2,
    )
    writeFileSync(path.join(o.root, BASELINE_REL), body + '\n', 'utf8')
    console.log(`已写下棘轮基线(${LABEL[o.face]} 现读):${body.replace(/\s+/g, ' ')}`)
    console.log('基线只许下调。为过门而调高 = 关掉这一维的看守,与"为消红削判据"同罪。')
    return 0
  }
  if (o.json) {
    console.log(
      JSON.stringify(
        {
          face: LABEL[o.face],
          counts: a.counts,
          rows: a.rows,
          composites: a.composites,
          open: a.claimableRows.map((r) => ({ line: r.line, key: r.key, text: clip(r.raw, 160) })),
          forks: a.forks.map((f) => ({ key: f.key, done: f.done.map((r) => r.line), open: f.open.map((r) => r.line) })),
          void: a.voidRows.map((r) => ({ line: r.line, text: clip(r.raw, 160) })),
          pointers: a.rotated.map((r) => ({ line: r.line, target: r.target, reason: r.reason })),
        },
        null,
        2,
      ),
    )
    return 0
  }
  if (o.open) {
    listRows(a.claimableRows, o.face)
    return 0
  }
  if (o.forks) {
    console.log(`── F1 同主键两态并存:${a.forks.length} 组 ──`)
    for (const f of a.forks) console.log(`  ${f.key}  done@${f.done.map((r) => r.line).join(',')} | open@${f.open.map((r) => r.line).join(',')}`)
    return 0
  }
  if (o.void) {
    listRows(a.voidRows, o.face)
    return 0
  }
  if (o.pointers) {
    console.log(`── F3 指针腐烂:${a.rotated.length} 处 ──`)
    for (const r of a.rotated) console.log(`  L${r.line} → L${r.target}  ${r.reason}`)
    return 0
  }
  report(a, o.face)
  if (o.gate) {
    let before = null
    let beforeErr = null
    if (o.face === 'staged') {
      try {
        before = auditPlan(readPlan(o.root, 'head'))
      } catch (e) {
        beforeErr = `HEAD 基准面取不到(${e instanceof Undetermined ? e.message : String(e?.message ?? e).split('\n')[0]})`
      }
    }
    return gate(a, o.strict, o.root, before, beforeErr)
  }
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    const code = main()
    if (code !== 0) process.exit(code)
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
