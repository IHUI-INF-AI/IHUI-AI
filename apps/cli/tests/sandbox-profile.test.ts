import { describe, expect, it } from 'vitest'
import { SANDBOX_PROFILES, resolveSandboxOptions, type SandboxOptions } from '../src/sandbox/index.js'

describe('SANDBOX_PROFILES 5 级预设', () => {
  it('包含 5 个 profile(readonly/limited/trusted/open/full)', () => {
    expect(Object.keys(SANDBOX_PROFILES).sort()).toEqual(['full', 'limited', 'open', 'readonly', 'trusted'])
  })

  it('readonly 的 commandAllowlist 是空数组', () => {
    expect(SANDBOX_PROFILES.readonly.overrides.commandAllowlist).toEqual([])
  })

  it('limited 的 commandAllowlist 包含 node/npm/pnpm', () => {
    const list = SANDBOX_PROFILES.limited.overrides.commandAllowlist!
    expect(list).toContain('node')
    expect(list).toContain('npm')
    expect(list).toContain('pnpm')
  })

  it('limited 的 blockedEnvVars 包含 *_API_KEY', () => {
    expect(SANDBOX_PROFILES.limited.overrides.blockedEnvVars).toContain('*_API_KEY')
  })

  it('trusted 的 timeoutMs = 120_000', () => {
    expect(SANDBOX_PROFILES.trusted.overrides.timeoutMs).toBe(120_000)
  })

  it('open 没有设置 commandAllowlist(允许全部)', () => {
    expect(SANDBOX_PROFILES.open.overrides.commandAllowlist).toBeUndefined()
  })

  it('full 没有任何 blockedEnvVars', () => {
    expect(SANDBOX_PROFILES.full.overrides.blockedEnvVars).toBeUndefined()
  })
})

describe('resolveSandboxOptions', () => {
  it('profile 为 undefined 时返回原 userOpts(同一引用)', () => {
    const userOpts: Partial<SandboxOptions> = { timeoutMs: 5000, commandAllowlist: ['node'] }
    expect(resolveSandboxOptions(undefined, userOpts)).toBe(userOpts)
  })

  it("profile='readonly' 且 opts 为空时返回 readonly 的 overrides", () => {
    const result = resolveSandboxOptions('readonly', {})
    expect(result).toEqual(SANDBOX_PROFILES.readonly.overrides)
  })

  it("profile='trusted' 时用户 opts 的 timeoutMs 覆盖 profile", () => {
    const result = resolveSandboxOptions('trusted', { timeoutMs: 200_000 })
    expect(result.timeoutMs).toBe(200_000)
  })

  it("profile='limited' 时用户 opts 的 commandAllowlist 覆盖 profile", () => {
    const result = resolveSandboxOptions('limited', { commandAllowlist: ['custom'] })
    expect(result.commandAllowlist).toEqual(['custom'])
  })

  it("无效 profile 不报错,返回原 opts(同一引用)", () => {
    const userOpts: Partial<SandboxOptions> = { timeoutMs: 9999 }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(resolveSandboxOptions('invalid' as any, userOpts)).toBe(userOpts)
  })
})
