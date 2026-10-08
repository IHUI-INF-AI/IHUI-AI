#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 台账专项落地工具为 CLI,需 console 输出 */
/**
 * plan-copy-row-purge.mjs —— 同主键副本行**物理归并**(批1,2026-10-08 立)
 *
 * 票:G-1102638。机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕—— §1 规矩2「只登记不删行」
 * 自本票起收窄为「同主键副本行经本器判删,真删不留占位」;可溯性由 git 历史与本器的
 * 逐行留痕 jsonl 共同承担。动因:账面 1623 行未勾里 463 组复合主键摊 ~3.5 行/任务,
 * 大头是 1160 行【归并】副本 + 行首「副本指针(编号…)」族,一行一任务从此成立。
 *
 * 批1删除对象(**逐行独立判,六条全过才删**,宁可漏删不可误删):
 *   ① `isClaimExcludedPointer(raw)` 命中 —— 行自述"我是副本"(行首「副本指针(编号…)」族
 *      ∪ 正文「【归并】重复登记副本」族,判据唯一出口 lib/plan-task-index.mjs);
 *   ② 不带落账注记(`MERGE_NOTE_RE` 不命中)—— 带〔【归并】…落账:复测…〕的行是批2对象:
 *      F5 差值棘轮(grewViolations)是提交链上的拦点,批1删它必红,批2须配套判据修改,不混做;
 *   ③ 无租约(`claim` 假)—— 租约行是活账,永不删;
 *   ④ 副本有"接收方":
 *      - 【归并】族:同复合主键组(`keyOfRow` 编号+标题逐字等值)内存在**幸存者**
 *        (open ∧ 无副本标记 ∧ 无租约 ∧ 异行)—— 组内不删空;
 *      - 行首指针族:自述指向编号 N(`副本指针(编号 N)`),新面仍存在编号 N 的 open 行 —— 指向不悬空;
 *   ⑤ 行所属主键组不在 F9 撞号声明组(撞号组的"同主键"语义被污染,归撞号链管,G-312);
 *   ⑥ 不在 F1 forkOpenLines(与 auditPlan 同口径;现读 0 组,保险档)。
 *
 * 幸存者选择与 F4 既有规则同向(lib :620 "幸存者取正文最长者,等长取行号靠后")——批1只判
 * "存在幸存者"不挑具体行,批2 归并正文时再按同一规则择优。
 *
 * 安全阀(全机器核,不靠人眼;仿 plan-tasks-merge 的四条 + 归档器的对象空间通道):
 *   - 行数对账:new = old − deleted;未删行按行号对齐**逐字不变**;
 *   - 复跑 auditPlan(newContent):F1 必须 === 0;dupPointerRows 必须下降;mergeNotes 必须不变
 *     (批1不碰落账注记);F9 声明组数不得增加(删行不造新键);
 *   - 门71模拟:每个被删行的编号 token 在新面仍有登记行(行首编号或加粗标记,判活同源);
 *   - CAS:parent = 现读 HEAD,`writeBlob → commitTreeWithIndex → casUpdateRef`(plumbing 唯一
 *     实现 lib/bypass-git.mjs;防覆盖:cas 失败即停不重试,交人看面);
 *   - 幂等:删除集为 0 ⇒ 报"无可删行" exit 0(重跑安全)。
 *
 * 留痕:删除清单逐行落 `.ihui-agent/archive/PROJECT_PLAN_copy-purge-<day>.jsonl`(line/raw/
 * family/key/survivorLine),与正文同笔提交 —— 真删不等于无痕,账逐条对得回来。
 *
 * 用法:
 *   node scripts/plan-copy-row-purge.mjs --dry-run   # 只打印删除清单与安全阀读数,不落地
 *   node scripts/plan-copy-row-purge.mjs --apply     # 对象空间 CAS 真落(提交 PROJECT_PLAN.md + 留痕 jsonl)
 *   node scripts/plan-copy-row-purge.mjs --self-test # 判据纯函数自检(零派生、零副作用)
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch } from './lib/face-reader.mjs'
import {
  DUP_POINTER_RE,
  COPY_POINTER_ROW_RE,
  isClaimExcludedPointer,
  MERGE_NOTE_RE,
  parseTaskRows,
  compositeKeyOf,
  findForks,
  f9Faces,
} from './lib/plan-task-index.mjs'
import {
  alignSharedIndex,
  casUpdateRef,
  commitTreeWithIndex,
  resolveHeadRef,
  writeBlob,
  writeBlobOfWorktree,
} from './lib/bypass-git.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const LEDGER = 'PROJECT_PLAN.md'
const LEDGER_REL = `HEAD:${LEDGER}`

/** 行首指针族的指向编号提取:`副本指针(编号 62)` / `(编号 4·观察期)` 全半角括号都收。 */
export function pointedIdOf(raw) {
  const m = /副本指针\s*[（(]编号\s*([^）)\n]{1,24})[）)]/.exec(raw)
  return m ? m[1].trim() : null
}

