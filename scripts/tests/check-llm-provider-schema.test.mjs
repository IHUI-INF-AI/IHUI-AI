import { test, before, after, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'

// =============================================================================
// check-llm-provider-schema.mjs 端到端集成测试
//
// 覆盖 7 条校验规则 + CLI 参数 + 边界情况:
//   1. JSON 解析必须合法
//   2. 顶层必须是对象
//   3. provider name 不在 31 个白名单 → warning(--strict 升级为 error)
//   4. 字段类型:api_key=str / api_base=str|null / enabled=bool / models=str[] / default_model=str|null
//   5. 未知字段:允许(透传到 extra),info 提示
//   6. api_key="" 且无 api_base → info 提示"可能未配置"
//   7. 重复 provider(LLM_PROVIDERS + LLM_PROVIDERS_JSON 冲突)→ error
//
// 用 Node.js 内置 test runner,无第三方依赖
// 端到端模式:创建临时 .env → spawn CLI → 验证 exit code + stdout
// =============================================================================

const SCRIPT = resolve('scripts/check-llm-provider-schema.mjs')
const TMP_DIR = join(tmpdir(), `llm-schema-test-${Date.now()}-${process.pid}`)
const ENV_FILE = join(TMP_DIR, '.env')

/**
 * 运行 CLI,返回 { exitCode, stdout, stderr }
 * 用 `--` 分隔符让脚本接管参数解析(避免 Node 20.6+ 内置 --env-file 冲突)
 */
function runCli(args = []) {
  const result = spawnSync('node', [SCRIPT, '--', '--env-file', ENV_FILE, ...args], {
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
  rmSync(TMP_DIR, { recursive: true, force: true })
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

  test('31 个白名单 provider 全部合法 → exit 0', () => {
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
      { encoding: 'utf8', cwd: process.cwd(), timeout: 10000 },
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
      { encoding: 'utf8', cwd: process.cwd(), timeout: 10000 },
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
})
