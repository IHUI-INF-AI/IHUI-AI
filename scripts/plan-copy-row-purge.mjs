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
 * 批2(--include-settled,2026-10-08 同日):判据②反转 —— **只**清带〔【归并】…落账:复测…〕
 * 注记的行(①不再强制:注记本身就是副本自述),③④⑤⑥同守。前置配套(G-1102638 批2 判据面):
 *  - plan-tasks.mjs grewViolations 加 absFloor 绝对下限豁免(gate 调用点传基线 base?.F5,
 *    缺省旧行为逐字不变)+ 基线 F5 21→0 —— 注记形态随物理归并退役,差值 F5 与存续性 F5
 *    同批交出看守职责(登记行防丢归门 71,留痕 md 在豁免面);
 *  - 安全阀 2 的 mergeNotes 对账随档切换:批1"不变"、批2"降幅 === 被删行行级注记和"。
 *
 * **批2 侦察证伪与拍板(2026-10-08,机主拍板〔拍板@2026-10-08 机主:注记留原地,判据退役收口〕)**:
 * dry-run 实测候选 0 行 —— 面级 405 条落账注记**全部住在 109 行「已归档」墓碑注释行内**
 * (`<!-- 已归档(…,随块带走的归并落账注记: …,完整内容在 …md -->`,归档器 placeholderLine
 * :457 刻意"随块带走"的契约产物),不在任何任务行上;早前"405 条行"是把面级注记条数误当行数。
 * 墓碑是归档基础设施的判据锚点(ledger-move-aware 靠"占位代表"防已归档条目整批误回捞;
 * check-delivery-report-consistency 靠它做归档章节豁免),删除 = 破坏防误回捞链,机主拍板
 * **注记留原地**。本器 --include-settled 档保留不删 —— 它面向的是"任务行上真有注记"的未来形态,
 * 对墓碑内注记结构性不命中(selectCopyRowsToPurge 只吃 parseTaskRows 任务行,墓碑注释行不在其中,
 * 双保险)。F5 判据退役照常收口(基线 F5=0 + absFloor),台账清理的真尾巴 = 剩余同键多行逐组裁决
 * (另批)。
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
 * 留痕:删除清单逐行落 `.ihui-agent/archive/PROJECT_PLAN_copy-purge-<day>.md`(**md 形态**,
 * 守门 71 归档豁免只认该目录 PROJECT_PLAN_*.md;jsonl 留痕被 --heal 回捞过,2026-10-08 实证),
 * 与正文同笔提交 —— 真删不等于无痕,账逐条对得回来。
 *
 * 用法:
 *   node scripts/plan-copy-row-purge.mjs --dry-run                    # 批1档预演
 *   node scripts/plan-copy-row-purge.mjs --apply                      # 批1档对象空间 CAS 真落
 *   node scripts/plan-copy-row-purge.mjs --include-settled --dry-run  # 批2档预演(清落账注记行)
 *   node scripts/plan-copy-row-purge.mjs --include-settled --apply    # 批2档真落
 *   node scripts/plan-copy-row-purge.mjs --self-test                  # 判据纯函数自检(零派生、零副作用)
 */

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
// MERGE_NOTE_RE 字面量带 g 标志(lib :1092 归并注记计数同源)⇒ 直接 .test() 会共享 lastIndex,
// 连续调用呈"一次真一次假"的交替漂移 —— 批1判据②用它做排除、批2用它做选择,都吃这一口。
// 每次现拼无 g 正则(仅 source,无状态);面级计数处(new RegExp(source,'g') match)本就无状态。
const hasSettledNote = (raw) => new RegExp(MERGE_NOTE_RE.source).test(raw)

/**
 * 删除判定(纯函数,self-test 直测):给定全行集合,返回删除行索引集合与逐行理由。
 * 判据见文件头注 —— 这里是唯一实现,--dry-run/--apply/--self-test 三档共用。
 *
 * 两档(G-1102638 三批路线):
 *  - 批1(缺省):①行自述副本 ∧ ②不带落账注记 —— 清干净的自述副本行;
 *  - 批2(includeSettled):②反转 —— **只**清带〔【归并】…落账:复测…〕注记的行,①不再强制
 *    (注记本身就是副本自述,不必再是「副本指针/重复登记」形态);③租约/④接收方/⑤F9/⑥F1 不变,
 *    由调用方(main 的 candidates filter)与函数内共同承担。
 */
