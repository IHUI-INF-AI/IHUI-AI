// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder 可用模型清单(CLI 桥通路,2026-10-27 立)。
 *
 * 取证定案(docs/RELAY_QODER_LISTMODELS_EVIDENCE.md):Qoder 上游 openapi 与 chat
 * 网关均无 models HTTP 端点(openapi CN 24 条候选全 404;qoder.sh catch-all 401;
 * 网关 404)⇒ 唯一客户端同源通路是 Qoder 官方 CLI 的 `--list-models` 表格输出。
 *
 * 清单语义 = **本机 CLI 登录态的当前用户**(不是号池任意账号),结果如实标注
 * scope:'local-cli-login';调用方不得把它当成号池账号的可用模型清单。
 *
 * CLI 实测(2026-10-27 实弹):
 * - `qoderclicn.exe --list-models` 输出表格(第一行 MODEL 表头);
 * - `-o json` 对 --list-models 无效(仍表格);
 * - 自定义模型 id 被 CLI 写死截断(末尾 …)⇒ 完整 id 无一手来源,如实标
 *   idTruncated:true,绝不猜完整 uuid。
 *
 * 纪律(不冒充可用):CLI 缺失/非零退出/超时/解析为空一律 ok:false 如实报错,
 * 绝不返回静态清单冒充上游点查结果。
 */
import { execFileSync as nodeExecFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// =============================================================================
// 解析
// =============================================================================

/** 自定义模型条目(CLI 显示的 id 被截断,完整 id 无一手来源) */
export interface QoderCustomModelEntry {
  /** 括号前的展示名(如 glm-5.3-flash) */
  name: string
  /** 括号内截断的 id 前缀(如 qoder-custom-e2bfa2ec-9e7c-48e5-8c51-68…) */
  idPrefix: string
  /** CLI 写死截断,恒 true —— 诚实标记,消费方不得当完整 id 用 */
  idTruncated: true
}

export interface QoderModelTable {
  /** CLI 是否输出 Auto(自动路由)行;Auto 不进 official */
  auto: boolean
  /** 官方模型名(逐行,去表头/Auto/custom 行) */
  official: string[]
  /** 自定义模型(括号段 qoder-custom-…,id 截断) */
  custom: QoderCustomModelEntry[]
}

const ANSI_RE = /\[[0-9;]*m/g

/** 剥 ANSI 色码(输出可能带色码) */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, '')
}

/**
 * CLI `--list-models` 表格 → 结构化清单。
 * 规则:第一个非空行必须是 MODEL 表头(大小写不敏感,与 CLI 实测一致)——
 * 不是表头即垃圾输出,如实返回 null,绝不把任意文本当模型名冒充清单;
 * Auto 单独成 auto 标志不进 official;行内 `(qoder-custom-…)` 括号段 =
 * 自定义模型(id 截断);其余进 official。
 * 解析不出任何模型(无 auto 且 official/custom 全空)→ null,如实报告。
 */
export function parseQoderModelTable(stdout: string): QoderModelTable | null {
  const lines = stripAnsi(stdout)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '')
  if (lines.length === 0 || !/^model$/i.test(lines[0]!)) return null
  const result: QoderModelTable = { auto: false, official: [], custom: [] }
  for (const line of lines.slice(1)) {
    if (/^auto$/i.test(line)) {
      result.auto = true
      continue
    }
    const m = /^(.*?)\s*\((qoder-custom-[^)]*)\)\s*$/.exec(line)
    if (m) {
      const name = m[1]!.trim()
      if (name !== '') result.custom.push({ name, idPrefix: m[2]!, idTruncated: true })
      continue
    }
    result.official.push(line)
  }
  if (!result.auto && result.official.length === 0 && result.custom.length === 0) return null
  return result
}

// =============================================================================
// CLI 点查
// =============================================================================

/**
 * exec 注入缝(测试假实现,绝不 spawn 真 CLI)。
 * 形状对标 execFileSync(encoding:'utf8' 时返回 string);抛错即失败。
 */
export type QoderCliExecImpl = (
  file: string,
  args: string[],
  options: Record<string, unknown>,
) => string | Buffer

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))

function up(levels: number): string {
  let p = MODULE_DIR
  for (let i = 0; i < levels; i += 1) p = dirname(p)
  return p
}

