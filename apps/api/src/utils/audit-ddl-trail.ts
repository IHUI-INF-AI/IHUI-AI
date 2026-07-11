/**
 * DDL 审计追踪链.
 *
 * 设计:
 *   - 记录 DDL 操作 (CREATE / ALTER / DROP / RENAME / TRUNCATE / INDEX) 到追加日志
 *   - 每条记录包含前一记录的 SHA-256 哈希 (链式防篡改)
 *   - 启动时可校验整条链完整性
 *   - 支持内存索引按表名 / 操作者 / 时间范围查询
 *   - 持久化到 JSONL, 异常恢复
 *
 * 参考: git show 3ee96cf0:server/app/utils/audit_ddl_trail.py
 */

import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, readFileSync, rmSync } from 'node:fs'

/** 创世哈希. */
export const GENESIS_HASH = '0'.repeat(64)

/** DDL 操作类型. */
export enum DdlOp {
  CREATE = 'CREATE',
  ALTER = 'ALTER',
  DROP = 'DROP',
  RENAME = 'RENAME',
  TRUNCATE = 'TRUNCATE',
  INDEX = 'INDEX',
}

/** DDL 审计条目. */
export interface DdlEntry {
  op: string
  /** 对象类型: TABLE / INDEX / VIEW ... */
  objType: string
  objName: string
  actor: string
  ts: number
  sql: string
  prevHash: string
  hash: string
  extra: Record<string, unknown>
}

/** 校验结果. */
export interface DdlVerifyResult {
  ok: boolean
  /** 断点位置, null 表示无断点 */
  brokenAt: number | null
  total: number
  tailHash: string
}

/** 计算条目哈希. */
function computeHash(entry: DdlEntry): string {
  const body = `${entry.op}|${entry.objType}|${entry.objName}|${entry.actor}|${entry.ts}|${entry.sql}|${entry.prevHash}`
  return createHash('sha256').update(body, 'utf8').digest('hex')
}

/**
 * DDL 审计链: 追加 + 哈希链 + 校验.
 */
export class DdlAuditTrail {
  private readonly maxInMem: number
  private logPath: string
  private readonly entries: DdlEntry[] = []
  private tailHash = GENESIS_HASH

  constructor(logPath = '', maxInMem = 5000) {
    this.logPath = logPath
    this.maxInMem = maxInMem
    if (logPath && existsSync(logPath)) this.loadFromFile()
  }

  private loadFromFile(): void {
    try {
      const text = readFileSync(this.logPath, 'utf8')
      for (const line of text.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const d = JSON.parse(trimmed) as DdlEntry
          this.entries.push(d)
          this.tailHash = d.hash
        } catch {
          continue
        }
      }
      // 超出内存上限: 保留最新的
      if (this.entries.length > this.maxInMem) {
        this.entries.splice(0, this.entries.length - this.maxInMem)
      }
    } catch {
      /* 读取失败忽略 */
    }
  }

  private appendToFile(entry: DdlEntry): void {
    if (!this.logPath) return
    try {
      appendFileSync(this.logPath, JSON.stringify(entry) + '\n', 'utf8')
    } catch {
      /* 写入失败忽略 */
    }
  }

  /** 记录一条 DDL. */
  record(
    op: string,
    objType: string,
    objName: string,
    actor: string,
    sql: string,
    extra?: Record<string, unknown>,
  ): DdlEntry {
    const opUpper = op.toUpperCase()
    const entry: DdlEntry = {
      op: opUpper,
      objType,
      objName,
      actor,
      ts: Date.now() / 1000,
      sql,
      prevHash: this.tailHash,
      hash: '',
      extra: extra ?? {},
    }
    entry.hash = computeHash(entry)
    this.entries.push(entry)
    if (this.entries.length > this.maxInMem) this.entries.shift()
    this.tailHash = entry.hash
    this.appendToFile(entry)
    return entry
  }

  /** 校验整条链. */
  verify(): DdlVerifyResult {
    let prev = GENESIS_HASH
    let brokenAt: number | null = null
    for (let idx = 0; idx < this.entries.length; idx++) {
      const e = this.entries[idx]!
      if (e.prevHash !== prev) {
        brokenAt = idx
        break
      }
      const recomputed = computeHash(e)
      if (recomputed !== e.hash) {
        brokenAt = idx
        break
      }
      prev = e.hash
    }
    return {
      ok: brokenAt === null,
      brokenAt,
      total: this.entries.length,
      tailHash: this.entries.length > 0 ? this.tailHash : GENESIS_HASH,
    }
  }

  /** 获取最近 N 条. */
  listRecent(n = 50, objName?: string): DdlEntry[] {
    let arr = this.entries
    if (objName) arr = arr.filter((e) => e.objName === objName)
    return arr.slice(-n)
  }

  /** 按条件查询. */
  query(
    opts: {
      objName?: string
      actor?: string
      op?: string
      sinceTs?: number
      limit?: number
    } = {},
  ): DdlEntry[] {
    const { objName, actor, op, sinceTs = 0, limit = 200 } = opts
    const opUpper = op?.toUpperCase()
    const out: DdlEntry[] = []
    for (const e of this.entries) {
      if (objName && e.objName !== objName) continue
      if (actor && e.actor !== actor) continue
      if (opUpper && e.op !== opUpper) continue
      if (e.ts < sinceTs) continue
      out.push(e)
      if (out.length >= limit) break
    }
    return out
  }

  /** 清空 (同时删除持久化文件). */
  clear(): void {
    this.entries.length = 0
    this.tailHash = GENESIS_HASH
    if (this.logPath && existsSync(this.logPath)) {
      try {
        rmSync(this.logPath)
      } catch {
        /* ignore */
      }
    }
  }

  /** 统计. */
  stats(): { total: number; byOp: Record<string, number>; tailHash: string; logPath: string } {
    const byOp: Record<string, number> = {}
    for (const e of this.entries) byOp[e.op] = (byOp[e.op] ?? 0) + 1
    return {
      total: this.entries.length,
      byOp,
      tailHash: this.tailHash,
      logPath: this.logPath,
    }
  }

  /** 设置日志路径. */
  setLogPath(p: string): void {
    this.logPath = p
  }
}

/** 全局单例. */
export const ddlAudit = new DdlAuditTrail()
