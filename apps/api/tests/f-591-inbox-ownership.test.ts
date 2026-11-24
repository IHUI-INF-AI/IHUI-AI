// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-591 回归锁(2026-11-13)。
 *
 * 病灶:团队成员可把队友的收件箱条目(尤其 handoff 交接消息)标记为已读。
 * 服务层若只校验"调用者是本队 active human",未把写操作绑定到条目接收人,
 * 队友的未读会被批量隐藏,交接链断裂且留痕显示已读。
 *
 * 本夹具锁:
 *   ① 本人条目可置已读,更新条件携带本人接收人;
 *   ② 队友条目(含 handoff)一律 404 且数据层零更新;
 *   ③ 非本队成员一律 404 且零更新;
 *   ④ 条目不存在 404 且零更新;
 *   ⑤ 即使调用者是 lead,队友的 human 收件箱仍不可代管。
 *
 * 只 mock 仓库模块,不触达真实 PG。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  type Kind = 'human' | 'agent'
  type InboxRow = {
    id: string
    teamId: string
    fromMemberKind: Kind
    fromMemberId: string
    toMemberKind: Kind
    toMemberId: string
    kind: 'message' | 'system' | 'handoff'
    idempotencyKey: string
    payload: Record<string, unknown>
    readAt: Date | null
    createdAt: Date
  }

  const teamId = 'team-f591'
  const memberRows: Array<{
    teamId: string
    memberKind: Kind
    memberId: string
    role: 'lead' | 'member'
  }> = []
  const inboxRows: InboxRow[] = []
  /** 数据层真正被调用的更新(证明越权请求零写库) */
  const markCalls: Array<{
    id: string
    readAt: Date
    to?: { memberKind: Kind; memberId: string }
  }> = []

  const member = (memberKind: Kind, memberId: string, role: 'lead' | 'member') => ({
    id: `${memberKind}:${memberId}`,
    teamId,
    memberKind,
    memberId,
    role,
    joinedAt: new Date(),
    leftAt: null,
  })

  const repo = {
    async findTeamById(id: string) {
      return id === teamId
        ? {
            id: teamId,
            ownerId: 'user-a',
            name: 'F-591 Team',
            status: 'active',
            createdAt: new Date(),
            dissolvedAt: null,
          }
        : null
    },

    async findMember(id: string, ref: { memberKind: Kind; memberId: string }) {
      const row = memberRows.find(
        (m) => m.teamId === id && m.memberKind === ref.memberKind && m.memberId === ref.memberId,
      )
      return row ? member(row.memberKind, row.memberId, row.role) : null
    },

    async listMembers(id: string) {
      return memberRows
        .filter((m) => m.teamId === id)
        .map((m) => member(m.memberKind, m.memberId, m.role))
    },

    async findInboxById(id: string, entryId: string) {
      return inboxRows.find((e) => e.teamId === id && e.id === entryId) ?? null
    },

    async markInboxRead(
      id: string,
      entryId: string,
      readAt: Date,
      to?: { memberKind: Kind; memberId: string },
    ) {
      markCalls.push({ id: entryId, readAt, to })
      const entry = inboxRows.find((e) => e.teamId === id && e.id === entryId)
      if (!entry) return null
      if (to && (entry.toMemberKind !== to.memberKind || entry.toMemberId !== to.memberId)) {
        return null
      }
      entry.readAt = readAt
      return entry
    },
  }

  const seed = () => {
    memberRows.length = 0
    inboxRows.length = 0
    markCalls.length = 0
    memberRows.push(
      { teamId, memberKind: 'human', memberId: 'user-a', role: 'lead' },
      { teamId, memberKind: 'human', memberId: 'user-b', role: 'member' },
      { teamId, memberKind: 'agent', memberId: 'agent-c', role: 'member' },
    )
    const row = (
      id: string,
      toMemberId: string,
      kind: InboxRow['kind'],
      idempotencyKey: string,
    ): InboxRow => ({
      id,
      teamId,
      fromMemberKind: 'agent',
      fromMemberId: 'agent-c',
      toMemberKind: 'human',
      toMemberId,
      kind,
      idempotencyKey,
      payload: {},
      readAt: null,
      createdAt: new Date(),
    })
    inboxRows.push(
      row('entry-to-a', 'user-a', 'message', 'to-a'),
      row('entry-to-b', 'user-b', 'message', 'to-b'),
      row('handoff-to-a', 'user-a', 'handoff', 'handoff-a'),
    )
  }

  return { repo, inboxRows, markCalls, seed, teamId }
})

vi.mock('../src/db/agent-team-queries.js', () => ({
  postgresAgentTeamRepository: mocks.repo,
}))

import { createAgentTeamService } from '../src/services/agent-team-service.js'

const USER_A = 'user-a'
const USER_B = 'user-b'
const service = createAgentTeamService({ artifactRoot: 'f591-artifacts' })

beforeEach(() => {
  mocks.seed()
})

describe('F-591 收件箱标记已读归属校验', () => {
  it('① 本人条目可置已读,更新条件绑定本人接收人', async () => {
    const updated = await service.markInboxRead(USER_A, mocks.teamId, 'entry-to-a')

    expect(updated.readAt).toBeInstanceOf(Date)
    expect(mocks.markCalls).toHaveLength(1)
    expect(mocks.markCalls[0]).toMatchObject({
      id: 'entry-to-a',
      to: { memberKind: 'human', memberId: USER_A },
    })
    expect(mocks.inboxRows.find((e) => e.id === 'entry-to-a')?.readAt).toBeInstanceOf(Date)
  })

  it('② 队友条目(含 handoff)被拒 404 且零写库', async () => {
    for (const entryId of ['entry-to-a', 'handoff-to-a']) {
      await expect(service.markInboxRead(USER_B, mocks.teamId, entryId)).rejects.toMatchObject({
        statusCode: 404,
        code: 'INBOX_ENTRY_NOT_FOUND',
      })
    }

    expect(mocks.markCalls).toHaveLength(0)
    expect(mocks.inboxRows.every((e) => e.readAt === null)).toBe(true)
  })

  it('③ 非本队成员被拒 404 且零写库', async () => {
    await expect(service.markInboxRead('user-outsider', mocks.teamId, 'entry-to-a')).rejects
      .toMatchObject({ statusCode: 404 })

    expect(mocks.markCalls).toHaveLength(0)
    expect(mocks.inboxRows.every((e) => e.readAt === null)).toBe(true)
  })

  it('④ 条目不存在返回 404 且零写库', async () => {
    await expect(service.markInboxRead(USER_A, mocks.teamId, 'entry-missing')).rejects.toMatchObject(
      { statusCode: 404, code: 'INBOX_ENTRY_NOT_FOUND' },
    )

    expect(mocks.markCalls).toHaveLength(0)
  })

  it('⑤ lead 也不能代管队友的 human 收件箱', async () => {
    await expect(service.markInboxRead(USER_A, mocks.teamId, 'entry-to-b')).rejects.toMatchObject({
      statusCode: 404,
      code: 'INBOX_ENTRY_NOT_FOUND',
    })

    expect(mocks.markCalls).toHaveLength(0)
    expect(mocks.inboxRows.find((e) => e.id === 'entry-to-b')?.readAt).toBeNull()
  })
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
