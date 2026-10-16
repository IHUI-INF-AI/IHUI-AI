// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 成本 → Prometheus 桥接锁定用例(2026-10-17 立)。
 *
 * 立因(实测):Prometheus 侧 `business_ai_calls_total` series=0。原因是两层叠加 ——
 * ① `recordAiCall` 装饰器全仓无人调用;② 采集 job 被注释。本文件钉的是 ① 的修复:
 * 桥接必须住在 `plugins/ai-cost.ts` 的 `recordAiCost()` 里(所有 AI 调用方的唯一收口)。
 *
 * 变异自证(为什么"只断言指标存在"不够):
 * - T1 正向:调 recordAiCost ⇒ 该条样本值从"不存在"变 1,token 双向各自前进,cost 按「分」前进;
 * - T2 对照:**不调** recordAiCost ⇒ 同一样本必须仍然不存在(证明用例不是恒真);
 * - T3 摘桥等价:计数严格按调用次数线性增长(1→2→3),且换 vendor/model 落**新**序列 ——
 *   任何"硬编码一条样本冒充桥接"的实现都过不了 T3;
 * - T4 位置锁:桥接在 DB 落库之前 ⇒ insert 抛错时调用计数仍然前进、另出
 *   business_ai_record_failures_total(把"没落库"和"没调用"分开)。
 * ⇒ 把 `recordAiCost` 里那行 `recordAiCallSample({...})` 删掉,T1/T3/T4 全红。
 *
 * 测试纪律:db / 定价引擎 / logger 全 mock,零连接(禁碰 PG 8810 与 Redis 8811)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const h = vi.hoisted(() => ({
  values: vi.fn(async () => undefined),
  insert: vi.fn(),
  calculateCost: vi.fn(),
}))
h.insert.mockImplementation(() => ({ values: h.values }))

vi.mock('../src/db/index.js', () => ({
  db: { insert: h.insert },
  // resolveTenantIdForUser 走 dbRead,返回空数组 ⇒ 租户归集降级为 undefined(不阻塞)
  dbRead: {
    select: () => ({
      from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => [] }) }) }),
    }),
  },
}))
vi.mock('../src/services/pricing-service.js', () => ({
  calculateCost: h.calculateCost,
}))
vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import businessMetricsPlugin, { __test__ as BM } from '../src/plugins/business-metrics.js'
import { recordAiCost, resolveAiCallType, type CostRecordInput } from '../src/plugins/ai-cost.js'

let server: FastifyInstance | undefined

beforeEach(() => {
  BM.resetAiState()
  h.values.mockReset()
  h.values.mockResolvedValue(undefined)
  h.insert.mockClear()
  h.calculateCost.mockReset()
  h.calculateCost.mockResolvedValue({
    inputCost: 100,
    outputCost: 23,
    totalCost: 123,
    currency: 'CNY',
  })
})

afterEach(async () => {
  if (server) {
    await server.close()
    server = undefined
  }
  // onClose 钩子里的 resetAllMetrics 会清单例,再清一次保证用例间零串扰
  BM.resetAiState()
})

async function boot(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(businessMetricsPlugin)
  await app.ready()
  return app
}

/** 从渲染文本里取一条样本的值(按名字 + 完整标签集精确匹配,不做前缀模糊)。 */
function sample(text: string, name: string, labels: Record<string, string>): string | undefined {
  const labelSet = Object.entries(labels)
    .map(([k, v]) => `${k}="${v}"`)
    .join(',')
  const re = new RegExp(
    `^${name}\\{${labelSet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\} (\\S+)$`,
    'm',
  )
  const hit = re.exec(text)
  return hit ? hit[1] : undefined
}

/** 端点上的采样行(排除 # 注释),用于结构合法性与重复序列判据。 */
function sampleLines(text: string): string[] {
  return text.split('\n').filter((l) => l.length > 0 && !l.startsWith('#'))
}

const BASE_INPUT: CostRecordInput = {
  userId: 'u-1',
  model: 'deepseek-v3',
  provider: 'deepseek',
  promptTokens: 100,
  completionTokens: 40,
  totalTokens: 140,
  requestType: 'chat',
}

