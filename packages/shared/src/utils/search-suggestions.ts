// 2026-07-28 立:SearchBar 三段式搜索面板(历史/热门/联想)的"热门"段数据集中管理。
// 设计:硬编码 8 个常用关键词(项目内置基线),与现有 i18n search.quickSuggestions
// 在含义上互补 — 这里是"运营推荐的热门",那里是"联想建议池"。
// 后续可下沉到 i18n / 后端配置中心,先以 const 形态稳定接口。

export const POPULAR_SEARCHES = [
  'AI 对话',
  '项目管理',
  '数据分析',
  '设置',
  '帮助',
  '快捷键',
  '个人资料',
  'AI 模型',
] as const

export type PopularSearch = (typeof POPULAR_SEARCHES)[number]
