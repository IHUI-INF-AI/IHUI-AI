// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 自愈工作区服务(2026-09-17 立,P3 #45)。
 *
 * 阶段1 故障检测器:四类探针(依赖损坏/索引过期/端口占用/磁盘不足),
 *   全部只读探测,任何探针自身异常不抛错(返回该类无问题,审计字段注明)。
 * 阶段2 自动修复:修复动作逐 step 记录(step/command/status/output/durationMs)
 *   可审计;默认 dryRun=true 只产出计划;真实执行走 sandboxExecutor
 *   (二进制白名单 + 无 shell),磁盘清理仅限 workspacePath 内白名单子目录。
 * 阶段3 巡逻联动:patrolType 新增 'workspace',巡逻 agent 经 self_heal_*
 *   工具(注册进 agentLoop)在对话流内完成检测/修复,天然 toolCall 可审计。
 */

import { createServer } from 'node:net'
import { statfs, rm, readdir, stat } from 'node:fs/promises'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import type { Dirent } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { platform } from 'node:os'
import { execFile } from 'node:child_process'
import { agentLoop, codebaseIndexer, sandboxExecutor } from './workspace-ai-service.js'

// =============================================================================
// 类型
// =============================================================================

export type SelfHealIssueKind = 'dependency' | 'index' | 'port' | 'disk'

export interface SelfHealIssue {
  kind: SelfHealIssueKind
  severity: 'warn' | 'error'
  detail: string
  fixPlan: string
}

export interface SelfHealStep {
  step: string
  command: string | null
  status: 'planned' | 'ok' | 'fail' | 'skipped'
  output: string
  durationMs: number
}

export interface SelfHealDetectResult {
  workspacePath: string
  checkedAt: string
  issues: SelfHealIssue[]
  /** 探针自身失败说明(不影响其余探针结果) */
  probeErrors: string[]
}

export interface SelfHealRepairResult {
  workspacePath: string
  kind: SelfHealIssueKind
  dryRun: boolean
  ok: boolean
  steps: SelfHealStep[]
}

// =============================================================================
// 探针(纯检测,只读)
// =============================================================================

/** 索引新鲜度判定阈值:索引时间早于工作区最新改动 60s 内视为新鲜 */
const INDEX_FRESH_TOLERANCE_MS = 60_000
/** 新鲜度扫描上限(文件数),防大工作区阻塞 */
const FRESHNESS_SCAN_LIMIT = 2000
/** 磁盘默认最低可用空间(MB) */
export const DEFAULT_MIN_FREE_MB = 1024

/** 依赖探针:node_modules 缺失=error;package.json 比 node_modules 新=warn;非 JS 工作区返回 null */
export function probeDependency(workspacePath: string): SelfHealIssue | null {
  const pkgPath = join(workspacePath, 'package.json')
  if (!existsSync(pkgPath)) return null
  if (!existsSync(join(workspacePath, 'node_modules'))) {
    return {
      kind: 'dependency',
      severity: 'error',
      detail: '存在 package.json 但 node_modules 缺失,依赖未安装或已损坏。',
      fixPlan: '在工作区执行依赖安装(pnpm install)。',
    }
  }
  const pkgMtime = statSync(pkgPath).mtimeMs
  const nodeModulesMtime = statSync(join(workspacePath, 'node_modules')).mtimeMs
  if (pkgMtime > nodeModulesMtime + INDEX_FRESH_TOLERANCE_MS) {
    return {
      kind: 'dependency',
      severity: 'warn',
      detail: 'package.json 修改时间晚于 node_modules,依赖可能过期(改了依赖未重装)。',
      fixPlan: '在工作区执行依赖安装(pnpm install)同步依赖。',
    }
  }
  return null
}

