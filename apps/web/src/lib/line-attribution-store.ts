// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 行级归因的 Web 侧持久层(localStorage)。
 *
 * 归属判定**全部**委托 @ihui/shared/attribution(recordAiAttribution / applyHumanEdit),
 * 本文件只做三件事:按「工作区 → 文件」键存区间、给 UI 提供逐行来源、变更后通知订阅者。
 * 键用工作区名(browser DirectoryHandle 的 name),与服务端 `/api/workspace/attribution`
 * 的 workspacePath 判据互不干扰 —— 客户端只展示自己有权访问的 handle 里的文件。
 */

import {
  applyHumanEdit,
  normalizePathSegments,
  recordAiAttribution,
  resolveLineSources,
  type AttributionOrigin,
  type AttributionRange,
  type AttributionSource,
  type LineAttribution,
} from '@ihui/shared/attribution'

const STORAGE_KEY = 'ihui.line-attribution.v1'
const listeners = new Set<() => void>()
let version = 0

type AttributionSnapshot = Record<string, Record<string, LineAttribution[]>>

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function loadSnapshot(): AttributionSnapshot {
  const store = storage()
  if (!store) return {}
  try {
    const raw = store.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as AttributionSnapshot
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function persist(snapshot: AttributionSnapshot): void {
  const store = storage()
  if (!store) return
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // 存储配额满时不阻断编辑:UI 只是少一次标记
  }
}

function fileKey(file: string): string {
  return normalizePathSegments(file)
}

/**
 * 按版本号取快照。`version` 是本模块唯一的失效信号:所有写入路径都先 persist 再 notify,
 * 所以版本号不变 ⇒ localStorage 里的归因数据也不变。以版本号为缓存键,一是让调用方 useMemo
 * 的依赖真正参与计算(而不是只当摆设塞进数组),二是同版本多次重渲染不再重复 JSON.parse。
 */
let cachedVersion = -1
let cachedSnapshot: AttributionSnapshot = {}

function snapshotAt(snapshotVersion: number): AttributionSnapshot {
  if (cachedVersion !== snapshotVersion) {
    cachedSnapshot = loadSnapshot()
    cachedVersion = snapshotVersion
  }
  return cachedSnapshot
}

/** 逐行来源(索引 0 = 第 1 行);无记录即全 human。 */
export function getLineAttributionSources(
  workspace: string,
  file: string,
  lineCount: number,
  snapshotVersion: number = version,
): AttributionSource[] {
  const records = snapshotAt(snapshotVersion)[workspace]?.[fileKey(file)] ?? []
  return resolveLineSources(records, lineCount)
}

/** 该文件已有记录(供写入侧做增量对比)。 */
export function getFileAttribution(workspace: string, file: string): LineAttribution[] {
  return loadSnapshot()[workspace]?.[fileKey(file)] ?? []
}

function notify(): void {
  version += 1
  for (const listener of listeners) listener()
}

/** useSyncExternalStore 订阅入口:任何写入都会推高版本号,触发 UI 重算逐行来源。 */
export function subscribeLineAttribution(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getLineAttributionVersion(): number {
  return version
}

/** 落盘成功后由写入路径调用:保存该文件最新压缩区间。 */
export function saveFileAttribution(
  workspace: string,
  file: string,
  ranges: readonly AttributionRange[],
): void {
  const snapshot = loadSnapshot()
  const files = snapshot[workspace] ?? {}
  files[fileKey(file)] = ranges.map((range) => ({ ...range, filePath: fileKey(file) }))
  snapshot[workspace] = files
  persist(snapshot)
  notify()
}

/**
 * 一次写入的归因入口(AI 工具写入 / 用户手动保存共用):
 * 只以 before/after 的真实 diff 标记,不整文件认领。
 */
export function recordFileWrite(input: {
  workspace: string
  file: string
  before: string
  after: string
  origin: AttributionOrigin
  mode: 'ai' | 'human'
}): AttributionRange[] {
  const old = getFileAttribution(input.workspace, input.file)
  const ranges =
    input.mode === 'human'
      ? applyHumanEdit(old, input.before, input.after, {
          filePath: fileKey(input.file),
          at: input.origin.at,
        })
      : recordAiAttribution(old, input.before, input.after, input.origin, {
          filePath: fileKey(input.file),
        })
  saveFileAttribution(input.workspace, input.file, ranges)
  return ranges
}

/** 工具调用参数里的目标路径(非写工具返回空串,归因旁路会自然跳过)。 */
export function filePathOfArgs(args: unknown): string {
  if (args && typeof args === 'object' && 'path' in args) {
    const raw = (args as { path?: unknown }).path
    return typeof raw === 'string' ? raw : ''
  }
  return ''
}

/** 清空某文件归属(文件被删除时用)。 */
export function clearFileAttribution(workspace: string, file: string): void {
  const snapshot = loadSnapshot()
  const files = snapshot[workspace]
  if (!files) return
  delete files[fileKey(file)]
  snapshot[workspace] = files
  persist(snapshot)
  notify()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
