// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 进程探针性能红线成文(b75-4#3,2026-09-30,上游出处 zcode
 * device/process-probe.ts:33-41、process-probe-linux.ts:17,133-147)。
 *
 * 本模块是「红线协议」的可测落点,不是真探针:exec 与 /proc 读取全部可注入,
 * 单测不真跑系统进程。红线(与上游逐字同判据):
 * - 外部进程白名单只有 `ps`、`tasklist`、`powershell` 与 `pwsh`(win32 CIM 全表取径),定型后每
 *   次采样最多一次调用;定型样本(实例首个采样)在候选 spawn 即时失败(WDAC/策略报 EPERM、
 *   未装 PS7 报 ENOENT)时可在同一预算内回退下一候选(至多两次派生),超时/非零退出不回退;
 * - Linux 一律读 `/proc`,不启动任何进程;
 * - 每次采样 1 秒硬超时,超时或失败一律视为「本次无样本」,不重试、不排队;
 * - 连续 3 次失败后本实例停用,直到调用方显式 reset()(上报窗口切换时调用);
 * - `/proc` 分批 64 条读取,每批前检查 deadline,超时即中止扫描判无样本;
 * - comm 字段允许含空格与括号,必须以最后一个 `)` 为界切分。
 */
import { spawn } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'

/** 采样硬超时(性能红线:探针调用 ≥1s 即弃样本)。 */
export const PROCESS_PROBE_SAMPLE_TIMEOUT_MS = 1000
/** 连续失败停用阈值(性能红线)。 */
export const PROCESS_PROBE_MAX_CONSECUTIVE_FAILURES = 3
/** /proc 分批读取的批大小(性能红线)。 */
export const PROC_READ_BATCH_SIZE = 64

/**
 * 外部进程白名单(性能红线:白名单外命令一律拒绝,不 spawn)。
 * powershell/pwsh 供 win32 的 CIM 全表取径——白名单与取径同笔扩(b76-09a 票2),两处口径不得分叉。
 */
export const PROBE_EXTERNAL_COMMANDS: readonly string[] = ['ps', 'tasklist', 'powershell', 'pwsh']

export function isProbeCommandAllowed(command: string): boolean {
  return PROBE_EXTERNAL_COMMANDS.includes(command)
}

/** 可注入的 execFile 形态(测试替身注入;默认实现接 node:child_process)。 */
export type ProbeExecFile = (file: string, args: readonly string[]) => Promise<string>

const defaultProbeExecFile: ProbeExecFile = (file, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(file, args as string[], {
      // AGENTS §5b:派生子进程一律 windowsHide;shell:false。兜底超时只防僵尸泄漏,
      // 红线级 1s 弃样本由调用方 raceProbeTimeout 收口。
      // stdin 一律 ignore(本仓 EBUSY 实证根治范式:不消费 stdin 的派生不给 stdin 管道;
      // ps/tasklist/powershell/pwsh -NonInteractive 均不读 stdin)。
      timeout: 15_000,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    // execFile 同语义:maxBuffer 16MB(Win32_Process 全表可超默认 1MB),非零退出即 reject。
    const MAX_BUFFER = 16 << 20
    let output = ''
    let settled = false
    child.stdout!.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8')
      if (output.length > MAX_BUFFER && !settled) {
        settled = true
        child.kill()
        reject(new Error(`${file} 输出超出 ${MAX_BUFFER} 字节`))
      }
    })
    child.on('error', (err) => {
      if (!settled) {
        settled = true
        reject(err)
      }
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      if (code === 0) resolve(output)
      else reject(new Error(`${file} 退出码 ${code}`))
    })
  })

export interface ProcessProbeOptions {
  execFile?: ProbeExecFile
  /** 列出 `/proc` 下的条目,仅 Linux 使用。 */
  listProcDirectory?: () => Promise<readonly string[]>
  onSampleFailed?: (reason: string) => void
  platform?: NodeJS.Platform
  /** 采样超时(仅测试注入用;红线默认 1s)。 */
  sampleTimeoutMs?: number
  /** 读取 `/proc/<pid>/stat`,仅 Linux 使用。 */
  readProcFile?: (path: string) => Promise<string>
}

