/**
 * AgentCapabilityPicker 类型定义
 */
import type { CapabilityItem, CapabilityCategory } from '@/api/capabilities'

export type { CapabilityItem, CapabilityCategory }

export interface AgentCapabilityPickerProps {
  /** 是否显示 */
  modelValue: boolean
  /** 当前选中的能力 ID */
  selectedCapabilityId?: string
  /** 是否启用自动匹配 */
  autoMatchEnabled?: boolean
  /** 主题模式 */
  isDark?: boolean
}

export interface AgentCapabilityPickerEmits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'update:selectedCapabilityId', id: string): void
  (e: 'update:autoMatchEnabled', enabled: boolean): void
  (e: 'select', item: CapabilityItem | null): void
  (e: 'invoke', item: CapabilityItem, input: string): void
}
