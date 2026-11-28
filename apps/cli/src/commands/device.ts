// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ihui device — 把这台电脑接入跨设备执行器(G2,2026-11-25)。
 *
 * 四步闭环(pair → start → 执行 → 收口):
 *  1. 手机/网页「设置-设备」签发 8 位配对码(5 分钟、单次);
 *  2. 本机 `ihui device pair <code>` 兑换设备令牌,绑定执行体指纹与工作区白名单;
 *  3. `ihui device start` 常驻:心跳续期 + 认领任务 + 本地 Agent 执行 + 过程写回会话;
 *  4. 用户在任一端看进度/取消/重排,取消在下次租约轮询时生效(跨网络杀不了进程)。
 *
 * 安全边界(不可放宽):
 *  - 工作区只能取本机配对时登记的白名单名字,任务载荷给路径 = 拒绝执行;
 *  - 危险动作无人可问 ⇒ fail-closed;autoApprove 最多到 acceptEdits,不开 bypassPermissions;
 *  - 设备令牌只落 0600 文件,不进日志、不进 stdout(只打前 8 位)。
 */
import { hostname, platform, arch } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import type { Command } from 'commander'
import chalk from 'chalk'
import {
  getDeviceTasks,
  listDevices,
  pairExchangeDevice,
  setBaseUrl,
} from '@ihui/api-client'
import { cliDeviceFingerprintCollector } from '../lib/device-fingerprint.js'
import { readCliPackage } from '../util/pkg-version.js'
import { resolveEffectiveConfig } from './settings.js'
import {
  clearDeviceCredential,
  cliConfigDir,
  deviceCredentialPath,
  devicePidPath,
  readDeviceCredential,
  writeDeviceCredential,
  DEVICE_CREDENTIAL_VERSION,
} from '../device/credential.js'
import { startDeviceRunner } from '../device/runner.js'

const execFileAsync = promisify(execFile)

/** Windows 计划任务名(单例;卸载按同名删除) */
const SERVICE_TASK_NAME = 'IHUI-Device-Executor'
/** 服务托管的启动脚本(Windows: 隐藏窗口的 vbs;都在 ~/.ihui 下,不落桌面/系统目录) */
function serviceScriptPath(): string {
  return join(cliConfigDir(), 'device-run.vbs')
}

const pkg = readCliPackage(import.meta.url) ?? { version: '0.0.0' }

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function readDaemonPid(): number | null {
  try {
    const raw = readFileSync(devicePidPath(), 'utf8').trim()
    const pid = Number.parseInt(raw, 10)
    return Number.isFinite(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}

function clearDaemonPid(): void {
  try {
    if (existsSync(devicePidPath())) unlinkSync(devicePidPath())
  } catch {
    /* pid 文件残留只影响下次单例判定,不阻断 */
  }
}

/** 读全 stdin(adopt 用:设备令牌从管道进来,不落 argv、不进进程列表) */
function readAllStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk: string) => {
      buf += chunk
    })
    process.stdin.on('end', () => resolve(buf))
    process.stdin.on('error', (err) => reject(err))
  })
}

/** 工作区名:同 basename 冲突时加序号(白名单键要能被人念出来) */
function buildWorkspaceMap(paths: string[]): Record<string, string> {  const map: Record<string, string> = {}
  for (const raw of paths) {
    const abs = resolve(raw)
    let name = basename(abs) || abs
    let n = 2
    while (map[name]) {
      name = `${basename(abs)}-${n}`
      n += 1
    }
    map[name] = abs
  }
  return map
}

