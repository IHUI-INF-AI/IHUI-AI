// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 连接表清理钩子的"判据即事实"锁(2026-09-26 反向缺陷收口票,第 2 部分)。
 *
 * 本票对四张同类表的处置是**逐处判定**,不是统一改写:
 *  - ws-notifications —— 改:gauge 的递减与"实际移除量"脱钩(近亲是票面点名的"按快照 size 递减");
 *  - ws-messages / ws-broadcast / ws-customer-service —— 不改。
 * "不改"必须能自证为什么不改,否则它读起来就像"没做"。这三处的安全前提是两条**可机器核**的
 * 形态事实:① getConnections 返回**活表**(不是复制快照)⇒ 判定与落刀面对同一份数据;
 * ② removeConnection 体内**同步**删除、其间无 await ⇒ isAllStale 的结论不会被续体跨过。
 * ws-chat 恰是反例(它返回 new Map(...) 快照),所以它必须走 removeIfDead —— 这个对照
 * 同时证明上面那把尺子有牙,不是恒真。
 *
 * 输入一律取**真源文件**(§22c:判据的对象是文件的形态,夹具只能复刻形状,证不了形态);
 * 每条锁另配一个"改坏必红"的变异对照,防止判据退化成恒真式。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
/**
 * 判据只看代码面。本票把"旧写法长什么样"写进了源文件的注释里(留证据),
 * 不剥注释就会被自己的尺子判成"旧形态仍在位";反向同理 —— 注释里的形态既不算
 * 合规也不算违规(守门 57 / 118 同一取向:匹配面是剥注释后的代码面)。
 */
const stripComments = (t: string): string =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
const src = (name: string): string =>
  stripComments(readFileSync(resolve(HERE, '../../src/plugins', name), 'utf8'))
/** 出现次数(零要能读成 0,而不是 undefined) */
const countOf = (t: string, re: RegExp): number => t.match(re)?.length ?? 0

