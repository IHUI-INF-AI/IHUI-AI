// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

/**
 * F-703(2026-11-11):智能体详情 `SUM(agent_billings.model_*_token)::int` 溢出。
 *
 * 病灶:`GET /api/agents/:agentId/details` 的统计查询写成
 * `COALESCE(sum(...), 0)::int`。`model_input_token/model_output_token` 是 integer,
 * 单条不溢出,但 `sum(int)` 得 int8 —— 累计超 2^31 后 `::int` 抛
 * `22003 numeric out of range`,整个详情接口 500。长寿智能体必然踩到。
 *
 * 两条不变量:
 *  ① SQL 侧累计必须留在 bigint(或更大),不得再窄回 `::int`;
 *  ② 对外仍是 number 契约(`::bigint` 经 pg 驱动回 string),取值处必须 `Number()` 收敛,
 *     且 null/undefined 兜底 0 —— 老客户端不会因为这次修复拿到 `"3000000000"`。
 *
 * 全程不连 PostgreSQL / Redis:SQL 形状读源码断言,归一逻辑测导出的纯函数。
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// 只借用 agents.ts 的纯函数:整条路由图的依赖(DB 池/Redis/鉴权)整体桩掉,
// 保证本文件零连接(AGENTS §5)。
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://127.0.0.1:5399/test',
    REDIS_URL: 'redis://127.0.0.1:6399',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(),
  checkAuth: vi.fn(),
  requireActiveUser: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(),
  isSystemAdmin: () => false,
}))

vi.mock('../src/db/rbac-queries.js', () => ({
  checkPermission: vi.fn().mockResolvedValue(false),
}))

vi.mock('../src/db/index.js', () => ({
  db: {},
  dbRead: {},
  dbClient: {},
}))

vi.mock('../src/services/agent-service.js', () => ({
  listAgents: vi.fn(),
  getAgentDetail: vi.fn(),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
}))

import { toBigintNumber } from '../src/routes/agents.js'

const root = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..')
const agentsSrc = readFileSync(path.join(root, 'apps/api/src/routes/agents.ts'), 'utf8')

function detailRouteBlock(): string {
  const start = agentsSrc.indexOf("server.get('/:agentId/details'")
  expect(start, '详情路由必须存在').toBeGreaterThan(-1)
  const end = agentsSrc.indexOf('\n  })\n', start)
  expect(end, '详情路由块必须能闭合').toBeGreaterThan(start)
  return agentsSrc.slice(start, end)
}

describe('F-703 SQL 形状:token 累计不得窄回 ::int', () => {
  it('totalInputTokens / totalOutputTokens 走 ::bigint', () => {
    const block = detailRouteBlock()
    const tokenLines = block
      .split('\n')
      .filter((line) => /model(Input|Output)Token/.test(line))
    expect(tokenLines.length).toBeGreaterThanOrEqual(2)
    for (const line of tokenLines) {
      expect(line, line).toContain('::bigint')
    }
  })

  it('token 聚合行不出现 ::int(旧写法会 22003)', () => {
    const block = detailRouteBlock()
    const sums = block
      .split('\n')
      .filter((line) => /sum\(/.test(line) && /model(Input|Output)Token/.test(line))
    expect(sums.length).toBeGreaterThanOrEqual(2)
    for (const line of sums) {
      expect(line, line).not.toMatch(/::int\b/)
    }
  })

  it('取值处经 toBigintNumber 收敛,不直接透传聚合值', () => {
    const block = detailRouteBlock()
    expect(block).toMatch(/totalInputTokens:\s*toBigintNumber\(/)
    expect(block).toMatch(/totalOutputTokens:\s*toBigintNumber\(/)
    expect(block).not.toMatch(/totalInputTokens:\s*billingStats\?\.totalInputTokens/)
  })
})

describe('F-703 归一:bigint 字符串 → number,缺失 → 0', () => {
  it('超 2^31 的字符串归一为 number 且数值不丢', () => {
    const out = toBigintNumber('3000000000')
    expect(typeof out).toBe('number')
    expect(out).toBe(3_000_000_000)
  })

  it('null / undefined / 空串 → 0(COALESCE 之外的兜底)', () => {
    expect(toBigintNumber(null)).toBe(0)
    expect(toBigintNumber(undefined)).toBe(0)
    expect(toBigintNumber('')).toBe(0)
  })

  it('已是 number 或 0 时原样保持', () => {
    expect(toBigintNumber(0)).toBe(0)
    expect(toBigintNumber(1_234)).toBe(1_234)
  })

  it('非数值垃圾值不产生 NaN,回落到 0', () => {
    expect(toBigintNumber('not-a-number')).toBe(0)
    expect(toBigintNumber(Number.NaN)).toBe(0)
  })
})