export interface LinuxProcReaders {
  isExpired: () => boolean
  listProcDirectory: () => Promise<readonly string[]>
  readProcFile: (path: string) => Promise<string>
}

/** 一次采样的统一失败形态(探针自身抛出,由失败预算收口为「无样本」)。 */
export class ProcessProbeFailure extends Error {}

export interface ProcessProbeSample {
  pid: number
  comm: string
  parentPid: number
  /** POSIX 独有(/proc stat);win32 CIM 样本无此语义,故可选。 */
  processGroupId?: number
  /** POSIX 独有;win32 CIM 样本不带。 */
  cpuTimeMs?: number
  /** 创建时间(UTC epoch 毫秒);win32 CIM 样本携带,Linux /proc stat 无该字段。 */
  createdAtMs?: number
}

export interface ProcessProbe {
  /**
   * 按根 pid 采进程树(含根自身);采样时已不存在的根不出现在结果里。
   * 返回 `undefined` = 本次无样本(超时/失败/已停用)。
   */
  sampleProcessTrees(
    rootPids: readonly number[],
  ): Promise<ReadonlyMap<number, readonly ProcessProbeSample[]> | undefined>
  /** 白名单外部命令采样(ps/tasklist/powershell/pwsh);白名单外命令拒绝并计一次失败。 */
  sampleExternalCommand(command: string, args: readonly string[]): Promise<string | undefined>
  /** 上报窗口切换时清零连续失败计数,让被停用的探针重新可用。 */
  reset(): void
  /** 是否已因连续失败停用。 */
  isDisabled(): boolean
  /** 本平台采样口径(linux 与 win32 均可建整棵树;win32 走 CIM 全表,见 sampleProcessTrees)。 */
  readonly treeScope: 'direct_process' | 'process_tree'
}

/** comm 字段允许含空格与括号,必须以最后一个 `)` 为界切分(红线,防空格崩解析)。 */
export function parseLinuxStat(
  stat: string,
): { cpuTimeMs: number; parentPid: number; processGroupId: number } | undefined {
  const commEnd = stat.lastIndexOf(')')
  if (commEnd === -1) return undefined
  const fields = stat
    .slice(commEnd + 1)
    .trim()
    .split(/\s+/)
  // 切分后 fields[0] 是 state(stat 的第 3 个字段),故 ppid=1、pgrp=2、utime=11、stime=12。
  const parentPid = Number(fields[1])
  const processGroupId = Number(fields[2])
  const utimeTicks = Number(fields[11])
  const stimeTicks = Number(fields[12])
  if (!Number.isInteger(parentPid) || parentPid < 0 || !Number.isInteger(processGroupId)) {
    return undefined
  }
  if (!Number.isFinite(utimeTicks) || !Number.isFinite(stimeTicks)) return undefined
  const LINUX_CLOCK_TICKS_PER_SECOND = 100
  return {
    cpuTimeMs: Math.round(((utimeTicks + stimeTicks) / LINUX_CLOCK_TICKS_PER_SECOND) * 1000),
    parentPid,
    processGroupId,
  }
}

/** 分批并发读取 `/proc`,每批前检查超时;已超时则中止扫描并判为本次无样本(红线)。 */
export async function readProcInBatches<T>(
  readers: LinuxProcReaders,
  pids: readonly number[],
  read: (pid: number) => Promise<T | undefined>,
): Promise<readonly T[]> {
  const collected: T[] = []
  for (let offset = 0; offset < pids.length; offset += PROC_READ_BATCH_SIZE) {
    if (readers.isExpired()) throw new ProcessProbeFailure('/proc 扫描超时')
    const batch = await Promise.all(pids.slice(offset, offset + PROC_READ_BATCH_SIZE).map(read))
    for (const item of batch) {
      if (item !== undefined) collected.push(item)
    }
  }
  return collected
}

