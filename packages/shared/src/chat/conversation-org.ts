// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:PLACEHOLDER

// D20 会话文件夹/标签(G-11)纯逻辑层:会话组织元数据的增删查/分组/筛选/置顶排序。
// 纯函数、零平台依赖、immutable —— 元数据本身由 web 端 store 持久化(v1 客户端态;
// 后端 schema 化持久化为后续票),本模块只定义"怎么算",不定义"存哪里"。

/** 单个会话的组织元数据(客户端持久化 v1 形态) */
export interface ConversationOrgMeta {
  /** 所属文件夹名;null/undefined = 未分组 */
  folder?: string | null
  /** 标签(去重、去空白、有上限);undefined = 无标签 */
  tags?: string[]
}

/** conversationId → 组织元数据 */
export type ConversationOrgMap = Record<string, ConversationOrgMeta>

export const ORG_TAG_MAX_COUNT = 8
export const ORG_TAG_MAX_LENGTH = 32
export const ORG_FOLDER_MAX_LENGTH = 40

/** 标签/文件夹名安全化:去控制字符 + trim + 截断(超上限丢弃该标签由调用方裁决) */
export function normalizeOrgName(raw: string, maxLength: number): string {
  return raw.replace(/[\u0000-\u001f]/g, '').trim().slice(0, maxLength)
}

/** 读取单条元数据(恒返回对象,便于调用方解构) */
export function getOrgMeta(map: ConversationOrgMap, id: string): ConversationOrgMeta {
  return map[id] ?? {}
}

/** 空元数据(无文件夹无标签)是否可从 map 中删除,保持持久化体积最小 */
function isEmptyMeta(meta: ConversationOrgMeta): boolean {
  const hasFolder = typeof meta.folder === 'string' && meta.folder.length > 0
  const hasTags = Array.isArray(meta.tags) && meta.tags.length > 0
  return !hasFolder && !hasTags
}

/** 归一化标签数组:去空白项 + 去重(保留首个)+ 数量上限截断 */
export function normalizeTagList(tags: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    const tag = normalizeOrgName(raw, ORG_TAG_MAX_LENGTH)
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
    if (out.length >= ORG_TAG_MAX_COUNT) break
  }
  return out
}

/** 设置会话所属文件夹(folder=null 清除);清空后整条元数据从 map 删除 */
export function withFolderMeta(
  map: ConversationOrgMap,
  id: string,
  folder: string | null,
): ConversationOrgMap {
  const meta = getOrgMeta(map, id)
  const normalized = folder === null ? null : normalizeOrgName(folder, ORG_FOLDER_MAX_LENGTH) || null
  const next: ConversationOrgMeta = { ...meta, folder: normalized }
  if (!next.folder?.length) delete next.folder
  if (!next.tags?.length) delete next.tags
  if (isEmptyMeta(next)) {
    if (!(id in map)) return map
    const clone = { ...map }
    delete clone[id]
    return clone
  }
  return { ...map, [id]: next }
}

/** 整体替换会话标签(内部归一化);清空后整条元数据从 map 删除 */
export function withTagsMeta(
  map: ConversationOrgMap,
  id: string,
  tags: readonly string[],
): ConversationOrgMap {
  const meta = getOrgMeta(map, id)
  const normalized = normalizeTagList(tags)
  const next: ConversationOrgMeta = { ...meta }
  if (normalized.length > 0) next.tags = normalized
  else delete next.tags
  if (!next.folder?.length) delete next.folder
  if (isEmptyMeta(next)) {
    if (!(id in map)) return map
    const clone = { ...map }
    delete clone[id]
    return clone
  }
  return { ...map, [id]: next }
}

/** 追加一个标签;重复或归一化后为空时返回原 map(引用相等,便于调用方判"没变化") */
export function withTagAdded(map: ConversationOrgMap, id: string, tag: string): ConversationOrgMap {
  const current = getOrgMeta(map, id).tags ?? []
  const normalized = normalizeOrgName(tag, ORG_TAG_MAX_LENGTH)
  if (!normalized || current.includes(normalized)) return map
  return withTagsMeta(map, id, [...current, normalized])
}

/** 移除一个标签;不存在时返回原 map */
export function withTagRemoved(
  map: ConversationOrgMap,
  id: string,
  tag: string,
): ConversationOrgMap {
  const current = getOrgMeta(map, id).tags ?? []
  if (!current.includes(tag)) return map
  return withTagsMeta(map, id, current.filter((t) => t !== tag))
}

/** 全部文件夹名(去空 + 去重 + 字典序),用于筛选器与对话框联想 */
export function listFolderNames(map: ConversationOrgMap): string[] {
  const set = new Set<string>()
  for (const meta of Object.values(map)) {
    if (meta.folder) set.add(meta.folder)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

/** 全部标签名(去重 + 字典序) */
export function listTagNames(map: ConversationOrgMap): string[] {
  const set = new Set<string>()
  for (const meta of Object.values(map)) {
    for (const tag of meta.tags ?? []) set.add(tag)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

/** 会话最小结构(调用方传 Conversation / ConversationItem 均可) */
interface OrgItem {
  id: string
}

/** 按文件夹分组:命名文件夹按字典序在前,未分组(null)恒在最后;组内保持输入顺序 */
export function groupByFolder<T extends OrgItem>(
  items: readonly T[],
  map: ConversationOrgMap,
): Array<{ folder: string | null; items: T[] }> {
  const named = new Map<string, T[]>()
  const ungrouped: T[] = []
  for (const item of items) {
    const folder = getOrgMeta(map, item.id).folder ?? null
    if (folder) {
      const bucket = named.get(folder)
      if (bucket) bucket.push(item)
      else named.set(folder, [item])
    } else {
      ungrouped.push(item)
    }
  }
  return [
    ...[...named.keys()].sort((a, b) => a.localeCompare(b)).map((folder) => ({
      folder,
      items: named.get(folder) ?? [],
    })),
    ...(ungrouped.length > 0 ? [{ folder: null, items: ungrouped }] : []),
  ]
}

/** 按文件夹筛选:undefined = 不过滤;null = 只看未分组;字符串 = 指定文件夹 */
export function filterByFolder<T extends OrgItem>(
  items: readonly T[],
  map: ConversationOrgMap,
  folder: string | null | undefined,
): T[] {
  if (folder === undefined) return [...items]
  return items.filter((item) => (getOrgMeta(map, item.id).folder ?? null) === folder)
}

/** 置顶优先排序(稳定:同位次保持输入顺序;服务端列表本就置顶在前,此处兜住本地重组) */
export function sortPinnedFirst<T extends { pinned?: boolean }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => Number(b.pinned === true) - Number(a.pinned === true))
}
// [IHUI-AI-PROVENANCE]:PLACEHOLDER