/** 有界遍历工作区取最新文件 mtime(跳过构建产物/依赖目录,限流防阻塞) */
async function newestMtime(root: string, limit = FRESHNESS_SCAN_LIMIT): Promise<number | null> {
  let newest: number | null = null
  let count = 0
  const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.turbo'])
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > 6 || count >= limit) return
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (count >= limit) return
      if (e.name.startsWith('.') && e.name !== '.ihui' && e.name !== '.env') continue
      if (SKIP.has(e.name)) continue
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        await walk(full, depth + 1)
      } else if (e.isFile()) {
        count++
        try {
          const m = statSync(full).mtimeMs
          if (newest === null || m > newest) newest = m
        } catch {
          /* 单文件失败忽略 */
        }
      }
    }
  }
  await walk(root, 0)
  return newest
}

/** 索引探针:.ihui/codebase-index.json 缺失=warn;索引时间早于最新改动=warn */
export async function probeIndex(workspacePath: string): Promise<SelfHealIssue | null> {
  const index = codebaseIndexer.load(workspacePath)
  if (!index) {
    return {
      kind: 'index',
      severity: 'warn',
      detail: '代码库索引缺失(.ihui/codebase-index.json 不存在),语义检索不可用。',
      fixPlan: '重建代码库索引。',
    }
  }
  const newest = await newestMtime(workspacePath)
  const indexedMs = index.indexedAt * 1000
  if (newest !== null && newest > indexedMs + INDEX_FRESH_TOLERANCE_MS) {
    return {
      kind: 'index',
      severity: 'warn',
      detail: `索引已过期:工作区在索引之后有改动(索引时间 ${new Date(indexedMs).toISOString()})。`,
      fixPlan: '重建代码库索引以纳入最新改动。',
    }
  }
  return null
}

/** 端口探针:尝试监听目标端口(绑定 127.0.0.1,与本地服务典型绑定一致),被占用=true */
export function probePort(port: number): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const server = createServer()
    server.once('error', () => resolvePromise(true))
    server.once('listening', () => {
      server.close(() => resolvePromise(false))
    })
    server.listen(port, '127.0.0.1')
  })
}

/** 磁盘探针:workspacePath 所在盘可用空间 < minFreeMB = error */
async function probeDisk(
  workspacePath: string,
  minFreeMB = DEFAULT_MIN_FREE_MB,
): Promise<SelfHealIssue | null> {
  const s = await statfs(workspacePath)
  const freeMB = Math.floor((s.bavail * s.bsize) / (1024 * 1024))
  if (freeMB < minFreeMB) {
    return {
      kind: 'disk',
      severity: 'error',
      detail: `磁盘可用空间不足:剩 ${freeMB} MB(阈值 ${minFreeMB} MB)。`,
      fixPlan: '清理工作区缓存目录(node_modules/.cache、tmp 等)后观察;仍不足需人工扩容。',
    }
  }
  return null
}

/** 汇总检测:四类探针逐一执行,单探针异常不阻断其余 */
export async function detectWorkspaceIssues(params: {
  workspacePath: string
  port?: number
  minFreeMB?: number
}): Promise<SelfHealDetectResult> {
  const { workspacePath } = params
  const issues: SelfHealIssue[] = []
  const probeErrors: string[] = []

  try {
    const issue = probeDependency(workspacePath)
    if (issue) issues.push(issue)
  } catch (e) {
    probeErrors.push(`dependency 探针异常: ${String(e)}`)
  }
  try {
    const issue = await probeIndex(workspacePath)
    if (issue) issues.push(issue)
  } catch (e) {
    probeErrors.push(`index 探针异常: ${String(e)}`)
  }
  if (params.port !== undefined) {
    try {
      const inUse = await probePort(params.port)
      if (inUse) {
        issues.push({
          kind: 'port',
          severity: 'warn',
          detail: `端口 ${params.port} 已被占用。`,
          fixPlan: '确认占用进程后终止(需显式提供 forceKillPid),或改用其他端口。',
        })
      }
    } catch (e) {
      probeErrors.push(`port 探针异常: ${String(e)}`)
    }
  }
  try {
    const issue = await probeDisk(workspacePath, params.minFreeMB)
    if (issue) issues.push(issue)
  } catch (e) {
    probeErrors.push(`disk 探针异常: ${String(e)}`)
  }

  return { workspacePath, checkedAt: new Date().toISOString(), issues, probeErrors }
}

// =============================================================================
// 修复执行器(逐 step 审计;默认 dryRun)
// =============================================================================

