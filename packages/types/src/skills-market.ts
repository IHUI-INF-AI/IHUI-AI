// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 技能市场(Skill Market)共享屏的形状单源 —— web `/skills-market` ↔ RN `SkillMarket*`。
 *
 * 2026-10-28 立:web 侧 `/skills-market` 与 `/skills-market/[id]` 共用同一份
 * `apps/web/app/(main)/skills-market/PageClient.tsx`(详情是列表页内的一个弹层,
 * 深链 `[id]` 只是把 name 交给 `deepLinkName` 反查后自动打开同一份弹层),RN 侧此前零承载。
 *
 * ⚠️ 与 `AiSkill*` **不是同一域**:RN 既有的 `AiSkill` / `AiSkillDetail` 打的是
 * `GET /api/ai-skills`(`SkillMarketEntry` 之外的另一套形状);技能市场打的是
 * `GET /api/skills/market`(`packages/shared/src/skills/market.ts` 的 `SkillMarketEntry`)。
 * 两者字段名、语义、后端实现都不同,不得互相复用。
 *
 * 端点实回(`apps/api/src/routes/skills.ts:743-774`):
 * `success({ items, total, page, pageSize })`,单条即 `SkillMarketEntry` 原文。
 * 但该表是 Redis JSON 累积写入的,历史条目可能缺 `tags` / `rating` 等列,
 * 故本文件的视图形状按**防御性归一后的目标态**声明:`name` / `description` 为必填,
 * 其余由宿主归一(缺失即 0 / 空数组 / 空串),共享屏只读视图,不再做二次容错。
 */
import type { TFunction } from './app-shared.js'

/**
 * 市场条目视图(归一后)。
 *
 * 与 `@ihui/shared/skills/market` 的 `SkillMarketEntry` 同名同义,但剔除了
 * `ownerId` / `source` / `enabled` 这三个**归属/上下架**字段 —— RN 两屏是只读浏览,
 * 不做上下架与 owner 判定(web 的上下架按钮只在详情弹层里、且仅 owner 可见),
 * 把它们搬过来只会多出三个永不消费的死字段。
 */
export interface SkillMarketEntryView {
  /** 条目唯一标识(也是深链 slug,后端按 name 唯一) */
  name: string
  description: string
  tags: string[]
  author: string
  version: string
  license: string
  /** 安装量(实回恒有;缺失归一为 0) */
  installCount: number
  /** 平均分 0~5(实回恒有;缺失归一为 0) */
  rating: number
  /** 评分条数(0 时列表显示「暂无评分」而不是「0 条评分」) */
  ratingCount: number
  /** 更新时间 ISO 串(缺失则不渲染该行) */
  updatedAt?: string | null
}

/**
 * SkillMarketListScreen 受控 props 契约。
 * 平台无关:取数 / 导航 / 分页状态全在宿主;本屏只渲染 + 回调。
 */
export interface SkillMarketListScreenProps {
  t: TFunction
  items: SkillMarketEntryView[]
  /** 标签候选(web 从当前页条目聚合,取前 12 个);空数组则整行不渲染 */
  tags: string[]
  /** 受控关键词输入值 */
  keyword: string
  /** 当前选中标签,空串 = 全部 */
  tag: string
  /** 总条数(实回 total;仅用于标题旁的计数徽章) */
  total: number
  /** 当前页,从 1 开始 */
  page: number
  /** 总页数(宿主按 total / pageSize 算好;<=1 时不渲染分页条) */
  totalPages: number
  /** 首屏加载中(整屏骨架) */
  loading: boolean
  /** 加载失败文案(非空且无条目时渲染错误态) */
  error: string
  onKeywordChange: (value: string) => void
  /** 提交搜索(回车 / 搜索键);宿主负责把页码重置回 1 */
  onSearch: () => void
  /** 切换标签(空串 = 全部);宿主负责把页码重置回 1 */
  onTagChange: (tag: string) => void
  /** 翻页 */
  onPageChange: (page: number) => void
  /** 点开条目 —— 由宿主 navigate 到详情屏(共享屏不碰导航) */
  onSelect: (item: SkillMarketEntryView) => void
  /** 顶部返回 */
  onBack: () => void
  /** 错误态重试 / 空态重新拉取 */
  onRetry: () => void
  colorScheme?: 'light' | 'dark'
}

/**
 * SkillMarketDetailScreen 受控 props 契约。
 *
 * `name` 与 `entry` 并存是刻意的:深链直达一个不存在 / 已下架的 skill 时 `entry` 为 null,
 * 空态文案仍要能回显"你查的是哪一条"(`notFoundHint {name}`),不能因为没查到就丢掉入参。
 */
export interface SkillMarketDetailScreenProps {
  t: TFunction
  /** 路由入参里的 skill name(未解码前的原文) */
  name: string
  /** 反查命中的条目;null + 非 loading 且无 error ⇒ 渲染「未找到该 Skill」 */
  entry: SkillMarketEntryView | null
  loading: boolean
  error: string
  /** 顶部返回(同时也是空态里的「返回 Skill 市场」出口) */
  onBack: () => void
  /** 错误态重试 / 空态重新反查 */
  onRetry: () => void
  colorScheme?: 'light' | 'dark'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
