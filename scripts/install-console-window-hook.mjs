#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 安装/卸载"机器级禁弹窗"钩子:把 windows-hide-default.cjs 装到仓库外的稳定目录,
// 并通过用户环境变量 NODE_OPTIONS=--import=file:///... 让本机每个 node 进程默认 windowsHide=true。
//
//   node scripts/install-console-window-hook.mjs            # 巡检(不写盘)
//   node scripts/install-console-window-hook.mjs --verify   # 同上
//   node scripts/install-console-window-hook.mjs --apply    # 安装(写文件 + 写 HKCU 环境变量)
//   node scripts/install-console-window-hook.mjs --remove   # 卸载(恢复原 NODE_OPTIONS)
//
// 为什么放仓库外:NODE_OPTIONS 指向的文件若不存在,本机 **所有** node 进程会直接启动失败。
// 因此钩子不进仓库(仓库被移动/删除/重装不影响),且落盘前必须试跑通过。
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const LOADER_SRC = join(REPO_ROOT, 'scripts', 'lib', 'windows-hide-default.mjs')
const LOADER_NAME = 'windows-hide-default.mjs'
const LOADER_STEM = 'windows-hide-default'
// 探针/暂存副本必须沿用同一扩展名:.mjs 是 ESM,写成 .cjs 会被按 CJS 解析而加载失败
const LOADER_EXT = `.${LOADER_NAME.split('.').pop()}`
const ENV_NAME = 'NODE_OPTIONS'

const mode = process.argv.includes('--apply') ? 'apply' : process.argv.includes('--remove') ? 'remove' : 'verify'
const pwsh = process.platform === 'win32' ? 'pwsh.exe' : null

function log(level, msg) {
  const icon = { info: '·', ok: '✅', warn: '⚠️', err: '❌' }[level]
  console.log(`${icon} ${msg}`)
}

// ─── 钩子目录:仓库外的稳定位置 ────────────────────────────────
// 优先 IHUI_NODE_HOOKS_DIR;否则取 TEMP 的上级(本机 = D:\caches\Temp → D:\caches),
// 与既有 D:\caches\ihui-scripts 同级同构;再退到用户主目录。
function resolveHooksDir() {
  if (process.env.IHUI_NODE_HOOKS_DIR) return resolve(process.env.IHUI_NODE_HOOKS_DIR)
  const parent = resolve(tmpdir(), '..')
  if (existsSync(parent)) return join(parent, 'ihui-node-hooks')
  return join(homedir(), '.ihui-node-hooks')
}

const hooksDir = resolveHooksDir()
const loaderDst = join(hooksDir, LOADER_NAME)
const backupFile = join(hooksDir, 'node-options-backup.json')
const importToken = `--import=${pathToFileURL(loaderDst).href}`

