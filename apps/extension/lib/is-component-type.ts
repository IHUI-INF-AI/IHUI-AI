/**
 * 判断值是否为可实例化的 React 组件类型(函数组件或 forwardRef/memo 等组件描述符)。
 *
 * 不能只用 `typeof x === 'function'` 判断:lucide-react 等图标库经 React.forwardRef
 * 创建组件,其值是对象描述符({ $$typeof: Symbol(react.forward_ref), render }),
 * typeof 为 'object'。若把它当文本子节点直接渲染,会触发 React 崩溃:
 * "Objects are not valid as a React child (found: object with keys {$$typeof, render})"。
 *
 * React 元素({$$typeof: react.element})是渲染结果而非组件类型,应直接渲染,故排除。
 */
import { isValidElement, type ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'

export function isComponentType(value: unknown): value is LucideIcon | ComponentType {
  if (typeof value === 'function') return true
  if (typeof value !== 'object' || value === null) return false
  if (isValidElement(value)) return false
  return typeof (value as { $$typeof?: unknown }).$$typeof !== 'undefined'
}
