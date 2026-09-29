// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话列表权威 membership 读取 + 版本化 in-flight promise 缓存(2026-09-30 立,吸收批 74 W5)。
 *
 * 机制(以我方中性语义重述:会话/工作区/运行记录):
 *  1. 持久索引的三个分区(active/pinned/archived)的**完整会话行并集**做左表——
 *     不能只保留 membership 集合丢 meta,否则列表只能反向枚举行、已读到的标题/状态全丢。
 *  2. unreadAt / terminalStatus / titleOverride 是平行 map,列表构建时 join;
 *     它们与 pin/archive 同属组织态,不进冻结的会话索引 schema。
 *  3. 任一核心分区 RPC 失败必须**抛错保留旧视图**(不能当作权威空集发布清空缓存);
 *     辅助集合(置顶 id / 删除 tombstone)失败按空集降级——pinned 行本身也是 membership 证据。
 *  4. membership 与内容帧解耦:只随归属 mutation(membershipVersion bump)重拉,
 *     标题/状态等内容帧不触发 membership 重拉。
 *  5. in-flight promise 按「membershipVersion + endpoints 签名 + service 身份」缓存:
 *     service 实例用 WeakMap 编号进 key(测试 mock、重连后的新 proxy 不得共享缓存);
 *     缓存有界 8 条按插入序淘汰;失败不缓存(防一次短暂 RPC 异常被当前版本粘住)。
 */

/** 会话状态(中性)。终态 = completed | error。 */
export type MembershipSessionStatus = 'draft' | 'running' | 'completed' | 'error'

export interface MembershipSessionRow {
  sessionId: string
  workspacePath: string
  workspaceIdentity?: string
  title: string
  titleOverridden?: boolean
  unreadAt?: number
  status?: MembershipSessionStatus
}

export interface MembershipScope {
  workspacePath: string
  workspaceIdentity?: string
}

/** service 形态:与持久索引存储的 RPC 面对面;测试用 mock 注入。 */
export interface MembershipService {
  listPinnedSessionIds(): Promise<string[]>
  listArchivedSessions(scope: MembershipScope): Promise<MembershipSessionRow[]>
  listSessions(scope: MembershipScope): Promise<MembershipSessionRow[]>
  listPinnedSessions(scope: MembershipScope): Promise<MembershipSessionRow[]>
  listDeletedSessionIds?(scope: MembershipScope): Promise<string[]>
}

export interface MembershipSets {
  /** 三个持久分区(active/pinned/archived)的完整会话行并集(左表)。 */
  sessionIndexItems: MembershipSessionRow[]
  pinnedIds: Set<string>
  archivedIds: Set<string>
  /** 持久删除 tombstone;优先于所有列表 kind。 */
  deletedIds: Set<string>
  /** sessionId → unreadAt(组织态;join 用)。 */
  unreadAtBySessionId: Map<string, number>
  /** sessionId → 历史终态(冷启动补红点用)。 */
  terminalStatusBySessionId: Map<string, 'completed' | 'error'>
  /** sessionId → 用户手动改写过的标题(老索引数据;join 用)。 */
  titleOverrideBySessionId: Map<string, string>
}

export interface MembershipEndpoint {
  service: MembershipService
  scopes: MembershipScope[]
}

/** 工作区身份键:优先用 identity(同路径本地/多端并存时不串),缺省回退路径。 */
export function buildMembershipWorkspaceKey(
  workspacePath: string,
  workspaceIdentity?: string,
): string {
  const identity = workspaceIdentity?.trim()
  return identity ? identity : workspacePath
}

/** 实体键 = 工作区键::sessionId,跨 endpoint 合并时的去重键。 */
export function buildMembershipEntityKey(row: {
  workspacePath: string
  workspaceIdentity?: string
  sessionId: string
}): string {
  return `${buildMembershipWorkspaceKey(row.workspacePath, row.workspaceIdentity)}::${row.sessionId}`
}

/** 可选辅助集合读取失败时按空集降级。 */
async function listOrEmpty<T>(list: () => Promise<T[]>): Promise<T[]> {
  try {
    return await list()
  } catch {
    return []
  }
}

/** 核心分区读取:失败不能吞,调用方据此保留旧视图。 */
async function listWithAvailability<T>(
  list: () => Promise<T[]>,
): Promise<{ items: T[]; available: boolean }> {
  try {
    return { items: await list(), available: true }
  } catch {
    return { items: [], available: false }
  }
}

function collectUnreadAt(map: Map<string, number>, rows: MembershipSessionRow[]): void {
  for (const row of rows) {
    if (typeof row.unreadAt === 'number') {
      map.set(row.sessionId, row.unreadAt)
    }
  }
}

