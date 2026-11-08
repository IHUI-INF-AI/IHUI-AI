#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/sync-readme-numbers.mjs
// ─────────────────────────────────────────────────────────────────────────
// 把 README 内嵌的 "BEGIN GENERATED NUMBERS ... END GENERATED NUMBERS" 块刷新为
// gen-doc-numbers.mjs 的现算输出。仅在该块的"数字"部分实际变化时写盘(幂等、安全):
//   · 只替换 BEGIN/END 标记之间的内容(标记本身不动),块外一律不碰;
//   · 比较时剥掉"最后核对日期"行,数字未变则不写盘 —— 避免每日仅日期滚动造成无意义提交;
//   · 若某 README 不含该生成块(ko/ja 暂未嵌入),跳过,交由定期 AI 刷新处理;
//   · 安全闸:仅当"块外内容"相对索引版本无差异时才 git add,绝不把他人/他席未提交的
//     prose 改动吞进本次提交;若块外另有未提交差异,写盘但跳过 add 并提示手动处理。
// 退出码 0 = 成功(无论是否写盘);非 0 = 生成器本身失败。
// 立点:李总要求"项目改动自动更新文档",根治 README 数字长期靠人肉提醒刷新的漂移
//      (596↔598、4393↔4443、48↔49 等)。挂进 husky pre-commit 提交链,任何改动
//      提交时自动把生成块对齐现算真值;正确性由守门 check-doc-numbers 兜底。
// ─────────────────────────────────────────────────────────────────────────
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { gitRaw } from './lib/face-reader.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const README_FILES = ['README.md', 'README.en.md', 'README.ko.md', 'README.ja.md']
/**
 * `--files=a.md,b.md`:只处理指定文件(2026-10-22 立)。
 * 调用方(safe-commit)只声明了 README.md 时,若本器顺手把 README.en 也 `git add` 进索引,
 * Step 3 的「暂存区精确匹配声明面」会判意外文件并整枚中止 —— 处理面必须与声明面同源。
 * 不带该参数 = 处理全部(独立运行/auto-commit 的既有语义)。
 */
const ONLY_FILES = (() => {
  const arg = process.argv.find((a) => a.startsWith('--files='))
  if (!arg) return null
  const set = new Set(arg.slice('--files='.length).split(',').map((s) => s.trim()).filter(Boolean))
  return set.size ? set : null
})()
const BEGIN = '<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->'
const END = '<!-- END GENERATED NUMBERS -->'

/** 跑 git 命令,返回 stdout(utf8)。maxBuffer 放大到 64MB:README 等文件超 1MB 默认缓冲会 ENOBUFS。
 * 取材统一走层(scripts/lib/face-reader.mjs):绝对 git + quotepath + 显式 stdio 由 gitRaw 同源提供。 */
function git(args) {
  return gitRaw(args, ROOT, { maxBuffer: 64 * 1024 * 1024 })
}

/** 重新生成 README 生成块(含 BEGIN/END 标记)。 */
function genBlockMarkdown() {
  return execFileSync('node', ['scripts/gen-doc-numbers.mjs', '--markdown'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/** 剥离"最后核对日期"行,用于忽略日期滚动的纯 cosmetic 差异;trim 归一化块末换行避免行数差 1。 */
function stripDateLine(s) {
  return s
    .split('\n')
    .filter((l) => !/上表由 .*生成,最后核对日期/.test(l))
    .join('\n')
    .trim()
}

/** 取块外内容(标记之前 + 标记之后);用于判断除生成块外是否另有改动。 */
function outsideBlock(text) {
  const bi = text.indexOf(BEGIN)
  const ei = text.indexOf(END)
  if (bi === -1 || ei === -1) return text
  return text.slice(0, bi) + '\n' + text.slice(ei + END.length)
}

const freshFull = genBlockMarkdown()
const freshCmp = stripDateLine(freshFull)

const staged = []
const skipped = []
let touched = 0

for (const f of README_FILES) {
  if (ONLY_FILES && !ONLY_FILES.has(f)) continue
  const p = path.join(ROOT, f)
  if (!fs.existsSync(p)) continue
  const wt = fs.readFileSync(p, 'utf8')
  const bi = wt.indexOf(BEGIN)
  const ei = wt.indexOf(END)
  if (bi === -1 || ei === -1 || ei < bi) continue // 无生成块 → 跳(ko/ja 由 AI 定期刷新)
  const embedded = wt.slice(bi, ei + END.length)
  if (stripDateLine(embedded) === freshCmp) continue // 数字未变 → 幂等跳过
  // 重建:保留块前/块后原文,用现算块替换块内。freshFull 末尾自带一个换行,
  // 而 wt.slice(ei+END.length) 起头已是 END 标记后的换行 —— 去掉 freshFull 尾部换行,
  // 避免 END 标记后重复空行(那会被"块外差异"安全闸误判为吞并他人 prose)。
  const newText = wt.slice(0, bi) + freshFull.replace(/\n+$/, '') + wt.slice(ei + END.length)
  fs.writeFileSync(p, newText)
  touched++
  // 安全闸:仅当"块外内容"相对索引版本无差异时,才 git add,避免吞并他人在飞 prose 改动。
  let idxText = null
  try {
    idxText = git(['show', `:${f}`])
  } catch {
    idxText = null
  }
  const safe = idxText !== null && outsideBlock(wt) === outsideBlock(idxText)
  if (safe) {
    git(['add', f])
    staged.push(f)
    console.log(`  ✅ ${f}: 生成块已刷新并加入 staged`)
    console.log(`STAGED:${f}`)
  } else {
    skipped.push(f)
    console.log(
      `  ⚠️  ${f}: 生成块已写盘,但块外另有未提交差异,已跳过 git add(请单独提交,避免吞并他人在飞改动)`,
    )
    console.log(`SKIP_PROSE:${f}`)
  }
}

if (touched === 0) console.log('  ✅ README 生成块数字无变化,跳过')
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
