/// <reference types="vite/client" />

// 图片文件类型声明
declare module '*.jpg' {
  const src: string
  export default src
}

declare module '*.jpeg' {
  const src: string
  export default src
}

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.gif' {
  const src: string
  export default src
}

declare module '*.svg' {
  const src: string
  export default src
}

declare module '*.webp' {
  const src: string
  export default src
}

interface ImportMetaEnv {
  // Vite默认环境变量
  readonly MODE: string
  readonly BASE_URL: string
  readonly PROD: boolean
  readonly DEV: boolean
  readonly SSR: boolean

  // 应用基本配置
  readonly VITE_APP_TITLE: string
  readonly VITE_APP_DEMO_MODE: string
  readonly VITE_DEMO_MODE: string
  readonly VITE_ENABLE_MOCK?: string
  readonly VITE_API_BASE_URL: string
  readonly VITE_ENCRYPTION_KEY: string
  readonly VITE_APP_VERSION: string
  readonly VITE_UPLOAD_URL: string
  readonly VITE_WS_URL: string

  // 构建平台配置
  readonly VITE_BUILD_PLATFORM?: 'web' | 'h5' | 'alipay' | 'electron'

  // 管理员配置
  readonly VITE_ADMIN_OVERRIDE?: string

  // WebSocket配置
  readonly VITE_WS_BASE_URL?: string

  // CDN配置
  readonly VITE_CDN_ENABLED?: string
  readonly VITE_CDN_BASE_URL?: string

  // 主项目URL
  readonly VITE_MAIN_PROJECT_URL?: string

  // E2E测试配置
  readonly VITE_APP_E2E?: string

  // 开发路由审计
  readonly VITE_DEV_ROUTE_AUDIT?: string
  readonly VITE_DEV_ROUTE_AUDIT_NAVIGATE?: string

  // 调试可见性
  readonly VITE_DEBUG_VISIBILITY?: string

  // 第三方登录开关
  readonly VITE_GOOGLE_ENABLED?: string

  // 应用Logo
  readonly VITE_APP_LOGO?: string


  // Google登录
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_GOOGLE_REDIRECT_URI: string

  // GitHub登录
  readonly VITE_GITHUB_CLIENT_ID: string
  readonly VITE_GITHUB_REDIRECT_URI: string

  // Apple登录
  readonly VITE_APPLE_CLIENT_ID: string
  readonly VITE_APPLE_REDIRECT_URI: string

  // 阿里云登录
  readonly VITE_ALIYUN_CLIENT_ID: string
  readonly VITE_ALIYUN_REDIRECT_URI: string

  // YouTube登录
  readonly VITE_YOUTUBE_CLIENT_ID: string
  readonly VITE_YOUTUBE_REDIRECT_URI: string
  readonly VITE_YOUTUBE_SCOPE?: string

  // CSDN登录
  readonly VITE_CSDN_CLIENT_ID: string
  readonly VITE_CSDN_REDIRECT_URI: string

  // 抖音登录
  readonly VITE_DOUYIN_CLIENT_ID: string
  readonly VITE_DOUYIN_REDIRECT_URI: string

  // 小红书登录
  readonly VITE_XIAOHONGSHU_CLIENT_ID?: string
  readonly VITE_XIAOHONGSHU_REDIRECT_URI?: string
  readonly VITE_XIAOHONGSHU_SCOPE?: string
  readonly VITE_XIAOHONGSHU_ENABLED?: string

  // 飞书登录
  readonly VITE_FEISHU_APP_ID?: string
  readonly VITE_FEISHU_REDIRECT_URI?: string
  readonly VITE_FEISHU_SCOPE?: string
  readonly VITE_FEISHU_ENABLED?: string

  // 钉钉登录
  readonly VITE_DINGTALK_CORP_ID?: string
  readonly VITE_DINGTALK_LOGIN_APP_ID?: string
  readonly VITE_DINGTALK_REDIRECT_URI?: string

  // 企业微信登录
  readonly VITE_WORKWECHAT_ENABLED?: string
  readonly VITE_WORKWECHAT_REDIRECT_URI?: string
  readonly VITE_WORKWECHAT_SCOPE?: string
  readonly VITE_WECOM_CORP_ID?: string

  // 日志 & 构建平台
  readonly VITE_LOG_LEVEL?: string
  readonly VITE_JAVA_API_BASE_URL?: string
  readonly VITE_ADMIN_API_BASE?: string
  readonly VITE_DEV_HMR_PROTOCOL?: string

  // 其他环境变量可以在这里添加
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
