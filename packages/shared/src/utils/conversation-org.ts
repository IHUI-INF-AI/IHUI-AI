// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D20 会话组织(v1)的归一化、回收与投影规则 —— 全项目唯一一份。
//
// 存在理由:「文件夹怎么算同名」「标签怎么算重复」「清空后这条还算不算存在」这类规则一旦被
// 端内各写一遍,就会出现「侧栏筛不出来、对话框里却看得到」这种两边各自自洽的对不上
// (§3 共享层优先)。本文件只做纯函数,不碰存储与网络:存储由调用方注入
// (web 端 = localStorage 按 userId 分桶,见 apps/web/src/stores/conversation-org.ts)。
//
// 写入侧的 withFolderMeta / withTagsMeta 有一条**必须保持的引用约定**:值没变就返回入参本体。
// store 靠 `next === base` 短路 set() —— 若每次写入都换 map 引用,未变化的保存动作也会让
// 侧栏整片重算,与本仓 2026-09-26 实测过的「selector 返回新字面量 ⇒ 全路由
// Maximum update depth exceeded」是同一型故障,只是触发点从读侧挪到了写侧。

/** 单个会话的组织元数据。字段全部可选 —— 无元数据的会话得到空对象。 */
export interface ConversationOrgMeta {
  /** 文件夹名;null / 缺失 = 未分组 */
  folder?: string | null
  /** 标签列表,已归一化 */
  tags?: string[]
}

/** conversationId → 元数据 */
export type ConversationOrgMap = Record<string, ConversationOrgMeta>

/**
 * 文件夹名上限 64:取本仓短名一律 varchar(64) 这一档(参照
 * `packages/database/src/schema/stock.ts` 的 conversationId)。输入框 maxLength 与
 * 归一化截断共用这一个数 —— 出现两个上限时,粘贴进来的长名字会"看起来能存、存下却不同"。
 */
export const ORG_FOLDER_MAX_LENGTH = 64

/** 单条标签字符上限 */
export const ORG_TAG_MAX_LENGTH = 24

/** 单个会话的标签条数上限(存储载体是 localStorage 时它必须有界) */
export const ORG_TAG_MAX_COUNT = 8

/**
 * 无元数据时的返回值。必须复用这**同一个**对象:消费侧把 meta 放进了
 * `React.useEffect(..., [open, meta])`(conversation-org-dialog.tsx),每次渲染返回新
 * 字面量会让该 effect 每帧重跑、把用户正在输入的内容重置回已保存值。
 */
export const EMPTY_CONVERSATION_ORG_META: ConversationOrgMeta = Object.freeze({})

