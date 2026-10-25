#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 补测器为 CLI 工具,诊断/清单走 console 输出 */

/**
 * e2e-autofill.mjs — E2E/集成测试缺口自动补测器(判据 + 骨架 + 机器可读清单)。
 *
 * 回答一个问题:"本次新增/改动的源模块,有没有对应的集成/E2E 测试?"并给出可直接落盘的
 * 建议 spec 路径与用例名,供 AI 补测(本脚本只生成骨架,不写业务断言)。
 *
 * 判据面(AGENTS §0.4,清单与内容同面同轮,取不到即 exit 2 未判定):
 *   无旗      HEAD blob 面,对比 HEAD^(只看最后一枚提交带进来的改动)
 *   --staged  索引 blob 面,对比 HEAD(pre-commit 形态;真正的准入门应挂这一档)
 *   --worktree 不支持 —— 共享工作树常年滞后 HEAD,按磁盘判会在恒红与假绿之间跳。
 *
 * 棘轮口径(§0.2 / §0.5,锚点 = 被审面自身):
 *   新缺口 = 被审面里"没有对应测试"的模块,且它在本轮之前不存在,或它在本轮之前是有测试的
 *   (测试被删 = 把缺口带回来)⇒ 判红。
 *   存量缺口 = 本轮之前也没有测试的模块 ⇒ 只报数,绝不判红。
 *
 * 单一真相源(§0.6 / §22c):扫描面、测试落点配方、模块↔测试显式映射全部住在
 * scripts/data/e2e-autofill-map.json;本文件只实现判据,不另抄清单。
 * 覆盖判据 = ① 显式映射命中;或 ② 模块 key(路由 slug / 文件名 stem)的每个 token 都出现在
 * 测试文件 stem 里,且测试层与模块层同族(路由模块只认 e2e spec,代码模块只认单测)。
 *
 * CLI:
 *   node scripts/e2e-autofill.mjs [--check] [--staged]        准入判定(默认)
 *   node scripts/e2e-autofill.mjs --propose [--staged]        机器可读缺口清单(JSON)
 *   node scripts/e2e-autofill.mjs --emit <spec> [--module <模块>] [--write] [--staged]
 *                                                            生成骨架;默认 dry-run,不加 --write 不写盘
 *   node scripts/e2e-autofill.mjs --self-test                   内置断言
 *
 * 退出码:0 绿/成功 / 1 有新增缺口 / 2 未判定或拒绝执行(缺输入、目标已存在、参数自相矛盾)。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, gitRaw, listFaceFiles } from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(HERE, '..')
export const MAP_REL = 'scripts/data/e2e-autofill-map.json'
/** 被审面只取这两个包(与票面"只扫描 apps/web、apps/api"一致)。 */
const FACE_PATHS = ['apps/web', 'apps/api']
const MAX_LISTED = 15

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

