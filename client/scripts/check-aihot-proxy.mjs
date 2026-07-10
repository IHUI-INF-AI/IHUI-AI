/**
 * pre-commit 守门脚本: 检查 AI HOT 资讯代理配置完整性
 *
 * 检查项:
 *   1. vite.config.ts 含 /aihot-api 代理配置
 *   2. nginx.conf 含 /aihot-api/ location 块
 *   3. aihot-news.ts 服务层存在且导出正确
 *   4. useAiHotNews.ts 组合式函数存在且导出正确
 *
 * 用法: node scripts/check-aihot-proxy.mjs
 * 退出码: 0=通过, 1=失败
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

let errors = []

function checkFile(label, filePath, patterns) {
  const fullPath = resolve(root, filePath)
  if (!existsSync(fullPath)) {
    errors.push(`[${label}] 文件不存在: ${filePath}`)
    return
  }
  const content = readFileSync(fullPath, 'utf-8')
  for (const { name, regex } of patterns) {
    if (!regex.test(content)) {
      errors.push(`[${label}] 缺少: ${name}`)
    }
  }
}

// 1. vite.config.ts 代理配置
checkFile('vite', 'vite.config.ts', [
  { name: '/aihot-api 代理路径', regex: /['"]\/aihot-api['"]/ },
  { name: 'aihot.virxact.com 目标', regex: /aihot\.virxact\.com/ },
  { name: 'User-Agent header 注入', regex: /User-Agent/i },
])

// 2. nginx.conf 代理配置
checkFile('nginx', '../nginx.conf', [
  { name: '/aihot-api/ location 块', regex: /location\s+\/aihot-api\// },
  { name: 'proxy_pass 到 aihot', regex: /proxy_pass\s+https:\/\/aihot\.virxact\.com/ },
  { name: 'proxy_ssl_server_name on', regex: /proxy_ssl_server_name\s+on/ },
  { name: 'User-Agent header', regex: /User-Agent/ },
])

// 3. 服务层
checkFile('service', 'src/services/aihot-news.ts', [
  { name: 'fetchAiHotItems 导出', regex: /export\s+async\s+function\s+fetchAiHotItems/ },
  { name: 'fetchAiHotDaily 导出', regex: /export\s+async\s+function\s+fetchAiHotDaily/ },
  { name: 'fetchAiHotDailies 导出', regex: /export\s+async\s+function\s+fetchAiHotDailies/ },
  { name: 'countSources 导出', regex: /export\s+function\s+countSources/ },
  { name: 'IndexedDB 持久化', regex: /persistToIndexedDB/ },
])

// 4. 组合式函数
checkFile('composable', 'src/composables/useAiHotNews.ts', [
  { name: 'useAiHotNews 导出', regex: /export\s+function\s+useAiHotNews/ },
  { name: 'loadMore 方法', regex: /async\s+function\s+loadMore/ },
  { name: 'setCategory 方法', regex: /function\s+setCategory/ },
  { name: 'search 方法', regex: /async\s+function\s+search/ },
  { name: 'toggleDaily 方法', regex: /function\s+toggleDaily/ },
  { name: 'IndexedDB 降级', regex: /loadFromIndexedDB/ },
])

// 5. 组件引用
checkFile('component', 'src/components/home/HomePage3.vue', [
  { name: 'useAiHotNews 导入', regex: /import.*useAiHotNews/ },
  { name: 'aiHot.load() 并行调用', regex: /aiHot\.load\(\)/ },
  { name: '日报面板', regex: /ai-daily-panel/ },
  { name: '搜索框', regex: /ai-hot-bar__search/ },
  { name: '信源筛选', regex: /ai-source-dropdown/ },
  { name: '分类筛选', regex: /ai-cat-bar/ },
])

// 输出结果
if (errors.length === 0) {
  console.log('\x1b[32m✓ AI HOT 资讯代理配置完整性检查通过\x1b[0m')
  console.log('  - vite.config.ts: 代理配置 ✓')
  console.log('  - nginx.conf: 生产代理 ✓')
  console.log('  - aihot-news.ts: 服务层 ✓')
  console.log('  - useAiHotNews.ts: 组合式函数 ✓')
  console.log('  - HomePage3.vue: 组件集成 ✓')
  process.exit(0)
} else {
  console.error('\x1b[31m✗ AI HOT 资讯代理配置完整性检查失败\x1b[0m')
  for (const err of errors) {
    console.error(`  ${err}`)
  }
  process.exit(1)
}
