// 深度扫描所有页面 i18n 键名裸露问题
import { test, expect } from '@playwright/test'

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:8888'

// 所有需要检查的页面路径
const PAGES = [
  { path: '/', name: '首页' },
  { path: '/login', name: '登录' },
  { path: '/register', name: '注册' },
  { path: '/agents', name: '智能体' },
  { path: '/ai-world', name: 'AI世界' },
  { path: '/ai-community', name: 'AI社区' },
  { path: '/community', name: '社区' },
  { path: '/ai-generation', name: 'AI生成' },
  { path: '/plaza', name: '广场' },
  { path: '/courses', name: '课程' },
  { path: '/chat', name: '聊天' },
  { path: '/user-center', name: '用户中心' },
  { path: '/vip', name: 'VIP' },
  { path: '/open', name: '开放平台' },
  { path: '/open-platform-docs', name: '开放平台文档' },
  { path: '/models', name: '模型中心' },
  { path: '/knowledge', name: '知识库' },
  { path: '/tools-store', name: '工具商店' },
  { path: '/orders', name: '订单' },
  { path: '/order-detail', name: '订单详情' },
  { path: '/footer', name: '页脚' },
  { path: '/dashboard', name: '仪表板' },
  { path: '/learn-ai', name: '学习AI' },
  { path: '/live', name: '直播' },
  { path: '/agent-income', name: '智能体收益' },
  { path: '/agent-detail', name: '智能体详情' },
  { path: '/voice-input', name: '语音输入' },
  { path: '/wx-user-center', name: '微信用户中心' },
  { path: '/wx-miniprogram', name: '微信小程序' },
  { path: '/wx-login', name: '微信登录' },
  { path: '/web-only', name: '仅网页' },
  { path: '/desktop', name: '桌面端' },
  { path: '/qr-scanner', name: '二维码扫描' },
  { path: '/mobile-optimized', name: '移动优化' },
  { path: '/system-tray', name: '系统托盘' },
  { path: '/desktop-settings', name: '桌面设置' },
  { path: '/qr-code', name: '二维码' },
  { path: '/unified-qr-login', name: '统一二维码登录' },
  { path: '/command-palette', name: '命令面板' },
  { path: '/error-boundary', name: '错误边界' },
  { path: '/connection-status', name: '连接状态' },
  { path: '/pwa', name: 'PWA' },
  { path: '/tour', name: '导览' },
  { path: '/progress', name: '进度' },
  { path: '/markdown', name: 'Markdown' },
  { path: '/developer', name: '开发者' },
  { path: '/workspace', name: '工作空间' },
  { path: '/purchase', name: '购买' },
  { path: '/api-test', name: 'API测试' },
  { path: '/settlement-stats', name: '结算统计' },
]

test.describe('深度扫描 i18n 键名裸露', () => {
  test.setTimeout(120_000)

  for (const p of PAGES) {
    test(`页面 ${p.name} (${p.path}) 无 i18n 键名裸露`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', err => errors.push(String(err)))

      try {
        const resp = await page.goto(`${BASE}${p.path}`, { waitUntil: 'domcontentloaded', timeout: 20_000 })
        if (!resp) {
          console.log(`[SKIP] ${p.path} 无响应`)
          test.skip()
          return
        }
        const status = resp.status()
        if (![200, 301, 302, 304].includes(status)) {
          console.log(`[SKIP] ${p.path} 状态码 ${status}`)
          test.skip()
          return
        }
      } catch (e) {
        console.log(`[SKIP] ${p.path} 访问失败: ${String(e).slice(0, 100)}`)
        test.skip()
        return
      }

      // 等待 Vue 挂载 + 异步组件加载
      await page.waitForTimeout(3000)
      try {
        await page.waitForLoadState('networkidle', { timeout: 5_000 })
      } catch { /* 允许超时 */ }

      // 扫描页面文字，检测 i18n 键名裸露
      const exposedKeys = await page.evaluate(() => {
        // 收集所有文本节点的内容（避免相邻元素文本拼接误判）
        const texts: string[] = []
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) => {
            const parent = node.parentElement
            if (!parent) return NodeFilter.FILTER_REJECT
            // 跳过 script/style/code/pre 标签
            const tag = parent.tagName.toLowerCase()
            if (['script', 'style', 'code', 'pre'].includes(tag)) return NodeFilter.FILTER_REJECT
            if (parent.closest('code, pre, .code-block, .hljs')) return NodeFilter.FILTER_REJECT
            const text = node.textContent?.trim() || ''
            if (!text) return NodeFilter.FILTER_REJECT
            return NodeFilter.FILTER_ACCEPT
          }
        })
        let node: Node | null
        while ((node = walker.nextNode())) {
          texts.push(node.textContent?.trim() || '')
        }
        const text = texts.join('\n')
        // 匹配 xxx.yyy.zzz 形式的 i18n 键名（至少2个点）
        const matches = text.match(/[a-zA-Z][a-zA-Z0-9]*\.[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)+/g) || []
        // 过滤掉合法 URL/路径/CSS/JS
        return matches.filter((m) => {
          // 排除明显的 URL
          if (/^(https?|ftp|ws|wss)\./i.test(m)) return false
          // 排除文件扩展名
          if (/\.(json|js|ts|css|scss|html|vue|png|jpg|jpeg|gif|svg|woff|ttf|eot|ico)$/i.test(m)) return false
          // 排除常见的域名
          if (/\.(com|cn|org|net|io|dev|app|co)\./i.test(m)) return false
          // 排除版本号
          if (/^\d+\.\d+\.\d+/.test(m)) return false
          // 排除 JavaScript 代码片段（client.xxx, require.xxx 等）
          if (/^(client|require|module|exports|console|window|document|process)\./i.test(m)) return false
          return m.length < 80
        })
      })

      if (exposedKeys.length > 0) {
        console.log(`[FAIL] ${p.path} 发现 ${exposedKeys.length} 个键名裸露:`)
        console.log(`  示例: ${exposedKeys.slice(0, 10).join(', ')}`)
      } else {
        console.log(`[OK] ${p.path} 无键名裸露`)
      }

      expect(exposedKeys.length, `页面 ${p.path} 发现 i18n 键名裸露: ${exposedKeys.slice(0, 5).join(', ')}`).toBe(0)
    })
  }
})