/** 磁盘清理白名单:仅允许删除 workspacePath 下这些相对目录(防越界) */
const DISK_CLEAN_TARGETS = ['node_modules/.cache', '.ihui/tmp', 'tmp', '.cache']

function stepPlanned(step: string, command: string | null, output: string): SelfHealStep {
  return { step, command, status: 'planned', output, durationMs: 0 }
}

/** 校验目标路径确实位于 workspacePath 内(防路径逃逸) */
function isInsideWorkspace(workspacePath: string, target: string): boolean {
  const wsAbs = resolve(workspacePath)
  const tAbs = resolve(target)
  return tAbs === wsAbs || tAbs.startsWith(wsAbs + sep)
}

async function repairDependency(
  workspacePath: string,
  dryRun: boolean,
  detail: string,
): Promise<SelfHealRepairResult> {
  const steps: SelfHealStep[] = [stepPlanned('检测', null, detail || '依赖缺失或过期')]
  const cmd = 'pnpm install --no-frozen-lockfile'
  if (dryRun) {
    steps.push(stepPlanned('依赖安装', cmd, '将执行依赖安装以恢复/同步 node_modules。'))
    return { workspacePath, kind: 'dependency', dryRun, ok: true, steps }
  }
  const t0 = Date.now()
  const result = await sandboxExecutor.execute({
    command: cmd,
    workspacePath,
    mode: 'workspace-write',
    timeoutMs: 300_000,
  })
  steps.push({
    step: '依赖安装',
    command: cmd,
    status: result.exitCode === 0 ? 'ok' : 'fail',
    output: (result.stdout + '\n' + result.stderr).trim().slice(-2000) || `exit ${result.exitCode}`,
    durationMs: Date.now() - t0,
  })
  const installed = existsSync(join(workspacePath, 'node_modules'))
  steps.push({
    step: '验证',
    command: null,
    status: installed ? 'ok' : 'fail',
    output: installed ? 'node_modules 已存在' : 'node_modules 仍缺失',
    durationMs: 0,
  })
  return {
    workspacePath,
    kind: 'dependency',
    dryRun,
    ok: installed && result.exitCode === 0,
    steps,
  }
}

async function repairIndex(workspacePath: string, dryRun: boolean): Promise<SelfHealRepairResult> {
  const steps: SelfHealStep[] = []
  if (dryRun) {
    steps.push(stepPlanned('重建索引', null, '将重建 .ihui/codebase-index.json(全量扫描工作区)。'))
    return { workspacePath, kind: 'index', dryRun, ok: true, steps }
  }
  const t0 = Date.now()
  let totalFiles = -1
  let status: SelfHealStep['status'] = 'fail'
  let output = ''
  try {
    // .ihui 目录不存在时 index() 的 writeFileSync 会 ENOENT,先确保目录在
    mkdirSync(join(workspacePath, '.ihui'), { recursive: true })
    const index = codebaseIndexer.index(workspacePath)
    totalFiles = index.totalFiles
    status = 'ok'
    output = `重建完成,共索引 ${totalFiles} 个文件`
  } catch (e) {
    output = String(e)
  }
  steps.push({ step: '重建索引', command: null, status, output, durationMs: Date.now() - t0 })
  return { workspacePath, kind: 'index', dryRun, ok: status === 'ok', steps }
}

