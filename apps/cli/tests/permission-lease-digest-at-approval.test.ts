// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「批准那一刻的内容」是租约摘要维度的**真实数据源**(A 线收尾票)。
 *
 * 立因(现读,不是假想):`grantLeaseFromFlag()` 刻意不传 `digestDeclarations` ⇒ 真实运行里
 * `lease.slotDigests` 恒为 undefined,即"内容变了旧批准就失效"这半**从未生效过**;而判据本身
 * (`resolveLeaseRelaxationDetail` + 执行入口的消费)早在 HEAD 就有装车证明。缺的从来不是尺子,
 * 是喂进尺子的那份数据。本文件钉的就是那条数据链的四个断点:
 *  1. 时序 —— 租约先授予、批准后发生,`PermissionLease` 字段 readonly 且构造器判死叠授予,
 *     所以补摘要只能是"向已生效租约登记"这一个出口(`recordApprovedInvocation`);
 *  2. 死循环 —— 未绑定的能力本来就不问人(租约直接放宽),于是"第一次批准"根本不会发生。
 *     解开它的是授予时的 `digestTrackOnApproval` 档位,不是事后伪造一次批准;
 *  3. 身份同源 —— 摘要是 sha256(工作区身份 × 内容),两处各算一遍必漂;
 *  4. 失效方向 —— 启用后未提供调用内容一律不放宽(fail-closed),并有一条显式关闭出口。
 *
 * 判据未变动的部分也照判:三条构造判死(无到期即拒 / 通配即拒 / dangerous 不受影响)一条都没松。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  MAX_DIGESTS_PER_SLOT,
  PermissionLeaseError,
  grantPermissionLease,
  isLeaseDigestDimensionEnabled,
  recordApprovedInvocation,
  resetPermissionLeaseForTests,
  resolveLeaseRelaxation,
  resolveLeaseRelaxationDetail,
  revokePermissionLease,
  slotDigest,
  activePermissionLease,
  LEASE_DIGEST_SWITCH_ENV,
} from '../src/tools/permission-lease.js'
import { checkRulesWithLease } from '../src/tools/permissions.js'
import {
  grantDigestTrackedLeaseFromFlag,
  grantLeaseFromFlag,
  leaseWorkspaceIdOf,
} from '../src/utils/permission-lease-flag.js'

const WS = leaseWorkspaceIdOf('G:/IHUI-AI/apps/cli')
const TOOL = 'write_file'

/** 执行侧喂进判定的口径(`executeToolCall` 用 `JSON.stringify(call.arguments ?? null)`)。 */
const contentOf = (args: Record<string, unknown>): string => JSON.stringify(args ?? null)
const APPROVED = { path: 'src/a.ts', text: '原内容' }
const DRIFTED = { path: 'src/a.ts', text: '被改过的内容' }

function trackedLease() {
  return grantPermissionLease({
    scope: 'goal:digest-at-approval',
    capabilities: [TOOL],
    grantor: 'goal-mode',
    ttlMs: 10 * 60_000,
    maxCalls: 100,
    workspaceId: WS,
    digestTrackOnApproval: true,
  })
}

function detail(content: string | null, lease = activePermissionLease()) {
  return resolveLeaseRelaxationDetail(lease, TOOL, 'write', content)
}

beforeEach(() => {
  resetPermissionLeaseForTests()
  delete process.env[LEASE_DIGEST_SWITCH_ENV]
})
afterEach(() => {
  resetPermissionLeaseForTests()
  delete process.env[LEASE_DIGEST_SWITCH_ENV]
})

