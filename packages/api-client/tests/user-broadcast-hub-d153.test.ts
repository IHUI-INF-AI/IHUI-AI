// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D153(2026-09-29 立)per-user 常连广播**消费面**回归 —— 票 §十 D153 第 6 栏 ①③④ 的客户端半边。
 * 权威口径:`docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md` §11.3(载体 = 全端 per-user 常连推送)。
 *
 * 四条判据,各自钉住一个会"安静发生"的失效:
 *  ① 帧一到即更新本地会话行,且**整条路径零 HTTP 请求**。票面要的是"B 端不刷新就看到",
 *    不是"收到推送后再 GET 一次"——所以 fetch 计数=0 是断言本体,不是叙述。
 *    反向:若实现改成 refetch,本用例必红(计数从 0 变 1),见 `fetch 探针自身可见` 那条阳性对照。
 *  ② 一台设备只有一条通道:第二个订阅者复用同一条(引用计数),不得"每个 hook 各建一条"。
 *  ③ payload 缺 `changedBy` ⇒ 整帧被拒:构造点抛错 + parse 层返回 null + hub 记「未判定」并点名,
 *    **handler 一次都不许跑**(票第 6 栏验收③:缺它就"必红",不是"照用但不知道谁改的")。
 *  ④ 帧形态只由 `@ihui/types` 那份判别联合描述:端内不得出现第二份事件名**清单**或手解帧的
 *    字符串比较。判据对合成语料有牙(能认出数组清单、能认出 `=== 'conversation:updated'`),
 *    对真实 handler 键位不误伤 —— 两臂同时成立才算这条判据在起作用而不是空转。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { conversationUpdatedEvent, parseUserBroadcastFrame } from '@ihui/types'
import {
  subscribeUserBroadcast,
  feedUserBroadcastFrame,
  getUserBroadcastHubStats,
  resetUserBroadcastHub,
  createUserBroadcastClient,
  USER_BROADCAST_SUBSCRIBABLE_EVENTS,
} from '../src/broadcast-client.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const BASE = 'https://api.example.test'
const CONV = '11111111-1111-4111-8111-111111111111'
const USER_A = 'aaaaaaaa-1111-4111-8111-111111111111'

/** 一帧真实形态:由生产面**唯一出口**构造,不在测试里手拼(手拼的夹具会与线上漂移) */
function makeFrame(title: string): { event: string; data: unknown } {
  const evt = conversationUpdatedEvent({
    conversationId: CONV,
    fields: ['title'],
    changedBy: USER_A,
    at: '2026-09-29T08:00:00.000Z',
    values: { title },
  })
  return { event: evt.event, data: evt.data }
}

describe('D153 ① 帧到达即更新且零 HTTP(票第 6 栏验收① 的客户端半边)', () => {
  let fetches = 0
  const spy = (url: unknown): never => {
    fetches += 1
    throw new Error(`广播路径不应发 HTTP:${String(url)}`)
  }

  beforeEach(() => {
    fetches = 0
    vi.stubGlobal('fetch', vi.fn(spy))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    resetUserBroadcastHub()
  })

  it('阳性对照:fetch 探针本身是可见的(否则"计数=0"是空断言)', () => {
    expect(() => globalThis.fetch('https://x.test')).toThrow(/广播路径不应发 HTTP/)
    expect(fetches).toBe(1)
  })

  it('注入一帧 ⇒ 本地会话行的标题变成新值,而整条路径一次 HTTP 都没发', () => {
    const titles = new Map<string, string | undefined>([[CONV, '旧标题']])
    const undetermined: unknown[] = []
    const sub = subscribeUserBroadcast(
      { baseUrl: BASE, tokenProvider: () => 't', transport: 'injected' },
      {
        'conversation:updated': (evt) => {
          const v = evt.data.values?.title
          if (typeof v === 'string') titles.set(evt.data.conversationId, v)
        },
        onUndetermined: (raw) => undetermined.push(raw),
      },
    )

    const got = feedUserBroadcastFrame(makeFrame('另一端改的新名字'), { baseUrl: BASE })

    expect(got).not.toBeNull()
    expect(titles.get(CONV)).toBe('另一端改的新名字')
    expect(undetermined).toHaveLength(0)
    // 判据本体:推送路径零 HTTP
    expect(fetches).toBe(0)
    sub.close()
  })

  it('② 第二个订阅者复用同一条通道(引用计数;一台设备不得各建一条)', () => {
    const a = subscribeUserBroadcast(
      { baseUrl: BASE, tokenProvider: () => 't', transport: 'injected' },
      { 'conversation:updated': () => {} },
    )
    const b = subscribeUserBroadcast(
      { baseUrl: BASE, tokenProvider: () => 't', transport: 'injected' },
      { 'conversation:updated': () => {} },
    )
    const channels = getUserBroadcastHubStats()
    expect(channels).toHaveLength(1)
    expect(channels[0]?.subscribers).toBe(2)
    // 注入档不拥有连接:connected 必须为 false(谎报"已连"就是把没判写成判过了)
    expect(channels[0]?.connected).toBe(false)
    expect(channels[0]?.transport).toBe('injected')
    a.close()
    b.close()
    expect(getUserBroadcastHubStats()).toHaveLength(0)
  })
})

