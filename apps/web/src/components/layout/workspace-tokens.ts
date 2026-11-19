// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工作区共享样式令牌(2026-11-16 立)
 *
 * 背景:侧边栏一级分类点击后的页面分两类骨架 ——
 *   - DomainHub:八个 `/domains/*` 域入口页(卡片网格);
 *   - CategoryShell:settings / user / models / developer / docs 五个模块页
 *     (左侧分组导航 + 右侧内容区)。
 * 用户要求「子功能页还得好好设计设计美化一下」「统一样式设定 token 方便管理」,
 * 两者必须共享同一套几何 / 字号 / 分组语言,否则又会漂移成
 * 「域页一套、模块页另一套」的观感断层。
 *
 * 纪律(AGENTS.md §0.6 单一真相源):
 *   - 图标砖几何、页标题档位、分组头元素**只在本文件定义一处**;
 *     DomainHub.HUB_TOKENS 与 CategoryShell.SHELL_TOKENS 只组合引用,不得复制字面量;
 *   - 只允许语义令牌(border/card/muted/primary/ring/cta 档),禁止硬编码色值;
 *   - 改档位只改这里,两处消费方同批生效。
 */

/**
 * 图标砖统一几何:36×36 / 圆角 8 —— 卡片、父项表头、模块页头共用一档。
 * (2026-11-16 用户反馈「统一所有域卡片的图标尺寸和间距」后抽为常量。)
 */
export const ICON_BRICK = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg'

/** 图标字形统一 16×16(与 ICON_BRICK 配对;再出现 h-3.5/h-5 混档即为漂移) */
export const ICON_GLYPH = 'h-4 w-4'

/**
 * 页头卡主面:淡主色渐变 + 描边。
 * hub 的域头卡与模块页的页头条共用同一表面语言。
 */
export const HERO_SURFACE =
  'relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card'

/** 页头卡右上角柔光(纯装饰,pointer-events-none) */
export const HERO_GLOW =
  'pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl'

/**
 * 头卡图标砖的「主色皮肤」:描边 + 淡主色底 + 主色字形。
 * 与任意图标砖几何(ICON_BRICK / 44 档)组合使用,颜色只在这里定义一档。
 */
export const ICON_TILE_TONE_PRIMARY =
  'border border-primary/20 bg-primary/10 text-primary shadow-elevation-sm'

/** 页头卡内的主色图标方砖几何(44×44,比卡片砖高一档,标识"这是页面级标题区") */
const HERO_TILE_GEOMETRY = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl'

/** 页头主色图标砖 = 44 档几何 + 主色皮肤(字符串与旧 HUB_TOKENS.heroIcon 逐字节一致) */
export const HERO_ICON_TILE = `${HERO_TILE_GEOMETRY} ${ICON_TILE_TONE_PRIMARY}`

/** 主色图标砖里的字形档位(20×20) */
export const HERO_ICON_GLYPH = 'h-5 w-5'

/** 页面主标题档位:手机 20px → 桌面 24px(与站内其它工作区页头一致) */
export const PAGE_TITLE = 'text-heading font-bold tracking-tight min-[768px]:text-display'

/** 页面描述文案样式 */
export const PAGE_DESCRIPTION = 'mt-1 text-label leading-relaxed text-muted-foreground'

/** 分组标题前置的主色圆点(分组锚点) */
export const SECTION_DOT = 'h-1.5 w-1.5 rounded-full bg-primary'

/** 分组标题文字 */
export const SECTION_TITLE = 'text-label font-semibold tracking-wide text-foreground'

/** 分组尾部的数量徽标 */
export const SECTION_COUNT =
  'rounded-full bg-muted px-2 py-0.5 text-label tabular-nums text-muted-foreground'

/** 轻量信息徽标(功能数等) */
export const CHIP =
  'inline-flex items-center gap-1 rounded-full border border-stroke-default bg-background/70 px-2.5 py-0.5 text-label text-muted-foreground backdrop-blur'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
