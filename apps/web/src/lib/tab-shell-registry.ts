// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 辅助面板 tab 结构化注册表(2026-09-30 立,吸收批 74 W5;票 G-977992 + G-977993)。
 *
 * 机制(中性语义重述:会话/工作区/运行记录):
 *
 * 【复合 id + 类型分层可见性 + 归属 stamping】
 *  1. tab id 由 `type:encodeURIComponent(workspaceKey):parentId:runId...` 各身份段复合:
 *     同一目标在同一工作区/会话下永远是同一个 tab,重复打开幂等聚焦且更新字段;
 *     tab 可先于实体存在(未启动的运行槽位先开 tab,实体起来后面板自愈)。
 *  2. 产物(artifact)tab id **不含 version**:同一产物的 v1 与 v2 是同一件东西的两个时刻,
 *     再次点击只该聚焦同一个 tab 并翻到最新版,不该并排开两个;合并时版本缺席即显式删键
 *     ("缺席真的是缺席",否则 chip 不带版本号永远回不到最新版)。
 *  3. 可见性按 tab 类型分层:工作区全局型全工作区可见;浏览型按所属会话;
 *     子会话/输出型按根会话;运行/产物型按父会话;其余按 owner 会话(草稿归一 "__draft__")。
 *  4. 归属 stamping:tab 提交到共享面板状态时**只为无主 tab 冻结归属**
 *     (已有主不覆盖)——事件自带归属的 tab 绝不能被当前 UI 作用域改写。
 *
 * 【visibility 事件只选择不创建 + generation 单调防僵尸】
 *  5. 迟到的 visible=true 是**选择信号**:只能命中现存且作用域/generation 完全一致的 shell,
 *     绝不重建已关闭的 tab——僵尸 shell 没有 main 权威,之后点关闭必然失败。
 *  6. residency 事件 generation **单调**:旧代际事件忽略,防 stale 串写新状态。
 *  7. ready/show 只激活 origin 工作区+会话一致的 shell:后台工作区的 ready 不抢当前焦点。
 */

/** tab 类型(中性:工作区工具/浏览/子会话/运行记录/产物)。 */
export type SidePaneTabType = 'workspace-tools' | 'browser' | 'assistant' | 'run' | 'artifact'

export interface SidePaneTabBase {
  id: string
  type: SidePaneTabType
  openedAt: number
  workspaceKey: string
  /** 归属会话;undefined 表示尚未 stamp(无主),null 表示显式无主(草稿)。 */
  ownerSessionId?: string | null
  title?: string
}

export interface WorkspaceToolsTab extends SidePaneTabBase {
  type: 'workspace-tools'
}

export interface BrowserTab extends SidePaneTabBase {
  type: 'browser'
  /** 浏览 tab 的可见性 scope = 所属会话。 */
  sessionId: string
}

export interface AssistantTab extends SidePaneTabBase {
  type: 'assistant'
  rootSessionId: string
  childSessionId: string
}

export interface RunTab extends SidePaneTabBase {
  type: 'run'
  parentSessionId: string
  runId: string
}

export interface ArtifactTab extends SidePaneTabBase {
  type: 'artifact'
  parentSessionId: string
  runId: string
  artifactId: string
  /** 产物版本;**不进 id**。缺席 = 回到最新版。 */
  version?: number
}

export type SidePaneTab = WorkspaceToolsTab | BrowserTab | AssistantTab | RunTab | ArtifactTab

export interface SidePaneState {
  tabs: SidePaneTab[]
  activeTabId: string | null
}

/* ---------------------------------- 复合 id ---------------------------------- */

/** 身份段编码:各段可能含 ":" 等分隔符,统一 encodeURIComponent 后再拼。 */
export function encodeSidePaneTabIdPart(part: string): string {
  return encodeURIComponent(part)
}

export function buildWorkspaceToolsTabId(workspaceKey: string): string {
  return ['workspace-tools', encodeSidePaneTabIdPart(workspaceKey)].join(':')
}

export function buildBrowserTabId(params: { workspaceKey: string; sessionId: string }): string {
  return ['browser', encodeSidePaneTabIdPart(params.workspaceKey), encodeSidePaneTabIdPart(params.sessionId)].join(':')
}

export function buildAssistantTabId(params: {
  workspaceKey: string
  rootSessionId: string
  childSessionId: string
}): string {
  return [
    'assistant',
    encodeSidePaneTabIdPart(params.workspaceKey),
    encodeSidePaneTabIdPart(params.rootSessionId),
    encodeSidePaneTabIdPart(params.childSessionId),
  ].join(':')
}

