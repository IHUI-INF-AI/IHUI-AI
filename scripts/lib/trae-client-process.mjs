// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

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
 * 以桌面用户身份重新拉起客户端。三条通道,按顺序试,每条起完都**验进程活着**才算数:
 *   1. 服务身份 → run-as-user.ps1 -NoWait(CreateProcessAsUser + 用户环境块);
 *   2. 非服务身份 → detached spawn(带 exe 所在目录当 cwd);
 *   3. 前两条**抛错**或发起了但 3 秒内量不到进程 → **shell 通道 `explorer.exe <exe>`**(等同人工双击)。
 *
 * 第 3 条不是兜底摆设:2026-10-28 实测 Loomy 在"由脚本/服务派生"的语境下,1、2 两条都会让它
 * 在 Electron 主进程启动**之前**就退出码 0 消失(连它自己第一行启动日志都不写、无崩溃转储),
 * 而同样的两条通道起 notepad 都能活着 ⇒ 不是通道起不了 GUI 进程,是这个客户端要 shell 语义的启动。
 * 人"双击能打开、脚本打不开"就是这个差别的现场。
 *
 * 第 1/2 条**抛错**也必须落到第 3 条:助手在权限不足或脚本自身报错时抛异常,旧写法被外层
 * catch 直接收成"拉不起来",于是"换一条通道再试"这格整条是空的(实测把 env 换成服务身份跑
 * 一次 notepad 就复现:helper 抛 CreateProcessAsUser 失败,客户端一个都没试过第二条)。
 * 但抛错之前先验一次进程 —— 包装器被杀而子进程已起是真实存在的一型,重复起等于给用户多开一个实例。
 *
 * 探测取不到(任务列表读不回)⇒ 按未判定放行,绝不把"没量到"读成"没起来"(§0.3)。
 * @returns {{launched:boolean, error:string, via:string}}
 */
export function launchProduct(exePath, opts = {}) {
  const env = opts.env ?? process.env
  if (!exePath || !fs.existsSync(exePath)) return { launched: false, error: '拿不到客户端可执行文件路径', via: '' }
  const helper = opts.helperPath ?? ''
  const run = opts.run ?? execFileSync
  const waitMs = Number(opts.verifyWaitMs ?? 6000)
  const product = String(opts.product ?? '').trim()
  const probe = opts.probe ?? (() => listProductPids(product, env))
  /**
   * 起了没:给了产品名就在预算窗口内**反复**看 pid 面,看到就算数。
   * 反复而不是"到点采一次":2026-10-28 实测真起 notepad 时,3 秒那一次采样扑空 ⇒ 判"没起来",
   * 而进程紧接着就出现了 —— GUI 冷启动快慢差几倍,单次采样会把"起得慢"读成"没起来",
   * 连带让下面第三条通道白跑一次(给用户多开一个实例)。
   * 任一次采样读不回(null)⇒ 按未判定放行,绝不把"没量到"读成"没起来"(§0.3)。
   */
  const verify = () => {
    if (!product || !(waitMs > 0)) return { launched: true, error: '' }
    const deadline = Date.now() + waitMs
    let unreadable = false
    for (;;) {
      const pids = probe()
      if (pids === null) unreadable = true
      else if (pids.length > 0) return { launched: true, error: '' }
      const left = deadline - Date.now()
      if (left <= 0) break
      sleepSync(Math.min(300, left))
    }
    if (unreadable) return { launched: true, error: '' }
    return { launched: false, error: `已发起启动,但 ${Math.round(waitMs / 1000)} 秒内没检测到客户端进程` }
  }
  /** 主通道(1 或 2)的统一收口:发起 → 验;抛错 → 先验(可能子进程已起)再判失败,失败原因点名是哪条通道 */
  const verifiable = Boolean(product) && waitMs > 0
  const primary = (kind, start) => {
    let threw = null
    try {
      start()
    } catch (e) {
      threw = e instanceof Error ? e.message : String(e)
    }
    if (!verifiable) {
      // 没有产品名可验时,抛错只能按失败如实回报 —— 不许把"没验"写成"起好了"(§0.3)
      // 并且**不再试 shell**:验不到"到底起没起",再发起一次等于可能给用户多开一个实例
      return threw
        ? { launched: false, stopFallback: true, error: `主通道(${kind})发起失败:${threw}`, via: kind }
        : { launched: true, error: '', via: kind }
    }
    const checked = verify()
    if (checked.launched) return { launched: true, error: '', via: kind }
    return { launched: false, error: threw ? `主通道(${kind})发起失败:${threw}` : checked.error, via: kind }
  }
  const serviceIdentity =
    /\\systemprofile(\\|$)/i.test(String(env.USERPROFILE ?? '')) ||
    /\\ServiceProfiles(\\|$)/i.test(String(env.USERPROFILE ?? '')) ||
    /(\$|^system$|^local service$|^network service$)/i.test(String(env.USERNAME ?? '').toLowerCase())
  try {
    let first
    if (serviceIdentity && helper && fs.existsSync(helper)) {
      first = primary('helper', () =>
        run(
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
        ),
      )
    } else {
      first = primary('spawn', () => {
        const child = spawn(exePath, [], {
          cwd: path.dirname(exePath),
          detached: true,
          stdio: 'ignore',
          windowsHide: false,
        })
        child.unref()
      })
    }
    if (first.launched) return first
    if (first.stopFallback) return { launched: false, error: first.error, via: first.via }
    return viaShell(first.error)
  } catch (e) {
    return { launched: false, error: e instanceof Error ? e.message : String(e), via: '' }
  }

  /** 第三条通道:交给 shell(explorer)起,语义等同人工双击;**起完照样验进程**,不认"发起成功" */
  function viaShell(firstError) {
    try {
      run('explorer.exe', [exePath], { windowsHide: true, timeout: 15_000, env })
    } catch (e) {
      return {
        launched: false,
        error: `${firstError};shell 通道发起失败(${e instanceof Error ? e.message : String(e)})`,
        via: 'primary+shell',
      }
    }
    const second = verify()
    if (second.launched) return { launched: true, error: '', via: 'shell' }
    return { launched: false, error: `${firstError};${second.error}`, via: 'primary+shell' }
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
