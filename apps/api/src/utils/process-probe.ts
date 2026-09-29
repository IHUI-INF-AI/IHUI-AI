// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 进程探针性能红线成文(b75-4#3,2026-09-30,上游出处 zcode
 * device/process-probe.ts:33-41、process-probe-linux.ts:17,133-147)。
 *
 * 本模块是「红线协议」的可测落点,不是真探针:exec 与 /proc 读取全部可注入,
 * 单测不真跑系统进程。红线(与上游逐字同判据):
 * - 外部进程白名单只有 `ps` 与 `tasklist`,每次采样最多一次调用;
 * - Linux 一律读 `/proc`,不启动任何进程;
 * - 每次采样 1 秒硬超时,超时或失败一律视为「本次无样本」,不重试、不排队;
 * - 连续 3 次失败后本实例停用,直到调用方显式 reset()(上报窗口切换时调用);
 * - `/proc` 分批 64 条读取,每批前检查 deadline,超时即中止扫描判无样本;
 * - comm 字段允许含空格与括号,必须以最后一个 `)` 为界切分。
 */
import { execFile as cpExecFile } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { promisify } from 'node:util'

/** 采样硬超时(性能红线:探针调用 ≥1s 即弃样本)。 */
export const PROCESS_PROBE_SAMPLE_TIMEOUT_MS = 1000
/** 连续失败停用阈值(性能红线)。 */
export const PROCESS_PROBE_MAX_CONSECUTIVE_FAILURES = 3
/** /proc 分批读取的批大小(性能红线)。 */
export const PROC_READ_BATCH_SIZE = 64

/** 外部进程白名单(性能红线:白名单外命令一律拒绝,不 spawn)。 */
export const PROBE_EXTERNAL_COMMANDS: readonly string[] = ['ps', 'tasklist']

export function isProbeCommandAllowed(command: string): boolean {
  return PROBE_EXTERNAL_COMMANDS.includes(command)
}

/** 可注入的 execFile 形态(测试替身注入;默认实现接 node:child_process)。 */
export type ProbeExecFile = (file: string, args: readonly string[]) => Promise<string>

const defaultProbeExecFile: ProbeExecFile = async (file, args) => {
  const { stdout } = await promisify(cpExecFile)(file, args as string[])
  return stdout
}

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
  processGroupId: number
  cpuTimeMs: number
}

export interface ProcessProbe {
  /**
   * 按根 pid 采进程树(含根自身);采样时已不存在的根不出现在结果里。
   * 返回 `undefined` = 本次无样本(超时/失败/已停用)。
   */
  sampleProcessTrees(
    rootPids: readonly number[],
  ): Promise<ReadonlyMap<number, readonly ProcessProbeSample[]> | undefined>
  /** 白名单外部命令采样(仅 ps/tasklist);白名单外命令拒绝并计一次失败。 */
  sampleExternalCommand(command: string, args: readonly string[]): Promise<string | undefined>
  /** 上报窗口切换时清零连续失败计数,让被停用的探针重新可用。 */
  reset(): void
  /** 是否已因连续失败停用。 */
  isDisabled(): boolean
  /** 本平台采样口径(win32 的 tasklist 无 ppid,只能 direct_process)。 */
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

function buildProcessTrees(
  samples: readonly ProcessProbeSample[],
  roots: readonly number[],
): Map<number, readonly ProcessProbeSample[]> {
  const byPid = new Map(samples.map((s) => [s.pid, s]))
  const childrenOf = new Map<number, number[]>()
  for (const s of samples) {
    const list = childrenOf.get(s.parentPid)
    if (list) list.push(s.pid)
    else childrenOf.set(s.parentPid, [s.pid])
  }
  const result = new Map<number, readonly ProcessProbeSample[]>()
  for (const root of roots) {
    if (!byPid.has(root)) continue // 采样时已不存在的根不出现在结果里
    const tree: ProcessProbeSample[] = []
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

export function createProcessProbe(options: ProcessProbeOptions = {}): ProcessProbe {
  const platform = options.platform ?? process.platform
  const timeoutMs = options.sampleTimeoutMs ?? PROCESS_PROBE_SAMPLE_TIMEOUT_MS
  const listProcDirectory = options.listProcDirectory ?? (() => readdir('/proc'))
  const readProcFile = options.readProcFile ?? ((path: string) => readFile(path, 'utf8'))
  const execFile = options.execFile ?? defaultProbeExecFile
  let consecutiveFailures = 0

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
    treeScope: platform === 'win32' ? 'direct_process' : 'process_tree',
    async sampleProcessTrees(rootPids) {
      const roots = [...new Set(rootPids.filter((p) => Number.isInteger(p) && p > 0))]
      if (roots.length === 0) return new Map()
      if (platform !== 'linux') {
        // 非 Linux:白名单外部命令一次调用(ps/tasklist);输出的结构化解析由消费方注入,
        // 本模块只成文红线(白名单/1s 超时/失败预算)。
        const command = platform === 'win32' ? 'tasklist' : 'ps'
        const stdout = await this.sampleExternalCommand(command, [])
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
