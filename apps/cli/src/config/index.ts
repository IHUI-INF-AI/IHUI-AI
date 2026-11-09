// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * P1-7 6 层 config merge 公共 API。
 *
 * 合并优先级(低 → 高,后者胜):
 *   1. defaults  — 内置默认值(代码中定义的 DEFAULT_SETTINGS)
 *   2. global    — ~/.ihui/settings.json 用户全局配置
 *   3. project   — <cwd>/.ihui/settings.json 项目级配置
 *   4. session   — 运行时临时配置(setSessionConfig 注入,进程内有效)
 *   5. env       — 环境变量(IHUI_ 前缀,大小写不敏感)
 *   6. cli       — 命令行参数(--key=value,. 分隔嵌套)
 *
 * 文件不存在时该层降级为默认;存在但读不到(EACCES/EIO 等)必须抛错,不得当成空配置。
 * 第 2 层 global 走运行时类型校验(config/validate.ts,BUG-0042):非法类型/越界数值
 * 回落默认层并逐键点名,不再把 `maxIterations: "abc"` 这类值静默合入。
 * 第 3 层 project 额外受可写键策略约束(G-408①,见 config/layer-policy.ts):
 * 安全敏感键与未知键/非法枚举值在该层被拒绝并点名,不静默。
 */

export * from './defaults.js'
export * from './merge.js'
export * from './env.js'
export * from './cli.js'
export * from './layer-policy.js'

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import type { Settings } from '../commands/settings.js'
import { DEFAULT_SETTINGS } from './defaults.js'
import { collectLayerContributions, deepMergeAll, type ConfigSourceEntry } from './merge.js'
import { parseEnvOverrides } from './env.js'
import { parseCliOverrides } from './cli.js'
import { filterProjectLayerSettings } from './layer-policy.js'
import { validateSettingsValues } from './validate.js'

export interface LoadConfigOptions {
  /** 工作目录(默认 process.cwd()),用于定位 project 级配置 */
  cwd?: string
  /** 环境变量(默认 process.env),用于 env 层解析 */
  env?: NodeJS.ProcessEnv
  /** CLI 参数(commander 已解析的 Record),用于 cli 层解析 */
  cliArgs?: Record<string, unknown>
  /** 临时 session 配置(优先级高于 setSessionConfig 注入的模块级状态) */
  sessionOverrides?: Partial<Settings>
  /** 磁盘探测注入(默认 fs.statSync);用于在测试里模拟读不到,不改变生产路径 */
  stat?: (p: string) => fs.Stats
}

/** 全局配置路径:~/.ihui/settings.json */
export function getGlobalSettingsPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir()
  return path.join(home, '.ihui', 'settings.json')
}

/** 项目级配置路径:<cwd>/.ihui/settings.json */
export function getProjectSettingsPath(cwd?: string): string {
  return path.join(cwd ?? process.cwd(), '.ihui', 'settings.json')
}