describe('时序:向已生效租约登记被批准的内容(唯一的显式出口)', () => {
  it('开了内容绑定档 ⇒ 未绑定的能力**不放宽**(第一次批准不会凭空发生)', () => {
    trackedLease()
    const d = detail(contentOf(APPROVED))
    expect(d).not.toBeNull()
    expect(d?.contentDrifted).toBe(true)
    // 消费面:不是"从未批准",而是单列的待再审态(旧批准不覆盖本次)
    const perm = checkRulesWithLease(TOOL, { ask: [TOOL] }, 'write', activePermissionLease(), contentOf(APPROVED))
    expect(perm.allowed).toBe(true)
    expect(perm.requiresApproval).toBe(true)
    expect(perm.approvalState).toBe('content-drifted')
  })

  it('批准 → 登记 → 同内容再调用 ⇒ 放宽,且不再问人', () => {
    trackedLease()
    const rec = recordApprovedInvocation({
      toolName: TOOL,
      invocationContent: contentOf(APPROVED),
      dangerLevel: 'write',
      workspaceId: WS,
    })
    expect(rec.recorded).toBe(true)
    expect(detail(contentOf(APPROVED))?.contentDrifted).toBe(false)
    const perm = checkRulesWithLease(TOOL, { ask: [TOOL] }, 'write', activePermissionLease(), contentOf(APPROVED))
    expect(perm.requiresApproval ?? false).toBe(false)
  })

  it('登记的是**内容本身**而非某个常量:换一份内容即判漂移', () => {
    trackedLease()
    recordApprovedInvocation({
      toolName: TOOL,
      invocationContent: contentOf(APPROVED),
      dangerLevel: 'write',
      workspaceId: WS,
    })
    // 若实现把"被批准内容"写死成常量,这两条不可能同时成立(它匹配不上真实原文)
    expect(detail(contentOf(APPROVED))?.contentDrifted).toBe(false)
    expect(detail(contentOf(DRIFTED))?.contentDrifted).toBe(true)
  })

  it('两次不同的批准都留下绑定(FIFO 上限内),各自同内容调用都放宽', () => {
    trackedLease()
    for (const args of [APPROVED, DRIFTED]) {
      expect(
        recordApprovedInvocation({
          toolName: TOOL,
          invocationContent: contentOf(args),
          dangerLevel: 'write',
          workspaceId: WS,
        }).recorded,
      ).toBe(true)
    }
    expect(detail(contentOf(APPROVED))?.contentDrifted).toBe(false)
    expect(detail(contentOf(DRIFTED))?.contentDrifted).toBe(false)
  })

  it('槽位有上限:超过 MAX_DIGESTS_PER_SLOT 即丢最旧一条(不是无界增长)', () => {
    trackedLease()
    for (let i = 0; i < MAX_DIGESTS_PER_SLOT + 1; i += 1) {
      recordApprovedInvocation({
        toolName: TOOL,
        invocationContent: contentOf({ n: i }),
        dangerLevel: 'write',
        workspaceId: WS,
      })
    }
    const slot = activePermissionLease()?.slotDigests?.[TOOL] ?? []
    expect(slot.length).toBe(MAX_DIGESTS_PER_SLOT)
    expect(detail(contentOf({ n: 0 }))?.contentDrifted).toBe(true)
    expect(detail(contentOf({ n: MAX_DIGESTS_PER_SLOT }))?.contentDrifted).toBe(false)
  })

  it('未开档位(既有租约形态)⇒ 登记被拒,默认档逐字不变', () => {
    grantPermissionLease({
      scope: 'cli-flag:legacy',
      capabilities: [TOOL],
      grantor: 'cli-flag',
      ttlMs: 60_000,
      maxCalls: 5,
    })
    const rec = recordApprovedInvocation({
      toolName: TOOL,
      invocationContent: contentOf(APPROVED),
      dangerLevel: 'write',
      workspaceId: WS,
    })
    // 既有 `--permission-lease` 出来的租约连身份都没有 ⇒ 摘要维度对它完全不存在
    expect(rec).toEqual({ recorded: false, reason: 'lease-has-no-workspace-identity' })
    // 旧语义:能力名匹配即放宽,没有任何内容治理
    expect(detail(contentOf(APPROVED))?.contentDrifted).toBe(false)
  })
})

