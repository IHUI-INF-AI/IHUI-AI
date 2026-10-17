// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 封闭枚举零基线用例(2026-10-17 立)。
 *
 * 立因(现读实测):`/business-metrics` 是**进程内存快照**的手工渲染器 —— 某些族只打印
 * `# HELP`/`# TYPE`,一条样本都没有,于是 Prometheus series=0、Grafana 面板恒 "No data",
 * 而"这段时间没人做过"与"埋点断了"在面板上同形,运维无从分辨。
 * 修法只针对**标签值在源码里已声明为封闭集**的族:逐枚举值开一条 0 样本。
 *
 * 本文件钉死三件事,缺一不算修好:
 * - A) 事件发生**前**基线就在(每个枚举成员一条、值为 0)—— 摘掉基线必须翻红;
 * - B) 事件发生**后**该条恰好是 1,且没有多出第二条同标签序列 —— 证明 0 基线不是
 *      "先占一条再另计一条"的重复计数(这是这类修法唯一的坑);
 * - C) 开放标签集(tenant_id / source_ip / 试卷 category / AI vendor+model / 订单)
 *      **不许**被基线编造出来:一个样本都没有才是真相,`tenant_id="unknown"` 比 No data 更坏。
 * 另加 D) 复位(admin reset / onClose)后基线必须回来,否则一次清零就把面板打回原状;
 *    E) 钩子真写出的 error_type 必须落在基线清单内(口径同源,不是两份清单对账)。
 *
 * 测试纪律:db / logger 全 mock,零连接(禁碰 PG 8810 与 Redis 8811,AGENTS §5);
 * 枚举清单一律从源文件取(§22c:判据不得在测试里抄第二份)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), query: vi.fn(), execute: vi.fn() },
  dbRead: { select: vi.fn(), query: vi.fn(), execute: vi.fn() },
}))
vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import businessMetricsPlugin, {
  __test__ as BM,
  recordAuthLoginAnomaly,
  recordOssRequest,
  recordOssError,
} from '../src/plugins/business-metrics.js'

let server: FastifyInstance | undefined
const savedOssDriver = process.env.OSS_DRIVER_TYPE

beforeEach(() => {
  BM.resetIhuiState()
})

afterEach(async () => {
  if (server) {
    await server.close()
    server = undefined
  }
  if (savedOssDriver === undefined) delete process.env.OSS_DRIVER_TYPE
  else process.env.OSS_DRIVER_TYPE = savedOssDriver
})

async function boot(
  /** 探针路由必须在 ready() 之前挂(ready 之后再 addRoute 会撞 "Root plugin has already booted")。 */
  setup?: (app: FastifyInstance) => void,
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(businessMetricsPlugin)
  if (setup) setup(app)
  await app.ready()
  return app
}

async function render(app: FastifyInstance): Promise<string> {
  const res = await app.inject({ method: 'GET', url: '/business-metrics' })
  expect(res.statusCode).toBe(200)
  return res.body
}

/** 取一条样本的值(名字 + 完整标签集精确匹配,不做前缀模糊)。 */
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

function sampleLines(text: string): string[] {
  return text.split('\n').filter((l) => l.length > 0 && !l.startsWith('#'))
}

/** 某个 family 的样本行数(带该族前缀与左花括号,精确到族名)。 */
function familyLineCount(text: string, family: string): number {
  return sampleLines(text).filter((l) => l.startsWith(`${family}{`)).length
}

