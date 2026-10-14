#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-plan-dup-pointer-ratchet.mjs —— 「重复登记防回潮」差值棘轮(2026-10-13 立;2026-10-14 扩维)。
 *
 * 立因(用户原话):"我不想让它出现重复登记副本 根本不想 不要再看到 给我彻底根治!"
 * 存量已于 2026-10-13 由 `scripts/plan-pointer-purge.mjs --apply` 一次性清偿(1074 行注记清零,
 * 台账 `.ihui-agent/archive/plan-pointer-purge-2026-10-13.md`)。本门守住清偿成果:
 *
 * 维①(2026-10-13)指针注记棘轮:
 * 判据(差值棘轮,与既有守门 130 的 F7/F8 同一条哲学):**只拦"本次提交让登记行上的指针注记
 * 变多"**,存量不担责 —— 因为与提交内容无关的恒红门只会逼人 --no-verify,连带废掉全部守门
 * (AGENTS §12e 同型)。判定面:
 *   ① 登记行(含残缺行 `- [ ]` / `[ ]`,排除 `<!-- -->` 占位注释):本次提交前后
 *      指针注记行数不得增加(判据 = DUP_POINTER_RE / SELF_DEDISPATCH_RE,来自
 *      scripts/lib/plan-task-index.mjs 单一实现,不在此再抄一份)。
 *   ② `--audit-pointers`(只读报数):当前面上登记行的注记存量,给人工体检用,不判红。
 *
 * 维②(2026-10-14)F10「同题不同编号」差值棘轮:
 * 自动档(plan-tasks-merge --heal)已停产 F10 折叠(noPointer,折叠注记与指针注记同字面);
 * purge 加了 L5 真归并层做存量收口 ⇒ 若不加这道差值,新的同题不同编号重复登记会无声累积。
 * 判据同一条哲学:--staged 面 vs HEAD 面,foldTwins 可折行数(判据单一实现 = plan-tasks-merge
 * 的 foldTwins,与报告口径同源)**只拦变多**。F4/F4b 两维**不在此重复设门** —— 守门 130 的
 * 差值维度已覆盖(plan-tasks.mjs GATE_DIMS 的 F4/F4b),再设就是同罪两罚。
 * 应急出口(须带原因,裸标记不放行):`DUP_RATCHET_ALLOW_TWIN_GROWTH=<原因>` —— 并发并集
 * 已声明的量纲放大走这里,出口打印原因留痕,不静默。
 *
 * 判据失明防护(T3 同型元判据):清偿后当前面登记行注记数必须为 0;若清偿成果被别的
 * 路径绕过本门带回(比如直接写工作树后绕钩子提交),本门**全量模式**(非差值)会点名
 * 并要求跑 `node scripts/plan-pointer-purge.mjs --apply` 重新清偿。
 *
 * 用法:
 *   node scripts/check-plan-dup-pointer-ratchet.mjs --staged  (pre-commit, 阻塞)
 *   node scripts/check-plan-dup-pointer-ratchet.mjs           (全量审计,exit 0/1)
 *   node scripts/check-plan-dup-pointer-ratchet.mjs --audit-pointers [--json]  (只读报数,exit 0)
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { catBatch, selectFace } from './lib/face-reader.mjs'
// 维②判据单一实现。环形引用说明:plan-tasks-merge → 本门(取 countPointerRows)→ 本门 →
// plan-tasks-merge(取 foldTwins),两侧都只在**函数体内**用对方导出 ⇒ ESM 循环安全。
import { foldTwins } from './plan-tasks-merge.mjs'

const require = createRequire(import.meta.url)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = 'PROJECT_PLAN.md'
const idx = require(path.join(ROOT, 'scripts/lib/plan-task-index.mjs'))

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

const isRow = (l) => /^\s*(?:[-*]\s*)?\[[ xX]\]/.test(l) && !/^\s*<!--/.test(l)
/** 该行是否命中任一指针注记判据(实现来自 plan-task-index 单一实现)。 */
export const hitsNote = (l) => idx.DUP_POINTER_RE.test(l) || idx.SELF_DEDISPATCH_RE.test(l)
/** 一段文本里命中注记的登记行数。 */
export const countPointerRows = (text) =>
  String(text || '')
    .split(/\r?\n/)
    .filter((l) => isRow(l) && hitsNote(l)).length
