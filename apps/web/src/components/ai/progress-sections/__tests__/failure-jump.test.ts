// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 深化W/Y(2026-11-17):失败分布徽章点击定位的目标决策纯函数测试。
// 钉住:① 只取 failed/dead 终态;② 按 failureKind / failureSource 正交筛选;
//       ③ 返回"展示列表最靠前"的首个匹配;④ 无匹配返回 null;⑤ 运行中/完成被跳过。

import { describe, expect, it } from 'vitest'
import type { Subagent } from '@/hooks/use-agent-progress'
import {
  resolveJumpTargetId,
  resolveJumpTargetIdByKind,
  resolveJumpTargetIdBySource,
} from '../failure-jump'

function makeSa(overrides: Partial<Subagent> & { id: string }): Subagent {
  return {
    threadId: overrides.id,
    nickname: overrides.id,
    handle: `@${overrides.id}`,
    color: 'cyan',
    status: 'done',
    spawnedAt: '2026-11-17T00:00:00Z',
    ...overrides,
  } as Subagent
}

describe('resolveJumpTargetIdByKind 深化W:按失败模式定位', () => {
  it('只取 failed/dead,运行中/完成即使 kind 匹配也跳过', () => {
    const list = [
      makeSa({ id: 'run', status: 'running', failureKind: 'rate_limited' }),
      makeSa({ id: 'done', status: 'done', failureKind: 'rate_limited' }),
      makeSa({ id: 'fail', status: 'failed', failureKind: 'rate_limited' }),
    ]
    expect(resolveJumpTargetIdByKind(list, 'rate_limited')).toBe('fail')
  })

  it('failed 与 dead 都算终态失败', () => {
    const list = [makeSa({ id: 'dead', status: 'dead', failureKind: 'transient' })]
    expect(resolveJumpTargetIdByKind(list, 'transient')).toBe('dead')
  })

  it('无该类失败返回 null', () => {
    const list = [makeSa({ id: 'fail', status: 'failed', failureKind: 'rate_limited' })]
    expect(resolveJumpTargetIdByKind(list, 'credentials_rejected')).toBeNull()
  })

  it('多个同类失败返回展示列表最靠前的一个', () => {
    const list = [
      makeSa({ id: 'first', status: 'failed', failureKind: 'rate_limited' }),
      makeSa({ id: 'second', status: 'failed', failureKind: 'rate_limited' }),
    ]
    expect(resolveJumpTargetIdByKind(list, 'rate_limited')).toBe('first')
  })
})

describe('resolveJumpTargetIdBySource 深化Y:按失败来源定位', () => {
  it('按 failureSource 筛选,与 failureKind 正交', () => {
    const list = [
      makeSa({ id: 'a', status: 'failed', failureSource: 'provider', failureKind: 'rate_limited' }),
      makeSa({ id: 'b', status: 'failed', failureSource: 'network', failureKind: 'transient' }),
    ]
    expect(resolveJumpTargetIdBySource(list, 'provider')).toBe('a')
    expect(resolveJumpTargetIdBySource(list, 'network')).toBe('b')
  })

  it('failureSource 为空串/缺席不匹配任何已知来源', () => {
    const list = [makeSa({ id: 'x', status: 'failed' })]
    expect(resolveJumpTargetIdBySource(list, 'provider')).toBeNull()
  })

  it('来源匹配但非终态则跳过', () => {
    const list = [makeSa({ id: 'run', status: 'running', failureSource: 'tool' })]
    expect(resolveJumpTargetIdBySource(list, 'tool')).toBeNull()
  })
})

describe('resolveJumpTargetId 通用谓词版', () => {
  it('接受任意谓词,复用终态过滤', () => {
    const list = [makeSa({ id: 'run', status: 'running' }), makeSa({ id: 'f1', status: 'failed' })]
    expect(resolveJumpTargetId(list, () => true)).toBe('f1')
    expect(resolveJumpTargetId(list, () => false)).toBeNull()
  })

  it('空列表返回 null', () => {
    expect(resolveJumpTargetId([], () => true)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