describe('A) 封闭枚举零基线:事件发生前每条都是 0', () => {
  it('B1 business_funnel_total 对每个 stage 有一条 channel="default" 的 0 样本,且只这么多', async () => {
    server = await boot()
    const text = await render(server)
    for (const stage of BM.FUNNEL_STAGES) {
      expect(
        sample(text, 'business_funnel_total', {
          stage,
          channel: BM.FUNNEL_DEFAULT_CHANNEL,
        }),
        `漏斗阶段 ${stage} 缺 0 基线`,
      ).toBe('0')
    }
    // 渠道是开放集 ⇒ 除缺省档外不得凭空多出任何 channel 序列
    expect(familyLineCount(text, 'business_funnel_total')).toBe(BM.FUNNEL_STAGES.length)
  })

  it('B3 ihui_auth_login_anomaly_total 对四个风控原因各有一条 0 样本', async () => {
    server = await boot()
    const text = await render(server)
    for (const reason of BM.AUTH_LOGIN_ANOMALY_REASONS) {
      expect(
        sample(text, 'ihui_auth_login_anomaly_total', { reason }),
        `原因 ${reason} 缺 0 基线`,
      ).toBe('0')
    }
    expect(familyLineCount(text, 'ihui_auth_login_anomaly_total')).toBe(
      BM.AUTH_LOGIN_ANOMALY_REASONS.length,
    )
  })

  it('B4 ihui_oss_requests_total 对六个存储驱动各有一条 0 样本', async () => {
    server = await boot()
    const text = await render(server)
    for (const driver of BM.OSS_DRIVER_TYPES) {
      expect(sample(text, 'ihui_oss_requests_total', { driver }), `驱动 ${driver} 缺 0 基线`).toBe(
        '0',
      )
    }
    expect(familyLineCount(text, 'ihui_oss_requests_total')).toBe(BM.OSS_DRIVER_TYPES.length)
  })

  it('B5 ihui_oss_errors_total 对 驱动×error_type 全组合各有一条 0 样本', async () => {
    server = await boot()
    const text = await render(server)
    for (const driver of BM.OSS_DRIVER_TYPES) {
      for (const errorType of BM.OSS_ERROR_TYPES) {
        expect(
          sample(text, 'ihui_oss_errors_total', { driver, error_type: errorType }),
          `${driver}/${errorType} 缺 0 基线`,
        ).toBe('0')
      }
    }
    expect(familyLineCount(text, 'ihui_oss_errors_total')).toBe(
      BM.OSS_DRIVER_TYPES.length * BM.OSS_ERROR_TYPES.length,
    )
  })
})

describe('B) 真实事件顶替 0,不重复计数', () => {
  it('B2 recordFunnel("register") 把该条 0 顶成 1,且没有第二条同标签序列', async () => {
    server = await boot()
    expect(
      sample(await render(server), 'business_funnel_total', {
        stage: 'register',
        channel: 'default',
      }),
    ).toBe('0')

    server.recordFunnel('register')
    const text = await render(server)
    expect(
      sample(text, 'business_funnel_total', {
        stage: 'register',
        channel: BM.FUNNEL_DEFAULT_CHANNEL,
      }),
      '0 基线被当成"再加一条"了 ⇒ 重复计数',
    ).toBe('1')
    expect(familyLineCount(text, 'business_funnel_total')).toBe(BM.FUNNEL_STAGES.length)

    server.recordFunnel('register')
    expect(
      sample(await render(server), 'business_funnel_total', {
        stage: 'register',
        channel: 'default',
      }),
    ).toBe('2')
  })

  it('B6 模块级写入出口(生产路径)对基线键是累加而非新开区', async () => {
    server = await boot()
    recordAuthLoginAnomaly('deny')
    recordOssRequest('local')
    recordOssError('aliyun-oss', 'status_4xx')
    const text = await render(server)
    expect(sample(text, 'ihui_auth_login_anomaly_total', { reason: 'deny' })).toBe('1')
    expect(sample(text, 'ihui_oss_requests_total', { driver: 'local' })).toBe('1')
    expect(
      sample(text, 'ihui_oss_errors_total', { driver: 'aliyun-oss', error_type: 'status_4xx' }),
    ).toBe('1')
    // 未动的枚举成员必须仍是 0(不是整族被重置成同一个数)
    expect(sample(text, 'ihui_oss_requests_total', { driver: 's3' })).toBe('0')
    expect(sample(text, 'ihui_auth_login_anomaly_total', { reason: 'review' })).toBe('0')
    expect(familyLineCount(text, 'ihui_oss_requests_total')).toBe(BM.OSS_DRIVER_TYPES.length)
    expect(familyLineCount(text, 'ihui_oss_errors_total')).toBe(
      BM.OSS_DRIVER_TYPES.length * BM.OSS_ERROR_TYPES.length,
    )
    expect(familyLineCount(text, 'ihui_auth_login_anomaly_total')).toBe(
      BM.AUTH_LOGIN_ANOMALY_REASONS.length,
    )
  })

  it('E) onResponse 钩子写出的 error_type 落在基线清单内(口径同源)', async () => {
    process.env.OSS_DRIVER_TYPE = 'local'
    server = await boot((app) => {
      app.get('/api/files/baseline-probe', async (_request, reply) => reply.status(404).send('x'))
      app.get('/api/files/baseline-ok', async () => 'ok')
    })
    await server.inject({ method: 'GET', url: '/api/files/baseline-probe' })
    await server.inject({ method: 'GET', url: '/api/files/baseline-ok' })
    await new Promise((resolve) => setImmediate(resolve)) // 钩子内是 setImmediate 上报

    const text = await render(server)
    // 404 ⇒ 基线里那条 local/status_4xx 从 0 变 1(而不是另开一条钩子自造的键)
    expect(
      sample(text, 'ihui_oss_errors_total', { driver: 'local', error_type: 'status_4xx' }),
    ).toBe('1')
    expect(sample(text, 'ihui_oss_requests_total', { driver: 'local' })).toBe('2')
    // 钩子一条也不许多出基线之外的 error_type / 总数
    const errorTypes = sampleLines(text)
      .filter((l) => l.startsWith('ihui_oss_errors_total{'))
      .map((l) => /error_type="([^"]+)"/.exec(l)?.[1] ?? '')
    for (const t of errorTypes) {
      expect(BM.OSS_ERROR_TYPES as readonly string[]).toContain(t)
    }
    expect(familyLineCount(text, 'ihui_oss_errors_total')).toBe(
      BM.OSS_DRIVER_TYPES.length * BM.OSS_ERROR_TYPES.length,
    )
    // ossErrorTypeFor 本身按状态码族给值(4xx/5xx 与基线清单逐一对应)
    expect(BM.ossErrorTypeFor(404)).toBe('status_4xx')
    expect(BM.ossErrorTypeFor(502)).toBe('status_5xx')
  })
})

