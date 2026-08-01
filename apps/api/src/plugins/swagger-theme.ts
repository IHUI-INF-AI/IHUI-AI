/**
 * Swagger UI 自定义品牌主题(2026-07-28 立,P0-4a Swagger 公开暴露策略)。
 *
 * 输出:
 * - theme: 自定义 CSS(品牌蓝 #3b82f6 + Logo 文字 + 顶栏 + 信息条)
 * - logo: 内联 SVG(不依赖外部资源,符合"无外部依赖"约束)
 * - uiConfig: Swagger UI 标准配置(深链/过滤/语法高亮/persistAuthorization)
 * - staticCSP: 显式 CSP 允许 swagger-ui 自己的 inline style/script
 *
 * 使用方式(在 server.ts 中):
 *   await server.register(swaggerUi, {
 *     routePrefix: '/docs',
 *     theme: buildSwaggerTheme(),
 *     logo: buildSwaggerLogo(),
 *     uiConfig: buildSwaggerUiConfig(),
 *     staticCSP: buildSwaggerCsp(),
 *     uiHooks: {
 *       onRequest: buildSwaggerApiKeyHook(config.SWAGGER_API_KEY),
 *     },
 *   })
 */
import type { FastifyRequest, FastifyReply } from 'fastify'

/** IHUI 品牌主色(与 apps/web/app/globals.css 中 #3b82f6 一致)。 */
export const IHUI_BRAND_PRIMARY = '#3b82f6'
export const IHUI_BRAND_PRIMARY_DARK = '#2563eb'
export const IHUI_BRAND_BG = '#f8fafc'

/**
 * 内联 SVG Logo(蓝色六边形 + "IHUI" 文字),不依赖外部资源。
 * 48x48 viewBox,data URL 形式输出。
 */
function buildLogoSvg(): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">',
    '<defs>',
    '<linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">',
    `<stop offset="0%" stop-color="${IHUI_BRAND_PRIMARY}"/>`,
    `<stop offset="100%" stop-color="${IHUI_BRAND_PRIMARY_DARK}"/>`,
    '</linearGradient>',
    '</defs>',
    '<path d="M24 3 L42 14 L42 34 L24 45 L6 34 L6 14 Z" fill="url(#g)"/>',
    '<text x="24" y="29" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" ',
    'font-size="14" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">IHUI</text>',
    '</svg>',
  ].join('')
}

/**
 * 自定义 CSS:覆盖 swagger-ui 顶栏色、按钮色、链接色、滚动条。
 * 全部 inline 写入 theme.css,无外部资源依赖。
 */
function buildThemeCss(): string {
  return [
    `/* IHUI 品牌主题覆盖(2026-07-28) */`,
    `:root {`,
    `  --ihui-primary: ${IHUI_BRAND_PRIMARY};`,
    `  --ihui-primary-dark: ${IHUI_BRAND_PRIMARY_DARK};`,
    `  --ihui-bg: ${IHUI_BRAND_BG};`,
    `}`,
    `.swagger-ui .topbar { background: linear-gradient(135deg, var(--ihui-primary) 0%, var(--ihui-primary-dark) 100%); padding: 14px 0; }`,
    `.swagger-ui .topbar .download-url-wrapper { display: none; }`,
    `.swagger-ui .info { background: var(--ihui-bg); border-radius: 8px; padding: 20px 24px; margin: 20px 0; }`,
    `.swagger-ui .info .title { color: var(--ihui-primary-dark); }`,
    `.swagger-ui .scheme-container { background: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); padding: 12px 20px; }`,
    `.swagger-ui .opblock-tag { font-size: 16px; border-bottom: 1px solid #e2e8f0; }`,
    `.swagger-ui .opblock .opblock-summary { border-radius: 6px; }`,
    `.swagger-ui .btn.execute { background: var(--ihui-primary); border-color: var(--ihui-primary); }`,
    `.swagger-ui .btn.execute:hover { background: var(--ihui-primary-dark); border-color: var(--ihui-primary-dark); }`,
    `.swagger-ui a { color: var(--ihui-primary-dark); }`,
    `.swagger-ui .opblock-tag-section .opblock-tag:hover { background: rgba(59, 130, 246, 0.06); }`,
    `.swagger-ui .opblock.opblock-post { border-color: var(--ihui-primary); background: rgba(59, 130, 246, 0.04); }`,
    `.swagger-ui .opblock.opblock-get { border-color: #10b981; background: rgba(16, 185, 129, 0.04); }`,
    `.swagger-ui .opblock.opblock-put { border-color: #f59e0b; background: rgba(245, 158, 11, 0.04); }`,
    `.swagger-ui .opblock.opblock-delete { border-color: #ef4444; background: rgba(239, 68, 68, 0.04); }`,
    `.swagger-ui .opblock.opblock-patch { border-color: #8b5cf6; background: rgba(139, 92, 246, 0.04); }`,
    `/* IHUI 品牌水印 */`,
    `.swagger-ui .info::after { content: 'Powered by IHUI AI'; display: block; margin-top: 12px; font-size: 12px; color: #94a3b8; text-align: right; }`,
  ].join('\n')
}

/**
 * 小段 JS:在 swagger-ui 加载完成后,替换默认顶栏文字为品牌信息。
 * 不用 uiHooks,直接 DOM 操作,降低与 swagger-ui 版本耦合。
 */
