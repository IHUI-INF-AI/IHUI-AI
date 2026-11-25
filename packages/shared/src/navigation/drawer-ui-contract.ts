// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 抽屉「历史卡动作条 + 批量操作条」的语义单一真相源（2026-11-24 立）。
 *
 * 背景：清单/图标/可见性已由 `sidebar-nav.ts` 单源化，但**动作集合**仍是三份手写：
 * 同一个「多选钮」在三端曾各写一个键(wed=切换任务多选模式 / RN=全选 / 小程序=无 aria)，
 * 同一个「批量删除」在三端曾各写一套值，同一动作在某一端静默缺席也无处登记。
 * 本文件把「有哪些动作、各端用哪个词条键、哪些端为什么没有」收敛成一张表。
 *
 * 纪律：
 * 1. 移动两端运行时**只准**经 `drawerActionKey(id)` 取键，不得再写 `'drawer.batchDelete'` 字面量；
 * 2. web 是参照端，键名由本表 `webNs + webKey` 锁定，改 web 键必须同步改本表（parity 测试拦）；
 * 3. 某端缺席必须写进 `absent` 并说明原因（数据能力/交互形态差异），不得静默消失；
 * 4. 文案「值」不在此处：值仍由三端词包承载，一致性由 `check-i18n-parity` 与 parity 测试兜。
 */

export type DrawerPlatform = 'web' | 'rn' | 'miniapp'

/** 动作身份（不用文案键当 key，改名不漂移） */
export type DrawerActionId =
  // 历史卡右上角动作条
  | 'search'
  | 'multiSelect'
  | 'folderFilter'
  | 'sort'
  // 多选批量操作条
  | 'selectAll'
  | 'invertSelection'
  | 'moveToFolder'
  | 'archive'
  | 'unarchive'
  | 'delete'
  | 'cancelSelection'

export interface DrawerActionSpec {
  id: DrawerActionId
  /** 所在区块（历史卡动作条 / 批量操作条） */
  scope: 'historyHeader' | 'batchBar'
  /** web i18n 命名空间（web 侧 useTranslations 分组） */
  webNs: 'chatHistory' | 'chatSearchBar' | 'aiChat'
  /** web 词条键（不含 ns 前缀） */
  webKey: string
  /** 移动两端（RN / 小程序）词条键（扁平 ns 下的全键） */
  mobileKey: string
  /** 移动两端第二取值键（排序切换钮按当前状态取，仅 sort 使用） */
  mobileAltKey?: string
  /** 中文兜底（三端同一份；缺词条时展示） */
  label: string
  /** 该动作存在的端；不在列表里的端必须在 `absent` 写明原因 */
  platforms: readonly DrawerPlatform[]
  /** 缺席理由（逐端一句话，禁止空泛） */
  absent?: Partial<Record<DrawerPlatform, string>>
}

/**
 * 全量动作表。顺序即三端渲染顺序（历史卡从左到右、批量条从左到右）。
 */
