// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 生成的文档(PDF / Email HTML / 落地页 / 站内通知)配色唯一真相源(2026-09-06 立)。
 *
 * 背景:这些由 apps/api 运行时拼接的独立静态文档(非交互端共享 UI token),
 * 此前每个模板各自散落 hex。现统一到本模块一处,消费端只 import,实现全项目唯一 token。
 *
 * 规则:
 * - 中性灰/边框/状态色复用 chart-colors 既有常量(DOC_* = 引用),避免重复 token;
 * - 仅文档专属品牌深蓝与暗黑落地页背景新增 DOC_* 面值;
 * - 改色只改本文件,配合 check:cross-end-tokens / 全量盘点守护。
 */
import {
  CHART_BG_LIGHT,
  CHART_AXIS_LIGHT,
  CHART_TEXT_LIGHT,
  CHART_TEXT_DARK,
  CHART_BG_DARK,
  CHART_RED,
  BRAND_PRIMARY,
  BRAND_PRIMARY_DARK,
} from './chart-colors'

// ─── 明色文档配色 ──────────────────────────────────────────────────

/** 文档卡片/正文底色 */
export const DOC_BG = CHART_BG_LIGHT
/** 文档页面外层底色(email 外框) */
export const DOC_PAGE_BG = '#f6f7f9'
/** 卡片/分节次级底色(landing 卡片、验证码 chip) */
export const DOC_BG_CARD = '#f8f9fa'
/** 卡片 hover 底色 */
export const DOC_BG_HOVER = '#f1f3f5'
/** 标题/强文本(与 CHART_BG_DARK #0f172a 同值,语义为"亮色下的深色文字") */
export const DOC_TEXT_STRONG = CHART_BG_DARK
/** 正文次级文字 */
export const DOC_TEXT_BODY = CHART_TEXT_DARK
/** 弱化/页脚文字 */
export const DOC_TEXT_MUTED = CHART_TEXT_LIGHT
/** 分隔线/边框 */
export const DOC_BORDER = CHART_AXIS_LIGHT
/** 表格直边框(比 DOC_BORDER 略深一档) */
export const DOC_BORDER_HARD = '#e2e8f0'
/** 文档品牌主色(深橙,报表/证书标题;对齐全项目强调橙) */
export const DOC_BRAND = '#c2410c'
/** 文档品牌浅色强调(章节卡片底,orange-100) */
export const DOC_BRAND_SOFT = '#ffedd5'
/** 文档品牌橙浅档(orange-400,渐变装饰线/强调;与品牌深橙 #c2410c 同色调浅档) */
export const DOC_BRAND_LIGHT = '#fb923c'
/** CTA/主按钮品牌橙(浅一档,用于按钮 hover 态品牌) */
export const DOC_BRAND_HOVER = BRAND_PRIMARY_DARK

// ─── 暗色落地页配色 ────────────────────────────────────────────────

/** 暗色页面底色 */
export const DOC_BG_DARK = '#0a0a0a'
/** 暗色卡片底 */
export const DOC_BG_CARD_DARK = '#141414'
/** 暗色卡片 hover 底 */
export const DOC_BG_HOVER_DARK = '#1a1a1a'
/** 暗色正文 */
export const DOC_TEXT_DARK = '#f5f5f5'
/** 暗色边框 */
export const DOC_BORDER_DARK = '#2a2a2a'

// ─── 状态与通用 ────────────────────────────────────────────────────

/** 危险/置灰(设为不可用等),复用 chart 红 */
export const DOC_DANGER = CHART_RED
/** 品牌主蓝(CTA / 链接),与 BRAND_PRIMARY 同值 */
export const DOC_ACCENT = BRAND_PRIMARY