export function buildRunTabId(params: {
  workspaceKey: string
  parentSessionId: string
  runId: string
}): string {
  return [
    'run',
    encodeSidePaneTabIdPart(params.workspaceKey),
    encodeSidePaneTabIdPart(params.parentSessionId),
    encodeSidePaneTabIdPart(params.runId),
  ].join(':')
}

/**
 * 产物 tab id:**不含 version**。同一产物的 v1 与 v2 是同一件东西的两个时刻,
 * 再次点击只聚焦并翻最新版,不并排开两个。
 */
export function buildArtifactTabId(params: {
  workspaceKey: string
  parentSessionId: string
  runId: string
  artifactId: string
}): string {
  return [
    'artifact',
    encodeSidePaneTabIdPart(params.workspaceKey),
    encodeSidePaneTabIdPart(params.parentSessionId),
    encodeSidePaneTabIdPart(params.runId),
    encodeSidePaneTabIdPart(params.artifactId),
  ].join(':')
}

/** 解析复合 id:首段为 type,其余段逐个 decode;解析失败返回 null(不猜)。 */
export function parseSidePaneTabId(
  id: string,
): { type: string; parts: string[] } | null {
  const segments = id.split(':')
  if (segments.length < 2) {
    return null
  }
  try {
    return { type: segments[0]!, parts: segments.slice(1).map((part) => decodeURIComponent(part)) }
  } catch {
    return null
  }
}

/* ---------------------------------- 打开/合并 ---------------------------------- */

function activateTab(current: SidePaneState | null, tab: SidePaneTab): SidePaneState {
  if (!current) {
    return { tabs: [tab], activeTabId: tab.id }
  }
  const existingIndex = current.tabs.findIndex((tab0) => tab0.id === tab.id)
  if (existingIndex >= 0) {
    const nextTabs = [...current.tabs]
    nextTabs[existingIndex] = tab
    return { tabs: nextTabs, activeTabId: tab.id }
  }
  return { tabs: [...current.tabs, tab], activeTabId: tab.id }
}

/**
 * 幂等打开:同 id 已存在则原位替换(更新字段)并聚焦;不存在则追加并聚焦。
 * tab 可以先于实体存在——同一身份段复合出的 id 稳定,后续打开自然落回同一个 tab。
 */
export function openSidePaneTab(state: SidePaneState | null, tab: SidePaneTab): SidePaneState {
  return activateTab(state, tab)
}

/**
 * 产物 tab 打开:同 id 合并时**丢掉旧 tab 上的 version**——
 * `...nextTab` 里缺席的键不会覆盖旧值,而那正好是"chip 不带版本号 ⇒ 回到最新版"
 * 这条语义会被悄悄破坏的地方。显式删键,让缺席真的是缺席。
 */
export function openArtifactSidePaneTab(
  state: SidePaneState | null,
  nextTab: ArtifactTab,
): SidePaneState {
  const existing = state?.tabs.find((tab) => tab.id === nextTab.id)
  if (!existing) {
    return activateTab(state, nextTab)
  }
  const merged: ArtifactTab = { ...existing, ...nextTab }
  if (nextTab.version === undefined) {
    delete merged.version
  }
  return activateTab(state, merged)
}

/* ------------------------------- tab 构建(中性) ------------------------------- */

function tabBase(params: { type: SidePaneTabType; id: string; workspaceKey: string; title?: string }): SidePaneTabBase {
  return {
    id: params.id,
    type: params.type,
    openedAt: Date.now(),
    workspaceKey: params.workspaceKey,
    ...(params.title ? { title: params.title } : {}),
  }
}

export function createWorkspaceToolsTab(params: { workspaceKey: string; title?: string }): WorkspaceToolsTab {
  return { ...tabBase({ type: 'workspace-tools', id: buildWorkspaceToolsTabId(params.workspaceKey), workspaceKey: params.workspaceKey, title: params.title }), type: 'workspace-tools' }
}

export function createBrowserTab(params: { workspaceKey: string; sessionId: string; title?: string }): BrowserTab {
  return {
    ...tabBase({ type: 'browser', id: buildBrowserTabId(params), workspaceKey: params.workspaceKey, title: params.title }),
    type: 'browser',
    sessionId: params.sessionId,
  }
}

export function createAssistantTab(params: {
  workspaceKey: string
  rootSessionId: string
  childSessionId: string
  title?: string
}): AssistantTab {
  return {
    ...tabBase({ type: 'assistant', id: buildAssistantTabId(params), workspaceKey: params.workspaceKey, title: params.title }),
    type: 'assistant',
    rootSessionId: params.rootSessionId,
    childSessionId: params.childSessionId,
  }
}

