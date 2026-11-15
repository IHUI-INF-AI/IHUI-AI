// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话结束(登出 / 被动失效)时的私有持久化统一清收口。
 *
 * 根治 PROJECT_PLAN Y-91/94/95/106/107/108/109/110/111/112 这一组跨用户串号缺陷
 * 的唯一出口。病灶:web 端多个 store 用固定 localStorage key(或桌面加密信封)持久化
 * **用户 A 的私有内容**(会话正文 / 草稿 / 自撰记忆 / 目标 / quest / 划词批注 / wiki 卡 /
 * 钩子规则 / webhook 凭据 / 画布),而登出既不清盘上 key、也不重置内存态。
 * A 登出后 B 在同一浏览器登录 ⇒ B 的会话里读到并写入 A 的私有数据。
 *
 * ## 为什么必须同时做两件事
 * 1. **清磁盘 key**:消灭盘上残留,下次冷启动 rehydrate 拿不到别人的快照。
 * 2. **重置内存态**:实测登出后是 SPA 内打开登录弹窗(use-auth / SidebarUserRow),
 *    **不 reload 页面** —— 只清 localStorage 时,已挂载 store 的内存里仍是 A 的数据,
 *    任何一次 `set(...)` 都会把 A 的旧数据经 persist 中间件**重新写回**盘上,清了等于没清。
 *    故必须在登出同步重置各 store 到初始态,让"下一份写盘"就是 B 的空态。
 *
 * ## 依赖方向(刻意无环)
 * auth.ts → 本模块 → 各私有 store。各私有 store **不**反向 import auth(已全量核对),
 * persist-helpers 也不反向依赖 auth —— 本模块做叶子,绕开"persist-helpers ← auth"成环。
 *
 * ## 范围:只清"用户私有内容",不动纯 UI 偏好
 * 清 theme / language / sampling-params / code-block-prefs / picture-in-picture-prefs /
 * predictive-edit-prefs / mode / conversation-detail-mode 这类偏好会伤 UX 且无安全增益,
 * 故**刻意不清**。清的是跨用户可见的私有内容与其私有引用。
 */

import { useChatStore } from './chat'
import { resetChatPaneStores } from './chat-panes'
import { useMemoryStore } from './memory'
import { useCanvasStore } from './canvas-store'
import { useIntegrationsStore } from './integrations'
import { useRepoWikiStore } from './repo-wiki'
import { useGoalStore } from './goal'
import { useQuestsStore } from './quests'
import { useAgentHooksStore } from './agent-hooks'
import { useSelectionAnnotationsStore } from './d180-selection-annotations'
import { useWalletStore } from './wallet'
import { useSamplingParamsStore } from './sampling-params'
import { usePictureInPicturePrefsStore } from './picture-in-picture-prefs'
import { useAiPanelStore } from './ai-panel'
import { useWorkPanelStore } from './work-panel'

/** 会话级私有 localStorage key(zustand persist 落盘 = 裸 name,见 d48 测试实测)。 */
const PRIVATE_PERSIST_KEYS: readonly string[] = [
  'ihui-chat', // 会话正文 / 草稿 / 输入历史 / 排队 / 失败草稿 / 划词评论(Y-94)
  'ihui-goal', // 目标文本(Y-110)
  'ihui-quests', // 自撰 quest 文本 + sessionId(Y-112)
  'ihui-memory', // 用户自撰记忆(Y-106)
  'ihui-integrations', // Slack webhook 凭据 + 通道配置(Y-108)
  'ihui-agent-hooks', // 用户私有钩子规则 + matchTool 表达式(Y-111)
  'ihui-repo-wiki', // wiki 卡 + conversationId 私有引用(Y-109)
  'ihui-canvas', // 画布正文 / 标题 / 版本历史(Y-107)
  'ihui-d180-selection-annotations', // 划词批注(Y-91)
  'ihui-wallet', // 钱包余额 / 流水 / 提现记录(Y-74,财务数据跨用户残留)
  'ihui-sampling-params', // 采样参数 byConversation 会话覆盖映射(Y-96)
  'ihui-picture-in-picture-prefs', // hiddenConversationIds 私有会话 ID 集合(Y-97)
  'ihui-ai-panel', // conversationWorkspaces 会话-工作区绑定(Y-98)
  'ihui-work-panel', // conversationTabs 会话分桶标签(Y-99,桌面加密信封)
]

/** 多窗格 chat persist 走动态 key `ihui-chat-pane-<paneId>`(Y-95),按前缀清。 */
const CHAT_PANE_KEY_PREFIX = 'ihui-chat-pane-'

/** 桌面加密装载层解不开时挪到 `<key>.unreadable` 的旁路键,一并清掉不留游离 blob。 */
const UNREADABLE_SUFFIX = '.unreadable'

/** 安全取 localStorage:SSR / 隐私模式下属性访问本身即抛,清收口绝不能因此打断登出。 */
function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage ?? null
  } catch {
    return null
  }
}

/**
 * 清磁盘:遍历 manifest 逐个 removeItem(含 `.unreadable` 旁路键),再按前缀清多窗格 chat。
 * 逐 key 清而非 `clear()`:同一 origin 下非会话私有的键(如登录偏好 ihui-login-prefs、
 * 主题 / 语言)不能被波及。
 */
