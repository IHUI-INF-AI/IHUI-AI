// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 本机 Trae 客户端进程探测 / 优雅关闭 / 重新拉起(2026-10-28 立)。
 *
 * 立因(实测):客户端是 Electron/VS Code 系,登录态在**进程内存**里,storage.json 只是
 * 落盘快照 —— 运行中写进去的新信封,会在客户端退出时被它自己的 onWillSaveState 用旧
 * 内存态刷回。2026-10-28 02:15 的 storage.json 仍由在跑的 Trae CN 改写,正是这条链:
 * 用户点「登录本机」→ 写盘成功 → 关客户端 → 客户端退出时覆写 → 重开还是旧号,表现为
 * 「实测不好使」。
 *
 * 所以写回端的次序必须是:探测 → 优雅关闭(等它自己落完盘)→ 写 → 自检 → 重新拉起。
 * 只发 WM_CLOSE(taskkill 不带 /F),等同用户点右上角关闭;客户端自己负责热退出与保存。
 *
 * 服务身份(LocalSystem)下:探测/关闭用 tasklist/taskkill(跨会话可用);
 * 重新拉起必须换桌面用户身份(CreateProcessAsUser),由 apps/api/scripts/run-as-user.ps1 执行。
 */
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/** 已知 Trae 产品(与 trae-auth-extract 的 traeUserDataDirs 三档同名) */
export const TRAE_PRODUCTS = Object.freeze(['Trae CN', 'TRAE SOLO CN', 'Trae'])

/** 探测/关闭总开关:测试或极端环境可关(关掉后运行中写回会被客户端覆写,仅用于诊断) */
function processControlEnabled(env) {
  return String(env.IHUI_TRAE_PROCESS_CONTROL ?? '').trim() !== '0'
}

/** 同步等待:Atomics.wait 阻塞当前线程但不 fork 子进程(旧实现每次都 fork 一个 node,15 秒能起上千个) */
function sleepSync(ms) {
  if (!(ms > 0)) return
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** 数据目录名 → 已知产品名(大小写不敏感);不匹配 ⇒ '' */
export function productOfDir(dirName) {
  const lower = String(dirName ?? '').trim().toLowerCase()
  return TRAE_PRODUCTS.find((p) => p.toLowerCase() === lower) ?? ''
}

/**
 * 某产品的在跑进程 pid 列表。
 * tasklist 在 SYSTEM 身份下也能看到桌面用户会话的进程(PS 的 Get-Process 同名口径)。
 * 命令失败 ⇒ null(**未知**,不是"没在跑")—— 调用方据此拒绝盲写。
 */
export function listProductPids(product, env = process.env) {
  if (!processControlEnabled(env)) return []
  const image = `${product}.exe`
  let out
  try {
    out = execFileSync('tasklist.exe', ['/FI', `IMAGENAME eq ${image}`, '/FO', 'CSV', '/NH'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 8000,
      env,
    })
  } catch {
    return null
  }
  const pids = []
  for (const line of String(out).split(/\r?\n/)) {
    const m = /^"([^"]+)","(\d+)"/.exec(line.trim())
    if (!m) continue
    if (m[1].toLowerCase() !== image.toLowerCase()) continue
    pids.push(Number(m[2]))
  }
  return pids
}

/**
 * 宿主解释器/终端进程映像名(小写):它们的**可执行文件路径**常落在带产品关键字的目录里
 * (例如本仓库源码路径含 zcode/qoder 字样),但绝不是客户端本体 —— 按路径兜底时必须排除,
 * 否则会把用户正在跑的 node/pwsh 脚本当客户端去关。
 */
const HOST_PROCESS_IMAGES = new Set([
  'node.exe',
  'pwsh.exe',
  'powershell.exe',
  'cmd.exe',
  'conhost.exe',
  'python.exe',
  'pythonw.exe',
  'wsl.exe',
  'bash.exe',
  'git.exe',
  'windowsterminal.exe',
  'wt.exe',
])

/** 按路径关键字筛进程(纯函数,单测直打;规则见 listProcessesByPath 头注) */
export function matchProcessesByPath(rows, hints) {
  const list = (hints ?? []).map((h) => String(h ?? '').trim().toLowerCase()).filter(Boolean)
  if (list.length === 0) return []
  const out = []
  for (const r of rows ?? []) {
    const exe = String(r?.ExecutablePath ?? '')
    if (!exe) continue
    if (HOST_PROCESS_IMAGES.has(String(r?.Name ?? '').toLowerCase())) continue
    const lower = exe.toLowerCase()
    if (!list.some((h) => lower.includes(h))) continue
    out.push({
      image: String(r.Name ?? '').replace(/\.exe$/i, ''),
      pid: Number(r.ProcessId),
      exePath: exe,
      commandLine: String(r.CommandLine ?? ''),
    })
  }
  return out
}

