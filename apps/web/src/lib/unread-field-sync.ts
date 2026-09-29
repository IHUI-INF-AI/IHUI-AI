// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 乐观未读 overlay + 字段级对账 + 失败回滚标脏(2026-09-30 立,吸收批 74 W5)。
 *
 * 机制(中性语义重述:会话/工作区/运行记录):
 *  1. 后台终态 → 未读:走**精确实体键**的字段 overlay——即使该会话的行还没 publish,
 *     后续读取也会合并这份 overlay;不能为已有未读再创建永久 overlay。
 *  2. 服务端回包只对账 unreadAt 字段,**禁止整份 meta 覆盖**——后台完成/未读写入
 *     若覆盖标题或更新时间,会污染列表排序与展示。
 *  3. 持久化失败:回滚提交前字段 + 标脏精确工作区 + bump 版本,
 *     不留 renderer-only 假未读(下一轮 membership join 回到持久索引事实)。
 *  4. 去重窗口 1s / 256 keys:同一条状态事件会被多个列表订阅收到,
 *     首个订阅者写 overlay 并落库,其余只补角标,不重复落库。
 *  5. 当前正在看的会话不置未读。
 *
 * 本模块不直接依赖 store:行表/overlay/角标/脏标记由工厂内部持有,
 * 调用方(未来的接线层)把 store 读写搬进来即可,测试用 mock service 注入。
 */

/** 未读同步涉及的行字段(只保留对账需要的最小面)。 */
export interface UnreadSyncRow {
  sessionId: string
  workspacePath: string
  workspaceIdentity?: string
  title?: string
  updatedAt?: number
  unreadAt?: number
}

/** 工作区状态变更事件(中性形状:理由 + 未读信号 + 归属 + 可选 meta)。 */
export interface UnreadStatusEvent {
  reason: string
  unreadSignal?: string
  workspacePath: string
  workspaceIdentity?: string
  sessionId: string
  status?: string
  updatedAt?: number
  meta?: { unreadAt?: number }
}

export interface UnreadActiveScope {
  workspacePath: string
  workspaceIdentity?: string
  sessionId: string | null
}

export interface UnreadSyncDeps {
  /** 持久化未读(写持久索引);resolve 可携带服务端权威 unreadAt。 */
  setUnread(params: {
    workspacePath: string
    workspaceIdentity?: string
    sessionId: string
    unread: boolean
  }): Promise<{ unreadAt?: number } | void>
  /** 时钟注入(去重窗口与乐观时间戳)。 */
  now?(): number
  /** 告警出口(持久化失败只 warn,不打断主链路)。 */
  warn?(message: string, error: unknown): void
}

export interface UnreadSyncStateSnapshot {
  rowsByEntityKey: Record<string, UnreadSyncRow>
  overlayByEntityKey: Record<string, number>
  badgeByEntityKey: Record<string, boolean>
  dirtyWorkspaceKeys: string[]
  membershipVersion: number
}

export type UnreadSyncOutcome = 'skipped' | 'reconciled' | 'deduped' | 'optimistic'

const UNREAD_DEDUPE_WINDOW_MS = 1_000
/** 去重键上限:超出按插入序淘汰最旧,防长会话无界增长。 */
const UNREAD_DEDUPE_MAX_KEYS = 256
/** 终态:后台跑完落这两个状态才可能产生"未读"。 */
const TERMINAL_STATUSES = new Set(['completed', 'error'])

export function buildUnreadWorkspaceKey(workspacePath: string, workspaceIdentity?: string): string {
  const identity = workspaceIdentity?.trim()
  return identity ? identity : workspacePath
}

export function buildUnreadEntityKey(row: {
  workspacePath: string
  workspaceIdentity?: string
  sessionId: string
}): string {
  return `${buildUnreadWorkspaceKey(row.workspacePath, row.workspaceIdentity)}::${row.sessionId}`
}

function isTerminalStatus(status: string | undefined): boolean {
  return status !== undefined && TERMINAL_STATUSES.has(status)
}

