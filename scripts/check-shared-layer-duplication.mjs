// 共享层重复检测守门脚本 (AGENTS.md S3 "shared-layer-first" 配套)
// 检测 apps/*/src 下是否有文件重新实现了 packages/shared 已提供的 hook/util
// 原理: 扫描 apps/*/src 下的 export 语句, 与 packages/shared/src 的 export 做交集
// 用法: node scripts/check-shared-layer-duplication.mjs
// 退出码: 0=通过, 1=发现重复
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, basename, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ===== 收集 packages/shared/src 的所有 export 名称 =====
const sharedExports = new Map() // exportName → filePath

function collectExports(dir, baseDir = dir) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      collectExports(fullPath, baseDir)
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.includes('.test.') && !entry.includes('.spec.')) {
      const content = readFileSync(fullPath, 'utf-8')
      // 匹配 export function/useXxx, export const useXxx, export { useXxx }
      const patterns = [
        /export\s+function\s+([A-Za-z_$][\w$]*)/g,
        /export\s+const\s+([A-Za-z_$][\w$]*)\s*[:=]/g,
        /export\s+\{[^}]*\b([A-Za-z_$][\w$]*)\b[^}]*\}/g,
        /export\s+type\s+([A-Za-z_$][\w$]*)/g,
        /export\s+interface\s+([A-Za-z_$][\w$]*)/g,
      ]
      for (const pattern of patterns) {
        let match
        while ((match = pattern.exec(content)) !== null) {
          const name = match[1]
          if (name && !sharedExports.has(name)) {
            sharedExports.set(name, relative(ROOT, fullPath))
          }
        }
      }
    }
  }
}

collectExports(join(ROOT, 'packages/shared/src'))
collectExports(join(ROOT, 'packages/types/src'))

// ===== 白名单:端内允许的独立实现(有合理理由不和 shared 共享) =====
// 格式: "appName/exportName" — 这些 export 虽与 shared 同名,但是合理的深度集成/平台 adapter
const whitelist = new Set([
  'web/useAgentRuntime', // web 深度集成版(集成 applyDiff/工具调用),shared 是依赖注入抽象
  'web/useAuth', // web 深度集成版(集成 next/navigation/react-query),shared 是纯逻辑层
  'web/useChat', // web 1678 行深度集成版(集成 store/router/applyDiff),shared 是依赖注入抽象
  'web/useClipboard', // 工厂模式: createUseClipboard + 浏览器 adapter,不是独立实现
  'web/useNotificationStore', // web 特有 notification store(集成浏览器 Notification API)
  'mobile-rn/useAuth', // RN AuthContext wrapper(集成 AsyncStorage),shared 是纯逻辑层
])

// ===== re-export wrapper 检测标识 =====
const reExportIndicators = [
  "from '@ihui/shared",
  'from "@ihui/shared',
  "export * from",
  'createUse', // 工厂模式
  'createAuth',
  'createTheme',
  'createAsyncStorage',
  'createSyncTransport',
]

// ===== 扫描 apps/*/src,找独立实现(非 re-export) =====
const apps = ['web', 'mobile-rn', 'miniapp-taro', 'extension', 'cli']
const violations = []

function scanAppDir(dir, appName) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      // 跳过 node_modules / .next / dist / __tests__
      if (['node_modules', '.next', 'dist', '__tests__', 'tests'].includes(entry)) continue
      scanAppDir(fullPath, appName)
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.includes('.test.') && !entry.includes('.spec.')) {
      const content = readFileSync(fullPath, 'utf-8')

      // 跳过 re-export wrapper(内容主要是 from '@ihui/shared')
      const isReExport = reExportIndicators.some((indicator) => content.includes(indicator))
      // 进一步检查:如果文件 < 30 行且包含 re-export indicator,肯定是 wrapper
      const lineCount = content.split('\n').length
      if (isReExport && lineCount < 50) continue

      // 检查是否有 export 与 shared 重名(且不是 re-export)
      const exportPatterns = [
        /export\s+function\s+(use[A-Z]\w*)/g,
        /export\s+const\s+(use[A-Z]\w*)\s*[:=]/g,
      ]
      for (const pattern of exportPatterns) {
        let match
        while ((match = pattern.exec(content)) !== null) {
          const exportName = match[1]
          if (sharedExports.has(exportName)) {
            // 白名单跳过(已确认是合理的深度集成/平台 adapter)
            if (whitelist.has(`${appName}/${exportName}`)) continue
            // 确认不是 re-export(检查 export 语句附近是否有 from)
            const lineStart = content.lastIndexOf('\n', match.index) + 1
            const lineEnd = content.indexOf('\n', match.index)
            const exportLine = content.slice(lineStart, lineEnd > 0 ? lineEnd : undefined)
            if (!exportLine.includes('from ')) {
              violations.push({
                appName,
                file: relative(ROOT, fullPath),
                exportName,
                sharedLocation: sharedExports.get(exportName),
                line: content.slice(0, match.index).split('\n').length,
              })
            }
          }
        }
      }
    }
  }
}

for (const app of apps) {
  const srcDir = join(ROOT, 'apps', app, 'src')
  if (existsSync(srcDir)) {
    scanAppDir(srcDir, app)
  }
}

// ===== 输出结果 =====
if (violations.length === 0) {
  console.log('✅ 共享层重复检测通过:未发现端内独立实现 shared 已提供的 hook')
  process.exit(0)
} else {
  console.error(`❌ 发现 ${violations.length} 处端内重复实现 shared hook:`)
  for (const v of violations) {
    console.error(`  ${v.appName}/${v.file}:${v.line} — export ${v.exportName}() 与 shared/${v.sharedLocation} 重复`)
  }
  console.error('\n修复:删除端内实现,改为 import { ' + violations[0].exportName + ' } from "@ihui/shared"')
  process.exit(1)
}
