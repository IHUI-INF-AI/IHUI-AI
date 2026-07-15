import { defineConfig } from 'wxt'

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'IHUI AI',
    description: 'IHUI AI 浏览器助手',
    version: '0.0.0',
    permissions: ['storage', 'activeTab', 'sidePanel'],
    host_permissions: ['http://localhost:3000/*', 'https://*.ihui.ai/*'],
    side_panel: {
      default_path: '/sidepanel.html',
    },
    action: {
      default_popup: 'popup.html',
    },
  },
})
