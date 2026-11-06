// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * BUG-0042 — 用户全局层运行时类型校验(`config/validate.ts`)。
 *
 * 判据式用例:把票面点名的三类非法值(`maxIterations: "abc"` / 负数、`sampler.temperature: "high"`)
 * 写进 `~/.ihui/settings.json` ⇒ 合入结果回落 DEFAULT_SETTINGS 且逐键点名;
 * 另配阳性对照:合法值原样生效(校验器不是"全局层什么都别想写")。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { validateSettingsValues } from '../src/config/validate.js'
import { loadConfig } from '../src/config/index.js'
import { DEFAULT_SETTINGS } from '../src/config/defaults.js'

describe('validateSettingsValues 纯函数', () => {
  it('maxIterations 非数字("abc")⇒ 丢弃并点名,期望可读', () => {
    const { value, warnings } = validateSettingsValues({ maxIterations: 'abc' })
    expect(value.maxIterations).toBeUndefined()
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('maxIterations')
    expect(warnings[0]).toContain('"abc"')
    expect(warnings[0]).toContain('正整数')
  })

  it('maxIterations 负数/零 ⇒ 丢弃并点名;正整数原样通过', () => {
    expect(validateSettingsValues({ maxIterations: -1 }).value.maxIterations).toBeUndefined()
    expect(validateSettingsValues({ maxIterations: 0 }).value.maxIterations).toBeUndefined()
    expect(validateSettingsValues({ maxIterations: 40 }).value.maxIterations).toBe(40)
  })

  it('sampler.temperature "high" / 越界 ⇒ 只丢该子键,同对象其他合法子键保留', () => {
    const badType = validateSettingsValues({ sampler: { temperature: 'high' } })
    expect(badType.value.sampler).toEqual({})
    expect(badType.warnings[0]).toContain('sampler.temperature')
    expect(badType.warnings[0]).toContain('0–2')

    const outOfRange = validateSettingsValues({ sampler: { temperature: 3, maxTokens: 2048 } })
    expect(outOfRange.value.sampler).toEqual({ maxTokens: 2048 })
    expect(outOfRange.warnings).toHaveLength(1)

    const ok = validateSettingsValues({ sampler: { temperature: 0.2, maxTokens: 2048 } })
    expect(ok.warnings).toEqual([])
    expect(ok.value.sampler).toEqual({ temperature: 0.2, maxTokens: 2048 })
  })

  it('布尔/枚举型:locale 越界、yolo 非布尔 ⇒ 丢弃;合法值(含全局层专属键)原样通过', () => {
    const bad = validateSettingsValues({ locale: 'fr', yolo: 'yes' })
    expect(bad.value).toEqual({})
    expect(bad.warnings.map((w) => w.split('=')[0])).toEqual([
      '[config] 键 locale',
      '[config] 键 yolo',
    ])

    const ok = validateSettingsValues({
      locale: 'en',
      yolo: true,
      permissionMode: 'default',
      sampler: { temperature: 0.2 },
    })
    expect(ok.warnings).toEqual([])
    expect(ok.value).toEqual({
      locale: 'en',
      yolo: true,
      permissionMode: 'default',
      sampler: { temperature: 0.2 },
    })
  })

  it('未知键原样保留(全局层无封闭白名单需求;本票只判类型,如实不装作全覆盖)', () => {
    const { value, warnings } = validateSettingsValues({ myCustomExtension: { a: 1 } })
    expect(warnings).toEqual([])
    expect(value.myCustomExtension).toEqual({ a: 1 })
  })
})

describe('loadConfig 端到端:全局层非法值回落默认并大声点名', () => {
  let tmpProject: string
  let tmpHome: string
  let origHome: string | undefined
  let origUserProfile: string | undefined
  let warnLines: string[]
  let origWarn: typeof console.warn

  beforeEach(() => {
    tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cfg-valid-proj-'))
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cfg-valid-home-'))
    origHome = process.env.HOME
    origUserProfile = process.env.USERPROFILE
    process.env.HOME = tmpHome
    process.env.USERPROFILE = tmpHome
    warnLines = []
    origWarn = console.warn
    console.warn = (...args: unknown[]) => {
      warnLines.push(args.map(String).join(' '))
    }
    fs.mkdirSync(path.join(tmpHome, '.ihui'), { recursive: true })
  })

  afterEach(() => {
    console.warn = origWarn
    if (origHome === undefined) delete process.env.HOME
    else process.env.HOME = origHome
    if (origUserProfile === undefined) delete process.env.USERPROFILE
    else process.env.USERPROFILE = origUserProfile
    fs.rmSync(tmpProject, { recursive: true, force: true })
    fs.rmSync(tmpHome, { recursive: true, force: true })
  })

  it('票面复现:{"maxIterations": "abc", "sampler": {"temperature": "high"}} ⇒ 回落默认且告警点名两键', () => {
    fs.writeFileSync(
      path.join(tmpHome, '.ihui', 'settings.json'),
      JSON.stringify({ maxIterations: 'abc', sampler: { temperature: 'high' } }),
    )
    const cfg = loadConfig({ cwd: tmpProject })
    expect(cfg.maxIterations).toBe(DEFAULT_SETTINGS.maxIterations)
    expect(cfg.sampler?.temperature).toBe(DEFAULT_SETTINGS.sampler?.temperature)
    const flat = warnLines.join('\n')
    expect(flat).toContain('maxIterations')
    expect(flat).toContain('sampler.temperature')
    expect(flat).toContain('未通过类型校验')
  })

  it('阳性对照:全局层合法值照常生效(校验器没把正常路径一起砸了)', () => {
    fs.writeFileSync(
      path.join(tmpHome, '.ihui', 'settings.json'),
      JSON.stringify({ maxIterations: 40, sampler: { temperature: 0.2 } }),
    )
    const cfg = loadConfig({ cwd: tmpProject })
    expect(cfg.maxIterations).toBe(40)
    expect(cfg.sampler?.temperature).toBe(0.2)
    expect(warnLines).toEqual([])
  })

  // BUG-0042:结构 schema 的三态 —— 文件不存在=静默;语法错/根形态错=可读告警 + 空层。
  it('文件不存在 ⇒ 静默(不是错误,不告警)', () => {
    const cfg = loadConfig({ cwd: tmpProject })
    expect(cfg.maxIterations).toBe(DEFAULT_SETTINGS.maxIterations)
    expect(warnLines).toEqual([])
  })

  it('JSON 语法错 ⇒ 告警点名文件路径与"不是合法 JSON",该层按空处理', () => {
    fs.writeFileSync(path.join(tmpHome, '.ihui', 'settings.json'), '{"maxIterations": 40,')
    const cfg = loadConfig({ cwd: tmpProject })
    expect(cfg.maxIterations).toBe(DEFAULT_SETTINGS.maxIterations)
    const flat = warnLines.join('\n')
    expect(flat).toContain('不是合法 JSON')
    expect(flat).toContain(path.join(tmpHome, '.ihui', 'settings.json'))
  })

  it('根节点是数组/标量 ⇒ 告警说明实际形态,该层按空处理', () => {
    fs.writeFileSync(path.join(tmpHome, '.ihui', 'settings.json'), JSON.stringify([{ maxIterations: 40 }]))
    const cfg = loadConfig({ cwd: tmpProject })
    expect(cfg.maxIterations).toBe(DEFAULT_SETTINGS.maxIterations)
    const flat = warnLines.join('\n')
    expect(flat).toContain('根节点必须是 JSON 对象')
    expect(flat).toContain('数组')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