/** 折叠空白 + 去掉控制字符。文件夹与标签都是单行短名,不能带换行。 */
function squashToSingleLine(raw: string): string {
  return (
    raw
      // 这里判的就是控制字符本身(换行/制表/NUL/行分隔符),不是源码里的转义序列
      .replace(/[\x00-\x1f\x7f\u2028\u2029]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

function clip(text: string, max: number): string {
  return max > 0 ? text.slice(0, max) : text
}

/**
 * 归一化文件夹名:单行化 → 去首尾空白 → 截断到 max。
 * 无有效内容时返回 `''`(调用方按 `|| null` 折成"未分组")。
 */
export function normalizeOrgName(
  raw: string | null | undefined,
  max: number = ORG_FOLDER_MAX_LENGTH,
): string {
  if (typeof raw !== 'string') return ''
  return clip(squashToSingleLine(raw), max)
}

/**
 * 归一化标签列表:逐条规范化 → 丢空 → 按小写去重(保留首次出现的书写)→ 截到条数上限。
 * 总是返回新数组,不改入参。
 */
export function normalizeTagList(tags: readonly string[] | null | undefined): string[] {
  if (!Array.isArray(tags)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of tags) {
    if (typeof raw !== 'string') continue
    const tag = clip(squashToSingleLine(raw), ORG_TAG_MAX_LENGTH)
    if (!tag) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(tag)
    if (out.length >= ORG_TAG_MAX_COUNT) break
  }
  return out
}

/** 读取某会话已归一化的文件夹名(空串 = 未分组) */
export function getOrgFolder(map: ConversationOrgMap | null | undefined, id: string): string {
  return normalizeOrgName(map?.[id]?.folder)
}

/**
 * 取某会话的组织元数据。**引用稳定**:命中返回存储里那一份,未命中返回模块级常量,
 * 因此 `orgMap` 未变时同一 id 多次调用返回同一对象(见 EMPTY_… 上方的说明)。
 */
export function getOrgMeta(
  map: ConversationOrgMap | null | undefined,
  id: string | null | undefined,
): ConversationOrgMeta {
  if (!map || !id) return EMPTY_CONVERSATION_ORG_META
  const entry = map[id]
  return entry ?? EMPTY_CONVERSATION_ORG_META
}

/** 列出所有已使用的文件夹名(去重、去掉未分组、稳定升序) */
export function listFolderNames(map: ConversationOrgMap | null | undefined): string[] {
  if (!map || typeof map !== 'object') return []
  const names = new Set<string>()
  for (const entry of Object.values(map)) {
    const folder = normalizeOrgName(entry?.folder)
    if (folder) names.add(folder)
  }
  // 不用 localeCompare:它的排序随 ICU/区域设置变,同一份数据在两台机上能给出两个顺序,
  // 而这里的顺序会直接呈现在筛选条上。按码位比是确定的。
  return [...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

/**
 * 按文件夹筛选。三态语义(与侧栏 `folderFilter` 的 state 声明一一对应):
 * - `undefined` 不过滤,全部返回
 * - `null` 只要未分组的
 * - 字符串 只要该文件夹的(两侧都先归一化再比,故历史脏值不会因多余空格而筛不到)
 *
 * 泛型只要求 `id`,所以各端自己的行类型(web 的局部 ConversationItem 等)都能直接喂。
 */
export function filterByFolder<T extends { id: string }>(
  items: readonly T[],
  map: ConversationOrgMap | null | undefined,
  folder: string | null | undefined,
): T[] {
  const list = Array.isArray(items) ? items : []
  if (folder === undefined) return [...list]
  // 传进来一个归一化后为空的"字符串":它表达的意图就是未分组,与 null 同义
  const want = normalizeOrgName(folder)
  const out: T[] = []
  for (const item of list) {
    const has = getOrgFolder(map, item.id) === want
    if (has) out.push(item)
  }
  return out
}

/**
 * 置顶优先的稳定排序:置顶项整体前移,组内相对顺序不变(后端已按置顶优先返回,
 * 这里只做客户端筛选后重排,不得打乱同组顺序)。不改入参。
 */
export function sortPinnedFirst<T extends { pinned?: boolean }>(items: readonly T[]): T[] {
  const list = Array.isArray(items) ? items : []
  const pinned: T[] = []
  const rest: T[] = []
  for (const item of list) {
    if (item?.pinned) pinned.push(item)
    else rest.push(item)
  }
  return [...pinned, ...rest]
}

/** 回收后的元数据:tags 恒在(空数组也要写回,否则读取侧要再判一次 undefined) */
type RecycledOrgMeta = { folder?: string; tags: string[] }

/** 归一化后两栏都空 ⇒ 该会话不该再占一条记录(否则 listFolderNames 与存储都攒死键) */
function recycle(meta: ConversationOrgMeta): RecycledOrgMeta | null {
  const folder = normalizeOrgName(meta.folder)
  const tags = normalizeTagList(meta.tags)
  if (!folder && tags.length === 0) return null
  return folder ? { folder, tags } : { tags }
}

/** 逐条比较标签:顺序与内容都相同才算没变(入参侧的脏书写先各自归一化再比) */
function sameTags(a: readonly string[] | undefined, b: readonly string[]): boolean {
  const left = normalizeTagList(a)
  return left.length === b.length && left.every((x, i) => x === b[i])
}

/**
 * 写入侧共用的那一条规则:算出该会话的新元数据,并判断它与旧值是否等价。
 * `withFolderMeta` / `withTagsMeta` 只差"这一次动的是哪一栏",其余必须同形。
 * 等价时返回**入参本体**(见文件上方引用约定)。
 */
function withMeta(
  map: ConversationOrgMap,
  conversationId: string,
  next: ConversationOrgMeta,
): ConversationOrgMap {
  if (!conversationId) return map
  const prev = map[conversationId]
  const recycled = recycle(next)
  const prevRecycled = prev ? recycle(prev) : null
  if (recycled === null && prevRecycled === null) return map
  if (
    recycled &&
    prevRecycled &&
    recycled.folder === prevRecycled.folder &&
    sameTags(prevRecycled.tags, recycled.tags)
  )
    return map
  const out: ConversationOrgMap = { ...map }
  if (recycled) out[conversationId] = recycled
  else delete out[conversationId]
  return out
}

/**
 * 写入某会话的文件夹(标签栏保持不变)。
 * folder 传 null / 空白 = 移出文件夹;两栏都空时整条回收。
 */
export function withFolderMeta(
  map: ConversationOrgMap,
  conversationId: string,
  folder: string | null | undefined,
): ConversationOrgMap {
  return withMeta(map, conversationId, { ...map[conversationId], folder: normalizeOrgName(folder) })
}

/**
 * 写入某会话的标签(文件夹栏保持不变)。
 * 传入的列表整条替换(不是追加),并按 normalizeTagList 的规则去重截断。
 */
export function withTagsMeta(
  map: ConversationOrgMap,
  conversationId: string,
  tags: readonly string[] | null | undefined,
): ConversationOrgMap {
  return withMeta(map, conversationId, { ...map[conversationId], tags: normalizeTagList(tags) })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
