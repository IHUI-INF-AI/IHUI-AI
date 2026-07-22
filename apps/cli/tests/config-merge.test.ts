/**
 * P1-7 6 层 config merge 模块测试。
 *
 * 覆盖范围:
 *   - deepMerge:标量覆盖 / 对象递归合并 / 数组整体替换 / null 处理 / undefined 处理
 *   - deepMergeAll:多层依次合并
 *   - parseEnvOverrides:扁平键 / 嵌套键 / 布尔转换 / 数字转换 / 未知键忽略 / 大小写不敏感
 *   - parseCliOverrides:扁平键 / 嵌套路径 / undefined 忽略 / null 清除 / 空字符串忽略
 *   - setNestedPath:a.b.c 三层嵌套写入
 *   - loadConfig:6 层完整流程 / 某层缺失跳过 / 某层加载失败不阻塞 / CLI 最高优先级 / defaults 最低优先级
 *   - sessionConfig:set / clear / 不持久化
 *   - envBool:1/0/true/false/yes/no/on/off/大小写混合 / 未定义返回 undefined
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  DEFAULT_SETTINGS,
  deepMerge,
  deepMergeAll,
  parseEnvOverrides,
  envBool,
  parseCliOverrides,
  setNestedPath,
  loadConfig,
  getGlobalSettingsPath,
  getProjectSettingsPath,
  setSessionConfig,
  clearSessionConfig,
} from '../src/config/index.js'

// ==================== deepMerge ====================

describe('deepMerge', () => {
  it('标量覆盖:b 覆盖 a', () => {
    expect(deepMerge(1, 2)).toBe(2)
    expect(deepMerge('a', 'b')).toBe('b')
    expect(deepMerge(true, false)).toBe(false)
  })

  it('对象递归合并:兄弟键保留,同键递归覆盖', () => {
    const a: Record<string, unknown> = { x: 1, y: { z: 1 } }
    const b: Record<string, unknown> = { y: { w: 2 }, k: 3 }
    const r = deepMerge(a, b)
    expect(r).toEqual({ x: 1, y: { z: 1, w: 2 }, k: 3 })
  })

  it('数组整体替换:不递归合并', () => {
    const a: Record<string, unknown> = { arr: [1, 2, 3] }
    const b: Record<string, unknown> = { arr: [4] }
    const r = deepMerge(a, b)
    expect(r).toEqual({ arr: [4] })
  })

  it('null 处理:null 视为显式清除,写入结果', () => {
    const a: Record<string, unknown> = { x: 1, y: 2 }
    const b: Record<string, unknown> = { x: null }
    const r = deepMerge(a, b)
    expect(r).toEqual({ x: null, y: 2 })
  })

  it('null 覆盖对象:整体替换', () => {
    const a: Record<string, unknown> = { x: { z: 1 } }
    const b: Record<string, unknown> = { x: null }
    const r = deepMerge(a, b)
    expect(r).toEqual({ x: null })
  })

  it('undefined 处理:不写入结果(保留 base 值)', () => {
    const a: Record<string, unknown> = { x: 1, y: 2 }
    const b: Record<string, unknown> = { x: undefined, z: 3 }
    const r = deepMerge(a, b)
    expect(r).toEqual({ x: 1, y: 2, z: 3 })
  })

  it('override 整体为 undefined 时保留 base', () => {
    expect(deepMerge<number | undefined>(1, undefined)).toBe(1)
    const a: Record<string, unknown> = { x: 1 }
    const b: Record<string, unknown> | undefined = undefined
    expect(deepMerge(a, b)).toEqual({ x: 1 })
  })
})

// ==================== deepMergeAll ====================

describe('deepMergeAll', () => {
  it('多层依次合并:后者胜,兄弟键保留', () => {
    const r = deepMergeAll<Record<string, unknown>>(
      { a: 1, b: { x: 1 } },
      { b: { y: 2 } },
      { a: 3 },
    )
    expect(r).toEqual({ a: 3, b: { x: 1, y: 2 } })
  })

  it('空列表返回空对象', () => {
    expect(deepMergeAll()).toEqual({})
  })

  it('6 层合并:defaults < global < project < session < env < cli', () => {
    const r = deepMergeAll<Record<string, unknown>>(
      { apiUrl: 'default', max: 25 }, // defaults
      { apiUrl: 'global', extra: 'g' }, // global
      { apiUrl: 'project' }, // project
      { allow: true }, // session
      { locale: 'en' }, // env
      { model: 'gpt-4' }, // cli
    )
    expect(r).toEqual({
      apiUrl: 'project',
      max: 25,
      extra: 'g',
      allow: true,
      locale: 'en',
      model: 'gpt-4',
    })
  })
})

// ==================== parseEnvOverrides ====================

describe('parseEnvOverrides', () => {
  it('扁平键映射', () => {
    const r = parseEnvOverrides({
      IHUI_API_URL: 'http://env-host',
      IHUI_API_KEY: 'env-key',
      IHUI_DEFAULT_MODEL: 'gpt-4',
      IHUI_LOCALE: 'en',
      IHUI_PERMISSION_MODE: 'plan',
    })
    expect(r.apiUrl).toBe('http://env-host')
    expect(r.apiKey).toBe('env-key')
    expect(r.defaultModel).toBe('gpt-4')
    expect(r.locale).toBe('en')
    expect(r.permissionMode).toBe('plan')
  })

  it('嵌套键映射:sampler.temperature / sampler.maxTokens', () => {
    const r = parseEnvOverrides({
      IHUI_SAMPLER_TEMPERATURE: '0.5',
      IHUI_SAMPLER_MAX_TOKENS: '8192',
    })
    expect(r.sampler?.temperature).toBe(0.5)
    expect(r.sampler?.maxTokens).toBe(8192)
  })

  it('嵌套键映射:sandbox.profile / compactionV2.enabled', () => {
    const r = parseEnvOverrides({
      IHUI_SANDBOX_PROFILE: 'readonly',
      IHUI_COMPACTION_V2_ENABLED: 'true',
    })
    expect(r.sandbox?.profile).toBe('readonly')
    expect(r.compactionV2?.enabled).toBe(true)
  })

  it('布尔转换:1/true/yes/on/enabled → true', () => {
    for (const v of ['1', 'true', 'yes', 'on', 'enabled']) {
      const r = parseEnvOverrides({ IHUI_AUDIT_ENABLED: v })
      expect(r.auditEnabled).toBe(true)
    }
    for (const v of ['1', 'true', 'yes', 'on', 'enabled']) {
      const r = parseEnvOverrides({ IHUI_ALLOW_DANGEROUS: v })
      expect(r.allowDangerous).toBe(true)
    }
  })

  it('布尔转换:0/false/no/off/disabled → false', () => {
    for (const v of ['0', 'false', 'no', 'off', 'disabled']) {
      const r = parseEnvOverrides({ IHUI_AUDIT_ENABLED: v })
      expect(r.auditEnabled).toBe(false)
    }
  })

  it('数字转换:maxIterations', () => {
    const r = parseEnvOverrides({ IHUI_MAX_ITERATIONS: '50' })
    expect(r.maxIterations).toBe(50)
  })

  it('数字转换:sampler.temperature 支持小数', () => {
    const r = parseEnvOverrides({ IHUI_SAMPLER_TEMPERATURE: '0.7' })
    expect(r.sampler?.temperature).toBe(0.7)
  })

  it('数字转换失败时跳过该键', () => {
    const r = parseEnvOverrides({ IHUI_MAX_ITERATIONS: 'abc' })
    expect(r.maxIterations).toBeUndefined()
  })

  it('未知 IHUI_ 前缀变量忽略,不报错', () => {
    const r = parseEnvOverrides({ IHUI_UNKNOWN_KEY: 'value', IHUI_FOO_BAR: 'x' })
    expect(r).toEqual({})
  })

  it('大小写不敏感:ihui_api_url 也映射到 apiUrl', () => {
    const r = parseEnvOverrides({ ihui_api_url: 'http://lower' })
    expect(r.apiUrl).toBe('http://lower')
  })

  it('大小写不敏感:混合大小写变量名', () => {
    const r = parseEnvOverrides({ Ihui_Api_Url: 'http://mixed' })
    expect(r.apiUrl).toBe('http://mixed')
  })

  it('空字符串视为未设置', () => {
    const r = parseEnvOverrides({ IHUI_API_URL: '' })
    expect(r.apiUrl).toBeUndefined()
  })

  it('布尔转换:非布尔值字符串跳过', () => {
    const r = parseEnvOverrides({ IHUI_AUDIT_ENABLED: 'maybe' })
    expect(r.auditEnabled).toBeUndefined()
  })

  it('默认使用 process.env', () => {
    const orig = process.env.IHUI_API_URL
    process.env.IHUI_API_URL = 'http://proc-env'
    try {
      const r = parseEnvOverrides()
      expect(r.apiUrl).toBe('http://proc-env')
    } finally {
      if (orig === undefined) delete process.env.IHUI_API_URL
      else process.env.IHUI_API_URL = orig
    }
  })
})

// ==================== envBool ====================

describe('envBool', () => {
  it('1/0 → true/false', () => {
    expect(envBool('X', { X: '1' })).toBe(true)
    expect(envBool('X', { X: '0' })).toBe(false)
  })

  it('true/false → true/false', () => {
    expect(envBool('X', { X: 'true' })).toBe(true)
    expect(envBool('X', { X: 'false' })).toBe(false)
  })

  it('yes/no → true/false', () => {
    expect(envBool('X', { X: 'yes' })).toBe(true)
    expect(envBool('X', { X: 'no' })).toBe(false)
  })

  it('on/off → true/false', () => {
    expect(envBool('X', { X: 'on' })).toBe(true)
    expect(envBool('X', { X: 'off' })).toBe(false)
  })

  it('enabled/disabled → true/false', () => {
    expect(envBool('X', { X: 'enabled' })).toBe(true)
    expect(envBool('X', { X: 'disabled' })).toBe(false)
  })

  it('大小写混合:True/YES/On/FALSE 等', () => {
    expect(envBool('X', { X: 'True' })).toBe(true)
    expect(envBool('X', { X: 'YES' })).toBe(true)
    expect(envBool('X', { X: 'On' })).toBe(true)
    expect(envBool('X', { X: 'Enabled' })).toBe(true)
    expect(envBool('X', { X: 'No' })).toBe(false)
    expect(envBool('X', { X: 'FALSE' })).toBe(false)
    expect(envBool('X', { X: 'OFF' })).toBe(false)
    expect(envBool('X', { X: 'Disabled' })).toBe(false)
  })

  it('未定义返回 undefined', () => {
    expect(envBool('X', {})).toBeUndefined()
  })

  it('未知值返回 undefined', () => {
    expect(envBool('X', { X: 'maybe' })).toBeUndefined()
  })

  it('大小写不敏感读取变量名', () => {
    expect(envBool('FLAG', { flag: 'yes' })).toBe(true)
    expect(envBool('flag', { FLAG: '1' })).toBe(true)
  })
})

// ==================== parseCliOverrides ====================

describe('parseCliOverrides', () => {
  it('扁平键:字符串与数字字符串', () => {
    const r = parseCliOverrides({ apiUrl: 'http://cli', maxIterations: '50' })
    expect(r.apiUrl).toBe('http://cli')
    expect(r.maxIterations).toBe(50)
  })

  it('嵌套路径:sampler.temperature', () => {
    const r = parseCliOverrides({ 'sampler.temperature': '0.3' })
    expect(r.sampler?.temperature).toBe(0.3)
  })

  it('嵌套路径:compactionV2.enabled(布尔透传)', () => {
    const r = parseCliOverrides({ 'compactionV2.enabled': true })
    expect(r.compactionV2?.enabled).toBe(true)
  })

  it('嵌套路径:sandbox.profile(字符串)', () => {
    const r = parseCliOverrides({ 'sandbox.profile': 'readonly' })
    expect(r.sandbox?.profile).toBe('readonly')
  })

  it('undefined 忽略:不覆盖下层', () => {
    const r = parseCliOverrides({ apiUrl: undefined, apiKey: 'k' })
    expect(r.apiUrl).toBeUndefined()
    expect(r.apiKey).toBe('k')
  })

  it('null 视为显式清除', () => {
    const r = parseCliOverrides({ apiUrl: null })
    expect(r.apiUrl).toBeNull()
  })

  it('空字符串忽略', () => {
    const r = parseCliOverrides({ apiUrl: '' })
    expect(r.apiUrl).toBeUndefined()
  })

  it('布尔值 true/false 透传', () => {
    const r = parseCliOverrides({ auditEnabled: true, allowDangerous: false })
    expect(r.auditEnabled).toBe(true)
    expect(r.allowDangerous).toBe(false)
  })

  it('非数字字符串保持字符串', () => {
    const r = parseCliOverrides({ defaultModel: 'gpt-4' })
    expect(r.defaultModel).toBe('gpt-4')
  })

  it('负数字符串转 number', () => {
    const r = parseCliOverrides({ maxIterations: '-5' })
    expect(r.maxIterations).toBe(-5)
  })
})

// ==================== setNestedPath ====================

describe('setNestedPath', () => {
  it('a.b.c 三层嵌套写入', () => {
    const target: Record<string, unknown> = {}
    setNestedPath(target, 'a.b.c', 42)
    expect(target).toEqual({ a: { b: { c: 42 } } })
  })

  it('单层路径写入', () => {
    const target: Record<string, unknown> = {}
    setNestedPath(target, 'x', 1)
    expect(target).toEqual({ x: 1 })
  })

  it('已存在中间节点保留兄弟键', () => {
    const target: Record<string, unknown> = { a: { b: { old: 1 } } }
    setNestedPath(target, 'a.b.new', 2)
    expect(target).toEqual({ a: { b: { old: 1, new: 2 } } })
  })

  it('中间节点为非对象时覆盖为 {}', () => {
    const target: Record<string, unknown> = { a: 5 }
    setNestedPath(target, 'a.b', 1)
    expect(target).toEqual({ a: { b: 1 } })
  })
})

// ==================== loadConfig ====================

describe('loadConfig', () => {
  let tmpHome: string
  let tmpCwd: string
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cfg-home-'))
    tmpCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cfg-cwd-'))
    originalEnv = { ...process.env }
    // 用临时 HOME 模拟 ~/.ihui/settings.json
    process.env.HOME = tmpHome
    process.env.USERPROFILE = tmpHome
    // 清除所有 IHUI_ 前缀环境变量,避免干扰
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

  it('6 层完整流程:defaults < global < project < session < env < cli', () => {
    // global: apiUrl + maxIterations
    fs.mkdirSync(path.join(tmpHome, '.ihui'), { recursive: true })
    fs.writeFileSync(
      path.join(tmpHome, '.ihui', 'settings.json'),
      JSON.stringify({ apiUrl: 'http://global', maxIterations: 10 }),
    )
    // project: apiUrl + allowDangerous=false
    fs.mkdirSync(path.join(tmpCwd, '.ihui'), { recursive: true })
    fs.writeFileSync(
      path.join(tmpCwd, '.ihui', 'settings.json'),
      JSON.stringify({ apiUrl: 'http://project', allowDangerous: false }),
    )
    // session: allowDangerous=true(覆盖 project 的 false)
    setSessionConfig({ allowDangerous: true })
    // env: locale=en
    process.env.IHUI_LOCALE = 'en'
    // cli: defaultModel=gpt-4
    const r = loadConfig({
      cwd: tmpCwd,
      cliArgs: { defaultModel: 'gpt-4' },
    })

    // cli 最高优先级
    expect(r.defaultModel).toBe('gpt-4')
    // env 层
    expect(r.locale).toBe('en')
    // session 层覆盖 project 层
    expect(r.allowDangerous).toBe(true)
    // project 层覆盖 global 层
    expect(r.apiUrl).toBe('http://project')
    // global 层未被覆盖的字段保留
    expect(r.maxIterations).toBe(10)
    // defaults 层未被覆盖的字段保留
    expect(r.auditEnabled).toBe(true)
    expect(r.permissionMode).toBe('default')
    expect(r.sampler?.temperature).toBe(0.7)
  })

  it('某层缺失时跳过:无 global / project 文件,仍返回 defaults', () => {
    const r = loadConfig({ cwd: tmpCwd })
    expect(r.apiUrl).toBe('http://localhost:8803')
    expect(r.maxIterations).toBe(25)
    expect(r.auditEnabled).toBe(true)
  })

  it('某层加载失败不阻塞:损坏 JSON 降级到默认', () => {
    fs.mkdirSync(path.join(tmpHome, '.ihui'), { recursive: true })
    fs.writeFileSync(
      path.join(tmpHome, '.ihui', 'settings.json'),
      '{invalid json',
    )
    const r = loadConfig({ cwd: tmpCwd })
    // global 损坏 → 降级,apiUrl 回退到 defaults
    expect(r.apiUrl).toBe('http://localhost:8803')
  })

  it('project 层损坏也不阻塞', () => {
    fs.mkdirSync(path.join(tmpCwd, '.ihui'), { recursive: true })
    fs.writeFileSync(
      path.join(tmpCwd, '.ihui', 'settings.json'),
      'not a json',
    )
    const r = loadConfig({ cwd: tmpCwd })
    expect(r.apiUrl).toBe('http://localhost:8803')
  })

  it('CLI 最高优先级:覆盖 env / session / project / global / defaults', () => {
    fs.mkdirSync(path.join(tmpCwd, '.ihui'), { recursive: true })
    fs.writeFileSync(
      path.join(tmpCwd, '.ihui', 'settings.json'),
      JSON.stringify({ apiUrl: 'http://project' }),
    )
    process.env.IHUI_API_URL = 'http://env'
    setSessionConfig({ apiUrl: 'http://session' })
    const r = loadConfig({
      cwd: tmpCwd,
      cliArgs: { apiUrl: 'http://cli' },
    })
    expect(r.apiUrl).toBe('http://cli')
  })

  it('defaults 最低优先级:被 env 覆盖', () => {
    process.env.IHUI_MAX_ITERATIONS = '99'
    const r = loadConfig({ cwd: tmpCwd })
    expect(r.maxIterations).toBe(99)
  })

  it('env 层覆盖 session 层覆盖 project 层', () => {
    fs.mkdirSync(path.join(tmpCwd, '.ihui'), { recursive: true })
    fs.writeFileSync(
      path.join(tmpCwd, '.ihui', 'settings.json'),
      JSON.stringify({ apiUrl: 'http://project' }),
    )
    setSessionConfig({ apiUrl: 'http://session' })
    process.env.IHUI_API_URL = 'http://env'
    const r = loadConfig({ cwd: tmpCwd })
    // env > session > project
    expect(r.apiUrl).toBe('http://env')
  })

  it('sessionOverrides 参数优先于 setSessionConfig 模块级状态', () => {
    setSessionConfig({ apiUrl: 'http://session' })
    const r = loadConfig({
      cwd: tmpCwd,
      sessionOverrides: { apiUrl: 'http://override' },
    })
    expect(r.apiUrl).toBe('http://override')
  })

  it('getGlobalSettingsPath 返回 ~/.ihui/settings.json', () => {
    const p = getGlobalSettingsPath()
    expect(p).toBe(path.join(tmpHome, '.ihui', 'settings.json'))
  })

  it('getProjectSettingsPath 返回 <cwd>/.ihui/settings.json', () => {
    const p = getProjectSettingsPath(tmpCwd)
    expect(p).toBe(path.join(tmpCwd, '.ihui', 'settings.json'))
  })

  it('DEFAULT_SETTINGS 包含所有默认字段', () => {
    expect(DEFAULT_SETTINGS.apiUrl).toBe('http://localhost:8803')
    expect(DEFAULT_SETTINGS.defaultModel).toBe('default')
    expect(DEFAULT_SETTINGS.maxIterations).toBe(25)
    expect(DEFAULT_SETTINGS.auditEnabled).toBe(true)
    expect(DEFAULT_SETTINGS.allowDangerous).toBe(false)
    expect(DEFAULT_SETTINGS.sandbox?.profile).toBe('trusted')
    expect(DEFAULT_SETTINGS.sampler?.temperature).toBe(0.7)
    expect(DEFAULT_SETTINGS.sampler?.maxTokens).toBe(4096)
    expect(DEFAULT_SETTINGS.locale).toBe('zh-CN')
    expect(DEFAULT_SETTINGS.permissionMode).toBe('default')
    expect(DEFAULT_SETTINGS.compactionV2?.enabled).toBe(false)
  })
})

// ==================== sessionConfig ====================

describe('sessionConfig', () => {
  let tmpHome: string
  let tmpCwd: string
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-sess-home-'))
    tmpCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-sess-cwd-'))
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

  it('set 注入后 loadConfig 反映 session 配置', () => {
    setSessionConfig({ allowDangerous: true, maxIterations: 100 })
    const r = loadConfig({ cwd: tmpCwd })
    expect(r.allowDangerous).toBe(true)
    expect(r.maxIterations).toBe(100)
  })

  it('clear 后 loadConfig 不再反映 session 配置(回退到默认)', () => {
    setSessionConfig({ allowDangerous: true })
    clearSessionConfig()
    const r = loadConfig({ cwd: tmpCwd })
    expect(r.allowDangerous).toBe(false)
  })

  it('不持久化:session 配置不写入磁盘', () => {
    setSessionConfig({ apiUrl: 'http://session' })
    loadConfig({ cwd: tmpCwd })
    const settingsPath = path.join(tmpHome, '.ihui', 'settings.json')
    expect(fs.existsSync(settingsPath)).toBe(false)
  })

  it('setSessionConfig 多次调用以最后一次为准', () => {
    setSessionConfig({ apiUrl: 'http://first' })
    setSessionConfig({ apiUrl: 'http://second' })
    const r = loadConfig({ cwd: tmpCwd })
    expect(r.apiUrl).toBe('http://second')
  })
})
