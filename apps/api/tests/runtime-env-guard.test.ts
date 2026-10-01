// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 运行档位判据的安全面测试(G-998138,b76-09b 票3,2026-09-30)。
 *
 * 钉三件事:
 *  ① 安全分支的档位来源:csrf / agents / auth-extended 三个文件**不得**再出现
 *     `process.env.NODE_ENV` 直接读(验收①的四处归零,含 auth-extended 的 devCode 档);
 *  ② 缺省方向:清空 NODE_ENV / ZCODE_RUNTIME_ENV 后加载 config,isProductionGuard === true
 *     (fail-safe 方向 —— 部署链漏设变量时守卫宁可误开,不可静默跳过);
 *  ③ 声明表对账:解析器产出 ⊆ RUNTIME_ENV_VALUES 闭集,显式注入口 ZCODE_RUNTIME_ENV
 *     优先于过渡期兼容的 NODE_ENV(对照 config/host-timezone.json"声明与实测对账"的做法)。
 *
 * 注意:本测试只判**代码缺省方向**,不断言本机部署通道是否设过 NODE_ENV(那台机器未取证)。
 * 凭据约束:本文件不输出任何 cookie/JWT 值。
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveEffectiveNodeEnv, RUNTIME_ENV_VALUES } from '../src/config/index.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const API_SRC = resolve(HERE, '../src')

/** ① 验收①钉进测试:三个安全消费点不得再直接读原始 NODE_ENV。 */
describe('安全分支不得直接读原始 NODE_ENV', () => {
  const CASES = [
    'plugins/csrf.ts',
    'routes/agents.ts',
    'routes/auth-extended.ts',
  ] as const

  for (const rel of CASES) {
    it(`${rel} 归零`, () => {
      const src = readFileSync(resolve(API_SRC, rel), 'utf8')
      expect(src.includes('process.env.NODE_ENV'), `${rel} 仍在直接读 NODE_ENV`).toBe(false)
    })
  }
})

/** ③ 声明表对账 + ② 缺省方向(解析器层面)。 */
describe('resolveEffectiveNodeEnv —— 声明表对账与缺省方向', () => {
  it('产出恒在声明表闭集内(对账尺子)', () => {
    const corpus = [
      'production',
      'development',
      'test',
      'PRODUCTION', // 大小写不做宽容:声明表外的值不认
      'staging',
      '',
      '   ',
      undefined,
    ]
    for (const raw of corpus) {
      const env: Record<string, string | undefined> = {
        ZCODE_RUNTIME_ENV: raw,
        NODE_ENV: undefined,
      }
      expect(RUNTIME_ENV_VALUES).toContain(resolveEffectiveNodeEnv(env))
    }
  })

  it('ZCODE_RUNTIME_ENV 显式注入优先于 NODE_ENV', () => {
    expect(
      resolveEffectiveNodeEnv({ ZCODE_RUNTIME_ENV: 'production', NODE_ENV: 'development' }),
    ).toBe('production')
    expect(
      resolveEffectiveNodeEnv({ ZCODE_RUNTIME_ENV: 'development', NODE_ENV: 'production' }),
    ).toBe('development')
  })

  it('声明表外的注入值不认(落到下一档,不盲信)', () => {
    expect(
      resolveEffectiveNodeEnv({ ZCODE_RUNTIME_ENV: 'staging', NODE_ENV: 'development' }),
    ).toBe('development')
  })

  it('缺省方向:两变量都缺 ⇒ production(fail-safe)', () => {
    expect(resolveEffectiveNodeEnv({})).toBe('production')
    expect(resolveEffectiveNodeEnv({ NODE_ENV: undefined, ZCODE_RUNTIME_ENV: undefined })).toBe(
      'production',
    )
  })

  it('空白值视同未设置(不得把 " " 当显式声明)', () => {
    expect(resolveEffectiveNodeEnv({ ZCODE_RUNTIME_ENV: '  ', NODE_ENV: ' ' })).toBe('production')
  })
})

/** ② 缺省方向(真 config 模块层面):清空 NODE_ENV 后动态加载,isProductionGuard === true。 */
describe('config 模块缺省方向(真实加载)', () => {
  const savedEnv: Record<string, string | undefined> = {}
  // 强密钥语料:守卫为 production 档时 JWT/CREDENTIALS 的弱密钥拒绝会生效 ——
  // setup-env 注入的 'test-' 前缀占位密钥正是被拒对象,这里换强语料让 config 能加载完成
  // (弱密钥被拒本身就是缺省方向 fail-safe 的一部分,由解析器层面的用例另钉)。
  const STRONG_SECRET = 'runtime-env-guard-strong-secret-0123456789abcdef'
  const GUARD_SENSITIVE_VARS = ['JWT_SECRET', 'CREDENTIALS_ENCRYPTION_KEY'] as const

  beforeEach(() => {
    for (const name of ['NODE_ENV', 'ZCODE_RUNTIME_ENV', ...GUARD_SENSITIVE_VARS]) {
      savedEnv[name] = process.env[name]
      delete process.env[name]
    }
    for (const name of GUARD_SENSITIVE_VARS) process.env[name] = STRONG_SECRET
    vi.resetModules()
  })

  afterEach(() => {
    for (const [name, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    vi.resetModules()
  })

  it('清空 NODE_ENV / ZCODE_RUNTIME_ENV 加载 config ⇒ isProductionGuard === true', async () => {
    const fresh = await import('../src/config/index.js')
    expect(fresh.isProductionGuard).toBe(true)
    expect(fresh.runtimeEnv).toBe('production')
  })

  it('显式 development 档加载 config ⇒ 守卫关(dev 语义不回归)', async () => {
    process.env.NODE_ENV = 'development'
    const fresh = await import('../src/config/index.js')
    expect(fresh.isProductionGuard).toBe(false)
    expect(fresh.isDevelopmentRuntime).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