function collectTerminalStatuses(
  map: Map<string, 'completed' | 'error'>,
  rows: MembershipSessionRow[],
): void {
  for (const row of rows) {
    if (row.status === 'completed' || row.status === 'error') {
      map.set(row.sessionId, row.status)
    }
  }
}

function collectTitleOverrides(map: Map<string, string>, rows: MembershipSessionRow[]): void {
  for (const row of rows) {
    if (row.titleOverridden === true && row.title.trim().length > 0) {
      map.set(row.sessionId, row.title)
    }
  }
}

function mergeRows(lists: MembershipSessionRow[][]): MembershipSessionRow[] {
  const rowByEntityKey = new Map<string, MembershipSessionRow>()
  for (const row of lists.flat()) {
    rowByEntityKey.set(buildMembershipEntityKey(row), row)
  }
  return [...rowByEntityKey.values()]
}

/** 拉取单个 service 下的权威会话行、pinned/archived 归属与平行元数据。 */
export async function fetchMembershipSets(params: {
  service: MembershipService
  scopes: MembershipScope[]
}): Promise<MembershipSets> {
  const [pinnedIdList, archivedResults, activeResults, pinnedRowResults, deletedIdLists] =
    await Promise.all([
      // 置顶 id 是辅助集合:短暂失败按空集降级,不阻塞整轮。
      listOrEmpty(() => params.service.listPinnedSessionIds()),
      Promise.all(
        params.scopes.map((scope) =>
          listWithAvailability(() => params.service.listArchivedSessions(scope)),
        ),
      ),
      Promise.all(
        params.scopes.map((scope) => listWithAvailability(() => params.service.listSessions(scope))),
      ),
      Promise.all(
        params.scopes.map((scope) =>
          listWithAvailability(() => params.service.listPinnedSessions(scope)),
        ),
      ),
      Promise.all(
        params.scopes.map((scope) =>
          params.service.listDeletedSessionIds
            ? listOrEmpty(() => params.service.listDeletedSessionIds!(scope))
            : Promise.resolve([] as string[]),
        ),
      ),
    ])
  // 任一核心分区读取不完整都不能发布:发布权威空集等于把调用方旧缓存整组清空。
  // 这里抛错,由调用方保留旧视图等待下一轮。
  if (
    activeResults.some((result) => !result.available) ||
    archivedResults.some((result) => !result.available) ||
    pinnedRowResults.some((result) => !result.available)
  ) {
    throw new Error('会话索引行读取不完整')
  }
  const archivedLists = archivedResults.map((result) => result.items)
  const activeLists = activeResults.map((result) => result.items)
  const pinnedRowLists = pinnedRowResults.map((result) => result.items)
  const unreadAtBySessionId = new Map<string, number>()
  const terminalStatusBySessionId = new Map<string, 'completed' | 'error'>()
  const titleOverrideBySessionId = new Map<string, string>()
  // unread 覆盖三类成员:active(listSessions = 非 pinned 非 archived)、pinned、archived。
  collectUnreadAt(unreadAtBySessionId, archivedLists.flat())
  collectUnreadAt(unreadAtBySessionId, activeLists.flat())
  collectUnreadAt(unreadAtBySessionId, pinnedRowLists.flat())
  collectTerminalStatuses(terminalStatusBySessionId, archivedLists.flat())
  collectTerminalStatuses(terminalStatusBySessionId, activeLists.flat())
  collectTerminalStatuses(terminalStatusBySessionId, pinnedRowLists.flat())
  collectTitleOverrides(titleOverrideBySessionId, archivedLists.flat())
  collectTitleOverrides(titleOverrideBySessionId, activeLists.flat())
  collectTitleOverrides(titleOverrideBySessionId, pinnedRowLists.flat())
  return {
    // 持久行存在性必须由索引决定:左表要保留已读到的完整 meta。
    sessionIndexItems: mergeRows([activeLists.flat(), pinnedRowLists.flat(), archivedLists.flat()]),
    // pinned 行本身也是 membership 证据:即使辅助 id RPC 短暂失败,
    // 已成功读到的 pinned 行也不能被误分到 timeline。
    pinnedIds: new Set([...pinnedIdList, ...pinnedRowLists.flat().map((row) => row.sessionId)]),
    archivedIds: new Set(archivedLists.flat().map((row) => row.sessionId)),
    deletedIds: new Set(deletedIdLists.flat()),
    unreadAtBySessionId,
    terminalStatusBySessionId,
    titleOverrideBySessionId,
  }
}

