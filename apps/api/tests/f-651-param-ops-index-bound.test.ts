// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-651 回归锁(2026-11-13)。
 *
 * 病灶:param-ops 的 setPath 对数组下标无上界,`while (container.length <= idx) push(null)`,
 * 一条 `{op:'set', path:'messages.999999999'}` 配置即可让每个命中请求 OOM。
 * 修复落在本模块(relay-param-ops-config.ts):入库校验 + 运行时过滤双闸,
 * 运行时所在的 relay-param-ops.ts 归他席,故防线放在调用它的本模块入口。
 *
 * 本文件锁:
 *   ①~⑥ isUnsafeParamOpPath 纯函数边界(超限下标/超段数拒绝,合法/边界值放行);
 *   ⑦~⑨ validateRuleOps 入库闸:恶意配置被拒、正常配置放行、op 数超限被拒;
 *   ⑩ 运行时:DB 里含超限下标的规则也不撑爆数组(用 5000 这种量级安全复刻),
 *      同规则里的正常 op 仍生效;
 *   ⑪ 源码锁:applyParamOpsToBody 与 dryRunParamOpRule 都经过过滤。
 *
 * 不连库:dbRead.select 链用内存 rows 替身。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi } from 'vitest'

const h = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }))

vi.mock('../src/db/index.js', () => {
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => Promise.resolve(h.rows),
    limit: () => Promise.resolve(h.rows),
  }
  return {
    db: { select: vi.fn(() => chain), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
    dbRead: { select: vi.fn(() => chain) },
    dbClient: {},
  }
})
vi.mock('../src/utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import {
  isUnsafeParamOpPath,
  validateRuleOps,
  applyParamOpsToBody,
} from '../src/services/relay-param-ops-config.js'

describe('F-651 param-ops 数组下标无上界', () => {
  it('① 超大下标 ⇒ 判不安全', () => {
    expect(isUnsafeParamOpPath('messages.999999999')).toBe(true)
  })
  it('② 下标 1000(边界内)⇒ 放行', () => {
    expect(isUnsafeParamOpPath('messages.1000')).toBe(false)
  })
  it('③ 下标 1001 ⇒ 判不安全', () => {
    expect(isUnsafeParamOpPath('messages.1001')).toBe(true)
  })
  it('④ 段数超过 32 ⇒ 判不安全', () => {
    expect(isUnsafeParamOpPath(Array.from({ length: 33 }, () => 'a').join('.'))).toBe(true)
  })
  it('⑤ 正常路径 / 前导零下标 ⇒ 放行', () => {
    expect(isUnsafeParamOpPath('messages.0.content')).toBe(false)
    expect(isUnsafeParamOpPath('data.0000000009')).toBe(false)
    expect(isUnsafeParamOpPath('temperature')).toBe(false)
  })
  it('⑥ 非字符串输入(校验层脏数据)⇒ 不误报', () => {
    expect(isUnsafeParamOpPath(undefined)).toBe(false)
    expect(isUnsafeParamOpPath(null)).toBe(false)
    expect(isUnsafeParamOpPath(42)).toBe(false)
  })

  it('⑦ validateRuleOps:含超大下标的配置 ⇒ 判不合法并点名 F-651', () => {
    const r = validateRuleOps([{ op: 'set', path: 'messages.999999999', value: 'x' }])
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.includes('F-651'))).toBe(true)
  })
  it('⑧ validateRuleOps:正常配置 ⇒ 放行(不削正常功能)', () => {
    const r = validateRuleOps([{ op: 'set', path: 'messages.0.content', value: 'x' }])
    expect(r.valid).toBe(true)
  })
  it('⑨ validateRuleOps:op 数超上限 ⇒ 判不合法', () => {
    const ops = Array.from({ length: 65 }, (_, i) => ({ op: 'set', path: `f${i}`, value: i }))
    expect(validateRuleOps(ops).valid).toBe(false)
  })

  it('⑩ 运行时:DB 规则含超限下标也不撑爆数组,同规则正常 op 仍生效', async () => {
    const rule = {
      name: 'malicious',
      enabled: true,
      priority: 1,
      matchConditions: { global: true },
      ops: [
        { op: 'set', path: 'messages.5000', value: 'x' },
        { op: 'set', path: 'temperature', value: 0.5 },
      ],
    }
    h.rows = [
      {
        key: 'relay_param_ops:1',
        value: JSON.stringify(rule),
        createdAt: new Date(),
        updatedAt: null,
      },
    ]
    const body = { model: 'm', messages: [] as unknown[] }
    const out = await applyParamOpsToBody(body as never, { model: 'm' })
    // 恶意 op 被过滤 ⇒ messages 数组没有被 setPath 补位撑到 5001
    expect((out.body as { messages?: unknown[] }).messages).toHaveLength(0)
    // 正常 op 仍生效 ⇒ 过滤没有一刀切掉整条规则
    expect(out.modified).toBe(true)
  })

  it('⑪ 源码锁:两个运行时入口都先过滤再调 applyParamOps', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../src/services/relay-param-ops-config.ts', import.meta.url)),
      'utf8',
    )
    expect(src).toContain('isUnsafeParamOpPath')
    expect(src).toContain('const safeOps = ops.filter((op) => !isUnsafeParamOpPath(op?.path))')
    expect(src).toContain('applyParamOps(body, safeOps, context)')
    expect(src).toContain('applyParamOps(sampleBody, safeOps, ctx)')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
