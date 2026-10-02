// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// GENERATED FILE — DO NOT EDIT. 由 apps/extension/scripts/generate-ext-ui-routes.mjs 生成(pnpm gen:ui-routes)
// 数据源:entrypoints/sidepanel/SidepanelApp.tsx 的 <Route path="…"> 清单(MemoryRouter 路由表,
//        含末尾兼容重定向路由,不含 `*` 通配)。改路由请改 SidepanelApp.tsx 后重新生成。

// IHUI-GEN-PIN-BEGIN
// generator: apps/extension/scripts/generate-ext-ui-routes.mjs
// sourceCommit: 43d17af723bdc50ea30036cad4c4553b981d0ca6
// inputsSha256: 7f62b00cd308b5e311451f847d0a237534aaca4679fb47fb9cabb9d0912c7db5
// input: apps/extension/entrypoints/sidepanel/SidepanelApp.tsx 9ceb3d791dd95239e04387f479a734e742d0f7b2320d6c40b3f627cb88a88889
// skipped: wildcardRoutes=1(`*` 通配,万物兜底不导航); dynamicPaths=0(path 为动态表达式)
// generatedAt: 2026-10-02T22:40:58.873Z
// IHUI-GEN-PIN-END

/** ext_ui navigate 路由白名单(生成常量,非手写维护):与 web 端 ui-route-index.ts 的站内白名单语义对齐 */
export const EXT_UI_ROUTES: readonly string[] = [
  '/',
  '/chat',
  '/chat/history',
  '/chat/favorites',
  '/chat/templates',
  '/chat/import',
  '/vocabulary',
  '/courses',
  '/ai',
  '/ai/agents',
  '/ai/agents/:id',
  '/ai/skills',
  '/ai/image-gen',
  '/ai/memory',
  '/ai/news',
  '/ai/models',
  '/content',
  '/content/articles',
  '/content/news',
  '/content/announcements',
  '/content/search',
  '/content/plaza',
  '/content/circles',
  '/content/topics',
  '/content/asks',
  '/me',
  '/me/dashboard',
  '/me/notifications',
  '/me/messages',
  '/me/favorites',
  '/me/following',
  '/me/fans',
  '/me/points',
  '/me/vip',
  '/me/member',
  '/me/distribution',
  '/me/invitations',
  '/me/profile',
  '/me/wallet',
  '/me/orders',
  '/settings',
  '/settings/about',
  '/settings/contact',
  '/settings/help',
  '/settings/agreement',
  '/settings/pricing',
  '/agents',
  '/agents/:id',
  '/profile',
  '/wallet',
  '/orders',
]

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