describe('C) 开放标签集不许被编造', () => {
  const OPEN_FAMILIES = [
    'ihui_tenant_api_calls_total',
    'ihui_auth_login_failed_total',
    'ihui_auth_token_revoked_total',
    'ihui_exam_question_used_total',
    'business_ai_calls_total',
    'business_ai_tokens_total',
    'business_ai_cost_minor_units_total',
    'business_ai_record_failures_total',
    'business_orders_total',
  ] as const

  it('B7 无事件时这些族零样本,文本里也不出现 unknown 之类的编造标签值', async () => {
    server = await boot()
    const text = await render(server)
    for (const family of OPEN_FAMILIES) {
      expect(familyLineCount(text, family), `${family} 是开放集,不该有基线`).toBe(0)
      // HELP/TYPE 头照旧存在(面板端族名可解析),只是没有样本
      expect(text).toContain(`# TYPE ${family} `)
    }
    expect(text).not.toContain('tenant_id="unknown"')
    expect(text).not.toContain('source_ip="unknown"')
    expect(text).not.toContain('category="unknown"')
  })
})

describe('D) 复位/重启后基线仍在', () => {
  it('B8 resetIhuiState(= admin reset 与 onClose 走的那条)之后基线自动重开', async () => {
    server = await boot()
    recordAuthLoginAnomaly('lockout')
    expect(
      sample(await render(server), 'ihui_auth_login_anomaly_total', { reason: 'lockout' }),
    ).toBe('1')
    BM.resetIhuiState()
    const text = await render(server)
    for (const reason of BM.AUTH_LOGIN_ANOMALY_REASONS) {
      expect(sample(text, 'ihui_auth_login_anomaly_total', { reason })).toBe('0')
    }
    for (const driver of BM.OSS_DRIVER_TYPES) {
      expect(sample(text, 'ihui_oss_requests_total', { driver })).toBe('0')
    }
    expect(sampleLines(text).some((l) => l.startsWith('ihui_tenant_api_calls_total{'))).toBe(false)
  })

  it('B9 重新注册插件(等价进程重启)后漏斗基线仍在,且每条样本行格式合法不重复', async () => {
    const first = await boot()
    first.recordFunnel('paid')
    await first.close()

    server = await boot()
    const text = await render(server)
    for (const stage of BM.FUNNEL_STAGES) {
      expect(sample(text, 'business_funnel_total', { stage, channel: 'default' })).toBe('0')
    }
    const lines = sampleLines(text)
    // 基线不许把渲染文本写坏:每行 name{k="v"} number,且同一条序列不重复打印
    for (const l of lines) {
      expect(l).toMatch(
        /^[a-z_][a-z0-9_]*(?:\{(?:[a-z_]+="[^"\n]*")(?:,[a-z_]+="[^"\n]*")*\})? [-\d.eE+Inf]+$/,
      )
    }
    expect(lines.filter((l, i) => lines.indexOf(l) !== i)).toEqual([])
    for (const family of [
      'business_funnel_total',
      'ihui_auth_login_anomaly_total',
      'ihui_oss_requests_total',
      'ihui_oss_errors_total',
    ]) {
      expect(text.split('\n').filter((l) => l.startsWith(`# TYPE ${family} `)).length).toBe(1)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
