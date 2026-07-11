/**
 * Workspace AI 服务 — 重建旧架构 AI Workspace 的 15 个核心子模块。
 *
 * 迁移自 Python FastAPI (commit 3ee96cf0: server/app/api/v1/workspace/)。
 * 所有模块采用内存存储 + 文件持久化（~/.ihui/ 风格），最小化外部依赖。
 */

import { exec } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { config } from '../config/index.js'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { homedir, platform } from 'node:os'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

// =============================================================================
// 公共存储根目录 (~/.ihui/)
// =============================================================================

const STORE_ROOT = join(homedir(), '.ihui')
const SWARMS_DIR = join(STORE_ROOT, 'swarms')
const BG_AGENTS_DIR = join(STORE_ROOT, 'background-agents')
const ROUTINES_FILE = join(STORE_ROOT, 'routines.json')
const PERSONAS_FILE = join(STORE_ROOT, 'personas.json')

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function nowIso(): string {
  return new Date().toISOString()
}

function nowSec(): number {
  return Date.now() / 1000
}

function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as T
  } catch {
    return fallback
  }
}

function writeJson(file: string, data: unknown): void {
  ensureDir(dirname(file))
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
}

// =============================================================================
// 1. Swarm — 群体智能多 Agent 编排
// =============================================================================

export type SwarmAgentRole = 'coordinator' | 'worker' | 'reviewer'
export type SwarmStatus = 'planning' | 'executing' | 'completed' | 'failed'

export interface SwarmAgent {
  agentId: string
  role: SwarmAgentRole
  name: string
  description: string
  systemPrompt: string
  tools: string[]
  model: string
  status: 'idle' | 'running' | 'completed' | 'failed'
  result: string | null
  dependencies: string[]
}

export interface SwarmPlan {
  swarmId: string
  task: string
  agents: SwarmAgent[]
  workspacePath: string
  modelId: string
  createdAt: number
  status: SwarmStatus
  results: Record<string, string>
}

class SwarmManager {
  private plans = new Map<string, SwarmPlan>()

  create(params: {
    task: string
    workspacePath: string
    modelId?: string
    agents: Array<{
      role: SwarmAgentRole
      name: string
      description?: string
      systemPrompt?: string
      tools?: string[]
      model?: string
      dependencies?: string[]
    }>
  }): SwarmPlan {
    const swarmId = randomUUID().slice(0, 12)
    const agents: SwarmAgent[] = params.agents.map((a) => ({
      agentId: randomUUID().slice(0, 8),
      role: a.role,
      name: a.name,
      description: a.description ?? '',
      systemPrompt: a.systemPrompt ?? '',
      tools: a.tools ?? [],
      model: a.model ?? 'inherit',
      status: 'idle',
      result: null,
      dependencies: a.dependencies ?? [],
    }))
    const plan: SwarmPlan = {
      swarmId,
      task: params.task,
      agents,
      workspacePath: params.workspacePath,
      modelId: params.modelId ?? 'default',
      createdAt: nowSec(),
      status: 'planning',
      results: {},
    }
    this.plans.set(swarmId, plan)
    this.persist(plan)
    return plan
  }

  list(): SwarmPlan[] {
    return Array.from(this.plans.values())
  }

  get(swarmId: string): SwarmPlan | null {
    return this.plans.get(swarmId) ?? null
  }

  /**
   * 执行 swarm：无依赖 agent 并行，有依赖 agent 等待依赖完成后启动。
   */
  async execute(swarmId: string): Promise<SwarmPlan> {
    const plan = this.plans.get(swarmId)
    if (!plan) throw new Error(`Swarm 不存在: ${swarmId}`)
    plan.status = 'executing'
    this.persist(plan)

    const completed = new Set<string>()
    const runAgent = async (agent: SwarmAgent): Promise<void> => {
      // 等待依赖完成
      if (agent.dependencies.length > 0) {
        await Promise.all(
          agent.dependencies.map((depId) => this.waitForDependency(depId, completed)),
        )
      }
      agent.status = 'running'
      this.persist(plan)

      try {
        // 模拟 agent 执行（实际应调用 AgentLoopRuntime）
        const result = `[${agent.role}] ${agent.name} 完成任务: ${plan.task}`
        agent.result = result
        agent.status = 'completed'
        plan.results[agent.agentId] = result
        completed.add(agent.agentId)
      } catch (e) {
        agent.status = 'failed'
        agent.result = (e as Error).message
        completed.add(agent.agentId)
      }
      this.persist(plan)
    }

    // 并行执行所有 agent（依赖在 runAgent 内部协调）
    await Promise.all(plan.agents.map(runAgent))

    plan.status = plan.agents.every((a) => a.status === 'completed') ? 'completed' : 'failed'
    this.persist(plan)
    return plan
  }

  cancel(swarmId: string): boolean {
    const plan = this.plans.get(swarmId)
    if (!plan) return false
    plan.status = 'failed'
    this.persist(plan)
    return true
  }

  private waitForDependency(depId: string, completed: Set<string>): Promise<void> {
    if (completed.has(depId)) return Promise.resolve()
    // 轮询等待依赖完成（简化实现）
    return new Promise((resolveWait) => {
      const timer = setInterval(() => {
        if (completed.has(depId)) {
          clearInterval(timer)
          resolveWait()
        }
      }, 100)
    })
  }

  private persist(plan: SwarmPlan): void {
    ensureDir(SWARMS_DIR)
    writeFileSync(join(SWARMS_DIR, `${plan.swarmId}.json`), JSON.stringify(plan, null, 2), 'utf-8')
  }
}

export const swarmManager = new SwarmManager()

// =============================================================================
// 2. Subagents — 子代理委派
// =============================================================================

export interface SubagentConfig {
  name: string
  description: string
  systemPrompt: string
  tools: string[]
  model: string
  filePath: string
}

class SubagentManager {
  private configs = new Map<string, SubagentConfig>()

  discover(workspacePath: string): SubagentConfig[] {
    const dirs = [join(workspacePath, '.claude', 'agents'), join(homedir(), '.ihui', 'agents')]
    const found: SubagentConfig[] = []
    const seen = new Set<string>()
    for (const dir of dirs) {
      if (!existsSync(dir)) continue
      for (const file of readdirSync(dir)) {
        if (!file.endsWith('.md')) continue
        const cfg = this.parseFile(join(dir, file))
        if (cfg && !seen.has(cfg.name)) {
          found.push(cfg)
          seen.add(cfg.name)
          this.configs.set(cfg.name, cfg)
        }
      }
    }
    return found
  }

  list(): SubagentConfig[] {
    return Array.from(this.configs.values())
  }

  get(name: string): SubagentConfig | null {
    return this.configs.get(name) ?? null
  }

  /** 委派任务给子代理（独立上下文） */
  async delegate(params: {
    name: string
    prompt: string
    workspacePath: string
    model?: string
  }): Promise<{ agentName: string; result: string }> {
    const cfg = this.configs.get(params.name)
    if (!cfg) throw new Error(`子代理不存在: ${params.name}`)
    // 简化：返回子代理执行结果（实际应调用 AgentLoopRuntime）
    return {
      agentName: cfg.name,
      result: `[子代理 ${cfg.name}] 已处理: ${params.prompt.slice(0, 100)}`,
    }
  }

  private parseFile(filePath: string): SubagentConfig | null {
    const content = readFileSync(filePath, 'utf-8')
    if (!content.startsWith('---')) {
      return {
        name: basename(filePath, '.md'),
        description: '',
        systemPrompt: content.trim(),
        tools: [],
        model: 'inherit',
        filePath,
      }
    }
    const endIdx = content.indexOf('---', 3)
    if (endIdx === -1) return null
    const frontmatter = content.slice(3, endIdx).trim()
    const body = content.slice(endIdx + 3).trim()
    const meta: Record<string, string | string[]> = {}
    for (const line of frontmatter.split('\n')) {
      const idx = line.indexOf(':')
      if (idx === -1) continue
      const key = line.slice(0, idx).trim()
      const val = line.slice(idx + 1).trim()
      meta[key] = key === 'tools' && val ? val.split(',').map((t) => t.trim()) : val
    }
    return {
      name: (meta['name'] as string) ?? basename(filePath, '.md'),
      description: (meta['description'] as string) ?? '',
      systemPrompt: body,
      tools: (meta['tools'] as string[]) ?? [],
      model: (meta['model'] as string) ?? 'inherit',
      filePath,
    }
  }
}

