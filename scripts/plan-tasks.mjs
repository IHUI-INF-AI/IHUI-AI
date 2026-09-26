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
  console.log(
    `  F6 整块登记重复(块级,行级四条判不到这一维): ${c.dupBlocks} 块 / 共 ${c.dupBlockCopies} 份` +
      ` —— 逐字相同才可自动收口;另有 ${c.dupBlockDrifted} 块首行相同而正文漂移(必须人工判哪份作数)`,
  )
  console.log(`  同态重复(done 侧只报数): done ${c.dupDoneGroups} 组`)
  console.log(`派单口径 —— 真·无人认领: ${c.claimable} 行`)
  console.log(
    `  分解(逐层互斥,可直接相加):未勾选 ${c.open} = 已认领 ${c.claimed} + 其余排除 ${c.unclaimed - c.claimable} + 真待办 ${c.claimable}`,
  )
  console.log(
    `  其余排除项**明细**(同一行可同时命中多项,故只能当诊断看、不得拿去减法核账):` +
      `同题已完成副本 ${c.forkOpenLines} / 自带作废声明 ${c.voidRows} / 当次算出的同题待办副本 ${c.dupOpenCopies} / 已标副本指针 ${c.dupPointerRows}`,
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

/** 前五条判据的读数(只判变多),按同一顺序成对比较;F5 方向相反,单独在 grewViolations / gate 里判。
 *  导出理由:同一份维度清单还被 `git-sync-converge` 的合并落地闸用(它拿基线核合并结果),
 *  在别处再抄一遍 `['F1', ...]` 就是第二个真相 —— 加一维时漏抄一处,那一维就静默不判。 */
export const probe = (a) => [
  ['F1', '同主键两态并存(组)', a.counts.forks],
  ['F2', '带作废声明未落账(行)', a.counts.voidRows],
  ['F3', '行号指针已腐烂(处)', a.counts.rotatedPointers],
  ['F4', '同一件事多条待办(副本行)', a.counts.dupOpenCopies],
  // F6 是**块**级量纲:一整块多行登记被追加两遍时,行级四条(F1–F4)一路通过 ——
  // 每一行看起来都"只是又一个孪生行"。本仓 2026-09-26 真实自伤过三次(2 份 → 3 份)。
  ['F6', '整块登记重复(块)', a.counts.dupBlocks],
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
  const out = items
    .filter(([k, , n]) => typeof prev.get(k)?.n === 'number' && n > prev.get(k).n)
    .map(([k, label, n]) => `${k} ${label} 由 ${prev.get(k).n} 涨到 ${n}(+$ ${n - prev.get(k).n})`)
  // F5 方向相反(只许增不许减),**不塞进上面那个"比变多"的循环** —— 一把尺子对同一维
  // 既判涨又判跌,读的人就无法知道哪个方向是坏。
  const b5 = before?.counts?.mergeNotes
  if (typeof b5 === 'number' && now.counts.mergeNotes < b5)
    out.push(`F5 归并落账注记由 ${b5} 条掉到 ${now.counts.mergeNotes} 条(被一次旧计划文档整文件提交抹掉了)`)
  return out
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
  // F5 与上面同层但方向相反:基线记的是"至少要有这么多条落账注记",**掉了**才判红。
  // 这一维专治"四条状态判据全绿而内容已被旧副本顶掉"(2026-09-26 一小时内实测发生两次)。
  if (typeof base?.F5 === 'number' && a.counts.mergeNotes < base.F5) {
    console.log(`❌ 存续性棘轮:归并落账注记由基线 ${base.F5} 条掉到 ${a.counts.mergeNotes} 条`)
    console.log('   成因只会是"按内存里那份旧计划文档整文件提交"或跳门回写;出路是重放那批注记,不是下调基线。')
    return 1
  }
  if (!nonZero.length) {
    console.log('✅ 五条"只判变多"的状态判据全部为零(F1–F4 + F6 块级;F5 注记存续性另判,见上)')
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
  // F5 存续性:方向与前四条**相反**(只许增不许减),故三例各判一个方向,缺一条就可能把"抹掉注记"当成好转绿
  const noted = auditPlan(
    '- [x] ✅(2026-09-26) **D9 带注记**:说明。〔【归并】D9 落账:复测 2026-09-26: 取证。\n' +
      '- [x] ✅(2026-09-26) **D10 带注记**:说明。〔【归并】D10 落账:复测 2026-09-26: 取证。',
  )
  const unnoted = auditPlan('- [x] ✅(2026-09-26) **D9 带注记**:说明。\n- [x] ✅(2026-09-26) **D10 带注记**:说明。')
  ok(noted.counts.mergeNotes === 2, `注记计数应为 2,实测 ${noted.counts.mergeNotes}`)
  ok(
    !grewViolations(noted, unnoted).some((x) => x.startsWith('F5')),
    '注记由 0 涨到 2 不得判红(那是好转)—— 反方向才判红,下一例核',
  )
  const loss = grewViolations(unnoted, noted)
  ok(loss.some((x) => x.includes('F5') && x.includes('掉到')), `注记被抹掉必须判红,实测 ${JSON.stringify(loss)}`)
  ok(auditPlan('').counts.mergeNotes === 0, '空面不得凭空数出注记')
  // F6 块级重复:行级四条(F1–F4)对"整块被追加两遍"完全失明,所以这一组必须自成一把尺子。
  // 阈值(>=3 行 / 每行 >=40 字符)是实测调出来的:低于它,台账里天然的成对短行会把噪声当债务。
  const B1 = '- 第一行:整块登记的探针结论与取证命令,长度必须过阈值才纳入统计口径说明段'
  const B2 = '- 第二行:同一块的第二条 bullet,同样要够长,短行(`- [x]` 之类)不参与块级判据'
  const B3 = '- 第三行:第三条,三行构成一个"块";块是 F6 的量纲,单行不是 —— 这是本条的存在理由'
  const blk = [B1, B2, B3]
  const pad = (s) => s + '　'.repeat(Math.max(0, 42 - [...s].length))
  const block = blk.map(pad).join('\n')
  // 尾行刻意不是 bullet:bullet 会把上一个块"续"成 4 行 run,而 run 里只要有一行不够长,
  // 整个 run 就不入统计 —— 第一版夹具就栽在 `- 别的行` 这一行上(报 0 而非 1)。
  const oneCopy = auditPlan(`## 段\n${block}\n## 另一段\n尾部说明不是 bullet`)
  const twoCopies = auditPlan(`## 段\n${block}\n## 另一段\n${block}\n\n尾部说明不是 bullet`)
  ok(oneCopy.counts.dupBlocks === 0, `单份块不得数出重复,实测 ${oneCopy.counts.dupBlocks}`)
  ok(twoCopies.counts.dupBlocks === 1, `逐字相同的两份应算 1 块重复,实测 ${twoCopies.counts.dupBlocks}`)
  ok(twoCopies.counts.dupBlockCopies === 2, `份数应为 2,实测 ${twoCopies.counts.dupBlockCopies}`)
  // 漂移(首行同而正文不同)不得混进"可自动收口"那一档 —— 机器折半必然有损,与 F4 同一条理由
  const drift = auditPlan(`## 段\n${block}\n## 另一段\n${[pad(B1), pad(B2 + '(改)'), pad(B3)].join('\n')}`)
  ok(drift.counts.dupBlocks === 0, `漂移副本不得算逐字重复,实测 ${drift.counts.dupBlocks}`)
  ok(drift.counts.dupBlockDrifted === 1, `漂移应单独计 1,实测 ${drift.counts.dupBlockDrifted}`)
  // 阈值两向:2 行块与短行块都不算(否则会产出成百条噪声,把这一维淹掉)
  ok(auditPlan(`${pad(B1)}\n${pad(B2)}`).counts.dupBlocks === 0, '2 行块不得纳入块级判据')
  ok(auditPlan('- a\n- b\n- c\n- a\n- b\n- c').counts.dupBlocks === 0, '短行块不得纳入块级判据')
  // 方向:多出一份必点名,收口掉一份(清偿)不得判红
  ok(
    grewViolations(twoCopies, oneCopy).some((x) => x.startsWith('F6')),
    `由 0 块涨到 1 块必须判红,实测 ${JSON.stringify(grewViolations(twoCopies, oneCopy))}`,
  )
  ok(
    !grewViolations(oneCopy, twoCopies).some((x) => x.startsWith('F6')),
    '清偿(1 块降到 0)不得判红 —— 反方向判红等于没人敢做归并',
  )
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
        // F6 是块级量纲(整块登记被追加两遍)。存量非零时它只能当棘轮上限用,
        // 清到零之后把基线写成 0 ⇒ 零容忍;不得为了让这条绿去调高它。
        F6: a.counts.dupBlocks,
        // F5 与前四条**方向相反**:记的是"归并落账注记至少要有这么多条",掉了才判红
        F5: a.counts.mergeNotes,
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
