/**
 * P1-6 Codebase Graph — 增量索引核心。
 *
 * 灵感来源:参考行业 Agent 框架的 codebase-graph 设计,做减法为扁平符号表版本。
 * 简化策略:
 *   - 不存 ScopeGraph 完整图,只存扁平 symbol → locations[] 表
 *   - 增量更新:indexFile 先 removeFile 再添加,保证幂等
 *   - 跨进程锁跳过(单进程 CLI 场景)
 *   - rayon 并行跳过(Node 单线程足够)
 *
 * 数据结构:
 *   - definitions:Map<symbol, DefinitionEntry[]>(同符号可有多处定义,不同文件/kind)
 *   - references:Map<symbol, ReferenceEntry[]>(同符号可有多处引用,按文件分 entry)
 *   - fileMeta:Map<filePath, FileMeta>(用于 isFileStale 增量判定)
 *   - fileToDefs/fileToRefs:反向索引,用于 removeFile 快速清理
 */

import { parseFile } from './parser.js'

// ============ 数据结构 ============

export interface SymbolLocation {
  filePath: string
  /** 1-based 行号 */
  line: number
  /** 1-based 列号 */
  column: number
}

export interface DefinitionEntry {
  symbol: string
  kind: 'function' | 'class' | 'interface' | 'type' | 'enum' | 'const' | 'variable' | 'import'
  locations: SymbolLocation[]
  filePath: string
}

export interface ReferenceEntry {
  symbol: string
  locations: SymbolLocation[]
}

export interface FileMeta {
  size: number
  mtimeMs: number
  lastIndexedMs: number
}

export interface CodeGraphSnapshot {
  definitions: Map<string, DefinitionEntry[]>
  references: Map<string, ReferenceEntry[]>
  fileMeta: Map<string, FileMeta>
  version: number
}

const SNAPSHOT_VERSION = 1

// ============ CodeGraphIndex ============

export class CodeGraphIndex {
  private definitions = new Map<string, DefinitionEntry[]>()
  private references = new Map<string, ReferenceEntry[]>()
  private fileMeta = new Map<string, FileMeta>()
  /** 反向索引:filePath → 该文件定义的符号集合 */
  private fileToDefs = new Map<string, Set<string>>()
  /** 反向索引:filePath → 该文件引用的符号集合 */
  private fileToRefs = new Map<string, Set<string>>()

  /**
   * 索引单个文件:解析内容,添加定义/引用,记录元数据。
   * 幂等:先移除该文件的旧数据,再添加新数据。
   */
  indexFile(filePath: string, content: string, meta: { size: number; mtimeMs: number }): void {
    // 先移除旧数据(幂等)
    this.removeFile(filePath)

    const { definitions, references } = parseFile(filePath, content)

    // 添加定义
    const defSymbols = new Set<string>()
    for (const def of definitions) {
      let arr = this.definitions.get(def.symbol)
      if (!arr) {
        arr = []
        this.definitions.set(def.symbol, arr)
      }
      arr.push(def)
      defSymbols.add(def.symbol)
    }
    if (defSymbols.size > 0) {
      this.fileToDefs.set(filePath, defSymbols)
    }

    // 添加引用
    const refSymbols = new Set<string>()
    for (const ref of references) {
      let arr = this.references.get(ref.symbol)
      if (!arr) {
        arr = []
        this.references.set(ref.symbol, arr)
      }
      arr.push(ref)
      refSymbols.add(ref.symbol)
    }
    if (refSymbols.size > 0) {
      this.fileToRefs.set(filePath, refSymbols)
    }

    // 记录文件元数据
    this.fileMeta.set(filePath, {
      size: meta.size,
      mtimeMs: meta.mtimeMs,
      lastIndexedMs: Date.now(),
    })
  }

  /** 移除文件的所有定义/引用/元数据。文件不存在时不抛错。 */
  removeFile(filePath: string): void {
    // 移除定义
    const defSymbols = this.fileToDefs.get(filePath)
    if (defSymbols) {
      for (const symbol of defSymbols) {
        const arr = this.definitions.get(symbol)
        if (arr) {
          const filtered = arr.filter((d) => d.filePath !== filePath)
          if (filtered.length === 0) {
            this.definitions.delete(symbol)
          } else {
            this.definitions.set(symbol, filtered)
          }
        }
      }
      this.fileToDefs.delete(filePath)
    }

    // 移除引用(ReferenceEntry 按 filePath 过滤,整个 entry 的 locations 同源同一文件)
    const refSymbols = this.fileToRefs.get(filePath)
    if (refSymbols) {
      for (const symbol of refSymbols) {
        const arr = this.references.get(symbol)
        if (arr) {
          const filtered = arr.filter(
            (r) => !r.locations.some((loc) => loc.filePath === filePath),
          )
          if (filtered.length === 0) {
            this.references.delete(symbol)
          } else {
            this.references.set(symbol, filtered)
          }
        }
      }
      this.fileToRefs.delete(filePath)
    }

    // 移除文件元数据
    this.fileMeta.delete(filePath)
  }

