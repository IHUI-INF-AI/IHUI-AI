// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * worktree-reclaim-guard.mjs —— worktree 磁盘约束唯一入口（2026-11-04 立）。
 *
 * 立因：2026-11-03/04 G: 盘两次因 worktree 与构建缓存堆积只剩 1.32 GB，安装中断、
 * git 写 ref 失败；回收时又两次撞上「判活判早了」——判活瞬间干净，删除瞬间被另一
 * 会话写入或进程占用，导致工作树半删。六条约束在此落成硬判据，不再只写在报告里：
 *
 * 1. 新 worktree 默认落 E:\IHUI-worktrees（可用 IHUI_WT_ROOT 覆盖）。
 *    依据：G: 总量仅 165 GB 且要承载主仓 + node_modules + 构建缓存；单个实装 worktree
 *    实测 3.5–14 GB；D 56 GB / E 720 GB 空闲，E 是 G 的 4 倍以上。
 * 2. worktree 一律 junction 复用主仓依赖（根与每个 workspace 包的 node_modules）。
 *    依据：每个实装 pnpm 依赖约 2.7 GB，junction 后只保留一份实体。
 * 3. 构建缓存（.next/.next-ct/.next-ct-v/.turbo/coverage/dist）用完即删。
 *    依据：这些是纯可再生产物，单个 worktree 曾占 10.5 GB 且完全不参与 git。
 * 4. 删除前必过「近 1 小时文件写入 + 进程命令行引用」双判活。
 *    依据：2026-11-03 composer-toolbar、2026-11-04 e2e-red-2 两次事故都发生在
 *    判活与删除之间被其他会话接管；只测 mtime 不够，还必须测进程占用。
 * 5. 回收目标解析后（含 junction / symlink）必须严格落在本仓 `.worktrees/` 之下，
 *    且不得是主工作树、不得是 gitdir。主仓路径直接拒绝，删除代码不可达。
 *    依据：DBG-92，`--reclaim` 对绝对路径没有包含性判据，误传主仓会 rmSync 整棵主工作树。
 * 6. `git status` 干净仍不够。删除前要看见忽略文件里的 .env、私钥、证书；
 *    命中则默认拒绝并点名，不提供自动删除出口。
 *    依据：DBG-96，porcelain 不列忽略文件，.env、证书和本地密钥会被删掉且不留痕。
 *
 * 纪律：默认 dry-run；--apply 才删。主仓、`.worktrees` 之外、以及带敏感忽略文件的检出，
 * `--apply` 也不删。摘 junction 只断链接（unlink 自身），
 * 绝不递归跟随到主仓 node_modules。全程不碰共享暂存区、不 push。
 *
 * 用法：
 *   node scripts/worktree-reclaim-guard.mjs --check <path>
 *   node scripts/worktree-reclaim-guard.mjs --create <名> [--apply]
 *   node scripts/worktree-reclaim-guard.mjs --reclaim <名|path> [--apply]
 *   node scripts/worktree-reclaim-guard.mjs --clean-cache <path> [--apply]
 *   node scripts/worktree-reclaim-guard.mjs --self-test
 */
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
  mkdtempSync,
  realpathSync,
} from 'node:fs'
import { join, dirname, resolve, isAbsolute, basename, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gitBinary } from './lib/face-reader.mjs'
import { tmpdir } from 'node:os'

const ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'))
const DEFAULT_WT_ROOT = process.env.IHUI_WT_ROOT || 'E:\\IHUI-worktrees'
const ACTIVITY_WINDOW_MS = 60 * 60 * 1000
const CACHE_DIR_NAMES = new Set(['.next', '.next-ct', '.next-ct-v', '.turbo', 'coverage', 'dist'])

function git(args, cwd = ROOT) {
  const r = spawnSync(gitBinary(), ['-c', 'safe.directory=*', ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { status: r.status, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() }
}

/** 递归收集普通文件（不进入任何 reparse point，杜绝跟随 junction）。 */
function collectFiles(root, out = []) {
  let entries
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const p = join(root, e.name)
    let lst
    try {
      lst = lstatSync(p)
    } catch {
      continue
    }
    if (lst.isSymbolicLink()) continue // 只统计链接本身，不进入目标
    if (lst.isDirectory()) collectFiles(p, out)
    else if (lst.isFile()) out.push({ path: p, mtimeMs: lst.mtimeMs })
  }
  return out
}

/** 递归收集 reparse point 目录（junction/symlink），供先摘链。 */
function collectReparse(root, out = []) {
  let entries
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const p = join(root, e.name)
    let lst
    try {
      lst = lstatSync(p)
    } catch {
      continue
    }
    if (lst.isSymbolicLink()) {
      out.push(p)
      continue // 不进入链接目标
    }
    if (lst.isDirectory()) collectReparse(p, out)
  }
  return out
}

