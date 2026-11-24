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
 * 2026-11-03(Taro 装载面补全)派生源扩到三处(全部是"框架/构建按约定装载"的真相源):
 *   ① app.config.ts 的 pages/subPackages → 页面 entry(同前)
 *   ② app.config.ts 的 tabBar.custom:true → src/custom-tab-bar/index(.config).tsx
 *      (Taro/微信把自定义 TabBar 组件按**固定目录约定**装载,静态 import 面看不见)
 *   ③ config/index.ts 的构建 alias → knip paths 的 rn-compat 键集 + 对应目标文件 entry
 *      (共享层 import 'react-native' 等请求在构建期被换到端内 rn-compat;knip 走 node_modules
 *      解析,既看不见 alias 也不知道这些文件是模块根 ⇒ 目标文件必须同时进 entry 才可达)
 *      paths 键集与 config/index.ts 的 rn-compat alias 键集**逐项相等**,由
 *      scripts/tests/knip-taro-alias-parity.test.mjs 判红;alias 增减而配置不跟上当场失败。
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
const BUILD_CONFIG_REL = 'apps/miniapp-taro/config/index.ts'
const KNIP_REL = 'knip.jsonc'
/** knip paths 里与 rn-compat 别名并列的非别名映射(来源 apps/miniapp-taro/tsconfig.json 的 paths,
 *  它们不是构建 alias、不在 config/index.ts 别名表里,故不参与 alias 键集自检)。 */
const EXTRA_PATHS = {
  '@rn-shells/*': ['../mobile-rn/src/screens/*'],
  '@ihui/rn-app/*': ['../../packages/app/src/*'],
}
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

/** 从 openIdx 处的开括号起截取到配对的闭括号 */
function extractBraced(text, openIdx, open = '(', close = ')') {
  let depth = 0
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === open) depth++
    else if (text[i] === close) {
      depth--
      if (depth === 0) return text.slice(openIdx, i + 1)
    }
  }
  return null
}

/**
 * 解析 apps/miniapp-taro/config/index.ts 里指向端内 rn-compat 的构建别名。
 * 只在 `alias: { ... }` 对象内取键(同文件的 rnShellReplacements 也有 `to: path.resolve(...rn-compat...)`,
 * 那是替换插件落点、不是别名,全局匹配会把它误记成别名)。
 * 支持键带引号/裸写(nativewind$),值跨多行 path.resolve(__dirname, '..', 'src', 'rn-compat', '<file>')。
 * 只收目标路径包含 'rn-compat' 的键 —— '@' / '@ihui/rn-app' 不是替换式别名,不进键集。
 * 同一键在顶层 alias 与 mini.alias 重复声明时,目标必须一致,否则当场抛错(第二真相)。
 */
export function parseRncAliases(text) {
  const clean = stripLineComments(text)
  const out = new Map()
  const aliasRe = /alias\s*:\s*{/g
  let block
  while ((block = aliasRe.exec(clean)) !== null) {
    const body = extractBraced(clean, block.index + block[0].length - 1, '{', '}')
    if (!body) continue
    const entryRe = /(?:^|[{,])\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$-]*))\s*:\s*path\.resolve\(/g
    let m
    while ((m = entryRe.exec(body)) !== null) {
      const key = m[1] ?? m[2] ?? m[3]
      const call = extractBraced(body, m.index + m[0].length - 1)
      if (!call) continue
      const parts = [...call.matchAll(/'([^']+)'/g)].map((x) => x[1])
      if (!parts.includes('rn-compat')) continue
      const target = `src/rn-compat/${parts[parts.length - 1]}`
      if (out.has(key) && out.get(key) !== target) {
        throw new Error(`[gen-knip-taro-entries] alias ${key} 在两处声明指向不同目标:${out.get(key)} vs ${target}`)
      }
      out.set(key, target)
    }
  }
  return out
}

