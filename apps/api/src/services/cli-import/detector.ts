/**
 * 本地 CLI 配置文件探测器。
 *
 * 用于 CLI/Desktop 端:扫描用户主目录下已知路径,
 * 检测已安装的 CLI 工具配置文件,返回 DetectedSource[]。
 *
 * 路径表对齐 cc-switch / codex++ / Codex / Claude / Gemini / Hermes 官方约定。
 * Web 端不能调用此模块(无法访问用户文件系统)。
 */
import { existsSync, statSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type { CliConfigSource, DetectedSource } from '@ihui/types'

interface ScanPathEntry {
  source: CliConfigSource
  /** 相对 home 的路径片段;null 表示走 env 变量 */
  segments: string[] | null
  /** 走 env 变量名(LOCALAPPDATA 优先,fallback HOME) */
  envVar?: 'LOCALAPPDATA' | 'APPDATA' | 'HOME'
  /** 路径必须以 env 变量为前缀时的拼接函数 */
  altResolver?: (home: string) => string
}

const SCAN_PATHS: ScanPathEntry[] = [
  // cc-switch: SQLite 主存储
  {
    source: 'cc-switch',
    segments: ['.cc-switch', 'cc-switch.db'],
    envVar: 'HOME',
  },
  // cc-switch 旧版 config.json(无 SQLite 时兜底)
  {
    source: 'cc-switch',
    segments: ['.cc-switch', 'config.json'],
    envVar: 'HOME',
  },
  // codex++: BackendSettings
  {
    source: 'codex++',
    segments: ['.codex-session-delete', 'settings.json'],
    envVar: 'HOME',
  },
  // Codex CLI 原生配置
  {
    source: 'codex-cli',
    segments: ['.codex', 'config.toml'],
    envVar: 'HOME',
  },
  // Claude Code CLI
  {
    source: 'claude-cli',
    segments: ['.claude', 'settings.json'],
    envVar: 'HOME',
  },
  // Gemini CLI
  {
    source: 'gemini-cli',
    segments: ['.gemini', 'settings.json'],
    envVar: 'HOME',
  },
  // Hermes:Windows 在 %LOCALAPPDATA%\hermes\,其他在 ~/.hermes/
  {
    source: 'hermes',
    segments: null,
    envVar: 'LOCALAPPDATA',
    altResolver: (home) => path.join(home, 'hermes', 'config.yaml'),
  },
  {
    source: 'hermes',
    segments: ['.hermes', 'config.yaml'],
    envVar: 'HOME',
  },
]

function resolveHome(): string {
  return os.homedir()
}

function resolveLocalAppData(): string {
  return process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local')
}

function resolveAppData(): string {
  return process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming')
}

function resolvePath(entry: ScanPathEntry): string {
  if (entry.altResolver) {
    if (entry.envVar === 'LOCALAPPDATA') return entry.altResolver(resolveLocalAppData())
    if (entry.envVar === 'APPDATA') return entry.altResolver(resolveAppData())
    return entry.altResolver(resolveHome())
  }
  const base =
    entry.envVar === 'LOCALAPPDATA'
      ? resolveLocalAppData()
      : entry.envVar === 'APPDATA'
        ? resolveAppData()
        : resolveHome()
  return path.join(base, ...(entry.segments ?? []))
}

/**
 * 探测本地已知 CLI 配置文件。
 *
 * - 已去重(同 source 多路径只返回存在的)
 * - 每条 DetectedSource 含 sizeBytes,version 占位(精确版本由 parser 解析)
 * - 不抛错;任何 stat 失败标记 exists=false
 */
export function detectSources(): DetectedSource[] {
  const results: DetectedSource[] = []
  const seen = new Set<string>()

  for (const entry of SCAN_PATHS) {
    const p = resolvePath(entry)
    if (seen.has(p)) continue
    seen.add(p)
    let exists = false
    let sizeBytes: number | undefined
    try {
      const stat = statSync(p)
      if (stat.isFile()) {
        exists = true
        sizeBytes = stat.size
      }
    } catch {
      exists = false
    }
    results.push({
      source: entry.source,
      path: p,
      exists,
      sizeBytes,
    })
  }
  return results
}

/**
 * 针对单一 source 类型,返回预期可能存在的路径列表(用于 UI 提示)。
 */
export function getExpectedPaths(source: CliConfigSource): string[] {
  return SCAN_PATHS.filter((e) => e.source === source).map((e) => resolvePath(e))
}

/**
 * 检查指定文件路径是否存在并读取大小(给 Web 端上传后用于元信息)。
 */
export function checkFileMeta(filePath: string): { exists: boolean; sizeBytes?: number } {
  try {
    const stat = statSync(filePath)
    if (stat.isFile()) return { exists: true, sizeBytes: stat.size }
  } catch {
    /* ignore */
  }
  return { exists: false }
}

/**
 * 同步快捷方法:某个来源是否在本地存在配置文件。
 */
export function hasSourceInstalled(source: CliConfigSource): boolean {
  return detectSources().some((d) => d.source === source && d.exists)
}

/**
 * 文件存在工具(用于 parser 内部快速校验路径)。
 */
export function fileExists(p: string): boolean {
  return existsSync(p) && statSync(p).isFile()
}
