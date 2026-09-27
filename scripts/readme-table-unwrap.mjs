// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// T-A 竖排续行的机械归并器 —— README 表格完整性守门(check-readme-table-integrity.mjs)的修复出口。
// 判据只说"红了"不修,就等于把红留给下一个人(§12e 同型);本工具把一段 T-A run
// (连续若干行、每行只有首尾两条竖线的散文)**机械归并**回上一行(宿主行)的最后一个单元格。
//
// 只处理 T-A 形态。T-B(比本簇主竖线少一条竖线的半截行)与孤立 2 竖线行**一律不动**并如实计数
// —— 那两类"该列填什么"要逐案判语义。run 没有宿主行(簇首)、或宿主/续行含转义竖线 `\|`
// (split 会切错)时**拒绝归并**该 run 并点名,不猜。
//
// 写盘前的硬前置(不可绕):**零内容损失自证** —— 把归并前后全文的所有竖线与非空白字符抹掉,
// 剩余字符多重集必须逐位全等;不成立即拒绝写盘并点名那一格(守门 108 的"待偿债务"不允许
// 用一次批量重写偷偷吃掉字)。默认 --dry-run **零写盘**;--apply 才写,写完回读验证。
// 幂等:同一文件连跑两次,第二次必须零改动(报"已归位")。
//
// 判据与这份出口**共用同一实现**:分箱逻辑直接 import 守门自身的 __test__ 导出 ——
// 两处实现必漂移是本仓记过最多次的失败型(守门 131/135 的 code-mask 同课)。
//
// 用法:node scripts/readme-table-unwrap.mjs --file <path> [--dry-run|--apply]
// 退出码:0 成功(dry-run 有改动也算 0)/ 1 拒绝写盘(零损失不成立、--apply 下写失败)/ 2 用法或取材错误

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { __test__ as gate } from './check-readme-table-integrity.mjs'

const { maskMarkdownStructure, findClusters, classifyCluster } = gate

/** 抹掉所有竖线与非空白字符后的字符多重集(纯函数,构造面即可证明) */
export function lossSignature(text) {
  const map = new Map()
  for (const ch of String(text)) {
    if (ch === '|' || /\s/.test(ch)) continue
    map.set(ch, (map.get(ch) || 0) + 1)
  }
  return map
}

/** 零内容损失判据(任务书指定的那一把尺子:竖线与非空白字符全部抹掉后多重集全等) */
export function assertNoLoss(before, after) {
  const a = lossSignature(before)
  const b = lossSignature(after)
  const missing = []
  const extra = []
  for (const [ch, n] of a) {
    const m = b.get(ch) || 0
    if (m < n) missing.push(`${JSON.stringify(ch)}×${n - m}`)
  }
  for (const [ch, n] of b) {
    const m = a.get(ch) || 0
    if (n > m) extra.push(`${JSON.stringify(ch)}×${n - m}`)
  }
  return { ok: missing.length === 0 && extra.length === 0, missing, extra }
}

/** 写盘闸门:只有 apply 档、有改动、且零损失成立才允许落盘 */
export function writeAllowed(plan, apply) {
  return apply === true && plan.changed === true && plan.lossOk === true
}

/** 把一行剥成"首尾竖线之间"的单元格文本(调用方保证该行恰有 2 条未转义竖线且无 `\|`) */
function cellText(rawLine) {
  const t = rawLine.replace(/\r$/, '')
  const first = t.indexOf('|')
  const last = t.lastIndexOf('|')
  if (first < 0 || last <= first) return null
  return t.slice(first + 1, last).trim()
}

/**
 * 计划一次归并(纯函数):text 进,{ newText, changed, edits, skipped, tbRows, loneRows } 出。
 * edits 每项 = { runLines, hostLine, before, after };skipped 每项带 reason,交人工。
 */
export function planUnwrap(text) {
  const rawLines = String(text).split('\n')
  const { masked } = maskMarkdownStructure(text)
  const clusters = findClusters(masked, rawLines)
  const drop = new Set()
  const edits = []
  const skipped = []
  let tbRows = 0
  let loneRows = 0
  let exemptRuns = 0
  for (const c of clusters) {
    const cls = classifyCluster(c)
    tbRows += cls.tb.length
    loneRows += cls.lone.length
    for (const r of cls.taRuns) {
      if (r.exempt) {
        exemptRuns++
        continue
      }
      const hostN = r.hostLine
      const host = rawLines[hostN - 1]
      const conts = r.lines.map((n) => ({ n, raw: rawLines[n - 1] }))
      const bad = (reason) => skipped.push({ reason, hostLine: hostN, lines: r.lines.slice() })
      if (typeof host !== 'string' || !host.trim().endsWith('|')) {
        bad('无宿主行或宿主行不以竖线收尾 —— 该归进哪一格要人判,不猜')
        continue
      }
      if (host.includes('\\|') || conts.some((x) => x.raw.includes('\\|'))) {
        bad('涉及转义竖线 \\|,机械 split 会切错,交人工')
        continue
      }
      const cells = conts.map((x) => (x.raw.trimStart().startsWith('|') && x.raw.trimEnd().replace(/\r$/, '').endsWith('|') ? cellText(x.raw) : null))
      if (cells.some((x) => x === null || x === '')) {
        bad('续行剥不出单元格文本,交人工')
        continue
      }
      const endIdx = host.lastIndexOf('|')
      const startIdx = host.lastIndexOf('|', endIdx - 1)
      if (startIdx < 0) {
        bad('宿主行不足两格可拼,交人工')
        continue
      }
      const inner = host.slice(startIdx + 1, endIdx).trim()
      const merged = [inner, ...cells].filter((s) => s !== '').join(' ')
      const newHost = host.slice(0, startIdx + 1) + ' ' + merged + ' ' + host.slice(endIdx)
      edits.push({ hostLine: hostN, before: host, after: newHost, runLines: r.lines.slice() })
      for (const n of r.lines) drop.add(n)
    }
  }
  const kept = []
  for (let i = 0; i < rawLines.length; i++) {
    const n = i + 1
    if (drop.has(n)) continue
    const e = edits.find((x) => x.hostLine === n)
    kept.push(e ? e.after : rawLines[i])
  }
  const newText = kept.join('\n')
  const changed = edits.length > 0
  const { ok: lossOk, missing, extra } = assertNoLoss(text, changed ? newText : text)
  return { changed, edits, skipped, tbRows, loneRows, exemptRuns, newText: changed ? newText : String(text), lossOk, missing, extra }
}