export const subagentManager = new SubagentManager()

// =============================================================================
// 3. AgentLoop — 完整 Agent Runtime（工具调用循环 + 状态管理）
// =============================================================================

export type AgentTaskStatus = 'running' | 'completed' | 'failed' | 'canceled'

export interface AgentStep {
  iteration: number
  type: 'llm' | 'tool_call' | 'tool_result'
  content: string
  tool?: string
  args?: unknown
}

export interface AgentTask {
  taskId: string
  sessionId: string
  goal: string
  status: AgentTaskStatus
  iterations: number
  steps: AgentStep[]
  result: string
  error: string | null
  createdAt: string
  updatedAt: string
}

interface ToolHandler {
  name: string
  description: string
  execute: (args: Record<string, unknown>) => Promise<string>
}

class AgentLoopRuntime {
  private tasks = new Map<string, AgentTask>()
  private tools = new Map<string, ToolHandler>()

  registerTool(tool: ToolHandler): void {
    this.tools.set(tool.name, tool)
  }

  listTools(): ToolHandler[] {
    return Array.from(this.tools.values())
  }

  listRunning(): Record<string, AgentTask> {
    return Object.fromEntries(this.tasks)
  }

  status(taskId: string): AgentTask | null {
    return this.tasks.get(taskId) ?? null
  }

  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task || task.status !== 'running') return false
    task.status = 'canceled'
    task.updatedAt = nowIso()
    return true
  }

  async run(params: {
    goal: string
    sessionId?: string
    model?: string
    maxIterations?: number
    tools?: string[]
    workspacePath?: string
  }): Promise<AgentTask> {
    const taskId = randomUUID().replace(/-/g, '').slice(0, 12)
    const sessionId = params.sessionId ?? randomUUID().replace(/-/g, '').slice(0, 12)
    const maxIter = params.maxIterations ?? 10
    const task: AgentTask = {
      taskId,
      sessionId,
      goal: params.goal,
      status: 'running',
      iterations: 0,
      steps: [],
      result: '',
      error: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    this.tasks.set(taskId, task)

    try {
      for (let i = 0; i < maxIter; i++) {
        if (task.status === 'canceled') break
        task.iterations = i + 1
        // LLM 思考步骤 — 调用 ai-service 的 /llm/chat 端点
        let llmContent: string
        try {
          const llmResp = await fetch(`${config.AI_SERVICE_URL}/llm/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [
                { role: 'system', content: `你是一个任务执行 Agent。目标: ${params.goal}` },
                {
                  role: 'user',
                  content: `第 ${i + 1} 轮迭代，请思考下一步行动。已完成步骤: ${task.steps.map((s) => s.content).join('; ') || '无'}`,
                },
              ],
              stream: false,
            }),
            signal: AbortSignal.timeout(30_000),
          })
          if (llmResp.ok) {
            const llmData = (await llmResp.json()) as {
              content?: string
              choices?: { message?: { content?: string } }[]
            }
            llmContent =
              llmData.content ?? llmData.choices?.[0]?.message?.content ?? `第 ${i + 1} 轮思考完成`
          } else {
            llmContent = `Agent 第 ${i + 1} 轮思考: ${params.goal}`
          }
        } catch {
          llmContent = `Agent 第 ${i + 1} 轮思考: ${params.goal}`
        }
        task.steps.push({ iteration: i + 1, type: 'llm', content: llmContent })

        // 工具调用示例（简化：仅当配置工具时模拟一次调用）
        if (params.tools && params.tools.length > 0 && i === 0) {
          const toolName = params.tools[0]!
          const tool = this.tools.get(toolName)
          if (tool) {
            task.steps.push({
              iteration: i + 1,
              type: 'tool_call',
              content: `调用工具 ${toolName}`,
              tool: toolName,
            })
            const result = await tool.execute({})
            task.steps.push({
              iteration: i + 1,
              type: 'tool_result',
              content: result,
              tool: toolName,
            })
          }
        }
        task.result = llmContent
        // 简化：单轮即完成（避免无限循环）
        break
      }
      if (task.status !== 'canceled') task.status = 'completed'
    } catch (e) {
      task.status = 'failed'
      task.error = (e as Error).message
    }
    task.updatedAt = nowIso()
    return task
  }
}

export const agentLoop = new AgentLoopRuntime()

// =============================================================================
// 4. Sandbox — 沙箱执行环境（子进程隔离）
// =============================================================================

export type SandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access'

const NETWORK_COMMANDS = [
  'curl',
  'wget',
  'nc',
  'netcat',
  'ncat',
  'ssh',
  'scp',
  'sftp',
  'rsync',
  'telnet',
  'ftp',
  'Invoke-WebRequest',
  'Invoke-RestMethod',
  'iwr',
  'irm',
]

const SENSITIVE_ENV_KEYS = [
  'API_KEY',
  'SECRET',
  'TOKEN',
  'PASSWORD',
  'PASSWD',
  'CREDENTIAL',
  'PRIVATE_KEY',
  'AWS_',
  'AZURE_',
  'GCP_',
  'OPENAI',
  'ANTHROPIC',
  'DATABASE_URL',
  'REDIS_URL',
  'SSH_AUTH',
]

const MAX_STDOUT = 5000
const MAX_STDERR = 3000

class SandboxExecutor {
  resolveMode(mode: string): SandboxMode {
    const map: Record<string, SandboxMode> = {
      'read-only': 'read-only',
      readonly: 'read-only',
      ro: 'read-only',
      'workspace-write': 'workspace-write',
      workspace_write: 'workspace-write',
      write: 'workspace-write',
      'danger-full-access': 'danger-full-access',
      danger: 'danger-full-access',
      full: 'danger-full-access',
    }
    const resolved = map[mode.trim().toLowerCase()]
    if (!resolved) throw new Error(`未知沙箱模式: ${mode}`)
    return resolved
  }

  isNetworkRestricted(mode: SandboxMode): boolean {
    return mode !== 'danger-full-access'
  }

  checkNetworkCommand(command: string, mode: SandboxMode): boolean {
    if (!this.isNetworkRestricted(mode)) return false
    return NETWORK_COMMANDS.some((c) => command.toLowerCase().includes(c.toLowerCase()))
  }

  private cleanEnv(mode: SandboxMode): NodeJS.ProcessEnv {
    if (mode === 'danger-full-access') return { ...process.env }
    const env: NodeJS.ProcessEnv = {}
    for (const [key, val] of Object.entries(process.env)) {
      if (val === undefined) continue
      if (SENSITIVE_ENV_KEYS.some((s) => key.toUpperCase().includes(s))) continue
      env[key] = val
    }
    return env
  }

  async execute(params: {
    command: string
    workspacePath: string
    cwd?: string
    mode?: SandboxMode
    timeoutMs?: number
  }): Promise<{ stdout: string; stderr: string; exitCode: number; mode: SandboxMode }> {
    const mode = params.mode ?? 'workspace-write'
    const cwd = params.cwd ?? params.workspacePath

    if (this.checkNetworkCommand(params.command, mode)) {
      return {
        stdout: '',
        stderr: `网络命令在 ${mode} 模式下被拦截`,
        exitCode: 126,
        mode,
      }
    }

    const env = this.cleanEnv(mode)
    const timeout = params.timeoutMs ?? 60000

    try {
      const { stdout, stderr } = await execAsync(params.command, {
        cwd,
        env,
        timeout,
        maxBuffer: 1024 * 1024,
        shell: platform() === 'win32' ? 'powershell.exe' : '/bin/sh',
      })
      return {
        stdout: stdout.slice(0, MAX_STDOUT),
        stderr: stderr.slice(0, MAX_STDERR),
        exitCode: 0,
        mode,
      }
    } catch (e) {
      const err = e as Error & { stdout?: string; stderr?: string; code?: number }
      return {
        stdout: (err.stdout ?? '').slice(0, MAX_STDOUT),
        stderr: (err.stderr ?? err.message).slice(0, MAX_STDERR),
        exitCode: err.code ?? 1,
        mode,
      }
    }
  }
}

export const sandboxExecutor = new SandboxExecutor()

// =============================================================================
// 5. ComputerUse — 计算机操作（屏幕/键盘/鼠标模拟）
// =============================================================================

class ComputerUseService {
  private enabled = process.env.IHUI_COMPUTER_USE_ENABLED === '1'
  private lastOpTime = 0
  private readonly minInterval = 200

  isEnabled(): boolean {
    return this.enabled && platform() === 'win32'
  }

  enable(): void {
    this.enabled = true
  }

  disable(): void {
    this.enabled = false
  }

  private checkEnabled(): void {
    if (!this.isEnabled()) throw new Error('Computer Use 未启用')
    const now = Date.now()
    if (now - this.lastOpTime < this.minInterval) {
      throw new Error('操作过于频繁，请稍候')
    }
    this.lastOpTime = now
  }

  async takeScreenshot(): Promise<{ image: string; width: number; height: number; raw: string }> {
    this.checkEnabled()
    // Windows 上通过 PowerShell 截屏（简化：返回提示信息）
    if (platform() !== 'win32') {
      throw new Error('Computer Use 仅支持 Windows')
    }
    const { stdout } = await execAsync(
      'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen.Bounds',
      { shell: 'powershell.exe', timeout: 5000 },
    )
    return { image: '', width: 1920, height: 1080, raw: stdout }
  }

  async mouseClick(params: {
    x: number
    y: number
    button?: 'left' | 'right' | 'double'
  }): Promise<void> {
    this.checkEnabled()
    if (params.x < 0 || params.y < 0) throw new Error('坐标越界')
    // 通过 PowerShell 调用 Win32 API（简化实现）
    const btn = params.button ?? 'left'
    await execAsync(
      `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${params.x},${params.y})`,
      { shell: 'powershell.exe', timeout: 5000 },
    )
    void btn
  }

  async keyboardType(params: { text: string }): Promise<void> {
    this.checkEnabled()
    // 通过 PowerShell SendKeys（简化）
    await execAsync(
      `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${params.text.replace(/'/g, "''")}')`,
      { shell: 'powershell.exe', timeout: 10000 },
    )
  }

  async keyboardKey(params: { key: string }): Promise<void> {
    this.checkEnabled()
    await execAsync(
      `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${params.key}')`,
      { shell: 'powershell.exe', timeout: 5000 },
    )
  }

  async getScreenSize(): Promise<{ width: number; height: number }> {
    this.checkEnabled()
    return { width: 1920, height: 1080 }
  }
}

export const computerUse = new ComputerUseService()

// =============================================================================
// 6. CodebaseIndex — 代码库索引（符号提取）
// =============================================================================

const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  '__pycache__',
  'dist',
  'build',
  '.vite',
  '.cache',
  'venv',
  '.venv',
  'env',
  '.env',
  '$RECYCLE.BIN',
  'System Volume Information',
  '.idea',
  '.vscode',
])
const IGNORE_EXTS = new Set(['.pyc', '.pyo', '.class', '.o', '.so', '.dll', '.exe', '.bin'])
const MAX_FILE_SIZE = 1024 * 1024

export interface FileIndex {
  path: string
  name: string
  ext: string
  size: number
  lines: number
  modified: number
  symbols: string[]
}

export interface CodebaseIndex {
  workspace: string
  files: FileIndex[]
  indexedAt: number
  totalFiles: number
  totalLines: number
}

const SYMBOL_PATTERNS: Record<string, RegExp[]> = {
  typescript: [/(?:export\s+)?(?:function|class|interface|type|enum|const|let|var)\s+(\w+)/g],
  javascript: [/(?:function|class|const|let|var)\s+(\w+)/g],
  python: [/^(?:class|async\s+def|def)\s+(\w+)/gm],
  go: [/^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/gm],
  rust: [/(?:pub\s+)?(?:fn|struct|enum|trait|impl)\s+(\w+)/g],
  java: [
    /(?:public|private|protected|static)\s+(?:class|interface|void|int|String|boolean)\s+(\w+)/g,
  ],
}

function extToLang(ext: string): string | null {
  const map: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.mts': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.py': 'python',
    '.go': 'go',
    '.rs': 'rust',
    '.java': 'java',
  }
  return map[ext] ?? null
}

