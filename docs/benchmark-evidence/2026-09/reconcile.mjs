#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 竞品对话流清单 ↔ 我方语言包/源码 逐条对账器（一次性取证工具，不在提交链）。
 *
 * 为什么不是"读一遍清单然后写结论"：本次要处理 1,370 行条目，人读完必然漏；
 * 而漏的部分会以"我方没有"的形态写进台账，那比空白更贵（本仓把"把没判写成判过了"列为最高频失效型）。
 *
 * 四态口径（**绝不并桶**，尤其不得把 undetermined 写成 missing）：
 *   L1 verbatim   竞品原文与我方 value 逐字等值（去空白后）
 *   L2 near       字符二元组 Jaccard ≥ 0.5（中文按字切，前缀/分词在中文里会漏——本仓 merge-live-doc 同一条教训）
 *   L3 keyonly    键末段同名但原文不同形 ⇒ 只能算"需人工核"，不算命中也不算缺失
 *   MISS          三面都没抓到 ⇒ 候选缺失，仍须人工判"是真没有"还是"我方另起一名"
 *
 * 控制测量（先于一切结论）：拿我方自己的一条真实原文喂 L1 与 L2，两边都必须命中；
 * 不成立就直接退出 —— 那说明匹配器坏了，此时任何 MISS 计数都是噪声（本仓"一次性量尺的三种静默失明
 * 全表现为 0 处"那一型）。
 *
 * 用法: node reconcile.mjs <清单.md> [--section "§10"] [--extra <我方字面量补充文件>...]
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', windowsHide: true }).trim()
const argv = process.argv.slice(2)
const LIST = argv[0]
if (!LIST || !fs.existsSync(LIST)) {
  console.error('用法: reconcile.mjs <清单.md> [--section 名称]')
  process.exit(2)
}
const secIdx = argv.indexOf('--section')
const SEC = secIdx > 0 ? argv[secIdx + 1] : null

