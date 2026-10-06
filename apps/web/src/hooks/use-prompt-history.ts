// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 DOM keydown / textarea selection,不适合放进 packages/shared 共享层。
// 栈的纯逻辑(push/去重/50 上限/游标导航)在 packages/shared/src/chat/prompt-history.ts,
// 本 hook 只做 web 端接线:
// - 按 conversationId 分桶持久化(`chat:prompt-history:{id}`,未持久化会话用 `chat:prompt-history`)
// - 维护翻历史游标 / 草稿备份(React Refs,不触发渲染)
// - 暴露 pushSent / handleArrowKey / resetCursor 给 MessageInput
//
// ## 2026-10-06(O59⑤ 残留修复):`chat:prompt-history*` 桶值改走加密通道
// 过去 5 处都是裸 `localStorage.*`,桌面端明文落盘(盘上实测有中文残留)。
// 现在桶值统一走 `lib/chat-draft-storage` 的同一条加密通道,与 `chat:draft*` 同构。
//
// ### 为什么"直接复用"通道的 `read/write`,不在其上再加一层值语义包装
// `openVaultText`/`sealVaultText` 是**键无关的纯文本封装**,JSON 字符串一样能加密,
// 所以通道的 `string` 契约对本 hook 天然成立 —— 加一层包装只是把同一段 JSON.stringify
// 挪个位置,却多出第二套"值 ↔ 文本"转换点(将来改格式要改两处)。
// **解析入口保持不变**:落盘形态从"明文 JSON"变成"信封 JSON",而读出来仍然是
// `JSON.parse` 后的字符串数组,`parsePromptHistory` 仍在 hook 侧、仍只认这一个入口。
// 唯一的适配点是**空串**:通道约定 `write(key, '')` 等价于清桶,而历史栈写的是
// `JSON.stringify([])` === `'[]'`(非空串),所以"空栈"会如实落一个 `'[]'` 密文,
// 与改造前 `setItem(key, '[]')` 的落盘形态一致,不存在"空栈被当成清桶"的错配。
//
// ### 域选择:单开 `chat-prompt-history`(2026-10-06 主会话裁决)
// 初版实现曾复用 `chat-draft` 域,理由是"该模块域硬编码、改它不在改动面内"。
// **那个理由不成立**:改动面由主会话定,发现需要拆域时应当报告并由主会话补齐,而不是就地降级。
// 复用有实质代价,不是"反正没关系":
//   共用子密钥 ⇒ 两族密文互相可解;任一方日后重加密/轮换密钥,另一族的密文**同生共死**,
//   且"这段密文是哪一族写的"失去锚点,无法归因。这与 chat-persist / goal-persist /
//   auth-persist / work-panel-persist 各自单开域是**同一条纪律**(见 chat-persist-crypto
//   文件头「新增被加密的 store 时必须开新域,不得共用一把子密钥」)。
// 关于"单开域会让存量密文对不上":**不成立** —— 本族改造前的存量是**明文**(`openVaultText`
// 返回 kind:'plain'),明文与域无关,读出来照样能用新域 seal。真正会对不上的是"用 A 域写的密文
// 拿 B 域的钥匙去解",而那要求存量已经是密文且恰好跨族,本仓无此形态。
// 已在 chat-draft-storage 侧把 domain 提为可注入参数,单例改按域各持一份(队列也随之分开)。
//
// ### 同步读变异步 ⇒ UI 竞态:本 hook 的处理与取舍
// 历史面是**游标式翻阅**(↑/↓ 一格一格走),不是草稿面的"文本框整体回填",竞态形态不同。
// 桌面端解密在飞时 `entriesRef` 是空的,若什么都不做会有两类错:
// (A) 翻历史键:`entries.length === 0` 提前 return false ⇒ 用户按 ↑ **静默无反应**
//     (反之若放行 false 让 textarea 自己移光标,历史一个也没翻,用户以为坏了)。
// (B) pushSent:`pushPromptEntry([], text)` 会把**整桶历史覆盖成这一条** ——
//     这是本轮引入的最隐蔽的一处丢数据,比 (A) 严重得多。
// 取舍与选择:**"pending 期间先记着,解密完成后按序重放"**(队列 = pendingNavRef/pendingPushRef)。
// - 为什么不给 pending 期间的翻历史键"直接丢弃":解密窗口只有一次 WebCrypto(首读还要
//   叠加一次密钥引导),量级在毫秒;丢弃 ⇒ 用户第一下 ↑ 没反应、第二下才生效,像是坏了。
// - 为什么不"放行 false 让 textarea 自己动":光标先动、文本后到,两段动画互相打架。
//   故 pending 期间**消费该键**(return true)并记账,重放时走与实时翻阅**同一个** stepCursor。
// - 按序重放让"↑ 又 ↓"这种连按回到草稿的语义天然成立(顺序即语义),不需要额外合并逻辑。
// - 唯一的走偏风险是"记完键用户开始打字" —— 由 `resetCursor` 清空记账化解:
//   手动编辑一发生,未落的翻历史意图即作废(回填到错的时刻比不回填更糟)。
// - (B) 同理:pending 期间的 pushSent 只记账不落盘,载入完成后并入 entries 再写一次。
//   不做这一步的实测后果:发送一条即**清空该会话全部历史**(push 的是 `[text]`,覆盖整桶)。
//
// ### 非桌面端为什么坚持"全同步",而不是让 read 的微任务也走统一路径
// 统一走 `await read()` 会给浏览器引入一个**旧实现不存在的窗口**:挂载 effect 里发起读之后、
// 微任务落地之前,用户 pushSent 写进 `entriesRef` 的栈会被随后到达的装载结果整个覆盖。
// 桌面端无碍(那段窗口本来就由 loading 记账兜住),但浏览器上它就是纯回归。
// 故浏览器路径用通道的 `peekSync` 同步取真值,把"行为一字不变"落到结构上而非靠论证。

