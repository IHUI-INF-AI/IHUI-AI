// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 第九轮 · ZCode 机制吸收:SSE 重放窗口「有洞」判据的取证。
//
// 要防的失败模式:缓冲每流上限 2000 行、超出即 FIFO 裁头。客户端带来的 lastSeq 落在
// 被裁掉的区间时,缓冲只剩后半截尾巴,而旧代码把这截尾巴当"完整重放"直接 write 出去
// —— 表现是"断线重连后消息少了若干条,但界面看起来是连续的"。即本仓最常见的
// 「缺席 / 读到空 / 读到无效」三态不分。
//
// 三层取证:
// A. 纯判据 `isReplayWindowComplete` 的注入用例(含边界差 1 不翻转、droppedCount=0 不误判);
// B. 真缓冲的端到端判定(未满/刚裁一头/未知 key 三态);
// C. 装车证明:路由两条重放分支确实被该判据挡住 —— 只判"路由有没有问",
//    因为 A/B 全绿而路由不问 = 机制在、没接上(本仓最高频失效型)。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  getReplayWindowStatus,
  hasReplayHole,
  isReplayWindowComplete,
  pushEvent,
  registerStream,
} from '../src/utils/sse-replay-buffer.js'

const HERE = dirname(fileURLToPath(import.meta.url))

describe('SSE 重放窗口判据(纯函数注入面)', () => {
  it('未裁过 ⇒ 任意 seq 都判完整(含 seq=-1 的"客户端什么都没收到")', () => {
    // 这一条是反向护栏:若把判据写成"seq < lowestId 即有洞",首条事件都会被判成洞。
    expect(isReplayWindowComplete(-1, 1, 0)).toBe(true)
    expect(isReplayWindowComplete(0, 5, 0)).toBe(true)
  })

  it('缓冲为空且没裁过 ⇒ 完整(无事可重放,不是洞)', () => {
    expect(isReplayWindowComplete(3, null, 0)).toBe(true)
  })

  it('裁过头却拿不到缓冲首条 ⇒ 判不出,按有洞处理(宁可不发半截)', () => {
    expect(isReplayWindowComplete(3, null, 7)).toBe(false)
  })

  it('边界:seq === lowestId - 1 判完整;seq === lowestId - 2 判有洞(差 1 不得翻转)', () => {
    // 缓冲现在持有 [50 .. N];客户端收到 49 ⇒ 缺的 50..N 全在缓冲里 = 无洞。
    expect(isReplayWindowComplete(49, 50, 50)).toBe(true)
    // 收到 48 ⇒ 第 49 条既不在缓冲也没被收到 = 有洞。
    expect(isReplayWindowComplete(48, 50, 50)).toBe(false)
    // 落在被裁区间深处同样有洞
    expect(isReplayWindowComplete(10, 50, 50)).toBe(false)
    // 落在缓冲区间内(含最后一条)⇒ 无洞
    expect(isReplayWindowComplete(50, 50, 50)).toBe(true)
    expect(isReplayWindowComplete(2049, 50, 50)).toBe(true)
  })
})

describe('SSE 重放窗口判据(真缓冲端到端)', () => {
  it('未知 key ⇒ known:false + complete:false + 判有洞(按"无法重放"而非"无洞")', () => {
    const missing = `hole-unknown:${Math.random()}`
    const st = getReplayWindowStatus(missing, 5)
    expect(st.known).toBe(false)
    expect(st.complete).toBe(false)
    expect(st.lowestId).toBe(null)
    expect(st.droppedCount).toBe(0)
    expect(hasReplayHole(missing, 5)).toBe(true)
  })

  it('未满 2000 行 ⇒ 无洞,且 droppedCount 恒为 0', () => {
    const key = `hole-small:${Math.random()}`
    registerStream(key)
    for (let i = 1; i <= 50; i++) pushEvent(key, { id: i, rawLine: `data: ${i}\n` })
    const st = getReplayWindowStatus(key, 1)
    expect(st).toMatchObject({ known: true, complete: true, lowestId: 1, droppedCount: 0 })
    expect(hasReplayHole(key, 0)).toBe(false)
  })

  it('刚裁掉一头:lastSeq 落在被裁区间 ⇒ 有洞;恰好接上 ⇒ 无洞(同一 key 两态)', () => {
    const key = `hole-trimmed:${Math.random()}`
    registerStream(key)
    for (let i = 1; i <= 2001; i++) pushEvent(key, { id: i, rawLine: `data: ${i}\n` })
    // 上限 2000 ⇒ 第 1 条被淘汰,缓冲现在持有 [2 .. 2001]
    const st = getReplayWindowStatus(key, 1)
    expect(st.droppedCount).toBe(1)
    expect(st.lowestId).toBe(2)
    expect(st.complete).toBe(true) // 边界:1 === 2 - 1,尾巴正好接上
    expect(getReplayWindowStatus(key, 0).complete).toBe(false) // 第 1 条已经没了
    expect(hasReplayHole(key, 0)).toBe(true)
  })

  it('重注册重置窗口(一次洞不得被读成永久洞)', () => {
    const key = `hole-rereg:${Math.random()}`
    registerStream(key)
    for (let i = 1; i <= 2001; i++) pushEvent(key, { id: i, rawLine: `data: ${i}\n` })
    expect(hasReplayHole(key, 0)).toBe(true)
    registerStream(key)
    expect(getReplayWindowStatus(key, 0)).toMatchObject({
      known: true,
      complete: true,
      droppedCount: 0,
    })
  })
})

describe('路由装车证明:两条重放分支都必须先问窗口判据', () => {
  const routeSrc = readFileSync(resolve(HERE, '../src/routes/ai-chat-stream.ts'), 'utf8')

  it('路由从 sse-replay-buffer 取窗口状态(不是本地另算一份)', () => {
    expect(routeSrc).toMatch(
      /import\s*\{[^}]*getReplayWindowStatus[^}]*\}\s*from\s*'\.\.\/utils\/sse-replay-buffer\.js'/,
    )
  })

  it('takeover 与 replay-only 两条写尾巴的分支都在 window.complete 守卫之内', () => {
    const guard = routeSrc.indexOf('if (window.complete) {')
    const status = routeSrc.indexOf('getReplayWindowStatus(replayKey, lastSeq)')
    const takeover = routeSrc.indexOf('takeoverStream(liveSession, lastSeq, raw)')
    const replayOnly = routeSrc.indexOf('getReplayEvents(replayKey, lastSeq)')
    const degradeLog = routeSrc.indexOf('replay-window-hole')
    // 四条都必须存在(任一被摘掉 = 该判据从提交链上消失)
    expect(status).toBeGreaterThan(-1)
    expect(guard).toBeGreaterThan(-1)
    expect(takeover).toBeGreaterThan(-1)
    expect(replayOnly).toBeGreaterThan(-1)
    // 顺序即结构:先问窗口 → 才可能进两条重放分支 → 否则走降级日志
    expect(guard).toBeGreaterThan(status)
    expect(guard).toBeLessThan(takeover)
    expect(guard).toBeLessThan(replayOnly)
    expect(degradeLog).toBeGreaterThan(replayOnly)
  })

  it('降级日志必须点名 lastSeq / lowestBufferedId / droppedCount(丢弃不许静默)', () => {
    expect(routeSrc).toContain('lowestBufferedId: window.lowestId')
    expect(routeSrc).toContain('droppedCount: window.droppedCount')
    expect(routeSrc).toContain('lastSeq,')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
