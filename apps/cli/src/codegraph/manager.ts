/**
 * P1-6 Codebase Graph — IndexManager 文件事件处理。
 *
 * 灵感来源:cli xai-codebase-graph 的 IndexManager,做减法为单进程版本。
 * 简化策略:
 *   - 处理 created/modified/removed/renamed 四类文件事件
 *   - handleEvents 合并事件:created+removed=cancel(取最后操作,remove 对未索引文件是 no-op)
 *   - renamed 拆成 removed(oldPath) + created(newPath)
 *   - indexDirectory 递归扫描目录,跳过 node_modules/dist/.git 等
 *   - 文件路径用相对 workspaceRoot 的 POSIX 风格存储
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { CodeGraphIndex } from './index.js'

export type FileEvent =
  | { type: 'created'; filePath: string }
  | { type: 'modified'; filePath: string }
  | { type: 'removed'; filePath: string }
  | { type: 'renamed'; oldPath: string; newPath: string }

const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', '.next', '.output', '.wxt',
  'target', 'build', '.turbo', '.cache', 'coverage',
])

export class IndexManager {
  private readonly workspaceRoot: string
  private readonly index: CodeGraphIndex

  constructor(workspaceRoot: string, index?: CodeGraphIndex) {
    this.workspaceRoot = path.resolve(workspaceRoot)
    this.index = index ?? new CodeGraphIndex()
  }

  /** 处理单个文件事件 */
  handleEvent(event: FileEvent): void {
    switch (event.type) {
      case 'created':
      case 'modified': {
        this.reindexFile(event.filePath)
        break
      }
      case 'removed': {
        this.index.removeFile(this.toRel(event.filePath))
        break
      }
      case 'renamed': {
        this.index.removeFile(this.toRel(event.oldPath))
        this.reindexFile(event.newPath)
        break
      }
    }
  }

  /**
   * 批量处理文件事件,合并同路径事件。
   * 合并策略:对每个路径取最后一个操作(index 或 remove)。
   * created+removed → 最终 remove → 对未索引文件是 no-op(等价 cancel)。
   * removed+created → 最终 index → 等价 modified。
   */
  handleEvents(events: FileEvent[]): void {
    // 展开 renamed 为 remove(old) + index(new)
    const expanded: Array<{ relPath: string; op: 'index' | 'remove' }> = []
    for (const event of events) {
      switch (event.type) {
        case 'created':
        case 'modified': {
          expanded.push({ relPath: this.toRel(event.filePath), op: 'index' })
          break
        }
        case 'removed': {
          expanded.push({ relPath: this.toRel(event.filePath), op: 'remove' })
          break
        }
        case 'renamed': {
          expanded.push({ relPath: this.toRel(event.oldPath), op: 'remove' })
          expanded.push({ relPath: this.toRel(event.newPath), op: 'index' })
          break
        }
      }
    }

    // 对每个路径取最后一个操作
    const finalOps = new Map<string, 'index' | 'remove'>()
    for (const { relPath, op } of expanded) {
      finalOps.set(relPath, op)
    }

    // 应用合并后的操作
    for (const [relPath, op] of finalOps) {
      if (op === 'index') {
        this.reindexFile(relPath)
      } else {
        this.index.removeFile(relPath)
      }
    }
  }

  /** 重新索引单个文件(读取磁盘内容并更新索引) */
  reindexFile(filePath: string): void {
    const abs = path.isAbsolute(filePath) ? filePath : path.resolve(this.workspaceRoot, filePath)
    let stat: fs.Stats
    try {
      stat = fs.statSync(abs)
    } catch {
      return
    }
    if (!stat.isFile()) return
    const ext = path.extname(abs).toLowerCase()
    if (!CODE_EXTS.has(ext)) return
    const content = fs.readFileSync(abs, 'utf-8')
    const relPath = path.relative(this.workspaceRoot, abs).replace(/\\/g, '/')
    this.index.indexFile(relPath, content, { size: stat.size, mtimeMs: stat.mtimeMs })
  }

  /**
   * 扫描并索引整个目录。
   * @param dir 相对 workspaceRoot 的子目录,缺省为 workspaceRoot 本身
   */
  async indexDirectory(dir?: string): Promise<{ files: number; definitions: number; elapsedMs: number }> {
    const start = Date.now()
    const targetDir = dir ? path.resolve(this.workspaceRoot, dir) : this.workspaceRoot
    const files = this.scanFiles(targetDir)
    for (const abs of files) {
      this.reindexFile(abs)
    }
    const stats = this.index.stats()
    return {
      files: files.length,
      definitions: stats.definitions,
      elapsedMs: Date.now() - start,
    }
  }

  /** 获取底层 CodeGraphIndex */
  getIndex(): CodeGraphIndex {
    return this.index
  }

  /** 将任意路径转为相对 workspaceRoot 的 POSIX 风格路径 */
  private toRel(filePath: string): string {
    const abs = path.isAbsolute(filePath) ? filePath : path.resolve(this.workspaceRoot, filePath)
    return path.relative(this.workspaceRoot, abs).replace(/\\/g, '/')
  }

  /** 递归扫描目录,返回所有代码文件的绝对路径 */
  private scanFiles(dir: string): string[] {
    const out: string[] = []
    const stack: string[] = [dir]
    while (stack.length > 0) {
      const cur = stack.pop()!
      let entries: fs.Dirent[]
      try {
        entries = fs.readdirSync(cur, { withFileTypes: true })
      } catch {
        continue
      }
      for (const e of entries) {
        if (e.isDirectory()) {
          if (IGNORED_DIRS.has(e.name)) continue
          if (e.name.startsWith('.') && e.name !== '.') continue
          stack.push(path.join(cur, e.name))
        } else if (e.isFile() && CODE_EXTS.has(path.extname(e.name).toLowerCase())) {
          out.push(path.join(cur, e.name))
        }
      }
    }
    return out
  }
}
