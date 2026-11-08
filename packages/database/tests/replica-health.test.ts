// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * DB-27 / DB-28 纯函数 + 懒连接夹具（不连库）。
 *
 * DB-27: lagSec 必须是 WAL 回放位点差(毫秒规整),不能是 `SELECT 1` 的 RTT。
 * DB-28: 副本健康初值必须是 false;首轮探测成功前 getReader() 回退主库。
 */
import { describe, expect, it } from 'vitest'
import { createReadWriteDb, normalizeReplicaLagSec } from '../src/read-replica.js'

const LAZY_REPLICA_URL = 'postgres://ihui:ihui@127.0.0.1:1/ihui_test'

describe('DB-27 normalizeReplicaLagSec 以真实回放时延为判据', () => {
  it('毫秒 → 秒;30s 真实延迟不会被 2ms RTT 抹成 0', () => {
    expect(normalizeReplicaLagSec(30_000)).toBe(30)
    expect(normalizeReplicaLagSec(2)).toBeCloseTo(0.002, 6)
  })

  it('无读数(null/undefined/非有限值)返回 undefined,由上层保留上次读数', () => {
    expect(normalizeReplicaLagSec(null)).toBeUndefined()
    expect(normalizeReplicaLagSec(undefined)).toBeUndefined()
    expect(normalizeReplicaLagSec(Number.NaN)).toBeUndefined()
    expect(normalizeReplicaLagSec(Number.POSITIVE_INFINITY)).toBeUndefined()
  })

  it('时钟倒挂的负值收敛为 0(不产生负延迟)', () => {
    expect(normalizeReplicaLagSec(-3)).toBe(0)
  })
})

describe('DB-28 副本健康初值为 false,首轮探测前读走主库', () => {
  it('未探测成功的副本不得被 getReader() 选中', async () => {
    const db = createReadWriteDb({
      url: 'postgres://ihui:ihui@127.0.0.1:1/ihui_test',
      replicas: [{ id: 'r1', url: LAZY_REPLICA_URL, priority: 1 }],
    })
    try {
      const [status] = db.getReplicaStatuses()
      expect(status.healthy).toBe(false)
      expect(db.getReader()).toBe(db.dbWriter)

      // 首轮探测成功(真实回放延迟 2ms)后才允许读副本
      db.reportReplicaHealth('r1', true, normalizeReplicaLagSec(2))
      expect(db.getReplicaStatuses()[0].healthy).toBe(true)
      expect(db.getReader()).toBe(db.replicaDbs.get('r1'))
    } finally {
      await db.writerClient.end()
      for (const client of db.replicaClients.values()) await client.end()
    }
  })

  it('真实回放延迟 30s 必须判不健康(阈值 10s),成功上报不得抹平延迟', async () => {
    const db = createReadWriteDb({
      url: 'postgres://ihui:ihui@127.0.0.1:1/ihui_test',
      replicas: [{ id: 'r1', url: LAZY_REPLICA_URL, priority: 1 }],
    })
    try {
      db.reportReplicaHealth('r1', true, normalizeReplicaLagSec(2))
      expect(db.getReplicaStatuses()[0].healthy).toBe(true)

      db.reportReplicaHealth('r1', true, normalizeReplicaLagSec(30_000))
      expect(db.getReplicaStatuses()[0].lagSec).toBe(30)
      expect(db.getReplicaStatuses()[0].healthy).toBe(false)
      expect(db.getReader()).toBe(db.dbWriter)

      // 后续成功上报未带延迟读数 ⇒ 保留 30s,不得回写 0 后复活
      db.reportReplicaHealth('r1', true)
      expect(db.getReplicaStatuses()[0].lagSec).toBe(30)
      expect(db.getReplicaStatuses()[0].healthy).toBe(false)
    } finally {
      await db.writerClient.end()
      for (const client of db.replicaClients.values()) await client.end()
    }
  })
})