const hasCopyMark = (raw) => isClaimExcludedPointer(raw)
const hasSettledNote = (raw) => MERGE_NOTE_RE.test(raw)

/**
 * 批1删除判定(纯函数,self-test 直测):给定全行集合,返回删除行索引集合与逐行理由。
 * 六条判据见文件头注 —— 这里是唯一实现,--dry-run/--apply/--self-test 三档共用。
 */
export function selectCopyRowsToPurge(rows) {
  const openRows = rows.filter((r) => r.state === 'open')
  // 组账:复合主键 → open 行(幸存者判定用)
  const byKey = new Map()
  for (const r of openRows) {
    const k = r.key
    if (!k) continue
    if (!byKey.has(k)) byKey.set(k, [])
    byKey.get(k).push(r)
  }
  // 编号账:编号 → open 行(行首指针族的"指向不悬空"判定用)
  const openById = new Map()
  for (const r of openRows) {
    const id = r.key
    if (!id) continue
    if (!openById.has(id)) openById.set(id, [])
    openById.get(id).push(r)
  }
  const deletes = []
  for (const r of rows) {
    if (r.state !== 'open') continue // 只动未勾行(勾行归归档器)
    if (!hasCopyMark(r.raw)) continue // ①
    if (hasSettledNote(r.raw)) continue // ② 批2对象
    if (r.claim) continue // ③
    const pointed = COPY_POINTER_ROW_RE.test(r.raw) ? pointedIdOf(r.raw) : null
    if (pointed) {
      // ④a 行首指针族:指向编号仍有 open 行(非本行)
      const targets = (openById.get(pointed) ?? []).filter((x) => x.line !== r.line)
      if (!targets.length) continue
      deletes.push({ row: r, family: 'pointer-row', key: pointed, survivorLine: targets[0].line })
    } else {
      // ④b 【归并】族:同复合主键组内存在幸存者
      const k = r.key ?? compositeKeyOf(r.raw)
      if (!k) continue
      const group = byKey.get(k) ?? []
      const survivor = group.find(
        (x) => x.line !== r.line && !hasCopyMark(x.raw) && !hasSettledNote(x.raw) && !x.claim,
      )
      if (!survivor) continue
      deletes.push({ row: r, family: 'merge-note', key: k, survivorLine: survivor.line })
    }
  }
  return deletes
}

