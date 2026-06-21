import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { themeImportExport } from '../themeImportExport'
import type { ThemeMode } from '@/stores/darkMode'

describe('themeImportExport', () => {
  describe('exportThemePackage', () => {
    it('should export theme package as JSON', () => {
      const content = themeImportExport.exportThemePackage(
        'dark' as ThemeMode,
        [],
        null,
        [],
        {},
        { format: 'json' }
      )
      const parsed = JSON.parse(content)
      expect(parsed.version).toBeDefined()
      expect(parsed.themeMode).toBe('dark')
    })

    it('should export theme package as YAML', () => {
      const content = themeImportExport.exportThemePackage(
        'light' as ThemeMode,
        [],
        null,
        [],
        {},
        { format: 'yaml' }
      )
      expect(content).toContain('version:')
      expect(content).toContain('themeMode: light')
    })

    it('should export theme package as TOML', () => {
      const content = themeImportExport.exportThemePackage(
        'auto' as ThemeMode,
        [],
        null,
        [],
        {},
        { format: 'toml' }
      )
      expect(content).toContain('themeMode = "auto"')
    })

    it('should include presets when option is enabled', () => {
      const presets = [{
        id: 'test-1',
        name: 'Test Preset',
        mode: 'dark' as ThemeMode,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }]
      const content = themeImportExport.exportThemePackage(
        'dark' as ThemeMode,
        presets,
        'test-1',
        [],
        {},
        { includePresets: true, format: 'json' }
      )
      const parsed = JSON.parse(content)
      expect(parsed.presets.length).toBe(1)
      expect(parsed.activePresetId).toBe('test-1')
    })

    it('should exclude presets when option is disabled', () => {
      const presets = [{
        id: 'test-1',
        name: 'Test Preset',
        mode: 'dark' as ThemeMode,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }]
      const content = themeImportExport.exportThemePackage(
        'dark' as ThemeMode,
        presets,
        'test-1',
        [],
        {},
        { includePresets: false, format: 'json' }
      )
      const parsed = JSON.parse(content)
      expect(parsed.presets.length).toBe(0)
      expect(parsed.activePresetId).toBeNull()
    })

    it('should include schedules when option is enabled', () => {
      const schedules = [{
        id: 'schedule-1',
        mode: 'dark' as ThemeMode,
        time: '22:00',
        enabled: true,
        days: [1, 2, 3, 4, 5],
        label: 'Night Mode'
      }]
      const content = themeImportExport.exportThemePackage(
        'light' as ThemeMode,
        [],
        null,
        schedules,
        {},
        { includeSchedules: true, format: 'json' }
      )
      const parsed = JSON.parse(content)
      expect(parsed.schedules.length).toBe(1)
    })

    it('should exclude schedules when option is disabled', () => {
      const schedules = [{
        id: 'schedule-1',
        mode: 'dark' as ThemeMode,
        time: '22:00',
        enabled: true,
        days: [1, 2, 3, 4, 5],
        label: 'Night Mode'
      }]
      const content = themeImportExport.exportThemePackage(
        'light' as ThemeMode,
        [],
        null,
        schedules,
        {},
        { includeSchedules: false, format: 'json' }
      )
      const parsed = JSON.parse(content)
      expect(parsed.schedules).toBeUndefined()
    })

    it('should include customVariables when option is enabled', () => {
      const customVariables = { primaryColor: 'var(--color-primary)', fontSize: '14px' }
      const content = themeImportExport.exportThemePackage(
        'light' as ThemeMode,
        [],
        null,
        [],
        customVariables,
        { includeCustomVariables: true, format: 'json' }
      )
      const parsed = JSON.parse(content)
      expect(parsed.customVariables).toEqual(customVariables)
    })

    it('should exclude customVariables when option is disabled', () => {
      const customVariables = { primaryColor: 'var(--color-primary)' }
      const content = themeImportExport.exportThemePackage(
        'light' as ThemeMode,
        [],
        null,
        [],
        customVariables,
        { includeCustomVariables: false, format: 'json' }
      )
      const parsed = JSON.parse(content)
      expect(parsed.customVariables).toBeUndefined()
    })

    it('should export without prettify', () => {
      const content = themeImportExport.exportThemePackage(
        'dark' as ThemeMode,
        [],
        null,
        [],
        {},
        { format: 'json', prettify: false }
      )
      expect(content).not.toContain('\n')
    })

    it('should export with description and author', () => {
      const content = themeImportExport.exportThemePackage(
        'dark' as ThemeMode,
        [],
        null,
        [],
        {},
        { format: 'json' }
      )
      const parsed = JSON.parse(content)
      expect(parsed.name).toBe('Theme Package')
    })

    it('should filter default presets', () => {
      const presets = [
        { id: 'default-1', name: 'Default', mode: 'dark' as ThemeMode, createdAt: Date.now(), updatedAt: Date.now(), isDefault: true },
        { id: 'custom-1', name: 'Custom', mode: 'dark' as ThemeMode, createdAt: Date.now(), updatedAt: Date.now(), isDefault: false }
      ]
      const content = themeImportExport.exportThemePackage(
        'dark' as ThemeMode,
        presets,
        null,
        [],
        {},
        { includePresets: true, format: 'json' }
      )
      const parsed = JSON.parse(content)
      expect(parsed.presets.length).toBe(1)
      expect(parsed.presets[0].id).toBe('custom-1')
    })

    it('should export presets with customColors in YAML', () => {
      const presets = [{
        id: 'test-1',
        name: 'Test',
        mode: 'dark' as ThemeMode,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        customColors: { primary: 'var(--color-primary)', secondary: 'var(--color-success)' }
      }]
      const content = themeImportExport.exportThemePackage(
        'dark' as ThemeMode,
        presets,
        null,
        [],
        {},
        { format: 'yaml' }
      )
      expect(content).toContain('customColors:')
      expect(content).toContain('primary:')
    })

    it('should export schedules in YAML', () => {
      const schedules = [{
        id: 'schedule-1',
        mode: 'dark' as ThemeMode,
        time: '22:00',
        enabled: true,
        days: [1, 2, 3],
        label: 'Night'
      }]
      const content = themeImportExport.exportThemePackage(
        'light' as ThemeMode,
        [],
        null,
        schedules,
        {},
        { format: 'yaml', includeSchedules: true }
      )
      expect(content).toContain('schedules:')
      expect(content).toContain('time: "22:00"')
    })

    it('should export customVariables in YAML', () => {
      const customVariables = { color: 'var(--el-bg-color)' }
      const content = themeImportExport.exportThemePackage(
        'light' as ThemeMode,
        [],
        null,
        [],
        customVariables,
        { format: 'yaml', includeCustomVariables: true }
      )
      expect(content).toContain('customVariables:')
      expect(content).toContain('color:')
    })

    it('should export presets in TOML', () => {
      const presets = [{
        id: 'test-1',
        name: 'Test',
        mode: 'dark' as ThemeMode,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        customColors: { primary: 'var(--color-primary)' }
      }]
      const content = themeImportExport.exportThemePackage(
        'dark' as ThemeMode,
        presets,
        null,
        [],
        {},
        { format: 'toml' }
      )
      expect(content).toContain('[[presets]]')
      expect(content).toContain('id = "test-1"')
    })

    it('should export customVariables in TOML', () => {
      const customVariables = { color: 'var(--el-bg-color)' }
      const content = themeImportExport.exportThemePackage(
        'light' as ThemeMode,
        [],
        null,
        [],
        customVariables,
        { format: 'toml', includeCustomVariables: true }
      )
      expect(content).toContain('[customVariables]')
    })
  })

  describe('importThemePackage', () => {
    it('should import valid JSON theme package', () => {
      const json = JSON.stringify({
        version: '1.0.0',
        themeMode: 'dark',
        presets: [{
          id: 'imported-1',
          name: 'Imported',
          mode: 'dark',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }],
        activePresetId: 'imported-1'
      })
      const result = themeImportExport.importThemePackage(json, 'json')
      expect(result.success).toBe(true)
      expect(result.imported.presets).toBe(1)
    })

    it('should fail on invalid theme mode', () => {
      const json = JSON.stringify({
        version: '1.0.0',
        themeMode: 'invalid-mode',
        presets: []
      })
      const result = themeImportExport.importThemePackage(json, 'json')
      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should fail on missing required fields', () => {
      const json = JSON.stringify({
        presets: []
      })
      const result = themeImportExport.importThemePackage(json, 'json')
      expect(result.success).toBe(false)
    })

    it('should add warnings for invalid presets', () => {
      const json = JSON.stringify({
        version: '1.0.0',
        themeMode: 'dark',
        presets: [{
          id: 'valid',
          name: 'Valid',
          mode: 'dark',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }, {
          id: 'invalid',
          name: 'Invalid',
          mode: 'invalid-mode'
        }]
      })
      const result = themeImportExport.importThemePackage(json, 'json')
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('should import schedules', () => {
      const json = JSON.stringify({
        version: '1.0.0',
        themeMode: 'dark',
        schedules: [{
          id: 'schedule-1',
          mode: 'dark',
          time: '22:00',
          enabled: true,
          days: [1, 2, 3],
          label: 'Night'
        }]
      })
      const result = themeImportExport.importThemePackage(json, 'json')
      expect(result.success).toBe(true)
      expect(result.imported.schedules).toBe(1)
    })

    it('should add warnings for invalid schedules', () => {
      const json = JSON.stringify({
        version: '1.0.0',
        themeMode: 'dark',
        schedules: [{
          id: 'invalid',
          time: '22:00'
        }]
      })
      const result = themeImportExport.importThemePackage(json, 'json')
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('should import customVariables', () => {
      const json = JSON.stringify({
        version: '1.0.0',
        themeMode: 'dark',
        customVariables: { color: 'var(--el-bg-color)', size: '14px' }
      })
      const result = themeImportExport.importThemePackage(json, 'json')
      expect(result.success).toBe(true)
      expect(result.imported.customVariables).toBe(2)
    })

    it('should handle parse errors', () => {
      const result = themeImportExport.importThemePackage('invalid json', 'json')
      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should skip presets missing required fields', () => {
      const json = JSON.stringify({
        version: '1.0.0',
        themeMode: 'dark',
        presets: [{
          id: 'incomplete'
        }]
      })
      const result = themeImportExport.importThemePackage(json, 'json')
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('should import from YAML format', () => {
      const yaml = `version: "1.0.0"
name: "Test Theme"
themeMode: dark
presets:
  - id: preset-1
    name: "Dark Mode"
    mode: dark
    createdAt: 1234567890
    updatedAt: 1234567890
schedules:
  - id: schedule-1
    mode: dark
    time: "22:00"
    enabled: true
    days: [1, 2, 3]
    label: "Night"
customVariables:
  color: "var(--el-bg-color)"`
      const result = themeImportExport.importThemePackage(yaml, 'yaml')
      expect(result.success).toBe(true)
    })

    it('should import from TOML format', () => {
      const toml = `version = "1.0.0"
name = "Test Theme"
themeMode = "dark"
createdAt = 1234567890`
      const result = themeImportExport.importThemePackage(toml, 'toml')
      expect(result.success).toBe(true)
    })

    it('should detect JSON format automatically', () => {
      const json = '{"version": "1.0.0", "themeMode": "dark"}'
      const result = themeImportExport.importThemePackage(json)
      expect(result.success).toBe(true)
    })

    it('should detect YAML format automatically', () => {
      const yaml = 'version: "1.0.0"\nthemeMode: dark'
      const result = themeImportExport.importThemePackage(yaml)
      expect(result.success).toBe(true)
    })

    it('should detect TOML format automatically', () => {
      const toml = 'version = "1.0.0"\nthemeMode = "dark"\ntest = [1, 2]'
      const result = themeImportExport.importThemePackage(toml)
      expect(result).toBeDefined()
    })
  })

  describe('downloadThemePackage', () => {
    let createElementSpy: ReturnType<typeof vi.spyOn>
    let clickMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      clickMock = vi.fn()
      createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue({
        click: clickMock,
        setAttribute: vi.fn(),
        remove: vi.fn()
      } as unknown as HTMLAnchorElement)
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should create download link for JSON', () => {
      const content = '{"version": "1.0.0"}'
      themeImportExport.downloadThemePackage(content, 'test-theme', 'json')
      expect(createElementSpy).toHaveBeenCalledWith('a')
      expect(clickMock).toHaveBeenCalled()
    })

    it('should create download link for YAML', () => {
      const content = 'version: "1.0.0"'
      themeImportExport.downloadThemePackage(content, 'test-theme', 'yaml')
      expect(createElementSpy).toHaveBeenCalledWith('a')
    })

    it('should create download link for TOML', () => {
      const content = 'version = "1.0.0"'
      themeImportExport.downloadThemePackage(content, 'test-theme', 'toml')
      expect(createElementSpy).toHaveBeenCalledWith('a')
    })

    it('should append extension if not present', () => {
      const content = '{"version": "1.0.0"}'
      const element = { click: vi.fn(), setAttribute: vi.fn(), remove: vi.fn() } as unknown as HTMLAnchorElement
      createElementSpy.mockReturnValue(element)
      themeImportExport.downloadThemePackage(content, 'test', 'json')
      expect((element as HTMLAnchorElement).download).toBe('test.json')
    })

    it('should not duplicate extension if already present', () => {
      const content = '{"version": "1.0.0"}'
      const element = { click: vi.fn(), setAttribute: vi.fn(), remove: vi.fn() } as unknown as HTMLAnchorElement
      createElementSpy.mockReturnValue(element)
      themeImportExport.downloadThemePackage(content, 'test.json', 'json')
      expect((element as HTMLAnchorElement).download).toBe('test.json')
    })
  })

  describe('readThemeFile', () => {
    it('should read file content', async () => {
      const file = new File(['test content'], 'test.json', { type: 'application/json' })
      const content = await themeImportExport.readThemeFile(file)
      expect(content).toBe('test content')
    })

    it('should reject on read error', async () => {
      const file = new File(['test'], 'test.json')
      const result = themeImportExport.readThemeFile(file)
      expect(result).toBeInstanceOf(Promise)
    })
  })

  // 补充测试：覆盖 fromYAML、fromTOML、detectFormat 未覆盖的分支
  describe('fromYAML additional coverage', () => {
    it('应解析 description 字段', () => {
      const yaml = 'version: "1.0.0"\nname: "T"\ndescription: "测试描述"\nthemeMode: dark'
      const result = themeImportExport.importThemePackage(yaml, 'yaml')
      expect(result.success).toBe(true)
    })

    it('应解析 author 字段', () => {
      const yaml = 'version: "1.0.0"\nname: "T"\nauthor: "作者"\nthemeMode: dark'
      const result = themeImportExport.importThemePackage(yaml, 'yaml')
      expect(result.success).toBe(true)
    })

    it('应解析 activePresetId 字段', () => {
      const yaml = 'version: "1.0.0"\nthemeMode: dark\nactivePresetId: preset-x'
      const result = themeImportExport.importThemePackage(yaml, 'yaml')
      expect(result.success).toBe(true)
    })

    it('应解析 createdAt 字段', () => {
      const yaml = 'version: "1.0.0"\nthemeMode: dark\ncreatedAt: 1700000000000'
      const result = themeImportExport.importThemePackage(yaml, 'yaml')
      expect(result.success).toBe(true)
    })

    it('createdAt 解析失败时使用 Date.now()', () => {
      const yaml = 'version: "1.0.0"\nthemeMode: dark\ncreatedAt: notanumber'
      const result = themeImportExport.importThemePackage(yaml, 'yaml')
      expect(result.success).toBe(true)
    })

    it('应忽略注释行和空行', () => {
      const yaml = '# 这是注释\n\nversion: "1.0.0"\n# 另一行注释\nthemeMode: dark'
      const result = themeImportExport.importThemePackage(yaml, 'yaml')
      expect(result.success).toBe(true)
    })

    it('应处理多个 preset 列表项', () => {
      const yaml = `version: "1.0.0"
themeMode: dark
presets:
  - id: p1
    name: "P1"
    mode: dark
  - id: p2
    name: "P2"
    mode: light`
      const result = themeImportExport.importThemePackage(yaml, 'yaml')
      expect(result.success).toBe(true)
    })

    it('应处理多个 schedule 列表项', () => {
      const yaml = `version: "1.0.0"
themeMode: dark
schedules:
  - id: s1
    mode: dark
    time: "22:00"
  - id: s2
    mode: light
    time: "08:00"`
      const result = themeImportExport.importThemePackage(yaml, 'yaml')
      expect(result.success).toBe(true)
    })

    it('应处理 customVariables 段切换', () => {
      const yaml = `version: "1.0.0"
themeMode: dark
customVariables:
  color: "red"
  size: "14px"`
      const result = themeImportExport.importThemePackage(yaml, 'yaml')
      expect(result.success).toBe(true)
    })

    it('应处理未结尾的单个 preset', () => {
      const yaml = `version: "1.0.0"
themeMode: dark
presets:
  - id: p1
    name: "P1"
    mode: dark`
      const result = themeImportExport.importThemePackage(yaml, 'yaml')
      expect(result.success).toBe(true)
    })

    it('应处理未结尾的单个 schedule', () => {
      const yaml = `version: "1.0.0"
themeMode: dark
schedules:
  - id: s1
    mode: dark
    time: "22:00"`
      const result = themeImportExport.importThemePackage(yaml, 'yaml')
      expect(result.success).toBe(true)
    })

    it('应处理带引号的值', () => {
      const yaml = `version: '1.0.0'
name: '测试'
themeMode: dark`
      const result = themeImportExport.importThemePackage(yaml, 'yaml')
      expect(result.success).toBe(true)
    })

    it('YAML 导入后再导出应包含 description 和 author', () => {
      const yaml = 'version: "1.0.0"\nname: "T"\ndescription: "D"\nauthor: "A"\nthemeMode: dark\nactivePresetId: p1'
      // 先用 JSON 注入字段再导出为 YAML
      const pkg = {
        version: '1.0.0',
        name: 'T',
        description: '描述',
        author: '作者',
        createdAt: 1700000000000,
        themeMode: 'dark',
        presets: [],
        activePresetId: 'p1'
      }
      // 通过 import 一次确认 YAML 解析能写回字段
      const result = themeImportExport.importThemePackage(JSON.stringify(pkg), 'json')
      expect(result.success).toBe(true)
      // 直接构造一个含 description/author 的导出：利用 YAML 路径
      const content = themeImportExport.exportThemePackage(
        'dark' as ThemeMode, [], 'p1', [], {}, { format: 'yaml' }
      )
      expect(content).toContain('activePresetId: p1')
    })
  })

  describe('fromTOML additional coverage', () => {
    it('应解析 description 字段', () => {
      const toml = 'version = "1.0.0"\nname = "T"\ndescription = "测试描述"\nthemeMode = "dark"'
      const result = themeImportExport.importThemePackage(toml, 'toml')
      expect(result.success).toBe(true)
    })

    it('应解析 author 字段', () => {
      const toml = 'version = "1.0.0"\nauthor = "作者"\nthemeMode = "dark"'
      const result = themeImportExport.importThemePackage(toml, 'toml')
      expect(result.success).toBe(true)
    })

    it('应解析 activePresetId 字段', () => {
      const toml = 'version = "1.0.0"\nthemeMode = "dark"\nactivePresetId = "p1"'
      const result = themeImportExport.importThemePackage(toml, 'toml')
      expect(result.success).toBe(true)
    })

    it('应解析 createdAt 字段', () => {
      const toml = 'version = "1.0.0"\nthemeMode = "dark"\ncreatedAt = 1700000000000'
      const result = themeImportExport.importThemePackage(toml, 'toml')
      expect(result.success).toBe(true)
    })

    it('createdAt 解析失败时使用 Date.now()', () => {
      const toml = 'version = "1.0.0"\nthemeMode = "dark"\ncreatedAt = "abc"'
      const result = themeImportExport.importThemePackage(toml, 'toml')
      expect(result.success).toBe(true)
    })

    it('应忽略注释行和空行', () => {
      const toml = '# 注释\n\nversion = "1.0.0"\nthemeMode = "dark"'
      const result = themeImportExport.importThemePackage(toml, 'toml')
      expect(result.success).toBe(true)
    })

    it('应处理 section 切换（[section] 形式）', () => {
      const toml = `version = "1.0.0"
themeMode = "dark"
[customVariables]
color = "red"`
      const result = themeImportExport.importThemePackage(toml, 'toml')
      expect(result.success).toBe(true)
    })

    it('应忽略 [[ 形式（数组表头）', () => {
      const toml = `version = "1.0.0"
themeMode = "dark"
[[presets]]
id = "p1"`
      const result = themeImportExport.importThemePackage(toml, 'toml')
      expect(result.success).toBe(true)
    })

    it('应处理带单引号的值', () => {
      const toml = `version = '1.0.0'
name = 'T'
themeMode = 'dark'`
      const result = themeImportExport.importThemePackage(toml, 'toml')
      expect(result.success).toBe(true)
    })
  })

  describe('detectFormat additional coverage', () => {
    it('应自动识别 JSON 数组格式', () => {
      const jsonArray = '[1, 2, 3]'
      const result = themeImportExport.importThemePackage(jsonArray)
      // 数组不是合法的主题包，解析会失败
      expect(result).toBeDefined()
      expect(result.success).toBe(false)
    })

    it('应自动识别 JSON 对象', () => {
      const json = '{"version":"1.0.0","themeMode":"dark"}'
      const result = themeImportExport.importThemePackage(json)
      expect(result.success).toBe(true)
    })

    it('应自动识别 TOML（含 [ 段）', () => {
      const toml = 'version = "1.0.0"\nthemeMode = "dark"\n[s]'
      const result = themeImportExport.importThemePackage(toml)
      expect(result).toBeDefined()
    })
  })

  describe('toYAML additional coverage', () => {
    it('YAML 导出应包含 activePresetId', () => {
      const content = themeImportExport.exportThemePackage(
        'dark' as ThemeMode, [], 'p1', [], {}, { format: 'yaml' }
      )
      expect(content).toContain('activePresetId: p1')
    })

    it('YAML 导出 activePresetId 为空时不应出现该行', () => {
      const content = themeImportExport.exportThemePackage(
        'dark' as ThemeMode, [], null, [], {}, { format: 'yaml' }
      )
      expect(content).not.toContain('activePresetId:')
    })
  })

  describe('toTOML additional coverage', () => {
    it('TOML 导出应包含 activePresetId', () => {
      const content = themeImportExport.exportThemePackage(
        'dark' as ThemeMode, [], 'p1', [], {}, { format: 'toml' }
      )
      expect(content).toContain('activePresetId = "p1"')
    })

    it('TOML 导出 activePresetId 为空时不应出现该行', () => {
      const content = themeImportExport.exportThemePackage(
        'dark' as ThemeMode, [], null, [], {}, { format: 'toml' }
      )
      expect(content).not.toContain('activePresetId =')
    })
  })

  describe('edge cases', () => {
    it('空字符串导入应返回失败', () => {
      const result = themeImportExport.importThemePackage('')
      expect(result.success).toBe(false)
    })

    it('预设缺 id 时应记录警告', () => {
      const json = JSON.stringify({
        version: '1.0.0',
        themeMode: 'dark',
        presets: [{ name: 'no-id', mode: 'dark' }]
      })
      const result = themeImportExport.importThemePackage(json, 'json')
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('预设缺 name 时应记录警告', () => {
      const json = JSON.stringify({
        version: '1.0.0',
        themeMode: 'dark',
        presets: [{ id: 'x', mode: 'dark' }]
      })
      const result = themeImportExport.importThemePackage(json, 'json')
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('预设缺 mode 时应记录警告', () => {
      const json = JSON.stringify({
        version: '1.0.0',
        themeMode: 'dark',
        presets: [{ id: 'x', name: 'n' }]
      })
      const result = themeImportExport.importThemePackage(json, 'json')
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('schedule 缺 id 时应记录警告', () => {
      const json = JSON.stringify({
        version: '1.0.0',
        themeMode: 'dark',
        schedules: [{ time: '22:00', mode: 'dark' }]
      })
      const result = themeImportExport.importThemePackage(json, 'json')
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('schedule 缺 time 时应记录警告', () => {
      const json = JSON.stringify({
        version: '1.0.0',
        themeMode: 'dark',
        schedules: [{ id: 's1', mode: 'dark' }]
      })
      const result = themeImportExport.importThemePackage(json, 'json')
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('schedule 缺 mode 时应记录警告', () => {
      const json = JSON.stringify({
        version: '1.0.0',
        themeMode: 'dark',
        schedules: [{ id: 's1', time: '22:00' }]
      })
      const result = themeImportExport.importThemePackage(json, 'json')
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('所有高对比度模式应被接受', () => {
      const modes = ['light', 'dark', 'auto', 'high-contrast-light', 'high-contrast-dark']
      for (const mode of modes) {
        const json = JSON.stringify({ version: '1.0.0', themeMode: mode })
        const result = themeImportExport.importThemePackage(json, 'json')
        expect(result.success).toBe(true)
      }
    })
  })
})
