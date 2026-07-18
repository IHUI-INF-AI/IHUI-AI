/**
 * Hook Trust — Hook 派发前的信任门控(security P0)。
 *
 * 灵感来源:参考 xai-grok-hooks/src/trust.rs::is_hook_disabled + folder-trust
 * 简化策略(做减法):
 *   - 2 个核心 gate:
 *     1. **disabled-hooks file**(每行一个被禁 hook 名,# 注释)
 *        → ~/.ihui/disabled-hooks(用户手动禁用,类似 git-blame-ignore-revs)
 *     2. **folder-trust**(cwd 是否在 ~/.ihui/trusted-folders 列表里)
 *        → git clone 恶意仓库不会自动执行 hooks
 *   - 默认安全策略:不信任任何 <cwd>/.ihui/hooks.json 派生的 hook
 *   - 0 新依赖
 *
 * 安全模型:
 *   - hooks.json 本身可被任何人改写(folder 内),但 hook 派发前必须过 trust gate
 *   - 用户首次执行新 folder 的 hooks 时,IHUI 应打印 "trust this folder?" 提示
 *   - 一旦信任,写入 ~/.ihui/trusted-folders(append 一行绝对路径)
 *   - 取消信任:从该文件删除对应行
 *
 * API:
 *   - isHookDisabled(name):是否被手动禁用(单条规则)
 *   - isFolderTrusted(absPath):folder 是否在白名单
 *   - trustFolder / untrustFolder:用户操作
 *   - gateHook(spec, absCwd):组合判断 — 派发前一次性调用
 */

import { readFileSync, appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve, isAbsolute } from 'node:path'
import { homedir } from 'node:os'

/** ~/.ihui/disabled-hooks — 每行一个被禁 hook 名,# 开头为注释 */
const DISABLED_HOOKS_PATH = join(homedir(), '.ihui', 'disabled-hooks')

/** ~/.ihui/trusted-folders — 每行一个被信任的绝对路径 */
const TRUSTED_FOLDERS_PATH = join(homedir(), '.ihui', 'trusted-folders')

/** 路径规范化:去尾部斜杠 + lowercase(Windows 大小写不敏感) */
function normalizePath(p: string): string {
  let n = resolve(p)
  if (n.length > 1 && (n.endsWith('/') || n.endsWith('\\'))) {
    n = n.slice(0, -1)
  }
  return process.platform === 'win32' ? n.toLowerCase() : n
}

/**
 * 是否手动禁用了某 hook(读 ~/.ihui/disabled-hooks)。
 * 文件不存在 / 读取失败 → 不禁用(默认启用)。
 */
