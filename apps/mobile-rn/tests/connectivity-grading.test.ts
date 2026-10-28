// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 台账 G-1113920 的常驻锁:在线判据必须分档、未判定不得渲染成"已确认离线"。
//
// 现场(2026-10-10/11 两次真机):设备 `ping` 通(0% loss,RTT 408–505ms)、`dumpsys connectivity`
// 两条 NetworkAgentInfo 均 VALIDATED + NOT_SUSPENDED,而 App 顶部横幅一路亮红写「网络已断开」。
// 旧实现(`apps/mobile-rn/src/context/NetworkContext.tsx` 重写前)把三件事压成一个布尔:
//   ① `setIsOnline(resp.ok)` ⇒ 服务器答了但业务失败(4xx/5xx)也判离线;
//   ② 一次探测失败即离线,且 30s 才复探 ⇒ 单次抖动就常驻;
//   ③ 只探配置里的 API 域(开发构建默认 `http://localhost:8802`,真机上那就是手机自己)
//      ⇒ "我这台构建没连上开发机"被说成"用户的网络断了"。
// 判据本体住 `packages/shared/src/utils/connectivity`,这里按**相对路径直连真实源码**取它 ——
// 走 `@ihui/shared/utils` 别名会命中端内替身(`apps/mobile-rn/vitest.config.ts` 文件头反复登记
// 的那条规矩:给纯逻辑写 mock,测的就是 mock)。全程零网络、零生产依赖(§5 测试隔离铁律):
// 探测层用注入的假 fetch 取证。
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  bannerKindFor,
  classifyRound,
  createConnectivityTracker,
  DEFAULT_CONNECTIVITY_THRESHOLDS,
  type ProbeRound,
  type ProbeSample,
} from '@ihui/shared/utils/connectivity'
import {
  probeConnectivityRound,
  probeTarget,
  PROBE_TIMEOUT_MS,
  PROBE_TARGETS,
} from '../src/lib/network-probe'

const THRESHOLDS = DEFAULT_CONNECTIVITY_THRESHOLDS

// 覆盖面自证:下面的用例喂的是"全部目标都不可达",所以目标数必须与源面一致 ——
// 哪天加了第三个探测目标而这里没跟上,判据会拿两份样本冒充全集而照样绿。
const [TARGET_A, TARGET_B] = PROBE_TARGETS
if (!TARGET_A || !TARGET_B || PROBE_TARGETS.length !== 2) {
  throw new Error(
    `PROBE_TARGETS 现为 ${PROBE_TARGETS.length} 项,本锁按 2 项写死 ⇒ 请同步用例,不得放宽这条自证`,
  )
}

const answered = (target: string, latencyMs: number, httpStatus = 200): ProbeSample => ({
  target,
  kind: 'response',
  httpStatus,
  latencyMs,
})
const unreachable = (target: string): ProbeSample => ({
  target,
  kind: 'unreachable',
  detail: 'mock refused',
})
const timedOut = (target: string): ProbeSample => ({
  target,
  kind: 'timeout',
  latencyMs: PROBE_TIMEOUT_MS,
})
const notProbed = (target: string): ProbeSample => ({
  target,
  kind: 'not-probed',
  reason: 'mock 未配置',
})

const round = (deviceSignal: ProbeRound['deviceSignal'], samples: ProbeSample[]): ProbeRound => ({
  deviceSignal,
  samples,
})

describe('G-1113920 ①：收到应答就不许说"没网"(旧实现最贵的一格)', () => {
  it('200 + 快 ⇒ online，横幅不出', () => {
    const s = classifyRound(round('unknown', [answered('a', 300)]), 0, THRESHOLDS)
    expect([s.status, bannerKindFor(s)]).toEqual(['online', 'none'])
  })

  it('服务器答了但业务失败(503)⇒ 仍是 online，不得判离线(旧写法 setIsOnline(resp.ok) 的回归)', () => {
    const s = classifyRound(round('unknown', [answered('a', 400, 503)]), 5, THRESHOLDS)
    expect(s.status).toBe('online')
    expect(bannerKindFor(s)).toBe('none')
    expect(s.consecutiveFailedRounds).toBe(0)
  })

  it('答了但耗时超阈 ⇒ slow(慢网 ≠ 断网)', () => {
    const s = classifyRound(
      round('unknown', [answered('a', THRESHOLDS.slowLatencyMs + 1)]),
      0,
      THRESHOLDS,
    )
    expect([s.status, s.reason, bannerKindFor(s)]).toEqual(['slow', 'slow-response', 'slow'])
  })
})

