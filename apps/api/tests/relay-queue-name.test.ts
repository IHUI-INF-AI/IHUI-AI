// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池队列名 × 数据库身份判据(2026-10-31 立,配 relay-queue-name.ts)。
 *
 * 立因:隔离栈(`.ihui-agent/tmp/perf5`,`DATABASE_URL=ihui_e2e`)继承主库 `REDIS_URL`,
 * 起的 worker 从主库 `relay-account-pool-queue` 抢走 sweep 作业并在缺列库上全轮失败,
 * 主库号池保活连续 7 天没执行。本用例锁的是「队列名必须能表达库身份」这条不变量。
 *
 * 判据一律 import 生产实现,测试内不复制第二份规则表(AGENTS §0.6 单一真相源);
 * 每条断言都给反例:隔离库必须带后缀,**远端生产库(production/railway)不得误伤**。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  PRIMARY_DB_NAME,
  dbNameFromUrl,
  describeQueueIsolation,
  relayAccountPoolQueueName,
  relayQueueName,
} from '../src/services/relay-queue-name.js'

const BASE = 'relay-account-pool-queue'

/** env 面原值快照(改 process.env 的用例一律经 withEnv,退出即还原,不污染他人) */
let savedEnv: Record<string, string | undefined> = {}

beforeEach(() => {
  savedEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    RELAY_QUEUE_SUFFIX: process.env.RELAY_QUEUE_SUFFIX,
    RELAY_PRIMARY_DB_NAME: process.env.RELAY_PRIMARY_DB_NAME,
  }
})

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('dbNameFromUrl(DSN → 库名)', () => {
  it('标准 DSN', () => {
    expect(dbNameFromUrl('postgresql://user:pass@localhost:5432/ihui')).toBe('ihui')
  })

  it('带 query 参数(库名不被查询串污染)', () => {
    expect(dbNameFromUrl('postgresql://user:pass@db:5432/ihui_e2e?sslmode=require')).toBe(
      'ihui_e2e',
    )
  })

  it('带 schema 参数', () => {
    expect(dbNameFromUrl('postgresql://user:pass@localhost:5432/ihui?schema=public')).toBe('ihui')
  })

  it('percent-encoded 库名解回原文', () => {
    expect(dbNameFromUrl('postgresql://user:pass@localhost:5432/my%20db')).toBe('my db')
  })

  it('无库名 ⇒ null(只有斜杠/只有主机)', () => {
    expect(dbNameFromUrl('postgresql://user:pass@localhost:5432/')).toBeNull()
    expect(dbNameFromUrl('postgresql://user:pass@localhost:5432')).toBeNull()
  })

  it('非法字符串 ⇒ null(不抛)', () => {
    expect(dbNameFromUrl('not a url')).toBeNull()
    expect(dbNameFromUrl('postgresql://user:pass@[bad/ihui')).toBeNull()
  })

  it('空值 ⇒ null', () => {
    expect(dbNameFromUrl(undefined)).toBeNull()
    expect(dbNameFromUrl(null)).toBeNull()
    expect(dbNameFromUrl('')).toBeNull()
  })
})

describe('relayQueueName(基础名 × 库身份)', () => {
  it('主库 ihui ⇒ 原名(生产零扰动)', () => {
    expect(relayQueueName(BASE, { dbName: 'ihui' })).toBe(BASE)
    expect(PRIMARY_DB_NAME).toBe('ihui')
  })

  it('隔离库 ihui_e2e ⇒ 带库名后缀', () => {
    expect(relayQueueName(BASE, { dbName: 'ihui_e2e' })).toBe(`${BASE}-ihui_e2e`)
  })

  it('一次性栈 ihui_perf5 ⇒ 带库名后缀', () => {
    expect(relayQueueName(BASE, { dbName: 'ihui_perf5' })).toBe(`${BASE}-ihui_perf5`)
  })

  it('他人命名的测试库 myapp_test ⇒ 带库名后缀', () => {
    expect(relayQueueName(BASE, { dbName: 'myapp_test' })).toBe(`${BASE}-myapp_test`)
  })

  it('远端生产库 production / railway ⇒ 原名(不得误伤)', () => {
    expect(relayQueueName(BASE, { dbName: 'production' })).toBe(BASE)
    expect(relayQueueName(BASE, { dbName: 'railway' })).toBe(BASE)
  })

  it('解析不出库名(null)⇒ 原名', () => {
    expect(relayQueueName(BASE, { dbName: null })).toBe(BASE)
  })

  it('显式 RELAY_QUEUE_SUFFIX 优先于库名判据', () => {
    expect(relayQueueName(BASE, { dbName: 'ihui_e2e', explicitSuffix: 'slot-a' })).toBe(
      `${BASE}-slot-a`,
    )
    // 主库上给了显式后缀 ⇒ 也照后缀走(人工强隔离优先)
    expect(relayQueueName(BASE, { dbName: 'ihui', explicitSuffix: 'slot-a' })).toBe(
      `${BASE}-slot-a`,
    )
  })

  it('显式后缀为空串/空白 ⇒ 视为未设置,回落库名判据', () => {
    expect(relayQueueName(BASE, { dbName: 'ihui_e2e', explicitSuffix: '' })).toBe(
      `${BASE}-ihui_e2e`,
    )
    expect(relayQueueName(BASE, { dbName: 'ihui_e2e', explicitSuffix: '   ' })).toBe(
      `${BASE}-ihui_e2e`,
    )
  })

  it('primaryDbName 覆盖:主库自己就叫 ihui_e2e 时不加后缀', () => {
    expect(relayQueueName(BASE, { dbName: 'ihui_e2e', primaryDbName: 'ihui_e2e' })).toBe(BASE)
    // 覆盖后别的隔离库仍按特征加后缀
    expect(relayQueueName(BASE, { dbName: 'ihui_perf5', primaryDbName: 'ihui_e2e' })).toBe(
      `${BASE}-ihui_perf5`,
    )
  })

  it('不传 dbName ⇒ 从 DATABASE_URL 解析(进程环境唯一入口)', () => {
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/ihui_e2e'
    expect(relayQueueName(BASE)).toBe(`${BASE}-ihui_e2e`)
    expect(relayAccountPoolQueueName()).toBe(`${BASE}-ihui_e2e`)

    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/ihui'
    expect(relayQueueName(BASE)).toBe(BASE)
    expect(relayAccountPoolQueueName()).toBe(BASE)
  })
})

