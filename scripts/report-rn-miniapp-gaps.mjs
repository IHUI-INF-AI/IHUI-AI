// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出账本 */
// RN→小程序 镜像缺口派单账本(只读,不进提交链)
//
// 回答一个问题:"RN 共享屏里,还有哪些在小程序端没有镜像页?"——并把每个缺口配上
// 名字最接近的 RN 端内屏/小程序既有页作为线索(仅建议,不判定)。
//
// 判定权与"已镜像"的判据全部复用 check-cross-end-screen-coverage 的 __test__(§0.6 单一真相源,
// 本文件零复算):mirored = 该门认定的"共享屏被小程序显式镜像"集合,gaps = 其余。
//
// 取材面:默认 HEAD blob;--worktree 仅人工逃生舱。取不到面 ⇒ exit 2「未判定」。
//
// 用法:
//   node scripts/report-rn-miniapp-gaps.mjs                 # 打印账本(不写盘)
//   node scripts/report-rn-miniapp-gaps.mjs --write <file>  # 写入 markdown
//   node scripts/report-rn-miniapp-gaps.mjs --json
import { dirname, resolve } from 'node:path'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const face = argv.includes('--worktree') ? 'worktree' : 'head'
const jsonMode = argv.includes('--json')
const writeArg = argv.indexOf('--write')
const writePath = writeArg >= 0 ? argv[writeArg + 1] : null

const STOP = new Set(['app', 'index', 'page', 'screen', 'main', 'web', 'pkg', 'pages'])
const tokensOf = (s) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_/-]+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t && !STOP.has(t))

const shared = cov.collectShared(face)
const rn = cov.collectRn(face)
const mp = cov.collectMiniapp(face)
if (shared.length === 0 || mp.length === 0) {
  console.error(`❌ 未判定:取不到被审面(共享屏 ${shared.length} / 小程序页 ${mp.length})`)
  process.exit(2)
}

// 已镜像集合(与门 128 同一判据)
const MARK_RE = /packages\/app\/src\/features\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_]+)Screen/g
const mirrored = new Set()
for (const p of mp) {
  const hay = `${p.text || ''}\n${p.cssText || ''}`
  for (const m of hay.matchAll(MARK_RE)) mirrored.add(`packages/app/src/features/${m[1]}/${m[2]}Screen.tsx`)
}

const gaps = shared.filter((s) => !mirrored.has(s.spec))
const rows = gaps.map((s) => {
  const st = tokensOf(s.name)
  const rnCands = rn
    .map((r) => {
      const rt = tokensOf(r.name)
      const hit = st.filter((t) => rt.includes(t))
      return { name: r.name, hit: hit.length, exact: hit.length === st.length && st.length > 0 }
    })
    .filter((c) => c.hit > 0)
    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.hit - a.hit)
    .slice(0, 2)
  const mpCands = mp
    .filter((p) => p.file)
    .map((p) => {
      const pt = tokensOf(p.route)
      const hit = st.filter((t) => pt.includes(t))
      return { route: p.route, hit: hit.length }
    })
    .filter((c) => c.hit > 0)
    .sort((a, b) => b.hit - a.hit)
    .slice(0, 2)
  return { shared: s.spec, domain: s.domain, name: s.name, rn: rnCands, mp: mpCands }
})

const stats = { face, sharedTotal: shared.length, mirrored: mirrored.size, gaps: gaps.length }

if (jsonMode) {
  console.log(JSON.stringify({ stats, rows }, null, 1))
  process.exit(0)
}

const lines = []
lines.push('# RN → 小程序 镜像缺口账本(自动生成)')
lines.push('')
lines.push(`> 判据:与 [check-cross-end-screen-coverage.mjs](../scripts/check-cross-end-screen-coverage.mjs) 同一实现(共享屏被小程序页显式镜像的集合);`)
lines.push(`> 生成命令:\`node scripts/report-rn-miniapp-gaps.mjs --write docs/engineering/rn-miniapp-parity-matrix.md\`。`)
lines.push('> 候选列只是名字 token 线索(不判定),落地时须按该屏实际字段/接口核实。')
lines.push('')
lines.push(`- 判定面: **${face === 'head' ? 'HEAD blob' : '工作树(人工)'}**`)
lines.push(`- 共享屏(真相源): **${stats.sharedTotal}**`)
lines.push(`- 已被小程序显式镜像: **${stats.mirrored}**`)
lines.push(`- 缺口(未判定镜像): **${stats.gaps}**`)
lines.push('')
lines.push('## 缺口清单')
lines.push('')
lines.push('| # | 共享屏(域) | RN 候选屏 | 小程序既有页线索 | 状态 |')
lines.push('|---|---|---|---|---|')
rows.forEach((r, i) => {
  const rnTxt = r.rn.length ? r.rn.map((c) => `${c.exact ? '★' : ''}${c.name}`).join(' / ') : '—'
  const mpTxt = r.mp.length ? r.mp.map((c) => c.route).join(' / ') : '—'
  lines.push(`| ${i + 1} | \`${r.domain}/${r.name}\` | ${rnTxt} | ${mpTxt} | 🔲 |`)
})
lines.push('')
lines.push(`> 合计 ${rows.length} 条;标 ★ 的是名字完全匹配(仍需核实功能对应)。`)
const md = lines.join('\n') + '\n'
if (writePath) {
  writeFileSync(resolve(ROOT, writePath), md)
  console.log(`written ${writePath} (${rows.length} gaps)`)
} else {
  console.log(md)
}

export const __test__ = { tokensOf, STOP }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