async function repairPort(
  workspacePath: string,
  port: number,
  dryRun: boolean,
  forceKillPid: number | null,
): Promise<SelfHealRepairResult> {
  const steps: SelfHealStep[] = []
  const inUse = await probePort(port)
  if (!inUse) {
    steps.push({
      step: '探测',
      command: null,
      status: 'ok',
      output: `端口 ${port} 当前空闲,无需处理`,
      durationMs: 0,
    })
    return { workspacePath, kind: 'port', dryRun, ok: true, steps }
  }
  steps.push({
    step: '探测',
    command: null,
    status: 'ok',
    output: `端口 ${port} 被占用`,
    durationMs: 0,
  })
  if (forceKillPid === null) {
    steps.push(
      stepPlanned(
        '终止占用进程',
        null,
        '需显式提供占用进程 PID(forceKillPid)才会终止;请先确认占用方非关键系统进程。',
      ),
    )
    return { workspacePath, kind: 'port', dryRun, ok: false, steps }
  }
  if (dryRun) {
    steps.push(
      stepPlanned('终止占用进程', `kill PID ${forceKillPid}`, `将终止进程 ${forceKillPid}。`),
    )
    return { workspacePath, kind: 'port', dryRun, ok: true, steps }
  }
  const isWin = platform() === 'win32'
  const cmd = isWin ? `taskkill /PID ${forceKillPid} /F` : `kill -9 ${forceKillPid}`
  const t0 = Date.now()
  // 终止进程不走 sandboxExecutor(taskkill/kill 不在 agent 命令白名单,这是有意的
  // 安全边界);此处为显式鉴权修复动作,直接 execFile 无 shell,参数为受控数字 PID
  const killOutput = await new Promise<string>((resolveKill) => {
    const bin = isWin ? 'taskkill' : 'kill'
    const argv = isWin ? ['/PID', String(forceKillPid), '/F'] : ['-9', String(forceKillPid)]
    execFile(bin, argv, { timeout: 15_000, shell: false }, (err, out, errOut) => {
      resolveKill(
        err
          ? `${String(err.message)}\n${String(out)}\n${String(errOut)}`.trim().slice(-1000)
          : String(out || errOut || 'done').slice(-1000),
      )
    })
  })
  steps.push({
    step: '终止占用进程',
    command: cmd,
    status: 'ok',
    output: killOutput,
    durationMs: Date.now() - t0,
  })
  const stillInUse = await probePort(port)
  steps.push({
    step: '验证',
    command: null,
    status: stillInUse ? 'fail' : 'ok',
    output: stillInUse ? '端口仍被占用(进程可能自动重启或 PID 不对)' : '端口已释放',
    durationMs: 0,
  })
  return { workspacePath, kind: 'port', dryRun, ok: !stillInUse, steps }
}

