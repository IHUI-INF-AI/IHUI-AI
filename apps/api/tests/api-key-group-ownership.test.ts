// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * API Key 分组归属闸契约锁(2026-10-27 越权修正配套)。
 *
 * 立因:两处入口的注释都自称「校验 apiKeyId 属于当前用户」,查询里却只有
 * `eq(developerApiKeys.id, …)` —— 证明的是"这行存在",不是"这行是你的"。任意登录
 * 用户可把受害者 Key 以 role='owner' 写进自己的组,该 Key 的计费/限流/可用模型口径
 * 随即由攻击者的组决定(relay-billing-service.getKeyGroup)。
 *
 * 成对夹具即变异自证:若把归属闸摘掉(路由直接放行),下面两条"false ⇒ 拒绝且无副作用"
 * 的用例立刻翻红,因为 addMember/acceptInvite 会被真实调用。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('../src/services/api-key-group-service.js', () => ({
  createGroup: vi.fn(),
  addMember: vi.fn(),
  getGroupById: vi.fn(),
  getGroupMembers: vi.fn(),
  getMemberRole: vi.fn(),
  getUserGroupIds: vi.fn(),
  getUserApiKeyInGroup: vi.fn(),
  createInvite: vi.fn(),
  acceptInvite: vi.fn(),
  isKeyOwnedBy: vi.fn(),
  rechargeGroupBalance: vi.fn(),
}))

import developerApiKeyGroupsRoutes from '../src/routes/developer/api-key-groups.js'
import { requireAuth } from '../src/plugins/require-permission.js'
import {
  createGroup,
  addMember,
  acceptInvite,
  isKeyOwnedBy,
} from '../src/services/api-key-group-service.js'

const VICTIM_KEY_ID = '0e0e0e0e-0e0e-4e0e-8e0e-0e0e0e0e0e0e'

function mockAuth(userId = 'attacker-user'): void {
  vi.mocked(requireAuth).mockImplementation(async (request: { userId?: string }) => {
    request.userId = userId
  })
}

describe('API Key 分组归属闸', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    mockAuth()
    if (!app) {
      app = Fastify({ logger: false })
      await app.register(developerApiKeyGroupsRoutes, { prefix: '/api/developer' })
      await app.ready()
    }
  })

  describe('POST /api-key-groups(建组时的 owner Key)', () => {
    it('isKeyOwnedBy=false ⇒ 400「不存在」,且绝不把他人 Key 写进组(addMember 零调用)', async () => {
      vi.mocked(isKeyOwnedBy).mockResolvedValue(false)
      vi.mocked(createGroup).mockResolvedValue({ id: 'group-1' } as never)
      const res = await app.inject({
        method: 'POST',
        url: '/api/developer/api-key-groups',
        payload: { name: '我的组', apiKeyId: VICTIM_KEY_ID },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toBe('指定的 API Key 不存在')
      // 断言副作用没发生:受害者的 Key 不允许以 owner 角色进入攻击者的组
      expect(vi.mocked(addMember)).not.toHaveBeenCalled()
      // 归属判据必须真的被问过,且问的时候带的是令牌主体
      expect(vi.mocked(isKeyOwnedBy)).toHaveBeenCalledWith(VICTIM_KEY_ID, 'attacker-user')
    })

    it('isKeyOwnedBy=true(自己的 Key)⇒ 201 且 addMember 照常(正向对照)', async () => {
      vi.mocked(isKeyOwnedBy).mockResolvedValue(true)
      vi.mocked(createGroup).mockResolvedValue({ id: 'group-1' } as never)
      const res = await app.inject({
        method: 'POST',
        url: '/api/developer/api-key-groups',
        payload: { name: '我的组', apiKeyId: VICTIM_KEY_ID },
      })
      expect(res.statusCode).toBe(201)
      expect(vi.mocked(addMember)).toHaveBeenCalledWith('group-1', VICTIM_KEY_ID, 'owner')
    })
  })

  describe('POST /api-key-groups/join(凭邀请码入组)', () => {
    it('isKeyOwnedBy=false ⇒ 400「不存在」,且绝不执行 acceptInvite(防先占位 DoS)', async () => {
      vi.mocked(isKeyOwnedBy).mockResolvedValue(false)
      const res = await app.inject({
        method: 'POST',
        url: '/api/developer/api-key-groups/join',
        payload: { inviteCode: 'abc123', apiKeyId: VICTIM_KEY_ID },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toBe('API Key 不存在')
      expect(vi.mocked(acceptInvite)).not.toHaveBeenCalled()
      expect(vi.mocked(isKeyOwnedBy)).toHaveBeenCalledWith(VICTIM_KEY_ID, 'attacker-user')
    })

    it('isKeyOwnedBy=true ⇒ 200 joined 且 acceptInvite 照常(正向对照)', async () => {
      vi.mocked(isKeyOwnedBy).mockResolvedValue(true)
      const res = await app.inject({
        method: 'POST',
        url: '/api/developer/api-key-groups/join',
        payload: { inviteCode: 'abc123', apiKeyId: VICTIM_KEY_ID },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data).toEqual({ joined: true })
      expect(vi.mocked(acceptInvite)).toHaveBeenCalledWith('ABC123', VICTIM_KEY_ID)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
