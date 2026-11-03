// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const g = (...a) => {
  try {
    return execFileSync('git', ['-c', 'safe.directory=*', ...a], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, windowsHide: true })
  } catch (e) {
    return e.status === 1 ? (e.stdout || '').toString() : '<<GITERR ' + (e.stderr || '').toString().slice(0, 100)
  }
}

const snap = new Set(readFileSync('.ihui-agent/tmp/plan-audit/dirty.txt', 'utf8').split('\n').map((s) => s.trim()).filter(Boolean))
const cur = g('status', '--porcelain')
  .split('\n')
  .filter(Boolean)
  .map((l) => ({ st: l.slice(0, 2).trim(), p: l.slice(3).replace(/"/g, '') }))
const paths = cur.map((c) => c.p.replace(/\/$/, ''))
const isNew = paths.filter((p) => !snap.has(p))
const newlyDirty = paths.filter((p) => !snap.has(p))
console.log(`HEAD=${g('rev-parse', '--short', 'HEAD').trim()}`)
console.log(`脏路径 ${paths.length} 条;其中**不在我开工前快照里**的 = ${newlyDirty.length} 条(= 代理/并行的产出)`)
newlyDirty.forEach((p) => console.log('   ' + p))

console.log('\n=== i18n 语言包 JSON 可解析性(代理报过一处断括号) ===')
for (const f of g('diff', '--name-only').split('\n').filter((x) => x.includes('packages/i18n/'))) {
  let ok = 'OK'
  try {
    JSON.parse(readFileSync(f, 'utf8'))
  } catch (e) {
    ok = 'BROKEN ' + (e.message || '').slice(0, 60)
  }
  console.log(`  ${ok.padEnd(70)} ${f}`)
}

console.log('\n=== 两票是否互相覆盖了 web 语言包 ===')
const zh = readFileSync('packages/i18n/messages/web/zh-CN.json', 'utf8')
const has = (k) => (zh.match(new RegExp(k, 'g')) || []).length
console.log(`  D17 的 nav.ecosystem* 命中: ${has('"ecosystem"')} / 描述键 ${(zh.match(/"ecosystem(?:Title|Subtitle|Groups|Experts|Entries)"/g) || []).length}`)
console.log(`  D83 的 toolNames.mcp 命中: ${(zh.match(/"mcp"/g) || []).length}`)
console.log(`  两票键并存? ${has('"ecosystem"') > 0 ? 'D17✓' : 'D17✗'} ${has('"mcp"') > 0 ? 'D83✓' : 'D83✗'}`)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