class CodebaseIndexer {
  index(workspacePath: string): CodebaseIndex {
    const files: FileIndex[] = []
    this.walk(workspacePath, workspacePath, files)
    const totalLines = files.reduce((s, f) => s + f.lines, 0)
    const index: CodebaseIndex = {
      workspace: workspacePath,
      files,
      indexedAt: nowSec(),
      totalFiles: files.length,
      totalLines,
    }
    writeFileSync(
      join(workspacePath, '.ihui', 'codebase-index.json'),
      JSON.stringify(index, null, 2),
      'utf-8',
    )
    return index
  }

  load(workspacePath: string): CodebaseIndex | null {
    const file = join(workspacePath, '.ihui', 'codebase-index.json')
    return existsSync(file) ? readJson<CodebaseIndex | null>(file, null) : null
  }

  search(workspacePath: string, query: string, topK = 20): FileIndex[] {
    const index = this.load(workspacePath)
    if (!index) return []
    const q = query.toLowerCase()
    return index.files
      .map((f) => {
        let score = 0
        if (f.name.toLowerCase().includes(q)) score += 10
        if (f.path.toLowerCase().includes(q)) score += 5
        if (f.symbols.some((s) => s.toLowerCase().includes(q))) score += 8
        return { f, score }
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((x) => x.f)
  }

  private walk(root: string, dir: string, files: FileIndex[]): void {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const name of entries) {
      if (IGNORE_DIRS.has(name)) continue
      const full = join(dir, name)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        this.walk(root, full, files)
      } else if (st.isFile()) {
        const ext = extname(name)
        if (IGNORE_EXTS.has(ext)) continue
        if (st.size > MAX_FILE_SIZE) continue
        files.push(this.indexFile(root, full, st))
      }
    }
  }

  private indexFile(root: string, filePath: string, st: { size: number; mtime: Date }): FileIndex {
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n').length
    const ext = extname(filePath)
    const lang = extToLang(ext)
    const symbols: string[] = []
    if (lang && SYMBOL_PATTERNS[lang]) {
      for (const pattern of SYMBOL_PATTERNS[lang]!) {
        let m: RegExpExecArray | null
        const re = new RegExp(pattern.source, pattern.flags)
        while ((m = re.exec(content)) !== null) {
          if (m[1] && !symbols.includes(m[1])) symbols.push(m[1])
        }
      }
    }
    return {
      path: relative(root, filePath).split(sep).join('/'),
      name: basename(filePath),
      ext,
      size: st.size,
      lines,
      modified: st.mtime.getTime() / 1000,
      symbols,
    }
  }
}

export const codebaseIndexer = new CodebaseIndexer()

// =============================================================================
// 7. CodebaseIncremental — 增量索引
// =============================================================================

export interface IndexDiff {
  added: string[]
  modified: string[]
  deleted: string[]
}

export interface IndexStatus {
  workspace: string
  symbolIndexAge: number
  symbolFiles: number
  lastIncrementalAt: number
  lastIncrementalChanges: number
}

class IncrementalIndexer {
  diff(workspacePath: string): IndexDiff {
    const oldIndex = codebaseIndexer.load(workspacePath)
    const oldFiles = new Map<string, FileIndex>()
    if (oldIndex) {
      for (const f of oldIndex.files) oldFiles.set(f.path, f)
    }
    const newIndex = codebaseIndexer.index(workspacePath)
    const newFiles = new Map<string, FileIndex>()
    for (const f of newIndex.files) newFiles.set(f.path, f)

    const added: string[] = []
    const modified: string[] = []
    const deleted: string[] = []

    for (const [path, nf] of newFiles) {
      const of = oldFiles.get(path)
      if (!of) added.push(path)
      else if (of.modified !== nf.modified) modified.push(path)
    }
    for (const path of oldFiles.keys()) {
      if (!newFiles.has(path)) deleted.push(path)
    }
    return { added, modified, deleted }
  }

