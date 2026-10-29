// @vitest-environment happy-dom
/**
 * 回退检查点的**时间单位**契约测试(2026-10-30 立)。
 *
 * §22c 纪律:判据一律 import 源脚本出口,本文件不复制折算逻辑。
 * 存在的理由:服务端 payload 里 `created_at` 是 epoch 秒,web 侧消息时刻是 epoch 毫秒,
 * 二者从前直接比 ⇒「恢复到本轮之前」恒选中最新一枚(= 未来的状态)。这个失效形态
 * 安静、不报错、UI 照渲染,只有把单位钉进断言才拦得住下一次改严。
 */
import { describe, expect, it } from 'vitest'

import {
  epochSecondsToMs,
  normalizeCheckpointList,
  type CheckpointListResult,
  type CheckpointMeta,
} from '@/api/checkpoint-api'
import { pickRevertCheckpoint } from '@/components/ai/checkpoint-impact'

const META = (id: string, createdAtSeconds: number): CheckpointMeta => ({
  checkpoint_id: id,
  session_id: 's1',
  iteration: 1,
  status: 'completed',
  created_at: createdAtSeconds,
  expires_at: createdAtSeconds + 86400,
  message_count: 3,
})

const LIST = (metas: CheckpointMeta[]): CheckpointListResult => ({
  session_id: 's1',
  total: metas.length,
  checkpoints: metas,
})

// 一条消息的创建时刻:毫秒口径(与 chat store 的 Date.now() 同基准)
const MSG_CREATED_AT_MS = 1_762_000_000_000
// 服务端会回吐的两种形态:这枚早于消息(应命中)、这枚晚于消息(应被过滤)
const EARLIER_SECONDS = Math.floor(MSG_CREATED_AT_MS / 1000) - 60
const LATER_SECONDS = Math.floor(MSG_CREATED_AT_MS / 1000) + 60

describe('checkpoint 时间单位契约', () => {
  it('epochSecondsToMs:秒折毫秒', () => {
    expect(epochSecondsToMs(1_762_000_000)).toBe(1_762_000_000_000)
  })

  it('非有限值不得被折成 0(判不出必须继续是判不出)', () => {
    expect(Number.isFinite(epochSecondsToMs(Number.NaN))).toBe(false)
    expect(Number.isFinite(epochSecondsToMs(Infinity))).toBe(false)
  })

  it('列表出口把 created_at/expires_at 折成毫秒,其余字段逐字不动', () => {
    const out = normalizeCheckpointList(LIST([META('a', EARLIER_SECONDS)]))
    const c = out.checkpoints[0]!
    expect(c.created_at).toBe(EARLIER_SECONDS * 1000)
    expect(c.expires_at).toBe((EARLIER_SECONDS + 86400) * 1000)
    expect(c.checkpoint_id).toBe('a')
    expect(c.message_count).toBe(3)
  })

  it('正向对照:早于消息的检查点仍被选中', () => {
    const metas = normalizeCheckpointList(LIST([META('old', EARLIER_SECONDS)])).checkpoints
    expect(pickRevertCheckpoint(metas, MSG_CREATED_AT_MS)?.checkpoint_id).toBe('old')
  })

  it('主断言:晚于消息的检查点必须被过滤掉,不得退化成「取最新一枚」', () => {
    const metas = normalizeCheckpointList(
      LIST([META('old', EARLIER_SECONDS), META('future', LATER_SECONDS)]),
    ).checkpoints
    // 若单位没折,秒(1.76e9)恒 < 毫秒(1.76e12)⇒ future 那枚也会通过过滤并被当成"更新"
    expect(pickRevertCheckpoint(metas, MSG_CREATED_AT_MS)?.checkpoint_id).toBe('old')
  })

  it('反向锁:摘掉折算 ⇒ 选择器就会挑到未来的那枚(证明本档测的是真缺口)', () => {
    const raw = LIST([META('old', EARLIER_SECONDS), META('future', LATER_SECONDS)]).checkpoints
    expect(pickRevertCheckpoint(raw, MSG_CREATED_AT_MS)?.checkpoint_id).toBe('future')
  })

  it('checkpoints 缺失(服务端给了空响应)不得抛,原样回吐空集', () => {
    const out = normalizeCheckpointList({
      session_id: 's1',
      total: 0,
    } as unknown as CheckpointListResult)
    expect(out.checkpoints).toEqual([])
  })
})
