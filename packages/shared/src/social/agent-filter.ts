// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 智能体列表的「筛选 / 排序 / 分类识别」契约(2026-11-14 立)。
 *
 * 治的是哪一族病:同一份智能体列表,两端各算一遍"哪些该显示、按什么排、属于哪个分类" ——
 *   · 小程序 `pkg-ai/ai/agent.tsx` 有一整套 `CATEGORY_KEYWORDS` + `detectCategory` + `filtered`;
 *   · 共享屏 `packages/app/src/features/agent-screen/AgentScreen.tsx` 另有一份
 *     `AGENT_CATEGORY_KEYS` + `keywordsOf` + `detectCategory` + `visibleItems`。
 * 两份的关键词表不同(一边写死 `'excel'/'python'`,另一边走词包逗号切分)、排序档也不同
 * ⇒ 同一个智能体在小程序与 RN 会落进不同分类、排在不同位置。
 *
 * 本文件把三件事钉成单一源:
 *   ① **分类枚举**(`AGENT_CATEGORY_IDS`);
 *   ② **关键词表**(`buildAgentCategoryKeywords`)—— 词由调用方传入(各端词包不同,但**结构**同源);
 *   ③ **筛选与排序规则**(`filterAgents` / `pickHotBanner` / `detectAgentCategory`)。
 *
 * 归属:`@ihui/shared`(纯 `.ts` 契约,三端可消费;`packages/app/features/*` 只认 `.tsx`)。
 *
 * 纪律:不 import 平台原语、不 import 任何端词包 —— 词以参数形式注入,
 * 这样共享层不必认识"小程序把办公叫办公、RN 把办公叫 Office"这类差异。
 */

/** 分类枚举。`recommend` 是"全部"的伪分类(不参与识别,只作为筛选的默认档)。 */
export const AGENT_CATEGORY_IDS = [
  'recommend',
  'office',
  'writing',
  'coding',
  'education',
  'life',
  'other',
] as const

export type AgentCategoryId = (typeof AGENT_CATEGORY_IDS)[number]

/**
 * 参与关键词识别的分类。
 *
 * `recommend` 是伪分类(选它 = 不过滤),`other` 是**兜底值**(匹配不到任何关键词时返回),
 * 两者都不该出现在关键词表里 —— 否则调用方会被迫给 `other` 编一组关键词,
 * 那组词一旦命中就会把本该"未归类"的项抢走。
 */
export type AgentDetectCategoryId = Exclude<AgentCategoryId, 'recommend' | 'other'>

/** 关键词表:每个可识别分类对应一组关键词(已取词、已小写由调用方保证) */
export type AgentCategoryKeywords = Record<AgentDetectCategoryId, readonly string[]>

/** 快捷 Tab(全部 / 收藏 / 最近使用) */
export const AGENT_QUICK_TABS = ['all', 'favorites', 'recent'] as const
export type AgentQuickTab = (typeof AGENT_QUICK_TABS)[number]

/** 排序档。`hot` 与 `uses` 当前同义(都按使用次数降序)—— 保留两档是为了词面兼容,不造新语义。 */
export const AGENT_SORT_KEYS = ['hot', 'newest', 'uses'] as const
export type AgentSortKey = (typeof AGENT_SORT_KEYS)[number]

/**
 * 筛选入参的**最小结构**。
 *
 * 为什么不用 `AgentScreenItem`:本契约要能被两端不同的行类型消费(小程序 `uses/desc`,
 * 共享屏 `useCount/description`)。用结构化最小面 + 调用方归一,比逼两端改字段名更稳。
 */
export interface AgentFilterable {
  id: string
  name?: string | null
  /** 描述(两端字段名不同,由调用方投影到这个位置) */
  desc?: string | null
  /** 分类(后端下发的原始字符串;识别失败时为空) */
  category?: string | null
  /** 使用次数(两端字段名不同,由调用方投影) */
  uses?: number | null
}