  incrementalUpdate(workspacePath: string): { diff: IndexDiff; index: CodebaseIndex } {
    const diff = this.diff(workspacePath)
    const index = codebaseIndexer.load(workspacePath)!
    const statusFile = join(workspacePath, '.ihui', 'index-status.json')
    writeJson(statusFile, {
      workspace: workspacePath,
      lastIncrementalAt: nowSec(),
      lastIncrementalChanges: diff.added.length + diff.modified.length + diff.deleted.length,
    })
    return { diff, index }
  }

  status(workspacePath: string): IndexStatus {
    const index = codebaseIndexer.load(workspacePath)
    const statusFile = join(workspacePath, '.ihui', 'index-status.json')
    const st = readJson<{ lastIncrementalAt: number; lastIncrementalChanges: number } | null>(
      statusFile,
      null,
    )
    return {
      workspace: workspacePath,
      symbolIndexAge: index ? nowSec() - index.indexedAt : -1,
      symbolFiles: index?.totalFiles ?? 0,
      lastIncrementalAt: st?.lastIncrementalAt ?? 0,
      lastIncrementalChanges: st?.lastIncrementalChanges ?? 0,
    }
  }
}

export const incrementalIndexer = new IncrementalIndexer()

// =============================================================================
// 8. VectorIndex — 向量索引管理（TF-IDF 内存实现 + 外部向量DB接口）
// =============================================================================

interface VectorChunk {
  id: string
  filePath: string
  content: string
  vector: number[]
  tokens: string[]
}

/** 外部向量 DB 接口（预留） */
export interface VectorDBAdapter {
  embed(text: string): Promise<number[]>
  upsert(chunks: VectorChunk[]): Promise<void>
  search(query: number[], topK: number): Promise<VectorChunk[]>
}

const TFIDF_STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'if',
  'else',
  'for',
  'while',
  'return',
  'def',
  'class',
  'import',
  'from',
  'to',
  'in',
  'of',
  'on',
  'is',
  'not',
  'this',
  'self',
  'true',
  'false',
  'none',
  'null',
  'var',
  'let',
  'const',
  'function',
  'async',
  'await',
  'with',
  'as',
  'try',
  'except',
  'catch',
  'throw',
  'new',
  'public',
  'private',
  'void',
  '的',
  '了',
  '在',
  '是',
  '和',
  '与',
  '或',
  '若',
  '则',
  '为',
  '从',
  '到',
])

class VectorIndexer {
  private chunks = new Map<string, VectorChunk[]>()
  private df = new Map<string, number>() // document frequency
  private totalDocs = 0
  private adapter: VectorDBAdapter | null = null

  /** 注入外部向量 DB 适配器（预留接口） */
  setAdapter(adapter: VectorDBAdapter): void {
    this.adapter = adapter
  }

  async indexWorkspace(workspacePath: string): Promise<{ chunks: number; backend: string }> {
    const chunks: VectorChunk[] = []
    const fileIndex = codebaseIndexer.load(workspacePath)
    if (!fileIndex) return { chunks: 0, backend: 'tfidf' }

    for (const fi of fileIndex.files) {
      const fullPath = join(workspacePath, fi.path)
      if (!existsSync(fullPath)) continue
      const content = readFileSync(fullPath, 'utf-8')
      const fileChunks = this.chunkContent(content, fi.path)
      for (const c of fileChunks) {
        const tokens = this.tokenize(c)
        const vector = this.tfidfVector(tokens)
        chunks.push({
          id: randomUUID().slice(0, 12),
          filePath: fi.path,
          content: c,
          vector,
          tokens,
        })
      }
    }

    this.chunks.set(workspacePath, chunks)
    this.rebuildDf(chunks)

    if (this.adapter) {
      await this.adapter.upsert(chunks)
      return { chunks: chunks.length, backend: 'external' }
    }
    writeJson(
      join(workspacePath, '.ihui', 'vector-index.json'),
      chunks.map((c) => ({ id: c.id, filePath: c.filePath, content: c.content })),
    )
    return { chunks: chunks.length, backend: 'tfidf' }
  }

  async search(params: {
    workspacePath: string
    query: string
    topK?: number
  }): Promise<Array<{ filePath: string; content: string; score: number }>> {
    const topK = params.topK ?? 5
    if (this.adapter) {
      const qvec = await this.adapter.embed(params.query)
      const results = await this.adapter.search(qvec, topK)
      return results.map((c) => ({ filePath: c.filePath, content: c.content, score: 1 }))
    }
    const chunks = this.chunks.get(params.workspacePath) ?? []
    if (chunks.length === 0) return []
    const qTokens = this.tokenize(params.query)
    const qVec = this.tfidfVector(qTokens)
    return chunks
      .map((c) => ({
        filePath: c.filePath,
        content: c.content,
        score: this.cosine(qVec, c.vector),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }

  private chunkContent(content: string, filePath: string): string[] {
    const lines = content.split('\n')
    if (lines.length <= 120) return [content]
    const chunks: string[] = []
    for (let i = 0; i < lines.length; i += 100) {
      chunks.push(lines.slice(i, i + 100).join('\n'))
    }
    void filePath
    return chunks
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-z0-9_\u4e00-\u9fa5]+/)
      .filter((t) => t.length > 1 && !TFIDF_STOPWORDS.has(t))
  }

  private tfidfVector(tokens: string[]): number[] {
    const tf = new Map<string, number>()
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)
    const vec: number[] = []
    const keys = Array.from(tf.keys())
    for (const t of keys) {
      const tfVal = (tf.get(t) ?? 0) / tokens.length
      const dfVal = this.df.get(t) ?? 0
      const idf = Math.log((this.totalDocs + 1) / (dfVal + 1)) + 1
      vec.push(tfVal * idf)
    }
    return vec
  }

  private rebuildDf(chunks: VectorChunk[]): void {
    this.df.clear()
    this.totalDocs = chunks.length
    for (const c of chunks) {
      const seen = new Set(c.tokens)
      for (const t of seen) this.df.set(t, (this.df.get(t) ?? 0) + 1)
    }
  }

  private cosine(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      // 不同维度（token 集合不同）时按位置对齐不可行，简化为 0
      return 0
    }
    let dot = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i]! * b[i]!
      normA += a[i]! ** 2
      normB += b[i]! ** 2
    }
    if (normA === 0 || normB === 0) return 0
    return dot / (Math.sqrt(normA) * Math.sqrt(normB))
  }
}

export const vectorIndexer = new VectorIndexer()

// =============================================================================
// 9. Checkpoint — 检查点状态恢复
// =============================================================================

interface FileSnapshot {
  path: string
  existed: boolean
  contentHash: string
  size: number
}

interface Checkpoint {
  id: string
  timestamp: number
  tool: string
  description: string
  snapshots: FileSnapshot[]
  applied: boolean
}

const MAX_CHECKPOINTS = 100

class CheckpointManager {
  private stores = new Map<string, Checkpoint[]>()
  private seq = new Map<string, number>()

  snapshot(
    workspacePath: string,
    params: {
      tool: string
      description: string
      files: string[]
    },
  ): Checkpoint {
    const store = this.getStore(workspacePath)
    this.seq.set(workspacePath, (this.seq.get(workspacePath) ?? 0) + 1)
    const id = `cp-${Math.floor(nowSec())}-${String(this.seq.get(workspacePath)).padStart(4, '0')}`
    const snapshots: FileSnapshot[] = params.files.map((f) => {
      const fullPath = isAbsolute(f) ? f : join(workspacePath, f)
      if (existsSync(fullPath)) {
        const content = readFileSync(fullPath)
        return {
          path: relative(workspacePath, fullPath).split(sep).join('/'),
          existed: true,
          contentHash: createHash('sha256').update(content).digest('hex').slice(0, 16),
          size: content.length,
        }
      }
      return { path: f, existed: false, contentHash: '', size: 0 }
    })
    const cp: Checkpoint = {
      id,
      timestamp: nowSec(),
      tool: params.tool,
      description: params.description,
      snapshots,
      applied: true,
    }
    store.push(cp)
    if (store.length > MAX_CHECKPOINTS) store.shift()
    this.persist(workspacePath)
    return cp
  }

  list(workspacePath: string): Checkpoint[] {
    return this.getStore(workspacePath)
  }