const PROBE_TIMED_OUT = Symbol('process-probe-timed-out')

function raceProbeTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T | typeof PROBE_TIMED_OUT> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(PROBE_TIMED_OUT), timeoutMs)
    // 定时器不引用事件循环:采样被并发路径放弃时不把挂起句柄留在进程里。
    ;(timer as { unref?: () => void }).unref?.()
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err: unknown) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

function buildProcessTrees<T extends { pid: number; parentPid: number }>(
  samples: readonly T[],
  roots: readonly number[],
): Map<number, readonly T[]> {
  const byPid = new Map(samples.map((s) => [s.pid, s]))
  const childrenOf = new Map<number, number[]>()
  for (const s of samples) {
    const list = childrenOf.get(s.parentPid)
    if (list) list.push(s.pid)
    else childrenOf.set(s.parentPid, [s.pid])
  }
  const result = new Map<number, readonly T[]>()
  for (const root of roots) {
    if (!byPid.has(root)) continue // 采样时已不存在的根不出现在结果里
    const tree: T[] = []
    const seen = new Set<number>([root])
    const queue = [root]
    while (queue.length > 0) {
      const pid = queue.shift()!
      const node = byPid.get(pid)
      if (node) tree.push(node)
      for (const child of childrenOf.get(pid) ?? []) {
        if (!seen.has(child)) {
          seen.add(child)
          queue.push(child)
        }
      }
    }
    result.set(root, tree)
  }
  return result
}

/**
 * win32 CIM 外部命令偏好序(候选均在白名单内,与 PROBE_EXTERNAL_COMMANDS 同笔扩)。
 * pwsh(PS7)优先:部分 Windows 主机的 WDAC/应用控制策略拦截 node 派生的 powershell.exe(5.1)
 * 而放行 PS7(本仓开发机实证:node spawnSync powershell.exe → EPERM,pwsh.exe → 退出码 0);
 * powershell 兜底覆盖未安装 PS7 的常规镜像(spawn pwsh → ENOENT 即时失败,同采样内回退)。
 */
const WIN_CIM_COMMAND_PREFERENCE: readonly string[] = ['pwsh', 'powershell']

/** .NET DateTime ticks(100ns)→ Unix epoch 的差值:0001-01-01T00:00:00Z = 621355968000000000 ticks。 */
const CIM_EPOCH_TICKS = BigInt('621355968000000000')

/**
 * win32 CIM 全表取径成文(b76-09a 票2,上游出处 windowsProcessListAsync.ts:109-110):
 * "Windows 11 24H2 及部分 Win10 镜像不再提供 WMIC;Windows 10+ 统一使用 PowerShell/CIM"。
 * 一次 `Get-CimInstance Win32_Process` 取全表 ProcessId/ParentProcessId/CreationDate ticks,
 * 输出 `pid\t pPid\t Ticks\t Name` 四列(Name 居尾,允许空格;列分隔用 [char]9,反引号转义跨 PS 版本不可靠)。
 * PowerShell 5.1 兼容:不用 `?.`/`??`;CreationDate 为空的系统进程(Idle/System)记 0。
 */
const WIN_CIM_PROCESS_LIST_SCRIPT =
  "$ErrorActionPreference='SilentlyContinue';" +
  'Get-CimInstance Win32_Process|ForEach-Object{' +
  '$c=$_.CreationDate;$t=0;if($null -ne $c){$t=$c.ToUniversalTime().Ticks};' +
  '($_.ProcessId,$_.ParentProcessId,$t,$_.Name) -join [char]9}'

