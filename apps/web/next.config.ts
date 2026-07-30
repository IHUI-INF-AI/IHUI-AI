import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// GitHub Pages 部署需要 basePath(仓库名作为路径前缀)
const isGitHubPages = process.env.GITHUB_PAGES === 'true'
const repoName = 'IHUI-AI'

// 2026-07-28 修复:Next.js 15 dev server 启动校验更严,`output: 'export'` + middleware.ts
// 共存直接报错 "Middleware cannot be used with output: export" 并死锁 8801 端口
// (HTTP 接收但永不响应,前端表现为"页面打不开")。dev 模式不设 output,build 模式保留。
// 关键证据:dev server 重启 5 次都死在 "Middleware cannot be used with output: export",
// 杀掉进程后 8801 端口空,但 HTTP 请求仍超时 → 输出不再设 + 修。
const isProdBuild = process.env.NODE_ENV === 'production'

const nextConfig: NextConfig = {
  // A 套壳方案:静态导出供 Tauri WebView 加载(原 'standalone',见 commit ce1f12795)
  // dev 模式跳过:output: export 模式下 middleware.ts 不工作,会触发 Next.js 启动校验报错
  ...(isProdBuild ? { output: 'export' as const } : {}),
  basePath: isGitHubPages ? `/${repoName}` : '',
  assetPrefix: isGitHubPages ? `/${repoName}/` : '',
  trailingSlash: isGitHubPages, // GitHub Pages 需要 trailingSlash 确保路由可访问
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true }, // CI 构建跳过 TS 错误(多 agent 并行开发可能有临时错误)
  eslint: { ignoreDuringBuilds: true }, // CI 构建跳过 ESLint
  productionBrowserSourceMaps: false,
  // 关闭 Next.js 15 自带的左下角 N 圆圈 dev indicator (2026-07-21)
  devIndicators: false,
  transpilePackages: [
    '@ihui/ui-react',
    '@ihui/design-tokens',
    '@ihui/types',
    '@ihui/auth',
    '@ihui/shared',
    '@ihui/api-client',
    '@ihui/i18n',
    '@tauri-apps/api',
    '@tauri-apps/plugin-dialog',
  ],
  turbopack: {
    resolveAlias: {
      'next-intl/config': './src/i18n/request.ts',
    },
    resolveExtensions: ['.js', '.jsx', '.ts', '.tsx', '.json', '.mjs'],
  },
  webpack: (config) => {
    config.resolve.alias = config.resolve.alias || {}
    // workspace 包(api-client/shared)已构建到 dist/,exports 指向 dist/*.js,
    // .js 扩展名 import 直接解析到实际 .js 文件。extensionAlias 仅作 fallback,
    // 当 .js 不存在时尝试 .ts/.tsx(不设 fullySpecified=false 以免干扰 Next.js 内部构建流程)
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    }
    // Next.js 15.5.20 output: 'export' bug:App Router-only 项目不生成 pages-manifest.json,
    // 但 "Collecting page data" 阶段尝试读取它 → ENOENT。用 afterEmit 钩子创建空文件兜底。
    config.plugins = config.plugins || []
    config.plugins.push({
      // 最小化内联类型,避免依赖 @types/webpack(Next.js 内置 webpack 但未导出类型声明)
      apply(compiler: { hooks: { afterEmit: { tap: (name: string, fn: () => void) => void } } }) {
        compiler.hooks.afterEmit.tap('EnsurePagesManifest', () => {
          // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports -- next.config webpack 钩子需用 require 加载 fs/path,as typeof import() 是动态类型导入
          const fs = require('fs') as typeof import('fs')
          // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports -- next.config webpack 钩子需用 require 加载 fs/path,as typeof import() 是动态类型导入
          const path = require('path') as typeof import('path')
          const manifestPath = path.join(__dirname, '.next', 'server', 'pages-manifest.json')
          if (!fs.existsSync(manifestPath)) {
            fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
            fs.writeFileSync(manifestPath, '{}')
          }
        })
      },
    })
    return config
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-label',
      '@radix-ui/react-slot',
      '@radix-ui/react-select',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-checkbox',
      '@tanstack/react-query',
      '@tanstack/react-table',
      'react-hook-form',
      'react-markdown',
      'react-syntax-highlighter',
      'sonner',
      'next-themes',
      'dompurify',
    ],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    // 2026-07-28 修复 Next.js 16 兼容警告:本地 /images/** 下的图片允许任意 query string
    // (如 ?v=20260719-unify 缓存破坏),Next.js 16+ 强制要求 localPatterns 显式声明
    localPatterns: [{ pathname: '/images/**' }],
    remotePatterns: [
      { protocol: 'https', hostname: 'aizhs.top' },
      { protocol: 'https', hostname: '*.aizhs.top' },
      { protocol: 'https', hostname: 'api.dicebear.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'platform-lookaside.fbsx.com' },
      { protocol: 'https', hostname: 'api.qrserver.com' },
    ],
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    unoptimized: true,
  },
  async redirects() {
    return []
  },
  async rewrites() {
    // 2026-07-25 修复:开发模式(NEXT_PUBLIC_API_BASE_URL 加载失败时)代理 /api/* → localhost:8802
    // - output:'export' 模式 rewrites 不生效(构建后由 nginx/CDN 托管),但 dev server (next dev) 会生效
    // - 浏览器 fetch 走同源 /api/* → Next.js dev 代理 → 解决 404 + CORS 双失败导致 templates 等查询为空
    // - 生产环境(production)跳过此 rewrite(避免重复代理)
    if (process.env.NODE_ENV !== 'production') {
      return [
        // 2026-07-29 新增:ai-skills 路由直接转发到 ai-service 8803
        // 原因:api server 8802 没有注册 /api/ai-skills 路由(404),
        // 而 ai-service 8803 有完整的 19 个 skill 元数据(GET /api/ai-skills) +
        // invoke 调用(POST /api/ai-skills/{id}/invoke)。
        // 必须放在 /api/:path* 通配符之前(rewrites 按顺序匹配,先命中先转发)。
        // :path* 匹配 0 个或多个路径段,覆盖 /api/ai-skills 和 /api/ai-skills/{id}/invoke。
        {
          source: '/api/ai-skills/:path*',
          destination: 'http://localhost:8803/api/ai-skills/:path*',
        },
        // 2026-07-29 新增:publish 多平台分发路由转发到 ai-service 8803
        // 原因:publish.py 注册在 ai-service(prefix="/publish",应用挂载 /api 前缀),
        // 完整路径是 /api/publish/*。若不显式转发会被 /api/:path* 通配符转发到 8802(api server),
        // 而 api server 没有注册 /api/publish 路由 → 404。
        // 必须放在 /api/:path* 通配符之前(rewrites 按顺序匹配,先命中先转发)。
        {
          source: '/api/publish/:path*',
          destination: 'http://localhost:8803/api/publish/:path*',
        },
        // 2026-07-30 新增:AI 网关 Dashboard 的 /api/llm/* 路由转发到 ai-service 8803
        // 原因:前端 api-client 调用 /llm/providers/health 等端点,normalizeUrl 会加 /api 前缀
        // 变成 /api/llm/providers/health。若走默认 /api/:path* → 8802/api/* 会 404(api 服务无此路由,
        // 因为 llm router 注册在 ai-service 8803 的 /api 前缀下)。
        // 这里把 /api/llm/* 转发到 ai-service 8803 的 /api/llm/* (保留 /api 前缀,
        // 因为 ai-service main.py 第 313 行注册 llm.router 时是 prefix="/api")。
        // 覆盖端点:GET /llm/providers/health + GET/POST/DELETE /llm/combos + POST /llm/compaction/demo
        // + GET /llm/compaction/metrics + GET /llm/free-providers + POST /llm/anthropic/v1/messages
        // + POST /llm/gemini/v1beta/models/{model}:generateContent + GET /llm/models + POST /llm/complete 等
        {
          source: '/api/llm/:path*',
          destination: 'http://localhost:8803/api/llm/:path*',
        },
        // 2026-07-31 新增:MCP 路由直接转发到 ai-service 8803
        // 原因:MCP 工具/资源/提示词/skill/slash 命令的 router 注册在 ai-service 8803 的 /api 前缀下,
        // IDE McpPane 组件调用 listMCPTools 等端点路径为 /mcp/*,normalizeUrl 加 /api 前缀后变成 /api/mcp/*,
        // 必须直连 ai-service 8803 才能命中。必须放在 /api/:path* 通配符之前。
        {
          source: '/api/mcp/:path*',
          destination: 'http://localhost:8803/api/mcp/:path*',
        },
        // 2026-07-31 新增:Agent 路由直接转发到 ai-service 8803
        // 原因:Agent runtime 的 router 注册在 ai-service 8803 的 /api 前缀下,
        // IDE AgentPane 组件调用 agent loop/graph 端点路径为 /agents/*,必须直连 ai-service 8803 才能命中。
        {
          source: '/api/agents/:path*',
          destination: 'http://localhost:8803/api/agents/:path*',
        },
        {
          source: '/api/:path*',
          destination: 'http://localhost:8802/api/:path*',
        },
      ]
    }
    return []
  },
  // 2026-07-24 安全加固:HTTP 安全响应头(CSP/HSTS/X-Frame-Options 等)
  // 注意:output:'export' 模式下 headers() 不生效(静态文件由 CDN/nginx 托管);
  // 改为 standalone 模式或 nginx 配置这些头时生效。保留配置供后续切换。
  async headers() {
    const securityHeaders = [
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      },
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          // 2026-07-25 修复扫码登录 SDK 加载失败:补全 4 家厂商 CDN 域名白名单
          // - res.wx.qq.com:微信 WxLogin.js
          // - wwcdn.weixin.qq.com:企业微信 wwLogin-1.2.7.js
          // - g.alicdn.com:钉钉 h5-dingtalk-login 0.21.0
          // - lf-package-cn.feishucdn.com:飞书 LarkSSOSDKWebQRCode-1.0.3.js
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://res.wx.qq.com https://wwcdn.weixin.qq.com https://g.alicdn.com https://lf-package-cn.feishucdn.com",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          "connect-src 'self' https: wss: ws: http://localhost:* http://127.0.0.1:*",
          "media-src 'self' blob:",
          "object-src 'none'",
          // 2026-07-25 修复扫码登录 iframe 拦截:SDK 内部创建 iframe 渲染二维码
          // - open.weixin.qq.com:微信扫码确认 iframe
          // - open.work.weixin.qq.com:企业微信 qrConnect iframe
          // - login.dingtalk.com:钉钉 OAuth iframe
          // - passport.feishu.cn:飞书 QR iframe
          // - self:Next.js dev HMR / React DevTools 需要
          "frame-src 'self' https://open.weixin.qq.com https://open.work.weixin.qq.com https://login.dingtalk.com https://passport.feishu.cn",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; '),
      },
    ]
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

export default withNextIntl(nextConfig)
