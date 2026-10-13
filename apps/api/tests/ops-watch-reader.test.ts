// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-916430③:mail 欠投递读方 + :80 CDN 视野并入 API 进程内定时读方(机主拍板不新增服务拓扑)。
// 本测试钉四件事:①两族标记形态都能读出且三态不并桶;②去重(冷却内同指纹不重发、内容变立即重报、
// 消失清键);③CDN 探测"任何 HTTP 应答=活着";④push 失败不外抛、不写冷却(下一轮重试)。
import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  scanUndeliveredDir,
  runOpsWatchTick,
  probeCdnLiveness,
  _resetDedupForTests,
  ALERT_COOLDOWN_MS,
  type WatchFinding,
} from '../src/jobs/ops-watch-reader.js'

let dir: string
beforeEach(() => {
  _resetDedupForTests()
  dir = mkdtempSync(join(tmpdir(), 'ops-watch-'))
  // 读方扫的是 <repoRoot>/.workbuddy
  mkdirSync(join(dir, '.workbuddy'), { recursive: true })
})

describe('scanUndeliveredDir — 标记扫描三态', () => {
  it('目录不存在 ⇒ 空(安静,不报错)', () => {
    expect(scanUndeliveredDir(join(dir, 'nope'))).toEqual([])
  })

  it('pg-backup 族形态(producer/alertId/title/reason/at)逐字段读出', () => {
    writeFileSync(
      join(dir, 'pg-backup-alert-UNDELIVERED.json'),
      JSON.stringify({
        producer: 'ihui-pg-backup',
        alertId: 'backup-20261013',
        title: 'PG 备份失败',
        reason: 'smtp dual fail',
        at: '2026-10-13 03:00:00',
      }),
    )
    const r = scanUndeliveredDir(dir)
    expect(r).toHaveLength(1)
    expect(r[0].severity).toBe('critical')
    expect(r[0].detail).toContain('ihui-pg-backup')
    expect(r[0].detail).toContain('2026-10-13 03:00:00')
  })

  it('守护族形态(name/fp/why/ts)同样读出 —— 写死任一族键名会漏另一族', () => {
    writeFileSync(
      join(dir, 'git-guardian-notify-UNDELIVERED.json'),
      JSON.stringify({
        name: 'guardian-red',
        fp: 'abc123',
        why: 'mail dispatch throw',
        ts: 1791860000000,
      }),
    )
    const r = scanUndeliveredDir(dir)
    expect(r).toHaveLength(1)
    expect(r[0].detail).toContain('guardian-red')
    expect(r[0].detail).toContain('mail dispatch throw')
  })

  it('JSON 坏 ⇒ undetermined 口径 finding 且不静默不洗成通过', () => {
    writeFileSync(join(dir, 'broken-alert-UNDELIVERED.json'), '{broken')
    const r = scanUndeliveredDir(dir)
    expect(r).toHaveLength(1)
    expect(r[0].title).toContain('JSON 坏')
    expect(r[0].detail).toContain('未判定')
  })

  it('非 UNDELIVERED 文件不命中(正则与 check-ops-patrol P8 同一条)', () => {
    writeFileSync(join(dir, 'alert-bridge-state.json'), '{}')
    writeFileSync(join(dir, 'normal.json'), '{}')
    expect(scanUndeliveredDir(dir)).toEqual([])
  })
})