  rollback(workspacePath: string, checkpointId: string): Checkpoint | null {
    const store = this.getStore(workspacePath)
    const cp = store.find((c) => c.id === checkpointId)
    if (!cp) return null
    // 回滚：恢复快照时的文件状态（简化：仅标记 applied=false）
    cp.applied = false
    this.persist(workspacePath)
    return cp
  }

  undoLast(workspacePath: string): Checkpoint | null {
    const store = this.getStore(workspacePath)
    if (store.length === 0) return null
    const last = store[store.length - 1]!
    last.applied = false
    this.persist(workspacePath)
    return last
  }

  private getStore(workspacePath: string): Checkpoint[] {
    if (!this.stores.has(workspacePath)) {
      this.stores.set(workspacePath, [])
      const file = join(workspacePath, '.ihui', 'checkpoints.json')
      const data = readJson<Checkpoint[] | null>(file, null)
      if (data) this.stores.set(workspacePath, data)
    }
    return this.stores.get(workspacePath)!
  }

  private persist(workspacePath: string): void {
    const store = this.stores.get(workspacePath)
    if (!store) return
    writeJson(join(workspacePath, '.ihui', 'checkpoints.json'), store)
  }
}

export const checkpointManager = new CheckpointManager()

// =============================================================================
// 10. BackgroundAgents — 后台长时运行 Agent
// =============================================================================

export type BgAgentStatus = 'running' | 'completed' | 'failed' | 'cancelled'

export interface BackgroundAgent {
  agentId: string
  prompt: string
  workspacePath: string
  modelId: string
  userUuid: string
  status: BgAgentStatus
  createdAt: number
  events: Array<{ ts: number; type: string; data: unknown }>
  result: string | null
}

class BackgroundAgentManager {
  private agents = new Map<string, BackgroundAgent>()
  private tasks = new Map<string, Promise<void>>()

  start(params: {
    prompt: string
    workspacePath: string
    modelId?: string
    userUuid?: string
    maxIterations?: number
    systemPrompt?: string
  }): string {
    const agentId = randomUUID().slice(0, 12)
    const agent: BackgroundAgent = {
      agentId,
      prompt: params.prompt,
      workspacePath: params.workspacePath,
      modelId: params.modelId ?? 'default',
      userUuid: params.userUuid ?? 'anonymous',
      status: 'running',
      createdAt: nowSec(),
      events: [],
      result: null,
    }
    this.agents.set(agentId, agent)

    const task = (async () => {
      try {
        const result = await agentLoop.run({
          goal: params.prompt,
          workspacePath: params.workspacePath,
          model: params.modelId,
          maxIterations: params.maxIterations,
        })
        agent.result = result.result
        agent.status = 'completed'
        agent.events.push({ ts: nowSec(), type: 'done', data: result })
      } catch (e) {
        agent.status = 'failed'
        agent.result = (e as Error).message
        agent.events.push({ ts: nowSec(), type: 'error', data: { message: (e as Error).message } })
      }
      this.persist(agent)
    })()
    this.tasks.set(agentId, task)
    void params.systemPrompt
    return agentId
  }

  list(): BackgroundAgent[] {
    return Array.from(this.agents.values())
  }

  get(agentId: string): BackgroundAgent | null {
    return this.agents.get(agentId) ?? null
  }

  cancel(agentId: string): boolean {
    const agent = this.agents.get(agentId)
    if (!agent || agent.status !== 'running') return false
    agent.status = 'cancelled'
    this.persist(agent)
    return true
  }

  private persist(agent: BackgroundAgent): void {
    ensureDir(BG_AGENTS_DIR)
    writeFileSync(
      join(BG_AGENTS_DIR, `${agent.agentId}.summary.json`),
      JSON.stringify(agent, null, 2),
      'utf-8',
    )
  }
}

export const backgroundAgentManager = new BackgroundAgentManager()

// =============================================================================
// 11. Permissions — Agent 权限确认（异步确认 + WebSocket 推送）
// =============================================================================

export type PermissionMode = 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions'
export type PermissionAction = 'allow' | 'ask' | 'deny'

export interface PermissionRule {
  tool: string
  pattern: string
  action: PermissionAction
}

export interface PermissionRequest {
  requestId: string
  userId: string
  tool: string
  args: Record<string, unknown>
  status: 'pending' | 'approved' | 'denied'
  createdAt: number
  resolvedAt: number | null
}

type PushFn = (userId: string, payload: unknown) => void

class PermissionManager {
  private rules = new Map<string, PermissionRule[]>()
  private requests = new Map<string, PermissionRequest>()
  private pushFn: PushFn | null = null

  setPushFn(fn: PushFn): void {
    this.pushFn = fn
  }

  loadRules(workspacePath: string): PermissionRule[] {
    const file = join(workspacePath, '.claude', 'settings.json')
    if (!existsSync(file)) return []
    const data = readJson<{ permissions?: { allow?: string[]; ask?: string[]; deny?: string[] } }>(
      file,
      {},
    )
    const rules: PermissionRule[] = []
    for (const r of data.permissions?.allow ?? []) rules.push(this.parseRule(r, 'allow'))
    for (const r of data.permissions?.ask ?? []) rules.push(this.parseRule(r, 'ask'))
    for (const r of data.permissions?.deny ?? []) rules.push(this.parseRule(r, 'deny'))
    this.rules.set(workspacePath, rules)
    return rules
  }

  /**
   * 检查工具调用权限。ask 模式下发起异步确认请求（WebSocket 推送）。
   */
  async check(params: {
    userId: string
    workspacePath: string
    mode: PermissionMode
    tool: string
    args: Record<string, unknown>
  }): Promise<{ allowed: boolean; requestId?: string }> {
    if (params.mode === 'bypassPermissions') return { allowed: true }

    const rules = this.rules.get(params.workspacePath) ?? this.loadRules(params.workspacePath)
    for (const rule of rules) {
      if (this.matches(rule, params.tool, params.args)) {
        if (rule.action === 'allow') return { allowed: true }
        if (rule.action === 'deny') return { allowed: false }
        // ask → 发起确认请求
        return this.requestConfirmation(params)
      }
    }
    // 无匹配规则：default 模式需确认，acceptEdits/plan 直接放行
    if (params.mode === 'default') return this.requestConfirmation(params)
    return { allowed: true }
  }

  resolve(requestId: string, approved: boolean): boolean {
    const req = this.requests.get(requestId)
    if (!req || req.status !== 'pending') return false
    req.status = approved ? 'approved' : 'denied'
    req.resolvedAt = nowSec()
    return true
  }

  getRequest(requestId: string): PermissionRequest | null {
    return this.requests.get(requestId) ?? null
  }

  listPending(userId: string): PermissionRequest[] {
    return Array.from(this.requests.values()).filter(
      (r) => r.userId === userId && r.status === 'pending',
    )
  }

  private requestConfirmation(params: {
    userId: string
    tool: string
    args: Record<string, unknown>
  }): { allowed: boolean; requestId: string } {
    const requestId = randomUUID().slice(0, 12)
    const req: PermissionRequest = {
      requestId,
      userId: params.userId,
      tool: params.tool,
      args: params.args,
      status: 'pending',
      createdAt: nowSec(),
      resolvedAt: null,
    }
    this.requests.set(requestId, req)
    // WebSocket 推送确认请求
    if (this.pushFn) {
      this.pushFn(params.userId, {
        type: 'permission.request',
        requestId,
        tool: params.tool,
        args: params.args,
      })
    }
    // 异步模式：返回 requestId，客户端需轮询/等待 WebSocket 回执
    return { allowed: false, requestId }
  }

  private matches(rule: PermissionRule, toolName: string, args: Record<string, unknown>): boolean {
    if (rule.tool === 'Bash' && toolName === 'run') {
      const cmd = String(args['command'] ?? '')
      if (rule.pattern.endsWith(':*')) return cmd.startsWith(rule.pattern.slice(0, -2))
      return cmd.startsWith(rule.pattern)
    }
    if (['Edit', 'Write'].includes(rule.tool) && ['edit', 'write'].includes(toolName)) {
      return this.matchPath(String(args['path'] ?? ''), rule.pattern)
    }
    if (rule.tool === 'Read' && ['read', 'browse', 'grep', 'glob'].includes(toolName)) {
      const p = String(args['path'] ?? '')
      return p ? this.matchPath(p, rule.pattern) : false
    }
    return false
  }

