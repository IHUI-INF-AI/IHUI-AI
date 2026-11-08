// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SDB-33:支付宝 OAuth 的签名 timestamp 必须与 `+08:00` 时区一致(按支付宝规范)。
 *
 * 旧实现 `new Date().toISOString().replace(/\.\d{3}Z$/, '+08:00')` 把 **UTC 墙钟**
 * 贴上 `+08:00` 标签,形式还是 ISO 8601;网关按 GMT+8 校验时恒偏 8 小时。
 * 修复后 OAuth 两处共用 alipay.ts 的 formatTimestamp(GMT+8 `yyyy-MM-dd HH:mm:ss`)。
 *
 * 与既有 alipay-timestamp 测试同口径:固定瞬间 + 硬编码北京真值作 oracle,
 * 并在 UTC / 本地时区两档下逐字相同。
 */
import { describe, it, expect, afterAll } from 'vitest'
import { alipayOAuthTimestamp } from '../oauth-providers.js'

const ORIGINAL_TZ = process.env.TZ
const BEIJING_MIDNIGHT = 1764000000000
const BEIJING_MIDNIGHT_TEXT = '2025-11-25 00:00:00'

afterAll(() => {
  if (ORIGINAL_TZ === undefined) {
    delete process.env.TZ
  } else {
    process.env.TZ = ORIGINAL_TZ
  }
})

describe('支付宝 OAuth 签名 timestamp', () => {
  it('UTC 宿主时区下仍是北京时间 yyyy-MM-dd HH:mm:ss(不是 UTC 墙钟)', () => {
    process.env.TZ = 'UTC'
    expect(alipayOAuthTimestamp(new Date(BEIJING_MIDNIGHT))).toBe(BEIJING_MIDNIGHT_TEXT)
  })

  it('本地宿主时区(Asia/Shanghai)同一瞬间输出逐字相同', () => {
    process.env.TZ = 'Asia/Shanghai'
    expect(alipayOAuthTimestamp(new Date(BEIJING_MIDNIGHT))).toBe(BEIJING_MIDNIGHT_TEXT)
  })

  it('形状符合协议,绝不是 ISO 8601 + 伪 +08:00 后缀', () => {
    for (const zone of ['UTC', 'Asia/Shanghai']) {
      process.env.TZ = zone
      const ts = alipayOAuthTimestamp(new Date())
      expect(ts).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
      expect(ts).not.toMatch(/T.*\+08:00/)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