describe('身份同源:摘要 key 的工作区身份只认构造时定死的那一份', () => {
  it('登记的摘要 = slotDigest(同一身份, 同一内容) ⇒ 授予侧与比对侧共用一份实现', () => {
    trackedLease()
    const rec = recordApprovedInvocation({
      toolName: TOOL,
      invocationContent: contentOf(APPROVED),
      dangerLevel: 'write',
      workspaceId: WS,
    })
    expect(rec.recorded === true && rec.digest).toBe(slotDigest(WS, contentOf(APPROVED)))
    // 换成另一套键(本仓并不存在 workspaceIdentity,若把这里改成 pid / cwd 冒充)⇒ 本条必红
    expect(rec.recorded === true && slotDigest('pid-1234', contentOf(APPROVED))).not.toBe(rec.digest)
  })

  it('身份不一致 ⇒ 拒绝登记、不重绑、槽位仍空(下一次照旧要批准)', () => {
    trackedLease()
    const rec = recordApprovedInvocation({
      toolName: TOOL,
      invocationContent: contentOf(APPROVED),
      dangerLevel: 'write',
      workspaceId: leaseWorkspaceIdOf('G:/别的目录'),
    })
    expect(rec).toEqual({ recorded: false, reason: 'workspace-identity-mismatch' })
    expect(activePermissionLease()?.slotDigests?.[TOOL] ?? []).toEqual([])
    expect(detail(contentOf(APPROVED))?.contentDrifted).toBe(true)
  })

  it('构造摘要绑定却不给身份 ⇒ 构造器判死(绝不"首次登记时补一份身份")', () => {
    expect(() =>
      grantPermissionLease({
        scope: 'goal:no-identity',
        capabilities: [TOOL],
        grantor: 'goal-mode',
        ttlMs: 60_000,
        maxCalls: 5,
        digestDeclarations: { [TOOL]: [contentOf(APPROVED)] },
      }),
    ).toThrow(PermissionLeaseError)
  })

  it('声明式绑定的槽位可被后续批准追加 —— 漂移后再授权那一步真的落账', () => {
    grantPermissionLease({
      scope: 'goal:declared-then-approved',
      capabilities: [TOOL],
      grantor: 'goal-mode',
      ttlMs: 60_000,
      maxCalls: 50,
      workspaceId: WS,
      digestDeclarations: { [TOOL]: [contentOf(APPROVED)] },
    })
    expect(detail(contentOf(APPROVED))?.contentDrifted).toBe(false)
    expect(detail(contentOf(DRIFTED))?.contentDrifted).toBe(true)
    const rec = recordApprovedInvocation({
      toolName: TOOL,
      invocationContent: contentOf(DRIFTED),
      dangerLevel: 'write',
      workspaceId: WS,
    })
    // 已绑定的名字不需要开绑定档也能追加(它本来就在摘要治理之下)
    expect(rec.recorded === true && rec.firstBinding).toBe(false)
    expect(detail(contentOf(DRIFTED))?.contentDrifted).toBe(false)
    expect(detail(contentOf(APPROVED))?.contentDrifted).toBe(false)
  })

  it('有身份、未开绑定档、该名字又没有绑定 ⇒ 拒绝(登记不给未纳管的名字凭空开槽)', () => {
    grantPermissionLease({
      scope: 'goal:other-tool-only',
      capabilities: [TOOL, 'other_tool'],
      grantor: 'goal-mode',
      ttlMs: 60_000,
      maxCalls: 50,
      workspaceId: WS,
      digestDeclarations: { other_tool: ['{}'] },
    })
    expect(
      recordApprovedInvocation({
        toolName: TOOL,
        invocationContent: contentOf(APPROVED),
        dangerLevel: 'write',
        workspaceId: WS,
      }),
    ).toEqual({ recorded: false, reason: 'unbound-slot-not-tracked' })
    expect(Object.keys(activePermissionLease()?.slotDigests ?? {})).toEqual(['other_tool'])
    expect(detail(contentOf(APPROVED))?.contentDrifted).toBe(false)
  })

  it('内容绑定档缺身份 ⇒ 构造器判死(不会造出一台"永远要批准"的死锁机器)', () => {
    expect(() =>
      grantPermissionLease({
        scope: 'goal:tracked-no-identity',
        capabilities: [TOOL],
        grantor: 'goal-mode',
        ttlMs: 60_000,
        maxCalls: 5,
        digestTrackOnApproval: true,
      }),
    ).toThrow(PermissionLeaseError)
  })
})

describe('三条构造判死与登记面的边界(一条都没松)', () => {
  it('dangerous 一律不登记 —— 危险确认从来不受租约影响', () => {
    trackedLease()
    expect(
      recordApprovedInvocation({
        toolName: TOOL,
        invocationContent: contentOf(APPROVED),
        dangerLevel: 'dangerous',
        workspaceId: WS,
      }),
    ).toEqual({ recorded: false, reason: 'dangerous-tool' })
  })

  it('不在能力清单里的名字 ⇒ 拒绝(登记不得静默扩大作用域)', () => {
    trackedLease()
    expect(
      recordApprovedInvocation({
        toolName: 'delete_everything',
        invocationContent: '{}',
        dangerLevel: 'write',
        workspaceId: WS,
      }),
    ).toEqual({ recorded: false, reason: 'tool-not-in-lease' })
    expect(activePermissionLease()?.slotDigests).toEqual({})
  })

  it('空内容 / 无生效租约 / 已撤销 ⇒ 各自拒绝', () => {
    trackedLease()
    expect(
      recordApprovedInvocation({ toolName: TOOL, invocationContent: '', dangerLevel: 'write', workspaceId: WS }),
    ).toEqual({ recorded: false, reason: 'empty-invocation-content' })
    expect(
      recordApprovedInvocation({ toolName: TOOL, invocationContent: null, dangerLevel: 'write', workspaceId: WS }),
    ).toEqual({ recorded: false, reason: 'empty-invocation-content' })
    revokePermissionLease('收尾')
    expect(
      recordApprovedInvocation({ toolName: TOOL, invocationContent: '{}', dangerLevel: 'write', workspaceId: WS }),
    ).toEqual({ recorded: false, reason: 'no-active-lease' })
  })
})