// ─── 读写用户级环境变量(pwsh 走 .NET,自带 WM_SETTINGCHANGE 广播) ─────
function readUserEnv() {
  if (!pwsh) return process.env[ENV_NAME] ?? ''
  const r = spawnSync(
    pwsh,
    ['-NoProfile', '-NonInteractive', '-Command', `[Environment]::GetEnvironmentVariable('${ENV_NAME}','User')`],
    { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  return r.status === 0 ? r.stdout.replace(/\r?\n$/, '') : ''
}

// PowerShell 单引号字面量(不插值),内部单引号翻倍转义 —— 规避路径空格/特殊字符
const psQuote = (s) => `'${String(s).replace(/'/g, "''")}'`

// -EncodedCommand 要求 **UTF-16LE** base64;按 UTF-8 编会得到乱码命令(PowerShell 报"无法识别")
function runPwsh(script) {
  const b64 = Buffer.from(script, 'utf16le').toString('base64')
  return spawnSync(pwsh, ['-NoProfile', '-NonInteractive', '-EncodedCommand', b64], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function writeUserEnv(value) {
  if (!pwsh) throw new Error('非 Windows 平台不支持用户级环境变量写入')
  const r = runPwsh(`[Environment]::SetEnvironmentVariable(${psQuote(ENV_NAME)}, ${psQuote(value)}, 'User')`)
  if (r.status !== 0) throw new Error(`写入用户环境变量失败: ${(r.stderr || r.stdout || `exit ${r.status}`).trim()}`)
}

function removeUserEnv() {
  const r = runPwsh(`[Environment]::SetEnvironmentVariable(${psQuote(ENV_NAME)}, $null, 'User')`)
  if (r.status !== 0) throw new Error(`清除用户环境变量失败: ${(r.stderr || r.stdout).trim()}`)
}

// 把我们的 --import token 合并进已有 NODE_OPTIONS(幂等:已存在则原位替换)
function mergeToken(existing) {
  const parts = (existing || '').split(/\s+/).filter(Boolean)
  const kept = parts.filter((p) => !isOurToken(p))
  return [...kept, importToken].join(' ')
}

function stripToken(existing) {
  return (existing || '')
    .split(/\s+/)
    .filter(Boolean)
    .filter((p) => !isOurToken(p))
    .join(' ')
}

function isOurToken(p) {
  // 按**无扩展名主干**匹配:历史版本曾落过 .cjs,若只认 .mjs 会把旧 token 当外人留下,
  // 而 .cjs 文件已被删除 → NODE_OPTIONS 指向不存在文件会让本机所有 node 进程启动失败。
  return p.startsWith('--import=') && p.includes(LOADER_STEM)
}

function hasOurToken(value) {
  return (value || '').split(/\s+/).filter(Boolean).some(isOurToken)
}

// ─── 安全闸:落盘前必须实测"装了钩子的 node 能正常启动且钩子确实生效" ─────
function smokeTest(candidateEnv, targetLoader) {
  if (!existsSync(targetLoader)) return { ok: false, why: `钩子文件不存在: ${targetLoader}` }
  const probe = [
    'const cp=require("node:child_process");',
    'const hit=["spawn","spawnSync","exec","execSync","execFile","execFileSync","fork"].filter(n=>cp[n]&&cp[n].__ihuiWindowsHidePatch);',
    'if(hit.length!==7){console.error("未生效: "+hit.join(","));process.exit(3)}',
    'console.log("patched="+hit.length)',
  ].join('')
  const r = spawnSync(process.execPath, ['-e', probe], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_OPTIONS: candidateEnv },
    timeout: 30_000,
  })
  if (r.status !== 0) {
    return { ok: false, why: `带候选 NODE_OPTIONS 的 node 启动失败(exit ${r.status}): ${(r.stderr || r.stdout || '').trim().slice(0, 300)}` }
  }
  return { ok: true, out: r.stdout.trim() }
}

function main() {
  log('info', `模式: ${mode} | 钩子目录: ${hooksDir}`)

  if (!existsSync(LOADER_SRC)) {
    log('err', `找不到钩子源文件: ${LOADER_SRC}`)
    process.exit(1)
  }
  const src = readFileSync(LOADER_SRC, 'utf8')
  const existing = readUserEnv() || ''
  const installed = existsSync(loaderDst) && readFileSync(loaderDst, 'utf8') === src
  const currentHasToken = hasOurToken(existing)

  log('info', `NODE_OPTIONS(用户级)= ${existing ? `[${existing}]` : '<未设置>'}`)
  log('info', `钩子文件: ${loaderDst} ${existsSync(loaderDst) ? (installed ? '(与源一致)' : '(与源不一致,需更新)') : '(不存在)'}`)
  log('info', `注册表 token: ${currentHasToken ? '已装载' : '未装载'}`)

  if (mode === 'remove') {
    const restored = stripToken(existing)
    if (!currentHasToken) {
      log('ok', '未装载钩子,无需卸载')
      return
    }
    if (existsSync(loaderDst)) {
      mkdirSync(hooksDir, { recursive: true })
      writeFileSync(
        backupFile,
        JSON.stringify({ ts: new Date().toISOString(), previousNodeOptions: existing, restored }, null, 2),
        'utf8',
      )
    }
    if (restored) {
      writeUserEnv(restored)
      log('ok', `NODE_OPTIONS 已恢复为: [${restored}]`)
    } else {
      removeUserEnv()
      log('ok', 'NODE_OPTIONS 已清除(原本只含我们的 token)')
    }
    log('warn', `钩子文件保留在 ${loaderDst},确认无用了可手动删除。已运行的进程/IDE 需重启才生效。`)
    return
  }

  const desired = mergeToken(existing)
  const needFile = !installed
  const needEnv = existing !== desired

  if (!needFile && !needEnv) {
    // 已就位:仍跑一次冒烟,确认钩子真的生效(可能源文件变了但内容指纹相同以外的情形)
    const sm = smokeTest(desired, loaderDst)
    if (!sm.ok) {
      log('err', `已标记装载,但冒烟失败 → ${sm.why}`)
      process.exit(1)
    }
    log('ok', `钩子已生效(${sm.out})。提示:已在运行的 node/IDE 进程不会回溯生效,需重启。`)
    return
  }

  log('info', `待办:${needFile ? ' 写入钩子文件' : ''}${needEnv ? ' 更新 NODE_OPTIONS' : ''}`)

  if (mode === 'verify') {
    log('warn', '巡检模式:未写盘。执行 --apply 安装(会先备份原 NODE_OPTIONS 到 ' + backupFile + ')')
    // 巡检也做一次冒烟,提前暴露不兼容
    mkdirSync(hooksDir, { recursive: true })
    const tmpProbe = join(hooksDir, `.probe-${process.pid}${LOADER_EXT}`)
    writeFileSync(tmpProbe, src, 'utf8')
    try {
      const probeDesired = mergeToken(existing).replace(
        pathToFileURL(loaderDst).href,
        pathToFileURL(tmpProbe).href,
      )
      const sm = smokeTest(probeDesired, tmpProbe)
      log(sm.ok ? 'ok' : 'err', `预演冒烟: ${sm.ok ? `通过(${sm.out})` : `失败 → ${sm.why}`}`)
      if (!sm.ok) process.exitCode = 1
    } finally {
      try {
        execFileSync('cmd.exe', ['/c', 'del', '/f', '/q', tmpProbe], { windowsHide: true, stdio: 'ignore' })
      } catch {
        /* 清理失败不影响结论 */
      }
    }
    return
  }

  // ─── apply:先备份 → 试跑 → 才落盘 ──────────────────────────
  mkdirSync(hooksDir, { recursive: true })
  const tmpLoader = join(hooksDir, `.staged-${process.pid}${LOADER_EXT}`)
  writeFileSync(tmpLoader, src, 'utf8')
  const stagedDesired = mergeToken(existing).replace(pathToFileURL(loaderDst).href, pathToFileURL(tmpLoader).href)
  const sm = smokeTest(stagedDesired, tmpLoader)
  try {
    execFileSync('cmd.exe', ['/c', 'del', '/f', '/q', tmpLoader], { windowsHide: true, stdio: 'ignore' })
  } catch {
    /* 清理失败不影响结论 */
  }
  if (!sm.ok) {
    log('err', `试跑未通过,**拒绝写入**任何配置 → ${sm.why}`)
    process.exit(1)
  }
  log('ok', `试跑通过(${sm.out}),开始落盘`)

  writeFileSync(
    backupFile,
    JSON.stringify({ ts: new Date().toISOString(), previousNodeOptions: existing, desired }, null, 2),
    'utf8',
  )
  copyFileSync(LOADER_SRC, loaderDst)
  writeUserEnv(desired)
  const recheck = smokeTest(readUserEnv() || desired, loaderDst)
  if (!recheck.ok) {
    log('err', `落盘后复验失败 → ${recheck.why}`)
    log('warn', `紧急回滚: reg delete "HKCU\\Environment" /v ${ENV_NAME} /f   (原值备份在 ${backupFile})`)
    process.exit(1)
  }
  log('ok', `已安装。NODE_OPTIONS= [${desired}]`)
  log('warn', '正在运行的 node / IDE / agent 宿主不会回溯生效 —— 需重启后其新派生进程才静默。')
  log('info', `随时卸载: node scripts/install-console-window-hook.mjs --remove`)
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
