/// <reference types="vite/client" />
/// <reference path="./src/shims-vue.d.ts" />
/// <reference path="./src/vue-module.d.ts" />
/// <reference path="./src/auto-imports.d.ts" />
/// <reference path="./src/components.d.ts" />
/// <reference path="./src/vite-env.d.ts" />

// Vue类型通过@vue/tsconfig自动处理，无需手动声明
// 注意：main.ts和stores文件需要显式导入Vue，不能使用auto-import

// Vue I18n类型声明
declare module 'vue-i18n' {
  export function useI18n(): {
    t: (key: string, ...args: unknown[]) => string
    locale: { value: string }
    [key: string]: unknown
  }
}

// @vue-office/pptx 无类型声明时声明为 any
declare module '@vue-office/pptx' {
  const VueOfficePptx: unknown
  export default VueOfficePptx
}

// Element Plus Icons 类型声明已移除
// 项目已完全迁移到 Lucide Icons，不再需要 Element Plus Icons 类型声明

// 组件类型声明
declare module '@/components/PaginationDots.vue' {
  const component: { __name?: string; __props?: Record<string, unknown> }
  export default component
}

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

// 全局声明 ImportMeta.env 类型（确保在所有文件中可用）
declare global {
  interface ImportMetaEnv {
    // Vite默认环境变量
    readonly MODE: string
    readonly BASE_URL: string
    readonly PROD: boolean
    readonly DEV: boolean
    readonly SSR: boolean

    // 应用基本配置
    readonly VITE_APP_TITLE?: string
    readonly VITE_APP_DEMO_MODE?: string
    /** 开发环境：启用管理员本地覆盖（仅与 VITE_ADMIN_OVERRIDE_UUID/PHONE 配合使用，勿写死凭据） */
    readonly VITE_ADMIN_OVERRIDE?: string
    readonly VITE_ADMIN_OVERRIDE_UUID?: string
    readonly VITE_ADMIN_OVERRIDE_PHONE?: string
    readonly VITE_API_BASE_URL?: string
    readonly VITE_ENCRYPTION_KEY?: string
    readonly VITE_APP_VERSION?: string
    readonly VITE_UPLOAD_URL?: string
    readonly VITE_WS_URL?: string

    // 支付宝登录
    readonly VITE_ALIPAY_APP_ID?: string
    readonly VITE_ALIPAY_REDIRECT_URI?: string
    readonly VITE_ALIPAY_SANDBOX_MODE?: string

    // Google登录
    readonly VITE_GOOGLE_CLIENT_ID?: string
    readonly VITE_GOOGLE_REDIRECT_URI?: string

    // GitHub登录
    readonly VITE_GITHUB_CLIENT_ID?: string
    readonly VITE_GITHUB_REDIRECT_URI?: string

    // Apple登录
    readonly VITE_APPLE_CLIENT_ID?: string
    readonly VITE_APPLE_REDIRECT_URI?: string

    // 阿里云登录
    readonly VITE_ALIYUN_CLIENT_ID?: string
    readonly VITE_ALIYUN_REDIRECT_URI?: string

    // YouTube登录
    readonly VITE_YOUTUBE_CLIENT_ID?: string
    readonly VITE_YOUTUBE_REDIRECT_URI?: string
    readonly VITE_YOUTUBE_SCOPE?: string

    // CSDN登录
    readonly VITE_CSDN_CLIENT_ID?: string
    readonly VITE_CSDN_REDIRECT_URI?: string

    // 抖音登录
    readonly VITE_DOUYIN_CLIENT_ID?: string
    readonly VITE_DOUYIN_REDIRECT_URI?: string

    // Coze API
    readonly VITE_COZE_API_TOKEN?: string
    readonly VITE_COZE_WORKFLOW_ID?: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

// Vue类型通过@vue/tsconfig自动处理，无需手动声明
// defineProps, defineEmits等是Vue编译时宏，在script setup中自动可用
// 注意：main.ts和stores文件需要显式导入Vue，不能使用auto-import
// ImportMeta.env类型已在上面全局声明

// 声明unplugin-vue-components模块
declare module 'unplugin-vue-components/vite' {
  import type { Plugin } from 'vite'
  export default function Components(options?: Record<string, unknown>): Plugin
}

declare module 'unplugin-vue-components/resolvers' {
  export function ElementPlusResolver(options?: Record<string, unknown>): {
    name: string
    from: string
  }
}

declare module 'unplugin-auto-import/vite' {
  import type { Plugin } from 'vite'
  export default function AutoImport(options?: Record<string, unknown>): Plugin
}

// 可选依赖：仅当 VITE_USE_VIZE=true 时动态加载，避免 vue-tsc 报错找不到模块
declare module '@vizejs/vite-plugin' {
  import type { Plugin } from 'vite'
  function vizePlugin(options?: { include?: RegExp; exclude?: RegExp[]; isProduction?: boolean; sourceMap?: boolean }): Plugin
  export default vizePlugin
}

// DOMRectReadOnly 类型声明
interface DOMRectReadOnly {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
  toJSON(): any
}

// IntersectionObserver 类型由浏览器和 TypeScript DOM 类型库提供，无需重复声明

// UniApp 类型声明（用于跨平台 composables）
declare const uni: {
  navigateTo(options: { url: string; success?: () => void; fail?: (err: unknown) => void }): void
  navigateBack(options: { delta?: number; success?: () => void; fail?: (err: unknown) => void }): void
  redirectTo(options: { url: string; success?: () => void; fail?: (err: unknown) => void }): void
  reLaunch(options: { url: string; success?: () => void; fail?: (err: unknown) => void }): void
  switchTab(options: { url: string; success?: () => void; fail?: (err: unknown) => void }): void
  showLoading(options: { title: string; mask?: boolean }): void
  hideLoading(): void
  showToast(options: { title: string; icon?: string; duration?: number }): void
  getStorageSync(key: string): unknown
  setStorageSync(key: string, value: unknown): void
  removeStorageSync(key: string): void
  request(options: { url: string; method?: string; data?: unknown; header?: Record<string, string>; timeout?: number; success?: (res: { data: unknown }) => void; fail?: (err: { errMsg?: string } | unknown) => void }): void
  connectSocket(options: { url: string; success?: () => void; fail?: (err: unknown) => void }): { onMessage: (cb: (res: { data: unknown }) => void) => void; onClose: (cb: () => void) => void; onError: (cb: () => void) => void; send: (options: { data: string }) => void; close: (options?: Record<string, unknown>) => void }
  requestPayment(options: { provider: string; [key: string]: unknown; success?: () => void; fail?: (err: unknown) => void }): void
}

declare const plus: unknown

declare function getCurrentPages(): Array<{ route?: string; options?: Record<string, unknown> }>
