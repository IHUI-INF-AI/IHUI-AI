// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-243 回归锁(2026-11-13)。
 *
 * 病灶:队列隔离只看库名关键词(`e2e|test|ci|tmp|perf|sandbox|scratch`),
 * `DATABASE_URL` 指向 `ihui_staging/preview/backup/local` 等**非主库但名字不含特征**时
 * 落到「原名」分支 ⇒ 隔离/预发栈静默接管主库定时作业(号池保活/对账)。
 *
 * 本文件锁:
 *   ① 库名不含特征且未显式声明主库 ⇒ 走隔离队列(默认隔离);
 *   ② 只有显式认定主库(白名单库名 / RELAY_DB_ROLE=primary)才走主队列原名;
 *   ③ 原有含关键词库名(`ihui_e2e`/`ihui_perf5`/`myapp_test`)按新语义仍隔离;
 *   ④ 不同非主库各自产生不同队列名,互不抢作业;
 *   ⑤ 源锁:不存在「仅凭库名关键词直接判主库」的分支。
 *
 * 纯 env + 生产解析函数,不触达 PG / Redis。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  PRIMARY_DB_NAME,
  describeQueueIsolation,
  relayQueueName,
} from '../src/services/relay-queue-name.js'

const BASE = 'relay-account-pool-queue'
const SOURCE = fileURLToPath(new URL('../src/services/relay-queue-name.ts', import.meta.url))

const ENV_KEYS = [
  'DATABASE_URL',
  'RELAY_QUEUE_SUFFIX',
  'RELAY_DB_ROLE',
  'RELAY_PRIMARY_DB_NAME',
] as const

let savedEnv: Record<string, string | undefined> = {}