describe('recordAiCost → business_ai_* 桥接(单点埋点)', () => {
  it('T1 正向:一次 recordAiCost 让调用/token 双向/成本三类样本各自前进,且值可核对', async () => {
    server = await boot()
    const before = await server.inject({ method: 'GET', url: '/business-metrics' })
    expect(before.statusCode).toBe(200)
    expect(
      sample(before.body, 'business_ai_calls_total', {
        vendor: 'deepseek',
        model: 'deepseek-v3',
        call_type: 'stream',
        status: 'success',
      }),
    ).toBeUndefined()

    await recordAiCost(BASE_INPUT)

    const after = await server.inject({ method: 'GET', url: '/business-metrics' })
    const labels = { vendor: 'deepseek', model: 'deepseek-v3' }
    expect(
      sample(after.body, 'business_ai_calls_total', {
        ...labels,
        call_type: 'stream',
        status: 'success',
      }),
    ).toBe('1')
    expect(sample(after.body, 'business_ai_tokens_total', { ...labels, direction: 'input' })).toBe(
      '100',
    )
    expect(sample(after.body, 'business_ai_tokens_total', { ...labels, direction: 'output' })).toBe(
      '40',
    )
    // 成本单位是「分」(定价引擎唯一口径),币种标签跟 calculateCost 走 ⇒ 不再谎称 USD
    expect(
      sample(after.body, 'business_ai_cost_minor_units_total', {
        ...labels,
        currency: 'CNY',
      }),
    ).toBe('123.000000')
    // 落库失败计数必须是 0(没失败就别冒数)
    expect(sample(after.body, 'business_ai_record_failures_total', { ...labels })).toBeUndefined()
    expect(h.insert).toHaveBeenCalledTimes(1)
  })

  it('T2 对照:不调 recordAiCost 时同一条样本仍然不存在(证明本用例不恒真)', async () => {
    server = await boot()
    const text = (await server.inject({ method: 'GET', url: '/business-metrics' })).body
    expect(text).toContain('# TYPE business_ai_calls_total counter')
    expect(sampleLines(text).filter((l) => l.startsWith('business_ai_calls_total{')).length).toBe(0)
    expect(h.insert).toHaveBeenCalledTimes(0)
  })

  it('T3 摘桥等价:计数随调用次数线性前进,换 vendor/model 落新序列(硬编码冒充不了)', async () => {
    server = await boot()
    await recordAiCost(BASE_INPUT)
    await recordAiCost(BASE_INPUT)
    await recordAiCost({ ...BASE_INPUT, provider: 'volcengine', model: 'doubao-pro' })
    const text = (await server.inject({ method: 'GET', url: '/business-metrics' })).body

    expect(
      sample(text, 'business_ai_calls_total', {
        vendor: 'deepseek',
        model: 'deepseek-v3',
        call_type: 'stream',
        status: 'success',
      }),
    ).toBe('2')
    expect(
      sample(text, 'business_ai_tokens_total', {
        vendor: 'deepseek',
        model: 'deepseek-v3',
        direction: 'input',
      }),
    ).toBe('200')
    expect(
      sample(text, 'business_ai_cost_minor_units_total', {
        vendor: 'deepseek',
        model: 'deepseek-v3',
        currency: 'CNY',
      }),
    ).toBe('246.000000')
    expect(
      sample(text, 'business_ai_calls_total', {
        vendor: 'volcengine',
        model: 'doubao-pro',
        call_type: 'stream',
        status: 'success',
      }),
    ).toBe('1')
  })

  it('T4 位置锁:DB 落库抛错时调用仍计数,并另记 record_failures(异常原样上抛)', async () => {
    server = await boot()
    h.values.mockRejectedValue(new Error('boom: db down'))
    await expect(recordAiCost(BASE_INPUT)).rejects.toThrow('boom: db down')
    const text = (await server.inject({ method: 'GET', url: '/business-metrics' })).body
    expect(
      sample(text, 'business_ai_calls_total', {
        vendor: 'deepseek',
        model: 'deepseek-v3',
        call_type: 'stream',
        status: 'success',
      }),
    ).toBe('1')
    expect(
      sample(text, 'business_ai_record_failures_total', {
        vendor: 'deepseek',
        model: 'deepseek-v3',
      }),
    ).toBe('1')
  })

  it('T5 requestType → call_type 只有这一张表:crew/user-model-chat/缺省各归其档', async () => {
    expect(resolveAiCallType('chat')).toBe('stream')
    expect(resolveAiCallType('crew')).toBe('crew')
    expect(resolveAiCallType('crew_session')).toBe('crew')
    expect(resolveAiCallType('user-model-chat')).toBe('user-model-chat')
    expect(resolveAiCallType('conversation-title')).toBe('conversation-title')
    expect(resolveAiCallType('semantic-summary')).toBe('semantic-summary')
    // 未登记值与缺省都落 'chat',不往标签里灌未知基数
    expect(resolveAiCallType('brand-new-type-xyz')).toBe('chat')
    expect(resolveAiCallType(undefined)).toBe('chat')
    expect(resolveAiCallType('chat', 'crew')).toBe('crew') // 显式优先

    server = await boot()
    await recordAiCost({ ...BASE_INPUT, requestType: 'crew_session' })
    const text = (await server.inject({ method: 'GET', url: '/business-metrics' })).body
    expect(
      sample(text, 'business_ai_calls_total', {
        vendor: 'deepseek',
        model: 'deepseek-v3',
        call_type: 'crew',
        status: 'success',
      }),
    ).toBe('1')
  })

  it('T6 显式 status=error 落到 status 标签(大屏错误率的数据源)', async () => {
    server = await boot()
    await recordAiCost({ ...BASE_INPUT, status: 'error' })
    await recordAiCost({ ...BASE_INPUT })
    const text = (await server.inject({ method: 'GET', url: '/business-metrics' })).body
    expect(
      sample(text, 'business_ai_calls_total', {
        vendor: 'deepseek',
        model: 'deepseek-v3',
        call_type: 'stream',
        status: 'error',
      }),
    ).toBe('1')
    expect(
      sample(text, 'business_ai_calls_total', {
        vendor: 'deepseek',
        model: 'deepseek-v3',
        call_type: 'stream',
        status: 'success',
      }),
    ).toBe('1')
  })
})

