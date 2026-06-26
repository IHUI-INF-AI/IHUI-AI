/// <reference types="vite/client" />

// Vue和Vue生态系统模块的类型声明
// 这些声明让TypeScript知道这些模块存在

// Vue模块 - 让TypeScript知道模块存在，实际类型从node_modules加载
declare module 'vue' {
  // 导出基本类型，让TypeScript知道模块存在
  // 实际类型会通过skipLibCheck从node_modules/vue自动加载
  export function createApp(rootComponent: Component): App
  export function ref<T = unknown>(value?: T): { value: T }
  export function reactive<T extends object>(target: T): T
  export function computed<T>(fn: () => T): { value: T }
  export function computed<T>(options: { get: () => T; set: (value: T) => void }): { value: T }
  export function watch<T>(
    source: T | (() => T),
    callback: (newVal: T, oldVal: T) => void,
    options?: { immediate?: boolean; deep?: boolean; flush?: 'pre' | 'post' | 'sync' }
  ): () => void
  export function watchEffect(
    effect: () => void,
    options?: { flush?: 'pre' | 'post' | 'sync' }
  ): () => void
  export function onMounted(hook: () => void): void
  export function onUnmounted(hook: () => void): void
  export function onActivated(hook: () => void): void
  export function onDeactivated(hook: () => void): void
  export function onBeforeMount(hook: () => void): void
  export function onBeforeUnmount(hook: () => void): void
  export function onErrorCaptured(
    hook: (err: Error, instance: ComponentPublicInstance | null, info: string) => boolean | void
  ): void
  export function provide<T>(key: InjectionKey<T> | string, value: T): void
  export function inject<T>(key: InjectionKey<T> | string): T | undefined
  export function nextTick(fn?: () => void): Promise<void>
  export function defineAsyncComponent<T>(loader: () => Promise<T>): { __asyncResolved?: T }
  export function defineComponent<T>(options: T): T
  export function h(
    type: string | Component,
    props?: Record<string, unknown> | null,
    children?: VNodeChild
  ): VNode
  export function toRef<T, K extends keyof T>(object: T, key: K): { value: T[K] }
  export function toRefs<T extends object>(object: T): { [K in keyof T]: { value: T[K] } }
  export function shallowRef<T>(value: T): { value: T }
  export function triggerRef(ref: { value: unknown }): void
  export function unref<T>(ref: T | { value: T }): T
  export function isRef(value: unknown): boolean
  export function markRaw<T>(value: T): T

  // 导出必要的类型
  export type Ref<T> = { value: T }
  export type ComputedRef<T> = { value: T }
  export type InjectionKey<_T> = symbol
  export type DefineComponent = { __isFragment?: never; __isTeleport?: never; __isSuspense?: never }
  export type Component = { __name?: string; __props?: Record<string, unknown> }
  export type ComponentPublicInstance = {
    $el: Element
    $data: Record<string, unknown>
    $props: Record<string, unknown>
    $attrs: Record<string, unknown>
    $refs: Record<string, unknown>
    $slots: Record<string, unknown>
    $root: ComponentPublicInstance | null
    $parent: ComponentPublicInstance | null
    $emit: (event: string, ...args: unknown[]) => void
    $forceUpdate: () => void
    $nextTick: (fn?: () => void) => Promise<void>
  } | null
  export type VNodeChild = string | number | boolean | VNode | VNode[] | null | undefined
  export type VNode = {
    type: string | Component
    props: Record<string, unknown> | null
    children: VNodeChild
  }
  export type App = {
    use: (plugin: Plugin, options?: unknown) => App
    provide: <T>(key: InjectionKey<T> | string, value: T) => App
    component: (name: string, component: Component) => App
    directive: (name: string, directive: Directive) => App
    mount: (selector: string | Element) => ComponentPublicInstance
    unmount: () => void
    config: {
      globalProperties: Record<string, unknown>
    }
  }
  export type Directive = {
    mounted?: (el: Element, binding: DirectiveBinding) => void
    updated?: (el: Element, binding: DirectiveBinding) => void
    unmounted?: (el: Element, binding: DirectiveBinding) => void
  }
  export type DirectiveBinding = {
    value: unknown
    oldValue: unknown
    arg?: string
    modifiers: Record<string, boolean>
  }
  export type Plugin = {
    install: (app: App, ...options: unknown[]) => void
  }
}

declare module 'vue-i18n' {
  interface I18n {
    global: {
      locale: { value: string } | string
      t: (key: string, ...args: unknown[]) => string
    }
    install: (app: unknown, ...options: unknown[]) => void
  }
  export function createI18n(options: {
    legacy?: boolean
    locale: string
    messages: Record<string, Record<string, unknown>>
    compilerOptions?: {
      isCustomElement?: (tag: string) => boolean
      whitespace?: 'condense' | 'preserve'
    }
    fallbackWarn?: boolean
    missingWarn?: boolean
  }): I18n
  export function useI18n(): {
    t: (key: string, ...args: unknown[]) => string
    te: (key: string) => boolean
    locale: { value: string }
    [key: string]: unknown
  }
}

// Element Plus Icons 类型声明已移除
// 项目已完全迁移到 Lucide Icons，不再需要 Element Plus Icons 类型声明

// 组件类型声明 - 使用Component类型

declare module '@/components/user/XiahuaSvgComplete.vue' {
  const component: { __name?: string; __props?: Record<string, unknown> }
  export default component
}

declare module '@/components/ai/AIChatInputBox.vue' {
  const component: { __name?: string; __props?: Record<string, unknown> }
  export default component
}

declare module '@/components/Footer.vue' {
  const component: { __name?: string; __props?: Record<string, unknown> }
  export default component
}

declare module '@/components/AnimatedBlobText.vue' {
  const component: { __name?: string; __props?: Record<string, unknown> }
  export default component
}

declare module '@/components/SpotlightEffect.vue' {
  const component: { __name?: string; __props?: Record<string, unknown> }
  export default component
}

declare module '@/components/IhuiAiEffectsLayer.vue' {
  const component: { __name?: string; __props?: Record<string, unknown> }
  export default component
}
