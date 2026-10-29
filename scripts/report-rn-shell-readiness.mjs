#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * report-rn-shell-readiness.mjs — 「RN 壳能否直接在小程序渲染」的就绪尺(只读,不进提交链)。
 *
 * 背景(2026-10-26):小程序端已接上共享屏源(`packages/app`)与 `rn-compat` 平台适配层,
 * 并给了 `@rn-shells` 别名指向 `apps/mobile-rn/src/screens`。若 RN 壳的整条 import 闭包
 * 在 mini 端都能解析,那 280+ 屏就是"零手写复用";若不能,就退化成逐屏重写数据逻辑 ——
 * 这正是本仓最贵的重复劳动。此前**没有任何尺子回答"还差哪些模块"**,只能靠一次构建失败
 * 一个模块地试。
 *
 * 本尺把这件事变成一次枚举:
 *   ① 别名表 **从 apps/miniapp-taro/config/index.ts 现读**(单一真相源,不在本文件硬编码);
 *   ② 从 HEAD 面枚举 `apps/mobile-rn/src/screens` 与 `packages/app/src`,跟随相对 import
 *      求整条闭包(§0.4:全量判 HEAD blob;取不到 ⇒ exit 2「未判定」);
 *   ③ 逐屏判 ready / blocked,并把未覆盖模块按被引用次数排序 —— 每补一个 shim 就解锁一批屏;
 *   ④ 单列 `@/` 语义风险:mini 端 `@` = `apps/miniapp-taro/src`,RN 文件里的 `@/x` 在 mini
 *      会**静默绑到另一个树**,这不是"缺模块",是"绑错模块",必须与缺模块分桶。
 *
 * 判据零复算:本文件不复制 compat 实现,只比对模块名;workspace 包能否解析按
 * miniapp `package.json` 的 dependencies 现读,不靠猜。
 *
 * Usage:
 *   node scripts/report-rn-shell-readiness.mjs              # 人读报告
 *   node scripts/report-rn-shell-readiness.mjs --json      # 机读
 *   node scripts/report-rn-shell-readiness.mjs --top=30    # 列前 N 个缺口模块(默认 20)
 *   node scripts/report-rn-shell-readiness.mjs --worktree  # 人工逃生舱(磁盘面)
 *   node scripts/report-rn-shell-readiness.mjs --self-test
 *
 * 退出码:0 = 取到读数(有没有缺口都算读数);1 = 自检失败;2 = 未判定(取不到被审面)。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, posix, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch } from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const SCREENS_ROOT = 'apps/mobile-rn/src/screens'
const APP_ROOT = 'packages/app/src'
const CONFIG_REL = 'apps/miniapp-taro/config/index.ts'
const MP_PKG = 'apps/miniapp-taro/package.json'

/** 从构建配置里现读别名键(单源)。返回精确键与可前缀匹配的键。 */
export function parseAliases(configText) {
  const exact = new Set()
  const prefix = new Set()
  // 形如: 'react-native$': path.resolve(...) / react: path.resolve(...) / '@ihui/rn-app': path.resolve(...)
  for (const m of String(configText).matchAll(/^\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*:\s*path\.resolve/gm)) {
    const raw = m[1] ?? m[2] ?? m[3]
    if (!raw) continue
    const hasDollar = raw.endsWith('$')
    const name = hasDollar ? raw.slice(0, -1) : raw
    exact.add(name)
    // 无 $ 的别名在 webpack 里按前缀匹配子路径
    if (!hasDollar) prefix.add(name)
  }
  return { exact, prefix }
}

/** 一条 import spec 归到哪个"根模块"。 */
export function moduleRoot(spec) {
  if (spec.startsWith('@')) return spec.split('/').slice(0, 2).join('/')
  return spec.split('/')[0]
}

