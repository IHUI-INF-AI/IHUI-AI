// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 兜底鉴权闸的 schema 默认档回归锁(2026-11-01 立,与 admin-totp-default.test.ts 同型)。
 *
 * 缺陷形状:线上那枚 `AUTH_DEFAULT_DENY_MODE=enforce` 只写在**不进仓**的
 * `D:\DevEnv\ihui-prod\apps\api\.env`,而 schema 默认是 `observe`(=不拦人)。于是"生产有没有
 * 这道兜底"取决于一个本地文件是否存在 —— 一次 `.env` 整体替换(2026-09-26 实测过 55 键被清空)
 * 或一次新机重建就静默回到 observe,且什么都不响。
 *
 * 修法与断言口径:默认值随**运行时档位**走(生产 ⇒ enforce,非生产 ⇒ observe),显式声明一律
 * 优先。断言只读 envSchema 的真实解析结果,不在测试里复算默认值(§22c/§0.6)。
 *
 * 用 `ZCODE_RUNTIME_ENV` 而不是 `NODE_ENV` 驱动:后者是 shell 与 Node 生态共用的通用变量,
 * 仓内官方口径是"安全分支只读 `runtimeEnv`"(见 src/config/index.ts 头注),这里就按那条走。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5399/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const CONFIG_MODULE = '../../config/index.js'

async function configWith(envs: Record<string, string | undefined>): Promise<{
  AUTH_DEFAULT_DENY_MODE: string
}> {
  const saved = new Map<string, string | undefined>()
  for (const [k, v] of Object.entries(envs)) {
    saved.set(k, process.env[k])
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  try {
    // 每次重取模块实例:config 是 import 期求值的(envSchema.parse(process.env))
    vi.resetModules()
    const mod = await import(CONFIG_MODULE)
    return mod.config as { AUTH_DEFAULT_DENY_MODE: string }
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}

describe('兜底鉴权闸的默认档随运行时档位走', () => {
  afterEach(() => {
    vi.resetModules()
  })

  it('生产 + 未声明 ⇒ enforce(缺省必须是武装的一档)', async () => {
    const c = await configWith({
      ZCODE_RUNTIME_ENV: 'production',
      AUTH_DEFAULT_DENY_MODE: undefined,
    })
    expect(c.AUTH_DEFAULT_DENY_MODE).toBe('enforce')
  })

  it('非生产 + 未声明 ⇒ observe(不拿没配全的名单误伤本地/测试面)', async () => {
    for (const runtime of ['development', 'test']) {
      const c = await configWith({
        ZCODE_RUNTIME_ENV: runtime,
        AUTH_DEFAULT_DENY_MODE: undefined,
      })
      expect(c.AUTH_DEFAULT_DENY_MODE, runtime).toBe('observe')
    }
  })

  it('显式声明一律优先:生产写 off 就是 off、写 observe 就是 observe(缺省不夺权)', async () => {
    const off = await configWith({
      ZCODE_RUNTIME_ENV: 'production',
      AUTH_DEFAULT_DENY_MODE: 'off',
    })
    expect(off.AUTH_DEFAULT_DENY_MODE).toBe('off')
    const obs = await configWith({
      ZCODE_RUNTIME_ENV: 'production',
      AUTH_DEFAULT_DENY_MODE: 'observe',
    })
    expect(obs.AUTH_DEFAULT_DENY_MODE).toBe('observe')
    const enf = await configWith({
      ZCODE_RUNTIME_ENV: 'development',
      AUTH_DEFAULT_DENY_MODE: 'enforce',
    })
    expect(enf.AUTH_DEFAULT_DENY_MODE).toBe('enforce')
  })

  it('档位名拼错 ⇒ 落回 schema 声明的三档之外会当场报错(z.enum 拒绝未声明值)', async () => {
    // 这一格钉的是"拼错的档位名不会静默变成一个能用的档":z.enum 直接抛,
    // 而不是悄悄落 off/enforce —— 静默落档就是"配置写错却换了个语义"。
    await expect(
      configWith({ ZCODE_RUNTIME_ENV: 'production', AUTH_DEFAULT_DENY_MODE: 'Enforce' }),
    ).rejects.toThrow()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
