// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D35 长会话分页投影 — 共享层纯函数用例 + 接线锁。
 *
 * 四类边界按票面逐条覆盖:空页 / 重叠页 / 游标倒退 / 序数缺失。
 * 另有一组**跨语言等价夹具**:base64url 串逐字取自服务端编解码实现
 * (`Buffer.from(JSON.stringify({turnOrdinal})).toString('base64url')`,
 *  见 apps/api/src/db/chat-queries.ts encodeHistoryCursor),
 * 用来钉"共享层解码器与服务端解码器认同一批串" —— 镜像测试只复读实现就是复读机
 * (AGENTS §22c),所以这里判的是对方产物的真实字节,不是自造串。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  HISTORY_TURN_DIRECTIONS,
  HISTORY_LIMIT_DEFAULT,
  clampHistoryLimit,
  decodeHistoryTurnCursor,
  deriveHistoryBoundary,
  encodeHistoryTurnCursor,
  isHistoryPageExhausted,
  isUsableTurnOrdinal,
  mergeHistoryTurnPages,
  projectHistoryPage,
} from '../history-projection'
import * as sharedChatBarrel from '../index'

interface Msg {
  id: string
}
type Turn = { turnOrdinal: number; messages: Msg[] }

function turn(turnOrdinal: number, ids: string[]): Turn {
  return { turnOrdinal, messages: ids.map((id) => ({ id })) }
}

function page(
  turns: Turn[],
  overrides: Partial<{ hasMore: boolean; nextCursor: string | null }> = {},
) {
  return {
    turns,
    limit: 20,
    hasMore: overrides.hasMore ?? true,
    nextCursor:
      'nextCursor' in overrides
        ? overrides.nextCursor!
        : encodeHistoryTurnCursor({ turnOrdinal: 1 }),
    projectionState: null,
  }
}

describe('游标编解码:与服务端同字节、非法串一律 null', () => {
  it('服务端产物夹具逐条可解(整数序号)', () => {
    const fixtures: ReadonlyArray<readonly [string, number]> = [
      ['eyJ0dXJuT3JkaW5hbCI6MH0', 0],
      ['eyJ0dXJuT3JkaW5hbCI6MX0', 1],
      ['eyJ0dXJuT3JkaW5hbCI6MTJ9', 12],
      ['eyJ0dXJuT3JkaW5hbCI6OTk5OTk5fQ', 999999],
      ['eyJ0dXJuT3JkaW5hbCI6LTN9', -3],
    ]
    for (const [raw, ordinal] of fixtures) {
      expect(decodeHistoryTurnCursor(raw)).toEqual({ turnOrdinal: ordinal })
    }
  })

  it('encode 产物 = 服务端 Buffer base64url 产物(往返一致)', () => {
    expect(encodeHistoryTurnCursor({ turnOrdinal: 12 })).toBe('eyJ0dXJuT3JkaW5hbCI6MTJ9')
    for (const ordinal of [0, 1, 7, 12, 999999, -3, 123456789]) {
      const encoded = encodeHistoryTurnCursor({ turnOrdinal: ordinal })
      expect(decodeHistoryTurnCursor(encoded)).toEqual({ turnOrdinal: ordinal })
      // 无填充、无 +/ —— 有 '=' 或 '+' 说明与 base64url 形态漂了
      expect(encoded).not.toMatch(/=/)
      expect(encoded).not.toMatch(/[+/]/)
    }
  })

  it('非法/缺失一律 null(不得抛错,不得返回 {turnOrdinal:undefined})', () => {
    for (const raw of [null, undefined, '', '!!!not-base64!!!', 'e30', 'eyJhIjoxfQ']) {
      expect(decodeHistoryTurnCursor(raw as string | null | undefined)).toBeNull()
    }
    // 序号非整数(服务端同样判非法 ⇒ 400)
    const nonInteger = Buffer.from(JSON.stringify({ turnOrdinal: 1.5 }), 'utf8').toString(
      'base64url',
    )
    expect(decodeHistoryTurnCursor(nonInteger)).toBeNull()
    const missingField = Buffer.from(JSON.stringify({ other: 1 }), 'utf8').toString('base64url')
    expect(decodeHistoryTurnCursor(missingField)).toBeNull()
  })
})

