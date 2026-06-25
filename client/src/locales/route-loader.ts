/**
 * 路由语言模块加载器
 * 进入路由时预加载对应 i18n 语言模块，避免页面显示 i18n 键名
 */

import type { Router } from 'vue-router'
import { getCurrentLocale, loadModule, loadModules } from '@/locales'

const adminModules = [
  'exam', 'learn', 'circle', 'comment', 'org', 'member', 'article',
  'setting', 'adminAuth', 'resource', 'point', 'live', 'message',
  'certificate', 'ask', 'search', 'account', 'adminCommon',
  'migrationAdmin', 'notificationCenter', 'answerDetail',
  'settlement', 'agentExamine',
]

// 路由路径前缀到 i18n 模块的映射
const pathModuleMap: Array<{ prefix: string; module: string }> = [
  { prefix: '/ai-world', module: 'aiWorld' },
  { prefix: '/ai-community', module: 'aiCommunity' },
  { prefix: '/community', module: 'community' },
  { prefix: '/ai-generation', module: 'aiGeneration' },
  { prefix: '/open-platform-docs', module: 'openPlatformDocs' },
  { prefix: '/open', module: 'openPlatform' },
  { prefix: '/agents', module: 'agentCategory' },
  { prefix: '/agent-detail', module: 'agentDetail' },
  { prefix: '/agent-income', module: 'agentIncome' },
  { prefix: '/orders', module: 'orders' },
  { prefix: '/order-detail', module: 'orderDetail' },
  { prefix: '/models', module: 'models' },
  { prefix: '/knowledge', module: 'knowledgeDetail' },
  { prefix: '/tools-store', module: 'toolsStore' },
  { prefix: '/voice-input', module: 'voiceInput' },
  { prefix: '/wx-user-center', module: 'wxUserCenter' },
  { prefix: '/wx-miniprogram', module: 'wxMiniprogram' },
  { prefix: '/wx-login', module: 'wxLogin' },
  { prefix: '/web-only', module: 'webOnlyFeature' },
  { prefix: '/desktop-settings', module: 'desktopSettings' },
  { prefix: '/qr-scanner', module: 'qrScanner' },
  { prefix: '/mobile-optimized', module: 'mobileOptimized' },
  { prefix: '/system-tray', module: 'systemTray' },
  { prefix: '/desktop', module: 'desktopExperience' },
  { prefix: '/qr-code', module: 'qrCode' },
  { prefix: '/unified-qr-login', module: 'unifiedQRLogin' },
  { prefix: '/register', module: 'register' },
  { prefix: '/command-palette', module: 'commandPalette' },
  { prefix: '/error-boundary', module: 'errorBoundary' },
  { prefix: '/connection-status', module: 'connectionStatus' },
  { prefix: '/pwa', module: 'pwa' },
  { prefix: '/tour', module: 'tour' },
  { prefix: '/progress', module: 'progress' },
  { prefix: '/markdown', module: 'markdown' },
  { prefix: '/developer', module: 'developer' },
  { prefix: '/workspace', module: 'workspace' },
  { prefix: '/purchase', module: 'purchase' },
  { prefix: '/api-test', module: 'apiTest' },
  { prefix: '/settlement-stats', module: 'cmpindex' },
  { prefix: '/dashboard', module: 'dashboard' },
  { prefix: '/learn-ai', module: 'learn' },
  { prefix: '/learn', module: 'learn' },
  { prefix: '/live', module: 'live' },
  { prefix: '/vip', module: 'vip' },
  { prefix: '/footer', module: 'footer' },
  { prefix: '/support/document-center', module: 'help' },
  { prefix: '/app', module: 'app' },
]

export function setupRouteLanguageLoader(router: Router) {
  router.beforeEach(async (to, _from, next) => {
    // 根据路径前缀加载对应 i18n 模块
    for (const { prefix, module } of pathModuleMap) {
      if (to.path === prefix || to.path.startsWith(prefix + '/') || to.path.startsWith(prefix + '-')) {
        try {
          await loadModule(getCurrentLocale(), module)
        } catch {
          // 加载失败也放行，仅翻译会回退为键名
        }
        break
      }
    }
    // /open 路径额外加载 openPlatform 模块（兼容旧逻辑）
    if (to.path.startsWith('/open')) {
      try {
        await loadModule(getCurrentLocale(), 'openPlatform')
      } catch {
        // 加载失败也放行
      }
    }
    // /admin 路径批量加载管理后台模块
    if (to.path.startsWith('/admin')) {
      try {
        await loadModules(getCurrentLocale(), adminModules)
      } catch {
        // 加载失败也放行
      }
    }
    // Footer 是全局组件，每次路由跳转确保 footer 模块已加载
    try {
      await loadModule(getCurrentLocale(), 'footer')
    } catch {
      // 加载失败也放行
    }
    next()
  })
}

export default { setupRouteLanguageLoader }
