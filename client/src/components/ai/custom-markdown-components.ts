/**
 * markstream-vue 自定义组件映射
 * 用于扩展 Markdown 渲染功能
 */

import type { Component } from 'vue'

/**
 * 自定义组件映射
 * key: Markdown 中的组件名称（如 :::component-name）
 * value: 异步组件加载函数
 */
// 默认自定义组件映射
// 注意：这些组件需要根据 markstream-vue 的自定义组件规范实现
// 目前提供基础框架，可以根据需要扩展
export const customMarkdownComponents: Record<string, () => Promise<Component>> = {
  // Alert 组件已实现，可以注册使用
  // 'alert': () => import('@/components/markdown/Alert.vue').then(m => m.default || m),
  // 'warning': () => import('@/components/markdown/Alert.vue').then(m => m.default || m),
  // 'info': () => import('@/components/markdown/Alert.vue').then(m => m.default || m),
  // 'tip': () => import('@/components/markdown/Alert.vue').then(m => m.default || m),
  // 其他组件可以根据需要实现和注册
  // 'card': () => import('@/components/markdown/Card.vue').then(m => m.default || m),
  // 'collapse': () => import('@/components/markdown/Collapse.vue').then(m => m.default || m),
  // 'tabs': () => import('@/components/markdown/Tabs.vue').then(m => m.default || m),
}

/**
 * 创建自定义组件加载器
 * @param componentName 组件名称
 * @returns 组件加载函数
 */
export function createCustomComponentLoader(componentName: string): () => Promise<Component> {
  return customMarkdownComponents[componentName] || (() => Promise.resolve({} as Component))
}

/**
 * 注册自定义组件
 * @param name 组件名称
 * @param loader 组件加载函数
 */
export function registerCustomComponent(name: string, loader: () => Promise<Component>): void {
  customMarkdownComponents[name] = loader
}

/**
 * 获取所有已注册的自定义组件名称
 */
export function getRegisteredComponents(): string[] {
  return Object.keys(customMarkdownComponents)
}