describe('limit 夹取:与服务端兜底同语义', () => {
  it('缺省/越界/非有限数各自归位', () => {
    expect(clampHistoryLimit(undefined)).toBe(HISTORY_LIMIT_DEFAULT)
    expect(clampHistoryLimit(null)).toBe(HISTORY_LIMIT_DEFAULT)
    expect(clampHistoryLimit(0)).toBe(HISTORY_LIMIT_DEFAULT)
    expect(clampHistoryLimit(-5)).toBe(HISTORY_LIMIT_DEFAULT)
    expect(clampHistoryLimit(Number.NaN)).toBe(HISTORY_LIMIT_DEFAULT)
    expect(clampHistoryLimit(Number.POSITIVE_INFINITY)).toBe(HISTORY_LIMIT_DEFAULT)
    expect(clampHistoryLimit(50)).toBe(50)
    expect(clampHistoryLimit(100)).toBe(100)
    expect(clampHistoryLimit(101)).toBe(100)
    expect(clampHistoryLimit(20.9)).toBe(20)
  })

  it('方向集合与导出常量同形(判据与类型不分开漂)', () => {
    expect([...HISTORY_TURN_DIRECTIONS].sort()).toEqual(['newer', 'newest', 'older'])
  })
})

describe('边界一:空页', () => {
  it('空 turns ⇒ 投影空、边界归零、判定到底', () => {
    const empty = page([], { hasMore: false, nextCursor: null })
    const projection = projectHistoryPage(empty, 'newest')
    expect(projection.turns).toEqual([])
    expect(projection.boundary.oldestTurnOrdinal).toBeNull()
    expect(projection.boundary.newestTurnOrdinal).toBeNull()
    expect(projection.boundary.olderCursor).toBeNull()
    expect(projection.boundary.newerCursor).toBeNull()
    expect(isHistoryPageExhausted(empty)).toBe(true)
  })

  it('hasMore=true 但无内容无游标 ⇒ 不算到底(把"服务端说了还有"留给调用方处置)', () => {
    expect(isHistoryPageExhausted(page([], { hasMore: true, nextCursor: null }))).toBe(true)
    expect(isHistoryPageExhausted(page([turn(1, ['a'])]))).toBe(false)
  })
})

describe('边界二:重叠页 ⇒ 整轮替换,不重复追加', () => {
  it('同 turnOrdinal 重发只保留最新一版(幂等回放)', () => {
    const existing = [turn(1, ['a']), turn(2, ['b'])]
    const incoming = [turn(2, ['b', 'b2']), turn(3, ['c'])]
    const merged = mergeHistoryTurnPages(existing, incoming)
    expect(merged.turns.map((t) => t.turnOrdinal)).toEqual([1, 2, 3])
    expect(merged.turns[1]?.messages.map((m) => m.id)).toEqual(['b', 'b2'])
    expect(merged.replacedTurns).toBe(1)
    expect(merged.droppedUnordained).toBe(0)
  })

  it('重复并入同一页不改变结果(流式追加后旧 cursor 重放安全)', () => {
    const once = mergeHistoryTurnPages([], [turn(5, ['x']), turn(4, ['y'])])
    const twice = mergeHistoryTurnPages(once.turns, [turn(5, ['x']), turn(4, ['y'])])
    expect(twice.turns).toEqual(once.turns)
    expect(twice.replacedTurns).toBe(2)
    // 升序与输入顺序无关(服务端 newest/older 反转、newer 正序,客户端只认一个形态)
    expect(twice.turns.map((t) => t.turnOrdinal)).toEqual([4, 5])
  })
})

describe('边界三:游标倒退', () => {
  it('older 页并入后,游标端点按服务端语义归位(newest/older→older 端)', () => {
    const olderPage = page([turn(1, ['a']), turn(2, ['b'])], {
      nextCursor: encodeHistoryTurnCursor({ turnOrdinal: 1 }),
    })
    const boundary = deriveHistoryBoundary(olderPage, 'older')
    expect(boundary.hasOlder).toBe(true)
    expect(boundary.hasNewer).toBe(false)
    expect(boundary.olderCursor).toBe(encodeHistoryTurnCursor({ turnOrdinal: 1 }))
    expect(decodeHistoryTurnCursor(boundary.olderCursor)?.turnOrdinal).toBe(1)
  })

  it('hasMore=false ⇒ 两端游标都归 null,不得留一个还能翻的假柄', () => {
    const last = page([turn(3, ['c'])], {
      hasMore: false,
      nextCursor: encodeHistoryTurnCursor({ turnOrdinal: 3 }),
    })
    for (const direction of HISTORY_TURN_DIRECTIONS) {
      const b = deriveHistoryBoundary(last, direction)
      expect(b.olderCursor).toBeNull()
      expect(b.newerCursor).toBeNull()
    }
  })

  it('newer 方向只点亮 newer 端(增量续读不得同时宣称有更早)', () => {
    const b = deriveHistoryBoundary(page([turn(9, ['z'])], { hasMore: true }), 'newer')
    expect(b.hasNewer).toBe(true)
    expect(b.hasOlder).toBe(false)
    expect(b.newerCursor).not.toBeNull()
  })
})