/** .NET DateTime ticks → UTC epoch 毫秒;非法输入返回 undefined。 */
export function cimTicksToEpochMs(ticks: string): number | undefined {
  if (!/^\d+$/.test(ticks)) return undefined
  if (ticks === '0') return 0 // CreationDate 为空的系统进程:时间未知,记 0
  return Number((BigInt(ticks) - CIM_EPOCH_TICKS) / 10000n)
}

/** 解析 CIM 全表单行:`pid\tpPid\tTicks\tName`(Name 居尾可含空格;以前三个 Tab 定界)。 */
export function parseCimProcessRow(line: string): ProcessProbeSample | undefined {
  const t1 = line.indexOf('\t')
  const t2 = t1 === -1 ? -1 : line.indexOf('\t', t1 + 1)
  const t3 = t2 === -1 ? -1 : line.indexOf('\t', t2 + 1)
  if (t1 === -1 || t2 === -1 || t3 === -1) return undefined
  const pid = Number(line.slice(0, t1))
  const parentPid = Number(line.slice(t1 + 1, t2))
  const createdAtMs = cimTicksToEpochMs(line.slice(t2 + 1, t3))
  const comm = line.slice(t3 + 1)
  if (!Number.isInteger(pid) || pid <= 0) return undefined
  if (!Number.isInteger(parentPid) || parentPid < 0) return undefined
  if (createdAtMs === undefined) return undefined
  if (comm.length === 0) return undefined
  return { pid, comm, parentPid, createdAtMs }
}

/** 解析 CIM 全表 stdout(按行;空行跳过,坏行丢弃——与 /proc 扫描同口径:不重试)。 */
export function parseCimProcessList(stdout: string): readonly ProcessProbeSample[] {
  const samples: ProcessProbeSample[] = []
  for (const line of stdout.split(/\r?\n/)) {
    if (line.length === 0) continue
    const sample = parseCimProcessRow(line)
    if (sample) samples.push(sample)
  }
  return samples
}