export function normalizeRel(value) {
  return String(value ?? '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
}

/** 映射基线是唯一真相源;读不到/坏 JSON 一律抛 Undetermined(调用方折成 exit 2)。 */
export function loadMap(root = ROOT) {
  const abs = join(root, MAP_REL)
  let text
  try {
    text = readFileSync(abs, 'utf8')
  } catch (e) {
    throw new Undetermined(`映射基线取不到(${MAP_REL}):${e.message}`)
  }
  let map
  try {
    map = JSON.parse(text)
  } catch (e) {
    throw new Undetermined(`映射基线不是合法 JSON(${MAP_REL}):${e.message}`)
  }
  const audit = map?.audit
  if (!audit || !Array.isArray(audit.roots) || audit.roots.length === 0) {
    throw new Undetermined(`映射基线缺 audit.roots(${MAP_REL})`)
  }
  if (!Array.isArray(map.recipes) || map.recipes.length === 0) {
    throw new Undetermined(`映射基线缺 recipes(${MAP_REL})`)
  }
  for (const key of ['testSuffixes', 'sourceExts', 'noiseSegments', 'nonSourceSegments']) {
    if (!Array.isArray(audit[key])) throw new Undetermined(`映射基线缺 audit.${key}(${MAP_REL})`)
  }
  if (
    map.mappings !== undefined &&
    (typeof map.mappings !== 'object' || Array.isArray(map.mappings))
  ) {
    throw new Undetermined(`映射基线 mappings 必须是对象(${MAP_REL})`)
  }
  for (const [moduleRel, tests] of Object.entries(map.mappings ?? {})) {
    if (!Array.isArray(tests) || tests.some((t) => typeof t !== 'string')) {
      throw new Undetermined(`映射基线 mappings["${moduleRel}"] 必须是字符串数组(${MAP_REL})`)
    }
  }
  return map
}

const segmentsOf = (rel) => normalizeRel(rel).split('/')
const hasSegment = (rel, list) => segmentsOf(rel).some((s) => list.includes(s))

export function appOf(rel) {
  const n = normalizeRel(rel)
  if (n.startsWith('apps/web/')) return 'web'
  if (n.startsWith('apps/api/')) return 'api'
  return null
}

/** node_modules / dist / .next 一类:清单枚举与测试索引都不得穿过。 */
export function isNoisePath(rel, map) {
  return hasSegment(rel, map.audit.noiseSegments)
}

export function isTestFile(rel, map) {
  const n = normalizeRel(rel)
  return map.audit.testSuffixes.some((suffix) => n.endsWith(suffix))
}

export function isE2eSpec(rel, map) {
  const n = normalizeRel(rel)
  if (!isTestFile(n, map)) return false
  return (map.e2eRoots ?? []).some((root) => n.startsWith(`${normalizeRel(root)}/`))
}

/** 受审源模块:在被审根内、非噪音/非测试目录、非 barrel/类型/框架样板文件。 */
export function isAuditedSource(rel, map) {
  const n = normalizeRel(rel)
  if (!appOf(n)) return false
  if (!map.audit.roots.some((root) => n === root || n.startsWith(`${normalizeRel(root)}/`))) {
    return false
  }
  if (isNoisePath(n, map)) return false
  if (hasSegment(n, map.audit.nonSourceSegments)) return false
  if (isTestFile(n, map)) return false
  const base = n.split('/').pop()
  if ((map.audit.ignoreFilenames ?? []).includes(base)) return false
  if ((map.audit.ignoreSuffixes ?? []).some((suffix) => n.endsWith(suffix))) return false
  const ext = `.${base.split('.').pop().toLowerCase()}`
  return map.audit.sourceExts.includes(ext)
}

/** 第一条命中的配方就是该模块的族(顺序有意义:先具体后兜底)。 */
export function recipeFor(rel, map) {
  const n = normalizeRel(rel)
  const base = n.split('/').pop()
  for (const recipe of map.recipes) {
    if (recipe.app !== appOf(n)) continue
    if (!new RegExp(recipe.match).test(n)) continue
    if (Array.isArray(recipe.filenames) && !recipe.filenames.includes(base)) continue
    return recipe
  }
  return null
}

/** Next 路由 key:`app/(main)/admin/users/page.tsx` → `admin-users`(路由组/私有目录不参与)。 */
export function routeSlugOf(rel) {
  const n = normalizeRel(rel)
  const prefix = 'apps/web/app/'
  const rest = n.startsWith(prefix) ? n.slice(prefix.length) : n
  const dirs = rest
    .split('/')
    .slice(0, -1)
    .filter((s) => !s.startsWith('(') && !s.startsWith('@') && !s.startsWith('_'))
    .map((s) => s.replace(/^\[+/, '').replace(/\]+$/, ''))
  return dirs.length ? dirs.join('-') : 'home'
}

/** 文件名 stem:去掉扩展名与 test/spec/node-test 后缀。 */
export function stemOf(rel) {
  const base = normalizeRel(rel).split('/').pop()
  return base.replace(/\.(?:tsx?|jsx?|mjs|cjs)$/, '').replace(/\.(?:node-test|test|spec)$/, '')
}

/** camelCase 也要拆成 token,否则 `agentPlanApi.ts` 与 `agent-plan-api.test.ts` 永远配不上。 */
export function tokensOf(value) {
  return String(value ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

export function moduleKeyOf(rel, map) {
  const n = normalizeRel(rel)
  const recipe = recipeFor(n, map)
  if (!recipe) return null
  return recipe.key === 'route-path' ? routeSlugOf(n) : stemOf(n)
}

export function suggestedSpecOf(rel, map) {
  const n = normalizeRel(rel)
  const recipe = recipeFor(n, map)
  if (!recipe) return null
  const parts = n.split('/')
  const base = parts.pop() ?? ''
  const dir = parts.join('/')
  const stem = stemOf(n)
  const ext = base.endsWith('.tsx') ? '.tsx' : '.ts'
  const area = parts[3] ?? ''
  const key = recipe.key === 'route-path' ? routeSlugOf(n) : stem
  return recipe.spec
    .replace(/\{dir\}/g, dir)
    .replace(/\{stem\}/g, stem)
    .replace(/\{key\}/g, key)
    .replace(/\{area\}/g, area)
    .replace(/\{ext\}/g, ext)
}

export function caseNameOf(rel, map) {
  return `${moduleKeyOf(rel, map)} 冒烟`
}

/** spec 落点只许在 apps/web|apps/api 内的测试文件名 —— 防 emit 被参数带出仓/带进源码。 */
export function safeSpecPath(rel, map) {
  const n = normalizeRel(rel)
  if (!n || n.startsWith('/') || /^[A-Za-z]:/.test(n)) return null
  if (n.split('/').includes('..')) return null
  if (!appOf(n)) return null
  if (!isTestFile(n, map)) return null
  return n
}

/** 测试索引:只做一次 token 拆解,避免逐模块重复解析。 */
export function indexTests(testRels, map) {
  const index = []
  for (const rel of testRels) {
    const n = normalizeRel(rel)
    if (!isTestFile(n, map) || isNoisePath(n, map)) continue
    const app = appOf(n)
    if (!app) continue
    index.push({ rel: n, app, e2e: isE2eSpec(n, map), tokens: new Set(tokensOf(stemOf(n))) })
  }
  return index
}

/**
 * 覆盖判据的**唯一实现**:显式映射优先;否则要求 ① 同包 ② 层同族(路由↔e2e / 代码↔单测)
 * ③ 模块 key 的每个 token 都在测试 stem 里。
 */
export function coversWithIndex(moduleRel, testIndex, map) {
  const m = normalizeRel(moduleRel)
  const app = appOf(m)
  const recipe = recipeFor(m, map)
  if (!app || !recipe) return []
  const explicit = new Set((map.mappings?.[m] ?? []).map(normalizeRel))
  const keyTokens = tokensOf(moduleKeyOf(m, map))
  if (keyTokens.length === 0) return []
  const hits = []
  for (const test of testIndex) {
    if (test.app !== app) continue
    if (explicit.has(test.rel)) {
      hits.push(test.rel)
      continue
    }
    const sameLayer = recipe.framework === 'playwright' ? test.e2e : !test.e2e
    if (!sameLayer) continue
    if (keyTokens.every((token) => test.tokens.has(token))) hits.push(test.rel)
  }
  return hits
}

export function testCoversModule(moduleRel, testRel, map) {
  const t = normalizeRel(testRel)
  if (!isTestFile(t, map)) return false
  return coversWithIndex(moduleRel, indexTests([t], map), map).includes(t)
}

/**
 * 棘轮差:新缺口 = 本轮才出现(或本轮前有测试、本轮没了)的未覆盖模块;存量只报数。
 * 构造面即可证明,不依赖 git(镜像测试与 --self-test 都从这里取判据)。
 */
export function diffGaps({ faceModules, baseModules, faceTests, baseTests, map }) {
  const faceIndex = indexTests(faceTests, map)
  const baseIndex = indexTests(baseTests, map)
  const baseSet = new Set(baseModules.map(normalizeRel))
  const baseCovered = new Set()
  for (const rel of baseModules) {
    if (coversWithIndex(rel, baseIndex, map).length > 0) baseCovered.add(normalizeRel(rel))
  }
  const gaps = []
  for (const rel of faceModules) {
    const moduleRel = normalizeRel(rel)
    if (coversWithIndex(moduleRel, faceIndex, map).length > 0) continue
    const recipe = recipeFor(moduleRel, map)
    if (!recipe) continue
    gaps.push({
      module: moduleRel,
      kind: recipe.framework === 'playwright' ? 'route' : 'unit',
      framework: recipe.framework,
      spec: suggestedSpecOf(moduleRel, map),
      caseName: caseNameOf(moduleRel, map),
      isNew: !baseSet.has(moduleRel) || baseCovered.has(moduleRel),
    })
  }
  gaps.sort((a, b) => a.module.localeCompare(b.module))
  return {
    gaps,
    newGaps: gaps.filter((g) => g.isNew),
    stockGaps: gaps.filter((g) => !g.isNew),
  }
}

/** `--emit` 的取目标判据(纯函数):spec 必须来自本轮缺口清单,同 spec 多模块时必须点名。 */
export function selectEmitTarget({ specRel, moduleRel, gaps }) {
  const spec = normalizeRel(specRel ?? '')
  if (!spec) return { ok: false, reason: '--emit 需要显式的 spec 路径' }
  const hits = (gaps ?? []).filter((g) => g.spec === spec)
  if (hits.length === 0) {
    return { ok: false, reason: `${spec} 不在本轮缺口清单里(先跑 --propose 取建议落点)` }
  }
  if (moduleRel) {
    const wanted = normalizeRel(moduleRel)
    const hit = hits.find((g) => g.module === wanted)
    if (!hit) return { ok: false, reason: `${wanted} 不是 ${spec} 的缺口候选` }
    return { ok: true, target: hit }
  }
  if (hits.length > 1) {
    const names = hits.map((g) => g.module).join(' / ')
    return { ok: false, reason: `${spec} 对应多个模块(${names}),请加 --module 点名` }
  }
  return { ok: true, target: hits[0] }
}

const escapeTs = (value) =>
  String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")

/**
 * 骨架必须能被现有配置识别(路径由配方保证),且**不立刻制造红**:
 * playwright 用 test.skip、vitest 用 it.todo —— 补真正断言是 AI/人的下一步。
 */
export function skeletonFor(gap) {
  const mod = escapeTs(gap?.module)
  const title = escapeTs(gap?.caseName ?? '冒烟')
  if (gap?.framework === 'playwright') {
    return [
      "import { test } from '@playwright/test'",
      '',
      `test.describe('${mod}', () => {`,
      `  test.skip('${title}', async () => {})`,
      '})',
      '',
    ].join('\n')
  }
  return [
    "import { describe, it } from 'vitest'",
    '',
    `describe('${mod}', () => {`,
    `  it.todo('${title}')`,
    '})',
    '',
  ].join('\n')
}

/** 写盘唯一出口:`wx` 保证并发/已存在时拒绝覆盖。 */
export function writeSkeleton(root, specRel, text) {
  const abs = join(root, specRel)
  try {
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, text, { encoding: 'utf8', flag: 'wx' })
    return { written: true }
  } catch (e) {
    if (e?.code === 'EEXIST') return { written: false, reason: '目标已存在,拒绝覆盖' }
    return { written: false, reason: e?.message ?? String(e) }
  }
}

export function parseArgs(argv = []) {
  const out = { mode: 'check', face: 'head', spec: null, module: null, write: false, error: null }
  const modes = new Set()
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--check') modes.add('check')
    else if (arg === '--propose') modes.add('propose')
    else if (arg === '--self-test') modes.add('self-test')
    else if (arg === '--help' || arg === '-h') modes.add('help')
    else if (arg === '--staged') out.face = 'staged'
    else if (arg === '--worktree') {
      out.error = '--worktree 不受支持:判据只取 HEAD blob 或索引 blob,不读滞后工作树'
      return out
    } else if (arg === '--write') out.write = true
    else if (arg === '--emit') {
      const value = argv[i + 1]
      if (!value || value.startsWith('-')) {
        out.error = '--emit 需要显式的 spec 路径(例:apps/web/e2e/foo.spec.ts)'
        return out
      }
      out.spec = value
      modes.add('emit')
      i++
    } else if (arg === '--module') {
      const value = argv[i + 1]
      if (!value || value.startsWith('-')) {
        out.error = '--module 需要显式的模块路径'
        return out
      }
      out.module = value
      i++
    } else if (arg.startsWith('-')) {
      out.error = `未知参数 ${arg}`
      return out
    } else {
      out.error = `多余的参数 ${arg}`
      return out
    }
  }
  if (modes.size > 1) {
    out.error = `模式互斥:${[...modes].join(' / ')}`
    return out
  }
  out.mode = modes.size === 1 ? [...modes][0] : 'check'
  if (out.write && out.mode !== 'emit') {
    out.error = '--write 只与 --emit 同用'
    return out
  }
  if (out.module && out.mode !== 'emit') {
    out.error = '--module 只与 --emit 同用'
    return out
  }
  return out
}

/**
 * 任意 rev 的跟踪文件清单。`listFaceFiles` 只认 head/staged/worktree、不接 rev 参数,
 * 而本器的基线是 HEAD^ —— 所以这里走同一个 `gitRaw` 压一层 ls-tree,不另造 git 派生。
 */
function listRevFiles(rev, paths = FACE_PATHS) {
  const out = gitRaw(['ls-tree', '-r', '--name-only', '-z', rev, '--', ...paths], ROOT, {
    timeout: 120000,
  })
  return String(out).split('\u0000').filter(Boolean)
}

function printHelp() {
  console.log(`
e2e-autofill.mjs — E2E/集成测试缺口自动补测器

用法:
  node scripts/e2e-autofill.mjs [--check] [--staged]          准入判定(默认)
  node scripts/e2e-autofill.mjs --propose [--staged]          缺口清单(JSON,机器可读)
  node scripts/e2e-autofill.mjs --emit <spec> [--module <m>] [--write] [--staged]
                                                             生成骨架;默认 dry-run
  node scripts/e2e-autofill.mjs --self-test                   内置断言
  node scripts/e2e-autofill.mjs --help

面(§0.4 清单与内容同面同轮,取不到即 exit 2):
  无旗/--check  HEAD blob 面,对比 HEAD^(最后一枚提交)
  --staged      索引 blob 面,对比 HEAD(建议的准入门档)

棘轮(§0.2):只拦本轮新增/回潮的缺口;存量缺口只报数。

退出码:0 绿/成功 / 1 有新增缺口 / 2 未判定或拒绝执行
`)
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)
  if (args.error) {
    console.error(`[e2e-autofill] ⏭ 未判定:${args.error} ⇒ 不记绿也不冒红(§0.3)`)
    return 2
  }
  if (args.mode === 'help') {
    printHelp()
    return 0
  }
  if (args.mode === 'self-test') return selfTest()

  let map
  try {
    map = loadMap(ROOT)
  } catch (e) {
    console.error(`[e2e-autofill] ⏭ 未判定:${e?.message ?? e}`)
    return 2
  }

  const faceLabel = args.face === 'staged' ? '索引 blob 面' : 'HEAD blob 面'
  const baseLabel = args.face === 'staged' ? 'HEAD' : 'HEAD^'
  let faceFiles
  let baseFiles
  try {
    faceFiles = listFaceFiles(ROOT, args.face, { paths: FACE_PATHS })
    if (args.face === 'staged') {
      baseFiles = listFaceFiles(ROOT, 'head', { paths: FACE_PATHS })
    } else {
      gitRaw(['rev-parse', '--verify', 'HEAD^'], ROOT)
      baseFiles = listRevFiles('HEAD^')
    }
  } catch (e) {
    console.error(`[e2e-autofill] ⏭ 未判定:${faceLabel}取材失败(${e?.message ?? e})`)
    return 2
  }

  const faceModules = faceFiles.filter((rel) => isAuditedSource(rel, map)).sort()
  const baseModules = baseFiles.filter((rel) => isAuditedSource(rel, map))
  const faceTests = faceFiles.filter((rel) => isTestFile(rel, map))
  const baseTests = baseFiles.filter((rel) => isTestFile(rel, map))

  if (faceFiles.length === 0) {
    console.error(`[e2e-autofill] ⏭ 未判定:${faceLabel}枚举到 0 个文件(不是"没有缺口")`)
    return 2
  }
  if (faceModules.length === 0) {
    console.error(`[e2e-autofill] ⏭ 未判定:${faceLabel}枚举到 0 个受审模块(不是"全绿")`)
    return 2
  }

  const result = diffGaps({ faceModules, baseModules, faceTests, baseTests, map })
  const scope = `${faceLabel}(对比 ${baseLabel}) 受审模块 ${faceModules.length} 枚 / 测试文件 ${indexTests(faceTests, map).length} 份`

  if (args.mode === 'propose') {
    console.log(
      JSON.stringify(
        {
          tool: 'e2e-autofill',
          face: args.face,
          base: baseLabel,
          auditedModules: faceModules.length,
          testFiles: indexTests(faceTests, map).length,
          newGapCount: result.newGaps.length,
          stockGapCount: result.stockGaps.length,
          gaps: result.newGaps.map((g) => ({
            module: g.module,
            kind: g.kind,
            framework: g.framework,
            spec: g.spec,
            caseName: g.caseName,
          })),
        },
        null,
        2,
      ),
    )
    return 0
  }

  if (args.mode === 'emit') {
    const picked = selectEmitTarget({
      specRel: args.spec,
      moduleRel: args.module,
      gaps: result.newGaps,
    })
    if (!picked.ok) {
      console.error(`[e2e-autofill] ⏭ 拒绝执行:${picked.reason}`)
      return 2
    }
    const specRel = safeSpecPath(picked.target.spec, map)
    if (!specRel) {
      console.error(`[e2e-autofill] ⏭ 拒绝执行:建议落点不安全(${picked.target.spec})`)
      return 2
    }
    // 写目标存在性判据(不是判定面):工作树已有同名文件也必须拒绝覆盖。
    if (existsSync(join(ROOT, specRel)) || faceFiles.some((r) => normalizeRel(r) === specRel)) {
      console.error(`[e2e-autofill] ⏭ 拒绝执行:${specRel} 已存在,拒绝覆盖`)
      return 2
    }
    const text = skeletonFor(picked.target)
    if (!args.write) {
      console.log(`${C.dim}[dry-run] 未写盘;加 --write 才落 ${specRel}${C.reset}`)
      console.log(text)
      return 0
    }
    const written = writeSkeleton(ROOT, specRel, text)
    if (!written.written) {
      console.error(`[e2e-autofill] ⏭ 拒绝执行:${written.reason}`)
      return 2
    }
    console.log(`${C.green}✓ 已生成测试骨架 ${specRel}(${picked.target.framework})${C.reset}`)
    return 0
  }

  if (result.newGaps.length > 0) {
    console.log('')
    console.log(
      `${C.red}${C.bold}❌ 测试缺口守门:${scope} —— 新增缺口 ${result.newGaps.length} 枚${C.reset}`,
    )
    console.log(
      `${C.dim}(存量缺口 ${result.stockGaps.length} 枚只报数,不判红 —— §0.2 棘轮只拦新增)${C.reset}`,
    )
    for (const gap of result.newGaps.slice(0, MAX_LISTED)) {
      console.log(`  ${C.red}- ${gap.module}${C.reset}`)
      console.log(`    → ${gap.spec}  [${gap.framework}] ${gap.caseName}`)
    }
    if (result.newGaps.length > MAX_LISTED) {
      console.log(`  … 其余 ${result.newGaps.length - MAX_LISTED} 枚略(--propose 取全量 JSON)`)
    }
    console.log('')
    console.log(`${C.bold}修复:${C.reset}`)
    console.log(
      `  node scripts/e2e-autofill.mjs --propose ${args.face === 'staged' ? '--staged' : ''}`,
    )
    console.log(
      `  node scripts/e2e-autofill.mjs --emit <上面建议的 spec> --write ${args.face === 'staged' ? '--staged' : ''}`,
    )
    console.log('')
    return 1
  }

  console.log(
    `${C.green}✓ 测试缺口守门:${scope} —— 无新增缺口(存量 ${result.stockGaps.length} 枚只报数)${C.reset}`,
  )
  return 0
}