export function createUnreadFieldSync(deps: UnreadSyncDeps) {
  const rowsByEntityKey: Record<string, UnreadSyncRow> = {}
  const overlayByEntityKey: Record<string, number> = {}
  const badgeByEntityKey: Record<string, boolean> = {}
  const dirtyWorkspaceKeys = new Set<string>()
  const recentUnreadByKey = new Map<string, number>()
  let membershipVersion = 0

  const now = deps.now ?? (() => Date.now())
  const warn = deps.warn ?? (() => {})

  /**
   * 去重窗口:同一条事件(同实体+同状态+同更新时间)在窗口内只放行首个订阅者。
   * 有界 256,过期键惰性清理。
   */
  function shouldSkipRecentUnread(key: string): boolean {
    const at = now()
    for (const [recentKey, seenAt] of recentUnreadByKey) {
      if (at - seenAt > UNREAD_DEDUPE_WINDOW_MS) {
        recentUnreadByKey.delete(recentKey)
      }
    }
    if (recentUnreadByKey.has(key)) {
      return true
    }
    recentUnreadByKey.set(key, at)
    if (recentUnreadByKey.size > UNREAD_DEDUPE_MAX_KEYS) {
      const oldestKey = recentUnreadByKey.keys().next().value
      if (oldestKey !== undefined) {
        recentUnreadByKey.delete(oldestKey)
      }
    }
    return false
  }

  /** 服务端回包**只对账 unreadAt 字段**,禁止整份 meta 覆盖其他字段。 */
  function reconcileUnreadField(entityKey: string, unreadAt: number): void {
    const existing = rowsByEntityKey[entityKey]
    if (existing) {
      rowsByEntityKey[entityKey] = { ...existing, unreadAt }
    } else {
      // 行尚未 publish:按事件归属补最小行,后续整份快照合并时以持久事实为准。
      const [sessionId] = entityKey.split('::').slice(-1)
      rowsByEntityKey[entityKey] = {
        sessionId: sessionId ?? entityKey,
        workspacePath: '',
        unreadAt,
      }
    }
    delete overlayByEntityKey[entityKey]
  }

  /**
   * 状态事件入口。返回值供测试/接线层观测:
   *  - skipped:非后台终态 / 非终态 / 当前正在看
   *  - reconciled:已有未读事实(行/overlay/事件携带),只补角标不重复落库
   *  - deduped:1s 窗口内的重复事件
   *  - optimistic:写 overlay + 发起持久化(失败时内部回滚标脏)
   */
  function handleStatusEvent(
    event: UnreadStatusEvent,
    active: UnreadActiveScope,
  ): UnreadSyncOutcome {
    if (event.reason !== 'status_changed' || event.unreadSignal !== 'background_terminal') {
      return 'skipped'
    }
    if (!event.sessionId || !isTerminalStatus(event.status)) {
      return 'skipped'
    }
    // 当前正在看的会话不置未读:同工作区且激活的就是这个会话。
    const sameWorkspace =
      buildUnreadWorkspaceKey(active.workspacePath, active.workspaceIdentity) ===
      buildUnreadWorkspaceKey(event.workspacePath, event.workspaceIdentity)
    if (sameWorkspace && active.sessionId === event.sessionId) {
      return 'skipped'
    }

    const entityKey = buildUnreadEntityKey(event)
    const cachedRow = rowsByEntityKey[entityKey]
    const pendingOverlay = overlayByEntityKey[entityKey]
    // 未读事实优先级:行字段 → 事件携带 → 乐观 overlay。
    const persistedUnreadAt =
      cachedRow?.unreadAt ?? event.meta?.unreadAt ?? (typeof pendingOverlay === 'number' ? pendingOverlay : undefined)
    if (typeof persistedUnreadAt === 'number') {
      // 同一条状态事件会被多个列表订阅收到:首个订阅者已写 overlay 后,
      // 后续只补角标。若未读是事件直接携带的(行/overlay 都没有),
      // 直接对账字段,不能为已有未读创建永久 overlay。
      if (typeof cachedRow?.unreadAt !== 'number' && typeof pendingOverlay !== 'number') {
        reconcileUnreadField(entityKey, persistedUnreadAt)
      }
      badgeByEntityKey[entityKey] = true
      return 'reconciled'
    }

    const dedupeKey = [
      buildUnreadWorkspaceKey(event.workspacePath, event.workspaceIdentity),
      event.sessionId,
      event.status ?? '',
      event.updatedAt ?? '',
    ].join('::')
    if (shouldSkipRecentUnread(dedupeKey)) {
      return 'deduped'
    }

    const previousUnreadAt = cachedRow?.unreadAt
    const previousBadge = badgeByEntityKey[entityKey] ?? false
    const optimisticUnreadAt = now()
    // 乐观未读走精确实体键的字段 overlay:即使行还没 publish,后续读取也会合并。
    overlayByEntityKey[entityKey] = optimisticUnreadAt
    badgeByEntityKey[entityKey] = true

    void deps
      .setUnread({
        workspacePath: event.workspacePath,
        workspaceIdentity: event.workspaceIdentity,
        sessionId: event.sessionId,
        unread: true,
      })
      .then((meta) => {
        // 服务端先写持久索引再回包;只对账 unreadAt 字段,禁止整份覆盖。
        reconcileUnreadField(entityKey, meta?.unreadAt ?? optimisticUnreadAt)
      })
      .catch((error: unknown) => {
        // 持久化失败不能留 renderer-only 假未读:恢复提交前字段,
        // 标脏精确工作区 + bump 版本,让下一轮 membership join 回到持久索引事实。
        if (typeof previousUnreadAt === 'number') {
          overlayByEntityKey[entityKey] = previousUnreadAt
        } else {
          delete overlayByEntityKey[entityKey]
        }
        badgeByEntityKey[entityKey] = previousBadge
        dirtyWorkspaceKeys.add(buildUnreadWorkspaceKey(event.workspacePath, event.workspaceIdentity))
        membershipVersion += 1
        warn('[unread-field-sync] 持久化后台终态未读失败', error)
      })
    return 'optimistic'
  }

  /** 外部快照回填入口:只取 unreadAt 字段,其余字段一律忽略。 */
  function applyServerMeta(
    entityKey: string,
    serverMeta: Partial<Pick<UnreadSyncRow, 'unreadAt'>> & Record<string, unknown>,
  ): void {
    if (typeof serverMeta.unreadAt !== 'number') {
      return
    }
    reconcileUnreadField(entityKey, serverMeta.unreadAt)
  }

  function getState(): UnreadSyncStateSnapshot {
    return {
      rowsByEntityKey: { ...rowsByEntityKey },
      overlayByEntityKey: { ...overlayByEntityKey },
      badgeByEntityKey: { ...badgeByEntityKey },
      dirtyWorkspaceKeys: [...dirtyWorkspaceKeys],
      membershipVersion,
    }
  }

  return { handleStatusEvent, applyServerMeta, getState }
}

export type UnreadFieldSync = ReturnType<typeof createUnreadFieldSync>