beforeEach(() => {
  savedEnv = {}
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key]
  // 宿主 shell 可能残留人工后缀/角色,本用例一律从「未设置」起算
  delete process.env.RELAY_QUEUE_SUFFIX
  delete process.env.RELAY_DB_ROLE
  delete process.env.RELAY_PRIMARY_DB_NAME
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = savedEnv[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('F-243 ① 默认隔离:库名不含关键词且未显式声明 ⇒ 走隔离队列', () => {
  it.each(['ihui_staging', 'ihui_preview', 'ihui_backup', 'ihui_local', 'ihui_pre_prod'])(
    '非主库 %s ⇒ 带库名后缀',
    (dbName) => {
      expect(relayQueueName(BASE, { dbName })).toBe(`${BASE}-${dbName}`)
    },
  )

  it('ihui_staging 的启动日志如实报 isolated-db / isolated=true', () => {
    expect(describeQueueIsolation({ dbName: 'ihui_staging' })).toEqual({
      queue: `${BASE}-ihui_staging`,
      dbName: 'ihui_staging',
      isolated: true,
      reason: 'isolated-db',
    })
  })

  it('DATABASE_URL 指向 ihui_staging(不传 dbName)同样隔离', () => {
    process.env.DATABASE_URL = 'postgresql://u:p@db:5432/ihui_staging'
    expect(relayQueueName(BASE)).toBe(`${BASE}-ihui_staging`)
    expect(describeQueueIsolation().reason).toBe('isolated-db')
    expect(describeQueueIsolation().isolated).toBe(true)
  })
})

describe('F-243 ② 显式认定主库才走原名', () => {
  it('主库名 ihui 与白名单 production / railway ⇒ 原名', () => {
    expect(relayQueueName(BASE, { dbName: PRIMARY_DB_NAME })).toBe(BASE)
    expect(relayQueueName(BASE, { dbName: 'production' })).toBe(BASE)
    expect(relayQueueName(BASE, { dbName: 'railway' })).toBe(BASE)
    expect(describeQueueIsolation({ dbName: 'production' })).toEqual({
      queue: BASE,
      dbName: 'production',
      isolated: false,
      reason: 'primary',
    })
  })

  it('RELAY_DB_ROLE=primary ⇒ 即便库名像隔离库也用原名', () => {
    process.env.RELAY_DB_ROLE = 'primary'
    expect(relayQueueName(BASE, { dbName: 'ihui_staging' })).toBe(BASE)
    expect(relayQueueName(BASE, { dbName: 'ihui_e2e' })).toBe(BASE)
    expect(describeQueueIsolation({ dbName: 'ihui_backup' })).toEqual({
      queue: BASE,
      dbName: 'ihui_backup',
      isolated: false,
      reason: 'primary',
    })
  })

  it('dbRole 显式传参优先于 env;非 primary 角色不认主库', () => {
    expect(relayQueueName(BASE, { dbName: 'ihui_staging', dbRole: 'primary' })).toBe(BASE)
    expect(relayQueueName(BASE, { dbName: 'ihui_staging', dbRole: 'replica' })).toBe(
      `${BASE}-ihui_staging`,
    )
  })

  it('解析不出库名(null)⇒ 原名(不猜)', () => {
    expect(relayQueueName(BASE, { dbName: null })).toBe(BASE)
    expect(describeQueueIsolation({ dbName: null }).reason).toBe('primary')
  })
})

describe('F-243 ③ 原有含关键词库名的行为按新语义断言', () => {
  it.each(['ihui_e2e', 'ihui_perf5', 'myapp_test', 'ihui_ci', 'ihui_tmp'])(
    '关键词库 %s 仍然隔离(理由不再是「命中关键词才隔离」)',
    (dbName) => {
      expect(relayQueueName(BASE, { dbName })).toBe(`${BASE}-${dbName}`)
      expect(describeQueueIsolation({ dbName })).toEqual({
        queue: `${BASE}-${dbName}`,
        dbName,
        isolated: true,
        reason: 'isolated-db',
      })
    },
  )

  it('关键词库名不会被当成主库(反之亦然:非关键词非主库也必须隔离)', () => {
    expect(relayQueueName(BASE, { dbName: 'ihui_e2e' })).not.toBe(BASE)
    expect(relayQueueName(BASE, { dbName: 'ihui_staging' })).not.toBe(BASE)
  })
})

describe('F-243 ④ 不同非主库产生不同队列名,互不抢作业', () => {
  it('staging / preview / test 三个非主库两两不同且都不等于主库原名', () => {
    const names = ['ihui_staging', 'ihui_preview', 'myapp_test'].map((dbName) =>
      relayQueueName(BASE, { dbName }),
    )
    expect(new Set([...names, BASE]).size).toBe(names.length + 1)
    for (const name of names) expect(name).not.toBe(BASE)
  })
})

describe('F-243 ⑤ 源锁:不存在「仅凭库名关键词直接判主库」的分支', () => {
  it('主库判据只来自显式角色 / 白名单,不含任何库名关键词正则', () => {
    const src = readFileSync(SOURCE, 'utf8')
    const start = src.indexOf('function isPrimaryDatabase')
    expect(start).toBeGreaterThan(-1)
    const end = src.indexOf('\n}', start)
    expect(end).toBeGreaterThan(start)
    const guard = src.slice(start, end)

    // 显式声明路径必须真实存在(否则「默认隔离」就没有出口)
    expect(guard).toContain('dbRole')
    expect(guard).toContain('PRIMARY_DB_NAME_WHITELIST')
    // 关键词判据(正则字面量)一旦混进来,就可能是「命中即主库」的旧形状
    expect(guard).not.toMatch(/\/[^/\n]+\/[gimsuy]*/)
    expect(guard).not.toContain('e2e')
  })

  it('resolve 的隔离分支由「非主库」反条件把关,且解析层不再出现关键词 .test(', () => {
    const src = readFileSync(SOURCE, 'utf8')
    const start = src.indexOf('function resolve(')
    expect(start).toBeGreaterThan(-1)
    const end = src.indexOf('\n}', start)
    expect(end).toBeGreaterThan(start)
    const body = src.slice(start, end)

    expect(body).toContain('!isPrimaryDatabase(dbName, primaryDbName, dbRole)')
    expect(body).not.toMatch(/\.test\(/)
    expect(body).not.toContain('ISOLATED_DB_PATTERN')
  })
})
