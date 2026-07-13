import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DdlAuditTrail, DdlOp, GENESIS_HASH } from '../src/utils/audit-ddl-trail.js'

describe('audit-ddl-trail — DDL 审计追踪链', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ddl-trail-'))
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  describe('GENESIS_HASH', () => {
    it('为 64 个 0', () => {
      expect(GENESIS_HASH).toBe('0'.repeat(64))
      expect(GENESIS_HASH).toHaveLength(64)
    })
  })

  describe('DdlOp 枚举', () => {
    it('包含 6 个操作类型', () => {
      expect(DdlOp.CREATE).toBe('CREATE')
      expect(DdlOp.ALTER).toBe('ALTER')
      expect(DdlOp.DROP).toBe('DROP')
      expect(DdlOp.RENAME).toBe('RENAME')
      expect(DdlOp.TRUNCATE).toBe('TRUNCATE')
      expect(DdlOp.INDEX).toBe('INDEX')
    })
  })

  describe('record', () => {
    it('记录 DDL 并返回带 hash 的条目', () => {
      const t = new DdlAuditTrail()
      const e = t.record('create', 'TABLE', 'users', 'alice', 'CREATE TABLE users(id int)')
      expect(e.op).toBe('CREATE')
      expect(e.objType).toBe('TABLE')
      expect(e.objName).toBe('users')
      expect(e.actor).toBe('alice')
      expect(e.sql).toBe('CREATE TABLE users(id int)')
      expect(e.prevHash).toBe(GENESIS_HASH)
      expect(e.hash).toHaveLength(64)
      expect(e.ts).toBeGreaterThan(0)
    })

    it('op 大小写不敏感（统一转大写）', () => {
      const t = new DdlAuditTrail()
      const e = t.record('alter', 'TABLE', 'users', 'a', 'x')
      expect(e.op).toBe('ALTER')
    })

    it('extra 默认为空对象', () => {
      const t = new DdlAuditTrail()
      const e = t.record('drop', 'TABLE', 't', 'a', 'x')
      expect(e.extra).toEqual({})
    })

    it('extra 透传', () => {
      const t = new DdlAuditTrail()
      const e = t.record('drop', 'TABLE', 't', 'a', 'x', { reason: 'test' })
      expect(e.extra).toEqual({ reason: 'test' })
    })
  })

  describe('verify', () => {
    it('空链返回 ok=true', () => {
      const t = new DdlAuditTrail()
      const r = t.verify()
      expect(r.ok).toBe(true)
      expect(r.brokenAt).toBeNull()
      expect(r.total).toBe(0)
      expect(r.tailHash).toBe(GENESIS_HASH)
    })

    it('单条记录校验通过', () => {
      const t = new DdlAuditTrail()
      t.record('create', 'TABLE', 't', 'a', 'x')
      const r = t.verify()
      expect(r.ok).toBe(true)
      expect(r.total).toBe(1)
      expect(r.tailHash).toHaveLength(64)
    })

    it('多条记录形成链', () => {
      const t = new DdlAuditTrail()
      t.record('create', 'TABLE', 't1', 'a', 'x1')
      t.record('alter', 'TABLE', 't2', 'a', 'x2')
      t.record('drop', 'TABLE', 't3', 'a', 'x3')
      const r = t.verify()
      expect(r.ok).toBe(true)
      expect(r.total).toBe(3)
    })

    it('篡改后校验失败', () => {
      const t = new DdlAuditTrail()
      const e1 = t.record('create', 'TABLE', 't1', 'a', 'x1')
      t.record('alter', 'TABLE', 't2', 'a', 'x2')
      // 篡改第一条的 sql（但保留 hash 不变）
      const internal = t as unknown as { entries: Array<{ sql: string }> }
      internal.entries[0]!.sql = 'TAMPERED'
      void e1
      const r = t.verify()
      expect(r.ok).toBe(false)
      expect(r.brokenAt).toBe(0)
    })
  })

  describe('listRecent', () => {
    it('返回最近 N 条', () => {
      const t = new DdlAuditTrail()
      for (let i = 0; i < 10; i++) t.record('create', 'TABLE', `t${i}`, 'a', 'x')
      const recent = t.listRecent(3)
      expect(recent).toHaveLength(3)
      expect(recent[0]!.objName).toBe('t7')
      expect(recent[2]!.objName).toBe('t9')
    })

    it('按 objName 过滤', () => {
      const t = new DdlAuditTrail()
      t.record('create', 'TABLE', 't1', 'a', 'x')
      t.record('create', 'TABLE', 't2', 'a', 'x')
      t.record('alter', 'TABLE', 't1', 'a', 'x')
      const recent = t.listRecent(50, 't1')
      expect(recent).toHaveLength(2)
      expect(recent.every((e) => e.objName === 't1')).toBe(true)
    })
  })

  describe('query', () => {
    it('按 actor 过滤', () => {
      const t = new DdlAuditTrail()
      t.record('create', 'TABLE', 't1', 'alice', 'x')
      t.record('create', 'TABLE', 't2', 'bob', 'x')
      const r = t.query({ actor: 'alice' })
      expect(r).toHaveLength(1)
      expect(r[0]!.actor).toBe('alice')
    })

    it('按 op 过滤', () => {
      const t = new DdlAuditTrail()
      t.record('create', 'TABLE', 't1', 'a', 'x')
      t.record('alter', 'TABLE', 't2', 'a', 'x')
      const r = t.query({ op: 'alter' })
      expect(r).toHaveLength(1)
      expect(r[0]!.op).toBe('ALTER')
    })

    it('按 sinceTs 过滤', () => {
      const t = new DdlAuditTrail()
      const e1 = t.record('create', 'TABLE', 't1', 'a', 'x')
      const r = t.query({ sinceTs: e1.ts + 1 })
      expect(r).toHaveLength(0)
      const r2 = t.query({ sinceTs: e1.ts })
      expect(r2).toHaveLength(1)
    })

    it('limit 生效', () => {
      const t = new DdlAuditTrail()
      for (let i = 0; i < 10; i++) t.record('create', 'TABLE', `t${i}`, 'a', 'x')
      const r = t.query({ limit: 3 })
      expect(r).toHaveLength(3)
    })
  })

  describe('持久化（JSONL）', () => {
    it('写入文件后从文件恢复', () => {
      const logPath = join(dir, 'ddl.jsonl')
      const t1 = new DdlAuditTrail(logPath)
      t1.record('create', 'TABLE', 't1', 'a', 'x1')
      t1.record('alter', 'TABLE', 't2', 'a', 'x2')

      const t2 = new DdlAuditTrail(logPath)
      expect(t2.stats().total).toBe(2)
      expect(t2.verify().ok).toBe(true)
    })

    it('损坏行被跳过', () => {
      const logPath = join(dir, 'ddl.jsonl')
      writeFileSync(logPath, 'invalid json line\n', 'utf8')
      const t = new DdlAuditTrail(logPath)
      expect(t.stats().total).toBe(0)
    })

    it('clear 删除文件', () => {
      const logPath = join(dir, 'ddl.jsonl')
      const t = new DdlAuditTrail(logPath)
      t.record('create', 'TABLE', 't1', 'a', 'x')
      const content = readFileSync(logPath, 'utf8')
      expect(content).toContain('CREATE')
      t.clear()
      expect(t.stats().total).toBe(0)
      // 文件已删除
      const t2 = new DdlAuditTrail(logPath)
      expect(t2.stats().total).toBe(0)
    })
  })

  describe('stats', () => {
    it('反映总数与 byOp 分布', () => {
      const t = new DdlAuditTrail()
      t.record('create', 'TABLE', 't1', 'a', 'x')
      t.record('create', 'TABLE', 't2', 'a', 'x')
      t.record('alter', 'TABLE', 't3', 'a', 'x')
      const s = t.stats()
      expect(s.total).toBe(3)
      expect(s.byOp.CREATE).toBe(2)
      expect(s.byOp.ALTER).toBe(1)
      expect(s.tailHash).toHaveLength(64)
    })
  })

  describe('setLogPath', () => {
    it('运行时切换日志路径', () => {
      const t = new DdlAuditTrail()
      t.setLogPath(join(dir, 'late.jsonl'))
      t.record('create', 'TABLE', 't1', 'a', 'x')
      const s = t.stats()
      expect(s.logPath).toContain('late.jsonl')
    })
  })

  describe('maxInMem 上限', () => {
    it('超出后保留最新', () => {
      const t = new DdlAuditTrail('', 3)
      for (let i = 0; i < 5; i++) t.record('create', 'TABLE', `t${i}`, 'a', 'x')
      const s = t.stats()
      expect(s.total).toBe(3)
    })
  })
})
