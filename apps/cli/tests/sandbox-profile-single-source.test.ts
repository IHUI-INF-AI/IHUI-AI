// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-212 切片:沙盒 profile 枚举域 / 默认值 / 解析的唯一真相源。
 *
 * 这组用例钉四件事,少一件“收成一份出口”就会退化成散文:
 *  1. 五档枚举的取值与顺序被逐字冻结(顺序 = 由严到宽,增删档必须显式改测试);
 *  2. 默认档现读 = `'limited'`(机主 2026-10-22 拍板:默认严档已切换),
 *     且 DEFAULT_SETTINGS 经引用后仍是同一值 ——
 *     本测试只保证“换一处就能全动”,再切换仍须拍板;
 *  3. 非法 profile(拼错/大小写/空白/非字符串)在配置层被拒:环境变量层跳过该键,
 *     合并后保持低层默认值,绝不把自由字符串透传给运行时;
 *  4. settings 模板与首跑模板不再重述字面量,`sandbox/index.ts` 的运行档表与本枚举
 *     双向同集(类型互赋 + 键集相等)—— 两处各拦一次,方向一致。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  SANDBOX_PROFILE_IDS,
  DEFAULT_SANDBOX_PROFILE,
  isSandboxProfile,
  parseSandboxProfile,
  type SandboxProfile,
} from '../src/config/sandbox-profile.js'
import { DEFAULT_SETTINGS, deepMergeAll, parseEnvOverrides } from '../src/config/index.js'
import { SANDBOX_PROFILES, type SandboxProfile as RuntimeSandboxProfile } from '../src/sandbox/index.js'

/** 类型层双向可赋值 = 两份联合逐字同集(typecheck 红即枚举漂移)。 */
const toRuntimeProfile = (p: SandboxProfile): RuntimeSandboxProfile => p
const toConfigProfile = (p: RuntimeSandboxProfile): SandboxProfile => p

function readCode(rel: string): string {
  const src = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
  // 注释不参与:反向锁只判代码里的赋值形态
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

describe('G-212 沙盒 profile 唯一真相源', () => {
  it('① 枚举冻结:五档按由严到宽排列', () => {
    expect([...SANDBOX_PROFILE_IDS]).toEqual(['readonly', 'limited', 'trusted', 'open', 'full'])
  })

  it('② 默认档现读 limited(机主 2026-10-22 拍板:默认严档已切换)', () => {
    expect(DEFAULT_SANDBOX_PROFILE).toBe('limited')
    expect(DEFAULT_SETTINGS.sandbox?.profile).toBe(DEFAULT_SANDBOX_PROFILE)
  })

  it('③ 解析器:合法档逐枚通过,非法值一律 undefined', () => {
    for (const id of SANDBOX_PROFILE_IDS) {
      expect(parseSandboxProfile(id)).toBe(id)
      expect(isSandboxProfile(id)).toBe(true)
    }
    for (const bad of ['strict', 'Trusted', ' trusted', 'trusted ', '', 'limited,trusted', 42, null, undefined, {}, ['trusted']]) {
      expect(parseSandboxProfile(bad as unknown), `非法值 ${JSON.stringify(bad)}`).toBeUndefined()
      expect(isSandboxProfile(bad)).toBe(false)
    }
  })

  it('④ 环境变量层:合法值生效,非法值跳过且合并后保持低层默认', () => {
    expect(parseEnvOverrides({ IHUI_SANDBOX_PROFILE: 'readonly' }).sandbox?.profile).toBe('readonly')

    const bad = parseEnvOverrides({ IHUI_SANDBOX_PROFILE: 'readonly-typo' })
    expect(bad.sandbox?.profile).toBeUndefined()

    const merged = deepMergeAll(DEFAULT_SETTINGS, bad)
    expect(merged.sandbox?.profile).toBe(DEFAULT_SANDBOX_PROFILE)
  })

  it('⑤ 源码反向锁:三处默认值落地只准引常量,不得重述字面量', () => {
    const literal = /profile\s*:\s*'(?:readonly|limited|trusted|open|full)'/
    const files = [
      '../src/config/defaults.ts',
      '../src/commands/first-run.ts',
      '../src/commands/settings.ts',
    ]
    for (const f of files) {
      const code = readCode(f)
      expect(literal.test(code), `${f} 仍在本地写 profile 字面量 ⇒ 请引 DEFAULT_SANDBOX_PROFILE`).toBe(false)
      expect(code.includes('DEFAULT_SANDBOX_PROFILE'), `${f} 未引用 DEFAULT_SANDBOX_PROFILE`).toBe(true)
    }
  })

  it('⑥ 运行档表同集:枚举 ↔ sandbox/index.ts 的 SANDBOX_PROFILES 双向一致', () => {
    expect(Object.keys(SANDBOX_PROFILES).sort()).toEqual([...SANDBOX_PROFILE_IDS].sort())
    for (const id of SANDBOX_PROFILE_IDS) {
      const runtime = SANDBOX_PROFILES[toRuntimeProfile(id)]
      expect(runtime, `运行档表缺 ${id}`).toBeTruthy()
      expect(toConfigProfile(id)).toBe(id)
      expect(runtime.description.length).toBeGreaterThan(0)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