/** 仓库根(src|dist → services → src|dist → api → apps → root),与 qoder-cli-bridge 同推导 */
const REPO_ROOT = up(5)

/**
 * CLI 路径独立探测(qoder-cli-bridge 的 resolveQoderBridgePaths 未导出,此处不改动
 * 既有文件,按同源候选独立解析):显式指定 > QODER_CLI_PATH env > 桥探测产物目录
 * > 官方安装目录 ~/.qodersec/bin。全不存在时回第一个候选,让 exec 如实报 ENOENT。
 */
export function resolveQoderModelsCliPath(override?: string): string {
  const explicit = override?.trim()
  if (explicit) return explicit
  const envPath = process.env['QODER_CLI_PATH']?.trim()
  if (envPath) return envPath
  const candidates = [
    join(REPO_ROOT, '.ihui-agent', 'tmp', 'qoder-chat-probe', 'run', 'cli', 'qoderclicn.exe'),
    join(homedir(), '.qodersec', 'bin', 'qoderclicn.exe'),
  ]
  for (const c of candidates) if (existsSync(c)) return c
  return candidates[0]!
}

export interface QoderModelsOptions {
  /** exec 注入(测试假实现);缺省 node:child_process.execFileSync */
  spawnImpl?: QoderCliExecImpl
  /** CLI 路径覆写;缺省 resolveQoderModelsCliPath 探测 */
  cliPath?: string
  /** 超时毫秒;默认 30s */
  timeoutMs?: number
}

export interface QoderModelsSuccess {
  ok: true
  /** 清单语义:本机 CLI 登录态的当前用户(不是号池任意账号) */
  scope: 'local-cli-login'
  /** CLI 输出了 Auto(自动路由)行 */
  auto: boolean
  official: string[]
  custom: QoderCustomModelEntry[]
  source: 'cli --list-models'
}

export interface QoderModelsFailure {
  ok: false
  error: string
}

export type QoderModelsResult = QoderModelsSuccess | QoderModelsFailure

const DEFAULT_TIMEOUT_MS = 30_000
const MAX_BUFFER = 16 * 1024 * 1024

/** execFileSync 错误 → 人读分类(不吞真实细节,不冒充) */
function describeExecError(e: unknown): string {
  const err = e as NodeJS.ErrnoException & { status?: number | null; signal?: string | null }
  if (err?.code === 'ENOENT') return 'Qoder CLI 缺失(未找到 qoderclicn.exe)'
  if (err?.code === 'ETIMEDOUT' || err?.signal === 'SIGTERM') return 'Qoder CLI 执行超时'
  if (typeof err?.status === 'number' && err.status !== 0) {
    return `Qoder CLI 非零退出(exit=${err.status})${err.message ? `: ${err.message.slice(0, 300)}` : ''}`
  }
  return `Qoder CLI 执行失败: ${e instanceof Error ? e.message : String(e)}`
}

/**
 * 点查本机 Qoder CLI 的可用模型清单(execFileSync 同款纪律:stdio 显式 pipe、
 * maxBuffer 16MB、超时默认 30s)。失败一律 ok:false 如实报错,不冒充。
 */
export function listQoderModels(opts: QoderModelsOptions = {}): QoderModelsResult {
  const cliPath = resolveQoderModelsCliPath(opts.cliPath)
  const exec =
    opts.spawnImpl ??
    ((file, args, options) =>
      nodeExecFileSync(file, args, options as Parameters<typeof nodeExecFileSync>[2]) as string)
  let stdout: string
  try {
    stdout = String(
      exec(cliPath, ['--list-models'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: MAX_BUFFER,
        timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        windowsHide: true,
        encoding: 'utf8',
      }),
    )
  } catch (e) {
    return { ok: false, error: describeExecError(e) }
  }
  const parsed = parseQoderModelTable(stdout)
  if (!parsed) {
    return {
      ok: false,
      error: `Qoder CLI --list-models 输出解析为空(无 MODEL 表行): ${stdout.slice(0, 200).trim() || '(空输出)'}`,
    }
  }
  return {
    ok: true,
    scope: 'local-cli-login',
    auto: parsed.auto,
    official: parsed.official,
    custom: parsed.custom,
    source: 'cli --list-models',
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
