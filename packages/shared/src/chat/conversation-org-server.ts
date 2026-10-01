// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D165(2026-10-01 立):会话分组的**服务端** store —— 跨端单一源(AGENTS §3:跨端可用的逻辑必须先落 packages/shared,
// 不得在端内各写一份;消费方经子路径 @ihui/shared/chat/conversation-org-server,不进根桶、不建第二份 barrel 出口)。
// 分组是一等行(库面 chat_conversation_groups),
// 不再是 localStorage 里的文件夹字符串。本地那份见 conversation-org.ts(标签仍住本地)。
//
// 为什么单独成文件而不是并进 conversation-org.ts:那一份的判据(归一化/去重/空回收)与它的
// 测试面都按"纯本地同步写"钉着;网络语义(失败原因、乐观回滚)混进去会让那批用例被迫 mock fetch,
// 而 mock 掉的正是本票要证的失败分支。
//
// 三条不许漂的写法:
// ① **失败必须给原因**:每个写出口回 `{ok:false, reason}` 判别联合,不抛裸 Error、不返回布尔 ——
//    布尔会让"没找到"与"不是你的分组"在 UI 上同形(AGENTS §5「认证不等于授权」与守门 134 的
//    "回报集合取库确认集"是同一条纪律)。
// ② **身份从结构化字段取,取数必须先过 unwrap**:`fetchApi` 回的是 `ApiResult<T>` 联合,失败分支上没有
//    `.data` —— 直接 `res.groups` 在运行时是 undefined(第一版就是这么错的:web typecheck 拦下了它,
//    而把 mock 负载写成裸对象的那批单测**全绿**)。分类优先读 `status`/`errorCode`(守门 135 立的
//    那一条:丢了这两档只剩文案,401 就会被说成"提交的信息有误",把用户引向错误的下一步),
//    字段缺席时才退回文案匹配。
// ③ **单一规则源**:分组名归一化仍走 @ihui/shared 的 normalizeOrgName,本文件不写第二套上限/大小写规则;
//    分组行的形状直接复用 @ihui/api-client 的 `ConversationGroup`,不抄第二份字段表。

import { create } from 'zustand'

import { normalizeOrgName, ORG_FOLDER_MAX_LENGTH } from '@ihui/shared'
import type { ApiResult } from '@ihui/types'
import {
  createConversationGroup,
  deleteConversationGroup,
  listConversationGroupAssignments,
  listConversationGroups,
  moveConversationsToGroup,
  updateConversationGroup,
  type ConversationGroup,
} from '@ihui/api-client'

/** 写失败的分类。UI 必须逐类给不同文案,不得并成"操作失败"。 */
export type OrgFailureReason =
  | 'offline' // 网络层失败(请求没到服务端)
  | 'name-too-long' // 归一化后为空,客户端就拦下
  | 'duplicate-name' // 同名冲突
  | 'not-found' // 分组不存在
  | 'forbidden' // 存在但不属于本人
  | 'unauthorized' // 401:该去重新登录,而不是"改个名字失败"
  | 'server' // 5xx:服务端自己的问题,不是用户的输入问题
  | 'unknown'

export type OrgWriteResult = { ok: true } | { ok: false; reason: OrgFailureReason }

/** 复用契约包的分组行:抄一份本地接口就会在两侧字段演进时静默分叉(守门 134 的净零逃逸同型)。 */
export type ConversationFolder = ConversationGroup

interface OrgServerState {
  userId: string | null
  folders: ConversationFolder[]
  /** conversationId → groupId;未分组不落键,由调用方按"无键=未分组"判 */
  membership: Record<string, string | null>
  /** 服务端接管标记:false 时本 store 从未成功加载,本地那份仍是唯一真相(不得读成"已同步") */
  ready: boolean
  loading: boolean
  lastError: OrgFailureReason | null
}

interface OrgServerActions {
  refresh: (userId: string) => Promise<void>
  reloadFolders: (userId: string) => Promise<void>
  assign: (
    userId: string,
    conversationId: string,
    folderName: string | null,
  ) => Promise<OrgWriteResult>
  assignMany: (
    userId: string,
    conversationIds: readonly string[],
    folderId: string | null,
  ) => Promise<
    { ok: true; affected: number; missedIds: string[] } | { ok: false; reason: OrgFailureReason }
  >
  renameFolder: (userId: string, folderId: string, name: string) => Promise<OrgWriteResult>
  togglePinFolder: (userId: string, folderId: string) => Promise<OrgWriteResult>
  deleteFolder: (userId: string, folderId: string) => Promise<OrgWriteResult>
}