/** 该段文本里命中注记的登记行(行号从 1 起,带截断原文)。 */
export const pointerRows = (text) =>
  String(text || '')
    .split(/\r?\n/)
    .map((l, i) => ({ line: i + 1, raw: l }))
    .filter((r) => isRow(r.raw) && hitsNote(r.raw))

/** 差值判定(纯函数):本次提交让注记行数增加 ⇒ 红。 */
export function ratchetVerdict(oldText, newText) {
  const before = countPointerRows(oldText)
  const after = countPointerRows(newText)
  return { before, after, delta: after - before, compliant: after <= before }
}

/** 维②读数(纯函数):一面上的 foldTwins 可折行数;判据炸了返回 null(未判定,不冒充 0)。 */
export const twinFoldCount = (text) => {
  try {
    return foldTwins(String(text || '').split(/\r?\n/)).edits.length
  } catch {
    return null
  }
}

/** 维②差值判定(纯函数):本次提交让"同题不同编号"可折重复登记变多 ⇒ 红。 */
export function twinRatchetVerdict(headText, newText) {
  const before = twinFoldCount(headText)
  const after = twinFoldCount(newText)
  if (before === null || after === null)
    return { before, after, grew: false, undetermined: true }
  return { before, after, grew: after > before, undetermined: false }
}

/**
 * 为什么这道门在"清偿后"全量面上判红是安全的(不是恒红门):
 * 存量已由 purge 脚本清零 ⇒ 正常流程下当前面注记数恒为 0,任何把注记写回来的提交
 * 都是"本次引入",在差值面被抓;全量面只在有人绕过钩子(直接写工作树 + `--no-verify`
 * 提交)时才红 —— 那正是这道门要拦的最后通道,不是与提交内容无关的状态。
 */
