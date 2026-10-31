#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * gen-knip-taro-entries.mjs — 从 Taro 的 app.config.ts 派生 knip 的 entry 清单
 *
 * 立因(2026-10-31):`apps/miniapp-taro` 的页面由 `src/app.config.ts` 的 `pages` 数组与
 * `subPackages[].root + pages` 按**字符串路径**装载,Taro 在运行时才去 resolve
 * (`<root>/<page>.tsx` 或 `<root>/<page>/index.tsx`)。knip 只沿静态 import 走,
 * 看不见这条装载链 ⇒ 每个页面连同它独占 import 的组件/常量一起被记成「未引用文件」。
 * 这已经让 knip 棘轮连续多批超基线(2026-10-20 / 10-25 / 10-26 三批都在往
 * knip.jsonc 里手工补 `ignore` 白名单),而白名单每加一页就要人记得再补一条。
 *
 * 本脚本把「页面注册表 → entry 清单」变成派生态:
 *   源头 = apps/miniapp-taro/src/app.config.ts
 *   派生 = knip.jsonc 里 apps/miniapp-taro.entry 的受管块( `// BEGIN/END:knip-taro-entries` )
 * 受管块禁止手改:新增/删除页面只改 app.config.ts,再跑本脚本 --write。
 *
 * 用法:
 *   node scripts/gen-knip-taro-entries.mjs           # 干跑,打印将写入的条数与差异摘要
 *   node scripts/gen-knip-taro-entries.mjs --write   # 写回 knip.jsonc
 *   node scripts/gen-knip-taro-entries.mjs --check   # 只判「受管块是否与源同步」,0 同步/1 漂移/2 未判定
 *
 * 退出码:0 成功(或 --check 判定同步);1 --check 判定漂移;2 未判定(源文件/受管块取不到)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'apps/miniapp-taro/src')
const CONFIG_REL = 'apps/miniapp-taro/src/app.config.ts'
const KNIP_REL = 'knip.jsonc'
const BEGIN = '// BEGIN:knip-taro-entries(由 scripts/gen-knip-taro-entries.mjs 生成,禁止手改)'
const END = '// END:knip-taro-entries'

/** 去掉行注释,避免注释里的引号被当成条目 */
function stripLineComments(text) {
  return text
    .split('\n')
    .map((line) => {
      const i = line.indexOf('//')
      return i >= 0 ? line.slice(0, i) : line
    })
    .join('\n')
}

const listOf = (s) => [...s.matchAll(/'([^']+)'/g)].map((m) => m[1])

/** 解析 app.config.ts:主包 pages + 每个 subPackage 的 root/pages */
export function parseTaroPages(text) {
  const clean = stripLineComments(text)
  const subIdx = clean.indexOf('subPackages')
  const head = subIdx >= 0 ? clean.slice(0, subIdx) : clean
  const mainBlock = head.match(/pages\s*:\s*\[([\s\S]*?)\]/)?.[1]
  if (mainBlock === undefined) return null
  const main = listOf(mainBlock).map((p) => ({ base: p }))
  const subs = []
  if (subIdx >= 0) {
    const tail = clean.slice(subIdx)
    const re = /root\s*:\s*'([^']+)'[\s\S]*?pages\s*:\s*\[([\s\S]*?)\]/g
    let m
    while ((m = re.exec(tail)) !== null) {
      for (const p of listOf(m[2])) subs.push({ base: `${m[1]}/${p}` })
    }
  }
  return [...main, ...subs].map((x) => x.base)
}