/** 端到端纯出口:给定文本返回 plan + 决策(writeAllowed 已在此套用),CLI 与镜像测试共用一条铰链。 */
export function unwrapFileText(text, apply) {
  const plan = planUnwrap(text)
  return { plan, mayWrite: writeAllowed(plan, apply) }
}

function main() {
  const argv = process.argv.slice(2)
  const apply = argv.includes('--apply')
  const dry = argv.includes('--dry-run')
  if (apply && dry) {
    console.error('❌ --apply 与 --dry-run 不得同用(默认就是 dry-run,零写盘)')
    process.exitCode = 2
    return
  }
  const fi = argv.indexOf('--file')
  // 变长参数停在下一个旗标处(与守门同一解析纪律,免得 `--file X --apply` 之后误吞旗标值)
  const files = []
  if (fi >= 0) {
    for (let k = fi + 1; k < argv.length; k++) {
      const a = String(argv[k])
      if (a.startsWith('--')) break
      files.push(a)
    }
  }
  if (files.length === 0) {
    console.error('❌ 必须 --file <path>(可多个)。例:node scripts/readme-table-unwrap.mjs --file README.md --dry-run')
    process.exitCode = 2
    return
  }
  let worst = 0
  for (const f of files) {
    const abs = resolve(f)
    let text
    try {
      text = readFileSync(abs, 'utf8')
    } catch (e) {
      console.error(`❌ ${f}:读不到(${e.message})`)
      worst = Math.max(worst, 2)
      continue
    }
    const { plan, mayWrite } = unwrapFileText(text, apply)
    console.log(
      `[readme-table-unwrap] ${f}:T-A run ${plan.edits.length} 处可归并 / 拒归并(交人工)${plan.skipped.length} 处` +
        ` · T-B ${plan.tbRows} 行不动(不属于本型)· 孤立续行 ${plan.loneRows} 行不动 · 豁免 run ${plan.exemptRuns}`,
    )
    for (const s of plan.skipped) console.log(`   ⚠️ 跳过 ${JSON.stringify(s.reason)}:run 行 ${s.lines.join(',')} 宿主 ${s.hostLine}`)
    if (!plan.changed) {
      console.log(`✅ ${f}:已归位(零改动,幂等)`)
      continue
    }
    for (const e of plan.edits.slice(0, 8))
      console.log(`   · 宿主行 ${e.hostLine}:并入 ${e.runLines.join(',')}(拼后长度 ${e.after.trim().length})`)
    if (plan.edits.length > 8) console.log(`   · …共 ${plan.edits.length} 处`)
    if (!plan.lossOk) {
      console.error(`❌ 零内容损失自证不成立,拒绝写盘:缺 ${plan.missing.join(' ')} / 多 ${plan.extra.join(' ')}`)
      worst = Math.max(worst, 1)
      continue
    }
    if (!apply) {
      console.log(`(dry-run,未写盘)确认无误后跑:node scripts/readme-table-unwrap.mjs --file ${f} --apply`)
      continue
    }
    if (!mayWrite) {
      console.error('❌ 决策闸门拒绝写盘(理论不可达:上面 lossOk/changed 已各拦一次)')
      worst = Math.max(worst, 1)
      continue
    }
    try {
      writeFileSync(abs, plan.newText, { encoding: 'utf8' })
      const back = readFileSync(abs, 'utf8')
      if (back !== plan.newText) {
        console.error(`❌ ${f}:写后回读不一致,停 —— 不再补写,交人工查文件系统状态`)
        worst = Math.max(worst, 1)
        continue
      }
    } catch (e) {
      console.error(`❌ ${f}:写盘失败:${e.message}`)
      worst = Math.max(worst, 1)
      continue
    }
    console.log(`✅ ${f}:已归并 ${plan.edits.length} 处(零损失自证通过)`)
  }
  process.exitCode = worst
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

export const __test__ = { lossSignature, assertNoLoss, writeAllowed, planUnwrap, unwrapFileText, cellText }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