export function selectCopyRowsToPurge(rows, opts = {}) {
  const includeSettled = Boolean(opts.includeSettled)
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
    if (includeSettled) {
      if (!hasSettledNote(r.raw)) continue // ②批2反转:只清落账注记行
    } else {
      if (!hasCopyMark(r.raw)) continue // ①
      if (hasSettledNote(r.raw)) continue // ② 批2对象
    }
    if (r.claim) continue // ③
    const pointed = COPY_POINTER_ROW_RE.test(r.raw) ? pointedIdOf(r.raw) : null
    if (pointed) {
      // ④a 行首指针族:指向编号仍有 open 行(非本行)
      const targets = (openById.get(pointed) ?? []).filter((x) => x.line !== r.line)
      if (!targets.length) continue
      deletes.push({
        row: r,
        family: includeSettled ? 'pointer-note' : 'pointer-row',
        key: pointed,
        survivorLine: targets[0].line,
      })
    } else {
      // ④b 【归并】族:同复合主键组内存在幸存者
      const k = r.key ?? compositeKeyOf(r.raw)
      if (!k) continue
      const group = byKey.get(k) ?? []
      const survivor = group.find(
        (x) => x.line !== r.line && !hasCopyMark(x.raw) && !hasSettledNote(x.raw) && !x.claim,
      )
      if (!survivor) continue
      deletes.push({
        row: r,
        family: includeSettled ? 'settled-note' : 'merge-note',
        key: k,
        survivorLine: survivor.line,
      })
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
  // —— 批2档(includeSettled):只清落账注记行,判据③④同守 ——
  d = selectCopyRowsToPurge(
    [
      // 主行也显式传 key:组账(byKey)只收 r.key 非 null 的行 —— 真实路径 parseTaskRows
      // 会给行首编号行填 key,构造用例须同形,否则主行进不了组账、幸存者永远找不到。
      mk(1, '- [ ] **G-50 题面丙** 主行正文', { key: 'G-50' }),
      mk(2, '- [ ] **G-50 题面丙** 同题副本 - 〔【归并】G-50 落账:复测 2026-10-01: 取证文案〕', { key: 'G-50' }),
    ],
    { includeSettled: true },
  )
  ok(d.length === 1 && d[0].row.line === 2 && d[0].family === 'settled-note', '批2:带落账注记的副本行应删(settled-note 族)')
  d = selectCopyRowsToPurge(
    [
      mk(1, '- [ ] G-51 主行'),
      mk(2, '- [ ] 副本指针(编号 G-51)：状态见主行。'),
    ],
    { includeSettled: true },
  )
  ok(d.length === 0, '批2:不带落账注记的行不删(指针行是批1对象,两档互斥)')
  d = selectCopyRowsToPurge(
    [
      mk(1, '- [ ] G-52 主行'),
      mk(2, '- [ ] G-52 同题副本(进行中@2026-10-08/某人) - 〔【归并】G-52 落账:复测 2026-10-01: 取证〕', { key: 'G-52', claim: { holder: '某人' } }),
    ],
    { includeSettled: true },
  )
  ok(d.length === 0, '批2:租约行仍不删(③不变)')
  d = selectCopyRowsToPurge(
    [
      mk(1, '- [ ] **G-53 题** 副本A - 〔【归并】G-53 落账:复测 2026-10-01: 取证〕', { key: 'G-53' }),
      mk(2, '- [ ] **G-53 题** 副本A - 〔【归并】G-53 落账:复测 2026-10-01: 取证〕', { key: 'G-53' }),
    ],
    { includeSettled: true },
  )
  ok(d.length === 0, '批2:组内无幸存者(全带注记)整组保留,宁可漏删')
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
  const includeSettled = args.includes('--include-settled') // 批2档:清落账注记行
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

  const candidates = selectCopyRowsToPurge(rows, { includeSettled }).filter((d) => {
    if (forkOpenLines.has(d.row.line)) return false // ⑥
    // ⑤ 撞号组"同主键"语义被污染,只辖同键组判定(④b);行首指针族走指向判定不查 F9
    if ((d.family === 'merge-note' || d.family === 'settled-note') && f9Keys.has(d.key)) return false
    return true
  })

  const batchLabel = includeSettled ? '批2(--include-settled)' : '批1'
  const before = { openRows: rows.filter((r) => r.state === 'open').length }
  console.log(`判定面:HEAD(${headRef}) 未勾 ${before.openRows} 行 [${batchLabel}]`)
  console.log(`候选删除 ${candidates.length} 行(${candidates.map((d) => d.family).filter((f, i, a) => a.indexOf(f) === i).join(' / ') || '无'})`)
  for (const d of candidates.slice(0, 12))
    console.log(`  L${d.row.line} [${d.family}] → 幸存/指向 L${d.survivorLine} ${d.row.raw.slice(0, 80)}`)
  if (candidates.length > 12) console.log(`  … 其余 ${candidates.length - 12} 行见留痕 md`)

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
  // mergeNotes 对账分档:批1"必须不变"(不碰注记行);批2"必须下降且降幅 === 被删行行级注记数之和"
  // —— MERGE_NOTE_RE 字符类含换行 ⇒ 注记可横跨两行(union-converge :570 记过),横跨注记的面级
  // 计数与行级之和可能有 ±1 口径差,dry-run 实测若差非零会在此点名交人看面,不静默放行。
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
  if (includeSettled) {
    const perRowDeleted = candidates.reduce(
      (n, d) => n + (d.row.raw.match(new RegExp(MERGE_NOTE_RE.source, 'g')) ?? []).length,
      0,
    )
    if (afterMergeNotes >= beforeMergeNotes)
      violations.push(`mergeNotes ${beforeMergeNotes}→${afterMergeNotes}(批2必须下降)`)
    else if (beforeMergeNotes - afterMergeNotes !== perRowDeleted)
      violations.push(
        `mergeNotes 降幅 ${beforeMergeNotes - afterMergeNotes} ≠ 被删行行级注记和 ${perRowDeleted}(横跨注记口径差或误删 ⇒ 交人看面)`,
      )
    if (afterDupPointer > beforeDupPointer)
      violations.push(`dupPointerRows ${beforeDupPointer}→${afterDupPointer}(不得增加)`)
  } else {
    if (afterMergeNotes !== beforeMergeNotes)
      violations.push(`mergeNotes ${beforeMergeNotes}→${afterMergeNotes}(批1必须不变)`)
    if (afterDupPointer >= beforeDupPointer)
      violations.push(`dupPointerRows ${beforeDupPointer}→${afterDupPointer}(必须下降)`)
  }
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
    const id = d.family === 'pointer-row' || d.family === 'pointer-note' ? d.key : d.row.key
    if (id && !newKeys.has(id)) newFaceMissing.push(`L${d.row.line} ${id}`)
  }
  if (newFaceMissing.length) throw new Error(`门71模拟红(编号判活悬空)⇒ 拒绝落地:${newFaceMissing.slice(0, 10).join(';')}`)
  console.log('门71模拟:被删行主键编号在新面全部判活')

  if (!apply) {
    console.log(`⚠️  --dry-run,未落地。真跑:node scripts/plan-copy-row-purge.mjs --apply`)
    return
  }

  // 留痕 md + 对象空间 CAS 落地(归档器同通道:writeBlob → commitTreeWithIndex → casUpdateRef)。
  // **留痕必须是 .md 形态**(2026-10-08 实证教训):守门 71 的归档豁免只认
  // `.ihui-agent/archive/PROJECT_PLAN_*.md`(archivedCopy:src.includes(marker)),jsonl 不在
  // 豁免面 ⇒ 批1的 381 行删除被 --heal 当丢失回捞过 1 条(O88)。md 与删行**同笔提交**入库,
  // 豁免按 HEAD 树判(同面)⇒ 自愈不再回捞。文件含历次累计:重读 HEAD 面已有内容再追加本次段。
  const day = new Date().toISOString().slice(0, 10)
  const trailRel = `.ihui-agent/archive/PROJECT_PLAN_copy-purge-${day}.md`
  const existing = catBatch(ROOT, [`HEAD:${trailRel}`]).get(`HEAD:${trailRel}`) ?? ''
  const section = candidates
    .map(
      (d) =>
        `- L${d.row.line} [${d.family}] → 幸存/指向 L${d.survivorLine} (head ${headRef.slice(0, 11)})\n` +
        d.row.raw,
    )
    .join('\n')
  const header = existing
    ? ''
    : `# PROJECT_PLAN 副本行物理归并留痕(G-1102638)\n\n> 每条 = 删除行原文逐字留痕(守门 71 归档豁免按「原文可在本目录 PROJECT_PLAN_*.md 找到」成立)。\n> 行已真删(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕),本文件是唯一账外副本,git 历史亦可溯。\n\n`
  const trailText = header + existing + (existing ? '\n' : '') + section + '\n'

  const ledgerBlob = writeBlob(newContent, { root: ROOT })
  const trailBlob = writeBlob(trailText, { root: ROOT })
  const batchDesc = includeSettled
    ? `批2 落账注记行清偿 — 删 ${candidates.length} 行(注记 ${beforeMergeNotes}→${afterMergeNotes};` +
      `F5 差值棘轮随基线退役 plan-task-state-baseline F5=0,存续性同批改 0;`
    : `批1 同主键副本行物理归并 — 删 ${candidates.length} 行` +
      `(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;落账注记行保留待批2;`
  const msg =
    `chore(plan): G-1102638 ${batchDesc}` +
    `复跑auditPlan对账F1=0/F9不增;逐行留痕 ${trailRel})`
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
