// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-212(第十一批·沙箱默认严档)收尾用例:钉"默认态不得落宽松档"这一条验收判据。
 *
 * 立因(2026-10-25 现读):默认档常量早在 2026-10-22 就切成 `'limited'`,但**运行时**从没
 * 按它结算过 ——
 *   - `resolveSandboxOptions()` 旧形态对 `undefined` 与"配置里写错的档位字符串"一律
 *     `return userOpts`,而调用方传的就是 `settings.sandbox ?? {}` ⇒ 白名单没设、
 *     凭据 env 没屏蔽 = 五档之外的最宽行为;
 *   - `commands/agent.ts` 构造 ctx 时又写作 `sandbox: settings.sandbox ? {…} : undefined`,
 *     于是"没有 settings.json"(首跑 / CI / 新环境的常态,V1 `loadSettings()` 不并
 *     DEFAULT_SETTINGS)这一条路径连 profile 都拿不到,沙盒整块不生效。
 * 账面写严档、运行时无限制,是 §0.3「没判绝不写成判过」的同型(判据存在但不接线 = 没有)。
 *
 * 本文件只钉四件事:缺档 ⇒ 默认档;坏档 ⇒ 默认档且不静默;用户显式选的宽松档照办;
 * 用户显式 opts 仍覆盖档表。取值一律 import 源模块导出的常量/档表(§22c,禁止复制判据),
 * "宽松档"由枚举表的展示序(由严到宽)推出来,不写档位名字面量。
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { DEFAULT_SANDBOX_PROFILE, SANDBOX_PROFILE_IDS } from '../src/config/sandbox-profile.js'
import { DEFAULT_SETTINGS } from '../src/config/index.js'
import { SANDBOX_PROFILES, resolveSandboxOptions } from '../src/sandbox/index.js'

/** 默认档的档表基础值(唯一取法:引常量查表,不在本文件重述档位)。 */
const defaultOverrides = SANDBOX_PROFILES[DEFAULT_SANDBOX_PROFILE].overrides

/** 枚举序上比默认档更宽的那些档 = 用户可显式选择、本票不许动宽松面的集合。 */
const looserThanDefault = SANDBOX_PROFILE_IDS.slice(
  SANDBOX_PROFILE_IDS.indexOf(DEFAULT_SANDBOX_PROFILE) + 1,
)

function readCode(rel: string): string {
  const src = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
  // 注释不参与:反向锁只判代码里的形态(与 sandbox-profile-single-source.test.ts 同一把尺)
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

describe('G-212 沙箱默认严档:缺配置/坏配置都不得落宽松档', () => {
  it('① 默认档自身必须是"严"的形态:有界白名单 + 非空凭据屏蔽', () => {
    // 宽松档的形态特征是 commandAllowlist/blockedEnvVars 缺席(open/full),
    // 所以"默认档是否严"必须量这两把,而不是只读一个档位名。
    expect(Array.isArray(defaultOverrides.commandAllowlist)).toBe(true)
    expect((defaultOverrides.commandAllowlist as string[]).length).toBeGreaterThan(0)
    expect(defaultOverrides.blockedEnvVars?.length).toBeGreaterThan(0)
  })

  it('② 配置缺失(settings 里没有 sandbox 段)⇒ 结算 = 默认档,绝不是"无限制"', () => {
    const resolved = resolveSandboxOptions(undefined, {})
    expect(resolved).toEqual(defaultOverrides)
    // 反向断言:旧形态在这里返回的是传进来的空对象 ⇒ 白名单/凭据屏蔽双双"未设置"
    expect(resolved.commandAllowlist).not.toBeUndefined()
    expect(resolved.blockedEnvVars).not.toBeUndefined()
  })

  it('③ 坏档(拼错/大小写/别的合法词)⇒ 同一默认档 + 一行喊话,不静默也不放行', () => {
    expect(looserThanDefault.length, '枚举表序须保证默认档之后还有更宽的档').toBeGreaterThan(0)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      for (const bad of ['limted', 'Trusted', ' limited', 'open,full', 'strict', 'default']) {
        const resolved = resolveSandboxOptions(bad, {})
        expect(resolved, `坏档 ${JSON.stringify(bad)} 不得落成无限制`).toEqual(defaultOverrides)
      }
      expect(warn.mock.calls.length, '未知档必须逐枚喊话(失效方向是多喊一次)').toBeGreaterThanOrEqual(
        6,
      )
      // 空串按"未配置"处理(不喊话),结果同样是默认档
      warn.mockClear()
      expect(resolveSandboxOptions('', {})).toEqual(defaultOverrides)
      expect(warn.mock.calls.length).toBe(0)
    } finally {
      warn.mockRestore()
    }
  })

  it('④ 用户显式选择的宽松档照办 —— 本票收紧的是默认态,不替用户收权', () => {
    for (const id of looserThanDefault) {
      expect(resolveSandboxOptions(id, {})).toEqual(SANDBOX_PROFILES[id].overrides)
    }
    // 显式 opts 仍覆盖档表基础值(三处调用方都把 settings.sandbox 整体当 userOpts 传入)
    const withOpts = resolveSandboxOptions(undefined, { timeoutMs: 1_234 })
    expect(withOpts.timeoutMs).toBe(1_234)
    expect(withOpts.commandAllowlist).toEqual(defaultOverrides.commandAllowlist)
  })

  it('⑤ 引用面形状锁:agent.ts 不得再把 ctx.sandbox 挂回 settings.sandbox 的存在性', () => {
    const code = readCode('../src/commands/agent.ts')
    expect(code.includes('resolveSandboxOptions('), 'agent.ts 必须经默认源结算').toBe(true)
    expect(
      /sandbox:\s*settings\.sandbox\s*\?/.test(code),
      'agent.ts 仍在按"配置里有没有 sandbox 段"决定沙盒是否生效 ⇒ 缺配置即无限制,违规',
    ).toBe(false)
  })

  it('⑥ 档位类型单一落点:sandbox/index.ts 不得再自述第二份联合', () => {
    const code = readCode('../src/sandbox/index.ts')
    expect(
      /export type SandboxProfile\s*=/.test(code),
      'sandbox/index.ts 又写了一份档位联合 ⇒ 两份必然漂移(§0.6)',
    ).toBe(false)
    expect(code.includes("from '../config/sandbox-profile.js'"), '运行档表必须引配置层默认源').toBe(
      true,
    )
    // 档表与枚举双向同集(与既有 sandbox-profile-single-source.test.ts ⑥ 同一判据,不新造尺)
    expect(Object.keys(SANDBOX_PROFILES).sort()).toEqual([...SANDBOX_PROFILE_IDS].sort())
  })

  it('⑦ DEFAULT_SETTINGS 仍经引用带出默认档(改一处全生效)', () => {
    expect(DEFAULT_SETTINGS.sandbox?.profile).toBe(DEFAULT_SANDBOX_PROFILE)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
