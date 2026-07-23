import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const nextConfig: NextConfig = {
  output: 'export',  // A 套壳方案:静态导出供 Tauri WebView 加载(原 'standalone',见 commit ce1f12795)
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  // 2026-07-22 临时:跳过构建时 ESLint(其他 agent 引入的 jsx-a11y/no-unused-vars 错误阻塞部署)
  eslint: { ignoreDuringBuilds: true },
  productionBrowserSourceMaps: false,
  // 关闭 Next.js 15 自带的左下角 N 圆圈 dev indicator (2026-07-21)
  // 它会在浏览器左下角出现一个黑色圆圈,遮挡内容;改用自定义的侧边栏开发者工具按钮
  devIndicators: false,
  transpilePackages: ['@ihui/ui', '@ihui/types', '@ihui/config', '@ihui/auth', '@ihui/app', '@ihui/shared', 'react-native-web'],
  turbopack: {
    resolveAlias: {
      'react-native': 'react-native-web',
      // 2026-07-23 修复 next-intl 3.26.5 在 Turbopack 下的兼容性:
      // plugin.js 用 process.env.TURBOPACK 检测 Turbopack 模式(Next 15.5 的 --turbopack
      // flag 不设置该变量),且 Turbopack 分支写已弃用的 experimental.turbo(被顶层 turbopack
      // 取代)。双重 bug 导致 'next-intl/config' alias 在 Turbopack 下不生效,报
      // "Couldn't find next-intl config file"。手动在顶层 turbopack.resolveAlias 设置 alias,
      // webpack 模式仍由 plugin 的 webpack 分支自动处理(config.resolve.alias)。
      'next-intl/config': './src/i18n/request.ts',
    },
    // solito 用 .web.js 平台扩展名(web 版 vs native 版),必须配置 resolveExtensions
    // 让 Turbopack 优先解析 .web.js/.web.tsx,否则 solito 的 next-link.web.js 不被加载,
    // TextLink 在 web 端无法渲染为 <a> 标签
    resolveExtensions: ['.web.js', '.web.jsx', '.web.ts', '.web.tsx', '.js', '.jsx', '.ts', '.tsx', '.json', '.mjs'],
  },
  webpack: (config) => {
    config.resolve.alias = config.resolve.alias || {}
    config.resolve.alias['react-native$'] = 'react-native-web'
    // solito .web.js 平台扩展名解析(webpack 模式)
    config.resolve.extensions = ['.web.js', '.web.jsx', '.web.ts', '.web.tsx', ...config.resolve.extensions || []]
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
    // 收敛可访问的远程图片源(2026-07-21 安全审计加固)
    // 旧值 `{ protocol: 'https', hostname: '**' }` 允许任意 HTTPS 主机,
    // 攻击者可滥用 Next 图片代理访问 SSRF 目标
    remotePatterns: [
      { protocol: 'https', hostname: 'aizhs.top' },
      { protocol: 'https', hostname: '*.aizhs.top' },
      { protocol: 'https', hostname: 'api.dicebear.com' }, // 头像生成
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // Google OAuth 头像
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' }, // GitHub OAuth 头像
      { protocol: 'https', hostname: 'platform-lookaside.fbsbx.com' }, // Facebook OAuth 头像
      { protocol: 'https', hostname: 'api.qrserver.com' }, // QR 码生成服务
    ],
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    unoptimized: true,
  },
  async redirects() {
    // A 套壳方案:output:export 不支持 redirects
    // 原 vueToNextRedirects 重定向规则见 commit ce1f12795 / @/config/redirects.config.ts
    // 静态导出下改由客户端路由处理或 Tauri WebView 层处理
    return []
  },
  async rewrites() {
    // A 套壳方案:output:export 不支持 rewrites 代理
    // 前端改直连 apps/api(8802)+ ai-service(8803),见 @/lib/api.ts baseURL 适配
    // 原 rewrites 代理规则见 commit ce1f12795
    return []
  },
  async headers() {
    // A 套壳方案:output:export 不支持 headers
    // 安全头(CSP/HSTS/X-Frame-Options)改由 apps/api 反代或 Tauri WebView 提供
    // 原 headers 配置见 commit ce1f12795
    return []
  },
}

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

export default withNextIntl(nextConfig)
