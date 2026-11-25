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

// 运行时基座 chunk:由 app 入口/框架自身加载,页面入口不得重复 require。
// 这些文件在 webpackJsonp 里同样带 chunk id,若按映射补挂会被重复打进每个页面。
const BASE_CHUNK_FILES = new Set(['app.js', 'comp.js', 'taro.js', 'vendors.js', 'runtime.js'])

/**
 * 建立 webpack chunk id → 磁盘文件名映射。
 *
 * 背景:Taro 产物多数 chunk 按纯数字 id 命名(`<id>.js`),但个别 chunk(实测 `68e3`)
 * 被重命名为顺序数字文件(`68000.js`)。补丁若只按 `<id>.js` 找文件,这条业务 chunk
 * 会被判"产物不存在"而漏掉 ⇒ deferred 模块永不满足 ⇒ 页面组件工厂不执行 ⇒ 整屏白
 * (page.data 只剩 `__webviewId__`)。这里读每个根 chunk 头部
 * `webpackJsonp.push([[ids],…])` 反查 chunk id 对应的真实磁盘文件名。
 */
export function buildChunkIdMap(root = ROOT) {
  const map = new Map()
  if (!fs.existsSync(root)) return map
  for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
    if (!ent.isFile() || !ent.name.endsWith('.js')) continue
    const head = fs.readFileSync(path.join(root, ent.name), 'utf8').slice(0, 200)
    const m = head.match(/push\(\[\[([0-9A-Za-z,\s]*)\]/)
    if (!m) continue
    for (const id of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
      if (!map.has(id)) map.set(id, ent.name)
    }
  }
  return map
}

/** 解析 chunk id 对应的磁盘文件名:先按 `<id>.js` 直挂,落空再查 id→文件映射;基座文件不补。 */
function resolveChunkFile(id, root, idMap) {
  const byId = `${id}.js`
  if (fs.existsSync(path.join(root, byId))) return byId
  const mapped = idMap && idMap.get(id)
  if (mapped && !BASE_CHUNK_FILES.has(mapped) && fs.existsSync(path.join(root, mapped))) {
    return mapped
  }
  return null
}
// 2026-11-26 修:这里曾写死 `e.O(...)` + `[0-9,]+`,两处都过窄,实测把 34 个入口判成"无 deferred 列表"
// 而静默跳过 ⇒ 那些页的 chunk 永不补挂 ⇒ 组件永不执行 ⇒ 整屏白(page.data 只剩 __webviewId__)。
// ① 变量名前缀随入口类型而变(主入口 e、页面入口可能是 n/s/r)⇒ 收任意标识符;
// ② chunk id 可能是 webpack 的十六进制名(实测 68e3)⇒ 字符类必须收字母,否则整条列表匹配失败;
// ③ 依赖列表可能**跨行**(实测 pages/user/index.js 19+ 个 id 被 webpack 换行输出)⇒ 字符类必须收空白,
//    否则同一条列表整段匹配失败,该页永远补不上 —— 这是「我的」页白屏的最后一层根因。
const DEFERRED_RE = /[A-Za-z_$][A-Za-z0-9_$]*\.O\(0,\[\s*([0-9A-Za-z,\s]*?)\s*\]/

export function patchFile(file, { root = ROOT, idMap } = {}) {
  const src = fs.readFileSync(file, 'utf8')
  if (src.includes(MARK)) return { changed: false, count: 0 }
  const m = src.match(DEFERRED_RE)
  if (!m) return { changed: false, count: 0 }
  const map = idMap ?? buildChunkIdMap(root)
  const rels = []
  for (const id of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
    const chunkName = resolveChunkFile(id, root, map)
    if (!chunkName) continue
    const chunk = path.join(root, chunkName)
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
  const idMap = buildChunkIdMap(root)
  let patched = 0
  let requires = 0
  for (const file of files) {
    if (!fs.readFileSync(file, 'utf8').includes('webpackJsonp')) continue
    const r = patchFile(file, { root, idMap })
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

export const __test__ = { patchFile, buildChunkIdMap, MARK, DEFERRED_RE, ROOT, BASE_CHUNK_FILES }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
