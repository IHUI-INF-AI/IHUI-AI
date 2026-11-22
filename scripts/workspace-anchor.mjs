#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工作区锚点：让 Agent 客户端写死的 `<LETTER>:\IHUI-AI` 始终解析到「当前这台机器上的真仓」。
 *
 * 背景：客户端把 workspace 存成绝对路径（默认 G:\IHUI-AI），换机器/换盘后该路径失效，
 * 命令行工具直接 cwd 不存在。仓里任何代码都不得写死盘符，所以这里反过来做：
 *   1) 仓库根由脚本自身位置推导（不读配置、不写盘符）；
 *   2) 若仓在 `<盘>:\IHUI-AI`，把锚点盘符 subst 到该盘根；
 *      若仓被套在更深目录，则在系统盘建 `IHUI-AI` 目录联接指向真仓，再把锚点盘符 subst 到系统盘；
 *   3) 校验 `fs.realpath(锚点:\IHUI-AI)` 与真仓同一个物理目录，否则显式 exit 2（未判定不等于成功）。
 *
 * 用法：
 *   node scripts/workspace-anchor.mjs               # 校准一次（幂等）
 *   node scripts/workspace-anchor.mjs --verify      # 只校验
 *   node scripts/workspace-anchor.mjs --install     # 写注册表指针 + 登录自启脚本（换机跑一次）
 *   node scripts/workspace-anchor.mjs --letter H    # 改锚点盘符（客户端 workspace 变了才需要）
 */
