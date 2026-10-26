#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 命令行工具,需 console 输出处理结果 */
/**
 * 给 `.ps1` / `.psm1` 补 UTF-8 BOM(幂等;已有 BOM 的文件一字节不动)。
 *
 * 存在的理由:守门 `scripts/check-ps1-bom.mjs` 判红时给的修复指引必须**真跑得通**
 * (§12f:文档里写的出路要实测)。手写一行 node -e 的转义在 Windows 上极易被吃掉,
 * 所以把这段收成一个正经的小工具。
 *
 * 用法:
 *   node scripts/lib/ps1-add-bom.mjs <文件...>
 *   node scripts/lib/ps1-add-bom.mjs --all-existing     # 把守门报的存量全部补上(修存量用)
 *   node scripts/lib/ps1-add-bom.mjs --check <文件...>  # 只判不改:exit 1 = 有文件缺 BOM
 *   node scripts/lib/ps1-add-bom.mjs --check --all-existing
 *                                                      # 全仓体检:exit 0 且打印"全仓 0 枚缺 BOM"
 *                                                      # 就是"真的全补完了",不是用法错
 *
 * 设计口径:
 *   · **只加前缀,不重写正文** —— 用 Buffer 拼,不经 utf8 字符串往返,不会顺手改变行尾或编码;
 *   · 幂等:已有 BOM ⇒ 跳过并如实说"跳过",不假装改过;
 *   · 文件不存在 / 不是 .ps1 后缀 ⇒ 明确报错并 exit 1,不静默忽略(§0.3)。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BOM = Buffer.from([0xef, 0xbb, 0xbf])
const ROOT = resolve(import.meta.dirname, '..', '..')

function hasBom(buf) {
  return buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf
}

function existingMissingBom() {
  const out = execFileSync('node', ['scripts/check-ps1-bom.mjs', '--json'], { cwd: ROOT, encoding: 'utf8' })
  const lines = out.trim().split('\n')
  // --json 档末尾还有一行"末行";前面才是 JSON 体
  const jsonEnd = lines.findIndex((l) => l.startsWith('[ps1-bom] 末行'))
  const body = JSON.parse(lines.slice(0, jsonEnd === -1 ? lines.length : jsonEnd).join('\n'))
  // 存量 + 新增一并返回:修存量时两者都要修(判据只管"新增不许有",修的时候不必区分)
  return [...body.existing, ...body.regressed.map((r) => r.path), ...body.added.map((r) => r.path)]
}

const argv = process.argv.slice(2)
const checkOnly = argv.includes('--check')
const allExisting = argv.includes('--all-existing')
const files = argv.filter((a) => !a.startsWith('--'))

if (allExisting) files.push(...existingMissingBom())
if (files.length === 0) {
  // 空清单有两种成因,必须分开说:① 没给任何参数(用法错,exit 1);② `--all-existing` 但守门
  // 现读 0 枚缺 BOM(全仓已清零,成功)。把 ② 报成 ① 的代价不是"少一句话" —— 下一个人看到
  // "用法:..." 会以为工具坏了,转身去手搓 `node -e` 拼字节,而那正是本工具存在要消灭的东西
  // (头注 §12f:文档里写的出路必须真跑得通)。2026-10-26 实测踩到:存量清零后本命令 exit 1。
  if (allExisting) {
    console.log('全仓没有缺 UTF-8 BOM 的 .ps1 / .psm1(守门 check-ps1-bom.mjs 现读 0 枚)')
    process.exit(0)
  }
  console.error('用法:node scripts/lib/ps1-add-bom.mjs <文件...> [--check] [--all-existing]')
  process.exit(1)
}

let changed = 0
let already = 0
let bad = 0
for (const rel of files) {
  if (!/\.(ps1|psm1)$/i.test(rel)) {
    console.error(`✗ ${rel}: 不是 .ps1 / .psm1,拒绝处理`)
    bad++
    continue
  }
  const abs = resolve(ROOT, rel)
  let buf
  try {
    buf = readFileSync(abs)
  } catch {
    console.error(`✗ ${rel}: 读不到`)
    bad++
    continue
  }
  if (hasBom(buf)) {
    console.log(`= ${rel}: 已有 BOM,跳过(未改动)`)
    already++
    continue
  }
  if (checkOnly) {
    console.log(`✗ ${rel}: 缺 BOM`)
    bad++
    continue
  }
  writeFileSync(abs, Buffer.concat([BOM, buf]))
  console.log(`✓ ${rel}: 已补 3 字节 BOM(正文 ${buf.length} 字节未动)`)
  changed++
}

console.log(`\n合计:补 ${changed} / 已是 ${already} / 不合格或读不到 ${bad}${checkOnly ? '(--check 只判不改)' : ''}`)
process.exit(bad > 0 ? 1 : 0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