describe('失效方向:启用后未提供调用内容必须不放宽,并留一条显式关闭出口', () => {
  it('已绑定而调用内容缺失 ⇒ 不放宽(旧入口 resolveLeaseRelaxation 同判)', () => {
    trackedLease()
    recordApprovedInvocation({
      toolName: TOOL,
      invocationContent: contentOf(APPROVED),
      dangerLevel: 'write',
      workspaceId: WS,
    })
    expect(detail(null)?.contentDrifted).toBe(true)
    expect(resolveLeaseRelaxation(activePermissionLease(), TOOL, 'write')).toBeNull()
  })

  it('IHUI_LEASE_SLOT_DIGEST=0 ⇒ 摘要维度整体退场,回到"按工具名即放宽"的旧语义', () => {
    trackedLease()
    recordApprovedInvocation({
      toolName: TOOL,
      invocationContent: contentOf(APPROVED),
      dangerLevel: 'write',
      workspaceId: WS,
    })
    expect(isLeaseDigestDimensionEnabled()).toBe(true)
    process.env[LEASE_DIGEST_SWITCH_ENV] = '0'
    expect(isLeaseDigestDimensionEnabled()).toBe(false)
    // 判据侧:绑定仍在账上,但不再参与判定(fail-open 只在操作员点名时才成立)
    expect(detail(contentOf(DRIFTED))?.contentDrifted).toBe(false)
    // 登记侧:关闭期间不接受新绑定(否则"关了"只关了判据、没关数据写入)
    expect(
      recordApprovedInvocation({
        toolName: TOOL,
        invocationContent: contentOf(APPROVED),
        dangerLevel: 'write',
        workspaceId: WS,
      }),
    ).toEqual({ recorded: false, reason: 'digest-dimension-disabled' })
    delete process.env[LEASE_DIGEST_SWITCH_ENV]
    expect(detail(contentOf(DRIFTED))?.contentDrifted).toBe(true)
  })
})

describe('授予入口:内容绑定档是显式选择,不是默认', () => {
  it('既有 --permission-lease 入口照旧不带摘要维度(零行为变化)', () => {
    const out = grantLeaseFromFlag({ toolsRaw: TOOL, target: 'sess-1', ttlRaw: '5', nowMs: Date.now() })
    expect(out.kind).toBe('granted')
    if (out.kind !== 'granted') return
    expect(out.lease.slotDigests).toBeUndefined()
    expect(out.lease.workspaceId).toBeUndefined()
    expect(out.lease.digestTrackOnApproval).toBeUndefined()
  })

  it('新入口:身份定死 + 档位打开,解析仍共用同一份(ttl 封顶照旧生效)', () => {
    const out = grantDigestTrackedLeaseFromFlag({
      toolsRaw: TOOL,
      target: 'sess-2',
      ttlRaw: '99999',
      workspacePath: 'G:/IHUI-AI/apps/cli',
      nowMs: Date.now(),
    })
    expect(out.kind).toBe('granted')
    if (out.kind !== 'granted') return
    expect(out.ttlMinutes).toBe(60) // 封顶来自既有解析出口,不是新写一遍
    expect(out.lease.workspaceId).toBe(WS)
    expect(out.lease.digestTrackOnApproval).toBe(true)
    expect(out.lease.slotDigests).toEqual({})
  })

  it('新入口拿不到身份 ⇒ 失败关闭(invalid),不静默退回无摘要维度的旧档', () => {
    expect(grantDigestTrackedLeaseFromFlag({ toolsRaw: TOOL, target: 'sess-3', workspacePath: '  ' })).toEqual({
      kind: 'invalid',
      reason: 'digest-tracked lease requires a workspace identity (workspacePath resolved to empty)',
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
