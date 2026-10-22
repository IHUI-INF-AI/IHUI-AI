// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 按"声明式摘除台账"剔除活文档工作树里**已被正当摘除过的行**(2026-10-22 立)。
 *
 * 立因(实测,不是推测):本席摘除 G-689/G-691/G-692/G-694 四枚已结清登记行并落库后,
 * 下一轮 `auto-commit-quiet` 的收编提交又把**四枚全部以未勾形态带回**。链路是:共享工作树里
 * PROJECT_PLAN.md 的副本常年滞后 HEAD ⇒ 那四行在盘上还在 ⇒ 归并档 `merge-live-doc` 只判
 * "不丢行 / 不重复",判不出"这几行是别人已按台账正当删掉的" ⇒ 当成新增内容收编回去。
 * 这正是 AGENTS §1 通道③的同型,但通道是定时任务而不是合并,所以更频繁。
 *
 * 判据(三条同时成立才剔,任一不成立就留下):
 *   ① 该行逐字出现在摘除声明台账里(器物 `strip-stale-claim-marks` 的 rowBefore / 摘行器物写的 before);
 *   ② 该行在**当下 HEAD 面**上已不存在(否则说明它仍在册,不得动);
 *   ③ 该行是登记行(`- [ ]` / `- [x]`)—— 只认台账语义,不碰正文其它部分。
 * 方向选择:判不出即**不剔**(宁可留一轮噪音,也不误删别人的行;与 §0.10 一致)。
 *
 * 出口(§0.8 只写跑得通的):
 *   预演:`node scripts/scrub-declared-removals.mjs PROJECT_PLAN.md --dry-run`
 *   写回:`node scripts/scrub-declared-removals.mjs PROJECT_PLAN.md`
 *   自证:`node scripts/scrub-declared-removals.mjs --self-test`
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LEDGERS = ['.workbuddy/stale-claim-strip.jsonl', '.workbuddy/plan-row-drop.jsonl']

/** 摘除声明集合:只收"整行原文"字段,解不开的行长跳过并计数。 */
export function declaredRows(root = ROOT, files = LEDGERS) {
  const set = new Set()
  let malformed = 0
  for (const f of files) {
    const p = path.join(root, f)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      if (line.trim() === '') continue
      let o
      try {
        o = JSON.parse(line)
      } catch {
        malformed++
        continue
      }
      for (const key of ['rowBefore', 'before']) {
        if (typeof o[key] === 'string' && /^\s*- \[[ xX]\]/.test(o[key])) set.add(o[key])
      }
    }
  }
  return { set, malformed }
}

/** 纯函数:算出该剔哪些行(不写盘,便于自检)。`headSet` = HEAD 面行集。 */
export function scrub(text, headText, declared) {
  const head = new Set(String(headText ?? '').split('\n'))
  const lines = String(text ?? '').split('\n')
  const kept = []
  const dropped = []
  for (const l of lines) {
    if (declared.has(l) && !head.has(l) && /^\s*- \[[ xX]\]/.test(l)) {
      dropped.push(l)
      continue
    }
    kept.push(l)
  }
  return { text: kept.join('\n'), dropped }
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  const file = argv.find((a) => !a.startsWith('--'))
  if (!file) {
    console.error('❌ 用法:scrub-declared-removals.mjs <仓库相对文档> [--dry-run]')
    return 2
  }
  const { set: declared, malformed } = declaredRows()
  if (declared.size === 0) {
    console.log(`SCRUB-RESULT state=undetermined why=摘除声明台账为空或不可解(malformed=${malformed}) ⇒ 不动文档`)
    return 2
  }
  let headText
  try {
    headText = execFileSync('git', ['show', `HEAD:${file}`], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1 << 28,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch {
    console.log(`SCRUB-RESULT state=undetermined why=取不到 HEAD 面 ${file} ⇒ 不动文档`)
    return 2
  }
  const abs = path.join(ROOT, file)
  if (!existsSync(abs)) {
    console.log(`SCRUB-RESULT state=undetermined why=工作树无 ${file} ⇒ 不动文档`)
    return 2
  }
  const r = scrub(readFileSync(abs, 'utf8'), headText, declared)
  console.log(
    `SCRUB-RESULT state=${r.dropped.length ? 'dropped' : 'clean'} dropped=${r.dropped.length} declared=${declared.size} malformed=${malformed} file=${file}`,
  )
  for (const d of r.dropped.slice(0, 6)) console.log(`  · 剔除:${d.trim().slice(0, 78)}`)
  if (r.dropped.length > 6) console.log(`  · 另有 ${r.dropped.length - 6} 行同批`)
  if (r.dropped.length === 0) return 0
  if (argv.includes('--dry-run')) {
    console.log('dry-run:未写回')
    return 0
  }
  writeFileSync(abs, r.text + (r.text.endsWith('\n') ? '' : '\n'), 'utf8')
  const back = readFileSync(abs, 'utf8')
  const left = back.split('\n').filter((l) => declared.has(l) && !new Set(headText.split('\n')).has(l) && /^\s*- \[[ xX]\]/.test(l))
  if (left.length !== 0) {
    console.log(`❌ 写回后仍有 ${left.length} 行未剔 ⇒ 回滚写回(用 HEAD 面复原本轮不判)`)
    return 2
  }
  console.log(`✅ 回读核对:0 行残留(写回 ${r.dropped.length} 行剔除已生效)`)
  return 0
}

function selfTest() {
  let pass = 0
  let fail = 0
  const t = (name, ok, extra = '') => {
    if (ok) {
      pass++
      console.log(`✅ ${name}`)
    } else {
      fail++
      console.log(`❌ ${name}${extra ? `:${extra}` : ''}`)
    }
  }
  const row = '- [ ]（进行中@2026-10-18/甲） G-900 已摘除的登记行'
  const declared = new Set([row])
  const head = '- [ ] G-901 在册行\n- [ ] G-902 另一在册行'
  const wt = `${head}\n${row}\n- [ ] G-903 别人本轮真新增的行`
  const r = scrub(wt, head, declared)
  t('声明摘除且 HEAD 已无的行被剔', r.dropped.length === 1 && !r.text.includes('G-900'))
  t('在册行与真新增行一字不动', r.text.includes('G-901') && r.text.includes('G-903'))
  const still = scrub(wt, `${head}\n${row}`, declared)
  t('HEAD 面上还在的行不得动(那叫复活是另一件事,不归本器)', still.dropped.length === 0)
  const prose = scrub(`普通正文 ${row}`, head, new Set([`普通正文 ${row}`]))
  t('非登记行一律不剔(只认台账语义)', prose.dropped.length === 0)
  const d = declaredRows(ROOT, ['.ihui-agent/tmp/nonexistent-ledger.jsonl'])
  t('台账不在位 ⇒ 空集(调用方须判未判定,不得当成"没有声明过")', d.set.size === 0)
  console.log(`--self-test: ${pass}/${pass + fail} 通过`)
  return fail
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exitCode = main(process.argv.slice(2))

export const __test__ = { scrub, declaredRows, LEDGERS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
