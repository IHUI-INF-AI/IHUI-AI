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
 * 任一层加载失败不阻塞,降级到默认。
 */

export * from './defaults.js'
export * from './merge.js'
export * from './env.js'
export * from './cli.js'

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import type { Settings } from '../commands/settings.js'
import { DEFAULT_SETTINGS } from './defaults.js'
import { deepMergeAll } from './merge.js'
import { parseEnvOverrides } from './env.js'
import { parseCliOverrides } from './cli.js'

export interface LoadConfigOptions {
  /** 工作目录(默认 process.cwd()),用于定位 project 级配置 */
  cwd?: string
  /** 环境变量(默认 process.env),用于 env 层解析 */
  env?: NodeJS.ProcessEnv
  /** CLI 参数(commander 已解析的 Record),用于 cli 层解析 */
  cliArgs?: Record<string, unknown>
  /** 临时 session 配置(优先级高于 setSessionConfig 注入的模块级状态) */
  sessionOverrides?: Partial<Settings>
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

/** 安全加载 settings.json:文件不存在或解析失败返回 {} */
function loadSettingsFile(p: string): Partial<Settings> {
  try {
    if (!fs.existsSync(p)) return {}
    const raw = fs.readFileSync(p, 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Partial<Settings>
    }
    return {}
  } catch {
    // 损坏文件忽略,降级到默认
    return {}
  }
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
 * 按 6 层优先级合并配置:defaults > global > project > session > env > cli。
 * 任一层加载失败不阻塞,降级到默认。
 *
 * session 层来源优先级:opts.sessionOverrides > setSessionConfig 注入的模块级状态。
 */
export function loadConfig(opts: LoadConfigOptions = {}): Settings {
  const cwd = opts.cwd ?? process.cwd()
  const env = opts.env ?? process.env
  const cliArgs = opts.cliArgs ?? {}

  // Layer 1: defaults(内置默认值,最低优先级)
  const defaults = DEFAULT_SETTINGS
  // Layer 2: global(~/.ihui/settings.json)
  const globalConfig = loadSettingsFile(getGlobalSettingsPath())
  // Layer 3: project(<cwd>/.ihui/settings.json)
  const projectConfig = loadSettingsFile(getProjectSettingsPath(cwd))
  // Layer 4: session(运行时临时配置;opts 优先,其次模块级状态)
  const session = opts.sessionOverrides ?? sessionConfig ?? {}
  // Layer 5: env(IHUI_ 前缀环境变量)
  const envOverrides = parseEnvOverrides(env)
  // Layer 6: cli(命令行参数,最高优先级)
  const cliOverrides = parseCliOverrides(cliArgs)

  return deepMergeAll(
    defaults,
    globalConfig,
    projectConfig,
    session,
    envOverrides,
    cliOverrides,
  ) as Settings
}