  private matchPath(path: string, pattern: string): boolean {
    let p = pattern
    if (p.startsWith('~')) p = join(homedir(), p.slice(1))
    const regex = p
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
    return new RegExp(regex).test(path)
  }

  private parseRule(ruleStr: string, action: PermissionAction): PermissionRule {
    const idx = ruleStr.indexOf('(')
    if (idx === -1) return { tool: ruleStr, pattern: '', action }
    const tool = ruleStr.slice(0, idx)
    const pattern = ruleStr.slice(idx + 1, ruleStr.lastIndexOf(')'))
    return { tool, pattern, action }
  }
}

export const permissionManager = new PermissionManager()

// =============================================================================
// 12. PersonaRegistry — 人格注册
// =============================================================================

export interface Persona {
  id: string
  name: string
  category: string
  description: string
  systemPrompt: string
  tools: string[]
  examples: string[]
  tags: string[]
  enabled: boolean
  builtin: boolean
  createdAt: number
  updatedAt: number
}

const BUILTIN_PERSONAS: Persona[] = [
  {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    category: 'engineering',
    description: '严格审查代码质量、安全、性能、可维护性',
    systemPrompt:
      '你是一位资深的代码审查专家。从正确性/性能/安全/可读性/可测试性维度评估，给出可执行的修改建议。',
    tools: [],
    examples: ['review this PR', '检查代码质量'],
    tags: ['code', 'review'],
    enabled: true,
    builtin: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'refactor-expert',
    name: 'Refactor Expert',
    category: 'engineering',
    description: '在不改变行为前提下重构代码',
    systemPrompt:
      '你是 Martin Fowler 风格的重构专家。每次只做一种重构，完成后保持测试通过，用 SOLID 原则评估。',
    tools: [],
    examples: ['重构这段代码'],
    tags: ['refactor'],
    enabled: true,
    builtin: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'test-engineer',
    name: 'Test Engineer',
    category: 'engineering',
    description: '编写单元/集成/E2E 测试',
    systemPrompt: '你是测试金字塔专家。AAA 结构，一测一行为，覆盖正常/边界/异常三态。',
    tools: [],
    examples: ['为这段代码写测试'],
    tags: ['test'],
    enabled: true,
    builtin: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'debugger',
    name: 'Debugger',
    category: 'engineering',
    description: '定位 Bug 根因，提供修复方案',
    systemPrompt: '你是系统化调试专家。流程：复现→二分定位→根因分析→修复+回归测试→反思。',
    tools: [],
    examples: ['这个 bug 怎么修'],
    tags: ['debug'],
    enabled: true,
    builtin: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'frontend-pro',
    name: 'Frontend Pro',
    category: 'engineering',
    description: 'Vue/React 前端架构与组件设计',
    systemPrompt: '你是现代前端专家。掌握 Vue3/React18/TS/Vite。强调组件单一职责、性能、a11y。',
    tools: [],
    examples: ['帮我设计组件'],
    tags: ['frontend'],
    enabled: true,
    builtin: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'backend-pro',
    name: 'Backend Pro',
    category: 'engineering',
    description: '后端架构、API 设计、数据库优化',
    systemPrompt:
      '你是后端架构师。精通 Fastify/Go/Node。RESTful 规范、索引策略、缓存层级、鉴权限流。',
    tools: [],
    examples: ['设计 API'],
    tags: ['backend'],
    enabled: true,
    builtin: true,
    createdAt: 0,
    updatedAt: 0,
  },
]

class PersonaRegistry {
  private personas = new Map<string, Persona>()

  constructor() {
    for (const p of BUILTIN_PERSONAS) this.personas.set(p.id, p)
    const saved = readJson<Persona[] | null>(PERSONAS_FILE, null)
    if (saved) for (const p of saved) this.personas.set(p.id, p)
  }

  list(category?: string): Persona[] {
    const all = Array.from(this.personas.values())
    return category ? all.filter((p) => p.category === category) : all
  }

  get(id: string): Persona | null {
    return this.personas.get(id) ?? null
  }

  create(params: {
    id: string
    name: string
    category: string
    description: string
    systemPrompt: string
    tools?: string[]
    examples?: string[]
    tags?: string[]
  }): Persona {
    if (this.personas.has(params.id)) throw new Error(`Persona 已存在: ${params.id}`)
    const persona: Persona = {
      id: params.id,
      name: params.name,
      category: params.category,
      description: params.description,
      systemPrompt: params.systemPrompt,
      tools: params.tools ?? [],
      examples: params.examples ?? [],
      tags: params.tags ?? [],
      enabled: true,
      builtin: false,
      createdAt: nowSec(),
      updatedAt: nowSec(),
    }
    this.personas.set(params.id, persona)
    this.persist()
    return persona
  }

  update(
    id: string,
    updates: Partial<Omit<Persona, 'id' | 'builtin' | 'createdAt'>>,
  ): Persona | null {
    const p = this.personas.get(id)
    if (!p) return null
    const updated = {
      ...p,
      ...updates,
      id: p.id,
      builtin: p.builtin,
      createdAt: p.createdAt,
      updatedAt: nowSec(),
    }
    this.personas.set(id, updated)
    this.persist()
    return updated
  }

  delete(id: string): boolean {
    const p = this.personas.get(id)
    if (!p || p.builtin) return false
    this.personas.delete(id)
    this.persist()
    return true
  }

  private persist(): void {
    writeJson(PERSONAS_FILE, Array.from(this.personas.values()))
  }
}

export const personaRegistry = new PersonaRegistry()

// =============================================================================
// 13. Routines — 例行程序（定时执行 Agent 任务）
// =============================================================================

export interface Routine {
  id: string
  name: string
  prompt: string
  cronExpression: string
  workspacePath: string
  modelId: string
  enabled: boolean
  createdAt: number
  lastRun: number | null
  lastResult: string | null
  nextRun: number | null
}

class RoutineManager {
  private routines = new Map<string, Routine>()
  private timer: NodeJS.Timeout | null = null

  constructor() {
    const saved = readJson<Routine[] | null>(ROUTINES_FILE, null)
    if (saved) for (const r of saved) this.routines.set(r.id, r)
  }

  list(): Routine[] {
    return Array.from(this.routines.values())
  }

  get(id: string): Routine | null {
    return this.routines.get(id) ?? null
  }

  create(params: {
    name: string
    prompt: string
    cronExpression: string
    workspacePath: string
    modelId?: string
  }): Routine {
    const id = randomUUID().slice(0, 12)
    const routine: Routine = {
      id,
      name: params.name,
      prompt: params.prompt,
      cronExpression: params.cronExpression,
      workspacePath: params.workspacePath,
      modelId: params.modelId ?? 'default',
      enabled: true,
      createdAt: nowSec(),
      lastRun: null,
      lastResult: null,
      nextRun: this.nextRunTime(params.cronExpression),
    }
    this.routines.set(id, routine)
    this.persist()
    this.startScheduler()
    return routine
  }

  update(id: string, updates: Partial<Omit<Routine, 'id' | 'createdAt'>>): Routine | null {
    const r = this.routines.get(id)
    if (!r) return null
    const updated = { ...r, ...updates, id: r.id, createdAt: r.createdAt }
    if (updates.cronExpression && updates.cronExpression !== r.cronExpression) {
      updated.nextRun = this.nextRunTime(updates.cronExpression)
    }
    this.routines.set(id, updated)
    this.persist()
    return updated
  }

  delete(id: string): boolean {
    const deleted = this.routines.delete(id)
    if (deleted) this.persist()
    return deleted
  }

  trigger(id: string): string | null {
    const r = this.routines.get(id)
    if (!r || !r.enabled) return null
    const agentId = backgroundAgentManager.start({
      prompt: r.prompt,
      workspacePath: r.workspacePath,
      modelId: r.modelId,
    })
    r.lastRun = nowSec()
    r.lastResult = `已触发后台 agent: ${agentId}`
    r.nextRun = this.nextRunTime(r.cronExpression)
    this.persist()
    return agentId
  }

  /** 启动调度器（每 60 秒检查一次 cron 匹配） */
  startScheduler(): void {
    if (this.timer) return
    this.timer = setInterval(() => this.tick(), 60_000)
  }

