// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 真实模型 A/B：native-first function calling vs prompt 模式。
 *
 * 与 agent-capability 的录制回放不同，这里调用真模型、真工具循环、真文件系统，
 * 用 benchmarks/tasks 的 verify.mjs 做机械判分。没有凭据时直接退出，绝不把
 * 回放分数冒充真实分数。
 *
 * 运行：
 *   pnpm -C apps/cli exec tsx scripts/live-agent-ab.ts --tasks 01,12,19,33 --model agnes-3.0-flash
 */

import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { runToolLoop } from '../src/commands/agent.js'
import { BUILTIN_TOOLS } from '../src/tools/builtins.js'
import { createFileEditTools } from '../src/tools/file-edit.js'
import { clearTools, registerTools, resetRateLimiter } from '../src/tools/index.js'

type Arm = 'native' | 'prompt'
type Counts = { pass: number; fail: number }

interface TaskRun {
  arm: Arm
  task: string
  passed: boolean
  stopReason: string
  iterations: number
  toolCalls: string[]
  toolOutputs?: Array<{ name: string; success: boolean; output: string; error?: string }>
  toolFailures: number
  promptTokens: number
  completionTokens: number
  wallMs: number
  error?: string
  verify?: string
}

function parseArgs(): { tasks: string[]; model: string; out: string; arms: Arm[]; provider: string } {
  const args = process.argv.slice(2)
  const get = (name: string): string | undefined => {
    const i = args.indexOf(name)
    return i >= 0 ? args[i + 1] : undefined
  }
  const tasks = (get('--tasks') ?? '01-fix-sum-off-by-one,05-fix-dedupe,12-feat-stats,19-write-tests')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const provider = get('--provider') ?? 'agnes'
  const defaultModel = provider === 'nvidia' ? 'nvidia/nemotron-3.5-lightning-30b-a3b' : 'agnes-3.0-flash'
  const model = get('--model') ?? process.env.IHUI_DEFAULT_MODEL ?? defaultModel
  const out = get('--out') ?? '../../benchmarks/agent-capability/results/live-ab.json'
  const rawArms = (get('--arms') ?? 'native,prompt').split(',').map((s) => s.trim())
  const arms = rawArms.filter((a): a is Arm => a === 'native' || a === 'prompt')
  return { tasks, model, out, arms: arms.length > 0 ? arms : ['native', 'prompt'], provider }
}

function readEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line)
    if (match?.[1]) out[match[1]] = match[2] ?? ''
  }
  return out
}

function resolveTaskDir(root: string, name: string): string {
  const exact = path.join(root, name)
  if (fs.existsSync(exact)) return exact
  const byPrefix = fs.readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith(name))
    .map((d) => path.join(root, d.name))
  if (byPrefix.length !== 1) throw new Error(`任务 ${name} 匹配到 ${byPrefix.length} 个目录`)
  return byPrefix[0]!
}