describe('recordAiCall 装饰器(向后兼容 + 新维度)', () => {
  it('T7 旧四位置参数不改签名可用,token 归 input、costUsd 按美元×100 入账', async () => {
    server = await boot()
    server.recordAiCall('openai', 'gpt-4o', 7, 0.5)
    const text = (await server.inject({ method: 'GET', url: '/business-metrics' })).body
    expect(
      sample(text, 'business_ai_calls_total', {
        vendor: 'openai',
        model: 'gpt-4o',
        call_type: 'other',
        status: 'success',
      }),
    ).toBe('1')
    expect(
      sample(text, 'business_ai_tokens_total', {
        vendor: 'openai',
        model: 'gpt-4o',
        direction: 'input',
      }),
    ).toBe('7')
    expect(
      sample(text, 'business_ai_cost_minor_units_total', {
        vendor: 'openai',
        model: 'gpt-4o',
        currency: 'USD',
      }),
    ).toBe('50.000000')
  })

  it('T8 新第 5 参带 direction/status/callType 时按新维度分列(大屏可按方向看)', async () => {
    server = await boot()
    server.recordAiCall('openai', 'gpt-4o', 9, 0, {
      direction: 'output',
      status: 'cancelled',
      callType: 'stream',
    })
    const text = (await server.inject({ method: 'GET', url: '/business-metrics' })).body
    expect(
      sample(text, 'business_ai_calls_total', {
        vendor: 'openai',
        model: 'gpt-4o',
        call_type: 'stream',
        status: 'cancelled',
      }),
    ).toBe('1')
    expect(
      sample(text, 'business_ai_tokens_total', {
        vendor: 'openai',
        model: 'gpt-4o',
        direction: 'output',
      }),
    ).toBe('9')
    // 成本为 0 ⇒ 不开该序列(0 成本记账不该在曲线上冒点)
    expect(
      sample(text, 'business_ai_cost_minor_units_total', {
        vendor: 'openai',
        model: 'gpt-4o',
        currency: 'USD',
      }),
    ).toBeUndefined()
  })
})