/** 页面路径 → 真实文件(组件 + 同页 config),取不到的返回空 */
function resolvePage(base) {
  const rel = base.replace(/^\//, '')
  const out = []
  const component = [`${rel}.tsx`, `${rel}.ts`, `${rel}/index.tsx`, `${rel}/index.ts`].find((c) =>
    existsSync(join(SRC, c)),
  )
  if (!component) return out
  out.push(component)
  for (const cfg of [`${rel}.config.ts`, `${rel}/index.config.ts`]) {
    if (existsSync(join(SRC, cfg))) out.push(cfg)
  }
  return out
}

export function buildEntries(configText) {
  const pages = parseTaroPages(configText)
  if (!pages) return null
  const set = new Set(['src/app.tsx'])
  const unresolved = []
  for (const p of pages) {
    const files = resolvePage(p)
    if (files.length === 0) unresolved.push(p)
    for (const f of files) set.add(`src/${f}`)
  }
  return { entries: [...set].sort(), unresolved, pageCount: pages.length }
}

function renderBlock(entries) {
  const lines = entries.map((e) => `        ${JSON.stringify(e)},`)
  return [BEGIN, '      "entry": [', ...lines, '      ],', END].join('\n')
}

function readFaces() {
  const cfgPath = join(ROOT, CONFIG_REL)
  const knipPath = join(ROOT, KNIP_REL)
  if (!existsSync(cfgPath) || !existsSync(knipPath)) return null
  return { configText: readFileSync(cfgPath, 'utf8'), knipText: readFileSync(knipPath, 'utf8') }
}

export function currentBlock(knipText) {
  const start = knipText.indexOf(BEGIN)
  const end = knipText.indexOf(END)
  if (start < 0 || end < 0 || end < start) return null
  return knipText.slice(start, end + END.length)
}

function main() {
  const write = process.argv.includes('--write')
  const check = process.argv.includes('--check')
  const faces = readFaces()
  if (!faces) {
    console.error('[gen-knip-taro-entries] 未判定:取不到 app.config.ts 或 knip.jsonc')
    process.exit(2)
  }
  const built = buildEntries(faces.configText)
  if (!built) {
    console.error('[gen-knip-taro-entries] 未判定:app.config.ts 里找不到 pages 数组')
    process.exit(2)
  }
  const block = renderBlock(built.entries)
  const cur = currentBlock(faces.knipText)
  console.log(
    `[gen-knip-taro-entries] 页面 ${built.pageCount} 个 → entry ${built.entries.length} 条` +
      (built.unresolved.length ? `;解析不到文件的页面 ${built.unresolved.length} 个:${built.unresolved.slice(0, 5).join(',')}` : ''),
  )
  if (check) {
    if (cur === null) {
      console.error('[gen-knip-taro-entries] 未判定:knip.jsonc 里没有受管块(BEGIN/END 缺失)')
      process.exit(2)
    }
    if (cur !== block) {
      console.error('[gen-knip-taro-entries] ❌ 受管块与 app.config.ts 不同步,请跑 --write')
      process.exit(1)
    }
    console.log('[gen-knip-taro-entries] ✅ 受管块与源同步')
    return
  }
  if (!write) {
    console.log(cur === null ? '[dry-run] 受管块不存在,将插入新块' : '[dry-run] 受管块已存在,将原位替换')
    return
  }
  let next
  if (cur !== null) {
    next = faces.knipText.replace(cur, block)
  } else {
    // 首次接入:定位 apps/miniapp-taro 段里的 "entry": [...] 并整行替换成受管块
    const anchor = /"apps\/miniapp-taro"\s*:\s*\{[\s\S]*?\n(\s*)"entry"\s*:\s*\[[^\]]*\],?/
    const m = faces.knipText.match(anchor)
    if (!m) {
      console.error('[gen-knip-taro-entries] 未判定:knip.jsonc 里找不到 apps/miniapp-taro.entry 锚点')
      process.exit(2)
    }
    const at = m.index + m[0].lastIndexOf(m[1] + '"entry"')
    const lineEnd = faces.knipText.indexOf('\n', at)
    next = faces.knipText.slice(0, m.index + (m[1].length ? m[0].indexOf(m[1] + '"entry"') : 0)) + block + faces.knipText.slice(lineEnd)
  }
  if (next === faces.knipText) {
    console.log('[gen-knip-taro-entries] 无变化')
    return
  }
  writeFileSync(join(ROOT, KNIP_REL), next)
  console.log(`[gen-knip-taro-entries] 已写入 ${KNIP_REL}`)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
}

export const __test__ = { parseTaroPages, buildEntries, currentBlock, renderBlock }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
