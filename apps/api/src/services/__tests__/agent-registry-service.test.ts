// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, expect, it } from 'vitest'
import type { AgentDefinition } from '@ihui/database'
import { snapshotDefinition, toDefinitionView } from '../agent-registry-service.js'

/**
 * 这些断言钉的是回滚/详情两个最容易静默破约的点：
 * 1. 快照少一列 → 回滚把定义回滚成半截，且没有任何报错；
 * 2. 列表/详情默认带出 systemPrompt → 团队普通成员能读走别人的提示词。
 */

function makeDefinition(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    ownerUserId: '00000000-0000-4000-8000-000000000002',
    teamId: null,
    scope: 'personal',
    name: 'reviewer-readonly',
    displayName: '只读评审员',
    description: '只读代码评审',
    role: 'reviewer',
    systemPrompt: '你是只读评审员',
    promptVersion: 2,
    model: 'inherit',
    temperature: '0.70',
    maxTokens: 30000,
    tools: ['read_file'],
    skills: ['code-review'],
    permissions: { filesystem: 'read' },
    memoryPolicy: { agent: 'write' },
    budget: { perRunTokens: 30000 },
    concurrencyLimit: 2,
    status: 'active',
    isBuiltin: false,
    isDispatchable: true,
    marketAgentId: null,
    metadata: { tags: ['review'] },
    version: 3,
    createdBy: '00000000-0000-4000-8000-000000000002',
    updatedBy: '00000000-0000-4000-8000-000000000002',
    createdAt: new Date('2026-11-27T12:00:00Z'),
    updatedAt: new Date('2026-11-27T12:30:00Z'),
    deletedAt: null,
    purgeAfter: null,
    ...overrides,
  }
}

const REQUIRED_SNAPSHOT_KEYS = [
  'name',
  'displayName',
  'description',
  'role',
  'systemPrompt',
  'promptVersion',
  'model',
  'temperature',
  'maxTokens',
  'tools',
  'skills',
  'permissions',
  'memoryPolicy',
  'budget',
  'concurrencyLimit',
  'status',
  'isDispatchable',
  'marketAgentId',
  'metadata',
] as const

describe('agent-registry snapshot', () => {
  it('快照覆盖全部可变字段，键集合不缺不溢出', () => {
    const snapshot = snapshotDefinition(makeDefinition())
    expect(Object.keys(snapshot).sort()).toEqual([...REQUIRED_SNAPSHOT_KEYS].sort())
  })

  it('快照的 temperature 落成字符串，避免 numeric 精度在回滚时变形', () => {
    const snapshot = snapshotDefinition(makeDefinition({ temperature: '1.25' }))
    expect(snapshot.temperature).toBe('1.25')
    expect(typeof snapshot.temperature).toBe('string')
  })
})

describe('agent-registry definition view', () => {
  it('默认不返回 systemPrompt', () => {
    const view = toDefinitionView(makeDefinition())
    expect(view).not.toHaveProperty('systemPrompt')
    expect(view.version).toBe(3)
    expect(view.temperature).toBe('0.70')
  })

  it('withPrompt=true 才返回提示词', () => {
    const view = toDefinitionView(makeDefinition(), true)
    expect(view.systemPrompt).toBe('你是只读评审员')
  })

  it('deletedAt/purgeAfter 转 ISO 字符串，null 保持 null', () => {
    const deleted = toDefinitionView(
      makeDefinition({
        status: 'deleted',
        deletedAt: new Date('2026-11-27T13:00:00Z'),
        purgeAfter: new Date('2026-12-27T13:00:00Z'),
      }),
    )
    expect(deleted.deletedAt).toBe('2026-11-27T13:00:00.000Z')
    expect(deleted.purgeAfter).toBe('2026-12-27T13:00:00.000Z')
  })
})
