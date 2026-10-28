// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * agent/team 记忆表到期治理的**判据与清单**测试(2026-10-03 数据出域合规整改)。
 *
 * 这 6 张表此前**完全没有**清理路径(不是"有机制没开",是机制根本不存在),
 * 而它们存的是用户画像 / 经验教训 / 会话摘要 / 多模态 caption。
 * 迁移 20261003180000 加了 expires_at,本文件钉死两件最容易悄悄坏掉的事:
 *   ① 过期判据:`expires_at IS NULL` 必须**不被**清(NULL = 用户显式选长期保留);
 *   ② 清理清单:6 张表一张不落、一张不多。
 *
 * 为什么不 mock db 链来测:
 *   早先版本试图 mock 整条 drizzle 查询链(先 select 取 id 批、再 delete),
 *   结果陷在 mock 保真度里出不来 —— drizzle 表对象取不到表名(JSON.stringify 因
 *   循环引用直接抛),且 `for(;;){select→空则break→delete}` 每表至少两次 select,
 *   按调用序消费时第二轮跳错表,表现为"清了 4 行而不是 6 行"。
 *   **而这类错恰恰是本组最危险的一类**:测试绿、线上删 0 行、监控显示已清理。
 *   所以把判据与清单提成导出的纯函数/常量(生产代码里它们本来就是这两样东西),
 *   直接测 —— 不经过 db,也就没有 mock 保真度问题。
 */

import { describe, expect, it, vi } from 'vitest'

// 本文件只导入纯函数/常量,但 data-archive-service 顶层会 import db,
// 故仍需 mock 掉 db 侧(不实现任何方法 —— 下面一个都不会被调用)。
vi.mock('../../db/index.js', () => ({
  db: {
    execute: vi.fn(),
    select: vi.fn(),
    delete: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}))
vi.mock('../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import {
  isAgentMemoryRowExpired,
  AGENT_MEMORY_TABLES,
  AGENT_MEMORY_PROFILE_LABEL,
} from '../data-archive-service.js'

const NOW = new Date('2026-10-03T12:00:00.000Z')
const daysBefore = (n: number) => new Date(NOW.getTime() - n * 86400_000)
const daysAfter = (n: number) => new Date(NOW.getTime() + n * 86400_000)

describe('isAgentMemoryRowExpired（过期判据）', () => {
  it('已过期的判为到期', () => {
    expect(isAgentMemoryRowExpired(daysBefore(1), NOW)).toBe(true)
    expect(isAgentMemoryRowExpired(daysBefore(365), NOW)).toBe(true)
  })

  it('未到期的判为未到期', () => {
    expect(isAgentMemoryRowExpired(daysAfter(1), NOW)).toBe(false)
    expect(isAgentMemoryRowExpired(daysAfter(365), NOW)).toBe(false)
  })

  it('边界：恰好到期（== now）判为到期（用 <= 不是 <）', () => {
    // 留这条是防止将来有人把 <= 改成 < —— 那样就"永远差一秒清不掉"，
    // 而这种错在每日一次的任务里几个月都看不出来。
    expect(isAgentMemoryRowExpired(NOW, NOW)).toBe(true)
  })

  it('边界：比 now 早 1ms 判到期，比晚 1ms 判未到期', () => {
    expect(isAgentMemoryRowExpired(new Date(NOW.getTime() - 1), NOW)).toBe(true)
    expect(isAgentMemoryRowExpired(new Date(NOW.getTime() + 1), NOW)).toBe(false)
  })

  it('NULL / undefined 判为「未到期」—— 语义是「用户显式选长期保留」', () => {
    // 本组最要紧的一条。若判据写成 expires_at <= NOW()（漏了 IS NOT NULL），
    // 用户明确选择长期保留的行会被清掉 —— 直接违背用户意愿。
    expect(isAgentMemoryRowExpired(null, NOW)).toBe(false)
    expect(isAgentMemoryRowExpired(undefined, NOW)).toBe(false)
  })

  it('接受 ISO 字符串（DB 里读出来就是这个形态）', () => {
    expect(isAgentMemoryRowExpired(daysBefore(1).toISOString(), NOW)).toBe(true)
    expect(isAgentMemoryRowExpired(daysAfter(1).toISOString(), NOW)).toBe(false)
  })

  it('无法解析的值判为「未到期」—— 不因脏数据误删用户记忆', () => {
    // 方向选择:解析不了就当"没到期"。反方向(当作到期)会让一条脏数据
    // 直接带走用户的一整条记忆,而我们连它为什么脏都不知道。
    expect(isAgentMemoryRowExpired('not-a-date', NOW)).toBe(false)
    expect(isAgentMemoryRowExpired('', NOW)).toBe(false)
  })
})

describe('AGENT_MEMORY_TABLES（清理清单）', () => {
  it('恰好 5 张走「按 id 批删」路', () => {
    expect(AGENT_MEMORY_TABLES).toHaveLength(5)
  })

  it('加上 user_profile 那张 = 6 张，一张不落', () => {
    // 迁移 20261003180000 加 expires_at 的正是这 6 张。清单少一张 ⇒
    // 那张表静默永不过期,而这正是本票要消除的东西。
    const labels = AGENT_MEMORY_TABLES.map((t) => t.label).concat(AGENT_MEMORY_PROFILE_LABEL)
    expect(labels).toHaveLength(6)
    for (const expected of [
      'agent_multimodal_memory(90d)',
      'agent_session_summary(180d)',
      'agent_meta_lessons(180d)',
      'team_memories(365d)',
      'agent_federated_lessons(365d)',
      'agent_user_profile(180d)',
    ]) {
      expect(labels).toContain(expected)
    }
  })

  it('user_profile 单独标注（主键是 user_id 而非 id，不走 id 批删路）', () => {
    // 把它硬塞进 id 批删那张表会得到「永远删 0 行」的假绿。
    expect(AGENT_MEMORY_PROFILE_LABEL).toBe('agent_user_profile(180d)')
    expect(AGENT_MEMORY_TABLES.map((t) => t.label)).not.toContain(AGENT_MEMORY_PROFILE_LABEL)
  })

  it('档位按内容敏感度分三档，不是一刀切', () => {
    const days = AGENT_MEMORY_TABLES.map((t) => t.retentionDays)
    // 多模态最短（caption/source_uri 可能带本地文件路径，最敏感）
    expect(AGENT_MEMORY_TABLES.find((t) => t.label.startsWith('agent_multimodal'))?.retentionDays).toBe(90)
    // 团队资产 / 联邦经验最长
    expect(AGENT_MEMORY_TABLES.find((t) => t.label.startsWith('team_memories'))?.retentionDays).toBe(365)
    expect(AGENT_MEMORY_TABLES.find((t) => t.label.startsWith('agent_federated'))?.retentionDays).toBe(365)
    // 对话提炼物居中
    expect(AGENT_MEMORY_TABLES.find((t) => t.label.startsWith('agent_session'))?.retentionDays).toBe(180)
    expect(new Set(days).size).toBe(3)
  })

  it('每张表都带 label 与 retentionDays（日志与排障要读）', () => {
    for (const t of AGENT_MEMORY_TABLES) {
      expect(typeof t.label).toBe('string')
      expect(t.label.length).toBeGreaterThan(0)
      expect(Number.isFinite(t.retentionDays)).toBe(true)
      expect(t.retentionDays).toBeGreaterThan(0)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
