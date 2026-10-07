// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, before, after, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

import { rmScratch, mkScratch } from '../lib/scratch-dir.mjs'
// 名单投影族出口(§22d 入口守卫保证 import 零副作用)
import { __test__ as gate } from '../check-llm-provider-schema.mjs'

// =============================================================================
// check-llm-provider-schema.mjs 端到端集成测试
//
// 覆盖 7 条校验规则 + CLI 参数 + 边界情况:
//   1. JSON 解析必须合法
//   2. 顶层必须是对象
//   3. provider name 不在投影名单(服务端能力清单单向投影)→ warning(--strict 升级为 error)
//   4. 字段类型:api_key=str / api_base=str|null / enabled=bool / models=str[] / default_model=str|null
//   5. 未知字段:允许(透传到 extra),info 提示
//   6. api_key="" 且无 api_base → info 提示"可能未配置"
//   7. 重复 provider(LLM_PROVIDERS + LLM_PROVIDERS_JSON 冲突)→ error
//
// 用 Node.js 内置 test runner,无第三方依赖
// 端到端模式:创建临时 .env → spawn CLI → 验证 exit code + stdout
// =============================================================================

const SCRIPT = resolve('scripts/check-llm-provider-schema.mjs')
const TMP_DIR = mkScratch('llm-schema-test-')
const ENV_FILE = join(TMP_DIR, '.env')

/**
 * 运行 CLI,返回 { exitCode, stdout, stderr }
 * 用 `--` 分隔符让脚本接管参数解析(避免 Node 20.6+ 内置 --env-file 冲突)
 */
function runCli(args = []) {
  const result = spawnSync('node', [SCRIPT, '--', '--env-file', ENV_FILE, ...args], {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    cwd: process.cwd(),
    timeout: 10000,
  })
  return {
    exitCode: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

/** 写入 .env 文件内容 */
function writeEnv(content) {
  writeFileSync(ENV_FILE, content, 'utf8')
}

before(() => {
  mkdirSync(TMP_DIR, { recursive: true })
})

after(() => {
  rmScratch(TMP_DIR)
})

// =============================================================================
// 1. JSON 解析必须合法
// =============================================================================
describe('规则 1: JSON 解析', () => {
  test('合法 JSON → exit 0', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"openai":{"api_key":"sk-xxx","enabled":true,"models":["gpt-4"]}}`)
    const { exitCode, stdout } = runCli()
    assert.equal(exitCode, 0)
    assert.match(stdout, /✅ 通过/)
  })

  test('非法 JSON → exit 1 + 错误信息', () => {
    writeEnv(`LLM_PROVIDERS_JSON={invalid json}`)
    const { exitCode, stdout } = runCli()
    assert.equal(exitCode, 1)
    assert.match(stdout, /JSON 解析失败/)
  })

  test('JSON 字符串值带引号转义 → exit 0', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"openai":{"api_key":"sk-\\"quoted\\"","enabled":true}}`)
    const { exitCode } = runCli()
    assert.equal(exitCode, 0)
  })
})

// =============================================================================
// 2. 顶层必须是对象
// =============================================================================
describe('规则 2: 顶层对象', () => {
  test('顶层是数组 → exit 1', () => {
    writeEnv(`LLM_PROVIDERS_JSON=[{"openai":{}}]`)
    const { exitCode, stdout } = runCli()
    assert.equal(exitCode, 1)
    assert.match(stdout, /顶层必须是对象/)
  })

  test('顶层是字符串 → exit 1', () => {
    // .env 单引号包裹 JSON 字符串 "not an object"
    // parseEnvFile 去外层单引号 → 值 "not an object"(带双引号)
    // JSON.parse('"not an object"') → 字符串 'not an object'
    // 校验:顶层必须是对象 → exit 1
    writeEnv(`LLM_PROVIDERS_JSON='"not an object"'`)
    const { exitCode, stdout } = runCli()
    assert.equal(exitCode, 1)
    assert.match(stdout, /顶层必须是对象/)
  })

  test('顶层是 null → exit 1', () => {
    writeEnv(`LLM_PROVIDERS_JSON=null`)
    const { exitCode, stdout } = runCli()
    assert.equal(exitCode, 1)
    assert.match(stdout, /顶层必须是对象/)
  })
})

