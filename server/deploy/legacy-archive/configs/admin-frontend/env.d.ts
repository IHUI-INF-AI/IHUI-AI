/// <reference types="vite/client" />
/// <reference path="./src/shims-vue.d.ts" />
/// <reference path="./src/auto-imports.d.ts" />
/// <reference path="./src/components.d.ts" />

// Vue模块类型声明
declare module "vue" {
  export * from "vue";
}

// Vue Router类型声明
declare module "vue-router" {
  export * from "vue-router";
}

// Vuex类型声明
declare module "vuex" {
  export * from "vuex";
}

// 注意：项目已完全迁移到 Lucide Icons，不再使用 @element-plus/icons-vue
// 如需图标类型声明，请使用 lucide-vue-next 的类型

// 全局声明 ImportMeta.env 类型
declare global {
  interface ImportMetaEnv {
    readonly MODE: string;
    readonly BASE_URL: string;
    readonly PROD: boolean;
    readonly DEV: boolean;
    readonly SSR: boolean;
    // Vue CLI 兼容性（向后兼容）
    readonly VUE_APP_TITLE?: string;
    readonly VUE_APP_BASE_API?: string;
    readonly VUE_APP_MAIN_APP_URL?: string;
    readonly VUE_APP_WEB_API_BASE?: string;
    readonly VUE_APP_WEB_URL?: string;
    // Vite 环境变量
    readonly VITE_APP_TITLE?: string;
    readonly VITE_BASE_API?: string;
    readonly VITE_MAIN_APP_URL?: string;
    readonly VITE_WEB_API_BASE?: string;
    readonly VITE_WEB_URL?: string;
    // OAuth2.1 配置
    readonly VITE_USE_OAUTH21?: string;
    readonly VITE_OAUTH21_TOKEN_ENDPOINT?: string;
    readonly VITE_OAUTH21_AUTHORIZATION_ENDPOINT?: string;
    // OAuth2 配置（向后兼容）
    readonly VITE_OAUTH2_TOKEN_ENDPOINT?: string;
    readonly VITE_OAUTH2_AUTHORIZATION_ENDPOINT?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