describe('runOpsWatchTick — 去重/冷却(机主明令:重复告警是缺陷)', () => {
  const undel = (extra: Record<string, unknown>) =>
    JSON.stringify({ producer: 'p', title: 'T', reason: 'R', at: '2026-10-13', ...extra })

  it('同一标记冷却内只发一次;内容变 = 新故障立即重报;消失清键后再现立即重报', async () => {
    writeFileSync(join(dir, '.workbuddy', 'a-alert-UNDELIVERED.json'), undel({}))
    const pushed: WatchFinding[] = []
    let t = 1_000_000
    const deps = {
      repoRoot: dir,
      stateDirs: [],
      cdnUrl: 'http://x/',
      probe: async () => true,
      push: (f: WatchFinding) => {
        pushed.push(f)
      },
      now: () => t,
    }
    await runOpsWatchTick(deps)
    expect(pushed).toHaveLength(1)

    t += 60_000 // 冷却内,内容未变
    await runOpsWatchTick(deps)
    expect(pushed).toHaveLength(1)

    t += 60_000
    writeFileSync(join(dir, '.workbuddy', 'a-alert-UNDELIVERED.json'), undel({ reason: '第二起' })) // 指纹变
    await runOpsWatchTick(deps)
    expect(pushed).toHaveLength(2)

    rmSync(join(dir, '.workbuddy', 'a-alert-UNDELIVERED.json')) // 消失 ⇒ 清键
    await runOpsWatchTick(deps)
    writeFileSync(join(dir, '.workbuddy', 'a-alert-UNDELIVERED.json'), undel({})) // 再现
    t += 60_000
    await runOpsWatchTick(deps)
    expect(pushed).toHaveLength(3)
  })

  it('冷却窗口边界:恰好 ALERT_COOLDOWN_MS 后同指纹重发', async () => {
    writeFileSync(join(dir, '.workbuddy', 'b-alert-UNDELIVERED.json'), undel({}))
    let t = 2_000_000
    let count = 0
    const deps = {
      repoRoot: dir,
      stateDirs: [],
      cdnUrl: 'http://x/',
      probe: async () => true,
      push: () => {
        count++
      },
      now: () => t,
    }
    await runOpsWatchTick(deps)
    t += ALERT_COOLDOWN_MS - 1
    await runOpsWatchTick(deps)
    expect(count).toBe(1)
    t += 1
    await runOpsWatchTick(deps)
    expect(count).toBe(2)
  })

  it('push 失败不外抛且不写冷却(下一轮重试)', async () => {
    writeFileSync(join(dir, '.workbuddy', 'c-alert-UNDELIVERED.json'), undel({}))
    let t = 3_000_000
    let calls = 0
    const deps = {
      repoRoot: dir,
      stateDirs: [],
      cdnUrl: 'http://x/',
      probe: async () => true,
      push: () => {
        calls++
        throw new Error('mail channel down')
      },
      now: () => t,
    }
    await expect(runOpsWatchTick(deps)).resolves.toBeDefined() // 不外抛
    t += 60_000
    await runOpsWatchTick(deps)
    expect(calls).toBe(2) // 第一次失败 ⇒ 冷却未写 ⇒ 第二轮重试
  })

  it('findings 里同时含标记与 CDN 两类;全净时为空', async () => {
    const base = { stateDirs: [], cdnUrl: 'http://cdn/', push: () => {}, now: () => 4_000_000 }
    writeFileSync(join(dir, '.workbuddy', 'd-alert-UNDELIVERED.json'), undel({}))
    const withDown = await runOpsWatchTick({
      ...base,
      repoRoot: dir,
      probe: async () => false,
    })
    expect(withDown.some((f) => f.key.startsWith('undelivered:'))).toBe(true)
    expect(withDown.some((f) => f.key.startsWith('cdn:'))).toBe(true)

    _resetDedupForTests()
    rmSync(join(dir, '.workbuddy', 'd-alert-UNDELIVERED.json'))
    const clean = await runOpsWatchTick({ ...base, repoRoot: dir, probe: async () => true })
    expect(clean).toEqual([])
  })
})

describe('probeCdnLiveness — 任何 HTTP 应答都算活着(404 占位 PNG 也是活着)', () => {
  it('200 ⇒ true', async () => {
    const ok = await probeCdnLiveness(
      'http://127.0.0.1/',
      100,
      (async () => new Response('ok', { status: 200 })) as unknown as typeof fetch,
    )
    expect(ok).toBe(true)
  })
  it('404 ⇒ true(服务在应答,只是路径不存在)', async () => {
    const ok = await probeCdnLiveness(
      'http://127.0.0.1/',
      100,
      (async () => new Response('png', { status: 404 })) as unknown as typeof fetch,
    )
    expect(ok).toBe(true)
  })
  it('fetch 抛(连接拒绝/超时)⇒ false', async () => {
    const ok = await probeCdnLiveness('http://127.0.0.1/', 100, (async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch)
    expect(ok).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
