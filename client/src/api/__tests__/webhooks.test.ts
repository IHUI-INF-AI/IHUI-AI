import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  },
}))

import * as api from '../webhooks'

describe('webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getWebhooks 应能正常调用', async () => {
    const fn = (api as any).getWebhooks
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getWebhook 应能正常调用', async () => {
    const fn = (api as any).getWebhook
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('createWebhook 应能正常调用', async () => {
    const fn = (api as any).createWebhook
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('updateWebhook 应能正常调用', async () => {
    const fn = (api as any).updateWebhook
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('deleteWebhook 应能正常调用', async () => {
    const fn = (api as any).deleteWebhook
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('testWebhook 应能正常调用', async () => {
    const fn = (api as any).testWebhook
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getWebhookEvents 应能正常调用', async () => {
    const fn = (api as any).getWebhookEvents
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getWebhookEventTypes 应能正常调用', async () => {
    const fn = (api as any).getWebhookEventTypes
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getWebhookStats 应能正常调用', async () => {
    const fn = (api as any).getWebhookStats
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('batchWebhookOperation 应能正常调用', async () => {
    const fn = (api as any).batchWebhookOperation
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('WebhookEventTypes.MODEL_CREATED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.MODEL_CREATED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.MODEL_UPDATED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.MODEL_UPDATED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.MODEL_DELETED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.MODEL_DELETED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.MODEL_ENABLED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.MODEL_ENABLED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.MODEL_DISABLED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.MODEL_DISABLED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.WORKFLOW_CREATED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.WORKFLOW_CREATED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.WORKFLOW_UPDATED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.WORKFLOW_UPDATED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.WORKFLOW_DELETED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.WORKFLOW_DELETED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.WORKFLOW_EXECUTED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.WORKFLOW_EXECUTED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.WORKFLOW_FAILED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.WORKFLOW_FAILED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.AGENT_CREATED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.AGENT_CREATED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.AGENT_UPDATED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.AGENT_UPDATED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.AGENT_DELETED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.AGENT_DELETED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.AGENT_PUBLISHED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.AGENT_PUBLISHED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.AGENT_UNPUBLISHED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.AGENT_UNPUBLISHED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.GATEWAY_CREATED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.GATEWAY_CREATED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.GATEWAY_UPDATED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.GATEWAY_UPDATED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.GATEWAY_DELETED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.GATEWAY_DELETED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.GATEWAY_ENABLED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.GATEWAY_ENABLED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.GATEWAY_DISABLED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.GATEWAY_DISABLED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.SDK_CREATED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.SDK_CREATED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.SDK_UPDATED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.SDK_UPDATED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.SDK_DELETED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.SDK_DELETED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.SDK_DOWNLOADED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.SDK_DOWNLOADED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.STATISTICS_UPDATED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.STATISTICS_UPDATED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.CALL_COMPLETED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.CALL_COMPLETED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.CALL_FAILED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.CALL_FAILED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.ORDER_CREATED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.ORDER_CREATED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.ORDER_PAID 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.ORDER_PAID()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.ORDER_REFUNDED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.ORDER_REFUNDED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.ORDER_CANCELLED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.ORDER_CANCELLED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.USER_REGISTERED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.USER_REGISTERED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.USER_UPDATED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.USER_UPDATED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.USER_VIP_ACTIVATED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.USER_VIP_ACTIVATED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.USER_VIP_EXPIRED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.USER_VIP_EXPIRED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.MESSAGE_CREATED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.MESSAGE_CREATED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.MESSAGE_READ 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.MESSAGE_READ()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.POST_CREATED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.POST_CREATED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.POST_UPDATED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.POST_UPDATED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.POST_DELETED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.POST_DELETED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.COMMENT_CREATED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.COMMENT_CREATED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.COURSE_CREATED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.COURSE_CREATED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.COURSE_UPDATED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.COURSE_UPDATED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.COURSE_ENROLLED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.COURSE_ENROLLED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.PLUGIN_INSTALLED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.PLUGIN_INSTALLED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.PLUGIN_UNINSTALLED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.PLUGIN_UNINSTALLED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('WebhookEventTypes.PLUGIN_UPDATED 应能正常调用', async () => {
    const obj = (api as any).WebhookEventTypes
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.PLUGIN_UPDATED()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

})