/**
 * 按「可执行文件路径含产品关键字」枚举进程(2026-10-28 补)。
 *
 * 立因:同一产品的不同发行版/版本,映像名未必在已知候选内(codearts 的实测映像名一直
 * 没能证实、Qoder 国内版/国际版命名不同)。精确映像名全落空时若直接判"没在跑",就会
 * 在客户端运行时盲写 —— 客户端退出时用内存态覆写落点,表现正是用户反馈的"不好使"。
 *
 * 返回 null = 探测失败(未判定),调用方据此拒绝盲写;[] = 确实没在跑。
 */
export function listProcessesByPath(hints, env = process.env) {
  if (!processControlEnabled(env)) return []
  const list = (hints ?? []).map((h) => String(h ?? '').trim()).filter(Boolean)
  if (list.length === 0) return []
  const ps = powershellPath(env)
  const script = [
    "$ErrorActionPreference='SilentlyContinue';",
    '[Console]::OutputEncoding=[Text.Encoding]::UTF8;',
    'Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath }',
    ' | Select-Object Name,ProcessId,ExecutablePath,CommandLine',
    ' | ConvertTo-Json -Compress',
  ].join('')
  let out
  try {
    out = execFileSync(
      ps,
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { encoding: 'utf8', windowsHide: true, timeout: 20_000, env },
    )
  } catch {
    return null
  }
  let parsed
  try {
    parsed = JSON.parse(String(out).trim() || 'null')
  } catch {
    return null
  }
  const rows = Array.isArray(parsed) ? parsed : parsed ? [parsed] : []
  return matchProcessesByPath(rows, list)
}