// —— 我方语料：zh-CN 语言包展平（web 主面包 + shared 包） ——
function flatten(obj, prefix, acc) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') { const t = normText(v); if (t && !acc.has(t)) { acc.set(t, key); orig.set(t, v) } }
    else if (v && typeof v === 'object') flatten(v, key, acc)
  }
  return acc
}
function normText(s) {
  return String(s).replace(/\s+/g, '').replace(/[，。、：；！？「」『』“”‘’（）()【】\[\]<>*_·—\-]/g, '').toLowerCase()
}
const our = new Map() // 归一化文本 -> 我方键（可能多键，取首个）
const orig = new Map() // 归一化文本 -> 原始 value：控制测量必须喂真实原文，喂键名会得到假阴性
const ourPairs = [] // [归一文本, 原始 value, key]
for (const f of ['packages/i18n/messages/web/zh-CN.json', 'packages/i18n/messages/shared/zh-CN.json']) {
  const p = path.join(ROOT, f)
  if (!fs.existsSync(p)) { console.log(`⚠️ 我方语料缺文件: ${f}（该面不计入，会抬高 MISS）`); continue }
  const acc = flatten(JSON.parse(fs.readFileSync(p, 'utf8')), '', new Map())
  for (const [t, k] of acc) if (!our.has(t)) { our.set(t, k); ourPairs.push([t, k, orig.get(t) || '']) }
}
// 源码内不走 i18n 的中文字面量（对标附录 C）。
// ⚠️ 口径必须是被审面(HEAD)而不是工作树：本机共享工作树常年滞后，按磁盘扫会把
// "HEAD 有、工作树还没同步"的文案误判成 MISS —— 那是把量具的失效写成仓库的缺陷（本仓同一型记过多次）。
// 也不能用 `git grep -E "\p{Han}"`：git grep 走 POSIX ERE，不认 \p{Han}，会**静默返回空**而不是报错。
const srcZh = new Set()
{
  let files = []
  try {
    // 必须 -C ROOT：否则从子目录跑时 `-- apps/web/src` 会按当前目录解析 ⇒ 静默拿到 0 个文件
    files = execFileSync('git', ['-C', ROOT, 'ls-tree', '-r', '--name-only', 'HEAD', '--', 'apps/web/src', 'packages/shared/src'], { encoding: 'utf8', maxBuffer: 64e6, windowsHide: true })
      .split('\n').filter((f) => /\.(ts|tsx)$/.test(f))
  } catch { console.log('⚠️ HEAD 文件清单取不到 ⇒ 附录 C 只能靠语言包判，其 MISS 数不得引用') }
  if (!files.length) {
    console.error('❌ HEAD 面 .ts/.tsx 清单为 0 ⇒ 源码面无从取证，拒绝出 MISS 结论（空枚举不是"没有中文文案"）')
    process.exit(2)
  }
  let out = ''
  if (files.length) {
    try {
      out = execFileSync('git', ['-C', ROOT, 'cat-file', '--batch'], { input: files.map((f) => `HEAD:${f}`).join('\n') + '\n', encoding: 'utf8', maxBuffer: 768e6, windowsHide: true })
    } catch { console.log('⚠️ HEAD 面批量读失败 ⇒ 附录 C 的 MISS 不得引用（量具失效不是仓库缺陷）') }
  }
  for (const m of out.matchAll(/["'`]([^"'`\n]{1,80})["'`]/g)) {
    if (!/[㐀-鿿豈-﫿]/.test(m[1])) continue // 码位范围；\p{Han} 在字符类内需 v 旗标，u 模式会抛
    const t = normText(m[1])
    if (t.length >= 2) srcZh.add(t)
  }
  console.log(`HEAD 面源码中文字面量: ${srcZh.size} 条（${files.length} 个 .ts/.tsx）`)
  if (!srcZh.size && files.length) {
    console.error('❌ 源码面抓到 0 条 ⇒ 判附录 C 无资格，拒绝出 MISS 结论')
    process.exit(2)
  }
}

function bigrams(s) {
  const a = []
  for (let i = 0; i < s.length - 1; i++) a.push(s.slice(i, i + 2))
  return a
}
function jaccard(s1, s2) {
  const A = new Set(bigrams(s1)), B = new Set(bigrams(s2))
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  return inter / new Set([...A, ...B]).size
}
function matchOne(text, keyName) {
  const t = normText(text)
  if (!t) return { state: 'skip', why: '原文为空或纯符号' }
  // 非文案过滤：附录 C 里混着样式对象与 className 字面量，它们不进入"用户看得见的文本"这一维。
  // 不摘掉会把上百条 CSS 属性当成"我方缺失的界面文案"写进台账（本轮实测抓到 147 条）。
  const kn = String(keyName || '')
  if (/className|backgroundColor|color:|textDecoration|font[A-Z]|border|padding|margin|display|flex|overflow|position|cursor|transition|animation/i.test(kn)
      && !/[㐀-鿿]/.test(text)) return { state: 'skip', why: '样式属性名非文案' }
  if (/^(?:var\(|#[0-9a-f]{3,8}\b|rgba?\(|\d+(px|rem|em|%)\b|flex\b|none\b|inherit\b|transparent\b|ghost\b|idle\b|pending\b)/i.test(String(text).trim())) {
    return { state: 'skip', why: 'CSS 值或枚举非文案' }
  }
  if (our.has(t)) return { state: 'L1', where: our.get(t) }
  if (srcZh.has(t)) return { state: 'L1', where: '源码字面量' }
  let best = null
  for (const [ot, ok] of ourPairs) {
    const j = jaccard(t, ot)
    if (j >= 0.5 && (!best || j > best.j)) best = { j, ok }
  }
  const lastSeg = (keyName || '').split('.').pop()
  if (best) return { state: 'L2', where: `${best.ok} (J=${best.j.toFixed(2)})` }
  if (lastSeg && our.has(normText(lastSeg))) return { state: 'L3', where: '键末段同名，原文待核' }
  // L2b 实词包含：竞品串常带占位符/限定语而更长，逐字与 Jaccard 都会漏。
  // 只判成「需人工核」而不是命中 —— 形似不等于等同，把子串当命中会造出假"我方已有"。
  if (t.length >= 4) {
    for (const [ot, ok] of ourPairs) {
      if (ot.length < 3) continue
      if (t.includes(ot) || ot.includes(t)) return { state: 'L3', where: `子串同形:${ok}` }
    }
  }
  return { state: 'MISS' }
}

// —— 控制测量：匹配器必须先证明自己能打中 ——
{
  const probeKey = ourPairs[Math.floor(ourPairs.length / 2)]
  if (!probeKey) { console.error('❌ 我方语料为空 ⇒ 无资格判 MISS'); process.exit(2) }
  const raw = String(probeKey[2] || probeKey[0]) // 必须喂原始 value（index 2），喂键名会得到必然 MISS 的假阴性
  const a = matchOne(raw, '')
  const b = matchOne(' ' + raw.slice(0, 4) + ' ' + raw.slice(4), '') // 加空白与截断：验归一化路径
  console.log(`控制测量: 原值=${a.state} 变形=${b.state}  我方语料 ${ourPairs.length} 条`)
  if (a.state !== 'L1' || b.state === 'MISS') {
    console.error('❌ 匹配器未通过控制测量 ⇒ 本次 MISS 一律无效，拒绝出结论')
    process.exit(2)
  }
}

// —— 解析清单：三种格式 ——
const lines = fs.readFileSync(LIST, 'utf8').split(/\r?\n/)
const rows = []
let section = '', family = ''
for (const raw of lines) {
  const l = raw.trim()
  if (/^#{2,3} /.test(l)) {
    const t = l.replace(/^#+\s*/, '')
    if (/^(\d+|附录)\s/.test(t) || /^## /.test(l)) section = t
    if (/^### /.test(l)) { const m = l.match(/^### `?([^`（ ]+)`?/); family = m ? m[1] : t; continue }
    continue
  }
  if (SEC && !section.includes(SEC)) continue
  let m = l.match(/^\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|/) // 正文表格 | `key` | 原文 |
  if (m) { rows.push({ sec: section, fam: family, key: m[1], text: m[2] }); continue }
  m = l.match(/^\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/) // 错误码表 | code | 标题 | 正文 |
  if (m && !/^-+$/.test(m[2])) { rows.push({ sec: section, fam: family + '#' + m[1], key: m[1], text: m[2] + ' ' + m[3] }); continue }
  m = l.match(/^([A-Za-z][A-Za-z0-9_]*):\s*["“]([^"”]{1,80})["”]/) // 附录 C key:"值"
  if (m) { rows.push({ sec: section, fam: family, key: (family || 'inline') + '.' + m[1], text: m[2] }); continue }
}

const bySec = new Map(), misses = []
for (const r of rows) {
  const res = matchOne(r.text, r.key)
  const k = r.sec.slice(0, 28)
  if (!bySec.has(k)) bySec.set(k, { L1: 0, L2: 0, L3: 0, MISS: 0, skip: 0 })
  bySec.get(k)[res.state] = (bySec.get(k)[res.state] || 0) + 1
  if (res.state === 'MISS') misses.push(`${r.sec.split(' ')[0]} ${r.fam} · \`${r.key}\` · ${r.text.slice(0, 40)}`)
}
console.log(`\n=== 对账（共 ${rows.length} 条，筛选=${SEC || '全清单'}）===`)
console.log('节'.padEnd(30) + 'L1逐字\tL2近义\tL3待核\tMISS')
for (const [k, v] of bySec) console.log(k.padEnd(28) + `${v.L1}\t${v.L2}\t${v.L3}\t${v.MISS}`)
console.log('\n=== MISS 明细（候选缺失，仍需人工判"真没有"还是"我方另起一名"）===')
const uniq = [...new Set(misses)]
for (const x of uniq.slice(0, Number(process.env.SHOW || 90))) console.log('  · ' + x)
if (uniq.length > 90) console.log(`  … 另 ${uniq.length - 90} 条（SHOW=200 可全出）`)
// 逐条导出：分节计数不足以让人复核，每条判定都得落到文件
const oIdx = argv.indexOf('--out')
if (oIdx > 0 && argv[oIdx + 1]) {
  const rows2 = rows.map((r) => ({ ...r, ...matchOne(r.text, r.key) }))
  const head = '# 逐条对账导出：' + (SEC || '全清单') + '\n\n' +
    '生成：`node docs/benchmark-evidence/2026-09/reconcile.mjs qoder/chat-stream-inventory.md' +
    (SEC ? ` --section "${SEC}"` : '') + ' --out <本文件>`\n\n' +
    '四态口径：**L1 逐字 / L2 近义(Jaccard≥0.5) 不算差距**；L3=需人工核（键同名或子串同形，形似不等于等同）；' +
    'MISS=候选缺失，须逐条定性后才可写进台账。控制测量在运行前已通过，故 MISS 不是匹配器空转的产物。\n\n' +
    '| 节 | 族 | 竞品键 | 竞品原文 | 判定 | 我方对应 |\n| --- | --- | --- | --- | --- | --- |\n'
  const body = rows2.map((r) => '| ' + [r.sec.split('：')[0].slice(0, 12), r.fam, '`' + r.key + '`', String(r.text).slice(0, 46).replace(/\|/g, '/'), r.state, r.where || ''].join(' | ') + ' |').join('\n')
  fs.writeFileSync(argv[oIdx + 1], head + body + '\n')
  console.log('\n# 已导出 ' + rows2.length + ' 条 → ' + argv[oIdx + 1])
}
console.log(`\n# 口径: L1/L2 不算差距; L3=需人工核; MISS 必须逐条定性后才可写进台账。`)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