describe('渲染面结构合法性(坏一个样本会打回整次 scrape)', () => {
  it('T9 标签值含引号/换行/中文时被洗白,输出行仍可被逐行解析', async () => {
    server = await boot()
    await recordAiCost({
      ...BASE_INPUT,
      provider: 'q"vendor',
      model: '深 度\n恶意"model/超长' + 'x'.repeat(200),
    })
    const text = (await server.inject({ method: 'GET', url: '/business-metrics' })).body
    const lines = sampleLines(text).filter((l) => l.startsWith('business_ai_'))
    expect(lines.length).toBeGreaterThan(0)
    for (const l of lines) {
      // 合法样本形态:name{k="v",k2="v2"} number(引号成对、值里无裸引号/换行)
      expect(l).toMatch(
        /^[a-z_]+(?:\{(?:[a-z_]+="[^"\n]*")(?:,[a-z_]+="[^"\n]*")*\})? [-\d.eE+Inf]+$/,
      )
    }
    expect(text).not.toContain('恶意\n')
    // 洗白后的 model 长度受上限约束(基数护栏的一部分)
    expect(BM.sanitizeAiLabel('a'.repeat(200)).length).toBe(64)
  })

  it('T10 每个 AI family 只有一条 # TYPE,且同一条样本不重复打印', async () => {
    server = await boot()
    await recordAiCost(BASE_INPUT)
    await recordAiCost({ ...BASE_INPUT, completionTokens: 0 })
    const text = (await server.inject({ method: 'GET', url: '/business-metrics' })).body
    for (const family of [
      'business_ai_calls_total',
      'business_ai_tokens_total',
      'business_ai_cost_minor_units_total',
      'business_ai_record_failures_total',
      'business_ai_series_dropped_total',
    ]) {
      const types = text.split('\n').filter((l) => l.startsWith(`# TYPE ${family} `))
      expect(types.length).toBe(1)
    }
    const lines = sampleLines(text)
    expect(lines.filter((l, i) => lines.indexOf(l) !== i)).toEqual([])
  })

  it('T11 基数护栏:超过上限的新序列不录,并计入 dropped 而不是静默丢', async () => {
    server = await boot()
    // 只带 model 不带 token/成本 ⇒ 每条采样只写 calls 族,丢弃数可精确核对(不按条计会糊成一团)
    for (let i = 0; i < BM.AI_SERIES_CAP + 50; i++) {
      BM.recordAiCallSample({ vendor: 'v', model: `m-${i}` })
    }
    expect(BM.aiState.calls.size).toBe(BM.AI_SERIES_CAP)
    expect(BM.aiState.seriesDroppedTotal).toBe(50)
    const text = (await server.inject({ method: 'GET', url: '/business-metrics' })).body
    // 丢弃数必须 own 一条无标签样本,不能只体现在内存里
    expect(/^business_ai_series_dropped_total 50$/m.test(text)).toBe(true)
    expect(sampleLines(text).filter((l) => l.startsWith('business_ai_calls_total{')).length).toBe(
      BM.AI_SERIES_CAP,
    )
  })

  it('T12 reset 出口清的是同一份单例(装饰器/桥接/渲染三面不会各留一套)', async () => {
    server = await boot()
    await recordAiCost(BASE_INPUT)
    expect(BM.aiState.calls.size).toBe(1)
    const reset = await server.inject({
      method: 'POST',
      url: '/business-metrics/reset',
    })
    // 未带管理员身份 ⇒ 该路由自身的鉴权必须挡住,不能把重置变成公开破坏面
    expect(reset.statusCode).toBe(401)
    expect(BM.aiState.calls.size).toBe(1)
    BM.resetAiState()
    expect(BM.aiState.calls.size).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