const INITIAL: OrgServerState = {
  userId: null,
  folders: [],
  membership: {},
  ready: false,
  loading: false,
  lastError: null,
}

/** 稳定空对象:selector 直接返回它时引用不变,否则订阅方每帧拿到新快照(全路由崩溃那一型)。 */
export const EMPTY_MEMBERSHIP: Record<string, string | null> = Object.freeze({}) as Record<
  string,
  string | null
>
export const EMPTY_FOLDER_LIST: readonly ConversationFolder[] = Object.freeze([])

type OrgStore = OrgServerState & OrgServerActions

/** 从失败分支的**结构化字段**判因;字段缺席才看文案。 */
export function reasonFromFields(
  status?: number,
  errorCode?: string,
  message?: string,
): OrgFailureReason {
  const code = (errorCode ?? '').toUpperCase()
  if (code === 'UNAUTHORIZED' || code === 'TOKEN_EXPIRED' || status === 401) return 'unauthorized'
  if (code === 'FORBIDDEN' || status === 403) return 'forbidden'
  if (code === 'NOT_FOUND' || status === 404) return 'not-found'
  if (code === 'CONFLICT' || code === 'DUPLICATE' || status === 409) return 'duplicate-name'
  if (typeof status === 'number' && status >= 500) return 'server'
  const lowered = (message ?? '').toLowerCase()
  if (/failed to fetch|networkerror|econnrefused|fetch failed|timeout/.test(lowered)) return 'offline'
  return 'unknown'
}

/** 异常路径的归因(抛出来的那些,不是 ApiResult 失败分支)。 */
export function classifyThrow(e: unknown): OrgFailureReason {
  const msg = e instanceof Error ? e.message : String(e)
  const lowered = msg.toLowerCase()
  if (/failed to fetch|networkerror|econnrefused|fetch failed|timeout|network request failed/.test(lowered)) {
    return 'offline'
  }
  if (/(401)|unauthorized|invalid or expired token/.test(lowered)) return 'unauthorized'
  if (/(403)|forbidden/.test(lowered)) return 'forbidden'
  if (/(404)|not.?found/.test(lowered)) return 'not-found'
  if (/(409)|conflict|duplicate/.test(lowered)) return 'duplicate-name'
  if (/(5\d\d)|internal server error/.test(lowered)) return 'server'
  return 'unknown'
}

/** 唯一的 unwrap:联合在这里收敛一次;每个出口各写一遍 `if (r.success)` 必然漏掉一处失败分支。 */
export function unwrap<T>(
  r: ApiResult<T>,
): { ok: true; data: T } | { ok: false; reason: OrgFailureReason } {
  if (r.success) return { ok: true, data: r.data }
  return { ok: false, reason: reasonFromFields(r.status, r.errorCode, r.error) }
}

export function blockedName(name: string): OrgFailureReason | null {
  return name ? null : 'name-too-long'
}