function powershellPath(env = process.env) {
  const override = String(env.IHUI_PWSH_PATH ?? '').trim()
  if (override && fs.existsSync(override)) return override
  const pf = String(env.ProgramFiles ?? '').trim() || 'C:\\Program Files'
  for (const rel of [
    ['PowerShell', '7', 'pwsh.exe'],
    ['PowerShell', '6', 'pwsh.exe'],
  ]) {
    const candidate = path.join(pf, ...rel)
    if (fs.existsSync(candidate)) return candidate
  }
  return path.join(env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
}

/**
 * 主进程可执行文件路径(用于关闭后原样拉起)。
 * 取 Win32_Process 里**不含 `--type=`** 的那个(Electron 子进程都带该参数),拿不到再按
 * 常见安装根兜底;全失败 ⇒ ''(调用方如实回报"已关闭但未能自动拉起")。
 */
export function resolveProductExe(product, env = process.env) {
  const ps = powershellPath(env)
  const image = `${product}.exe`
  const script = [
    "$ErrorActionPreference='SilentlyContinue';",
    '[Console]::OutputEncoding=[Text.Encoding]::UTF8;',
    `Get-CimInstance Win32_Process -Filter "Name='${image.replace(/'/g, "''")}'"`,
    ' | Select-Object ProcessId,ExecutablePath,CommandLine',
    ' | ConvertTo-Json -Compress',
  ].join('')
  try {
    const out = execFileSync(
      ps,
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { encoding: 'utf8', windowsHide: true, timeout: 12_000, env },
    )
    const parsed = JSON.parse(String(out).trim() || 'null')
    const rows = Array.isArray(parsed) ? parsed : parsed ? [parsed] : []
    const main = rows.find(
      (r) => typeof r?.ExecutablePath === 'string' && r.ExecutablePath && !/--type=/.test(String(r.CommandLine ?? '')),
    )
    if (main) return main.ExecutablePath
  } catch {
    /* 兜底见下 */
  }
  const roots = []
  for (const rel of [
    ['AppData', 'Local', 'Programs', product, image],
    ['AppData', 'Local', product, image],
  ]) {
    const up = String(env.USERPROFILE ?? '').trim()
    if (up && !/\\systemprofile\\/i.test(up)) roots.push(path.join(up, ...rel))
    // 服务身份:跨 profile 找安装(与 traeUserDataDirs 同一现读判据)
    const usersRoot = path.join(String(env.SystemDrive || 'C:').replace(/[\\/]+$/, ''), 'Users')
    try {
      for (const d of fs.readdirSync(usersRoot, { withFileTypes: true })) {
        if (d.isDirectory()) roots.push(path.join(usersRoot, d.name, ...rel))
      }
    } catch {
      /* 读不到用户根 */
    }
  }
  for (const pfVar of ['ProgramFiles', 'ProgramFiles(x86)']) {
    const pf = String(env[pfVar] ?? '').trim()
    if (pf) roots.push(path.join(pf, product, image))
  }
  return roots.find((p) => fs.existsSync(p)) ?? ''
}

/**
 * 优雅关闭:对主进程发 WM_CLOSE(taskkill 不带 /F,等同点窗口关闭),等全部进程退出。
 * @returns {{wasRunning:boolean, closed:boolean, pids:number[]}}
 */
export function closeProduct(product, opts = {}) {
  const env = opts.env ?? process.env
  const waitMs = Number(opts.waitMs ?? 15_000)
  const pids = opts.pids ?? listProductPids(product, env)
  if (pids === null) return { wasRunning: false, closed: false, pids: [], unknown: true }
  if (pids.length === 0) return { wasRunning: false, closed: true, pids: [] }
  for (const pid of pids) {
    try {
      execFileSync('taskkill.exe', ['/PID', String(pid)], { windowsHide: true, timeout: 8000, env })
    } catch {
      /* 该 pid 已退出,或无权发消息 —— 由下方轮询给出最终判定 */
    }
  }
  const waitOnce = (limit) => {
    const deadline = Date.now() + limit
    while (Date.now() < deadline) {
      const now = listProductPids(product, env)
      if (now !== null && now.length === 0) return true
      sleepSync(400)
    }
    return false
  }
  if (waitOnce(waitMs)) return { wasRunning: true, closed: true, pids }
  // 托盘常驻/窗口收不到消息时再补一轮(覆盖"第一次消息被忽略"的情形),仍不退就交回人工
  for (const pid of pids) {
    try {
      execFileSync('taskkill.exe', ['/PID', String(pid)], { windowsHide: true, timeout: 8000, env })
    } catch {
      /* 同上 */
    }
  }
  if (waitOnce(Math.min(8000, waitMs))) return { wasRunning: true, closed: true, pids, forced: false }
  /**
   * 还不退:客户端被设成"关闭即最小化到托盘",或有确认弹窗没人点 —— 这时它永远不会自己退。
   * 用户已经点过「写入并替换」并在确认框里被告知先存盘,授权是明确的;不强杀等于这个功能
   * 在托盘常驻的机器上永远不可用(实测"点了没反应"的一大来源)。强杀反而更安全:
   * 客户端没机会执行退出落盘,不可能再覆写我们马上要写的 storage.json。
   */
  for (const pid of pids) {
    try {
      execFileSync('taskkill.exe', ['/PID', String(pid), '/F'], { windowsHide: true, timeout: 8000, env })
    } catch {
      /* 已退出或无权 —— 由下方轮询给出最终判定 */
    }
  }
  return { wasRunning: true, closed: waitOnce(Math.min(8000, waitMs)), pids, forced: true }
}

/**
 * 以桌面用户身份重新拉起客户端。
 * - 非服务身份:detached spawn(与用户双击等价);
 * - 服务身份:run-as-user.ps1 -NoWait(CreateProcessAsUser + 用户环境块,立即返回)。
 * @returns {{launched:boolean, error:string}}
 */
export function launchProduct(exePath, opts = {}) {
  const env = opts.env ?? process.env
  if (!exePath || !fs.existsSync(exePath)) return { launched: false, error: '拿不到客户端可执行文件路径' }
  const helper = opts.helperPath ?? ''
  /** 起了没:给了产品名就等 3 秒再看一眼 pid 面(不然 spawn 成功被安全软件吃掉也会报"已重开") */
  const verify = () => {
    const product = String(opts.product ?? '').trim()
    const wait = Number(opts.verifyWaitMs ?? 3000)
    if (!product || !(wait > 0)) return { launched: true, error: '' }
    sleepSync(wait)
    const pids = listProductPids(product, env)
    if (pids !== null && pids.length === 0) {
      return { launched: false, error: '已发起启动,但 3 秒内没检测到客户端进程(可能被安全软件拦截)' }
    }
    return { launched: true, error: '' }
  }
  const serviceIdentity =
    /\\systemprofile(\\|$)/i.test(String(env.USERPROFILE ?? '')) ||
    /\\ServiceProfiles(\\|$)/i.test(String(env.USERPROFILE ?? '')) ||
    /(\$|^system$|^local service$|^network service$)/i.test(String(env.USERNAME ?? '').toLowerCase())
  try {
    if (serviceIdentity && helper && fs.existsSync(helper)) {
      execFileSync(
        powershellPath(env),
        [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          helper,
          '-Exe',
          exePath,
          '-ArgJson',
          '[]',
          '-WorkingDirectory',
          path.dirname(exePath),
          '-NoWait',
        ],
        { windowsHide: true, timeout: 20_000, env },
      )
      return verify()
    }
    const child = spawn(exePath, [], {
      cwd: path.dirname(exePath),
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    })
    child.unref()
    return verify()
  } catch (e) {
    return { launched: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export const __test__ = {
  productOfDir,
  listProductPids,
  closeProduct,
  launchProduct,
  powershellPath,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