function selfTest() {
  const mk = (line, raw, extra = {}) => ({ line, state: 'open', raw, body: raw, key: null, claim: null, ...extra })
  let fail = 0
  const ok = (cond, msg) => {
    if (!cond) {
      fail++
      console.error(`❌ ${msg}`)
    }
  }
  // ① 行首指针族:指向仍在 ⇒ 删
  let d = selectCopyRowsToPurge([
    mk(1, '- [ ] G-10 主任务行(正文最全)', { key: 'G-10' }),
    mk(2, '- [ ] 副本指针(编号 G-10)：同主键第二份未勾选副本,只加指针不动勾选;当前状态见 G-10 那条。'),
  ])
  ok(d.length === 1 && d[0].family === 'pointer-row' && d[0].row.line === 2, '行首指针族应删第2行')
  // ①b 指向悬空 ⇒ 不删
  d = selectCopyRowsToPurge([mk(1, '- [ ] 副本指针(编号 G-99)：状态见 G-99 那条。')])
  ok(d.length === 0, '指向悬空的指针行不得删')
  // ② 落账注记行 ⇒ 不删(批2对象)
  d = selectCopyRowsToPurge([
    mk(1, '- [ ] G-20 主行'),
    mk(2, '- [ ] G-20 同题副本 - 〔【归并】重复登记副本…落账:复测 2026-10-01 机主已拍板,派单以 G-20 主行为准〕'),
  ])
  ok(d.length === 0, '带落账注记的副本行批1不删')
  // ③ 带租约 ⇒ 不删
  d = selectCopyRowsToPurge([
    mk(1, '- [ ] G-30 主行'),
    mk(2, '- [ ] G-30 同题副本(进行中@2026-10-08/某人) - 【归并】重复登记副本,派单以主行为准'),
  ])
  ok(d.length === 0, '带租约行不得删')
  // ④b 【归并】族:同键幸存者在 ⇒ 删;组内全带标记 ⇒ 整组不删。
  // 用例传显式 key(parseTaskRows 的 r.key = keyOfRow = 编号);compositeKeyOf 真实路径
  // 由 HEAD 语料 dry-run 381 行全过(2026-10-08)。
  d = selectCopyRowsToPurge([
    mk(1, '- [ ] **G-40 题面甲** 正文', { key: 'G-40' }),
    mk(2, '- [ ] **G-40 题面甲** 正文 - 【归并】重复登记副本,派单以那条为准', { key: 'G-40' }),
  ])
  ok(d.length === 1 && d[0].row.line === 2, '同键幸存者在,副本行应删')
  d = selectCopyRowsToPurge([
    mk(1, '- [ ] **G-41 题面乙** 副本A - 【归并】重复登记副本', { key: 'G-41' }),
    mk(2, '- [ ] **G-41 题面乙** 副本A - 【归并】重复登记副本', { key: 'G-41' }),
  ])
  ok(d.length === 0, '组内无幸存者(全带标记)整组保留')
  // ③b 无主键正文行(叙述式)不在【归并】判 ⇒ 不删
  d = selectCopyRowsToPurge([mk(1, '随便一行正文没有复选框')])
  ok(d.length === 0, '非复选框行不在视野')
  if (fail) {
    console.error(`self-test ${fail} 项红`)
    return 1
  }
  console.log('✅ self-test 全绿')
  return 0
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) process.exit(selfTest())
  const apply = args.includes('--apply')
  if (!apply && !args.includes('--dry-run')) {
    console.error('缺 --apply / --dry-run(默认只读不猜)')
    process.exit(2)
  }

  // 底稿 = 被审面:取材层 catBatch 取 HEAD 正文(归档器同规,不自拼 git show)
  const headRef = resolveHeadRef({ root: ROOT })
  const content = catBatch(ROOT, [LEDGER_REL]).get(LEDGER_REL)
  if (typeof content !== 'string' || !content) throw new Error(`取不到 ${LEDGER_REL} ⇒ 拒绝执行`)
  const eol = content.includes('\r\n') ? '\r\n' : '\n'
  const lines = content.split(/\r?\n/)

  const rows = parseTaskRows(content)
  const { forks } = findForks(content)
  const forkOpenLines = new Set(
    forks.flatMap((g) => g.open.filter((r) => !DUP_POINTER_RE.test(r.raw)).map((r) => r.line)),
  )
  const f9 = f9Faces(content)
  const f9Keys = new Set(f9.collisions.map((g) => g.key))

  const candidates = selectCopyRowsToPurge(rows).filter((d) => {
    if (forkOpenLines.has(d.row.line)) return false // ⑥
    if (d.family === 'merge-note' && f9Keys.has(d.key)) return false // ⑤
    return true
  })

  const before = { openRows: rows.filter((r) => r.state === 'open').length }
  console.log(`判定面:HEAD(${headRef}) 未勾 ${before.openRows} 行`)
  console.log(`批1候选删除 ${candidates.length} 行(pointer-row ${candidates.filter((d) => d.family === 'pointer-row').length} / merge-note ${candidates.filter((d) => d.family === 'merge-note').length})`)
  for (const d of candidates.slice(0, 12))
    console.log(`  L${d.row.line} [${d.family}] → 幸存/指向 L${d.survivorLine} ${d.row.raw.slice(0, 80)}`)
  if (candidates.length > 12) console.log(`  … 其余 ${candidates.length - 12} 行见留痕 jsonl`)

  if (!candidates.length) {
    console.log('无可删行(幂等出口)')
    process.exit(0)
  }

  // 组装新面:未删行逐字不变
  const delSet = new Set(candidates.map((d) => d.row.line))
  const kept = lines.filter((_, i) => !delSet.has(i + 1))
  const newContent = kept.join(eol)

  // 安全阀 1:行数对账 + 未删行逐字不变
  if (kept.length !== lines.length - candidates.length) throw new Error('行数对账失败 ⇒ 拒绝落地')
  let j = 0
  for (let i = 0; i < lines.length; i++) {
    if (delSet.has(i + 1)) continue
    if (lines[i] !== kept[j]) throw new Error(`未删行漂移 L${i + 1} ⇒ 拒绝落地`)
    j++
  }

  // 安全阀 2:复跑 auditPlan 判据面(F1/mergeNotes/dupPointerRows/F9)
  const after = parseTaskRows(newContent)
  const afterForks = findForks(newContent)
  const afterF1 = afterForks.forks.length
  const afterDupPointer = after.filter((r) => r.state === 'open' && DUP_POINTER_RE.test(r.raw)).length
  const afterMergeNotes = (newContent.match(new RegExp(MERGE_NOTE_RE.source, 'g')) ?? []).length
  const beforeMergeNotes = (content.match(new RegExp(MERGE_NOTE_RE.source, 'g')) ?? []).length
  const afterF9 = f9Faces(newContent).collisions.length
  const beforeDupPointer = rows.filter((r) => r.state === 'open' && DUP_POINTER_RE.test(r.raw)).length
  const violations = []
  if (afterF1 !== 0) violations.push(`F1 分叉 ${afterF1} 组(必须 0)`)
  if (afterMergeNotes !== beforeMergeNotes) violations.push(`mergeNotes ${beforeMergeNotes}→${afterMergeNotes}(批1必须不变)`)
  if (afterDupPointer >= beforeDupPointer) violations.push(`dupPointerRows ${beforeDupPointer}→${afterDupPointer}(必须下降)`)
  if (afterF9 > f9.collisions.length) violations.push(`F9 声明组 ${f9.collisions.length}→${afterF9}(不得增加)`)
  if (violations.length) throw new Error(`复跑对账红 ⇒ 拒绝落地:${violations.join(';')}`)
  console.log(`复跑对账:F1=0 / mergeNotes ${beforeMergeNotes}→${afterMergeNotes} / dupPointerRows ${beforeDupPointer}→${afterDupPointer} / F9 ${f9.collisions.length}→${afterF9}`)

  // 安全阀 3:门71模拟 —— 被删行的**主键编号**(merge-note 族 = keyOfRow 的编号)或**指向编号**
  // (pointer-row 族,④a 已判,此处对删除后再复核)在新面仍存在登记行(keyOfRow 同源重扫)。
  // 刻意不对正文里的引用编号判活 —— 那是别人票的号,不是本行的键(dry-run 实证:G-23 等括注
  // 引用会被误报悬空)。
  const newKeys = new Set(after.filter((r) => r.key).map((r) => r.key))
  const newFaceMissing = []
  for (const d of candidates) {
    const id = d.family === 'pointer-row' ? d.key : d.row.key
    if (id && !newKeys.has(id)) newFaceMissing.push(`L${d.row.line} ${id}`)
  }
  if (newFaceMissing.length) throw new Error(`门71模拟红(编号判活悬空)⇒ 拒绝落地:${newFaceMissing.slice(0, 10).join(';')}`)
  console.log('门71模拟:被删行主键编号在新面全部判活')

  if (!apply) {
    console.log(`⚠️  --dry-run,未落地。真跑:node scripts/plan-copy-row-purge.mjs --apply`)
    return
  }

  // 留痕 jsonl + 对象空间 CAS 落地(归档器同通道:writeBlob → commitTreeWithIndex → casUpdateRef)
  const day = new Date().toISOString().slice(0, 10)
  const trailRel = `.ihui-agent/archive/PROJECT_PLAN_copy-purge-${day}.jsonl`
  const trailAbs = path.join(ROOT, trailRel)
  mkdirSync(path.dirname(trailAbs), { recursive: true })
  const trail = candidates
    .map((d) =>
      JSON.stringify({
        line: d.row.line,
        family: d.family,
        key: d.key,
        survivorLine: d.survivorLine,
        raw: d.row.raw,
        headRef,
      }),
    )
    .join('\n')
  writeFileSync(trailAbs, trail + '\n', 'utf8')

  const ledgerBlob = writeBlob(newContent, { root: ROOT })
  const trailBlob = writeBlobOfWorktree(trailRel, { root: ROOT })
  const msg =
    `chore(plan): G-1102638 批1 同主键副本行物理归并 — 删 ${candidates.length} 行` +
    `(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;` +
    `落账注记行保留待批2;复跑auditPlan对账F1=0/mergeNotes ${beforeMergeNotes}→${afterMergeNotes}/F9不增;` +
    `逐行留痕 ${trailRel})`
  const committed = commitTreeWithIndex({
    root: ROOT,
    parent: headRef,
    message: msg,
    entries: [
      { path: LEDGER, blob: ledgerBlob },
      { path: trailRel, blob: trailBlob },
    ],
  })
  const okCas = casUpdateRef(committed.commit, headRef, { root: ROOT })
  if (!okCas) throw new Error(`CAS 失败:HEAD 已被推进(${headRef.slice(0, 11)} 不再是当前值)⇒ 不重试,重读面后再跑(幂等)`)
  console.log(`✅ CAS 成功 ${headRef.slice(0, 11)} → ${committed.commit.slice(0, 11)}(删 ${candidates.length} 行,行数 ${lines.length}→${kept.length})`)
  const aligned = alignSharedIndex({ root: ROOT, paths: [LEDGER, trailRel], parentRef: headRef })
  console.log(`✅ 共享索引对齐 moved=${aligned.moved.length} already=${aligned.already.length} skipped=${aligned.skipped.length}(工作树滞后一格,收尾由调用方对齐)`)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(String(e?.message ?? e))
    process.exit(1)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
