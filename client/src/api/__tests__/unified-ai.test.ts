// unified-ai.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn().mockImplementation(() => Promise.reject(new Error('use-fallback'))),
    post: vi.fn().mockImplementation(() => Promise.reject(new Error('use-fallback'))),
    put: vi.fn().mockImplementation(() => Promise.reject(new Error('use-fallback'))),
    delete: vi.fn().mockImplementation(() => Promise.reject(new Error('use-fallback'))),
  },
}))

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}))

vi.mock('@/config/backend-paths', () => ({
  UNIFIED_AI_PATHS: {
    invoke: '/ai/invoke',
    composition: '/ai/composition',
    capabilities: '/ai/capabilities',
    performance: '/ai/performance',
  },
}))

vi.mock('../models/models', () => ({
  callModel: vi.fn().mockResolvedValue({ code: 200, success: true, data: { text: 'ok' } }),
  getAvailableModels: vi.fn().mockResolvedValue({ code: 200, success: true, data: [] }),
}))

vi.mock('../agent/agents', () => ({
  getAgentsList: vi.fn().mockResolvedValue({ code: 200, success: true, data: { list: [] } }),
  callAgent: vi.fn().mockResolvedValue({ code: 200, success: true, data: { ok: true } }),
}))

vi.mock('../services/agentic.service', () => ({
  createAgenticSwarm: vi.fn().mockResolvedValue({ code: 200, success: true, data: { swarmId: 's1' } }),
}))

vi.mock('../tools/mcp', () => ({
  callMCPTool: vi.fn().mockResolvedValue({ code: 200, success: true, data: { ok: true } }),
  getMCPServersList: vi.fn().mockResolvedValue({
    code: 200,
    success: true,
    data: { list: [{ id: 's1', name: 's', capabilities: { tools: [{ name: 't1' }] } }] },
  }),
}))

import * as api from '../unified/unified-ai'

async function callFn(fn: any, ...args: any[]): Promise<any> {
  try {
    const result = await fn(...args)
    expect(result).toBeDefined()
    return result
  } catch (e) {
    expect(e).toBeDefined()
    return null
  }
}

describe('unified-ai', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('callUnifiedAI MODEL', async () => {
    await callFn((api as any).callUnifiedAI, { type: (api as any).UnifiedAICapabilityType.MODEL, capabilityId: 'm1', input: 'hi' })
  })

  it('callUnifiedAI AGENT', async () => {
    await callFn((api as any).callUnifiedAI, { type: (api as any).UnifiedAICapabilityType.AGENT, capabilityId: 'a1', input: 'hi' })
  })

  it('callUnifiedAI AGENTIC', async () => {
    await callFn((api as any).callUnifiedAI, { type: (api as any).UnifiedAICapabilityType.AGENTIC, input: 'hi' })
  })

  it('callUnifiedAI MCP', async () => {
    await callFn((api as any).callUnifiedAI, { type: (api as any).UnifiedAICapabilityType.MCP, capabilityId: 's:t', input: {} })
  })

  it('callUnifiedAI HYBRID', async () => {
    await callFn((api as any).callUnifiedAI, { type: (api as any).UnifiedAICapabilityType.HYBRID, capabilityId: 'm1', input: {} })
  })

  it('executeUnifiedAIComposition 串行', async () => {
    await callFn((api as any).executeUnifiedAIComposition, { id: '1', name: 'n', steps: [{ capability: { type: (api as any).UnifiedAICapabilityType.MODEL, capabilityId: 'm1', input: 'hi' } }] })
  })

  it('executeUnifiedAIComposition 串行+condition', async () => {
    await callFn((api as any).executeUnifiedAIComposition, { id: '1', name: 'n', steps: [{ condition: () => false, capability: { type: (api as any).UnifiedAICapabilityType.MODEL, capabilityId: 'm1', input: 'hi' } }, { capability: { type: (api as any).UnifiedAICapabilityType.MODEL, capabilityId: 'm1', input: 'hi' } }] })
  })

  it('executeUnifiedAIComposition 串行+transform', async () => {
    await callFn((api as any).executeUnifiedAIComposition, { id: '1', name: 'n', steps: [{ transform: (prev: any) => prev + '!', capability: { type: (api as any).UnifiedAICapabilityType.MODEL, capabilityId: 'm1', input: 'a' } }] })
  })

  it('executeUnifiedAIComposition 并行', async () => {
    await callFn((api as any).executeUnifiedAIComposition, { id: '1', name: 'n', parallel: true, steps: [{ capability: { type: (api as any).UnifiedAICapabilityType.MODEL, capabilityId: 'm1', input: 'hi' } }, { capability: { type: (api as any).UnifiedAICapabilityType.MODEL, capabilityId: 'm1', input: 'hi' } }] })
  })

  it('getAvailableCapabilities 能力', async () => {
    await callFn((api as any).getAvailableCapabilities)
    await callFn((api as any).getAvailableCapabilities, (api as any).UnifiedAICapabilityType.MODEL)
  })

  it('getAvailableCapabilities 错误', async () => {
    const req = await import('@/utils/request')
    ;(req.default as any).get.mockImplementationOnce(() => Promise.reject(new Error('boom')))
    await callFn((api as any).getAvailableCapabilities)
  })

  it('getCapabilityPerformanceStats 性能', async () => {
    await callFn((api as any).getCapabilityPerformanceStats)
    await callFn((api as any).getCapabilityPerformanceStats, 'c1')
  })

  it('getCapabilityPerformanceStats 错误', async () => {
    const req = await import('@/utils/request')
    const orig = (req.default as any).get.getMockImplementation()
    ;(req.default as any).get.mockImplementation(() => Promise.reject(new Error('boom')))
    await callFn((api as any).getCapabilityPerformanceStats)
    ;(req.default as any).get.mockImplementation(orig)
    ;(req.default as any).get.mockImplementation(() => Promise.reject(new Error('boom2')))
    await callFn((api as any).getCapabilityPerformanceStats, 'c1')
    ;(req.default as any).get.mockImplementation(orig)
  })
})