/** 自检:纯构造面,不派生 git、不读工作树判定面。 */
export function selfTest() {
  let fails = 0
  let total = 0
  const check = (name, cond, detail = '') => {
    total++
    if (cond) console.log(`✓ ${name}`)
    else {
      fails++
      console.log(`✗ ${name}${detail ? ` —— ${detail}` : ''}`)
    }
  }

  let map
  try {
    map = loadMap(ROOT)
  } catch (e) {
    console.error(`✗ 映射基线不可读:${e?.message ?? e}`)
    return 1
  }

  try {
    check('S1 源模块面:正常源文件在审', isAuditedSource('apps/web/src/lib/foo.ts', map) === true)
    check(
      'S1 反证:测试文件不进源面',
      isAuditedSource('apps/web/src/lib/foo.test.ts', map) === false,
    )
    check(
      'S1 反证:node_modules 不穿',
      isAuditedSource('apps/web/src/node_modules/x.ts', map) === false,
    )
    check('S1 反证:.next 不穿', isAuditedSource('apps/web/.next/x.ts', map) === false)
    check(
      'S1 反证:barrel index.ts 不审',
      isAuditedSource('apps/api/src/lib/index.ts', map) === false,
    )
    check('S1 反证:.d.ts 不审', isAuditedSource('apps/api/src/db/types.d.ts', map) === false)

    check('S2 playwright spec 认', isTestFile('apps/web/e2e/foo.spec.ts', map) === true)
    check('S2 node-test 认', isTestFile('apps/web/src/__tests__/foo.node-test.mjs', map) === true)
    check('S2 源文件不认', isTestFile('apps/web/src/foo.ts', map) === false)

    check(
      'S3 路由 slug 去组/去文件名',
      routeSlugOf('apps/web/app/(main)/admin/users/page.tsx') === 'admin-users',
      routeSlugOf('apps/web/app/(main)/admin/users/page.tsx'),
    )
    check('S3 根页 slug = home', routeSlugOf('apps/web/app/page.tsx') === 'home')

    check(
      'S4 web 路由落 e2e',
      suggestedSpecOf('apps/web/app/(main)/admin/users/page.tsx', map) ===
        'apps/web/e2e/admin-users.spec.ts',
    )
    check(
      'S4 web 代码落模块旁 __tests__',
      suggestedSpecOf('apps/web/src/lib/foo.ts', map) === 'apps/web/src/lib/__tests__/foo.test.ts',
      suggestedSpecOf('apps/web/src/lib/foo.ts', map),
    )
    check(
      'S4 api 四目录落 src 内 __tests__',
      suggestedSpecOf('apps/api/src/routes/foo.ts', map) ===
        'apps/api/src/routes/__tests__/foo.test.ts',
    )
    check(
      'S4 api 其它目录落 tests(vitest include 认)',
      suggestedSpecOf('apps/api/src/lib/foo.ts', map) === 'apps/api/tests/lib/foo.test.ts',
    )

    const route = 'apps/web/app/(main)/admin/users/page.tsx'
    check(
      'S5 路由被同名 e2e 覆盖',
      testCoversModule(route, 'apps/web/e2e/admin-users.spec.ts', map),
    )
    check(
      'S5 反证:泛化 e2e 不覆盖具体路由',
      testCoversModule(route, 'apps/web/e2e/admin.spec.ts', map) === false,
    )
    check(
      'S5 层不同族:e2e 不覆盖 web 代码模块',
      testCoversModule('apps/web/src/lib/foo.ts', 'apps/web/e2e/foo.spec.ts', map) === false,
    )
    check(
      'S5 camelCase:agentPlanApi ↔ agent-plan-api.test',
      testCoversModule(
        'apps/web/src/lib/agentPlanApi.ts',
        'apps/web/src/lib/__tests__/agent-plan-api.test.ts',
        map,
      ),
    )

    const map2 = {
      ...map,
      mappings: {
        'apps/api/src/routes/foo.ts': ['apps/api/src/routes/__tests__/feature.test.ts'],
      },
    }
    check(
      'S6 显式映射可跨命名覆盖',
      testCoversModule(
        'apps/api/src/routes/foo.ts',
        'apps/api/src/routes/__tests__/feature.test.ts',
        map2,
      ),
    )

    const diff = diffGaps({
      faceModules: ['apps/web/src/a.ts', 'apps/web/src/b.ts', 'apps/web/src/c.ts'],
      baseModules: ['apps/web/src/a.ts', 'apps/web/src/c.ts'],
      faceTests: [],
      baseTests: ['apps/web/src/__tests__/c.test.ts'],
      map,
    })
    check(
      'S7 新模块无测试 ⇒ 新缺口',
      diff.newGaps.some((g) => g.module === 'apps/web/src/b.ts'),
    )
    check(
      'S7 存量同形态 ⇒ 只报数',
      diff.stockGaps.some((g) => g.module === 'apps/web/src/a.ts'),
    )
    check(
      'S7 存量不进新缺口',
      diff.newGaps.every((g) => g.module !== 'apps/web/src/a.ts'),
    )
    check(
      'S7 测试被删(回潮)⇒ 新缺口',
      diff.newGaps.some((g) => g.module === 'apps/web/src/c.ts'),
    )

    const pw = skeletonFor({
      module: 'apps/web/app/(main)/x/page.tsx',
      caseName: 'x 冒烟',
      framework: 'playwright',
    })
    const vi = skeletonFor({
      module: 'apps/api/src/lib/x.ts',
      caseName: 'x 冒烟',
      framework: 'vitest',
    })
    check(
      'S9 playwright 骨架可识别',
      pw.includes("from '@playwright/test'") && pw.includes('test.skip('),
    )
    check('S9 vitest 骨架可识别且不立刻红', vi.includes("from 'vitest'") && vi.includes('it.todo('))

    const args = parseArgs([])
    check('S10 默认 = check/head', args.mode === 'check' && args.face === 'head' && !args.error)
    check('S10 --staged 取索引面', parseArgs(['--check', '--staged']).face === 'staged')
    const emit = parseArgs(['--emit', 'apps/web/e2e/x.spec.ts'])
    check(
      'S10 --emit 取显式 spec',
      emit.mode === 'emit' && emit.spec === 'apps/web/e2e/x.spec.ts' && !emit.write,
    )
    check('S10 --emit 缺值 ⇒ 未判定', Boolean(parseArgs(['--emit']).error))
    check('S10 模式互斥', Boolean(parseArgs(['--check', '--propose']).error))
    check('S10 --worktree 不受支持', Boolean(parseArgs(['--worktree']).error))
    check('S10 --write 必须配 --emit', Boolean(parseArgs(['--write']).error))
    check('S10 未知参数', Boolean(parseArgs(['--nope']).error))

    check(
      'S11 spec 落点拒绝越界',
      safeSpecPath('apps/web/e2e/x.spec.ts', map) === 'apps/web/e2e/x.spec.ts' &&
        safeSpecPath('../x.test.ts', map) === null &&
        safeSpecPath('/abs/x.test.ts', map) === null &&
        safeSpecPath('apps/mobile-rn/x.test.ts', map) === null &&
        safeSpecPath('apps/web/src/x.ts', map) === null,
    )

    const hit = selectEmitTarget({
      specRel: 'apps/web/e2e/x.spec.ts',
      gaps: [{ module: 'apps/web/app/x/page.tsx', spec: 'apps/web/e2e/x.spec.ts' }],
    })
    const miss = selectEmitTarget({ specRel: 'apps/web/e2e/nope.spec.ts', gaps: [] })
    check('S12 唯一命中可取', hit.ok === true)
    check('S12 不在清单 ⇒ 拒绝', miss.ok === false)
  } finally {
    /* 结束时统一打印读数 */
  }

  console.log(
    fails === 0
      ? `${C.green}✓ e2e-autofill self-test:${total} 例全绿${C.reset}`
      : `${C.red}✗ e2e-autofill self-test:${fails}/${total} 例失败${C.reset}`,
  )
  return fails === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`[e2e-autofill] 异常:${e?.stack ?? e}`)
      process.exit(2)
    })
}

export const __test__ = {
  loadMap,
  isAuditedSource,
  isTestFile,
  isE2eSpec,
  isNoisePath,
  appOf,
  recipeFor,
  routeSlugOf,
  stemOf,
  tokensOf,
  moduleKeyOf,
  suggestedSpecOf,
  caseNameOf,
  safeSpecPath,
  indexTests,
  coversWithIndex,
  testCoversModule,
  diffGaps,
  selectEmitTarget,
  skeletonFor,
  writeSkeleton,
  parseArgs,
  main,
  selfTest,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
