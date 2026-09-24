#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 78:workspace 依赖"声明即已链接"对账
 *
 * 成因(2026-09-23 生产停摆实测):apps/extension/package.json 声明了
 * `@ihui/design-tokens: workspace:*`,但 node_modules 里没有对应链接 —— AGENTS.md §12e
 * 记过的那类 `pnpm install --filter <包>` 会把链接剪掉。后果不是"本地报个错",而是
 * **部署环连续失败并反复冷却**:deploy 跑 `pnpm -r build`,wxt 在 rollup 阶段报
 * `Rollup failed to resolve import "@ihui/design-tokens"`,4 次重试全红 → web 不再更新
 * → 线上停在旧提交。而 typecheck/lint/单测全都不会知道(TS 走 tsconfig paths,不看链接)。
 *
 * 判据:逐个工作空间包,取 dependencies/devDependencies/peerDependencies 中所有
 * `workspace:` 声明,要求 `<包目录>/node_modules/<依赖>` 可解析(根 node_modules 命中也算,
 * 兼容 publicHoist)。existsSync 跟随符号链接,**悬空链接同样判红** —— 那正是本次故障形态。
 *
 * 用法:
 *   node scripts/check-workspace-dep-links.mjs            # 全量审计
 *   node scripts/check-workspace-dep-links.mjs --staged   # 仅审计 package.json 被暂存的包
 *   node scripts/check-workspace-dep-links.mjs --self-test
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = dirname(HERE)
const GIT = process.env.GIT_BIN || 'git'

const toPosix = (p) => p.split(sep).join('/')

function git(args) {
  return execFileSync(GIT, ['-c', 'safe.directory=*', '-C', REPO, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
  })
}

/** 解析 pnpm-workspace.yaml 的 packages: 列表(支持 * 与 **,忽略 ! 取反项) */
export function parseWorkspacePatterns(yamlText) {
  return yamlText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2).trim().replace(/^['"]|['"]$/g, ''))
    .filter((p) => p && !p.startsWith('!'))
}

/** 从 rootDir 按 pattern 展开候选包目录(只用 readdirSync,不依赖 pnpm) */
export function expandPatterns(rootDir, patterns) {
  const out = new Set()
  const step = (dir, segs) => {
    if (segs.length === 0) {
      if (existsSync(join(dir, 'package.json'))) out.add(dir)
      return
    }
    const [seg, ...rest] = segs
    if (seg === '**') {
      step(dir, rest)
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) step(join(dir, e.name), segs)
      }
      return
    }
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue
      if (seg === '*' || e.name === seg) step(join(dir, e.name), rest)
    }
  }
  for (const p of patterns) {
    if (p === '.') step(rootDir, [])
    else step(rootDir, p.split('/'))
  }
  return [...out].sort()
}

/** 一个包目录里所有 `workspace:` 协议声明的依赖名 */
export function workspaceDepsOf(pkgJson) {
  const merged = {
    ...(pkgJson.dependencies || {}),
    ...(pkgJson.devDependencies || {}),
    ...(pkgJson.peerDependencies || {}),
  }
  return Object.entries(merged)
    .filter(([, spec]) => typeof spec === 'string' && spec.trim().startsWith('workspace:'))
    .map(([name]) => name)
}

/**
 * 核心判据。rootDir 下没有 node_modules 时返回 null —— 那是"还没装依赖",
 * 不是"装歪了",由调用方显式提示,既不计红也不静默通过。
 */
export function findMissingLinks(rootDir, pkgDirs) {
  if (!existsSync(join(rootDir, 'node_modules'))) return null
  const missing = []
  for (const dir of pkgDirs) {
    let pkgJson
    try {
      pkgJson = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    } catch {
      continue
    }
    for (const dep of workspaceDepsOf(pkgJson)) {
      const parts = dep.split('/')
      const local = join(dir, 'node_modules', ...parts)
      const hoisted = join(rootDir, 'node_modules', ...parts)
      if (existsSync(local) || existsSync(hoisted)) continue
      missing.push({
        pkg: pkgJson.name || toPosix(relative(rootDir, dir)),
        dep,
        expect: toPosix(relative(rootDir, local)),
      })
    }
  }
  return missing
}