import * as React from 'react'
import {
  navigateCursor,
  parsePromptHistory,
  PROMPT_HISTORY_PREFIX,
  pushPromptEntry,
  resolveHistoryText,
} from '@ihui/shared/chat'
import { touchAndEvictBuckets } from '@/lib/prompt-bucket-quota'
import { getPromptHistoryStorage, type ChatDraftStorage } from '@/lib/chat-draft-storage'
import { isDesktopEnv } from '@/lib/local-vault'

/** keydown 事件的最小子集(handleArrowKey 不依赖真实 React 事件,便于单测) */
export interface HistoryKeyLike {
  key: string
  preventDefault: () => void
  nativeEvent?: { isComposing?: boolean }
}

export interface UsePromptHistoryParams {
  /** 动态返回当前历史 key(随 conversationId 变化);push/load 时求值,保证用的是最新会话桶 */
  getHistoryKey: () => string
  /** 读取 textarea 当前光标位置(selectionStart),用于多行首行判定 */
  getCaretPosition: () => number
  /** 把历史文本回填到输入框并把光标移到行尾(调用方负责 setValue + focus + setSelectionRange) */
  applyText: (text: string) => void
}

export interface UsePromptHistoryResult {
  /** 发送成功后推送该条用户文本(写入 localStorage + 重置翻历史游标) */
  pushSent: (text: string) => void
  /** 输入框 keydown 拦截:处理 ↑/↓ 翻历史,返回 true 表示已消费(调用方应 preventDefault) */
  handleArrowKey: (e: HistoryKeyLike, ctx: { value: string }) => boolean
  /** 用户手动编辑输入框时调用:清空翻历史游标 / 草稿备份,避免回填上一条时误用旧游标 */
  resetCursor: () => void
}

/** 一次待重放的翻历史按键。value 是按键那一刻的输入框内容(重放时要用来存草稿备份) */
interface PendingNav {
  dir: 'prev' | 'next'
  value: string
}

