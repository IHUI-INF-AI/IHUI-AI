/**
 * packages/app 共享设计令牌(RN 端)。
 *
 * 单一源头:所有 RN 风格 tokens 定义在 @ihui/design-tokens/src/rn-tokens.ts,
 * 本文件仅 re-export 并保留历史命名,确保 mobile-rn / packages/app 内部代码向后兼容。
 *
 * 跨端共享组件统一引用此文件,根治颜色漂移 + 为暗色模式铺路。
 * mobile-rn 端可 re-export 或同步引用,确保品牌色一致。
 */
import {
  rnTokens,
  rnLightTokens,
  rnDarkTokens,
  getRnTokens,
  type RnTokens,
  type RnThemeMode,
  type RnThemeTokens,
} from '@ihui/design-tokens'

/** RN 端基础 tokens(向后兼容 RootNavigator Tab Bar) */
export const tokens: RnTokens = rnTokens

/** 已解析主题(无 'system') */
export type AppThemeMode = RnThemeMode

/** 动态主题 token 集。相比 base tokens 增加 surface.bg(主背景),其余字段对齐。 */
export type AppThemeTokens = RnThemeTokens

/** 基础 tokens 类型(向后兼容) */
export type AppTokens = RnTokens

/** 浅色 token 集(re-export 自 @ihui/design-tokens) */
export const lightTokens: AppThemeTokens = rnLightTokens

/** 深色 token 集(re-export 自 @ihui/design-tokens) */
export const darkTokens: AppThemeTokens = rnDarkTokens

/** 按已解析主题返回对应 token 集 */
export function getTokens(theme: AppThemeMode): AppThemeTokens {
  return getRnTokens(theme)
}