/** rn-compat 目标:能补 .ts/.tsx 就补上真实文件名(alias 允许不带后缀,如 native-extras) */
export function resolveRncFile(rel) {
  const candidates = [rel, `${rel}.ts`, `${rel}.tsx`, `${rel}/index.ts`, `${rel}/index.tsx`]
  const hit = candidates.find((c) => existsSync(join(ROOT, 'apps/miniapp-taro', c)))
  return hit ?? rel
}

/** app.config.ts 是否启用自定义 TabBar(Taro 按固定目录 custom-tab-bar/index 装载) */
export function hasCustomTabBar(configText) {
  const clean = stripLineComments(configText)
  const at = clean.indexOf('tabBar')
  if (at < 0) return false
  return /custom\s*:\s*true/.test(clean.slice(at))
}

export function buildEntries(configText, rncAliases = new Map(), rnShellTargets = new Set()) {
  const pages = parseTaroPages(configText)
  if (!pages) return null
  const set = new Set(['src/app.tsx'])
  const unresolved = []
  for (const p of pages) {
    const files = resolvePage(p)
    if (files.length === 0) unresolved.push(p)
    for (const f of files) set.add(`src/${f}`)
  }
  // 构建 alias 的目标文件是"共享层 import 的模块根",静态面不可达 ⇒ 必须作为 entry 才可达
  for (const target of rncAliases.values()) set.add(resolveRncFile(target))
  // 2026-11-04:rn-shell-replace 的落点同样必须可达。它与 alias 是**两条独立通道** ——
  // alias 换的是"共享层对已安装包的请求",而 RnShellReplacePlugin 换的是"发起方在
  // apps/mobile-rn/src/ 里时对 RN 真相源模块的请求"(config/index.ts:457 那段 plugin 装载)。
  // 之前只解析 alias 块,于是 rn-compat/i18n.ts、rn-compat/theme.tsx 这类**纯替换落点**
  // 从未进过 entry,长期被判未引用文件 —— 这是判据缺口,不是死代码。
  for (const target of rnShellTargets) set.add(target)
  // 2026-11-04:Taro 构建配置本身是框架约定入口 —— @tarojs/helper 的 PROJECT_CONFIG 常量
  // 写死 'config/index',`taro build --type weapp`(package.json:22)不传 --config,
  // CLI 直接在 ctx.paths.configPath 读它。knip 看不见"框架按约定加载配置"这一形态,
  // 于是 config/index.ts 连同它静态 import 的 dev.ts/prod.ts/rn-shell-replace-plugin.ts
  // 一起被判未引用文件。加到 entry 后 knip 会正常分析它们的 import(那正是判据想要的)。
  set.add('config/index.ts')
  // custom-tab-bar:app.config.ts 的 tabBar.custom:true 时,平台按目录约定装载这两个文件
  let customTabBar = false
  if (hasCustomTabBar(configText)) {
    for (const f of ['src/custom-tab-bar/index.tsx', 'src/custom-tab-bar/index.config.ts']) {
      if (existsSync(join(ROOT, 'apps/miniapp-taro', f))) {
        set.add(f)
        customTabBar = true
      }
    }
  }
  return { entries: [...set].sort(), unresolved, pageCount: pages.length, customTabBar }
}

/**
 * 解析 `rnShellReplacements` 的落点(`to: path.resolve(..., 'rn-compat', 'x.ts')`)。
 *
 * 与 parseRncAliases 分开:那条走 `alias: { key: path.resolve(...) }` 的**键值**形态,
 * 这条走 `{ base, to }` 的**对象数组**形态,两者语义不同(前者映射包名,后者映射发起方模块),
 * 合在一个函数里会让 alias 键集自检被污染的合成键撑大。
 */
export function parseRnShellTargets(text) {
  const clean = stripLineComments(text)
  const out = new Set()
  const re = /to\s*:\s*path\.resolve\(([^)]*)\)/g
  let m
  while ((m = re.exec(clean)) !== null) {
    const parts = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
    if (!parts.includes('rn-compat')) continue
    out.add(`src/rn-compat/${parts[parts.length - 1]}`)
  }
  return out
}

