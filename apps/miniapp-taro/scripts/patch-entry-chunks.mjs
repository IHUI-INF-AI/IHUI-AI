#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * patch-entry-chunks.mjs — 给小程序产物里每个 webpack 入口补「静态 require」deferred chunk。
 *
 * 为什么需要它(2026-10-31 实测根因,票「首页/学习页区段头几何读数」):
 * weapp 端为压主包 2MB 上限开了 `mini.optimizeMainPackage`,同时把 Taro 内置
 * `cacheGroups.common.name` 摘掉避免 `SplitChunksPlugin` 同名冲突。两件事叠加后,
 * 产物里的入口/页面回调形如 `e.O(0,[25 个 chunkId], …)`,其中二十多个 chunk 被拆成
 * 独立的 `dist/<id>.js`,而**入口从不 require 它们**,小程序运行时也不会自动加载
 * ⇒ webpack 的 deferred modules 永远不满足 ⇒ `App()`/页面组件永不执行,
 * 表现就是整端白屏(`getApp()` 恒 false、`page.data` 只剩 `__webviewId__`)。
 *
 * 修法:在 taro build 之后扫产物,对每个含 `e.O(0,[...])` 的 JS,把其依赖里
 * **产物根目录确实存在的 `<id>.js`** 以**静态字符串** require 追加到文件末尾
 * (动态拼路径会被小程序编译器判 `module '…' is not defined`)。静态 require 还让
 * 编译器把 chunk 收进包;deferred 检查在最后一枚 chunk push 时自然通过。
 *
 * 幂等:文件里已有 MARK 即跳过。主包体积不变(这些 chunk 文件本就产出在 dist 里),
 * 代价是启动时多加载这些 chunk 的 JS —— 待 Taro/config 侧能共存后本脚本应退役。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const MARK = '/*miniapp-entry-chunks*/'
const DEFERRED_RE = /e\.O\(0,\[([0-9,]+)\]/

export function patchFile(file, { root = ROOT } = {}) {
  const src = fs.readFileSync(file, 'utf8')
  if (src.includes(MARK)) return { changed: false, count: 0 }
  const m = src.match(DEFERRED_RE)
  if (!m) return { changed: false, count: 0 }
  const rels = []
  for (const id of m[1].split(',')) {
    const chunk = path.join(root, `${id}.js`)
    if (!fs.existsSync(chunk)) continue
    let rel = path.relative(path.dirname(file), chunk).split(path.sep).join('/')
    if (!rel.startsWith('.')) rel = `./${rel}`
    rels.push(rel)
  }
  if (rels.length === 0) return { changed: false, count: 0 }
  const inject = `\n;${MARK}${rels.map((r) => `require("${r}")`).join(';')};`
  fs.writeFileSync(file, src + inject, 'utf8')
  return { changed: true, count: rels.length }
}

export function main(root = ROOT) {
  if (!fs.existsSync(root)) {
    console.error(`❌ 找不到产物目录 ${root}(先跑 taro build --type weapp)`)
    return 2
  }
  const files = []
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name)
      if (ent.isDirectory()) walk(p)
      else if (ent.name.endsWith('.js')) files.push(p)
    }
  }
  walk(root)
  let patched = 0
  let requires = 0
  for (const file of files) {
    if (!fs.readFileSync(file, 'utf8').includes('webpackJsonp')) continue
    const r = patchFile(file, { root })
    if (r.changed) {
      patched += 1
      requires += r.count
    }
  }
  console.log(`[patch-entry-chunks] 补挂 ${patched} 个入口,共 ${requires} 条静态 require`)
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}`)
    process.exit(2)
  }
}

export const __test__ = { patchFile, MARK, DEFERRED_RE, ROOT }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
