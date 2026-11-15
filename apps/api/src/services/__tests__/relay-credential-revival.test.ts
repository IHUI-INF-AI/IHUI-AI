// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「凭证版本驱动复活」单源判据锁(2026-11-15 立)。
 *
 * 每条含「同形正例 + 反向牙 + 合法改动仍绿」:
 *  - 判死后 credVersion 前进 ⇒ 放行解摘(新票已进池);
 *  - 反向牙:版本没变 / 倒退 / 留痕缺失 / 留痕坏 ⇒ 一律不放行
 *    (否则会退回「每 6h 拿死票空撞上游」的无限循环,那正是判死闸门要防的);
 *  - 合法改动:留痕 id / at 换成任意值、extra_metadata 加别的键 ⇒ 判据不变;
 *  - 即时复活补丁:客户端票过期不复活、健康行不折腾、异常行复位到 unknown。
 *
 * 纯函数测试,零 DB / 零 Redis / 零凭据。判据全部 import 生产端,测试内零复制(§22c)。
 */
import { describe, it, expect } from 'vitest'
import {
  TERMINAL_VERDICT_KEY,
  healthRevivalPatchOf,
  hasFreshCredentials,
  shouldReviveTerminal,
  stripTerminalVerdict,
  terminalVerdictOf,
  terminalVerdictSnapshotOf,
} from '../relay-credential-revival.js'

const SNAP = { id: 'codearts-sts5.1806', credVersion: 17, at: '2026-11-15T01:15:01.434Z' }
const rowOf = (credVersion: unknown, extra: unknown = { [TERMINAL_VERDICT_KEY]: SNAP }) => ({
  credVersion,
  extraMetadata: extra,
})

describe('terminalVerdictOf / terminalVerdictSnapshotOf', () => {
  it('同形正例:正常留痕逐字段解析', () => {
    expect(terminalVerdictOf(rowOf(20))).toEqual(SNAP)
  })

  it('反向牙:缺 id / 版本非有限数 / extra 为 null 或数组 / 无留痕键 ⇒ 未判定', () => {
    expect(
      terminalVerdictOf(rowOf(20, { [TERMINAL_VERDICT_KEY]: { credVersion: 17, at: SNAP.at } })),
    ).toBeNull()
    expect(
      terminalVerdictOf(
        rowOf(20, {
          [TERMINAL_VERDICT_KEY]: { id: 'x', credVersion: 'not-a-number', at: SNAP.at },
        }),
      ),
    ).toBeNull()
    expect(terminalVerdictOf({ credVersion: 20, extraMetadata: null })).toBeNull()
    expect(terminalVerdictOf({ credVersion: 20, extraMetadata: [] })).toBeNull()
    expect(
      terminalVerdictOf({ credVersion: 20, extraMetadata: { keepAliveForever: true } }),
    ).toBeNull()
    expect(terminalVerdictOf(null)).toBeNull()
  })

  it('合法改动仍绿:留痕 id / at 换值、extra 加别的键、版本写成数字字符串', () => {
    expect(
      terminalVerdictOf(
        rowOf(20, {
          [TERMINAL_VERDICT_KEY]: {
            id: 'trae-refresh-invalid',
            credVersion: '17',
            at: '2026-01-01T00:00:00.000Z',
          },
          keepAliveForever: true,
          checkinSync: { state: null },
        }),
      ),
    ).toEqual({ id: 'trae-refresh-invalid', credVersion: 17, at: '2026-01-01T00:00:00.000Z' })
  })

  it('快照构造:verdictId 空 / credVersion 取不到 ⇒ null,绝不写假证据', () => {
    expect(terminalVerdictSnapshotOf({ credVersion: 17 }, 'codearts-sts5.1806')).toMatchObject({
      id: 'codearts-sts5.1806',
      credVersion: 17,
    })
    expect(terminalVerdictSnapshotOf({ credVersion: 17 }, null)).toBeNull()
    expect(terminalVerdictSnapshotOf({ credVersion: 17 }, '')).toBeNull()
    expect(terminalVerdictSnapshotOf({}, 'codearts-sts5.1806')).toBeNull()
  })
})

