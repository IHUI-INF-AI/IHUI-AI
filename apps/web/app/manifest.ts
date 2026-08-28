import type { MetadataRoute } from 'next'

// 2026-08-28 修复静态导出构建失败:output:'export' 要求所有 Route Handler 显式声明
// force-static 或 revalidate(与 app/rss.xml/route.ts 同一模式)。manifest 内容构建时
// 完全确定(纯字面量,无运行时依赖),force-static 在服务端/静态两种模式下均正确。
export const dynamic = 'force-static'

/**
 * PWA Manifest（Next.js 标准端点 → /manifest.webmanifest）
 *
 * 2026-08-26 立:此前只有 public/manifest.json 静态文件 + layout metadata.manifest
 * 指向 /manifest.json,但 /manifest.webmanifest(Next 标准路由) 404 —— PWA 规范端点缺失
 * (pwa.spec.ts 断言 /manifest.webmanifest 200 + JSON 字段)。
 * 内容与 public/manifest.json 保持一致(黑底 logo 品牌统一)。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/?source=pwa',
    name: 'IHUI AI — 全栈 AI 操作系统',
    short_name: 'IHUI AI',
    description:
      'IHUI AI(智汇 AI)是一站式全栈 AI 操作系统,集成 Agent 市场、知识库 RAG、多模型调度、MCP 工具协议,支持 8 端同源分发。',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui', 'browser'],
    orientation: 'any',
    lang: 'zh-CN',
    dir: 'ltr',
    background_color: '#000000',
    theme_color: '#000000',
    categories: ['productivity', 'business', 'developer'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
