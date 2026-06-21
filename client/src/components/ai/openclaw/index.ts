/**
 * OpenClaw 容器组件
 * 用于 AI 聊天功能扩展
 */

import { h, defineComponent, type VNode } from 'vue'

/**
 * OpenClaw 容器属性
 */
export interface OpenClawContainerProps {
  visible?: boolean
  className?: string
}

/**
 * OpenClaw 容器组件
 * 用于包裹 AI 聊天相关的扩展功能
 */
export const OpenClawContainer = defineComponent({
  props: {
    visible: {
      type: Boolean,
      default: true
    },
    className: {
      type: String,
      default: ''
    }
  },
  setup(props: OpenClawContainerProps, { slots }: { slots: Record<string, (() => VNode[]) | undefined> }) {
    return (): VNode | null => {
      if (props.visible === false) return null

      return h(
        'div',
        {
          class: ['openclaw-container', props.className].filter(Boolean).join(' '),
        },
        slots.default?.()
      )
    }
  },
})

/**
 * OpenClaw 工具项
 */
export interface OpenClawTool {
  id: string
  name: string
  icon?: string
  description?: string
  action: () => void | Promise<void>
}

/**
 * OpenClaw 配置
 */
export interface OpenClawConfig {
  tools: OpenClawTool[]
  enabled: boolean
}

/**
 * 创建默认配置
 */
export function createDefaultConfig(): OpenClawConfig {
  return {
    tools: [],
    enabled: true,
  }
}

export default OpenClawContainer
