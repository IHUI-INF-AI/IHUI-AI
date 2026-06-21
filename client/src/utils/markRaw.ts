/**
 * markRaw 工具函数
 *
 * 用于统一处理响应式对象中的组件 icon，避免 Vue 响应式系统对组件对象进行代理
 * 消除 "Vue received a Component which was made a reactive object" 警告
 *
 * @example
 * // 单个 icon 包装
 * import { House } from '@element-plus/icons-vue'
 * const item = { icon: markIcon(House), label: '首页' }
 *
 * // 数组批量包装
 * const items = markIcons([
 *   { icon: House, label: '首页' },
 *   { icon: User, label: '用户' },
 * ])
 */

import { markRaw, type Component } from 'vue'

/**
 * 包装单个组件为 markRaw，避免响应式代理
 * @param icon 组件对象
 * @returns markRaw 包装后的组件
 */
export function markIcon<T extends Component>(icon: T): T {
  return markRaw(icon)
}

/**
 * 批量包装数组中所有 icon 字段为 markRaw
 * 仅处理对象数组中名为 `icon` 的字段
 * @param items 含 icon 字段的对象数组
 * @returns 原数组（icon 字段已被 markRaw 包装）
 */
export function markIcons<T extends { icon?: Component }>(items: T[]): T[] {
  return items.map((item) => {
    if (item.icon) {
      item.icon = markRaw(item.icon) as T['icon']
    }
    return item
  })
}

/**
 * IconComponent 类型别名
 * 用于统一项目中所有 icon 字段的类型定义
 * 约束开发者使用 markRaw 包装的组件
 */
export type IconComponent = ReturnType<typeof markRaw<Component>>

export { markRaw } from 'vue'
