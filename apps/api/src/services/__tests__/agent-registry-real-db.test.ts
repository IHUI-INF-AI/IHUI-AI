// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * R1 真库集成用例（默认跳过）。
 *
 * 运行前置：
 *   AGENT_REGISTRY_REAL_DB=1
 *   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/ihui_agent_test
 *
 * 该库必须是 `ihui_dev` 的模板克隆并已应用
 * `packages/database/drizzle/20261127120000_agent_registry.sql`。
 * 只验证 R1 自己的 5 张表与审计链，不碰业务库的其它域。
 */

import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { agentDefinitionVersions, agentDefinitions, agentRuns, users } from '@ihui/database'
import { db } from '../../db/index.js'
import {
  createAgentDefinition,
  getAgentDefinition,
  listAgentDefinitions,
  rollbackAgentDefinition,
  updateAgentDefinition,
} from '../agent-registry-service.js'
import {
  approveApproval,
  createDeleteApproval,
  createPurgeApproval,
  precheckDelete,
  restoreAgentDefinition,
} from '../agent-registry-approval-service.js'
import {
  appendRunEvent,
  createOrUpdateRun,
  recordInternalAgentAudit,
  updateRun,
} from '../agent-registry-run-write-service.js'

const enabled =
  process.env.AGENT_REGISTRY_REAL_DB === '1' &&
  (process.env.DATABASE_URL ?? '').includes('ihui_agent_test')

