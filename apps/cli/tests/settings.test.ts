import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  getSettingsPath,
  loadSettings,
  saveSettingsTemplate,
  resolveEffectiveConfig,
} from '../src/commands/settings.js'

describe('settings 加载/保存/合并', () => {
  let tmpDir: string
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cli-test-'))
    originalEnv = { ...process.env }
    // 用临时 HOME 模拟 ~/.ihui/settings.json
    process.env.HOME = tmpDir
    process.env.USERPROFILE = tmpDir
    process.env.IHUI_API_URL = ''
    process.env.IHUI_API_KEY = ''
    process.env.IHUI_AUDIT = ''
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    process.env = originalEnv
  })

  it('getSettingsPath 返回 ~/.ihui/settings.json', () => {
    const p = getSettingsPath()
    expect(p).toMatch(/settings\.json$/)
  })

  it('loadSettings 在文件不存在时返回 {}', () => {
    const s = loadSettings()
    expect(s).toEqual({})
  })

  it('saveSettingsTemplate --force 覆盖,不带 --force 不覆盖', () => {
    const p = getSettingsPath()
    expect(fs.existsSync(p)).toBe(false)
    expect(saveSettingsTemplate(false)).toBe(true)
    expect(fs.existsSync(p)).toBe(true)
    expect(saveSettingsTemplate(false)).toBe(false)
    expect(saveSettingsTemplate(true)).toBe(true)
    const content = JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>
    expect(content.auditEnabled).toBe(true)
    expect(content.allowDangerous).toBe(false)
  })

  it('resolveEffectiveConfig 优先级:CLI flag > settings > env > 默认', () => {
    process.env.IHUI_API_URL = 'http://env-host:1234'
    process.env.IHUI_API_KEY = 'env-key'
    const p = getSettingsPath()
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, JSON.stringify({ apiUrl: 'http://settings-host:5678' }))

    // CLI > settings
    const r1 = resolveEffectiveConfig({ cliApiUrl: 'http://cli-host:9999' })
    expect(r1.apiUrl).toBe('http://cli-host:9999')

    // settings > env
    const r2 = resolveEffectiveConfig({})
    expect(r2.apiUrl).toBe('http://settings-host:5678')

    // env > default
    fs.unlinkSync(p)
    const r3 = resolveEffectiveConfig({})
    expect(r3.apiUrl).toBe('http://env-host:1234')

    // default
    process.env.IHUI_API_URL = ''
    const r4 = resolveEffectiveConfig({})
    expect(r4.apiUrl).toBe('http://localhost:8000')
    expect(r4.maxIterations).toBe(25)
    expect(r4.auditEnabled).toBe(true)
  })

  it('maxIterations 非法值回退到 25', () => {
    const r1 = resolveEffectiveConfig({ cliMaxIterations: 'abc' })
    expect(r1.maxIterations).toBe(25)
    const r2 = resolveEffectiveConfig({ cliMaxIterations: '50' })
    expect(r2.maxIterations).toBe(50)
  })

  it('auditEnabled=false 显式关闭', () => {
    const p = getSettingsPath()
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, JSON.stringify({ auditEnabled: false }))
    const r = resolveEffectiveConfig({})
    expect(r.auditEnabled).toBe(false)
  })
})
