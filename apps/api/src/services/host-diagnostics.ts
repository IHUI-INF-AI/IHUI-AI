// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 主机诊断判据(2026-11-17 立)。
 *
 * 对标 qoder2api-hub 的 `GET /diag/vm`(本机虚拟化检测 + 与官方风控桥交叉校验)。
 * 本仓只做**自己能量到的那一半**:虚拟化/容器/WSL 三态与运行时事实,不伪造官方风控桥
 * 那一路(本仓没有该渠道,凭空编一个"交叉校验"就是把未判定写成判过)。
 *
 * 纪律(与全仓一致):
 * - 每个维度只有 true / false / **null(未判定)** 三态;取不到输入一律 null 并进 `undetermined`,
 *   绝不把"没读到"写成 false。
 * - 纯判据 `classifyVirtualization` 与采集 `collectHostDiagnostics` 分开:判据可注入夹具单测,
 *   不需要真机也不需要 root。
 * - Windows 上没有 /proc,三项全部 null —— 这是如实结果,不是缺陷。
 */
import os from 'node:os'
import { existsSync, readFileSync } from 'node:fs'

export type TriBool = boolean | null

export interface VirtualizationVerdict {
  hypervisor: TriBool
  container: TriBool
  wsl: TriBool
  /** 每条判定的直接证据(可回读),不写推断。 */
  evidence: string[]
  /** 取不到输入、因而判不了的维度名。 */
  undetermined: string[]
}

export interface VirtualizationInput {
  /** `/proc/cpuinfo` 全文;读不到 = null。 */
  cpuInfo: string | null
  /** `/proc/version` 全文;读不到 = null。 */
  procVersion: string | null
  /** `/proc/1/cgroup` 全文;读不到 = null。 */
  cgroup: string | null
  /** `/.dockerenv` 是否存在。 */
  dockerEnvFile: boolean
}

export interface HostDiagnostics {
  generatedAt: string
  os: { platform: string; release: string; arch: string; hostname: string; uptimeSec: number }
  cpu: { model: string; cores: number; loadavg1: number | null }
  memory: { totalMb: number; freeMb: number }
  virtualization: VirtualizationVerdict
  runtime: { nodeVersion: string; qoderBridge: TriBool }
  undetermined: string[]
}

const CONTAINER_MARKERS = ['docker', 'kubepods', 'containerd', 'libpod']

/**
 * 虚拟化三态判据(纯函数,零 IO)。
 *
 * - hypervisor:Linux 上看 `/proc/cpuinfo` 的 `hypervisor` 标志。**有这个标志 = 跑在
 *   hypervisor 之下**(KVM/Xen/Hyper-V 等);没有 = 物理机或裸金属容器宿主。
 * - container:`/.dockerenv` 或 `/proc/1/cgroup` 里的运行时标记。
 * - wsl:`/proc/version` 里的 `microsoft`(大小写不敏感)。
 */
export function classifyVirtualization(input: VirtualizationInput): VirtualizationVerdict {
  const evidence: string[] = []
  const undetermined: string[] = []

  let hypervisor: TriBool = null
  if (input.cpuInfo === null) {
    undetermined.push('hypervisor')
  } else if (/^\s*flags\s*:.*\bhypervisor\b/m.test(input.cpuInfo)) {
    hypervisor = true
    evidence.push('cpuinfo:hypervisor-flag')
  } else {
    hypervisor = false
    evidence.push('cpuinfo:no-hypervisor-flag')
  }

  let container: TriBool = null
  if (input.dockerEnvFile) {
    container = true
    evidence.push('fs:/.dockerenv')
  } else if (input.cgroup !== null) {
    const hit = CONTAINER_MARKERS.find((m) => input.cgroup?.toLowerCase().includes(m))
    if (hit) {
      container = true
      evidence.push(`cgroup:${hit}`)
    } else {
      container = false
      evidence.push('cgroup:no-runtime-marker')
    }
  } else {
    undetermined.push('container')
  }

  let wsl: TriBool = null
  if (input.procVersion === null) {
    undetermined.push('wsl')
  } else if (/microsoft/i.test(input.procVersion)) {
    wsl = true
    evidence.push('procversion:microsoft')
  } else {
    wsl = false
    evidence.push('procversion:no-microsoft')
  }

  return { hypervisor, container, wsl, evidence, undetermined }
}

/** 读文件失败一律 null(取不到 ≠ 没有)。 */
function readOrNull(path: string): string | null {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

/**
 * 采集本机事实。可注入 env 以测 qoderBridge 判据(文件存在性仍是真实读取)。
 */
export function collectHostDiagnostics(env: NodeJS.ProcessEnv = process.env): HostDiagnostics {
  const platform = os.platform()
  const isLinux = platform === 'linux'

  const virtualization = classifyVirtualization({
    cpuInfo: isLinux ? readOrNull('/proc/cpuinfo') : null,
    procVersion: isLinux ? readOrNull('/proc/version') : null,
    cgroup: isLinux ? readOrNull('/proc/1/cgroup') : null,
    dockerEnvFile: existsSync('/.dockerenv'),
  })

  const undetermined = [...virtualization.undetermined]

  // qoderBridge 三态:未设 env = null(不知道装没装);设了但指向不存在 = false(明确没装)。
  let qoderBridge: TriBool = null
  const bridgePath = (env.QODER_CLI_PATH ?? '').trim()
  if (bridgePath) {
    qoderBridge = existsSync(bridgePath)
  } else {
    undetermined.push('runtime.qoderBridge')
  }

  // os.loadavg() 在 Windows 恒返回 [0,0,0],那不是"负载为零"而是"平台不提供" ⇒ null。
  const loadavg1 = platform === 'win32' ? null : (os.loadavg()[0] ?? null)
  if (loadavg1 === null) undetermined.push('cpu.loadavg1')

  const cpus = os.cpus()
  return {
    generatedAt: new Date().toISOString(),
    os: {
      platform,
      release: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptimeSec: Math.round(os.uptime()),
    },
    cpu: {
      model: cpus[0]?.model ?? 'unknown',
      cores: cpus.length,
      loadavg1,
    },
    memory: {
      totalMb: Math.round(os.totalmem() / (1024 * 1024)),
      freeMb: Math.round(os.freemem() / (1024 * 1024)),
    },
    virtualization,
    runtime: { nodeVersion: process.version, qoderBridge },
    undetermined,
  }
}

/** 测试出口(单一真相源:判据只在本文件实现)。 */
export const __test__ = { classifyVirtualization, collectHostDiagnostics }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
