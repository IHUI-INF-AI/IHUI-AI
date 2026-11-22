// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { handleConfigCommand } from '../src/commands/config-cmd.js'
import {
  getSettingsPath,
  loadSettings,
  readSettingsObjectForUpdate,
  saveSettingsTemplate,
  resolveEffectiveConfig,
} from '../src/commands/settings.js'
import { recordInstall } from '../src/lib/registry-client.js'
import { addTask } from '../src/commands/tasks.js'

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

  it('损坏的配置即使 --force 也不覆盖', () => {
    const p = getSettingsPath()
    fs.mkdirSync(path.dirname(p), { recursive: true })
    const body = '{not json'
    fs.writeFileSync(p, body)
    expect(() => saveSettingsTemplate(true)).toThrow(/不能把它覆盖成新内容/)
    expect(fs.readFileSync(p, 'utf-8')).toBe(body)
  })

  it('空白设置当成没有,损坏内容不能被 /config set 收掉', () => {
    const p = getSettingsPath()
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, '  \n')
    expect(readSettingsObjectForUpdate(p)).toEqual({ state: 'missing' })
    const body = '{not json'
    fs.writeFileSync(p, body)
    expect(() => handleConfigCommand('set locale zh-CN')).toThrow(/不能把它覆盖成新内容 \(corrupt\)/)
    expect(fs.readFileSync(p, 'utf-8')).toBe(body)
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
    expect(r4.apiUrl).toBe('http://localhost:8802')
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

describe('安装清单损坏时不覆盖', () => {
  it('损坏的安装清单不会被记成只剩这一条', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-registry-installs-'))
    const corrupt = path.join(dir, 'corrupt.json')
    const body = '{not json'
    fs.writeFileSync(corrupt, body, 'utf-8')
    try {
      expect(() =>
        recordInstall(
          { sourceType: 'skill', sourceId: 'demo', version: '1.0.0', installedAt: '2026-11-06T00:00:00.000Z' },
          corrupt,
        ),
      ).toThrow(/不能把它说成没有已装项 \(corrupt\)/)
      expect(fs.readFileSync(corrupt, 'utf-8')).toBe(body)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('任务库根不是对象时不覆盖', () => {
  it('数组根不会被收成只剩新的一条', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-tasks-array-'))
    const prevHome = process.env.HOME
    const prevProfile = process.env.USERPROFILE
    process.env.HOME = dir
    process.env.USERPROFILE = dir
    const file = path.join(dir, '.ihui', 'tasks.json')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const body = '[]'
    fs.writeFileSync(file, body, 'utf-8')
    try {
      expect(() => addTask(dir, '新任务')).toThrow(/不是对象/)
      expect(fs.readFileSync(file, 'utf-8')).toBe(body)
    } finally {
      if (prevHome === undefined) delete process.env.HOME
      else process.env.HOME = prevHome
      if (prevProfile === undefined) delete process.env.USERPROFILE
      else process.env.USERPROFILE = prevProfile
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