describe('边界四:序数缺失', () => {
  it('非整数/NaN 序数的分片被丢弃并计数(绝不静默)', () => {
    const broken = [
      turn(NaN, ['x']),
      turn(1.5, ['y']),
      {
        turnOrdinal: '2' as unknown as number,
        messages: [turn(2, []).messages[0]! as Msg],
      } as unknown as Turn,
      turn(3, ['ok']),
    ]
    const merged = mergeHistoryTurnPages([], broken)
    expect(merged.turns.map((t) => t.turnOrdinal)).toEqual([3])
    expect(merged.droppedUnordained).toBe(3)
  })

  it('既有时间线里的坏轮同样被清出,不随合并回流', () => {
    const merged = mergeHistoryTurnPages([turn(NaN, ['x']), turn(4, ['ok'])], [turn(5, ['new'])])
    expect(merged.turns.map((t) => t.turnOrdinal)).toEqual([4, 5])
    expect(merged.droppedUnordained).toBe(1)
  })

  it('isUsableTurnOrdinal 与合并判据同一把尺', () => {
    expect(isUsableTurnOrdinal(0)).toBe(true)
    expect(isUsableTurnOrdinal(-1)).toBe(true)
    expect(isUsableTurnOrdinal(1.2)).toBe(false)
    expect(isUsableTurnOrdinal(undefined)).toBe(false)
    expect(isUsableTurnOrdinal('3')).toBe(false)
  })
})

describe('接线锁:barrel 真导出 + 存在非测试面 importer', () => {
  // __dirname = packages/shared/src/chat/__tests__ ⇒ 仓库根要上跳 5 级
  // (5 不是 4:写成 4 会解析到 packages/apps/**,报 ENOENT 而不是报判据错)
  const repoRoot = join(__dirname, '..', '..', '..', '..', '..')

  it('@ihui/shared/chat barrel 真导出投影符号(不是注释态)', () => {
    for (const name of [
      'clampHistoryLimit',
      'decodeHistoryTurnCursor',
      'encodeHistoryTurnCursor',
      'mergeHistoryTurnPages',
      'deriveHistoryBoundary',
      'projectHistoryPage',
      'isHistoryPageExhausted',
    ] as const) {
      expect((sharedChatBarrel as Record<string, unknown>)[name]).toBeTypeOf('function')
    }
  })

  it('barrel 里那一行不是注释形态(注释式摘线 = 判据看不见但账面还在)', () => {
    const barrel = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8')
    const line = barrel.split('\n').find((l) => l.includes("from './history-projection'"))
    expect(line).toBeDefined()
    expect((line as string).trimStart().startsWith('//')).toBe(false)
  })

  it('生产面至少一个 importer(造好没装车 = 没有)', () => {
    const consumer = join(repoRoot, 'apps', 'web', 'src', 'hooks', 'use-chat-history-projection.ts')
    let imported = false
    try {
      imported = /from '@ihui\/shared\/chat'/.test(readFileSync(consumer, 'utf8'))
    } catch {
      imported = false
    }
    expect(imported).toBe(true)
  })

  it('api-client 暴露 getConversationHistory 且路径指向 turn 分片端点', () => {
    const src = readFileSync(
      join(repoRoot, 'packages', 'api-client', 'src', 'endpoints', 'chat.ts'),
      'utf8',
    )
    expect(src).toMatch(/export function getConversationHistory/)
    expect(src).toMatch(/\/history\?\$\{qs\.toString\(\)\}/)
    // 端内不得绕开 api-client 裸 fetch 自家后端(守门 73 同一条禁令的本地形式)
    const hookSrc = readFileSync(
      join(repoRoot, 'apps', 'web', 'src', 'hooks', 'use-chat-history-projection.ts'),
      'utf8',
    )
    expect(hookSrc).toMatch(/from '@ihui\/api-client'/)
    expect(hookSrc).not.toMatch(/\bfetch\(/)
  })

  it('全仓只有一份投影实现(端内不得各写一份分页算术)', () => {
    const projectionSymbols =
      /export function (mergeHistoryTurnPages|projectHistoryPage|deriveHistoryBoundary)\b/
    const owners: string[] = []
    const walk = (dir: string, depth: number) => {
      if (depth > 6) return
      for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue
        const p = join(dir, entry)
        const st = statSync(p)
        if (st.isDirectory()) walk(p, depth + 1)
        else if (
          /\.tsx?$/.test(entry) &&
          !entry.endsWith('.d.ts') &&
          projectionSymbols.test(readFileSync(p, 'utf8'))
        )
          owners.push(p)
      }
    }
    for (const root of [join(repoRoot, 'apps'), join(repoRoot, 'packages')]) {
      try {
        walk(root, 0)
      } catch {
        /* 根不存在 ⇒ 不判(环境缺失不等于重复实现) */
      }
    }
    // 唯一允许的定义处 = 本模块自身
    expect(owners).toEqual([join(__dirname, '..', 'history-projection.ts')])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
