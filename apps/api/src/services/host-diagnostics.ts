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
  /** 本机风险启发式(见 scoreHostRisk;不是官方风控评分) */
  risk: RiskScore
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

/** 风险启发式输入的可得事实(取不到的维度传 null,由判据自己进 undetermined)。 */
export interface RiskFacts {
  hypervisor: TriBool
  container: TriBool
  wsl: TriBool
  /** CPU 型号原文(os.cpus()[0].model) */
  cpuModel: string
  /** 系统制造商;本仓不采(无 WMI 依赖),恒 null */
  osManufacturer?: string | null
  /** VBS 三态;本仓不采,恒 null */
  vbs?: TriBool
  /** HVCI 三态;本仓不采,恒 null */
  hvci?: TriBool
}

export interface RiskScore {
  /** 0-100(越高越像"被风控盯上的自动化环境") */
  score: number
  level: 'low' | 'medium' | 'high'
  hits: Array<{ key: string; weight: number; evidence: string }>
  undetermined: string[]
  /** 固定声明:这是本机启发式,不是任何官方风控评分 */
  disclaimer: string
}

const RISK_DISCLAIMER =
  '本评分是本机特征启发式,不是上游官方风控评分;低分不等于"不会被风控",高分也不等于"已被标记"。'

/** 常见虚拟化 CPU 型号特征。 */
const VIRT_CPU = /qemu|virtual cpu|kvm|vmware|xen|hyper-v|parallels|bochs/i

/**
 * 风险启发式评分(纯函数,零 IO)。
 *
 * 对照的 `/diag/vm` 会把本机事实与官方风控桥的 vmInfo 交叉校验;本仓没有那条渠道,
 * 于是把"自己能算的那一半"算清楚:**同样是虚拟化,跑在 QEMU 上与跑在实体机上,
 * 被风控的观感不同**。权重全是可回读的规则,没有一条来自"猜"。
 *
 * 权重方向:
 * - 虚拟化/容器 +25/+20(最敏感信号,单纯 VM 就足以让风控降权)
 * - WSL +10(常见但也是自动化环境特征)
 * - CPU 型号命中虚拟化厂商 +10(与 hypervisor 叠加,不互斥)
 * - VBS/HVCI 开启 -10/-5(有设备完整性保护的环境通常更"正规")
 */
export function scoreHostRisk(facts: RiskFacts): RiskScore {
  const hits: Array<{ key: string; weight: number; evidence: string }> = []
  const undetermined: string[] = []

  if (facts.hypervisor === true)
    hits.push({ key: 'hypervisor', weight: 25, evidence: 'cpuinfo:hypervisor-flag' })
  else if (facts.hypervisor === null) undetermined.push('hypervisor')

  if (facts.container === true)
    hits.push({ key: 'container', weight: 20, evidence: 'fs/cgroup:runtime-marker' })
  else if (facts.container === null) undetermined.push('container')

  if (facts.wsl === true) hits.push({ key: 'wsl', weight: 10, evidence: 'procversion:microsoft' })
  else if (facts.wsl === null) undetermined.push('wsl')

  if (VIRT_CPU.test(facts.cpuModel)) {
    hits.push({ key: 'virt-cpu-model', weight: 10, evidence: `cpu:${facts.cpuModel.slice(0, 64)}` })
  }

  if (facts.vbs === true) hits.push({ key: 'vbs', weight: -10, evidence: 'device:vbs-enabled' })
  else if (facts.vbs !== false) undetermined.push('vbs')

  if (facts.hvci === true) hits.push({ key: 'hvci', weight: -5, evidence: 'device:hvci-enabled' })
  else if (facts.hvci !== false) undetermined.push('hvci')

  if (facts.osManufacturer === null || facts.osManufacturer === undefined) {
    undetermined.push('osManufacturer')
  }

  const raw = hits.reduce((sum, h) => sum + h.weight, 0)
  const score = Math.max(0, Math.min(100, raw))
  const level: RiskScore['level'] = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low'
  return { score, level, hits, undetermined, disclaimer: RISK_DISCLAIMER }
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
  const cpuModel = cpus[0]?.model ?? 'unknown'
  // 风险启发式:只用本函数能取到的事实;VBS/HVCI/系统制造商本仓不采 ⇒ 进去 undetermined,
  // 由端点如实显示"这几维没判",而不是默认给 0 分。
  const risk = scoreHostRisk({
    hypervisor: virtualization.hypervisor,
    container: virtualization.container,
    wsl: virtualization.wsl,
    cpuModel,
    osManufacturer: null,
    vbs: null,
    hvci: null,
  })
  undetermined.push(...risk.undetermined.map((k) => `risk.${k}`))

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
      model: cpuModel,
      cores: cpus.length,
      loadavg1,
    },
    memory: {
      totalMb: Math.round(os.totalmem() / (1024 * 1024)),
      freeMb: Math.round(os.freemem() / (1024 * 1024)),
    },
    virtualization,
    runtime: { nodeVersion: process.version, qoderBridge },
    risk,
    undetermined,
  }
}

/** 测试出口(单一真相源:判据只在本文件实现)。 */
export const __test__ = { classifyVirtualization, collectHostDiagnostics, scoreHostRisk }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