import { existsSync, realpathSync, statSync } from 'node:fs'
import { basename, dirname, join, parse, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = (() => {
  const raw = resolve(SCRIPT_DIR, '..')
  try {
    // 脚本可能经锚点盘符被调起（G:\IHUI-AI\scripts），必须先归一成物理路径，
    // 否则会把锚点盘符当成"仓所在盘"再指向自己，subst 直接失败并把锚点删掉。
    return physicalPath(realpathSync(raw))
  } catch {
    return raw
  }
})()
const REG_KEY = 'HKCU\\Software\\IHUI\\Workspace'
const QUIET = process.argv.includes('--quiet')
const log = (...args) => {
  if (!QUIET) process.stdout.write(args.map(String).join(' ') + '\n')
}

// 非 Windows（CI / 云端 Linux）没有盘符概念，直接静默成功，避免阻断 postinstall 链
if (process.platform !== 'win32') process.exit(0)

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
function flag(name) {
  return process.argv.includes(name)
}
function run(cmd, args) {
  return spawnSync(cmd, args, { windowsHide: true, encoding: 'utf8' })
}
function norm(p) {
  return resolve(p)
    .replace(/[\\/]+$/, '')
    .toLowerCase()
}
function samePath(a, b) {
  try {
    const sa = statSync(a)
    const sb = statSync(b)
    // Windows 上 subst 盘符的 realpath 不会回落到物理路径，只能比卷/文件号
    return sa.dev === sb.dev && sa.ino === sb.ino
  } catch {
    return false
  }
}
/** 把 subst 盘符路径折算回物理路径（realpath 对 subst 不回落，必须自己折）。 */
function physicalPath(p, depth = 0) {
  if (depth > 3) return p
  const m = /^([A-Za-z]):\\(.*)$/.exec(p)
  if (!m) return p
  const target = substTarget(m[1].toUpperCase())
  if (!target) return p
  return physicalPath(join(target, m[2]), depth + 1)
}
function anchorLetter() {
  const fromArg = arg('--letter')
  if (fromArg) return fromArg.replace(':', '').toUpperCase()
  const q = run('reg', ['query', REG_KEY, '/v', 'AnchorLetter'])
  const hit = /AnchorLetter\s+REG_SZ\s+([A-Za-z])/.exec(q.stdout || '')
  return hit ? hit[1].toUpperCase() : null
}
function regSet(name, value) {
  return run('reg', ['add', REG_KEY, '/v', name, '/t', 'REG_SZ', '/d', value, '/f'])
}
function substList() {
  const r = run('cmd', ['/c', 'subst'])
  return (r.stdout || '').toString()
}
function substTarget(letter) {
  const hit = new RegExp(`^${letter}:\\\\: => (.+)$`, 'i').exec(substList().trim())
  return hit ? hit[1].trim() : null
}
function fail(msg) {
  console.error(`[anchor] ${msg}`)
  process.exit(2)
}

function canonicalPath() {
  const sysRoot = `${(process.env.SystemDrive || 'C:').replace(/[\\/]/g, '')}\\`
  return join(sysRoot, 'IHUI-AI')
}

const LETTER = anchorLetter()
const ANCHOR = LETTER ? `${LETTER}:\\IHUI-AI` : canonicalPath()

function desiredBase() {
  // 仓正好是 `<盘>:\IHUI-AI` ⇒ 直接把锚点接到该盘根
  const driveRoot = parse(REPO_ROOT).root
  if (
    basename(REPO_ROOT).toUpperCase() === 'IHUI-AI' &&
    norm(dirname(REPO_ROOT)) === norm(driveRoot)
  ) {
    return { base: driveRoot, via: 'subst-drive-root' }
  }
  // 仓在更深目录 ⇒ 系统盘上建 IHUI-AI 联接，锚点接到系统盘根
  const sysDrive = `${(process.env.SystemDrive || 'C:').replace(':', '')}:`
  const linkPath = join(`${sysDrive}\\`, 'IHUI-AI')
  if (samePath(linkPath, REPO_ROOT)) return { base: `${sysDrive}\\`, via: 'junction-exists' }
  if (existsSync(linkPath)) {
    // 可能是指向旧仓的联接；用 rmdir 只摘联接（对真目录会失败，正好拦住误删）
    const rm = run('cmd', ['/c', 'rmdir', linkPath])
    if (rm.status !== 0)
      fail(
        `${linkPath} 已存在且无法作为目录联接摘除（可能是真目录），请人工确认：${(rm.stderr || '').trim()}`,
      )
  }
  const mk = run('cmd', ['/c', 'mklink', '/J', linkPath, REPO_ROOT])
  if (mk.status !== 0) fail(`建立目录联接失败：${(mk.stderr || mk.stdout || '').trim()}`)
  return { base: `${sysDrive}\\`, via: 'junction-created' }
}

function ensureCanonical() {
  // 稳定入口 <SystemDrive>\IHUI-AI：客户端 workspace 指向该路径时，
  // 任何机器上都由这里保证它等于真仓，不再依赖盘符字母。
  const canonical = canonicalPath()
  if (samePath(canonical, REPO_ROOT)) return { state: 'ok', path: canonical }
  if (existsSync(canonical)) return { state: 'conflict', path: canonical }
  const mk = run('cmd', ['/c', 'mklink', '/J', canonical, REPO_ROOT])
  return mk.status === 0
    ? { state: 'created', path: canonical }
    : { state: 'failed', path: canonical, err: (mk.stderr || '').trim() }
}

function verify() {
  if (!existsSync(ANCHOR)) return { ok: false, why: `${ANCHOR} 不存在` }
  if (!samePath(ANCHOR, REPO_ROOT))
    return {
      ok: false,
      why: `${ANCHOR} 指向 ${realpathSync(ANCHOR)}，不是 ${realpathSync(REPO_ROOT)}`,
    }
  return { ok: true, why: 'ok' }
}

function pickNode() {
  // 登录脚本里不能写沙箱/临时 node 路径（会被清理），优先取 PATH 里的稳定 node
  const where = run('where', ['node'])
  const cands = (where.stdout || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  for (const p of cands) {
    if (!/sandbox_runtime|\\Temp\\|\.doubao\\sandbox/i.test(p) && existsSync(p)) return p
  }
  const exe = process.execPath
  return /sandbox_runtime/i.test(exe) ? 'node' : exe
}

function ensureInstalled() {
  regSet('RepoRoot', REPO_ROOT)
  if (LETTER) regSet('AnchorLetter', LETTER)
  else run('reg', ['delete', REG_KEY, '/v', 'AnchorLetter', '/f'])
  const startupDir = join(
    process.env.APPDATA || '',
    'Microsoft\\Windows\\Start Menu\\Programs\\Startup',
  )
  if (!existsSync(startupDir)) fail(`找不到启动目录：${startupDir}`)
  const nodeExe = pickNode()
  const cmd = [
    '@echo off',
    'setlocal',
    'set "REPO="',
    'set "NODE=node"',
    `for /f "tokens=3,*" %%A in ('reg query "${REG_KEY}" /v RepoRoot 2^>nul ^| findstr /i "RepoRoot"') do set "REPO=%%A"`,
    'if exist "%REPO%\\scripts\\workspace-anchor.mjs" goto :run',
    'for %%D in (C D E F H I J) do if exist "%%D:\\IHUI-AI\\scripts\\workspace-anchor.mjs" set "REPO=%%D:\\IHUI-AI"',
    'if exist "%REPO%\\scripts\\workspace-anchor.mjs" goto :run',
    'for %%D in (C D E F H I J) do for /d %%X in ("%%D:\\*") do if exist "%%X\\IHUI-AI\\scripts\\workspace-anchor.mjs" set "REPO=%%X\\IHUI-AI"',
    ':run',
    'if not exist "%REPO%\\scripts\\workspace-anchor.mjs" exit /b 0',
    `if exist "${nodeExe}" set "NODE=${nodeExe}"`,
    '"%NODE%" "%REPO%\\scripts\\workspace-anchor.mjs" --quiet',
    'exit /b 0',
    '',
  ].join('\r\n')
  const file = join(startupDir, 'ihui-workspace-anchor.cmd')
  writeFileSync(file, cmd, 'ascii')
  for (const legacy of ['ihui-g-drive.cmd']) {
    const p = join(startupDir, legacy)
    if (existsSync(p)) unlinkSync(p)
  }
  return file
}

function main() {
  const mode = flag('--verify') ? 'verify' : flag('--install') ? 'install' : 'anchor'

  if (mode === 'verify') {
    const v = verify()
    log(`[anchor] ${v.ok ? 'green' : 'red'}: ${v.why} (repo=${REPO_ROOT}, anchor=${ANCHOR})`)
    process.exit(v.ok ? 0 : 2)
  }

  // 任何一次校准都顺手把「注册表指针 + 登录自启」补齐：
  // 换机后只要在仓里跑过任意一次 pnpm install / pnpm dev / 本脚本，这台机器就自适应了。
  const file = ensureInstalled()
  if (mode === 'install') {
    log(`[anchor] 已安装：${file}`)
    log(`[anchor] 注册表指针：${REG_KEY}\\RepoRoot = ${REPO_ROOT}`)
  }

  // anchor / install 都继续走校准
  const c = ensureCanonical()
  if (c.state === 'conflict') log(`[anchor] warn: ${c.path} 已是另一个实体目录，未改动`)
  else if (c.state === 'failed') log(`[anchor] warn: 无法建立稳定入口 ${c.path}：${c.err}`)
  else log(`[anchor] canonical ${c.path}: ${c.state}`)

  if (LETTER) {
    const base = desiredBase()
    if (norm(base.base) !== norm(`${LETTER}:\\`)) {
      const current = substTarget(LETTER)
      const mappedToBase = current && norm(current) === norm(base.base)
      if (!mappedToBase) {
        if (current) run('cmd', ['/c', `subst ${LETTER}: /D`])
        const r = run('cmd', ['/c', `subst ${LETTER}: ${base.base}`])
        if (r.status !== 0) fail(`subst 失败：${(r.stderr || r.stdout || '').trim()}`)
      }
      log(`[anchor] letter ${LETTER}: -> ${base.base} (${base.via})`)
    }
  }

  const v = verify()
  if (!v.ok) fail(v.why)
  log(`[anchor] ok: ${ANCHOR} -> ${realpathSync(REPO_ROOT)}`)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