/** 是否有进程命令行引用该路径（Windows）；其他平台跳过。 */
function processesReferencing(path) {
  if (process.platform !== 'win32') return []
  const escaped = path.replace(/'/g, "''")
  const script =
    `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains('${escaped}') } | ` +
    `ForEach-Object { "$($_.ProcessId)|$($_.Name)" }`
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 20000,
  })
  return (r.stdout || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    // 自匹配排除：node 自身与本次 powershell 查询命令的命令行都含有目标路径字符串，
    // 不过滤会把「自己」误判成占用进程（2026-11-04 self-test 反向例实测命中）。
    .filter((l) => !l.startsWith(`${process.pid}|`) && !l.startsWith(`${r.pid}|`))
}

/**
 * 双判活：近 1 小时文件写入 + 进程命令行引用。
 * quiet=false 即必须跳过；两个维度任一命中都不许删。
 */
function checkActivity(path, now = Date.now()) {
  const files = collectFiles(path)
  const cutoff = now - ACTIVITY_WINDOW_MS
  const recent = files.filter((f) => f.mtimeMs > cutoff)
  const newest = files.reduce((a, f) => (f.mtimeMs > a ? f.mtimeMs : a), 0)
  const procs = processesReferencing(path)
  return {
    quiet: recent.length === 0 && procs.length === 0,
    recentWrites: recent.length,
    processes: procs,
    newest,
    fileCount: files.length,
  }
}

function isMerged(path) {
  return git(['-C', path, 'merge-base', '--is-ancestor', 'HEAD', 'origin/main']).status === 0
}

function isClean(path) {
  const r = git(['-C', path, 'status', '--porcelain'])
  if (r.status !== 0) return false
  return r.stdout.split(/\r?\n/).filter((l) => l.trim().length > 0).length === 0
}

/** .env / 私钥 / 证书。只看文件名，不读内容。 */
const SENSITIVE_EXT = new Set([
  '.pem',
  '.key',
  '.p12',
  '.pfx',
  '.crt',
  '.cer',
  '.der',
  '.p7b',
  '.p7c',
  '.pk8',
  '.jks',
  '.keystore',
])
const KEY_BASENAMES = new Set(['id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519', 'id_ed25519_sk'])

function isSensitiveName(name) {
  const lower = String(name).toLowerCase()
  if (lower === '.env' || lower === '.envrc' || lower.startsWith('.env.') || lower.endsWith('.env')) {
    return true
  }
  if (KEY_BASENAMES.has(lower)) return true
  const dot = lower.lastIndexOf('.')
  return dot > 0 && SENSITIVE_EXT.has(lower.slice(dot))
}

function samePath(a, b) {
  if (!a || !b) return false
  const left = resolve(a)
  const right = resolve(b)
  if (process.platform === 'win32') return left.toLowerCase() === right.toLowerCase()
  return left === right
}

