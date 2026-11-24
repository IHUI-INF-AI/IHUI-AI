// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-350(P2):Agent 团队收件箱未绑定 actor。
 *
 * 旧行为(HEAD 版本)下:
 *  ① 任意成员可在请求体里把 fromMember 填成他人,落库即冒名;
 *  ② 任意成员可读他人的 human 收件箱;
 *  ③ 任意成员可把他人收件箱条目标记已读;
 *  ④ 任意成员可向任意 human 成员投递。
 *
 * 本夹具用 Fastify inject + 内存数据层,只验"身份由 request.userId 推导"这一层:
 *  ① B 传 fromMember=A 发消息 → 落库 fromMember 是 B;
 *  ② B 读 A 的收件箱 → 空;读自己的 → 有;
 *  ③ B 标记 A 的条目已读 → 404 且零更新(数据层 markInboxRead 未被调用);
 *  ④ B 给自己发消息 → 200,并能标记自己已读;
 *  ⑤ B 向 A 的人类收件箱投递 → 403 INBOX_RECIPIENT_NOT_SELF 且零落库;
 *  ⑥ A 读/标记自己 → 200(正向对照,防"整片写死"骗过 ②③)。
 */

import { afterAll, beforeEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { FastifyRequest } from 'fastify'
import Fastify from 'fastify'

const mocks = vi.hoisted(() => {
  type TeamRow = {
    id: string
    ownerId: string
    name: string
    status: 'active' | 'dissolved'
    createdAt: Date
    dissolvedAt: Date | null
  }
  type MemberRow = {
    id: string
    teamId: string
    memberKind: 'human' | 'agent'
    memberId: string
    role: 'lead' | 'member'
    joinedAt: Date
    leftAt: Date | null
  }
  type InboxRow = {
    id: string
    teamId: string
    fromMemberKind: 'human' | 'agent'
    fromMemberId: string
    toMemberKind: 'human' | 'agent'
    toMemberId: string
    kind: 'message' | 'system' | 'handoff'
    idempotencyKey: string
    payload: Record<string, unknown>
    readAt: Date | null
    createdAt: Date
  }

  let seq = 0
  /** 固定形态的 v4 UUID,避免夹具依赖宿主 crypto;每次 reset 后重新计数 */
  const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`

  const teams = new Map<string, TeamRow>()
  const members: MemberRow[] = []
  const inbox: InboxRow[] = []
  /** 数据层真正被执行 read 更新的条目 id;用于证明"他人的条目零更新" */
  const markReadCalls: string[] = []

  const repo = {
    async createTeamWithLead(input: { ownerId: string; name: string }) {
      const team: TeamRow = {
        id: uuid(),
        ownerId: input.ownerId,
        name: input.name,
        status: 'active',
        createdAt: new Date(),
        dissolvedAt: null,
      }
      teams.set(team.id, team)
      const lead: MemberRow = {
        id: uuid(),
        teamId: team.id,
        memberKind: 'human',
        memberId: input.ownerId,
        role: 'lead',
        joinedAt: new Date(),
        leftAt: null,
      }
      members.push(lead)
      return { team, lead }
    },

    async findTeamById(teamId: string) {
      return teams.get(teamId) ?? null
    },

    async findMember(
      teamId: string,
      ref: { memberKind: 'human' | 'agent'; memberId: string },
      options?: { activeOnly?: boolean },
    ) {
      return (
        members.find(
          (m) =>
            m.teamId === teamId &&
            m.memberKind === ref.memberKind &&
            m.memberId === ref.memberId &&
            (!(options?.activeOnly ?? true) || m.leftAt === null),
        ) ?? null
      )
    },

    async listMembers(teamId: string) {
      return members.filter((m) => m.teamId === teamId && m.leftAt === null)
    },

    async insertMember(input: {
      teamId: string
      memberKind: 'human' | 'agent'
      memberId: string
      role: 'lead' | 'member'
    }) {
      const row: MemberRow = {
        id: uuid(),
        teamId: input.teamId,
        memberKind: input.memberKind,
        memberId: input.memberId,
        role: input.role,
        joinedAt: new Date(),
        leftAt: null,
      }
      members.push(row)
      return row
    },

    async insertInbox(input: {
      teamId: string
      fromMemberKind: 'human' | 'agent'
      fromMemberId: string
      toMemberKind: 'human' | 'agent'
      toMemberId: string
      kind: 'message' | 'system' | 'handoff'
      idempotencyKey: string
      payload: Record<string, unknown>
    }) {
      const existing = inbox.find(
        (e) => e.teamId === input.teamId && e.idempotencyKey === input.idempotencyKey,
      )
      if (existing) return { entry: existing, duplicated: true }
      const entry: InboxRow = {
        id: uuid(),
        teamId: input.teamId,
        fromMemberKind: input.fromMemberKind,
        fromMemberId: input.fromMemberId,
        toMemberKind: input.toMemberKind,
        toMemberId: input.toMemberId,
        kind: input.kind,
        idempotencyKey: input.idempotencyKey,
        payload: input.payload,
        readAt: null,
        createdAt: new Date(),
      }
      inbox.push(entry)
      return { entry, duplicated: false }
    },

    async listInbox(
      teamId: string,
      to?: { memberKind: 'human' | 'agent'; memberId: string },
    ) {
      return inbox.filter(
        (e) =>
          e.teamId === teamId &&
          (!to || (e.toMemberKind === to.memberKind && e.toMemberId === to.memberId)),
      )
    },

    async findInboxById(teamId: string, id: string) {
      return inbox.find((e) => e.teamId === teamId && e.id === id) ?? null
    },

    async markInboxRead(teamId: string, id: string, readAt: Date) {
      markReadCalls.push(id)
      const entry = inbox.find((e) => e.teamId === teamId && e.id === id)
      if (!entry) return null
      entry.readAt = readAt
      return entry
    },
  }

  const reset = () => {
    teams.clear()
    members.length = 0
    inbox.length = 0
    markReadCalls.length = 0
    seq = 0
  }

  return { repo, inbox, markReadCalls, reset, authenticate: vi.fn() }
})

vi.mock('../src/db/agent-team-queries.js', () => ({
  postgresAgentTeamRepository: mocks.repo,
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mocks.authenticate,
  default: vi.fn(),
}))

import { agentTeamRoutes } from '../src/routes/agent-team.js'

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb'
const AGENT_C = 'agent-c'

const server = Fastify({ logger: false })

let currentActor = ''
let teamId = ''
let seedToAId = ''
let seedToBId = ''

async function seedTeam() {
  const { team } = await mocks.repo.createTeamWithLead({ ownerId: USER_A, name: 'F-350 Team' })
  teamId = team.id
  await mocks.repo.insertMember({
    teamId,
    memberKind: 'human',
    memberId: USER_B,
    role: 'member',
  })
  await mocks.repo.insertMember({
    teamId,
    memberKind: 'agent',
    memberId: AGENT_C,
    role: 'member',
  })
  const toA = await mocks.repo.insertInbox({
    teamId,
    fromMemberKind: 'agent',
    fromMemberId: AGENT_C,
    toMemberKind: 'human',
    toMemberId: USER_A,
    kind: 'message',
    idempotencyKey: 'seed-to-a',
    payload: { text: 'A 的私信' },
  })
  const toB = await mocks.repo.insertInbox({
    teamId,
    fromMemberKind: 'agent',
    fromMemberId: AGENT_C,
    toMemberKind: 'human',
    toMemberId: USER_B,
    kind: 'message',
    idempotencyKey: 'seed-to-b',
    payload: { text: 'B 的私信' },
  })
  seedToAId = toA.entry.id
  seedToBId = toB.entry.id
}

beforeAll(async () => {
  await server.register(agentTeamRoutes)
  await server.ready()
})

afterAll(async () => {
  await server.close()
})

beforeEach(async () => {
  vi.clearAllMocks()
  mocks.reset()
  currentActor = USER_A
  mocks.authenticate.mockImplementation(async (request: FastifyRequest) => {
    request.userId = currentActor
  })
  await seedTeam()
})

describe('F-350 收件箱绑定 actor', () => {
  it('① B 传 fromMember=A 发消息,落库发送人是 B', async () => {
    currentActor = USER_B
    const res = await server.inject({
      method: 'POST',
      url: `/agent-teams/${teamId}/inbox`,
      payload: {
        fromMember: { memberKind: 'human', memberId: USER_A },
        toMember: { memberKind: 'agent', memberId: AGENT_C },
        kind: 'message',
        payload: { text: '冒名消息' },
        idempotencyKey: 'forge-from',
      },
    })
    expect(res.statusCode).toBe(200)
    const entry = res.json().data.entry
    expect(entry.fromMemberKind).toBe('human')
    expect(entry.fromMemberId).toBe(USER_B)
    expect(entry.fromMemberId).not.toBe(USER_A)
    const stored = mocks.inbox.find((e) => e.idempotencyKey === 'forge-from')
    expect(stored?.fromMemberId).toBe(USER_B)
  })

  it('② B 读 A 的收件箱为空,读自己的仍可见', async () => {
    currentActor = USER_B
    const other = await server.inject({
      method: 'GET',
      url: `/agent-teams/${teamId}/inbox?toMemberKind=human&toMemberId=${USER_A}`,
    })
    expect(other.statusCode).toBe(200)
    expect(other.json().data.entries).toEqual([])

    const own = await server.inject({
      method: 'GET',
      url: `/agent-teams/${teamId}/inbox?toMemberKind=human&toMemberId=${USER_B}`,
    })
    expect(own.statusCode).toBe(200)
    const ownEntries = own.json().data.entries
    expect(ownEntries).toHaveLength(1)
    expect(ownEntries[0].id).toBe(seedToBId)
  })

  it('③ B 标记 A 的条目已读 → 404 且零更新', async () => {
    currentActor = USER_B
    const res = await server.inject({
      method: 'POST',
      url: `/agent-teams/${teamId}/inbox/${seedToAId}/read`,
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().errorCode).toBe('INBOX_ENTRY_NOT_FOUND')
    expect(mocks.inbox.find((e) => e.id === seedToAId)?.readAt).toBeNull()
    expect(mocks.markReadCalls).not.toContain(seedToAId)
  })

  it('④ B 给自己发消息成功,并能标记自己已读', async () => {
    currentActor = USER_B
    const send = await server.inject({
      method: 'POST',
      url: `/agent-teams/${teamId}/inbox`,
      payload: {
        fromMember: { memberKind: 'human', memberId: USER_A },
        toMember: { memberKind: 'human', memberId: USER_B },
        kind: 'message',
        payload: { text: '给自己' },
        idempotencyKey: 'self-send',
      },
    })
    expect(send.statusCode).toBe(200)
    const entry = send.json().data.entry
    expect(entry.fromMemberId).toBe(USER_B)
    expect(entry.toMemberId).toBe(USER_B)

    const read = await server.inject({
      method: 'POST',
      url: `/agent-teams/${teamId}/inbox/${entry.id}/read`,
    })
    expect(read.statusCode).toBe(200)
    expect(read.json().data.readAt).not.toBeNull()
  })

  it('⑤ B 向 A 的人类收件箱投递 → 403 且零落库', async () => {
    currentActor = USER_B
    const res = await server.inject({
      method: 'POST',
      url: `/agent-teams/${teamId}/inbox`,
      payload: {
        fromMember: { memberKind: 'human', memberId: USER_B },
        toMember: { memberKind: 'human', memberId: USER_A },
        kind: 'message',
        payload: { text: '应该被拒' },
        idempotencyKey: 'cross-human',
      },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().errorCode).toBe('INBOX_RECIPIENT_NOT_SELF')
    expect(mocks.inbox.filter((e) => e.idempotencyKey === 'cross-human')).toHaveLength(0)
  })

  it('⑥ A 可读并标记自己的收件箱(正向对照)', async () => {
    currentActor = USER_A
    const list = await server.inject({
      method: 'GET',
      url: `/agent-teams/${teamId}/inbox?toMemberKind=human&toMemberId=${USER_A}`,
    })
    expect(list.statusCode).toBe(200)
    expect(list.json().data.entries.map((e: { id: string }) => e.id)).toEqual([seedToAId])

    const read = await server.inject({
      method: 'POST',
      url: `/agent-teams/${teamId}/inbox/${seedToAId}/read`,
    })
    expect(read.statusCode).toBe(200)
    expect(read.json().data.readAt).not.toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
