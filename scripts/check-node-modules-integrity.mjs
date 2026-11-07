#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-node-modules-integrity.mjs — node_modules 完整性一键自检（2026-11-07 立）
 *
 * 在修什么（机器级、反复复发）：
 *   pnpm 把「包目录存在但为空」判为已安装。上一次 install 在拆包/重建窗口被打断后，
 *   `.pnpm/<id>/node_modules/<pkg>` 会留下空目录；后续 `pnpm install --frozen-lockfile`
 *   认为无工作可做，于是"手工修完又复发"，而受害者要到任何走 lint-staged 的提交报
 *   `Cannot find module` 才发现。
 *
 * 本命令只做两件事：
 *   1) 扫 `.pnpm/<id>/node_modules/<pkg>`，找出存在但 0 条目的包目录（含断链）；
 *   2) 按根 package.json 的 dependencies/devDependencies，找出顶层应有却缺失/为空的名字。
 * 只读；`--fix` 只删除**空的**目录（非空的一律不动），materialize 由 `pnpm install` 完成。
 *
 * 用法：
 *   node scripts/check-node-modules-integrity.mjs            # 只读检查
 *   node scripts/check-node-modules-integrity.mjs --json     # 机器读
 *   node scripts/check-node-modules-integrity.mjs --fix      # 只删空目录，再报剩余问题
 *
 * 退出码：0 通过 / 1 发现缺失或空目录 / 2 扫描根不可用
 */

import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
if (args.includes('-h') || args.includes('--help')) {
  console.log('用法：node scripts/check-node-modules-integrity.mjs [--json] [--fix]')
  process.exit(0)
}
const asJson = args.includes('--json')
const doFix = args.includes('--fix')

const root = resolve(process.env.IHUI_NODE_MODULES_ROOT || process.cwd())
const nm = join(root, 'node_modules')
const virtual = join(nm, '.pnpm')

function entriesOf(path) {
  try {
    return readdirSync(path)
  } catch {
    return null
  }
}

function isDir(path) {
  try {
    return lstatSync(path).isDirectory()
  } catch {
    return false
  }
}

/** 顶层依赖名（含 scoped）→ 是否在根 package.json 中声明。 */
function declaredNames() {
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    return [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]
  } catch {
    return []
  }
}

const emptyVirtual = [] // { path, kind: 'dir-empty' | 'broken-link' }
const topMissing = []
const topEmpty = []

if (!isDir(nm)) {
  console.error(`[node-modules-integrity] 根不可用：${nm} 不存在或不是目录`)
  process.exit(2)
}

// ─── 1. 虚拟层：.pnpm/<id>/node_modules/<pkg> ──────────────────────────────
if (isDir(virtual)) {
  for (const id of entriesOf(virtual) || []) {
    if (id.startsWith('.') || id === 'node_modules' || id === 'lock.yaml') continue
    const inner = join(virtual, id, 'node_modules')
    if (!isDir(inner)) continue
    const names = entriesOf(inner) || []
    const flat = []
    for (const name of names) {
      if (name.startsWith('.')) continue
      if (name.startsWith('@')) {
        for (const sub of entriesOf(join(inner, name)) || []) flat.push(`${name}/${sub}`)
      } else {
        flat.push(name)
      }
    }
    for (const name of flat) {
      const p = join(inner, name)
      let st
      try {
        st = lstatSync(p)
      } catch {
        continue
      }
      if (st.isSymbolicLink()) {
        try {
          realpathSync(p)
        } catch {
          emptyVirtual.push({ path: p, kind: 'broken-link' })
          continue
        }
        const targetEntries = entriesOf(p)
        if (targetEntries && targetEntries.length === 0) {
          emptyVirtual.push({ path: p, kind: 'dir-empty' })
        }
        continue
      }
      if (!st.isDirectory()) continue
      const innerEntries = entriesOf(p)
      if (innerEntries && innerEntries.length === 0) {
        emptyVirtual.push({ path: p, kind: 'dir-empty' })
      }
    }
  }
}

// ─── 2. 顶层：根 package.json 声明却缺失/为空 ──────────────────────────────
for (const name of declaredNames()) {
  const p = join(nm, name)
  if (!existsSync(p)) {
    topMissing.push(name)
    continue
  }
  const list = entriesOf(p)
  if (list && list.length === 0) topEmpty.push(name)
}

// ─── 3. --fix：只删空的虚拟层目录 ─────────────────────────────────────────
let removed = 0
if (doFix) {
  for (const item of emptyVirtual) {
    try {
      rmSync(item.path, { recursive: true, force: true })
      removed += 1
    } catch {
      /* 删不掉就留在清单里，下一轮仍会报 */
    }
  }
}

const remaining = doFix
  ? emptyVirtual.filter((item) => existsSync(item.path))
  : emptyVirtual

const problems = remaining.length + topMissing.length + topEmpty.length
const payload = {
  root,
  emptyVirtualCount: remaining.length,
  emptyVirtualFirst10: remaining.slice(0, 10).map((item) => `${item.path} (${item.kind})`),
  topMissing,
  topEmpty,
  removed: doFix ? removed : null,
  ok: problems === 0,
}

if (asJson) {
  console.log(JSON.stringify(payload, null, 2))
} else {
  console.log(`[node-modules-integrity] root=${root}`)
  if (doFix) console.log(`[node-modules-integrity] --fix 已删除空目录 ${removed} 个`)
  if (remaining.length === 0) {
    console.log('✅ 虚拟层无空目录/断链')
  } else {
    console.log(`❌ 虚拟层空目录/断链 ${remaining.length} 个（前 10）：`)
    for (const item of payload.emptyVirtualFirst10) console.log(`   - ${item}`)
    if (remaining.length > 10) console.log(`   …其余 ${remaining.length - 10} 个见 --json`)
  }
  console.log(
    topMissing.length === 0
      ? '✅ 顶层声明依赖均有链接'
      : `❌ 顶层缺失 ${topMissing.length} 个：${topMissing.join(', ')}`,
  )
  if (topEmpty.length > 0) console.log(`❌ 顶层为空目录 ${topEmpty.length} 个：${topEmpty.join(', ')}`)
  console.log(
    problems === 0
      ? '[node-modules-integrity] 通过'
      : '[node-modules-integrity] 未通过；修复：先 --fix 删空目录，再 node scripts/lib/pnpm-install-lock.mjs run -- pnpm install --frozen-lockfile',
  )
}

process.exit(payload.ok ? 0 : 1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