export function createRunTab(params: {
  workspaceKey: string
  parentSessionId: string
  runId: string
  title?: string
}): RunTab {
  return {
    ...tabBase({ type: 'run', id: buildRunTabId(params), workspaceKey: params.workspaceKey, title: params.title }),
    type: 'run',
    parentSessionId: params.parentSessionId,
    runId: params.runId,
  }
}

export function createArtifactTab(params: {
  workspaceKey: string
  parentSessionId: string
  runId: string
  artifactId: string
  version?: number
  title?: string
}): ArtifactTab {
  return {
    ...tabBase({ type: 'artifact', id: buildArtifactTabId(params), workspaceKey: params.workspaceKey, title: params.title }),
    type: 'artifact',
    parentSessionId: params.parentSessionId,
    runId: params.runId,
    artifactId: params.artifactId,
    ...(params.version === undefined ? {} : { version: params.version }),
  }
}

/* ------------------------------ 可见性 scope 分层 ------------------------------ */

/** 草稿态(null/undefined 会话)归一,供按会话隔离的可见性判定。 */
export function sidePaneOwnerKey(sessionId: string | null | undefined): string {
  return sessionId ?? '__draft__'
}

/** 工作区全局型 tab:整个工作区共享,不随会话切换消失。 */
const WORKSPACE_GLOBAL_SIDE_PANE_TAB_TYPES = new Set<SidePaneTabType>(['workspace-tools'])

export interface SidePaneVisibilityScope {
  workspaceKey: string | null
  /** 当前激活会话(草稿为 null)。 */
  activeSessionId: string | null
}

export function isTabVisibleForScope(tab: SidePaneTab, scope: SidePaneVisibilityScope): boolean {
  // 工作区不匹配一票否远(身份键比路径严格,防多端同路径串面板)。
  if (tab.workspaceKey !== scope.workspaceKey) {
    return false
  }
  if (WORKSPACE_GLOBAL_SIDE_PANE_TAB_TYPES.has(tab.type)) {
    return true
  }
  if (tab.type === 'browser') {
    // 浏览 tab 按所属会话收窄
    return tab.sessionId === scope.activeSessionId
  }
  if (tab.type === 'assistant') {
    // 子会话/目录类按根会话收窄
    return tab.rootSessionId === scope.activeSessionId
  }
  if (tab.type === 'run' || tab.type === 'artifact') {
    // 运行/产物类按父会话收窄
    return tab.parentSessionId === scope.activeSessionId
  }
  return sidePaneOwnerKey(tab.ownerSessionId) === sidePaneOwnerKey(scope.activeSessionId)
}

export function getVisibleSidePaneTabs(
  tabs: SidePaneTab[],
  scope: SidePaneVisibilityScope,
): SidePaneTab[] {
  return tabs.filter((tab) => isTabVisibleForScope(tab, scope))
}

/* --------------------------------- 归属 stamping -------------------------------- */

/**
 * tab 提交到共享面板状态时统一冻结归属。**只为无主 tab(ownerSessionId === undefined)
 * 冻结**:事件自带归属的已打标 tab 绝不能被当前 UI 作用域覆盖,否则 scope 判定错乱。
 */
export function stampSidePaneTabsOwnership(
  state: SidePaneState | null,
  ownership: {
    ownerSessionId: string | null
    workspaceKey?: string | null
  },
): SidePaneState | null {
  if (!state) {
    return state
  }
  let changed = false
  const tabs = state.tabs.map((tab) => {
    if (tab.ownerSessionId !== undefined) {
      return tab
    }
    changed = true
    return {
      ...tab,
      ownerSessionId: ownership.ownerSessionId,
      ...(ownership.workspaceKey && !tab.workspaceKey ? { workspaceKey: ownership.workspaceKey } : {}),
    } as SidePaneTab
  })
  return changed ? { ...state, tabs } : state
}

/* -------------------- shell 注册表:visibility 只选择不创建(票 7) -------------------- */

export type TabShellResidency = 'live-visible' | 'live-background' | 'suspended' | 'restoring'

export interface TabShellRecord {
  tabId: string
  type: SidePaneTabType
  workspaceKey: string
  sessionId?: string
  /** main 权威代际:ready/创建入口递增;visibility 事件必须精确匹配。 */
  generation: number
  residency?: TabShellResidency
  /** residency 代际:单调防 stale 串写。 */
  residencyGeneration?: number
}

export interface TabShellRegistryState {
  shells: TabShellRecord[]
  activeTabId: string | null
}

export interface TabShellActiveScope {
  workspaceKey: string
  sessionId: string | null
}

export interface TabShellEvent {
  tabId: string
  type: SidePaneTabType
  workspaceKey: string
  sessionId?: string
  generation: number
  residency?: TabShellResidency
}

