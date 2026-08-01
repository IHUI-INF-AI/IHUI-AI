import { defineConfig } from 'wxt'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  // 2026-07-26 P0 修复:Node 17+ + Windows 把 localhost 解析为 ::1,Chrome 扩展页面
  // 用 127.0.0.1 解析 localhost 时连接被拒绝 → 显式绑 IPv4 127.0.0.1。
  // 注意:WXT dev 必须用顶层的 dev.server.hostname,vite.server.host 会被覆盖。
  dev: {
    server: {
      hostname: '127.0.0.1',
    },
  },
  manifest: {
    name: 'IHUI AI',
    description: 'IHUI AI 浏览器助手',
    version: '1.0.0',
    minimum_chrome_version: '114',
    permissions: [
      'storage',
      'activeTab',
      'sidePanel',
      'contextMenus',
      'tabs',
      'scripting',
      'alarms',
      // 2026-08-01 SSO 接入:chrome.identity.launchWebAuthFlow 打开 web SSO 登录页
      'identity',
    ],
    host_permissions: ['http://localhost:8802/*', 'https://*.aizhs.top/*'],
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
        // 收窄到 aizhs.top 域 + 本地开发环境(与 host_permissions 一致)
        matches: ['http://localhost:8802/*', 'https://*.aizhs.top/*'],
      },
    ],
  },
})
