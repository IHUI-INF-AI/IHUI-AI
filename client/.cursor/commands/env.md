# 环境变量配置

生成环境变量配置文件和类型定义。

## 指令

请根据以下需求生成环境变量配置：

{{selection}}

### 环境变量文件

1. **.env.example** - 示例配置
```bash
# 应用配置
VITE_APP_TITLE=应用名称
VITE_APP_BASE_URL=/

# API 配置
VITE_API_BASE_URL=http://localhost:3000
VITE_API_TIMEOUT=10000

# 第三方服务
VITE_SENTRY_DSN=
VITE_GA_ID=

# 功能开关
VITE_ENABLE_MOCK=false
VITE_ENABLE_DEVTOOLS=true
```

2. **.env.development** - 开发环境
```bash
VITE_API_BASE_URL=http://localhost:3000
VITE_ENABLE_MOCK=true
VITE_ENABLE_DEVTOOLS=true
```

3. **.env.production** - 生产环境
```bash
VITE_API_BASE_URL=https://api.example.com
VITE_ENABLE_MOCK=false
VITE_ENABLE_DEVTOOLS=false
```

### 类型定义

```typescript
// env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  readonly VITE_APP_BASE_URL: string
  readonly VITE_API_BASE_URL: string
  readonly VITE_API_TIMEOUT: string
  readonly VITE_ENABLE_MOCK: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

### 使用封装

```typescript
// config/env.ts
export const env = {
  appTitle: import.meta.env.VITE_APP_TITLE,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  apiTimeout: Number(import.meta.env.VITE_API_TIMEOUT) || 10000,
  enableMock: import.meta.env.VITE_ENABLE_MOCK === 'true',
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
}
```

### 输出

1. 各环境的 .env 文件内容
2. TypeScript 类型定义
3. 环境变量使用封装