function buildThemeJs(): string {
  return [
    `(() => {`,
    `  const apply = () => {`,
    `    const topbar = document.querySelector('.swagger-ui .topbar');`,
    `    if (topbar && !topbar.dataset.ihuiBranded) {`,
    `      topbar.dataset.ihuiBranded = '1';`,
    `      const link = topbar.querySelector('a');`,
    `      if (link) {`,
    `        link.innerHTML = '<span style="color:#fff;font-weight:600;font-size:16px;letter-spacing:0.5px;">IHUI AI · API Docs</span>';`,
    `        link.setAttribute('href', 'https://aizhs.top');`,
    `        link.setAttribute('target', '_blank');`,
    `      }`,
    `    }`,
    `  };`,
    `  if (document.readyState === 'loading') {`,
    `    document.addEventListener('DOMContentLoaded', apply);`,
    `  } else {`,
    `    apply();`,
    `  }`,
    `  // swagger-ui 异步渲染,延迟再尝试一次`,
    `  setTimeout(apply, 500);`,
    `  setTimeout(apply, 1500);`,
    `})();`,
  ].join('\n')
}

/**
 * Favicon:与 Logo 同款的 16x16 内联 SVG。
 */
function buildFaviconSvg(): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">',
    `<rect width="16" height="16" rx="3" fill="${IHUI_BRAND_PRIMARY}"/>`,
    '<text x="8" y="11" font-family="Arial,sans-serif" font-size="8" font-weight="700" fill="#fff" text-anchor="middle">I</text>',
    '</svg>',
  ].join('')
}

/** 自定义主题:title/css/js/favicon。 */
export function buildSwaggerTheme() {
  return {
    title: 'IHUI AI · API Documentation',
    css: [{ filename: 'theme.css', content: buildThemeCss() }],
    js: [{ filename: 'theme.js', content: buildThemeJs() }],
    favicon: [
      {
        filename: 'favicon.svg',
        rel: 'icon',
        type: 'image/svg+xml',
        sizes: '16x16',
        content: buildFaviconSvg(),
      },
    ],
  }
}

/** 自定义 Logo(SVG data URL,内联不依赖外部资源)。 */
export function buildSwaggerLogo() {
  return {
    type: 'image/svg+xml',
    content: buildLogoSvg(),
    href: 'https://aizhs.top',
    target: '_blank' as const,
  }
}

/** Swagger UI 标准 uiConfig:深链/过滤/语法高亮/持久鉴权。 */
export function buildSwaggerUiConfig() {
  return {
    deepLinking: true,
    displayOperationId: false,
    defaultModelsExpandDepth: 1,
    defaultModelExpandDepth: 1,
    docExpansion: 'list' as const,
    filter: true,
    maxDisplayedTags: 50,
    operationsSorter: 'alpha' as const,
    tagsSorter: 'alpha' as const,
    showExtensions: true,
    showCommonExtensions: false,
    tryItOutEnabled: true,
    persistAuthorization: true,
    withCredentials: true,
    syntaxHighlight: {
      activate: true,
      theme: 'nord' as const,
    },
  }
}

/**
 * 显式 CSP:允许 swagger-ui 的 inline style/script(它自己生成),
 * 允许从自身 host 加载资源。inline img 用 data:。
 */
export function buildSwaggerCsp(): Record<string, string | string[]> {
  return {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'", 'data:', 'https:'],
    'connect-src': ["'self'"],
  }
}

/**
 * 构造 /docs 路径 API Key 鉴权 hook(可选)。
 *
 * - `apiKey` 为空字符串 → 不启用鉴权(开发模式/公开访问)
 * - `apiKey` 已配置 → 检查 `X-API-Key` header,匹配放行,否则 401
 *
 * 使用 timingSafeEqual 防时序攻击。
 *
 * 挂载方式:swaggerUi 的 uiHooks.onRequest
 */
export function buildSwaggerApiKeyHook(apiKey: string) {
  return async function swaggerApiKeyHook(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    // 未配置 = 公开访问(开发模式友好)
    if (!apiKey) return

    // 仅保护 /docs 页面本身,/docs/json(spec 端点)与 swagger-ui 静态资源保持公开,
    // 方便 CI / 自动化工具(OpenAPI Generator / Postman / SDK 生成器)拉取 schema
    // - /docs            → HTML 页面(浏览器人工查阅,需鉴权)
    // - /docs/json       → OpenAPI JSON(自动化工具,公开)
    // - /docs/static/... → swagger-ui 自带 JS/CSS/字体(公开)
    // - /docs/swagger-ui-initializer.js 等 → 公开
    const path = request.url.split('?')[0] ?? ''
    if (path === '/docs/json' || path.startsWith('/docs/static/')) {
      return
    }
    // 仅对 /docs 根路径 / /docs 子路径做鉴权;其他路径放行
    if (path !== '/docs' && !path.startsWith('/docs/')) {
      return
    }

    const provided = request.headers['x-api-key']
    const providedStr = typeof provided === 'string' ? provided : ''
    if (!providedStr || providedStr.length !== apiKey.length) {
      reply.status(401).send({
        code: 401,
        message: 'X-API-Key 请求头无效或缺失',
      })
      return
    }

    // 时序安全比较
    const { timingSafeEqual } = await import('node:crypto')
    const a = Buffer.from(providedStr, 'utf8')
    const b = Buffer.from(apiKey, 'utf8')
    if (!timingSafeEqual(a, b)) {
      reply.status(401).send({
        code: 401,
        message: 'X-API-Key 请求头无效或缺失',
      })
      return
    }
  }
}