/** spec 是否被别名覆盖(精确键或前缀键)。 */
export function isAliased(spec, aliases) {
  if (aliases.exact.has(spec)) return true
  for (const p of aliases.prefix) {
    if (spec === p || spec.startsWith(`${p}/`)) return true
  }
  return false
}

const IMPORT_RE = /^\s*(?:import|export)\s+(?!type\b)[\s\S]*?from\s*'([^']+)'/gm
/** 纯函数:抽出运行时 import spec(跳过 `import type`,它在构建时被擦除)。 */
export function importsOf(text) {
  const out = []
  for (const m of String(text).matchAll(IMPORT_RE)) out.push(m[1])
  return out
}

const REL_CANDIDATES = (base) => [base, `${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`]

function listFaceFiles(face) {
  const dirs = [SCREENS_ROOT, APP_ROOT, 'apps/mobile-rn/src']
  const out = new Set()
  if (face === 'worktree') {
    const walk = (rel) => {
      const abs = join(ROOT, rel)
      if (!existsSync(abs)) return
      for (const e of readdirSync(abs)) {
        const childRel = `${rel}/${e}`
        const absChild = join(ROOT, childRel)
        if (statSync(absChild).isDirectory()) walk(childRel)
        else if (/\.(tsx?|jsx?)$/.test(e)) out.add(childRel)
      }
    }
    for (const d of dirs) walk(d)
    return out
  }
  for (const d of dirs) {
    // 用 `HEAD -- <dir>` 形态:输出是仓库相对路径;`HEAD:<dir>` 会给出相对该目录的路径,
    // 让下面的 `startsWith(SCREENS_ROOT + '/')` 恒假(实测屏数 0)。
    const raw = execFileSync('git', ['ls-tree', '-r', '--name-only', face, '--', d], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 32 << 20,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    for (const l of raw.split('\n')) if (l && /\.(tsx?|jsx?)$/.test(l)) out.add(l)
  }
  return out
}

/**
 * 核心:给定已读到的文件内容表,算逐屏就绪与缺口。
 * 纯函数(零 IO),供自检与镜像测试直接喂夹具。
 */
export function judgeReadiness({ files, textOf, aliases, mpDeps }) {
  const fileSet = new Set(files)
  const followRoots = [SCREENS_ROOT + '/', APP_ROOT + '/', 'apps/mobile-rn/src/']
  const resolveRel = (from, spec) => {
    const base = posix.normalize(posix.join(posix.dirname(from), spec))
    for (const c of REL_CANDIDATES(base)) if (fileSet.has(c)) return c
    return null
  }
  const ALLOWED = new Set(['react', 'react/jsx-runtime', '@tarojs/components', '@tarojs/taro', '@tarojs/runtime'])
  const screenFiles = files.filter((f) => f.startsWith(`${SCREENS_ROOT}/`) && f.endsWith('.tsx'))

  const blockedByModule = new Map()
  const blockedSites = new Map()
  const atAliasHits = new Map()
  const unresolved = []
  const perScreen = []
  const allScreens = screenFiles.length
  // 非代码资源(png/json/css 等)由打包器处理,不参与"模块是否可解析"的判断;
  // 把它们算成未解析会把读数稀释成噪声(实测 82 处里大头是 logo.png 与 package.json)。
  const NON_CODE_RE = /\.(png|jpe?g|gif|webp|svg|json|css|scss|less|ttf|otf|woff2?|mp4|mp3|wav)$/i

  for (const screen of screenFiles) {
    const seen = new Set()
    const mods = new Set()
    const stack = [screen]
    let hazard = false
    while (stack.length) {
      const f = stack.pop()
      if (seen.has(f)) continue
      seen.add(f)
      const text = textOf(f)
      if (text === null || text === undefined) continue
      for (const spec of importsOf(text)) {
        if (spec.startsWith('.')) {
          if (NON_CODE_RE.test(spec)) continue
          const r = resolveRel(f, spec)
          if (!r) unresolved.push([f, spec])
          else if (followRoots.some((p) => r.startsWith(p))) stack.push(r)
          continue
        }
        // `@/` 必须排在别名判定之前:mini 端 `@` 确实有别名(指 apps/miniapp-taro/src),
        // 若先走 isAliased 就被"可解析"吞掉 —— 那是绑错树,不是缺模块。
        if (spec.startsWith('@/')) {
          hazard = true
          const k = moduleRoot(spec)
          atAliasHits.set(k, (atAliasHits.get(k) ?? 0) + 1)
          continue
        }
        if (isAliased(spec, aliases)) continue
        if (ALLOWED.has(moduleRoot(spec))) continue
        const root = moduleRoot(spec)
        if (root.startsWith('@ihui/') && mpDeps.has(root)) continue
        mods.add(root)
        if (!blockedSites.has(root)) blockedSites.set(root, new Map())
        const sites = blockedSites.get(root)
        sites.set(f, (sites.get(f) ?? 0) + 1)
      }
    }
    for (const m of mods) blockedByModule.set(m, (blockedByModule.get(m) ?? 0) + 1)
    perScreen.push({
      screen,
      ready: mods.size === 0 && !hazard,
      blocked: [...mods].sort(),
      hazard,
      closure: seen.size,
    })
  }

  const ready = perScreen.filter((s) => s.ready).length
  const hazardCount = perScreen.filter((s) => s.hazard).length
  return {
    face: null,
    total: allScreens,
    ready,
    readyRatio: allScreens > 0 ? Number((ready / allScreens).toFixed(4)) : null,
    hazardScreens: hazardCount,
    atAliasHits: [...atAliasHits.entries()].sort((a, b) => b[1] - a[1]),
    blockedModules: [...blockedByModule.entries()]
      .map(([module, screens]) => {
        const sites = blockedSites.get(module) ?? new Map()
        return {
          module,
          screens,
          siteCount: sites.size,
          // 补一个 shim 前先看"谁引的":核心 util 一处命中会带出几百屏,
          // 与"某屏专用一处"是两种完全不同的工作量。
          topSites: [...sites.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([file, hits]) => ({ file, hits })),
        }
      })
      .sort((a, b) => b.screens - a.screens),
    unresolved: unresolved.slice(0, 50),
    unresolvedCount: unresolved.length,
    screens: perScreen,
  }
}

function readFace(face) {
  const files = [...listFaceFiles(face)]
  if (face === 'worktree') {
    const textOf = (f) => {
      try {
        return readFileSync(join(ROOT, f), 'utf8')
      } catch {
        return null
      }
    }
    return { files, textOf }
  }
  const specs = files.map((f) => `${face}:${f}`)
  const got = catBatch(ROOT, specs)
  const textOf = (f) => got.get(`${face}:${f}`) ?? null
  return { files, textOf }
}

function readAliases(face) {
  const raw =
    face === 'worktree'
      ? readFileSync(join(ROOT, CONFIG_REL), 'utf8')
      : execFileSync('git', ['show', `${face}:${CONFIG_REL}`], {
          cwd: ROOT,
          encoding: 'utf8',
          maxBuffer: 8 << 20,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
  return parseAliases(raw)
}

function readMpDeps(face) {
  const raw =
    face === 'worktree'
      ? readFileSync(join(ROOT, MP_PKG), 'utf8')
      : execFileSync('git', ['show', `${face}:${MP_PKG}`], {
          cwd: ROOT,
          encoding: 'utf8',
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
  return new Set(Object.keys(JSON.parse(raw).dependencies ?? {}))
}

function selfTest() {
  const cfg = `alias: {\n  'react-native$': path.resolve(x),\n  '@ihui/rn-app': path.resolve(y),\n  react: path.resolve(z),\n}`
  const a = parseAliases(cfg)
  const cases = [
    ['react-native 精确命中', isAliased('react-native', a) === true],
    ['@ihui/rn-app 子路径按前缀命中', isAliased('@ihui/rn-app/features/about/AboutScreen', a) === true],
    ['expo-audio 未命中', isAliased('expo-audio', a) === false],
    ['moduleRoot scoped', moduleRoot('@ihui/shared/x') === '@ihui/shared'],
    ['import type 不算运行时依赖', importsOf("import type { A } from 'expo-audio'").length === 0],
    ['运行时 import 算', importsOf("import { play } from 'expo-audio'").length === 1],
  ]
  const files = ['apps/mobile-rn/src/screens/A.tsx', 'apps/mobile-rn/src/screens/B.tsx', 'apps/mobile-rn/src/x.ts']
  const texts = {
    'apps/mobile-rn/src/screens/A.tsx': "import { View } from 'react-native'\nimport { X } from './x'",
    'apps/mobile-rn/src/screens/B.tsx': "import { Audio } from 'expo-audio'",
    'apps/mobile-rn/src/x.ts': "export const X = 1",
  }
  const r = judgeReadiness({
    files,
    textOf: (f) => texts[f] ?? null,
    aliases: a,
    mpDeps: new Set(),
  })
  cases.push(['A 就绪(react-native 已别名 + 相对闭包)', r.screens.find((s) => s.screen.endsWith('A.tsx'))?.ready === true])
  cases.push(['B 缺 expo-audio', r.screens.find((s) => s.screen.endsWith('B.tsx'))?.blocked.includes('expo-audio') === true])
  cases.push(['缺口按屏计数', r.blockedModules.find((x) => x.module === 'expo-audio')?.screens === 1])
  const pass = cases.filter(([, ok]) => ok).length
  for (const [n, ok] of cases) console.log(`  ${ok ? '✓' : '✗'} ${n}`)
  return { pass, total: cases.length }
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    const r = selfTest()
    console.log(`[self-test] ${r.pass}/${r.total}`)
    process.exit(r.pass === r.total ? 0 : 1)
  }
  const face = argv.includes('--worktree') ? 'worktree' : 'head'
  const json = argv.includes('--json')
  const topArg = argv.find((a) => a.startsWith('--top='))
  const top = topArg ? Number.parseInt(topArg.split('=')[1], 10) : 20
  if (!existsSync(join(ROOT, '.git'))) {
    console.error('❌ 未判定:仓库根不可达')
    process.exit(2)
  }
  let result
  try {
    const { files, textOf } = readFace(face)
    result = judgeReadiness({
      files,
      textOf,
      aliases: readAliases(face),
      mpDeps: readMpDeps(face),
    })
    result.face = face
  } catch (e) {
    console.error(`❌ 未判定:取不到被审面(${String(e?.message ?? e).slice(0, 160)})`)
    process.exit(2)
  }
  if (json) {
    console.log(JSON.stringify({ ...result, screens: result.screens.map((s) => ({ ...s })) }, null, 1))
  } else {
    console.log(`RN 壳复用就绪尺 · 面=${result.face}`)
    console.log(`  屏 ${result.total} · 就绪 ${result.ready}(${(result.readyRatio ?? 0) * 100}%) · 含 @/ 语义风险 ${result.hazardScreens}`)
    console.log(`  未覆盖模块 ${result.blockedModules.length} 个,按解锁屏数排:`)
    for (const b of result.blockedModules.slice(0, top))
      console.log(`    ${String(b.screens).padStart(4)} 屏  ${b.module}`)
    if (result.atAliasHits.length)
      console.log(`  ⚠ @/ 绑定风险(会静默指向小程序树):${result.atAliasHits.map(([k, n]) => `${k}(${n})`).join(' / ')}`)
    if (result.unresolvedCount) console.log(`  ⚠ 相对导入解析不到 ${result.unresolvedCount} 处(见 --json)`)
    console.log(`  逐屏明细:--json`)
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}`)
    process.exit(2)
  })
}

export const __test__ = { parseAliases, moduleRoot, isAliased, importsOf, judgeReadiness, selfTest }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