/** JSON 根节点必须是普通对象(schema 的第一层:形态判定,值是 `unknown`)。 */
function isJsonObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** 诊断文案用:把 JSON 根节点的实际形态说清楚,不猜。 */
function describeJsonRoot(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return `数组(长度 ${v.length})`
  return typeof v
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/**
 * 安全加载 settings.json。
 *
 * BUG-0042:此前这里是 `JSON.parse` 后直接 `as Partial<Settings>` —— 一个裸断言,
 * 运行时零校验;注释说"安全加载",实际只保证"是对象"。现在改成显式的**结构 schema**
 * 判定 + 可读诊断:
 *  - 文件不存在 → 静默返回空层(正常态,不是错误);
 *  - 存在但读不到(EACCES/EIO 等)→ 抛错:权限/IO 故障不能被降级成"空配置";
 *  - JSON 语法错 / 根节点不是对象 → `console.warn` 点名**文件路径 + 实际形态 +
 *    底层错误**,该层按空处理(内容坏但不阻塞启动,也不让脏值流进下游);
 *  - 根对象原样返回 `Record<string, unknown>`,**不再冒充 `Partial<Settings>`** ——
 *    键级类型校验是另一层的事(global 见 `config/validate.ts`,project 见
 *    `config/layer-policy.ts`),那两张表是唯一判据,不在这里抄第三份。
 *
 * 返回类型改为 `Record<string, unknown>` 是本次修复的要害:调用方必须先过校验才能
 * 拿到 `Partial<Settings>`,类型系统从此不再替脏文件背书。
 */
function loadSettingsFile(
  p: string,
  stat: (target: string) => fs.Stats = fs.statSync,
): Record<string, unknown> {
  // 读不到 ≠ 不存在:ENOENT 才是"没有这份配置";EACCES/EIO 等必须抛,
  // 否则权限错误会被静默当成空层,用户设过的 apiUrl 等键无声回落默认值。
  try {
    stat(p)
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') return {}
    throw new Error(`配置读不到 "${p}":${errorText(e)}`)
  }

  let raw: string
  try {
    raw = fs.readFileSync(p, 'utf-8')
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') return {}
    throw new Error(`配置读不到 "${p}":${errorText(e)}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    console.warn(`[config] ${p} 不是合法 JSON,该层按空处理:${errorText(e)}`)
    return {}
  }

  if (!isJsonObject(parsed)) {
    console.warn(
      `[config] ${p} 根节点必须是 JSON 对象,实际是 ${describeJsonRoot(parsed)},该层按空处理`,
    )
    return {}
  }

  return parsed
}

/** 进程内临时 session 配置(不持久化,clearSessionConfig 后清除) */
let sessionConfig: Partial<Settings> | undefined

/** 注入进程内临时配置(不持久化,进程内有效) */
export function setSessionConfig(patch: Partial<Settings>): void {
  sessionConfig = patch
}

/** 清除进程内临时配置 */
export function clearSessionConfig(): void {
  sessionConfig = undefined
}

/**
 * 配置层名,数组顺序 = 优先级升序(与 loadConfig 的合并顺序一致)。
 * 出处探针与合并共用这一份定义,不留第二套层序。
 */
export const CONFIG_LAYERS = ['defaults', 'global', 'project', 'session', 'env', 'cli'] as const
export type ConfigLayerName = (typeof CONFIG_LAYERS)[number]

/** 单层解析结果:层名 + 该层值 + 该层对应的磁盘文件(仅磁盘层有) */
interface ResolvedLayer {
  layer: ConfigLayerName
  value: Partial<Settings>
  originFile?: string
}

/**
 * 构建 6 层输入(优先级升序)。loadConfig 与 sourcesFor 共用这一份,保证
 * "出处查询"与实际合并读的是同一批源、同一优先级 —— 不存在第二套判定。
 * 文件不存在时该层降级为默认;存在但读不到(EACCES/EIO 等)必须抛错。
 */
function resolveLayers(opts: LoadConfigOptions): ResolvedLayer[] {
  const cwd = opts.cwd ?? process.cwd()
  const env = opts.env ?? process.env
  const cliArgs = opts.cliArgs ?? {}

  const globalPath = getGlobalSettingsPath()
  const projectPath = getProjectSettingsPath(cwd)

  // Layer 1: defaults(内置默认值,最低优先级)
  const defaults = DEFAULT_SETTINGS
  // Layer 2: global(~/.ihui/settings.json)—— BUG-0042:用户全局层此前只断言 isRecord,
  // 非法类型/越界数值会原样进主循环。这里过运行时类型校验:非法键回落默认层并点名。
  const globalRaw = loadSettingsFile(globalPath, opts.stat)
  const globalCheck = validateSettingsValues(globalRaw)
  if (globalCheck.warnings.length > 0) {
    console.warn(
      `[config] ${globalPath} 有 ${globalCheck.warnings.length} 个键未通过类型校验(未合入配置):\n` +
        globalCheck.warnings.map((w) => `  - ${w}`).join('\n'),
    )
  }
  const globalConfig = globalCheck.value
  // Layer 3: project(<cwd>/.ihui/settings.json)—— G-408①:这一层是**仓库内容**,必须过
  // 可写键封闭表(config/layer-policy.ts):安全敏感键/未知键/非法枚举一律拒绝并点名。
  // 此前它零键过滤,防线只剩 .gitignore 的 `.ihui/*` 一行 —— ignore 不是判据。
  const projectRaw = loadSettingsFile(projectPath, opts.stat)
  const projectFilter = filterProjectLayerSettings(projectRaw)
  if (projectFilter.rejected.length > 0) {
    // 拒绝必须可见:静默丢弃安全键等于让仓库作者可以"悄悄试",下一次换个键再来。
    console.warn(
      `[config] ${projectPath} 有 ${projectFilter.rejected.length} 个键被项目层策略拒绝(未合入配置):\n` +
        projectFilter.rejected.map((r) => `  - ${r.key}(${r.category}): ${r.reason}`).join('\n'),
    )
  }
  const projectConfig = projectFilter.accepted
  // Layer 4: session(运行时临时配置;opts 优先,其次模块级状态)
  const session = opts.sessionOverrides ?? sessionConfig ?? {}
  // Layer 5: env(IHUI_ 前缀环境变量)
  const envOverrides = parseEnvOverrides(env)
  // Layer 6: cli(命令行参数,最高优先级)
  const cliOverrides = parseCliOverrides(cliArgs)

  return [
    { layer: 'defaults', value: defaults },
    { layer: 'global', value: globalConfig, originFile: globalPath },
    { layer: 'project', value: projectConfig, originFile: projectPath },
    { layer: 'session', value: session },
    { layer: 'env', value: envOverrides },
    { layer: 'cli', value: cliOverrides },
  ]
}

/**
 * 按 6 层优先级合并配置:defaults > global > project > session > env > cli。
 * 文件不存在时该层降级为默认;存在但读不到(EACCES/EIO 等)必须抛错,不得当成空配置。
 *
 * session 层来源优先级:opts.sessionOverrides > setSessionConfig 注入的模块级状态。
 */
export function loadConfig(opts: LoadConfigOptions = {}): Settings {
  const layers = resolveLayers(opts)
  return deepMergeAll(...layers.map((l) => l.value)) as Settings
}

/**
 * 只读探针(A19):回答"这个键的值是哪一层给的、从哪个文件读的、在它之前哪些层被跳过"。
 * - 与 loadConfig 共用同一份层构建(resolveLayers),不改任何现有读取路径与优先级;
 * - key 为点分路径(如 'apiUrl' / 'sampler.temperature');
 * - 返回数组按优先级**降序**(最高层在前),长度 = 实际贡献该键的层数;
 * - 来自磁盘的层(global/project)条目必带非空 originFile,非磁盘层不带。
 */
export function sourcesFor(key: string, opts: LoadConfigOptions = {}): ConfigSourceEntry[] {
  return collectLayerContributions<Settings>(resolveLayers(opts)).get(key) ?? []
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