// =============================================================================
// 3. provider name 白名单
// =============================================================================
describe('规则 3: provider 白名单', () => {
  test('已知 provider(openai)→ exit 0 无 warning', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"openai":{"api_key":"sk-xxx","enabled":true}}`)
    const { exitCode, stdout } = runCli()
    assert.equal(exitCode, 0)
    assert.doesNotMatch(stdout, /未知 provider/)
  })

  test('未知 provider → exit 0 + warning(默认模式)', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"unknown_provider":{"api_key":""}}`)
    const { exitCode, stdout } = runCli()
    assert.equal(exitCode, 0)
    assert.match(stdout, /未知 provider name: "unknown_provider"/)
  })

  test('未知 provider + --strict → exit 1', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"unknown_provider":{"api_key":""}}`)
    const { exitCode, stdout } = runCli(['--strict'])
    assert.equal(exitCode, 1)
    assert.match(stdout, /未知 provider name: "unknown_provider"/)
  })

  test('旧手抄名单代表条目全部合法 → exit 0', () => {
    // 抽样验证 5 个 provider 覆盖不同厂商
    const providers = ['openai', 'anthropic', 'gemini', 'stepfun', 'cloudflare']
    const json = JSON.stringify(
      Object.fromEntries(providers.map((p) => [p, { api_key: 'sk-test', enabled: false }])),
    )
    writeEnv(`LLM_PROVIDERS_JSON=${json}`)
    const { exitCode } = runCli()
    assert.equal(exitCode, 0)
  })
})

// =============================================================================
// 4. 字段类型校验
// =============================================================================
describe('规则 4: 字段类型', () => {
  test('api_key 非字符串(数字)→ exit 1', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"openai":{"api_key":123}}`)
    const { exitCode, stdout } = runCli()
    assert.equal(exitCode, 1)
    assert.match(stdout, /期望字符串/)
  })

  test('api_base 非字符串非 null(数字)→ exit 1', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"openai":{"api_key":"sk","api_base":123}}`)
    const { exitCode, stdout } = runCli()
    assert.equal(exitCode, 1)
    assert.match(stdout, /期望字符串或 null/)
  })

  test('api_base=null → exit 0', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"openai":{"api_key":"sk","api_base":null,"enabled":true}}`)
    const { exitCode } = runCli()
    assert.equal(exitCode, 0)
  })

  test('enabled 非布尔(字符串 "true")→ exit 1', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"openai":{"api_key":"sk","enabled":"true"}}`)
    const { exitCode, stdout } = runCli()
    assert.equal(exitCode, 1)
    assert.match(stdout, /期望布尔值/)
  })

  test('enabled=false → exit 0', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"openai":{"api_key":"sk","enabled":false}}`)
    const { exitCode } = runCli()
    assert.equal(exitCode, 0)
  })

  test('models 非数组(字符串)→ exit 1', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"openai":{"api_key":"sk","models":"gpt-4"}}`)
    const { exitCode, stdout } = runCli()
    assert.equal(exitCode, 1)
    assert.match(stdout, /期望字符串数组/)
  })

  test('models 数组含非字符串(数字)→ exit 1', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"openai":{"api_key":"sk","models":["gpt-4",123]}}`)
    const { exitCode, stdout } = runCli()
    assert.equal(exitCode, 1)
    assert.match(stdout, /期望字符串/)
  })

  test('models 空数组 → exit 0', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"openai":{"api_key":"sk","models":[]}}`)
    const { exitCode } = runCli()
    assert.equal(exitCode, 0)
  })

  test('default_model 非字符串非 null(数字)→ exit 1', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"openai":{"api_key":"sk","default_model":123}}`)
    const { exitCode, stdout } = runCli()
    assert.equal(exitCode, 1)
    assert.match(stdout, /期望字符串或 null/)
  })

  test('default_model=null → exit 0', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"openai":{"api_key":"sk","default_model":null}}`)
    const { exitCode } = runCli()
    assert.equal(exitCode, 0)
  })
})

// =============================================================================
// 5. 未知字段
// =============================================================================
describe('规则 5: 未知字段', () => {
  test('未知字段 → info 提示,exit 0', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"openai":{"api_key":"sk","custom_field":"value"}}`)
    const { exitCode, stdout } = runCli()
    assert.equal(exitCode, 0)
    assert.match(stdout, /未知字段/)
  })
})