function clearPrivatePersistKeys(): void {
  const storage = safeStorage()
  if (!storage) return
  const doomed = new Set<string>()
  for (const key of PRIVATE_PERSIST_KEYS) {
    doomed.add(key)
    doomed.add(`${key}${UNREADABLE_SUFFIX}`)
  }
  // 多窗格 chat 动态 key:按前缀扫盘,拿到 paneId 集合后删其 persist 快照 + 旁路键。
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (key && key.startsWith(CHAT_PANE_KEY_PREFIX)) {
        doomed.add(key)
        doomed.add(`${key}${UNREADABLE_SUFFIX}`)
      }
    }
  } catch {
    // Storage 枚举失败(极少数隐私模式)⇒ 退化为只清已知 manifest,不抛穿登出。
  }
  for (const key of doomed) {
    try {
      storage.removeItem(key)
    } catch {
      // 单键删除失败不阻塞其余键
    }
  }
}

/**
 * 重置已加载私有 store 的内存态到初始值。
 *
 * 刻意**只重置数据字段、不重建 store**(不 replace 整个 state,避免丢 action 引用 / 破坏
 * persist 订阅)。各字段初始值逐一对齐各 store 自身 `create(...)` 的初值,不凭空捏造。
 * 登出后任何一次组件 `set` 都只可能写 B 的空态,不会再把 A 的旧数据带回盘上。
 */
function resetPrivateInMemoryStores(): void {
  // 先回收多窗格 chat 实例(清 paneStores / WeakMap),再清单例 —— 顺序无关但先收内存更稳。
  resetChatPaneStores()

  // chat 单例:清会话承载字段(currentModel/Channel 是偏好,刻意保留,见头注范围)。
  try {
    useChatStore.setState({
      messages: [],
      messagesTurnWindowed: false,
      conversationId: null,
      draftInput: null,
      inputHistory: [],
      pendingDiffComments: [],
      sideQueueByConversation: {},
      failedDraft: null,
      failedDraftStatus: null,
      recentMessages: null,
    })
  } catch {
    // store 未初始化(极端时序)不阻塞登出
  }

  try {
    useMemoryStore.setState({ entries: [] })
  } catch {
    /* 同上 */
  }
  try {
    useCanvasStore.setState({
      open: false,
      fullscreen: false,
      content: '',
      title: '',
      versions: [],
    })
  } catch {
    /* 同上 */
  }
  try {
    // 通道凭据(webhookUrl)一并归零:恢复为 DEFAULT_CHANNEL 形态(全关 + 空 events)。
    useIntegrationsStore.setState({
      channels: {
        github: { enabled: false, events: [] },
        slack: { enabled: false, events: [] },
        push: { enabled: false, events: [] },
      },
      log: [],
      droppedLog: 0,
    })
  } catch {
    /* 同上 */
  }
  try {
    useRepoWikiStore.setState({ cards: [] })
  } catch {
    /* 同上 */
  }
  try {
    useGoalStore.setState({ goal: null })
  } catch {
    /* 同上 */
  }
  try {
    useQuestsStore.setState({ entries: {} })
  } catch {
    /* 同上 */
  }
  try {
    useAgentHooksStore.setState({ hooks: [], events: [], droppedEvents: 0 })
  } catch {
    /* 同上 */
  }
  try {
    useSelectionAnnotationsStore.setState({ annotationsByMessage: {} })
  } catch {
    /* 同上 */
  }
  try {
    useWalletStore.setState({ balance: 0, transactions: [], withdrawRecords: [] })
  } catch {
    /* 同上 */
  }
  try {
    useSamplingParamsStore.setState({ defaults: {}, byConversation: {} })
  } catch {
    /* 同上 */
  }
  try {
    usePictureInPicturePrefsStore.setState({
      hideInAllSessions: false,
      hiddenConversationIds: [],
    })
  } catch {
    /* 同上 */
  }
  try {
    useAiPanelStore.setState({ activeWorkspace: null, conversationWorkspaces: {} })
  } catch {
    /* 同上 */
  }
  try {
    useWorkPanelStore.setState({
      conversationTabs: {},
      tabs: [],
      activeTabId: null,
      conversationId: null,
    })
  } catch {
    /* 同上 */
  }
}

/**
 * 会话结束的**唯一**清收口:登出 / 被动失效都在 auth 的 logout / expireSession 里调用。
 * 同步执行(先清磁盘 + 先重置内存),必须在任何后续 await(后端吊销 / vault 处置)之前
 * —— 那些等待期间组件仍可能 set,A 的数据一旦写回就前功尽弃。
 * 全程 try/catch 兜底:清收口绝不打断登出主流程(失效方向:宁可残留一份待下次冷启动清,
 * 也不让用户卡在登不出去)。
 */
export function resetPrivateSessionState(): void {
  try {
    clearPrivatePersistKeys()
  } catch {
    /* 盘上清理失败不阻塞内存重置 */
  }
  try {
    resetPrivateInMemoryStores()
  } catch {
    /* 内存重置失败不阻塞登出 */
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