export function registerDeviceCommand(program: Command): void {
  const device = program
    .command('device')
    .description('把本机接入跨设备执行器:配对、常驻、查看任务')

  device
    .command('pair <code>')
    .description('用手机/网页签发的 8 位配对码把本机接入执行器')
    .option('--name <name>', '设备名(默认主机名)', hostname())
    .option('--api-url <url>', '后端 API 地址(默认取 settings)')
    .option(
      '--dir <path>',
      '加入工作区白名单(可重复;默认当前目录)',
      (v: string, prev: string[] = []) => [...prev, v],
      [] as string[],
    )
    .option('--model <model>', '默认模型(可被任务载荷覆盖)')
    .action(async (code: string, opts: { name: string; apiUrl?: string; dir: string[]; model?: string }, command: Command) => {
      if (!/^\d{8}$/.test(code.trim())) {
        console.error(chalk.red('配对码是 8 位数字(手机/网页「设置-设备」里的那串)'))
        process.exitCode = 1
        return
      }
      // 根命令也有 --api-url(全局默认),Commander 会在根层吃掉同名选项,
      // 子命令拿不到它。这里合并 optsWithGlobals,避免 `ihui device pair <code> --api-url`
      // 静默回落到 localhost(实测踩过:配对成功后设备却写向 localhost)。
      const globalApiUrl = (command.optsWithGlobals() as { apiUrl?: string }).apiUrl
      const cfg = resolveEffectiveConfig({
        cliApiUrl: opts.apiUrl || globalApiUrl || undefined,
        cliModel: opts.model,
      })
      setBaseUrl(cfg.apiUrl)
      const fingerprint = (await cliDeviceFingerprintCollector.get()).fingerprint
      const workspaces = buildWorkspaceMap(
        opts.dir.length > 0 ? opts.dir : [process.cwd()],
      )
      const res = await pairExchangeDevice({
        code: code.trim(),
        name: opts.name,
        os: `${platform()}/${arch()}`,
        capabilities: {
          roles: ['cli', 'executor'],
          workspaces: Object.keys(workspaces),
          models: opts.model ? [opts.model] : [],
        },
        fingerprint,
        clientVersion: pkg.version,
      })
      if (!res.success || !res.data) {
        console.error(chalk.red(`配对失败:${res.error ?? '未知错误'}`))
        process.exitCode = 1
        return
      }
      writeDeviceCredential({
        version: DEVICE_CREDENTIAL_VERSION,
        apiUrl: cfg.apiUrl,
        deviceId: res.data.device_id,
        deviceToken: res.data.device_token,
        fingerprint,
        name: opts.name,
        workspaces,
        pairedAt: new Date().toISOString(),
      })
      console.info(chalk.green('已配对。'))
      console.info(chalk.dim(`  设备 ID   ${res.data.device_id.slice(0, 8)}…`))
      console.info(chalk.dim(`  工作区    ${Object.entries(workspaces).map(([k, v]) => `${k}=${v}`).join('  ')}`))
      console.info(chalk.dim(`  凭据文件  ${deviceCredentialPath()}(0600,勿入库)`))
      console.info(chalk.dim('下一步:ihui device start(常驻接单;也由桌面端托盘/服务托管启动)'))
    })

  device
    .command('adopt')
    .description('由已登录客户端调用:接管自助签发的设备令牌并落盘(不需要 8 位配对码)')
    .option('--api-url <url>', '后端 API 地址(默认取 settings)')
    .option(
      '--dir <path>',
      '加入工作区白名单(可重复;默认取 stdin 的 workspace,其次当前目录)',
      (v: string, prev: string[] = []) => [...prev, v],
      [] as string[],
    )
    .action(async (opts: { apiUrl?: string; dir: string[] }) => {
      // 令牌只走 stdin,不进 argv(命令行在进程列表里对本机所有用户可见)。
      const raw = await readAllStdin()
      let input: {
        device_id?: unknown
        device_token?: unknown
        name?: unknown
        api_url?: unknown
        workspace?: unknown
        workspaces?: unknown
      }
      try {
        input = JSON.parse(raw) as typeof input
      } catch {
        console.error(chalk.red('stdin 不是合法 JSON'))
        process.exitCode = 1
        return
      }
      const deviceId = typeof input.device_id === 'string' ? input.device_id.trim() : ''
      const deviceToken = typeof input.device_token === 'string' ? input.device_token.trim() : ''
      if (!deviceId || !deviceToken) {
        console.error(chalk.red('stdin 缺 device_id 或 device_token'))
        process.exitCode = 1
        return
      }
      // 后端地址同理走 stdin 优先:桌面端知道自己被哪个站点加载(生产 = 该站点 origin),
      // 而 CLI 的默认值是本机开发地址,不写进去就会把生产机器指到 localhost。
      const payloadApiUrl = typeof input.api_url === 'string' ? input.api_url.trim() : ''
      const cfg = resolveEffectiveConfig({ cliApiUrl: opts.apiUrl ?? (payloadApiUrl || undefined) })
      setBaseUrl(cfg.apiUrl)
      // 指纹仍由 CLI 生成:这是全仓唯一一份指纹算法(桌面端只转交令牌,不另算一份)。
      const fingerprint = (await cliDeviceFingerprintCollector.get()).fingerprint
      // 工作区优先级:stdin 的 workspace(s)(桌面端选目录的唯一可靠通道) > --dir > 当前目录。
      // 刻意**不读** --workspace:根命令的 `-w, --workspace <path>` 会先吃掉这个开关,
      // 子命令永远收不到值(2026-11-26 自验实测:传了目录却落盘成 cwd ⇒ 任务跑错目录)。
      const fromPayload: string[] = []
      for (const v of [input.workspace, input.workspaces]) {
        if (typeof v === 'string' && v.trim()) fromPayload.push(v.trim())
        else if (Array.isArray(v)) {
          for (const x of v) if (typeof x === 'string' && x.trim()) fromPayload.push(x.trim())
        }
      }
      const explicit = [...fromPayload, ...opts.dir]
      const workspaces = buildWorkspaceMap(explicit.length > 0 ? explicit : [process.cwd()])
      const name =
        (typeof input.name === 'string' ? input.name.trim() : '') ||
        hostname().trim() ||
        'desktop'
      writeDeviceCredential({
        version: DEVICE_CREDENTIAL_VERSION,
        apiUrl: cfg.apiUrl,
        deviceId,
        deviceToken,
        fingerprint,
        name,
        workspaces,
        pairedAt: new Date().toISOString(),
      })
      console.info(chalk.green('已接管(自助签发,无需配对码)。'))
      console.info(chalk.dim(`  设备 ID   ${deviceId.slice(0, 8)}…`))
      console.info(chalk.dim(`  设备名    ${name}`))
      console.info(
        chalk.dim(
          `  工作区    ${Object.entries(workspaces).map(([k, v]) => `${k}=${v}`).join('  ')}`,
        ),
      )
    })

  device
    .command('start')
    .description('常驻:心跳续租 + 认领任务 + 本机 Agent 执行 + 过程写回会话')
    .option('--model <model>', '默认模型(可被任务载荷覆盖)')
    .option('--poll <ms>', '认领轮询间隔(毫秒)', '3000')
    .option('--heartbeat <ms>', '心跳间隔(毫秒)', '30000')
    .option('--permission-mode <mode>', '权限模式(default/acceptEdits/plan/manual)', 'default')
    .option('--max-iterations <n>', '单任务最大迭代轮次', '30')
    .action(
      async (opts: {
        model?: string
        poll: string
        heartbeat: string
        permissionMode: string
        maxIterations: string
      }) => {
        const cred = readDeviceCredential()
        if (!cred) {
          console.error(chalk.red('本机尚未配对。先跑:ihui device pair <8 位配对码>'))
          process.exitCode = 1
          return
        }
        const existing = readDaemonPid()
        if (existing && existing !== process.pid && isPidAlive(existing)) {
          console.error(chalk.yellow(`已有执行器在跑(pid ${existing})。要重启先停掉它。`))
          process.exitCode = 1
          return
        }

        const cfg = resolveEffectiveConfig({
          cliApiUrl: cred.apiUrl,
          cliModel: opts.model,
          cliPermissionMode: opts.permissionMode,
        })
        setBaseUrl(cred.apiUrl)
        if (!cfg.apiKey) {
          console.error(chalk.red('缺少模型调用凭据:先 `ihui login`(执行器自己也要能调模型)'))
          process.exitCode = 1
          return
        }

        writeFileSync(devicePidPath(), String(process.pid), { encoding: 'utf8', mode: 0o600 })
        const runner = startDeviceRunner({
          apiUrl: cred.apiUrl,
          deviceId: cred.deviceId,
          deviceToken: cred.deviceToken,
          fingerprint: cred.fingerprint,
          workspaces: cred.workspaces,
          model: cfg.model,
          apiKey: cfg.apiKey,
          permissionMode: cfg.permissionMode,
          pollIntervalMs: Math.max(500, Number.parseInt(opts.poll, 10) || 3000),
          heartbeatIntervalMs: Math.max(5000, Number.parseInt(opts.heartbeat, 10) || 30_000),
          maxIterations: Math.max(1, Number.parseInt(opts.maxIterations, 10) || 30),
          onTokenRotated: (token) => {
            // 令牌续期必须落盘:进程重启后旧令牌过期 = 等于掉线
            const next = { ...cred, deviceToken: token }
            try {
              writeDeviceCredential(next)
            } catch {
              /* 落盘失败下一轮心跳还会再给一次;不因写盘失败中断执行 */
            }
          },
        })

        const shutdown = (signal: string): void => {
          console.info(chalk.dim(`收到 ${signal},等当前任务收尾后退出…`))
          runner.stop()
          void runner.done.finally(() => {
            clearDaemonPid()
            process.exit(0)
          })
        }
        process.on('SIGINT', () => shutdown('SIGINT'))
        process.on('SIGTERM', () => shutdown('SIGTERM'))

        console.info(chalk.cyan(`执行器已启动 ${cred.name}(${cred.deviceId.slice(0, 8)}…)`))
        console.info(
          chalk.dim(`  模型 ${cfg.model} | 权限 ${cfg.permissionMode} | 工作区 ${Object.keys(cred.workspaces).join(', ')}`),
        )
        await runner.done
        clearDaemonPid()
      },
    )

  device
    .command('status')
    .description('查看本机配对状态与最近任务(需要已登录的人令牌)')
    .action(async () => {
      const cred = readDeviceCredential()
      if (!cred) {
        console.info(chalk.yellow('本机未配对。手机/网页「设置-设备」签发配对码后:ihui device pair <code>'))
        return
      }
      const pid = readDaemonPid()
      const running = pid !== null && isPidAlive(pid)
      console.info(chalk.bold(`设备  ${cred.name}(${cred.deviceId.slice(0, 8)}…)`))
      console.info(chalk.dim(`  后端      ${cred.apiUrl}`))
      console.info(chalk.dim(`  配对时间  ${new Date(cred.pairedAt).toLocaleString()}`))
      console.info(chalk.dim(`  执行器    ${running ? `运行中(pid ${pid})` : '未运行'}`))
      console.info(
        chalk.dim(`  工作区    ${Object.entries(cred.workspaces).map(([k, v]) => `${k}=${v}`).join('  ')}`),
      )
      setBaseUrl(cred.apiUrl)
      const devices = await listDevices()
      if (!devices.success) {
        console.info(chalk.yellow(`  在线状态  未判定(${devices.error ?? '接口失败'};可能需要先 ihui login)`))
        return
      }
      const mine = devices.data?.find((d) => d.id === cred.deviceId)
      console.info(
        chalk.dim(`  服务端    ${mine ? (mine.online ? '在线' : '离线') : '已撤销或不存在'}`),
      )
      const tasks = await getDeviceTasks(cred.deviceId)
      if (!tasks.success || !tasks.data) {
        console.info(chalk.yellow(`  任务     未判定(${tasks.error ?? '接口失败'})`))
        return
      }
      const recent = tasks.data.slice(-5).reverse()
      if (recent.length === 0) {
        console.info(chalk.dim('  任务     暂无'))
        return
      }
      console.info(chalk.cyan('  最近任务:'))
      for (const t of recent) {
        const progress = t.progress ? `${t.progress.stage} ${t.progress.percent}%` : '-'
        const err = t.error ? chalk.red(` ${t.error.slice(0, 60)}`) : ''
        console.info(
          `    ${t.id.slice(0, 8)}…  ${t.status.padEnd(9)}  ${progress}${t.attempt > 1 ? `  #${t.attempt}` : ''}${err}`,
        )
      }
    })

  device
    .command('unpair')
    .description('删除本机执行器凭据(服务端撤销请到「设置-设备」)')
    .action(() => {
      const pid = readDaemonPid()
      if (pid !== null && isPidAlive(pid)) {
        console.error(chalk.yellow(`执行器还在跑(pid ${pid}),先停掉再 unpair`))
        process.exitCode = 1
        return
      }
      const removed = clearDeviceCredential()
      console.info(
        removed ? chalk.green('本机凭据已删除。') : chalk.dim('本机本来就没有配对凭据。'),
      )
      console.info(chalk.dim('服务端那台设备仍占着记录:到网页「设置-设备」点撤销,令牌会即刻失效。'))
    })

  device
    .command('install')
    .description('登录自动常驻(Windows 计划任务,隐藏窗口;免开终端)')
    .action(async () => {
      const cred = readDeviceCredential()
      if (!cred) {
        console.error(chalk.red('本机尚未配对。先跑:ihui device pair <8 位配对码>'))
        process.exitCode = 1
        return
      }
      if (process.platform !== 'win32') {
        console.info(
          chalk.yellow('自动安装目前只支持 Windows。macOS/Linux 请用系统自带的用户级守护:'),
        )
        console.info(
          chalk.dim(`  ${process.execPath} ${fileURLToPath(new URL('../index.js', import.meta.url))} device start`),
        )
        console.info(chalk.dim('  (macOS: launchd LaunchAgent;Linux: systemd --user unit)'))
        return
      }
      const entry = fileURLToPath(new URL('../index.js', import.meta.url))
      const script = serviceScriptPath()
      // VBS 只写 ASCII:WScript 按 ANSI 读非 BOM 文件,中文会变乱码导致整段不执行
      const vbs = [
        'Set sh = CreateObject("WScript.Shell")',
        `sh.CurrentDirectory = "${cliConfigDir()}"`,
        `sh.Run """${process.execPath}"" ""${entry}"" device start", 0, False`,
      ].join('\r\n')
      writeFileSync(script, `${vbs}\r\n`, { encoding: 'utf8' })
      try {
        await execFileAsync(
          'schtasks',
          [
            '/create',
            '/tn',
            SERVICE_TASK_NAME,
            '/tr',
            `wscript.exe //B "${script}"`,
            '/sc',
            'onlogon',
            '/rl',
            'LIMITED',
            '/f',
          ],
          { windowsHide: true },
        )
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        console.error(chalk.red(`计划任务安装失败:${message}`))
        process.exitCode = 1
        return
      }
      // 不等下一次登录:立刻拉起一次(已有存活实例则不重复起)
      const existing = readDaemonPid()
      if (!(existing !== null && isPidAlive(existing))) {
        spawn('wscript.exe', ['//B', script], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        }).unref()
      }
      console.info(chalk.green('已安装:登录即自动常驻(计划任务 IHUI-Device-Executor,隐藏窗口)'))
      console.info(chalk.dim(`  日志 ${join(cliConfigDir(), 'device.log')}`))
      console.info(chalk.dim('  卸载:ihui device uninstall'))
    })

  device
    .command('uninstall')
    .description('移除登录自启计划任务(不动配对凭据)')
    .action(async () => {
      if (process.platform !== 'win32') {
        console.info(chalk.yellow('自动卸载目前只支持 Windows;其他平台请停掉用户级守护进程。'))
        return
      }
      try {
        await execFileAsync('schtasks', ['/delete', '/tn', SERVICE_TASK_NAME, '/f'], {
          windowsHide: true,
        })
      } catch (e) {
        console.info(chalk.yellow(`计划任务不存在或删除失败:${e instanceof Error ? e.message : String(e)}`))
      }
      const pid = readDaemonPid()
      if (pid !== null && isPidAlive(pid)) {
        try {
          process.kill(pid, 'SIGTERM')
        } catch {
          /* 进程可能已自行退出 */
        }
      }
      console.info(chalk.green('已移除登录自启(配对凭据保留;要彻底断开再跑 ihui device unpair)'))
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