export const useOrgServerStore = create<OrgStore>((set, get) => ({
  ...INITIAL,

  async refresh(userId) {
    if (get().loading && get().userId === userId) return
    set({ userId, loading: true })
    try {
      const [groupsRaw, assignmentsRaw] = await Promise.all([
        listConversationGroups(),
        listConversationGroupAssignments(),
      ])
      const groups = unwrap(groupsRaw)
      const assignments = unwrap(assignmentsRaw)
      if (!groups.ok || !assignments.ok) {
        // 一次刷新失败不得把"曾经同步过"说成"没同步",也不得反过来:ready 保持原值,只报因。
        const reason = !groups.ok
          ? groups.reason
          : !assignments.ok
            ? assignments.reason
            : ('unknown' as OrgFailureReason)
        set({ loading: false, lastError: reason })
        return
      }
      const map: Record<string, string | null> = {}
      for (const row of assignments.data.assignments) map[row.conversationId] = row.groupId
      set({
        userId,
        folders: groups.data.groups,
        membership: map,
        ready: true,
        loading: false,
        lastError: null,
      })
    } catch (e) {
      set({ loading: false, lastError: classifyThrow(e) })
    }
  },

  /**
   * 只重取分组清单(不重取 membership)。
   * 为什么写后不整表 refresh:刚写完立刻读回,读到的可能是**尚未跟上这次写**的那一份,
   * 于是界面把用户刚做成的事演成"没生效" —— 比失败更难排查的一种。计数这种可延后的派生值才走这条路。
   */
  async reloadFolders(userId) {
    try {
      const groups = unwrap(await listConversationGroups())
      if (!groups.ok) {
        set({ lastError: groups.reason })
        return
      }
      set({ userId, folders: groups.data.groups, ready: true, lastError: null })
    } catch (e) {
      set({ lastError: classifyThrow(e) })
    }
  },

  async assign(userId, conversationId, folderName) {
    const wanted = normalizeOrgName(folderName ?? '', ORG_FOLDER_MAX_LENGTH)
    if (folderName !== null) {
      const bad = blockedName(wanted)
      if (bad) return { ok: false, reason: bad }
    }
    try {
      let groupId: string | null = null
      if (wanted) {
        const hit = get().folders.find((f) => f.name === wanted)
        groupId = hit?.id ?? null
        if (!groupId) {
          const created = unwrap(await createConversationGroup(wanted))
          if (!created.ok) return { ok: false, reason: created.reason }
          groupId = created.data.group.id
        }
      }
      const moved = unwrap(await moveConversationsToGroup([conversationId], groupId))
      if (!moved.ok) return { ok: false, reason: moved.reason }
      if (moved.data.affected === 0) {
        // 请求发了、库里没命中 —— 这不是成功。回 not-found 让调用方回滚乐观值。
        return { ok: false, reason: 'not-found' }
      }
      set((s) => ({ membership: { ...s.membership, [conversationId]: groupId } }))
      await get().reloadFolders(userId)
      return { ok: true }
    } catch (e) {
      return { ok: false, reason: classifyThrow(e) }
    }
  },

  async assignMany(userId, conversationIds, folderId) {
    const ids = [...new Set(conversationIds.filter(Boolean))]
    if (ids.length === 0) return { ok: true, affected: 0, missedIds: [] }
    try {
      const moved = unwrap(await moveConversationsToGroup(ids, folderId))
      if (!moved.ok) return { ok: false, reason: moved.reason }
      set((s) => {
        const next = { ...s.membership }
        // 命中集合 = 请求集 − 库侧没命中的那些。服务端回的 requested 是**计数**而不是 id 清单,
        // 所以用本地已去重的 ids 做差,而不是把计数当数组遍历(上一版写了 moved.requestedIds,
        // 运行时是 undefined ⇒ 整个写被自己的 catch 判成失败)。
        for (const id of ids) if (!moved.data.missedIds.includes(id)) next[id] = folderId
        return { membership: next }
      })
      await get().reloadFolders(userId)
      return { ok: true, affected: moved.data.affected, missedIds: moved.data.missedIds }
    } catch (e) {
      return { ok: false, reason: classifyThrow(e) }
    }
  },

  async renameFolder(userId, folderId, name) {
    const wanted = normalizeOrgName(name, ORG_FOLDER_MAX_LENGTH)
    const bad = blockedName(wanted)
    if (bad) return { ok: false, reason: bad }
    try {
      const r = unwrap(await updateConversationGroup(folderId, { name: wanted }))
      if (!r.ok) return r
      await get().reloadFolders(userId)
      return { ok: true }
    } catch (e) {
      return { ok: false, reason: classifyThrow(e) }
    }
  },

  async togglePinFolder(userId, folderId) {
    const current = get().folders.find((f) => f.id === folderId)
    if (!current) return { ok: false, reason: 'not-found' }
    try {
      const r = unwrap(await updateConversationGroup(folderId, { pinned: !current.pinned }))
      if (!r.ok) return r
      await get().reloadFolders(userId)
      return { ok: true }
    } catch (e) {
      return { ok: false, reason: classifyThrow(e) }
    }
  },

  async deleteFolder(userId, folderId) {
    try {
      const r = unwrap(await deleteConversationGroup(folderId))
      if (!r.ok) return r
      // 删除成功后本地立刻把该组的会话退回"未分组",不等下一次读回(那会让界面停在已消失的组上)。
      set((s) => {
        const next: Record<string, string | null> = {}
        for (const [cid, gid] of Object.entries(s.membership)) if (gid !== folderId) next[cid] = gid
        return { membership: next }
      })
      await get().reloadFolders(userId)
      return { ok: true }
    } catch (e) {
      return { ok: false, reason: classifyThrow(e) }
    }
  },
}))

/** 分组名列表(供文件夹筛选器/联想用)。未 ready 时回稳定空数组。 */
export function useOrgFolderNames(): string[] {
  const ready = useOrgServerStore((s) => s.ready)
  const folders = useOrgServerStore((s) => s.folders)
  return ready ? folders.map((f) => f.name) : []
}

/** groupId → 分组名;调用方拿 membership 里的 id 还原成名字。 */
export function folderNameById(
  folders: ConversationFolder[],
  groupId: string | null,
): string | null {
  if (!groupId) return null
  return folders.find((f) => f.id === groupId)?.name ?? null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
