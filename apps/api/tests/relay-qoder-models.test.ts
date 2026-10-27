// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:relay-qoder-models

/**
 * Qoder 可用模型清单(CLI 桥通路)单测(2026-10-27 立)。
 *
 * 不跑真实 Qoder CLI、不发任何真实上游请求、不触碰登录态:
 * - 解析层:CLI 表格真实样本逐行(official/Auto 分离/custom 截断标记/色码剥离);
 * - CLI 点查:注入假 exec(回真实样本文本),覆盖 CLI 缺失/超时/非零退出/
 *   垃圾输出的 ok:false,以及 exec 纪律选项(stdio/maxBuffer/timeout);
 * - adapter.listModelsDetailed:vi.doMock 模块缝注入假 listQoderModels,
 *   验证富形状与永不抛(成功/失败/内部异常三态)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  listQoderModels,
  parseQoderModelTable,
  resolveQoderModelsCliPath,
  stripAnsi,
  type QoderCliExecImpl,
} from '../src/services/upstream-adapters/qoder-models.js'
import type {
  AdapterAccountContext,
  RelayUpstreamAdapter,
} from '../src/services/relay-upstream-adapters.js'

const ADAPTER_PATH = '../src/services/upstream-adapters/qoder-adapter.js'
const MODELS_PATH = '../src/services/upstream-adapters/qoder-models.js'

// =============================================================================
// 真实样本(2026-10-27 实弹)
// =============================================================================

const REAL_TABLE = [
  'MODEL',
  'Auto',
  'Qwen3.8-Max',
  'Qwen3.8-Flash',
  'DeepSeek-V4-Pro',
  'DeepSeek-Flash',
  'GLM-5.3',
  'GLM-5.3-Flash',
  'Kimi-K3.1-Pro',
  'Kimi-K2.8-Preview',
  'MiniMax-M3.1-Flash',
  'glm-5.3-flash (qoder-custom-e2bfa2ec-9e7c-48e5-8c51-68…)',
].join('\n')

const REAL_OFFICIAL = [
  'Qwen3.8-Max',
  'Qwen3.8-Flash',
  'DeepSeek-V4-Pro',
  'DeepSeek-Flash',
  'GLM-5.3',
  'GLM-5.3-Flash',
  'Kimi-K3.1-Pro',
  'Kimi-K2.8-Preview',
  'MiniMax-M3.1-Flash',
]

/** 捕获式假 exec:回固定 stdout,记录实参(测试绝不 spawn 真 CLI) */
function makeCapture(stdout: string): {
  impl: QoderCliExecImpl
  args?: string[]
  opts?: Record<string, unknown>
  file?: string
} {
  const box: {
    impl: QoderCliExecImpl
    args?: string[]
    opts?: Record<string, unknown>
    file?: string
  } = { impl: () => '' }
  box.impl = (file, args, options) => {
    box.file = file
    box.args = args
    box.opts = options
    return stdout
  }
  return box
}

/** 抛错假 exec(模拟 execFileSync 的 ENOENT/ETIMEDOUT/非零退出) */
function throwingExec(err: NodeJS.ErrnoException): QoderCliExecImpl {
  return () => {
    throw err
  }
}

// =============================================================================
// 环境隔离:QODER_CLI_PATH env 不许泄漏进断言
// =============================================================================

const ENV_KEYS = ['QODER_CLI_PATH'] as const
let savedEnv: Record<string, string | undefined> = {}

beforeEach(() => {
  savedEnv = {}
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k]
    delete process.env[k]
  }
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    const v = savedEnv[k]
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  vi.doUnmock(MODELS_PATH)
  vi.resetModules()
  vi.restoreAllMocks()
})

// =============================================================================
// parseQoderModelTable
// =============================================================================

