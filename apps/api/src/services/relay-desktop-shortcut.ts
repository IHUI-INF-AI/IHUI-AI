// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 桌面「AI 客户端一键切号」快捷方式一键安装出口(2026-11-15 立)。
 *
 * 立因:安装器 scripts\install-relay-shortcut.cmd 一直只能"进仓双击"。机主要求在
 * 前端号池管理页放一个按钮一键装到本机。网页跑在浏览器沙箱里不可能自己落快捷方式,
 * 唯一诚实通路 = admin 端点驱动 api 宿主机执行仓内安装器 —— 与"登录本机"
 * (relay-local-login.ts → 写本机客户端登录态、launch 本机客户端)完全同款的
 * **同机边界**:api 与桌面不同机时,本模块如实报 unreachable,绝不谎称装好。
 *
 * 纪律:
 * - 固定 argv(pwsh -NoProfile -NonInteractive -ExecutionPolicy Bypass + 仓内 ps1
 *   的 -File),不接任何请求侧输入 ⇒ 无注入面;路径来自自身位置推导(§15 ROOT 纪律),
 *   IHUI_REPO_ROOT 覆盖口径与 relay-local-login 逐字同源;
 * - §12g:派生进程显式 stdio + windowsHide,且必须显式接管 stdout/stderr(199 门);
 * - §0.3 fail-closed:非 win32 / 安装器缺失 / pwsh 缺失 / ps1 判错,一律抛带理由的
 *   DesktopShortcutError 点名出路,不记绿也不冒"已安装"的假成功;
 * - 输出证据:ps1 每建一枚打 `OK <lnk路径>` + `Target=` / `Icon=` 行,原样解析回传
 *   (落点桌面路径本身即"装到了哪台机"的凭据,可复核可回滚:删 .lnk 即净)。
 */
const HERE = dirname(fileURLToPath(import.meta.url))

/** 与 relay-local-login.ts:38 同口径的仓库根推导(env 覆盖 + 自身位置向上取)。 */
export const DEFAULT_REPO_ROOT =
  process.env.IHUI_REPO_ROOT?.trim() || resolve(HERE, '..', '..', '..', '..')

/** 仓内安装器 ps1(唯一真相源,不在本端复制任何快捷方式判据)。 */
export const INSTALLER_PS1_REL = 'scripts/install-relay-shortcut.ps1'

const PWSH = 'pwsh'
const SPAWN_TIMEOUT_MS = 60_000

export interface InstalledShortcut {
  /** 生成的 .lnk 完整路径(含真实桌面落点,即"装到了哪台机"的证据) */
  link: string
  target: string
  icon: string
}

export interface DesktopShortcutInstallResult {
  installed: InstalledShortcut[]
  warnings: string[]
  installerExitCode: number
  /** 安装器 stdout 全文(截尾)—— 面板"查看详情"用,判据零复算 */
  rawOutput: string[]
}

/** 可携带 HTTP 状态与错误码的执行障碍(路由层据此回 409/502,不空手 500)。 */
export class DesktopShortcutError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'DesktopShortcutError'
  }
}

/** 同机边界不成立(api 宿主不是装快捷方式该去的地方):路由映射 409。 */
export class DesktopShortcutUnreachableError extends DesktopShortcutError {
  constructor(message: string, code: string) {
    super(message, code, 409)
    this.name = 'DesktopShortcutUnreachableError'
  }
}

interface SpawnOutcome {
  code: number | null
  stdout: string
  stderr: string
}

/** 真跑 pwsh 的唯一出口(测试注入假 runner,不在测试里复算判据)。 */
function runPwsh(args: string[]): Promise<SpawnOutcome> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(PWSH, args, {
      cwd: DEFAULT_REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    const out: Buffer[] = []
    const errBuf: Buffer[] = []
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn()
    }
    const timer = setTimeout(() => {
      try {
        child.kill()
      } catch {
        /* 已退出 */
      }
      finish(() =>
        rejectPromise(
          new DesktopShortcutError(`安装器超时(${SPAWN_TIMEOUT_MS}ms)未退出`, 'timeout', 502),
        ),
      )
    }, SPAWN_TIMEOUT_MS)
    child.stdout.on('data', (c: Buffer) => out.push(c))
    child.stderr.on('data', (c: Buffer) => errBuf.push(c))
    child.on('error', (e: NodeJS.ErrnoException) => {
      if (e.code === 'ENOENT') {
        finish(() =>
          rejectPromise(
            new DesktopShortcutUnreachableError(
              'api 宿主机 PATH 里没有 pwsh(PowerShell 7)。出路:装 PowerShell 7(winget install --id Microsoft.PowerShell -e),或直接在该机双击 scripts\\install-relay-shortcut.cmd。',
              'pwsh-missing',
            ),
          ),
        )
      } else {
        finish(() => rejectPromise(e))
      }
    })
    child.on('close', (code) =>
      finish(() =>
        resolvePromise({
          code,
          stdout: Buffer.concat(out).toString('utf8'),
          stderr: Buffer.concat(errBuf).toString('utf8'),
        }),
      ),
    )
  })
}