/** 按 endpoint 并行拉取归属并求并集(sessionId 跨 endpoint 不冲突,按实体键去重)。 */
export async function fetchMembershipSetsForEndpoints(
  endpoints: MembershipEndpoint[],
): Promise<MembershipSets> {
  const results = await Promise.all(
    endpoints
      .filter((endpoint) => endpoint.scopes.length > 0)
      .map((endpoint) =>
        fetchMembershipSets({ service: endpoint.service, scopes: endpoint.scopes }),
      ),
  )
  const merged: MembershipSets = {
    sessionIndexItems: [],
    pinnedIds: new Set<string>(),
    archivedIds: new Set<string>(),
    deletedIds: new Set<string>(),
    unreadAtBySessionId: new Map<string, number>(),
    terminalStatusBySessionId: new Map<string, 'completed' | 'error'>(),
    titleOverrideBySessionId: new Map<string, string>(),
  }
  const rowByEntityKey = new Map<string, MembershipSessionRow>()
  for (const result of results) {
    for (const row of result.sessionIndexItems) {
      rowByEntityKey.set(buildMembershipEntityKey(row), row)
    }
    for (const sessionId of result.pinnedIds) merged.pinnedIds.add(sessionId)
    for (const sessionId of result.archivedIds) merged.archivedIds.add(sessionId)
    for (const sessionId of result.deletedIds) merged.deletedIds.add(sessionId)
    for (const [sessionId, unreadAt] of result.unreadAtBySessionId) {
      merged.unreadAtBySessionId.set(sessionId, unreadAt)
    }
    for (const [sessionId, status] of result.terminalStatusBySessionId) {
      merged.terminalStatusBySessionId.set(sessionId, status)
    }
    for (const [sessionId, title] of result.titleOverrideBySessionId) {
      merged.titleOverrideBySessionId.set(sessionId, title)
    }
  }
  merged.sessionIndexItems = [...rowByEntityKey.values()]
  return merged
}

// membership 与内容帧解耦:membership 只随归属 mutation 变化(membershipVersion bump),
// 与内容帧(标题/状态/活跃时间)无关——否则一次标题变更让所有列表实例各发一轮
// 1+3×scopes 的 RPC。这里按「membershipVersion + endpoints 签名 + service 身份」缓存
// in-flight promise,跨列表实例共享;版本 bump 或 endpoint 拓扑变化自然换 key 重拉。
const membershipPromiseByCacheKey = new Map<string, Promise<MembershipSets>>()
/** 缓存上限:超出按插入序淘汰最旧,防历史版本堆积。 */
const MEMBERSHIP_CACHE_MAX_KEYS = 8
// service 实例身份进 key:不同 endpoint service(含测试 mock、重连后的新 proxy)不得共享缓存。
const membershipServiceIds = new WeakMap<MembershipService, number>()
let nextMembershipServiceId = 1

function membershipServiceIdOf(service: MembershipService): number {
  let id = membershipServiceIds.get(service)
  if (id === undefined) {
    id = nextMembershipServiceId++
    membershipServiceIds.set(service, id)
  }
  return id
}

/**
 * 版本化缓存入口。`cacheKey` 建议形态:`${membershipVersion}::${endpoints 签名}`;
 * service 身份(WeakMap 编号)由这里自动追加,调用方无需关心。
 */
export function fetchMembershipSetsCached(params: {
  cacheKey: string
  endpoints: MembershipEndpoint[]
}): Promise<MembershipSets> {
  const fullCacheKey = `${params.cacheKey}::svc=${params.endpoints
    .map((endpoint) => membershipServiceIdOf(endpoint.service))
    .join(',')}`
  const cached = membershipPromiseByCacheKey.get(fullCacheKey)
  if (cached) {
    return cached
  }
  const promise = fetchMembershipSetsForEndpoints(params.endpoints)
  membershipPromiseByCacheKey.set(fullCacheKey, promise)
  // 辅助集合可按空集降级,但核心分区读取不完整会 reject;失败不缓存,
  // 避免一次短暂 RPC 异常被当前版本粘住。
  promise.catch(() => {
    membershipPromiseByCacheKey.delete(fullCacheKey)
  })
  while (membershipPromiseByCacheKey.size > MEMBERSHIP_CACHE_MAX_KEYS) {
    const oldestKey = membershipPromiseByCacheKey.keys().next().value
    if (oldestKey === undefined) {
      break
    }
    membershipPromiseByCacheKey.delete(oldestKey)
  }
  return promise
}

/** 测试/异常恢复用:清空 membership 缓存。 */
export function resetMembershipCacheForTests(): void {
  membershipPromiseByCacheKey.clear()
}
