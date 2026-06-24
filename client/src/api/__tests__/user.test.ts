import { describe, it, expect, vi, beforeEach } from 'vitest'
import { COZE_PATHS, LOGIN_PWD_PATHS } from '@/config/backend-paths'

// mock request：既是函数又挂载 get/post/put/delete 方法
vi.mock('@/utils/request', () => {
  const fn = vi.fn()
  ;(fn as any).get = vi.fn()
  ;(fn as any).post = vi.fn()
  ;(fn as any).put = vi.fn()
  ;(fn as any).delete = vi.fn()
  return { default: fn }
})

// mock i18n 避免 t 函数依赖完整 i18n 初始化
vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }))

// mock logger 避免日志输出干扰测试
vi.mock('@/utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

// mock storage 避免 setPwd 动态 import 报错
vi.mock('@/utils/storage', () => ({
  StorageManager: { getItem: vi.fn().mockReturnValue(null) },
  STORAGE_KEYS: { TEMP_AUTH_KEY: 'TEMP_AUTH_KEY' },
}))

// mock shared-services 的 refreshAuthToken
vi.mock('@aizhs/shared-services', () => ({
  refreshAuthToken: vi.fn(),
}))

import request from '@/utils/request'
import { refreshAuthToken } from '@aizhs/shared-services'
import * as userApi from '../user'

// 构造 axios 风格的成功响应
const ok = (data: any = {}) => ({ data: { code: 200, data, message: 'success' } })

describe('user', () => {
  it('应该导出API', () => {
    expect(true).toBe(true)
  })
})

describe('user API 函数', () => {
  beforeEach(() => {
    vi.mocked(request).mockReset()
    vi.mocked(request.get).mockReset()
    vi.mocked(request.post).mockReset()
    vi.mocked(request.put).mockReset()
    vi.mocked(request.delete).mockReset()
    vi.mocked(refreshAuthToken).mockReset()
  })

  // ============ 用户信息相关 ============

  it('getUserInfo 调用 GET /user/info 并返回数据', async () => {
    vi.mocked(request.get).mockResolvedValueOnce(ok({ nickname: '张三' }))
    const res = await userApi.getUserInfo()
    expect(request.get).toHaveBeenCalledWith('/user/info', { base: 2 })
    expect(res.success).toBe(true)
    expect(res.data).toMatchObject({ nickname: '张三' })
  })

  it('getUserInfo 请求失败返回 500', async () => {
    // 用 mockRejectedValue 让重试也失败（withApiResponseHandler 默认重试 1 次）
    vi.mocked(request.get).mockRejectedValue(new Error('网络错误'))
    const res = await userApi.getUserInfo()
    expect(res.code).toBe(500)
    expect(res.success).toBe(false)
  })

  it('updateUserInfo 调用 PUT /user/profile 并传递数据', async () => {
    vi.mocked(request.put).mockResolvedValueOnce(ok({ nickname: '新名字' }))
    const res = await userApi.updateUserInfo({ nickname: '新名字' })
    expect(request.put).toHaveBeenCalledWith('/user/profile', { nickname: '新名字' })
    expect(res.success).toBe(true)
  })

  it('getUserAuthInfo 调用 GET /user/auth', async () => {
    vi.mocked(request.get).mockResolvedValueOnce(ok({ realName: '张三' }))
    const res = await userApi.getUserAuthInfo()
    expect(request.get).toHaveBeenCalledWith('/user/auth', {})
    expect(res.success).toBe(true)
  })

  it('submitUserAuth 调用 POST /user/auth 并传递认证数据', async () => {
    vi.mocked(request.post).mockResolvedValueOnce(ok(true))
    const res = await userApi.submitUserAuth({ realName: '张三', idCard: '110101199001011234' })
    expect(request.post).toHaveBeenCalledWith('/user/auth', { realName: '张三', idCard: '110101199001011234' })
    expect(res.success).toBe(true)
  })

  // ============ 资金 / VIP 相关 ============

  it('getUserCoins 调用 GET /api/v1/user/coins 并传递 params', async () => {
    vi.mocked(request.get).mockResolvedValueOnce(ok({ balance: 100 }))
    const res = await userApi.getUserCoins({ userId: 'u1' })
    expect(request.get).toHaveBeenCalledWith('/api/v1/user/coins', { params: { userId: 'u1' } })
    expect(res.success).toBe(true)
  })

  it('getUserFundInfo 调用 GET /user/fund', async () => {
    vi.mocked(request.get).mockResolvedValueOnce(ok({ balance: 1000 }))
    const res = await userApi.getUserFundInfo()
    expect(request.get).toHaveBeenCalledWith('/user/fund', {})
    expect(res.success).toBe(true)
  })

  it('getUserVipInfo 调用 GET /user/vip', async () => {
    vi.mocked(request.get).mockResolvedValueOnce(ok({ vipLevelName: '黄金会员' }))
    const res = await userApi.getUserVipInfo()
    expect(request.get).toHaveBeenCalledWith('/user/vip', {})
    expect(res.success).toBe(true)
  })

  it('getUserLoginLogs 调用 GET /user/login-logs 并传递分页参数', async () => {
    vi.mocked(request.get).mockResolvedValueOnce(ok({ list: [], total: 0 }))
    const res = await userApi.getUserLoginLogs({ page: 1, pageSize: 10 })
    expect(request.get).toHaveBeenCalledWith('/user/login-logs', { params: { page: 1, pageSize: 10 } })
    expect(res.success).toBe(true)
  })

  it('getUserThirdPartyAccounts 调用 GET /user/third-party-accounts', async () => {
    vi.mocked(request.get).mockResolvedValueOnce(ok([]))
    const res = await userApi.getUserThirdPartyAccounts()
    expect(request.get).toHaveBeenCalledWith('/user/third-party-accounts', {})
    expect(res.success).toBe(true)
  })

  it('bindThirdPartyAccount 调用 POST /user/bind-third-party', async () => {
    vi.mocked(request.post).mockResolvedValueOnce(ok(true))
    const res = await userApi.bindThirdPartyAccount({ platform: 'wechat', code: 'c1' })
    expect(request.post).toHaveBeenCalledWith('/user/bind-third-party', { platform: 'wechat', code: 'c1' })
    expect(res.success).toBe(true)
  })

  it('unbindThirdPartyAccount 调用 DELETE /user/unbind-third-party/{id}', async () => {
    vi.mocked(request.delete).mockResolvedValueOnce(ok(true))
    const res = await userApi.unbindThirdPartyAccount('acc-1')
    expect(request.delete).toHaveBeenCalledWith('/user/unbind-third-party/acc-1')
    expect(res.success).toBe(true)
  })

  it('getVipLevels 调用 GET /vip/levels', async () => {
    vi.mocked(request.get).mockResolvedValueOnce(ok([]))
    const res = await userApi.getVipLevels()
    expect(request.get).toHaveBeenCalledWith('/vip/levels', {})
    expect(res.success).toBe(true)
  })

  it('getVipProducts 调用 GET /vip/products', async () => {
    vi.mocked(request.get).mockResolvedValueOnce(ok([]))
    const res = await userApi.getVipProducts()
    expect(request.get).toHaveBeenCalledWith('/vip/products', {})
    expect(res.success).toBe(true)
  })

  it('purchaseVip 调用 POST /vip/purchase 并传递购买数据', async () => {
    vi.mocked(request.post).mockResolvedValueOnce(ok({ orderId: 'o1' }))
    const res = await userApi.purchaseVip({ vipLevelId: 'v1', paymentMethod: 'alipay' })
    expect(request.post).toHaveBeenCalledWith('/vip/purchase', { vipLevelId: 'v1', paymentMethod: 'alipay' })
    expect(res.success).toBe(true)
  })

  // ============ 密码 / 验证码相关 ============

  it('changePassword 调用 PUT /api/v1/auth/profile/password', async () => {
    // 2026-06-24 源码对齐后端: PUT /api/v1/auth/profile/password (Body: old_password, new_password)
    vi.mocked(request.put).mockResolvedValueOnce(ok(true))
    const res = await userApi.changePassword({ oldPassword: 'old', newPassword: 'new' })
    expect(request.put).toHaveBeenCalledWith('/api/v1/auth/profile/password', { old_password: 'old', new_password: 'new' })
    expect(res.success).toBe(true)
  })

  it('resetPassword 调用 POST /user/reset-password', async () => {
    vi.mocked(request.post).mockResolvedValueOnce(ok(true))
    const res = await userApi.resetPassword({ email: 'a@b.com', code: '1234', newPassword: 'new' })
    expect(request.post).toHaveBeenCalledWith('/user/reset-password', { email: 'a@b.com', code: '1234', newPassword: 'new' })
    expect(res.success).toBe(true)
  })

  it('sendVerificationCode 调用 POST /user/send-code', async () => {
    vi.mocked(request.post).mockResolvedValueOnce(ok({ codeId: 'c1' }))
    const res = await userApi.sendVerificationCode({ type: 'email', target: 'a@b.com' })
    expect(request.post).toHaveBeenCalledWith('/user/send-code', { type: 'email', target: 'a@b.com' })
    expect(res.success).toBe(true)
  })

  it('verifyCode 调用 POST /user/verify-code', async () => {
    vi.mocked(request.post).mockResolvedValueOnce(ok(true))
    const res = await userApi.verifyCode({ codeId: 'c1', code: '1234' })
    expect(request.post).toHaveBeenCalledWith('/user/verify-code', { codeId: 'c1', code: '1234' })
    expect(res.success).toBe(true)
  })

  it('updatePassword 调用 PUT /api/v1/auth/profile/password', async () => {
    // 2026-06-24 源码对齐后端: PUT /api/v1/auth/profile/password (Body: old_password, new_password)
    vi.mocked(request.put).mockResolvedValueOnce(ok(true))
    const res = await userApi.updatePassword({ oldPassword: 'old', newPassword: 'new' })
    expect(request.put).toHaveBeenCalledWith('/api/v1/auth/profile/password', { old_password: 'old', new_password: 'new' })
    expect(res.success).toBe(true)
  })

  // ============ 账号注销相关 ============

  it('deleteAccount 调用 POST /user/delete-account', async () => {
    vi.mocked(request.post).mockResolvedValueOnce(ok(true))
    const res = await userApi.deleteAccount({ password: 'pwd', reason: '不用了' })
    expect(request.post).toHaveBeenCalledWith('/user/delete-account', { password: 'pwd', reason: '不用了' })
    expect(res.success).toBe(true)
  })

  it('getAccountDeletionStatus 调用 GET /user/deletion-status', async () => {
    vi.mocked(request.get).mockResolvedValueOnce(ok({ status: 'pending' }))
    const res = await userApi.getAccountDeletionStatus()
    expect(request.get).toHaveBeenCalledWith('/user/deletion-status', {})
    expect(res.success).toBe(true)
  })

  it('cancelAccountDeletion 调用 POST /user/cancel-deletion', async () => {
    vi.mocked(request.post).mockResolvedValueOnce(ok(true))
    const res = await userApi.cancelAccountDeletion()
    expect(request.post).toHaveBeenCalledWith('/user/cancel-deletion', {})
    expect(res.success).toBe(true)
  })

  // ============ 登录 / 注册相关 ============

  it('login 调用 POST /auth/login 并传递登录数据', async () => {
    vi.mocked(request.post).mockResolvedValueOnce(ok({ token: 't1', refreshToken: 'r1', expiresIn: 3600, tokenType: 'Bearer' }))
    const res = await userApi.login({ username: 'user1', password: 'pwd' })
    expect(request.post).toHaveBeenCalledWith('/auth/login', { username: 'user1', password: 'pwd' })
    expect(res.success).toBe(true)
  })

  it('logout 调用 POST /api/v1/auth/logout', async () => {
    // 2026-06-24 源码恢复调用后端 /api/v1/auth/logout 使 token 加入黑名单
    vi.mocked(request.post).mockResolvedValueOnce(ok(true))
    const res = await userApi.logout()
    expect(request.post).toHaveBeenCalledWith('/api/v1/auth/logout', {})
    expect(res.success).toBe(true)
    expect(res.code).toBe(200)
  })

  it('register 调用 POST /auth/register 并传递必填字段', async () => {
    vi.mocked(request.post).mockResolvedValueOnce(ok({ token: 't1' }))
    const res = await userApi.register({ username: 'u1', password: 'p1', email: 'a@b.com' })
    expect(request.post).toHaveBeenCalledWith('/auth/register', { username: 'u1', password: 'p1', email: 'a@b.com' })
    expect(res.success).toBe(true)
  })

  it('register 可选字段正确传递', async () => {
    vi.mocked(request.post).mockResolvedValueOnce(ok({}))
    await userApi.register({ username: 'u1', password: 'p1', email: 'a@b.com', phone: '13800138000', code: '1234', captcha: 'cap', inviteCode: 'inv' })
    expect(request.post).toHaveBeenCalledWith('/auth/register', {
      username: 'u1', password: 'p1', email: 'a@b.com',
      phone: '13800138000', code: '1234', captcha: 'cap', inviteCode: 'inv',
    })
  })

  it('checkWechatLoginStatus 调用 GET /api/auth/wechat/check 并传递 code', async () => {
    vi.mocked(request.get).mockResolvedValueOnce(ok({ status: 'ok' }))
    const res = await userApi.checkWechatLoginStatus('wx-code')
    expect(request.get).toHaveBeenCalledWith('/api/auth/wechat/check?code=wx-code', {})
    expect(res.success).toBe(true)
  })

  // ============ 手机登录相关 ============

  it('sendPhoneLoginCode 调用 POST smsVerify 并清理手机号', async () => {
    vi.mocked(request.post).mockResolvedValueOnce(ok('sent'))
    const res = await userApi.sendPhoneLoginCode('13800138000')
    expect(request.post).toHaveBeenCalledWith(
      LOGIN_PWD_PATHS.smsVerify,
      { phone: '13800138000' },
      { headers: { 'platform-type': 'web' } }
    )
    expect(res.success).toBe(true)
  })

  it('sendPhoneLoginCode 去除 +86 前缀', async () => {
    vi.mocked(request.post).mockResolvedValueOnce(ok('sent'))
    await userApi.sendPhoneLoginCode('+86 13800138000')
    expect(request.post).toHaveBeenCalledWith(
      LOGIN_PWD_PATHS.smsVerify,
      { phone: '13800138000' },
      { headers: { 'platform-type': 'web' } }
    )
  })

  it('verifyPhoneCode 调用 POST verify 并返回临时密钥', async () => {
    vi.mocked(request.post).mockResolvedValueOnce(ok('temp-key'))
    const res = await userApi.verifyPhoneCode({ phone: '13800138000', code: '1234' })
    expect(request.post).toHaveBeenCalledWith(
      LOGIN_PWD_PATHS.verify,
      { phone: '13800138000', code: '1234' },
      { headers: { 'platform-type': 'web' } }
    )
    expect(res.success).toBe(true)
    expect(res.data).toBe('temp-key')
  })

  it('phoneLogin 是 verifyPhoneCode 的别名', () => {
    expect(userApi.phoneLogin).toBe(userApi.verifyPhoneCode)
  })

  it('completePhoneLogin 调用 request POST registerLogin', async () => {
    vi.mocked(request).mockResolvedValueOnce(ok({ token: 't1' }))
    const res = await userApi.completePhoneLogin({ phone: '13800138000', tempKey: 'tk1' })
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      url: LOGIN_PWD_PATHS.registerLogin,
      method: 'POST',
      data: expect.objectContaining({ phone: '13800138000', password: '', parentId: '', openId: '' }),
      headers: { EditAuth: 'tk1', 'platform-type': 'web' },
    }))
    expect(res.success).toBe(true)
  })

  // ============ 第三方登录相关 ============

  it('handleThirdPartyCallback 调用 POST /auth/third-party/callback', async () => {
    vi.mocked(request.post).mockResolvedValueOnce(ok({ token: 't1' }))
    const res = await userApi.handleThirdPartyCallback({ platform: 'wechat', code: 'c1' })
    expect(request.post).toHaveBeenCalledWith('/auth/third-party/callback', { platform: 'wechat', code: 'c1' })
    expect(res.success).toBe(true)
  })

  it('getThirdPartyLoginConfig 调用 GET /auth/third-party/config', async () => {
    vi.mocked(request.get).mockResolvedValueOnce(ok({ wechat: { enabled: true, appId: 'wx' } }))
    const res = await userApi.getThirdPartyLoginConfig()
    expect(request.get).toHaveBeenCalledWith('/auth/third-party/config', {})
    expect(res.success).toBe(true)
  })

  // ============ 订单 / Coze 相关 ============

  it('getUserOrders 调用 GET /user/orders 并传递 params', async () => {
    vi.mocked(request.get).mockResolvedValueOnce(ok([]))
    const res = await userApi.getUserOrders({ page: 1, pageSize: 10, status: 'paid' })
    expect(request.get).toHaveBeenCalledWith('/user/orders', { params: { page: 1, pageSize: 10, status: 'paid' } })
    expect(res.success).toBe(true)
  })

  it('getUserCozeInfo 调用 request GET meCoze', async () => {
    vi.mocked(request).mockResolvedValueOnce(ok({ id: '1', name: 'coze-user' }))
    const res = await userApi.getUserCozeInfo()
    expect(request).toHaveBeenCalledWith({ url: COZE_PATHS.users.meCoze, method: 'GET', base: 3 })
    expect(res.success).toBe(true)
  })

  it('bindUserNew 调用 POST users/bind', async () => {
    vi.mocked(request.post).mockResolvedValueOnce(ok({}))
    const res = await userApi.bindUserNew({ username: 'u1', phone: '13800138000', avatarUrl: 'url', fileName: 'f.png' })
    expect(request.post).toHaveBeenCalledWith(COZE_PATHS.users.bind, { username: 'u1', phone: '13800138000', avatarUrl: 'url', fileName: 'f.png' })
    expect(res.success).toBe(true)
  })

  it('setEmail 调用 POST setEmail', async () => {
    vi.mocked(request.post).mockResolvedValueOnce(ok({}))
    const res = await userApi.setEmail({ uuid: 'u1', email: 'a@b.com' })
    expect(request.post).toHaveBeenCalledWith(LOGIN_PWD_PATHS.setEmail, { uuid: 'u1', email: 'a@b.com' })
    expect(res.success).toBe(true)
  })

  it('setPwd 调用 POST modifyPassword 并传递密码数据', async () => {
    vi.mocked(request.post).mockResolvedValueOnce(ok({}))
    const res = await userApi.setPwd({ phone: '13800138000', password: 'pwd' })
    expect(request.post).toHaveBeenCalledWith(
      LOGIN_PWD_PATHS.modifyPassword,
      { phone: '13800138000', password: 'pwd', uuid: undefined },
      undefined
    )
    expect(res.success).toBe(true)
  })

  // ============ refreshToken ============

  it('refreshToken 调用 refreshAuthToken 并返回 token 数据', async () => {
    vi.mocked(refreshAuthToken).mockResolvedValueOnce({
      code: 200,
      success: true,
      message: 'success',
      data: { token: 'new-token', refreshToken: 'new-refresh', expiresIn: 3600 },
      timestamp: Date.now(),
    } as any)
    const res = await userApi.refreshToken('old-refresh')
    expect(refreshAuthToken).toHaveBeenCalled()
    expect(res.success).toBe(true)
    expect(res.data).toMatchObject({ token: 'new-token' })
  })

  // ============ uploadAvatar ============

  it('uploadAvatar 上传成功并更新用户头像', async () => {
    // 第一次请求：文件上传
    vi.mocked(request.post).mockResolvedValueOnce(ok({ url: 'http://img.com/avatar.png' }))
    // 第二次请求：更新用户信息
    vi.mocked(request.put).mockResolvedValueOnce(ok({ avatar: 'http://img.com/avatar.png' }))
    const file = new File(['content'], 'avatar.png', { type: 'image/png' })
    const res = await userApi.uploadAvatar(file)
    expect(res.success).toBe(true)
    expect(res.data.url).toBe('http://img.com/avatar.png')
  })

  // ============ uploadAvatar 边界场景 ============

  it('uploadAvatar 上传成功但更新用户信息失败时返回上传URL', async () => {
    // 上传成功
    vi.mocked(request.post).mockResolvedValueOnce(ok({ url: 'http://img.com/avatar.png' }))
    // 更新失败（非 200）
    vi.mocked(request.put).mockResolvedValueOnce({ data: { code: 500, data: null, message: 'fail' } })
    const file = new File(['content'], 'avatar.png', { type: 'image/png' })
    const res = await userApi.uploadAvatar(file)
    expect(res.success).toBe(true)
    expect(res.data.url).toBe('http://img.com/avatar.png')
  })

  it('uploadAvatar 上传失败抛出错误', async () => {
    // 上传失败（非 200）
    vi.mocked(request.post).mockResolvedValueOnce({ data: { code: 500, data: null, message: 'fail' } })
    const file = new File(['content'], 'avatar.png', { type: 'image/png' })
    const res = await userApi.uploadAvatar(file)
    expect(res.success).toBe(false)
  })

  // ============ sendPhoneLoginCode 边界场景 ============

  it('sendPhoneLoginCode 传入 tempId 和 tempCode 正确传递', async () => {
    vi.mocked(request.post).mockResolvedValueOnce(ok('sent'))
    await userApi.sendPhoneLoginCode('13800138000', 123, 'tempCode1')
    expect(request.post).toHaveBeenCalledWith(
      LOGIN_PWD_PATHS.smsVerify,
      { phone: '13800138000', tempId: 123, tempCode: 'tempCode1' },
      { headers: { 'platform-type': 'web' } }
    )
  })

  it('sendPhoneLoginCode 空字符串 tempCode 不传递', async () => {
    vi.mocked(request.post).mockResolvedValueOnce(ok('sent'))
    await userApi.sendPhoneLoginCode('13800138000', 123, '   ')
    expect(request.post).toHaveBeenCalledWith(
      LOGIN_PWD_PATHS.smsVerify,
      { phone: '13800138000', tempId: 123 },
      { headers: { 'platform-type': 'web' } }
    )
  })

  it('sendPhoneLoginCode 86 前缀 13 位手机号会被剥离', async () => {
    vi.mocked(request.post).mockResolvedValueOnce(ok('sent'))
    await userApi.sendPhoneLoginCode('8613800138000')
    expect(request.post).toHaveBeenCalledWith(
      LOGIN_PWD_PATHS.smsVerify,
      { phone: '13800138000' },
      { headers: { 'platform-type': 'web' } }
    )
  })

  // ============ verifyPhoneCode 边界场景 ============

  it('verifyPhoneCode 去除 +86 前缀', async () => {
    vi.mocked(request.post).mockResolvedValueOnce(ok('temp-key'))
    await userApi.verifyPhoneCode({ phone: '+86 13800138000', code: '1234' })
    expect(request.post).toHaveBeenCalledWith(
      LOGIN_PWD_PATHS.verify,
      { phone: '13800138000', code: '1234' },
      { headers: { 'platform-type': 'web' } }
    )
  })

  it('verifyPhoneCode 后端返回字符串 code 时正确解析', async () => {
    // 模拟后端返回的格式：{ code: "200", msg: "ok", data: "temp-key" }
    vi.mocked(request.post).mockResolvedValueOnce({
      data: { code: '200', msg: 'ok', data: 'temp-key' },
    } as any)
    const res = await userApi.verifyPhoneCode({ phone: '13800138000', code: '1234' })
    expect(res.success).toBe(true)
    expect(res.data).toBe('temp-key')
  })

  it('verifyPhoneCode 验证失败时返回失败响应', async () => {
    // 模拟后端返回失败（重试机制会再次调用，因此用 mockImplementation 始终返回失败）
    vi.mocked(request.post).mockImplementation(async () => ({
      data: { code: 500, msg: '验证码错误', data: '' },
    }) as any)
    const res = await userApi.verifyPhoneCode({ phone: '13800138000', code: '0000' })
    expect(res.success).toBe(false)
    vi.mocked(request.post).mockReset()
  })

  // ============ completePhoneLogin 边界场景 ============

  it('completePhoneLogin 传入 platformType 和 unionId', async () => {
    vi.mocked(request).mockResolvedValueOnce(ok({ token: 't1' }))
    await userApi.completePhoneLogin({
      phone: '13800138000',
      tempKey: 'tk1',
      platformType: 'wechat',
      unionId: 'union-1',
    })
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      url: LOGIN_PWD_PATHS.registerLogin,
      method: 'POST',
      data: expect.objectContaining({
        phone: '13800138000',
        'platform-type': 'wechat',
        unionId: 'union-1',
      }),
      headers: expect.objectContaining({ EditAuth: 'tk1', 'platform-type': 'wechat' }),
    }))
  })

  it('completePhoneLogin 去除 +86 前缀', async () => {
    vi.mocked(request).mockResolvedValueOnce(ok({ token: 't1' }))
    await userApi.completePhoneLogin({ phone: '+86 13800138000', tempKey: 'tk1' })
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ phone: '13800138000' }),
    }))
  })

  it('completePhoneLogin 处理后端返回字符串 code', async () => {
    // 模拟后端原始 axios 响应：response.data 是 { code: "200", msg: "ok", data: {...} }
    vi.mocked(request).mockResolvedValueOnce({
      data: { code: '200', msg: 'ok', data: { token: 't1' } },
    } as any)
    const res = await userApi.completePhoneLogin({ phone: '13800138000', tempKey: 'tk1' })
    expect(res.success).toBe(true)
  })

  it('completePhoneLogin 返回数据包含 token/user/refreshToken 时正确记录日志', async () => {
    // response.data 是标准后端格式，包含完整登录数据，触发 token/user/refreshToken 日志分支
    vi.mocked(request).mockResolvedValueOnce({
      data: {
        code: 200,
        msg: 'ok',
        data: {
          token: 'tk',
          refreshToken: 'rt',
          user: { id: 'u1', username: 'u1' },
        },
      },
    } as any)
    const res = await userApi.completePhoneLogin({ phone: '13800138000', tempKey: 'tk1' })
    expect(res.success).toBe(true)
  })

  it('completePhoneLogin response.data 不是标准格式时走 normalizeApiResponse 分支', async () => {
    // response.data 不是带 code/msg 的对象，触发 else 分支
    vi.mocked(request).mockResolvedValueOnce({
      data: 'plain-string',
    } as any)
    const res = await userApi.completePhoneLogin({ phone: '13800138000', tempKey: 'tk1' })
    expect(res).toBeDefined()
  })

  // ============ refreshToken 边界场景 ============

  it('refreshToken data 是字符串时正确处理', async () => {
    vi.mocked(refreshAuthToken).mockResolvedValueOnce({
      code: 200,
      success: true,
      message: 'ok',
      data: 'raw-token-string',
      timestamp: Date.now(),
    } as any)
    const res = await userApi.refreshToken('old-refresh')
    expect(res.success).toBe(true)
    expect(res.data.token).toBe('raw-token-string')
    expect(res.data.tokenType).toBe('Bearer')
  })

  it('refreshToken 使用 accessToken/refresh_token/expires_in/token_type 备用字段', async () => {
    vi.mocked(refreshAuthToken).mockResolvedValueOnce({
      code: 200,
      success: true,
      message: 'ok',
      data: {
        access_token: 'access-tk',
        refresh_token: 'refresh-tk-new',
        expires_in: 7200,
        token_type: 'MAC',
      },
      timestamp: Date.now(),
    } as any)
    const res = await userApi.refreshToken('old-refresh')
    expect(res.success).toBe(true)
    expect(res.data.token).toBe('access-tk')
    expect(res.data.refreshToken).toBe('refresh-tk-new')
    expect(res.data.expiresIn).toBe(7200)
    expect(res.data.tokenType).toBe('MAC')
  })

  it('refreshToken response.code 为字符串时转换', async () => {
    vi.mocked(refreshAuthToken).mockResolvedValueOnce({
      code: '200',
      message: 'ok',
      data: { token: 't1' },
    } as any)
    const res = await userApi.refreshToken('old-refresh')
    expect(res.code).toBe(200)
    expect(res.success).toBe(true)
  })

  it('refreshToken response.success 缺省时根据 code 判断', async () => {
    vi.mocked(refreshAuthToken).mockResolvedValueOnce({
      code: 200,
      message: 'ok',
      data: { token: 't1' },
    } as any)
    const res = await userApi.refreshToken('old-refresh')
    expect(res.success).toBe(true)
  })

  // ============ setPwd 边界场景 ============

  it('setPwd 存在 TEMP_AUTH_KEY 时带上 EditAuth 头', async () => {
    // 重新 mock storage 使其返回有效值
    const { StorageManager } = await import('@/utils/storage')
    vi.mocked(StorageManager.getItem).mockReturnValueOnce('temp-auth-value')
    vi.mocked(request.post).mockResolvedValueOnce(ok({}))
    const res = await userApi.setPwd({ phone: '13800138000', password: 'pwd' })
    expect(request.post).toHaveBeenCalledWith(
      LOGIN_PWD_PATHS.modifyPassword,
      { phone: '13800138000', password: 'pwd', uuid: undefined },
      { headers: { EditAuth: 'temp-auth-value' } }
    )
    expect(res.success).toBe(true)
  })
})
