import { defineConfig } from 'wxt'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'IHUI AI',
    description: 'IHUI AI 浏览器助手',
    version: '1.0.0',
    minimum_chrome_version: '114',
    permissions: ['storage', 'activeTab', 'sidePanel', 'contextMenus', 'tabs', 'scripting', 'alarms'],
    host_permissions: ['http://localhost:8801/*', 'https://*.ihui.ai/*'],
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
    side_panel: {
      default_path: '/sidepanel.html',
    },
    action: {
      default_popup: 'popup.html',
      default_icon: {
        16: 'icon/16.png',
        32: 'icon/32.png',
        48: 'icon/48.png',
        128: 'icon/128.png',
      },
    },
    web_accessible_resources: [
      {
        resources: ['*.css', '*.svg'],
        // 2026-07-22 P0 Round 5 鲁棒性加固:收窄 matches 防 fingerprinting
        // 原 ['<all_urls>'] 允许任何网站引用扩展资源,可被钓鱼站点探测用户是否安装扩展
        // 收窄到 ihui.ai 域 + 本地开发环境(与 host_permissions 一致)
        matches: ['http://localhost:8801/*', 'https://*.ihui.ai/*'],
      },
    ],
  },
})
