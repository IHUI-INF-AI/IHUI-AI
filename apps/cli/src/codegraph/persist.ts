/**
 * P1-6 Codebase Graph — JSON 持久化。
 *
 * 简化策略:
 *   - JSON 格式序列化(无需二进制/压缩,单进程 CLI 场景文件不大)
 *   - Map 序列化为 [key, value][] 数组(JSON.stringify 原生支持)
 *   - magic + version 头校验,防止误读非缓存文件
 *   - 跨进程锁跳过(单进程)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import {
  CodeGraphIndex,
  type CodeGraphSnapshot,
  type DefinitionEntry,
  type ReferenceEntry,
  type FileMeta,
} from './index.js'

export const CODEGRAPH_SCHEMA_VERSION = 1
export const CODEGRAPH_MAGIC = 'IHUI-CG'

/** 序列化后的快照(Map 转为数组) */
export interface SerializedSnapshot {
  definitions: Array<[string, DefinitionEntry[]]>
  references: Array<[string, ReferenceEntry[]]>
  fileMeta: Array<[string, FileMeta]>
  version: number
}

export interface PersistedGraph {
  magic: string
  version: number
  savedAt: string
  snapshot: SerializedSnapshot
}

/**
 * 保存索引到缓存文件。
 * 自动创建父目录,覆盖已有文件。
 */
export async function saveCache(index: CodeGraphIndex, cachePath: string): Promise<void> {
  const snapshot = index.snapshot()
  const serialized: SerializedSnapshot = {
    definitions: Array.from(snapshot.definitions.entries()),
    references: Array.from(snapshot.references.entries()),
    fileMeta: Array.from(snapshot.fileMeta.entries()),
    version: snapshot.version,
  }
  const data: PersistedGraph = {
    magic: CODEGRAPH_MAGIC,
    version: CODEGRAPH_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    snapshot: serialized,
  }

  const dir = path.dirname(cachePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * 从缓存文件加载索引。
 * 文件不存在 / 解析失败 / magic 不符 / version 不符 → 返回 undefined。
 */
export async function loadCache(cachePath: string): Promise<CodeGraphIndex | undefined> {
  if (!fs.existsSync(cachePath)) return undefined

  let data: PersistedGraph
  try {
    const content = fs.readFileSync(cachePath, 'utf-8')
    data = JSON.parse(content) as PersistedGraph
  } catch {
    return undefined
  }

  // 校验 magic
  if (data.magic !== CODEGRAPH_MAGIC) return undefined
  // 校验 version
  if (typeof data.version !== 'number') return undefined
  if (data.version !== CODEGRAPH_SCHEMA_VERSION) return undefined
  // 校验 snapshot 结构
  if (!data.snapshot || !Array.isArray(data.snapshot.definitions)) return undefined

  const snapshot: CodeGraphSnapshot = {
    definitions: new Map(data.snapshot.definitions),
    references: new Map(data.snapshot.references),
    fileMeta: new Map(data.snapshot.fileMeta),
    version: data.snapshot.version,
  }

  const index = new CodeGraphIndex()
  index.restore(snapshot)
  return index
}

/**
 * 获取默认缓存路径:~/.ihui/cache/codegraph/<workspaceHash>.json
 * 基于 workspaceRoot 生成确定性哈希,同一工作区多次调用得到同一路径。
 */
export function getDefaultCachePath(workspaceRoot: string): string {
  const hash = simpleHash(workspaceRoot)
  return path.join(os.homedir(), '.ihui', 'cache', 'codegraph', `${hash}.json`)
}

/** 简单字符串哈希(DJB2 变体),返回 16 进制字符串 */
function simpleHash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(16)
}
