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
 * 判据一(声明↔链接):逐个工作空间包,取 dependencies/devDependencies/peerDependencies 中所有
 * `workspace:` 声明,要求 `<包目录>/node_modules/<依赖>` 可解析(根 node_modules 命中也算,
 * 兼容 publicHoist)。existsSync 跟随符号链接,**悬空链接同样判红** —— 那正是本次故障形态。
 *
 * 判据二(链接↔内容,2026-09-24 补):根 + 各包的 `node_modules/<dep>` **符号链接**目标必须是
 * 一个真包(有可 parse 的 package.json)。因为 existsSync 对"指向**空目录**的链接"仍返回 true,
 * 而 2026-09-24 的全机门禁停摆正是这一型:`node_modules/typescript`、`node_modules/eslint`
 * 指向 `.pnpm` 里的空目录,`.bin` 只剩 16 项(无 eslint/tsc/vitest/next)⇒ lint-staged 第一步
 * `✖ eslint --fix` 并阻止提交 ⇒ **每次提交都被迫 --no-verify,约 110 道守门对全队同时失效**,
 * 而 git status / typecheck / 其余守门报告全都看不出来。
 *
 * 用法:
 *   node scripts/check-workspace-dep-links.mjs            # 全量审计
 *   node scripts/check-workspace-dep-links.mjs --staged   # 仅审计 package.json 被暂存的包
 *   node scripts/check-workspace-dep-links.mjs --self-test
 *   node scripts/check-workspace-dep-links.mjs --root=<dir>  # 指定仓库根(自测夹具必须显式注入)
 */
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  readdirSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, relative, sep } from 'node:path'
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
    .map((l) =>
      l
        .slice(2)
        .trim()
        .replace(/^['"]|['"]$/g, ''),
    )
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

/**
 * 第二维判据(2026-09-24 全机门禁停摆后补):**"链接在、内容被掏空"**。
 *
 * 为什么既有判据看不见:pnpm 的 `node_modules/<dep>` 是指向 `.pnpm/<pkg>/node_modules/<dep>`
 * 的符号链接,而 `existsSync` 跟随符号链接 —— 只要目标目录**存在**(哪怕是空的)就返回 true。
 * 实测本机 `node_modules/typescript`、`node_modules/eslint` 目标目录条目数 = 0,
 * `node_modules/.bin` 里 eslint/tsc/tsserver/vitest/next 全缺 ⇒ lint-staged 第一步就
 * `✖ eslint --fix` + 「'eslint' 不是内部或外部命令」并阻止提交 ⇒ **每一次提交都只能
 * --no-verify,约 110 道守门对全队同时失效**,而 git status / typecheck 结论 / 守门报告
 * 里没有任何一处能看出这件事。
 *
 * 判据(宁漏不误报):只统计**符号链接**(真目录是 file:/workspace: 直连形态,不参与),
 * 要求目标里有**可 parse 的 package.json**。刻意**不**比 name —— pnpm 的别名安装
 * (`foo@npm:bar`)会在链接名下指向另一个 name 的包,比 name 必产假阳。
 * 两类红点如实分列:`悬空`(目标不存在)/ `掏空`(目标在但无有效清单)。
 */
export function findGuttedLinks(rootDir, pkgDirs) {
  const nmDirs = [join(rootDir, 'node_modules'), ...pkgDirs.map((d) => join(d, 'node_modules'))]
  const gutted = []
  const missingBins = []
  let scanned = 0
  const check = (abs, rel, owner, nmDir, name) => {
    scanned += 1
    if (!existsSync(abs)) {
      gutted.push({ kind: '悬空', link: rel, owner })
      return
    }
    let manifest
    try {
      manifest = JSON.parse(readFileSync(join(abs, 'package.json'), 'utf8'))
    } catch {
      gutted.push({ kind: '掏空', link: rel, owner })
      return
    }
    if (typeof manifest.name !== 'string' || !manifest.name) {
      gutted.push({ kind: '掏空', link: rel, owner })
      return
    }
    /**
     * 第三型(2026-09-24 同一场事故的第二个半边,当前**只报数不判红**):包内容完好,
     * 但 `.bin` 里的可执行入口没了 ⇒ 直接跑 `node_modules/eslint/bin/eslint.js --version`
     * 出 v10.8.1,而 lint-staged / `pnpm run typecheck` 通过 PATH 找 `eslint`/`tsc` 仍然
     * 「不是内部或外部命令」。pnpm 在 "Already up to date" 短路时**不会**重建 bin 链接,
     * 所以这一型只有主动对账才看得见。
     *
     * 为什么暂不判红:"每条直接依赖的每个 bin 都必须在 `.bin` 里有 shim" 是不是 pnpm 在本仓
     * 的真实不变量,尚未证明(实测根 + 各包共 119 条缺 shim,其中 apps/api/packages/shared 等
     * 连 `.bin` 目录都不存在)。拿未证明的基线做 blocking = 造一台恒红机 = 各会话合法
     * `--no-verify` 关掉其余全部守门(本仓优先级最高的反面教训)。基线由
     * `pnpm install --force` 重链后的复测确定,证据写在 PROJECT_PLAN 对应票里。
     */
    const bins = manifest.bin
    const names =
      typeof bins === 'string'
        ? [basename(abs)]
        : Array.isArray(bins)
          ? bins.map((b) => (b && typeof b === 'object' && b.name) || '')
          : bins
            ? Object.keys(bins)
            : []
    for (const b of names) {
      if (!b) continue
      // pnpm 只为**该 owner 直接声明的依赖**建 .bin shim;根里 hoist 上来的传递依赖
      // (实测 expo / react-native 就不在根 package.json 里)按定义不该有 shim ——
      // 把它们算进红点就是一台"看起来在报破损、实际在报 pnpm 语义"的假阳机。
      if (!declaredFor(owner).has(name)) continue
      const shim = join(nmDir, '.bin', process.platform === 'win32' ? `${b}.CMD` : b)
      if (!existsSync(shim)) missingBins.push({ link: rel, bin: b, owner })
    }
  }
  const declaredCache = new Map()
  const declaredFor = (owner) => {
    if (declaredCache.has(owner)) return declaredCache.get(owner)
    let set = new Set()
    try {
      const j = JSON.parse(readFileSync(join(rootDir, owner, 'package.json'), 'utf8'))
      set = new Set([
        ...Object.keys(j.dependencies || {}),
        ...Object.keys(j.devDependencies || {}),
        ...Object.keys(j.optionalDependencies || {}),
      ])
    } catch {
      /* owner 没有 package.json(异常形态)⇒ 视为无直接依赖,不据此判红 */
    }
    declaredCache.set(owner, set)
    return set
  }
  const scan = (nm, owner) => {
    let ents
    try {
      ents = readdirSync(nm, { withFileTypes: true })
    } catch {
      return // 该包没有 node_modules(纯配置包等),不是破损
    }
    for (const e of ents) {
      if (e.name.startsWith('.')) continue // .bin / .pnpm / .modules.yaml 不是"被解析的依赖"
      const abs = join(nm, e.name)
      if (e.isSymbolicLink()) {
        check(abs, toPosix(relative(rootDir, abs)), owner, nm, e.name)
      } else if (e.isDirectory() && e.name.startsWith('@')) {
        let sub
        try {
          sub = readdirSync(abs, { withFileTypes: true })
        } catch {
          continue
        }
        for (const s of sub) {
          if (!s.isSymbolicLink()) continue
          check(join(abs, s.name), toPosix(relative(rootDir, join(abs, s.name))), owner, nm, `${e.name}/${s.name}`)
        }
      }
    }
  }
  for (const nm of nmDirs) scan(nm, toPosix(relative(rootDir, dirname(nm))) || '.')
  return { gutted, missingBins, scanned }
}

/**
 * 第四维(2026-09-24 立,**判红**):pre-commit 第一步要 spawn 的命令必须解析得到。
 *
 * 为什么单独拿 lint-staged 的命令集做判据(而不是"所有直接依赖的 bin 都要有 shim"):
 * 后者是不是 pnpm 在本仓的真实不变量**尚未证明**(实测 119 条缺 shim,含 apps/api、
 * packages/shared 等连 `.bin` 目录都没有的包),拿未证明的基线做 blocking 等于造恒红机。
 * 而 lint-staged 配置里的命令是**每一次提交必然 spawn** 的 —— 解析不到就是今天这种结局:
 * `✖ eslint --fix` → 「'eslint' 不是内部或外部命令」→ 提交被阻止 → 各会话 --no-verify →
 * 其余约 110 道守门同时对全队失效。这一条不需要任何基线假设。
 *
 * 命令名解析:取命令串首 token;`node`/`pnpm`/`npx`/内建 shell 关键字不参与(它们由 PATH 承载)。
 * 解析面(任一命中即通过):`<root>/node_modules/.bin/<cmd>`(POSIX)或 `<cmd>.CMD`(Windows)、
 * 或全局 PATH(`where`/`which` 命中)。**刻意不把"`node_modules/<cmd>` 包目录在"当作通过** ——
 * 今天这场事故恰恰是"包内容完好、shim 没了":`node_modules/eslint/bin/eslint.js --version`
 * 跑得出 v10.8.1,而 lint-staged 按 PATH 找 `eslint` 仍然报「不是内部或外部命令」。
 */
const NON_SHIMMED_COMMANDS = new Set([
  'node',
  'pnpm',
  'npx',
  'sh',
  'bash',
  'cmd',
  'pwsh',
  'powershell',
  'echo',
  'true',
])

export function lintStagedCommands(pkgJson) {
  const cfg = pkgJson && pkgJson['lint-staged']
  const out = []
  const walk = (v) => {
    if (typeof v === 'string') out.push(v)
    else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') for (const x of Object.values(v)) walk(x)
  }
  walk(cfg)
  return out
    .map((cmd) => String(cmd).trim().split(/\s+/)[0])
    .filter((tok) => tok && !NON_SHIMMED_COMMANDS.has(tok) && !tok.startsWith('-'))
}

export function findUnresolvableHookCommands(rootDir, cmds) {
  const bad = []
  for (const cmd of new Set(cmds || [])) {
    const winShim = join(rootDir, 'node_modules', '.bin', `${cmd}.CMD`)
    const posixShim = join(rootDir, 'node_modules', '.bin', cmd)
    if (existsSync(winShim) || existsSync(posixShim)) continue
    // 刻意**不**去问全局 PATH:pre-commit 是在钩子进程环境里跑的,那里的 PATH 与本会话不同。
    // 实测本机全局确实装了 eslint(本会话 `where eslint` 命中),而 10:31 的 hook 日志仍然
    // 「'eslint' 不是内部或外部命令」⇒ 拿全局命中当"能解析"会造出一台在故障现场报绿的假尺子。
    bad.push({ cmd })
  }
  return bad
}

/** 返回 { missing, scanned };判据失效一律 exit(1),不返绿灯 */
export function audit({ staged = false, root = REPO, strict = false } = {}) {
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
      files = git(['diff', '--cached', '--name-only'])
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    } catch (e) {
      console.warn(`⚠️  git diff --cached 失败(${e?.message}),仍按全量判定 —— 不静默放行`)
    }
    const touched = files
      ? all.filter((d) =>
          new Set(files.map(toPosix)).has(toPosix(relative(root, join(d, 'package.json')))),
        ).length
      : '?'
    scope = `全量(pre-commit 亦不随暂存收窄;暂存触及 ${touched}/${all.length} 个包的 package.json)`
  }

  const missing = findMissingLinks(root, targets)
  if (missing === null) {
    console.log('⚠️  根目录没有 node_modules(依赖未安装)—— 本门无法判定,请先 pnpm install')
    return { missing: [], scanned: targets.length, skipped: true }
  }
  const t0 = Date.now()
  const { gutted, missingBins = [], scanned: linksScanned } = findGuttedLinks(root, targets)
  // 第四维(判红):pre-commit 第一步必然 spawn 的命令能不能解析到
  let hookCmds = []
  try {
    hookCmds = lintStagedCommands(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')))
  } catch {
    hookCmds = []
  }
  const hookBad = hookCmds.length === 0 ? [] : findUnresolvableHookCommands(root, hookCmds)
  console.log(
    `workspace 依赖链接对账:${scope} / 判定 ${targets.length} 个包` +
      ` | 链接完整性:扫 ${linksScanned} 条,破损 ${gutted.length} 条,钩子命令 ${hookCmds.length} 条(解析不到 ${hookBad.length} 条)` +
      `(${Date.now() - t0}ms)`,
  )
  if (missingBins.length) {
    // 2026-09-24 取证后的定档:提交链里**只报数**,`--strict`(check:all / CI)才判红。
    // 取证过程(值得留):我一度以为"102 条缺 shim"是未证明的基线、不敢拦人;
    // 直到一轮**完整跑完**的 install 之后复测 = **0 条**,且 25 个包的 `.bin` 全部存在
    // (apps/api 45 项 / web 33 / extension 24 / shared 15 …) —— 说明那 102 条不是"本来就该没有",
    // 而是同一场削损的一部分。但它在并发 install 期间会闪成上百条(实测 0↔113 跳),
    // 而 pre-commit 每天都跑 ⇒ 拿它做 blocking 会在别人装依赖的窗口里把全队逼进 --no-verify
    // (本仓最高反面教训:恒红门=全队关闸)。所以判红放到不在提交链上的严格入口。
    const byOwner = {}
    for (const m of missingBins) byOwner[m.owner] = (byOwner[m.owner] || 0) + 1
    const summary =
      Object.entries(byOwner)
        .slice(0, 6)
        .map(([o, n]) => `${o || '.'}=${n}`)
        .join(' ') + (Object.keys(byOwner).length > 6 ? ` …等 ${Object.keys(byOwner).length} 处` : '')
    if (strict) {
      console.error(
        `❌ ${missingBins.length} 条直接依赖声明了 bin 而该处 .bin 无同名 shim(严格模式判红;提交链默认只报数,` +
          `因并发 install 期间会闪红):${summary}`,
      )
      for (const m of missingBins.slice(0, 20)) console.error(`   [缺可执行入口] ${m.link}  bin: ${m.bin}  ← ${m.owner}`)
      if (missingBins.length > 20) console.error(`   … 另有 ${missingBins.length - 20} 条`)
      console.error('   修复:node scripts/repair-node-bin-links.mjs(根)或全量 pnpm install(包级)。')
    } else {
      console.log(`   ℹ️ 另有 ${missingBins.length} 条"声明了 bin 但该处无 shim"(提交链只报数;--strict 判红):${summary}`)
    }
  }
  return {
    missing,
    scanned: targets.length,
    gutted,
    missingBins,
    hookBad,
    linksScanned,
    skipped: false,
  }
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
      '     2026-09-24 新增的第二型(比"声明未链接"更隐蔽):链接**在**、目标目录却被**掏空**',
      '     (.pnpm/<pkg>/node_modules/<dep> 变成空目录)—— existsSync 仍返回 true,所以旧判据',
      '     恒绿,而 eslint/tsc 已从 node_modules/.bin 消失 ⇒ lint-staged 失败、每次提交被迫',
      '     --no-verify、约 110 道守门对全队同时失效。修复同样是全量 `pnpm install`,',
      '     恢复判据必须实测:`node_modules/.bin/eslint --version` 与 `tsc --version` 都出版本号。',
      '     ⚠️ 只补内容不够:bin shim 要 **`pnpm install --frozen-lockfile --force`** 才会重建',
      '     (实测 2026-09-24 11:22:56,.CMD shim 正是这一条命令写回来的;普通 `pnpm install`',
      '     与不带 --force 的重跑都只回 "Already up to date",shim 一个都不补)。',
      '     本门对"命令解析不到"判红,对"某包声明 bin 但该处无 shim"只报数(后者不等于坏:',
      '     apps/api 无自身 .bin 而 typecheck 仍经根 .bin 通过 —— 拿未证明的基线拦人=恒红机)。',
      '     单独复验:node scripts/check-workspace-dep-links.mjs',
      '     自检:node scripts/check-workspace-dep-links.mjs --self-test',
      '     紧急跳过(不推荐):HUSKY_SKIP_WORKSPACE_DEP_LINKS=1 git commit ...',
      '',
    ].join('\n'),
  )
}

