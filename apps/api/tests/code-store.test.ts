// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach } from 'vitest'
import {
  __test__ as store,
  putCodeEntry,
  getCodeEntry,
  verifyCode,
  generateCode,
  CODE_TTL_MS,
  CODE_TTL_REGISTER_MS,
  CODE_RESEND_INTERVAL_MS,
} from '../src/utils/code-store.js'

/**
 * 验证码存储的契约测试。
 *
 * 2026-10-22 从"进程内 Map 的实现细节测试"改写成"后端无关的契约测试":
 * 存储已经换成 Redis 为主 + 内存兜底,同一套断言必须在**两档后端**上都成立。
 * 跑法(两档各一次,由 REDIS_URL 决定,不需要在源码里开测试专用注入点):
 *   ./node_modules/.bin/vitest run tests/code-store.test.ts                       # 有 Redis ⇒ redis 档
 *   REDIS_URL=redis://127.0.0.1:1/1 ./node_modules/.bin/vitest run tests/code-store.test.ts   # 连不上 ⇒ memory 档
 * 末行的 `store.backend()` 断言会把"这一轮到底测了哪一档"打在结论里 —— 不然两档跑出来
 * 长得一模一样,谁也不知道第二档其实没跑到。
 */

const PHONE = '13800138000'

async function seed(identifier: string, code: string, ttlMs: number, sentAt = Date.now()) {
  await putCodeEntry(identifier, { code, expiresAt: sentAt + ttlMs, sentAt })
}

