/**
 * 最高管理员账号三路登录 + UNIQUE 约束端到端测试 (2026-07-06 立)
 *
 * 覆盖:
 *   1. 三种登录方式都拿到 is_admin=true 同一 user_id
 *      - user_name="admin" + password="admin123"
 *      - phone="18643389808" + password="admin123"
 *      - email="502319984@qq.com" + password="admin123"
 *   2. 错误密码 / 不存在账号 返回非 0 响应
 *
 * 设计说明 (2026-07-06):
 *   全部走 backend API (/api/v1/auth/login), 不依赖浏览器渲染.
 *   用 4 个 test 而非 9 个: 第 1 个 test 验证三路登录 + 唯一性 (3 个请求),
 *   后续 3 个独立 test 各自 1 个请求. 因 backend 对 /api/v1/auth/login 限流
 *   5 req/min/IP (rate_limit.py), 测试间需 sleep 13s 避开.
 *   关闭 retries 避免瞬时 429 触发重试雪崩.
 *
 * 守门:
 *   - pre-commit 脚本 scripts/check-admin-binding.mjs (规则 1-9)
 *   - 本 e2e 验证运行时三种登录都拿 is_admin=true
 *
 * 跑法:
 *   npx playwright test e2e/admin-binding-e2e.spec.ts --project=chromium --retries=0
 *
 * 环境:
 *   需要 dev uvicorn 8000 端口运行 + 最高管理员账号已绑定 (update_admin_account.py 跑过)
 */

import { test, expect, request as playwrightRequest } from '@playwright/test'

const BACKEND = process.env.PW_BACKEND_URL || 'http://127.0.0.1:8000'
const ADMIN_PWD = 'admin123'
const EXPECTED_PHONE = '18643389808'
const EXPECTED_EMAIL = '502319984@qq.com'
const EXPECTED_NICK = '最高管理员'
const EXPECTED_UUID = '00000000-0000-0000-0000-000000000001'

// /api/v1/auth/login 限流 5 req/min/IP. 4 个 test 各发 1-3 个请求, 需 sleep 13s 避开.
// 串行执行, 避免并行触发限流.
test.describe.configure({ mode: 'serial' })

test.describe('最高管理员账号三路登录 + UNIQUE 约束 (2026-07-06)', () => {
  let apiContext: Awaited<ReturnType<typeof playwrightRequest.newContext>>

  test.beforeAll(async () => {
    apiContext = await playwrightRequest.newContext({ baseURL: BACKEND })
  })

  test.afterAll(async () => {
    await apiContext.dispose()
  })

  // 用 13s 间隔避开 5 req/min 限流
  test.afterEach(async () => {
    await new Promise((r) => setTimeout(r, 13_000))
  })

  // ----------------------------------------------------------------------
  // 关键 test 1: 三路登录 + 唯一性, 走完 3 个请求 (test 内部串行, 间 13s)
  // ----------------------------------------------------------------------
  test('三种登录方式 (user_name/phone/email) 都返回 is_admin=true 同一 user_id', async () => {
    const results: Array<{
      account: string
      is_admin: boolean
      uuid: string
      nickname: string
    }> = []

    for (const account of ['admin', EXPECTED_PHONE, EXPECTED_EMAIL]) {
      const res = await apiContext.post('/api/v1/auth/login', {
        data: { phone: account, password: ADMIN_PWD },
      })
      expect(res.status(), `HTTP 应为 200, 实际 ${res.status()}, account=${account}`).toBe(200)
      const body = await res.json()
      expect(String(body.code), `code 应为 0, 实际 ${body.code}, msg=${body.msg}`).toBe('0')
      expect(body.data.user.is_admin, `is_admin 应为 true, account=${account}`).toBe(true)
      expect(body.data.user.nickname, `nickname 应为 ${EXPECTED_NICK}`).toBe(EXPECTED_NICK)
      results.push({
        account,
        is_admin: body.data.user.is_admin,
        uuid: body.data.user.uuid,
        nickname: body.data.user.nickname,
      })
      // 测试内 3 个请求间 sleep 13s
      if (account !== EXPECTED_EMAIL) {
        await new Promise((r) => setTimeout(r, 13_000))
      }
    }

    // 三种登录应返回同一 uuid
    const uniqueUuids = new Set(results.map((r) => r.uuid))
    expect(
      uniqueUuids.size,
      `三种登录应返回同一 uuid, 实际: ${JSON.stringify(results)}`
    ).toBe(1)
    expect(results[0].uuid).toBe(EXPECTED_UUID)
  })

  // ----------------------------------------------------------------------
  // 关键 test 2: 错误密码应被拒
  // ----------------------------------------------------------------------
  test('错误密码应返回非 0 响应', async () => {
    const res = await apiContext.post('/api/v1/auth/login', {
      data: { phone: 'admin', password: 'wrong_pwd_12345' },
    })
    expect(res.status()).toBe(200) // API 用 200 + code 非 0 表示业务错误
    const body = await res.json()
    expect(String(body.code)).not.toBe('0')
    expect(body.msg).toContain('密码')
  })

  // ----------------------------------------------------------------------
  // 关键 test 3: 不存在的手机号应被拒
  // ----------------------------------------------------------------------
  test('不存在的手机号应返回非 0 响应', async () => {
    const res = await apiContext.post('/api/v1/auth/login', {
      data: { phone: '13900000000', password: ADMIN_PWD },
    })
    const body = await res.json()
    expect(String(body.code)).not.toBe('0')
  })

  // ----------------------------------------------------------------------
  // 关键 test 4: 不存在的邮箱应被拒
  // ----------------------------------------------------------------------
  test('不存在的邮箱应返回非 0 响应', async () => {
    const res = await apiContext.post('/api/v1/auth/login', {
      data: { phone: 'no-such-user@notfound.com', password: ADMIN_PWD },
    })
    const body = await res.json()
    expect(String(body.code)).not.toBe('0')
  })
})
