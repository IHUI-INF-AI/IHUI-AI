// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type {
  AgentTeam,
  AgentTeamInboxEntry,
  AgentTeamInboxPayload,
  AgentTeamMember,
} from '@ihui/database'
import type {
  AgentTeamRepository,
  InsertInboxInput,
  InsertMemberInput,
} from '../src/db/agent-team-queries.js'
import { AgentTeamError, createAgentTeamService } from '../src/services/agent-team-service.js'

/**
 * 服务层行为测试(内存仓库版)。
 *
 * 为什么用内存仓库而不是 mock drizzle 链式调用:本域要验的是**权限与幂等语义**,
 * 不是某条 SQL 的拼接形状。内存实现按真实约束建模:
 * - 同一 (memberKind, memberId) 在 leftAt IS NULL 时不可存在于两个团队;
 * - 同一 (teamId, idempotencyKey) 只保留一行。
 * 存储层的真实性(部分唯一索引 / ON CONFLICT)另有 *.real.test.ts 在真库上验。
 */

function uniqueViolation(constraint: string) {
  return Object.assign(
    new Error(`duplicate key value violates unique constraint "${constraint}"`),
    {
      code: '23505',
      constraint,
    },
  )
}

class MemoryAgentTeamRepository implements AgentTeamRepository {
  private teams = new Map<string, AgentTeam>()
  private members: AgentTeamMember[] = []
  private inbox: AgentTeamInboxEntry[] = []

  async createTeamWithLead(input: { ownerId: string; name: string }) {
    const team: AgentTeam = {
      id: randomUUID(),
      ownerId: input.ownerId,
      name: input.name,
      status: 'active',
      createdAt: new Date(),
      dissolvedAt: null,
    }
    this.teams.set(team.id, team)
    const lead: AgentTeamMember = {
      id: randomUUID(),
      teamId: team.id,
      memberKind: 'human',
      memberId: input.ownerId,
      role: 'lead',
      joinedAt: new Date(),
      leftAt: null,
    }
    this.members.push(lead)
    return { team, lead }
  }

  async findTeamById(teamId: string) {
    return this.teams.get(teamId) ?? null
  }

  async findActiveTeamByMember(ref: {
    memberKind: AgentTeamMember['memberKind']
    memberId: string
  }) {
    const member = this.members.find(
      (m) =>
        m.memberKind === ref.memberKind &&
        m.memberId === ref.memberId &&
        m.leftAt === null &&
        this.teams.get(m.teamId)?.status === 'active',
    )
    if (!member) return null
    return { team: this.teams.get(member.teamId)!, member }
  }

  async findMember(
    teamId: string,
    ref: { memberKind: AgentTeamMember['memberKind']; memberId: string },
    options?: { activeOnly?: boolean },
  ) {
    return (
      this.members.find(
        (m) =>
          m.teamId === teamId &&
          m.memberKind === ref.memberKind &&
          m.memberId === ref.memberId &&
          (!(options?.activeOnly ?? true) || m.leftAt === null),
      ) ?? null
    )
  }

  async listMembers(teamId: string, options?: { activeOnly?: boolean }) {
    return this.members.filter(
      (m) => m.teamId === teamId && (!(options?.activeOnly ?? true) || m.leftAt === null),
    )
  }

  async countActiveLeads(teamId: string) {
    return this.members.filter((m) => m.teamId === teamId && m.role === 'lead' && m.leftAt === null)
      .length
  }

  async insertMember(input: InsertMemberInput) {
    const existingActive = this.members.find(
      (m) =>
        m.memberKind === input.memberKind && m.memberId === input.memberId && m.leftAt === null,
    )
    if (existingActive) throw uniqueViolation('agent_team_members_active_uq')
    const previous = this.members.find(
      (m) =>
        m.teamId === input.teamId &&
        m.memberKind === input.memberKind &&
        m.memberId === input.memberId,
    )
    if (previous) {
      previous.leftAt = null
      previous.role = input.role
      previous.joinedAt = new Date()
      return previous
    }
    const row: AgentTeamMember = {
      id: randomUUID(),
      teamId: input.teamId,
      memberKind: input.memberKind,
      memberId: input.memberId,
      role: input.role,
      joinedAt: new Date(),
      leftAt: null,
    }
    this.members.push(row)
    return row
  }