/** 返回 { missing, scanned, skipped };判据失效一律 exit(1),不返绿灯 */
export function audit({ staged = false, root = REPO } = {}) {
  const yamlPath = join(root, 'pnpm-workspace.yaml')
  if (!existsSync(yamlPath)) fail('找不到 pnpm-workspace.yaml,判据无法成立')
  const all = expandPatterns(root, parseWorkspacePatterns(readFileSync(yamlPath, 'utf8')))
  if (all.length === 0) fail('一个 workspace 包都没扫到(patterns 解析失效),不允许报绿灯')

  const targets = all
  let scope = '全量'
  if (staged) {
    // 刻意**不**按暂存集收窄。破损常与"本次提交改了什么"无关:手动删了 node_modules 里
    // 一条链接、他机跑过 pnpm install --filter、清理工具动过依赖树 —— 按 staged 收范围
    // 正好放过这一整类(而它的表现就是部署环恒红)。全量扫 25 个包实测约 1s,成本可忽略。
    let files = null
    try {
      files = git(['diff', '--cached', '--name-only']).split('\n').map((l) => l.trim()).filter(Boolean)
    } catch (e) {
      console.warn(`⚠️  git diff --cached 失败(${e?.message}),仍按全量判定 —— 不静默放行`)
    }
    const touched = files
      ? all.filter((d) => new Set(files.map(toPosix)).has(toPosix(relative(root, join(d, 'package.json'))))).length
      : '?'
    scope = `全量(pre-commit 亦不随暂存收窄;暂存触及 ${touched}/${all.length} 个包的 package.json)`
  }

  const missing = findMissingLinks(root, targets)
  if (missing === null) {
    console.log('⚠️  根目录没有 node_modules(依赖未安装)—— 本门无法判定,请先 pnpm install')
    return { missing: [], scanned: targets.length, skipped: true }
  }
  console.log(`workspace 依赖链接对账:${scope} / 判定 ${targets.length} 个包`)
  return { missing, scanned: targets.length, skipped: false }
}

function fail(msg) {
  console.error(`❌ ${msg}`)
  process.exit(1)
}

function hint() {
  console.error(
    [
      '',
      '  💡 这是"装过但被削掉"或"改了 package.json 没重装",不是代码写错。',
      '     修复:跑 **全量** `pnpm install`(不带 --filter)。',
      '     AGENTS.md §12e:`pnpm install --filter <包>` 会剪掉根 node_modules 的链接,',
      '     曾让 lint-staged 消失、109 道守门全废;本仓 workspace 依赖变更一律全量安装。',
      '     为什么本地看不出来:typecheck 走 tsconfig paths,不看 node_modules;',
      '     只有 vite/rollup 真打包时才 `failed to resolve import` —— 也就是部署环。',
      '     单独复验:node scripts/check-workspace-dep-links.mjs',
      '     自检:node scripts/check-workspace-dep-links.mjs --self-test',
      '     紧急跳过(不推荐):HUSKY_SKIP_WORKSPACE_DEP_LINKS=1 git commit ...',
      '',
    ].join('\n'),
  )
}

function run(argv) {
  if (argv.includes('--self-test')) return selfTest()
  const { missing, scanned, skipped } = audit({ staged: argv.includes('--staged') })
  if (skipped) return 0
  if (missing.length === 0) {
    console.log(`✅ ${scanned} 个包声明的 workspace 依赖均已链接`)
    return 0
  }
  console.error(`❌ ${missing.length} 处声明了 workspace 依赖,但 node_modules 里解析不到:`)
  for (const m of missing) console.error(`   ${m.pkg}  缺 ${m.dep}\n      期望 ${m.expect}`)
  hint()
  return 1
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed')
}

