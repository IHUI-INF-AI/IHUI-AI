/// <reference types="vite/client" />

/* eslint-disable @typescript-eslint/no-explicit-any */

// 声明路径别名
declare module '@/*' {
  const value: any
  export default value
}

// 声明components模块
declare module '@/components/*' {
  const value: { __name?: string; __props?: Record<string, unknown> }
  export default value
}

// 声明composables模块
declare module '@/composables/*' {
  const value: (...args: any[]) => unknown
  export default value
}

// 声明utils模块
declare module '@/utils/*' {
  const value: Record<string, unknown> | ((...args: any[]) => unknown)
  export default value
}

// 声明api模块
declare module '@/api/*' {
  const value: Record<string, (...args: any[]) => Promise<unknown>>
  export default value
}

// 声明views模块
declare module '@/views/*' {
  const value: { __name?: string; __props?: Record<string, unknown> }
  export default value
}

// 声明styles模块
declare module '@/styles/*' {
  const value: string
  export default value
}

// 声明assets模块
declare module '@/assets/*' {
  const value: string
  export default value
}

// 声明types模块
declare module '@/types/*' {
  const value: Record<string, unknown>
  export default value
}

// 声明services模块
declare module '@/services/*' {
  const value: Record<string, unknown> | ((...args: any[]) => unknown)
  export default value
}

// 声明config模块
declare module '@/config/*' {
  const value: Record<string, unknown>
  export default value
}

// 声明features模块
declare module '@/features/*' {
  const value: Record<string, unknown>
  export default value
}

// 声明docs模块
declare module '@/docs/*' {
  const value: string | Record<string, unknown>
  export default value
}

// 声明locales模块
declare module '@/locales/*' {
  const value: Record<string, unknown>
  export default value
}

// 声明router模块
declare module '@/router/*' {
  const value: Record<string, unknown>
  export default value
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare module './components/agents/AgentsFilterBar.vue' {
  const component: { __name?: string; __props?: Record<string, unknown> }
  export default component
}

declare module './components/agents/AgentCard.vue' {
  const component: { __name?: string; __props?: Record<string, unknown> }
  export default component
}

declare module './components/agents/AgentsEmptyState.vue' {
  const component: { __name?: string; __props?: Record<string, unknown> }
  export default component
}

declare module '@/components/agents/AgentsFilterBar.vue' {
  const component: { __name?: string; __props?: Record<string, unknown> }
  export default component
}

declare module '@/components/agents/AgentCard.vue' {
  const component: { __name?: string; __props?: Record<string, unknown> }
  export default component
}

declare module '@/components/agents/AgentsEmptyState.vue' {
  const component: { __name?: string; __props?: Record<string, unknown> }
  export default component
}

declare module '@/components/admin/AdminEditDialog.vue' {
  export interface FormFieldOption {
    label: string
    value: string | number
  }
  export interface FormField {
    prop: string
    label: string
    type?: string
    required?: boolean
    options?: FormFieldOption[]
    [key: string]: unknown
  }
  const component: { __name?: string; __props?: Record<string, unknown> }
  export default component
}

declare module '@/components/ErrorNotification.vue' {
  export interface ErrorInfo {
    message: string
    type?: string
    [key: string]: unknown
  }
  const component: { __name?: string; __props?: Record<string, unknown> }
  export default component
}