export interface AgentFilterInput<T extends AgentFilterable> {
  list: readonly T[]
  keyword?: string
  /** 模型类型筛选(按 category 子串匹配) */
  activeType?: string | null
  activeCategory?: AgentCategoryId
  sortKey?: AgentSortKey
  quickTab?: AgentQuickTab
  favoriteIds?: readonly string[]
  recentIds?: readonly string[]
}

/**
 * 关键词识别:把「名称 + 描述」拼起来,按分类顺序找第一个命中的。
 *
 * 顺序敏感:`Object.entries` 的插入序即优先级。命中不到任何分类 ⇒ `'other'`
 * (这是"其他"分类的唯一来源,不允许调用方自行兜底成别的值)。
 */
export function detectAgentCategory(
  name: string | null | undefined,
  desc: string | null | undefined,
  keywords: AgentCategoryKeywords,
): AgentCategoryId {
  const text = `${name ?? ''} ${desc ?? ''}`.toLowerCase()
  for (const [key, kws] of Object.entries(keywords) as [
    AgentDetectCategoryId,
    readonly string[],
  ][]) {
    if (kws.some((kw) => kw.length > 0 && text.includes(kw.toLowerCase()))) return key
  }
  return 'other'
}

/**
 * 筛选 + 排序。**纯函数,不改入参**(`slice()` 后才 sort)。
 *
 * 规则顺序(不可换):快捷 Tab → 模型类型 → 分类 → 关键词 → 排序。
 * `recent` 档特殊:它自带"按最近使用顺序"语义,此处直接返回,不再走后续排序 ——
 * 否则用户看到的"最近使用"会被使用次数排序打乱(原实现即如此,这里只把它固化)。
 */
export function filterAgents<T extends AgentFilterable>(input: AgentFilterInput<T>): T[] {
  const {
    list,
    keyword,
    activeType,
    activeCategory = 'recommend',
    sortKey = 'hot',
    quickTab = 'all',
    favoriteIds = [],
    recentIds = [],
  } = input

  let arr = list.slice()

  // ① 快捷 Tab
  if (quickTab === 'favorites') {
    const favSet = new Set(favoriteIds)
    arr = arr.filter((a) => favSet.has(a.id))
  } else if (quickTab === 'recent') {
    const recSet = new Set(recentIds)
    arr = arr.filter((a) => recSet.has(a.id))
    const orderMap = new Map(recentIds.map((id, idx) => [id, idx]))
    return arr.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))
  }

  // ② 模型类型
  if (activeType) {
    const type = activeType.toLowerCase()
    arr = arr.filter((a) => (a.category ?? '').toLowerCase().includes(type))
  }

  // ③ 分类(伪分类 recommend = 不过滤)
  if (activeCategory !== 'recommend') {
    arr = arr.filter((a) => (a.category ?? '') === activeCategory)
  }

  // ④ 关键词
  const kw = keyword?.trim().toLowerCase()
  if (kw) {
    arr = arr.filter(
      (a) => (a.name ?? '').toLowerCase().includes(kw) || (a.desc ?? '').toLowerCase().includes(kw),
    )
  }

  // ⑤ 排序
  if (sortKey === 'newest') {
    // 后端未下发 createdAt ⇒ 按列表顺序倒序近似(与原实现同口径,不造时间)
    return arr.reverse()
  }
  // hot 与 uses 同义:按使用次数降序
  return arr.sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0))
}

/**
 * 顶部热门推荐 Banner:仅当「全部 Tab + 无任何筛选」时出,取使用次数前 N。
 *
 * 为什么要有这条判据:筛选态下还顶着"热门推荐"会让人误以为推荐区也参与了筛选
 * (点进去发现不是同一批),原实现就是这条规则,这里固化。
 */
export function pickHotBanner<T extends AgentFilterable>(
  input: Omit<AgentFilterInput<T>, 'sortKey' | 'favoriteIds' | 'recentIds'>,
  limit = 5,
): T[] {
  const { list, keyword, activeType, activeCategory = 'recommend', quickTab = 'all' } = input
  if (quickTab !== 'all' || keyword || activeType || activeCategory !== 'recommend') return []
  return list
    .slice()
    .sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0))
    .slice(0, Math.max(0, limit))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
