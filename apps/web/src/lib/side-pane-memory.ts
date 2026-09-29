// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 辅助工作区(侧栏面板)状态记忆 —— 按 workspace 键控 + LRU 上限(2026-09-30 立,吸收批 74 W5)。
 *
 * 机制(中性语义重述:会话/工作区/运行记录):
 *  1. 记忆键只按**工作区身份**隔离、刻意不含会话 id——辅助面板的语义是
 *     "当前工作区右侧的辅助工作区",不是会话私有上下文。把会话 id 拼进键之后,
 *     同一工作区下切换会话会命中一份全新记忆,用户正在看的浏览/代码/变更视图
 *     像是被"切会话顺手清空"。
 *  2. 渲染层模块级 Map 用 LRU 50 防长会话无界增长:旧键持有 tabs、浏览地址、
 *     diff 补丁等状态,永不淘汰会持续膨胀;LRU 保留最近访问的工作区。
 *  3. 对话级折叠偏好按 owner 会话分桶 + `__draft__` 兜底(草稿态没有会话 id);
 *     tabs 本身仍按工作区复用。
 *  4. 读取时旧字段 normalize 兼容:旧版单地址字段迁移进地址表,未知键丢弃,
 *     缺失字段回落默认,防旧内存形状污染新链路。
 */

/** 辅助面板记忆状态(每个工作区一份)。 */
export interface SidePaneMemoryState {
  /** 面板 tab 结构等自由状态(键控为工作区,跨会话复用)。 */
  paneState: Record<string, unknown> | null
  isPaneCollapsed: boolean
  /** 对话级展开/收起偏好;按 owner 会话分桶,草稿归 `__draft__`。 */
  collapsedByOwner: Record<string, boolean>
  /** 浏览器面板地址表(面板 id → URL)。 */
  viewerUrls: Record<string, string>
}

/** LRU 上限:长会话切大量工作区时旧键不能无界持有状态。 */
const SIDE_PANE_MEMORY_MAX_ENTRIES = 50

/** 草稿态(无 owner 会话)的折叠偏好桶。 */
const DRAFT_SIDE_PANE_OWNER_KEY = '__draft__'

const sidePaneMemory = new Map<string, SidePaneMemoryState>()

/** 面板 id 的归一地址键:旧版单地址迁移的落点。 */
const LEGACY_VIEWER_URL_KEY = 'primary'

function freshDefaultState(): SidePaneMemoryState {
  return {
    paneState: null,
    isPaneCollapsed: true,
    collapsedByOwner: {},
    viewerUrls: {},
  }
}

function normalizeRecordString(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) {
    return {}
  }
  const out: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'string') {
      out[key] = entry
    }
  }
  return out
}

function normalizeRecordBoolean(value: unknown): Record<string, boolean> {
  if (typeof value !== 'object' || value === null) {
    return {}
  }
  const out: Record<string, boolean> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'boolean') {
      out[key] = entry
    }
  }
  return out
}

/**
 * 读取时旧字段 normalize 兼容:
 *  - 旧版单地址字段 `viewerUrl` 迁移进 `viewerUrls.primary`(表为空时);
 *  - 未知键丢弃、类型不符回落默认,防旧内存形状污染新链路。
 */
export function normalizeSidePaneMemoryState(raw: unknown): SidePaneMemoryState {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const viewerUrls = normalizeRecordString(source.viewerUrls)
  const legacyViewerUrl = source.viewerUrl
  if (Object.keys(viewerUrls).length === 0 && typeof legacyViewerUrl === 'string' && legacyViewerUrl) {
    viewerUrls[LEGACY_VIEWER_URL_KEY] = legacyViewerUrl
  }
  return {
    paneState:
      typeof source.paneState === 'object' && source.paneState !== null
        ? (source.paneState as Record<string, unknown>)
        : null,
    isPaneCollapsed:
      typeof source.isPaneCollapsed === 'boolean' ? source.isPaneCollapsed : true,
    collapsedByOwner: normalizeRecordBoolean(source.collapsedByOwner),
    viewerUrls,
  }
}

/**
 * 记忆键:只按工作区身份隔离。
 * `sessionId` 参数刻意忽略(签名保留它以显式表达"切会话不清空"的语义):
 * 之前把会话 id 拼进键,同工作区切会话命中全新记忆,用户正在看的内容像被清空。
 */
