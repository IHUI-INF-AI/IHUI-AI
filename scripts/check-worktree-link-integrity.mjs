#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-worktree-link-integrity.mjs —— worktree 内 `node_modules/@ihui/*` 链接指向自检
 *
 * 背景(2026-11-07 立):
 *   多 worktree 并行开发时,pnpm 生成的 `node_modules/@ihui/<pkg>` 软链可能指向**别的**
 *   worktree(常见是主树 `D:\IHUI-AI\packages\*`),而不是本 worktree 的同名包。
 *   此时在该 worktree 里跑 tsc / 测试,校验到的是别人的代码,红绿读数不可信 ——
 *   典型实测:`apps/web` 的 `@ihui/rn-app` 指向主树 `packages/app`,改正后
 *   staged typecheck 从 7 错(1×TS2307 + 6×连带 TS7006)变成 0 错。
 *
 * 判据(单条链接):
 *   1) 真实目标落在**该 worktree 自身根目录**内 ⇒ ok;
 *   2) 包名命中白名单 ⇒ whitelisted(共享配置类包按设计跨 worktree 复用,见下);
 *   3) 其余一律违规(cross-worktree / main-tree / external);
 *   4) 断链 / 取不到 realpath ⇒ 违规(category=broken),不静默判绿。
 *
 * 白名单为什么允许:
 *   `@ihui/eslint-config`、`@ihui/tsconfig` 是**工具链配置包**,不含业务运行时代码。
 *   各 worktree 共用同一份可避免"每个检出都要重新装一遍 lint 配置"和配置漂移;
 *   它们不参与 tsc 的类型解析结论,指向外部不会污染红绿读数。当前实测大量 worktree
 *   指向 `D:\IHUI-AI-wt-paritygate\packages\eslint-config`,属设计如此。
 *   白名单可配置:`--whitelist=<逗号分隔>`、`--whitelist-file=<json>`、
 *   环境变量 `IHUI_WORKTREE_LINK_WHITELIST`;`--no-default-whitelist` 关掉内置项。
 *
 * 用法:
 *   node scripts/check-worktree-link-integrity.mjs              # 只报数,exit 0
 *   node scripts/check-worktree-link-integrity.mjs --strict     # 有违规 ⇒ exit 1
 *   node scripts/check-worktree-link-integrity.mjs --json       # 机器可读(含完整违规清单)
 *   node scripts/check-worktree-link-integrity.mjs --all        # 文本模式打印全部违规
 *   node scripts/check-worktree-link-integrity.mjs --limit 20   # 每个 worktree 的样例条数(默认 5)
 *   node scripts/check-worktree-link-integrity.mjs --self-test  # 内置夹具自测
 *
 * 退出码: 0 = 无违规(或非 strict 模式) / 1 = --strict 且有违规 / 2 = 未判定(git 读取失败等)
 */

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */

import { execFileSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const EXIT_OK = 0
export const EXIT_VIOLATION = 1
export const EXIT_UNKNOWN = 2

/**
 * 内置白名单:共享工具链配置包。
 * 理由见文件头「白名单为什么允许」;新增条目必须写清"为什么不参与类型判定"。
 */
export const DEFAULT_WHITELIST = [
  '@ihui/eslint-config', // lint 配置:纯工具链,tsc 不消费
  '@ihui/tsconfig', // tsconfig 预设:被 extends 引用时不需要本 worktree 副本
]

const SKIP_DIR_NAMES = new Set(['.git', '.next', '.turbo', 'dist', 'build'])

/** 规范化路径:统一分隔符/盘符大小写/去尾斜杠,并剥掉 Windows 的 `\\?\` 前缀。 */
export function normalizePath(input) {
  let p = resolve(String(input)).replace(/\\/g, '/')
  if (p.startsWith('//?/')) p = p.slice(4)
  p = p.replace(/\/+$/, '')
  if (/^[a-z]:/i.test(p)) p = p[0].toUpperCase() + p.slice(1)
  return p.toLowerCase()
}

/** target 是否落在 root 内(含 root 自身)。 */
export function isInside(root, target) {
  const r = normalizePath(root)
  const t = normalizePath(target)
  return t === r || t.startsWith(`${r}/`)
}

/** 解析 `git worktree list --porcelain`。 */
export function parseWorktreePorcelain(text) {
  const out = []
  for (const block of String(text).split(/\r?\n\r?\n/)) {
    if (!block.trim()) continue
    const lines = block.split(/\r?\n/)
    let path = null
    const info = { path: null, bare: false, detached: false, locked: false, lockReason: '', prunable: false, branch: '' }
    for (const line of lines) {
      if (line.startsWith('worktree ')) path = line.slice('worktree '.length).trim()
      else if (line.trim() === 'bare') info.bare = true
      else if (line.trim() === 'detached') info.detached = true
      else if (line.startsWith('locked')) {
        info.locked = true
        info.lockReason = line.slice('locked'.length).trim()
      } else if (line.startsWith('prunable')) info.prunable = true
      else if (line.startsWith('branch ')) info.branch = line.slice('branch '.length).trim()
    }
    if (path) out.push({ ...info, path })
  }
  return out
}

/**
 * 列出扫描根:git worktree list + 当前检出本身。
 * 当前检出可能不在 list 里(本仓 `D:/IHUI-AI/.git` 是 `gitdir:` 文件,主工作树在
 * `D:/IHUI-AI-git-repo`),漏掉它会把主树自己的正确链接误判成违规。
 */
export function listScanRoots(repoRoot = ROOT) {
  const text = execFileSync('git', ['-C', repoRoot, 'worktree', 'list', '--porcelain'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const entries = parseWorktreePorcelain(text)
  const seen = new Set(entries.map((e) => normalizePath(e.path)))
  const self = normalizePath(repoRoot)
  if (!seen.has(self)) {
    entries.unshift({ path: repoRoot, bare: false, detached: false, locked: false, lockReason: '', prunable: false, branch: '', implicitCurrent: true })
  }
  return entries
}

/** 枚举一个 worktree 下所有 `node_modules/@ihui` 目录(root / apps/<name> / packages/<name>)。 */
export function findIhuiScopeDirs(worktreeRoot) {
  const candidates = [join(worktreeRoot, 'node_modules')]
  for (const area of ['apps', 'packages', 'tools']) {
    const areaDir = join(worktreeRoot, area)
    if (!existsSync(areaDir)) continue
    let entries = []
    try {
      entries = readdirSync(areaDir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const ent of entries) {
      if (!ent.isDirectory() && !ent.isSymbolicLink()) continue
      if (SKIP_DIR_NAMES.has(ent.name)) continue
      candidates.push(join(areaDir, ent.name, 'node_modules'))
    }
  }
  return candidates.filter((p) => {
    const scope = join(p, '@ihui')
    try {
      return lstatSync(scope).isDirectory() || lstatSync(scope).isSymbolicLink()
    } catch {
      return false
    }
  })
}

/**
 * 判定单条链接。
 * @returns {{status:'ok'|'whitelisted'|'violation', category?:string}}
 */
export function classifyLink(linkPath, realTarget, { worktreeRoot, whitelist, knownRoots }) {
  const pkg = `@ihui/${linkPath.split(/[\\/]/).pop()}`
  if (!realTarget) return { status: 'violation', category: 'broken' }
  if (isInside(worktreeRoot, realTarget)) return { status: 'ok', category: 'self' }
  if (whitelist.has(pkg)) return { status: 'whitelisted', category: 'whitelist' }
  let targetWorktree = null
  for (const root of knownRoots) {
    if (isInside(root, realTarget)) {
      if (!targetWorktree || normalizePath(root).length > normalizePath(targetWorktree).length) targetWorktree = root
    }
  }
  if (!targetWorktree) return { status: 'violation', category: 'external' }
  return {
    status: 'violation',
    category: isInside(repoMainRoot(knownRoots), realTarget) ? 'main-tree' : 'cross-worktree',
    targetWorktree,
  }
}

/** knownRoots 里第一个就是当前检出(主树);显式化以便分类文案。 */
function repoMainRoot(knownRoots) {
  return knownRoots[0] ?? ''
}

/**
 * 扫描单个 worktree。
 * @returns {{root:string, links:number, ok:number, whitelisted:number, violations:Array, broken:Array,
 *            externalNodeModules:Array}}
 */
export function scanWorktree(worktreeRoot, { whitelist, knownRoots, readlink = true }) {
  const result = {
    root: worktreeRoot,
    links: 0,
    ok: 0,
    whitelisted: 0,
    violations: [],
    broken: [],
    externalNodeModules: [],
  }
  // 先记下"node_modules 整目录本身就是指向外部的重解析点"——这是共享依赖布局的根因证据:
  // 此时树内看到的 @ihui 链接其实物理上属于另一个工作树,改它等于改别人的文件。
  for (const nodeModules of findIhuiScopeDirs(worktreeRoot)) {
    let st
    try {
      st = lstatSync(nodeModules)
    } catch {
      continue
    }
    if (!st.isSymbolicLink()) continue
    let physical = ''
    try {
      physical = realpathSync(nodeModules)
    } catch {
      physical = ''
    }
    if (!physical || !isInside(worktreeRoot, physical)) {
      result.externalNodeModules.push({
        path: relative(worktreeRoot, nodeModules).replace(/\\/g, '/'),
        physical: physical ? toDisplayPath(physical) : '(unresolved)',
        ownerWorktree: findOwner(physical, knownRoots),
      })
    }
  }
  for (const nodeModules of findIhuiScopeDirs(worktreeRoot)) {
    const scope = join(nodeModules, '@ihui')
    let names = []
    try {
      names = readdirSync(scope)
    } catch {
      continue
    }
    let physicalLinkDir = ''
    try {
      physicalLinkDir = realpathSync(scope)
    } catch {
      physicalLinkDir = ''
    }
    for (const name of names) {
      const linkPath = join(scope, name)
      let st
      try {
        st = lstatSync(linkPath)
      } catch {
        continue
      }
      if (!st.isSymbolicLink()) continue
      result.links++
      let rawTarget = ''
      if (readlink) {
        try {
          rawTarget = readlinkSync(linkPath)
        } catch {
          rawTarget = ''
        }
      }
      let realTarget = ''
      try {
        realTarget = realpathSync(linkPath)
      } catch {
        realTarget = ''
      }
      const relLink = relative(worktreeRoot, linkPath).replace(/\\/g, '/')
      const verdict = classifyLink(linkPath, realTarget, { worktreeRoot, whitelist, knownRoots })
      if (verdict.status === 'ok') result.ok++
      else if (verdict.status === 'whitelisted') result.whitelisted++
      else {
        const physicallyOwned = Boolean(physicalLinkDir) && isInside(worktreeRoot, physicalLinkDir)
        const record = {
          worktree: worktreeRoot,
          link: relLink,
          absoluteLink: linkPath,
          package: `@ihui/${name}`,
          target: realTarget ? toDisplayPath(realTarget) : rawTarget || '(unresolved)',
          rawTarget: rawTarget || '(unresolved)',
          category: verdict.category,
          targetWorktree: verdict.targetWorktree ? toDisplayPath(verdict.targetWorktree) : null,
          physicallyOwned,
          physicalLinkDir: physicalLinkDir ? toDisplayPath(physicalLinkDir) : '(unresolved)',
          physicalOwner: physicallyOwned ? null : findOwner(physicalLinkDir, knownRoots),
        }
        result.violations.push(record)
        if (verdict.category === 'broken') result.broken.push(record)
      }
    }
  }
  return result
}

/** 找出路径所属的已知 worktree(最长前缀)。 */
function findOwner(target, knownRoots) {
  if (!target) return null
  let owner = null
  for (const root of knownRoots) {
    if (isInside(root, target) && (!owner || normalizePath(root).length > normalizePath(owner).length)) owner = root
  }
  return owner ? toDisplayPath(owner) : null
}

function toDisplayPath(p) {
  return String(p).replace(/\\/g, '/')
}

/** 构建扫描计划(roots → 每个 root 的扫描结果)。 */
export function scanAll({ repoRoot = ROOT, whitelist = new Set(DEFAULT_WHITELIST), entries = null } = {}) {
  const roots = entries ?? listScanRoots(repoRoot)
  const knownRoots = [repoRoot]
  for (const r of roots) {
    if (!knownRoots.some((k) => normalizePath(k) === normalizePath(r.path))) knownRoots.push(r.path)
  }
  const results = []
  for (const entry of roots) {
    if (!existsSync(entry.path)) continue
    results.push(scanWorktree(entry.path, { whitelist, knownRoots }))
  }
  return { roots, results, repoRoot }
}

function buildArgs(argv) {
  const opts = {
    json: false,
    strict: false,
    all: false,
    limit: 5,
    selfTest: false,
    whitelist: new Set(DEFAULT_WHITELIST),
    whitelistFile: null,
    noDefaultWhitelist: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--json') opts.json = true
    else if (a === '--strict') opts.strict = true
    else if (a === '--all') opts.all = true
    else if (a === '--self-test') opts.selfTest = true
    else if (a === '--no-default-whitelist') opts.noDefaultWhitelist = true
    else if (a === '--limit') opts.limit = Number(argv[++i] ?? 5) || 5
    else if (a.startsWith('--limit=')) opts.limit = Number(a.slice(8)) || 5
    else if (a === '--whitelist') addWhitelist(opts.whitelist, argv[++i] ?? '')
    else if (a.startsWith('--whitelist=')) addWhitelist(opts.whitelist, a.slice('--whitelist='.length))
    else if (a === '--whitelist-file') opts.whitelistFile = argv[++i]
    else if (a.startsWith('--whitelist-file=')) opts.whitelistFile = a.slice('--whitelist-file='.length)
    else if (a === '--help' || a === '-h') {
      console.log('用法: node scripts/check-worktree-link-integrity.mjs [--json] [--strict] [--all] [--limit N] [--whitelist=a,b] [--whitelist-file=f] [--self-test]')
      process.exit(EXIT_OK)
    }
  }
  if (opts.noDefaultWhitelist) opts.whitelist = new Set()
  const env = process.env.IHUI_WORKTREE_LINK_WHITELIST
  if (env) addWhitelist(opts.whitelist, env)
  if (opts.whitelistFile) {
    const abs = resolve(opts.whitelistFile)
    if (!existsSync(abs)) {
      console.error(`未判定:白名单文件不存在 ${abs}`)
      process.exit(EXIT_UNKNOWN)
    }
    let parsed
    try {
      parsed = JSON.parse(readFileSync(abs, 'utf8'))
    } catch (e) {
      console.error(`未判定:白名单文件不是合法 JSON ${abs}: ${e.message}`)
      process.exit(EXIT_UNKNOWN)
    }
    const list = Array.isArray(parsed) ? parsed : parsed?.packages
    if (!Array.isArray(list)) {
      console.error(`未判定:白名单文件缺少 packages 数组 ${abs}`)
      process.exit(EXIT_UNKNOWN)
    }
    for (const item of list) addWhitelist(opts.whitelist, item)
  }
  return opts
}

function addWhitelist(set, text) {
  for (const part of String(text).split(/[,;\s]+/)) {
    const v = part.trim()
    if (!v) continue
    set.add(v.startsWith('@') ? v : `@ihui/${v}`)
  }
}

function summarize(results) {
  const stats = {
    roots: results.length,
    rootsWithLinks: 0,
    links: 0,
    ok: 0,
    whitelisted: 0,
    violations: 0,
    broken: 0,
    worktreesWithViolations: 0,
    sharedNodeModulesWorktrees: 0,
    violationsPhysicallyOwned: 0,
  }
  for (const r of results) {
    stats.links += r.links
    stats.ok += r.ok
    stats.whitelisted += r.whitelisted
    stats.violations += r.violations.length
    stats.broken += r.broken.length
    stats.violationsPhysicallyOwned += r.violations.filter((v) => v.physicallyOwned).length
    if (r.links > 0) stats.rootsWithLinks++
    if (r.violations.length > 0) stats.worktreesWithViolations++
    if ((r.externalNodeModules ?? []).length > 0) stats.sharedNodeModulesWorktrees++
  }
  return stats
}

function printText({ results, stats, whitelist, limit, all }) {
  console.log('worktree 链接完整性检查')
  console.log(`  扫描 worktree ${stats.roots} 个(含当前检出与 git worktree list)`)
  console.log(
    `  链接 ${stats.links} 条:自身 ${stats.ok} / 白名单 ${stats.whitelisted} / 违规 ${stats.violations} / 断链 ${stats.broken}`,
  )
  console.log(`  白名单(${whitelist.size}):${[...whitelist].join(', ') || '(空)'}`)
  console.log(
    `  node_modules 整目录指向外部的 worktree:${stats.sharedNodeModulesWorktrees} 个(这些树里的违规链接物理上属于别的树)`,
  )
  if (stats.violations === 0) {
    console.log('  结论: 全部链接指向各自 worktree 自身或命中白名单')
    return
  }
  const grouped = results.filter((r) => r.violations.length > 0).sort((a, b) => b.violations.length - a.violations.length)
  console.log(`  违规分布 ${stats.worktreesWithViolations} 个 worktree(按条数降序):`)
  for (const r of grouped) {
    console.log(`  [${toDisplayPath(r.root)}] 违规 ${r.violations.length} 条`)
    const shown = all ? r.violations : r.violations.slice(0, limit)
    for (const v of shown) {
      const physical = v.physicallyOwned ? '' : `  [物理归属:${v.physicalOwner ?? v.physicalLinkDir}]`
      console.log(`    - ${v.link} -> ${v.target}  (${v.category}${v.targetWorktree ? `:${v.targetWorktree}` : ''})${physical}`)
    }
    if (!all && r.violations.length > shown.length) {
      console.log(`    … 其余 ${r.violations.length - shown.length} 条省略(--all 或 --json 查看完整清单)`)
    }
  }
}

function emitJson({ results, stats, whitelist, strict }) {
  const payload = {
    ok: stats.violations === 0,
    strict,
    generatedAt: new Date().toISOString(),
    whitelist: [...whitelist],
    stats,
    worktrees: results.map((r) => ({
      path: toDisplayPath(r.root),
      links: r.links,
      ok: r.ok,
      whitelisted: r.whitelisted,
      violations: r.violations.length,
      broken: r.broken.length,
      externalNodeModules: r.externalNodeModules ?? [],
    })),
    violations: results.flatMap((r) => r.violations),
  }
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
}

function runSelfTest() {
  const assert = (cond, msg) => {
    if (!cond) throw new Error(`self-test 失败:${msg}`)
  }
  const base = join(process.env.TEMP || process.env.TMP || '.', `ihui-wt-link-selftest-${process.pid}-${Date.now()}`)
  try {
    const mainRoot = join(base, 'main')
    const wtRoot = join(base, 'wt')
    const whitelistTarget = join(base, 'shared-config')
    for (const dir of [join(mainRoot, 'packages', 'app'), join(wtRoot, 'packages', 'app'), whitelistTarget]) {
      mkdirSync(dir, { recursive: true })
    }
    mkdirSync(join(wtRoot, 'apps', 'web', 'node_modules', '@ihui'), { recursive: true })
    // 1) 指向主树 ⇒ 违规(main-tree)
    const linkToMain = join(wtRoot, 'apps', 'web', 'node_modules', '@ihui', 'rn-app')
    symlinkSync(join(mainRoot, 'packages', 'app'), linkToMain, 'junction')
    // 2) 指向自身 ⇒ 通过
    const linkToSelf = join(wtRoot, 'apps', 'web', 'node_modules', '@ihui', 'shared')
    symlinkSync(join(wtRoot, 'packages', 'app'), linkToSelf, 'junction')
    // 3) 白名单包指向外部 ⇒ 通过
    const linkWhitelisted = join(wtRoot, 'apps', 'web', 'node_modules', '@ihui', 'eslint-config')
    symlinkSync(whitelistTarget, linkWhitelisted, 'junction')
    // 4) 断链 ⇒ 违规(broken)
    const linkBroken = join(wtRoot, 'apps', 'web', 'node_modules', '@ihui', 'i18n')
    symlinkSync(join(base, 'does-not-exist'), linkBroken, 'junction')

    const knownRoots = [mainRoot, wtRoot]
    const scan = scanWorktree(wtRoot, { whitelist: new Set(DEFAULT_WHITELIST), knownRoots })
    const find = (pkg) => scan.violations.find((v) => v.package === pkg)
    assert(scan.links === 4, `应扫到 4 条链接,实际 ${scan.links}`)
    assert(scan.ok === 1, `指向自身应判 ok,实际 ok=${scan.ok}`)
    assert(scan.whitelisted === 1, `白名单应判 whitelisted,实际 whitelisted=${scan.whitelisted}`)
    assert(find('@ihui/rn-app')?.category === 'main-tree', '指向主树应判 main-tree 违规')
    assert(find('@ihui/i18n')?.category === 'broken', '断链应判 broken 违规')
    assert(!find('@ihui/eslint-config'), '白名单包不应出现在违规清单')
    assert(!find('@ihui/shared'), '指向自身的链接不应出现在违规清单')

    // 5) 反向对照:去掉白名单后同一现场必须变红
    const strictScan = scanWorktree(wtRoot, { whitelist: new Set(), knownRoots })
    assert(strictScan.violations.some((v) => v.package === '@ihui/eslint-config' && v.category === 'external'), '去白名单后 eslint-config 必须判违规')

    // 6) 路径规范化与包容判定
    assert(isInside('D:\\IHUI-AI\\packages', 'd:/ihui-ai/packages/app'), 'isInside 应忽略盘符/分隔符/大小写')
    assert(!isInside('D:\\IHUI-AI\\packages', 'D:\\IHUI-AI\\packages2\\x'), '前缀相近的兄弟目录不得误判为内部')

    // 7) porcelain 解析
    const parsed = parseWorktreePorcelain('worktree D:/a\nHEAD abc\nbranch refs/heads/main\n\nworktree D:/b\nHEAD def\ndetached\n')
    assert(parsed.length === 2 && parsed[1].detached, 'porcelain 解析应识别 detached')
  } finally {
    try {
      rmSync(base, { recursive: true, force: true })
    } catch {
      /* 清理失败不影响自测结论 */
    }
  }
  console.log('self-test 通过: 7 项断言(含 2 个阴性对照)')
}

function main() {
  const opts = buildArgs(process.argv.slice(2))
  if (opts.selfTest) {
    runSelfTest()
    process.exit(EXIT_OK)
  }
  let plan
  try {
    plan = scanAll({ whitelist: opts.whitelist })
  } catch (e) {
    console.error(`未判定:无法枚举 worktree / 扫描链接:${e.message}`)
    process.exit(EXIT_UNKNOWN)
  }
  const stats = summarize(plan.results)
  if (opts.json) emitJson({ ...plan, stats, whitelist: opts.whitelist, strict: opts.strict })
  else printText({ ...plan, stats, whitelist: opts.whitelist, limit: opts.limit, all: opts.all })
  if (opts.strict && stats.violations > 0) process.exit(EXIT_VIOLATION)
  process.exit(EXIT_OK)
}

const isMain = process.argv[1] && normalizePath(process.argv[1]) === normalizePath(fileURLToPath(import.meta.url))
if (isMain) main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