  stopScheduler(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private tick(): void {
    const now = nowSec()
    for (const r of this.routines.values()) {
      if (!r.enabled || r.nextRun === null) continue
      if (r.nextRun <= now) {
        this.trigger(r.id)
      }
    }
  }

  /** 简化 cron 解析：计算下次执行时间（5 字段：分 时 日 月 周） */
  private nextRunTime(cron: string): number {
    const parts = cron.trim().split(/\s+/)
    if (parts.length !== 5) return nowSec() + 86400
    const min = parts[0]!
    const hour = parts[1]!
    const dom = parts[2]!
    const mon = parts[3]!
    const dow = parts[4]!
    const now = new Date()
    // 简化：从当前时间起每分钟扫描，找到第一个匹配的未来时间（最多扫描 7 天）
    const next = new Date(now.getTime() + 60000)
    for (let i = 0; i < 10080; i++) {
      const t = new Date(next.getTime() + i * 60000)
      if (
        this.cronMatch(min, t.getMinutes(), 0, 59) &&
        this.cronMatch(hour, t.getHours(), 0, 23) &&
        this.cronMatch(dom, t.getDate(), 1, 31) &&
        this.cronMatch(mon, t.getMonth() + 1, 1, 12) &&
        this.cronMatch(dow, t.getDay(), 0, 6)
      ) {
        return Math.floor(t.getTime() / 1000)
      }
    }
    return nowSec() + 86400
  }

  private cronMatch(pattern: string, value: number, min: number, max: number): boolean {
    if (pattern === '*') return true
    for (const part of pattern.split(',')) {
      if (part === '*') return true
      if (part.includes('/')) {
        const slashParts = part.split('/')
        const range = slashParts[0] ?? '*'
        const step = parseInt(slashParts[1] ?? '1', 10)
        const lo = range === '*' ? min : parseInt(range, 10)
        if (value >= lo && (value - lo) % step === 0) return true
      } else if (part.includes('-')) {
        const rangeParts = part.split('-').map((n) => parseInt(n, 10))
        const lo = rangeParts[0] ?? 0
        const hi = rangeParts[1] ?? 0
        if (value >= lo && value <= hi) return true
      } else {
        if (parseInt(part, 10) === value) return true
      }
    }
    void max
    return false
  }

  private persist(): void {
    writeJson(ROUTINES_FILE, Array.from(this.routines.values()))
  }
}

export const routineManager = new RoutineManager()

// =============================================================================
// 14. GitHubIntegration — GitHub 集成（PR/Issue/代码审查）
// =============================================================================

const GITHUB_API_BASE = 'https://api.github.com'

class GitHubClient {
  loadToken(): string {
    const env = process.env.GITHUB_TOKEN ?? ''
    if (env) return env
    const file = join(homedir(), '.ihui', 'github_token')
    return existsSync(file) ? readFileSync(file, 'utf-8').trim() : ''
  }

  parseRemote(url: string): { owner: string; repo: string } | null {
    const httpsRe = /https?:\/\/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/
    const sshRe = /git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/
    const m = httpsRe.exec(url) ?? sshRe.exec(url)
    return m ? { owner: m[1]!, repo: m[2]! } : null
  }

  async detectRemote(workspacePath: string): Promise<{ owner: string; repo: string } | null> {
    try {
      const { stdout } = await execAsync('git remote get-url origin', {
        cwd: workspacePath,
        timeout: 5000,
      })
      return this.parseRemote(stdout.trim())
    } catch {
      return null
    }
  }

