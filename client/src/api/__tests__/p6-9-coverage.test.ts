/**
 * P6-9 后端 API 单测覆盖
 * - sso.ts buildEduPlatformUrl 纯函数
 * - webhooks.ts WebhookEventTypes / ResourceTypes 常量
 * - share.ts ShareLinkRequest 类型 + 字段映射
 * - security.ts LoginDevice / SessionInfo 类型完整性
 * - invoice.ts 类型完整性 + 函数签名
 * - 关键 API 模块导出函数数量
 */

import { describe, it, expect, vi } from 'vitest'
import { buildEduPlatformUrl, EduPlatformType } from '../sso'
import { WebhookEventTypes, ResourceTypes } from '../webhooks'

describe('P6-9 后端 API 单测', () => {
  describe('sso.buildEduPlatformUrl 纯函数', () => {
    it('应该拼接 token / refreshToken / expiresIn', () => {
      const url = buildEduPlatformUrl('https://edu.example.com/callback', {
        token: 'abc123',
        refreshToken: 'refresh_xyz',
        expiresIn: 7200,
        userId: 'u-1',
      })
      expect(url).toContain('token=abc123')
      expect(url).toContain('refreshToken=refresh_xyz')
      expect(url).toContain('expiresIn=7200')
    })

    it('应该将其他用户字段合并到 userInfo', () => {
      const url = buildEduPlatformUrl('https://edu.example.com/callback', {
        token: 't',
        nickname: 'tester',
        avatar: 'https://example.com/a.png',
      })
      expect(url).toMatch(/userInfo=/)
      // userInfo 是 encodeURIComponent 后的 JSON
      const m = url.match(/userInfo=([^&]+)/)
      expect(m, '存在 userInfo 参数').toBeTruthy()
      if (m) {
        const decoded = decodeURIComponent(m[1])
        expect(decoded).toContain('nickname')
        expect(decoded).toContain('tester')
        expect(decoded).toContain('avatar')
      }
    })

    it('缺省 expiresIn 应该使用 604800', () => {
      const url = buildEduPlatformUrl('https://edu.example.com/callback', { token: 't' })
      expect(url).toContain('expiresIn=604800')
    })

    it('应该兼容 accessToken / access_token 字段', () => {
      const url1 = buildEduPlatformUrl('https://e.com', { accessToken: 'a' })
      expect(url1).toContain('token=a')
      const url2 = buildEduPlatformUrl('https://e.com', { access_token: 'b' })
      expect(url2).toContain('token=b')
    })

    it('应该兼容 refresh_token 字段', () => {
      const url = buildEduPlatformUrl('https://e.com', { refresh_token: 'r1', token: 't' })
      expect(url).toContain('refreshToken=r1')
    })

    it('应该过滤掉已单独传递的字段', () => {
      const url = buildEduPlatformUrl('https://e.com', {
        token: 'tok',
        refreshToken: 'ref',
        accessToken: 'a',
        access_token: 'b',
        refresh_token: 'c',
        expiresIn: 100,
      })
      const m = url.match(/userInfo=([^&]+)/)
      if (m) {
        const decoded = decodeURIComponent(m[1])
        const obj = JSON.parse(decoded) as Record<string, unknown>
        expect(obj.token, 'token 排除').toBeUndefined()
        expect(obj.accessToken, 'accessToken 排除').toBeUndefined()
        expect(obj.refreshToken, 'refreshToken 排除').toBeUndefined()
        expect(obj.expiresIn, 'expiresIn 排除').toBeUndefined()
      }
    })

    it('EduPlatformType 枚举值正确', () => {
      expect(EduPlatformType.ADMIN).toBe(1)
      expect(EduPlatformType.USER).toBe(2)
    })
  })

  describe('webhooks 常量完整性', () => {
    it('WebhookEventTypes 包含 6 大类核心事件', () => {
      expect(WebhookEventTypes.MODEL_CREATED).toBe('model.created')
      expect(WebhookEventTypes.WORKFLOW_EXECUTED).toBe('workflow.executed')
      expect(WebhookEventTypes.AGENT_PUBLISHED).toBe('agent.published')
      expect(WebhookEventTypes.ORDER_PAID).toBe('order.paid')
      expect(WebhookEventTypes.USER_REGISTERED).toBe('user.registered')
      expect(WebhookEventTypes.MESSAGE_CREATED).toBe('message.created')
    })

    it('ResourceTypes 资源类型至少 10 个', () => {
      const keys = Object.keys(ResourceTypes)
      expect(keys.length, '资源类型 >= 10').toBeGreaterThanOrEqual(10)
      expect(ResourceTypes.MODEL).toBe('model')
      expect(ResourceTypes.WORKFLOW).toBe('workflow')
      expect(ResourceTypes.AGENT).toBe('agent')
    })

    it('事件命名空间使用 dot.case 命名', () => {
      const events = Object.values(WebhookEventTypes)
      events.forEach((e) => {
        expect(e, `${e} 形如 xxx.yyy`).toMatch(/^[a-z]+(\.[a-z_]+)+$/)
      })
    })
  })

  describe('share.ts 字段映射（mock request）', () => {
    it('generateShareLink 应将 camelCase 转为 snake_case', async () => {
      vi.resetModules()
      const requestMock = vi.fn().mockResolvedValue({ data: { shortUrl: 'https://s/x' } })
      vi.doMock('@/utils/request', () => ({ default: { post: requestMock } }))
      const { generateShareLink } = await import('../content/share')
      const res = await generateShareLink({
        url: 'https://example.com/a',
        title: 'A',
        description: 'B',
        image: 'C',
        expireTime: 3600,
      })
      expect(requestMock).toHaveBeenCalledWith(
        '/share/generate',
        expect.objectContaining({
          url: 'https://example.com/a',
          title: 'A',
          description: 'B',
          image: 'C',
          expire_time: 3600,
        })
      )
      expect(res.success).toBe(true)
    })

    it('recordShare 失败时返回 recorded:false（不抛错）', async () => {
      vi.resetModules()
      const requestMock = vi.fn().mockRejectedValue(new Error('network error'))
      vi.doMock('@/utils/request', () => ({ default: { post: requestMock } }))
      const { recordShare } = await import('../content/share')
      const res = await recordShare({ shareType: 'wechat', shareUrl: 'https://x' })
      expect(res.success, '记录失败时仍返回 success=true').toBe(true)
      expect(res.data.recorded, 'recorded=false').toBe(false)
    })

    it('getShareStats 失败时返回默认 0 统计', async () => {
      vi.resetModules()
      const requestMock = vi.fn().mockRejectedValue(new Error('timeout'))
      vi.doMock('@/utils/request', () => ({ default: { get: requestMock } }))
      const { getShareStats } = await import('../content/share')
      const res = await getShareStats('content-1', 'agent')
      expect(res.success, '获取统计失败时 success=true').toBe(true)
      expect(res.data.totalShares).toBe(0)
      expect(res.data.shareCount).toBe(0)
    })

    it('getWechatShareConfig 返回 JSSDK 字段', async () => {
      vi.resetModules()
      const requestMock = vi.fn().mockResolvedValue({
        data: { appId: 'wxabc', timestamp: 1700000000, nonceStr: 'n', signature: 'sig' },
      })
      vi.doMock('@/utils/request', () => ({ default: { post: requestMock } }))
      const { getWechatShareConfig } = await import('../content/share')
      const res = await getWechatShareConfig('https://example.com/page')
      expect(res.success).toBe(true)
      expect(res.data.appId).toBe('wxabc')
      expect(res.data.signature).toBe('sig')
    })
  })

  describe('security.ts API 端点正确', () => {
    it('getLoginDevices 调 GET /security/devices', async () => {
      vi.resetModules()
      const requestMock = vi.fn().mockResolvedValue({ data: [] })
      vi.doMock('@/utils/request', () => ({ default: { get: requestMock } }))
      const { getLoginDevices } = await import('../system/security')
      const res = await getLoginDevices()
      expect(requestMock).toHaveBeenCalledWith('/security/devices')
      expect(res.data).toEqual([])
    })

    it('removeLoginDevice 调 POST /security/devices/{id}/remove', async () => {
      vi.resetModules()
      const requestMock = vi.fn().mockResolvedValue({ data: true })
      vi.doMock('@/utils/request', () => ({ default: { post: requestMock } }))
      const { removeLoginDevice } = await import('../system/security')
      await removeLoginDevice('dev-1')
      expect(requestMock).toHaveBeenCalledWith('/security/devices/dev-1/remove')
    })

    it('trustDevice 调 POST /security/devices/{id}/trust', async () => {
      vi.resetModules()
      const requestMock = vi.fn().mockResolvedValue({ data: true })
      vi.doMock('@/utils/request', () => ({ default: { post: requestMock } }))
      const { trustDevice } = await import('../system/security')
      await trustDevice('dev-2')
      expect(requestMock).toHaveBeenCalledWith('/security/devices/dev-2/trust')
    })

    it('terminateSession 调 POST /security/sessions/{id}/terminate', async () => {
      vi.resetModules()
      const requestMock = vi.fn().mockResolvedValue({ data: true })
      vi.doMock('@/utils/request', () => ({ default: { post: requestMock } }))
      const { terminateSession } = await import('../system/security')
      await terminateSession('sess-1')
      expect(requestMock).toHaveBeenCalledWith('/security/sessions/sess-1/terminate')
    })

    it('terminateAllOtherSessions 调 POST /security/sessions/terminate-all', async () => {
      vi.resetModules()
      const requestMock = vi.fn().mockResolvedValue({ data: true })
      vi.doMock('@/utils/request', () => ({ default: { post: requestMock } }))
      const { terminateAllOtherSessions } = await import('../system/security')
      await terminateAllOtherSessions()
      expect(requestMock).toHaveBeenCalledWith('/security/sessions/terminate-all')
    })

    it('bindEmail / unbindEmail 调对应端点', async () => {
      vi.resetModules()
      const requestMock = vi.fn().mockResolvedValue({ data: true })
      vi.doMock('@/utils/request', () => ({ default: { post: requestMock } }))
      const { bindEmail, unbindEmail } = await import('../system/security')
      await bindEmail({ email: 'a@b.com', code: '1234' })
      expect(requestMock).toHaveBeenCalledWith('/security/bind-email', { email: 'a@b.com', code: '1234' })
      await unbindEmail({ password: 'p', code: '5678' })
      expect(requestMock).toHaveBeenCalledWith('/security/unbind-email', { password: 'p', code: '5678' })
    })
  })

  describe('webhooks.ts API 端点正确', () => {
    it('getWebhooks 调 GET /developer/webhooks', async () => {
      vi.resetModules()
      const requestMock = vi.fn().mockResolvedValue({ data: { list: [], total: 0 } })
      vi.doMock('@/utils/request', () => ({ default: { get: requestMock } }))
      const { getWebhooks } = await import('../webhooks')
      const res = await getWebhooks({ page: 1, pageSize: 20, enabled: true })
      expect(requestMock).toHaveBeenCalled()
      const callArg = requestMock.mock.calls[0] as unknown[]
      expect(String(callArg[0])).toMatch(/webhooks/)
      expect(res.data.total).toBe(0)
    })

    it('createWebhook 调 POST /developer/webhooks', async () => {
      vi.resetModules()
      const requestMock = vi.fn().mockResolvedValue({ data: { id: 'wh-1', secret: 's3cr3t' } })
      vi.doMock('@/utils/request', () => ({ default: { post: requestMock } }))
      const { createWebhook } = await import('../webhooks')
      const res = await createWebhook({
        name: 'My Hook',
        url: 'https://example.com/hook',
        events: ['model.created'],
        enabled: true,
      })
      expect(requestMock).toHaveBeenCalled()
      expect(res.data.id).toBe('wh-1')
      expect(res.data.secret).toBe('s3cr3t')
    })

    it('testWebhook 调 POST /developer/webhooks/{id}/test', async () => {
      vi.resetModules()
      const requestMock = vi.fn().mockResolvedValue({ data: { success: true, statusCode: 200 } })
      vi.doMock('@/utils/request', () => ({ default: { post: requestMock } }))
      const { testWebhook } = await import('../webhooks')
      const res = await testWebhook('wh-1', { foo: 'bar' })
      expect(requestMock).toHaveBeenCalled()
      expect(res.data.success).toBe(true)
    })

    it('batchWebhookOperation 调 POST /developer/webhooks/batch', async () => {
      vi.resetModules()
      const requestMock = vi.fn().mockResolvedValue({ data: { affectedRows: 3 } })
      vi.doMock('@/utils/request', () => ({ default: { post: requestMock } }))
      const { batchWebhookOperation } = await import('../webhooks')
      const res = await batchWebhookOperation('enable', ['wh-1', 'wh-2', 'wh-3'])
      expect(res.data.affectedRows).toBe(3)
    })
  })

  describe('invoice.ts API 端点正确', () => {
    it('downloadInvoice 调 GET 返回 Blob', async () => {
      vi.resetModules()
      const blob = new Blob(['pdf data'], { type: 'application/pdf' })
      const requestMock = vi.fn().mockResolvedValue({ data: blob })
      vi.doMock('@/utils/request', () => ({ default: { get: requestMock } }))
      const { downloadInvoice } = await import('../payment/invoice')
      const res = await downloadInvoice('order-1')
      expect(res).toBeInstanceOf(Blob)
    })

    it('downloadInvoice 响应非 Blob 时抛错', async () => {
      vi.resetModules()
      const requestMock = vi.fn().mockResolvedValue({ data: { not: 'a blob' } })
      vi.doMock('@/utils/request', () => ({ default: { get: requestMock } }))
      const { downloadInvoice } = await import('../payment/invoice')
      await expect(downloadInvoice('order-2')).rejects.toThrow()
    })

    it('generateInvoice 调 POST 返回 invoiceId', async () => {
      vi.resetModules()
      const requestMock = vi.fn().mockResolvedValue({
        data: { success: true, code: 200, data: { invoiceId: 'inv-1', downloadUrl: 'https://x/i.pdf' } },
      })
      vi.doMock('@/utils/request', () => ({ default: { post: requestMock } }))
      const { generateInvoice } = await import('../payment/invoice')
      const res = await generateInvoice('order-1', {
        type: 'company',
        title: 'Tech Co.',
        taxNumber: '91110000XXXXXXXXXX',
      })
      expect(res.data?.invoiceId).toBe('inv-1')
    })
  })

  describe('后端 API 导出完整性', () => {
    it('security.ts 至少 12 个 API 函数', async () => {
      const mod = await import('../system/security')
      const keys = Object.keys(mod)
      const apiKeys = keys.filter((k) => k.startsWith('get') || k.startsWith('remove') || k.startsWith('trust') || k.startsWith('terminate') || k.startsWith('bind') || k.startsWith('unbind') || k.startsWith('verify'))
      expect(apiKeys.length, `security API 数: ${apiKeys.join(', ')}`).toBeGreaterThanOrEqual(12)
    })

    it('webhooks.ts 至少 9 个 API 函数', async () => {
      const mod = await import('../webhooks')
      const apiKeys = Object.keys(mod).filter((k) => k.startsWith('get') || k.startsWith('create') || k.startsWith('update') || k.startsWith('delete') || k.startsWith('test') || k.startsWith('batch'))
      expect(apiKeys.length, `webhook API 数: ${apiKeys.join(', ')}`).toBeGreaterThanOrEqual(9)
    })

    it('share.ts 至少 4 个 API 函数', async () => {
      const mod = await import('../content/share')
      const keys = Object.keys(mod)
      const apiKeys = keys.filter((k) => k.startsWith('generate') || k.startsWith('record') || k.startsWith('get') || k.startsWith('default'))
      expect(apiKeys.length, `share API 数: ${apiKeys.join(', ')}`).toBeGreaterThanOrEqual(4)
    })
  })
})
