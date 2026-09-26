// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 格②生产者侧接线回归(2026-09-26):clawdbot 生产者裸 Date.now()-start → utils/elapsed-ms.ts 出口。
// 证明链:
//  ① 时钟回拨/分歧 ⇒ 生产者样本 latencyTrusted:false,analytics 不计 avg/p95 且 untrustedLatencyExcluded +1
//  ② 正常路径与旧算法同量级(假时钟 perf/wall 同步推进 ⇒ duration === 墙钟差值,即旧 Date.now()-start 的值)
//  ③ admin 探测展示面拿到 null 时序列化为 null,不得显示成 0(源码锁 + 真实序列化器断言)
//  ④ 变异对照由人工执行:把任一迁移动点改回裸 Date.now()-x,用例①必红(见各分支对 latencyTrusted 的严格断言)。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const { clock } = vi.hoisted(() => ({ clock: { perf: 0, wall: 0 } }))

// 把生产者内部 startStopwatch() 的时钟换成假时钟(唯一出口模块本身不 mock 判据,只注入 clocks)
vi.mock('../src/utils/elapsed-ms.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../src/utils/elapsed-ms.js')>()
  return {
    ...actual,
    startStopwatch: (opts?: Parameters<typeof actual.startStopwatch>[0]) =>
      actual.startStopwatch({
        ...opts,
        clocks: { perfNow: () => clock.perf, wallNow: () => clock.wall },
      }),
  }
})

const { HealthChecker } = await import('../src/services/clawdbot/health.js')
const { ToolExecutor } = await import('../src/services/clawdbot/tools.js')
const { ToolRunner } = await import('../src/services/clawdbot/tool-executor.js')
const { AnalyticsService } = await import('../src/services/clawdbot/analytics.js')
const { success } = await import('../src/utils/response.js')

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

beforeEach(() => {
  clock.perf = 0
  clock.wall = 0
})

describe('格② clawdbot 生产者走 elapsed-ms 出口', () => {
  it('②等价回归:双钟同步推进时,duration 与旧 Date.now()-start 同值', async () => {
    const health = new HealthChecker()
    health.registerDependency('db', async () => {
      clock.perf += 250
      clock.wall += 250
      return { status: 'healthy' as const }
    })
    const r = await health.checkDependency('db')
    expect(r.latencyMs).toBe(250)
    expect(r.latencyTrusted).toBe(true)

    const tools = new ToolExecutor()
    tools.register(
      {
        name: 't1',
        description: '',
        category: 'test',
        parameters: {},
        enabled: true,
      },
      async () => {
        clock.perf += 120
        clock.wall += 120
        return { success: true, output: 'ok', duration: 0 }
      },
    )
    const tr = await tools.execute('t1', {})
    expect(tr.duration).toBe(120)
    expect(tr.latencyTrusted).toBe(true)

    const runner = new ToolRunner()
    runner.register(
      { name: 'r1', description: '', category: 'test', timeout: 5_000, requiredPermissions: [] },
      async () => {
        clock.perf += 80
        clock.wall += 80
        return 'done'
      },
    )
    const rr = await runner.execute('r1', {}, { userId: 'u', permissions: [] })
    expect(rr.durationMs).toBe(80)
    expect(rr.latencyTrusted).toBe(true)
  })

  it('①时钟回拨(wall 倒退)⇒ 样本 latencyTrusted:false,analytics 不计 avg/p95 且 excluded +1', async () => {
    const health = new HealthChecker()
    health.registerDependency('clock-skew', async () => {
      clock.perf += 120
      clock.wall -= 5_000 // NTP step / 休眠唤醒式回拨
      return { status: 'healthy' as const }
    })
    const dirty = await health.checkDependency('clock-skew')
    expect(dirty.latencyTrusted).toBe(false) // 变异对照:改回裸 Date.now()-x 时这里拿到 undefined ⇒ 红
    expect(dirty.latencyMs).toBe(120) // 不可信时保留 perfMs 原始观测量,不冒充 0

    const analytics = new AnalyticsService()
    // 一条可信样本先入账
    analytics.record({
      botId: 'b1',
      sessionId: 's1',
      intent: 'demo',
      success: true,
      latencyMs: 100,
      latencyTrusted: true,
    })
    // 脏样本按生产者透出形态喂入
    analytics.record({
      botId: 'b1',
      sessionId: 's1',
      intent: 'demo',
      success: true,
      latencyMs: dirty.latencyMs,
      latencyTrusted: dirty.latencyTrusted,
    })
    const summary = analytics.getSummary()
    expect(summary.totalCalls).toBe(2)
    expect(summary.untrustedLatencyExcluded).toBe(1)
    expect(summary.avgLatencyMs).toBe(100) // 120 未参与
    expect(summary.p95LatencyMs).toBe(100)
    // 记录保留不静默丢(格②分析层既有语义)
    expect(analytics.query()[1]?.latencyTrusted).toBe(false)
  })

  it('①b时钟分歧(wall 超前 perf >2s)同样判不可信(catch 分支之外也生效)', async () => {
    const health = new HealthChecker()
    health.registerDependency('drift', async () => {
      clock.perf += 300
      clock.wall += 100_000
      return { status: 'healthy' as const }
    })
    const r = await health.checkDependency('drift')
    expect(r.latencyTrusted).toBe(false)
  })

  it('catch 分支同样带 trusted 标记(handler 抛错 + 回拨)', async () => {
    const tools = new ToolExecutor()
    tools.register(
      {
        name: 'boom',
        description: '',
        category: 'test',
        parameters: {},
        enabled: true,
      },
      async () => {
        clock.perf += 50
        clock.wall -= 9_000
        throw new Error('kaboom')
      },
    )
    const r = await tools.execute('boom', {})
    expect(r.success).toBe(false)
    expect(r.latencyTrusted).toBe(false)
    expect(r.duration).toBe(50)
  })
})