describe('BullMQ 合法性:队列名里不许出现冒号', () => {
  // 立因:BullMQ 的 QueueBase 构造时对队列名里的 `:` 直接抛
  // `Queue name cannot contain :`(bullmq/dist/cjs/classes/queue-base.js)。解析层一旦产出冒号,
  // 隔离栈的 API 会整进程崩在 worker 启动那一步(2026-10-31 实测于 --stack 档)。
  // 此前 21 例全按冒号断言 ⇒ 纯函数绿、运行时红;这几例补的是**运行时形状**。
  it('三条规则分支的产物都不含冒号', () => {
    expect(relayQueueName(BASE, { dbName: 'ihui' })).toBe(BASE)
    expect(relayQueueName(BASE, { dbName: 'ihui_e2e' })).toBe(`${BASE}-ihui_e2e`)
    expect(relayQueueName(BASE, { dbName: 'ihui', explicitSuffix: 'slot-a' })).toBe(
      `${BASE}-slot-a`,
    )
  })

  it('显式后缀里自带冒号 ⇒ 换成连字符(一条手写的后缀不许把服务打死)', () => {
    expect(relayQueueName(BASE, { dbName: 'ihui', explicitSuffix: 'slot:2' })).toBe(
      `${BASE}-slot-2`,
    )
    expect(relayQueueName(BASE, { dbName: 'ihui', explicitSuffix: 'a:b:c' })).toBe(`${BASE}-a-b-c`)
  })

  it('worker 与任务中心共用的那个出口同样不含冒号', () => {
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/ihui_e2e'
    process.env.RELAY_QUEUE_SUFFIX = 'e2e'
    expect(relayAccountPoolQueueName()).not.toContain(':')
    expect(describeQueueIsolation().queue).not.toContain(':')
  })
})

describe('describeQueueIsolation(启动日志的三条 reason)', () => {
  it('reason=explicit-suffix:RELAY_QUEUE_SUFFIX 在位', () => {
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/ihui'
    process.env.RELAY_QUEUE_SUFFIX = 'perf5'
    expect(describeQueueIsolation()).toEqual({
      queue: `${BASE}-perf5`,
      dbName: 'ihui',
      isolated: true,
      reason: 'explicit-suffix',
    })
  })

  it('reason=isolated-db:隔离库命中特征', () => {
    delete process.env.RELAY_QUEUE_SUFFIX
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/ihui_e2e'
    expect(describeQueueIsolation()).toEqual({
      queue: `${BASE}-ihui_e2e`,
      dbName: 'ihui_e2e',
      isolated: true,
      reason: 'isolated-db',
    })
  })

  it('reason=primary:主库原名', () => {
    delete process.env.RELAY_QUEUE_SUFFIX
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/ihui'
    expect(describeQueueIsolation()).toEqual({
      queue: BASE,
      dbName: 'ihui',
      isolated: false,
      reason: 'primary',
    })
  })

  it('DATABASE_URL 缺失 ⇒ dbName 为 null、原名(如实不猜)', () => {
    delete process.env.RELAY_QUEUE_SUFFIX
    delete process.env.DATABASE_URL
    expect(describeQueueIsolation()).toEqual({
      queue: BASE,
      dbName: null,
      isolated: false,
      reason: 'primary',
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