  async markMemberLeft(
    teamId: string,
    ref: { memberKind: AgentTeamMember['memberKind']; memberId: string },
  ) {
    const row = await this.findMember(teamId, ref)
    if (!row) return null
    row.leftAt = new Date()
    return row
  }

  async dissolveTeam(teamId: string) {
    const team = this.teams.get(teamId)
    if (!team || team.status !== 'active') return null
    team.status = 'dissolved'
    team.dissolvedAt = new Date()
    for (const m of this.members) {
      if (m.teamId === teamId && m.leftAt === null) m.leftAt = new Date()
    }
    return team
  }

  async findInboxByKey(teamId: string, idempotencyKey: string) {
    return (
      this.inbox.find((e) => e.teamId === teamId && e.idempotencyKey === idempotencyKey) ?? null
    )
  }

  async insertInbox(input: InsertInboxInput) {
    const existing = await this.findInboxByKey(input.teamId, input.idempotencyKey)
    if (existing) return { entry: existing, duplicated: true }
    const entry: AgentTeamInboxEntry = {
      id: randomUUID(),
      teamId: input.teamId,
      fromMemberKind: input.fromMemberKind,
      fromMemberId: input.fromMemberId,
      toMemberKind: input.toMemberKind,
      toMemberId: input.toMemberId,
      kind: input.kind,
      idempotencyKey: input.idempotencyKey,
      payload: input.payload as AgentTeamInboxPayload,
      readAt: null,
      createdAt: new Date(),
    }
    this.inbox.push(entry)
    return { entry, duplicated: false }
  }

  async listInbox(
    teamId: string,
    to?: { memberKind: AgentTeamMember['memberKind']; memberId: string },
  ) {
    return this.inbox.filter(
      (e) =>
        e.teamId === teamId &&
        (!to || (e.toMemberKind === to.memberKind && e.toMemberId === to.memberId)),
    )
  }

  async findInboxById(teamId: string, id: string) {
    return this.inbox.find((e) => e.teamId === teamId && e.id === id) ?? null
  }

  async markInboxRead(teamId: string, id: string, readAt: Date) {
    const entry = await this.findInboxById(teamId, id)
    if (!entry) return null
    entry.readAt = readAt
    return entry
  }

  async countInboxByKey(teamId: string, idempotencyKey: string) {
    return this.inbox.filter((e) => e.teamId === teamId && e.idempotencyKey === idempotencyKey)
      .length
  }

  /** 测试专用:直接数行,给反向例 ② 的"库里只 1 条"提供读数 */
  countEntries(teamId: string, idempotencyKey: string) {
    return this.inbox.filter((e) => e.teamId === teamId && e.idempotencyKey === idempotencyKey)
      .length
  }
}

const owner = 'user-owner'
const memberUser = 'user-member'
const outsider = 'user-outsider'
const agentA = { memberKind: 'agent' as const, memberId: 'agent-a' }
const agentB = { memberKind: 'agent' as const, memberId: 'agent-b' }

let artifactRoot = ''

beforeAll(async () => {
  artifactRoot = await mkdtemp(join(tmpdir(), 'ihui-agent-team-test-'))
  await writeFile(join(artifactRoot, 'artifact.txt'), 'team artifact body\n', 'utf8')
})

afterAll(async () => {
  if (artifactRoot) await rm(artifactRoot, { recursive: true, force: true })
})

function setup() {
  const repo = new MemoryAgentTeamRepository()
  const service = createAgentTeamService({ repo, artifactRoot })
  return { repo, service }
}

async function createTeamWithAgents() {
  const { repo, service } = setup()
  const { team } = await service.createTeam(owner, 'Alpha Team')
  await service.addMember(owner, team.id, { ...agentA, role: 'member' })
  await service.addMember(owner, team.id, { ...agentB, role: 'member' })
  return { repo, service, team }
}

