// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { vueToNextRedirects } from './src/config/redirects.config'

// GitHub Pages 部署需要 basePath(仓库名作为路径前缀)
const isGitHubPages = process.env.GITHUB_PAGES === 'true'
const repoName = 'IHUI-AI'

// 2026-07-28 修复:Next.js 16 dev server 启动校验更严,`output: 'export'` + middleware.ts
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
  // 关闭 Next.js 16 自带的左下角 N 圆圈 dev indicator (2026-07-21)
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
    // 2026-08-28 构建排障:Next.js 16 对 .well-known 路由的构建产物中使用了 require,
    // 但项目是 ESM 模块("type": "module"),导致 "require is not defined"。
    // 将 .well-known 路由排除在 webpack 构建外,由 Next.js 运行时处理。
    config.externals = config.externals || []
    config.externals.push({
      '.well-known': 'commonjs .well-known',
    })
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
    // Next.js 16.2.12 output: 'export' bug:App Router-only 项目不生成 pages-manifest.json,
    // 但 "Collecting page data" 阶段尝试读取它 → ENOENT。用 afterEmit 钩子创建空文件兜底。
    // 2026-08-17 扩展:同 bug 还影响 app-paths-manifest.json(见 build/index.js:1125,
    // appDir 存在时无条件 readManifest(APP_PATHS_MANIFEST)),凌晨构建成功因 .next 残留
    // 旧文件,全量重编译后暴露。两个 manifest 均兜底为空对象,不影响导出页面收集。
    config.plugins = config.plugins || []
    config.plugins.push({
      // 最小化内联类型,避免依赖 @types/webpack(Next.js 内置 webpack 但未导出类型声明)
      apply(compiler: { hooks: { afterEmit: { tap: (name: string, fn: () => void) => void } } }) {
        compiler.hooks.afterEmit.tap('EnsurePagesManifest', () => {
          // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports -- next.config webpack 钩子需用 require 加载 fs/path,as typeof import() 是动态类型导入
          const fs = require('fs') as typeof import('fs')
          // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports -- next.config webpack 钩子需用 require 加载 fs/path,as typeof import() 是动态类型导入
          const path = require('path') as typeof import('path')
          const serverDir = path.join(__dirname, '.next', 'server')
          for (const name of ['pages-manifest.json', 'app-paths-manifest.json']) {
            const manifestPath = path.join(serverDir, name)
            if (!fs.existsSync(manifestPath)) {
              fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
              fs.writeFileSync(manifestPath, '{}')
            }
          }
          // 2026-08-26 加固:Next.js 16 服务端模式(next start)启动时会读取根目录
          // .next/prerender-manifest.json。若某次构建因异常(如误入 export 模式、
          // 静态生成阶段被中断)未产出该文件,next start 会 ENOENT 崩溃 → NSSM 将
          // 服务卡在 SERVICE_PAUSED,导致 8801 永久宕机。这里兜底:缺失时写入
          // 结构完整的空 manifest(与 build/index.js 空项目产物同构),保证 next
          // start 必定能启动(页面退化为按需渲染,功能不受影响)。
          // 正常服务端构建会在 afterEmit 之后的静态生成阶段覆盖写入真实 manifest。
          //
          // 2026-08-29 修复静态导出构建崩溃(TypeError: reading '/404'):
          // 静态导出模式(output:'export')下禁止写此兜底。构建早期主进程某处会
          // require 该文件,Node require 缓存会把这个空 stub 缓存住;导出阶段
          // (export/index.js:230 require 同一路径)命中缓存拿到无 dynamicRoutes
          // 的对象 → `prerenderManifest.dynamicRoutes['/404']` 崩溃。且静态导出
          // 产物根本不跑 next start,该兜底毫无意义。仅服务端模式写入。
          const prerenderPath = path.join(__dirname, '.next', 'prerender-manifest.json')
          if (!isStaticExport && !fs.existsSync(prerenderPath)) {
            fs.writeFileSync(
              prerenderPath,
              JSON.stringify({
                version: 4,
                routes: {},
                dynamicRoutes: {},
                notFoundRoutes: [],
                preview: { developmentKey: '', isPreview: false, productionKey: '' },
              }),
            )
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
    // 2026-08-28 内存排障:尝试禁用 webpackBuildWorker,看是否改善
    webpackBuildWorker: false,
    // 2026-08-04 22:45 修正:限制 webpack 编译并行度,降低峰值内存。
    // SWC 大分配(15GB) + V8 堆组合在满并行时触发提交量上限,限 4 核压缩峰值。
    // 2026-08-28 内存排障:进一步降低并行度,尝试完成构建
    cpus: 4,
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
    // 2026-08-05 客户端路由缓存:staleTimes 让 Next.js 16 的客户端导航缓存 RSC 数据,
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
    // 2026-08-25 修复:接入 vueToNextRedirects(73 条永久重定向)。
    // 此前 src/config/redirects.config.ts 声明了 /login→/sso/login、/home→/、
    // /landing→/、/article→/articles 等重定向但从未接线(全仓零消费者),
    // redirects() 恒返回 [] → 生产上这些老链接全部 404/空白(实测 /login
    // 导航到 about:blank,/sso/login 正常)。生产为服务端模式(next build+
    // next start),redirects 原生生效;静态导出(output:'export',Tauri/
    // GitHub Pages)不支持 redirects,返回 [] 保持原状,避免静态构建告警。
    return isStaticExport ? [] : vueToNextRedirects
  },
  async rewrites() {
    // 2026-07-25 修复:开发模式(NEXT_PUBLIC_API_BASE_URL 加载失败时)代理 /api/* → localhost:8802
    // - output:'export' 模式 rewrites 不生效(构建后由 nginx/CDN 托管),但 dev server (next dev) 会生效
    // - 浏览器 fetch 走同源 /api/* → Next.js dev 代理 → 解决 404 + CORS 双失败导致 templates 等查询为空
    // - 2026-08-04 生产切换:服务端模式(next build + next start)同样需要此代理,
    //   否则生产环境前端 /api/* 请求 404。因此移除 NODE_ENV 条件,始终启用(静态导出时 rewrites 本身不生效,无副作用)。
    return {
      beforeFiles: [
        // ===== 2026-08-27 图片 CDN 静态资源(微信小程序远程图标) =====
        // 背景:小程序图标原指向 file.aizhs.top(公网被指向第三方"写字楼系统")与
        // bspapp.com(uniCloud CDN 已失效,DNS 不解析)。CDN 服务器 deploy/cdn-server.js
        // 已在本机 :80 运行(Cloudflare Flexible 零证书,灰度占位图动态生成)。
        // 方案:以下 184 条【精确路径】rewrite 将图标路径回源到 localhost:80,
        // 使 https://aizhs.top/<icon-path> 直接可用,无需新增 Cloudflare 子域绑定。
        // 精确匹配(非前缀通配)以避开 (main)/home、/user、/recruitment、/distribution
        // 等页面路由与 [id] 动态路由。新图标加入 remote-icons.ts 后需重新生成
        // (node deploy/generate-placeholders.js + 本段重新生成)。
        {
          source: '/user/%E5%88%A0%E9%99%A4.png',
          destination: 'http://localhost:80/user/%E5%88%A0%E9%99%A4.png',
        },
        {
          source: '/tabbar/home/carousel4-footer1/BottomFigure.png',
          destination: 'http://localhost:80/tabbar/home/carousel4-footer1/BottomFigure.png',
        },
        {
          source: '/recruitment/recruit2.png',
          destination: 'http://localhost:80/recruitment/recruit2.png',
        },
        {
          source: '/recruitment/recruit3.png',
          destination: 'http://localhost:80/recruitment/recruit3.png',
        },
        {
          source: '/tabbar/home/xia/commission.png',
          destination: 'http://localhost:80/tabbar/home/xia/commission.png',
        },
        { source: '/card/background.png', destination: 'http://localhost:80/card/background.png' },
        {
          source: '/tabbar/home/second/hello2.png',
          destination: 'http://localhost:80/tabbar/home/second/hello2.png',
        },
        {
          source: '/tabbar/ai_agent/lunbo6.jpg',
          destination: 'http://localhost:80/tabbar/ai_agent/lunbo6.jpg',
        },
        {
          source: '/tabbar/home/carousel4-footer1/carousel1.jpg',
          destination: 'http://localhost:80/tabbar/home/carousel4-footer1/carousel1.jpg',
        },
        {
          source: '/tabbar/home/carousel4-footer1/carousel2.jpg',
          destination: 'http://localhost:80/tabbar/home/carousel4-footer1/carousel2.jpg',
        },
        {
          source: '/tabbar/home/carousel4-footer1/carousel3.jpg',
          destination: 'http://localhost:80/tabbar/home/carousel4-footer1/carousel3.jpg',
        },
        {
          source: '/tabbar/home/carousel4-footer1/carousel4-footer1-two.png',
          destination:
            'http://localhost:80/tabbar/home/carousel4-footer1/carousel4-footer1-two.png',
        },
        {
          source: '/tabbar/home/carousel4-footer1/lunbo1.png',
          destination: 'http://localhost:80/tabbar/home/carousel4-footer1/lunbo1.png',
        },
        {
          source: '/tabbar/home/carousel4-footer1/lunbo2.png',
          destination: 'http://localhost:80/tabbar/home/carousel4-footer1/lunbo2.png',
        },
        {
          source: '/tabbar/home/zhongxia/king.png',
          destination: 'http://localhost:80/tabbar/home/zhongxia/king.png',
        },
        {
          source: '/tabbar/coursePlanet/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20250419152536.png',
          destination:
            'http://localhost:80/tabbar/coursePlanet/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20250419152536.png',
        },
        {
          source: '/tabbar/coursePlanet/%E4%B8%8B.png',
          destination: 'http://localhost:80/tabbar/coursePlanet/%E4%B8%8B.png',
        },
        {
          source: '/tabbar/home/zhong/right-arrow.png',
          destination: 'http://localhost:80/tabbar/home/zhong/right-arrow.png',
        },
        {
          source: '/sys-mini/xtk/textareaOpen.png',
          destination: 'http://localhost:80/sys-mini/xtk/textareaOpen.png',
        },
        {
          source: '/sys-mini/default/home/send.png',
          destination: 'http://localhost:80/sys-mini/default/home/send.png',
        },
        {
          source: '/sys-mini/jieshaoye.jpg',
          destination: 'http://localhost:80/sys-mini/jieshaoye.jpg',
        },
        {
          source: '/sys-mini/caopanshouqy.png',
          destination: 'http://localhost:80/sys-mini/caopanshouqy.png',
        },
        {
          source: '/sys-mini/privateadvisory.png',
          destination: 'http://localhost:80/sys-mini/privateadvisory.png',
        },
        {
          source: '/sys-mini/privateback.png',
          destination: 'http://localhost:80/sys-mini/privateback.png',
        },
        {
          source: '/tabbar/home/xia/popular-courser.png',
          destination: 'http://localhost:80/tabbar/home/xia/popular-courser.png',
        },
        {
          source: '/tabbar/home/xia/right-arrow.png',
          destination: 'http://localhost:80/tabbar/home/xia/right-arrow.png',
        },
        {
          source: '/tabbar/home/xia/KnowledgePlanet.png',
          destination: 'http://localhost:80/tabbar/home/xia/KnowledgePlanet.png',
        },
        {
          source: '/tabbar/home/zhong/aizhinengshe.png',
          destination: 'http://localhost:80/tabbar/home/zhong/aizhinengshe.png',
        },
        {
          source: '/tabbar/home/xia/message.png',
          destination: 'http://localhost:80/tabbar/home/xia/message.png',
        },
        {
          source: '/tabbar/home/xia/Like.png',
          destination: 'http://localhost:80/tabbar/home/xia/Like.png',
        },
        {
          source: '/tabbar/home/xia/Forward.png',
          destination: 'http://localhost:80/tabbar/home/xia/Forward.png',
        },
        { source: '/user/act.png', destination: 'http://localhost:80/user/act.png' },
        {
          source: '/tabbar/coursePlanet/8.png',
          destination: 'http://localhost:80/tabbar/coursePlanet/8.png',
        },
        {
          source: '/tabbar/coursePlanet/4.png',
          destination: 'http://localhost:80/tabbar/coursePlanet/4.png',
        },
        {
          source: '/tabbar/coursePlanet/2.png',
          destination: 'http://localhost:80/tabbar/coursePlanet/2.png',
        },
        {
          source: '/tabbar/coursePlanet/11.png',
          destination: 'http://localhost:80/tabbar/coursePlanet/11.png',
        },
        {
          source: '/tabbar/coursePlanet/5.png',
          destination: 'http://localhost:80/tabbar/coursePlanet/5.png',
        },
        {
          source: '/tabbar/coursePlanet/7.png',
          destination: 'http://localhost:80/tabbar/coursePlanet/7.png',
        },
        {
          source: '/tabbar/coursePlanet/3.png',
          destination: 'http://localhost:80/tabbar/coursePlanet/3.png',
        },
        {
          source: '/tabbar/coursePlanet/10.png',
          destination: 'http://localhost:80/tabbar/coursePlanet/10.png',
        },
        {
          source: '/tabbar/coursePlanet/right.png',
          destination: 'http://localhost:80/tabbar/coursePlanet/right.png',
        },
        {
          source: '/tabbar/home/zhongxia/popular-courser.png',
          destination: 'http://localhost:80/tabbar/home/zhongxia/popular-courser.png',
        },
        {
          source: '/tabbar/home/zhongxia/right-arrow.png',
          destination: 'http://localhost:80/tabbar/home/zhongxia/right-arrow.png',
        },
        {
          source: '/tabbar/home/zhongxia/popular-courses-nav.png',
          destination: 'http://localhost:80/tabbar/home/zhongxia/popular-courses-nav.png',
        },
        {
          source: '/tabbar/course/fufei.png',
          destination: 'http://localhost:80/tabbar/course/fufei.png',
        },
        {
          source: '/tabbar/ai_agent/user-avatar.png',
          destination: 'http://localhost:80/tabbar/ai_agent/user-avatar.png',
        },
        {
          source: '/tabbar/ai_agent/jiqiren-big.png',
          destination: 'http://localhost:80/tabbar/ai_agent/jiqiren-big.png',
        },
        {
          source: '/tabbar/home/second/hello1.png',
          destination: 'http://localhost:80/tabbar/home/second/hello1.png',
        },
        {
          source: '/tabbar/home/zhong/custom-made.png',
          destination: 'http://localhost:80/tabbar/home/zhong/custom-made.png',
        },
        {
          source: '/tabbar/tabbar/_20250418212023.png',
          destination: 'http://localhost:80/tabbar/tabbar/_20250418212023.png',
        },
        { source: '/tabbar/tabbar/6.png', destination: 'http://localhost:80/tabbar/tabbar/6.png' },
        { source: '/tabbar/tabbar/4.png', destination: 'http://localhost:80/tabbar/tabbar/4.png' },
        { source: '/tabbar/tabbar/7.png', destination: 'http://localhost:80/tabbar/tabbar/7.png' },
        { source: '/tabbar/tabbar/2.png', destination: 'http://localhost:80/tabbar/tabbar/2.png' },
        { source: '/tabbar/tabbar/5.png', destination: 'http://localhost:80/tabbar/tabbar/5.png' },
        { source: '/tabbar/tabbar/3.png', destination: 'http://localhost:80/tabbar/tabbar/3.png' },
        {
          source: '/tabbar/home/zhong/backA.png',
          destination: 'http://localhost:80/tabbar/home/zhong/backA.png',
        },
        {
          source: '/tabbar/tabbar/_20250418221944.png',
          destination: 'http://localhost:80/tabbar/tabbar/_20250418221944.png',
        },
        {
          source: '/sys-mini/default/home/userVip_act.png',
          destination: 'http://localhost:80/sys-mini/default/home/userVip_act.png',
        },
        { source: '/user/ai-icon.png', destination: 'http://localhost:80/user/ai-icon.png' },
        {
          source: '/user/course-icon.png',
          destination: 'http://localhost:80/user/course-icon.png',
        },
        {
          source: '/user/knowledge-icon.png',
          destination: 'http://localhost:80/user/knowledge-icon.png',
        },
        { source: '/sys-mini/lingqu.png', destination: 'http://localhost:80/sys-mini/lingqu.png' },
        {
          source: '/sys-mini/wenjuan.png',
          destination: 'http://localhost:80/sys-mini/wenjuan.png',
        },
        { source: '/sys-mini/dd-bg.png', destination: 'http://localhost:80/sys-mini/dd-bg.png' },
        {
          source: '/tabbar/coursePlanet/ss.png',
          destination: 'http://localhost:80/tabbar/coursePlanet/ss.png',
        },
        { source: '/sys-mini/xiala.png', destination: 'http://localhost:80/sys-mini/xiala.png' },
        { source: '/sys-mini/team1.png', destination: 'http://localhost:80/sys-mini/team1.png' },
        { source: '/yongjin/icon1.png', destination: 'http://localhost:80/yongjin/icon1.png' },
        {
          source: '/yongjin/juxing5Copy2@2x.png',
          destination: 'http://localhost:80/yongjin/juxing5Copy2@2x.png',
        },
        { source: '/yongjin/money.png', destination: 'http://localhost:80/yongjin/money.png' },
        {
          source: '/yongjin/mxbackground.png',
          destination: 'http://localhost:80/yongjin/mxbackground.png',
        },
        { source: '/yongjin/date.png', destination: 'http://localhost:80/yongjin/date.png' },
        { source: '/yongjin/qz.png', destination: 'http://localhost:80/yongjin/qz.png' },
        { source: '/user/%E5%B7%A6.png', destination: 'http://localhost:80/user/%E5%B7%A6.png' },
        {
          source: '/sys-mini/default/aihui.png',
          destination: 'http://localhost:80/sys-mini/default/aihui.png',
        },
        {
          source: '/sys-mini/xtk/company.png',
          destination: 'http://localhost:80/sys-mini/xtk/company.png',
        },
        {
          source: '/sys-mini/xtk/userinfo_btn_bg.png',
          destination: 'http://localhost:80/sys-mini/xtk/userinfo_btn_bg.png',
        },
        {
          source: '/sys-mini/xtk/aimove.png',
          destination: 'http://localhost:80/sys-mini/xtk/aimove.png',
        },
        {
          source: '/sys-mini/xtk/aimusic.png',
          destination: 'http://localhost:80/sys-mini/xtk/aimusic.png',
        },
        {
          source: '/sys-mini/xtk/aiText.png',
          destination: 'http://localhost:80/sys-mini/xtk/aiText.png',
        },
        {
          source: '/sys-mini/xtk/aiBk.png',
          destination: 'http://localhost:80/sys-mini/xtk/aiBk.png',
        },
        {
          source: '/sys-mini/xtk/ai2.png',
          destination: 'http://localhost:80/sys-mini/xtk/ai2.png',
        },
        {
          source: '/sys-mini/xtk/aiWork.png',
          destination: 'http://localhost:80/sys-mini/xtk/aiWork.png',
        },
        {
          source: '/sys-mini/xtk/set_need_image.png',
          destination: 'http://localhost:80/sys-mini/xtk/set_need_image.png',
        },
        {
          source: '/sys-mini/xtk/set_need_addimage.png',
          destination: 'http://localhost:80/sys-mini/xtk/set_need_addimage.png',
        },
        {
          source: '/sys-mini/xtk/set_need_text.png',
          destination: 'http://localhost:80/sys-mini/xtk/set_need_text.png',
        },
        {
          source: '/sys-mini/xtk/set_need_work.png',
          destination: 'http://localhost:80/sys-mini/xtk/set_need_work.png',
        },
        {
          source: '/tabbar/ai_agent/%E8%83%8C%E6%99%AF%E5%92%8Clogo.png',
          destination: 'http://localhost:80/tabbar/ai_agent/%E8%83%8C%E6%99%AF%E5%92%8Clogo.png',
        },
        {
          source: '/tabbar/home/zhong/ai-video.png',
          destination: 'http://localhost:80/tabbar/home/zhong/ai-video.png',
        },
        {
          source: '/tabbar/home/second/jiqiren-big.png',
          destination: 'http://localhost:80/tabbar/home/second/jiqiren-big.png',
        },
        {
          source: '/tabbar/home/second/hello.png',
          destination: 'http://localhost:80/tabbar/home/second/hello.png',
        },
        {
          source: '/tabbar/home/second/user-avatar.jpg',
          destination: 'http://localhost:80/tabbar/home/second/user-avatar.jpg',
        },
        {
          source: '/tabbar/home/second/jiqiren.png',
          destination: 'http://localhost:80/tabbar/home/second/jiqiren.png',
        },
        {
          source: '/tabbar/home/second/right.png',
          destination: 'http://localhost:80/tabbar/home/second/right.png',
        },
        {
          source: '/tabbar/home/second/title.png',
          destination: 'http://localhost:80/tabbar/home/second/title.png',
        },
        {
          source: '/sys-mini/Wechat_white@2x.png',
          destination: 'http://localhost:80/sys-mini/Wechat_white@2x.png',
        },
        { source: '/sys-mini/xgzt.jpg', destination: 'http://localhost:80/sys-mini/xgzt.jpg' },
        {
          source: '/sys-mini/save@2x.png',
          destination: 'http://localhost:80/sys-mini/save@2x.png',
        },
        {
          source: '/sys-mini/default/mingpian.jpg',
          destination: 'http://localhost:80/sys-mini/default/mingpian.jpg',
        },
        {
          source: '/recruitment/xuancai@2x.png',
          destination: 'http://localhost:80/recruitment/xuancai@2x.png',
        },
        {
          source: '/recruitment/ewm@2x.png',
          destination: 'http://localhost:80/recruitment/ewm@2x.png',
        },
        {
          source: '/tabbar/coursePlanet/6.png',
          destination: 'http://localhost:80/tabbar/coursePlanet/6.png',
        },
        {
          source: '/tabbar/coursePlanet/9.png',
          destination: 'http://localhost:80/tabbar/coursePlanet/9.png',
        },
        {
          source: '/tabbar/coursePlanet/1.png',
          destination: 'http://localhost:80/tabbar/coursePlanet/1.png',
        },
        {
          source: '/tabbar/ai_agent/12071746256773_.pic.jpg',
          destination: 'http://localhost:80/tabbar/ai_agent/12071746256773_.pic.jpg',
        },
        {
          source: '/sys-mini/xtk/cash.png',
          destination: 'http://localhost:80/sys-mini/xtk/cash.png',
        },
        {
          source: '/sys-mini/xtk/my_model_delete.png',
          destination: 'http://localhost:80/sys-mini/xtk/my_model_delete.png',
        },
        {
          source: '/sys-mini/xtk/dev_pay_icon.png',
          destination: 'http://localhost:80/sys-mini/xtk/dev_pay_icon.png',
        },
        {
          source: '/sys-mini/xtk/enter_page.png',
          destination: 'http://localhost:80/sys-mini/xtk/enter_page.png',
        },
        {
          source: '/sys-mini/xtk/dev_pay_border_image.png',
          destination: 'http://localhost:80/sys-mini/xtk/dev_pay_border_image.png',
        },
        {
          source: '/sys-mini/xtk/bumen2.png',
          destination: 'http://localhost:80/sys-mini/xtk/bumen2.png',
        },
        {
          source: '/sys-mini/xtk/model_edit_down.png',
          destination: 'http://localhost:80/sys-mini/xtk/model_edit_down.png',
        },
        {
          source: '/sys-mini/xtk/model_edit_yes.png',
          destination: 'http://localhost:80/sys-mini/xtk/model_edit_yes.png',
        },
        {
          source: '/sys-mini/xtk/model_edit_yuan.png',
          destination: 'http://localhost:80/sys-mini/xtk/model_edit_yuan.png',
        },
        {
          source: '/sys-mini/xtk/model_edit_helf.png',
          destination: 'http://localhost:80/sys-mini/xtk/model_edit_helf.png',
        },
        {
          source: '/sys-mini/xtk/model_income_btn_bg.png',
          destination: 'http://localhost:80/sys-mini/xtk/model_income_btn_bg.png',
        },
        {
          source: '/sys-mini/xtk/model_income_right.png',
          destination: 'http://localhost:80/sys-mini/xtk/model_income_right.png',
        },
        {
          source: '/sys-mini/xtk/model_income_icon_form.png',
          destination: 'http://localhost:80/sys-mini/xtk/model_income_icon_form.png',
        },
        {
          source: '/sys-mini/xtk/wx_wallet.png',
          destination: 'http://localhost:80/sys-mini/xtk/wx_wallet.png',
        },
        {
          source: '/sys-mini/xtk/wx_icon.png',
          destination: 'http://localhost:80/sys-mini/xtk/wx_icon.png',
        },
        {
          source: '/sys-mini/xtk/wx_btn_yes.png',
          destination: 'http://localhost:80/sys-mini/xtk/wx_btn_yes.png',
        },
        {
          source: '/sys-mini/xtk/wx_btn_no.png',
          destination: 'http://localhost:80/sys-mini/xtk/wx_btn_no.png',
        },
        {
          source: '/sys-backs/2025/09/24/391_42_20250924094836A218.png',
          destination: 'http://localhost:80/sys-backs/2025/09/24/391_42_20250924094836A218.png',
        },
        {
          source: '/tabbar/tabbar/home.png',
          destination: 'http://localhost:80/tabbar/tabbar/home.png',
        },
        { source: '/home/ewm.png', destination: 'http://localhost:80/home/ewm.png' },
        { source: '/sys-mini/fasong.png', destination: 'http://localhost:80/sys-mini/fasong.png' },
        {
          source: '/sys-mini/home-icon.png',
          destination: 'http://localhost:80/sys-mini/home-icon.png',
        },
        {
          source: '/sys-mini/xtk/devlogo.png',
          destination: 'http://localhost:80/sys-mini/xtk/devlogo.png',
        },
        {
          source: '/sys-mini/xtk/cancel.png',
          destination: 'http://localhost:80/sys-mini/xtk/cancel.png',
        },
        {
          source: '/sys-mini/xtk/Welcome.png',
          destination: 'http://localhost:80/sys-mini/xtk/Welcome.png',
        },
        {
          source: '/sys-mini/xtk/iHuiInfAI.png',
          destination: 'http://localhost:80/sys-mini/xtk/iHuiInfAI.png',
        },
        {
          source: '/sys-mini/xtk/plaza_win_left.png',
          destination: 'http://localhost:80/sys-mini/xtk/plaza_win_left.png',
        },
        {
          source: '/sys-mini/xtk/image_or.png',
          destination: 'http://localhost:80/sys-mini/xtk/image_or.png',
        },
        {
          source: '/sys-mini/xtk/plaza_win_right.png',
          destination: 'http://localhost:80/sys-mini/xtk/plaza_win_right.png',
        },
        {
          source: '/sys-mini/xtk/plaza_icon11.png',
          destination: 'http://localhost:80/sys-mini/xtk/plaza_icon11.png',
        },
        {
          source: '/sys-mini/xtk/plaza_icon01.png',
          destination: 'http://localhost:80/sys-mini/xtk/plaza_icon01.png',
        },
        {
          source: '/sys-mini/xtk/plaza_icon12.png',
          destination: 'http://localhost:80/sys-mini/xtk/plaza_icon12.png',
        },
        {
          source: '/sys-mini/xtk/plaza_icon02.png',
          destination: 'http://localhost:80/sys-mini/xtk/plaza_icon02.png',
        },
        {
          source: '/sys-mini/xtk/plaza_icon13.png',
          destination: 'http://localhost:80/sys-mini/xtk/plaza_icon13.png',
        },
        {
          source: '/sys-mini/xtk/plaza_icon03.png',
          destination: 'http://localhost:80/sys-mini/xtk/plaza_icon03.png',
        },
        {
          source: '/sys-mini/xtk/plaza_icon14.png',
          destination: 'http://localhost:80/sys-mini/xtk/plaza_icon14.png',
        },
        {
          source: '/sys-mini/xtk/plaza_icon04.png',
          destination: 'http://localhost:80/sys-mini/xtk/plaza_icon04.png',
        },
        {
          source: '/sys-mini/xtk/my_model.png',
          destination: 'http://localhost:80/sys-mini/xtk/my_model.png',
        },
        {
          source: '/sys-mini/xtk/my_input.png',
          destination: 'http://localhost:80/sys-mini/xtk/my_input.png',
        },
        {
          source: '/sys-mini/default/n8n.png',
          destination: 'http://localhost:80/sys-mini/default/n8n.png',
        },
        {
          source: '/sys-mini/xtk/dev_copy.png',
          destination: 'http://localhost:80/sys-mini/xtk/dev_copy.png',
        },
        {
          source: '/sys-mini/xtk/dev_pay_boder_nomal.png',
          destination: 'http://localhost:80/sys-mini/xtk/dev_pay_boder_nomal.png',
        },
        {
          source: '/sys-mini/xtk/dev_pay_border_color.png',
          destination: 'http://localhost:80/sys-mini/xtk/dev_pay_border_color.png',
        },
        {
          source: '/sys-mini/default/bumen.png',
          destination: 'http://localhost:80/sys-mini/default/bumen.png',
        },
        {
          source: '/sys-mini/xtk/set_need_time.png',
          destination: 'http://localhost:80/sys-mini/xtk/set_need_time.png',
        },
        {
          source: '/sys-mini/xtk/set_need_time_end.png',
          destination: 'http://localhost:80/sys-mini/xtk/set_need_time_end.png',
        },
        {
          source: '/sys-mini/xtk/set_need_select_down.png',
          destination: 'http://localhost:80/sys-mini/xtk/set_need_select_down.png',
        },
        {
          source: '/sys-mini/xtk/set_need_money.png',
          destination: 'http://localhost:80/sys-mini/xtk/set_need_money.png',
        },
        {
          source: '/recruitment/bigtp@2x.png',
          destination: 'http://localhost:80/recruitment/bigtp@2x.png',
        },
        {
          source: '/sys-mini/xtk/study_icon_add_grad.png',
          destination: 'http://localhost:80/sys-mini/xtk/study_icon_add_grad.png',
        },
        {
          source: '/sys-mini/xtk/study_icon_playing.png',
          destination: 'http://localhost:80/sys-mini/xtk/study_icon_playing.png',
        },
        {
          source: '/sys-mini/xtk/study_icon_right_end.png',
          destination: 'http://localhost:80/sys-mini/xtk/study_icon_right_end.png',
        },
        {
          source: '/sys-mini/xtk/study_comment_info.png',
          destination: 'http://localhost:80/sys-mini/xtk/study_comment_info.png',
        },
        {
          source: '/sys-mini/xtk/study_icon_video.png',
          destination: 'http://localhost:80/sys-mini/xtk/study_icon_video.png',
        },
        {
          source: '/sys-mini/xtk/study_icon_blink.png',
          destination: 'http://localhost:80/sys-mini/xtk/study_icon_blink.png',
        },
        {
          source: '/sys-mini/xtk/study_icon_tip.png',
          destination: 'http://localhost:80/sys-mini/xtk/study_icon_tip.png',
        },
        {
          source: '/sys-mini/default/huodongBG.png',
          destination: 'http://localhost:80/sys-mini/default/huodongBG.png',
        },
        {
          source: '/sys-mini/penicon.png',
          destination: 'http://localhost:80/sys-mini/penicon.png',
        },
        {
          source: '/sys-mini/123444456.png',
          destination: 'http://localhost:80/sys-mini/123444456.png',
        },
        {
          source: '/sys-mini/WechatIMG54.png',
          destination: 'http://localhost:80/sys-mini/WechatIMG54.png',
        },
        {
          source: '/sys-mini/wallet-zf.png',
          destination: 'http://localhost:80/sys-mini/wallet-zf.png',
        },
        {
          source: '/sys-mini/default/wallet.png',
          destination: 'http://localhost:80/sys-mini/default/wallet.png',
        },
        {
          source: '/sys-mini/default/gold_active.png',
          destination: 'http://localhost:80/sys-mini/default/gold_active.png',
        },
        {
          source: '/sys-mini/default/gold.png',
          destination: 'http://localhost:80/sys-mini/default/gold.png',
        },
        { source: '/sys-mini/xiugai.png', destination: 'http://localhost:80/sys-mini/xiugai.png' },
        {
          source: '/sys-mini/default/selected.png',
          destination: 'http://localhost:80/sys-mini/default/selected.png',
        },
        {
          source: '/sys-mini/default/select.png',
          destination: 'http://localhost:80/sys-mini/default/select.png',
        },
        { source: '/sys-mini/Emphty.png', destination: 'http://localhost:80/sys-mini/Emphty.png' },
        {
          source: '/sys-mini/default/wechat.png',
          destination: 'http://localhost:80/sys-mini/default/wechat.png',
        },
        { source: '/user/topup.png', destination: 'http://localhost:80/user/topup.png' },
        {
          source: '/sys-mini/default/xing.png',
          destination: 'http://localhost:80/sys-mini/default/xing.png',
        },
        {
          source: '/sys-mini/default/ljkt_icon.png',
          destination: 'http://localhost:80/sys-mini/default/ljkt_icon.png',
        },
        {
          source: '/sys-mini/default/zuan.png',
          destination: 'http://localhost:80/sys-mini/default/zuan.png',
        },
        {
          source: '/sys-mini/default/zuan_title.png',
          destination: 'http://localhost:80/sys-mini/default/zuan_title.png',
        },
        {
          source: '/sys-mini/default/sdh_back.jpg',
          destination: 'http://localhost:80/sys-mini/default/sdh_back.jpg',
        },
        { source: '/user/right.png', destination: 'http://localhost:80/user/right.png' },
        { source: '/user/wxfb.png', destination: 'http://localhost:80/user/wxfb.png' },
        { source: '/user/zfb.png', destination: 'http://localhost:80/user/zfb.png' },
      ],
      afterFiles: [
        {
          source: '/yongjin/juxing5Copy2%402x.png',
          destination: 'http://localhost:80/yongjin/juxing5Copy2%402x.png',
        },
        {
          source: '/sys-mini/Wechat_white%402x.png',
          destination: 'http://localhost:80/sys-mini/Wechat_white%402x.png',
        },
        {
          source: '/sys-mini/save%402x.png',
          destination: 'http://localhost:80/sys-mini/save%402x.png',
        },
        {
          source: '/recruitment/xuancai%402x.png',
          destination: 'http://localhost:80/recruitment/xuancai%402x.png',
        },
        {
          source: '/recruitment/ewm%402x.png',
          destination: 'http://localhost:80/recruitment/ewm%402x.png',
        },
        {
          source: '/recruitment/bigtp%402x.png',
          destination: 'http://localhost:80/recruitment/bigtp%402x.png',
        },
        // 2026-08-27: 图片/文件 CDN 的 /uploads 出图已改为 web 端 route handler 托管
        // (apps/web/app/uploads/[[...path]]/route.ts),直接从磁盘读取
        // apps/api/uploads/public 返回,Host 无关、不依赖反代 8802,根治公网
        // file.aizhs.top 等子域 rewrite 代理偶发失败的问题。故此处不再保留 /uploads rewrite。
        // api.aizhs.top/uploads 由 Cloudflare 隧道直指 8802(@fastify/static),不经 web。
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
        // 2026-08-31 新增:语音 STT 端点转发到 ai-service 8803。
        // 原因:voice-input 的 fallback 路径(MediaRecorder → faster-whisper)此前浏览器
        // 直连 8803,① 跨端口无 cookie/token(ai-service JWT 鉴权 401);② 生产环境
        // localhost 指向用户本机。改为同源 /api/voice/* 走 next rewrites 代理 +
        // Bearer token(ai-service jwt_public_paths 已放行 /api/voice/stt 双保险)。
        {
          source: '/api/voice/:path*',
          destination: 'http://localhost:8803/api/voice/:path*',
        },
        // 2026-08-17 修复(删除原 /api/publish/:path* → 8803 转发):
        // 原规则 2026-07-29 立,当时 api server 未注册 /api/publish 路由,
        // 把 publish 全量转发 ai-service 8803。此后 api 端已实现完整代理
        // (apps/api/src/routes/publish-routes.ts 16+ 端点 + publish-analytics.ts),
        // 但 rewrites 未更新 → 浏览器所有 /api/publish/* 被劫持到 8803:
        //   1. ai-service JWTAuthMiddleware 只认 Bearer,不认 auth_token cookie,
        //      浏览器同源请求(主要靠 cookie)大量 401;
        //   2. analytics 端点只在 8802 注册,走 8803 必 404/401;
        // 删除后 /api/publish/* 回落 /api/:path* 兜底 → 8802(api 层 cookie 认证 +
        // 统一信封 + 透传 ai-service),链路稳定。ai-service 的 publish 路由仍经
        // 8802 proxyToAiService 访问,不受影响。
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
        // 2026-08-15 新增:A2A 智能体协作路由转发到 ai-service 8803
        // 原因:a2a router 注册在 ai-service(prefix="/api",路径 /api/a2a/*),
        // 前端 a2a 页面调用 /api/a2a/agents 等,必须直连 8803 才能命中;
        // 否则落到 /api/:path* → 8802(api server)无此路由 → 404。
        {
          source: '/api/a2a/:path*',
          destination: 'http://localhost:8803/api/a2a/:path*',
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
        // 2026-08-12 新增:AgentLoopV2 实时任务事件订阅转发到 ai-service 8803
        // 原因:agents router 注册在 ai-service(8803),workbench runtime 视图
        // (use-agent-runtime) 的 SSE 订阅端点必须在 /api/:path* 之前匹配。
        {
          source: '/api/agents/tasks/stream',
          destination: 'http://localhost:8803/api/agents/tasks/stream',
        },
        // 2026-08-12 新增:Agent 运行日志 SSE(AgentRuntimeLog)转发到 ai-service 8803
        // 原因:/agents/{id}/stream 注册在 8803(新增),白名单必须覆盖,否则
        // 落到 /api/:path* → 8802 404。注意 tasks/stream 精确规则在前,
        // 数组顺序匹配,与 :agentId/stream 无冲突。
        {
          source: '/api/agents/:agentId/stream',
          destination: 'http://localhost:8803/api/agents/:agentId/stream',
        },
        // 2026-08-12 新增:agent-runtime ToolCallTree/ErrorHeatmap 端点转发到 8803
        // 原因:/agents/{id}/tool-calls + /errors 注册在 8803,白名单须覆盖,
        // 否则落到 /api/:path* → 8802 404(此前实测页面空态)。
        {
          source: '/api/agents/:agentId/tool-calls',
          destination: 'http://localhost:8803/api/agents/:agentId/tool-calls',
        },
        {
          source: '/api/agents/:agentId/errors',
          destination: 'http://localhost:8803/api/agents/:agentId/errors',
        },
        // 2026-08-12 新增:agent-runtime SessionTree/TokenUsageChart 端点转发到 8803
        // 原因:/agents/{id}/sessions + /token-usage 新注册在 8803(此前双端 404),
        // 白名单须覆盖,否则落到 /api/:path* → 8802 404。注意与 /api/agents/sessions/
        // :path*(8802 兜底)无冲突:动态段 :agentId/ 静态段 sessions 路径不同。
        {
          source: '/api/agents/:agentId/sessions',
          destination: 'http://localhost:8803/api/agents/:agentId/sessions',
        },
        {
          source: '/api/agents/:agentId/token-usage',
          destination: 'http://localhost:8803/api/agents/:agentId/token-usage',
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
      ],
    }
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
//
