// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, vi } from 'vitest'
import { SANDBOX_PROFILES, resolveSandboxOptions, type SandboxOptions } from '../src/sandbox/index.js'
import { DEFAULT_SANDBOX_PROFILE } from '../src/config/sandbox-profile.js'

describe('SANDBOX_PROFILES 5 级预设', () => {
  it('包含 5 个 profile(readonly/limited/trusted/open/full)', () => {
    expect(Object.keys(SANDBOX_PROFILES).sort()).toEqual(['full', 'limited', 'open', 'readonly', 'trusted'])
  })

  it('readonly 的 commandAllowlist 是 null(= 一律拒绝),不是空数组', () => {
    // 旧值 [] 在判定里等价于"未设置",于是本档描述写的"无 shell 命令"根本不成立。
    // null 才是"显式禁止一切命令"的机器可表达形态。
    expect(SANDBOX_PROFILES.readonly.overrides.commandAllowlist).toBeNull()
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
  it('profile 为 undefined(未配置沙箱)⇒ 按默认严档结算,用户 opts 继续覆盖其上', () => {
    // 旧形态这里 `return userOpts` ⇒ "没配 sandbox" 就是"没有任何限制",
    // 与默认档早已是严档的账面相反。G-212 收尾把默认态收进唯一默认源。
    const userOpts: Partial<SandboxOptions> = { timeoutMs: 5000, commandAllowlist: ['node'] }
    const result = resolveSandboxOptions(undefined, userOpts)
    expect(result.timeoutMs).toBe(5000)
    expect(result.commandAllowlist).toEqual(['node'])
    // 用户没写的键由默认档补齐(凭据 env 屏蔽不得因为"没配置"而消失)
    expect(result.blockedEnvVars).toEqual(SANDBOX_PROFILES[DEFAULT_SANDBOX_PROFILE].overrides.blockedEnvVars)
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

  it('无效 profile 不抛错,按默认严档结算并喊话(绝不返回"无限制")', () => {
    // 旧形态 `return userOpts` = 拼错的档位静默退化成最宽行为(与 readonly/limited 之外
    // 任何一档都不等价)。现与缺档同路:引唯一默认源,另打一行 ASCII 喊话。
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const userOpts: Partial<SandboxOptions> = { timeoutMs: 9999 }
      const result = resolveSandboxOptions('invalid', userOpts)
      expect(result.timeoutMs).toBe(9999)
      expect(result).toEqual({ ...SANDBOX_PROFILES[DEFAULT_SANDBOX_PROFILE].overrides, ...userOpts })
      expect(warn).toHaveBeenCalledTimes(1)
    } finally {
      warn.mockRestore()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