describe('D153 ③ payload 缺 changedBy ⇒ 必红(票第 6 栏验收③)', () => {
  afterEach(() => resetUserBroadcastHub())

  it('构造点直接抛:生产面漏传 changedBy 不可能产出一帧', () => {
    expect(() =>
      conversationUpdatedEvent({
        conversationId: CONV,
        fields: ['title'],
        changedBy: '',
        at: '2026-09-29T08:00:00.000Z',
      }),
    ).toThrow(/changedBy/)
  })

  it('parse 层拒收整帧,且 handler 一次都不跑、帧被记成「未判定」并点名', () => {
    const frame = makeFrame('新名字') as { event: string; data: Record<string, unknown> }
    delete frame.data.changedBy
    expect(parseUserBroadcastFrame(frame)).toBeNull()

    let applied = 0
    const undetermined: unknown[] = []
    const sub = subscribeUserBroadcast(
      { baseUrl: BASE, tokenProvider: () => 't', transport: 'injected' },
      {
        'conversation:updated': () => {
          applied += 1
        },
        onUndetermined: (raw) => undetermined.push(raw),
      },
    )
    expect(feedUserBroadcastFrame(frame, { baseUrl: BASE })).toBeNull()
    expect(applied).toBe(0)
    expect(undetermined).toHaveLength(1)
    expect(getUserBroadcastHubStats()[0]?.undetermined).toBe(1)
    sub.close()
  })

  it('同型:未知事件名不得静默丢弃(静默丢弃与静默分叉在用户侧同一个症状)', () => {
    let applied = 0
    const undetermined: unknown[] = []
    const sub = subscribeUserBroadcast(
      { baseUrl: BASE, tokenProvider: () => 't', transport: 'injected' },
      {
        'conversation:updated': () => {
          applied += 1
        },
        onUndetermined: (raw) => undetermined.push(raw),
      },
    )
    feedUserBroadcastFrame({ event: 'conversation:deleted', data: { conversationId: CONV } }, { baseUrl: BASE })
    expect(applied).toBe(0)
    expect(undetermined).toHaveLength(1)
    sub.close()
  })
})

// ===================== ④ 第二份事件名清单(源码面扫描) =====================

/** 判据:一帧文本里事件名被当成**清单**(数组/联合)或**手解帧的比较**出现 ⇒ 违规 */
const EVENT_LITERAL = "'conversation:updated'"

function findSecondTruth(file: string, text: string): string[] {
  // 权威两文件之外才算第二份:types 那份是唯一定义,api-client 那份是投影 + handler 键位
  if (file.endsWith('user-broadcast.ts') || file.endsWith('broadcast-client.ts')) return []
  const out: string[] = []
  const lines = text.split(/\r?\n/)
  lines.forEach((line, i) => {
    if (!line.includes(EVENT_LITERAL)) return
    // 数组清单:[ 'conversation:updated' … ](含 as const 与字面量联合的第二份定义形态)
    if (/\[[^\]]*$/.test(line.slice(0, line.indexOf(EVENT_LITERAL)))) out.push(`${file}:${i + 1} 事件名清单`)
    // 手解帧:与事件名做等值比较(那是端内自己又写了一遍判别)
    if (/===|!==|==(?!=)/.test(line)) out.push(`${file}:${i + 1} 手解帧比较`)
  })
  return out
}

