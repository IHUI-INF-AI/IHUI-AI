// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工作区导航历史 —— 浏览器式前进/后退栈(2026-09-30 立,吸收批 74 W5)。
 *
 * 纯数据结构 + 不可变更新函数,不含 React 依赖,由会话 store 持有实例并驱动 UI。
 *
 * 机制(中性语义重述:会话/工作区/运行记录):
 *  - cursor 指针语义:cursor 指向 entries 的索引,-1 表示空栈;
 *  - 相邻去重:历史回放或连续打开同一目标时不重复入栈;
 *  - push 截断:从当前位置 push 会丢弃 cursor 之后的全部前进历史(浏览器语义);
 *  - MAX 50 溢出裁剪:裁掉最旧条目时 cursor 同步平移,指针语义不漂;
 *  - 条目删除保持 cursor 语义:当前条目被删时沿用旧位置取最近目标;
 *    运行记录等非会话条目不属于会话生命周期,原样保留;
 *  - 远程工作区的导航条目必须带 workspaceIdentity:同一路径在本地/多台远端
 *    可能同时存在,只记路径会串工作区;
 *  - 前进/后退目标存在性不能只看当前可见列表(列表迁缓存后旧可见列表可能为空,
 *    会把真实存在的历史目标误判成"按钮点了没反应"),须再查 meta 表。
 */

/** 会话条目。 */
export interface SessionNavEntry {
  kind: 'session'
  workspacePath: string
  workspaceIdentity?: string
  sessionId: string
}

/** 运行记录条目(工作区级主视图,不属于会话生命周期)。 */
export interface RunsNavEntry {
  kind: 'runs'
  workspacePath: string
  workspaceIdentity?: string
}

export type NavEntry = SessionNavEntry | RunsNavEntry

export interface NavHistory {
  entries: NavEntry[]
  /** 当前指针,指向 entries 中的索引;-1 表示空。 */
  cursor: number
}

/** 历史上限;超出裁掉最旧条目,cursor 同步平移。 */
export const NAV_HISTORY_MAX_ENTRIES = 50

/** 会话 meta 表的最小查询面:实体键 → 行存在性。 */
export type NavSessionMetaTable = Record<string, { sessionId: string }>

export function createNavHistory(): NavHistory {
  return { entries: [], cursor: -1 }
}

/** 工作区身份键:远程条目必须与路径一起隔离。 */
export function buildNavWorkspaceKey(workspacePath: string, workspaceIdentity?: string): string {
  const identity = workspaceIdentity?.trim()
  return identity ? identity : workspacePath
}

/** 会话实体的 meta 表键,与导航条目身份一一对应。 */
export function buildNavSessionEntityKey(entry: {
  workspacePath: string
  workspaceIdentity?: string
  sessionId: string
}): string {
  return `${buildNavWorkspaceKey(entry.workspacePath, entry.workspaceIdentity)}::${entry.sessionId}`
}

function isSameNavEntry(left: NavEntry, right: NavEntry): boolean {
  if (
    left.kind !== right.kind ||
    left.workspacePath !== right.workspacePath ||
    left.workspaceIdentity !== right.workspaceIdentity
  ) {
    return false
  }
  if (left.kind === 'session' && right.kind === 'session') {
    return left.sessionId === right.sessionId
  }
  return true
}

function pushEntry(history: NavHistory, entry: NavEntry): NavHistory {
  const current = history.cursor >= 0 ? history.entries[history.cursor] : null
  // 相邻去重:历史回放或连续打开同一目标时不重复入栈。
  if (current && isSameNavEntry(current, entry)) {
    return history
  }
  // 截断 cursor 之后的前进历史,保持浏览器式导航语义。
  const next = [...history.entries.slice(0, history.cursor + 1), entry]
  if (next.length > NAV_HISTORY_MAX_ENTRIES) {
    const overflow = next.length - NAV_HISTORY_MAX_ENTRIES
    return {
      entries: next.slice(overflow),
      cursor: next.length - overflow - 1,
    }
  }
  return { entries: next, cursor: next.length - 1 }
}