/** 受管 paths = config/index.ts 的 rn-compat alias(按原键,保留 `$` 语义) + tsconfig 的非别名映射 */
export function buildPaths(rncAliases) {
  const out = {}
  for (const [key, target] of rncAliases) out[key] = [resolveRncFile(target)]
  return { ...EXTRA_PATHS, ...out }
}

function renderBlock(entries, paths = {}) {
  const lines = entries.map((e) => `        ${JSON.stringify(e)},`)
  const pathLines = Object.entries(paths).map(
    ([k, rels]) => `        ${JSON.stringify(k)}: ${JSON.stringify(rels)},`,
  )
  return [
    BEGIN,
    '      // rn-compat 构建别名:键集与 apps/miniapp-taro/config/index.ts 逐项相等',
    '      // (自检 scripts/tests/knip-taro-alias-parity.test.mjs;alias 增减而此处不跟上即判红)。',
    '      // 注意:knip 对已安装包的请求先走 node_modules resolveSync,不回落到 paths ——',
    '      // 真正让这些目标可达的是上面 entry 里的同名文件,paths 保留是为了键集漂移可见。',
    '      // @rn-shells/* 与 @ihui/rn-app/* 来自 apps/miniapp-taro/tsconfig.json,非 rn-compat,不参与自检。',
    '      "entry": [',
    ...lines,
    '      ],',
    '      "paths": {',
    ...pathLines,
    '      },',
    END,
  ].join('\n')
}

/** 从 knip.jsonc 受管块读出 rn-compat alias 键值(值数组里含 rn-compat 的才算) */
export function parseKnipRncAliases(knipText) {
  const block = currentBlock(knipText)
  if (!block) return null
  const at = block.indexOf('"paths"')
  if (at < 0) return null
  const out = new Map()
  for (const m of block.slice(at).matchAll(/"([^"]+)"\s*:\s*\[\s*"([^"]+)"\s*\]/g)) {
    if (m[2].includes('rn-compat')) out.set(m[1], m[2])
  }
  return out
}

function readFaces() {
  const cfgPath = join(ROOT, CONFIG_REL)
  const knipPath = join(ROOT, KNIP_REL)
  if (!existsSync(cfgPath) || !existsSync(knipPath)) return null
  return {
    configText: readFileSync(cfgPath, 'utf8'),
    buildConfigText: existsSync(join(ROOT, BUILD_CONFIG_REL))
      ? readFileSync(join(ROOT, BUILD_CONFIG_REL), 'utf8')
      : null,
    knipText: readFileSync(knipPath, 'utf8'),
  }
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
  if (faces.buildConfigText === null) {
    console.error(`[gen-knip-taro-entries] 未判定:取不到 ${BUILD_CONFIG_REL}`)
    process.exit(2)
  }
  let rncAliases
  try {
    rncAliases = parseRncAliases(faces.buildConfigText)
  } catch (e) {
    console.error(`[gen-knip-taro-entries] 未判定:${e.message}`)
    process.exit(2)
  }
  if (rncAliases.size === 0) {
    console.error('[gen-knip-taro-entries] 未判定:config/index.ts 里解析不到 rn-compat alias')
    process.exit(2)
  }
  const built = buildEntries(faces.configText, rncAliases, parseRnShellTargets(faces.buildConfigText))
  if (!built) {
    console.error('[gen-knip-taro-entries] 未判定:app.config.ts 里找不到 pages 数组')
    process.exit(2)
  }
  const block = renderBlock(built.entries, buildPaths(rncAliases))
  const cur = currentBlock(faces.knipText)
  console.log(
    `[gen-knip-taro-entries] 页面 ${built.pageCount} 个 + rn-compat alias ${rncAliases.size} 条` +
      `${built.customTabBar ? ' + custom-tab-bar' : ''} → entry ${built.entries.length} 条` +
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

export const __test__ = {
  parseTaroPages,
  parseRncAliases,
  resolveRncFile,
  hasCustomTabBar,
  buildEntries,
  buildPaths,
  currentBlock,
  renderBlock,
  parseKnipRncAliases,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