describe('parseQoderModelTable: 真实样本逐行', () => {
  it('解析真实样本:auto 分离、official 逐行、custom 截断标记', () => {
    const parsed = parseQoderModelTable(REAL_TABLE)
    expect(parsed).not.toBeNull()
    expect(parsed!.auto).toBe(true)
    expect(parsed!.official).toEqual(REAL_OFFICIAL)
    expect(parsed!.custom).toEqual([
      {
        name: 'glm-5.3-flash',
        idPrefix: 'qoder-custom-e2bfa2ec-9e7c-48e5-8c51-68…',
        idTruncated: true,
      },
    ])
  })

  it('Auto 单独成标志,不进 official', () => {
    const parsed = parseQoderModelTable('MODEL\nAuto\nGLM-5.3')
    expect(parsed!.auto).toBe(true)
    expect(parsed!.official).toEqual(['GLM-5.3'])
    expect(parsed!.custom).toEqual([])
  })

  it('无 Auto 行时 auto:false,official/custom 仍成立', () => {
    const parsed = parseQoderModelTable('MODEL\nGLM-5.3\nglm-x (qoder-custom-abc…)')
    expect(parsed!.auto).toBe(false)
    expect(parsed!.official).toEqual(['GLM-5.3'])
    expect(parsed!.custom).toHaveLength(1)
  })

  it('剥离 ANSI 色码后再解析', () => {
    const colored = '\x1b[1mMODEL\x1b[0m\n\x1b[36mAuto\x1b[0m\n\x1b[32mGLM-5.3\x1b[0m'
    const parsed = parseQoderModelTable(colored)
    expect(parsed!.auto).toBe(true)
    expect(parsed!.official).toEqual(['GLM-5.3'])
  })

  it('stripAnsi 直接剥离各色码形态', () => {
    expect(stripAnsi('a\x1b[0mb')).toBe('ab')
    expect(stripAnsi('a\x1b[38;5;196mb\x1b[mc')).toBe('abc')
    expect(stripAnsi('a\x1b[2mdim\x1b[0m')).toBe('adim')
  })

  it('CRLF 行尾与表头大小写不敏感', () => {
    const parsed = parseQoderModelTable('model\r\nGLM-5.3\r\n')
    expect(parsed!.official).toEqual(['GLM-5.3'])
  })

  it('空串/表头独行 → null(解析不出任何模型,如实)', () => {
    expect(parseQoderModelTable('')).toBeNull()
    expect(parseQoderModelTable('MODEL\n')).toBeNull()
  })

  it('括号段缺失名称的 custom 行不收(不造无名条目);全空 → null 如实', () => {
    const parsed = parseQoderModelTable('MODEL\n(qoder-custom-abc…)')
    expect(parsed).toBeNull() // 唯一行被过滤后无任何模型 → null
  })

  it('无 MODEL 表头的垃圾文本 → null(绝不把任意文本当模型名)', () => {
    expect(parseQoderModelTable('not a model table at all')).toBeNull()
    expect(parseQoderModelTable('Usage: qoder [options]\nunknown flag: --x')).toBeNull()
  })
})

// =============================================================================
// resolveQoderModelsCliPath
// =============================================================================

describe('resolveQoderModelsCliPath', () => {
  it('显式指定优先于 env', () => {
    process.env['QODER_CLI_PATH'] = 'C:/env/cli.exe'
    expect(resolveQoderModelsCliPath('C:/explicit/cli.exe')).toBe('C:/explicit/cli.exe')
  })

  it('无显式时取 env', () => {
    process.env['QODER_CLI_PATH'] = 'C:/env/cli.exe'
    expect(resolveQoderModelsCliPath()).toBe('C:/env/cli.exe')
  })
})

// =============================================================================
// listQoderModels(假 exec 注入,绝不 spawn 真 CLI)
// =============================================================================

