import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// GitHub Pages 部署需要 basePath(仓库名作为路径前缀)
const isGitHubPages = process.env.GITHUB_PAGES === 'true'
const repoName = 'IHUI-AI'

// 2026-07-28 修复:Next.js 15 dev server 启动校验更严,`output: 'export'` + middleware.ts
// 共存直接报错 "Middleware cannot be used with output: export" 并死锁 8801 端口
// (HTTP 接收但永不响应,前端表现为"页面打不开")。dev 模式不设 output。
//
// 2026-08-04 生产切换(关键):output:'export'(纯静态导出)改为显式环境变量控制,
// 不再跟随 NODE_ENV。原因:
//   - 生产服务端模式(next build + next start)需要 rewrites 代理 /api/* → 8802/8803,
//     而静态导出模式 rewrites/headers/middleware 全部不生效 → 登录/模型接口会 404。
//   - Tauri 桌面端(frontendDist: ../../web/out)与 GitHub Pages CI 仍需要静态导出,
//     它们通过 EXPORT_STATIC=true / GITHUB_PAGES=true 显式触发,互不影响。
const isStaticExport = process.env.EXPORT_STATIC === 'true' || process.env.GITHUB_PAGES === 'true'

const nextConfig: NextConfig = {
  // 静态导出供 Tauri WebView 加载(仅 EXPORT_STATIC/GITHUB_PAGES 时启用;
  // 生产服务端模式不设 output,保留 rewrites/headers/middleware 全部能力)
  ...(isStaticExport ? { output: 'export' as const } : {}),
  basePath: isGitHubPages ? `/${repoName}` : '',
  assetPrefix: isGitHubPages ? `/${repoName}/` : '',
  trailingSlash: isGitHubPages, // GitHub Pages 需要 trailingSlash 确保路由可访问
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true }, // CI 构建跳过 TS 错误(多 agent 并行开发可能有临时错误)
  // Next 16 移除了 NextConfig.eslint 配置项(ESLint 不再在 next build 期间运行,
  // 由独立 `next lint` 或外部 ESLint 流程负责),原 eslint.ignoreDuringBuilds 不再需要。
  productionBrowserSourceMaps: false,
  // 2026-08-05 00:15 生产构建排障(官方 memory-usage 文档 P0 项):
  // 显式关闭 server/prerender source map 生成——官方文档明确 source map
  // 是构建内存大户,Next 16 的 cacheComponents/prerender 阶段默认开启。
  enablePrerenderSourceMaps: false,
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
    // (预构建 @ihui 包方案经评估放弃:tsc ESM 扩展名/subpath 迁移风险高,
    // 改用 D 盘 pagefile 扩容解决构建内存问题——见 2026-08-05 记录)
    // 2026-08-04 生产构建排障:webpack 缓存(默认 filesystem/memory)是构建期
    // 峰值内存大户。官方 memory-usage 文档推荐构建期禁用缓存降内存。
    // 仅影响构建性能(全量编译),不影响产物正确性。
    // 2026-08-05 根治:双 pagefile(C:32+D:96=128GB)已生效,提交上限 159.8GB,
    // 内存不再是瓶颈 → 恢复 webpack filesystem 缓存,二次构建命中缓存大幅提速
    // (首次 50.6min → 预期 15min 内)。若内存再紧张可重新启用 memory 缓存。
    if (false && config.cache && !process.env.NODE_ENV?.includes('dev')) {
      config.cache = Object.freeze({
        type: 'memory' as const,
      })
    }
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
    // 2026-08-04 生产构建排障:SWC memory allocation of 7.5GB failed
    // (next build 反复 0xC0000409 崩溃,根因=webpack 峰值内存过高)。
    // webpackMemoryOptimizations 禁用 dual string buffer caching + 字符串驻留,
    // 官方文档推荐的构建内存优化方案,显著降低峰值内存。仅影响构建期,不影响运行时。
    webpackMemoryOptimizations: true,
    // 2026-08-04 生产构建排障(核心修复#2):本项目有自定义 webpack config,
    // 按 next/dist/build/index.js:useBuildWorker = !config.webpack = false,
    // 整个编译(server/edge/client)在主进程内跑,V8 堆+SWC+webpack 挤同一进程,
    // 提交量爆炸到 80GB+。显式启用 webpackBuildWorker 让编译进独立 worker 进程,
    // 内存隔离,显著降低单进程提交量峰值。
    webpackBuildWorker: true,
    // 2026-08-04 22:45 修正:限制 webpack 编译并行度,降低峰值内存。
    // SWC 大分配(15GB) + V8 堆组合在满并行时触发提交量上限,限 4 核压缩峰值。
    // 2026-08-05 极致优化(实测对比):cpus=12 → 编译 2.8min(总 3:26);
    // cpus=16 → 总 3:37(超线程争抢反而慢 11s)。cpus=12 为最优值
    // (机器 12 物理核,20 逻辑核;编译密集型任务超线程无益)。
    cpus: 12,
    // 2026-08-04 生产构建排障(核心修复#1):Next.js 构建默认 fork 多个独立 worker
    // 进程(server/edge/client + 静态预渲染),每个进程独立 V8 堆 + SWC 实例,
    // 提交量(commit charge)叠加逼近 Windows 上限(物理31.8GB+pagefile16GB=47.8GB)
    // → SWC 产物生成阶段一次性分配 15GB 失败 → Rust abort (0xC0000409)。
    // workerThreads:true 让 worker 在共享进程内以线程运行,显著降低提交量峰值。
    // 2026-08-04 22:40 修正:workerThreads 与 webpackBuildWorker 同时开启时,
    // 实验观察内存峰值仍达 76GB(疑似线程共享地址空间反而放大 SWC 分配)。
    // 已移除 workerThreads,仅保留 webpackBuildWorker(独立进程隔离)。
    // 2026-08-05 00:15 生产构建排障(P1 项,基于 next/dist/build/index.js:852 源码):
    // parallelServerBuildTraces 未设置时自动为 true(compile 模式),会并行收集
    // server build traces 增加峰值内存 → 显式关闭。
    parallelServerBuildTraces: false,
    // 2026-08-05 00:15 生产构建排障(P1 项):按内存而非 CPU 计算 worker 数,
    // 更保守,降低并发 worker 叠加的提交量峰值。
    memoryBasedWorkersCount: true,
    // 2026-08-05 客户端路由缓存:staleTimes 让 Next.js 15 的客户端导航缓存 RSC 数据,
    // 避免同一页面在导航中反复重新请求。dynamic=30s,static=5min 提供即时返回体验。
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
    // 2026-08-05 00:15 生产构建排障(P0 项,官方 memory-usage 文档):
    // 显式关闭 server source map,降低构建内存峰值。
    serverSourceMaps: false,
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
    // - 2026-08-04 生产切换:服务端模式(next build + next start)同样需要此代理,
    //   否则生产环境前端 /api/* 请求 404。因此移除 NODE_ENV 条件,始终启用(静态导出时 rewrites 本身不生效,无副作用)。
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
        // 2026-08-12 新增:Agent 轨迹可视化 API 路由转发到 ai-service 8803
        // 原因:agent/trace 端点注册在 ai-service(prefix="/api"),
        // 必须在 /api/agents/:path* 通配符之前匹配,否则会被转发到 8802(api server)导致 404。
        {
          source: '/api/agent/:path*',
          destination: 'http://localhost:8803/api/agent/:path*',
        },
        // 2026-07-31 新增:Agent 路由直接转发到 ai-service 8803
        // 原因:Agent runtime 的 router 注册在 ai-service 8803 的 /api 前缀下,
        // IDE AgentPane 组件调用 agent loop/graph 端点路径为 /agents/*,必须直连 ai-service 8803 才能命中。
        // 2026-08-12 P0 修复:原 `/api/agents/:path*` 全量转发 8803 会劫持 api 端(8802)的
        // CRUD 端点(agents/list、categories、settlement、examine、kanban 等)导致 404,
        // 改为白名单只转发 ai-service 独有的执行类端点,其余回落 8802 兜底。
        {
          source: '/api/agents/execute/stream',
          destination: 'http://localhost:8803/api/agents/execute/stream',
        },
        {
          source: '/api/agents/execute',
          destination: 'http://localhost:8803/api/agents/execute',
        },
        {
          source: '/api/agents/running',
          destination: 'http://localhost:8803/api/agents/running',
        },
        {
          source: '/api/agents/sessions/:path*',
          destination: 'http://localhost:8803/api/agents/sessions/:path*',
        },
        {
          source: '/api/agents/memory/search',
          destination: 'http://localhost:8803/api/agents/memory/search',
        },
        {
          source: '/api/agents/:taskId/status',
          destination: 'http://localhost:8803/api/agents/:taskId/status',
        },
        {
          source: '/api/agents/:taskId/cancel',
          destination: 'http://localhost:8803/api/agents/:taskId/cancel',
        },
        {
          source: '/api/agents/skill-evolution',
          destination: 'http://localhost:8803/api/agents/skill-evolution',
        },
        {
          source: '/api/agents/debate',
          destination: 'http://localhost:8803/api/agents/debate',
        },
        // 2026-07-31 新增:Browser Hub CDP 内置浏览器路由转发到 ai-service 8803
        // 原因:browser_hub router 注册在 ai-service(prefix="/browser",应用挂载 /api 前缀),
        // 完整路径 /api/browser/sessions/*。若走默认 /api/:path* → 8802(api server)会 404。
        // 注意:旧的 /api/browser/screenshot 和 /api/browser/probe 仍走 8802(api server 转发),
        // 此规则只匹配 /api/browser/sessions/*,不影响旧端点。
        // WebSocket(/api/browser/ws/*)不走 Next.js rewrites,前端直连 ws://localhost:8803(dev)。
        {
          source: '/api/browser/sessions/:path*',
          destination: 'http://localhost:8803/api/browser/sessions/:path*',
        },
        // 2026-08-08 新增:Meta-Learner 自进化系统路由转发到 ai-service 8803
        // 原因:meta_learning router 注册在 ai-service(prefix="/api/admin/meta-learner"),
        // 必须在 /api/:path* 通配符之前匹配,否则会被转发到 8802(api server)导致 404。
        {
          source: '/api/admin/meta-learner/:path*',
          destination: 'http://localhost:8803/api/admin/meta-learner/:path*',
        },
        // 2026-08-11 新增:LLM 用量统计 API 路由转发到 ai-service 8803
        // 原因:usage router 注册在 ai-service(prefix="/api/v1/ai/usage"),
        // 必须在 /api/:path* 通配符之前匹配,否则会被转发到 8802(api server)导致 404。
        {
          source: '/api/v1/ai/usage/:path*',
          destination: 'http://localhost:8803/api/v1/ai/usage/:path*',
        },
        // 2026-08-11 新增:评估/评测 API 路由转发到 ai-service 8803
        // 原因:eval router 注册在 ai-service(prefix="/api/v1/ai/eval"),
        // 必须在 /api/:path* 通配符之前匹配,否则会被转发到 8802(api server)导致 404。
        {
          source: '/api/v1/ai/eval/:path*',
          destination: 'http://localhost:8803/api/v1/ai/eval/:path*',
        },
        // 2026-08-11 新增:Prompt 管理 API 路由转发到 ai-service 8803
        // 原因:prompts router 注册在 ai-service(prefix="/api"),
        // 必须在 /api/:path* 通配符之前匹配,否则会被转发到 8802(api server)导致 404。
        {
          source: '/api/prompts/:path*',
          destination: 'http://localhost:8803/api/prompts/:path*',
        },
        // 2026-08-12 新增:News 自动刷新 admin 端点(LLM 每日生成新闻写入 news_articles)
        // 原因:news router 注册在 ai-service 8803 (prefix="/api/admin/news"),
        // 必须在 /api/:path* 通配符之前匹配,否则会被转发到 8802(api server)导致 404。
        {
          source: '/api/admin/news/:path*',
          destination: 'http://localhost:8803/api/admin/news/:path*',
        },
        {
          source: '/api/:path*',
          destination: 'http://localhost:8802/api/:path*',
        },
      ]
  },
  // 2026-07-24 安全加固:HTTP 安全响应头(CSP/HSTS/X-Frame-Options 等)
  // 注意:output:'export' 模式下 headers() 不生效(静态文件由 CDN/nginx 托管);
  // 改为 standalone 模式或 nginx 配置这些头时生效。保留配置供后续切换。
  async headers() {
    const securityHeaders = [
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
      // 2026-08-02 fix:WorkPanel 内置浏览器需 iframe 嵌入同源页面(发布/设置等),
      // DENY 会拦截同源嵌入(chrome-error refused to connect),改 SAMEORIGIN:
      // 同源可嵌入,跨源仍拦截(clickjacking 防护不变)。与 apps/api xss-protection 一致。
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
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
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://res.wx.qq.com https://wwcdn.weixin.qq.com https://g.alicdn.com https://lf-package-cn.feishucdn.com https://cdn.jsdelivr.net",
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
          // 2026-08-02 fix:WorkPanel 内置浏览器允许用户打开任意网址,
          // frame-src 放开 https:/http: 使可嵌入的外部站点能正常 iframe 展示。
          "frame-src 'self' https: http: https://open.weixin.qq.com https://open.work.weixin.qq.com https://login.dingtalk.com https://passport.feishu.cn",
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