// ── 判据(纯函数:输入源码文本,输出该形态是否在位)────────────────────────
const LIVE_MAP_GETTER = /getConnections: \(\) => connections as unknown as/
const SNAPSHOT_MAP_GETTER = /getConnections: \(\) => \{[\s\S]*?new Map[<(]/
const SYNC_KEY_DELETE_HOOK =
  /removeConnection: async \((?:userId|sessionId|roomId)\) => \{\s*(?:\/\/[^\n]*\n\s*)*connections\.delete\((?:userId|sessionId|roomId)\)\s*\},/
const CHAT_LEASE_FINALLY =
  /\}\s*finally\s*\{(?:[^{}]*\n)*?\s*if \(!ownedByCloseListener\) teardownOnce\(\)/
const CHAT_HANDOFF_AFTER_REGISTER =
  /socket\.on\('close', \(\) => teardownOnce\(\)\)[\s\S]{0,400}?\n\s*ownedByCloseListener = true/
const CHAT_IDEMPOTENT_GUARD = /const teardownOnce = \(\): void => \{\s*if \(teardownDone\) return/
const CHAT_LIVENESS_RECHECK = /if \(isSocketUnusable\(socket\)\) return/
const NOTIF_REMOVES_BY_COUNT =
  /const removed = removeIfDead\(connections,[\s\S]{0,80}?\n\s*if \(removed > 0\) \{\s*wsConnectionCount -= removed/
const NOTIF_CLOSE_PAIRING =
  /if \(removeIfSame\(connections, userId, ws\)\) \{\s*wsConnectionCount--/
/** 旧形态指纹:按快照 size 递减 / 整键删除(单靠multiline正则分不出"无条件递减"与
 *  if 分支内的递减,那一型改由"只有一处 wsConnectionCount-- 且它与身份删除配对"两条例子合判) */
const LEGACY_GAUGE_PATTERNS = [/wsConnectionCount -= conns\.size/, /connections\.delete\(userId\)/]

describe('ws-chat 槽位租约的接线形态(行为例见 ws-chat-slot-lease.test.ts)', () => {
  const chat = src('ws-chat.ts')

  it('租约四件套齐备:finally 兜底 / 交接点 / 幂等闩 / await 后复判存活', () => {
    expect(CHAT_LEASE_FINALLY.test(chat), 'finally 里没有 !ownedByCloseListener 兜底').toBe(true)
    expect(CHAT_HANDOFF_AFTER_REGISTER.test(chat)).toBe(true)
    expect(CHAT_IDEMPOTENT_GUARD.test(chat)).toBe(true)
    expect(CHAT_LIVENESS_RECHECK.test(chat)).toBe(true)
  })

  it('释放只有一个出口:releaseUserConnectionSlots 出现 1 次,裸 release 出现 0 次', () => {
    // 双 release 的成因就是"两处各写一遍收尾";数一下出口比读注释可靠
    expect(countOf(chat, /releaseUserConnectionSlots\(\{/g)).toBe(1)
    expect(countOf(chat, /userConnectionLimiter\.release\(/g), '收尾之外还有一处裸 release').toBe(0)
    expect(countOf(chat, /const teardownOnce = /g)).toBe(1)
  })

  it('变异对照:把 finally 兜底撤掉 ⇒ 上面的锁必红(判据不是恒真)', () => {
    const mutated = chat.replace(
      /if \(!ownedByCloseListener\) teardownOnce\(\)/,
      '/* 撤掉兜底:回到只有 close 事件才 release 的旧世界 */',
    )
    expect(mutated).not.toBe(chat)
    expect(CHAT_LEASE_FINALLY.test(mutated)).toBe(false)
    // 同一份变异里幂等闩仍在位 ⇒ 证明变红的就是"finally 没了"这一条,不是整片失效
    expect(CHAT_IDEMPOTENT_GUARD.test(mutated)).toBe(true)
  })
})

describe('ws-notifications:gauge 与连接表同源(改)', () => {
  const notif = src('ws-notifications.ts')

  it('递减一律由"真的摘掉了人"驱动:僵尸口按实际移除量、close 按 removeIfSame 返回值', () => {
    expect(
      NOTIF_REMOVES_BY_COUNT.test(notif),
      'removeConnection 未按 removeIfDead 的计数递减',
    ).toBe(true)
    expect(NOTIF_CLOSE_PAIRING.test(notif), 'close 回调的递减未与身份删除配对').toBe(true)
    // 三条移除路径全部走 dropConnection / removeIfDead,不得再有第四处手写递减
    expect(notif.match(/wsConnectionCount--/g)?.length).toBe(1)
  })

  it('旧形态三指纹全部消失:按快照 size 递减 / 整键删除 / 无条件递减', () => {
    for (const legacy of LEGACY_GAUGE_PATTERNS) {
      expect(legacy.test(notif), `旧指纹仍在位:${legacy}`).toBe(false)
    }
  })

  it('变异对照:把 gauge 改回"按快照 size 递减 + 整键删除" ⇒ 对应两条锁同时翻红', () => {
    const legacyHook = `removeConnection: async (userId) => {
      const conns = connections.get(userId)
      if (conns) {
        wsConnectionCount -= conns.size
        connections.delete(userId)
        updateWsConnectionGauges()
      }
    },`
    const mutated = notif.replace(
      /removeConnection: async \(userId\) => \{[\s\S]*?\n    \},/,
      legacyHook,
    )
    expect(mutated).not.toBe(notif) // 夹具确实改动了东西,否则这条对照是空的
    expect(NOTIF_REMOVES_BY_COUNT.test(mutated)).toBe(false)
    expect(LEGACY_GAUGE_PATTERNS.some((p) => p.test(mutated))).toBe(true)
  })
})

describe('另三张同类表:判定为"不改",并把不改的前提钉成可核事实', () => {
  const liveMapTables = ['ws-messages.ts', 'ws-broadcast.ts', 'ws-customer-service.ts'] as const

  it.each(liveMapTables)('%s 的 getConnections 返回活表(非快照)', (name) => {
    const text = src(name)
    expect(LIVE_MAP_GETTER.test(text)).toBe(true)
    expect(SNAPSHOT_MAP_GETTER.test(text), '已改成复制快照 ⇒ 本处判定作废,须走 removeIfDead').toBe(
      false,
    )
  })

  it.each(liveMapTables)('%s 的 removeConnection 体内同步删,判据与落刀同一 tick', (name) => {
    const text = src(name)
    expect(SYNC_KEY_DELETE_HOOK.test(text)).toBe(true)
    // 交接窗口一旦被 await 撑开,整键删除就会拆掉重连后的活连接(即 ws-chat 那型)
    const hook = /removeConnection: async [\s\S]*?\n    \},/.exec(text)?.[0] ?? ''
    expect(hook).not.toBe('')
    expect(hook).not.toMatch(/\bawait\b|setTimeout|\.then\(/)
  })

  it('对照:ws-chat 的 getConnections 确实是快照形态 ⇒ 上面那把尺子分得开两种形态', () => {
    const chat = src('ws-chat.ts')
    expect(LIVE_MAP_GETTER.test(chat), '两形态混成同一条 ⇒ 判据失真,本组结论一并失效').toBe(false)
    expect(SNAPSHOT_MAP_GETTER.test(chat)).toBe(true)
    expect(/removeIfDead\(rooms,/.test(chat)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
