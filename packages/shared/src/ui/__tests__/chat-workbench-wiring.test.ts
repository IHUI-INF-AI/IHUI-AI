// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * chat-workbench-shell-spec 接线契约测试(2026-10-28 立)。
 *
 * 钉四组不会让 typecheck 红的失效:
 *  ① 窗格身份不回退 —— WORKBENCH_PANE_ID 必须与根窗格(pane-root)不同域:
 *     同域会把全屏工作台和停靠侧栏的 pane store 静默并成一份(票60 判据形态);
 *  ② 路由/参数档与 /chat?conversationId= 深链同参数名 —— 壳若自创参数名,
 *     跨形态分享链接就只在一边有效,这类漂移不报编译错;
 *  ③ resolveWorkbenchConversationId 的规整语义 —— 空白串/超长串必须落 null
 *     (深链防御;直接透传会让畸形 id 打进 getConversation 请求);
 *  ④ workbenchConversationHref 对特殊字符必须 encodeURIComponent,且 null 回纯路由
 *     (自动选中取的是后端任意标题域内的 id,拼串不走 encode 就是埋 XSS/坏链)。
 * 判据面与壳消费面同引 ../chat-workbench-shell-spec 一份,不留第二套常量。
 */
import { describe, expect, it } from 'vitest'
import {
  chatDeeplinkPath,
  isRailRowSelected,
  pickAutoSelectConversationId,
  resolveWorkbenchConversationId,
  WORKBENCH_CONVERSATION_PARAM,
  WORKBENCH_PANE_ID,
  WORKBENCH_ROUTE,
  workbenchConversationHref,
} from '../chat-workbench-shell-spec'

describe('chat-workbench-shell-spec 契约(① 窗格身份)', () => {
  it('工作台窗格 id 与根窗格 pane-root 不同域,且非空', () => {
    expect(WORKBENCH_PANE_ID).not.toBe('pane-root')
    expect(WORKBENCH_PANE_ID.trim()).not.toBe('')
    // 票60 判据:空 paneId 在 getChatStoreForPane 挂载点即抛 —— 常量不得漂成空白
    expect(WORKBENCH_PANE_ID.length).toBeGreaterThan(4)
  })
})

describe('chat-workbench-shell-spec 契约(② 路由与深链参数名)', () => {
  it('路由挂在 /chat 家族下且参数名与 /chat 侧栏深链同名', () => {
    expect(WORKBENCH_ROUTE).toBe('/chat/workbench')
    expect(WORKBENCH_CONVERSATION_PARAM).toBe('conversationId')
  })
})

describe('chat-workbench-shell-spec 契约(③ id 规整)', () => {
  it.each([
    ['null 视作新任务态', null],
    ['空串视作新任务态', ''],
    ['纯空白视作新任务态', '   '],
    ['超长畸形串拒绝', 'x'.repeat(129)],
  ])('%s', (_case, raw) => {
    expect(resolveWorkbenchConversationId(raw)).toBeNull()
  })
  it('正常 id 去首尾空白后保留;128 字符上限内允许', () => {
    expect(resolveWorkbenchConversationId('  conv-42 ')).toBe('conv-42')
    expect(resolveWorkbenchConversationId('x'.repeat(128))).toBe('x'.repeat(128))
  })
})

describe('chat-workbench-shell-spec 契约(④ href 拼装)', () => {
  it('null 回纯路由;有值必走 encodeURIComponent', () => {
    expect(workbenchConversationHref(null)).toBe(WORKBENCH_ROUTE)
    expect(workbenchConversationHref('conv/§?#1')).toBe(
      `${WORKBENCH_ROUTE}?conversationId=${encodeURIComponent('conv/§?#1')}`,
    )
  })
  it('自动选中只取排序后的第一条,不自行排序(判据面留 give-up 空表)', () => {
    expect(pickAutoSelectConversationId(['b', 'a'])).toBe('b')
    expect(pickAutoSelectConversationId([])).toBeNull()
  })
  it('rail 选中判据:同 id 才亮,null 选中态谁都不亮', () => {
    expect(isRailRowSelected('c1', 'c1')).toBe(true)
    expect(isRailRowSelected('c1', 'c2')).toBe(false)
    expect(isRailRowSelected('c1', null)).toBe(false)
  })
})

describe('chat-workbench-shell-spec 契约(⑤ 发送链 URL 目标档)', () => {
  it.each([
    ['工作台本体留在工作台', '/chat/workbench', WORKBENCH_ROUTE],
    ['工作台子路径也留在工作台', '/chat/workbench/deep', WORKBENCH_ROUTE],
    [' /chat 本体旧行为逐字不变', '/chat', '/chat'],
    ['侧栏在他页发新会话仍回 /chat(/home)', '/home', '/chat'],
    ['历史页兄弟面维持旧行为', '/chat/history', '/chat'],
    ['同名前缀的别的域不误伤(/chatx)', '/chatx/workbench-fake', '/chat'],
  ])('%s', (_case, pathname, want) => {
    expect(chatDeeplinkPath(pathname)).toBe(want)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
