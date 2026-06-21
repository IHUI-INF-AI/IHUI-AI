/**
 * 开放平台统一图标常量
 * 避免重复导入，统一管理图标
 */
import {
  Odometer,
  Document,
  Cpu,
  UserFilled,
  Connection,
} from '@element-plus/icons-vue'

// 使用 Document 作为 Code 图标的别名（Element Plus 没有独立的 Code 图标）
export const Code = Document

export const FeatureIcons = {
  Dashboard: Odometer,
  SDKs: Code,
  Models: Cpu,
  Agents: UserFilled,
  APIs: Connection,
  Documents: Document,
} as const

export type FeatureIconType = keyof typeof FeatureIcons