/** 用户主动选择/创建会话时调用;远程工作区必须带身份隔离键。 */
export function pushSessionNavEntry(
  history: NavHistory,
  entry: { workspacePath: string; workspaceIdentity?: string; sessionId: string },
): NavHistory {
  return pushEntry(history, {
    kind: 'session',
    workspacePath: entry.workspacePath,
    ...(entry.workspaceIdentity ? { workspaceIdentity: entry.workspaceIdentity } : {}),
    sessionId: entry.sessionId,
  })
}

/** 用户主动打开运行记录主视图时调用。 */
export function pushRunsNavEntry(
  history: NavHistory,
  entry: { workspacePath: string; workspaceIdentity?: string },
): NavHistory {
  return pushEntry(history, {
    kind: 'runs',
    workspacePath: entry.workspacePath,
    ...(entry.workspaceIdentity ? { workspaceIdentity: entry.workspaceIdentity } : {}),
  })
}

export function canGoBack(history: NavHistory): boolean {
  return history.cursor > 0
}

export function canGoForward(history: NavHistory): boolean {
  return history.cursor < history.entries.length - 1
}

/** 后退一步,返回新的 history 和目标 entry;不可后退返回 null。 */
export function goBack(
  history: NavHistory,
): { history: NavHistory; entry: NavEntry } | null {
  if (!canGoBack(history)) {
    return null
  }
  const nextCursor = history.cursor - 1
  const entry = history.entries[nextCursor]
  if (!entry) {
    return null
  }
  return { history: { ...history, cursor: nextCursor }, entry }
}

/** 前进一步,返回新的 history 和目标 entry;不可前进返回 null。 */
export function goForward(
  history: NavHistory,
): { history: NavHistory; entry: NavEntry } | null {
  if (!canGoForward(history)) {
    return null
  }
  const nextCursor = history.cursor + 1
  const entry = history.entries[nextCursor]
  if (!entry) {
    return null
  }
  return { history: { ...history, cursor: nextCursor }, entry }
}

/**
 * 从历史中移除指定会话的所有会话条目(会话被删除时调用)。
 * 运行记录条目不属于会话生命周期,必须原样保留。
 */
export function removeSessionFromNavHistory(
  history: NavHistory,
  sessionId: string,
): NavHistory {
  const currentEntry = history.cursor >= 0 ? history.entries[history.cursor] : null
  const filtered = history.entries.filter(
    (entry) => !(entry.kind === 'session' && entry.sessionId === sessionId),
  )
  if (filtered.length === history.entries.length) {
    return history
  }
  if (filtered.length === 0) {
    return createNavHistory()
  }
  // 当前条目未被删除时保持指向它;被删时沿用旧位置选择最近目标。
  const currentEntryIndex = currentEntry ? filtered.indexOf(currentEntry) : -1
  const cursor =
    currentEntryIndex >= 0 ? currentEntryIndex : Math.min(history.cursor, filtered.length - 1)
  return { entries: filtered, cursor }
}

/**
 * 前进/后退目标存在性判定。
 * 不能只看当前可见列表(列表迁缓存后旧可见列表可能为空,会把真实存在的历史目标
 * 误删表现成按钮点了没反应),须再查会话 meta 表。
 */
export function navTargetExists(params: {
  entry: NavEntry
  visibleSessions: readonly { sessionId: string }[]
  sessionMetaByEntityKey: NavSessionMetaTable
}): boolean {
  if (params.entry.kind !== 'session') {
    // 非会话条目是工作区级视图,不随会话删除失效。
    return true
  }
  // 先落局部变量:回调内的窄化会被重置,不能直接引用 params.entry。
  const sessionId = params.entry.sessionId
  if (params.visibleSessions.some((session) => session.sessionId === sessionId)) {
    return true
  }
  const cached = params.sessionMetaByEntityKey[buildNavSessionEntityKey(params.entry)]
  return cached?.sessionId === params.entry.sessionId
}