function createEmptyShellRegistryState(): TabShellRegistryState {
  return { shells: [], activeTabId: null }
}

function shellMatchesOrigin(shell: TabShellRecord, event: TabShellEvent): boolean {
  return (
    shell.workspaceKey === event.workspaceKey &&
    (shell.sessionId ?? '') === (event.sessionId ?? '')
  )
}

function shellOriginMatchesScope(shell: TabShellRecord, scope: TabShellActiveScope): boolean {
  return shell.workspaceKey === scope.workspaceKey && (shell.sessionId ?? '') === (scope.sessionId ?? '')
}

/**
 * ready 事件:创建权威(可以创建/更新 shell)。
 * 但**激活**只发生在 origin 工作区+会话与当前作用域一致时——
 * 后台工作区的 ready 不抢当前焦点。
 */
export function applyTabShellReadyEvent(
  currentState: TabShellRegistryState | null,
  event: TabShellEvent,
  activeScope: TabShellActiveScope,
): TabShellRegistryState {
  const state = currentState ?? createEmptyShellRegistryState()
  const index = state.shells.findIndex((shell) => shell.tabId === event.tabId)
  const shell: TabShellRecord = {
    tabId: event.tabId,
    type: event.type,
    workspaceKey: event.workspaceKey,
    ...(event.sessionId !== undefined ? { sessionId: event.sessionId } : {}),
    generation: event.generation,
    ...(event.residency !== undefined ? { residency: event.residency } : {}),
    ...(event.residency !== undefined ? { residencyGeneration: event.generation } : {}),
  }
  let shells: TabShellRecord[]
  if (index >= 0) {
    shells = [...state.shells]
    shells[index] = shell
  } else {
    shells = [...state.shells, shell]
  }
  const shouldActivate = shellOriginMatchesScope(shell, activeScope)
  return {
    shells,
    activeTabId: shouldActivate ? shell.tabId : state.activeTabId,
  }
}

/**
 * visibility 事件:**只选择,不创建**。
 * 只能命中现存且作用域/generation 完全一致的 shell;命中不到(含已被关闭/移除)
 * 返回原状态——迟到的 visible=true 绝不重建已关 tab(僵尸 shell 点关必失败)。
 */
export function applyTabShellVisibilityEvent(
  currentState: TabShellRegistryState | null,
  event: TabShellEvent,
  activeScope: TabShellActiveScope,
): { state: TabShellRegistryState | null; didMatch: boolean; shouldReveal: boolean } {
  if (!currentState) {
    return { state: currentState, didMatch: false, shouldReveal: false }
  }
  const shell = currentState.shells.find(
    (candidate) =>
      candidate.tabId === event.tabId &&
      shellMatchesOrigin(candidate, event) &&
      candidate.generation === event.generation,
  )
  if (!shell) {
    return { state: currentState, didMatch: false, shouldReveal: false }
  }
  const shouldReveal = shellOriginMatchesScope(shell, activeScope)
  if (!shouldReveal) {
    return { state: currentState, didMatch: true, shouldReveal: false }
  }
  return { state: { ...currentState, activeTabId: shell.tabId }, didMatch: true, shouldReveal: true }
}

/**
 * residency 事件:generation **单调**——shell 上已有更新的代际时忽略本次事件,
 * 防乱序到达的 stale 状态串写(可见性抖动/挂起态回退)。
 */
export function applyTabShellResidencyEvent(
  currentState: TabShellRegistryState | null,
  event: TabShellEvent,
): TabShellRegistryState | null {
  if (!currentState) {
    return currentState
  }
  const index = currentState.shells.findIndex(
    (shell) => shell.tabId === event.tabId && shellMatchesOrigin(shell, event),
  )
  if (index < 0) {
    return currentState
  }
  const target = currentState.shells[index]!
  if ((target.residencyGeneration ?? 0) > event.generation) {
    return currentState
  }
  if (event.residency === undefined) {
    return currentState
  }
  const shells = [...currentState.shells]
  shells[index] = { ...target, residency: event.residency, residencyGeneration: event.generation }
  return { ...currentState, shells }
}

/** 关闭 shell(main 权威):移除记录;此后迟到的 visibility 事件命中不到,不会重建。 */
export function closeTabShell(
  currentState: TabShellRegistryState | null,
  tabId: string,
): TabShellRegistryState | null {
  if (!currentState) {
    return currentState
  }
  const shells = currentState.shells.filter((shell) => shell.tabId !== tabId)
  if (shells.length === currentState.shells.length) {
    return currentState
  }
  return {
    shells,
    activeTabId: currentState.activeTabId === tabId ? null : currentState.activeTabId,
  }
}