/** 自建夹具跑真判据;每一步都断言夹具非空,防"扫了个空"式假绿 */
function selfTest() {
  const root = mkScratch('ihui-dep-link-')
  const cases = []
  const t = (name, fn) => cases.push({ name, fn })
  try {
    mkdirSync(join(root, 'packages', 'aa'), { recursive: true })
    mkdirSync(join(root, 'apps', 'bb'), { recursive: true })
    writeFileSync(join(root, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n  - 'packages/*'\n")
    writeFileSync(join(root, 'packages', 'aa', 'package.json'), JSON.stringify({ name: '@ihui/aa' }))
    writeFileSync(
      join(root, 'apps', 'bb', 'package.json'),
      JSON.stringify({ name: '@ihui/bb', dependencies: { '@ihui/aa': 'workspace:*' } }),
    )

    const pats = parseWorkspacePatterns(readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8'))
    t('patterns 解析出 2 条', () => assert(pats.length === 2, `got ${pats.length}`))
    const dirs = expandPatterns(root, pats)
    t('展开出 2 个包目录(夹具非空)', () => assert(dirs.length === 2, `got ${dirs.length}`))
    t('无 node_modules → null(不是空清单)', () =>
      assert(findMissingLinks(join(root, 'nope'), dirs) === null, 'expected null'),
    )
    t('声明未链接 → 判红并点名包与依赖', () => {
      mkdirSync(join(root, 'node_modules'), { recursive: true })
      const m = findMissingLinks(root, dirs)
      assert(m.length === 1, `expected 1 missing, got ${m.length}`)
      assert(m[0].dep === '@ihui/aa' && m[0].pkg === '@ihui/bb', `got ${JSON.stringify(m[0])}`)
    })
    t('嵌套目录缺失(悬空形态)仍判红', () => {
      mkdirSync(join(root, 'apps', 'bb', 'node_modules', '@ihui'), { recursive: true })
      const m = findMissingLinks(root, dirs)
      assert(m.length === 1, `@ihui 目录存在但 aa 缺失,应判红, got ${m.length}`)
    })
    t('补上链接 → 归零', () => {
      mkdirSync(join(root, 'apps', 'bb', 'node_modules', '@ihui', 'aa'), { recursive: true })
      assert(findMissingLinks(root, dirs).length === 0, 'expected 0')
    })
    t('链接被删 → 再判红(可反复检出)', () => {
      rmSync(join(root, 'apps', 'bb', 'node_modules', '@ihui', 'aa'), { recursive: true, force: true })
      assert(findMissingLinks(root, dirs).length === 1, 'expected 1')
    })
    t('非 workspace 协议声明不参与判定', () => {
      writeFileSync(
        join(root, 'apps', 'bb', 'package.json'),
        JSON.stringify({ name: '@ihui/bb', dependencies: { react: '^19.0.0' } }),
      )
      assert(findMissingLinks(root, dirs).length === 0, `普通依赖不该进本门: ${JSON.stringify(findMissingLinks(root, dirs))}`)
    })
    t('patterns 为空/错 → 判据失效必须红', () => {
      const emptyRoot = mkScratch('ihui-dep-link-empty-')
      try {
        writeFileSync(join(emptyRoot, 'pnpm-workspace.yaml'), "nodeLinker: isolated\n")
        let code = 0
        const orig = process.exit
        process.exit = (c) => {
          code = c
          throw new Error('__exit__')
        }
        try {
          audit({ root: emptyRoot })
        } catch (e) {
          if (e.message !== '__exit__') throw e
        } finally {
          process.exit = orig
        }
        assert(code === 1, `扫不到包时应 exit 1, got ${code}`)
      } finally {
        rmScratch(emptyRoot)
      }
    })

    let failed = 0
    for (const c of cases) {
      try {
        c.fn()
        console.log(`  ✅ ${c.name}`)
      } catch (e) {
        failed++
        console.log(`  ❌ ${c.name} — ${e.message}`)
      }
    }
    console.log(failed === 0 ? `--self-test ${cases.length}/${cases.length} 通过` : `--self-test 失败 ${failed}/${cases.length}`)
    return failed === 0 ? 0 : 1
  } finally {
    rmScratch(root)
  }
}

export const __test__ = { parseWorkspacePatterns, expandPatterns, workspaceDepsOf, findMissingLinks, audit }

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(run(process.argv.slice(2)))
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
