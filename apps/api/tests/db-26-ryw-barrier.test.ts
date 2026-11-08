// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DB-26 / DB-27 / DB-28 接线夹具(纯函数 + 读源码文本,不连库、不启动 Fastify)。
 *
 * DB-26: RywConsistency 不能是死代码 —— 写 SQL 必须打 RYW 标记,dbRead 代理在窗口内走主库。
 * DB-27: 探测必须查 pg 真实回放时延,不得再用 SELECT 1 的 RTT 冒充。
 * DB-28: 探测必须有超时护栏(配合 read-replica 的 healthy=false 初值)。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  RYW_READ_BARRIER_WINDOW_MS,
  RywReadBarrier,
  isWriteSql,
} from '../src/utils/ryw-consistency.js'

const DB_INDEX_SRC = readFileSync(new URL('../src/db/index.ts', import.meta.url), 'utf8')

describe('DB-26 写后读(RYW)屏障', () => {
  it('写窗口内必须走主库,窗口到期/其他主体不受影响', () => {
    const barrier = new RywReadBarrier()
    const t0 = 1_000_000

    expect(barrier.mustReadPrimary('user-1', t0)).toBe(false)
    barrier.markWrite('user-1', t0)
    expect(barrier.mustReadPrimary('user-1', t0)).toBe(true)
    expect(barrier.mustReadPrimary('user-2', t0)).toBe(false)
    expect(barrier.mustReadPrimary('user-1', t0 + RYW_READ_BARRIER_WINDOW_MS - 1)).toBe(true)
    expect(barrier.mustReadPrimary('user-1', t0 + RYW_READ_BARRIER_WINDOW_MS)).toBe(false)
  })

  it('匿名/后台写入按匿名作用域标记,自定义窗口可覆盖默认值', () => {
    const barrier = new RywReadBarrier(500)
    barrier.markWrite(null, 10)
    expect(barrier.mustReadPrimary(null, 10)).toBe(true)
    expect(barrier.mustReadPrimary(undefined, 509)).toBe(true)
    expect(barrier.mustReadPrimary(null, 510)).toBe(false)
  })

  it('写 SQL 识别覆盖 INSERT/UPDATE/DELETE/CTE,不把 SELECT/事务控制当写', () => {
    expect(isWriteSql('insert into users (id) values (1)')).toBe(true)
    expect(isWriteSql('  UPDATE users set name = $1 where id = $2')).toBe(true)
    expect(isWriteSql('delete from users where id = $1')).toBe(true)
    expect(isWriteSql('with t as (select 1) insert into users select * from t')).toBe(true)
    expect(isWriteSql('select * from users')).toBe(false)
    expect(isWriteSql('begin')).toBe(false)
    expect(isWriteSql('commit')).toBe(false)
  })

  it('db/index.ts 必须真的接线:sqlLogger 打标记 + dbRead 代理查屏障', () => {
    expect(DB_INDEX_SRC).toMatch(/from '\.\.\/utils\/ryw-consistency\.js'/)
    expect(DB_INDEX_SRC).toMatch(/new RywReadBarrier\(/)
    expect(DB_INDEX_SRC).toMatch(/rywBarrier\.markWrite\(/)
    expect(DB_INDEX_SRC).toMatch(/rywBarrier\.mustReadPrimary\(/)
    expect(DB_INDEX_SRC).toMatch(/currentPrincipal\(\)/)
  })
})

describe('DB-27/DB-28 副本探测接线', () => {
  it('探测查询使用 pg_last_xact_replay_timestamp,不再用 RTT 冒充延迟', () => {
    expect(DB_INDEX_SRC).toMatch(/pg_last_xact_replay_timestamp/)
    expect(DB_INDEX_SRC).not.toMatch(/lagSec = \(Date\.now\(\) - start\) \/ 1000/)
    expect(DB_INDEX_SRC).toMatch(/normalizeReplicaLagSec/)
  })

  it('首轮探测有超时护栏(不阻塞建连 + 超时即判本次失败)', () => {
    expect(DB_INDEX_SRC).toMatch(/REPLICA_PROBE_TIMEOUT_MS/)
    expect(DB_INDEX_SRC).toMatch(/setTimeout\(/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