describe('G-1113920 ②：阳性对照 —— 探测目标不可达但设备在线 ⇒ 落 unknown，绝不落 offline', () => {
  it('两条目标全 unreachable + deviceSignal=online ⇒ unknown / unconfirmed', () => {
    const s = classifyRound(
      round('online', [unreachable(TARGET_A), unreachable(TARGET_B)]),
      THRESHOLDS.offlineConsecutiveRounds + 2,
      THRESHOLDS,
    )
    expect(s.status).not.toBe('offline')
    expect(s.status).toBe('unknown')
    expect(s.reason).toBe('probe-target-unreachable')
    expect(bannerKindFor(s)).toBe('unconfirmed')
    // 未判定必须逐条打印原因，不得静默成"看起来一切正常"
    expect(s.detail.length).toBeGreaterThan(0)
    expect(s.detail.join('\n')).toContain('已连网')
  })

  it('开发构建那一型：配置域(primary)拒绝连接、旁证域(egress)答了 ⇒ online，横幅不亮红', () => {
    const s = classifyRound(
      round('unknown', [
        unreachable('http://localhost:8802/api/health'),
        answered('https://aizhs.top/api/health', 900),
      ]),
      2,
      THRESHOLDS,
    )
    expect([s.status, bannerKindFor(s)]).toEqual(['online', 'none'])
  })

  it('有目标压根没探 ⇒ 覆盖面不闭合 ⇒ unknown，不得据此下离线结论', () => {
    const s = classifyRound(round('unknown', [unreachable('a'), notProbed('b')]), 10, THRESHOLDS)
    expect(s.status).toBe('unknown')
    expect(s.status).not.toBe('offline')
    expect(s.detail.join('\n')).toContain('不闭合')
  })
})

describe('G-1113920 ③：同一把尺子喂"真离线"⇒ 必落 offline', () => {
  it('设备级信号直接报无网 ⇒ 立即 offline', () => {
    const s = classifyRound(round('offline', [unreachable('a')]), 0, THRESHOLDS)
    expect([s.status, s.reason, bannerKindFor(s)]).toEqual([
      'offline',
      'device-offline-signal',
      'offline',
    ])
  })

  it('无任何反证时，全目标连续未答达到阈值才升级 offline；未达阈值只报 pending', () => {
    const t = createConnectivityTracker(THRESHOLDS)
    const failing = round('unknown', [timedOut('a'), unreachable('b')])
    const r1 = t.observe(failing)
    const r2 = t.observe(failing)
    expect([r1.status, r1.consecutiveFailedRounds]).toEqual(['unknown', 1])
    expect([r2.status, r2.consecutiveFailedRounds]).toEqual(['unknown', 2])
    expect(bannerKindFor(r2)).toBe('none') // 抖动不刷屏
    const r3 = t.observe(failing)
    expect([r3.status, r3.reason, bannerKindFor(r3)]).toEqual([
      'offline',
      'all-targets-unreachable',
      'offline',
    ])
  })

  it('自动恢复：判成 offline 之后**一次**收到应答即解除横幅，不需要用户手动刷新', () => {
    const t = createConnectivityTracker(THRESHOLDS)
    for (let i = 0; i < THRESHOLDS.offlineConsecutiveRounds; i++)
      t.observe(round('unknown', [timedOut('a')]))
    expect(bannerKindFor(t.peek())).toBe('offline')
    const back = t.observe(round('unknown', [answered('a', 200)]))
    expect([back.status, bannerKindFor(back), back.consecutiveFailedRounds]).toEqual([
      'online',
      'none',
      0,
    ])
  })
})

describe('G-1113920 ④：一个样本都没有 ⇒ 未判定，不得伪装成"跑过了"或"没网"', () => {
  it('空轮 ⇒ unknown/no-sample，横幅不出但结论是"未知"不是"在线"', () => {
    const s = classifyRound(round('unknown', []), 0, THRESHOLDS)
    expect([s.status, s.reason, bannerKindFor(s)]).toEqual(['unknown', 'no-sample', 'none'])
    expect(s.latencyMs).toBeNull()
  })

  it('全是 not-probed(例如运行环境没有 fetch)⇒ unconfirmed 档，逐条报名原因', () => {
    const s = classifyRound(round('unknown', [notProbed('a'), notProbed('b')]), 0, THRESHOLDS)
    expect([s.status, s.reason, bannerKindFor(s)]).toEqual([
      'unknown',
      'probe-unavailable',
      'unconfirmed',
    ])
    expect(s.detail.join('\n')).toContain('未探')
  })
})

describe('G-1113920 ⑤：探测层只产出观测，不产出结论（假 fetch，零真实网络）', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('HTTP 500 产出的是 response 样本(把"业务失败"和"没网"分开的第一道关口)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ status: 500 }) as unknown as Response),
    )
    const sample = await probeTarget('http://127.0.0.1:1/api/health', 50)
    expect(sample.kind).toBe('response')
    if (sample.kind === 'response') expect(sample.httpStatus).toBe(500)
  })

  it('fetch 抛错 ⇒ unreachable，并留下可归因的 detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Failed to connect to /127.0.0.1:1')
      }),
    )
    const sample = await probeTarget('http://127.0.0.1:1/api/health', 50)
    expect(sample.kind).toBe('unreachable')
    if (sample.kind === 'unreachable') expect(sample.detail).toContain('Failed to connect')
  })

  it('整轮取两个目标，deviceSignal 如实为 unknown(本端没有原生网络状态能力，不得猜)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (url: string) =>
          ({ status: url.includes('aizhs.top') ? 200 : 500 }) as unknown as Response,
      ),
    )
    const r = await probeConnectivityRound()
    expect(r.deviceSignal).toBe('unknown')
    expect(r.samples.map((s) => s.target)).toEqual(PROBE_TARGETS.slice())
    // 配置域没答、旁证域答了 ⇒ 判据给出 online,这正是票面那次误报的正解
    const s = classifyRound(r, 0, THRESHOLDS)
    expect(s.status).toBe('online')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
