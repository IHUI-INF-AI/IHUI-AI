// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 自动默认工作区权限初始化(2026-11-28)。
 *
 * 缺陷:默认工作区之前只建目录、权限档写 default,后台任务写根文件要等 60s 人工审计，
 * 表现就是“任务卡住/失败”。这里锁三件事:
 *   ① 无权限记录 → accept-edits + 全量模板；
 *   ② 历史 default → 升 accept-edits，不清用户规则，只补缺失模板；
 *   ③ plan / bypass → 尊重显式选择，不改档。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getPermission: vi.fn(),
  upsertPermission: vi.fn(),
  listRules: vi.fn(),
  createRulesBulk: vi.fn(),
}))

vi.mock('../src/db/workspace-permission-queries.js', () => ({
  getPermission: mocks.getPermission,
  upsertPermission: mocks.upsertPermission,
  listRules: mocks.listRules,
  createRulesBulk: mocks.createRulesBulk,
}))

import {
  SAFE_TEMPLATES,
  ensureDefaultWorkspacePermission,
  mergeSafeTemplateRules,
} from '../src/services/workspace-permission-presets.js'

const input = { userId: 'u-default', workspacePath: '/tmp/ws/default', name: 'AI 默认工作区' }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.listRules.mockResolvedValue([])
})

describe('ensureDefaultWorkspacePermission', () => {
  it('无权限记录:创建 accept-edits + 全量模板', async () => {
    mocks.getPermission.mockResolvedValue(undefined)
    const result = await ensureDefaultWorkspacePermission(input)

    expect(mocks.upsertPermission).toHaveBeenCalledWith(
      expect.objectContaining({ workspacePath: input.workspacePath, mode: 'acceptEdits' }),
    )
    expect(mocks.createRulesBulk).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      mode: 'accept-edits',
      changed: true,
      addedRules: SAFE_TEMPLATES.length,
    })
  })

  it('历史 default:升 accept-edits，保留原名并补模板', async () => {
    mocks.getPermission.mockResolvedValue({
      name: '旧名字',
      techStack: 'node',
      mode: 'default',
    })
    const result = await ensureDefaultWorkspacePermission(input)

    expect(mocks.upsertPermission).toHaveBeenCalledWith(
      expect.objectContaining({ name: '旧名字', techStack: 'node', mode: 'acceptEdits' }),
    )
    expect(result.mode).toBe('accept-edits')
    expect(result.changed).toBe(true)
  })

  it('已是 accept-edits:只补缺失模板，不重写权限记录', async () => {
    mocks.getPermission.mockResolvedValue({ name: 'AI 默认工作区', mode: 'accept-edits' })
    mocks.listRules.mockResolvedValue([
      { ruleType: 'path', pattern: '**', operation: 'write', decision: 'allow' },
    ])
    const result = await ensureDefaultWorkspacePermission(input)

    expect(mocks.upsertPermission).not.toHaveBeenCalled()
    expect(result.mode).toBe('accept-edits')
    expect(result.addedRules).toBe(SAFE_TEMPLATES.length - 1)
  })

  it('plan / bypass:尊重用户显式选择，不改档也不塞规则', async () => {
    for (const mode of ['plan', 'bypass-permissions']) {
      vi.clearAllMocks()
      mocks.getPermission.mockResolvedValue({ name: 'x', mode })
      const result = await ensureDefaultWorkspacePermission(input)
      expect(result).toEqual({ mode, changed: false, addedRules: 0 })
      expect(mocks.upsertPermission).not.toHaveBeenCalled()
      expect(mocks.createRulesBulk).not.toHaveBeenCalled()
    }
  })
})

describe('mergeSafeTemplateRules', () => {
  it('幂等:已有规则逐条比对，不重复插入', async () => {
    mocks.listRules.mockResolvedValue(
      SAFE_TEMPLATES.map((rule) => ({ ...rule, builtin: true, id: 'x' })),
    )
    const added = await mergeSafeTemplateRules(input.userId, input.workspacePath)
    expect(added).toBe(0)
    expect(mocks.createRulesBulk).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