export function usePromptHistory(params: UsePromptHistoryParams): UsePromptHistoryResult {
  const { getHistoryKey, getCaretPosition, applyText } = params
  const entriesRef = React.useRef<string[]>([])
  const cursorRef = React.useRef(0)
  const draftBackupRef = React.useRef('')
  const prevKeyRef = React.useRef('')
  /** 解密在飞期间按下的翻历史键,解密完成后按序重放(见文件头竞态取舍) */
  const pendingNavRef = React.useRef<PendingNav[]>([])
  /** 解密在飞期间 pushSent 的文本:此刻 entries 还没读回来,直接落盘会覆盖整桶历史 */
  const pendingPushRef = React.useRef<string[]>([])
  /** 当前桶是否处于"解密在飞"。用来区分"真的没有历史"与"还没读到历史" */
  const loadingRef = React.useRef(false)

  /** 执行一次游标移动并回填文本。实时翻阅与解密后重放共用同一份逻辑(避免两处漂移) */
  const stepCursor = React.useCallback(
    (dir: 'prev' | 'next', ctx: { value: string }): boolean => {
      const entries = entriesRef.current
      if (entries.length === 0) return false
      if (dir === 'prev') {
        // 第一次从草稿上翻:保存当前未发送文本,供 ↓ 返回(Codex 语义)
        if (cursorRef.current === 0 && ctx.value.length > 0) {
          draftBackupRef.current = ctx.value
        }
        cursorRef.current = navigateCursor(cursorRef.current, 'prev', entries.length)
      } else {
        // 已回到草稿则不拦截,让光标在草稿内正常下移
        if (cursorRef.current === 0) return false
        cursorRef.current = navigateCursor(cursorRef.current, 'next', entries.length)
      }
      applyText(resolveHistoryText(entries, cursorRef.current, draftBackupRef.current))
      return true
    },
    [applyText],
  )

  // 重放要调"当时那份" stepCursor,但**不能**把它列进下面 effect 的依赖:
  // applyText 在 message-input 里是 useCallback 稳定函数,在部分调用点/测试里是内联箭头,
  // 一旦成为依赖,effect 每次 render 都重跑 → 归零游标 + 重复跨桶搬运。
  // (与 message-input-history.test.tsx 里"必须复刻 getHistoryKey 稳定身份"同源。)
  // 故用 ref 追最新实现:effect 依赖仍只有 getHistoryKey,行为与改造前一致。
  const stepCursorRef = React.useRef(stepCursor)
  React.useEffect(() => {
    stepCursorRef.current = stepCursor
  }, [stepCursor])

  /** 装载完成后的落地:合并在飞期间的 push,归零游标,重放待翻键。仅在未取消时生效 */
  const applyLoaded = React.useCallback(
    (key: string, loaded: string[], storage: ChatDraftStorage) => {
      // 合并解密在飞期间的 pushSent:它们当时没落盘(见文件头 (B) 条)
      const queued = pendingPushRef.current
      let merged = loaded
      for (const text of queued) merged = pushPromptEntry(merged, text)
      pendingPushRef.current = []
      entriesRef.current = merged
      if (queued.length > 0) {
        // 合并后的完整栈必须回写,否则这些 push 只活在内存里,刷新即丢
        void storage.write(key, JSON.stringify(merged)).then(() => {
          touchAndEvictBuckets(PROMPT_HISTORY_PREFIX, key)
        })
      }
      cursorRef.current = 0
      draftBackupRef.current = ''
      loadingRef.current = false
      // 按序重放解密期间按下的翻历史键(见文件头竞态取舍)。
      // 必须在 entriesRef 赋值之后 —— 重放走的是实时翻阅同一个 stepCursor。
      const navs = pendingNavRef.current
      pendingNavRef.current = []
      for (const nav of navs) {
        stepCursorRef.current(nav.dir, { value: nav.value })
      }
    },
    [],
  )

  // 会话切换:加载目标桶历史;若新桶为空而旧桶有内容(新会话首条消息时机),
  // 把旧桶内容迁移到新桶,避免首条消息历史丢失(会话隔离不被破坏,仅跨桶搬运当前数据)。
  React.useEffect(() => {
    const storage = getPromptHistoryStorage()
    const newKey = getHistoryKey()
    const prevKey = prevKeyRef.current
    // 上一次的解密结果一律作废:key 换了还把旧桶历史回填进来,就是跨会话串味
    let cancelled = false
    pendingPushRef.current = []
    pendingNavRef.current = []
    prevKeyRef.current = newKey

    // ---- 路径 A:非桌面端。全同步,行为与改造前逐字一致(硬要求 1) ----
    // 这里刻意**不用** async read:浏览器的 read 虽然同步 resolve,但 `.then` 仍要排一个
    // 微任务,于是"挂载后同一 tick 内 pushSent"写进内存的栈会被随后到达的装载结果覆盖
    // (旧实现是三处同步 getItem,不存在这个窗口)。`peekSync` 正是通道为"同步给真值"
    // 留的出口,这里用它把浏览器路径拉回严格同步。
    if (!isDesktopEnv()) {
      const oldEntries =
        prevKey && prevKey !== newKey
          ? parsePromptHistory(storage.peekSync(prevKey))
          : ([] as string[])
      const loaded = parsePromptHistory(storage.peekSync(newKey))
      if (loaded.length === 0 && oldEntries.length > 0) {
        // 跨桶搬运;失败不阻断(存储异常/配额)
        try {
          void storage.write(newKey, JSON.stringify(oldEntries))
          touchAndEvictBuckets(PROMPT_HISTORY_PREFIX, newKey)
        } catch {
          // 忽略存储异常(隐私模式 / 配额)
        }
        applyLoaded(newKey, oldEntries, storage)
        return
      }
      applyLoaded(newKey, loaded, storage)
      return
    }

    // ---- 路径 B:桌面端。值是密文,同步解不开 ⇒ 异步解密 ----
    // 期间"没有历史"与"还没读到历史"无法区分,故置 loading:
    // pushSent 只记账(否则整桶历史会被覆盖成最后一条),翻历史键记账后重放。
    loadingRef.current = true
    void (async () => {
      const oldEntries =
        prevKey && prevKey !== newKey ? parsePromptHistory(await storage.read(prevKey)) : []
      const loaded = parsePromptHistory(await storage.read(newKey))
      if (cancelled) return
      if (loaded.length === 0 && oldEntries.length > 0) {
        // 跨桶搬运 + 落盘;失败不阻断(存储异常/配额)
        try {
          await storage.write(newKey, JSON.stringify(oldEntries))
          touchAndEvictBuckets(PROMPT_HISTORY_PREFIX, newKey)
        } catch {
          // 忽略存储异常(隐私模式 / 配额)
        }
        applyLoaded(newKey, oldEntries, storage)
        return
      }
      if (cancelled) return
      applyLoaded(newKey, loaded, storage)
    })()

    return () => {
      cancelled = true
    }
  }, [getHistoryKey, applyLoaded])

  const pushSent = React.useCallback(
    (text: string) => {
      const key = getHistoryKey()
      // 解密在飞:栈还没读回来,此刻 push+落盘会把整桶历史覆盖成这一条(丢数据)。
      // 只记账,等 load 的 finish() 合并进完整栈后统一回写。
      if (loadingRef.current) {
        pendingPushRef.current.push(text)
        cursorRef.current = 0
        draftBackupRef.current = ''
        return
      }
      const next = pushPromptEntry(entriesRef.current, text)
      entriesRef.current = next
      // 通道 write 内部串行入队(见 chat-draft-storage 文件头「异步写序」),此处不 await:
      // 发送路径不因加密阻塞。存储异常由通道内部吞掉。
      void getPromptHistoryStorage()
        .write(key, JSON.stringify(next))
        .then(() => {
          touchAndEvictBuckets(PROMPT_HISTORY_PREFIX, key)
        })
      cursorRef.current = 0
      draftBackupRef.current = ''
    },
    [getHistoryKey],
  )

  const handleArrowKey = React.useCallback(
    (e: HistoryKeyLike, ctx: { value: string }): boolean => {
      const keyName = e.key
      if (keyName !== 'ArrowUp' && keyName !== 'ArrowDown') return false
      if (e.nativeEvent?.isComposing) return false
      const dir = keyName === 'ArrowUp' ? 'prev' : 'next'
      // 多行:光标不在第一行时只移动光标,不劫持翻历史(行业惯例,防多行编辑被劫持)
      if (dir === 'prev') {
        const caret = getCaretPosition()
        const onFirstLine = !ctx.value.slice(0, caret).includes('\n')
        if (!onFirstLine) return false
      }
      // 解密在飞:栈还是空的,实时翻阅会 return false 让按键"静默消失"。
      // 改为记账并消费该键,解密完成后按序重放(见文件头竞态取舍)。
      if (loadingRef.current) {
        pendingNavRef.current.push({ dir, value: ctx.value })
        return true
      }
      return stepCursor(dir, ctx)
    },
    [getCaretPosition, stepCursor],
  )

  const resetCursor = React.useCallback(() => {
    cursorRef.current = 0
    draftBackupRef.current = ''
    // 用户已开始手动编辑 ⇒ 解密在飞期间记下的翻历史意图作废。
    // 不清的话,重放会在用户敲完字之后突然把输入框覆盖成某条历史(比不回填更糟)。
    pendingNavRef.current = []
  }, [])

  return { pushSent, handleArrowKey, resetCursor }
}
