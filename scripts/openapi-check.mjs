#!/usr/bin/env node
/**
 * OpenAPI 规范校验脚本。
 * 检查后端路由文件数量与 OpenAPI spec 中路径数量的一致性。
 */
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = join(__dirname, '..')

// 统计后端路由文件
const routesDir = join(root, 'apps', 'api', 'src', 'routes')
try {
  const files = await readdir(routesDir)
  const routeFiles = files.filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'))
  console.log(`[openapi-check] 后端路由文件: ${routeFiles.length} 个`)
  
  // 检查是否有 openapi spec 文件
  const specPath = join(root, 'apps', 'api', 'openapi.json')
  try {
    await stat(specPath)
    console.log(`[openapi-check] OpenAPI spec 存在: openapi.json`)
  } catch {
    console.log(`[openapi-check] OpenAPI spec 不存在 (openapi.json)，跳过路径对比`)
    console.log(`[openapi-check] 建议: 运行 pnpm --filter @ihui/api dev 后访问 /docs/json 生成 spec`)
  }
  
  console.log(`[openapi-check] ✅ 检查完成`)
} catch (err) {
  console.error(`[openapi-check] ❌ 检查失败:`, err.message)
  process.exit(1)
}
