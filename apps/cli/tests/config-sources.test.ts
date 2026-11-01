// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * A19 配置出处探针 sourcesFor 测试(MECHANISM-SPEC-5 §A19 落点 5)。
 * 三条语义各一用例:
 *   ① 只有一层给值 ⇒ 该层是唯一来源;
 *   ② 多层给值 ⇒ 数组顺序 = 优先级降序,且长度 = 贡献层数(不得压成一条);
 *   ③ 来自磁盘的层必带非空 originFile(非磁盘层不带)。
 * 本票"只加读路不改行为":loadConfig 的实际合并值与探针最高优先级条目必须同源一致,
 * 由用例②的交叉断言钉住。
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { clearSessionConfig, loadConfig, sourcesFor } from '../src/config/index.js'

describe('sourcesFor(A19 配置出处探针)', () => {
  let tmpHome: string
  let tmpCwd: string
  let originalEnv: NodeJS.ProcessEnv

  /**
   * 布置一个"五层都给 locale 值"的场景(cli/env/project/global/defaults)。
   * 用非敏感键 locale(在 PROJECT_ALLOWED_SETTINGS_KEYS 内,且 DEFAULT_SETTINGS、
   * ENV_MAPPING 均有落点):这样 project 层不会被 SECURITY_SENSITIVE_SETTINGS_KEYS 拒绝,
   * 五层来源才能都出现 —— apiUrl 等安全敏感键正是"项目层必须拒绝"的新策略,不应用它构造来源。
   */
  function seedLocaleLayers(): void {
    fs.mkdirSync(path.join(tmpHome, '.ihui'), { recursive: true })
    fs.writeFileSync(
      path.join(tmpHome, '.ihui', 'settings.json'),
      JSON.stringify({ locale: 'en' }),
    )
    fs.mkdirSync(path.join(tmpCwd, '.ihui'), { recursive: true })
    fs.writeFileSync(
      path.join(tmpCwd, '.ihui', 'settings.json'),
      JSON.stringify({ locale: 'ja' }),
    )
    process.env.IHUI_LOCALE = 'ko'
  }

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-src-home-'))
    tmpCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-src-cwd-'))
    originalEnv = { ...process.env }
    process.env.HOME = tmpHome
    process.env.USERPROFILE = tmpHome
    for (const k of Object.keys(process.env)) {
      if (k.toUpperCase().startsWith('IHUI_')) delete process.env[k]
    }
    clearSessionConfig()
  })

  afterEach(() => {
    process.env = originalEnv
    fs.rmSync(tmpHome, { recursive: true, force: true })
    fs.rmSync(tmpCwd, { recursive: true, force: true })
    clearSessionConfig()
  })

  it('① 只有一层给值 ⇒ 该层是唯一来源', () => {
    // 该键不在 DEFAULT_SETTINGS / 磁盘文件 / env 中,只有 cli 层给出
    const r = sourcesFor('onlyFromCliKey', {
      cwd: tmpCwd,
      cliArgs: { onlyFromCliKey: 'x' },
    })
    expect(r).toHaveLength(1)
    expect(r[0]!.layer).toBe('cli')
    expect(r[0]!.value).toBe('x')
  })

  it('② 多层给值 ⇒ 顺序 = 优先级降序,长度 = 贡献层数(不得压成一条)', () => {
    // 用非敏感键 locale 构造五层来源(apiUrl 等安全敏感键已在项目层被拒绝,
    // 见 SECURITY_SENSITIVE_SETTINGS_KEYS —— 这正是新策略想要的行为,不能用来测来源)。
    seedLocaleLayers()
    const opts = { cwd: tmpCwd, cliArgs: { locale: 'zh-TW' } }
    const r = sourcesFor('locale', opts)
    expect(r).toHaveLength(5)
    expect(r.map((e) => e.layer)).toEqual(['cli', 'env', 'project', 'global', 'defaults'])
    expect(r.map((e) => e.value)).toEqual([
      'zh-TW',
      'ko',
      'ja',
      'en',
      'zh-CN',
    ])
    // 探针与行为同源:最高优先级条目的值必须等于 loadConfig 实际生效值
    expect(r[0]!.value).toBe(loadConfig(opts).locale)
  })

  it('③ 来自磁盘的层必带非空 originFile;非磁盘层不带', () => {
    seedLocaleLayers()
    const r = sourcesFor('locale', { cwd: tmpCwd, cliArgs: { locale: 'zh-TW' } })
    const disk = r.filter((e) => e.layer === 'global' || e.layer === 'project')
    expect(disk).toHaveLength(2)
    for (const e of disk) {
      expect(typeof e.originFile).toBe('string')
      expect(e.originFile).not.toBe('')
    }
    expect(disk.find((e) => e.layer === 'global')!.originFile).toBe(
      path.join(tmpHome, '.ihui', 'settings.json'),
    )
    expect(disk.find((e) => e.layer === 'project')!.originFile).toBe(
      path.join(tmpCwd, '.ihui', 'settings.json'),
    )
    // cli/env/defaults 非磁盘层不得伪造来源文件
    for (const e of r.filter((x) => x.layer !== 'global' && x.layer !== 'project')) {
      expect(e.originFile).toBeUndefined()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