describe('团队实体与成员权限', () => {
  it('建队后 owner 自动成为 lead 成员', async () => {
    const { service } = setup()
    const { team, members } = await service.createTeam(owner, 'Solo Team')
    expect(team.status).toBe('active')
    expect(members).toHaveLength(1)
    expect(members[0]).toMatchObject({ memberKind: 'human', memberId: owner, role: 'lead' })
  })

  it('同一 owner 再次建队被拒绝(MEMBER_ALREADY_IN_ACTIVE_TEAM)', async () => {
    const { service } = setup()
    await service.createTeam(owner, 'First')
    await expect(service.createTeam(owner, 'Second')).rejects.toMatchObject({
      statusCode: 409,
      code: 'MEMBER_ALREADY_IN_ACTIVE_TEAM',
    })
  })

  it('反向例①:member 尝试建队被拒绝,拒绝码与原文可读', async () => {
    const { service, team } = await createTeamWithAgents()
    await service.addMember(owner, team.id, {
      memberKind: 'human',
      memberId: memberUser,
      role: 'member',
    })
    const error = await service.createTeam(memberUser, 'Member Team').catch((e) => e)
    expect(error).toBeInstanceOf(AgentTeamError)
    expect(error).toMatchObject({ statusCode: 409, code: 'MEMBER_ALREADY_IN_ACTIVE_TEAM' })
    expect(error.message).toContain('已属于一个 active 团队')
    expect(error.details).toMatchObject({ teamId: team.id })
  })

  it('反向例①:member 尝试加成员被 403 NOT_TEAM_LEAD', async () => {
    const { service, team } = await createTeamWithAgents()
    await service.addMember(owner, team.id, {
      memberKind: 'human',
      memberId: memberUser,
      role: 'member',
    })
    const error = await service
      .addMember(memberUser, team.id, { memberKind: 'agent', memberId: 'agent-c', role: 'member' })
      .catch((e) => e)
    expect(error).toMatchObject({ statusCode: 403, code: 'NOT_TEAM_LEAD' })
    expect(error.message).toContain('只有 lead')
  })

  it('member 尝试解散团队被 403 NOT_TEAM_LEAD', async () => {
    const { service, team } = await createTeamWithAgents()
    await service.addMember(owner, team.id, {
      memberKind: 'human',
      memberId: memberUser,
      role: 'member',
    })
    await expect(service.dissolveTeam(memberUser, team.id)).rejects.toMatchObject({
      statusCode: 403,
      code: 'NOT_TEAM_LEAD',
    })
  })

  it('lead 可以添加 agent 成员', async () => {
    const { service, team } = await createTeamWithAgents()
    const members = await service.getTeam(owner, team.id).then((v) => v.members)
    expect(members.map((m) => `${m.memberKind}:${m.memberId}`)).toEqual([
      `human:${owner}`,
      'agent:agent-a',
      'agent:agent-b',
    ])
  })

  it('重复添加同团队同成员被拒绝(MEMBER_ALREADY_IN_TEAM)', async () => {
    const { service, team } = await createTeamWithAgents()
    await expect(
      service.addMember(owner, team.id, { ...agentA, role: 'member' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'MEMBER_ALREADY_IN_TEAM' })
  })

  it('成员唯一性:同一 agent 不能同时加入第二个 active 团队', async () => {
    const { service, team: firstTeam } = await createTeamWithAgents()
    const { team: otherTeam } = await service.createTeam(outsider, 'Other Team')
    await expect(
      service.addMember(outsider, otherTeam.id, { ...agentA, role: 'member' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'MEMBER_ALREADY_IN_ACTIVE_TEAM' })
    expect(firstTeam.id).not.toBe(otherTeam.id)
  })

  it('移除最后一名 lead 被拒绝(LAST_LEAD_REQUIRED)', async () => {
    const { service, team } = await createTeamWithAgents()
    await expect(
      service.removeMember(owner, team.id, { memberKind: 'human', memberId: owner }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'LAST_LEAD_REQUIRED' })
  })

  it('存在第二名 lead 时可以移除第一名 lead,成员唯一性随之释放', async () => {
    const { service, team } = await createTeamWithAgents()
    await service.addMember(owner, team.id, {
      memberKind: 'human',
      memberId: memberUser,
      role: 'lead',
    })
    const removed = await service.removeMember(owner, team.id, {
      memberKind: 'human',
      memberId: owner,
    })
    expect(removed.leftAt).toBeInstanceOf(Date)
    const { team: otherTeam } = await service.createTeam(owner, 'Rejoinable Team')
    expect(otherTeam.ownerId).toBe(owner)
    expect(team.id).not.toBe(otherTeam.id)
  })

  it('解散团队后成员全部释放,可重新建队', async () => {
    const { service, team } = await createTeamWithAgents()
    const dissolved = await service.dissolveTeam(owner, team.id)
    expect(dissolved.status).toBe('dissolved')
    expect(dissolved.dissolvedAt).toBeInstanceOf(Date)
    const view = await service.getTeam(owner, team.id).catch((e) => e)
    expect(view).toMatchObject({ statusCode: 404, code: 'TEAM_NOT_FOUND' })
    await expect(service.createTeam(owner, 'After Dissolve')).resolves.toMatchObject({
      team: { name: 'After Dissolve' },
    })
  })

  it('名称非法被拒绝(TEAM_NAME_INVALID)', async () => {
    const { service } = setup()
    await expect(service.createTeam(owner, '   ')).rejects.toMatchObject({
      statusCode: 400,
      code: 'TEAM_NAME_INVALID',
    })
  })
})

describe('持久收件箱', () => {
  it('lead 发送消息后被目标成员按 teamId + toMember 拉到', async () => {
    const { service, team } = await createTeamWithAgents()
    const { entry } = await service.sendInbox(owner, team.id, {
      fromMember: { memberKind: 'human', memberId: owner },
      toMember: agentA,
      kind: 'message',
      payload: { text: '请接手构建' },
      idempotencyKey: 'msg-1',
    })
    expect(entry.readAt).toBeNull()
    expect(entry.payload).toMatchObject({ text: '请接手构建' })
    const list = await service.listInbox(owner, team.id, agentA)
    expect(list.map((e) => e.id)).toEqual([entry.id])
    expect(list[0].toMemberId).toBe('agent-a')
  })

  it('反向例②:同一幂等键发两次,内存库计数仍为 1', async () => {
    const { service, repo, team } = await createTeamWithAgents()
    const input = {
      fromMember: { memberKind: 'human' as const, memberId: owner },
      toMember: agentA,
      kind: 'message' as const,
      payload: { text: '只应落一条' },
      idempotencyKey: 'idem-msg-1',
    }
    const first = await service.sendInbox(owner, team.id, input)
    const second = await service.sendInbox(owner, team.id, input)
    expect(first.duplicated).toBe(false)
    expect(second.duplicated).toBe(true)
    expect(second.entry.id).toBe(first.entry.id)
    expect(repo.countEntries(team.id, 'idem-msg-1')).toBe(1)
    expect(await repo.countInboxByKey(team.id, 'idem-msg-1')).toBe(1)
  })

  it('不同团队可用相同幂等键(唯一键按 team 分域)', async () => {
    const first = await createTeamWithAgents()
    const second = setup()
    const { team: otherTeam } = await second.service.createTeam(outsider, 'Other')
    const input = {
      fromMember: { memberKind: 'human' as const, memberId: outsider },
      toMember: { memberKind: 'agent' as const, memberId: 'agent-x' },
      kind: 'message' as const,
      payload: {},
      idempotencyKey: 'same-key',
    }
    await second.service.addMember(outsider, otherTeam.id, {
      memberKind: 'agent',
      memberId: 'agent-x',
      role: 'member',
    })
    const a = await first.service.sendInbox(owner, first.team.id, {
      ...input,
      fromMember: { memberKind: 'human', memberId: owner },
      toMember: agentA,
    })
    const b = await second.service.sendInbox(outsider, otherTeam.id, input)
    expect(a.entry.teamId).toBe(first.team.id)
    expect(b.entry.teamId).toBe(otherTeam.id)
  })

  it('发送方不是团队成员被 403 NOT_TEAM_MEMBER', async () => {
    const { service, team } = await createTeamWithAgents()
    await expect(
      service.sendInbox(owner, team.id, {
        fromMember: { memberKind: 'agent', memberId: 'agent-ghost' },
        toMember: agentA,
        kind: 'message',
        payload: {},
        idempotencyKey: 'ghost-1',
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'NOT_TEAM_MEMBER' })
  })

  it('目标成员不是团队成员被 403 NOT_TEAM_MEMBER', async () => {
    const { service, team } = await createTeamWithAgents()
    await expect(
      service.sendInbox(owner, team.id, {
        fromMember: { memberKind: 'human', memberId: owner },
        toMember: { memberKind: 'agent', memberId: 'agent-ghost' },
        kind: 'message',
        payload: {},
        idempotencyKey: 'ghost-2',
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'NOT_TEAM_MEMBER' })
  })

  it('handoff 不允许走 sendInbox 入口(HANDOFF_REQUIRES_ENDPOINT)', async () => {
    const { service, team } = await createTeamWithAgents()
    await expect(
      service.sendInbox(owner, team.id, {
        fromMember: { memberKind: 'human', memberId: owner },
        toMember: agentA,
        kind: 'handoff',
        payload: {},
        idempotencyKey: 'handoff-via-send',
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'HANDOFF_REQUIRES_ENDPOINT' })
  })

  it('按 toMember 过滤只返回目标成员的消息', async () => {
    const { service, team } = await createTeamWithAgents()
    const base = {
      fromMember: { memberKind: 'human' as const, memberId: owner },
      kind: 'message' as const,
      payload: {},
    }
    await service.sendInbox(owner, team.id, { ...base, toMember: agentA, idempotencyKey: 'to-a' })
    await service.sendInbox(owner, team.id, { ...base, toMember: agentB, idempotencyKey: 'to-b' })
    const toA = await service.listInbox(owner, team.id, agentA)
    const toB = await service.listInbox(owner, team.id, agentB)
    const all = await service.listInbox(owner, team.id)
    expect(toA.map((e) => e.idempotencyKey)).toEqual(['to-a'])
    expect(toB.map((e) => e.idempotencyKey)).toEqual(['to-b'])
    expect(all).toHaveLength(2)
  })

  it('按不存在的成员过滤收件箱被 403 NOT_TEAM_MEMBER', async () => {
    const { service, team } = await createTeamWithAgents()
    await expect(
      service.listInbox(owner, team.id, { memberKind: 'agent', memberId: 'agent-ghost' }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'NOT_TEAM_MEMBER' })
  })

  it('标记已读写入 readAt;不存在的条目 404', async () => {
    const { service, team } = await createTeamWithAgents()
    const { entry } = await service.sendInbox(owner, team.id, {
      fromMember: { memberKind: 'human', memberId: owner },
      toMember: agentA,
      kind: 'message',
      payload: {},
      idempotencyKey: 'read-1',
    })
    const updated = await service.markInboxRead(owner, team.id, entry.id)
    expect(updated.readAt).toBeInstanceOf(Date)
    await expect(service.markInboxRead(owner, team.id, randomUUID())).rejects.toMatchObject({
      statusCode: 404,
      code: 'INBOX_ENTRY_NOT_FOUND',
    })
  })

  it('反向例④:跨租户读收件箱被 404(团队存在性不泄露)', async () => {
    const { service, team } = await createTeamWithAgents()
    const error = await service.listInbox(outsider, team.id, agentA).catch((e) => e)
    expect(error).toMatchObject({ statusCode: 404, code: 'TEAM_NOT_FOUND' })
    expect(error.message).toContain('团队不存在或无权访问')
    // 不存在的团队与无权访问同一口径
    await expect(service.listInbox(outsider, randomUUID())).rejects.toMatchObject({
      statusCode: 404,
      code: 'TEAM_NOT_FOUND',
    })
  })
})

describe('产物转交 handoff', () => {
  const sha256Of = (content: string | Buffer) => createHash('sha256').update(content).digest('hex')

  it('sha256 一致时落库并记录完整来源', async () => {
    const { service, team } = await createTeamWithAgents()
    const expected = sha256Of('team artifact body\n')
    const result = await service.handoff(owner, team.id, {
      artifactPath: 'artifact.txt',
      sha256: expected,
      fromMember: agentA,
      toMember: agentB,
      idempotencyKey: 'handoff-1',
    })
    expect(result.duplicated).toBe(false)
    expect(result.entry.kind).toBe('handoff')
    expect(result.entry.payload).toMatchObject({
      artifactPath: 'artifact.txt',
      sha256: expected,
      fromMember: 'agent:agent-a',
      toMember: 'agent:agent-b',
      sizeBytes: 19,
    })
    expect((result.entry.payload as { transferredAt: string }).transferredAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T/,
    )
  })

  it('反向例③:篡改 sha256 被 409 拒绝,并原样返回 expected/actual', async () => {
    const { service, team } = await createTeamWithAgents()
    const actual = sha256Of('team artifact body\n')
    const tampered = '0'.repeat(64)
    const error = await service
      .handoff(owner, team.id, {
        artifactPath: 'artifact.txt',
        sha256: tampered,
        fromMember: agentA,
        toMember: agentB,
        idempotencyKey: 'handoff-tampered',
      })
      .catch((e) => e)
    expect(error).toMatchObject({ statusCode: 409, code: 'ARTIFACT_SHA256_MISMATCH' })
    expect(error.details).toEqual({ expectedSha256: tampered, actualSha256: actual })
    expect(error.details.actualSha256).not.toBe(tampered)
  })

  it('目标成员未加入团队时转交被 403 拒绝', async () => {
    const { service, team } = await createTeamWithAgents()
    await expect(
      service.handoff(owner, team.id, {
        artifactPath: 'artifact.txt',
        sha256: sha256Of('team artifact body\n'),
        fromMember: agentA,
        toMember: { memberKind: 'agent', memberId: 'agent-ghost' },
        idempotencyKey: 'handoff-ghost',
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'NOT_TEAM_MEMBER' })
  })

  it('产物不在允许根目录内被 403 ARTIFACT_PATH_OUT_OF_SCOPE', async () => {
    const { service, team } = await createTeamWithAgents()
    await expect(
      service.handoff(owner, team.id, {
        artifactPath: join(tmpdir(), 'ihui-agent-team-escape.txt'),
        sha256: sha256Of('x'),
        fromMember: agentA,
        toMember: agentB,
        idempotencyKey: 'handoff-escape',
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'ARTIFACT_PATH_OUT_OF_SCOPE' })
  })

  it('产物文件不存在被 404 ARTIFACT_NOT_FOUND', async () => {
    const { service, team } = await createTeamWithAgents()
    await expect(
      service.handoff(owner, team.id, {
        artifactPath: 'missing.txt',
        sha256: '0'.repeat(64),
        fromMember: agentA,
        toMember: agentB,
        idempotencyKey: 'handoff-missing',
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'ARTIFACT_NOT_FOUND' })
  })

  it('同一 handoff 幂等键重放仍只有一条记录', async () => {
    const { service, repo, team } = await createTeamWithAgents()
    const input = {
      artifactPath: 'artifact.txt',
      sha256: sha256Of('team artifact body\n'),
      fromMember: agentA,
      toMember: agentB,
      idempotencyKey: 'handoff-idem',
    }
    const first = await service.handoff(owner, team.id, input)
    const second = await service.handoff(owner, team.id, input)
    expect(second.duplicated).toBe(true)
    expect(second.entry.id).toBe(first.entry.id)
    expect(repo.countEntries(team.id, 'handoff-idem')).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