function readTaskPrompt(dir: string): string {
  return fs.readFileSync(path.join(dir, 'task.md'), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim()
}

function verifyTask(taskDir: string, workspace: string): { passed: boolean; detail: string } {
  try {
    const out = execFileSync(process.execPath, [path.join(taskDir, 'verify.mjs')], {
      cwd: workspace,
      encoding: 'utf8',
      timeout: 60_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { passed: out.includes('PASS'), detail: out.trim().slice(0, 200) }
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string }
    return { passed: false, detail: `${e.stdout ?? ''}${e.stderr ?? ''}${e.message ?? ''}`.trim().slice(0, 400) }
  }
}

const LIVE_TOOL_NAMES = ['read_file', 'list_dir', 'glob', 'write_file', 'edit_file'] as const
const TOOL_GUIDE = [
  '你是编码代理。必须真的修改工作区文件，不要在回答里只贴代码。',
  '只允许使用下列文件工具；run_command / terminal_open 不在本次工具面，不要尝试。',
  '先 read_file/list_dir/glob 了解现状，再用 edit_file（优先）或 write_file 落盘。',
  '工具清单：',
  '- read_file: 读取文件，参数 path',
  '- list_dir: 列目录，参数 path',
  '- glob: 按模式找文件，参数 pattern',
  '- edit_file: 精确替换文件片段，参数 path、search、replace；多处命中时加 replace_all:true',
  '- write_file: 创建或覆盖文件，参数 path、content',
  '如果你要调用工具，正文必须只包含一个围栏块，格式严格如下（JSON 里 name/arguments 必填）：',
  '```tool_call',
  '{"name":"edit_file","arguments":{"path":"relative/path","search":"原文片段","replace":"替换后的片段"}}',
  '```',
].join('\n')

function liveTools(ctx: { workspacePath: string }): ReturnType<typeof createFileEditTools> {
  const fileTools = createFileEditTools(ctx as never)
  const picked = [
    ...BUILTIN_TOOLS.filter((t) => LIVE_TOOL_NAMES.includes(t.name as (typeof LIVE_TOOL_NAMES)[number])),
    ...fileTools.filter((t) => LIVE_TOOL_NAMES.includes(t.name as (typeof LIVE_TOOL_NAMES)[number])),
  ]
  // 同名去重（read_file 在 builtins，write/edit 在 file-edit）
  return [...new Map(picked.map((t) => [t.name, t])).values()]
}

function toolGuide(): string {
  return TOOL_GUIDE
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function providerCredentials(env: Record<string, string>, provider: string): { base: string; key: string } {
  if (provider === 'agnes') {
    return { base: env.AGNES_API_BASE ?? '', key: env.AGNES_API_KEY ?? '' }
  }
  if (provider === 'nvidia') {
    const providers = JSON.parse(env.LLM_PROVIDERS ?? '{}') as Record<string, { api_key?: string; api_base?: string }>
    return { base: providers.nvidia?.api_base ?? '', key: providers.nvidia?.api_key ?? '' }
  }
  throw new Error(`未知 provider: ${provider}（只接 agnes|nvidia，避免拿别的来源冒充）`)
}

async function runArm(
  arm: Arm,
  taskDir: string,
  taskName: string,
  prompt: string,
  model: string,
): Promise<TaskRun> {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), `ihui-live-${taskName}-${arm}-`))
  fs.cpSync(path.join(taskDir, 'workspace'), workspace, { recursive: true })
  const toolCalls: string[] = []
  const toolOutputs: Array<{ name: string; success: boolean; output: string; error?: string }> = []
  let toolFailures = 0
  const started = Date.now()
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    { role: 'system', content: toolGuide() },
    { role: 'user', content: prompt },
  ]
  const ctx = {
    workspacePath: workspace,
    // 同一次 run 内稳定，保证 read_file 的已读状态跨 write_file/edit_file 可见。
    readFileStateKey: `live-${taskName}-${arm}-${Date.now()}`,
    allowDangerous: true,
    approverAvailable: false,
    // 评测是无人值守的真实模型 A/B：文件编辑必须自动放行（acceptEdits），
    // 否则 write_file/edit_file 会以“无审批人”一律拒绝。
    permissionMode: 'acceptEdits',
    // 评测只给临时工作区；命令白名单放开，但系统提示已要求不做 shell。
    sandbox: { commandAllowlist: undefined, allowedPaths: [workspace] },
  }
  try {
    resetRateLimiter()
    clearTools()
    registerTools(liveTools(ctx))
    const result = await runToolLoop({
      modelId: model,
      messages,
      ctx: ctx as never,
      maxIterations: 10,
      settingsOverride: {
        provider: 'openai-compatible',
        providerBaseUrl: process.env.IHUI_PROVIDER_BASE_URL,
        defaultModel: model,
        nativeFunctionCalling: arm === 'native',
        compactionV2: { enabled: false },
      },
      providerSupportsTools: arm === 'native',
      parallelToolCalls: arm === 'native',
      onToolCall: (name) => toolCalls.push(name),
      onToolResult: (name, success, output, _display, error) => {
        if (!success) toolFailures += 1
        toolOutputs.push({ name, success, output: output.slice(0, 300), ...(error ? { error: error.slice(0, 300) } : {}) })
      },
    })
    const verified = verifyTask(taskDir, workspace)
    return {
      arm,
      task: taskName,
      passed: verified.passed,
      stopReason: result.stopReason,
      iterations: result.iterations,
      toolCalls,
      toolFailures,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      wallMs: Date.now() - started,
      toolOutputs,
      ...(verified.passed ? {} : { verify: verified.detail }),
    }
  } catch (err) {
    return {
      arm,
      task: taskName,
      passed: false,
      stopReason: 'exception',
      iterations: 0,
      toolCalls,
      toolFailures,
      promptTokens: 0,
      completionTokens: 0,
      wallMs: Date.now() - started,
      toolOutputs,
      error: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
    }
  } finally {
    clearTools()
    fs.rmSync(workspace, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  const { tasks, model, out, arms, provider } = parseArgs()
  const repoRoot = path.resolve(import.meta.dirname, '../../..')
  const env = readEnv(path.join(repoRoot, 'apps/ai-service/.env'))
  const creds = providerCredentials(env, provider)
  if (!creds.key || !creds.base) {
    console.error(`没有 ${provider} 的 key/base，拒绝用回放冒充真实模型 A/B`)
    process.exit(2)
  }
  process.env.IHUI_PROVIDER = 'openai-compatible'
  process.env.IHUI_PROVIDER_BASE_URL = creds.base
  process.env.IHUI_PROVIDER_API_KEY = creds.key
  process.env.IHUI_API_KEY = creds.key
  process.env.IHUI_DEFAULT_MODEL = model
  process.env.IHUI_ENABLE_MCP = 'false'

  const taskRoot = path.join(repoRoot, 'benchmarks/tasks')
  const runs: TaskRun[] = []
  for (const task of tasks) {
    const taskDir = resolveTaskDir(taskRoot, task)
    const taskName = path.basename(taskDir)
    const prompt = readTaskPrompt(taskDir)
    for (const arm of arms) {
      process.stderr.write(`[live-ab] ${taskName} / ${arm}\n`)
      let run: TaskRun | undefined
      for (let attempt = 0; attempt < 3; attempt += 1) {
        run = await runArm(arm, taskDir, taskName, prompt, model)
        const transient = run.stopReason === 'error' || run.stopReason === 'exception'
        if (run.passed || !transient) break
        process.stderr.write(`[live-ab] ${taskName} / ${arm} 上游限流，退避重试 ${attempt + 1}/2\n`)
        await sleep(8_000 * (attempt + 1))
      }
      runs.push(run!)
      await sleep(2_500)
    }
  }

  const byArm = (arm: Arm): TaskRun[] => runs.filter((r) => r.arm === arm)
  const summary = (arm: Arm): Record<string, unknown> => {
    const items = byArm(arm)
    const passed = items.filter((r) => r.passed).length
    const avg = (key: 'iterations' | 'promptTokens' | 'completionTokens' | 'wallMs'): number =>
      items.length ? Math.round(items.reduce((s, r) => s + r[key], 0) / items.length) : 0
    return {
      tasks: items.length,
      passed,
      passRate: items.length ? Number((passed / items.length).toFixed(3)) : 0,
      avgIterations: avg('iterations'),
      avgPromptTokens: avg('promptTokens'),
      avgCompletionTokens: avg('completionTokens'),
      avgWallMs: avg('wallMs'),
    }
  }
  const payload = {
    generatedAt: new Date().toISOString(),
    model,
    protocol: 'openai-compatible chat/completions',
    tasks,
    arms: { native: summary('native'), prompt: summary('prompt') },
    runs,
  }
  const outPath = path.resolve(import.meta.dirname, out)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`)
  console.log(JSON.stringify({ model, arms: payload.arms, out: outPath }, null, 2))
  const native = payload.arms.native as Counts & { passRate: number }
  const prompt = payload.arms.prompt as Counts & { passRate: number }
  if (native.passed === 0 && prompt.passed === 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