async function repairDisk(
  workspacePath: string,
  dryRun: boolean,
  minFreeMB: number,
): Promise<SelfHealRepairResult> {
  const steps: SelfHealStep[] = []
  const wsAbs = resolve(workspacePath)
  const targets: { rel: string; abs: string; bytes: number }[] = []
  for (const rel of DISK_CLEAN_TARGETS) {
    const abs = join(wsAbs, rel)
    if (!isInsideWorkspace(workspacePath, abs)) continue
    if (!existsSync(abs)) continue
    let bytes = 0
    try {
      // 有界统计(浅层 + 单层 node_modules/.cache 场景足够;失败按 0 记)
      const entries = await readdir(abs, { recursive: false })
      for (const name of entries.slice(0, 500)) {
        try {
          const st = await stat(join(abs, name))
          bytes += st.size
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
    targets.push({ rel, abs, bytes })
  }
  if (targets.length === 0) {
    steps.push({
      step: '盘点可清理目录',
      command: null,
      status: 'skipped',
      output: `工作区内无白名单缓存目录(${DISK_CLEAN_TARGETS.join(', ')}),无自动清理空间;需人工扩容`,
      durationMs: 0,
    })
    return { workspacePath, kind: 'disk', dryRun, ok: false, steps }
  }
  const planText = targets
    .map((t) => `${t.rel}(约 ${(t.bytes / 1024 / 1024).toFixed(1)} MB)`)
    .join(', ')
  steps.push({
    step: '盘点可清理目录',
    command: null,
    status: 'ok',
    output: planText,
    durationMs: 0,
  })
  if (dryRun) {
    steps.push(
      stepPlanned(
        '清理缓存目录',
        `rm -rf [${targets.map((t) => t.rel).join(', ')}]`,
        '将删除上述白名单缓存目录(仅限工作区内)。',
      ),
    )
    return { workspacePath, kind: 'disk', dryRun, ok: true, steps }
  }
  let freed = 0
  for (const t of targets) {
    const t0 = Date.now()
    try {
      await rm(t.abs, { recursive: true, force: true })
      freed += t.bytes
      steps.push({
        step: `清理 ${t.rel}`,
        command: null,
        status: 'ok',
        output: `已删除(约 ${(t.bytes / 1024 / 1024).toFixed(1)} MB)`,
        durationMs: Date.now() - t0,
      })
    } catch (e) {
      steps.push({
        step: `清理 ${t.rel}`,
        command: null,
        status: 'fail',
        output: String(e).slice(-500),
        durationMs: Date.now() - t0,
      })
    }
  }
  const s = await statfs(workspacePath)
  const freeMBAfter = Math.floor((s.bavail * s.bsize) / (1024 * 1024))
  steps.push({
    step: '验证',
    command: null,
    status: freeMBAfter >= minFreeMB ? 'ok' : 'fail',
    output: `释放约 ${(freed / 1024 / 1024).toFixed(1)} MB,当前可用 ${freeMBAfter} MB(阈值 ${minFreeMB} MB)${freeMBAfter < minFreeMB ? ';仍不足需人工扩容' : ''}`,
    durationMs: 0,
  })
  return {
    workspacePath,
    kind: 'disk',
    dryRun,
    ok: freeMBAfter >= minFreeMB,
    steps,
  }
}

/** 修复入口:按 kind 分派;dryRun 缺省 true(只出计划不落刀) */
export async function repairWorkspaceIssue(params: {
  workspacePath: string
  kind: SelfHealIssueKind
  dryRun?: boolean
  port?: number
  forceKillPid?: number | null
  minFreeMB?: number
  detail?: string
}): Promise<SelfHealRepairResult> {
  const dryRun = params.dryRun ?? true
  switch (params.kind) {
    case 'dependency':
      return repairDependency(params.workspacePath, dryRun, params.detail ?? '')
    case 'index':
      return repairIndex(params.workspacePath, dryRun)
    case 'port':
      return repairPort(params.workspacePath, params.port ?? 0, dryRun, params.forceKillPid ?? null)
    case 'disk':
      return repairDisk(params.workspacePath, dryRun, params.minFreeMB ?? DEFAULT_MIN_FREE_MB)
  }
}

// =============================================================================
// agentLoop 工具注册(对话流内 toolCall 可审计)
// =============================================================================

agentLoop.registerTool({
  name: 'self_heal_detect',
  description:
    '工作区环境健康检测:四类探针(依赖损坏/索引过期/端口占用/磁盘不足),返回问题清单与修复预案。只读,不修改任何文件。',
  execute: async (args) => {
    const result = await detectWorkspaceIssues({
      workspacePath: String(args['workspacePath'] ?? process.cwd()),
      port: args['port'] !== undefined ? Number(args['port']) : undefined,
      minFreeMB: args['minFreeMB'] !== undefined ? Number(args['minFreeMB']) : undefined,
    })
    return JSON.stringify(result)
  },
})

agentLoop.registerTool({
  name: 'self_heal_repair',
  description:
    '工作区故障自愈修复:kind=dependency(依赖安装)/index(重建索引)/port(端口清理,需 forceKillPid)/disk(清理工作区白名单缓存目录)。默认 dryRun=true 只返回执行计划;确认后传 dryRun=false 真实执行,每步带审计记录。',
  execute: async (args) => {
    const result = await repairWorkspaceIssue({
      workspacePath: String(args['workspacePath'] ?? process.cwd()),
      kind: String(args['kind'] ?? '') as SelfHealIssueKind,
      dryRun: args['dryRun'] === undefined ? true : Boolean(args['dryRun']),
      port: args['port'] !== undefined ? Number(args['port']) : undefined,
      forceKillPid: args['forceKillPid'] !== undefined ? Number(args['forceKillPid']) : undefined,
      minFreeMB: args['minFreeMB'] !== undefined ? Number(args['minFreeMB']) : undefined,
      detail: args['detail'] !== undefined ? String(args['detail']) : undefined,
    })
    return JSON.stringify(result)
  },
})

/** 供启动日志确认工具已注册(与既有 fsBridge 工具同一生命周期) */
export const SELF_HEAL_TOOL_NAMES = ['self_heal_detect', 'self_heal_repair'] as const
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