describe('code-store — 验证码存储与一次性校验', () => {
  beforeEach(async () => {
    await store.reset()
  })

  it('本轮实际使用的后端档位必须等于运行者声明的那一档(覆盖面自证)', async () => {
    // 两档各跑一次时,若不做这条断言,两次运行看起来都是 18/18 绿 —— 谁也不知道
    // "内存兜底"那轮其实偷偷走的还是 Redis。用 IHUI_EXPECT_BACKEND 把期望钉死。
    const expectBackend = process.env.IHUI_EXPECT_BACKEND
    if (!expectBackend) return // 未声明 ⇒ 不判(默认单跑时不断言档位)
    // Redis 客户端是异步就绪的,给一次短轮询,否则冷启动会误读成 memory
    let seen = store.backend()
    for (let i = 0; i < 20 && seen !== expectBackend; i++) {
      await new Promise((r) => setTimeout(r, 100))
      seen = store.backend()
    }
    expect(seen).toBe(expectBackend)
  })

  describe('常量', () => {
    it('CODE_TTL_MS = 5 分钟', () => {
      expect(CODE_TTL_MS).toBe(5 * 60 * 1000)
    })
    it('CODE_TTL_REGISTER_MS = 10 分钟(注册模板 SMS_491200014 对用户的承诺)', () => {
      expect(CODE_TTL_REGISTER_MS).toBe(10 * 60 * 1000)
    })
    it('CODE_RESEND_INTERVAL_MS = 60 秒', () => {
      expect(CODE_RESEND_INTERVAL_MS).toBe(60 * 1000)
    })
  })

  describe('generateCode', () => {
    it('返回 6 位数字字符串', () => {
      expect(generateCode()).toMatch(/^\d{6}$/)
    })
    it('范围在 100000-999999', () => {
      for (let i = 0; i < 50; i++) {
        const n = Number(generateCode())
        expect(n).toBeGreaterThanOrEqual(100000)
        expect(n).toBeLessThanOrEqual(999999)
      }
    })
  })

  describe('存取', () => {
    it('存入后可原样读回', async () => {
      await seed(PHONE, '654321', CODE_TTL_MS)
      const got = await getCodeEntry(PHONE)
      expect(got?.code).toBe('654321')
    })

    it('没存过的标识读出 null', async () => {
      expect(await getCodeEntry('13900000000')).toBeNull()
    })

    it('已过期的读不出来', async () => {
      await seed(PHONE, '111111', -1000)
      expect(await getCodeEntry(PHONE)).toBeNull()
    })

    it('后写入的覆盖先写入的(重发场景)', async () => {
      await seed(PHONE, '111111', CODE_TTL_MS)
      await seed(PHONE, '222222', CODE_TTL_MS)
      expect((await getCodeEntry(PHONE))?.code).toBe('222222')
    })
  })

  describe('verifyCode', () => {
    it('匹配且未过期 ⇒ true,并且一次性消费掉', async () => {
      await seed(PHONE, '246810', CODE_TTL_MS)
      expect(await verifyCode(PHONE, '246810')).toBe(true)
      expect(await store.exists(PHONE)).toBe(false)
    })

    it('同一枚码不能用第二次(一次性是硬要求,不是"尽量")', async () => {
      await seed(PHONE, '135790', CODE_TTL_MS)
      expect(await verifyCode(PHONE, '135790')).toBe(true)
      expect(await verifyCode(PHONE, '135790')).toBe(false)
    })

    it('验证码不存在 ⇒ false', async () => {
      expect(await verifyCode('13700000000', '000000')).toBe(false)
    })

    it('码不匹配 ⇒ false,且原码必须留着(输错一次不该把用户的码烧掉)', async () => {
      await seed(PHONE, '111111', CODE_TTL_MS)
      expect(await verifyCode(PHONE, '999999')).toBe(false)
      expect(await store.exists(PHONE)).toBe(true)
      expect(await verifyCode(PHONE, '111111')).toBe(true)
    })

    it('已过期 ⇒ false', async () => {
      await seed(PHONE, '123123', -1)
      expect(await verifyCode(PHONE, '123123')).toBe(false)
    })

    it('输错 4 次后,正确码仍可通过(计数不该误伤本人)', async () => {
      await seed(PHONE, '246813', CODE_TTL_MS)
      for (let i = 0; i < 4; i += 1) {
        expect(await verifyCode(PHONE, '000000')).toBe(false)
      }
      expect(await verifyCode(PHONE, '246813')).toBe(true)
    })

    it('连续输错 5 次 ⇒ 该码作废,正确码也过不去(防在线枚举)', async () => {
      await seed(PHONE, '135790', CODE_TTL_MS)
      for (let i = 0; i < 5; i += 1) {
        expect(await verifyCode(PHONE, '000000')).toBe(false)
      }
      expect(await verifyCode(PHONE, '135790')).toBe(false)
      expect(await store.exists(PHONE)).toBe(false)
    })

    it('重新取码后计数清零(换码不是接着上一次的失败次数)', async () => {
      await seed(PHONE, '135790', CODE_TTL_MS)
      for (let i = 0; i < 4; i += 1) expect(await verifyCode(PHONE, '000000')).toBe(false)
      await seed(PHONE, '975310', CODE_TTL_MS)
      expect(await verifyCode(PHONE, '975310')).toBe(true)
    })

    it('按场景给的有效期真的生效:注册 10 分钟档在第 7 分钟仍可校验通过', async () => {
      const sentAt = Date.now() - 7 * 60 * 1000
      await seed(PHONE, '777666', CODE_TTL_REGISTER_MS, sentAt)
      expect(await verifyCode(PHONE, '777666')).toBe(true)
    })

    it('对照:5 分钟档在同一第 7 分钟必须判过期(否则上一条测试是空跑)', async () => {
      const sentAt = Date.now() - 7 * 60 * 1000
      await seed(PHONE, '777666', CODE_TTL_MS, sentAt)
      expect(await verifyCode(PHONE, '777666')).toBe(false)
    })

    it('邮箱与手机号同一条通道(key 只是标识符)', async () => {
      await seed('a@b.com', '515151', CODE_TTL_MS)
      expect(await verifyCode('a@b.com', '515151')).toBe(true)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