describe.skipIf(!enabled)('agent-registry real db', () => {
  const suffix = randomUUID().slice(0, 8)
  const adminId = randomUUID()
  const memberId = randomUUID()

  const admin = {
    userId: adminId,
    roleId: 1,
    requestId: `real-admin-${suffix}`,
    traceId: `real-trace-${suffix}`,
  }
  const member = {
    userId: memberId,
    roleId: 2,
    requestId: `real-member-${suffix}`,
    traceId: `real-trace-${suffix}`,
  }

  const createdIds: string[] = []

  beforeAll(async () => {
    await db.insert(users).values([
      { id: adminId, username: `r1-admin-${suffix}`, roleId: 1, status: 1 },
      { id: memberId, username: `r1-member-${suffix}`, roleId: 2, status: 1 },
    ])
  })

  afterAll(async () => {
    for (const id of createdIds) {
      await db
        .delete(agentDefinitions)
        .where(eq(agentDefinitions.id, id))
        .catch(() => undefined)
    }
    await db
      .delete(users)
      .where(eq(users.id, adminId))
      .catch(() => undefined)
    await db
      .delete(users)
      .where(eq(users.id, memberId))
      .catch(() => undefined)
  })

  it('create / detail / prompt 可见性', async () => {
    const created = await createAgentDefinition(admin, {
      scope: 'personal',
      name: `r1-vis-${suffix}`,
      displayName: '可见性用例',
      systemPrompt: '只有 owner 能看全文',
    })
    createdIds.push(created.id)

    expect(created.systemPrompt).toBe('只有 owner 能看全文')
    expect(created.auditId).toBeTruthy()

    const ownerView = await getAgentDefinition(admin, created.id)
    expect(ownerView.systemPrompt).toBe('只有 owner 能看全文')

    const memberView = await getAgentDefinition(member, created.id).catch(() => null)
    expect(memberView).toBeNull()
  })

  it('列表 cursor 分页不重不漏，并带 stats', async () => {
    for (let i = 0; i < 3; i += 1) {
      const created = await createAgentDefinition(admin, {
        scope: 'personal',
        name: `r1-page-${suffix}-${i}`,
        displayName: `分页 ${i}`,
      })
      createdIds.push(created.id)
    }

    const page1 = await listAgentDefinitions(admin, {
      search: `r1-page-${suffix}`,
      limit: 2,
      offset: 0,
    })
    expect(page1.list).toHaveLength(2)
    expect(page1.nextCursor).toBeTruthy()

    const page2 = await listAgentDefinitions(admin, {
      search: `r1-page-${suffix}`,
      limit: 2,
      cursor: page1.nextCursor ?? undefined,
    })
    expect(page2.list).toHaveLength(1)
    expect(page2.nextCursor).toBeNull()

    const ids = [...page1.list, ...page2.list].map((item) => item.id)
    expect(new Set(ids).size).toBe(3)

    const first = page1.list[0]!
    await db.insert(agentRuns).values({
      definitionId: first.id,
      definitionName: first.name,
      definitionVersion: first.version,
      ownerUserId: adminId,
      mode: 'single',
      goal: '统计用运行',
      status: 'succeeded',
      startedAt: new Date(),
      endedAt: new Date(),
      inputTokens: 10,
      outputTokens: 20,
      costPoints: '1.2500',
      traceId: `real-stats-${suffix}`,
    })
    const afterRun = await listAgentDefinitions(admin, {
      search: `r1-page-${suffix}`,
      limit: 2,
    })
    const target = afterRun.list.find((item) => item.id === first.id)
    expect(target?.stats?.runs7d).toBe(1)
    expect(target?.stats?.successRate).toBe(1)
    expect(target?.stats?.costPoints7d).toBe('1.2500')
  })

  it('预检 → 软删审批 → 恢复', async () => {
    const created = await createAgentDefinition(admin, {
      scope: 'personal',
      name: `r1-del-${suffix}`,
      displayName: '删除用例',
    })
    createdIds.push(created.id)

    const precheck = await precheckDelete(admin, created.id)
    expect(precheck.precheckToken.startsWith('pc_')).toBe(true)

    const approval = await createDeleteApproval(
      admin,
      created.id,
      precheck.precheckToken,
      '真实集成删除',
    )
    expect(approval.status).toBe('pending')

    const approved = await approveApproval(admin, approval.approvalId, created.name, '真实集成删除')
    expect(approved.definition?.status).toBe('deleted')
    expect(approved.definition?.purgeAfter).toBeTruthy()
    expect(approved.approval.status).toBe('consumed')
    expect(approved.auditId).toBeTruthy()

    const restored = await restoreAgentDefinition(admin, created.id)
    expect(restored.status).toBe('active')
    expect(restored.version).toBe(approved.definition!.version + 1)
  })

  it('活跃运行下回滚走审批，批准后按快照写回', async () => {
    const created = await createAgentDefinition(admin, {
      scope: 'personal',
      name: `r1-roll-${suffix}`,
      displayName: '回滚用例',
      systemPrompt: 'v1 prompt',
    })
    createdIds.push(created.id)

    const updated = await updateAgentDefinition(admin, created.id, {
      ifVersion: created.version,
      systemPrompt: 'v2 prompt',
      changeSummary: '升级到 v2',
    })
    expect(updated.version).toBe(2)

    await db.insert(agentRuns).values({
      definitionId: created.id,
      definitionName: created.name,
      definitionVersion: updated.version,
      ownerUserId: adminId,
      mode: 'single',
      goal: '制造活跃运行',
      status: 'running',
      startedAt: new Date(),
      traceId: `real-roll-${suffix}`,
    })

    const result = await rollbackAgentDefinition(
      admin,
      created.id,
      created.version,
      updated.version,
    )
    expect('requiresApproval' in result).toBe(true)
    if (!('requiresApproval' in result)) return
    expect(result.activeRuns).toBe(1)

    const approved = await approveApproval(admin, result.approvalId, created.name, '审批回滚')
    expect(approved.definition?.systemPrompt).toBe('v1 prompt')
    expect(approved.definition?.version).toBe(3)
    expect(approved.approval.status).toBe('consumed')
  })

  it('运行账本：创建幂等、事件 seq 去重、终态不可回 running', async () => {
    const definition = await createAgentDefinition(admin, {
      scope: 'personal',
      name: `r1-run-${suffix}`,
      displayName: '运行账本用例',
    })
    createdIds.push(definition.id)

    const runId = randomUUID()
    const created = await createOrUpdateRun(admin, {
      runId,
      definitionId: definition.id,
      definitionVersion: definition.version,
      definitionName: definition.name,
      mode: 'single',
      goal: '真库运行账本',
      traceId: `real-ledger-${suffix}`,
    })
    expect(created.created).toBe(true)
    expect(created.run.status).toBe('queued')

    const repeated = await createOrUpdateRun(admin, {
      runId,
      definitionId: definition.id,
      definitionVersion: definition.version,
      definitionName: definition.name,
      mode: 'single',
      goal: '真库运行账本',
      traceId: `real-ledger-${suffix}`,
    })
    expect(repeated.created).toBe(false)
    expect(repeated.run.runId).toBe(runId)

    const artifact = await appendRunEvent(admin, runId, {
      seq: 1,
      type: 'artifact',
      payload: { name: 'report.md' },
    })
    expect(artifact.duplicate).toBe(false)

    const duplicate = await appendRunEvent(admin, runId, {
      seq: 1,
      type: 'artifact',
      payload: { name: 'report.md' },
    })
    expect(duplicate.duplicate).toBe(true)
    expect(duplicate.run.artifactCount).toBe(1)

    const running = await appendRunEvent(admin, runId, {
      seq: 2,
      type: 'status',
      payload: { status: 'running' },
    })
    expect(running.run.status).toBe('running')

    const updated = await updateRun(admin, runId, {
      inputTokens: 100,
      outputTokens: 200,
      costPoints: '0.3500',
    })
    expect(updated.inputTokens).toBe(100)
    expect(updated.costPoints).toBe('0.3500')

    const succeeded = await appendRunEvent(admin, runId, {
      seq: 3,
      type: 'status',
      payload: { status: 'succeeded' },
    })
    expect(succeeded.run.status).toBe('succeeded')
    expect(succeeded.run.endedAt).toBeTruthy()

    await expect(
      appendRunEvent(admin, runId, {
        seq: 4,
        type: 'status',
        payload: { status: 'running' },
      }),
    ).rejects.toMatchObject({ errorCode: 'AGENT_RUN_NOT_ACTIVE' })

    const auditId = await recordInternalAgentAudit(admin, {
      action: 'agent.run.settled',
      resourceType: 'agent_run',
      resourceId: runId,
      metadata: { inputTokens: 100, outputTokens: 200 },
    })
    expect(auditId).toBeTruthy()
  })

  it('canceled / timeout 终态事件保留 errorCode 与 errorMessage', async () => {
    const definition = await createAgentDefinition(admin, {
      scope: 'personal',
      name: `r1-canceled-${suffix}`,
      displayName: '取消原因用例',
    })
    createdIds.push(definition.id)

    for (const status of ['canceled', 'timeout']) {
      const runId = randomUUID()
      await createOrUpdateRun(admin, {
        runId,
        definitionId: definition.id,
        definitionVersion: definition.version,
        definitionName: definition.name,
        mode: 'single',
        goal: `终态原因 ${status}`,
        traceId: `real-canceled-${status}-${suffix}`,
      })
      await appendRunEvent(admin, runId, {
        seq: 1,
        type: 'status',
        payload: { status: 'running' },
      })
      const terminal = await appendRunEvent(admin, runId, {
        seq: 2,
        type: 'status',
        payload: {
          status,
          errorCode: status === 'canceled' ? 'AGENT_RUN_STOPPED' : 'AGENT_RUN_TIMEOUT',
          errorMessage: status === 'canceled' ? '用户停止执行' : '执行超时',
        },
      })
      expect(terminal.run.status).toBe(status)
      expect(terminal.run.errorCode).toBe(
        status === 'canceled' ? 'AGENT_RUN_STOPPED' : 'AGENT_RUN_TIMEOUT',
      )
      expect(terminal.run.errorMessage).toBe(status === 'canceled' ? '用户停止执行' : '执行超时')
      expect(terminal.run.endedAt).toBeTruthy()
    }
  })

  it('彻底清除保留审批与归档，版本行级联消失', async () => {
    const created = await createAgentDefinition(admin, {
      scope: 'personal',
      name: `r1-purge-${suffix}`,
      displayName: '彻底清除用例',
      systemPrompt: '待归档的提示词',
    })
    createdIds.push(created.id)

    const precheck = await precheckDelete(admin, created.id)
    const del = await createDeleteApproval(admin, created.id, precheck.precheckToken, '先软删')
    await approveApproval(admin, del.approvalId, created.name, '先软删')

    await db
      .update(agentDefinitions)
      .set({ purgeAfter: new Date(Date.now() - 60_000) })
      .where(eq(agentDefinitions.id, created.id))

    const purge = await createPurgeApproval(admin, created.id, created.name, '保留期已满')
    expect(purge.status).toBe('pending')

    const approved = await approveApproval(admin, purge.approvalId, created.name, '彻底清除')
    expect(approved.purged).toBe(true)
    expect(approved.definition).toBeNull()

    const defRows = await db
      .select({ id: agentDefinitions.id })
      .from(agentDefinitions)
      .where(eq(agentDefinitions.id, created.id))
    expect(defRows).toHaveLength(0)

    const versionRows = await db
      .select({ id: agentDefinitionVersions.id })
      .from(agentDefinitionVersions)
      .where(eq(agentDefinitionVersions.definitionId, created.id))
    expect(versionRows).toHaveLength(0)

    const approvals = await db.execute(sql`
      SELECT status FROM agent_management_approvals WHERE id = ${purge.approvalId}
    `)
    expect((approvals as unknown as Array<{ status: string }>)[0]?.status).toBe('consumed')

    const audit = await db.execute(sql`
      SELECT count(*)::int AS count FROM audit_logs_chain
      WHERE resource_id = ${created.id} AND action IN ('agent.definition.purged', 'agent.definition.purge_requested')
    `)
    expect((audit as unknown as Array<{ count: number }>)[0]?.count).toBe(2)
  })
})