describe('hasFreshCredentials / shouldReviveTerminal', () => {
  it('同形正例:判死后写票令 credVersion 前进 ⇒ 有新证据,放行', () => {
    expect(hasFreshCredentials(rowOf(18))).toBe(true)
    expect(shouldReviveTerminal(rowOf(18))).toBe(true)
  })

  it('反向牙:版本没变 / 倒退 / 留痕缺失 / 留痕坏 / 版本取不到 ⇒ 一律不放行', () => {
    expect(shouldReviveTerminal(rowOf(17))).toBe(false)
    expect(shouldReviveTerminal(rowOf(16))).toBe(false)
    expect(shouldReviveTerminal(rowOf(18, { keepAliveForever: true }))).toBe(false)
    expect(shouldReviveTerminal(rowOf(18, { [TERMINAL_VERDICT_KEY]: { id: 'x' } }))).toBe(false)
    expect(shouldReviveTerminal({ extraMetadata: { [TERMINAL_VERDICT_KEY]: SNAP } })).toBe(false)
    expect(shouldReviveTerminal(null)).toBe(false)
  })

  it('合法改动仍绿:版本大幅前进、字符串版本、留痕 id 任意 ⇒ 结论不变', () => {
    expect(shouldReviveTerminal(rowOf(99))).toBe(true)
    expect(shouldReviveTerminal(rowOf('18'))).toBe(true)
    expect(
      shouldReviveTerminal(
        rowOf(19, {
          [TERMINAL_VERDICT_KEY]: { ...SNAP, id: 'any-other-verdict' },
          keepAliveForever: true,
        }),
      ),
    ).toBe(true)
  })
})

describe('stripTerminalVerdict', () => {
  it('只摘留痕键,其余键逐字保留,不改入参', () => {
    const extra = {
      [TERMINAL_VERDICT_KEY]: SNAP,
      keepAliveForever: true,
      sessionTemplate: { a: 1 },
    }
    const out = stripTerminalVerdict(extra)
    expect(out).toEqual({ keepAliveForever: true, sessionTemplate: { a: 1 } })
    expect(extra[TERMINAL_VERDICT_KEY]).toEqual(SNAP)
  })

  it('反向牙:extra 为 null / 数组 / 无留痕 ⇒ 返回等价对象,不凭空造键', () => {
    expect(stripTerminalVerdict(null)).toEqual({})
    expect(stripTerminalVerdict([])).toEqual({})
    expect(stripTerminalVerdict({ keepAliveForever: true })).toEqual({ keepAliveForever: true })
  })
})

describe('healthRevivalPatchOf', () => {
  const now = new Date('2026-11-15T03:00:00.000Z')

  it('同形正例:down / 已摘除 / 有失败计数的行 + 有效客户端票 ⇒ 复位到 unknown', () => {
    const patch = {
      healthStatus: 'unknown',
      refreshFailureCount: 0,
      lastErrorMessage: null,
      tempUnschedulable: false,
    }
    expect(
      healthRevivalPatchOf(
        { healthStatus: 'down', refreshFailureCount: 3, tempUnschedulable: true },
        { clientExpiresAt: new Date('2026-12-01T00:00:00.000Z'), now },
      ),
    ).toEqual(patch)
    expect(
      healthRevivalPatchOf({ healthStatus: 'unknown', refreshFailureCount: 0 }, { now }),
    ).toEqual(patch)
    expect(
      healthRevivalPatchOf({ healthStatus: 'healthy', refreshFailureCount: 2 }, { now }),
    ).toEqual(patch)
    expect(
      healthRevivalPatchOf({ healthStatus: 'healthy', tempUnschedulable: true }, { now }),
    ).toEqual(patch)
  })

  it('反向牙:客户端票已过期 / 到期时刻非法 / 健康行 / 空行 ⇒ null', () => {
    const broken = { healthStatus: 'down', refreshFailureCount: 3, tempUnschedulable: true }
    expect(
      healthRevivalPatchOf(broken, { clientExpiresAt: new Date('2026-11-14T00:00:00.000Z'), now }),
    ).toBeNull()
    expect(
      healthRevivalPatchOf(broken, { clientExpiresAt: new Date('invalid') as Date, now }),
    ).toBeNull()
    expect(
      healthRevivalPatchOf({ healthStatus: 'healthy', refreshFailureCount: 0 }, { now }),
    ).toBeNull()
    expect(healthRevivalPatchOf(null, { now })).toBeNull()
  })

  it('合法改动仍绿:不给 clientExpiresAt 时按「调用方已确认写入新票」处理,异常行仍复位', () => {
    expect(
      healthRevivalPatchOf({ healthStatus: 'degraded', refreshFailureCount: 0 }, { now }),
    ).toEqual({
      healthStatus: 'unknown',
      refreshFailureCount: 0,
      lastErrorMessage: null,
      tempUnschedulable: false,
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