function main(argv) {
  const jsonOut = argv.includes('--json')
  const auditOnly = argv.includes('--audit-pointers')
  const staged = argv.includes('--staged')

  const specNew = staged ? `:${FILE}` : null
  let newContent = null
  if (staged) {
    try {
      const got = catBatch(ROOT, [specNew], { timeout: 60000 })
      newContent = got.get(specNew) ?? null
    } catch {
      newContent = null
    }
  } else {
    // 全量/audit:读 **HEAD blob**(真相面)。**不能读工作树** —— 本仓的批量清偿走对象空间落地
    // (commit-tree + CAS,从不写工作树),工作树副本从此滞后于 HEAD 且含其他会话在飞的编辑;
    // 按工作树判会让整个滞后窗口恒红,而那红与任何人本次动作无关 —— 正是 §12e 禁的恒红门。
    // 真相面判:清偿落地后 HEAD 注记恒为 0,任何把它带回来的动作都在差值面被抓。
    try {
      const got = catBatch(ROOT, ['HEAD:' + FILE], { timeout: 60000 })
      newContent = got.get('HEAD:' + FILE) ?? null
    } catch {
      newContent = null
    }
  }
  if (newContent === null) {
    console.error(`${C.yellow}⏭  PROJECT_PLAN.md 本版取不到,无法判定${C.reset}`)
    return 2
  }

  if (auditOnly) {
    const rows = pointerRows(newContent)
    if (jsonOut) {
      console.log(
        JSON.stringify({
          face: staged ? 'staged' : 'HEAD',
          pointerRows: rows.length,
          samples: rows.slice(0, 20).map((r) => ({ line: r.line, sample: r.raw.slice(0, 120) })),
        }),
      )
    } else {
      console.log(`${C.cyan}📊 登记行指针注记存量:${rows.length} 行${C.reset}`)
      for (const r of rows.slice(0, 30)) console.log(`  L${r.line} ${r.raw.slice(0, 120)}`)
    }
    return 0 // 只读报数,永不判红
  }

  let oldContent = ''
  if (staged) {
    try {
      const got = catBatch(ROOT, ['HEAD:' + FILE], { timeout: 60000 })
      oldContent = got.get('HEAD:' + FILE) ?? ''
    } catch {
      oldContent = ''
    }
  } else {
    // 全量:与当前面自己比(delta 恒 0),但存量必须为 0(清偿成果守住)
    oldContent = ''
  }

  const v = ratchetVerdict(oldContent, newContent)
  const residue = countPointerRows(newContent)

  if (!v.compliant) {
    console.error(
      `${C.red}❌ 重复登记副本指针棘轮:${C.reset}本次提交让登记行上的指针注记从 ${v.before} 增至 ${v.after}(+${v.delta})`,
    )
    const bad = pointerRows(newContent).slice(0, 10)
    for (const r of bad) console.error(`  ${C.red}· L${r.line} ${r.raw.slice(0, 100)}${C.reset}`)
    console.error(
      `${C.yellow}出路:${C.reset} ① 删掉这些注记,重复副本改由持有行承载(AGENTS §1 规矩:一个编号一行,新登记同主键时翻勾旧行,不得抄第二份);\n` +
        `       ② 若是工具自动生成(归并器 F4),跑 \`node scripts/plan-pointer-purge.mjs --apply\` 一次性清偿并留台账。`,
    )
    return 1
  }

  if (staged) {
    console.log(
      `${C.green}✅ 指针棘轮:${C.reset}本次提交未新增指针注记(${v.before} → ${v.after};当前面存量 ${residue} 行只报数)`,
    )
    // ── 维② F10「同题不同编号」差值棘轮(2026-10-14)──
    const tv = twinRatchetVerdict(oldContent, newContent)
    if (tv.undetermined) {
      console.log(
        `${C.yellow}⏭ F10 差值未判定(foldTwins 判据异常)${C.reset} —— 不冒充通过也不冒红,点名即走`,
      )
    } else if (tv.grew) {
      const allow = process.env.DUP_RATCHET_ALLOW_TWIN_GROWTH
      if (allow && allow.trim()) {
        console.log(
          `${C.yellow}⚠️ F10 差值棘轮经应急出口放行(带原因留痕,不静默):${C.reset}${allow.trim()}(${tv.before} → ${tv.after})`,
        )
      } else {
        console.error(
          `${C.red}❌ F10 同题不同编号差值棘轮:${C.reset}本次提交让可折的"同题不同编号"重复登记从 ${tv.before} 增至 ${tv.after}(+${tv.after - tv.before})`,
        )
        console.error(
          `${C.yellow}出路:${C.reset} ① 同一件事只登记一行(同题不同号也算重复;新登记前先按题面搜一遍);\n` +
            `       ② 存量收口跑 \`node scripts/plan-pointer-purge.mjs\`(dry-run 看分层处置,--apply 走对象空间落地);\n` +
            `       ③ 确属并发并集已声明的量纲放大 ⇒ 带原因重试:DUP_RATCHET_ALLOW_TWIN_GROWTH=<原因>(裸标记不放行)`,
        )
        return 1
      }
    } else {
      console.log(
        `${C.green}✅ F10 差值:${C.reset}同题不同编号可折重复登记 ${tv.before} → ${tv.after}(不增;F4/F4b 维归守门 130,不在此重复设门)`,
      )
    }
  } else {
    // 全量模式:存量必须为 0(清偿成果守住);不为 0 红 —— 它必然是绕过钩子或写盘路径带回的
    if (residue > 0) {
      console.error(
        `${C.red}❌ 指针存量:${C.reset}登记行上的指针注记存量为 ${residue} 行(清偿成果被带回,应为 0)`,
      )
      const bad = pointerRows(newContent).slice(0, 10)
      for (const r of bad) console.error(`  ${C.red}· L${r.line} ${r.raw.slice(0, 100)}${C.reset}`)
      console.error(
        `${C.yellow}出路:${C.reset}跑 \`node scripts/plan-pointer-purge.mjs --apply\` 重新清偿(台账会自动记录)。`,
      )
      return 1
    }
    console.log(`${C.green}✅ 指针棘轮:${C.reset}当前面登记行指针注记 0 行(清偿成果守住)`)
    // 全量档对维②只报数(差值档在 --staged;存量 3 行是 purge 逐行点名豁免的真独有内容行,
    // 当场判红就是与任何提交无关的恒红门,§12e)
    const twinFull = twinFoldCount(newContent)
    if (twinFull !== null)
      console.log(
        `${C.cyan}📊 F10 同题不同编号可折重复登记存量:${twinFull} 行(只报数;收口跑 plan-pointer-purge --apply)${C.reset}`,
      )
  }
  return 0
}

const isDirectRun =
  process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href
if (isDirectRun) {
  const argv = process.argv.slice(2)
  const { error } = selectFace({ staged: argv.includes('--staged'), def: 'worktree' })
  if (error && !argv.includes('--audit-pointers')) {
    console.error(`❌ 无法判定: ${error}`)
    process.exitCode = 2
  } else {
    process.exitCode = main(argv)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