/** 阳性对照语料:证明这条判据认得出它要防的两种形态 */
const POSITIVE_CORPUS: Array<{ file: string; text: string; expectHit: boolean; why: string }> = [
  {
    file: 'apps/web/src/second-list.ts',
    text: `export const LOCAL_EVENTS = [${EVENT_LITERAL}] as const`,
    expectHit: true,
    why: '端内数组清单',
  },
  {
    file: 'apps/miniapp-taro/src/hand-rolled.ts',
    text: `if (frame.event === ${EVENT_LITERAL}) { /* 端内自己解帧 */ }`,
    expectHit: true,
    why: '端内手解帧比较',
  },
  {
    file: 'apps/web/src/hooks/ok.ts',
    text: `subscribe(cfg, { ${EVENT_LITERAL}: (evt) => apply(evt) })`,
    expectHit: false,
    why: 'handler 键位由 UserBroadcastHandlers 类型约束,不是第二份清单',
  },
  {
    file: 'packages/types/src/user-broadcast.ts',
    text: `export const USER_BROADCAST_EVENT_NAMES = [${EVENT_LITERAL}] as const`,
    expectHit: false,
    why: '唯一权威定义本身豁免(否则扫描永远命中权威,判据没有意义)',
  },
]

describe('D153 ④ 帧形态只由 @ihui/types 描述:端内不得有第二份事件名清单', () => {
  it('判据对合成语料有牙(两种违规都命中),对正当 handler 键位不误伤', () => {
    for (const c of POSITIVE_CORPUS) {
      const hits = findSecondTruth(c.file, c.text)
      if (c.expectHit) expect(hits.length, c.why).toBeGreaterThan(0)
      else expect(hits, c.why).toEqual([])
    }
  })

  it('真仓受检面零命中,且阳性对照证明扫描确实读到了内容(不是空扫)', () => {
    const faces = [
      'apps/web/src',
      'apps/miniapp-taro/src',
      'packages/app/src',
      'apps/mobile-rn/src',
      'apps/api/src',
    ]
    // git grep 的 **退出码 1 = "没有命中"**,不是失败(把它当异常抛会把"扫到 0"读成"扫描坏了");
    // --untracked 必须带:新落地但还没 git add 的消费面文件正是本判据要看的对象,
    // 默认档只扫已跟踪文件 ⇒ 它会对着空气打分并报"零命中"。
    let matched: string[] = []
    try {
      matched = execFileSync(
        'git',
        ['-c', 'safe.directory=*', 'grep', '-l', '--untracked', '--fixed-string', EVENT_LITERAL, '--', ...faces],
        { cwd: ROOT, windowsHide: true, timeout: 120_000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
      )
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status !== 1) throw err
    }

    // 扫描确实看见了东西 ⇒ "0 命中"才是结论而不是空转(受检面里至少 web 那个消费点在用 handler 键)
    expect(matched.length, '受检面必须至少命中一个真实消费点,否则本扫描是在对着空气打分').toBeGreaterThan(0)

    const violations = matched.flatMap((rel) =>
      findSecondTruth(rel, readFileSync(join(ROOT, rel), 'utf8')),
    )
    expect(violations).toEqual([])
  })

  it('投影与权威必须同集合(端内拿到的清单就是 types 那份,不是第二份手抄)', () => {
    expect(USER_BROADCAST_SUBSCRIBABLE_EVENTS).toEqual(['conversation:updated'])
  })
})

describe('D153 宿主绑定工厂(createUserBroadcastClient 是端内适配器的唯一入口)', () => {
  afterEach(() => resetUserBroadcastHub())

  it('feed/stats 绑在同一 baseUrl 上,且不新建连接', () => {
    const client = createUserBroadcastClient({
      baseUrl: `${BASE}/`, // 尾斜杠:hub 键必须归一,否则同一部署会裂成两条通道
      tokenProvider: () => 't',
      transport: 'injected',
    })
    const sub = client.subscribe({ 'conversation:updated': () => {} })
    expect(client.feed(makeFrame('绑定的名字'))).not.toBeNull()
    expect(client.stats()).toHaveLength(1)
    expect(client.stats()[0]?.key).toBe(`${BASE}|injected`)
    expect(client.stats()[0]?.connected).toBe(false)
    sub.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