export function isHookDisabled(hookName: string): boolean {
  if (!existsSync(DISABLED_HOOKS_PATH)) return false
  try {
    const content = readFileSync(DISABLED_HOOKS_PATH, 'utf-8')
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      if (line === hookName) return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * 列出所有被禁 hook 名(用于 /hooks list 等 UI)。
 */
export function listDisabledHooks(): string[] {
  if (!existsSync(DISABLED_HOOKS_PATH)) return []
  try {
    const content = readFileSync(DISABLED_HOOKS_PATH, 'utf-8')
    const out: string[] = []
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      out.push(line)
    }
    return out
  } catch {
    return []
  }
}

/**
 * 禁用一个 hook(append 一行到 disabled-hooks,已存在则跳过)。
 * 返回 true 表示成功写入, false 表示已存在或写入失败。
 */
export function disableHook(hookName: string): boolean {
  if (isHookDisabled(hookName)) return false
  try {
    // 兜底:确保 ~/.ihui 存在
    const dir = join(homedir(), '.ihui')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    const line = hookName.includes('\n') ? JSON.stringify(hookName) : hookName
    appendFileSync(DISABLED_HOOKS_PATH, `${line}\n`, 'utf-8')
    return true
  } catch {
    return false
  }
}

/**
 * 取消禁用(整文件重写,删除对应行)。
 * 返回 true 表示成功移除, false 表示原本未禁用或写入失败。
 */
export function enableHook(hookName: string): boolean {
  if (!isHookDisabled(hookName)) return false
  try {
    const content = readFileSync(DISABLED_HOOKS_PATH, 'utf-8')
    const next = content
      .split('\n')
      .filter((line) => line.trim() !== hookName)
      .join('\n')
    writeFileSync(DISABLED_HOOKS_PATH, next, 'utf-8')
    return true
  } catch {
    return false
  }
}

/**
 * folder 是否在 ~/.ihui/trusted-folders 列表中(绝对路径比较)。
 */
export function isFolderTrusted(folderPath: string): boolean {
  if (!isAbsolute(folderPath)) folderPath = resolve(folderPath)
  const target = normalizePath(folderPath)
  if (!existsSync(TRUSTED_FOLDERS_PATH)) return false
  try {
    const content = readFileSync(TRUSTED_FOLDERS_PATH, 'utf-8')
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      if (normalizePath(line) === target) return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * 信任一个 folder(append 一行到 trusted-folders,已存在跳过)。
 */
export function trustFolder(folderPath: string): boolean {
  if (isFolderTrusted(folderPath)) return false
  if (!isAbsolute(folderPath)) folderPath = resolve(folderPath)
  try {
    const dir = join(homedir(), '.ihui')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    appendFileSync(TRUSTED_FOLDERS_PATH, `${folderPath}\n`, 'utf-8')
    return true
  } catch {
    return false
  }
}

/**
 * 取消信任(整文件重写)。
 */
export function untrustFolder(folderPath: string): boolean {
  if (!isFolderTrusted(folderPath)) return false
  if (!isAbsolute(folderPath)) folderPath = resolve(folderPath)
  try {
    const content = readFileSync(TRUSTED_FOLDERS_PATH, 'utf-8')
    const target = normalizePath(folderPath)
    const next = content
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim()
        if (!trimmed) return false
        return normalizePath(trimmed) !== target
      })
      .join('\n')
    writeFileSync(TRUSTED_FOLDERS_PATH, next, 'utf-8')
    return true
  } catch {
    return false
  }
}

/**
 * 列出所有被信任的 folder(用于 /hooks list 等 UI)。
 */
export function listTrustedFolders(): string[] {
  if (!existsSync(TRUSTED_FOLDERS_PATH)) return []
  try {
    const content = readFileSync(TRUSTED_FOLDERS_PATH, 'utf-8')
    const out: string[] = []
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      out.push(line)
    }
    return out
  } catch {
    return []
  }
}

// ==================== 派发 gate ====================

export interface HookSpecLite {
  /** hook 唯一名(在 hooks.json 中定义) */
  name: string
  /** 是否启用(spec.enabled) */
  enabled?: boolean
}

export interface HookGateResult {
  /** 是否允许派发 */
  allowed: boolean
  /** 不允许的原因 */
  reason?: 'disabled-in-config' | 'disabled-by-user' | 'folder-not-trusted'
  /** 详细说明(给用户/日志看) */
  detail?: string
}

/**
 * 派发前一次性 gate:组合 disabled + folder-trust。
 *
 * 用法:
 *   const r = gateHook({ name: 'block-rm-rf', enabled: true }, process.cwd())
 *   if (!r.allowed) {
 *     console.warn('hook skipped:', r.reason, r.detail)
 *     return
 *   }
 *   // ... 派发 hook
 *
 * 调用顺序(由轻到重):
 *   1. spec.enabled === false → skip(disabled-in-config)
 *   2. isHookDisabled(name)    → skip(disabled-by-user)
 *   3. !isFolderTrusted(cwd)   → skip(folder-not-trusted)— security P0
 */
export function gateHook(spec: HookSpecLite, absCwd: string): HookGateResult {
  if (spec.enabled === false) {
    return {
      allowed: false,
      reason: 'disabled-in-config',
      detail: `hook "${spec.name}" is disabled in hooks.json`,
    }
  }
  if (isHookDisabled(spec.name)) {
    return {
      allowed: false,
      reason: 'disabled-by-user',
      detail: `hook "${spec.name}" is in ~/.ihui/disabled-hooks`,
    }
  }
  if (!isFolderTrusted(absCwd)) {
    return {
      allowed: false,
      reason: 'folder-not-trusted',
      detail: `folder "${absCwd}" is not in ~/.ihui/trusted-folders; run \`ihui hooks trust ${absCwd}\` to allow hooks here`,
    }
  }
  return { allowed: true }
}