  /** 判断文件是否需要重新索引(size 或 mtime 变化即为 stale) */
  isFileStale(filePath: string, currentMeta: { size: number; mtimeMs: number }): boolean {
    const meta = this.fileMeta.get(filePath)
    if (!meta) return true
    return meta.size !== currentMeta.size || meta.mtimeMs !== currentMeta.mtimeMs
  }

  /** 查找符号的所有定义 */
  findDefinitions(symbol: string): DefinitionEntry[] {
    return this.definitions.get(symbol) ?? []
  }

  /** 查找符号的所有引用 */
  findReferences(symbol: string): ReferenceEntry[] {
    return this.references.get(symbol) ?? []
  }

  /** 判断符号是否有定义 */
  hasDefinition(symbol: string): boolean {
    return this.definitions.has(symbol)
  }

  /** 列出文件中定义的所有符号名 */
  listFileDefinitions(filePath: string): string[] {
    return Array.from(this.fileToDefs.get(filePath) ?? [])
  }

  /** 列出索引中所有符号名 */
  allSymbols(): string[] {
    return Array.from(this.definitions.keys())
  }

  /** 生成当前索引快照(深拷贝) */
  snapshot(): CodeGraphSnapshot {
    const definitions = new Map<string, DefinitionEntry[]>()
    for (const [symbol, arr] of this.definitions) {
      definitions.set(
        symbol,
        arr.map((d) => ({
          ...d,
          locations: d.locations.map((l) => ({ ...l })),
        })),
      )
    }
    const references = new Map<string, ReferenceEntry[]>()
    for (const [symbol, arr] of this.references) {
      references.set(
        symbol,
        arr.map((r) => ({
          ...r,
          locations: r.locations.map((l) => ({ ...l })),
        })),
      )
    }
    const fileMeta = new Map<string, FileMeta>()
    for (const [filePath, meta] of this.fileMeta) {
      fileMeta.set(filePath, { ...meta })
    }
    return { definitions, references, fileMeta, version: SNAPSHOT_VERSION }
  }

  /** 从快照恢复索引(替换当前所有数据) */
  restore(snapshot: CodeGraphSnapshot): void {
    this.clear()

    // 恢复 definitions
    for (const [symbol, arr] of snapshot.definitions) {
      this.definitions.set(
        symbol,
        arr.map((d) => ({
          ...d,
          locations: d.locations.map((l) => ({ ...l })),
        })),
      )
    }

    // 恢复 references
    for (const [symbol, arr] of snapshot.references) {
      this.references.set(
        symbol,
        arr.map((r) => ({
          ...r,
          locations: r.locations.map((l) => ({ ...l })),
        })),
      )
    }

    // 恢复 fileMeta
    for (const [filePath, meta] of snapshot.fileMeta) {
      this.fileMeta.set(filePath, { ...meta })
    }

    // 重建反向索引 fileToDefs
    for (const [symbol, arr] of this.definitions) {
      for (const def of arr) {
        let set = this.fileToDefs.get(def.filePath)
        if (!set) {
          set = new Set()
          this.fileToDefs.set(def.filePath, set)
        }
        set.add(symbol)
      }
    }

    // 重建反向索引 fileToRefs
    for (const [symbol, arr] of this.references) {
      for (const ref of arr) {
        for (const loc of ref.locations) {
          let set = this.fileToRefs.get(loc.filePath)
          if (!set) {
            set = new Set()
            this.fileToRefs.set(loc.filePath, set)
          }
          set.add(symbol)
        }
      }
    }
  }

  /** 清空所有索引数据 */
  clear(): void {
    this.definitions.clear()
    this.references.clear()
    this.fileMeta.clear()
    this.fileToDefs.clear()
    this.fileToRefs.clear()
  }

  /** 返回索引统计信息 */
  stats(): { files: number; definitions: number; references: number; symbols: number } {
    let defCount = 0
    for (const arr of this.definitions.values()) defCount += arr.length
    let refCount = 0
    for (const arr of this.references.values()) refCount += arr.length
    return {
      files: this.fileMeta.size,
      definitions: defCount,
      references: refCount,
      symbols: this.definitions.size,
    }
  }
}

// ============ Barrel re-exports ============
// 作为 codegraph 模块的统一入口,re-export 兄弟模块的公开 API,
// 供外部消费方(如 tools/codegraph.ts)从单一路径 '../codegraph/index.js' 导入。

export * from './parser.js'
export * from './manager.js'
export * from './persist.js'