// =============================================================================
// 6. 空值检查
// =============================================================================
describe('规则 6: 空值检查', () => {
  test('api_key="" 且无 api_base → info 提示,exit 0', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"openai":{"api_key":""}}`)
    const { exitCode, stdout } = runCli()
    assert.equal(exitCode, 0)
    assert.match(stdout, /未配置 api_key/)
  })

  test('api_key="" 但有 api_base → 无 info 提示,exit 0', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"openai":{"api_key":"","api_base":"https://api.example.com"}}`)
    const { exitCode, stdout } = runCli()
    assert.equal(exitCode, 0)
    assert.doesNotMatch(stdout, /未配置 api_key/)
  })
})

// =============================================================================
// 7. 重复 provider(LLM_PROVIDERS + LLM_PROVIDERS_JSON 冲突)
// =============================================================================
describe('规则 7: 重复 provider', () => {
  test('两个字段都配置同一 provider → exit 1', () => {
    writeEnv([
      `LLM_PROVIDERS_JSON={"openai":{"api_key":"sk-json"}}`,
      `LLM_PROVIDERS={"openai":{"api_key":"sk-flat"}}`,
    ].join('\n'))
    const { exitCode, stdout } = runCli()
    assert.equal(exitCode, 1)
    assert.match(stdout, /重复配置/)
  })

  test('两个字段配置不同 provider → exit 0', () => {
    writeEnv([
      `LLM_PROVIDERS_JSON={"openai":{"api_key":"sk-json"}}`,
      `LLM_PROVIDERS={"anthropic":{"api_key":"sk-flat"}}`,
    ].join('\n'))
    const { exitCode } = runCli()
    assert.equal(exitCode, 0)
  })
})

// =============================================================================
// CLI 参数
// =============================================================================
describe('CLI 参数', () => {
  test('--help → exit 0 + 显示用法', () => {
    // --help 不需要 .env 文件,直接跑
    const result = spawnSync('node', [SCRIPT, '--', '--help'], {
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      cwd: process.cwd(),
      timeout: 10000,
    })
    assert.equal(result.status, 0)
    assert.match(result.stdout, /用法/)
    assert.match(result.stdout, /--env-file/)
  })

  test('.env 不存在 → exit 2 + 错误信息', () => {
    const result = spawnSync(
      'node',
      [SCRIPT, '--', '--env-file', '/nonexistent/path/.env'],
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', cwd: process.cwd(), timeout: 10000 },
    )
    assert.equal(result.status, 2)
    assert.match(result.stderr + result.stdout, /不存在/)
  })

  test('--json 输出 → exit 0 + 合法 JSON', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"openai":{"api_key":"sk-xxx","enabled":true}}`)
    const { exitCode, stdout } = runCli(['--json'])
    assert.equal(exitCode, 0)
    const parsed = JSON.parse(stdout)
    assert.equal(parsed.passed, true)
    assert.equal(parsed.errors, 0)
    assert.ok(Array.isArray(parsed.details))
  })

  test('--json 输出 + 有 error → exit 1 + passed=false', () => {
    writeEnv(`LLM_PROVIDERS_JSON={invalid}`)
    const { exitCode, stdout } = runCli(['--json'])
    assert.equal(exitCode, 1)
    const parsed = JSON.parse(stdout)
    assert.equal(parsed.passed, false)
    assert.ok(parsed.errors >= 1)
  })

  test('未知参数 → exit 2 + 错误信息', () => {
    const result = spawnSync(
      'node',
      [SCRIPT, '--', '--unknown-flag'],
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', cwd: process.cwd(), timeout: 10000 },
    )
    assert.equal(result.status, 2)
    assert.match(result.stderr + result.stdout, /未知参数/)
  })
})

// =============================================================================
// 边界情况
// =============================================================================
describe('边界情况', () => {
  test('空 LLM_PROVIDERS_JSON → exit 0', () => {
    writeEnv(`LLM_PROVIDERS_JSON=`)
    const { exitCode } = runCli()
    assert.equal(exitCode, 0)
  })

  test('两个字段都为空 → exit 0', () => {
    writeEnv(`LLM_PROVIDERS_JSON=\nLLM_PROVIDERS=`)
    const { exitCode } = runCli()
    assert.equal(exitCode, 0)
  })

  test('provider config 非对象(字符串)→ exit 1', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"openai":"not an object"}`)
    const { exitCode, stdout } = runCli()
    assert.equal(exitCode, 1)
    assert.match(stdout, /必须是对象/)
  })

  test('provider config 非对象(数组)→ exit 1', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"openai":["not","an","object"]}`)
    const { exitCode, stdout } = runCli()
    assert.equal(exitCode, 1)
    assert.match(stdout, /必须是对象/)
  })

  test('provider config null → exit 1', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"openai":null}`)
    const { exitCode, stdout } = runCli()
    assert.equal(exitCode, 1)
    assert.match(stdout, /必须是对象/)
  })

  test('多个 provider 混合 → exit 0', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"openai":{"api_key":"sk-1","enabled":true,"models":["gpt-4"]},"anthropic":{"api_key":"sk-2","enabled":false,"models":["claude-3"]}}`)
    const { exitCode } = runCli()
    assert.equal(exitCode, 0)
  })

  test('export 前缀语法 → exit 0', () => {
    writeEnv(`export LLM_PROVIDERS_JSON={"openai":{"api_key":"sk-xxx","enabled":true}}`)
    const { exitCode } = runCli()
    assert.equal(exitCode, 0)
  })

  test('# 注释行 → exit 0', () => {
    writeEnv([
      `# This is a comment`,
      `LLM_PROVIDERS_JSON={"openai":{"api_key":"sk-xxx","enabled":true}}`,
    ].join('\n'))
    const { exitCode } = runCli()
    assert.equal(exitCode, 0)
  })

  test('值带 # 注释 → 正确解析', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"openai":{"api_key":"sk-xxx"}} # inline comment`)
    const { exitCode } = runCli()
    assert.equal(exitCode, 0)
  })

  test('单引号包裹 JSON → 正确解析', () => {
    writeEnv(`LLM_PROVIDERS_JSON='{"openai":{"api_key":"sk-xxx","enabled":true}}'`)
    const { exitCode } = runCli()
    assert.equal(exitCode, 0)
  })

  test('字段缺失(只配 api_key)→ exit 0', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"openai":{"api_key":"sk-xxx"}}`)
    const { exitCode } = runCli()
    assert.equal(exitCode, 0)
  })

  test('空对象 provider → exit 0', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"openai":{}}`)
    const { exitCode } = runCli()
    assert.equal(exitCode, 0)
  })
})