describe('listQoderModels: 假 exec 全流程', () => {
  it('成功:形状与 scope 如实,source 标注', () => {
    const r = listQoderModels({ spawnImpl: makeCapture(REAL_TABLE).impl })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.scope).toBe('local-cli-login')
      expect(r.auto).toBe(true)
      expect(r.official).toEqual(REAL_OFFICIAL)
      expect(r.custom[0]?.idTruncated).toBe(true)
      expect(r.source).toBe('cli --list-models')
    }
  })

  it('exec 纪律:--list-models 参数 + stdio pipe + maxBuffer 16MB + encoding utf8', () => {
    const box = makeCapture(REAL_TABLE)
    listQoderModels({ spawnImpl: box.impl })
    expect(box.args).toEqual(['--list-models'])
    expect(box.opts).toMatchObject({
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 16 * 1024 * 1024,
      encoding: 'utf8',
      windowsHide: true,
    })
    expect(typeof (box.opts as { timeout?: number }).timeout).toBe('number')
  })

  it('timeoutMs 覆写默认 30s', () => {
    const box = makeCapture(REAL_TABLE)
    listQoderModels({ spawnImpl: box.impl, timeoutMs: 1_234 })
    expect((box.opts as { timeout?: number }).timeout).toBe(1_234)
  })

  it('cliPath 覆写直达 exec(不冒充探测路径)', () => {
    const box = makeCapture(REAL_TABLE)
    listQoderModels({ spawnImpl: box.impl, cliPath: 'C:/my/qoderclicn.exe' })
    expect(box.file).toBe('C:/my/qoderclicn.exe')
  })

  it('CLI 缺失(ENOENT)→ ok:false 如实报错', () => {
    const err: NodeJS.ErrnoException = Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' })
    const r = listQoderModels({ spawnImpl: throwingExec(err) })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('CLI 缺失')
  })

  it('超时(ETIMEDOUT/SIGTERM)→ ok:false 如实报错', () => {
    for (const err of [
      Object.assign(new Error('ETIMEDOUT'), { code: 'ETIMEDOUT' }),
      Object.assign(new Error('killed'), { signal: 'SIGTERM' }),
    ]) {
      const r = listQoderModels({ spawnImpl: throwingExec(err) })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toContain('超时')
    }
  })

  it('非零退出(status=2)→ ok:false 如实报错', () => {
    const err: NodeJS.ErrnoException & { status?: number } = Object.assign(
      new Error('Command failed'),
      { status: 2 },
    )
    const r = listQoderModels({ spawnImpl: throwingExec(err) })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('exit=2')
  })

  it('垃圾输出(解析为空)→ ok:false 如实报错(不造空清单冒充)', () => {
    const r = listQoderModels({
      spawnImpl: makeCapture('\x1b[31munknown flag: --list-models\x1b[0m\n').impl,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('解析为空')
  })

  it('空输出 → ok:false', () => {
    const r = listQoderModels({ spawnImpl: makeCapture('').impl })
    expect(r.ok).toBe(false)
  })

  it('色码包裹的正常表格照常解析成功', () => {
    const colored = REAL_TABLE.split('\n')
      .map((l, i) => (i === 0 ? l : `\x1b[36m${l}\x1b[0m`))
      .join('\n')
    const r = listQoderModels({ spawnImpl: makeCapture(colored).impl })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.official).toEqual(REAL_OFFICIAL)
  })
})

// =============================================================================
// adapter.listModelsDetailed:永不抛(vi.doMock 模块缝,绝不 spawn 真 CLI)
// =============================================================================

describe('qoderAdapter.listModelsDetailed', () => {
  /** 最小 ctx(listModelsDetailed 不消费 ctx 凭据,CLI 用本机登录态) */
  const ctx = { row: {}, credentials: {} } as unknown as AdapterAccountContext

  async function loadAdapterWith(modelsMock: Record<string, unknown>) {
    vi.resetModules()
    vi.doMock(MODELS_PATH, () => modelsMock)
    const mod = await import(ADAPTER_PATH)
    return mod.qoderAdapter as RelayUpstreamAdapter
  }

  it('成功:富形状(auto 打头 + official + custom 截断标记),scope 如实', async () => {
    const adapter = await loadAdapterWith({
      listQoderModels: () => ({
        ok: true,
        scope: 'local-cli-login',
        auto: true,
        official: ['GLM-5.3'],
        custom: [{ name: 'glm-5.3-flash', idPrefix: 'qoder-custom-abc…', idTruncated: true }],
        source: 'cli --list-models',
      }),
    })
    const r = await adapter.listModelsDetailed(ctx)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.scope).toBe('local-cli-login')
      expect(r.models).toEqual([
        { name: 'auto' },
        { name: 'GLM-5.3', id: 'GLM-5.3' },
        { name: 'glm-5.3-flash', id: 'qoder-custom-abc…', idTruncated: true },
      ])
    }
  })

  it('失败归 ok:false 如实带 error(永不抛)', async () => {
    const adapter = await loadAdapterWith({
      listQoderModels: () => ({ ok: false, error: 'Qoder CLI 缺失(未找到 qoderclicn.exe)' }),
    })
    const r = await adapter.listModelsDetailed(ctx)
    expect(r).toEqual({ ok: false, error: 'Qoder CLI 缺失(未找到 qoderclicn.exe)' })
  })

  it('内部异常也兜底归 ok:false(永不抛)', async () => {
    const adapter = await loadAdapterWith({
      listQoderModels: () => {
        throw new Error('boom')
      },
    })
    const r = await adapter.listModelsDetailed(ctx)
    expect(r).toEqual({ ok: false, error: 'boom' })
  })
})
// [IHUI-AI-PROVENANCE]:relay-qoder-models
