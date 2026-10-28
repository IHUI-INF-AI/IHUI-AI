// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Turnstile「未配置即放行」这一格的可见性锁(2026-10-28)。
 *
 * 钉三件事，缺一不算锁住：
 *  1. 行为方向不变：缺 TURNSTILE_SECRET_KEY 时仍返回 success:true。
 *     这条断言**刻意钉住放行**，不是认可放行 —— 密钥属机主侧凭据，agent 无权代填，
 *     把它翻成 fail-closed 只会在 .env 被整体清空时把全站登录一起打死(2026-09-26 那一型)。
 *     要改方向必须连同 check-env-drift 的判序一起改，不许单方面"更安全"。
 *  2. 命中该分支必须留下 warn —— 原来这条分支一句都不记，"人机验证其实不在岗"是静默的。
 *  3. 只报一次，不逐请求刷 —— 否则攻击者冲 /auth 就能把日志当放大面。
 * 反向对照：密钥在位时不得出现这条 warn(证明它对应的是"防线不在岗"而不是泛用告警)。
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { logger } from '../src/utils/logger.js'
import { verifyTurnstile, __test__ } from '../src/services/turnstile-service.js'

const ORIGINAL_SECRET = process.env.TURNSTILE_SECRET_KEY
const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => logger)

beforeEach(() => {
  __test__.resetMissingSecretWarning()
  warnSpy.mockClear()
})

afterAll(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.TURNSTILE_SECRET_KEY
  else process.env.TURNSTILE_SECRET_KEY = ORIGINAL_SECRET
  warnSpy.mockRestore()
})

describe('verifyTurnstile — TURNSTILE_SECRET_KEY 缺失', () => {
  beforeEach(() => {
    delete process.env.TURNSTILE_SECRET_KEY
  })

  it('方向不变：仍放行（改方向须连巡检判序一起改，不许单方面 fail-closed）', async () => {
    expect(await verifyTurnstile('tok-1', '1.2.3.4')).toEqual({ success: true })
  })

  it('放行必须留痕：记一条 warn', async () => {
    await verifyTurnstile('tok-1', '1.2.3.4')
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain('TURNSTILE_SECRET_KEY')
  })

  it('不逐请求刷屏：同一进程内反复命中只报一次', async () => {
    for (let i = 0; i < 5; i++) {
      expect(await verifyTurnstile(`tok-${i}`, '1.2.3.4')).toEqual({ success: true })
    }
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })
})

describe('verifyTurnstile — 密钥在位（反向对照）', () => {
  it('不得出现「防线不在岗」这条 warn', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret-not-used-outbound'
    // token 为空时在出站之前就返回，不触碰网络
    expect(await verifyTurnstile('', '1.2.3.4')).toEqual({
      success: false,
      errorCodes: ['missing-token'],
    })
    expect(warnSpy).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