// =============================================================================
// 综合场景
// =============================================================================
describe('综合场景', () => {
  test('多 provider + 多字段类型错 → 多个 error,exit 1', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"openai":{"api_key":123,"enabled":"true"},"anthropic":{"models":"not-array"}}`)
    const { exitCode, stdout } = runCli()
    assert.equal(exitCode, 1)
    // 至少 3 个 error(api_key 类型 + enabled 类型 + models 类型)
    const errorMatches = stdout.match(/❌|期望/g) ?? []
    assert.ok(errorMatches.length >= 3, `应至少 3 个 error,实际 ${errorMatches.length}`)
  })

  test('--strict + --json 组合 → JSON 输出 + strict 模式', () => {
    writeEnv(`LLM_PROVIDERS_JSON={"unknown_provider":{"api_key":""}}`)
    const { exitCode, stdout } = runCli(['--strict', '--json'])
    assert.equal(exitCode, 1)
    const parsed = JSON.parse(stdout)
    assert.equal(parsed.passed, false)
    // strict 模式下未知 provider 是 error
    const hasUnknownProviderError = parsed.details.some(
      (d) => d.level === 'error' && d.message.includes('未知 provider'),
    )
    assert.ok(hasUnknownProviderError, 'strict 模式应将未知 provider 升级为 error')
  })

  test('安全回归:诊断输出严禁回显 api_key 明文(只输出结构摘要)', () => {
    const fakeKey = 'sk-AAAABBBBCCCCDDDDeeeeFFFF00001111'
    writeEnv(`LLM_PROVIDERS_JSON={"openai":{"api_key":"${fakeKey}","enabled":true}}`)
    const { exitCode, stdout } = runCli()
    assert.equal(exitCode, 0)
    assert.ok(!stdout.includes(fakeKey), 'stdout 不得包含 api_key 原值')
    assert.doesNotMatch(stdout, /sk-[A-Za-z0-9_-]{10,}/, 'stdout 不得包含任何 sk- 长 token')
    assert.match(stdout, /providers: openai/, '摘要应显示 provider 名称而非值')
  })
})

// =============================================================================
// 8. provider 名单单向投影(G-354族/G-393/G-762 拍板②,2026-10-07)
//    名单 = 服务端能力清单单向投影,手抄 PROVIDER_WHITELIST 已消灭:
//    投影内 provider 永不判"未知";新增 provider 正解 = 进机器源,本门零改动自动识别。
// =============================================================================
describe('名单单向投影(G-354族/G-393/G-762)', () => {
  test('三源并集投影:构造源注入 → 并集与映射投影正确,notes 全 ok', () => {
    const registrySrc = [
      'class _F:  # 测试 fixture',
      '    provider_code="openai"',
      "    provider_code='deepseek'",
      '    provider_code="agnes_qwen"',
      '    provider_code="cloudflare_workers_ai"',
    ].join('\n')
    const availabilitySrc = [
      '_PROVIDER_CODE_TO_LLM_PROVIDERS_NAME = {',
      '    "cloudflare_workers_ai": "cloudflare",',
      '}',
    ].join('\n')
    const gatewaySrc = [
      '_FREE_PROVIDER_ENDPOINT_RESOLVERS = {',
      '    "nvidia": ("nvidia_nim", lambda: None),',
      '}',
    ].join('\n')
    const literalSrcs = ['cfg = get_provider_config("hf_qwen")']
    const { set, notes } = gate.projectProviderWhitelist({
      registrySrc, availabilitySrc, gatewaySrc, literalSrcs,
    })
    for (const n of ['openai', 'deepseek', 'agnes_qwen', 'cloudflare', 'nvidia_nim', 'hf_qwen'])
      assert.ok(set.has(n), `投影名单应含 ${n}`)
    assert.ok(!set.has('cloudflare_workers_ai'), '映射键(原始 code)不得直接入名单,应投影成 name')
    assert.ok(notes.every((x) => x.kind === 'ok'), `四源 notes 应全 ok,实得 ${JSON.stringify(notes)}`)
  })

  test('全空源 → set 空 + notes 全 empty(不抛错、不静默充数)', () => {
    const { set, notes } = gate.projectProviderWhitelist({})
    assert.equal(set.size, 0)
    assert.equal(notes.length, 4)
    assert.ok(notes.every((x) => x.kind === 'empty'))
  })

  test('真仓面:getProviderWhitelist 三源健康,投影 ≥ 50 条', () => {
    const wl = gate.getProviderWhitelist()
    assert.ok(wl.set.size >= 50, `投影名单应 ≥ 50 条,实得 ${wl.set.size}`)
    assert.ok(
      wl.notes.every((x) => x.kind === 'ok'),
      `真仓三源应全 ok,实得 ${JSON.stringify(wl.notes)}`,
    )
  })

  test('旧手抄名单代表条目全部 ∈ 投影 → 名单外判黄语义不变回归锁', () => {
    const wl = gate.getProviderWhitelist()
    for (const n of ['openai', 'anthropic', 'gemini', 'stepfun', 'cloudflare', 'deepseek',
      'zhipu', 'qwen', 'nvidia', 'openrouter'])
      assert.ok(wl.set.has(n), `旧手抄名单条目 ${n} 应仍在投影内`)
  })

  test('CLI 端到端:.env 实配 12 名全部无「未知 provider」warning(改前 7 名被误判)', () => {
    const wl = gate.getProviderWhitelist()
    const names = ['agnes', 'stepfun', 'openrouter', 'cloudflare', 'nvidia', 'gemini',
      'ihui_relay', 'hf_qwen', 'openai', 'deepseek', 'zhipu', 'qwen']
    for (const n of names) assert.ok(wl.set.has(n), `实配名 ${n} 应在投影名单内`)
    const json = JSON.stringify(
      Object.fromEntries(names.map((p) => [p, { api_key: 'sk-test', enabled: false }])),
    )
    writeEnv(`LLM_PROVIDERS_JSON=${json}`)
    const { exitCode, stdout } = runCli()
    assert.equal(exitCode, 0)
    assert.doesNotMatch(stdout, /未知 provider/, '投影后实配名不得再判未知')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
