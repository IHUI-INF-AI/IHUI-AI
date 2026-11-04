// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../src/db/index.js'
import { postgresAgentTeamRepository } from '../src/db/agent-team-queries.js'
import { createAgentTeamService } from '../src/services/agent-team-service.js'

/**
 * 真库集成测试:验证"只有存储层能证明"的三件事。
 * - 幂等键重放后 `select count(*)` 必须为 1(反向例②的 SQL 读数);
 * - 部分唯一索引 (member_kind, member_id) WHERE left_at IS NULL 拒绝第二团队的直接插入;
 * - 跨租户读收件箱在服务层就是 404,不是查询后过滤成空数组。
 *
 * 前置:test:real 入口(.env.test 指向专用测试库,非生产 8810)。
 * 每个用例使用独立用户/Agent 标识,避免前一条用例占住 active team 归属。
 */

let artifactRoot = ''
let service: ReturnType<typeof createAgentTeamService>
const sha256Of = (content: string) => createHash('sha256').update(content).digest('hex')

async function makeUser(): Promise<string> {
  const id = randomUUID()
  await db.execute(sql`INSERT INTO users (id) VALUES (${id}::uuid) ON CONFLICT (id) DO NOTHING`)
  return id
}

beforeAll(async () => {
  artifactRoot = await mkdtemp(join(tmpdir(), 'ihui-agent-team-db-'))
  await writeFile(join(artifactRoot, 'artifact.txt'), 'db artifact body\n', 'utf8')
  process.env.IHUI_TEAM_ARTIFACT_ROOT = artifactRoot
  service = createAgentTeamService()
})

afterAll(async () => {
  if (artifactRoot) await rm(artifactRoot, { recursive: true, force: true })
  delete process.env.IHUI_TEAM_ARTIFACT_ROOT
})

describe('agent_team 真库约束', () => {
  it('幂等键重放:库里计数仍为 1', async () => {
    const owner = await makeUser()
    const member = await makeUser()
    const { team } = await service.createTeam(owner, 'DB Team')
    await service.addMember(owner, team.id, {
      memberKind: 'human',
      memberId: member,
      role: 'member',
    })
    const input = {
      fromMember: { memberKind: 'human' as const, memberId: owner },
      toMember: { memberKind: 'human' as const, memberId: member },
      kind: 'message' as const,
      payload: { text: 'persist once' },
      idempotencyKey: 'db-idem-1',
    }
    const first = await service.sendInbox(owner, team.id, input)
    const second = await service.sendInbox(owner, team.id, input)
    expect(first.duplicated).toBe(false)
    expect(second.duplicated).toBe(true)

    const rows = await db.execute(sql`
      SELECT count(*)::int AS c FROM agent_team_inbox
      WHERE team_id = ${team.id}::uuid AND idempotency_key = 'db-idem-1'
    `)
    expect(rows[0]).toMatchObject({ c: 1 })
    expect(await postgresAgentTeamRepository.countInboxByKey(team.id, 'db-idem-1')).toBe(1)
  })

  it('部分唯一索引拒绝同一 agent 加入第二个 active 团队', async () => {
    const firstOwner = await makeUser()
    const secondOwner = await makeUser()
    const agent = `agent-${randomUUID()}`
    const { team: firstTeam } = await service.createTeam(firstOwner, 'First DB Team')
    await service.addMember(firstOwner, firstTeam.id, {
      memberKind: 'agent',
      memberId: agent,
      role: 'member',
    })
    const { team: otherTeam } = await service.createTeam(secondOwner, 'Second DB Team')

    await expect(
      service.addMember(secondOwner, otherTeam.id, {
        memberKind: 'agent',
        memberId: agent,
        role: 'member',
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'MEMBER_ALREADY_IN_ACTIVE_TEAM' })

    // 绕过服务层直插,证明约束在数据库层而不是应用层:
    const directInsertError = await db
      .execute(
        sql`
        INSERT INTO agent_team_members (team_id, member_kind, member_id, role)
        VALUES (${otherTeam.id}::uuid, 'agent', ${agent}, 'member')
      `,
      )
      .catch((e) => e)
    expect(directInsertError).toBeInstanceOf(Error)
    // drizzle 0.45 会把驱动错误包一层 DrizzleQueryError,原始 pg code 在 cause 上
    const cause = (directInsertError as { cause?: { code?: string } }).cause
    expect(cause?.code).toBe('23505')
  })

  it('反向例③:篡改 sha256 被拒绝,expected/actual 原样返回', async () => {
    const owner = await makeUser()
    const agentA = `agent-${randomUUID()}`
    const agentB = `agent-${randomUUID()}`
    const { team } = await service.createTeam(owner, 'Handoff Team')
    await service.addMember(owner, team.id, {
      memberKind: 'agent',
      memberId: agentA,
      role: 'member',
    })
    await service.addMember(owner, team.id, {
      memberKind: 'agent',
      memberId: agentB,
      role: 'member',
    })
    const actual = sha256Of('db artifact body\n')
    const error = await service
      .handoff(owner, team.id, {
        artifactPath: 'artifact.txt',
        sha256: 'f'.repeat(64),
        fromMember: { memberKind: 'agent', memberId: agentA },
        toMember: { memberKind: 'agent', memberId: agentB },
        idempotencyKey: 'db-handoff-bad',
      })
      .catch((e) => e)
    expect(error).toMatchObject({ statusCode: 409, code: 'ARTIFACT_SHA256_MISMATCH' })
    expect(error.details).toEqual({ expectedSha256: 'f'.repeat(64), actualSha256: actual })
  })

  it('反向例④:跨租户读收件箱为 404', async () => {
    const owner = await makeUser()
    const member = await makeUser()
    const outsider = await makeUser()
    const { team } = await service.createTeam(owner, 'Tenant Team')
    await service.addMember(owner, team.id, {
      memberKind: 'human',
      memberId: member,
      role: 'member',
    })
    await service.sendInbox(owner, team.id, {
      fromMember: { memberKind: 'human', memberId: owner },
      toMember: { memberKind: 'human', memberId: member },
      kind: 'message',
      payload: {},
      idempotencyKey: 'db-tenant-1',
    })
    await expect(
      service.listInbox(outsider, team.id, { memberKind: 'human', memberId: member }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'TEAM_NOT_FOUND' })
  })

  it('member 尝试管理成员为 403 NOT_TEAM_LEAD', async () => {
    const owner = await makeUser()
    const member = await makeUser()
    const { team } = await service.createTeam(owner, 'Lead Gate Team')
    await service.addMember(owner, team.id, {
      memberKind: 'human',
      memberId: member,
      role: 'member',
    })
    await expect(
      service.addMember(member, team.id, {
        memberKind: 'agent',
        memberId: `agent-${randomUUID()}`,
        role: 'member',
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'NOT_TEAM_LEAD' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
