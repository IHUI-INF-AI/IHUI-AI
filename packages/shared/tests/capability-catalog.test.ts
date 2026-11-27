// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { AGENT_READY_CAPABILITIES, CAPABILITY_CATALOG } from '../src/capabilities'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const TOOLS_INIT = join(REPO_ROOT, 'apps/ai-service/app/tools/__init__.py')

describe('能力目录 v0', () => {
  it('恰好 37 条能力', () => {
    expect(CAPABILITY_CATALOG).toHaveLength(37)
  })

  it('id 唯一且是 domain.verb 形态', () => {
    const ids = CAPABILITY_CATALOG.map((capability) => capability.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id).toMatch(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/)
    }
  })

  it('agent-ready 与 agentTool 双向一致，且工具名真实导出', () => {
    const toolsInit = readFileSync(TOOLS_INIT, 'utf8')
    for (const capability of CAPABILITY_CATALOG) {
      if (capability.status === 'agent-ready') {
        expect(capability.agentTool).toBeTruthy()
        expect(capability.surfaces).toContain('agent')
        expect(toolsInit).toContain(capability.agentTool ?? '<missing>')
      } else {
        expect(capability.agentTool).toBeNull()
        expect(capability.surfaces).not.toContain('agent')
      }
    }
    expect(AGENT_READY_CAPABILITIES.length).toBeGreaterThan(0)
    expect(AGENT_READY_CAPABILITIES.length).toBeLessThan(CAPABILITY_CATALOG.length)
  })

  it('owner 路径都能在仓库里找到真实文件', () => {
    for (const capability of CAPABILITY_CATALOG) {
      expect(existsSync(join(REPO_ROOT, capability.owner))).toBe(true)
    }
  })

  it('非 planned 的能力必须有 UI 落点，planned 允许没有', () => {
    for (const capability of CAPABILITY_CATALOG) {
      if (capability.status === 'planned') continue
      expect(capability.uiHref).not.toBeNull()
      expect(capability.uiHref?.startsWith('/')).toBe(true)
    }
  })

  it('价格、时延、权限、审计、表面都是合法值', () => {
    const domains = new Set([
      'content',
      'publish',
      'account',
      'media',
      'knowledge',
      'education',
      'tool',
    ])
    for (const capability of CAPABILITY_CATALOG) {
      expect(domains.has(capability.domain)).toBe(true)
      expect(['free', 'metered', 'unpriced']).toContain(capability.price.mode)
      expect(capability.price.note.length).toBeGreaterThan(0)
      expect(capability.sla.p95Ms).toBeGreaterThan(0)
      expect(capability.sla.note).toBeTruthy()
      expect(['user', 'org_admin', 'public']).toContain(capability.permissionScope)
      expect(['none', 'standard', 'required']).toContain(capability.audit)
      expect(capability.surfaces).toContain('web')
      expect(capability.idempotencyKey.length).toBeGreaterThan(0)
      expect(capability.inputSchema.type).toBe('object')
      expect(capability.outputSchema.type).toBe('object')
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