export function buildSidePaneMemoryKey({
  workspacePath,
  workspaceIdentity,
  sessionId,
}: {
  workspacePath: string
  workspaceIdentity?: string
  sessionId: string | null
}): string | null {
  void sessionId
  const workspaceKey = workspaceIdentity?.trim() || workspacePath
  return workspaceKey.trim() ? workspaceKey : null
}

function touchMemoryEntry(key: string, state: SidePaneMemoryState): SidePaneMemoryState {
  // 先删后插维护 LRU 访问序:最近读写的键沉到 Map 尾部。
  sidePaneMemory.delete(key)
  sidePaneMemory.set(key, state)
  return state
}

function pruneMemory(): void {
  while (sidePaneMemory.size > SIDE_PANE_MEMORY_MAX_ENTRIES) {
    const oldestKey = sidePaneMemory.keys().next().value
    if (oldestKey === undefined) {
      return
    }
    sidePaneMemory.delete(oldestKey)
  }
}

/** 读记忆:无键/未命中返回全新默认;命中走 normalize + LRU touch。 */
export function readSidePaneMemoryState(key: string | null): SidePaneMemoryState {
  if (!key) {
    return freshDefaultState()
  }
  const state = sidePaneMemory.get(key)
  if (!state) {
    return freshDefaultState()
  }
  return touchMemoryEntry(key, normalizeSidePaneMemoryState(state))
}

/** 写记忆:与既有状态浅合并后 normalize,再 touch + LRU 裁剪。 */
export function saveSidePaneMemoryState(
  key: string | null,
  patch: Partial<SidePaneMemoryState>,
): void {
  if (!key) {
    return
  }
  const existing = sidePaneMemory.get(key)
  touchMemoryEntry(
    key,
    normalizeSidePaneMemoryState({
      ...freshDefaultState(),
      ...existing,
      ...patch,
      collapsedByOwner: {
        ...existing?.collapsedByOwner,
        ...patch.collapsedByOwner,
      },
      viewerUrls: {
        ...existing?.viewerUrls,
        ...patch.viewerUrls,
      },
    }),
  )
  pruneMemory()
}

/** 读对话级折叠偏好:owner 缺省归一 `__draft__` 桶。 */
export function getSidePaneCollapsedPreference(
  state: SidePaneMemoryState,
  ownerSessionId: string | null | undefined,
): boolean | undefined {
  return state.collapsedByOwner[ownerSessionId ?? DRAFT_SIDE_PANE_OWNER_KEY]
}

/** 写对话级折叠偏好:按 owner 会话分桶,同工作区跨会话互不影响。 */
export function saveSidePaneCollapsedPreference(
  key: string | null,
  ownerSessionId: string | null | undefined,
  isPaneCollapsed: boolean,
): void {
  if (!key) {
    return
  }
  const state = readSidePaneMemoryState(key)
  const ownerKey = ownerSessionId ?? DRAFT_SIDE_PANE_OWNER_KEY
  saveSidePaneMemoryState(key, {
    isPaneCollapsed,
    collapsedByOwner: {
      ...state.collapsedByOwner,
      [ownerKey]: isPaneCollapsed,
    },
  })
}

/** 草稿桶键(导出供测试断言)。 */
export const SIDE_PANE_DRAFT_OWNER_KEY = DRAFT_SIDE_PANE_OWNER_KEY

/** 测试用:注入旧版/异形原始状态,验证读取 normalize。 */
export function setSidePaneMemoryRawForTests(key: string, raw: unknown): void {
  sidePaneMemory.set(key, raw as SidePaneMemoryState)
}

/** 测试用:当前 Map 尺寸(LRU 上限断言)。 */
export function getSidePaneMemorySizeForTests(): number {
  return sidePaneMemory.size
}

/** 测试用:按插入序取最旧键(LRU 逐出断言)。 */
export function getSidePaneMemoryOldestKeyForTests(): string | null {
  return sidePaneMemory.keys().next().value ?? null
}

/** 测试用:清空模块级记忆,保证用例隔离。 */
export function resetSidePaneMemoryForTests(): void {
  sidePaneMemory.clear()
}