/**
 * 解析安装器 stdout:
 *   OK <lnk 路径>
 *     Target=<...>
 *     Icon=<...>
 * 结构不认识的行只进 rawOutput 不判失败(§0.3:判据必须在真跑它的那一刻才成立)。
 */
export function parseInstallerOutput(
  stdout: string,
  stderr: string,
): {
  installed: InstalledShortcut[]
  warnings: string[]
  rawOutput: string[]
} {
  const installed: InstalledShortcut[] = []
  const warnings: string[] = []
  const rawOutput: string[] = []
  let pending: InstalledShortcut | null = null
  for (const line of stdout.split(/\r?\n/)) {
    const text = line.trimEnd()
    if (!text) continue
    if (/^OK\s+\S/.test(text)) {
      if (pending) installed.push(pending)
      pending = { link: text.slice(3).trim(), target: '', icon: '' }
      continue
    }
    const target = /^Target=(.*)$/.exec(text.trim())
    if (target && pending) {
      pending.target = target[1] ?? ''
      continue
    }
    const icon = /^Icon=(.*)$/.exec(text.trim())
    if (icon && pending) {
      pending.icon = icon[1] ?? ''
      continue
    }
    rawOutput.push(text)
  }
  if (pending) installed.push(pending)
  for (const line of stderr.split(/\r?\n/)) {
    const text = line.trim()
    if (!text) continue
    if (/^(WARNING|#):/i.test(text) || text.includes('跳过') || text.includes('回退')) {
      warnings.push(text.replace(/^WARNING:\s*/i, ''))
    } else {
      rawOutput.push(text)
    }
  }
  return { installed, warnings, rawOutput }
}

/** 前置裁决(纯函数,可测):平台 → 安装器存在 → pwsh 参数。 */
export function planDesktopShortcutInstall(
  opts: {
    repoRoot?: string
    platform?: NodeJS.Platform
  } = {},
): { ps1Path: string; pwshArgs: string[] } {
  const platform = opts.platform ?? process.platform
  const repoRoot = opts.repoRoot ?? DEFAULT_REPO_ROOT
  if (platform !== 'win32') {
    throw new DesktopShortcutUnreachableError(
      `api 宿主机平台是 ${platform},没有"桌面"可落快捷方式(本功能与"登录本机"同机边界一致)。出路:在本机跑 pnpm dev 的 api 上点这个按钮,或直接在目标机双击 scripts\\install-relay-shortcut.cmd。`,
      'not-win32',
    )
  }
  const ps1Path = resolve(repoRoot, INSTALLER_PS1_REL)
  if (!existsSync(ps1Path)) {
    throw new DesktopShortcutUnreachableError(
      `api 宿主机仓库里找不到安装器:${ps1Path}。出路:确认本机 IHUI-AI 仓库完整(git pull),或显式设置 IHUI_REPO_ROOT。`,
      'installer-missing',
    )
  }
  // 安装器现只建唯一入口「AI 客户端一键切号」(旧 WorkBuddy 入口 2026-11-17 退役):
  // 固定 argv 里的 -SkipOld 已无作用,保留是为了不改这条既有机读面(安装器照旧接受该参数)。
  // 包一层 -Command 强制 stdout 为 UTF8:api 派生的 pwsh 无控制台,默认码页会吃掉中文路径
  // (§5f 实测同型:cmd 写管道按 OEM 码页,Node 按 utf8 解会静默改写)。
  const inner = [
    '[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false);',
    `& '${ps1Path.replace(/'/g, "''")}' -SkipOld;`,
    'exit $LASTEXITCODE',
  ].join(' ')
  return {
    ps1Path,
    pwshArgs: ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', inner],
  }
}

export async function installDesktopShortcut(
  opts: {
    repoRoot?: string
    platform?: NodeJS.Platform
    runner?: (args: string[]) => Promise<SpawnOutcome>
  } = {},
): Promise<DesktopShortcutInstallResult> {
  const { pwshArgs } = planDesktopShortcutInstall(opts)
  const runner = opts.runner ?? runPwsh
  const outcome = await runner(pwshArgs)
  const { installed, warnings, rawOutput } = parseInstallerOutput(outcome.stdout, outcome.stderr)
  if (outcome.code !== 0) {
    const tail = [outcome.stderr.trim(), ...rawOutput].filter(Boolean).slice(-3).join(' / ')
    throw new DesktopShortcutError(
      `安装器退出码 ${outcome.code ?? '(被信号终止)'}:${tail || '无输出'}。桌面未确认落档,可看仓内 scripts\\install-relay-shortcut.cmd 手动重试。`,
      'installer-failed',
      502,
    )
  }
  return { installed, warnings, installerExitCode: outcome.code, rawOutput }
}

export const __test__ = {
  planDesktopShortcutInstall,
  parseInstallerOutput,
  runPwsh,
  DEFAULT_REPO_ROOT,
  INSTALLER_PS1_REL,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
