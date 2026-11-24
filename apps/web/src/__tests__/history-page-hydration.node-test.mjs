// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 历史"向上翻页"三要素形状锁(2026-10-25)。
//   node --test apps/web/src/__tests__/history-page-hydration.node-test.mjs
//
// ## 钉的是哪三要素
// 根窗格(ai-side-panel.tsx handleLoadMoreHistory)与窗格体(chat-pane-body.tsx 同名回调)的
// 翻页结果都必须:
//   ① 走同一水合出口 `hydrateHistoryMessages(res.data.messages)` —— 首屏加载走它、翻页不走,
//      翻上来的旧消息就丢 toolCalls/planSteps/citations/pinnedAt/parentMessageId+siblingIndex
//      (版本族判不出 ⇒「点一次编辑出两个气泡」,2026-10-25 现读的根窗格正是此形态);
//   ② `await getMessages` 之后、任何 store/缓存写入之前,复验会话身份
//      (`…getState().conversationId !== <当前会话>`) —— 缺它则 await 期间切会话时,旧会话的
//      一页被 prepend 进新会话、游标与 LRU 缓存桶一起被串写(跨桶持久污染);
//   ③ 会话复验必须**先于** setState/patch*Cache(顺序即语义:先作废在途页,才谈得上写入)。
//
// ## 为什么是形状锁而不是行为测试
// 竞态③的触发窗口(慢 fetch × 中途切会话)在 jsdom 用例里要靠计时器编排才能稳定命中,
// 而"编排出来的竞态"一旦依赖微任务时序,失效方向是**用例自己变 flaky**,守不住东西。
// 同型先例:apps/miniapp-taro/tests/api-no-double-unwrap.test.ts(2026-10-23 二次解包族)
// 也是"只能钉形状"——水合出口与会话复验都是词法可判的契约,判据即本文件,一份(§0.6)。
//
// 成对是硬要求:每条"必拒"配"不得误拒"。变异自证 = 内置三型坏夹具逐条注入,摘掉判据即翻红。

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// 判据(住在本文件一份;镜像纪律按 api-no-double-unwrap 先例,守门 import __test__ 留待装闸那枚)
export function extractLoadMoreBody(src) {
  const m = src.match(/const handleLoadMoreHistory = React\.useCallback\(async \(\) => \{/)
  assert.ok(m, '找不到 handleLoadMoreHistory 函数头 —— 结构变了,判据必须跟着搬家,不许静默失配')
  const start = m.index
  // 配平花括号取函数体(到 useCallback 收尾的 `}, [` 之前)
  let depth = 0
  let end = -1
  let seenOpen = false
  let inString = null
  let inLineComment = false
  let inBlockComment = false
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    const c = src[i]
    const p = src[i - 1]
    if (inLineComment) {
      if (c === '\n') inLineComment = false
      continue
    }
    if (inBlockComment) {
      if (c === '/' && p === '*') inBlockComment = false
      continue
    }
    if (inString) {
      if (c === inString && p !== '\\') inString = null
      continue
    }
    if (c === '/' && src[i + 1] === '/') {
      inLineComment = true
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      inBlockComment = true
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      inString = c
      continue
    }
    if (c === '{') {
      depth++
      seenOpen = true
    } else if (c === '}') {
      depth--
      if (seenOpen && depth === 0) {
        end = i
        break
      }
    }
  }
  assert.ok(end > start, '函数体花括号不配平')
  return src.slice(start, end)
}

export function judgeLoadMore(body) {
  const violations = []
  // ① 水合出口:翻页结果必须过 hydrateHistoryMessages(<fetch 响应行>)
  const hydrateAt = body.search(/hydrateHistoryMessages\((?:res|msgRes|response)\.data\.messages\)/)
  const manualMap = body.search(/\.data\.messages\.map\(/)
  if (hydrateAt < 0) violations.push('G1 未走水合出口:翻页结果绕开 hydrateHistoryMessages(丢 toolCalls/版本族字段)')
  if (manualMap >= 0 && (hydrateAt < 0 || manualMap < hydrateAt)) violations.push('G1b 手工 map 造行(与 ① 相斥的坏形态)')
  // ② await 后复验会话身份
  const awaitAt = body.search(/await getMessages\(/)
  const guard = body.match(/getState\(\)\.conversationId\s*!==/)
  if (awaitAt < 0) violations.push('G0 找不到 await getMessages —— 夹具/实现形状变了,判据搬家')
  if (!guard) violations.push('G2 缺会话复验:await 后会话可被切走,旧页会写进新会话')
  // ③ 顺序:复验先于 setState/patchCache
  const write = body.search(/(?:chatStore|useChatStore)\.setState\(|patch(?:Conversation)?Cache\(/)
  if (guard && write >= 0 && guard.index > write) violations.push('G3 复验晚于 store 写入:竞态窗口没关住')
  return violations
}

const FILES = {
  'apps/web/src/components/ai/ai-side-panel.tsx': '根窗格 handleLoadMoreHistory',
  'apps/web/src/components/ai/chat-pane-body.tsx': '窗格体 handleLoadMoreHistory',
}

for (const [rel, label] of Object.entries(FILES)) {
  test(`${rel} —— ${label} 三要素齐备`, () => {
    const src = readFileSync(resolve(import.meta.dirname, '../components/ai', rel.split('/').pop()), 'utf8')
    const body = extractLoadMoreBody(src)
    assert.deepEqual(judgeLoadMore(body), [], `${label}:${rel} 判出违规`)
  })

  test(`${rel} —— 成对:变异夹具逐条被咬`, () => {
    const src = readFileSync(resolve(import.meta.dirname, '../components/ai', rel.split('/').pop()), 'utf8')
    const good = extractLoadMoreBody(src)
    // 变异 1:水合出口换回手工 map ⇒ G1/G1b 必须点名
    const noHydrate = good.replace(/hydrateHistoryMessages\((?:res|msgRes)\.data\.messages\)/, 'res.data.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: new Date(m.createdAt).getTime() }))')
    assert.ok(judgeLoadMore(noHydrate).some((v) => v.startsWith('G1')), '坏形态①(绕水合)没被咬住')
    // 变异 2:删掉会话复验 ⇒ G2 点名
    const noGuard = good.replace(/if \((?:chatStore|useChatStore)\.getState\(\)\.conversationId !== (?:conversationId|convId)\) return\n/, '')
    assert.ok(judgeLoadMore(noGuard).some((v) => v.startsWith('G2')), '坏形态②(无复验)没被咬住')
    // 变异 3:复验搬到 setState 之后 ⇒ G3 点名(手写一个全形状但倒序的夹具)
    const lateOrder = `
    const handleLoadMoreHistory = React.useCallback(async () => {
      const res = await getMessages(conversationId, { cursor, direction: 'older' })
      if (!res.success) return
      const older = hydrateHistoryMessages(res.data.messages)
      chatStore.setState((s) => ({ messages: [...older, ...s.messages] }))
      if (chatStore.getState().conversationId !== conversationId) return
      patchCache(conversationId, chatStore.getState().messages)
    }, [])
`
    assert.ok(judgeLoadMore(lateOrder).some((v) => v.startsWith('G3')), '坏形态③(顺序倒置)没被咬住')
  })
}

test('正向对照:判据不吃合法注释/字符串里的假词', () => {
  const legit = `
    const handleLoadMoreHistory = React.useCallback(async () => {
      const res = await getMessages(conversationId, { cursor, direction: 'older' })
      if (!res.success) return
      if (chatStore.getState().conversationId !== conversationId) return
      const older = hydrateHistoryMessages(res.data.messages)
      chatStore.setState((s) => ({ messages: [...older, ...s.messages] }))
      patchCache(conversationId, chatStore.getState().messages)
    }, [])
  `
  assert.deepEqual(judgeLoadMore(legit), [])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