export function createProcessProbe(options: ProcessProbeOptions = {}): ProcessProbe {
  const platform = options.platform ?? process.platform
  const timeoutMs = options.sampleTimeoutMs ?? PROCESS_PROBE_SAMPLE_TIMEOUT_MS
  const listProcDirectory = options.listProcDirectory ?? (() => readdir('/proc'))
  const readProcFile = options.readProcFile ?? ((path: string) => readFile(path, 'utf8'))
  const execFile = options.execFile ?? defaultProbeExecFile
  let consecutiveFailures = 0
  /** win32 CIM 取径的定型命令(实例内缓存:定型后每样本仍至多一次派生,不再试错)。 */
  let cimCommand: string | undefined

  const reportFailure = (reason: string): undefined => {
    consecutiveFailures += 1
    try {
      options.onSampleFailed?.(reason)
    } catch {
      // 观测回调抛错不能反过来影响采样与业务。
    }
    return undefined
  }

  /** 一次采样的统一收口:超时、异常、命令失败都只表现为「无样本」,并累计失败预算(红线)。 */
  const sampleWithinBudget = async <T>(
    collect: (readers: LinuxProcReaders) => Promise<T>,
  ): Promise<T | undefined> => {
    if (consecutiveFailures >= PROCESS_PROBE_MAX_CONSECUTIVE_FAILURES) return undefined
    const deadline = Date.now() + timeoutMs
    let outcome: T | typeof PROBE_TIMED_OUT
    try {
      outcome = await raceProbeTimeout(
        collect({
          isExpired: () => Date.now() >= deadline,
          listProcDirectory,
          readProcFile,
        }),
        timeoutMs,
      )
    } catch (error) {
      return reportFailure(error instanceof Error ? error.message : String(error))
    }
    if (outcome === PROBE_TIMED_OUT) {
      return reportFailure(`采样超过 ${timeoutMs} 毫秒`)
    }
    consecutiveFailures = 0
    return outcome
  }

  return {
    treeScope: platform === 'linux' || platform === 'win32' ? 'process_tree' : 'direct_process',
    async sampleProcessTrees(rootPids) {
      const roots = [...new Set(rootPids.filter((p) => Number.isInteger(p) && p > 0))]
      if (roots.length === 0) return new Map()
      if (platform === 'win32') {
        // Windows 11 24H2 及部分 Win10 镜像不再提供 WMIC;Windows 10+ 统一使用 PowerShell/CIM。
        // 红线同承:定型后每次采样最多一次外部派生,超时即弃样本,失败预算由 sampleWithinBudget
        // 统一收口。定型样本(实例首个采样)按偏好序试错:仅当候选 spawn 即时失败(WDAC 拦截
        // powershell.exe 报 EPERM、未装 PS7 报 ENOENT)才在同一预算内回退下一候选;
        // 超时/非零退出/超缓冲一律不回退(红线:1s 硬超时,外层 race 对整段链生效)。
        const cimArgs = [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          WIN_CIM_PROCESS_LIST_SCRIPT,
        ] as const
        if (cimCommand !== undefined) {
          const stdout = await this.sampleExternalCommand(cimCommand, cimArgs)
          if (stdout === undefined) return undefined
          return buildProcessTrees(parseCimProcessList(stdout), roots)
        }
        let chosen: string | undefined
        const stdout = await sampleWithinBudget(async () => {
          for (const command of WIN_CIM_COMMAND_PREFERENCE) {
            if (!isProbeCommandAllowed(command)) {
              throw new ProcessProbeFailure(
                `win32 CIM 命令 ${command} 不在白名单 ${PROBE_EXTERNAL_COMMANDS.join('/')}`,
              )
            }
            try {
              const output = await execFile(command, cimArgs)
              chosen = command
              return output
            } catch (error) {
              const code =
                error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined
              if (code === 'EPERM' || code === 'ENOENT' || code === 'EACCES') continue
              throw error
            }
          }
          throw new ProcessProbeFailure(
            `win32 CIM 取径全部不可用(${WIN_CIM_COMMAND_PREFERENCE.join('/')})`,
          )
        })
        if (stdout === undefined) return undefined
        if (chosen !== undefined) cimCommand = chosen
        return buildProcessTrees(parseCimProcessList(stdout), roots)
      }
      if (platform !== 'linux') {
        // 其余 POSIX(darwin 等):白名单外部命令一次调用;输出的结构化解析由消费方注入,
        // 本模块只成文红线(白名单/1s 超时/失败预算)。
        const stdout = await this.sampleExternalCommand('ps', [])
        if (stdout === undefined) return undefined
        return new Map()
      }
      return await sampleWithinBudget(async (readers) => {
        const entries = await readers.listProcDirectory()
        const pids = entries.map(Number).filter((p) => Number.isInteger(p) && p > 0)
        const samples = await readProcInBatches(readers, pids, async (pid) => {
          try {
            const stat = await readers.readProcFile(`/proc/${pid}/stat`)
            const parsed = parseLinuxStat(stat)
            if (!parsed) return undefined
            const commStart = stat.indexOf('(')
            const commEnd = stat.lastIndexOf(')')
            return {
              pid,
              comm: commStart === -1 || commEnd === -1 ? '' : stat.slice(commStart + 1, commEnd),
              ...parsed,
            }
          } catch {
            // 进程在扫描途中退出:无该样本,不重试。
            return undefined
          }
        })
        return buildProcessTrees(samples, roots)
      })
    },
    async sampleExternalCommand(command, args) {
      if (!isProbeCommandAllowed(command)) {
        return reportFailure(
          `外部进程命令 ${command} 不在白名单 ${PROBE_EXTERNAL_COMMANDS.join('/')}`,
        )
      }
      return await sampleWithinBudget(async () => execFile(command, args))
    },
    reset() {
      consecutiveFailures = 0
    },
    isDisabled() {
      return consecutiveFailures >= PROCESS_PROBE_MAX_CONSECUTIVE_FAILURES
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
