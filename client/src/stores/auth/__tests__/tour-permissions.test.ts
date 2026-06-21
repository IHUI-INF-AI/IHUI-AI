import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUserStore } from '../user'
import { useTokenStore } from '../token'
import { useVipStore } from '../vip'
import { useTourPermissionsStore } from '../tour-permissions'

vi.mock('../user', () => ({
  useUserStore: vi.fn(() => ({
    user: { uuid: 'test-user', status: 1, roles: ['user'] },
    isVip: false,
  })),
}))

vi.mock('../token', () => ({
  useTokenStore: vi.fn(() => ({
    token: 'test-token',
    isTokenExpired: false,
  })),
}))

vi.mock('../vip', () => ({
  useVipStore: vi.fn(() => ({
    isVipActive: false,
  })),
}))

// 通用 mock 设置方法，方便每个用例调整登录态和角色
const setMocks = (opts: {
  user?: unknown
  token?: string
  isTokenExpired?: boolean
  isVipActive?: boolean
}) => {
  vi.mocked(useUserStore).mockReturnValue({
    user: opts.user === undefined ? null : opts.user,
    isVip: false,
  } as never)
  vi.mocked(useTokenStore).mockReturnValue({
    token: opts.token ?? '',
    isTokenExpired: opts.isTokenExpired ?? false,
  } as never)
  vi.mocked(useVipStore).mockReturnValue({
    isVipActive: opts.isVipActive ?? false,
  } as never)
}

describe('useTourPermissionsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('应该返回用户角色', () => {
    const store = useTourPermissionsStore()
    expect(store.userRoles).toContain('user')
  })

  it('应该检查权限', () => {
    const store = useTourPermissionsStore()
    const hasPermission = store.hasPermission('tour:view')
    expect(typeof hasPermission).toBe('boolean')
  })

  it('应该检查任意权限', () => {
    const store = useTourPermissionsStore()
    const result = store.hasAnyPermission(['tour:view', 'tour:create'])
    expect(typeof result).toBe('boolean')
  })

  it('应该检查所有权限', () => {
    const store = useTourPermissionsStore()
    const result = store.hasAllPermissions(['tour:view', 'tour:create'])
    expect(typeof result).toBe('boolean')
  })

  it('应该检查角色', () => {
    const store = useTourPermissionsStore()
    const result = store.hasRole('user')
    expect(typeof result).toBe('boolean')
  })

  it('应该返回管理权限计算属性', () => {
    const store = useTourPermissionsStore()
    expect(typeof store.canManageTours).toBe('boolean')
    expect(typeof store.canManageMonitoring).toBe('boolean')
    expect(typeof store.canManageRecommendations).toBe('boolean')
    expect(typeof store.canManagePlatforms).toBe('boolean')
  })

  it('应该返回所有权限列表', () => {
    const store = useTourPermissionsStore()
    expect(Array.isArray(store.allPermissions)).toBe(true)
  })

  it('空权限数组应该返回false', () => {
    const store = useTourPermissionsStore()
    expect(store.hasAnyPermission([])).toBe(false)
  })

  it('hasAllPermissions空数组应该返回true', () => {
    const store = useTourPermissionsStore()
    expect(store.hasAllPermissions([])).toBe(true)
  })

  it('无效权限应该返回false', () => {
    const store = useTourPermissionsStore()
    expect(store.hasPermission('invalid:permission' as never)).toBe(false)
  })

  it('无效角色应该返回false', () => {
    const store = useTourPermissionsStore()
    expect(store.hasRole('invalid_role' as never)).toBe(false)
  })

  it('应该正确处理多个权限检查', () => {
    const store = useTourPermissionsStore()
    const permissions = ['tour:view', 'monitoring:view', 'recommendation:view']
    const result = store.hasAnyPermission(permissions as never[])
    expect(typeof result).toBe('boolean')
  })

  it('allPermissions应该根据用户角色返回权限', () => {
    const store = useTourPermissionsStore()
    expect(store.allPermissions.length).toBeGreaterThan(0)
    expect(Array.isArray(store.allPermissions)).toBe(true)
  })
})