export const DRAWER_ACTION_SOURCE: readonly DrawerActionSpec[] = [
  {
    id: 'search',
    scope: 'historyHeader',
    webNs: 'chatSearchBar',
    webKey: 'searchAriaLabel',
    mobileKey: 'drawer.search',
    label: '搜索对话',
    platforms: ['web', 'rn', 'miniapp'],
  },
  {
    id: 'multiSelect',
    scope: 'historyHeader',
    webNs: 'chatHistory',
    webKey: 'selectModeAriaLabel',
    mobileKey: 'drawer.multiSelect',
    label: '切换任务多选模式',
    platforms: ['web', 'rn', 'miniapp'],
  },
  {
    id: 'folderFilter',
    scope: 'historyHeader',
    webNs: 'aiChat',
    webKey: 'org.filterLabel',
    mobileKey: 'drawer.filterLabel',
    label: '按文件夹筛选',
    platforms: ['web', 'rn', 'miniapp'],
  },
  {
    id: 'sort',
    scope: 'historyHeader',
    webNs: 'chatHistory',
    webKey: 'sorting.label',
    mobileKey: 'drawer.sortPinnedFirst',
    mobileAltKey: 'drawer.sortByTime',
    label: '排序方式',
    platforms: ['web', 'rn', 'miniapp'],
  },
  {
    id: 'selectAll',
    scope: 'batchBar',
    webNs: 'chatHistory',
    webKey: 'selectAll',
    mobileKey: 'drawer.selectAll',
    label: '全选',
    platforms: ['web', 'rn', 'miniapp'],
  },
  {
    id: 'invertSelection',
    scope: 'batchBar',
    webNs: 'chatHistory',
    webKey: 'invertSelection',
    mobileKey: 'drawer.invertSelection',
    label: '反选',
    platforms: ['web', 'rn', 'miniapp'],
  },
  {
    id: 'moveToFolder',
    scope: 'batchBar',
    webNs: 'chatHistory',
    webKey: 'moveSelectedToGroup',
    mobileKey: 'drawer.moveToFolder',
    label: '移动所选到分组',
    platforms: ['web', 'rn', 'miniapp'],
  },
  {
    id: 'archive',
    scope: 'batchBar',
    webNs: 'chatHistory',
    webKey: 'batchArchive',
    mobileKey: 'drawer.batchArchive',
    label: '批量归档',
    platforms: ['web', 'rn'],
    absent: {
      miniapp: '小程序会话表无 archived 列，归档态无承载字段（需后端补列后才可进入）',
    },
  },
  {
    id: 'unarchive',
    scope: 'batchBar',
    webNs: 'chatHistory',
    webKey: 'batchUnarchive',
    mobileKey: 'drawer.batchUnarchive',
    label: '批量取消归档',
    platforms: ['web'],
    absent: {
      rn: 'RN 端未实现归档后的批量恢复入口（归档入口已存在，恢复态留待后续接后端批量接口）',
      miniapp: '小程序无归档态（同 archive 的缺席理由）',
    },
  },
  {
    id: 'delete',
    scope: 'batchBar',
    webNs: 'chatHistory',
    webKey: 'batchDelete',
    mobileKey: 'drawer.batchDelete',
    label: '批量删除',
    platforms: ['web', 'rn', 'miniapp'],
  },
  {
    id: 'cancelSelection',
    scope: 'batchBar',
    webNs: 'chatHistory',
    webKey: 'cancelSelection',
    mobileKey: 'drawer.cancelSelection',
    label: '取消选择',
    platforms: ['web', 'rn', 'miniapp'],
  },
] as const

/** 动作键索引（缺 id 直接抛，避免静默 undefined） */
const ACTION_BY_ID = new Map<DrawerActionId, DrawerActionSpec>(
  DRAWER_ACTION_SOURCE.map((spec) => [spec.id, spec]),
)

export function drawerActionSpec(id: DrawerActionId): DrawerActionSpec {
  const spec = ACTION_BY_ID.get(id)
  if (!spec) throw new Error(`[drawer-ui-contract] 未登记的动作: ${id}`)
  return spec
}

/** 移动两端取键的唯一入口（RN / 小程序渲染层专用） */
export function drawerActionKey(id: DrawerActionId): string {
  return drawerActionSpec(id).mobileKey
}

/** 某端在该区块应渲染的动作（顺序 = 表顺序） */
export function drawerActionsFor(
  scope: DrawerActionSpec['scope'],
  platform: DrawerPlatform,
): DrawerActionSpec[] {
  return DRAWER_ACTION_SOURCE.filter(
    (spec) => spec.scope === scope && spec.platforms.includes(platform),
  )
}

/** 该端缺席的动作（供 parity 测试与文档核对，禁止静默消失） */
export function drawerAbsentActions(
  scope: DrawerActionSpec['scope'],
  platform: DrawerPlatform,
): Array<{ id: DrawerActionId; reason: string }> {
  return DRAWER_ACTION_SOURCE.filter(
    (spec) => spec.scope === scope && !spec.platforms.includes(platform),
  ).map((spec) => ({ id: spec.id, reason: spec.absent?.[platform] ?? '' }))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