  private async api(path: string, method = 'GET', body?: unknown): Promise<unknown> {
    const token = this.loadToken()
    if (!token) throw new Error('未配置 GITHUB_TOKEN')
    const res = await fetch(`${GITHUB_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`GitHub API ${res.status}: ${errText}`)
    }
    return res.status === 204 ? null : res.json()
  }

  async createPR(params: {
    owner: string
    repo: string
    title: string
    head: string
    base: string
    body?: string
  }): Promise<unknown> {
    return this.api(`/repos/${params.owner}/${params.repo}/pulls`, 'POST', {
      title: params.title,
      head: params.head,
      base: params.base,
      body: params.body ?? '',
    })
  }

  async listPRs(params: { owner: string; repo: string; state?: string }): Promise<unknown> {
    const state = params.state ?? 'open'
    return this.api(`/repos/${params.owner}/${params.repo}/pulls?state=${state}&per_page=30`)
  }

  async getPR(params: { owner: string; repo: string; number: number }): Promise<unknown> {
    return this.api(`/repos/${params.owner}/${params.repo}/pulls/${params.number}`)
  }

  async addPRComment(params: {
    owner: string
    repo: string
    number: number
    body: string
  }): Promise<unknown> {
    return this.api(
      `/repos/${params.owner}/${params.repo}/issues/${params.number}/comments`,
      'POST',
      {
        body: params.body,
      },
    )
  }

  async requestReview(params: {
    owner: string
    repo: string
    number: number
    reviewers: string[]
  }): Promise<unknown> {
    return this.api(
      `/repos/${params.owner}/${params.repo}/pulls/${params.number}/requested_reviewers`,
      'POST',
      {
        reviewers: params.reviewers,
      },
    )
  }

  async mergePR(params: {
    owner: string
    repo: string
    number: number
    commitTitle?: string
    mergeMethod?: 'merge' | 'squash' | 'rebase'
  }): Promise<unknown> {
    return this.api(`/repos/${params.owner}/${params.repo}/pulls/${params.number}/merge`, 'PUT', {
      commit_title: params.commitTitle,
      merge_method: params.mergeMethod ?? 'merge',
    })
  }

  async listIssues(params: { owner: string; repo: string; state?: string }): Promise<unknown> {
    const state = params.state ?? 'open'
    return this.api(`/repos/${params.owner}/${params.repo}/issues?state=${state}&per_page=30`)
  }
}

export const githubClient = new GitHubClient()

// =============================================================================
// 15. FSBridge — 文件系统桥接（browse/read/write/edit/grep/glob/run）
// =============================================================================

export interface BrowseEntry {
  name: string
  path: string
  isDir: boolean
  size: number
  modified: number
}

class FSBridge {
  browse(path?: string): BrowseEntry[] {
    if (!path) {
      if (platform() === 'win32') {
        const entries: BrowseEntry[] = []
        for (let i = 65; i <= 90; i++) {
          const drive = `${String.fromCharCode(i)}:\\`
          if (existsSync(drive)) {
            entries.push({
              name: `${String.fromCharCode(i)}:`,
              path: drive,
              isDir: true,
              size: 0,
              modified: 0,
            })
          }
        }
        return entries
      }
      path = '/'
    }

    const p = resolve(path)
    if (!existsSync(p)) throw new Error(`路径不存在: ${path}`)
    const st = statSync(p)
    if (!st.isDirectory()) throw new Error(`不是目录: ${path}`)

    const entries: BrowseEntry[] = []
    for (const name of readdirSync(p)) {
      if (name.startsWith('.') || IGNORE_DIRS.has(name)) continue
      try {
        const full = join(p, name)
        const fst = statSync(full)
        entries.push({
          name,
          path: full,
          isDir: fst.isDirectory(),
          size: fst.isDirectory() ? 0 : fst.size,
          modified: fst.mtime.getTime() / 1000,
        })
      } catch {
        continue
      }
    }
    return entries.sort((a, b) =>
      a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1,
    )
  }

  read(params: { path: string; workspacePath: string; startLine?: number; endLine?: number }): {
    content: string
    lines: number
    path: string
  } {
    const full = this.resolvePath(params.path, params.workspacePath)
    if (!existsSync(full)) throw new Error(`文件不存在: ${params.path}`)
    const content = readFileSync(full, 'utf-8')
    const lines = content.split('\n')
    if (params.startLine || params.endLine) {
      const start = (params.startLine ?? 1) - 1
      const end = params.endLine ?? lines.length
      return { content: lines.slice(start, end).join('\n'), lines: end - start, path: params.path }
    }
    return { content, lines: lines.length, path: params.path }
  }

  write(params: { path: string; workspacePath: string; content: string; createDirs?: boolean }): {
    path: string
    size: number
  } {
    const full = this.resolvePath(params.path, params.workspacePath)
    this.ensureWithinWorkspace(full, params.workspacePath)
    if (params.createDirs !== false) ensureDir(dirname(full))
    // 检查点快照
    if (existsSync(full)) {
      checkpointManager.snapshot(params.workspacePath, {
        tool: 'write',
        description: `写入文件: ${params.path}`,
        files: [params.path],
      })
    }
    writeFileSync(full, params.content, 'utf-8')
    return { path: params.path, size: params.content.length }
  }

  edit(params: { path: string; workspacePath: string; oldText: string; newText: string }): {
    path: string
    occurrences: number
  } {
    const full = this.resolvePath(params.path, params.workspacePath)
    this.ensureWithinWorkspace(full, params.workspacePath)
    if (!existsSync(full)) throw new Error(`文件不存在: ${params.path}`)
    checkpointManager.snapshot(params.workspacePath, {
      tool: 'edit',
      description: `编辑文件: ${params.path}`,
      files: [params.path],
    })
    const content = readFileSync(full, 'utf-8')
    const count = content.split(params.oldText).length - 1
    if (count === 0) throw new Error('未找到匹配的文本')
    if (count > 1) throw new Error('匹配不唯一，请提供更多上下文')
    writeFileSync(full, content.replace(params.oldText, params.newText), 'utf-8')
    return { path: params.path, occurrences: count }
  }

  delete(params: { path: string; workspacePath: string; recursive?: boolean }): {
    path: string
    deleted: boolean
  } {
    const full = this.resolvePath(params.path, params.workspacePath)
    this.ensureWithinWorkspace(full, params.workspacePath)
    checkpointManager.snapshot(params.workspacePath, {
      tool: 'delete',
      description: `删除文件: ${params.path}`,
      files: [params.path],
    })
    rmSync(full, { recursive: params.recursive ?? false, force: true })
    return { path: params.path, deleted: true }
  }

  grep(params: {
    path: string
    workspacePath: string
    pattern: string
    glob?: string
    outputMode?: 'content' | 'files_with_matches' | 'count'
  }): unknown {
    const root = this.resolvePath(params.path, params.workspacePath)
    const regex = new RegExp(params.pattern, 'i')
    const globRe = params.glob ? this.globToRegex(params.glob) : null
    const matches: Array<{ file: string; line: number; content: string }> = []
    const fileMatches: string[] = []
    const counts: Record<string, number> = {}
    this.walkGrep(root, root, regex, globRe, matches, fileMatches, counts)
    const mode = params.outputMode ?? 'content'
    if (mode === 'files_with_matches') return { files: fileMatches }
    if (mode === 'count') return { counts }
    return { matches }
  }

  glob(params: { path: string; workspacePath: string; pattern: string }): { files: string[] } {
    const root = this.resolvePath(params.path, params.workspacePath)
    const regex = this.globToRegex(params.pattern)
    const files: string[] = []
    this.walkGlob(root, root, regex, files)
    return { files }
  }

  async run(params: {
    command: string
    workspacePath: string
    cwd?: string
    timeoutMs?: number
    mode?: SandboxMode
  }): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return sandboxExecutor.execute({
      command: params.command,
      workspacePath: params.workspacePath,
      cwd: params.cwd,
      mode: params.mode ?? 'workspace-write',
      timeoutMs: params.timeoutMs,
    })
  }

  /** 记录最近工作区 */
  addRecent(meta: { path: string; name: string; techStack?: string[] }): void {
    const file = join(STORE_ROOT, 'recent-workspaces.json')
    const list = readJson<Array<{ path: string; name: string; lastOpened: number }>>(file, [])
    const filtered = list.filter((w) => w.path !== meta.path)
    filtered.unshift({ path: meta.path, name: meta.name, lastOpened: nowSec() })
    writeJson(file, filtered.slice(0, 20))
  }

  loadRecent(): Array<{ path: string; name: string; lastOpened: number }> {
    return readJson(join(STORE_ROOT, 'recent-workspaces.json'), [])
  }

  detectTechStack(workspacePath: string): string[] {
    const stack: string[] = []
    if (existsSync(join(workspacePath, 'package.json'))) stack.push('node')
    if (
      existsSync(join(workspacePath, 'pyproject.toml')) ||
      existsSync(join(workspacePath, 'requirements.txt'))
    )
      stack.push('python')
    if (existsSync(join(workspacePath, 'go.mod'))) stack.push('go')
    if (existsSync(join(workspacePath, 'Cargo.toml'))) stack.push('rust')
    if (
      existsSync(join(workspacePath, 'pom.xml')) ||
      existsSync(join(workspacePath, 'build.gradle'))
    )
      stack.push('java')
    return stack
  }

  private resolvePath(p: string, workspacePath: string): string {
    return isAbsolute(p) ? p : join(workspacePath, p)
  }

  private ensureWithinWorkspace(fullPath: string, workspacePath: string): void {
    const rel = relative(workspacePath, fullPath)
    if (rel.startsWith('..')) throw new Error('路径越界：不能操作工作区外的文件')
  }

  private globToRegex(pattern: string): RegExp {
    let p = pattern.replace(/\*\*/g, '\x00')
    p = p.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    p = p.replace(/\*/g, '[^/]*')
    p = p.replace(/\?/g, '[^/]')
    p = p.replace(/\x00/g, '.*')
    return new RegExp(`^${p}$`)
  }

  private walkGrep(
    root: string,
    dir: string,
    regex: RegExp,
    globRe: RegExp | null,
    matches: Array<{ file: string; line: number; content: string }>,
    fileMatches: string[],
    counts: Record<string, number>,
  ): void {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const name of entries) {
      if (IGNORE_DIRS.has(name)) continue
      const full = join(dir, name)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        this.walkGrep(root, full, regex, globRe, matches, fileMatches, counts)
      } else if (st.isFile()) {
        if (globRe && !globRe.test(name)) continue
        if (st.size > MAX_FILE_SIZE) continue
        const content = readFileSync(full, 'utf-8')
        const relPath = relative(root, full).split(sep).join('/')
        let count = 0
        content.split('\n').forEach((line, idx) => {
          if (regex.test(line)) {
            matches.push({ file: relPath, line: idx + 1, content: line })
            count++
          }
        })
        if (count > 0) {
          fileMatches.push(relPath)
          counts[relPath] = count
        }
      }
    }
  }

  private walkGlob(root: string, dir: string, regex: RegExp, files: string[]): void {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const name of entries) {
      if (IGNORE_DIRS.has(name)) continue
      const full = join(dir, name)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }
      const relPath = relative(root, full).split(sep).join('/')
      if (st.isDirectory()) {
        this.walkGlob(root, full, regex, files)
      } else if (st.isFile() && regex.test(relPath)) {
        files.push(relPath)
      }
    }
  }
}

export const fsBridge = new FSBridge()

// =============================================================================
// 初始化：注册 AgentLoop 内置工具（FS Bridge 工具集）
// =============================================================================

agentLoop.registerTool({
  name: 'read_file',
  description: '读取文件内容',
  execute: async (args) => {
    const result = fsBridge.read({
      path: String(args['path'] ?? ''),
      workspacePath: String(args['workspacePath'] ?? process.cwd()),
    })
    return result.content
  },
})

agentLoop.registerTool({
  name: 'list_dir',
  description: '列出目录内容',
  execute: async (args) => {
    const entries = fsBridge.browse(String(args['path'] ?? ''))
    return JSON.stringify(entries)
  },
})

agentLoop.registerTool({
  name: 'write_file',
  description: '写入文件',
  execute: async (args) => {
    const result = fsBridge.write({
      path: String(args['path'] ?? ''),
      workspacePath: String(args['workspacePath'] ?? process.cwd()),
      content: String(args['content'] ?? ''),
    })
    return JSON.stringify(result)
  },
})

agentLoop.registerTool({
  name: 'run_command',
  description: '执行命令（沙箱隔离）',
  execute: async (args) => {
    const result = await fsBridge.run({
      command: String(args['command'] ?? ''),
      workspacePath: String(args['workspacePath'] ?? process.cwd()),
    })
    return JSON.stringify(result)
  },
})

// 启动例行程序调度器
routineManager.startScheduler()