describe('useTourPermissionsStore 补充测试', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // 每次用例前重置环境变量
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // isLoggedIn 状态分支
  it('未登录时 isLoggedIn 应为 false', () => {
    setMocks({ token: '', user: null })
    const store = useTourPermissionsStore()
    expect(store.isLoggedIn).toBe(false)
  })

  it('token 过期时 isLoggedIn 应为 false', () => {
    setMocks({ token: 'tok', user: { uuid: 'u' }, isTokenExpired: true })
    const store = useTourPermissionsStore()
    expect(store.isLoggedIn).toBe(false)
  })

  it('user 为空时 isLoggedIn 应为 false', () => {
    setMocks({ token: 'tok', user: null })
    const store = useTourPermissionsStore()
    expect(store.isLoggedIn).toBe(false)
  })

  it('登录态完整时 isLoggedIn 应为 true', () => {
    setMocks({ token: 'tok', user: { uuid: 'u', status: 1 } })
    const store = useTourPermissionsStore()
    expect(store.isLoggedIn).toBe(true)
  })

  // userRoles 角色分支
  it('user 为空时角色应默认为 user', () => {
    setMocks({ token: 'tok', user: null })
    const store = useTourPermissionsStore()
    expect(store.userRoles).toEqual(['user'])
  })

  it('roles 包含 admin 时应加入 admin 角色', () => {
    setMocks({ token: 'tok', user: { uuid: 'u', status: 1, roles: ['admin', 'user'] } })
    const store = useTourPermissionsStore()
    expect(store.userRoles).toContain('admin')
    expect(store.userRoles).toContain('user')
  })

  it('roles 包含 operator 时应加入 operator 角色', () => {
    setMocks({ token: 'tok', user: { uuid: 'u', status: 1, roles: ['operator'] } })
    const store = useTourPermissionsStore()
    expect(store.userRoles).toContain('operator')
  })

  it('roles 包含 analyst 时应加入 analyst 角色', () => {
    setMocks({ token: 'tok', user: { uuid: 'u', status: 1, roles: ['analyst'] } })
    const store = useTourPermissionsStore()
    expect(store.userRoles).toContain('analyst')
  })

  it('roles 非数组时应不影响角色推导', () => {
    setMocks({ token: 'tok', user: { uuid: 'u', status: 1, roles: 'admin' as never } })
    const store = useTourPermissionsStore()
    expect(store.userRoles).toEqual(['user'])
  })

  it('status=1 且 VIP 激活时应自动获得 analyst 角色', () => {
    setMocks({
      token: 'tok',
      user: { uuid: 'u', status: 1, roles: ['user'] },
      isVipActive: true,
    })
    const store = useTourPermissionsStore()
    expect(store.userRoles).toContain('analyst')
  })

  it('status 不为 1 时即使 VIP 激活也不加 analyst', () => {
    setMocks({
      token: 'tok',
      user: { uuid: 'u', status: 0, roles: ['user'] },
      isVipActive: true,
    })
    const store = useTourPermissionsStore()
    expect(store.userRoles).not.toContain('analyst')
  })

  // VITE_ADMIN_OVERRIDE 环境变量分支
  it('adminOverride 开启且 uuid 匹配时应获得 admin 角色', () => {
    vi.stubEnv('VITE_ADMIN_OVERRIDE', 'true')
    vi.stubEnv('VITE_ADMIN_OVERRIDE_UUID', 'admin-uuid')
    setMocks({ token: 'tok', user: { uuid: 'admin-uuid', status: 1, roles: ['user'] } })
    const store = useTourPermissionsStore()
    expect(store.userRoles).toContain('admin')
  })

  it('adminOverride 开启但 uuid 不匹配时不应获得 admin 角色', () => {
    vi.stubEnv('VITE_ADMIN_OVERRIDE', 'true')
    vi.stubEnv('VITE_ADMIN_OVERRIDE_UUID', 'admin-uuid')
    setMocks({ token: 'tok', user: { uuid: 'other', status: 1, roles: ['user'] } })
    const store = useTourPermissionsStore()
    expect(store.userRoles).not.toContain('admin')
  })

  it('adminOverride 开启且 status 不为 1 时不应通过 uuid 获得 admin', () => {
    vi.stubEnv('VITE_ADMIN_OVERRIDE', 'true')
    vi.stubEnv('VITE_ADMIN_OVERRIDE_UUID', 'admin-uuid')
    setMocks({ token: 'tok', user: { uuid: 'admin-uuid', status: 0, roles: ['user'] } })
    const store = useTourPermissionsStore()
    expect(store.userRoles).not.toContain('admin')
  })

  it('adminOverride 关闭时不触发覆盖逻辑', () => {
    vi.stubEnv('VITE_ADMIN_OVERRIDE', 'false')
    vi.stubEnv('VITE_ADMIN_OVERRIDE_UUID', 'admin-uuid')
    setMocks({ token: 'tok', user: { uuid: 'admin-uuid', status: 1, roles: ['user'] } })
    const store = useTourPermissionsStore()
    expect(store.userRoles).not.toContain('admin')
  })

  it('adminOverride 通过手机号完全匹配获得 admin 角色', () => {
    vi.stubEnv('VITE_ADMIN_OVERRIDE', 'true')
    vi.stubEnv('VITE_ADMIN_OVERRIDE_PHONE', '13800000000')
    setMocks({
      token: 'tok',
      user: { uuid: 'u', status: 1, phone: '13800000000', roles: ['user'] },
    })
    const store = useTourPermissionsStore()
    expect(store.userRoles).toContain('admin')
  })

  it('adminOverride 通过手机号后缀匹配获得 admin 角色', () => {
    vi.stubEnv('VITE_ADMIN_OVERRIDE', 'true')
    vi.stubEnv('VITE_ADMIN_OVERRIDE_PHONE', '0000000')
    setMocks({
      token: 'tok',
      user: { uuid: 'u', status: 1, phone: '13800000000', roles: ['user'] },
    })
    const store = useTourPermissionsStore()
    expect(store.userRoles).toContain('admin')
  })

  it('adminOverride 手机号带空格和加号应被规范化匹配', () => {
    vi.stubEnv('VITE_ADMIN_OVERRIDE', 'true')
    vi.stubEnv('VITE_ADMIN_OVERRIDE_PHONE', '13800000000')
    setMocks({
      token: 'tok',
      user: { uuid: 'u', status: 1, phone: '+86 138-0000-0000', roles: ['user'] },
    })
    const store = useTourPermissionsStore()
    expect(store.userRoles).toContain('admin')
  })

  it('adminOverride 手机号不匹配时不应获得 admin 角色', () => {
    vi.stubEnv('VITE_ADMIN_OVERRIDE', 'true')
    vi.stubEnv('VITE_ADMIN_OVERRIDE_PHONE', '13900000000')
    setMocks({
      token: 'tok',
      user: { uuid: 'u', status: 1, phone: '13800000000', roles: ['user'] },
    })
    const store = useTourPermissionsStore()
    expect(store.userRoles).not.toContain('admin')
  })

  it('adminOverride 没有 uuid 和 phone 时不应覆盖 admin', () => {
    vi.stubEnv('VITE_ADMIN_OVERRIDE', 'true')
    vi.stubEnv('VITE_ADMIN_OVERRIDE_UUID', '')
    vi.stubEnv('VITE_ADMIN_OVERRIDE_PHONE', '')
    setMocks({ token: 'tok', user: { uuid: 'u', status: 1, roles: ['user'] } })
    const store = useTourPermissionsStore()
    expect(store.userRoles).not.toContain('admin')
  })

  // allPermissions 合并分支
  it('allPermissions 应合并多角色权限', () => {
    setMocks({
      token: 'tok',
      user: { uuid: 'u', status: 1, roles: ['admin', 'analyst'] },
    })
    const store = useTourPermissionsStore()
    expect(store.allPermissions).toContain('tour:publish')
    expect(store.allPermissions).toContain('platform:config')
  })

  it('默认 user 角色 allPermissions 应只有 tour:view', () => {
    setMocks({ token: 'tok', user: { uuid: 'u', status: 1, roles: ['user'] } })
    const store = useTourPermissionsStore()
    expect(store.allPermissions).toEqual(['tour:view'])
  })

  it('allPermissions 应自动去重', () => {
    setMocks({
      token: 'tok',
      user: { uuid: 'u', status: 1, roles: ['user', 'admin'] },
    })
    const store = useTourPermissionsStore()
    const viewCount = store.allPermissions.filter(p => p === 'tour:view').length
    expect(viewCount).toBe(1)
  })

  // hasPermission / hasAnyPermission / hasAllPermissions / hasRole 实际值
  it('未登录时 hasPermission 应返回 false', () => {
    setMocks({ token: '', user: null })
    const store = useTourPermissionsStore()
    expect(store.hasPermission('tour:view')).toBe(false)
  })

  it('admin 角色 hasPermission 应返回 true', () => {
    setMocks({ token: 'tok', user: { uuid: 'u', status: 1, roles: ['admin'] } })
    const store = useTourPermissionsStore()
    expect(store.hasPermission('platform:config')).toBe(true)
  })

  it('普通 user 没有 platform:config 权限', () => {
    setMocks({ token: 'tok', user: { uuid: 'u', status: 1, roles: ['user'] } })
    const store = useTourPermissionsStore()
    expect(store.hasPermission('platform:config')).toBe(false)
  })

  it('hasAnyPermission 全部不匹配时应返回 false', () => {
    setMocks({ token: 'tok', user: { uuid: 'u', status: 1, roles: ['user'] } })
    const store = useTourPermissionsStore()
    expect(store.hasAnyPermission(['tour:create', 'platform:config'])).toBe(false)
  })

  it('hasAnyPermission 部分匹配时应返回 true', () => {
    setMocks({ token: 'tok', user: { uuid: 'u', status: 1, roles: ['user'] } })
    const store = useTourPermissionsStore()
    expect(store.hasAnyPermission(['tour:view', 'platform:config'])).toBe(true)
  })

  it('hasAllPermissions 部分缺失时应返回 false', () => {
    setMocks({ token: 'tok', user: { uuid: 'u', status: 1, roles: ['user'] } })
    const store = useTourPermissionsStore()
    expect(store.hasAllPermissions(['tour:view', 'platform:config'])).toBe(false)
  })

  it('hasAllPermissions 全部满足时应返回 true', () => {
    setMocks({ token: 'tok', user: { uuid: 'u', status: 1, roles: ['admin'] } })
    const store = useTourPermissionsStore()
    expect(store.hasAllPermissions(['tour:view', 'platform:config'])).toBe(true)
  })

  it('hasAllPermissions 未登录时应返回 false', () => {
    setMocks({ token: '', user: null })
    const store = useTourPermissionsStore()
    expect(store.hasAllPermissions(['tour:view'])).toBe(false)
  })

  it('hasAnyPermission 未登录时应返回 false', () => {
    setMocks({ token: '', user: null })
    const store = useTourPermissionsStore()
    expect(store.hasAnyPermission(['tour:view'])).toBe(false)
  })

  it('hasRole 未登录时应返回 false', () => {
    setMocks({ token: '', user: null })
    const store = useTourPermissionsStore()
    expect(store.hasRole('admin')).toBe(false)
  })

  it('hasRole 应能正确识别 admin 角色', () => {
    setMocks({ token: 'tok', user: { uuid: 'u', status: 1, roles: ['admin'] } })
    const store = useTourPermissionsStore()
    expect(store.hasRole('admin')).toBe(true)
    expect(store.hasRole('operator')).toBe(false)
  })

  // canManage* 计算属性
  it('admin 角色应能管理全部模块', () => {
    setMocks({ token: 'tok', user: { uuid: 'u', status: 1, roles: ['admin'] } })
    const store = useTourPermissionsStore()
    expect(store.canManageTours).toBe(true)
    expect(store.canManageMonitoring).toBe(true)
    expect(store.canManageRecommendations).toBe(true)
    expect(store.canManagePlatforms).toBe(true)
  })

  it('operator 角色应能管理 tour 和 monitoring', () => {
    setMocks({ token: 'tok', user: { uuid: 'u', status: 1, roles: ['operator'] } })
    const store = useTourPermissionsStore()
    expect(store.canManageTours).toBe(true)
    expect(store.canManageMonitoring).toBe(true)
    expect(store.canManageRecommendations).toBe(false)
    expect(store.canManagePlatforms).toBe(false)
  })

  it('analyst 角色应能管理 recommendations 中的 abtest', () => {
    setMocks({ token: 'tok', user: { uuid: 'u', status: 1, roles: ['analyst'] } })
    const store = useTourPermissionsStore()
    expect(store.canManageTours).toBe(false)
    expect(store.canManageRecommendations).toBe(true)
    expect(store.canManagePlatforms).toBe(false)
  })

  it('普通 user 不应有任何管理权限', () => {
    setMocks({ token: 'tok', user: { uuid: 'u', status: 1, roles: ['user'] } })
    const store = useTourPermissionsStore()
    expect(store.canManageTours).toBe(false)
    expect(store.canManageMonitoring).toBe(false)
    expect(store.canManageRecommendations).toBe(false)
    expect(store.canManagePlatforms).toBe(false)
  })

  it('未登录时 canManage* 应全部为 false', () => {
    setMocks({ token: '', user: null })
    const store = useTourPermissionsStore()
    expect(store.canManageTours).toBe(false)
    expect(store.canManageMonitoring).toBe(false)
    expect(store.canManageRecommendations).toBe(false)
    expect(store.canManagePlatforms).toBe(false)
  })

  // checkPermission / checkAnyPermission 函数方法
  it('checkPermission 应返回布尔值', () => {
    setMocks({ token: 'tok', user: { uuid: 'u', status: 1, roles: ['user'] } })
    const store = useTourPermissionsStore()
    expect(store.checkPermission('tour:view')).toBe(true)
    expect(store.checkPermission('platform:config')).toBe(false)
  })

  it('checkAnyPermission 应返回布尔值', () => {
    setMocks({ token: 'tok', user: { uuid: 'u', status: 1, roles: ['user'] } })
    const store = useTourPermissionsStore()
    expect(store.checkAnyPermission(['tour:view'])).toBe(true)
    expect(store.checkAnyPermission(['platform:config'])).toBe(false)
    expect(store.checkAnyPermission([])).toBe(false)
  })

  it('checkPermission 未登录时应返回 false', () => {
    setMocks({ token: '', user: null })
    const store = useTourPermissionsStore()
    expect(store.checkPermission('tour:view')).toBe(false)
  })

  it('checkAnyPermission 未登录时应返回 false', () => {
    setMocks({ token: '', user: null })
    const store = useTourPermissionsStore()
    expect(store.checkAnyPermission(['tour:view'])).toBe(false)
  })

  // 补充剩余分支覆盖
  it('VIP 自动 analyst 角色在已存在时不应重复添加', () => {
    setMocks({
      token: 'tok',
      user: { uuid: 'u', status: 1, roles: ['analyst'] },
      isVipActive: true,
    })
    const store = useTourPermissionsStore()
    const analystCount = store.userRoles.filter(r => r === 'analyst').length
    expect(analystCount).toBe(1)
  })

  it('adminOverride 手机号匹配时 admin 角色已存在则不重复添加', () => {
    vi.stubEnv('VITE_ADMIN_OVERRIDE', 'true')
    vi.stubEnv('VITE_ADMIN_OVERRIDE_PHONE', '13800000000')
    setMocks({
      token: 'tok',
      user: { uuid: 'u', status: 1, phone: '13800000000', roles: ['admin'] },
    })
    const store = useTourPermissionsStore()
    const adminCount = store.userRoles.filter(r => r === 'admin').length
    expect(adminCount).toBe(1)
  })

  it('adminOverride phone 为空字符串时应跳过手机号匹配', () => {
    vi.stubEnv('VITE_ADMIN_OVERRIDE', 'true')
    vi.stubEnv('VITE_ADMIN_OVERRIDE_PHONE', '')
    setMocks({
      token: 'tok',
      user: { uuid: 'u', status: 1, phone: '13800000000', roles: ['user'] },
    })
    const store = useTourPermissionsStore()
    expect(store.userRoles).not.toContain('admin')
  })

  it('adminOverride uuid 匹配时 admin 角色已存在则不重复添加', () => {
    vi.stubEnv('VITE_ADMIN_OVERRIDE', 'true')
    vi.stubEnv('VITE_ADMIN_OVERRIDE_UUID', 'admin-uuid')
    setMocks({
      token: 'tok',
      user: { uuid: 'admin-uuid', status: 1, roles: ['admin'] },
    })
    const store = useTourPermissionsStore()
    const adminCount = store.userRoles.filter(r => r === 'admin').length
    expect(adminCount).toBe(1)
  })

  it('adminOverride uuid 为空字符串时应跳过 uuid 匹配', () => {
    vi.stubEnv('VITE_ADMIN_OVERRIDE', 'true')
    vi.stubEnv('VITE_ADMIN_OVERRIDE_UUID', '')
    setMocks({
      token: 'tok',
      user: { uuid: 'admin-uuid', status: 1, roles: ['user'] },
    })
    const store = useTourPermissionsStore()
    expect(store.userRoles).not.toContain('admin')
  })

  it('adminOverride 用户没有 phone 字段时应不匹配', () => {
    vi.stubEnv('VITE_ADMIN_OVERRIDE', 'true')
    vi.stubEnv('VITE_ADMIN_OVERRIDE_PHONE', '13800000000')
    setMocks({
      token: 'tok',
      user: { uuid: 'u', status: 1, roles: ['user'] },
    })
    const store = useTourPermissionsStore()
    expect(store.userRoles).not.toContain('admin')
  })
})