describe('格② admin 探测延迟(展示面对 null 显式)', () => {
  const src = readFileSync(resolve(ROOT, 'src/routes/admin/relay-channels.ts'), 'utf8')

  it('③两把探测函数已走出口且返回类型放宽为 number | null', () => {
    expect(src).toContain('startStopwatch')
    expect(src).toContain('latencyMs: number | null')
    expect(src).not.toMatch(/Date\.now\(\) - startedAt/)
  })

  it('③展示面透出 null(真实序列化器:渲染串含 "latencyMs":null,不得是 0)', () => {
    // 探测函数不可达外部 fetch(本票禁真发外部 HTTP),按响应装配的同一形态渲染:
    const payload = success({ ok: false, latencyMs: null as number | null, httpStatus: 0 })
    const json = JSON.stringify(payload)
    expect(json).toContain('"latencyMs":null')
    expect(json).not.toContain('"latencyMs":0')
  })

  it('③落库兜底 ?? 0 只允许出现在 llm_call_logs 写入处(展示响应不得套 0)', () => {
    const coercions = src.match(/latencyMs: result\.latencyMs \?\? 0/g) ?? []
    expect(coercions.length).toBe(1)
    expect(src).toContain('latencyMs: result.latencyMs,')
    // 不可信标记随行李落库,统计侧可按 metadata.latencyTrusted 过滤
    expect(src).toContain('latencyTrusted: result.latencyMs !== null')
  })
})

describe('格② clawdbot 生产面无裸耗时差值(剩余登记面)', () => {
  const files = [
    'health.ts',
    'tools.ts',
    'tool-executor.ts',
    'gateway.ts',
    'canvas.ts',
    'skills.ts',
    'integrations.ts',
    'browser.ts',
  ]
  for (const f of files) {
    it(`${f} 不再含 Date.now() - start`, () => {
      const src = readFileSync(resolve(ROOT, 'src/services/clawdbot', f), 'utf8')
      expect(src).not.toMatch(/Date\.now\(\) - start\b/)
    })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