/** 严格子孙：等于 parent、逃出 parent、跨盘绝对相对路径都不算。 */
function isStrictDescendant(parent, child) {
  if (!parent || !child) return false
  const rel = relative(resolve(parent), resolve(child))
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`)) return false
  return !isAbsolute(rel)
}

function isSameOrDescendant(parent, child) {
  return samePath(parent, child) || isStrictDescendant(parent, child)
}

/** 把已存在的前缀做成 realpath，再拼回尚不存在的尾巴。junction 因此暴露真实目标。 */
function canonicalize(p) {
  const abs = resolve(p)
  let cur = abs
  const missing = []
  const seen = new Set()
  try {
    while (!existsSync(cur)) {
      if (seen.has(cur)) break
      seen.add(cur)
      const parent = dirname(cur)
      if (parent === cur) break
      missing.push(basename(cur))
      cur = parent
    }
    let realBase = cur
    if (existsSync(cur)) realBase = realpathSync(cur)
    return missing.length === 0 ? realBase : resolve(realBase, ...missing.reverse())
  } catch {
    return abs
  }
}

let defaultAnchorCache
function getDefaultAnchors() {
  if (defaultAnchorCache) return defaultAnchorCache
  const top = git(['rev-parse', '--show-toplevel'], ROOT)
  const gd = git(['rev-parse', '--absolute-git-dir'], ROOT)
  defaultAnchorCache = {
    repoRoot: ROOT,
    mainWorktree: top.status === 0 && top.stdout ? resolve(top.stdout) : ROOT,
    gitDir: gd.status === 0 && gd.stdout ? resolve(gd.stdout) : resolve(ROOT, '.git'),
    worktreesDir: resolve(ROOT, '.worktrees'),
  }
  return defaultAnchorCache
}

function anchorsOf(override) {
  const defaults = getDefaultAnchors()
  if (!override) return defaults
  return {
    repoRoot: resolve(override.repoRoot),
    mainWorktree: resolve(override.mainWorktree),
    gitDir: resolve(override.gitDir),
    worktreesDir: resolve(override.worktreesDir),
  }
}

/**
 * DBG-92：回收目标必须严格位于 `.worktrees` 之下，且词法路径和 realpath
 * 都不得是主工作树 / gitdir。没有放行开关。
 */
function classifyReclaimTarget(raw, anchorOverride) {
  const defaults = getDefaultAnchors()
  const anchors = anchorsOf(anchorOverride)
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, target: '', reason: '拒绝回收：缺少目标路径' }
  }
  const lexical = isAbsolute(raw) ? resolve(raw) : resolve(anchors.repoRoot, '.worktrees', raw)
  const canonical = canonicalize(lexical)
  const mains = [defaults.mainWorktree, defaults.repoRoot, anchors.mainWorktree, anchors.repoRoot]
  if (mains.some((m) => samePath(m, lexical) || samePath(m, canonical))) {
    return {
      ok: false,
      target: lexical,
      reason: `拒绝回收：目标是主仓工作树，禁止删除（${lexical}）`,
    }
  }
  const gitDirs = [defaults.gitDir, anchors.gitDir].filter(Boolean)
  if (gitDirs.some((g) => isSameOrDescendant(g, lexical) || isSameOrDescendant(g, canonical))) {
    return {
      ok: false,
      target: lexical,
      reason: `拒绝回收：目标落在主仓 gitdir，禁止删除（${lexical}）`,
    }
  }
  const realWorktrees = canonicalize(anchors.worktreesDir)
  if (!isStrictDescendant(anchors.worktreesDir, lexical) || !isStrictDescendant(realWorktrees, canonical)) {
    return {
      ok: false,
      target: lexical,
      reason: `拒绝回收：目标必须位于仓库 .worktrees 之下，且不能是主工作树或 gitdir（${lexical}）`,
    }
  }
  return { ok: true, target: lexical, canonical }
}

function collectSensitive(root, relBase = '', out = []) {
  const dir = relBase ? join(root, ...relBase.split('/')) : root
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git') continue
    const rel = relBase ? `${relBase}/${e.name}` : e.name
    const abs = join(dir, e.name)
    let lst
    try {
      lst = lstatSync(abs)
    } catch {
      continue
    }
    if (lst.isSymbolicLink()) {
      if (isSensitiveName(e.name)) out.push(rel)
      continue
    }
    if (lst.isDirectory()) {
      collectSensitive(root, rel, out)
      continue
    }
    if (lst.isFile() && isSensitiveName(e.name)) out.push(rel)
  }
  return out
}

function toRelPath(cwd, item) {
  const text = String(item).replace(/\\/g, '/').replace(/^\.\//, '')
  if (isAbsolute(item)) {
    const rel = relative(cwd, item)
    if (rel && !rel.startsWith('..') && !isAbsolute(rel)) return rel.split(sep).join('/')
  }
  return text
}

/** git check-ignore：0 有命中，1 全未忽略，其余都是未判定。 */
function checkIgnore(cwd, relPaths) {
  const query = relPaths.map((p) => p.replace(/\\/g, '/'))
  const r = spawnSync(
    gitBinary(),
    ['-c', 'safe.directory=*', '-C', cwd, 'check-ignore', '--stdin', '-z'],
    {
      cwd,
      input: `${query.join('\0')}\0`,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 20000,
    },
  )
  if (r.error || (r.status !== 0 && r.status !== 1)) return { ok: false }
  const ignored = new Set(
    (r.stdout || '')
      .split('\0')
      .filter(Boolean)
      .map((item) => toRelPath(cwd, item)),
  )
  return { ok: true, ignored }
}

/**
 * DBG-96：只把「被忽略」的敏感文件当删除障碍。status 看不见它们。
 * check-ignore 失败则未判定，同样拒绝（失效方向是多留，不是多删）。
 */
function findSensitiveIgnored(target) {
  let named = []
  try {
    named = collectSensitive(target).sort()
  } catch {
    return {
      blocked: true,
      files: [],
      reason: '拒绝删除：敏感文件枚举失败，未判定，默认不删除',
    }
  }
  if (named.length === 0) return { blocked: false, files: [] }
  const probe = checkIgnore(target, named)
  if (!probe.ok) {
    return {
      blocked: true,
      files: named,
      reason: `拒绝删除：发现敏感文件名（.env/私钥/证书），但 git check-ignore 未判定，默认不删除：${named.join('、')}`,
    }
  }
  const ignored = named.filter((n) => probe.ignored.has(n))
  if (ignored.length === 0) return { blocked: false, files: [] }
  return {
    blocked: true,
    files: ignored,
    reason: `拒绝删除：存在被忽略的敏感文件（.env/私钥/证书），默认不自动删除：${ignored.join('、')}`,
  }
}

function reapOne(raw, opts = {}) {
  const apply = opts.apply === true
  const verdict = classifyReclaimTarget(raw, opts.anchors)
  if (!verdict.ok) return { action: 'refuse', reason: verdict.reason, target: verdict.target, files: [] }
  const target = verdict.target
  if (!existsSync(target)) return { action: 'skip', reason: '路径不存在', target, files: [] }
  const secrets = findSensitiveIgnored(target)
  if (secrets.blocked) {
    return { action: 'refuse', reason: secrets.reason, target, files: secrets.files }
  }
  // assume* 只给测试把合并/干净/判活垫成通过。包含性与敏感文件没有对应开关，命令行也不传。
  const merged = opts.assumeMerged === true ? true : isMerged(target)
  if (!merged) return { action: 'skip', reason: 'HEAD 未并入 origin/main', target, files: [] }
  const clean = opts.assumeClean === true ? true : isClean(target)
  if (!clean) return { action: 'skip', reason: '工作区不干净（有未提交改动）', target, files: [] }
  const act = opts.assumeActivity ?? checkActivity(target, opts.now)
  if (!act.quiet) {
    return {
      action: 'skip',
      reason: `双判活未通过（近1h写入=${act.recentWrites}，进程=${act.processes.length}）`,
      target,
      files: [],
    }
  }
  if (!apply) {
    return {
      action: 'dry-run',
      reason: '路径包含、敏感忽略文件、合并、工作区与双判活全部通过，可删',
      target,
      files: [],
    }
  }
  if (typeof opts.onBeforeDelete === 'function') opts.onBeforeDelete(target)
  const links = collectReparse(target)
  for (const l of links) unlinkSync(l) // 只删链接本身，绝不递归跟随
  rmSync(target, { recursive: true, force: false })
  git(['worktree', 'prune'])
  return { action: 'removed', links: links.length, target, files: [] }
}

function cleanCache(root, apply = false) {
  const hits = []
  const walk = (dir) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const p = join(dir, e.name)
      let lst
      try {
        lst = lstatSync(p)
      } catch {
        continue
      }
      if (lst.isSymbolicLink()) continue
      if (!lst.isDirectory()) continue
      if (e.name === 'node_modules') continue
      if (CACHE_DIR_NAMES.has(e.name)) {
        hits.push(p)
        continue
      }
      walk(p)
    }
  }
  walk(root)
  if (apply) for (const p of hits) rmSync(p, { recursive: true, force: true })
  return hits
}

function createWorktree(name, apply = false) {
  const target = join(DEFAULT_WT_ROOT, name)
  if (existsSync(target)) throw new Error(`目标已存在：${target}`)
  const branch = `wt/${name}`
  const cmd = ['worktree', 'add', '-b', branch, target, 'origin/main']
  if (!apply) return { action: 'dry-run', target, branch, cmd: `git ${cmd.join(' ')}` }
  if (git(cmd).status !== 0) throw new Error('git worktree add 失败')
  const link = (src, dst) => {
    if (!existsSync(src) || existsSync(dst)) return 0
    symlinkSync(src, dst, 'junction')
    return 1
  }
  let linked = link(join(ROOT, 'node_modules'), join(target, 'node_modules'))
  for (const base of ['apps', 'packages']) {
    const b = join(ROOT, base)
    if (!existsSync(b)) continue
    for (const e of readdirSync(b, { withFileTypes: true })) {
      if (!e.isDirectory()) continue
      const src = join(b, e.name, 'node_modules')
      if (existsSync(src)) linked += link(src, join(target, base, e.name, 'node_modules'))
    }
  }
  return { action: 'created', target, branch, junctions: linked }
}

function selfTest() {
  const failures = []
  const base = mkdtempSync(join(tmpdir(), 'wt-guard-'))
  const now = Date.now()
  const active = join(base, 'active')
  const quiet = join(base, 'quiet')
  mkdirSync(active, { recursive: true })
  mkdirSync(quiet, { recursive: true })
  writeFileSync(join(active, 'fresh.txt'), 'fresh')
  const oldFile = join(quiet, 'old.txt')
  writeFileSync(oldFile, 'old')
  const t = (now - 2 * ACTIVITY_WINDOW_MS) / 1000
  utimesSync(oldFile, t, t)

  // 反向例 1：刚写过的目录必须判为 active（quiet=false）
  if (checkActivity(active, now).quiet) failures.push('刚写过的目录被误判为 quiet')
  // 反向例 2：2 小时前的目录必须判为 quiet
  if (!checkActivity(quiet, now).quiet) failures.push('2 小时前的目录被误判为 active')
  // 反向例 3：junction 摘链只删链接，目标必须存活
  const shared = join(base, 'shared')
  mkdirSync(shared, { recursive: true })
  const j = join(base, 'junction-case')
  mkdirSync(j, { recursive: true })
  symlinkSync(shared, join(j, 'node_modules'), 'junction')
  for (const l of collectReparse(j)) unlinkSync(l)
  if (!existsSync(shared)) failures.push('摘 junction 时误删了链接目标')
  if (existsSync(join(j, 'node_modules'))) failures.push('junction 链接未被摘除')

  rmSync(base, { recursive: true, force: true })
  if (failures.length) {
    console.error(`SELFTEST FAIL: ${failures.join(' | ')}`)
    return 1
  }
  console.log('SELFTEST PASS: active/quiet 双态 + junction 摘链三条反向例全部符合')
  return 0
}

async function main() {
  const argv = process.argv.slice(2)
  const apply = argv.includes('--apply')
  const argOf = (flag) => argv[argv.indexOf(flag) + 1]

  if (argv.includes('--self-test')) process.exit(selfTest())

  if (argv.includes('--check')) {
    const p = resolve(argOf('--check'))
    const act = checkActivity(p)
    console.log(JSON.stringify({ path: p, ...act }, null, 2))
    process.exit(act.quiet ? 0 : 1)
  }

  if (argv.includes('--reclaim')) {
    const raw = argOf('--reclaim')
    try {
      const result = reapOne(raw, { apply })
      console.log(JSON.stringify(result, null, 2))
      if (result.action === 'refuse') process.exit(1)
    } catch (e) {
      console.error(`RECLAIM FAIL: ${e.message}`)
      process.exit(1)
    }
    process.exit(0)
  }

  if (argv.includes('--clean-cache')) {
    const p = resolve(argOf('--clean-cache'))
    console.log(JSON.stringify({ path: p, hits: cleanCache(p, apply), applied: apply }, null, 2))
    process.exit(0)
  }

  if (argv.includes('--create')) {
    try {
      console.log(JSON.stringify(createWorktree(argOf('--create'), apply), null, 2))
    } catch (e) {
      console.error(`CREATE FAIL: ${e.message}`)
      process.exit(1)
    }
    process.exit(0)
  }

  console.log(
    'worktree-reclaim-guard: 用 --check <path> / --create <名> / --reclaim <名|path> / --clean-cache <path> / --self-test，加 --apply 才落盘',
  )
}

export const __test__ = {
  ROOT,
  classifyReclaimTarget,
  findSensitiveIgnored,
  isClean,
  isSensitiveName,
  reapOne,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