function run(argv) {
  if (argv.includes('--self-test')) return selfTest()
  // --root 供自测夹具显式注入(教训:自测只改 cwd 会静默扫真仓,产出"看起来全绿"的空转结果)
  const rootArg = argv.find((a) => a.startsWith('--root='))
  const root = rootArg ? rootArg.slice('--root='.length) : REPO
  // --strict:把"声明了 bin 但该处无 shim"也计入退出码(给 check:all / CI 用)。
  // 提交链默认不加 —— 并发 install 期间这条会闪出上百项(实测 0↔113),
  // 而在提交链上拦人 = 各会话 --no-verify = 其余约 110 道守门同时被跳过。
  const strict = argv.includes('--strict')
  const { missing, scanned, gutted = [], missingBins = [], hookBad = [], linksScanned = 0, skipped } = audit({
    staged: argv.includes('--staged'),
    root,
    strict,
  })
  const redBins = strict ? missingBins.length : 0
  if (skipped) return 0
  // 反假绿:一条链接都没扫到 = 判据没跑到东西,绝不记绿(与"扫不到包必须红"同族)
  if (linksScanned === 0) {
    console.error('❌ 扫到 0 条 node_modules 链接 —— 判据无从成立,不允许报绿(先确认依赖已安装)')
    return 1
  }
  if (missing.length === 0 && gutted.length === 0 && redBins === 0 && hookBad.length === 0) {
    console.log(
      `✅ ${scanned} 个包声明的 workspace 依赖均已链接,${linksScanned} 条链接目标内容完好,钩子命令全部可解析` +
        (strict
          ? `,直接依赖声明的 bin 均有 shim`
          : `(shim 完整性现测 ${missingBins.length} 条缺失,只报数;要判红加 --strict)`),
    )
    return 0
  }
  if (missing.length) {
    console.error(`❌ ${missing.length} 处声明了 workspace 依赖,但 node_modules 里解析不到:`)
    for (const m of missing) console.error(`   ${m.pkg}  缺 ${m.dep}\n      期望 ${m.expect}`)
  }
  if (gutted.length) {
    const byKind = {}
    for (const x of gutted) byKind[x.kind] = (byKind[x.kind] || 0) + 1
    console.error(
      `❌ ${gutted.length} 条链接目标内容不成立(${Object.entries(byKind)
        .map(([k, v]) => `${k} ${v}`)
        .join(' / ')})—— existsSync 对"指向空目录的链接"仍返回 true,所以这一类旧判据看不见:`,
    )
    for (const x of gutted.slice(0, 25)) console.error(`   [${x.kind}] ${x.link}  ← ${x.owner}`)
    if (gutted.length > 25) console.error(`   … 另有 ${gutted.length - 25} 条`)
    console.error(
      '   ⚠️ 若此刻有并发 `pnpm install` 在跑,这类红会在装完后自行消失(半复制态)。',
    )
    console.error('      正确反应是**等一等再复跑本门**,不是 --no-verify(那会连带跳过其余全部守门)。')
  }
  if (hookBad.length) {
    console.error(`❌ ${hookBad.length} 条 pre-commit 第一步必然 spawn 的 lint-staged 命令解析不到(根 node_modules/.bin 里没有 shim):`)
    for (const x of hookBad) console.error(`   [命令不可解析] ${x.cmd}  ⇒ lint-staged 报「'${x.cmd}' 不是内部或外部命令」`)
    console.error('   ⇒ 每一次提交都被迫 --no-verify ⇒ 其余全部守门同时对全队失效。')
  }
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
    writeFileSync(
      join(root, 'packages', 'aa', 'package.json'),
      JSON.stringify({ name: '@ihui/aa' }),
    )
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
      rmSync(join(root, 'apps', 'bb', 'node_modules', '@ihui', 'aa'), {
        recursive: true,
        force: true,
      })
      assert(findMissingLinks(root, dirs).length === 1, 'expected 1')
    })
    t('夹具内先造一条完好链接(供链接完整性判据取正反对照)', () => {
      mkdirSync(join(root, 'apps', 'bb', 'node_modules', '@ihui'), { recursive: true })
      mkdirSync(join(root, 'apps', 'bb', 'node_modules', '@ihui', 'aa'), { recursive: true })
      writeFileSync(
        join(root, 'apps', 'bb', 'node_modules', '@ihui', 'aa', 'package.json'),
        JSON.stringify({ name: '@ihui/aa' }),
      )
      assert(findMissingLinks(root, dirs).length === 0, '夹具链接未生效')
    })
    /**
     * 2026-09-24 新维度:**"链接在、目标被掏空"** 必须判红。
     * 夹具刻意用符号链接(与 pnpm 布局同形态),并同时钉住"existsSync 对空目标返回 true"
     * 这一尺子前提 —— 否则这条用例会随平台语义变化静默失效。
     */
    t('掏空/悬空链接必须判红,且 existsSync 对掏空仍为 true(旧判据为何失明)', () => {
      const store = join(root, '.pnpm-fixture')
      mkdirSync(join(store, 'typescript@5.9.0', 'node_modules', 'typescript'), { recursive: true })
      writeFileSync(
        join(store, 'typescript@5.9.0', 'node_modules', 'typescript', 'package.json'),
        JSON.stringify({ name: 'typescript', version: '5.9.0' }),
      )
      mkdirSync(join(store, 'eslint@10.8.1', 'node_modules', 'eslint'), { recursive: true }) // 空目录 = 被掏空
      const nm = join(root, 'node_modules')
      mkdirSync(join(nm, '@scope'), { recursive: true })
      const link = (target, name) => {
        const abs = join(nm, name)
        try {
          rmSync(abs, { recursive: true, force: true })
        } catch {
          /* 首次不存在 */
        }
        try {
          symlinkSync(target, abs, 'dir')
          return true
        } catch {
          return false // Windows 无符号链接权限 ⇒ 由下一条用例显式报告
        }
      }
      const okA = link(join(store, 'typescript@5.9.0', 'node_modules', 'typescript'), 'typescript')
      const okB = link(join(store, 'eslint@10.8.1', 'node_modules', 'eslint'), 'eslint')
      const okC = link(join(store, 'nope@1.0.0', 'node_modules', 'nope'), 'dangling-pkg')
      const okD = link(join(store, 'typescript@5.9.0', 'node_modules', 'typescript'), '@scope/real')
      const okE = link(join(store, 'eslint@10.8.1', 'node_modules', 'eslint'), '@scope/aliased')
      assert(okA && okB && okC && okD && okE, '本机无法创建符号链接,链接完整性判据未被真正验证')
      const emptyTarget = join(nm, 'eslint')
      assert(
        existsSync(emptyTarget),
        '前提不成立:existsSync 对掏空目标应返回 true(这正是旧判据失明的原因)',
      )
      const { gutted, scanned } = findGuttedLinks(root, dirs)
      assert(scanned === 5, `夹具应扫到 5 条链接(真目录不参与,只数符号链接), got ${scanned}`)
      const names = gutted.map((x) => x.link).sort()
      assert(
        JSON.stringify(names) ===
          JSON.stringify([
            'node_modules/@scope/aliased',
            'node_modules/dangling-pkg',
            'node_modules/eslint',
          ]),
        `掏空/悬空清单不对: ${names.join(',')}`,
      )
      assert(
        gutted.find((x) => x.link === 'node_modules/eslint').kind === '掏空' &&
          gutted.find((x) => x.link === 'node_modules/dangling-pkg').kind === '悬空',
        '两类红点必须分列(掏空=目标在但无有效清单;悬空=目标不存在)',
      )
      const t = gutted.find((x) => x.link === 'node_modules/@scope/aliased')
      assert(t && t.owner === '.', `scoped 包归属应记为仓库根('.'), got ${t && t.owner}`)
      assert(
        !names.includes('node_modules/typescript') && !names.includes('node_modules/@scope/real'),
        '完好链接不得判红',
      )
    })
    /**
     * 第三型(仅报数)与第四型(判红)都得有双向证明。第四型是 2026-09-24 那场停摆的
     * **直接指纹**:内容完好但 `.bin` 里没有 shim ⇒ lint-staged 第一步就炸,
     * 而"包目录存在"这种判断会当场报绿(尺子必须在故障现场报红)。
     */
    t('第三型"声明 bin 但无 shim"只进 missingBins 不计红,补 shim 后归零;hoist 传递依赖不得算', () => {
      const nm = join(root, 'node_modules')
      const store = join(root, '.pnpm-fixture2')
      const mkPkg = (name, bin) => {
        mkdirSync(join(store, `${name}@1.0.0`, 'node_modules', name), { recursive: true })
        writeFileSync(
          join(store, `${name}@1.0.0`, 'node_modules', name, 'package.json'),
          JSON.stringify({ name, bin }),
        )
        try {
          symlinkSync(join(store, `${name}@1.0.0`, 'node_modules', name), join(nm, name), 'dir')
        } catch {
          assert(false, '本机无法创建符号链接,第三型未被真正验证')
        }
      }
      writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'fixture-root', dependencies: { mytool: '1.0.0' } }))
      mkPkg('mytool', { mytool: './cli.js' }) // 直接声明 ⇒ 应有 shim
      mkPkg('hoisted', { hoisted: './cli.js' }) // 未声明(根里 hoist 上来的传递依赖)⇒ 按 pnpm 语义不该有 shim
      const r1 = findGuttedLinks(root, dirs)
      assert(r1.gutted.every((x) => x.link !== 'node_modules/mytool'), '声明 bin 无 shim 不得进 gutted(未证明的基线不拦人)')
      assert(
        r1.missingBins.some((x) => x.link === 'node_modules/mytool' && x.bin === 'mytool'),
        `missingBins 应点名 mytool, got ${JSON.stringify(r1.missingBins)}`,
      )
      assert(
        !r1.missingBins.some((x) => x.link === 'node_modules/hoisted'),
        'hoist 的传递依赖被算进红点 = 假阳机(真仓实测 expo / react-native 正是这一型,不在根 package.json 里)',
      )
      mkdirSync(join(nm, '.bin'), { recursive: true })
      writeFileSync(join(nm, '.bin', process.platform === 'win32' ? 'mytool.CMD' : 'mytool'), '@ECHO off\n')
      const r2 = findGuttedLinks(root, dirs)
      assert(
        !r2.missingBins.some((x) => x.link === 'node_modules/mytool'),
        '补上 shim 后必须归零(否则该维度是单向断言)',
      )
      rmSync(join(nm, 'mytool'), { recursive: true, force: true })
      rmSync(join(nm, 'hoisted'), { recursive: true, force: true })
      rmSync(join(nm, '.bin', process.platform === 'win32' ? 'mytool.CMD' : 'mytool'), { force: true })
      rmSync(join(root, 'package.json'), { force: true })
    })
    t('lintStagedCommands:字符串/数组/嵌套对象三种形态都要提出命令名,且 node/pnpm 首 token 不算', () => {
      const cmds = lintStagedCommands({
        'lint-staged': {
          '*.ts': 'eslint --fix',
          '*.js': ['prettier --write', 'node scripts/own-check.mjs'],
          '*.{css,md}': { commands: ['prettier --write'], packageManager: 'pnpm exec' },
        },
      })
      assert(cmds.includes('eslint') && cmds.includes('prettier'), `漏提命令名: ${cmds.join(',')}`)
      assert(!cmds.includes('node'), '`node x.mjs` 的命令名应是 node 本身以外 ⇒ 不参与 shim 对账')
      assert(!cmds.includes('pnpm'), 'pnpm exec 由 PATH 承载,不要求 .bin shim')
      assert(new Set(cmds).size <= 3, `去重前应≤3 种命令, got ${cmds.join(',')}`)
      assert(lintStagedCommands({}).length === 0, '无 lint-staged 配置应返回空集(不得凭猜测判红)')
    })
    t('第四型判红双向:命令无 shim 必红,补 shim 必绿;且"包目录在而 shim 没了"不得算绿', () => {
      const h = mkScratch('ihui-hook-cmd-')
      try {
        mkdirSync(join(h, 'node_modules', '.bin'), { recursive: true })
        mkdirSync(join(h, 'node_modules', 'eslint', 'node_modules'), { recursive: true })
        writeFileSync(join(h, 'node_modules', 'eslint', 'package.json'), JSON.stringify({ name: 'eslint' }))
        const bad = findUnresolvableHookCommands(h, ['eslint', 'prettier'])
        assert(
          bad.length === 2 && bad.every((x) => ['eslint', 'prettier'].includes(x.cmd)),
          `包内容在、shim 没了必须判红(这正是 2026-09-24 的现场), got ${JSON.stringify(bad)}`,
        )
        writeFileSync(join(h, 'node_modules', '.bin', process.platform === 'win32' ? 'eslint.CMD' : 'eslint'), '@ECHO off\n')
        const after = findUnresolvableHookCommands(h, ['eslint', 'prettier'])
        assert(after.length === 1 && after[0].cmd === 'prettier', `补一个 shim 只应消一个红, got ${JSON.stringify(after)}`)
        assert(findUnresolvableHookCommands(h, []).length === 0, '空命令集不得凭空造红')
      } finally {
        rmScratch(h)
      }
    })
    t('一条链接都扫不到 ⇒ 判据失效必须红(不许空扫报绿)', () => {
      rmSync(join(root, 'node_modules'), { recursive: true, force: true })
      rmSync(join(root, 'apps', 'bb', 'node_modules'), { recursive: true, force: true })
      mkdirSync(join(root, 'node_modules'), { recursive: true }) // 目录在、链接为 0 条 = "空扫"形态
      // 刻意先把 bb 的 workspace 声明摘掉:否则 exit 1 可能来自"声明未链接"而不是本用例要证的
      // "空扫",断言就变成恒真(自写脚本最容易骗自己的形态)。
      writeFileSync(
        join(root, 'apps', 'bb', 'package.json'),
        JSON.stringify({ name: '@ihui/bb', dependencies: { react: '^19.0.0' } }),
      )
      const { gutted, scanned } = findGuttedLinks(root, dirs)
      assert(gutted.length === 0 && scanned === 0, `夹具未清空: scanned=${scanned}`)
      assert(
        findMissingLinks(root, dirs).length === 0,
        '夹具里 missing 应为 0,否则本用例会因别的原因变红',
      )
      // run() 只"返回退出码"(process.exit 在 isDirectRun 出口层),所以断言取返回值
      const code = run([`--root=${root}`])
      assert(code === 1, `scanned=0 时 run() 应返回 1, got ${code}`)
    })
    t('--strict 开关是**双向**的:同一夹具默认 exit 0、加 --strict 必 exit 1(缺一半就是空开关)', () => {
      const h = mkScratch('ihui-strict-switch-')
      try {
        mkdirSync(join(h, 'packages', 'aa'), { recursive: true })
        writeFileSync(join(h, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n")
        writeFileSync(join(h, 'package.json'), JSON.stringify({ name: 'strict-root', dependencies: { mytool: '1.0.0' } }))
        writeFileSync(join(h, 'packages', 'aa', 'package.json'), JSON.stringify({ name: '@ihui/aa' }))
        const store = join(h, '.pnpm-fixture3')
        mkdirSync(join(store, 'mytool@1.0.0', 'node_modules', 'mytool'), { recursive: true })
        writeFileSync(
          join(store, 'mytool@1.0.0', 'node_modules', 'mytool', 'package.json'),
          JSON.stringify({ name: 'mytool', bin: { mytool: './cli.js' } }),
        )
        mkdirSync(join(h, 'node_modules'), { recursive: true })
        try {
          symlinkSync(join(store, 'mytool@1.0.0', 'node_modules', 'mytool'), join(h, 'node_modules', 'mytool'), 'dir')
        } catch {
          assert(false, '本机无法创建符号链接,--strict 未被真正验证')
        }
        const code1 = run([`--root=${h}`])
        const code2 = run([`--root=${h}`, '--strict'])
        assert(code1 === 0, `默认模式不得因缺 shim 拦人(实得 ${code1})`)
        assert(code2 === 1, `--strict 必须把同一状态判红(实得 ${code2})`)
        // 补上 shim ⇒ 两种模式都归零(证明判的是"有没有",不是"报不报")
        mkdirSync(join(h, 'node_modules', '.bin'), { recursive: true })
        writeFileSync(join(h, 'node_modules', '.bin', process.platform === 'win32' ? 'mytool.CMD' : 'mytool'), '@ECHO off\n')
        assert(run([`--root=${h}`, '--strict']) === 0, '补 shim 后 strict 仍红 = 判据不成立')
      } finally {
        rmScratch(h)
      }
    })
    t('真仓不参判据自测(共享工作区在装依赖时链接数会瞬时下跌,写进自检必成 flaky 红)', () => {
      // 真仓规模的"装车证明"放在镜像测试 scripts/tests/check-workspace-dep-links.test.mjs,
      // 那里手动/CI 跑,不进每次提交的自检链(教训:自测夹具不得依赖真仓瞬时状态)。
      assert(
        findGuttedLinks(join(root, 'no-such-dir'), []) instanceof Object,
        'findGuttedLinks 应总返回对象',
      )
    })
    t('非 workspace 协议声明不参与判定', () => {
      writeFileSync(
        join(root, 'apps', 'bb', 'package.json'),
        JSON.stringify({ name: '@ihui/bb', dependencies: { react: '^19.0.0' } }),
      )
      assert(
        findMissingLinks(root, dirs).length === 0,
        `普通依赖不该进本门: ${JSON.stringify(findMissingLinks(root, dirs))}`,
      )
    })
    t('patterns 为空/错 → 判据失效必须红', () => {
      const emptyRoot = mkScratch('ihui-dep-link-empty-')
      try {
        writeFileSync(join(emptyRoot, 'pnpm-workspace.yaml'), 'nodeLinker: isolated\n')
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
    console.log(
      failed === 0
        ? `--self-test ${cases.length}/${cases.length} 通过`
        : `--self-test 失败 ${failed}/${cases.length}`,
    )
    return failed === 0 ? 0 : 1
  } finally {
    rmScratch(root)
  }
}

export const __test__ = {
  parseWorkspacePatterns,
  expandPatterns,
  workspaceDepsOf,
  findMissingLinks,
  findGuttedLinks,
  lintStagedCommands,
  findUnresolvableHookCommands,
  audit,
}

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
