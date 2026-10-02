// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// GENERATED FILE — DO NOT EDIT. 由 apps/extension/scripts/generate-ext-ui-routes.mjs 生成(pnpm gen:ui-routes)
// 数据源:entrypoints/sidepanel/SidepanelApp.tsx 的 <Route path="…"> 清单(MemoryRouter 路由表,
//        含末尾兼容重定向路由,不含 `*` 通配)。改路由请改 SidepanelApp.tsx 后重新生成。

// IHUI-GEN-PIN-BEGIN
// generator: apps/extension/scripts/generate-ext-ui-routes.mjs
// sourceCommit: 6738f14922b323848c9e84abe4e3961851689875
// inputsSha256: 234a1b5bb0de6201d35af09b6f10474936f3bdd6f5ba6647f55d4836ab68c7b6
// input: apps/extension/entrypoints/sidepanel/SidepanelApp.tsx 308fc917dd134e5cd831180d082f1bd54b660b7a64774003349ae7e22091e57c
// skipped: wildcardRoutes=1(`*` 通配,万物兜底不导航); dynamicPaths=0(path 为动态表达式)
// generatedAt: 2026-10-02T09:20:31.435Z
// IHUI-GEN-PIN-END

/** ext_ui navigate 路由白名单(生成常量,非手写维护):与 web 端 ui-route-index.ts 的站内白名单语义对齐 */
export const EXT_UI_ROUTES: readonly string[] = [
  '/',
  '/chat',
  '/chat/history',
  '/chat/favorites',
  '/chat/templates',
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
